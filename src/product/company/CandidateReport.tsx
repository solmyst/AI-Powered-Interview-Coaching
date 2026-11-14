import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Link2, Trash2 } from "lucide-react";
import { api } from "../api";
import type { RubricItem } from "../types";
import { AI_NOTE, Bar, type Org } from "./Company";

type Event = {
  id: number;
  at: string;
  turn: number;
  kind: string;
  durationMs: number | null;
  reviewedAt: string | null;
  verdict: string | null;
  reviewNote: string | null;
};
type Evidence = {
  competency: string;
  quote: string;
  supports: "strength" | "concern";
};
type Turn = {
  question: { question: string; focus: string };
  answer: string;
  exchanges: { said: string; reply: string }[];
  evaluation: {
    scores: Record<string, number>;
    evidence: Evidence[];
    rationale: string;
    followUpForHuman?: string;
  } | null;
  events: Event[];
};
type Report = {
  invite: {
    id: string;
    name: string;
    email: string;
    status: string;
    decision: { status: string; note: string; by: string; at: string } | null;
    candidateNote: string | null;
    consent: { version: string; acceptedAt: string } | null;
  };
  role: {
    id: string;
    title: string;
    rubric: RubricItem[];
    questionCount: number;
  };
  screening: {
    state: string;
    turns: Turn[];
    currentQuestion: { question: string } | null;
    report: {
      summary: string;
      strengths: string[];
      concerns: string[];
      suggestedFollowUps: string[];
      competencyScores: Record<string, number>;
      overall: number;
    } | null;
  } | null;
  events: Event[];
};

const kindLabel: Record<string, string> = {
  tab_hidden: "Left the tab",
  fullscreen_exit: "Left full screen",
  face_absent: "No face in view",
  multiple_faces: "More than one face",
  camera_off: "Camera stopped",
  paste: "Pasted text",
  reconnect: "Reconnected",
  new_device: "Continued on another device",
};
const quiet = new Set(["reconnect", "new_device"]);
const length = (ms: number | null) =>
  ms ? ` · ${Math.round(ms / 1000)}s` : "";

export function CandidateReport({
  org,
  inviteId,
  back,
}: {
  org: Org;
  inviteId: string;
  back: () => void;
}) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const load = useCallback(() => {
    void api<Report>(`/invites/${inviteId}/report`)
      .then((r) => {
        setData(r);
        setNote((typed) => typed || r.invite.decision?.note || "");
      })
      .catch((reason) => setError((reason as Error).message));
  }, [inviteId]);
  useEffect(load, [load]);
  if (!data)
    return error ? (
      <>
        <button className="text-button" onClick={back}>
          <ArrowLeft size={16} /> Candidates
        </button>
        <p className="error" role="alert">
          {error}
        </p>
      </>
    ) : (
      <p aria-busy="true">Opening report…</p>
    );
  const { invite, role, screening, events } = data;
  const report = screening?.report;
  const label = (key: string) =>
    role.rubric.find((r) => r.key === key)?.label || key;
  const decide = async (status: string) => {
    setError("");
    try {
      await api(`/invites/${invite.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ status, note }),
      });
      load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  };
  const review = async (ids: number[], verdict: "no_concern" | "concern") => {
    await api(`/invites/${invite.id}/integrity-review`, {
      method: "POST",
      body: JSON.stringify({ eventIds: ids, verdict, note: "" }),
    });
    load();
  };
  const flagged = events.filter((e) => !quiet.has(e.kind));
  const pending = flagged.filter((e) => !e.reviewedAt);
  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft size={16} /> Candidates
      </button>
      <div className="room-heading">
        <div>
          <p className="eyebrow">{role.title.toUpperCase()}</p>
          <h1>{invite.name}</h1>
          <p className="muted">
            {invite.email} ·{" "}
            {invite.status === "completed"
              ? "Completed"
              : invite.status === "started"
                ? `In progress, ${screening?.turns.length ?? 0} of ${role.questionCount} answered`
                : invite.status}
          </p>
        </div>
        {report && (
          <div
            className="co-bigscore"
            aria-label={`AI estimate ${report.overall} out of 100`}
          >
            <b>{report.overall}</b>
            <span>AI estimate</span>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="notice">{AI_NOTE}</p>

      <section className="panel co-decision">
        <h2>Your decision</h2>
        <p className="muted">
          A person makes every decision. Nothing happens to a candidate unless
          you choose it here.
        </p>
        <label>
          Note for your team <small>optional</small>
          <input
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="co-actions">
          {(["advance", "hold", "reject"] as const).map((s) => (
            <button
              key={s}
              className={
                invite.decision?.status === s
                  ? `primary decision-${s}`
                  : "secondary"
              }
              aria-pressed={invite.decision?.status === s}
              onClick={() => void decide(s)}
            >
              {s === "advance" ? "Advance" : s === "hold" ? "Hold" : "Reject"}
            </button>
          ))}
        </div>
        {invite.decision && (
          <p className="muted">
            Recorded by {invite.decision.by} on{" "}
            {new Date(invite.decision.at).toLocaleDateString()}.
          </p>
        )}
      </section>

      {report && (
        <section className="panel">
          <h2>Summary</h2>
          <p>{report.summary}</p>
          <div className="co-competencies">
            {role.rubric.map((r) => (
              <div key={r.key}>
                <span>
                  {r.label} <small>weight {r.weight}</small>
                </span>
                <Bar value={report.competencyScores[r.key]} />
              </div>
            ))}
          </div>
          <div className="two-col">
            <div>
              <h3>Strengths</h3>
              <ul className="feedback-list">
                {report.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Concerns</h3>
              {report.concerns.length ? (
                <ul className="feedback-list">
                  {report.concerns.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">None raised.</p>
              )}
            </div>
          </div>
          <h3>Questions for your human round</h3>
          <ul className="feedback-list">
            {report.suggestedFollowUps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {!report && screening && (
        <p className="notice">
          This interview isn’t finished, so there is no overall estimate. The
          answers so far are below.
        </p>
      )}
      {!screening && (
        <p className="notice">The candidate hasn’t started yet.</p>
      )}

      {invite.candidateNote && (
        <section className="panel">
          <h2>Note from the candidate</h2>
          <p className="prewrap">{invite.candidateNote}</p>
        </section>
      )}

      <section className="panel">
        <h2>Focus notes</h2>
        <p className="muted">
          Browser signals the candidate was told about. They have ordinary
          causes, such as a notification, and never change the score. Mark each
          as no concern or a concern.
        </p>
        {!flagged.length && <p>None recorded.</p>}
        {pending.length > 0 && (
          <div className="co-actions">
            <button
              className="secondary"
              onClick={() =>
                void review(
                  pending.map((e) => e.id),
                  "no_concern",
                )
              }
            >
              Mark all {pending.length} as no concern
            </button>
          </div>
        )}
        <ul className="co-events">
          {flagged.map((e) => (
            <li key={e.id}>
              <span>
                <strong>
                  {kindLabel[e.kind]}
                  {length(e.durationMs)}
                </strong>{" "}
                <small>during question {e.turn + 1}</small>
              </span>
              {e.reviewedAt ? (
                <span
                  className={`co-chip ${e.verdict === "concern" ? "flag" : "completed"}`}
                >
                  {e.verdict === "concern" ? "Concern" : "No concern"}
                </span>
              ) : (
                <span className="co-actions">
                  <button
                    className="secondary"
                    onClick={() => void review([e.id], "no_concern")}
                  >
                    No concern
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void review([e.id], "concern")}
                  >
                    Concern
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {events.some((e) => quiet.has(e.kind)) && (
          <p className="muted">
            Informational:{" "}
            {(
              [
                [
                  events.filter((e) => e.kind === "reconnect").length,
                  "reconnect",
                ],
                [
                  events.filter((e) => e.kind === "new_device").length,
                  "device change",
                ],
              ] as [number, string][]
            )
              .filter(([n]) => n)
              .map(([n, word]) => `${n} ${word}${n === 1 ? "" : "s"}`)
              .join(", ")}
            .
          </p>
        )}
      </section>

      {screening?.turns.map((turn, i) => (
        <section className="panel co-turn" key={i}>
          <p className="eyebrow">
            QUESTION {i + 1} · {turn.question.focus.toUpperCase()}
          </p>
          <h3>{turn.question.question}</h3>
          {turn.exchanges.map((x, j) => (
            <div className="co-chat" key={j}>
              <p className="you">{x.said}</p>
              <p className="maya">{x.reply}</p>
            </div>
          ))}
          <blockquote className="prewrap">{turn.answer}</blockquote>
          {turn.evaluation ? (
            <>
              <div className="co-competencies">
                {role.rubric.map((r) => (
                  <div key={r.key}>
                    <span>{r.label}</span>
                    <Bar value={turn.evaluation!.scores[r.key] ?? 0} />
                  </div>
                ))}
              </div>
              <p>{turn.evaluation.rationale}</p>
              {turn.evaluation.evidence.length > 0 && (
                <ul className="co-evidence">
                  {turn.evaluation.evidence.map((e, k) => (
                    <li key={k} className={e.supports}>
                      <b>
                        {e.supports === "strength" ? "Strength" : "Concern"} ·{" "}
                        {label(e.competency)}
                      </b>
                      “{e.quote}”
                    </li>
                  ))}
                </ul>
              )}
              {turn.evaluation.followUpForHuman && (
                <p className="muted">
                  <b>Ask in person:</b> {turn.evaluation.followUpForHuman}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Scoring in progress.</p>
          )}
          {turn.events.filter((e) => !quiet.has(e.kind)).length > 0 && (
            <p className="muted">
              Focus notes:{" "}
              {turn.events
                .filter((e) => !quiet.has(e.kind))
                .map((e) => kindLabel[e.kind] + length(e.durationMs))
                .join(", ")}
            </p>
          )}
        </section>
      ))}

      <section className="panel co-danger">
        <h2>Link and data</h2>
        {link && (
          <p className="notice">
            New link (shown once, the old one no longer works):{" "}
            <code>{link}</code>
          </p>
        )}
        <div className="co-actions">
          {!["completed", "withdrawn"].includes(invite.status) && (
            <button
              className="secondary"
              onClick={async () => {
                const r = await api<{ link: string }>(
                  `/invites/${invite.id}/reissue`,
                  { method: "POST", body: "{}" },
                );
                setLink(r.link);
              }}
            >
              <Link2 size={16} /> Reissue link
            </button>
          )}
          {["pending", "started"].includes(invite.status) && (
            <button
              className="secondary"
              onClick={async () => {
                await api(`/invites/${invite.id}/revoke`, {
                  method: "POST",
                  body: "{}",
                });
                load();
              }}
            >
              Revoke link
            </button>
          )}
          {org.role === "owner" && (
            <button
              className="danger"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Delete ${invite.name} and all their interview data permanently? This cannot be undone.`,
                  )
                )
                  return;
                await api(`/invites/${invite.id}`, { method: "DELETE" });
                back();
              }}
            >
              <Trash2 size={16} /> Delete candidate data
            </button>
          )}
        </div>
      </section>
    </>
  );
}
