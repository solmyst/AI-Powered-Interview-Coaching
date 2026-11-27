import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Download, Plus, Send, Trash2 } from "lucide-react";
import { api } from "../api";
import choices from "../../../shared/interview-options.json";
import type { RoleConfig, RubricItem } from "../types";
import { CandidateReport } from "./CandidateReport";

export type Org = {
  id: string;
  name: string;
  contactEmail: string;
  retentionDays: number;
  role: "owner" | "reviewer";
};
type RoleRow = {
  id: string;
  title: string;
  status: string;
  role: string;
  track: string;
  questionCount: number;
  total: number;
  pending: number;
  started: number;
  completed: number;
};
export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  score: number | null;
  competencyScores: Record<string, number> | null;
  answered: number;
  questionCount: number;
  unreviewedFlags: number;
  attention: number | null;
  terminated: boolean;
  decision: { status: string; note: string; by: string } | null;
  expires: number;
};
type RoleDetail = {
  id: string;
  title: string;
  status: string;
  rubric: RubricItem[];
  questionCount: number;
};
type View =
  | { name: "roles" }
  | { name: "newRole" }
  | { name: "candidates"; roleId: string }
  | { name: "report"; roleId: string; inviteId: string };

const statusLabel: Record<string, string> = {
  completed: "Completed",
  started: "In progress",
  pending: "Not started",
  expired: "Link expired",
  revoked: "Revoked",
  withdrawn: "Withdrew",
};
export const AI_NOTE =
  "Scores are AI estimates against your rubric. Read the transcript before deciding.";

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30) || "criterion";

// The hiring area: companies, roles, invite links, a ranked list and per-candidate reports.
export function Company({
  canCreate,
  orgs,
  reload,
}: {
  canCreate: boolean;
  orgs: Org[];
  reload: () => void;
}) {
  const [view, setView] = useState<View>({ name: "roles" });
  const org = orgs[0];
  if (!org) return <CreateOrg canCreate={canCreate} done={reload} />;
  return (
    <div className="wrap workspace co">
      {view.name === "roles" && (
        <Roles
          org={org}
          reload={reload}
          open={(roleId) => setView({ name: "candidates", roleId })}
          create={() => setView({ name: "newRole" })}
        />
      )}
      {view.name === "newRole" && (
        <RoleForm
          org={org}
          back={() => setView({ name: "roles" })}
          done={(roleId) => setView({ name: "candidates", roleId })}
        />
      )}
      {view.name === "candidates" && (
        <Candidates
          key={view.roleId}
          org={org}
          roleId={view.roleId}
          back={() => setView({ name: "roles" })}
          open={(inviteId) =>
            setView({
              name: "report",
              roleId: (view as { roleId: string }).roleId,
              inviteId,
            })
          }
        />
      )}
      {view.name === "report" && (
        <CandidateReport
          org={org}
          inviteId={view.inviteId}
          back={() => setView({ name: "candidates", roleId: view.roleId })}
        />
      )}
    </div>
  );
}

function CreateOrg({
  canCreate,
  done,
}: {
  canCreate: boolean;
  done: () => void;
}) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState("");
  if (!canCreate)
    return (
      <div className="wrap workspace narrow">
        <p className="eyebrow">HIRING</p>
        <h1>Screen candidates with Maya.</h1>
        <p className="lead">
          Company screening is in a closed pilot. Ask the InterviewAce team to
          add your account, then come back to create your company.
        </p>
      </div>
    );
  return (
    <div className="wrap workspace narrow">
      <p className="eyebrow">HIRING</p>
      <h1>Set up your company.</h1>
      <p className="lead">
        Candidates see this name and your contact email in their notice, so they
        know who is hiring and whom to ask about accommodations or deletion.
      </p>
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await api("/orgs", {
              method: "POST",
              body: JSON.stringify({ name, contactEmail }),
            });
            done();
          } catch (reason) {
            setError((reason as Error).message);
          }
        }}
      >
        <label>
          Company name
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Contact email for candidates{" "}
          <small>optional, shown in the notice</small>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary">Create company</button>
      </form>
    </div>
  );
}

function Roles({
  org,
  reload,
  open,
  create,
}: {
  org: Org;
  reload: () => void;
  open: (id: string) => void;
  create: () => void;
}) {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [error, setError] = useState("");
  const [contact, setContact] = useState(org.contactEmail);
  const [retention, setRetention] = useState(org.retentionDays);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void api<RoleRow[]>(`/orgs/${org.id}/roles`)
      .then(setRoles)
      .catch((reason) => setError((reason as Error).message));
  }, [org.id]);
  return (
    <>
      <div className="room-heading">
        <div>
          <p className="eyebrow">HIRING · {org.name.toUpperCase()}</p>
          <h1>Your open roles.</h1>
        </div>
        {org.role === "owner" && (
          <button className="primary" onClick={create}>
            <Plus size={18} /> New role
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {roles && !roles.length && (
        <section className="panel empty">
          <h2>Create your first role</h2>
          <p>
            Paste the job description, choose what good looks like, then send
            candidates a link. Maya interviews them and you get a ranked list
            with evidence.
          </p>
          {org.role === "owner" && (
            <button className="primary" onClick={create}>
              Create a role
            </button>
          )}
        </section>
      )}
      <div className="co-roles">
        {roles?.map((role) => (
          <button
            key={role.id}
            className="co-role"
            onClick={() => open(role.id)}
          >
            <span className={`co-chip ${role.status}`}>
              {role.status === "open" ? "Open" : "Closed"}
            </span>
            <strong>{role.title}</strong>
            <small>
              {role.role} · {role.track} · {role.questionCount} questions
            </small>
            <span className="co-counts">
              <b>{role.total}</b> invited <b>{role.started}</b> in progress{" "}
              <b>{role.completed}</b> completed
            </span>
          </button>
        ))}
      </div>
      {org.role === "owner" && (
        <section className="panel co-settings">
          <h2>Company settings</h2>
          <div className="form-grid">
            <label>
              Contact email for candidates
              <input
                type="email"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              Keep candidate data for (days)
              <input
                type="number"
                min={30}
                max={730}
                value={retention}
                onChange={(e) => {
                  setRetention(Number(e.target.value));
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <p className="muted">
            After this period, candidates and everything under them are deleted
            automatically.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              setError("");
              try {
                await api(`/orgs/${org.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    contactEmail: contact,
                    retentionDays: retention,
                  }),
                });
                setSaved(true);
                reload();
              } catch (reason) {
                setError((reason as Error).message);
              }
            }}
          >
            Save settings
          </button>
          {saved && (
            <span className="muted" role="status">
              {" "}
              Saved.
            </span>
          )}
        </section>
      )}
    </>
  );
}

function RoleForm({
  org,
  back,
  done,
}: {
  org: Org;
  back: () => void;
  done: (roleId: string) => void;
}) {
  const [form, setForm] = useState<RoleConfig>({
    title: "",
    role: "Software engineering",
    experience: "Early career",
    track: "Technical",
    difficulty: "Intermediate",
    industry: "Technology",
    jobDescription: "",
    questionCount: 5,
    rubric: (choices.rubrics as Record<string, RubricItem[]>).Technical,
    inviteDays: 7,
    candidateFeedback: "summary",
    questions: [],
    proctoring: "strict",
  });
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof RoleConfig>(key: K, value: RoleConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const rubricOf = (track: string) =>
    (choices.rubrics as Record<string, RubricItem[]>)[track];
  const setRubric = (rubric: RubricItem[]) => {
    setEdited(true);
    set("rubric", rubric);
  };
  const item = (index: number, patch: Partial<RubricItem>) =>
    setRubric(
      form.rubric.map((r, i) =>
        i === index
          ? {
              ...r,
              ...patch,
              ...(patch.label !== undefined ? { key: slug(patch.label) } : {}),
            }
          : r,
      ),
    );
  const select = (
    label: string,
    key: "role" | "experience" | "track" | "difficulty",
    options: string[],
  ) => (
    <label>
      {label}
      <select
        value={form[key]}
        onChange={(e) => {
          set(key, e.target.value);
          // Switching round swaps in that round's starter criteria until the company edits them.
          if (key === "track" && !edited)
            set("rubric", rubricOf(e.target.value));
        }}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft size={16} /> Roles
      </button>
      <p className="eyebrow">NEW ROLE</p>
      <h1>What are you hiring for?</h1>
      <form
        className="co-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const made = await api<{ id: string }>(`/orgs/${org.id}/roles`, {
              method: "POST",
              body: JSON.stringify(form),
            });
            done(made.id);
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="panel">
          <h2>The role</h2>
          <div className="form-grid">
            <label>
              Job title
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Backend engineer, payments"
              />
            </label>
            {select("Role family", "role", choices.roles)}
            {select("Level", "experience", choices.experience)}
            {select("Interview round", "track", choices.tracks)}
            {select("Difficulty", "difficulty", choices.difficulty)}
            <label>
              Industry
              <input
                required
                maxLength={80}
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              />
            </label>
          </div>
          <label>
            Job description{" "}
            <small>Maya uses this to choose realistic scenarios</small>
            <textarea
              required
              rows={6}
              minLength={50}
              maxLength={6000}
              value={form.jobDescription}
              onChange={(e) => set("jobDescription", e.target.value)}
              placeholder="Responsibilities, must-have skills, the problems this person will own…"
            />
          </label>
        </section>
        <section className="panel">
          <h2>What good looks like</h2>
          <p className="muted">
            Every candidate is scored against these criteria, weighted by
            importance. Edit them to match how your team hires.
          </p>
          {form.rubric.map((r, i) => (
            <div className="co-rubric" key={i}>
              <label>
                Criterion
                <input
                  required
                  maxLength={60}
                  value={r.label}
                  onChange={(e) => item(i, { label: e.target.value })}
                />
              </label>
              <label>
                What a strong answer shows
                <input
                  required
                  maxLength={400}
                  value={r.description}
                  onChange={(e) => item(i, { description: e.target.value })}
                />
              </label>
              <label>
                Weight
                <select
                  value={r.weight}
                  onChange={(e) => item(i, { weight: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${r.label || "criterion"}`}
                disabled={form.rubric.length <= 2}
                onClick={() => setRubric(form.rubric.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={form.rubric.length >= 6}
            onClick={() =>
              setRubric([
                ...form.rubric,
                { key: "new_criterion", label: "", description: "", weight: 2 },
              ])
            }
          >
            <Plus size={16} /> Add criterion
          </button>
        </section>
        <section className="panel">
          <h2>Your questions</h2>
          <p className="muted">
            Maya asks these first, word for word and in this order, then writes
            follow-ups from the job description and each candidate’s résumé for
            the remaining {Math.max(0, form.questionCount - form.questions.length)}.
            Leave empty to let Maya write every question.
          </p>
          {form.questions.map((q, i) => (
            <div className="co-question" key={i}>
              <label>
                Question {i + 1}
                <textarea
                  rows={2}
                  required
                  minLength={10}
                  maxLength={600}
                  value={q}
                  onChange={(e) =>
                    set(
                      "questions",
                      form.questions.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove question ${i + 1}`}
                onClick={() =>
                  set("questions", form.questions.filter((_, j) => j !== i))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={form.questions.length >= form.questionCount}
            onClick={() => set("questions", [...form.questions, ""])}
          >
            <Plus size={16} /> Add a question
          </button>
        </section>
        <section className="panel">
          <h2>Interview settings</h2>
          <div className="form-grid">
            <label>
              Questions
              <select
                value={form.questionCount}
                onChange={(e) => set("questionCount", Number(e.target.value))}
              >
                {[3, 4, 5, 6, 7, 8].filter((n) => n >= form.questions.length).map((n) => (
                  <option key={n} value={n}>
                    {n} questions · about {n * 4} minutes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Invite links stay valid for
              <select
                value={form.inviteDays}
                onChange={(e) => set("inviteDays", Number(e.target.value))}
              >
                {[3, 7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proctoring
              <select
                value={form.proctoring}
                onChange={(e) =>
                  set("proctoring", e.target.value as "strict" | "standard")
                }
              >
                <option value="strict">
                  Strict: full screen and one display; leaving for 10 s ends the interview
                </option>
                <option value="standard">
                  Standard: leaving full screen or the tab is noted for review
                </option>
              </select>
            </label>
            <label>
              After submitting, candidates see
              <select
                value={form.candidateFeedback}
                onChange={(e) =>
                  set("candidateFeedback", e.target.value as "none" | "summary")
                }
              >
                <option value="summary">
                  A short “areas to prepare” summary, no scores
                </option>
                <option value="none">Only a thank-you</option>
              </select>
            </label>
          </div>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create role"}
        </button>
      </form>
    </>
  );
}

function Candidates({
  org,
  roleId,
  back,
  open,
}: {
  org: Org;
  roleId: string;
  back: () => void;
  open: (inviteId: string) => void;
}) {
  const [data, setData] = useState<{
    role: RoleDetail;
    candidates: CandidateRow[];
  } | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);
  const load = useCallback(() => {
    void api<{ role: RoleDetail; candidates: CandidateRow[] }>(
      `/roles/${roleId}/candidates`,
    )
      .then(setData)
      .catch((reason) => setError((reason as Error).message));
  }, [roleId]);
  useEffect(load, [load]);
  if (!data)
    return error ? (
      <p className="error" role="alert">
        {error}
      </p>
    ) : (
      <p aria-busy="true">Loading candidates…</p>
    );
  const { role, candidates } = data;
  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft size={16} /> Roles
      </button>
      <div className="room-heading">
        <div>
          <p className="eyebrow">
            {org.name.toUpperCase()} ·{" "}
            {role.status === "open" ? "OPEN" : "CLOSED"}
          </p>
          <h1>{role.title}</h1>
        </div>
        <div className="co-actions">
          <a
            className="secondary"
            href={`/api/roles/${role.id}/export.csv`}
            download
          >
            <Download size={16} /> Export CSV
          </a>
          {org.role === "owner" && (
            <button
              className="secondary"
              onClick={async () => {
                await api(`/roles/${role.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    status: role.status === "open" ? "closed" : "open",
                  }),
                });
                load();
              }}
            >
              {role.status === "open" ? "Close role" : "Reopen role"}
            </button>
          )}
          <button
            className="primary"
            disabled={role.status !== "open"}
            onClick={() => setInviting(true)}
          >
            <Send size={16} /> Invite candidates
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {inviting && (
        <InvitePanel
          roleId={role.id}
          company={org.name}
          title={role.title}
          close={() => {
            setInviting(false);
            load();
          }}
        />
      )}
      <p className="notice">{AI_NOTE}</p>
      {!candidates.length ? (
        <section className="panel empty">
          <h2>No candidates yet</h2>
          <p>
            Invite candidates by name and email. You’ll get a private link for
            each one to share.
          </p>
        </section>
      ) : (
        <div className="co-table-wrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidate</th>
                <th>Status</th>
                <th>AI estimate</th>
                <th>Eye contact</th>
                {role.rubric.map((r) => (
                  <th key={r.key}>{r.label}</th>
                ))}
                <th>Notes</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => open(c.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open(c.id);
                  }}
                >
                  <td>{c.score !== null ? i + 1 : "—"}</td>
                  <td>
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                  </td>
                  <td>
                    <span className={`co-chip ${c.status}`}>
                      {statusLabel[c.status]}
                    </span>
                    {(c.status === "started" ||
                      (c.status === "completed" &&
                        c.answered < c.questionCount)) && (
                      <small>
                        {c.status === "completed" ? "Ended early · " : ""}
                        {c.answered} of {c.questionCount} answered
                      </small>
                    )}
                  </td>
                  <td>
                    {c.score !== null ? (
                      <b className="co-score">{c.score}</b>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{c.attention !== null ? `${c.attention}%` : "—"}</td>
                  {role.rubric.map((r) => (
                    <td key={r.key}>
                      {c.competencyScores ? (
                        <Bar value={c.competencyScores[r.key]} />
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                  <td>
                    {c.terminated && (
                      <span className="co-chip flag">Ended by proctoring</span>
                    )}
                    {c.unreviewedFlags ? (
                      <span className="co-chip flag">
                        {c.unreviewedFlags} to review
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {c.decision ? (
                      <span className={`co-chip decision-${c.decision.status}`}>
                        {c.decision.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function Bar({ value }: { value: number }) {
  return (
    <span className="co-bar" title={`${value} out of 100`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      <b>{value}</b>
    </span>
  );
}

// datetime-local works in local time; the API takes epoch milliseconds.
const localInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
type Created = {
  id: string;
  name: string;
  email: string;
  link: string;
  opensAt: number;
  closesAt: number;
};
const inviteEmail = (company: string, title: string, l: Created) => ({
  subject: `${company}: your AI screening interview for ${title}`,
  body: `Hi ${l.name},

${company} invites you to a short AI screening interview for the ${title} role.

Your private link (do not share it):
${l.link}

Open it between ${when(l.opensAt)} and ${when(l.closesAt)}.

Before you start:
- Use a laptop or desktop with Chrome or Edge, a camera and a microphone.
- Use one screen only. The interview runs in full screen; leaving full screen or the tab for more than 10 seconds ends it.
- Sit in a quiet, well-lit place. Headphones help.

A person at ${company} reviews every interview and makes every decision.

Best of luck,
${company} hiring team`,
});

function InvitePanel({
  roleId,
  company,
  title,
  close,
}: {
  roleId: string;
  company: string;
  title: string;
  close: () => void;
}) {
  const [text, setText] = useState("");
  const [resumes, setResumes] = useState<Record<string, string>>({});
  const [opens, setOpens] = useState(() => localInput(Date.now()));
  const [closes, setCloses] = useState(() =>
    localInput(Date.now() + 7 * 86400000),
  );
  const [links, setLinks] = useState<Created[] | null>(null);
  const [skipped, setSkipped] = useState<{ email: string; reason: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const parse = () =>
    lines.map((line) => {
      const match = line.match(/^(.*?)[,\s]+([^\s,]+@[^\s,]+)$/);
      return match
        ? {
            name: match[1].replace(/["<>]/g, "").trim() || match[2],
            email: match[2].replace(/[<>]/g, "").toLowerCase(),
          }
        : null;
    });
  const parsed = parse();
  const copy = async (id: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(id);
  };
  return (
    <section className="panel co-invite" aria-label="Invite candidates">
      {!links ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (parsed.some((p) => !p))
              return setError("Use one candidate per line: name, email.");
            const opensAt = new Date(opens).getTime();
            const closesAt = new Date(closes).getTime();
            if (!(closesAt > opensAt))
              return setError("The window must close after it opens.");
            setError("");
            try {
              const result = await api<{
                invites: Created[];
                skipped: typeof skipped;
              }>(`/roles/${roleId}/invites`, {
                method: "POST",
                body: JSON.stringify({
                  candidates: parsed.map((p) => ({
                    ...p,
                    resume: (resumes[p!.email] || "").slice(0, 10000),
                  })),
                  opensAt,
                  closesAt,
                }),
              });
              setLinks(result.invites);
              setSkipped(result.skipped);
            } catch (reason) {
              setError((reason as Error).message);
            }
          }}
        >
          <h2>Invite candidates</h2>
          <label>
            One candidate per line: name, email <small>up to 50</small>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "Asha Rao, asha@example.com\nRavi Shah, ravi@example.com"
              }
            />
          </label>
          <div className="co-window">
            <label>
              Interview opens
              <input
                type="datetime-local"
                required
                value={opens}
                onChange={(e) => setOpens(e.target.value)}
              />
            </label>
            <label>
              Must be finished by
              <input
                type="datetime-local"
                required
                value={closes}
                onChange={(e) => setCloses(e.target.value)}
              />
            </label>
          </div>
          {parsed.some(Boolean) && (
            <div>
              <h3>Résumés (optional)</h3>
              <p className="muted">
                Maya asks follow-ups about real claims in each résumé. Paste the
                text, or choose a .txt file. For a PDF, open it and copy the
                text.
              </p>
              {parsed.map(
                (p) =>
                  p && (
                    <div className="co-invite-row" key={p.email}>
                      <label>
                        {p.name} <small>{p.email}</small>
                        <textarea
                          rows={3}
                          maxLength={10000}
                          value={resumes[p.email] || ""}
                          onChange={(e) =>
                            setResumes((r) => ({ ...r, [p.email]: e.target.value }))
                          }
                          placeholder="Paste résumé text"
                        />
                      </label>
                      <input
                        type="file"
                        accept=".txt,.md,text/plain"
                        aria-label={`Résumé file for ${p.name}`}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const value = (await file.text()).slice(0, 10000);
                          setResumes((r) => ({ ...r, [p.email]: value }));
                        }}
                      />
                    </div>
                  ),
              )}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="co-actions">
            <button className="primary" disabled={!lines.length}>
              Create {lines.length || ""} link{lines.length === 1 ? "" : "s"}
            </button>
            <button type="button" className="text-button" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h2>Send these invites</h2>
          <p className="notice">
            Each link is private to one candidate.{" "}
            <strong>They are shown only now</strong>; if you lose one, reissue
            it from the candidate’s page. “Email” opens a ready-to-send message
            in your own mail app.
          </p>
          <ul className="co-links">
            {links.map((l) => {
              const mail = inviteEmail(company, title, l);
              return (
                <li key={l.id}>
                  <span>
                    <strong>{l.name}</strong>
                    <small>
                      {l.email} · {when(l.opensAt)} to {when(l.closesAt)}
                    </small>
                  </span>
                  <code>{l.link}</code>
                  <a
                    className="secondary button-link"
                    href={`mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`}
                  >
                    <Send size={14} /> Email
                  </a>
                  <button
                    className="secondary"
                    onClick={() => void copy(l.id, mail.body)}
                  >
                    <Copy size={14} /> {copied === l.id ? "Copied" : "Copy message"}
                  </button>
                </li>
              );
            })}
          </ul>
          {skipped.map((s) => (
            <p className="muted" key={s.email}>
              {s.email}: {s.reason}.
            </p>
          ))}
          <button className="primary" onClick={close}>
            Done
          </button>
        </>
      )}
    </section>
  );
}
