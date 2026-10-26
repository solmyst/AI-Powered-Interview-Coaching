import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Camera,
  Check,
  Headphones,
  Mic,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { api } from "./api";
import { useVoice } from "./useVoice";
import { useWhisper } from "./speech/useWhisper";
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
  | "complete";

export function Room({
  session,
  update,
  back,
}: {
  session: Session;
  update: (value: Session) => void;
  back: () => void;
}) {
  const visual = useRef(emptyVisual());
  const spoken = useRef({ words: 0, fillers: 0 });
  const deliveredTurn = useRef(-1);
  const reportStarted = useRef(false);
  const callStartedAt = useRef(0);
  const sharedStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const [joined, setJoined] = useState(false);
  const [mediaState, setMediaState] = useState<
    "idle" | "requesting" | "ready" | "error"
  >("idle");
  const [mediaError, setMediaError] = useState("");
  const [phase, setPhase] = useState<CallPhase>("preflight");
  const [elapsed, setElapsed] = useState(0);
  const [lastAnswer, setLastAnswer] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  async function submitSpokenAnswer(text: string) {
    const answer = text.trim().slice(0, 8000);
    if (answer.length < 2) {
      setError("I couldn’t hear a complete answer. Try that response again.");
      setPhase("listening");
      return;
    }
    setLastAnswer(answer);
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
              source: "whisper",
              captureMs: whisper.durationMs(),
              words: spoken.current.words,
              fillers: spoken.current.fillers,
            },
          },
        }),
      });
      visual.current = emptyVisual();
      spoken.current = { words: 0, fillers: 0 };
      whisper.reset();
      update(next);
    } catch (reason) {
      setError((reason as Error).message);
      setPhase("listening");
    }
  }

  function receiveTranscript(text: string) {
    spoken.current.words += text.trim().split(/\s+/).filter(Boolean).length;
    spoken.current.fillers += (
      text.match(/\b(um|uh|erm|hmm)\b/gi) || []
    ).length;
    void submitSpokenAnswer(text);
  }

  const whisper = useWhisper(receiveTranscript);
  const voice = useVoice(() => {});
  const question = session.currentQuestion?.question || "";

  useEffect(() => {
    if (whisper.status === "off") whisper.load();
    // The model is prepared before Join; media permissions still require the click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      sharedStream.current?.getTracks().forEach((track) => track.stop());
      sharedStream.current = null;
    },
    [],
  );

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
      }
      setMediaState("ready");
    } catch (reason) {
      setMediaState("error");
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
      whisper.status !== "ready" ||
      deliveredTurn.current === session.turns.length ||
      session.state !== "active"
    )
      return;
    deliveredTurn.current = session.turns.length;
    setPhase("interviewer");
    setLastAnswer("");
    setError("");
    voice.speak(question, () => {
      setPhase("listening");
      void whisper.record({
        autoStop: true,
        mediaStream: sharedStream.current || undefined,
      });
    });
    // retry intentionally replays the current turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, question, session.turns.length, session.state, whisper.status, retry]);

  useEffect(() => {
    if (whisper.status === "transcribing") setPhase("transcribing");
    if (whisper.status === "recording") setPhase("listening");
  }, [whisper.status]);

  useEffect(() => {
    if (session.state !== "report_pending" || reportStarted.current) return;
    reportStarted.current = true;
    setPhase("complete");
    voice.stop();
    whisper.cancel();
    void api<Session>(`/interviews/${session.id}/report`, {
      method: "POST",
      body: "{}",
    })
      .then(update)
      .catch((reason) => setError((reason as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  function repeatQuestion() {
    voice.stop();
    whisper.cancel();
    whisper.load();
    deliveredTurn.current = -1;
    setRetry((value) => value + 1);
  }

  async function endInterview() {
    voice.stop();
    whisper.cancel();
    if (!session.turns.length) {
      back();
      return;
    }
    setPhase("complete");
    setError("");
    try {
      update(
        await api<Session>(`/interviews/${session.id}/report`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  const status =
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
            <div><Mic /><span><strong>Microphone</strong>Automatic local transcription with Whisper</span></div>
            <div><Headphones /><span><strong>Headphones recommended</strong>Prevents the interviewer’s voice entering your answer</span></div>
            <div><ShieldCheck /><span><strong>Private by design</strong>No video, audio, frames, or raw landmarks are stored</span></div>
          </div>
          {(whisper.error || error) && <div className="call-error" role="alert">{whisper.error || error}</div>}
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
              disabled={whisper.status !== "ready" || mediaState !== "ready"}
              onClick={() => {
                callStartedAt.current = Date.now();
                setPhase("joining");
                setJoined(true);
              }}
            >
              <Volume2 size={20} />
              {mediaState !== "ready"
                ? "Complete device check first"
                : whisper.status === "ready"
                  ? "Join interview"
                  : "Preparing voice engine…"}
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
            {mediaState === "ready" && <b><Check size={14} /> Camera and microphone ready</b>}
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
          <div className="question-caption" aria-live="polite">
            <span>{phase === "thinking" ? "MAYA IS PREPARING YOUR FOLLOW-UP" : "MAYA ASKS"}</span>
            <h1>{phase === "thinking" ? "Thank you. Give me a moment to consider that." : question}</h1>
          </div>
          {phase === "listening" && (
            <div className="listening-prompt"><span className="audio-wave"><i/><i/><i/><i/><i/></span> Answer naturally. I’ll continue when you finish.</div>
          )}
          {phase === "transcribing" && <div className="listening-prompt"><Sparkles size={18}/> Understanding your response…</div>}
          {lastAnswer && phase === "thinking" && <p className="answer-received"><Check size={16}/> Answer received</p>}
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

      {(error || whisper.error || voice.error) && (
        <div className="call-error" role="alert">
          {error || whisper.error || voice.error}
          <button onClick={repeatQuestion}>Retry this question</button>
        </div>
      )}

      <footer className="call-controls" aria-label="Interview controls">
        <button
          className="round-control"
          disabled={phase === "thinking" || phase === "complete"}
          onClick={repeatQuestion}
          aria-label="Repeat question"
        ><RotateCcw /></button>
        <div className="active-mic" aria-label="Microphone is automatic">
          <Mic /><span>{phase === "listening" ? "Mic live" : "Mic paused"}</span>
        </div>
        {phase === "listening" && (
          <button className="done-speaking" onClick={whisper.stop}>
            Done speaking
          </button>
        )}
        <button className="hang-up" onClick={() => void endInterview()} aria-label="End interview">
          <PhoneOff />
        </button>
      </footer>
    </div>
  );
}
