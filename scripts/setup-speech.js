import { mkdir, writeFile, access } from "node:fs/promises";
const root = new URL("../public/speech/", import.meta.url);
const model = new URL("whisper-tiny.en/", root);
await mkdir(new URL("onnx/", model), { recursive: true });
for (const file of [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
]) {
  const target = new URL(file, model);
  try {
    await access(target);
    console.info(`${file}: already installed`);
    continue;
  } catch {
    /* Download missing model files. */
  }
  const response = await fetch(
    `https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/${file}`,
    { signal: AbortSignal.timeout(180000) },
  );
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  console.info(`${file}: installed`);
}
