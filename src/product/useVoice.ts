import { useEffect, useRef, useState } from "react";
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: {
            isFinal: boolean;
            [index: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type VoiceWindow = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useVoice(append: (text: string) => void) {
  const recognition = useRef<Recognition | null>(null);
  const started = useRef(0),
    elapsed = useRef(0);
  const appendRef = useRef(append);
  appendRef.current = append;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const engine =
    (window as unknown as VoiceWindow).SpeechRecognition ||
    (window as unknown as VoiceWindow).webkitSpeechRecognition;
  function stop() {
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }
  function dictate() {
    setError("");
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!engine) {
      setError(
        "Speech recognition is unavailable in this browser. Please use a supported browser and retry.",
      );
      return;
    }
    const rec = new engine();
    recognition.current = rec;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) appendRef.current(e.results[i][0].transcript);
    };
    rec.onerror = (e) => {
      setListening(false);
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was denied. Enable it in browser settings and retry."
          : `Speech recognition stopped (${e.error}). Please retry.`,
      );
    };
    rec.onstart = () => {
      started.current = Date.now();
    };
    rec.onend = () => {
      if (started.current) elapsed.current += Date.now() - started.current;
      started.current = 0;
      setListening(false);
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start the microphone. Please retry.");
    }
  }
  function speak(text: string, onDone?: () => void) {
    setError("");
    recognition.current?.stop();
    if (!window.speechSynthesis) {
      setError(
        "Spoken questions are unavailable in this browser. Read the question on screen.",
      );
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = 0.95;
    speech.onend = () => {
      setSpeaking(false);
      onDone?.();
    };
    speech.onerror = (e) => {
      setSpeaking(false);
      if (e.error !== "canceled" && e.error !== "interrupted")
        setError("Speech playback failed. The question is available as text.");
      if (e.error !== "canceled" && e.error !== "interrupted") onDone?.();
    };
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  }
  useEffect(
    () => () => {
      const rec = recognition.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      }
      window.speechSynthesis?.cancel();
    },
    [],
  );
  return {
    listening,
    speaking,
    error,
    available: Boolean(engine),
    dictate,
    speak,
    stop,
    durationMs: () =>
      Math.round(
        elapsed.current + (started.current ? Date.now() - started.current : 0),
      ),
    reset: () => {
      elapsed.current = 0;
      started.current = 0;
    },
  };
}
