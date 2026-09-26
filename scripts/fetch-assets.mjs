// Copies the MediaPipe wasm runtime and downloads the pose models into public/mediapipe (git-ignored).
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';

const OUT = 'public/mediapipe';
const WASM = 'node_modules/@mediapipe/tasks-vision/wasm';
const MODELS = ['lite', 'full'];
const modelUrl = (m) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/1/pose_landmarker_${m}.task`;
const exists = (path) => stat(path).then(() => true, () => false);

await mkdir(`${OUT}/wasm`, { recursive: true });
for (const file of await readdir(WASM)) await copyFile(`${WASM}/${file}`, `${OUT}/wasm/${file}`);
for (const model of MODELS) {
  const target = `${OUT}/pose_landmarker_${model}.task`;
  if (await exists(target)) continue;
  const response = await fetch(modelUrl(model));
  if (!response.ok) throw new Error(`Download failed for ${model}: HTTP ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`downloaded ${target}`);
}
