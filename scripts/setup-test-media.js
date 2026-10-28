// Synthetic devices for browser tests. No recordings, personal data or API keys.
import { mkdir, writeFile } from "node:fs/promises";

const root = new URL("../tests/fixtures/", import.meta.url);
await mkdir(root, { recursive: true });
const width = 640, height = 480;
const frame = Buffer.alloc(width * height * 3 / 2, 128);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    frame[y * width + x] = 40 + Math.floor(x / 80) * 25;
  }
}
await writeFile(new URL("camera.y4m", root), Buffer.concat([
  Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`),
  ...Array.from({ length: 30 }, () => Buffer.concat([Buffer.from("FRAME\n"), frame])),
]));

// Continuous audible tone keeps manual Done speaking tests independent of VAD.
const sampleRate = 16000, samples = sampleRate * 15;
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / sampleRate) * 8000), 44 + i * 2);
}
await writeFile(new URL("microphone.wav", root), wav);
console.info("Synthetic camera and microphone fixtures generated.");
