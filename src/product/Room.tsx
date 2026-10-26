import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Brain,
  Mic,
  Square,
  Volume2,
} from "lucide-react";
import { api } from "./api";
import { useVoice } from "./useVoice";
import type { Session } from "./types";
export function Room({
  session,
  update,
  back,
}: {
  session: Session;
  update: (s: Session) => void;
  back: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const voice = useVoice((text) =>
    setAnswer((previous) => (previous + " " + text).trim().slice(0, 8000)),
  );
  useEffect(() => {
    questionRef.current?.focus();
  }, [session.turns.length]);
  async function report() {
    setReporting(true);
    voice.stop();
    setBusy(true);
    setError("");
    try {
      update(
        await api<Session>(`/interviews/${session.id}/report`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReporting(false);
      setBusy(false);
    }
  }
  return (
    <div className="wrap workspace">
      <div className="room-heading">
        <div>
          <p className="eyebrow">THE PRACTICE ROOM</p>
          <h1>{session.setup.track} interview</h1>
          <p>
            {session.setup.role} <span className="separator">/</span>{" "}
            {session.setup.experience}
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            voice.stop();
            back();
          }}
        >
          Leave interview
        </button>
      </div>
      <div className="room-grid">
        <section className="interview-panel">
          <div className="room-top">
            <span>
              <span className="dot" />{" "}
              {busy
                ? "Thinking…"
                : session.state === "report_pending"
                  ? "Practice complete"
                  : "Your interviewer"}
            </span>
            <span>
              {Math.min(session.turns.length + 1, session.setup.questionCount)}{" "}
              / {session.setup.questionCount}
            </span>
          </div>
          <div className="progress-track">
            <i
              style={{
                width: `${(session.turns.length / session.setup.questionCount) * 100}%`,
              }}
            />
          </div>
          <div className="question-area">
            <div className="interviewer-mark">
              <Brain size={32} />
            </div>
            <p className="eyebrow">
              {session.currentQuestion?.focus || "TIME TO REFLECT"}
            </p>
            <h2 ref={questionRef} tabIndex={-1}>
              {session.currentQuestion?.question ||
                "You’ve done the practice. Let’s turn it into progress."}
            </h2>
            {session.currentQuestion && (
              <button
                className="question-audio"
                disabled={busy}
                onClick={() =>
                  voice.speaking
                    ? voice.stop()
                    : voice.speak(session.currentQuestion!.question)
                }
              >
                {voice.speaking ? <Square size={16} /> : <Volume2 size={18} />}{" "}
                {voice.speaking ? "Stop playback" : "Read question aloud"}
              </button>
            )}
          </div>
          {session.state === "active" ? (
            <form
              className="answer-area"
              onSubmit={async (e) => {
                e.preventDefault();
                voice.stop();
                setBusy(true);
                setError("");
                try {
                  const next = await api<Session>(
                    `/interviews/${session.id}/answers`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        answer,
                        expectedTurn: session.turns.length,
                      }),
                    },
                  );
                  setAnswer("");
                  update(next);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor="answer">
                Your answer <span>{answer.length} / 8,000</span>
              </label>
              <textarea
                id="answer"
                rows={7}
                placeholder={
                  session.setup.track === "Coding"
                    ? "Write your approach and code. Include edge cases and time / space complexity. Code is reviewed, not executed."
                    : "Take a moment to think. Explain your approach, give a specific example, and share the outcome."
                }
                value={answer}
                maxLength={8000}
                disabled={busy}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <div className="answer-controls">
                <button
                  type="button"
                  className={`secondary ${voice.listening ? "recording" : ""}`}
                  disabled={busy || !consent || !voice.available}
                  onClick={voice.dictate}
                >
                  {voice.listening ? <Square size={16} /> : <Mic size={16} />}{" "}
                  {voice.listening ? "Stop dictation" : "Dictate answer"}
                </button>
                <button
                  className="primary"
                  disabled={busy || answer.trim().length < 2 || voice.listening}
                >
                  {reporting
                    ? "Building your report…"
                    : busy
                      ? "Reviewing your answer…"
                      : "Submit answer"}
                  <ArrowRight size={18} />
                </button>
              </div>
              <small aria-live="polite">
                {voice.listening
                  ? "Listening. Stop dictation and review your text before submitting."
                  : reporting
                    ? "Your saved answers are being turned into a coaching report."
                    : busy
                      ? "The model is reviewing your reasoning. Your answer stays here until saved."
                      : "Only submitted answers are saved. Unsent text is lost when you leave or reload."}
              </small>
            </form>
          ) : (
            <div className="answer-area">
              <p>
                All {session.turns.length} answers are saved. Generate your
                report to see strengths, missing concepts, and your next steps.
              </p>
              <button className="primary" disabled={busy} onClick={report}>
                {busy ? "Building your coaching report…" : "Generate my report"}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          {(error || voice.error) && (
            <div className="error" role="alert">
              {error || voice.error}
              {error && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      update(await api<Session>(`/interviews/${session.id}`));
                      setError("");
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Reload saved progress
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="room-aside">
          <section className="panel">
            <p className="eyebrow">SESSION FOCUS</p>
            <h3>{session.setup.difficulty}</h3>
            <p>{session.setup.company || session.setup.industry}</p>
            <hr />
            <h3>Make your thinking visible.</h3>
            <p>
              Clarify assumptions. Explain trade-offs. If you’re unsure, say
              what you would investigate next.
            </p>
            <p>Feedback stays out of your way until the final report.</p>
          </section>
          <section className="panel voice-panel">
            <AudioLines size={23} />
            <h3>A conversation, at your pace.</h3>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (!e.target.checked) voice.stop();
                }}
              />
              <span>Enable optional dictation</span>
            </label>
            <small>
              Your browser may send audio to its speech service. InterviewAce
              receives the transcript, not a recording. English dictation;
              availability depends on your browser.
            </small>
            {!voice.available && (
              <p className="notice">
                Dictation isn’t supported here. Text answers and available
                speech playback still work.
              </p>
            )}
          </section>
          {session.turns.length > 0 && session.state === "active" && (
            <button
              className="text-button"
              disabled={busy || Boolean(answer.trim())}
              onClick={report}
            >
              Finish early & review {session.turns.length} saved answers
            </button>
          )}
        </aside>
      </div>
      {session.turns.length > 0 && (
        <details className="transcript panel">
          <summary>
            Review saved conversation ({session.turns.length} answers)
          </summary>
          {session.turns.map((t, i) => (
            <article key={i}>
              <h3>
                {i + 1}. {t.question.question}
              </h3>
              <p className="prewrap">{t.answer}</p>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
