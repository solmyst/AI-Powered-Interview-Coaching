import { useEffect, useRef, useState } from "react";
export function useWhisper(append: (text: string) => void) {
  const worker = useRef<Worker | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(),
    deadline = useRef<ReturnType<typeof setTimeout>>(),
    started = useRef(0),
    duration = useRef(0),
    monitor = useRef<AudioContext | null>(null),
    monitorFrame = useRef(0),
    ownsStream = useRef(false),
    epoch = useRef(0),
    callback = useRef(append);
  callback.current = append;
  const [status, setStatus] = useState<
    | "off"
    | "loading"
    | "ready"
    | "requesting"
    | "recording"
    | "transcribing"
    | "error"
  >("off");
  const [error, setError] = useState("");
  function release() {
    clearTimeout(timer.current);
    cancelAnimationFrame(monitorFrame.current);
    void monitor.current?.close().catch(() => {});
    monitor.current = null;
    if (ownsStream.current)
      stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ownsStream.current = false;
  }
  function cancel() {
    epoch.current++;
    clearTimeout(deadline.current);
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    release();
    worker.current?.terminate();
    worker.current = null;
    setStatus("off");
  }
  function timeout() {
    clearTimeout(deadline.current);
    deadline.current = setTimeout(() => {
      cancel();
      setStatus("error");
      setError(
        "Local transcription timed out. Retry this question.",
      );
    }, 120000);
  }
  function load() {
    cancel();
    setError("");
    setStatus("loading");
    timeout();
    const w = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      clearTimeout(deadline.current);
      if (e.data.type === "ready") setStatus("ready");
      else if (e.data.type === "result") {
        setStatus("ready");
        if (e.data.text) callback.current(e.data.text);
        else
          setError(
            "No speech was transcribed. Please try again or type your answer.",
          );
      } else {
        setStatus("error");
        setError(
          `Whisper could not run. Check the local speech assets and retry. ${e.data.message || ""}`,
        );
      }
    };
    w.onerror = () => {
      cancel();
      setStatus("error");
      setError("The local Whisper worker failed. Retry this question.");
    };
    w.postMessage({ type: "load" });
  }
  async function record(
    options: { autoStop?: boolean; mediaStream?: MediaStream } = {},
  ) {
    setError("");
    setStatus("requesting");
    const generation = epoch.current;
    try {
      const acquired = options.mediaStream
        ? new MediaStream(options.mediaStream.getAudioTracks())
        : await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
      if (generation !== epoch.current) {
        if (!options.mediaStream)
          acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = acquired;
      ownsStream.current = !options.mediaStream;
      const r = new MediaRecorder(acquired);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        duration.current += Date.now() - started.current;
        release();
        if (generation !== epoch.current) return;
        setStatus("transcribing");
        timeout();
        let context: AudioContext | null = null;
        try {
          context = new AudioContext({ sampleRate: 16000 });
          const decoded = await context.decodeAudioData(
            await new Blob(chunks, { type: r.mimeType }).arrayBuffer(),
          );
          const audio = new Float32Array(decoded.length);
          for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
            const data = decoded.getChannelData(channel);
            for (let i = 0; i < audio.length; i++)
              audio[i] += data[i] / decoded.numberOfChannels;
          }
          await context.close();
          context = null;
          if (generation !== epoch.current) return;
          const rms = Math.sqrt(
            audio.reduce((sum, v) => sum + v * v, 0) / audio.length,
          );
          if (!audio.length || rms < 0.004) {
            clearTimeout(deadline.current);
            setStatus("ready");
            setError(
              "No audible speech detected. Check your microphone and try again.",
            );
            return;
          }
          worker.current?.postMessage({ type: "transcribe", audio }, [
            audio.buffer,
          ]);
        } catch {
          await context?.close().catch(() => {});
          if (generation === epoch.current) {
            clearTimeout(deadline.current);
            setStatus("error");
            setError(
              "Could not decode microphone audio. Retry this question.",
            );
          }
        }
      };
      r.onerror = () => {
        release();
        setError("Microphone recording failed. Please retry.");
        setStatus("error");
      };
      r.start();
      started.current = Date.now();
      setStatus("recording");
      if (options.autoStop) {
        const context = new AudioContext();
        monitor.current = context;
        const source = context.createMediaStreamSource(acquired);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const levels = new Uint8Array(analyser.fftSize);
        let heardSpeech = false;
        let quietSince = 0;
        const detectEnd = (time: number) => {
          if (r.state !== "recording") return;
          analyser.getByteTimeDomainData(levels);
          const rms = Math.sqrt(
            levels.reduce((sum, value) => {
              const normalized = (value - 128) / 128;
              return sum + normalized * normalized;
            }, 0) / levels.length,
          );
          if (rms > 0.018) {
            heardSpeech = true;
            quietSince = 0;
          } else if (heardSpeech) {
            quietSince ||= time;
            if (time - quietSince > 1800 && Date.now() - started.current > 2500) {
              r.stop();
              return;
            }
          }
          monitorFrame.current = requestAnimationFrame(detectEnd);
        };
        monitorFrame.current = requestAnimationFrame(detectEnd);
      }
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 120000);
    } catch (err) {
      release();
      setStatus("ready");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in browser settings, then retry."
          : "No usable microphone was found. Connect one, then retry.",
      );
    }
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  useEffect(
    () => () => {
      epoch.current++;
      clearTimeout(timer.current);
      clearTimeout(deadline.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      worker.current?.terminate();
    },
    [],
  );
  return {
    status,
    error,
    load,
    record,
    stop,
    cancel,
    durationMs: () => duration.current,
    reset: () => {
      duration.current = 0;
    },
  };
}
