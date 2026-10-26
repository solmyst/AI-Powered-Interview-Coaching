const ENDPOINT = "https://sync.assemblyai.com/transcribe";
const DEFAULT_MODEL = "universal-3-5-pro";

export class TranscriptionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createTranscriber(env = process.env, { fetchImpl = fetch } = {}) {
  const apiKey = env.ASSEMBLYAI_API_KEY?.trim();
  const model = env.ASSEMBLYAI_MODEL?.trim() || DEFAULT_MODEL;

  return {
    status: () => ({ provider: "assemblyai", model, ready: Boolean(apiKey) }),
    async transcribe(audio) {
      if (!apiKey)
        throw new TranscriptionError(
          503,
          "Speech transcription is not configured yet.",
        );
      const form = new FormData();
      form.append("audio", new Blob([audio], { type: "audio/wav" }), "answer.wav");
      form.append("language_codes", JSON.stringify(["en", "hi"]));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "X-AAI-Model": model,
          },
          body: form,
          signal: controller.signal,
        });
        if (!response.ok)
          throw new TranscriptionError(
            response.status === 429 ? 429 : 503,
            response.status === 429
              ? "Speech transcription is busy. Please wait a moment and retry."
              : "Speech transcription is temporarily unavailable. Retry this answer.",
          );
        const result = await response.json();
        return {
          text: typeof result.text === "string" ? result.text.trim() : "",
          confidence:
            typeof result.confidence === "number" ? result.confidence : null,
          durationMs:
            typeof result.audio_duration_ms === "number"
              ? result.audio_duration_ms
              : 0,
        };
      } catch (error) {
        if (error instanceof TranscriptionError) throw error;
        throw new TranscriptionError(
          503,
          "Speech transcription is temporarily unavailable. Retry this answer.",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
