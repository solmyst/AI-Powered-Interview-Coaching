const DEFAULT_MODEL = "bulbul:v3";

export class SpeechError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createSpeech(env = process.env, { fetchImpl = fetch } = {}) {
  const apiKey = env.SARVAM_API_KEY?.trim();
  const model = env.SARVAM_MODEL?.trim() || DEFAULT_MODEL;
  const voiceId = env.SARVAM_VOICE?.trim() || "priya";
  const ready = Boolean(apiKey && /^[A-Za-z0-9_-]{4,80}$/.test(voiceId));

  return {
    status: () => ({ provider: "sarvam", model, voiceId, ready }),
    async synthesize(text) {
      if (!ready)
        throw new SpeechError(503, "Sarvam speech is not configured yet.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetchImpl(
          "https://api.sarvam.ai/text-to-speech",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-subscription-key": apiKey,
            },
            body: JSON.stringify({
              text,
              language_code: /[\u0900-\u097f]/u.test(text) ? "hi-IN" : "en-IN",
              model,
              speaker: voiceId,
              speech_sample_rate: 24000,
              output_audio_codec: "wav",
              pace: 1,
            }),
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
        const result = await response.json();
        const encoded = result?.audios?.[0];
        if (typeof encoded !== "string" || !encoded.length || encoded.length > 16000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
          throw new SpeechError(503, "Interviewer speech returned invalid audio.");
        const audio = Buffer.from(encoded, "base64");
        if (audio.subarray(0, 4).toString() !== "RIFF" || audio.subarray(8, 12).toString() !== "WAVE")
          throw new SpeechError(503, "Interviewer speech returned invalid audio.");
        return { audio, contentType: "audio/wav" };
      } catch (error) {
        if (error instanceof SpeechError) throw error;
        throw new SpeechError(503, "Interviewer speech is temporarily unavailable.");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
