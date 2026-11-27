import { ServiceError } from "./ai.js";
const DEFAULT_MODEL = "bulbul:v4-flash";

export function createSpeech(env = process.env, { fetchImpl = fetch } = {}) {
  const apiKey = env.SARVAM_API_KEY?.trim();
  const model = env.SARVAM_MODEL?.trim() || DEFAULT_MODEL;
  const voiceId = env.SARVAM_VOICE?.trim() || "aarti_hi_customer";
  const ready = Boolean(apiKey && /^[A-Za-z0-9_-]{4,80}$/.test(voiceId));

  return {
    status: () => ({ provider: "sarvam", model, voiceId, ready }),
    async synthesize(text) {
      if (!ready)
        throw new ServiceError(503, "Sarvam speech is not configured yet.");
      // Sarvam's time grows with length (about 3 s per 200 characters), so long lines are split into
      // sentences, spoken in parallel and joined, which keeps them under the browser's wait.
      const language = /[\u0900-\u097f]/u.test(text) ? "hi-IN" : "en-IN";
      const parts = chunks(text);
      const audios = await Promise.all(
        parts.map((part) => one(part, language)),
      );
      return {
        audio: audios.length === 1 ? audios[0] : joinWav(audios),
        contentType: "audio/wav",
      };
    },
  };
  async function one(text, language) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetchImpl("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          text,
          language_code: language,
          model,
          speaker: voiceId,
          speech_sample_rate: 24000,
          output_audio_codec: "wav",
          pace: 1,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new ServiceError(
          response.status === 429 ? 429 : 503,
          response.status === 429
            ? "Interviewer speech is busy. Using the browser voice instead."
            : "Interviewer speech is temporarily unavailable.",
        );
      const result = await response.json();
      const encoded = result?.audios?.[0];
      if (
        typeof encoded !== "string" ||
        !encoded.length ||
        encoded.length > 16000000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
      )
        throw new ServiceError(
          503,
          "Interviewer speech returned invalid audio.",
        );
      const audio = Buffer.from(encoded, "base64");
      if (
        audio.subarray(0, 4).toString() !== "RIFF" ||
        audio.subarray(8, 12).toString() !== "WAVE"
      )
        throw new ServiceError(
          503,
          "Interviewer speech returned invalid audio.",
        );
      return audio;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        503,
        "Interviewer speech is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

const LIMIT = 220;
// Sentences grouped up to LIMIT characters; a sentence longer than that stays whole.
export function chunks(text) {
  const out = [];
  for (const sentence of text.match(
    /[^.!?।]+[.!?।]+["')\]]*\s*|[^.!?।]+$/gu,
  ) || [text]) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + sentence.length <= LIMIT)
      out[last] += sentence;
    else out.push(sentence);
  }
  return out.map((c) => c.trim()).filter(Boolean);
}
// Joins PCM WAV files that share one format by concatenating their data chunks under a new header.
export function joinWav(files) {
  const parts = files.map((file) => {
    let at = 12,
      fmt,
      data;
    while (at + 8 <= file.length) {
      const id = file.subarray(at, at + 4).toString();
      const size = file.readUInt32LE(at + 4);
      if (id === "fmt ") fmt = file.subarray(at + 8, at + 8 + size);
      if (id === "data")
        data = file.subarray(at + 8, Math.min(file.length, at + 8 + size));
      at += 8 + size + (size % 2);
    }
    if (!fmt || !data)
      throw new ServiceError(503, "Interviewer speech returned invalid audio.");
    return { fmt, data };
  });
  if (parts.some((p) => !p.fmt.equals(parts[0].fmt)))
    throw new ServiceError(503, "Interviewer speech returned invalid audio.");
  const data = Buffer.concat(parts.map((p) => p.data));
  const fmt = parts[0].fmt;
  const header = Buffer.alloc(20);
  header.write("RIFF", 0);
  header.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(fmt.length, 16);
  const dataHead = Buffer.alloc(8);
  dataHead.write("data", 0);
  dataHead.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, fmt, dataHead, data]);
}
