import { useRef, useState } from "react";
import { ArrowRight, FileText, SlidersHorizontal } from "lucide-react";
import { api } from "./api";
import {
  roles,
  tracks,
  type Session,
  type Setup as SetupType,
  type Health,
  type Usage,
} from "./types";
const defaults: SetupType = {
  role: "Software engineering",
  experience: "Student / graduate",
  track: "Technical",
  difficulty: "Intermediate",
  industry: "Technology",
  company: "",
  resume: "",
  jobDescription: "",
  questionCount: 5,
};
export function Setup({
  health,
  usage,
  open,
  refresh,
}: {
  health: Health | null;
  usage: Usage;
  open: (s: Session) => void;
  refresh: () => void;
}) {
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useRef(crypto.randomUUID());
  const update = (key: keyof SetupType, value: string | number) => {
    setForm({ ...form, [key]: value });
    id.current = crypto.randomUUID();
  };
  const select = (label: string, key: keyof SetupType, options: string[]) => (
    <label>
      {label}
      <select value={form[key]} onChange={(e) => update(key, e.target.value)}>
        {options.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="wrap workspace">
      <p className="eyebrow">SET YOUR INTENTION</p>
      <h1>An interview built around you.</h1>
      <p className="lead">
        Choose your focus. We’ll take it one question at a time.
      </p>
      <form
        className="setup-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            open(
              await api<Session>("/interviews", {
                method: "POST",
                headers: { "Idempotency-Key": id.current },
                body: JSON.stringify(form),
              }),
            );
            refresh();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <section className="panel">
            <div className="panel-title">
              <SlidersHorizontal size={20} />
              <h2>The essentials</h2>
              <span>01</span>
            </div>
            <div className="form-grid">
              {select("Target role", "role", roles)}
              {select("Experience", "experience", [
                "Student / graduate",
                "Early career",
                "Experienced",
                "Senior / lead",
              ])}
              {select("Interview round", "track", tracks)}
              {select("Difficulty", "difficulty", [
                "Foundational",
                "Intermediate",
                "Advanced",
              ])}
              <label>
                Industry
                <input
                  required
                  maxLength={80}
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                />
              </label>
              <label>
                Target company <small>optional</small>
                <input
                  maxLength={100}
                  placeholder="e.g. a fintech startup"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                />
              </label>
            </div>
            <small>
              Company preparation uses public role expectations, not
              confidential questions.
            </small>
          </section>
          <section className="panel">
            <div className="panel-title">
              <FileText size={20} />
              <h2>Add your context</h2>
              <span>02</span>
            </div>
            <p>
              Optional. Remove contact details or other sensitive information
              before adding your resume.
            </p>
            <label>
              Upload a text resume (.txt, up to 40 KB)
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    !f.name.toLowerCase().endsWith(".txt") ||
                    f.size > 40000
                  ) {
                    setError(
                      "Please use a .txt resume smaller than 40 KB, or paste the relevant text.",
                    );
                    return;
                  }
                  const text = await f.text();
                  if (text.length > 10000) {
                    setError("Resume text must be under 10,000 characters.");
                    return;
                  }
                  update("resume", text);
                  setError("");
                }}
              />
            </label>
            <label>
              Resume or project highlights
              <textarea
                rows={5}
                maxLength={10000}
                placeholder="Your skills, projects, responsibilities, and impact…"
                value={form.resume}
                onChange={(e) => update("resume", e.target.value)}
              />
            </label>
            <label>
              Job description
              <textarea
                rows={4}
                maxLength={6000}
                placeholder="Paste the role requirements…"
                value={form.jobDescription}
                onChange={(e) => update("jobDescription", e.target.value)}
              />
            </label>
            <small>
              For PDF or Word resumes, paste the relevant text. Context is
              stored during the interview and removed when your report is
              generated. Questions may still reference it.
            </small>
          </section>
        </div>
        <aside>
          <div className="panel setup-summary">
            <p className="eyebrow">YOUR PRACTICE SESSION</p>
            <h2>{form.track}</h2>
            <p>{form.role}</p>
            <hr />
            <label>
              Number of questions
              <select
                value={form.questionCount}
                onChange={(e) =>
                  update("questionCount", Number(e.target.value))
                }
              >
                {[3, 5, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} questions · about {n * 3} minutes
                  </option>
                ))}
              </select>
            </label>
            <ul className="checklist">
              <li>Adaptive follow-up questions</li>
              <li>Answer-by-answer feedback</li>
              <li>A personal study plan</li>
              <li>Text first, optional voice</li>
            </ul>
            <div className="provider-status">
              <span className={`dot ${health?.ready ? "" : "offline"}`} />
              {health?.ready
                ? "AI provider configured"
                : "AI provider unavailable"}
              <small>{health?.model || "Checking connection…"}</small>
            </div>
            {!health?.ready && (
              <button className="text-button" type="button" onClick={refresh}>
                Check connection again
              </button>
            )}
            <p className="muted">
              {usage.limit - usage.used} of {usage.limit} daily sessions
              remaining
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={busy || !health?.ready || usage.used >= usage.limit}
            >
              {busy ? "Preparing your first question…" : "Begin interview"}
              <ArrowRight size={18} />
            </button>
            <small aria-live="polite">
              {busy
                ? "Your model is thinking. Local generation may take up to two minutes."
                : "Answers are shared with the configured AI provider. No camera access is needed."}
            </small>
          </div>
        </aside>
      </form>
    </div>
  );
}
