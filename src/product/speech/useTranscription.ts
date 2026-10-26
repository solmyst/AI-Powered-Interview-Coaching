import { useEffect, useRef, useState } from "react";
import { api } from "../api";

type Transcript = { text: string; confidence: number | null; durationMs: number };

function encodeWav(audio: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + audio.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + audio.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, audio.length * 2, true);
  for (let i = 0; i < audio.length; i++) {
    const sample = Math.max(-1, Math.min(1, audio[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useTranscription(append: (text: string) => void) {
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(),
    started = useRef(0),
    duration = useRef(0),
    monitor = useRef<AudioContext | null>(null),
    monitorFrame = useRef(0),
    ownsStream = useRef(false),
    epoch = useRef(0),
    callback = useRef(append);
  callback.current = append;
  const [status, setStatus] = useState<
    "ready" | "requesting" | "recording" | "transcribing" | "error"
  >("ready");
  const [error, setError] = useState("");

  function release() {
    clearTimeout(timer.current);
    cancelAnimationFrame(monitorFrame.current);
    void monitor.current?.close().catch(() => {});
    monitor.current = null;
    if (ownsStream.current) stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    ownsStream.current = false;
  }

  function cancel() {
    epoch.current++;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    release();
    setStatus("ready");
  }

  async function transcribe(chunks: Blob[], mimeType: string, generation: number) {
    setStatus("transcribing");
    let context: AudioContext | null = null;
    try {
      context = new AudioContext({ sampleRate: 16000 });
      const decoded = await context.decodeAudioData(
        await new Blob(chunks, { type: mimeType }).arrayBuffer(),
      );
      const audio = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const data = decoded.getChannelData(channel);
        for (let i = 0; i < audio.length; i++) audio[i] += data[i] / decoded.numberOfChannels;
      }
      const sampleRate = decoded.sampleRate;
      await context.close();
      context = null;
      if (generation !== epoch.current) return;
      const rms = Math.sqrt(audio.reduce((sum, value) => sum + value * value, 0) / audio.length);
      if (!audio.length || rms < 0.004) {
        setStatus("ready");
        setError("No audible speech detected. Check your microphone and try again.");
        return;
      }
      const result = await api<Transcript>("/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: encodeWav(audio, sampleRate),
        signal: AbortSignal.timeout(45000),
      });
      if (generation !== epoch.current) return;
      setStatus("ready");
      if (result.text) callback.current(result.text);
      else setError("No speech was transcribed. Please try your answer again.");
    } catch (reason) {
      await context?.close().catch(() => {});
      if (generation !== epoch.current) return;
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Speech transcription failed. Retry this answer.");
    }
  }

  async function record(options: { autoStop?: boolean; mediaStream?: MediaStream } = {}) {
    setError("");
    setStatus("requesting");
    const generation = epoch.current;
    try {
      const acquired = options.mediaStream
        ? new MediaStream(options.mediaStream.getAudioTracks())
        : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (generation !== epoch.current) {
        if (!options.mediaStream) acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      ownsStream.current = !options.mediaStream;
      const nextRecorder = new MediaRecorder(acquired);
      recorder.current = nextRecorder;
      const chunks: Blob[] = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      nextRecorder.onstop = () => {
        duration.current += Date.now() - started.current;
        release();
        if (generation === epoch.current)
          void transcribe(chunks, nextRecorder.mimeType, generation);
      };
      nextRecorder.onerror = () => {
        release();
        setError("Microphone recording failed. Please retry.");
        setStatus("error");
      };
      nextRecorder.start();
      started.current = Date.now();
      setStatus("recording");
      if (options.autoStop) {
        const context = new AudioContext();
        monitor.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(acquired).connect(analyser);
        const levels = new Uint8Array(analyser.fftSize);
        let heardSpeech = false;
        let quietSince = 0;
        const detectEnd = (time: number) => {
          if (nextRecorder.state !== "recording") return;
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
              nextRecorder.stop();
              return;
            }
          }
          monitorFrame.current = requestAnimationFrame(detectEnd);
        };
        monitorFrame.current = requestAnimationFrame(detectEnd);
      }
      timer.current = setTimeout(() => {
        if (nextRecorder.state === "recording") nextRecorder.stop();
      }, 120000);
    } catch (reason) {
      release();
      setStatus("ready");
      setError(
        reason instanceof DOMException && reason.name === "NotAllowedError"
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
      cancelAnimationFrame(monitorFrame.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      void monitor.current?.close().catch(() => {});
    },
    [],
  );

  return {
    status,
    error,
    record,
    stop,
    cancel,
    durationMs: () => duration.current,
    reset: () => { duration.current = 0; },
  };
}
