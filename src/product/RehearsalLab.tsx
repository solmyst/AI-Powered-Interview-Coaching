import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Mic, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { api } from "./api";
import { useVoice } from "./useVoice";
import { useTranscription } from "./speech/useTranscription";
import type { Observation, Session } from "./types";

const labels = { demonstrated: "Demonstrated", partial: "Partly shown", not_yet: "Not observed yet" };
function Evidence({ value }: { value: Observation }) {
  return <div className={`lab-observation ${value.status}`}>
    <strong>{labels[value.status]}</strong>
    {value.evidence && <blockquote>“{value.evidence}”</blockquote>}
    <p>{value.reason}</p>
  </div>;
}

export function RehearsalLab({ session, update, speechReady, transcriptionReady }: {
  session: Session;
  update: (session: Session) => void;
  speechReady: boolean;
  transcriptionReady: boolean;
}) {
  const weakest = session.turns.reduce((selected, turn, index, turns) => {
    const average = (scores: Record<string, number>) => Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(scores).length);
    return average(turn.evaluation.scores) < average(turns[selected].evaluation.scores) ? index : selected;
  }, 0);
  const [turn, setTurn] = useState(weakest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAnswer, setPendingAnswer] = useState("");
  const alive = useRef(true);
  const submitting = useRef(false);
  const voice = useVoice(() => {}, { cloud: speechReady });
  const transcription = useTranscription((answer) => void submit(answer));
  const lab = session.rehearsals?.[turn];
  const attempt = lab?.attempts.length || 0;
  const capturing = transcription.status === "recording" || transcription.status === "requesting";
  const waiting = busy || voice.speaking || capturing || transcription.status === "transcribing";
  const question = attempt === 1 ? lab?.plan.transferQuestion : session.turns[turn]?.question.question;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const next = await api<Session>(`/interviews/${session.id}/rehearsal/${turn}`, { method: "POST", body: "{}" });
      if (alive.current) update(next);
    } catch (reason) {
      if (alive.current) setError((reason as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function submit(answer: string) {
    if (!alive.current || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setPendingAnswer(answer);
    setError("");
    try {
      const next = await api<Session>(`/interviews/${session.id}/rehearsal/${turn}/answers`, {
        method: "POST", body: JSON.stringify({ answer, expectedAttempt: attempt }),
      });
      if (alive.current) { update(next); setPendingAnswer(""); }
    } catch (reason) {
      try {
        const latest = await api<Session>(`/interviews/${session.id}`);
        if ((latest.rehearsals?.[turn]?.attempts.length || 0) > attempt) {
          if (alive.current) { update(latest); setPendingAnswer(""); }
          return;
        }
      } catch { /* Keep the transcript available for another save attempt. */ }
      if (alive.current) setError((reason as Error).message);
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function practice() {
    setError("");
    setPendingAnswer("");
    transcription.cancel();
    voice.speak(`${attempt === 0 ? lab?.plan.coaching + " " : "Let's apply that skill to a new situation. "}${question}`, () => {
      if (alive.current) void transcription.record({ autoStop: true });
    });
  }

  function cancelRecording() {
    voice.stop();
    transcription.cancel();
  }

  if (!session.turns.length) return null;
  return <section className="answer-lab" aria-labelledby="answer-lab-title">
    <div className="lab-intro">
      <div><p className="eyebrow"><Sparkles size={15} /> THE ANSWER LAB</p>
        <h2 id="answer-lab-title">Don’t just read feedback. Put it to the test.</h2>
        <p>Improve one answer aloud, then try a new situation. See exactly which skills show up in your words.</p>
      </div>
      <span className="lab-private">Private practice · original scores stay unchanged</span>
    </div>
    <ol className="lab-steps" aria-label="Answer Lab progress">
      {["Find your focus", "Retry aloud", "Apply it elsewhere"].map((label, i) => <li key={label} aria-current={lab && attempt === i ? "step" : undefined} className={lab && attempt >= i ? "active" : ""}><span>{i + 1}</span>{label}</li>)}
    </ol>
    <label className="lab-select">Choose an answer to work on
      <select value={turn} disabled={waiting} onChange={(e) => { cancelRecording(); setTurn(Number(e.target.value)); setError(""); setPendingAnswer(""); }}>
        {session.turns.map((t, i) => <option key={i} value={i}>Question {i + 1}{i === weakest ? " · Suggested focus" : ""}: {t.question.focus}</option>)}
      </select>
    </label>
    {!lab ? <div className="lab-start">
      <h3>{session.turns[turn].question.question}</h3>
      <p>{session.turns[turn].evaluation.improvements[0]}</p>
      <button className="primary" disabled={busy} onClick={() => void prepare()}><Sparkles size={17} />{busy ? "Finding your coaching focus…" : "Coach this answer"}</button>
    </div> : <>
      <div className="lab-mission"><p className="eyebrow">ONE SKILL TO WORK ON</p><h3>{lab.plan.focus}</h3><p>{lab.plan.coaching}</p></div>
      {attempt < 2 && <div className="lab-practice">
        <p className="eyebrow">{attempt === 0 ? "YOUR SECOND TAKE" : "A NEW CONSTRAINT"}</p>
        <h3>{question}</h3>
        <p>{attempt === 0 ? "Use the three checkpoints below. Speak from your own experience; don’t invent achievements." : "Apply the same checkpoints to this new scenario. This tests application, not memorization."}</p>
        <div className="lab-actions">
          {!waiting && !pendingAnswer && <button className="primary" disabled={!transcriptionReady} onClick={practice}><Mic size={17} />{attempt ? "Try a new scenario" : "Retry aloud"}</button>}
          {voice.speaking && <p role="status"><Volume2 size={17} /> Maya is speaking. Your microphone starts automatically.</p>}
          {capturing && <><p role="status"><Mic size={17} /> Listening. Finish naturally or select Done speaking.</p><button className="primary" onClick={transcription.stop}>Done speaking</button></>}
          {(voice.speaking || capturing) && <button className="secondary" onClick={cancelRecording}>Pause practice</button>}
          {(busy || transcription.status === "transcribing") && <p role="status">{busy ? "Checking your answer against the same checkpoints…" : "Understanding your answer…"}</p>}
          {!waiting && pendingAnswer && <><button className="secondary" onClick={() => void submit(pendingAnswer)}><RotateCcw size={16} />Retry feedback for saved response</button><button className="secondary" onClick={practice}>Record again</button></>}
        </div>
        {!transcriptionReady && <p className="notice">Voice practice is temporarily unavailable. Your coaching checklist is ready below.</p>}
      </div>}
      <div className="lab-checkpoints">
        {lab.plan.checkpoints.map((checkpoint, index) => <article key={index}>
          <h3><span>{index + 1}</span>{checkpoint.criterion}</h3>
          <div className="lab-comparison">
            <div><p className="eyebrow">ORIGINAL ANSWER</p><Evidence value={checkpoint.baseline} /></div>
            {lab.attempts.map((a) => <div key={a.stage}><p className="eyebrow">{a.stage === "retry" ? "YOUR RETRY" : "NEW SCENARIO"}</p><Evidence value={a.result.checks[index]} /></div>)}
          </div>
        </article>)}
      </div>
      {lab.attempts.map((a) => <details className="lab-attempt" key={a.stage}><summary>{a.stage === "retry" ? "What changed in your retry" : "How you handled the new scenario"}</summary><p>{a.result.summary}</p><blockquote>{a.answer}</blockquote><strong>Next move</strong><p>{a.result.nextStep}</p></details>)}
      {attempt === 2 && <div className="lab-finished"><Check size={21} /><div><h3>You’ve practiced the change.</h3><p>Compare the evidence above. “Not observed” means this answer didn’t show it yet—not that you lack the skill.</p></div><ArrowRight size={21} /></div>}
      <p className="lab-footnote">Quotes are checked against your transcript. The assessment is still an AI coaching judgment. A new scenario is not a like-for-like score comparison.</p>
    </>}
    {(error || transcription.error || voice.error) && <p className="notice" role="alert">{error || transcription.error || voice.error}</p>}
  </section>;
}
