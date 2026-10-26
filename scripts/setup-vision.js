import { mkdir, cp, writeFile, access } from "node:fs/promises";
const root = new URL("../public/vision/", import.meta.url);
await mkdir(root, { recursive: true });
await cp(
  new URL("../node_modules/@mediapipe/tasks-vision/wasm/", import.meta.url),
  new URL("wasm/", root),
  { recursive: true },
);
for (const [name, url] of Object.entries({
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
})) {
  const target = new URL(name, root);
  try {
    await access(target);
    console.info(`${name}: already installed`);
    continue;
  } catch {
    /* download missing assets */
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  console.info(`${name}: installed`);
}
