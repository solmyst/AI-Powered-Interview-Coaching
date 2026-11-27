import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
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
  proctoring: "strict" | "standard";
  rubric: RubricItem[];
  questionCount: number;
};
type View =
  | { name: "overview" }
  | { name: "settings" }
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

// The hiring workspace: its own shell (side navigation, roles, candidates, reports), separate from practice.
export function Company({
  canCreate,
  requested,
  orgs,
  reload,
}: {
  canCreate: boolean;
  requested: boolean;
  orgs: Org[];
  reload: () => void;
}) {
  const [view, setView] = useState<View>({ name: "overview" });
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [error, setError] = useState("");
  const org = orgs[0];
  const loadRoles = useCallback(() => {
    if (!org) return;
    void api<RoleRow[]>(`/orgs/${org.id}/roles`)
      .then(setRoles)
      .catch((reason) => setError((reason as Error).message));
  }, [org]);
  useEffect(loadRoles, [loadRoles]);
  if (!org)
    return (
      <CreateOrg canCreate={canCreate} requested={requested} done={reload} />
    );
  const owner = org.role === "owner";
  const activeRole =
    view.name === "candidates" || view.name === "report" ? view.roleId : null;
  const go = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="co-shell">
      <nav className="co-side" aria-label="Hiring navigation">
        <p className="co-org">{org.name}</p>
        <button
          className={view.name === "overview" ? "active" : ""}
          aria-current={view.name === "overview" ? "page" : undefined}
          onClick={() => go({ name: "overview" })}
        >
          <LayoutDashboard size={16} /> Overview
        </button>
        <p className="co-side-label">Roles</p>
        {roles?.map((role) => (
          <button
            key={role.id}
            className={activeRole === role.id ? "active" : ""}
            aria-current={activeRole === role.id ? "page" : undefined}
            onClick={() => go({ name: "candidates", roleId: role.id })}
          >
            <span>{role.title}</span>
            <small>
              {role.completed}/{role.total}
            </small>
          </button>
        ))}
        {owner && (
          <button
            className={view.name === "newRole" ? "active" : ""}
            onClick={() => go({ name: "newRole" })}
          >
            <Plus size={16} /> New role
          </button>
        )}
        <p className="co-side-label">Company</p>
        {owner && (
          <button
            className={view.name === "settings" ? "active" : ""}
            onClick={() => go({ name: "settings" })}
          >
            <Settings size={16} /> Settings
          </button>
        )}
      </nav>
      <div className="co-main co">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {view.name === "overview" && (
          <Overview
            org={org}
            roles={roles}
            open={(roleId) => go({ name: "candidates", roleId })}
            create={() => go({ name: "newRole" })}
          />
        )}
        {view.name === "settings" && (
          <CompanySettings org={org} reload={reload} />
        )}
        {view.name === "newRole" && (
          <RoleForm
            org={org}
            back={() => go({ name: "overview" })}
            done={(roleId) => {
              loadRoles();
              go({ name: "candidates", roleId });
            }}
          />
        )}
        {view.name === "candidates" && (
          <Candidates
            key={view.roleId}
            org={org}
            roleId={view.roleId}
            changed={loadRoles}
            back={() => go({ name: "overview" })}
            open={(inviteId) =>
              go({
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
            back={() => go({ name: "candidates", roleId: view.roleId })}
          />
        )}
      </div>
    </div>
  );
}

function CreateOrg({
  canCreate,
  requested,
  done,
}: {
  canCreate: boolean;
  requested: boolean;
  done: () => void;
}) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  if (!canCreate)
    return (
      <div className="wrap workspace narrow">
        <p className="eyebrow">HIRING · EARLY ACCESS</p>
        <h1>Screen candidates with Maya.</h1>
        <p className="lead">
          Maya runs a structured first-round interview for each candidate,
          scores it against your criteria with quoted evidence, and gives you a
          ranked shortlist. A person on your team makes every decision.
        </p>
        {requested ? (
          <section className="panel" role="status">
            <h2>Request received</h2>
            <p>
              Our team will turn on company screening for this account. Sign in
              again later and this page will let you set up your company and
              first role.
            </p>
          </section>
        ) : (
          <form
            className="panel"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              try {
                await api("/orgs/request", {
                  method: "POST",
                  body: JSON.stringify({ company: name, teamSize, note }),
                });
                done();
              } catch (reason) {
                setError((reason as Error).message);
              }
            }}
          >
            <h2>Request access</h2>
            <p className="muted">
              Company accounts are approved by our team during early access.
            </p>
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
              Hiring team size <small>optional</small>
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
              >
                <option value="">Choose</option>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>200+</option>
              </select>
            </label>
            <label>
              Roles you want to screen for <small>optional</small>
              <textarea
                maxLength={1000}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary">Request access</button>
          </form>
        )}
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

function Overview({
  org,
  roles,
  open,
  create,
}: {
  org: Org;
  roles: RoleRow[] | null;
  open: (id: string) => void;
  create: () => void;
}) {
  const total = (key: "total" | "started" | "completed") =>
    roles?.reduce((sum, role) => sum + role[key], 0) ?? 0;
  return (
    <>
      <div className="room-heading">
        <div>
          <p className="eyebrow">HIRING · {org.name.toUpperCase()}</p>
          <h1>Overview</h1>
        </div>
        {org.role === "owner" && (
          <button className="primary" onClick={create}>
            <Plus size={18} /> New role
          </button>
        )}
      </div>
      {roles && roles.length > 0 && (
        <div className="co-stats">
          <div>
            <b>{roles.filter((r) => r.status === "open").length}</b>
            <span>Open roles</span>
          </div>
          <div>
            <b>{total("total")}</b>
            <span>Candidates invited</span>
          </div>
          <div>
            <b>{total("started")}</b>
            <span>Interviewing now</span>
          </div>
          <div>
            <b>{total("completed")}</b>
            <span>Ready to review</span>
          </div>
        </div>
      )}
      {roles && !roles.length && (
        <section className="panel empty">
          <h2>Create your first role</h2>
          <p>
            Paste the job description, choose what good looks like, then share
            one link or invite candidates one by one. Maya interviews them and
            you get a ranked list with evidence.
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
    </>
  );
}

function CompanySettings({ org, reload }: { org: Org; reload: () => void }) {
  const [error, setError] = useState("");
  const [contact, setContact] = useState(org.contactEmail);
  const [retention, setRetention] = useState(org.retentionDays);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="room-heading">
        <div>
          <p className="eyebrow">HIRING · {org.name.toUpperCase()}</p>
          <h1>Company settings</h1>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel co-settings">
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
          Candidates see this email in their notice. After the retention period,
          candidates and everything under them are deleted automatically.
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
            the remaining{" "}
            {Math.max(0, form.questionCount - form.questions.length)}. Leave
            empty to let Maya write every question.
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
                      form.questions.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove question ${i + 1}`}
                onClick={() =>
                  set(
                    "questions",
                    form.questions.filter((_, j) => j !== i),
                  )
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
                {[3, 4, 5, 6, 7, 8]
                  .filter((n) => n >= form.questions.length)
                  .map((n) => (
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
                  Strict: full screen and one display; leaving for 10 s ends the
                  interview
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
  changed,
}: {
  org: Org;
  roleId: string;
  back: () => void;
  open: (inviteId: string) => void;
  changed: () => void;
}) {
  const [data, setData] = useState<{
    role: RoleDetail;
    candidates: CandidateRow[];
  } | null>(null);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
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
  const { role, candidates: everyone } = data;
  const count = (f: Filter) => everyone.filter(filters[f].test).length;
  const needle = query.trim().toLowerCase();
  const candidates = everyone
    .filter(filters[filter].test)
    .filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle),
    );
  const scored = everyone.filter((c) => c.score !== null);
  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft size={16} /> Overview
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
                changed();
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
          proctoring={role.proctoring}
          close={() => {
            setInviting(false);
            load();
            changed();
          }}
        />
      )}
      <ShareLink
        role={role}
        org={org}
        changed={() => {
          load();
          changed();
        }}
      />
      {everyone.length > 0 && (
        <>
          <div className="co-stats">
            <div>
              <b>{everyone.length}</b>
              <span>Invited</span>
            </div>
            <div>
              <b>{count("progress")}</b>
              <span>In progress</span>
            </div>
            <div>
              <b>{count("review")}</b>
              <span>To review</span>
            </div>
            <div>
              <b>
                {scored.length
                  ? Math.round(
                      scored.reduce((sum, c) => sum + (c.score ?? 0), 0) /
                        scored.length,
                    )
                  : "—"}
              </b>
              <span>Average AI estimate</span>
            </div>
          </div>
          <div className="co-toolbar">
            <div
              className="co-tabs"
              role="tablist"
              aria-label="Filter candidates"
            >
              {(Object.keys(filters) as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {filters[f].label} <small>{count(f)}</small>
                </button>
              ))}
            </div>
            <label className="co-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search name or email"
                aria-label="Search candidates"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        </>
      )}
      <p className="notice">{AI_NOTE}</p>
      {!everyone.length ? (
        <section className="panel empty">
          <h2>No candidates yet</h2>
          <p>
            Share the open link above, or invite candidates by name and email.
            Each person gets their own private interview link.
          </p>
        </section>
      ) : !candidates.length ? (
        <section className="panel empty">
          <h2>No one matches</h2>
          <p>Try another filter or search.</p>
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
                <th>Decision</th>
                <th>Notes</th>
                <th>Eye contact</th>
                {role.rubric.map((r) => (
                  <th key={r.key}>{r.label}</th>
                ))}
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
                  <td>
                    {c.decision ? (
                      <span className={`co-chip decision-${c.decision.status}`}>
                        {c.decision.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
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
type Filter = "all" | "review" | "progress" | "waiting" | "decided";
const filters: Record<
  Filter,
  { label: string; test: (c: CandidateRow) => boolean }
> = {
  all: { label: "All", test: () => true },
  review: {
    label: "To review",
    test: (c) => c.status === "completed" && !c.decision,
  },
  progress: { label: "In progress", test: (c) => c.status === "started" },
  waiting: {
    label: "Not started",
    test: (c) => ["pending", "expired"].includes(c.status),
  },
  decided: { label: "Decided", test: (c) => Boolean(c.decision) },
};
type Created = {
  id: string;
  name: string;
  email: string;
  link: string;
  opensAt: number;
  closesAt: number;
};
const inviteEmail = (
  company: string,
  title: string,
  l: Created,
  proctoring: "strict" | "standard",
) => ({
  subject: `${company}: your AI screening interview for ${title}`,
  body: `Hi ${l.name},

${company} invites you to a short AI screening interview for the ${title} role.

Your private link (do not share it):
${l.link}

Open it between ${when(l.opensAt)} and ${when(l.closesAt)}.

Before you start:
- Use a laptop or desktop with Chrome or Edge, a camera and a microphone.
${proctoring === "strict" ? "- Use one screen only. The interview runs in full screen; leaving full screen or the tab for more than 10 seconds ends it.\n" : ""}- Sit in a quiet, well-lit place. Headphones help.

A person at ${company} reviews every interview and makes every decision.

Best of luck,
${company} hiring team`,
});

function InvitePanel({
  roleId,
  company,
  title,
  proctoring,
  close,
}: {
  roleId: string;
  company: string;
  title: string;
  proctoring: "strict" | "standard";
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
                            setResumes((r) => ({
                              ...r,
                              [p.email]: e.target.value,
                            }))
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
              const mail = inviteEmail(company, title, l, proctoring);
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
                    <Copy size={14} />{" "}
                    {copied === l.id ? "Copied" : "Copy message"}
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

type OpenLink = {
  enabled: boolean;
  link: string | null;
  cap: number;
  used: number;
};
// Two ways to reach candidates: one shared link anyone can use to sign themselves up, or a private link per person.
function ShareLink({
  role,
  org,
  changed,
}: {
  role: RoleDetail;
  org: Org;
  changed: () => void;
}) {
  const [info, setInfo] = useState<OpenLink | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cap, setCap] = useState(50);
  const owner = org.role === "owner";
  useEffect(() => {
    void api<OpenLink>(`/roles/${role.id}/open-link`)
      .then((value) => {
        setInfo(value);
        setCap(value.cap);
      })
      .catch((reason) => setError((reason as Error).message));
  }, [role.id]);
  const save = async (enabled: boolean, rotate = false) => {
    setError("");
    try {
      setInfo(
        await api<OpenLink>(`/roles/${role.id}/open-link`, {
          method: "PUT",
          body: JSON.stringify({ enabled, cap, rotate }),
        }),
      );
      changed();
    } catch (reason) {
      setError((reason as Error).message);
    }
  };
  const message = info?.link
    ? `Hi, ${org.name} invites you to a short AI screening interview for the ${role.title} role.\n\nOpen this link, enter your name and email, and you will get your own interview: ${info.link}\n\nUse a laptop or desktop with Chrome or Edge, a camera and a microphone. A person at ${org.name} reviews every interview.`
    : "";
  return (
    <section className="panel co-share" aria-label="Share this role">
      <div>
        <h2>
          <Link2 size={18} aria-hidden="true" /> Share one link
        </h2>
        <p className="muted">
          Send the same link to everyone, for example in a group chat or on a
          careers page. Each person enters their name and email and gets their
          own private interview. To send private links to named people, use
          “Invite candidates” above.
        </p>
        {info?.enabled && info.link ? (
          <>
            <div className="co-sharebox">
              <code>{info.link}</code>
              <button
                className="primary"
                onClick={async () => {
                  await navigator.clipboard?.writeText(message);
                  setCopied(true);
                }}
              >
                <Copy size={15} /> {copied ? "Copied" : "Copy message"}
              </button>
            </div>
            <p className="muted">
              {info.used} of {info.cap} places used.{" "}
              {owner && (
                <>
                  <label className="co-inline">
                    Limit
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={cap}
                      onChange={(e) => setCap(Number(e.target.value))}
                      onBlur={() => void save(true)}
                    />
                  </label>{" "}
                  <button
                    className="text-button"
                    onClick={() => void save(false)}
                  >
                    Turn off
                  </button>{" "}
                  <button
                    className="text-button"
                    onClick={() => void save(true, true)}
                  >
                    New link
                  </button>
                </>
              )}
            </p>
          </>
        ) : owner ? (
          <button
            className="primary"
            disabled={role.status !== "open"}
            onClick={() => void save(true)}
          >
            Create shareable link
          </button>
        ) : (
          <p className="muted">The owner has not turned this on.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
