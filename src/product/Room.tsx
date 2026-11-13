import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Camera,
  Check,
  HelpCircle,
  Clock,
  Headphones,
  Keyboard,
  Maximize,
  Mic,
  Minimize,
  MessageCircle,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sun,
  Volume2,
} from "lucide-react";
import { api } from "./api";
import { BriefingDialog } from "./BriefingDialog";
import { useVoice } from "./useVoice";
import { useTranscription } from "./speech/useTranscription";
import { CameraCoach } from "./vision/CameraCoach";
import { emptyVisual } from "./vision/metrics";
import type { Session } from "./types";

type CallPhase =
  | "preflight"
  | "joining"
  | "interviewer"
  | "listening"
  | "transcribing"
  | "thinking"
  | "paused"
  | "complete";

function waitForVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const deadline = performance.now() + 8000;
    const check = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0)
        return resolve();
      if (performance.now() >= deadline)
        return reject(new Error("The camera connected but did not provide a picture."));
      requestAnimationFrame(check);
    };
    check();
  });
}

export function Room({
  session,
  transcriptionReady,
  speechReady,
  update,
  back,
}: {
  session: Session;
  transcriptionReady: boolean;
  speechReady: boolean;
  update: (value: Session) => void;
  back: () => void;
}) {
  const visual = useRef(emptyVisual());
  const spoken = useRef({ words: 0, fillers: 0 });
  const deliveredTurn = useRef(-1);
  const reportStarted = useRef(false);
  const callEnded = useRef(false);
  const paused = useRef(false);
  const callStartedAt = useRef(0);
  const sharedStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const [joined, setJoined] = useState(false);
  const [mediaState, setMediaState] = useState<
    "idle" | "requesting" | "ready" | "error"
  >("idle");
  const [mediaError, setMediaError] = useState("");
  const [cameraLabel, setCameraLabel] = useState("");
  const [phase, setPhase] = useState<CallPhase>("preflight");
  const [elapsed, setElapsed] = useState(0);
  const [lastAnswer, setLastAnswer] = useState("");
  const [answerPending, setAnswerPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [briefingError, setBriefingError] = useState("");
  const [clarifiedQuestion, setClarifiedQuestion] = useState("");
  // Maya's spoken reply when the candidate asked her something instead of answering.
  const [mayaReply, setMayaReply] = useState("");
  const [clarifying, setClarifying] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [answerStartedAt, setAnswerStartedAt] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return localStorage.getItem("interviewace:call-theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
  });
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("interviewace:call-theme", next); } catch { /* Theme still applies for this call. */ }
  }

  async function submitSpokenAnswer(text: string) {
    if (callEnded.current) return;
    const answer = text.trim().slice(0, 8000);
    if (answer.length < 2) {
      setError("I couldn’t hear a complete answer. Try that response again.");
      setPhase("listening");
      return;
    }
    setLastAnswer(answer);
    setAnswerPending(true);
    setPhase("thinking");
    setError("");
    try {
      const { reply, ...next } = await api<Session & { reply?: string }>(`/interviews/${session.id}/answers`, {
        method: "POST",
        body: JSON.stringify({
          answer,
          expectedTurn: session.turns.length,
          delivery: {
            ...(visual.current.samples ? { visual: visual.current } : {}),
            speech: {
              source: "assemblyai",
              captureMs: transcription.durationMs(),
              words: spoken.current.words,
              fillers: spoken.current.fillers,
            },
          },
        }),
      });
      setAnswerPending(false);
      if (reply) {
        // Same question, Maya talks back; delivery counters keep running for this question.
        setMayaReply(reply);
        setLastAnswer("");
        setPhase("interviewer");
        update(next);
        voice.speak(reply, () => {
          if (!callEnded.current && !paused.current) resumeInterview();
        });
        return;
      }
      visual.current = emptyVisual();
      spoken.current = { words: 0, fillers: 0 };
      transcription.reset();
      update(next);
    } catch (reason) {
      // A response can be lost after the server saves a turn. Reconcile before
      // offering a retry so one spoken answer cannot advance two questions.
      try {
        const latest = await api<Session>(`/interviews/${session.id}`);
        if (latest.turns.length > session.turns.length) {
          setAnswerPending(false);
          visual.current = emptyVisual();
          spoken.current = { words: 0, fillers: 0 };
          transcription.reset();
          update(latest);
          return;
        }
      } catch { /* Preserve the response locally until the connection returns. */ }
      setError((reason as Error).message);
      pauseInterview();
    }
  }

  function receiveTranscript(text: string) {
    const command = text.trim().toLowerCase().replace(/[?.!।]/g, "").trim();
    if (/^(please )?(repeat( the)? question|repeat that|could you repeat( the question| that)?|can you repeat( the question| that)?)( please)?$/.test(command)) {
      repeatQuestion();
      return;
    }
    if (/^(please )?(pause( the)? interview|give me a moment|pause)( please)?$/.test(command)) {
      pauseInterview();
      return;
    }
    if (/^(please )?(clarify( the)? question|could you clarify( the question| that)?|can you rephrase( the question| that)?)( please)?$/.test(command)) {
      void clarifyQuestion();
      return;
    }
    spoken.current.words += text.trim().split(/\s+/).filter(Boolean).length;
    spoken.current.fillers += (
      text.match(/\b(um|uh|erm|hmm)\b/gi) || []
    ).length;
    void submitSpokenAnswer(text);
  }

  const transcription = useTranscription(receiveTranscript);
  const voice = useVoice(() => {}, { cloud: speechReady });
  const question = session.currentQuestion?.question || "";

  useEffect(
    () => () => {
      sharedStream.current?.getTracks().forEach((track) => track.stop());
      sharedStream.current = null;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
    [],
  );

  // Space ends the answer, like a push-to-talk release, unless the user is typing or on a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code !== "Space" || /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(target.tagName)) return;
      if (transcription.status !== "recording" || phase !== "listening") return;
      event.preventDefault();
      transcription.stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Full screen was blocked by the browser. You can continue normally.");
    }
  }

  async function requestMedia() {
    setMediaState("requesting");
    setMediaError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera and microphone access requires HTTPS or localhost.",
        );
      sharedStream.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      sharedStream.current = stream;
      if (previewVideo.current) {
        previewVideo.current.srcObject = stream;
        await previewVideo.current.play();
        await waitForVideoFrame(previewVideo.current);
      }
      const cameraTrack = stream.getVideoTracks()[0];
      setCameraLabel(cameraTrack?.label || "Camera connected");
      stream.getTracks().forEach((track) => track.addEventListener(
        "ended",
        () => {
          if (callEnded.current) return;
          setMediaState("error");
          setMediaError("A camera or microphone disconnected. Reconnect your devices to continue.");
          if (callStartedAt.current) pauseInterview();
        },
        { once: true },
      ));
      setMediaState("ready");
    } catch (reason) {
      setMediaState("error");
      sharedStream.current?.getTracks().forEach((track) => track.stop());
      sharedStream.current = null;
      if (previewVideo.current) previewVideo.current.srcObject = null;
      setMediaError(
        reason instanceof DOMException && reason.name === "NotAllowedError"
          ? "Camera or microphone permission was denied. Allow both in browser settings, then retry."
          : reason instanceof DOMException && reason.name === "NotFoundError"
            ? "A working camera and microphone were not both found. Connect them and retry."
            : reason instanceof Error
              ? reason.message
              : "Camera and microphone could not be started.",
      );
    }
  }

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - callStartedAt.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [joined]);

  useEffect(() => {
    if (
      !joined ||
      !question ||
      transcription.status !== "ready" ||
      deliveredTurn.current === session.turns.length ||
      session.state !== "active"
    )
      return;
    deliveredTurn.current = session.turns.length;
    setPhase("interviewer");
    setClarifiedQuestion("");
    setMayaReply("");
    setLastAnswer("");
    setError("");
    voice.speak(`${session.currentQuestion?.lead || ""} ${question}`.trim(), () => {
      if (callEnded.current || paused.current) return;
      setPhase("listening");
      void transcription.record({
        autoStop: true,
        mediaStream: sharedStream.current || undefined,
      });
    });
    // retry intentionally replays the current turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, question, session.turns.length, session.state, transcription.status, retry]);

  useEffect(() => {
    if (transcription.status === "recording") setAnswerStartedAt(Date.now());
  }, [transcription.status]);

  useEffect(() => {
    if (transcription.status === "transcribing") setPhase("transcribing");
    if (transcription.status === "recording") setPhase("listening");
    if (transcription.error && !callEnded.current) {
      paused.current = true;
      setPhase("paused");
    }
  }, [transcription.status, transcription.error]);

  useEffect(() => {
    if (session.state !== "report_pending" || reportStarted.current) return;
    reportStarted.current = true;
    callEnded.current = true;
    setPhase("complete");
    setBriefingError("");
    voice.stop();
    transcription.cancel();
    sharedStream.current?.getTracks().forEach((track) => track.stop());
    void api<Session>(`/interviews/${session.id}/report`, {
      method: "POST",
      body: "{}",
    })
      .then(update)
      .catch((reason) => {
        setBriefingError((reason as Error).message);
        reportStarted.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  function repeatQuestion() {
    paused.current = false;
    voice.stop();
    transcription.cancel();
    deliveredTurn.current = -1;
    setRetry((value) => value + 1);
  }

  function pauseInterview() {
    paused.current = true;
    voice.stop();
    transcription.cancel();
    setPhase("paused");
  }

  // Typing is a fallback for noisy rooms or speech trouble; it pauses the microphone first.
  function openTyping() {
    if (typing) { setTyping(false); return; }
    pauseInterview();
    setTyping(true);
  }

  // Candidates who read the question faster than Maya speaks can start answering at once.
  function skipToAnswer() {
    voice.stop();
    resumeInterview();
  }

  function resumeInterview() {
    setTyping(false);
    paused.current = false;
    setPhase("listening");
    void transcription.record({ autoStop: true, mediaStream: sharedStream.current || undefined });
  }

  async function clarifyQuestion() {
    voice.stop();
    transcription.cancel();
    setClarifying(true);
    setPhase("interviewer");
    setError("");
    try {
      const result = await api<{ question: string }>(`/interviews/${session.id}/clarify`, {
        method: "POST", body: JSON.stringify({ expectedTurn: session.turns.length }),
      });
      if (callEnded.current) return;
      setClarifiedQuestion(result.question);
      voice.speak(result.question, () => { if (!callEnded.current && !paused.current) resumeInterview(); });
    } catch (reason) {
      setError((reason as Error).message);
      if (!callEnded.current) pauseInterview();
    } finally {
      setClarifying(false);
    }
  }

  async function endInterview() {
    if (reportStarted.current || phase === "thinking" || phase === "transcribing") return;
    reportStarted.current = true;
    callEnded.current = true;
    voice.stop();
    transcription.cancel();
    sharedStream.current?.getTracks().forEach((track) => track.stop());
    if (!session.turns.length) {
      back();
      return;
    }
    setPhase("complete");
    setBriefingError("");
    setError("");
    try {
      update(
        await api<Session>(`/interviews/${session.id}/report`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (reason) {
      reportStarted.current = false;
      setBriefingError((reason as Error).message);
    }
  }

  const status = clarifying ? "Clarifying your question" : phase === "paused" ? "Paused · take your time" :
    phase === "interviewer" && voice.preparing ? "Preparing interviewer audio" : phase === "interviewer"
      ? "Interviewer speaking"
      : phase === "listening"
        ? "Listening to you"
        : phase === "transcribing"
          ? "Understanding your answer"
          : phase === "thinking"
            ? "Preparing a follow-up"
            : phase === "complete"
              ? "Writing your debrief"
              : "Preparing interview";
  const formatTime = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (!joined)
    return (
      <div className="call-preflight">
        <div className="preflight-copy">
          <p className="eyebrow">PRIVATE PRACTICE INTERVIEW</p>
          <h1>Your interviewer is ready.</h1>
          <p className="preflight-lead">
            This works like a real video call. The interviewer asks every
            question aloud, listens to your spoken answer, and responds with an
            adaptive follow-up. There is nothing to type.
          </p>
          <div className="preflight-checks" aria-label="Interview readiness">
            <div><Camera /><span><strong>Camera</strong>Private self-view and on-device presence coaching</span></div>
            <div><Mic /><span><strong>Microphone</strong>Automatic English and Hindi transcription</span></div>
            <div><Headphones /><span><strong>Headphones recommended</strong>Prevents the interviewer’s voice entering your answer</span></div>
            <div><ShieldCheck /><span><strong>Private by design</strong>Video stays on-device; audio is sent securely for transcription</span></div>
          </div>
          {(transcription.error || error) && <div className="call-error" role="alert">{transcription.error || error}</div>}
          {!transcriptionReady && (
            <div className="call-error" role="alert">
              Speech transcription is not configured on the server yet.
            </div>
          )}
          {mediaError && <div className="call-error" role="alert">{mediaError}</div>}
          <div className="preflight-actions">
            {mediaState !== "ready" && (
              <button
                className="device-check"
                disabled={mediaState === "requesting"}
                onClick={() => void requestMedia()}
              >
                <Camera size={20} />
                {mediaState === "requesting"
                  ? "Waiting for permission…"
                  : mediaState === "error"
                    ? "Retry camera & microphone"
                    : "Allow camera & microphone"}
              </button>
            )}
            <button
              className="join-call"
              disabled={!transcriptionReady || transcription.status !== "ready" || mediaState !== "ready"}
              onClick={() => {
                callStartedAt.current = Date.now();
                setPhase("joining");
                void document.documentElement.requestFullscreen?.().catch(() => {});
                setJoined(true);
              }}
            >
              <Volume2 size={20} />
              {!transcriptionReady
                ? "Speech service unavailable"
                : mediaState !== "ready"
                ? "Complete device check first"
                : transcription.status === "ready"
                  ? "Join interview"
                  : "Speech service unavailable"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                sharedStream.current?.getTracks().forEach((track) => track.stop());
                back();
              }}
            >Return to dashboard</button>
          </div>
        </div>
        <div className="preflight-interviewer" aria-label="AI interviewer preview">
          <div className="interviewer-orbit"><Brain size={54} /></div>
          <span className="availability"><i /> Ready now</span>
          <h2>Maya</h2>
          <p>AI interview coach</p>
          <small>{session.setup.role} · {session.setup.track} round</small>
          <div className={`preflight-device-preview ${mediaState}`}>
            <video ref={previewVideo} autoPlay muted playsInline aria-label="Camera preview" />
            {mediaState !== "ready" && (
              <span><Camera size={24} /> Your camera preview will appear here</span>
            )}
            {mediaState === "ready" && (
              <b title={cameraLabel}><Check size={14} /> Camera and microphone ready</b>
            )}
          </div>
        </div>
        {phase === "complete" && <BriefingDialog error={briefingError} retry={() => void endInterview()} back={back} />}
      </div>
    );

  const total = session.setup.questionCount;
  const current = Math.min(session.turns.length + 1, total);
  const locked = phase === "thinking" || phase === "transcribing" || phase === "complete" || clarifying || answerPending;
  const shown = clarifiedQuestion || question;
  const recording = transcription.status === "recording";
  const answerSeconds = recording && answerStartedAt ? Math.floor((Date.now() - answerStartedAt) / 1000) : 0;
  const level = recording ? transcription.level : 0;
  return (
    <div className="interview-call-shell" data-theme={theme} style={{ "--level": level } as React.CSSProperties}>
      <header className="call-topbar">
        <div className="call-brand"><Brain size={20} aria-hidden="true" /><span>InterviewAce</span></div>
        <span className="call-round">{session.setup.role} · {session.setup.track}</span>
        <div className="call-meta">
          <span className="call-timer" title="Time in this interview"><Clock size={14} aria-hidden="true" /> {formatTime(elapsed)}</span>
          <button className="icon-only" onClick={toggleTheme} aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} title="Switch theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-only" onClick={() => setHelpOpen((open) => !open)} aria-label="Interview help" aria-expanded={helpOpen} title="Help">
            <HelpCircle size={18} />
          </button>
          <button
            className="hang-up"
            disabled={locked}
            onClick={() => void endInterview()}
            aria-label="End interview"
            title={phase === "thinking" || phase === "transcribing" ? "Saving your answer before ending the interview" : "End interview and prepare briefing"}
          >
            End interview
          </button>
        </div>
        {helpOpen && (
          <section className="call-help" aria-label="How this interview works">
            <h2>How this works</h2>
            <p>Maya asks one question at a time out loud. Take a moment to think; the microphone only waits for you to start. It stops after a short pause, or press <b>Space</b>.</p>
            <p>Say “repeat the question”, “could you clarify that?” or “pause the interview” at any time, or use the buttons below.</p>
            <p>Prefer typing? Use the keyboard button. Each answer is saved before the next question.</p>
          </section>
        )}
      </header>

      <div className="call-stage">
        <nav className="interview-map" aria-label="Interview progress">
          <p className="map-title">Question {current} of {total}</p>
          <ol>
            {Array.from({ length: total }, (_, i) => {
              const done = session.turns[i];
              const state = done ? "done" : i === session.turns.length ? "current" : "upcoming";
              return (
                <li key={i} className={state} aria-current={state === "current" ? "step" : undefined}>
                  <span className="map-dot" aria-hidden="true">{done ? <Check size={12} /> : i + 1}</span>
                  {done ? (
                    <details>
                      <summary>{done.question.focus}</summary>
                      <p className="map-q">{done.question.question}</p>
                      <p className="map-a"><span className="sr-only">Your answer: </span>{done.answer}</p>
                    </details>
                  ) : (
                    <span className="map-label">{state === "current" ? session.currentQuestion?.focus || "Current question" : "Coming up"}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className={`interviewer-tile phase-${phase}`} aria-label="AI interviewer">
          <div className="maya-presence" aria-hidden="true">
            <span className="maya-ring r1" />
            <span className="maya-ring r2" />
            <span className="maya-core"><Brain size={26} /></span>
          </div>
          <p className={`turn-badge phase-${phase}`} aria-live="polite"><i aria-hidden="true" />{status}</p>
          <div
            className={`question-caption ${shown.length > 170 ? "question-very-long" : shown.length > 105 ? "question-long" : ""}`}
            aria-live="polite"
          >
            {mayaReply ? <p className="question-lead maya-reply">{mayaReply}</p> : session.currentQuestion?.lead && !clarifiedQuestion && <p className="question-lead">{session.currentQuestion.lead}</p>}
            {session.currentQuestion && (
              <span className="question-meta">{session.currentQuestion.focus} · {session.currentQuestion.difficulty}</span>
            )}
            <h1>{shown}</h1>
          </div>
          <div className="turn-state-slot" aria-live="polite">
            {phase === "listening" && !recording && <p className="turn-hint">Take a moment. I’m listening as soon as you start.</p>}
            {recording && <p className="turn-hint">Answer naturally. I’ll continue after a short pause.</p>}
            {phase === "transcribing" && <p className="turn-hint">Turning your answer into text…</p>}
            {lastAnswer && (phase === "thinking" || answerPending) && (
              <blockquote className="answer-receipt"><span>You said</span>{lastAnswer}</blockquote>
            )}
            {phase === "paused" && !typing && <p className="turn-hint">Microphone paused. Resume when you’re ready.</p>}
          </div>
        </section>

        <aside className="call-side">
          <CameraCoach
            autoStart
            callMode
            mediaStream={sharedStream.current}
            paused={phase !== "listening"}
            turn={session.turns.length}
            onSummary={(summary) => { visual.current = summary; }}
          />
          <div className={`mic-meter ${recording ? "live" : ""}`}>
            <Mic size={16} aria-hidden="true" />
            <span className="meter-track" aria-hidden="true"><span className="meter-fill" /></span>
            <span className="meter-time">{recording ? formatTime(answerSeconds) : "—"}</span>
          </div>
          {recording && answerSeconds >= 120 && <p className="pace-hint">Good time to wrap up this answer.</p>}
        </aside>
      </div>

      {typing && (
        <form
          className="type-answer"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (text.length < 2 || locked) return;
            setTyping(false);
            setDraft("");
            void submitSpokenAnswer(text);
          }}
        >
          <label htmlFor="typed-answer" className="sr-only">Type your answer</label>
          <textarea id="typed-answer" autoFocus rows={3} maxLength={8000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your answer…" />
          <button className="primary-action" disabled={draft.trim().length < 2 || locked}>Send answer</button>
        </form>
      )}

      {(mediaError || error || transcription.error || voice.error) && (
        <div className="call-error" role="alert">
          {mediaError || error || transcription.error || voice.error}
          {mediaError ? <button disabled={mediaState === "requesting"} onClick={() => void requestMedia()}>{mediaState === "requesting" ? "Reconnecting…" : "Reconnect camera & microphone"}</button> : <button onClick={() => answerPending ? void submitSpokenAnswer(lastAnswer) : repeatQuestion()}>{answerPending ? "Retry saving my answer" : "Retry this question"}</button>}
        </div>
      )}

      <footer className="call-controls" aria-label="Interview controls">
        <div className="call-dock">
          <div className={`active-mic ${recording ? "live" : ""}`} role="img" aria-label={recording ? "Microphone is recording" : "Microphone is paused"}>
            <Mic size={18} />
          </div>
          <button className="round-control" disabled={locked} onClick={repeatQuestion} aria-label="Repeat question" data-tip="Repeat"><RotateCcw size={18} /></button>
          <button className="round-control" disabled={locked} onClick={() => void clarifyQuestion()} aria-label="Clarify question" data-tip="Clarify"><MessageCircle size={18} /></button>
          <button className={`round-control ${typing ? "on" : ""}`} disabled={locked} onClick={openTyping} aria-label={typing ? "Close typed answer" : "Type your answer instead"} aria-pressed={typing} data-tip="Type"><Keyboard size={18} /></button>
          <button className="round-control" disabled={locked} onClick={() => phase === "paused" ? resumeInterview() : pauseInterview()} aria-label={phase === "paused" ? "Resume interview" : "Pause interview"} data-tip={phase === "paused" ? "Resume" : "Pause"}>
            {phase === "paused" ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button className="round-control" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit full screen" : "Enter full screen"} data-tip={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
        {phase === "interviewer" && !clarifying ? (
          <button className="primary-action" onClick={skipToAnswer}>Skip to my answer</button>
        ) : (
          <button className="primary-action" aria-label="Done speaking" aria-keyshortcuts="Space" disabled={!recording || phase !== "listening"} onClick={transcription.stop}>
            Done speaking <kbd aria-hidden="true">Space</kbd>
          </button>
        )}
      </footer>
      {phase === "complete" && <BriefingDialog error={briefingError} retry={() => void endInterview()} back={back} />}
    </div>
  );
}
