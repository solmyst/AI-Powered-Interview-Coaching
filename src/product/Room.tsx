import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Camera,
  Check,
  Headphones,
  Maximize,
  Mic,
  Minimize,
  MessageCircle,
  Pause,
  Play,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { api } from "./api";
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
  const [clarifying, setClarifying] = useState(false);

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
      const next = await api<Session>(`/interviews/${session.id}/answers`, {
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
      visual.current = emptyVisual();
      spoken.current = { words: 0, fillers: 0 };
      transcription.reset();
      setAnswerPending(false);
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
      cameraTrack?.addEventListener(
        "ended",
        () => {
          setMediaState("error");
          setMediaError("The camera disconnected. Reconnect it and retry the device check.");
        },
        { once: true },
      );
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
    setLastAnswer("");
    setError("");
    voice.speak(question, () => {
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
    if (transcription.status === "transcribing") setPhase("transcribing");
    if (transcription.status === "recording") setPhase("listening");
  }, [transcription.status]);

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

  function resumeInterview() {
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
    phase === "interviewer"
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
      </div>
    );

  return (
    <div className="interview-call-shell">
      <header className="call-topbar">
        <div className="call-brand"><Brain size={21} /> InterviewAce</div>
        <div className={`call-status phase-${phase}`}><i /> {status}</div>
        <div className="call-meta">
          <span>{formatTime(elapsed)}</span>
          <span>Question {Math.min(session.turns.length + 1, session.setup.questionCount)} of {session.setup.questionCount}</span>
        </div>
      </header>

      <main className="call-stage">
        <section className="interviewer-tile" aria-label="AI interviewer">
          <div className={`interviewer-presence ${phase === "interviewer" ? "speaking" : ""}`}>
            <div className="voice-ring ring-one" />
            <div className="voice-ring ring-two" />
            <div className="interviewer-avatar"><Brain size={48} /></div>
          </div>
          <div className="interviewer-identity">
            <strong>Maya</strong><span>AI interview coach</span>
          </div>
          <div
            className={`question-caption ${question.length > 170 ? "question-very-long" : question.length > 105 ? "question-long" : ""}`}
            aria-live="polite"
          >
            <span>{phase === "thinking" ? "MAYA IS PREPARING YOUR FOLLOW-UP" : "MAYA ASKS"}</span>
            <h1>{clarifiedQuestion || question}</h1>
          </div>
          <div className="turn-state-slot" aria-live="polite">
            {phase === "listening" && (
              <div className="listening-prompt"><span className="audio-wave"><i/><i/><i/><i/><i/></span> Answer naturally. I’ll continue when you finish.</div>
            )}
            {phase === "transcribing" && <div className="listening-prompt"><Sparkles size={18}/> Understanding your response…</div>}
            {lastAnswer && phase === "thinking" && <p className="answer-received"><Check size={16}/> Answer received</p>}
            {phase === "paused" && <p className="listening-prompt">Microphone paused. Resume when you’re ready.</p>}
          </div>
        </section>

        <CameraCoach
          autoStart
          callMode
          mediaStream={sharedStream.current}
          paused={phase !== "listening"}
          turn={session.turns.length}
          onSummary={(summary) => { visual.current = summary; }}
        />
      </main>

      {(error || transcription.error || voice.error) && (
        <div className="call-error" role="alert">
          {error || transcription.error || voice.error}
          <button onClick={() => answerPending ? void submitSpokenAnswer(lastAnswer) : repeatQuestion()}>{answerPending ? "Retry saving my answer" : "Retry this question"}</button>
        </div>
      )}

      <footer className="call-controls" aria-label="Interview controls">
        <button
          className="round-control"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
        >{fullscreen ? <Minimize /> : <Maximize />}</button>
        <button
          className="round-control"
          disabled={phase === "thinking" || phase === "transcribing" || phase === "complete" || clarifying || answerPending}
          onClick={repeatQuestion}
          aria-label="Repeat question"
        ><RotateCcw /></button>
        <button className="round-control" disabled={phase === "thinking" || phase === "transcribing" || phase === "complete" || clarifying || answerPending} onClick={() => phase === "paused" ? resumeInterview() : pauseInterview()} aria-label={phase === "paused" ? "Resume interview" : "Pause interview"}>{phase === "paused" ? <Play /> : <Pause />}</button>
        <button className="round-control" disabled={phase === "thinking" || phase === "transcribing" || phase === "complete" || clarifying || answerPending} onClick={() => void clarifyQuestion()} aria-label="Clarify question"><MessageCircle /></button>
        <div className="active-mic" aria-label="Microphone is automatic">
          <Mic /><span>{phase === "listening" ? "Mic live" : "Mic paused"}</span>
        </div>
        {phase === "listening" && (
          <button className="done-speaking" onClick={transcription.stop}>
            Done speaking
          </button>
        )}
        <button className="hang-up" disabled={phase === "thinking" || phase === "transcribing" || phase === "complete" || clarifying || answerPending} onClick={() => void endInterview()} aria-label="End interview" title={phase === "thinking" || phase === "transcribing" ? "Saving your answer before ending the interview" : "End interview and prepare briefing"}>
          <PhoneOff />
        </button>
      </footer>
      {phase === "complete" && (
        <div className="briefing-overlay" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
          <div className="briefing-card">
            <span className="briefing-mark"><Check size={28} /></span>
            <p className="eyebrow">SESSION SAVED</p>
            <h2 id="briefing-title" tabIndex={-1} ref={(element) => element?.focus()}>Interview complete</h2>
            {briefingError ? (
              <>
                <p>We couldn’t prepare your briefing yet. Your answers are safe.</p>
                <p className="briefing-error">{briefingError}</p>
                <button className="primary" onClick={() => void endInterview()}>
                  Try preparing briefing again
                </button>
                <button className="text-button" onClick={back}>Return to dashboard</button>
              </>
            ) : (
              <>
                <p>Maya is preparing your briefing, answer feedback, and next-step study plan.</p>
                <div className="briefing-progress"><i /><i /><i /></div>
                <small>This usually takes a few seconds. Please keep this window open.</small>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
