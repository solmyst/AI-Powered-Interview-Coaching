import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import {
  randomUUID,
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
import { openDatabase } from "./db.js";
import { createAI, ServiceError } from "./ai.js";
import { createTranscriber } from "./transcription.js";
import { createSpeech } from "./speech.js";
import { registerRehearsal } from "./rehearsal.js";
import { answerOf, decideTurn, tidyQuestion } from "./turn.js";
import { registerScreening } from "./screening.js";
export { tidyQuestion, repeats } from "./turn.js";
import {
  setupSchema,
  answerSchema,
  questionSchema,
  evaluationSchema,
  reportSchema,
  dimensions,
} from "./schemas.js";
const derive = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(128),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
const day = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const fail = (status, message) => {
  throw new ServiceError(status, message);
};
export function createApp({
  env = process.env,
  db = openDatabase(env.DATABASE_PATH || "./data/interviewace.db"),
  ai = createAI(env),
  transcriber = createTranscriber(env),
  speech = createSpeech(env),
} = {}) {
  const app = express();
  const locks = new Set();
  const limit = Number(env.DAILY_INTERVIEW_LIMIT || 5);
  const speechLimit = Number(env.DAILY_SPEECH_LIMIT || 300);
  // Owner/testing accounts skip daily trial caps. Everyone else is a trial user.
  const unlimited = new Set(
    (env.UNLIMITED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  // Company screening is a pilot: only these emails (plus the unlimited testing accounts) can create companies.
  const screeners = new Set(
    (env.SCREENING_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const candidateSpeechLimit = Number(env.CANDIDATE_SPEECH_LIMIT || 150);
  let screening = null;
  const secure = env.NODE_ENV === "production";
  const origin = env.APP_ORIGIN || "http://localhost:5173";
  if (secure && !origin.startsWith("https://"))
    throw new Error("Production APP_ORIGIN must use HTTPS");
  app.disable("x-powered-by");
  // Production is exposed through one local Nginx hop. This lets rate limits use
  // the real client address without trusting arbitrary forwarded chains.
  app.set("trust proxy", secure ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "'wasm-unsafe-eval'"],
          "connect-src": ["'self'"],
          "worker-src": ["'self'", "blob:"],
          "media-src": ["'self'", "blob:"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          "upgrade-insecure-requests": secure ? [] : null,
        },
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    const started = Date.now();
    res.on("finish", () => {
      if (env.NODE_ENV !== "test")
        console.info(
          JSON.stringify({
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            ms: Date.now() - started,
          }),
        );
    });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    )
      return res.status(403).json({ error: "Request origin is not allowed." });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute." },
    }),
  );
  app.use(express.json({ limit: "80kb" }));
  app.use(cookieParser());
  const safeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  });
  const usage = (user) => ({
    used:
      db
        .prepare("SELECT count FROM usage WHERE user_id=? AND day=?")
        .get(user.id, day())?.count || 0,
    limit: unlimited.has(user.email) ? null : limit,
    reset: "00:00 UTC",
  });
  const userFromCookie = (req) => {
    const token = req.cookies.ia_session;
    return (
      token &&
      db
        .prepare(
          "SELECT users.* FROM users JOIN auth_sessions ON users.id=auth_sessions.user_id WHERE token=? AND expires>?",
        )
        .get(hash(token), Date.now())
    );
  };
  function auth(req, _res, next) {
    req.user = userFromCookie(req);
    if (!req.user)
      return next(new ServiceError(401, "Please sign in to continue."));
    next();
  }
  // Reports clear resume context; abandoned interviews must not keep it forever.
  const purgeStaleContext = () =>
    db
      .prepare(
        "UPDATE interviews SET data=json_set(data,'$.setup.resume','','$.setup.jobDescription','') WHERE state!='complete' AND created < ? AND (json_extract(data,'$.setup.resume')!='' OR json_extract(data,'$.setup.jobDescription')!='')",
      )
      .run(new Date(Date.now() - 7 * 86400000).toISOString());
  purgeStaleContext();
  function issueSession(res, user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM auth_sessions WHERE expires < ?").run(Date.now());
    purgeStaleContext();
    db.prepare("INSERT INTO auth_sessions VALUES (?, ?, ?)").run(
      hash(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("ia_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: 7 * 86400000,
    });
  }
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  app.get("/api/health", async (_req, res) =>
    res.json({
      ...(await ai.status()),
      transcription: transcriber.status(),
      speech: speech.status(),
      billing: false,
    }),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    if (!input.name) fail(400, "Your name is required.");
    const salt = randomBytes(16).toString("hex");
    const password = `${salt}:${(await derive(input.password, salt, 64)).toString("hex")}`;
    const user = { id: randomUUID(), name: input.name, email: input.email };
    try {
      db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
        user.id,
        user.email,
        user.name,
        password,
        now(),
      );
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
        fail(409, "Unable to create this account. Try signing in.");
      throw error;
    }
    issueSession(res, user);
    res.status(201).json({ user, usage: usage(user) });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email);
    const [salt, stored] = (
      user?.password || `${"0".repeat(32)}:${"0".repeat(128)}`
    ).split(":");
    const result = await derive(input.password, salt, 64);
    if (!timingSafeEqual(result, Buffer.from(stored, "hex")) || !user)
      fail(401, "Email or password is incorrect.");
    issueSession(res, user);
    res.json({ user: safeUser(user), usage: usage(user) });
  });
  app.post("/api/auth/logout", (req, res) => {
    if (req.cookies.ia_session)
      db.prepare("DELETE FROM auth_sessions WHERE token=?").run(
        hash(req.cookies.ia_session),
      );
    res.clearCookie("ia_session", {
      path: "/",
      secure,
      sameSite: "strict",
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  app.get("/api/auth/session", (req, res) => {
    const user = userFromCookie(req);
    res.json({
      user: user ? safeUser(user) : null,
      usage: user ? usage(user) : null,
    });
  });
  app.get("/api/me", auth, (req, res) =>
    res.json({ user: safeUser(req.user), usage: usage(req.user) }),
  );
  // AssemblyAI and Sarvam bill per call; count before calling so parallel requests cannot pass the cap.
  function spendSpeech(user) {
    const { speech_calls } = db
      .prepare(
        "INSERT INTO usage(user_id,day,speech_calls) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET speech_calls=speech_calls+1 RETURNING speech_calls",
      )
      .get(user.id, day());
    if (speech_calls > speechLimit && !unlimited.has(user.email))
      fail(
        429,
        "You've reached today's voice limit. Type your answers or return after 00:00 UTC.",
      );
  }
  // Speech endpoints serve signed-in users and invited screening candidates.
  function speaker(req, _res, next) {
    const user = userFromCookie(req);
    if (user) {
      req.user = user;
      return next();
    }
    const candidate = screening.resolveCandidate(req);
    if (candidate?.status === "started" && candidate.consent) {
      req.candidate = candidate;
      return next();
    }
    next(new ServiceError(401, "Please sign in to continue."));
  }
  const spend = (req) =>
    req.candidate
      ? screening.spendCandidateSpeech(req.candidate, candidateSpeechLimit)
      : spendSpeech(req.user);
  app.post(
    "/api/transcribe",
    speaker,
    express.raw({ type: "audio/wav", limit: "12mb" }),
    async (req, res) => {
      if (
        !Buffer.isBuffer(req.body) ||
        req.body.length < 44 ||
        req.body.subarray(0, 4).toString("ascii") !== "RIFF" ||
        req.body.subarray(8, 12).toString("ascii") !== "WAVE"
      )
        fail(415, "A valid WAV recording is required.");
      spend(req);
      res.json(await transcriber.transcribe(req.body));
    },
  );
  app.post("/api/speech", speaker, async (req, res) => {
    const { text } = z
      .object({ text: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    spend(req);
    const generated = await speech.synthesize(text);
    res.type(generated.contentType).send(Buffer.from(generated.audio));
  });
  app.patch("/api/me", auth, (req, res) => {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(80) })
      .strict()
      .parse(req.body);
    db.prepare("UPDATE users SET name=? WHERE id=?").run(name, req.user.id);
    res.json({ user: { ...safeUser(req.user), name } });
  });
  async function locked(key, work) {
    if (locks.has(key))
      fail(
        409,
        "A request is already in progress. Wait, then refresh your session.",
      );
    locks.add(key);
    try {
      return await work();
    } finally {
      locks.delete(key);
    }
  }
  function owned(req) {
    const row = db
      .prepare("SELECT data FROM interviews WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!row) fail(404, "Interview not found.");
    return JSON.parse(row.data);
  }
  function save(id, session) {
    // Answers are scored in the background; never overwrite a score that landed meanwhile.
    const stored = db.prepare("SELECT data FROM interviews WHERE id=?").get(id);
    if (stored)
      JSON.parse(stored.data).turns.forEach((turn, i) => {
        if (turn.evaluation && session.turns[i] && !session.turns[i].evaluation)
          session.turns[i].evaluation = turn.evaluation;
      });
    db.prepare("UPDATE interviews SET state=?, data=? WHERE id=?").run(
      session.state,
      JSON.stringify(session),
      id,
    );
  }
  function recordUsage(id, tokens) {
    db.prepare(
      "INSERT INTO usage(user_id,day,count,input_tokens,output_tokens) VALUES (?,?,0,?,?) ON CONFLICT(user_id,day) DO UPDATE SET input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens",
    ).run(id, day(), tokens.input, tokens.output);
  }
  function context(session) {
    return {
      setup: session.setup,
      turns: session.turns.map((t) => ({
        question: t.question,
        answer: t.answer.slice(0, 2500),
        evaluation: t.evaluation && {
          scores: t.evaluation.scores,
          rationale: t.evaluation.rationale.slice(0, 500),
        },
      })),
      previousWeaknesses: session.previousWeaknesses,
    };
  }
  registerRehearsal(app, { auth, locked, owned, save, recordUsage, ai });
  screening = registerScreening(app, {
    db,
    ai,
    auth,
    locked,
    authLimit,
    hash,
    secure,
    origin,
    allowed: (user) => unlimited.has(user.email) || screeners.has(user.email),
  });
  app.get("/api/interviews", auth, (req, res) => {
    const sessions = db
      .prepare(
        "SELECT id, created, state, json_extract(data,'$.setup.role') AS role, json_extract(data,'$.setup.track') AS track, json_array_length(data,'$.turns') AS answered, json_extract(data,'$.setup.questionCount') AS total, json_extract(data,'$.report.overall') AS score FROM interviews WHERE user_id=? ORDER BY created DESC LIMIT 100",
      )
      .all(req.user.id);
    res.json({ sessions, usage: usage(req.user) });
  });
  app.post("/api/interviews", auth, async (req, res) =>
    locked(req.user.id, async () => {
      const setup = setupSchema.parse(req.body);
      const id = z.uuid().parse(req.headers["idempotency-key"]);
      const existing = db
        .prepare("SELECT data FROM interviews WHERE id=? AND user_id=?")
        .get(id, req.user.id);
      if (existing) return res.json(JSON.parse(existing.data));
      const today = usage(req.user);
      if (today.limit !== null && today.used >= today.limit)
        fail(
          429,
          `You've used today's ${limit} interviews. Continue an existing session or return after 00:00 UTC.`,
        );
      const latest = db
        .prepare(
          "SELECT data FROM interviews WHERE user_id=? AND state='complete' ORDER BY created DESC LIMIT 3",
        )
        .all(req.user.id)
        .map((r) => JSON.parse(r.data));
      const previousWeaknesses = latest
        .flatMap((s) => s.report.improvements)
        .slice(0, 5);
      const generated = await ai.generate(
        questionSchema,
        "Open the interview the way a warm, experienced human interviewer would. lead: one or two short spoken sentences introducing yourself as Maya and the round (role, track) and putting the candidate at ease. question: ONE concrete situational question tailored to the role, track and level (for example 'Imagine…', 'Suppose your team…', or 'Tell me about a time…'), answerable in about two minutes of speech, at most 45 words with exactly one question mark. The question must describe a concrete scenario or task; never ask for an overview, background, summary or résumé walk-through. The lead is at most 25 words, ends with a full stop, and never asks or requests anything. Use specific resume or job-description details when present. Do not open with 'walk me through your resume' or 'tell me about yourself'. Do not provide the answer.",
        { setup, previousWeaknesses },
      );
      const session = {
        id,
        created: now(),
        state: "active",
        setup,
        currentQuestion: tidyQuestion(generated.value),
        turns: [],
        report: null,
        previousWeaknesses,
        provider: ai.provider,
        model: ai.model,
      };
      db.transaction(() => {
        db.prepare("INSERT INTO interviews VALUES (?,?,?,?,?)").run(
          id,
          req.user.id,
          session.created,
          session.state,
          JSON.stringify(session),
        );
        db.prepare(
          "INSERT INTO usage(user_id,day,count) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1",
        ).run(req.user.id, day());
        recordUsage(req.user.id, generated.usage);
      })();
      res.status(201).json(session);
    }),
  );
  app.get("/api/interviews/:id", auth, (req, res) => res.json(owned(req)));
  app.post("/api/interviews/:id/clarify", auth, async (req, res) =>
    locked(req.user.id, async () => {
      const { expectedTurn } = z
        .object({ expectedTurn: z.number().int().min(0).max(7) })
        .strict()
        .parse(req.body);
      const session = owned(req);
      if (session.state !== "active" || expectedTurn !== session.turns.length)
        fail(
          409,
          "The question changed. Please retry on the current question.",
        );
      session.clarifications ||= {};
      const used = session.clarifications[expectedTurn] || 0;
      if (used >= 2)
        fail(
          429,
          "This question has been clarified twice. Take your time and answer what you understand.",
        );
      const generated = await ai.generate(
        questionSchema,
        "lead: a short phrase such as 'Sure, let me put that another way.' question: rephrase the current question in plain language, preserving its technical meaning, difficulty, and constraints. Explain ambiguous wording only. Do not give hints, solutions, an example answer, or a new question. Ask ONE question. Use the same language as the current question.",
        { role: session.setup.role, currentQuestion: session.currentQuestion },
      );
      session.clarifications[expectedTurn] = used + 1;
      save(session.id, session);
      recordUsage(req.user.id, generated.usage);
      res.json({ question: generated.value.question });
    }),
  );
  app.post("/api/interviews/:id/answers", auth, async (req, res) =>
    locked(req.user.id, async () => {
      const input = answerSchema.parse(req.body);
      const session = owned(req);
      if (
        session.state !== "active" ||
        input.expectedTurn !== session.turns.length
      )
        fail(
          409,
          "This answer is already saved or the session changed. Reload the interview.",
        );
      const turn = await decideTurn(ai, session, input.answer);
      if (!turn.answered) {
        session.exchanges = [
          ...(session.exchanges || []),
          { said: input.answer, reply: turn.reply },
        ];
        db.transaction(() => {
          save(session.id, session);
          recordUsage(req.user.id, turn.usage);
        })();
        return res.json({ ...session, reply: turn.reply });
      }
      const exchanges = session.exchanges || [];
      const { last } = turn;
      const generated = { usage: turn.usage };
      const index = session.turns.length;
      session.turns.push({
        question: session.currentQuestion,
        answer: answerOf(exchanges, input.answer),
        ...(exchanges.length ? { exchanges } : {}),
        ...(input.delivery ? { delivery: input.delivery } : {}),
      });
      session.exchanges = [];
      session.currentQuestion = last ? null : turn.nextQuestion;
      session.state = last ? "report_pending" : "active";
      db.transaction(() => {
        save(session.id, session);
        recordUsage(req.user.id, generated.usage);
      })();
      res.json(session);
      scoreLater(req.user.id, session.id, index).catch(() => {
        /* The report scores any answer still missing an evaluation. */
      });
    }),
  );
  // Scoring is slow and the candidate should not wait for it between questions.
  const scoring = new Map();
  function scoreLater(userId, id, index) {
    const key = `${id}:${index}`;
    if (scoring.has(key)) return scoring.get(key);
    const read = () => {
      const row = db
        .prepare("SELECT data FROM interviews WHERE id=? AND user_id=?")
        .get(id, userId);
      return row && JSON.parse(row.data);
    };
    const job = (async () => {
      const session = read();
      const turn = session?.turns[index];
      if (!turn || turn.evaluation) return;
      const generated = await ai.generate(
        evaluationSchema,
        "Evaluate the candidate's answer to this interview question with concrete evidence from what they said. Consider any conversation they had about the question before answering.",
        {
          setup: session.setup,
          earlierAnswers: session.turns.slice(0, index).map((t) => ({
            question: t.question.question,
            answer: t.answer.slice(0, 800),
          })),
          question: turn.question,
          conversationBeforeAnswer: turn.exchanges || [],
          answer: turn.answer,
        },
      );
      const fresh = read();
      if (!fresh?.turns[index] || fresh.turns[index].evaluation) return;
      fresh.turns[index].evaluation = generated.value;
      db.transaction(() => {
        save(id, fresh);
        recordUsage(userId, generated.usage);
      })();
    })().finally(() => scoring.delete(key));
    scoring.set(key, job);
    return job;
  }
  app.post("/api/interviews/:id/report", auth, async (req, res) =>
    locked(req.user.id, async () => {
      let session = owned(req);
      if (session.report) return res.json(session);
      if (!session.turns.length)
        fail(400, "Answer at least one question before generating a report.");
      for (const [i, turn] of session.turns.entries())
        if (!turn.evaluation) await scoreLater(req.user.id, session.id, i);
      session = owned(req);
      if (session.turns.some((turn) => !turn.evaluation))
        fail(
          502,
          "Some answers are still being scored. Please retry in a moment.",
        );
      const generated = await ai.generate(
        reportSchema,
        "Create an evidence-based coaching summary and a concrete study plan, with practice questions. Consider only answered questions. Never invent performance or hiring outcomes.",
        context(session),
      );
      const scores = Object.fromEntries(
        dimensions.map((key) => [
          key,
          Math.round(
            session.turns.reduce((n, t) => n + t.evaluation.scores[key], 0) /
              session.turns.length,
          ),
        ]),
      );
      session.report = {
        ...generated.value,
        scores,
        overall: Math.round(
          Object.values(scores).reduce((a, b) => a + b, 0) / dimensions.length,
        ),
        answered: session.turns.length,
      };
      session.state = "complete";
      session.currentQuestion = null;
      // Resume text is no longer needed after completion; avoid retaining it in reports/history.
      session.setup.resume = "";
      session.setup.jobDescription = "";
      db.transaction(() => {
        save(session.id, session);
        recordUsage(req.user.id, generated.usage);
      })();
      res.json(session);
    }),
  );
  app.delete("/api/interviews/:id", auth, async (req, res) =>
    locked(req.user.id, async () => {
      owned(req);
      db.prepare("DELETE FROM interviews WHERE id=? AND user_id=?").run(
        req.params.id,
        req.user.id,
      );
      res.json({ ok: true });
    }),
  );
  app.get("/api/bookmarks", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT bookmarks.interview_id, bookmarks.turn, interviews.data FROM bookmarks JOIN interviews ON interviews.id=bookmarks.interview_id WHERE bookmarks.user_id=? ORDER BY interviews.created DESC",
        )
        .all(req.user.id)
        .map((r) => ({
          interviewId: r.interview_id,
          turn: r.turn,
          ...JSON.parse(r.data).turns[r.turn],
        })),
    ),
  );
  app.post("/api/interviews/:id/bookmarks", auth, (req, res) => {
    const session = owned(req);
    const { turn, saved } = z
      .object({ turn: z.number().int().min(0), saved: z.boolean() })
      .strict()
      .parse(req.body);
    if (!session.turns[turn]) fail(400, "Question not found.");
    if (saved)
      db.prepare("INSERT OR IGNORE INTO bookmarks VALUES (?,?,?)").run(
        req.user.id,
        session.id,
        turn,
      );
    else
      db.prepare(
        "DELETE FROM bookmarks WHERE user_id=? AND interview_id=? AND turn=?",
      ).run(req.user.id, session.id, turn);
    res.json({ ok: true });
  });
  app.get("/api/me/export", auth, (req, res) =>
    res.json({
      user: safeUser(req.user),
      interviews: db
        .prepare("SELECT data FROM interviews WHERE user_id=?")
        .all(req.user.id)
        .map((r) => JSON.parse(r.data)),
      bookmarks: db
        .prepare("SELECT interview_id,turn FROM bookmarks WHERE user_id=?")
        .all(req.user.id),
    }),
  );
  app.delete("/api/me", auth, async (req, res) =>
    locked(req.user.id, async () => {
      db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
      res.clearCookie("ia_session", {
        path: "/",
        secure,
        sameSite: "strict",
        httpOnly: true,
      });
      res.json({ ok: true });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use((error, req, res, _next) => {
    const status = error instanceof z.ZodError ? 400 : error.status || 500;
    if (status >= 500 && env.NODE_ENV !== "test")
      console.error(
        JSON.stringify({
          requestId: req.requestId,
          status,
          type: error.constructor.name,
        }),
      );
    res.status(status).json({
      error:
        error instanceof z.ZodError
          ? "Invalid input. Check the fields and length limits."
          : status === 500
            ? "An unexpected server error occurred. Please retry."
            : error.message,
      requestId: req.requestId,
    });
  });
  return { app, db };
}
