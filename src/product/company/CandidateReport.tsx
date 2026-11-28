import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Link2, Trash2 } from "lucide-react";
import { api } from "../api";
import type { RubricItem } from "../types";
import { AI_NOTE, Bar, type Org } from "./Company";
import { bandLabel, type Band } from "./band";

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
type Delivery = {
  spoken: boolean;
  words: number;
  fillers: Record<string, number>;
  fillerTotal: number;
  captureMs: number;
  wpm: number | null;
  observedMs?: number;
  awayEpisodes?: number;
  awayMs?: number;
  lostEpisodes?: number;
  lostMs?: number;
};
type DeliverySummary = {
  answers: number;
  spokenAnswers: number;
  typedAnswers: number;
  words: number;
  fillerTotal: number;
  fillers: Record<string, number>;
  fillersPer100Words: number | null;
  wpm: number | null;
  cameraAnswers: number;
  awayEpisodes: number;
  awaySeconds: number;
  lostEpisodes: number;
  lostSeconds: number;
  observedSeconds: number;
};
type ReportBody = {
  summary: string;
  strengths: string[];
  concerns: string[];
  suggestedFollowUps: string[];
  competencyScores: Record<string, number>;
  overall: number;
  attention: number | null;
  answeredAverage?: number;
  band?: Band;
  coverage?: { answered: number; total: number; noContent: number };
  confidence?: "high" | "low";
};
type Turn = {
  question: { question: string; focus: string };
  answer: string;
  exchanges: { said: string; reply: string }[];
  evaluation: {
    scores: Record<string, number>;
    evidence: Evidence[];
    rationale: string;
    evidenceDropped?: number;
    gate?: string | null;
    confidence?: {
      samples: number;
      spread: number;
      unsupported: string[];
      reviewRequired?: boolean;
    };
    followUpForHuman?: string;
  } | null;
  attention: { eyeContact: number; inFrame: number } | null;
  delivery: Delivery | null;
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
    deliverySummary: DeliverySummary;
    turns: Turn[];
    currentQuestion: { question: string } | null;
    report: ReportBody | null;
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
  multiple_screens: "Second display connected",
  terminated: "Interview ended by proctoring",
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
            <span>
              AI estimate{report.band ? ` · ${bandLabel[report.band]}` : ""}
            </span>
          </div>
        )}
        {report?.attention != null && (
          <div
            className="co-bigscore"
            aria-label={`Eye contact ${report.attention} percent`}
          >
            <b>{report.attention}%</b>
            <span>Eye contact</span>
          </div>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="notice">{AI_NOTE}</p>

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
      {screening && screening.turns.length > 0 && (
        <Scorecard
          report={report}
          rubric={role.rubric}
          turns={screening.turns}
          summary={screening.deliverySummary}
          events={events}
        />
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
          {(turn.attention || turn.delivery) && (
            <p className="muted co-signals">
              {turn.attention &&
                `Eye contact ${turn.attention.eyeContact}% · face in frame ${turn.attention.inFrame}%`}
              {turn.delivery?.awayEpisodes !== undefined &&
                ` · looked away ${turn.delivery.awayEpisodes} time${turn.delivery.awayEpisodes === 1 ? "" : "s"} (${Math.round((turn.delivery.awayMs ?? 0) / 1000)} s)`}
              {turn.delivery && ` · ${turn.delivery.words} words`}
              {turn.delivery?.wpm ? ` · ${turn.delivery.wpm} words/min` : ""}
              {turn.delivery?.spoken
                ? ` · filler words ${turn.delivery.fillerTotal}${fillerList(turn.delivery.fillers)}`
                : " · typed answer"}
            </p>
          )}
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
              {turn.evaluation.gate && (
                <p className="notice" role="note">
                  No credit for this answer: {turn.evaluation.gate}
                </p>
              )}
              {!turn.evaluation.gate &&
                (turn.evaluation.confidence?.reviewRequired ||
                  (turn.evaluation.confidence?.spread ?? 0) >= 2 ||
                  (turn.evaluation.confidence?.unsupported.length ?? 0) >
                    0) && (
                  <p className="notice" role="note">
                    Review needed: the AI’s judgements disagreed or some scores
                    had no supporting quote, so they were reduced. Read the
                    answer before relying on them. Judge agreement is not a
                    calibrated probability of correctness.
                  </p>
                )}
              {turn.evaluation.evidence.length === 0 &&
                (turn.evaluation.evidenceDropped ?? 0) > 0 && (
                  <p className="notice" role="note">
                    The AI’s quotes for this answer could not be matched to what
                    the candidate said, so they were discarded. Read the answer
                    yourself before relying on these scores.
                  </p>
                )}
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

const fillerList = (fillers: Record<string, number>) => {
  const list = Object.entries(fillers).sort((a, b) => b[1] - a[1]);
  return list.length
    ? ` (${list.map(([w, n]) => `${w} ×${n}`).join(", ")})`
    : "";
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const average = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

// Everything a reviewer needs to judge a candidate in one place: the content score and how it was built,
// then delivery signals and focus notes beside it (never inside it).
function Scorecard({
  report,
  rubric,
  turns,
  summary,
  events,
}: {
  report: ReportBody | null | undefined;
  rubric: RubricItem[];
  turns: Turn[];
  summary: DeliverySummary;
  events: Event[];
}) {
  const flagged = events.filter((e) => !quiet.has(e.kind));
  const byKind = Object.entries(
    flagged.reduce<Record<string, { n: number; ms: number }>>((acc, e) => {
      const row = acc[e.kind] || { n: 0, ms: 0 };
      row.n += 1;
      row.ms += e.durationMs || 0;
      acc[e.kind] = row;
      return acc;
    }, {}),
  );
  // Weighted like the overall estimate, so the answers' scores average to it.
  const weights = rubric.reduce((n, r) => n + r.weight, 0);
  const answerScore = (t: Turn) =>
    t.evaluation
      ? Math.round(
          rubric.reduce(
            (n, r) => n + (t.evaluation!.scores[r.key] ?? 0) * r.weight,
            0,
          ) / weights,
        )
      : null;
  const hasCamera = summary.cameraAnswers > 0;
  // Averaged here so it shows while the interview is still in progress, before the final report exists.
  const eyeContact = average(
    turns.flatMap((t) => (t.attention ? [t.attention.eyeContact] : [])),
  );
  return (
    <section className="panel co-scorecard" aria-label="Evaluation scorecard">
      <h2>Evaluation scorecard</h2>
      <p className="muted">
        The AI estimate is about <strong>what was said</strong>: each answer is
        scored against your criteria, and the overall is the average of the
        criteria weighted {rubric.map((r) => r.weight).join(" : ")}. Delivery
        signals and focus notes below are shown for context. They are{" "}
        <strong>not part of the estimate</strong>, and they depend on camera
        position, lighting, accent, language and connection.
      </p>
      {report?.band === "insufficient" && (
        <p className="notice" role="note">
          <strong>Not enough to judge.</strong> Only{" "}
          {report.coverage?.answered ?? 0} of {report.coverage?.total ?? 0}{" "}
          questions were answered
          {report.coverage?.noContent
            ? `, and ${report.coverage.noContent} had no real content`
            : ""}
          . Treat this as not assessed rather than as a low score.
        </p>
      )}
      {report?.confidence === "low" && (
        <p className="notice" role="note">
          Lower confidence: for at least one answer the AI’s judgements
          disagreed or some scores lacked a supporting quote.
        </p>
      )}
      <details className="co-method">
        <summary>How the estimate is calculated</summary>
        <ol>
          <li>
            Answers that add nothing beyond the question (restating it, “I don’t
            know”, filler, off topic) get <strong>0</strong> without being
            judged.
          </li>
          <li>
            Otherwise the AI judges each criterion three times on a 0 to 4 scale
            (0 none, 1 generic, 2 partly specific, 3 specific and reasoned, 4
            also weighs trade-offs or measures success), and the middle result
            is used. A scale level maps to 0, 20, 45, 75 or 95.
          </li>
          <li>
            Any credit of level 2 or more needs a quote the candidate really
            said; otherwise it is capped at level 1. Communication can never
            score more than one level above the best content criterion.
          </li>
          <li>
            The overall is the weighted average over <strong>all</strong>{" "}
            questions. A question not answered counts as 0, so leaving early
            cannot raise the score
            {report?.answeredAverage !== undefined
              ? ` (the average of answered questions alone is ${report.answeredAverage}).`
              : "."}
          </li>
          <li>
            Eye contact, looking away, filler words and pace are never part of
            the estimate.
          </li>
        </ol>
      </details>
      <div className="co-stats">
        <div>
          <b>{report ? report.overall : "—"}</b>
          <span>
            AI estimate (content)
            {report?.coverage
              ? ` · ${report.coverage.answered} of ${report.coverage.total} answered`
              : ""}
          </span>
        </div>
        <div>
          <b>{eyeContact !== null ? `${eyeContact}%` : "—"}</b>
          <span>Eye contact (avg)</span>
        </div>
        <div>
          <b>{hasCamera ? summary.awayEpisodes : "—"}</b>
          <span>
            Times looked away
            {hasCamera ? ` · ${summary.awaySeconds} s total` : ""}
          </span>
        </div>
        <div>
          <b>{hasCamera ? summary.lostEpisodes : "—"}</b>
          <span>
            Times out of frame
            {hasCamera ? ` · ${summary.lostSeconds} s` : ""}
          </span>
        </div>
        <div>
          <b>{summary.spokenAnswers ? summary.fillerTotal : "—"}</b>
          <span>
            Filler words
            {summary.fillersPer100Words !== null
              ? ` · ${summary.fillersPer100Words} per 100 words`
              : ""}
          </span>
        </div>
        <div>
          <b>{summary.wpm ?? "—"}</b>
          <span>Speaking pace (words/min)</span>
        </div>
        <div>
          <b>{flagged.length}</b>
          <span>Focus notes</span>
        </div>
      </div>
      {!hasCamera && (
        <p className="muted">
          No camera data was recorded for this candidate (the camera was off or
          blocked), so eye contact and looking-away counts are not available.
        </p>
      )}
      {summary.typedAnswers > 0 && (
        <p className="muted">
          {plural(summary.typedAnswers, "answer")} of {summary.answers} typed
          instead of spoken; pace and filler words cover spoken answers only.
        </p>
      )}
      {Object.keys(summary.fillers).length > 0 && (
        <p>
          <strong>Filler words used:</strong>{" "}
          {Object.entries(summary.fillers)
            .sort((a, b) => b[1] - a[1])
            .map(([w, n]) => `“${w}” ×${n}`)
            .join(", ")}
          . Counted from the transcript, so a speech service may drop some.
        </p>
      )}
      {byKind.length > 0 && (
        <p>
          <strong>Focus notes:</strong>{" "}
          {byKind
            .map(
              ([kind, v]) =>
                `${kindLabel[kind] || kind} ${plural(v.n, "time")}${v.ms ? ` (${Math.round(v.ms / 1000)} s)` : ""}`,
            )
            .join(", ")}
          .
        </p>
      )}
      <div
        className="co-table-wrap"
        role="region"
        aria-label="Answer score comparison, scroll horizontally for more columns"
        tabIndex={0}
      >
        <table className="co-table">
          <caption className="co-table-caption">
            Scroll for all criteria →
          </caption>
          <thead>
            <tr>
              <th>Answer</th>
              <th>AI score (weighted)</th>
              {rubric.map((r) => (
                <th key={r.key}>{r.label}</th>
              ))}
              <th>Eye contact</th>
              <th>Looked away</th>
              <th>Out of frame</th>
              <th>Words</th>
              <th>Pace</th>
              <th>Fillers</th>
            </tr>
          </thead>
          <tbody>
            {turns.map((t, i) => (
              <tr key={i}>
                <td>
                  Q{i + 1}
                  <small>{t.question.focus}</small>
                </td>
                <td>
                  <b className="co-score">{answerScore(t) ?? "—"}</b>
                </td>
                {rubric.map((r) => (
                  <td key={r.key}>{t.evaluation?.scores[r.key] ?? "—"}</td>
                ))}
                <td>{t.attention ? `${t.attention.eyeContact}%` : "—"}</td>
                <td>
                  {t.delivery?.awayEpisodes !== undefined
                    ? `${t.delivery.awayEpisodes}× · ${Math.round((t.delivery.awayMs ?? 0) / 1000)} s`
                    : "—"}
                </td>
                <td>
                  {t.delivery?.lostEpisodes !== undefined
                    ? `${t.delivery.lostEpisodes}×`
                    : "—"}
                </td>
                <td>{t.delivery?.words ?? "—"}</td>
                <td>{t.delivery?.wpm ?? "—"}</td>
                <td>{t.delivery?.spoken ? t.delivery.fillerTotal : "typed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
