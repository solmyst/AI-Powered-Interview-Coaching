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
export function useVoice(
  append: (text: string) => void,
  { cloud = false }: { cloud?: boolean } = {},
) {
  const recognition = useRef<Recognition | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef("");
  const speechRequest = useRef<AbortController | null>(null);
  const speechGeneration = useRef(0);
  const started = useRef(0),
    elapsed = useRef(0);
  const appendRef = useRef(append);
  appendRef.current = append;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const engine =
    (window as unknown as VoiceWindow).SpeechRecognition ||
    (window as unknown as VoiceWindow).webkitSpeechRecognition;
  function stop() {
    setPreparing(false);
    speechGeneration.current++;
    speechRequest.current?.abort();
    speechRequest.current = null;
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = "";
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
  function speakWithBrowser(text: string, generation: number, onDone?: () => void) {
    if (generation !== speechGeneration.current) return;
    setPreparing(false);
    if (!window.speechSynthesis) {
      setError("Spoken questions are unavailable. Read the question on screen.");
      setSpeaking(false);
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0900-\u097f]/.test(text) ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (generation !== speechGeneration.current) return;
      setSpeaking(false);
      onDone?.();
    };
    utterance.onerror = (event) => {
      if (generation !== speechGeneration.current) return;
      setSpeaking(false);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setError("Speech playback failed. The question is available as text.");
        onDone?.();
      }
    };
    window.speechSynthesis.speak(utterance);
  }
  function speak(text: string, onDone?: () => void) {
    setError("");
    recognition.current?.stop();
    stop();
    const generation = speechGeneration.current;
    setSpeaking(true);
    if (!cloud) {
      speakWithBrowser(text, generation, onDone);
      return;
    }
    const controller = new AbortController();
    setPreparing(true);
    speechRequest.current = controller;
    let usedFallback = false;
    const fallback = () => {
      if (usedFallback) return;
      usedFallback = true;
      audio.current?.pause();
      speakWithBrowser(text, generation, onDone);
    };
    void fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Cloud speech unavailable");
        return response.blob();
      })
      .then((blob) => {
        if (generation !== speechGeneration.current) return;
        setPreparing(false);
        audioUrl.current = URL.createObjectURL(blob);
        const player = new Audio(audioUrl.current);
        audio.current = player;
        player.onended = () => {
          if (generation !== speechGeneration.current) return;
          setSpeaking(false);
          onDone?.();
        };
        player.onerror = fallback;
        return player.play();
      })
      .catch((reason) => {
        if (generation !== speechGeneration.current || reason?.name === "AbortError") return;
        fallback();
      });
  }
  useEffect(
    () => () => {
      speechGeneration.current++;
      const rec = recognition.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      }
      window.speechSynthesis?.cancel();
      speechRequest.current?.abort();
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    },
    [],
  );
  return {
    listening,
    speaking,
    preparing,
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
