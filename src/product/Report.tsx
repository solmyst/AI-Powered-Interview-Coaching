import { Bookmark as BookmarkIcon, Download, ArrowUpRight } from "lucide-react";
import { download } from "./api";
import type { Bookmark, Session } from "./types";
export function Report({
  session,
  bookmarks,
  toggle,
  start,
}: {
  session: Session;
  bookmarks: Bookmark[];
  toggle: (id: string, turn: number, saved: boolean) => void;
  start: () => void;
}) {
  const report = session.report!;
  return (
    <div className="wrap workspace">
      <div className="room-heading">
        <div>
          <p className="eyebrow">YOUR INTERVIEW, REFLECTED</p>
          <h1>Practice with a purpose.</h1>
          <p>
            {session.setup.role} · {session.setup.track} · {report.answered}{" "}
            answers reviewed
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => download(`interviewace-${session.id}.json`, session)}
        >
          <Download size={17} />
          Export report
        </button>
      </div>
      <section className="report-overview">
        <div className="score-orb">
          <strong>{report.overall}</strong>
          <span>OUT OF 100</span>
        </div>
        <div>
          <p className="eyebrow">COACHING SUMMARY</p>
          <h2>Here’s where you stand.</h2>
          <p>{report.summary}</p>
        </div>
      </section>
      <p className="notice">
        AI coaching estimate, not an objective hiring decision. Each dimension
        has equal weight; the overall score averages the eight dimensions across
        answered questions. Evidence measures support for claims, not personal
        confidence. Code was reviewed, not executed.
      </p>
      <section className="panel">
        <h2>Your answer profile</h2>
        <div className="scores-grid">
          {Object.entries(report.scores).map(([name, value]) => (
            <div key={name}>
              <div className="score-label">
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
              <meter min={0} max={100} value={value} aria-label={name} />
            </div>
          ))}
        </div>
        <details>
          <summary>How to interpret these scores</summary>
          <p>
            0–24: missing or incorrect · 25–49: partial · 50–74: sound with gaps
            · 75–89: strong · 90–100: exceptional, supported reasoning. Model
            judgments can be wrong. Compare similar roles and difficulty levels,
            and verify technical claims independently.
          </p>
          <small>
            Generated with {session.provider} / {session.model}.
          </small>
        </details>
      </section>
      <div className="two-col">
        <section className="panel">
          <p className="eyebrow">KEEP DOING</p>
          <h2>Your strengths</h2>
          <ul className="feedback-list">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <p className="eyebrow">FOCUS NEXT</p>
          <h2>Room to grow</h2>
          <ul className="feedback-list">
            {report.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Your next steps</h2>
          <span>STUDY PLAN</span>
        </div>
        {report.studyPlan.map((s, i) => (
          <article className="study-row" key={i}>
            <span>DAY {s.day}</span>
            <div>
              <h3>{s.topic}</h3>
              <p>{s.task}</p>
              <p className="practice-prompt">Practice: {s.practiceQuestion}</p>
            </div>
          </article>
        ))}
      </section>
      <section>
        <div className="section-heading">
          <h2>The details make you better.</h2>
          <span>ANSWER-BY-ANSWER REVIEW</span>
        </div>
        {session.turns.map((t, i) => {
          const saved = bookmarks.some(
            (b) => b.interviewId === session.id && b.turn === i,
          );
          return (
            <details className="panel answer-review" key={i}>
              <summary>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {t.question.question}
              </summary>
              <div className="review-content">
                <h3>Your answer</h3>
                <p className="prewrap">{t.answer}</p>
                <h3>Coach’s evaluation</h3>
                <p>{t.evaluation.rationale}</p>
                <ul>
                  {t.evaluation.improvements.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ul>
                {t.evaluation.missingConcepts.length > 0 && (
                  <p>
                    <strong>Revisit: </strong>
                    {t.evaluation.missingConcepts.join(" · ")}
                  </p>
                )}
                <h3>Example of a stronger answer</h3>
                <p className="prewrap model-answer">
                  {t.evaluation.modelAnswer}
                </p>
                <button
                  className="secondary"
                  aria-pressed={saved}
                  onClick={() => toggle(session.id, i, !saved)}
                >
                  <BookmarkIcon
                    size={16}
                    fill={saved ? "currentColor" : "none"}
                  />
                  {saved ? "Saved for revision" : "Save for revision"}
                </button>
              </div>
            </details>
          );
        })}
      </section>
      <div className="closing">
        <h2>Put your feedback into practice.</h2>
        <button className="primary" onClick={start}>
          Practice again <ArrowUpRight size={18} />
        </button>
      </div>
    </div>
  );
}
