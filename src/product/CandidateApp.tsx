import { useEffect, useRef, useState } from "react";
import { Brain, Check, ShieldCheck } from "lucide-react";
import { api } from "./api";
import { Room } from "./Room";
import type { CandidateSummary, Health, RoomSession } from "./types";
import "./product.css";

type Stage =
  | "loading"
  | "invalid"
  | "notice"
  | "declined"
  | "room"
  | "paused"
  | "submitted";

// The page a candidate opens from an invite link. No account, no navigation: notice, interview, done.
export default function CandidateApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const booted = useRef(false);

  async function enter(info: CandidateSummary) {
    setSummary(info);
    if (info.state === "complete" || info.status === "completed")
      return setStage("submitted");
    if (!info.consented) return setStage("notice");
    await openInterview();
  }
  async function openInterview() {
    setError("");
    try {
      setSession(
        await api<RoomSession>("/candidate/interview", {
          method: "POST",
          body: "{}",
        }),
      );
      setStage("room");
    } catch (reason) {
      setError((reason as Error).message);
      setStage("notice");
    }
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void api<Health>("/health")
      .then(setHealth)
      .catch(() => setHealth(null));
    // The token lives in the URL fragment so it never reaches a server log. Remove it from the address bar at once.
    const token = new URLSearchParams(location.hash.slice(1)).get("t");
    if (token)
      history.replaceState(null, "", location.pathname + location.search);
    (token
      ? api<CandidateSummary>("/candidate/session", {
          method: "POST",
          body: JSON.stringify({ token }),
        })
      : api<CandidateSummary>("/candidate/session")
    )
      .then(enter)
      .catch((reason) => {
        setError((reason as Error).message);
        setStage("invalid");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stage === "room" && session && summary)
    return (
      <Room
        mode="screening"
        key={session.id}
        session={session}
        transcriptionReady={Boolean(health?.transcription.ready)}
        speechReady={Boolean(health?.speech.ready)}
        update={(value) => {
          // The final call returns the candidate summary instead of the session.
          if ("company" in value && "consented" in value) {
            setSummary(value as unknown as CandidateSummary);
            setStage("submitted");
          } else setSession(value as RoomSession);
        }}
        back={() => setStage("paused")}
      />
    );

  return (
    <main className="cand-shell">
      <header className="cand-brand">
        <Brain size={20} aria-hidden="true" /> InterviewAce
      </header>
      {stage === "loading" && (
        <p className="cand-card" aria-busy="true">
          Opening your interview…
        </p>
      )}
      {stage === "invalid" && (
        <section className="cand-card" role="alert">
          <h1>This link can’t be used</h1>
          <p>{error || "This interview link is not valid."}</p>
          <p className="muted">
            Ask the company that invited you for a new link. Your answers so
            far, if any, are saved.
          </p>
        </section>
      )}
      {stage === "notice" && summary && (
        <Notice
          summary={summary}
          error={error}
          onAccept={async () => {
            setError("");
            try {
              const next = await api<CandidateSummary>("/candidate/consent", {
                method: "POST",
                body: JSON.stringify({
                  accepted: true,
                  version: summary.consentVersion,
                }),
              });
              setSummary(next);
              await openInterview();
            } catch (reason) {
              setError((reason as Error).message);
            }
          }}
          onDecline={async () => {
            try {
              await api("/candidate/consent", {
                method: "POST",
                body: JSON.stringify({ declined: true }),
              });
              setStage("declined");
            } catch (reason) {
              setError((reason as Error).message);
            }
          }}
        />
      )}
      {stage === "declined" && summary && (
        <section className="cand-card">
          <h1>You’ve withdrawn from this interview</h1>
          <p>
            Nothing was recorded. If this was a mistake or you need an
            accommodation, contact {summary.company}
            {summary.contactEmail ? (
              <>
                {" "}
                at{" "}
                <a href={`mailto:${summary.contactEmail}`}>
                  {summary.contactEmail}
                </a>
              </>
            ) : (
              ""
            )}{" "}
            and ask for a new link.
          </p>
        </section>
      )}
      {stage === "paused" && summary && (
        <section className="cand-card">
          <h1>Your interview is saved</h1>
          <p>
            You can reopen your invite link before{" "}
            {new Date(summary.expires).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
            })}{" "}
            to continue where you left off.
          </p>
        </section>
      )}
      {stage === "submitted" && summary && <Submitted summary={summary} />}
    </main>
  );
}

function Notice({
  summary,
  error,
  onAccept,
  onDecline,
}: {
  summary: CandidateSummary;
  error: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [ai, setAi] = useState(false);
  const [data, setData] = useState(false);
  const [busy, setBusy] = useState(false);
  const expires = new Date(summary.expires).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
  return (
    <section className="cand-card wide" aria-labelledby="notice-title">
      <p className="eyebrow">{summary.company.toUpperCase()}</p>
      <h1 id="notice-title">Before you start: {summary.roleTitle}</h1>
      <p className="lead">
        {summary.company} invited you to a screening interview. InterviewAce
        runs it for them. It takes about {summary.minutes} minutes.
      </p>
      <div className="notice-grid">
        <div>
          <h2>An AI interviews you</h2>
          <p>
            Maya is an AI. She asks {summary.questionCount} spoken questions and
            may ask follow-ups. An AI estimates scores against {summary.company}
            ’s criteria.{" "}
            <strong>
              A person at {summary.company} reads your transcript and makes
              every decision.
            </strong>{" "}
            The AI does not reject anyone.
          </p>
        </div>
        <div>
          <h2>What is collected</h2>
          <p>
            Your answers as text, the AI’s score estimates with quotes from what
            you said, and the focus notes below. Audio is sent to a speech
            service to become text and is not stored by InterviewAce.{" "}
            <strong>No video is recorded or sent.</strong> Your camera is
            checked on your device only.
          </p>
        </div>
        <div>
          <h2>Focus notes</h2>
          <ul>
            <li>Leaving this tab for 3 seconds or more</li>
            <li>Leaving full screen</li>
            <li>Your camera stopping</li>
            <li>Pasting a large block of text</li>
          </ul>
          <p className="muted">
            These can have ordinary causes, like a notification. They are shown
            to you when they happen and go to the reviewer as notes, never as
            automatic penalties.
          </p>
        </div>
        <div>
          <h2>Your choices</h2>
          <p>
            You can type instead of speaking at any time. {summary.company}{" "}
            keeps your interview for {summary.retentionDays} days, then deletes
            it.
            {summary.contactEmail ? (
              <>
                {" "}
                For questions, accommodations or deletion, write to{" "}
                <a href={`mailto:${summary.contactEmail}`}>
                  {summary.contactEmail}
                </a>
                .
              </>
            ) : (
              ""
            )}{" "}
            If you lose connection, reopen this link before {expires} to
            continue from the same question.
          </p>
        </div>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={ai}
          onChange={(e) => setAi(e.target.checked)}
        />{" "}
        I understand an AI conducts and scores this interview and a person
        reviews it.
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={data}
          onChange={(e) => setData(e.target.checked)}
        />{" "}
        I agree to the processing described above.
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="cand-actions">
        <button
          className="primary"
          disabled={!ai || !data || busy}
          onClick={async () => {
            setBusy(true);
            await onAccept();
            setBusy(false);
          }}
        >
          <ShieldCheck size={18} aria-hidden="true" /> Accept and continue
        </button>
        <button className="text-button" disabled={busy} onClick={onDecline}>
          No thanks, withdraw
        </button>
      </div>
    </section>
  );
}

function Submitted({ summary }: { summary: CandidateSummary }) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(summary.noteSent);
  const [error, setError] = useState("");
  return (
    <section className="cand-card wide">
      <span className="cand-check">
        <Check size={26} aria-hidden="true" />
      </span>
      <h1>Your interview was submitted to {summary.company}</h1>
      <p className="lead">
        Thank you. A person at {summary.company} will review it and contact you
        about next steps. You don’t need to do anything else.
      </p>
      {summary.feedback && (
        <div className="feedback-box">
          <h2>A few things to take away</h2>
          <ul>
            {summary.feedback.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <h3>Areas to prepare</h3>
          <ul>
            {summary.feedback.areasToPrepare.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="muted">
            This is a general summary from the AI, not a score or a hiring
            decision.
          </p>
        </div>
      )}
      {sent ? (
        <p className="notice" role="status">
          Your note was sent to the reviewer.
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await api("/candidate/note", {
                method: "POST",
                body: JSON.stringify({ note }),
              });
              setSent(true);
            } catch (reason) {
              setError((reason as Error).message);
            }
          }}
        >
          <label htmlFor="cand-note">
            Anything you’d like the reviewer to know? <small>optional</small>
          </label>
          <textarea
            id="cand-note"
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example, a noisy room, a connection problem, or context about an answer."
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="secondary" disabled={!note.trim()}>
            Send note
          </button>
        </form>
      )}
    </section>
  );
}
