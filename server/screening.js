// Company screening: orgs, roles, invite links, the candidate interview and the reviewer reports.
// Candidates never get a user account. They hold a hashed, expiring invite session instead.
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { ServiceError } from "./ai.js";
import { answerOf, decideTurn, tidyQuestion } from "./turn.js";
import {
  answerSchema,
  questionSchema,
  roleConfigSchema,
  screeningEvaluationSchema,
  screeningReportSchema,
} from "./schemas.js";

export const CONSENT_VERSION = "2026-11-14";
const DAY = 86400000;
const fail = (status, message) => {
  throw new ServiceError(status, message);
};
const iso = () => new Date().toISOString();
const today = () => iso().slice(0, 10);
const COOKIE = "ia_candidate";
const CLIENT_EVENTS = [
  "tab_hidden",
  "fullscreen_exit",
  "face_absent",
  "multiple_faces",
  "camera_off",
  "paste",
];
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Candidates see questions and their own words, never scores, rubric or reports.
export const candidateView = (session) => ({
  id: session.id,
  state: session.state,
  created: session.created,
  setup: {
    role: session.setup.role,
    track: session.setup.track,
    questionCount: session.setup.questionCount,
    company: session.setup.company,
  },
  currentQuestion: session.currentQuestion,
  turns: session.turns.map((t) => ({ question: t.question, answer: t.answer })),
  clarifications: session.clarifications || {},
});

const openingTask = (rubric) =>
  `Open the interview the way a warm, experienced human interviewer would. lead: one or two short spoken sentences introducing yourself as Maya, an AI interviewer working for the company in setup.company, naming the role and putting the candidate at ease. question: ONE concrete situational question for this role, drawn from setup.jobDescription, answerable in about two minutes of speech, at most 45 words with exactly one question mark. The question must describe a concrete scenario or task; never ask for an overview, background, summary or résumé walk-through. The lead is at most 25 words, ends with a full stop, and never asks or requests anything. The rubric competencies are ${rubric.map((r) => r.label).join(", ")}; prefer a scenario that lets the candidate show one of them. Do not provide the answer.`;

export function registerScreening(
  app,
  { db, ai, auth, locked, authLimit, hash, secure, origin, allowed },
) {
  // ----- shared helpers -----
  const orgUsage = (orgId, add) =>
    db
      .prepare(
        "INSERT INTO org_usage(org_id,day,screenings,speech_calls,input_tokens,output_tokens) VALUES (?,?,?,?,?,?) ON CONFLICT(org_id,day) DO UPDATE SET screenings=screenings+excluded.screenings, speech_calls=speech_calls+excluded.speech_calls, input_tokens=input_tokens+excluded.input_tokens, output_tokens=output_tokens+excluded.output_tokens",
      )
      .run(
        orgId,
        today(),
        add.screenings || 0,
        add.speech || 0,
        add.input || 0,
        add.output || 0,
      );
  const tokenUsage = (orgId, usage) =>
    orgUsage(orgId, { input: usage.input, output: usage.output });
  const status = (invite) =>
    ["pending", "started"].includes(invite.status) &&
    invite.expires < Date.now()
      ? "expired"
      : invite.status;
  const link = (token) => `${origin}/interviewace/join#t=${token}`;
  const newToken = () => randomBytes(32).toString("hex");

  function member(user, orgId, min = "reviewer") {
    const row = db
      .prepare("SELECT role FROM org_members WHERE org_id=? AND user_id=?")
      .get(orgId, user.id);
    // 404, not 403: ids from other companies must not be confirmable.
    if (!row) fail(404, "Not found.");
    if (min === "owner" && row.role !== "owner")
      fail(403, "Only an owner can do that.");
    return row.role;
  }
  function loadRole(req, min) {
    const role = db
      .prepare("SELECT * FROM roles WHERE id=?")
      .get(req.params.roleId);
    if (!role) fail(404, "Not found.");
    member(req.user, role.org_id, min);
    return { ...role, config: JSON.parse(role.config) };
  }
  function loadInvite(req, min) {
    const invite = db
      .prepare(
        "SELECT i.*, r.org_id, r.config, r.status AS role_status, o.name AS org_name, o.retention_days, o.contact_email FROM invites i JOIN roles r ON r.id=i.role_id JOIN orgs o ON o.id=r.org_id WHERE i.id=?",
      )
      .get(req.params.inviteId);
    if (!invite) fail(404, "Not found.");
    member(req.user, invite.org_id, min);
    return { ...invite, config: JSON.parse(invite.config) };
  }
  const readScreening = (inviteId) => {
    const row = db
      .prepare("SELECT * FROM screenings WHERE invite_id=?")
      .get(inviteId);
    return row && { row, session: JSON.parse(row.data) };
  };
  const saveScreening = (inviteId, session, score = null) =>
    db
      .prepare(
        "UPDATE screenings SET state=?, data=?, score=COALESCE(?, score) WHERE invite_id=?",
      )
      .run(session.state, JSON.stringify(session), score, inviteId);

  // Retention: a company's candidate data is deleted after its own window. Runs at startup and on listing.
  function purge() {
    db.prepare(
      "DELETE FROM invites WHERE id IN (SELECT i.id FROM invites i JOIN roles r ON r.id=i.role_id JOIN orgs o ON o.id=r.org_id WHERE i.created < strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || o.retention_days || ' days'))",
    ).run();
    db.prepare("DELETE FROM candidate_sessions WHERE expires < ?").run(
      Date.now(),
    );
  }
  purge();

  // ----- scoring (shared by candidate completion and lazy report generation) -----
  const scoring = new Map();
  function scoreLater(inviteId, index, config, company) {
    const key = `${inviteId}:${index}`;
    if (scoring.has(key)) return scoring.get(key);
    const job = (async () => {
      const current = readScreening(inviteId);
      const turn = current?.session.turns[index];
      if (!turn || turn.evaluation) return;
      const generated = await ai.generate(
        screeningEvaluationSchema(config.rubric),
        "Score the candidate's answer against each rubric competency (0-100), quote evidence verbatim from the answer for strengths and concerns, and add a short rationale. If the answer is empty or evasive, score low and say so; do not invent evidence.",
        {
          company,
          role: config.title,
          rubric: config.rubric,
          question: turn.question,
          conversationBeforeAnswer: turn.exchanges || [],
          answer: turn.answer,
        },
        { mode: "screening" },
      );
      // Quotes the model invented are dropped; only text the candidate really said reaches the report.
      const said = normalize(turn.answer);
      const verified = generated.value.evidence.filter((e) =>
        said.includes(normalize(e.quote)),
      );
      const fresh = readScreening(inviteId);
      if (!fresh?.session.turns[index] || fresh.session.turns[index].evaluation)
        return;
      fresh.session.turns[index].evaluation = {
        ...generated.value,
        evidence: verified,
        evidenceDropped: generated.value.evidence.length - verified.length,
      };
      db.transaction(() => {
        saveScreening(inviteId, fresh.session);
        const org = db
          .prepare(
            "SELECT r.org_id FROM invites i JOIN roles r ON r.id=i.role_id WHERE i.id=?",
          )
          .get(inviteId);
        if (org) tokenUsage(org.org_id, generated.usage);
      })();
    })().finally(() => scoring.delete(key));
    scoring.set(key, job);
    return job;
  }

  async function finishReport(invite) {
    let { session } = readScreening(invite.id);
    if (session.report) return session;
    if (!session.turns.length) fail(400, "No answers were submitted.");
    for (const [i, turn] of session.turns.entries())
      if (!turn.evaluation)
        await scoreLater(invite.id, i, invite.config, invite.org_name);
    session = readScreening(invite.id).session;
    if (session.turns.some((turn) => !turn.evaluation))
      fail(
        502,
        "Some answers are still being scored. Please retry in a moment.",
      );
    const { rubric } = invite.config;
    const generated = await ai.generate(
      screeningReportSchema,
      "Write a short, evidence-based screening summary for the hiring team: strengths, concerns, and follow-up questions for a human interviewer. Use only what the candidate said; never invent performance and never recommend hiring or rejecting.",
      {
        company: invite.org_name,
        role: invite.config.title,
        rubric,
        turns: session.turns.map((t) => ({
          question: t.question.question,
          answer: t.answer.slice(0, 1500),
          scores: t.evaluation.scores,
          rationale: t.evaluation.rationale,
        })),
      },
      { mode: "screening" },
    );
    const competencyScores = Object.fromEntries(
      rubric.map((r) => [
        r.key,
        Math.round(
          session.turns.reduce(
            (n, t) => n + (t.evaluation.scores[r.key] ?? 0),
            0,
          ) / session.turns.length,
        ),
      ]),
    );
    const weights = rubric.reduce((n, r) => n + r.weight, 0);
    const overall = Math.round(
      rubric.reduce((n, r) => n + competencyScores[r.key] * r.weight, 0) /
        weights,
    );
    session.report = {
      ...generated.value,
      competencyScores,
      overall,
      answered: session.turns.length,
      questionCount: session.setup.questionCount,
    };
    session.state = "complete";
    session.currentQuestion = null;
    // The role keeps the job description; the per-candidate copy is not needed after completion.
    session.setup.jobDescription = "";
    db.transaction(() => {
      saveScreening(invite.id, session, overall);
      db.prepare("UPDATE invites SET status='completed' WHERE id=?").run(
        invite.id,
      );
      tokenUsage(invite.org_id, generated.usage);
    })();
    return session;
  }

  // ===== Company API =====
  app.post("/api/orgs", auth, (req, res) => {
    if (!allowed(req.user))
      fail(
        403,
        "Company screening is limited to approved pilot accounts for now.",
      );
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        contactEmail: z
          .string()
          .trim()
          .email()
          .max(254)
          .or(z.literal(""))
          .default(""),
      })
      .strict()
      .parse(req.body);
    const id = randomUUID();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO orgs(id,name,contact_email,created) VALUES (?,?,?,?)",
      ).run(id, input.name, input.contactEmail, iso());
      db.prepare(
        "INSERT INTO org_members(org_id,user_id,role,created) VALUES (?,?,?,?)",
      ).run(id, req.user.id, "owner", iso());
    })();
    res.status(201).json({
      id,
      name: input.name,
      role: "owner",
      contactEmail: input.contactEmail,
      retentionDays: 180,
    });
  });

  app.get("/api/orgs", auth, (req, res) => {
    purge();
    res.json({
      canCreate: allowed(req.user),
      orgs: db
        .prepare(
          "SELECT o.id, o.name, o.contact_email AS contactEmail, o.retention_days AS retentionDays, m.role FROM orgs o JOIN org_members m ON m.org_id=o.id WHERE m.user_id=? ORDER BY o.created",
        )
        .all(req.user.id),
    });
  });

  app.patch("/api/orgs/:orgId", auth, (req, res) => {
    member(req.user, req.params.orgId, "owner");
    const input = z
      .object({
        name: z.string().trim().min(2).max(100).optional(),
        contactEmail: z
          .string()
          .trim()
          .email()
          .max(254)
          .or(z.literal(""))
          .optional(),
        retentionDays: z.number().int().min(30).max(730).optional(),
      })
      .strict()
      .parse(req.body);
    const org = db
      .prepare("SELECT * FROM orgs WHERE id=?")
      .get(req.params.orgId);
    db.prepare(
      "UPDATE orgs SET name=?, contact_email=?, retention_days=? WHERE id=?",
    ).run(
      input.name ?? org.name,
      input.contactEmail ?? org.contact_email,
      input.retentionDays ?? org.retention_days,
      org.id,
    );
    res.json({ ok: true });
  });

  app.get("/api/orgs/:orgId/roles", auth, (req, res) => {
    member(req.user, req.params.orgId);
    const rows = db
      .prepare(
        "SELECT id, title, status, config, created FROM roles WHERE org_id=? ORDER BY created DESC",
      )
      .all(req.params.orgId);
    const counts = db.prepare(
      "SELECT status, expires, COUNT(*) n FROM invites WHERE role_id=? GROUP BY status, expires",
    );
    res.json(
      rows.map((r) => {
        const config = JSON.parse(r.config);
        const tally = { total: 0, pending: 0, started: 0, completed: 0 };
        for (const c of counts.all(r.id)) {
          tally.total += c.n;
          if (tally[c.status] !== undefined) tally[c.status] += c.n;
        }
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          created: r.created,
          role: config.role,
          track: config.track,
          questionCount: config.questionCount,
          ...tally,
        };
      }),
    );
  });

  app.post("/api/orgs/:orgId/roles", auth, (req, res) => {
    member(req.user, req.params.orgId, "owner");
    const config = roleConfigSchema.parse(req.body);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO roles(id,org_id,title,status,config,created_by,created) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id,
      req.params.orgId,
      config.title,
      "open",
      JSON.stringify(config),
      req.user.id,
      iso(),
    );
    res.status(201).json({ id });
  });

  app.get("/api/roles/:roleId", auth, (req, res) => {
    const role = loadRole(req);
    const started = db
      .prepare(
        "SELECT COUNT(*) n FROM invites WHERE role_id=? AND status IN ('started','completed')",
      )
      .get(role.id).n;
    res.json({
      id: role.id,
      title: role.title,
      status: role.status,
      config: role.config,
      locked: started > 0,
    });
  });

  app.patch("/api/roles/:roleId", auth, (req, res) => {
    const role = loadRole(req, "owner");
    const input = z
      .object({
        status: z.enum(["open", "closed"]).optional(),
        config: roleConfigSchema.optional(),
      })
      .strict()
      .parse(req.body);
    if (input.config) {
      const started = db
        .prepare(
          "SELECT COUNT(*) n FROM invites WHERE role_id=? AND status IN ('started','completed')",
        )
        .get(role.id).n;
      // Every candidate on a role must be scored against the same rubric.
      if (started)
        fail(
          409,
          "This role has started interviews. Create a new role to change the rubric.",
        );
      db.prepare("UPDATE roles SET config=?, title=? WHERE id=?").run(
        JSON.stringify(input.config),
        input.config.title,
        role.id,
      );
    }
    if (input.status)
      db.prepare("UPDATE roles SET status=? WHERE id=?").run(
        input.status,
        role.id,
      );
    res.json({ ok: true });
  });

  app.post("/api/roles/:roleId/invites", auth, (req, res) => {
    const role = loadRole(req);
    if (role.status !== "open") fail(409, "This role is closed.");
    const { candidates } = z
      .object({
        candidates: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(100),
              email: z
                .string()
                .trim()
                .email()
                .max(254)
                .transform((e) => e.toLowerCase()),
            }),
          )
          .min(1)
          .max(50),
      })
      .strict()
      .parse(req.body);
    const created = [];
    const skipped = [];
    const insert = db.prepare(
      "INSERT INTO invites(id,role_id,token_hash,candidate_name,candidate_email,status,expires,created) VALUES (?,?,?,?,?,'pending',?,?)",
    );
    for (const c of candidates) {
      const token = newToken();
      const id = randomUUID();
      try {
        insert.run(
          id,
          role.id,
          hash(token),
          c.name,
          c.email,
          Date.now() + role.config.inviteDays * DAY,
          iso(),
        );
        created.push({ id, name: c.name, email: c.email, link: link(token) });
      } catch (error) {
        if (error.code !== "SQLITE_CONSTRAINT_UNIQUE") throw error;
        skipped.push({
          email: c.email,
          reason: "Already invited to this role",
        });
      }
    }
    // Links are shown once; only their hashes are stored.
    res.status(201).json({ invites: created, skipped });
  });

  app.post("/api/invites/:inviteId/revoke", auth, (req, res) => {
    const invite = loadInvite(req);
    if (!["pending", "started"].includes(invite.status))
      fail(409, "This invite can no longer be revoked.");
    db.transaction(() => {
      db.prepare("UPDATE invites SET status='revoked' WHERE id=?").run(
        invite.id,
      );
      db.prepare("DELETE FROM candidate_sessions WHERE invite_id=?").run(
        invite.id,
      );
    })();
    res.json({ ok: true });
  });

  app.post("/api/invites/:inviteId/reissue", auth, (req, res) => {
    const invite = loadInvite(req);
    if (["completed", "withdrawn"].includes(invite.status))
      fail(409, "This interview is already finished.");
    const token = newToken();
    const started = readScreening(invite.id);
    db.transaction(() => {
      db.prepare(
        "UPDATE invites SET token_hash=?, expires=?, status=? WHERE id=?",
      ).run(
        hash(token),
        Date.now() + invite.config.inviteDays * DAY,
        started ? "started" : "pending",
        invite.id,
      );
      db.prepare("DELETE FROM candidate_sessions WHERE invite_id=?").run(
        invite.id,
      );
    })();
    res.json({ link: link(token) });
  });

  const rank = (a, b) => {
    const order = {
      completed: 0,
      started: 1,
      pending: 2,
      expired: 3,
      revoked: 4,
      withdrawn: 5,
    };
    return (
      order[a.status] - order[b.status] ||
      (b.score ?? -1) - (a.score ?? -1) ||
      (a.completed || "").localeCompare(b.completed || "")
    );
  };
  function candidateRows(role) {
    return db
      .prepare(
        "SELECT i.id, i.candidate_name AS name, i.candidate_email AS email, i.status, i.expires, i.decision, i.created, s.score, s.state, s.data, (SELECT COUNT(*) FROM integrity_events e WHERE e.invite_id=i.id AND e.reviewed_at IS NULL AND e.kind NOT IN ('reconnect','new_device')) AS unreviewedFlags FROM invites i LEFT JOIN screenings s ON s.invite_id=i.id WHERE i.role_id=?",
      )
      .all(role.id)
      .map((r) => {
        const session = r.data ? JSON.parse(r.data) : null;
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          status: status(r),
          created: r.created,
          expires: r.expires,
          score: r.state === "complete" ? r.score : null,
          competencyScores: session?.report?.competencyScores || null,
          answered: session?.turns.length || 0,
          questionCount: role.config.questionCount,
          unreviewedFlags: r.unreviewedFlags,
          decision: r.decision ? JSON.parse(r.decision) : null,
        };
      })
      .sort(rank);
  }
  app.get("/api/roles/:roleId/candidates", auth, (req, res) => {
    const role = loadRole(req);
    res.json({
      role: {
        id: role.id,
        title: role.title,
        status: role.status,
        rubric: role.config.rubric,
        questionCount: role.config.questionCount,
      },
      candidates: candidateRows(role),
    });
  });

  app.get("/api/invites/:inviteId/report", auth, async (req, res) =>
    locked(req.params.inviteId, async () => {
      const invite = loadInvite(req);
      let found = readScreening(invite.id);
      if (found?.session.state === "report_pending") {
        await finishReport(invite);
        found = readScreening(invite.id);
      }
      const events = db
        .prepare(
          "SELECT id, at, turn, kind, duration_ms AS durationMs, reviewed_at AS reviewedAt, verdict, review_note AS reviewNote FROM integrity_events WHERE invite_id=? ORDER BY at",
        )
        .all(invite.id);
      const session = found?.session || null;
      res.json({
        invite: {
          id: invite.id,
          name: invite.candidate_name,
          email: invite.candidate_email,
          status: status(invite),
          decision: invite.decision ? JSON.parse(invite.decision) : null,
          candidateNote: invite.candidate_note,
          consent: invite.consent ? JSON.parse(invite.consent) : null,
        },
        role: {
          id: invite.role_id,
          title: invite.config.title,
          rubric: invite.config.rubric,
          questionCount: invite.config.questionCount,
        },
        screening: session && {
          state: session.state,
          turns: session.turns.map((t, i) => ({
            question: t.question,
            answer: t.answer,
            exchanges: t.exchanges || [],
            evaluation: t.evaluation || null,
            events: events.filter((e) => e.turn === i),
          })),
          currentQuestion: session.currentQuestion,
          report: session.report,
        },
        events,
      });
    }),
  );

  app.post("/api/invites/:inviteId/decision", auth, (req, res) => {
    const invite = loadInvite(req);
    const input = z
      .object({
        status: z.enum(["advance", "hold", "reject"]),
        note: z.string().trim().max(1000).default(""),
      })
      .strict()
      .parse(req.body);
    // A person records every decision; nothing in the product rejects a candidate on its own.
    const decision = { ...input, by: req.user.name, at: iso() };
    db.prepare("UPDATE invites SET decision=? WHERE id=?").run(
      JSON.stringify(decision),
      invite.id,
    );
    res.json({ decision });
  });

  app.post("/api/invites/:inviteId/integrity-review", auth, (req, res) => {
    const invite = loadInvite(req);
    const input = z
      .object({
        eventIds: z.array(z.number().int()).min(1).max(200),
        verdict: z.enum(["no_concern", "concern"]),
        note: z.string().trim().max(500).default(""),
      })
      .strict()
      .parse(req.body);
    const update = db.prepare(
      "UPDATE integrity_events SET reviewed_by=?, reviewed_at=?, verdict=?, review_note=? WHERE id=? AND invite_id=?",
    );
    db.transaction(() => {
      for (const id of input.eventIds)
        update.run(
          req.user.id,
          iso(),
          input.verdict,
          input.note,
          id,
          invite.id,
        );
    })();
    res.json({ ok: true });
  });

  app.delete("/api/invites/:inviteId", auth, (req, res) => {
    const invite = loadInvite(req, "owner");
    db.prepare("DELETE FROM invites WHERE id=?").run(invite.id);
    res.json({ ok: true });
  });

  app.get("/api/roles/:roleId/export.csv", auth, (req, res) => {
    const role = loadRole(req);
    // Spreadsheet formulas in names or emails must not run when a reviewer opens the file.
    const cell = (v) => {
      const text = String(v ?? "");
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const keys = role.config.rubric.map((r) => r.key);
    const lines = [
      [
        "Name",
        "Email",
        "Status",
        "Overall (AI estimate)",
        ...role.config.rubric.map((r) => r.label),
        "Answered",
        "Decision",
        "Unreviewed flags",
      ]
        .map(cell)
        .join(","),
      ...candidateRows(role).map((c) =>
        [
          c.name,
          c.email,
          c.status,
          c.score,
          ...keys.map((k) => c.competencyScores?.[k]),
          `${c.answered}/${c.questionCount}`,
          c.decision?.status,
          c.unreviewedFlags,
        ]
          .map(cell)
          .join(","),
      ),
    ];
    res
      .type("text/csv")
      .set("Content-Disposition", 'attachment; filename="candidates.csv"')
      .send(lines.join("\r\n"));
  });

  // ===== Candidate API =====
  function resolveCandidate(req) {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const row = db
      .prepare(
        "SELECT i.*, r.org_id, r.config, r.status AS role_status, o.name AS org_name, o.retention_days, o.contact_email FROM candidate_sessions c JOIN invites i ON i.id=c.invite_id JOIN roles r ON r.id=i.role_id JOIN orgs o ON o.id=r.org_id WHERE c.token=? AND c.expires>?",
      )
      .get(hash(token), Date.now());
    return row && { ...row, config: JSON.parse(row.config) };
  }
  function candidateAuth(req, _res, next) {
    const invite = resolveCandidate(req);
    if (!invite || invite.status === "revoked")
      return next(
        new ServiceError(
          401,
          "This link has expired or was replaced on another device.",
        ),
      );
    req.candidate = invite;
    next();
  }
  function summary(invite) {
    const found = readScreening(invite.id);
    const complete = found?.session.state === "complete";
    return {
      company: invite.org_name,
      roleTitle: invite.config.title,
      questionCount: invite.config.questionCount,
      minutes: invite.config.questionCount * 4,
      expires: invite.expires,
      status: status(invite),
      consentVersion: CONSENT_VERSION,
      consented: Boolean(
        invite.consent &&
        JSON.parse(invite.consent).version === CONSENT_VERSION,
      ),
      retentionDays: invite.retention_days,
      contactEmail: invite.contact_email,
      answered: found?.session.turns.length || 0,
      state: found?.session.state || null,
      // Candidates may get "areas to prepare" after submission, never scores or the decision.
      feedback:
        complete && invite.config.candidateFeedback === "summary"
          ? {
              strengths: found.session.report.strengths,
              areasToPrepare: found.session.report.suggestedFollowUps,
            }
          : null,
      noteSent: Boolean(invite.candidate_note),
    };
  }
  function addEvent(inviteId, turn, kind, durationMs = null) {
    db.prepare(
      "INSERT INTO integrity_events(invite_id,at,turn,kind,duration_ms) VALUES (?,?,?,?,?)",
    ).run(inviteId, iso(), turn, kind, durationMs);
  }
  const turnNow = (inviteId) =>
    readScreening(inviteId)?.session.turns.length ?? 0;

  app.post("/api/candidate/session", authLimit, (req, res) => {
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(req.body);
    const row = db
      .prepare(
        "SELECT i.*, r.org_id, r.config, r.status AS role_status, o.name AS org_name, o.retention_days, o.contact_email FROM invites i JOIN roles r ON r.id=i.role_id JOIN orgs o ON o.id=r.org_id WHERE i.token_hash=?",
      )
      .get(hash(token));
    if (!row) fail(404, "This interview link is not valid.");
    if (row.status === "revoked")
      fail(
        410,
        "This interview link was cancelled. Contact the company that invited you.",
      );
    const invite = { ...row, config: JSON.parse(row.config) };
    if (status(invite) === "expired")
      fail(
        410,
        "This interview link has expired. Ask the company for a new one.",
      );
    // One live device at a time: a new session replaces the old one, which stays visible to the reviewer.
    const previous = db
      .prepare("SELECT COUNT(*) n FROM candidate_sessions WHERE invite_id=?")
      .get(invite.id).n;
    const cookie = newToken();
    const lifetime = Math.min(
      Math.max(invite.expires - Date.now(), DAY),
      7 * DAY,
    );
    db.transaction(() => {
      db.prepare("DELETE FROM candidate_sessions WHERE invite_id=?").run(
        invite.id,
      );
      db.prepare(
        "INSERT INTO candidate_sessions(token,invite_id,expires) VALUES (?,?,?)",
      ).run(hash(cookie), invite.id, Date.now() + lifetime);
      if (previous) addEvent(invite.id, turnNow(invite.id), "new_device");
    })();
    res.cookie(COOKIE, cookie, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: lifetime,
    });
    res.json(summary(invite));
  });
  app.get("/api/candidate/session", candidateAuth, (req, res) =>
    res.json(summary(req.candidate)),
  );

  app.post("/api/candidate/consent", candidateAuth, (req, res) => {
    const input = z
      .union([
        z
          .object({
            accepted: z.literal(true),
            version: z.literal(CONSENT_VERSION),
          })
          .strict(),
        z.object({ declined: z.literal(true) }).strict(),
      ])
      .parse(req.body);
    const invite = req.candidate;
    if (!["pending", "started"].includes(invite.status))
      fail(409, "This interview can no longer be changed.");
    if ("declined" in input) {
      db.transaction(() => {
        db.prepare("UPDATE invites SET status='withdrawn' WHERE id=?").run(
          invite.id,
        );
        db.prepare("DELETE FROM candidate_sessions WHERE invite_id=?").run(
          invite.id,
        );
      })();
      return res.json({
        withdrawn: true,
        contactEmail: invite.contact_email,
        company: invite.org_name,
      });
    }
    db.prepare("UPDATE invites SET consent=? WHERE id=?").run(
      JSON.stringify({ version: CONSENT_VERSION, acceptedAt: iso() }),
      invite.id,
    );
    res.json(
      summary({
        ...invite,
        consent: JSON.stringify({ version: CONSENT_VERSION }),
      }),
    );
  });

  // Create the screening, or resume it. Idempotent per invite.
  app.post("/api/candidate/interview", candidateAuth, async (req, res) =>
    locked(req.candidate.id, async () => {
      const invite = req.candidate;
      if (!summary(invite).consented)
        fail(409, "Please read and accept the interview notice first.");
      const found = readScreening(invite.id);
      if (found) {
        if (found.session.state === "active")
          addEvent(invite.id, found.session.turns.length, "reconnect");
        return res.json(candidateView(found.session));
      }
      if (status(invite) !== "pending" && status(invite) !== "started")
        fail(409, "This interview is not available.");
      if (invite.role_status !== "open")
        fail(409, "This role is no longer open.");
      const { config } = invite;
      const setup = {
        role: config.role,
        experience: config.experience,
        track: config.track,
        difficulty: config.difficulty,
        industry: config.industry,
        company: invite.org_name,
        jobDescription: config.jobDescription,
        resume: "",
        questionCount: config.questionCount,
      };
      const generated = await ai.generate(
        questionSchema,
        openingTask(config.rubric),
        { setup },
        { mode: "screening" },
      );
      const session = {
        id: randomUUID(),
        created: iso(),
        state: "active",
        setup,
        currentQuestion: tidyQuestion(generated.value),
        turns: [],
        report: null,
        provider: ai.provider,
        model: ai.model,
      };
      db.transaction(() => {
        db.prepare(
          "INSERT INTO screenings(id,invite_id,created,state,data) VALUES (?,?,?,?,?)",
        ).run(
          session.id,
          invite.id,
          session.created,
          session.state,
          JSON.stringify(session),
        );
        db.prepare("UPDATE invites SET status='started' WHERE id=?").run(
          invite.id,
        );
        orgUsage(invite.org_id, {
          screenings: 1,
          input: generated.usage.input,
          output: generated.usage.output,
        });
      })();
      res.status(201).json(candidateView(session));
    }),
  );

  function activeScreening(invite, expectedTurn) {
    const found = readScreening(invite.id);
    if (
      !found ||
      found.session.state !== "active" ||
      status(invite) !== "started"
    )
      fail(409, "This interview is not active.");
    if (
      expectedTurn !== undefined &&
      expectedTurn !== found.session.turns.length
    )
      fail(
        409,
        "This answer is already saved or the session changed. Reload the interview.",
      );
    return found.session;
  }

  app.post(
    "/api/candidate/interview/answers",
    candidateAuth,
    async (req, res) =>
      locked(req.candidate.id, async () => {
        const invite = req.candidate;
        // Delivery metrics (gaze, framing, filler words) are never stored for screening: bias risk.
        const input = answerSchema.parse(req.body);
        const session = activeScreening(invite, input.expectedTurn);
        const turn = await decideTurn(ai, session, input.answer, {
          mode: "screening",
          intro: `You are Maya, an AI interviewer screening candidates for ${invite.org_name}. Stay neutral and professional: never praise or criticise the quality of an answer, and never hint at scores or hiring chances. `,
        });
        if (!turn.answered) {
          session.exchanges = [
            ...(session.exchanges || []),
            { said: input.answer, reply: turn.reply },
          ];
          db.transaction(() => {
            saveScreening(invite.id, session);
            tokenUsage(invite.org_id, turn.usage);
          })();
          return res.json({ ...candidateView(session), reply: turn.reply });
        }
        const index = session.turns.length;
        session.turns.push({
          question: session.currentQuestion,
          answer: answerOf(session.exchanges, input.answer),
          ...(session.exchanges?.length
            ? { exchanges: session.exchanges }
            : {}),
        });
        session.exchanges = [];
        session.currentQuestion = turn.last ? null : turn.nextQuestion;
        session.state = turn.last ? "report_pending" : "active";
        db.transaction(() => {
          saveScreening(invite.id, session);
          tokenUsage(invite.org_id, turn.usage);
        })();
        res.json(candidateView(session));
        scoreLater(invite.id, index, invite.config, invite.org_name).catch(
          () => {
            /* The report scores any answer still missing an evaluation. */
          },
        );
      }),
  );

  app.post(
    "/api/candidate/interview/clarify",
    candidateAuth,
    async (req, res) =>
      locked(req.candidate.id, async () => {
        const invite = req.candidate;
        const { expectedTurn } = z
          .object({ expectedTurn: z.number().int().min(0).max(7) })
          .strict()
          .parse(req.body);
        const session = activeScreening(invite, expectedTurn);
        session.clarifications ||= {};
        const used = session.clarifications[expectedTurn] || 0;
        if (used >= 2)
          fail(
            429,
            "This question has been clarified twice. Take your time and answer what you understand.",
          );
        const generated = await ai.generate(
          questionSchema,
          "lead: a short phrase such as 'Sure, let me put that another way.' question: rephrase the current question in plain language, preserving its meaning and difficulty. Do not give hints, solutions or a new question. Ask ONE question.",
          {
            role: session.setup.role,
            currentQuestion: session.currentQuestion,
          },
          { mode: "screening" },
        );
        session.clarifications[expectedTurn] = used + 1;
        db.transaction(() => {
          saveScreening(invite.id, session);
          tokenUsage(invite.org_id, generated.usage);
        })();
        res.json({ question: generated.value.question });
      }),
  );

  // Submitting is final from the candidate's side; the company report is generated here or lazily later.
  app.post("/api/candidate/interview/report", candidateAuth, async (req, res) =>
    locked(req.candidate.id, async () => {
      const invite = req.candidate;
      const found = readScreening(invite.id);
      if (!found) fail(409, "The interview has not started.");
      if (found.session.state !== "complete") {
        if (!found.session.turns.length)
          fail(400, "Answer at least one question before submitting.");
        found.session.state = "report_pending";
        saveScreening(invite.id, found.session);
        await finishReport(invite);
      }
      res.json(summary({ ...invite, status: "completed" }));
    }),
  );

  app.post("/api/candidate/integrity-events", candidateAuth, (req, res) => {
    const invite = req.candidate;
    const { events } = z
      .object({
        events: z
          .array(
            z.object({
              kind: z.enum(CLIENT_EVENTS),
              turn: z.number().int().min(0).max(7),
              durationMs: z.number().int().min(0).max(3600000).optional(),
            }),
          )
          .min(1)
          .max(20),
      })
      .strict()
      .parse(req.body);
    const existing = db
      .prepare("SELECT COUNT(*) n FROM integrity_events WHERE invite_id=?")
      .get(invite.id).n;
    if (existing + events.length > 200)
      return res.json({ ok: true, dropped: events.length });
    db.transaction(() => {
      for (const e of events)
        addEvent(invite.id, e.turn, e.kind, e.durationMs ?? null);
    })();
    res.json({ ok: true });
  });

  app.post("/api/candidate/note", candidateAuth, (req, res) => {
    const { note } = z
      .object({ note: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(req.body);
    const done = db
      .prepare(
        "UPDATE invites SET candidate_note=? WHERE id=? AND candidate_note IS NULL",
      )
      .run(note, req.candidate.id);
    if (!done.changes) fail(409, "You have already sent a note.");
    res.json({ ok: true });
  });

  // ----- paid speech for candidates: metered per invite, charged to the company -----
  function spendCandidateSpeech(invite, limit) {
    const { speech_calls } = db
      .prepare(
        "UPDATE invites SET speech_calls=speech_calls+1 WHERE id=? RETURNING speech_calls",
      )
      .get(invite.id);
    if (speech_calls > limit)
      fail(
        429,
        "You've reached the voice limit for this interview. Please type your answers.",
      );
    orgUsage(invite.org_id, { speech: 1 });
  }

  return { resolveCandidate, spendCandidateSpeech };
}
