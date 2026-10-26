const DEFAULT_MODEL = "eleven_v4_turbo";

export class SpeechError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createSpeech(env = process.env, { fetchImpl = fetch } = {}) {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  const model = env.ELEVENLABS_MODEL?.trim() || DEFAULT_MODEL;
  const voiceId = env.ELEVENLABS_VOICE_ID?.trim() || "";
  const ready = Boolean(apiKey && /^[A-Za-z0-9_-]{4,80}$/.test(voiceId));

  return {
    status: () => ({ provider: "elevenlabs", model, voiceId, ready }),
    async synthesize(text) {
      if (!ready)
        throw new SpeechError(503, "ElevenLabs speech is not configured yet.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetchImpl(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128&enable_logging=false`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
            },
            body: JSON.stringify({ text, model_id: model }),
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new SpeechError(
            response.status === 429 ? 429 : 503,
            response.status === 429
              ? "Interviewer speech is busy. Using the browser voice instead."
              : "Interviewer speech is temporarily unavailable.",
          );
        return {
          audio: new Uint8Array(await response.arrayBuffer()),
          contentType: response.headers.get("content-type") || "audio/mpeg",
        };
      } catch (error) {
        if (error instanceof SpeechError) throw error;
        throw new SpeechError(503, "Interviewer speech is temporarily unavailable.");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
