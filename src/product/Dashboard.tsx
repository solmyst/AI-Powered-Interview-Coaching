import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Code2,
  MessagesSquare,
  Network,
  Trash2,
} from "lucide-react";
import type { Summary, User, Usage } from "./types";
export function SessionList({
  sessions,
  open,
  remove,
}: {
  sessions: Summary[];
  open: (id: string) => void;
  remove?: (id: string) => void;
}) {
  return sessions.length ? (
    <div className="session-list">
      {sessions.map((s) => (
        <article className="session-row" key={s.id}>
          <div className="session-icon">
            <MessagesSquare size={22} />
          </div>
          <button className="session-name" onClick={() => open(s.id)}>
            <strong>{s.role}</strong>
            <span>
              {s.track} ·{" "}
              {new Date(s.created).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {s.answered}/{s.total} answers
            </span>
          </button>
          <span
            className={`session-state ${s.state === "complete" ? "finished" : ""}`}
          >
            {s.state === "complete"
              ? "Complete"
              : s.state === "report_pending"
                ? "Report ready to generate"
                : "In progress"}
          </span>
          <strong className="session-score">
            {s.score ?? "—"}
            <small>{s.score !== null ? "/100" : ""}</small>
          </strong>
          <button
            className="icon-button"
            aria-label={`Open ${s.role} interview`}
            onClick={() => open(s.id)}
          >
            <ArrowUpRight size={20} />
          </button>
          {remove && (
            <button
              className="icon-button"
              aria-label={`Delete ${s.role} interview`}
              onClick={() => remove(s.id)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </article>
      ))}
    </div>
  ) : (
    <div className="empty">
      <BookOpen size={30} />
      <h3>Your story starts with one session.</h3>
      <p>Completed interviews and in-progress sessions will appear here.</p>
    </div>
  );
}
export function Dashboard({
  user,
  usage,
  sessions,
  start,
  open,
  history,
}: {
  user: User;
  usage: Usage;
  sessions: Summary[];
  start: () => void;
  open: (id: string) => void;
  history: () => void;
}) {
  const completed = sessions.filter((s) => s.score !== null);
  const average = completed.length
    ? Math.round(
        completed.reduce((sum, s) => sum + s.score!, 0) / completed.length,
      )
    : null;
  const change =
    completed.length > 1 ? completed[0].score! - completed[1].score! : null;
  return (
    <div className="wrap workspace">
      <div className="room-heading">
        <div>
          <p className="eyebrow">YOUR PRACTICE, YOUR PROGRESS</p>
          <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
          <p>A little more prepared than yesterday. That’s the goal.</p>
        </div>
        <button className="primary" onClick={start}>
          New interview <ArrowUpRight size={18} />
        </button>
      </div>
      <section className="dashboard-feature">
        <div>
          <span className="pill">MAKE YOUR NEXT ANSWER COUNT</span>
          <h2>
            The best preparation
            <br />
            is a conversation.
          </h2>
          <p>Bring your experience. We’ll bring the follow-up questions.</p>
          <button className="light-button" onClick={start}>
            Find your focus <ArrowRight size={18} />
          </button>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <MessagesSquare size={48} />
        </div>
      </section>
      <div className="stats-grid">
        <article>
          <span>Completed interviews</span>
          <strong>{completed.length.toString().padStart(2, "0")}</strong>
          <small>Every session is a step forward</small>
        </article>
        <article>
          <span>Average practice score</span>
          <strong>
            {average ?? "—"}
            {average !== null && <sub>/100</sub>}
          </strong>
          <small>
            {average === null
              ? "Your first report sets the baseline"
              : "Across completed sessions shown below"}
          </small>
        </article>
        <article>
          <span>Latest score change</span>
          <strong>
            {change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
            <sub>{change !== null ? " pts" : ""}</sub>
          </strong>
          <small>Compare similar tracks and difficulty</small>
        </article>
        <article>
          <span>Sessions available today</span>
          <strong>
            {Math.max(0, usage.limit - usage.used)}
            <sub>/{usage.limit}</sub>
          </strong>
          <small>Resets at {usage.reset}</small>
        </article>
      </div>
      <div className="section-heading">
        <h2>A different round. A sharper skill.</h2>
        <span>CHOOSE IN INTERVIEW SETUP</span>
      </div>
      <div className="three-col practice-tracks">
        {[
          [
            Code2,
            "Technical & coding",
            "Reason through solutions, complexity, and edge cases.",
          ],
          [
            Network,
            "System design",
            "Balance scale, reliability, and real-world trade-offs.",
          ],
          [
            MessagesSquare,
            "Behavioral & product",
            "Tell clear stories. Make decisions with evidence.",
          ],
        ].map(([Icon, title, description]) => {
          const I = Icon as typeof Code2;
          return (
            <button className="track-card" key={String(title)} onClick={start}>
              <I size={26} />
              <h3>{String(title)}</h3>
              <p>{String(description)}</p>
              <ArrowUpRight size={18} />
            </button>
          );
        })}
      </div>
      <div className="section-heading">
        <h2>Your recent practice</h2>
        <button className="text-button" onClick={history}>
          View all sessions <ArrowRight size={16} />
        </button>
      </div>
      <section className="panel">
        <SessionList sessions={sessions.slice(0, 5)} open={open} />
      </section>
      {completed.length > 1 && (
        <section className="panel">
          <h2>Your practice timeline</h2>
          <p>
            Last ten completed sessions. Different rounds and model judgments
            are not directly comparable.
          </p>
          <div className="timeline">
            {completed
              .slice(0, 10)
              .reverse()
              .map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => open(s.id)}
                  aria-label={`Session ${i + 1}, score ${s.score}, ${s.role}`}
                >
                  <span>{s.score}</span>
                  <i style={{ height: `${s.score! + 8}px` }} />
                  <small>{i + 1}</small>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
