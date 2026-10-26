import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  accumulate,
  emptyVisual,
  frameSignals,
  type FrameSignals,
  type VisualSummary,
} from "./metrics";
export function CameraCoach({
  paused,
  turn,
  onSummary,
  autoStart = false,
  callMode = false,
  mediaStream = null,
}: {
  paused: boolean;
  turn: number;
  onSummary: (summary: VisualSummary) => void;
  autoStart?: boolean;
  callMode?: boolean;
  mediaStream?: MediaStream | null;
}) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null),
    face = useRef<FaceLandmarker | null>(null),
    pose = useRef<PoseLandmarker | null>(null);
  const generation = useRef(0),
    animation = useRef(0),
    samples = useRef(emptyVisual()),
    lastTime = useRef(0),
    lastFrame = useRef(-1);
  const ownsStream = useRef(false);
  const pauseRef = useRef(paused),
    callback = useRef(onSummary);
  pauseRef.current = paused;
  callback.current = onSummary;
  const [status, setStatus] = useState<"off" | "loading" | "active" | "error">(
    "off",
  );
  const [error, setError] = useState("");
  const [live, setLive] = useState<FrameSignals | null>(null);
  const [overlay, setOverlay] = useState(true);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  function cleanup() {
    generation.current++;
    cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach((t) => {
      t.onended = null;
      if (ownsStream.current) t.stop();
    });
    stream.current = null;
    ownsStream.current = false;
    face.current?.close();
    pose.current?.close();
    face.current = null;
    pose.current = null;
    if (video.current) video.current.srcObject = null;
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    lastTime.current = 0;
    lastFrame.current = -1;
  }
  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    samples.current = emptyVisual();
    callback.current(samples.current);
    lastTime.current = 0;
  }, [turn]);
  async function enable() {
    cleanup();
    const epoch = generation.current;
    setError("");
    setLive(null);
    setStatus("loading");
    let acquired: MediaStream | null = null;
    let loadedFace: FaceLandmarker | null = null;
    let loadedPose: PoseLandmarker | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires HTTPS or localhost and a supported browser.",
        );
      acquired =
        mediaStream ||
        (await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        }));
      if (epoch !== generation.current) {
        if (!mediaStream) acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = acquired;
      ownsStream.current = !mediaStream;
      const v = video.current!;
      v.srcObject = acquired;
      await v.play();
      const { FaceLandmarker, PoseLandmarker, FilesetResolver } =
        await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/vision/wasm");
      // CPU is broadly compatible with browsers/headless tests. Detection is capped at ~4Hz.
      loadedFace = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/vision/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      if (epoch !== generation.current) {
        loadedFace.close();
        return;
      }
      loadedPose = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/vision/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      if (epoch !== generation.current) {
        loadedFace.close();
        loadedPose.close();
        return;
      }
      face.current = loadedFace;
      pose.current = loadedPose;
      acquired.getVideoTracks()[0].onended = () => {
        cleanup();
        setStatus("error");
        setError(
          "The camera disconnected. Reconnect it and enable the camera again.",
        );
      };
      setStatus("active");
      const loop = (time: number) => {
        if (epoch !== generation.current) return;
        if (
          !document.hidden &&
          !pauseRef.current &&
          v.readyState >= 2 &&
          time - lastTime.current >= 250 &&
          v.currentTime !== lastFrame.current
        ) {
          try {
            const f = face.current!.detectForVideo(v, time).faceLandmarks[0];
            const p = pose.current!.detectForVideo(v, time).landmarks[0];
            const signals = frameSignals(f, p, v.videoWidth / v.videoHeight);
            setLive(signals);
            samples.current = accumulate(
              samples.current,
              signals,
              lastTime.current ? time - lastTime.current : 250,
            );
            callback.current(samples.current);
            lastTime.current = time;
            lastFrame.current = v.currentTime;
            const c = canvas.current;
            if (c) {
              c.width = v.videoWidth;
              c.height = v.videoHeight;
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, c.width, c.height);
                if (overlayRef.current) {
                  ctx.strokeStyle = "#a8e2ad";
                  ctx.fillStyle = "#a8e2ad";
                  ctx.lineWidth = 2;
                  for (const pair of [
                    [33, 133],
                    [362, 263],
                    [33, 263],
                  ])
                    if (f?.[pair[0]] && f[pair[1]]) {
                      ctx.beginPath();
                      ctx.moveTo(
                        f[pair[0]].x * c.width,
                        f[pair[0]].y * c.height,
                      );
                      ctx.lineTo(
                        f[pair[1]].x * c.width,
                        f[pair[1]].y * c.height,
                      );
                      ctx.stroke();
                    }
                  for (const i of [1, 468, 473])
                    if (f?.[i]) {
                      ctx.beginPath();
                      ctx.arc(
                        f[i].x * c.width,
                        f[i].y * c.height,
                        3,
                        0,
                        Math.PI * 2,
                      );
                      ctx.fill();
                    }
                  if (signals.shoulderTilt !== null && p) {
                    ctx.beginPath();
                    ctx.moveTo(p[11].x * c.width, p[11].y * c.height);
                    ctx.lineTo(p[12].x * c.width, p[12].y * c.height);
                    ctx.stroke();
                  }
                }
              }
            }
          } catch {
            cleanup();
            setStatus("error");
            setError(
              "Camera analysis stopped. Try again or continue with text and voice.",
            );
            return;
          }
        } else if (pauseRef.current || document.hidden) {
          lastTime.current = 0;
        }
        animation.current = requestAnimationFrame(loop);
      };
      animation.current = requestAnimationFrame(loop);
    } catch (err) {
      loadedFace?.close();
      loadedPose?.close();
      if (!mediaStream) acquired?.getTracks().forEach((t) => t.stop());
      if (epoch !== generation.current) return;
      cleanup();
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in browser settings, or continue without video."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No camera was found. Connect a webcam and retry."
            : `Could not initialize camera analysis. Check that vision assets are installed, then retry. ${err instanceof Error ? err.message : ""}`,
      );
    }
  }
  useEffect(() => {
    if (autoStart && (!mediaStream || mediaStream.active)) void enable();
    // Start once when the call tile mounts; reconnect remains an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, mediaStream]);
  return (
    <section className={`panel camera-coach ${callMode ? "call-camera" : ""}`}>
      <div className="camera-heading">
        <h2>Your interview presence</h2>
        <span>
          {status === "active"
            ? "LIVE · LOCAL ONLY"
            : status === "loading"
              ? "STARTING…"
              : "CAMERA OFF"}
        </span>
      </div>
      <div className="camera-preview">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Your live camera preview"
        />
        <canvas ref={canvas} aria-hidden="true" />
        {status !== "active" && (
          <div className="camera-placeholder">
            <CameraOff size={30} />
            <p>
              {status === "loading"
                ? "Preparing camera and tracking models…"
                : "See yourself as you practice."}
            </p>
          </div>
        )}
      </div>
      <div className="camera-actions">
        <button
          className="secondary"
          onClick={() => {
            if (status === "active" || status === "loading") {
              cleanup();
              setLive(null);
              setStatus("off");
            } else void enable();
          }}
        >
          {status === "active" || status === "loading" ? (
            <CameraOff size={16} />
          ) : (
            <Camera size={16} />
          )}{" "}
          {status === "loading"
            ? "Cancel camera startup"
            : status === "active"
              ? "Turn camera off"
              : "Enable camera coaching"}
        </button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={overlay}
            onChange={(e) => setOverlay(e.target.checked)}
          />
          Tracking overlay
        </label>
      </div>
      {status === "active" && (
        <>
          <p className="camera-state" role="status">
            {paused
              ? "Analysis paused while the interviewer is speaking or thinking."
              : !live
                ? "Waiting for a video frame…"
                : !live.face
                  ? "Face not detected. Try better lighting and keep your face in frame."
                  : "Tracking your face and visible shoulders."}
          </p>
          <dl className="camera-signals">
            <div>
              <dt>Eye direction estimate</dt>
              <dd>
                {paused
                  ? "Paused"
                  : live?.gazeAligned === null || !live
                    ? "Not measurable"
                    : live.gazeAligned
                      ? "Near lens direction"
                      : "Looking away / uncertain"}
              </dd>
            </div>
            <div>
              <dt>Face framing</dt>
              <dd>
                {paused
                  ? "Paused"
                  : !live?.face
                    ? "Not measurable"
                    : live.centered
                      ? "Centered"
                      : "Adjust framing"}
              </dd>
            </div>
            <div>
              <dt>Head tilt</dt>
              <dd>
                {paused
                  ? "Paused"
                  : live?.headTilt == null
                    ? "Not measurable"
                    : `${Math.round(Math.abs(live.headTilt))}° from level`}
              </dd>
            </div>
            <div>
              <dt>Shoulder alignment</dt>
              <dd>
                {paused
                  ? "Paused"
                  : live?.shoulderTilt == null
                    ? "Move back to show shoulders"
                    : `${Math.round(Math.abs(live.shoulderTilt))}° from level`}
              </dd>
            </div>
          </dl>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <small>
        Video is processed on this device; no frames or face landmarks are
        uploaded or recorded. Only aggregate measurements are saved with
        submitted answers. Eye direction is approximate, not proof of eye
        contact. Sitting posture and confidence cannot be established from these
        signals.
      </small>
    </section>
  );
}
