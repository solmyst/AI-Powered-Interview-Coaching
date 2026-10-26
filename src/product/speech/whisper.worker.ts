import { env, pipeline } from "@huggingface/transformers";
import wasmFactoryUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import wasmBinaryUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
env.allowRemoteModels = false;
env.useWasmCache = false;
env.allowLocalModels = true;
env.localModelPath = "/speech/";
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = {
    // Vite must own the dynamic module URL. Public-directory modules are served
    // as static files and Vite rejects the `?import` request ORT creates.
    mjs: wasmFactoryUrl,
    wasm: wasmBinaryUrl,
  };
}
type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string }>;
let transcriber: Transcriber | null = null;
self.onmessage = async (
  event: MessageEvent<{ type: "load" | "transcribe"; audio?: Float32Array }>,
) => {
  try {
    if (event.data.type === "load") {
      const create = pipeline as unknown as (
        task: string,
        model: string,
        options: Record<string, unknown>,
      ) => Promise<Transcriber>;
      transcriber = await create(
        "automatic-speech-recognition",
        "whisper-tiny.en",
        { device: "wasm", dtype: "q8", local_files_only: true },
      );
      self.postMessage({ type: "ready" });
    } else {
      if (!transcriber || !event.data.audio)
        throw new Error("Whisper is not loaded.");
      const result = await transcriber(event.data.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
      self.postMessage({ type: "result", text: result.text?.trim() || "" });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Whisper failed.",
    });
  }
};
