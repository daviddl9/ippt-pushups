# IPPT Push-up Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone web app that counts push-ups out loud from the camera and calls IPPT no-counts (not low enough, no lockout, butt high, hips sagging, knees) with reasons, plus video upload analysis and session history.

**Architecture:** MediaPipe Pose Landmarker runs in the browser and feeds a pure-TypeScript rule engine (`src/core/`, no DOM). That engine is a hysteresis rep counter, calibrated from a 1 s plank hold and the first 3 reps. Thin controllers in `src/app/` wire camera/video frames → session reducer → voice + views. Views in `src/ui/` are built by the `slides-ui-dev` subagent against fixed contracts. It's a static site on GitHub Pages.

**Tech Stack:** TypeScript 7.0.2, Vite 8.3.1, Vitest 5.0.2, Playwright 1.63.0, @mediapipe/tasks-vision 1.0.1 (browser), Python 3.12 + mediapipe 0.10.21 via `uv` (fixture extraction only), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-26-ippt-pushups-design.md`. All code below was prototyped and verified before this plan was written:
- 112 unit + golden tests pass.
- `tsc` is clean under the tsconfig below.
- All 4 Playwright specs pass against a throwaway UI in headless Chromium.

## Global Constraints

- Repo: `~/Projects/ippt-pushups`. Personal identity is already set locally (`daviddl9` / `ddl.tdh@gmail.com`). Remote: `git@github-daviddl9:daviddl9/ippt-pushups.git`. Never add co-author trailers. Stage files explicitly (never `git add .`).
- One branch + draft PR per milestone (`m0-phone-spike`, `m1-core`, `m2-live`, `m3-history`, `m4-upload`, `m5-tune`). CI must pass before merging. Merging to `main` deploys to https://daviddl9.github.io/ippt-pushups/. Ask the user before each merge.
- Node ≥ 22.12 locally (Vite 8); CI uses Node 24. Exact dependency versions are pinned in `package.json`.
- Vite `base` is always `/ippt-pushups/`, so dev runs at `http://localhost:5173/ippt-pushups/`.
- `src/core/` is pure: no DOM, no timers, no randomness. Every threshold lives in `src/core/rules.config.ts`.
- Never commit videos, `test-assets/`, `public/mediapipe/` or `dist/`. Fixtures in `tests/fixtures/` contain pose landmarks only (no images, no location).
- The Python fixture tool must use `mediapipe==0.10.21`. Version 1.0.x crashes on macOS ("Service is unavailable").
- Style: small single-purpose functions, early returns, no nesting, `readonly` data, comments only for *why*.
- **UI tasks** (marked *Implementer: slides-ui-dev*) must follow these rules:
  - Create or change only files under `src/ui/`, plus the wiring files each task provides verbatim.
  - Plain TS + CSS, no framework, no external fonts or CDNs.
  - Dark, high-contrast, mobile-first design that works in portrait and landscape and respects `env(safe-area-inset-*)`.
  - The live count must be huge (≥ 30vh), readable from 2 m. Green means valid, red means no-count. Touch targets ≥ 44 px.
  - `data-testid` values must match the contracts exactly.
- Every `gh` command runs as daviddl9, so each block that uses `gh` starts with `export GH_TOKEN=$(gh auth token --user daviddl9)`.
- E2E runs locally only, because it needs the user's clip. Before E2E: `npx playwright install chromium` and `tools/prepare_clip.sh ~/Downloads/IMG_8568.MOV img8568`.

## Task overview

| # | Task | Implementer | Milestone |
|---|---|---|---|
| 1 | Scaffold (Vite, TS, Vitest, asset script) | general | M0 |
| 2 | Pose types, MediaPipe wrapper, camera, frame loops, voice | general | M0 |
| 3 | Settings, estimator cache, fps meter, routes, debug controller, E2E harness | general | M0 |
| 4 | Home + debug screens | slides-ui-dev | M0 |
| 5 | CI, GitHub Pages deploy, **phone checkpoint** | general + user | M0 |
| 6 | Geometry, rules config, smoothing | general | M1 |
| 7 | Synthetic poses + setup detection | general | M1 |
| 8 | Per-frame features | general | M1 |
| 9 | Rep counter | general | M1 |
| 10 | Judge + thresholds | general | M1 |
| 11 | Session reducer | general | M1 |
| 12 | Speech + summary | general | M1 |
| 13 | Golden fixtures from IMG_8568 | general | M1 |
| 14 | Live controller, history store, live text | general | M2 |
| 15 | Home start buttons, live + summary screens, **full-set checkpoint** | slides-ui-dev + user | M2 |
| 16 | History screen | slides-ui-dev | M3 |
| 17 | Upload mode | slides-ui-dev | M4 |
| 18 | Labelled clip, threshold tuning, camera guide, final deploy | general + user | M5 |

## File structure

```
index.html · package.json · tsconfig.json · vite.config.ts · vitest.config.ts · playwright.config.ts
scripts/fetch-assets.mjs          copy MediaPipe wasm + download models → public/mediapipe (git-ignored)
tools/prepare_clip.sh             phone clip → test-assets/<name>.{mp4,webm,mjpeg}
tools/extract_landmarks.py        clip → gzipped landmark fixture (Python MediaPipe)
src/main.ts                       composition root: deps + hash router
src/core/   (pure)                mode · pose · geometry · rules.config · smoothing · setup · features
                                  repCounter · judge · session · speech · summary
src/pose/                         monotonicClock · poseEstimator (MediaPipe wrapper)
src/io/                           camera · videoFrames · voice · wakeLock
src/store/history.ts              localStorage sessions
src/app/                          deps · settings · estimator · fpsMeter · routes · screens · debugScreen
                                  liveSession · liveScreen · liveText · bottomSnapshots · finishedSession
                                  finishSession · sessionFrames · uploadSession · uploadFlow
src/ui/                           (slides-ui-dev) styles.css · home · debug · skeleton · live · summary · history
tests/                            unit tests mirror src/; synthetic.ts · helpers.ts · memoryStorage.ts · fixtures/
e2e/                              speech.ts · debug · live · history · upload specs
```

---

## M0 — Phone spike

### Task 1: Scaffold the project

**Implementer:** general

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `index.html`, `src/main.ts`, `scripts/fetch-assets.mjs`

**Interfaces:**
- Produces: npm scripts `assets`, `dev`, `build`, `preview`, `test`, `typecheck`, `e2e`. `predev`/`prebuild` fetch MediaPipe assets into `public/mediapipe/`.

- [ ] **Step 1: Branch**

```bash
cd ~/Projects/ippt-pushups && git checkout -b m0-phone-spike
```

- [ ] **Step 2: Create `package.json` and install**

```json
{
  "name": "ippt-pushups",
  "private": true,
  "type": "module",
  "scripts": {
    "assets": "node scripts/fetch-assets.mjs",
    "predev": "npm run assets",
    "dev": "vite",
    "prebuild": "npm run assets",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "1.0.1"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@types/node": "26.6.3",
    "typescript": "7.0.2",
    "vite": "8.3.1",
    "vitest": "5.0.2"
  }
}
```

Run: `npm install`
Expected: installs without errors and creates `package-lock.json`.

- [ ] **Step 3: Create the configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ippt-pushups/',
  build: { target: 'es2022' },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], passWithNoTests: true },
});
```

`.gitignore`:
```
node_modules/
dist/
public/mediapipe/
test-assets/
test-results/
playwright-report/
```

- [ ] **Step 4: Create the page, a placeholder entry and the asset script**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>IPPT Push-ups</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (placeholder until Task 4):
```ts
document.getElementById('app')!.textContent = 'IPPT Push-ups';
```

`scripts/fetch-assets.mjs`:
```js
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
```

- [ ] **Step 5: Verify build, tests and types**

Run: `npm run build`
Expected: prints `downloaded public/mediapipe/pose_landmarker_lite.task` and `…_full.task`, then `✓ built`. `dist/mediapipe/` contains `wasm/` and both `.task` files.

Run: `npm test && npm run typecheck`
Expected: Vitest reports no test files and exits 0; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .gitignore index.html src/main.ts scripts/fetch-assets.mjs
git commit -m "chore: scaffold Vite + TypeScript app with MediaPipe asset fetch"
```

### Task 2: Pose types, MediaPipe wrapper, camera, frame loops, voice

**Implementer:** general

**Files:**
- Create: `src/core/mode.ts`, `src/core/pose.ts`, `src/pose/monotonicClock.ts`, `src/pose/poseEstimator.ts`, `src/io/camera.ts`, `src/io/videoFrames.ts`, `src/io/voice.ts`
- Test: `tests/core/pose.test.ts`, `tests/pose/monotonicClock.test.ts`, `tests/io/voice.test.ts`

**Interfaces:**
- Produces:
  - `type Mode = 'ippt60' | 'untimed'`
  - `Point`, `Landmark`, `Pose`, `Frame { tMs; pose: Pose | null; aspect }`, `VisibleFrame`, `Side`, `Joint`
  - `jointPoint(frame: VisibleFrame, joint, side): Point`, `sideVisibility(pose, side): number`, `nearSide(pose): Side`
  - `monotonicClock(): (tMs) => number`
  - `createPoseEstimator(model: ModelVariant, delegate: Delegate): Promise<PoseEstimator>` with `PoseEstimator { detect(source, tMs): Pose | null; close() }`, `ModelVariant = 'lite' | 'full'`, `Delegate = 'GPU' | 'CPU'`
  - `startCamera(video): Promise<() => void>`
  - `eachVideoFrame(video, onFrame): () => void`, `seekFrames(video, fps): AsyncGenerator<number>`
  - `Voice { say(text) }`, `createVoice(synth?)`

- [ ] **Step 1: Write the failing tests**

`tests/core/pose.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { jointPoint, nearSide, sideVisibility, type Landmark } from '../../src/core/pose';

const pose = (leftVisibility: number, rightVisibility: number): Landmark[] =>
  Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.25, visibility: i % 2 ? leftVisibility : rightVisibility }));

describe('pose', () => {
  it('scales x by the aspect ratio so both axes share frame-height units', () => {
    expect(jointPoint({ tMs: 0, aspect: 16 / 9, pose: pose(1, 1) }, 'shoulder', 'left')).toEqual({ x: (0.5 * 16) / 9, y: 0.25 });
  });

  it('takes the weakest joint as the side visibility', () => {
    const p = pose(0.9, 0.9);
    p[27] = { ...p[27], visibility: 0.2 };
    expect(sideVisibility(p, 'left')).toBe(0.2);
  });

  it('picks the more visible side as the camera side', () => {
    expect(nearSide(pose(0.4, 0.95))).toBe('right');
    expect(nearSide(pose(0.95, 0.4))).toBe('left');
  });
});
```

`tests/pose/monotonicClock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { monotonicClock } from '../../src/pose/monotonicClock';

describe('monotonicClock', () => {
  it('passes increasing timestamps through', () => {
    const clock = monotonicClock();
    expect([0, 33, 67].map(clock)).toEqual([0, 33, 67]);
  });

  it('shifts a restarted video past the last timestamp, keeping its spacing', () => {
    const clock = monotonicClock();
    [0, 33, 67].forEach(clock);
    expect([0, 33].map(clock)).toEqual([68, 101]);
  });
});
```

`tests/io/voice.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createVoice } from '../../src/io/voice';

class FakeUtterance {
  rate = 1;
  constructor(readonly text: string) {}
}

describe('createVoice', () => {
  it('cancels whatever is playing, then speaks the new line', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const calls: string[] = [];
    const synth = { cancel: () => calls.push('cancel'), speak: (u: FakeUtterance) => calls.push(`speak ${u.text}`) };
    createVoice(synth as unknown as SpeechSynthesis).say('12');
    expect(calls).toEqual(['cancel', 'speak 12']);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The imports `../../src/core/pose`, `../../src/pose/monotonicClock` and `../../src/io/voice` can't be resolved.

- [ ] **Step 3: Implement**

`src/core/mode.ts`:
```ts
export type Mode = 'ippt60' | 'untimed';
```

`src/core/pose.ts`:
```ts
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Landmark extends Point {
  readonly visibility: number;
}

export type Pose = readonly Landmark[];

export interface Frame {
  readonly tMs: number;
  readonly pose: Pose | null;
  readonly aspect: number;
}

export type VisibleFrame = Frame & { readonly pose: Pose };
export type Side = 'left' | 'right';
export type Joint = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';

const LANDMARK_INDEX: Record<Joint, readonly [left: number, right: number]> = {
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
};

const JOINTS = Object.keys(LANDMARK_INDEX) as Joint[];

function landmark(pose: Pose, joint: Joint, side: Side): Landmark {
  return pose[LANDMARK_INDEX[joint][side === 'left' ? 0 : 1]];
}

/** Joint position in frame-height units, so x and y share one scale. */
export function jointPoint(frame: VisibleFrame, joint: Joint, side: Side): Point {
  const { x, y } = landmark(frame.pose, joint, side);
  return { x: x * frame.aspect, y };
}

export function sideVisibility(pose: Pose, side: Side): number {
  return Math.min(...JOINTS.map((joint) => landmark(pose, joint, side).visibility));
}

export function nearSide(pose: Pose): Side {
  return sideVisibility(pose, 'left') > sideVisibility(pose, 'right') ? 'left' : 'right';
}
```

`src/pose/monotonicClock.ts`:
```ts
/** MediaPipe needs strictly increasing timestamps; a new video restarting at 0 is shifted past the last one. */
export function monotonicClock(): (tMs: number) => number {
  let offset = 0;
  let last = -Infinity;
  return (tMs) => {
    if (tMs + offset <= last) offset = last + 1 - tMs;
    last = tMs + offset;
    return last;
  };
}
```

`src/pose/poseEstimator.ts`:
```ts
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Pose } from '../core/pose';
import { monotonicClock } from './monotonicClock';

export type ModelVariant = 'lite' | 'full';
export type Delegate = 'GPU' | 'CPU';

export interface PoseEstimator {
  detect(source: TexImageSource, tMs: number): Pose | null;
  close(): void;
}

const toPose = (landmarks: readonly NormalizedLandmark[] | undefined): Pose | null =>
  landmarks?.map(({ x, y, visibility }) => ({ x, y, visibility })) ?? null;

export async function createPoseEstimator(model: ModelVariant, delegate: Delegate): Promise<PoseEstimator> {
  const assets = `${import.meta.env.BASE_URL}mediapipe`;
  const fileset = await FilesetResolver.forVisionTasks(`${assets}/wasm`);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${assets}/pose_landmarker_${model}.task`, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  const clock = monotonicClock();
  return {
    detect: (source, tMs) => toPose(landmarker.detectForVideo(source, clock(tMs)).landmarks[0]),
    close: () => landmarker.close(),
  };
}
```

`src/io/camera.ts`:
```ts
/** Starts the front camera in `video`; resolves to a function that turns it off. */
export async function startCamera(video: HTMLVideoElement): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return () => stream.getTracks().forEach((track) => track.stop());
}
```

`src/io/videoFrames.ts`:
```ts
/** Calls onFrame with a timestamp for every new video frame, until the returned function is called. */
export function eachVideoFrame(video: HTMLVideoElement, onFrame: (tMs: number) => void): () => void {
  let active = true;
  const tick = (now: DOMHighResTimeStamp) => {
    if (!active) return;
    onFrame(now);
    video.requestVideoFrameCallback(tick);
  };
  video.requestVideoFrameCallback(tick);
  return () => {
    active = false;
  };
}

/** Seeks through a loaded video at a fixed rate, yielding each sample time in ms. */
export async function* seekFrames(video: HTMLVideoElement, fps: number): AsyncGenerator<number> {
  const count = Math.floor(video.duration * fps);
  for (let i = 0; i < count; i++) {
    video.currentTime = i / fps;
    await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    yield Math.round((i * 1000) / fps);
  }
}
```

`src/io/voice.ts`:
```ts
export interface Voice {
  say(text: string): void;
}

/** Latest line wins, so counts never queue up behind each other. Call once inside a tap first (iOS unlock). */
export function createVoice(synth: SpeechSynthesis = window.speechSynthesis): Voice {
  return {
    say(text) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      synth.speak(utterance);
    },
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 6 tests pass (pose 3, monotonicClock 2, voice 1); `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/core/mode.ts src/core/pose.ts src/pose src/io tests/core/pose.test.ts tests/pose tests/io
git commit -m "feat: add pose types, MediaPipe estimator, camera, frame loops and voice"
```

### Task 3: Settings, estimator cache, fps meter, routes, debug controller, E2E harness

**Implementer:** general

**Files:**
- Create: `src/app/settings.ts`, `src/app/estimator.ts`, `src/app/fpsMeter.ts`, `src/app/routes.ts`, `src/app/deps.ts`, `src/app/debugScreen.ts`, `playwright.config.ts`, `tools/prepare_clip.sh`, `e2e/speech.ts`
- Test: `tests/memoryStorage.ts`, `tests/app/settings.test.ts`, `tests/app/fpsMeter.test.ts`, `tests/app/routes.test.ts`

**Interfaces:**
- Consumes: Task 2's `createPoseEstimator`, `startCamera`, `eachVideoFrame`, `Voice`, `Pose`, `Mode`.
- Produces:
  - `Settings { model; delegate }`, `DEFAULT_SETTINGS`, `readSettings(search, storage)`, `saveSettings(settings, storage)`
  - `getEstimator(settings): Promise<PoseEstimator>` (one cached instance)
  - `createFpsMeter(windowMs?)`
  - `Route`, `parseRoute(hash)`, `routeHash(route)`
  - `AppDeps { settings; voice; storage; navigate(hash) }`
  - `DebugView`, `startDebugScreen(view, deps): () => void`
  - `recordSpeech(page)`, `spokenLines(page)` for E2E

- [ ] **Step 1: Write the failing tests**

`tests/memoryStorage.ts`:
```ts
export function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map(Object.entries(initial));
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}
```

`tests/app/settings.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, readSettings, saveSettings } from '../../src/app/settings';
import { memoryStorage } from '../memoryStorage';

describe('settings', () => {
  it('defaults to the lite model on the GPU', () => {
    expect(readSettings('', memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('prefers URL parameters over saved settings', () => {
    const storage = memoryStorage();
    saveSettings({ model: 'full', delegate: 'GPU' }, storage);
    expect(readSettings('?delegate=CPU', storage)).toEqual({ model: 'full', delegate: 'CPU' });
  });

  it('ignores unknown values', () => {
    expect(readSettings('?model=heavy&delegate=TPU', memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });
});
```

`tests/app/fpsMeter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createFpsMeter } from '../../src/app/fpsMeter';

describe('createFpsMeter', () => {
  it('counts the frames of the last second', () => {
    const fps = createFpsMeter();
    let latest = 0;
    for (let i = 0; i < 60; i++) latest = fps(i * 50);
    expect(latest).toBe(20);
  });
});
```

`tests/app/routes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from '../../src/app/routes';

const ROUTES: Route[] = [
  { name: 'home' },
  { name: 'live', mode: 'ippt60' },
  { name: 'live', mode: 'untimed' },
  { name: 'summary', id: '2026-09-26T09:00:00.000Z' },
  { name: 'history' },
  { name: 'debug' },
];

describe('routes', () => {
  it.each(ROUTES)('round-trips %j', (route) => {
    expect(parseRoute(routeHash(route))).toEqual(route);
  });

  it.each(['', '#', '#/', '#/nope', '#/live/bogus', '#/summary'])('treats %j as home', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'home' });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL on unresolved `../../src/app/settings`, `fpsMeter` and `routes`.

- [ ] **Step 3: Implement**

`src/app/settings.ts`:
```ts
import type { Delegate, ModelVariant } from '../pose/poseEstimator';

export interface Settings {
  readonly model: ModelVariant;
  readonly delegate: Delegate;
}

export const DEFAULT_SETTINGS: Settings = { model: 'lite', delegate: 'GPU' };
const KEY = 'ippt-pushups.settings.v1';
const MODELS: readonly string[] = ['lite', 'full'];
const DELEGATES: readonly string[] = ['GPU', 'CPU'];

/** URL parameters win over saved settings, which win over defaults. */
export function readSettings(search: string, storage: Pick<Storage, 'getItem'>): Settings {
  const saved = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Settings>;
  const params = new URLSearchParams(search);
  const pick = <T extends string>(key: keyof Settings, allowed: readonly string[], fallback: T): T =>
    [params.get(key), saved[key]].find((v): v is T => typeof v === 'string' && allowed.includes(v)) ?? fallback;
  return { model: pick('model', MODELS, DEFAULT_SETTINGS.model), delegate: pick('delegate', DELEGATES, DEFAULT_SETTINGS.delegate) };
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(KEY, JSON.stringify(settings));
}
```

`src/app/estimator.ts`:
```ts
import { createPoseEstimator, type PoseEstimator } from '../pose/poseEstimator';
import type { Settings } from './settings';

let current: { key: string; estimator: Promise<PoseEstimator> } | null = null;

/** One MediaPipe instance for the whole app; recreating them leaks memory in WebKit (mediapipe#5036). */
export function getEstimator(settings: Settings): Promise<PoseEstimator> {
  const key = `${settings.model}/${settings.delegate}`;
  if (current?.key === key) return current.estimator;
  void current?.estimator.then((old) => old.close());
  current = { key, estimator: createPoseEstimator(settings.model, settings.delegate) };
  return current.estimator;
}
```

`src/app/fpsMeter.ts`:
```ts
/** Returns a function that records a frame time and gives frames per second over the last second. */
export function createFpsMeter(windowMs = 1000): (tMs: number) => number {
  const times: number[] = [];
  return (tMs) => {
    times.push(tMs);
    while (times[0] <= tMs - windowMs) times.shift();
    return (times.length * 1000) / windowMs;
  };
}
```

`src/app/routes.ts`:
```ts
import type { Mode } from '../core/mode';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'live'; readonly mode: Mode }
  | { readonly name: 'summary'; readonly id: string }
  | { readonly name: 'history' }
  | { readonly name: 'debug' };

const MODES: readonly string[] = ['ippt60', 'untimed'];

export function parseRoute(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  if (name === 'live' && MODES.includes(arg)) return { name, mode: arg as Mode };
  if (name === 'summary' && arg) return { name, id: decodeURIComponent(arg) };
  if (name === 'history' || name === 'debug') return { name };
  return { name: 'home' };
}

export function routeHash(route: Route): string {
  if (route.name === 'live') return `#/live/${route.mode}`;
  if (route.name === 'summary') return `#/summary/${encodeURIComponent(route.id)}`;
  return route.name === 'home' ? '#/' : `#/${route.name}`;
}
```

`src/app/deps.ts`:
```ts
import type { Voice } from '../io/voice';
import type { Settings } from './settings';

export interface AppDeps {
  readonly settings: Settings;
  readonly voice: Voice;
  readonly storage: Storage;
  navigate(hash: string): void;
}
```

`src/app/debugScreen.ts`:
```ts
import type { Pose } from '../core/pose';
import { startCamera } from '../io/camera';
import { eachVideoFrame } from '../io/videoFrames';
import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { createFpsMeter } from './fpsMeter';
import { saveSettings, type Settings } from './settings';

export interface DebugView {
  readonly video: HTMLVideoElement;
  drawPose(pose: Pose | null): void;
  showFps(fps: number): void;
  showLoadMs(ms: number): void;
  showSettings(settings: Settings): void;
  showError(message: string): void;
  onSettingsChange(handler: (settings: Settings) => void): void;
  onVoiceTest(handler: () => void): void;
}

/** Camera + skeleton + fps for checking the phone; returns a cleanup. */
export function startDebugScreen(view: DebugView, deps: AppDeps): () => void {
  view.showSettings(deps.settings);
  view.onSettingsChange((settings) => {
    saveSettings(settings, deps.storage);
    location.reload();
  });
  view.onVoiceTest(() => deps.voice.say('Voice check. One, two, three'));
  let left = false;
  let stop = () => {};
  void run(view, deps)
    .then((stopRun) => (left ? stopRun() : (stop = stopRun)))
    .catch((error: unknown) => view.showError(error instanceof Error ? error.message : String(error)));
  return () => {
    left = true;
    stop();
  };
}

async function run(view: DebugView, deps: AppDeps): Promise<() => void> {
  const loadStart = performance.now();
  const estimator = await getEstimator(deps.settings);
  view.showLoadMs(performance.now() - loadStart);
  const stopCamera = await startCamera(view.video);
  const fps = createFpsMeter();
  const stopFrames = eachVideoFrame(view.video, (tMs) => {
    view.drawPose(estimator.detect(view.video, tMs));
    view.showFps(fps(tMs));
  });
  return () => {
    stopFrames();
    stopCamera();
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 22 tests pass; `tsc` prints nothing.

- [ ] **Step 5: Add the E2E harness**

`playwright.config.ts` (fake camera plays the prepared MJPEG; E2E pages pass `?delegate=CPU`, which is about 30 fps headless versus about 5 fps on the SwiftShader GPU path):
```ts
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}/ippt-pushups/`,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=test-assets/img8568.mjpeg',
      ],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/ippt-pushups/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`tools/prepare_clip.sh`:
```bash
#!/usr/bin/env bash
# Converts a phone clip into test assets: H.264 for fixture extraction, VP9 for the upload E2E
# (Playwright's Chromium lacks H.264/HEVC) and MJPEG for the fake camera in the live E2E.
set -euo pipefail
source_video="${1:?usage: tools/prepare_clip.sh <video> <name>}"
name="${2:?usage: tools/prepare_clip.sh <video> <name>}"
out="test-assets/$name"
mkdir -p test-assets
ffmpeg -hide_banner -loglevel error -y -i "$source_video" -vf "scale=960:-2,format=yuv420p" -c:v libx264 -crf 20 -an "$out.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$out.mp4" -c:v libvpx-vp9 -b:v 1M -deadline realtime -cpu-used 8 -an "$out.webm"
ffmpeg -hide_banner -loglevel error -y -i "$out.mp4" -q:v 5 -f mjpeg "$out.mjpeg"
ls -la "$out".*
```

`e2e/speech.ts`:
```ts
import type { Page } from '@playwright/test';

/** Replaces speech synthesis with a recorder; read the lines back with spokenLines(page). */
export async function recordSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const lines: string[] = [];
    Object.assign(window, { __spoken: lines });
    window.speechSynthesis.speak = (utterance) => void lines.push(utterance.text);
    window.speechSynthesis.cancel = () => {};
  });
}

export function spokenLines(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}
```

Run:
```bash
chmod +x tools/prepare_clip.sh
tools/prepare_clip.sh ~/Downloads/IMG_8568.MOV img8568
npx playwright install chromium
npm run typecheck
```
Expected: `test-assets/img8568.mjpeg` (~39 MB), `.mp4` (~5.6 MB) and `.webm` (~5.7 MB) are listed; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/app tests/memoryStorage.ts tests/app playwright.config.ts tools/prepare_clip.sh e2e/speech.ts
git commit -m "feat: add settings, estimator cache, routes, debug controller and E2E harness"
```

### Task 4: Home + debug screens

**Implementer:** slides-ui-dev. Controllers exist; build the views to this contract.

**Files:**
- Create: `src/app/screens.ts` (verbatim below), `src/ui/styles.css`, `src/ui/home.ts`, `src/ui/debug.ts`, `src/ui/skeleton.ts`, `e2e/debug.spec.ts` (verbatim below)
- Modify: `src/main.ts` (replace entirely, verbatim below)

**Interfaces:**
- Consumes: `DebugView` and `startDebugScreen` (`src/app/debugScreen.ts`), `Settings` (`src/app/settings.ts`), `Pose` and `nearSide` (`src/core/pose.ts`).
- Produces (contract):
  - `renderHome(root: HTMLElement): void`. Shows the app name, a one-line description, and a link `data-testid="debug-link"` to `#/debug`. Counting arrives in Task 15.
  - `renderDebug(root: HTMLElement): DebugView`. Contains:
    - a `<video muted playsinline>` (the `video` field) with a canvas overlay exactly on top of it
    - `data-testid="fps"` (integer text), `data-testid="load-ms"` (integer text)
    - `<select data-testid="model-select">` (lite/full), `<select data-testid="delegate-select">` (GPU/CPU)
    - `<button data-testid="voice-test">`, an error line, and a back link to `#/`
    - `onSettingsChange` fires with both selects' values when either changes.
  - `drawSkeleton(canvas: HTMLCanvasElement, pose: Pose | null, video: HTMLVideoElement): void`. Sizes the canvas to the video frame and clears it. It draws lines between landmarks 11–12, 11–13–15, 12–14–16, 11–23, 12–24, 23–24, 23–25–27 and 24–26–28, with the camera side (`nearSide(pose)`) bright and thick and the far side dim. With no pose, it clears only.

- [ ] **Step 1: Write the failing E2E test**

`e2e/debug.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('debug screen tracks the camera', async ({ page }) => {
  await page.goto('?delegate=CPU#/debug');
  await expect(page.getByTestId('load-ms')).toHaveText(/\d+/, { timeout: 60_000 });
  await expect.poll(async () => Number(await page.getByTestId('fps').textContent()), { timeout: 30_000 }).toBeGreaterThan(10);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e -- e2e/debug.spec.ts`
Expected: FAIL. There's no `load-ms` element, because the placeholder page has no debug screen yet.

- [ ] **Step 3: Add the wiring (verbatim)**

`src/app/screens.ts`:
```ts
import { renderDebug } from '../ui/debug';
import { renderHome } from '../ui/home';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import type { Route } from './routes';

const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  if (route.name === 'debug') return startDebugScreen(renderDebug(root), deps);
  renderHome(root);
  return NO_CLEANUP;
}
```

`src/main.ts`:
```ts
import type { AppDeps } from './app/deps';
import { parseRoute } from './app/routes';
import { showScreen } from './app/screens';
import { readSettings } from './app/settings';
import { createVoice } from './io/voice';
import './ui/styles.css';

const root = document.getElementById('app')!;
const deps: AppDeps = {
  settings: readSettings(location.search, localStorage),
  voice: createVoice(),
  storage: localStorage,
  navigate: (hash) => {
    location.hash = hash;
  },
};

let cleanup = () => {};
function render(): void {
  cleanup();
  root.replaceChildren();
  cleanup = showScreen(parseRoute(location.hash), root, deps);
}

window.addEventListener('hashchange', render);
render();
```

- [ ] **Step 4: Build the views**

Implement `src/ui/styles.css`, `src/ui/home.ts`, `src/ui/debug.ts` and `src/ui/skeleton.ts` to the contract above and the UI rules in Global Constraints. Review the layout with Playwright screenshots of `?delegate=CPU#/` and `?delegate=CPU#/debug` at 844×390 (landscape phone) and 390×844 (portrait); the fake camera shows the clip, so the skeleton overlay is visible.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run e2e -- e2e/debug.spec.ts`
Expected: `tsc` clean, 22 unit tests pass, `1 passed` for the debug spec.

- [ ] **Step 6: Commit**

```bash
git add src/app/screens.ts src/main.ts src/ui e2e/debug.spec.ts
git commit -m "feat: add home and debug screens with skeleton overlay"
```

### Task 5: CI, GitHub Pages deploy, phone checkpoint

**Implementer:** general + user

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`, `docs/superpowers/m0-results.md`

- [ ] **Step 1: Add workflows and README**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

`README.md`:
````markdown
# IPPT Push-up Coach

Phone web app that counts push-ups out loud and calls no-counts (not low enough, arms not locked, butt high, hips sagging, knees) like an IPPT tester. Pose tracking runs on the phone with MediaPipe; video never leaves the device.

Live: https://daviddl9.github.io/ippt-pushups/

## Develop

```sh
npm install
npm run dev          # http://localhost:5173/ippt-pushups/ (camera works on localhost)
npm test             # unit + golden tests
npm run typecheck
```

## End-to-end tests

Needs the source clip (not committed) and Chromium:

```sh
npx playwright install chromium
tools/prepare_clip.sh ~/Downloads/IMG_8568.MOV img8568
npm run e2e
```

Design: `docs/superpowers/specs/2026-09-26-ippt-pushups-design.md`.
````

```bash
git add .github README.md
git commit -m "ci: add PR checks and GitHub Pages deploy"
```

- [ ] **Step 2: Confirm with the user, then create the public repo**

Ask: "OK to create the public repo `daviddl9/ippt-pushups` and push?" Continue only on yes.

```bash
export GH_TOKEN=$(gh auth token --user daviddl9)
gh repo create daviddl9/ippt-pushups --public --description "IPPT push-up counter with form checks"
git remote add origin git@github-daviddl9:daviddl9/ippt-pushups.git
git push -u origin main
gh api -X POST repos/daviddl9/ippt-pushups/pages -f build_type=workflow
```
Expected: the repo exists; `main` has only the docs; the Pages API returns JSON with `"build_type": "workflow"`.

- [ ] **Step 3: Open the M0 draft PR and wait for CI**

```bash
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m0-phone-spike
gh pr create --draft --base main --head m0-phone-spike --title "M0: phone spike (camera, MediaPipe, debug screen)" --body "Camera + MediaPipe pose + debug screen (fps, model/delegate toggle, voice test). E2E: debug spec passes locally."
gh pr checks --watch
```
Expected: the `CI / check` job passes.

- [ ] **Step 4: Merge after the user approves, then verify the deploy**

```bash
export GH_TOKEN=$(gh auth token --user daviddl9)
gh pr ready && gh pr merge --squash --delete-branch
sleep 15
gh run watch $(gh run list --workflow Deploy --limit 1 --json databaseId --jq '.[0].databaseId')
curl -sI https://daviddl9.github.io/ippt-pushups/ | head -1
curl -sI https://daviddl9.github.io/ippt-pushups/mediapipe/pose_landmarker_lite.task | head -1
git checkout main && git pull
```
Expected: both return `HTTP/2 200`.

- [ ] **Step 5: CHECKPOINT: user tests on the iPhone**

Ask the user to open `https://daviddl9.github.io/ippt-pushups/#/debug` in Safari with the phone landscape on the floor, allow the camera, and report the following for **lite/GPU, full/GPU, lite/CPU** (switch with the selects; the page reloads):
- load ms and steady fps
- whether the skeleton sits on the body
- whether "Test voice" is audible while the camera runs

Record the results in `docs/superpowers/m0-results.md`:

```markdown
# M0 phone results (iPhone 13 Pro, iOS 26, Safari)

| Model | Delegate | Load (ms) | fps | Skeleton on body? |
|---|---|---|---|---|
| lite | GPU | | | |
| full | GPU | | | |
| lite | CPU | | | |

Voice audible with camera on: yes / no
Default model: lite / full, because …
```

Decision rules:
- full/GPU ≥ 20 fps and skeleton correct: set `DEFAULT_SETTINGS.model = 'full'` in `src/app/settings.ts`, and change the first expectation in `tests/app/settings.test.ts` to `{ model: 'full', delegate: 'GPU' }`.
- Skeleton wrong on GPU but right on CPU: set `delegate: 'CPU'` the same way.
- Lite below 15 fps everywhere: stop and tell the user. The fallback is `width: { ideal: 640 }, height: { ideal: 360 }` in `src/io/camera.ts`, then re-test.
- Voice silent: stop and tell the user (open question for M2).

Commit on a short branch and PR it like Step 3 (skip if no code changed):
```bash
git checkout -b m0-results
git add docs/superpowers/m0-results.md src/app/settings.ts tests/app/settings.test.ts
git commit -m "docs: record M0 phone results and default model"
```

---

## M1 — Core logic (TDD)

Start M1 on a fresh branch from the updated `main`: `git checkout main && git pull && git checkout -b m1-core`.

### Task 6: Geometry, rules config, smoothing

**Implementer:** general

**Files:**
- Create: `src/core/rules.config.ts`, `src/core/geometry.ts`, `src/core/smoothing.ts`
- Test: `tests/core/geometry.test.ts`, `tests/core/smoothing.test.ts`

**Interfaces:**
- Consumes: `Point` from `src/core/pose.ts`.
- Produces:
  - `RULES` (all thresholds)
  - `sub`, `dot`, `length`, `unit`, `mean`, `meanPoint`, `median`
  - `angleDeg(a, vertex, c)`, `tiltDeg(a, b, up)`, `signedOffset(p, a, b, up)`
  - `Smoothed<T>`, `smooth(previous, values, tMs)`

- [ ] **Step 1: Write the failing tests**

`tests/core/geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { angleDeg, median, signedOffset, tiltDeg } from '../../src/core/geometry';

const UP = { x: 0, y: -1 };

describe('geometry', () => {
  it('measures the angle at a vertex', () => {
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });

  it('measures tilt from level relative to up', () => {
    expect(tiltDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, UP)).toBeCloseTo(0);
    expect(tiltDeg({ x: 0, y: 0 }, { x: 1, y: 1 }, UP)).toBeCloseTo(45);
    expect(tiltDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, UP)).toBeCloseTo(90);
  });

  it('gives a signed offset from a line, positive towards up', () => {
    const a = { x: 0, y: 0.5 };
    const b = { x: 1, y: 0.5 };
    expect(signedOffset({ x: 0.5, y: 0.4 }, a, b, UP)).toBeCloseTo(0.1);
    expect(signedOffset({ x: 0.5, y: 0.6 }, a, b, UP)).toBeCloseTo(-0.1);
  });

  it('takes the median of odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
```

`tests/core/smoothing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/rules.config';
import { smooth, type Smoothed } from '../../src/core/smoothing';

type One = { readonly v: number };

function stepResponse(fps: number, seconds: number): number {
  let state: Smoothed<One> = smooth<One>(null, { v: 0 }, 0);
  for (let i = 1; i <= fps * seconds; i++) state = smooth(state, { v: 1 }, (i * 1000) / fps);
  return state.values.v;
}

describe('smooth', () => {
  it('passes the first value through', () => {
    expect(smooth<One>(null, { v: 5 }, 100)).toEqual({ tMs: 100, values: { v: 5 } });
  });

  it('closes 1 - 1/e of the gap after one time constant', () => {
    const next = smooth({ tMs: 0, values: { v: 0 } }, { v: 1 }, RULES.smoothingTauMs);
    expect(next.values.v).toBeCloseTo(1 - Math.exp(-1));
  });

  it('gives the same result at 15 and 30 fps', () => {
    expect(stepResponse(15, 0.2)).toBeCloseTo(stepResponse(30, 0.2), 6);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/core/geometry.test.ts tests/core/smoothing.test.ts`
Expected: FAIL on unresolved `src/core/geometry`, `rules.config` and `smoothing`.

- [ ] **Step 3: Implement**

`src/core/rules.config.ts`:
```ts
export const RULES = {
  minVisibility: 0.5,
  maxBodyTiltDeg: 40,
  setupMinElbowDeg: 150,
  setupHoldMs: 1000,
  setupMaxWobble: 0.1,
  smoothingTauMs: 50,
  prominence: 0.12,
  atTopTolerance: 0.03,
  topLine: 0.85,
  lockoutElbowToleranceDeg: 12,
  calibrationReps: 3,
  depthTolerance: 0.12,
  maxCalibrationBottom: 0.6,
  hipTolerancePct: 5,
  minKneeDeg: 150,
  lostAfterMs: 1000,
  untimedEndAfterMs: 5000,
  ipptDurationMs: 60_000,
  timeWarningsSecondsLeft: [30, 10],
} as const;
```

`src/core/geometry.ts`:
```ts
import type { Point } from './pose';

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const length = (a: Point): number => Math.hypot(a.x, a.y);
export const unit = (a: Point): Point => ({ x: a.x / length(a), y: a.y / length(a) });
export const mean = (xs: readonly number[]): number => xs.reduce((sum, x) => sum + x, 0) / xs.length;
export const meanPoint = (ps: readonly Point[]): Point => ({ x: mean(ps.map((p) => p.x)), y: mean(ps.map((p) => p.y)) });
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function angleDeg(a: Point, vertex: Point, c: Point): number {
  const u = sub(a, vertex);
  const v = sub(c, vertex);
  return toDegrees(Math.acos(clamp(dot(u, v) / (length(u) * length(v)), -1, 1)));
}

/** Angle between the a→b line and the plane perpendicular to `up` (0° = level). */
export function tiltDeg(a: Point, b: Point, up: Point): number {
  return toDegrees(Math.asin(clamp(Math.abs(dot(unit(sub(b, a)), up)), 0, 1)));
}

/** Signed distance of p from the a→b line along `up`, as a fraction of |ab|. */
export function signedOffset(p: Point, a: Point, b: Point, up: Point): number {
  const ab = sub(b, a);
  const direction = unit(ab);
  const ap = sub(p, a);
  const along = dot(ap, direction);
  const perpendicular = { x: ap.x - along * direction.x, y: ap.y - along * direction.y };
  return dot(perpendicular, up) / length(ab);
}
```

`src/core/smoothing.ts`:
```ts
import { RULES } from './rules.config';

type Numbers<T> = { readonly [K in keyof T]: number };

export interface Smoothed<T extends Numbers<T>> {
  readonly tMs: number;
  readonly values: T;
}

/** Time-based exponential moving average of each value, so results don't depend on fps. */
export function smooth<T extends Numbers<T>>(previous: Smoothed<T> | null, values: T, tMs: number): Smoothed<T> {
  if (!previous) return { tMs, values };
  const alpha = 1 - Math.exp(-(tMs - previous.tMs) / RULES.smoothingTauMs);
  const keys = Object.keys(values) as (keyof T)[];
  const blended = Object.fromEntries(keys.map((k) => [k, previous.values[k] + alpha * (values[k] - previous.values[k])]));
  return { tMs, values: blended as T };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/geometry.test.ts tests/core/smoothing.test.ts && npm run typecheck`
Expected: 7 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/rules.config.ts src/core/geometry.ts src/core/smoothing.ts tests/core/geometry.test.ts tests/core/smoothing.test.ts
git commit -m "feat(core): add geometry helpers, rule constants and time-based smoothing"
```

### Task 7: Synthetic poses + setup detection

**Implementer:** general

**Files:**
- Create: `src/core/setup.ts`
- Test: `tests/synthetic.ts` (test helper), `tests/core/setup.test.ts`

**Interfaces:**
- Consumes: Task 6 geometry + `RULES`; Task 2 `jointPoint`, `nearSide`, `sideVisibility`.
- Produces:
  - `Calibration { side; up; setupHeight; setupElbowDeg }`, `SetupSample`
  - `setupSample(frame): SetupSample | null`, `extendRun(run, sample)`, `calibrateFromHold(run): Calibration | null`
  - Test helper `tests/synthetic.ts`: `frameAt`, `holdFrames`, `hiddenFrames`, `repFrames`, `sequence`, `hold`, `hidden`, `rep`, `reps`, plus the `Posture` and `RepShape` types

- [ ] **Step 1: Write the synthetic pose builder and the failing tests**

`tests/synthetic.ts` builds side-on poses (camera sees the right side) with a chosen height, elbow angle, hip lift and knee angle. Faults peak at the bottom of a synthetic rep:
```ts
import type { Frame, Landmark, Point } from '../src/core/pose';

/** A side-on push-up posture; the camera sees the right side. */
export interface Posture {
  /** Shoulder height above the wrist, 1 = top of the setup hold. */
  readonly height?: number;
  readonly elbowDeg?: number;
  /** Hip distance from the shoulder→ankle line as a fraction of its length, + = up. */
  readonly hipLift?: number;
  readonly kneeDeg?: number;
  readonly standing?: boolean;
  readonly visibility?: number;
}

/** Faults (hipLift, kneeDeg) peak at the bottom of the rep. */
export interface RepShape {
  readonly bottom?: number;
  readonly top?: number;
  readonly topElbowDeg?: number;
  readonly bottomElbowDeg?: number;
  readonly hipLift?: number;
  readonly kneeDeg?: number;
  readonly durationMs?: number;
}

const WRIST: Point = { x: 0.7, y: 0.8 };
const ANKLE: Point = { x: 0.1, y: 0.78 };
const ARM_HEIGHT = 0.3;
const FRAME_MS = 1000 / 30;
const RIGHT = [12, 14, 16, 24, 26, 28];
const LEFT = [11, 13, 15, 23, 25, 27];

const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + k * b.x, y: a.y + k * b.y });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Unit normal of a→b on the side where `pick` is positive. */
function normal(a: Point, b: Point, pick: (n: Point) => number): Point {
  const d = distance(a, b);
  const n = { x: -(b.y - a.y) / d, y: (b.x - a.x) / d };
  return pick(n) > 0 ? n : { x: -n.x, y: -n.y };
}

/** A joint between a and b such that the angle a-joint-b equals angleDeg. */
function bend(a: Point, b: Point, angleDeg: number, towards: Point): Point {
  const offset = distance(a, b) / 2 / Math.tan((angleDeg * Math.PI) / 360);
  return add(mid(a, b), towards, offset);
}

function joints(p: Required<Posture>): Point[] {
  if (p.standing) return [{ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.42 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.72 }, { x: 0.5, y: 0.9 }];
  const shoulder = { x: WRIST.x, y: WRIST.y - ARM_HEIGHT * p.height };
  const elbow = bend(shoulder, WRIST, p.elbowDeg, normal(shoulder, WRIST, (n) => -n.x));
  const up = normal(shoulder, ANKLE, (n) => -n.y);
  const hip = add(mid(shoulder, ANKLE), up, p.hipLift * distance(shoulder, ANKLE));
  const knee = bend(hip, ANKLE, p.kneeDeg, normal(hip, ANKLE, (n) => n.y));
  return [shoulder, elbow, WRIST, hip, knee, ANKLE];
}

export function frameAt(tMs: number, posture: Posture = {}): Frame {
  const p = { height: 1, elbowDeg: 172, hipLift: 0, kneeDeg: 178, standing: false, visibility: 0.99, ...posture };
  const points = joints(p);
  const pose: Landmark[] = Array.from({ length: 33 }, () => ({ ...points[0], visibility: 0.9 }));
  RIGHT.forEach((index, i) => (pose[index] = { ...points[i], visibility: p.visibility }));
  LEFT.forEach((index, i) => (pose[index] = { ...points[i], visibility: Math.min(0.4, p.visibility) }));
  return { tMs: Math.round(tMs), aspect: 1, pose };
}

export function holdFrames(startMs: number, durationMs: number, posture: Posture = {}): Frame[] {
  const count = Math.round(durationMs / FRAME_MS);
  return Array.from({ length: count }, (_, i) => frameAt(startMs + i * FRAME_MS, posture));
}

export function hiddenFrames(startMs: number, durationMs: number): Frame[] {
  return holdFrames(startMs, durationMs).map((frame) => ({ ...frame, pose: null }));
}

export function repFrames(startMs: number, shape: RepShape = {}): Frame[] {
  const s = { bottom: 0.45, top: 0.95, topElbowDeg: 170, bottomElbowDeg: 80, hipLift: 0, kneeDeg: 178, durationMs: 1000, ...shape };
  const count = Math.round(s.durationMs / FRAME_MS);
  return Array.from({ length: count }, (_, i) => {
    const phase = (1 - Math.cos((2 * Math.PI * i) / count)) / 2;
    return frameAt(startMs + i * FRAME_MS, {
      height: s.top - (s.top - s.bottom) * phase,
      elbowDeg: s.topElbowDeg - (s.topElbowDeg - s.bottomElbowDeg) * phase,
      hipLift: s.hipLift * phase,
      kneeDeg: 178 - (178 - s.kneeDeg) * phase,
    });
  });
}

/** Frames played back to back, each list shifted to start where the previous ended. */
export function sequence(...parts: ((startMs: number) => Frame[])[]): Frame[] {
  const frames: Frame[] = [];
  for (const part of parts) frames.push(...part(frames.length ? frames.at(-1)!.tMs + FRAME_MS : 0));
  return frames;
}

export const hold = (durationMs: number, posture?: Posture) => (startMs: number) => holdFrames(startMs, durationMs, posture);
export const hidden = (durationMs: number) => (startMs: number) => hiddenFrames(startMs, durationMs);
export const rep = (shape?: RepShape) => (startMs: number) => repFrames(startMs, shape);
export const reps = (count: number, shape?: RepShape) => (startMs: number) =>
  sequence(...Array.from({ length: count }, () => rep(shape))).map((f) => ({ ...f, tMs: f.tMs + Math.round(startMs) }));
```

`tests/core/setup.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { calibrateFromHold, extendRun, setupSample, type SetupSample } from '../../src/core/setup';
import { frameAt, holdFrames } from '../synthetic';

function runOf(frames: ReturnType<typeof holdFrames>): SetupSample[] {
  return frames.reduce<SetupSample[]>((run, frame) => extendRun(run, setupSample(frame)), []);
}

describe('setupSample', () => {
  it('accepts the top push-up position on the camera side', () => {
    expect(setupSample(frameAt(0))).toMatchObject({ side: 'right', tMs: 0 });
  });

  it.each([
    ['kneeling', { kneeDeg: 90 }],
    ['bent arms', { elbowDeg: 120 }],
    ['standing', { standing: true }],
    ['hidden limbs', { visibility: 0.3 }],
  ])('rejects %s', (_, posture) => {
    expect(setupSample(frameAt(0, posture))).toBeNull();
  });

  it('rejects frames without a pose', () => {
    expect(setupSample({ ...frameAt(0), pose: null })).toBeNull();
  });
});

describe('extendRun', () => {
  it('restarts on a missing sample', () => {
    const run = runOf(holdFrames(0, 500));
    expect(extendRun(run, null)).toEqual([]);
  });
});

describe('calibrateFromHold', () => {
  it('waits for a full second', () => {
    expect(calibrateFromHold(runOf(holdFrames(0, 900)))).toBeNull();
  });

  it('learns side, up, height and lockout angle from a steady hold', () => {
    const calibration = calibrateFromHold(runOf(holdFrames(0, 1100)));
    expect(calibration?.side).toBe('right');
    expect(calibration?.up.x).toBeCloseTo(0);
    expect(calibration?.up.y).toBeCloseTo(-1);
    expect(calibration?.setupHeight).toBeCloseTo(0.3);
    expect(calibration?.setupElbowDeg).toBeCloseTo(172);
  });

  it('rejects a wobbly hold', () => {
    const frames = holdFrames(0, 1100).map((frame, i) => (i % 2 ? frameAt(frame.tMs, { height: 0.8 }) : frame));
    expect(calibrateFromHold(runOf(frames))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/setup.test.ts`
Expected: FAIL on unresolved `src/core/setup`.

- [ ] **Step 3: Implement `src/core/setup.ts`**

```ts
import { angleDeg, dot, mean, meanPoint, sub, tiltDeg, unit } from './geometry';
import { type Frame, type Point, type Side, jointPoint, nearSide, sideVisibility } from './pose';
import { RULES } from './rules.config';

export interface Calibration {
  readonly side: Side;
  readonly up: Point;
  readonly setupHeight: number;
  readonly setupElbowDeg: number;
}

export interface SetupSample {
  readonly tMs: number;
  readonly side: Side;
  readonly arm: Point;
  readonly elbowDeg: number;
}

const IMAGE_UP: Point = { x: 0, y: -1 };

/** The frame as a top-position sample, or null if it isn't one. */
export function setupSample(frame: Frame): SetupSample | null {
  if (!frame.pose) return null;
  const side = nearSide(frame.pose);
  if (sideVisibility(frame.pose, side) < RULES.minVisibility) return null;
  const at = (joint: Parameters<typeof jointPoint>[1]) => jointPoint({ ...frame, pose: frame.pose! }, joint, side);
  const arm = sub(at('shoulder'), at('wrist'));
  const elbowDeg = angleDeg(at('shoulder'), at('elbow'), at('wrist'));
  const isTop =
    elbowDeg >= RULES.setupMinElbowDeg &&
    angleDeg(at('hip'), at('knee'), at('ankle')) >= RULES.minKneeDeg &&
    tiltDeg(at('shoulder'), at('ankle'), IMAGE_UP) <= RULES.maxBodyTiltDeg &&
    dot(arm, IMAGE_UP) > 0;
  return isTop ? { tMs: frame.tMs, side, arm, elbowDeg } : null;
}

/** Consecutive same-side samples; any other frame restarts the run. */
export function extendRun(run: readonly SetupSample[], sample: SetupSample | null): SetupSample[] {
  if (!sample) return [];
  if (run.length > 0 && run[0].side !== sample.side) return [sample];
  return [...run, sample].filter((s) => sample.tMs - s.tMs <= 2 * RULES.setupHoldMs);
}

/** Calibration once the run is a steady hold of at least `setupHoldMs`, else null. */
export function calibrateFromHold(run: readonly SetupSample[]): Calibration | null {
  const last = run.at(-1);
  if (!last || last.tMs - run[0].tMs < RULES.setupHoldMs) return null;
  const hold = run.filter((s) => last.tMs - s.tMs <= RULES.setupHoldMs);
  const up = unit(meanPoint(hold.map((s) => s.arm)));
  const heights = hold.map((s) => dot(s.arm, up));
  const setupHeight = mean(heights);
  if (Math.max(...heights) - Math.min(...heights) > RULES.setupMaxWobble * setupHeight) return null;
  return { side: last.side, up, setupHeight, setupElbowDeg: mean(hold.map((s) => s.elbowDeg)) };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/setup.test.ts && npm run typecheck`
Expected: 10 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/setup.ts tests/synthetic.ts tests/core/setup.test.ts
git commit -m "feat(core): detect a steady plank hold and calibrate side, up, height and lockout angle"
```

### Task 8: Per-frame features

**Implementer:** general

**Files:**
- Create: `src/core/features.ts`
- Test: `tests/core/features.test.ts`

**Interfaces:**
- Consumes: `Calibration` (Task 7), geometry (Task 6), `jointPoint` and `sideVisibility` (Task 2).
- Produces: `Features { tMs; inPosition; height; elbowDeg; hipOffsetPct; kneeDeg }`, `computeFeatures(frame, calibration): Features | null`.

- [ ] **Step 1: Write the failing test**

`tests/core/features.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../../src/core/features';
import type { Calibration } from '../../src/core/setup';
import { frameAt } from '../synthetic';

const CALIBRATION: Calibration = { side: 'right', up: { x: 0, y: -1 }, setupHeight: 0.3, setupElbowDeg: 172 };

describe('computeFeatures', () => {
  it('measures height relative to the setup hold', () => {
    expect(computeFeatures(frameAt(0), CALIBRATION)?.height).toBeCloseTo(1);
    expect(computeFeatures(frameAt(0, { height: 0.45 }), CALIBRATION)?.height).toBeCloseTo(0.45);
  });

  it('measures elbow and knee angles', () => {
    const features = computeFeatures(frameAt(0, { elbowDeg: 90, kneeDeg: 120 }), CALIBRATION);
    expect(features?.elbowDeg).toBeCloseTo(90);
    expect(features?.kneeDeg).toBeCloseTo(120);
  });

  it('signs the hip offset: positive for butt high, negative for sagging', () => {
    expect(computeFeatures(frameAt(0, { hipLift: 0.1 }), CALIBRATION)?.hipOffsetPct).toBeGreaterThan(8);
    expect(computeFeatures(frameAt(0, { hipLift: -0.1 }), CALIBRATION)?.hipOffsetPct).toBeLessThan(-8);
  });

  it('knows when the body is out of push-up position', () => {
    expect(computeFeatures(frameAt(0), CALIBRATION)?.inPosition).toBe(true);
    expect(computeFeatures(frameAt(0, { standing: true }), CALIBRATION)?.inPosition).toBe(false);
  });

  it('returns null when the camera-side limbs are hidden', () => {
    expect(computeFeatures(frameAt(0, { visibility: 0.3 }), CALIBRATION)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/features.test.ts`
Expected: FAIL on unresolved `src/core/features`.

- [ ] **Step 3: Implement `src/core/features.ts`**

```ts
import { angleDeg, dot, signedOffset, sub, tiltDeg } from './geometry';
import { type Frame, type Joint, jointPoint, sideVisibility } from './pose';
import { RULES } from './rules.config';
import type { Calibration } from './setup';

export interface Features {
  readonly tMs: number;
  readonly inPosition: boolean;
  /** Shoulder height above the wrist, as a fraction of the setup height. */
  readonly height: number;
  readonly elbowDeg: number;
  /** Hip distance from the shoulder→ankle line, % of its length; positive = hip above. */
  readonly hipOffsetPct: number;
  readonly kneeDeg: number;
}

/** Per-frame signals from the camera-side limbs, or null when they aren't visible. */
export function computeFeatures(frame: Frame, calibration: Calibration): Features | null {
  if (!frame.pose || sideVisibility(frame.pose, calibration.side) < RULES.minVisibility) return null;
  const at = (joint: Joint) => jointPoint({ ...frame, pose: frame.pose! }, joint, calibration.side);
  const shoulder = at('shoulder');
  const wrist = at('wrist');
  const hip = at('hip');
  const ankle = at('ankle');
  return {
    tMs: frame.tMs,
    inPosition: tiltDeg(shoulder, ankle, calibration.up) <= RULES.maxBodyTiltDeg,
    height: dot(sub(shoulder, wrist), calibration.up) / calibration.setupHeight,
    elbowDeg: angleDeg(shoulder, at('elbow'), wrist),
    hipOffsetPct: 100 * signedOffset(hip, shoulder, ankle, calibration.up),
    kneeDeg: angleDeg(hip, at('knee'), ankle),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/features.test.ts && npm run typecheck`
Expected: 5 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/features.ts tests/core/features.test.ts
git commit -m "feat(core): compute height, elbow, hip offset and knee signals per frame"
```

### Task 9: Rep counter

**Implementer:** general

**Files:**
- Create: `src/core/repCounter.ts`
- Test: `tests/core/repCounter.test.ts`

**Interfaces:**
- Consumes: `RULES` (`prominence`, `atTopTolerance`, `topLine`).
- Produces:
  - `Signals`, `Sample`, `RepAttempt { startMs; endMs; bottom; hipMaxPct; hipMinPct; kneeMinDeg; lockedOut }`
  - `CounterState`, `CounterStep`, `INITIAL_COUNTER`
  - `stepCounter(state, sample, lockoutElbowDeg): CounterStep`

- [ ] **Step 1: Write the failing test**

`tests/core/repCounter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { INITIAL_COUNTER, stepCounter, type RepAttempt, type Sample } from '../../src/core/repCounter';

const LOCKOUT = 160;

function attemptsFrom(samples: readonly Partial<Sample>[]): RepAttempt[] {
  let state = INITIAL_COUNTER;
  const attempts: RepAttempt[] = [];
  samples.forEach((partial, i) => {
    const sample = { tMs: i * 100, height: 1, elbowDeg: 170, hipOffsetPct: 0, kneeDeg: 178, ...partial };
    const step = stepCounter(state, sample, LOCKOUT);
    state = step.state;
    if (step.attempt) attempts.push(step.attempt);
  });
  return attempts;
}

const heights = (...hs: number[]) => hs.map((height) => ({ height, elbowDeg: height > 0.9 ? 170 : 100 }));

describe('stepCounter', () => {
  it('emits one locked-out attempt when a rep returns to the top', () => {
    const attempts = attemptsFrom(heights(1, 0.9, 0.7, 0.5, 0.45, 0.6, 0.8, 0.95));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ bottom: 0.45, lockedOut: true, startMs: 0, endMs: 700 });
  });

  it('ignores dips smaller than the prominence', () => {
    expect(attemptsFrom(heights(1, 0.95, 0.92, 0.97, 1))).toHaveLength(0);
  });

  it('closes an attempt without lockout when the user goes down again first', () => {
    const samples = [...heights(1, 0.7, 0.45, 0.7), { height: 0.95, elbowDeg: 140 }, ...heights(0.7, 0.45, 0.7, 0.95)];
    const attempts = attemptsFrom(samples);
    expect(attempts.map((a) => a.lockedOut)).toEqual([false, true]);
  });

  it('starts an attempt at the last moment at the top', () => {
    const attempts = attemptsFrom(heights(1, 1, 0.99, 0.98, 0.7, 0.45, 0.7, 0.95));
    expect(attempts[0].startMs).toBe(300);
  });

  it('tracks hip and knee extremes across the attempt', () => {
    const samples = [{ height: 1 }, { height: 0.7, hipOffsetPct: 3 }, { height: 0.45, hipOffsetPct: -4, kneeDeg: 120 }, { height: 0.95 }];
    expect(attemptsFrom(samples)[0]).toMatchObject({ hipMaxPct: 3, hipMinPct: -4, kneeMinDeg: 120 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/repCounter.test.ts`
Expected: FAIL on unresolved `src/core/repCounter`.

- [ ] **Step 3: Implement `src/core/repCounter.ts`**

```ts
import { RULES } from './rules.config';

export interface Signals {
  readonly height: number;
  readonly elbowDeg: number;
  readonly hipOffsetPct: number;
  readonly kneeDeg: number;
}

export type Sample = Signals & { readonly tMs: number };

export interface RepAttempt {
  readonly startMs: number;
  readonly endMs: number;
  readonly bottom: number;
  readonly hipMaxPct: number;
  readonly hipMinPct: number;
  readonly kneeMinDeg: number;
  readonly lockedOut: boolean;
}

type OpenAttempt = Omit<RepAttempt, 'endMs' | 'lockedOut'>;

export interface CounterState {
  readonly phase: 'top' | 'down' | 'up';
  readonly peak: number;
  readonly peakMs: number;
  readonly open: OpenAttempt | null;
}

export interface CounterStep {
  readonly state: CounterState;
  readonly attempt?: RepAttempt;
}

export const INITIAL_COUNTER: CounterState = { phase: 'top', peak: -Infinity, peakMs: 0, open: null };

export function stepCounter(state: CounterState, sample: Sample, lockoutElbowDeg: number): CounterStep {
  if (state.phase === 'top') return stepTop(state, sample);
  if (state.phase === 'down') return stepDown(state, sample, lockoutElbowDeg);
  return stepUp(state, sample, lockoutElbowDeg);
}

function stepTop(state: CounterState, s: Sample): CounterStep {
  if (s.height >= state.peak) return { state: { ...state, peak: s.height, peakMs: s.tMs } };
  if (s.height >= state.peak - RULES.atTopTolerance) return { state: { ...state, peakMs: s.tMs } };
  if (s.height > state.peak - RULES.prominence) return { state };
  return { state: { ...state, phase: 'down', open: openAttempt(state.peakMs, s) } };
}

function stepDown(state: CounterState, s: Sample, lockoutElbowDeg: number): CounterStep {
  const open = track(state.open!, s);
  if (s.height <= open.bottom + RULES.prominence) return { state: { ...state, open } };
  return stepUp({ phase: 'up', peak: s.height, peakMs: s.tMs, open }, s, lockoutElbowDeg);
}

function stepUp(state: CounterState, s: Sample, lockoutElbowDeg: number): CounterStep {
  const open = track(state.open!, s);
  if (s.height >= RULES.topLine && s.elbowDeg >= lockoutElbowDeg) {
    return { state: { phase: 'top', peak: s.height, peakMs: s.tMs, open: null }, attempt: close(open, s.tMs, true) };
  }
  if (s.height < state.peak - RULES.prominence) {
    return { state: { ...state, phase: 'down', open: openAttempt(state.peakMs, s) }, attempt: close(open, s.tMs, false) };
  }
  const risen = s.height > state.peak;
  return { state: { ...state, open, peak: risen ? s.height : state.peak, peakMs: risen ? s.tMs : state.peakMs } };
}

function openAttempt(startMs: number, s: Sample): OpenAttempt {
  return { startMs, bottom: s.height, hipMaxPct: s.hipOffsetPct, hipMinPct: s.hipOffsetPct, kneeMinDeg: s.kneeDeg };
}

function track(open: OpenAttempt, s: Sample): OpenAttempt {
  return {
    startMs: open.startMs,
    bottom: Math.min(open.bottom, s.height),
    hipMaxPct: Math.max(open.hipMaxPct, s.hipOffsetPct),
    hipMinPct: Math.min(open.hipMinPct, s.hipOffsetPct),
    kneeMinDeg: Math.min(open.kneeMinDeg, s.kneeDeg),
  };
}

function close(open: OpenAttempt, endMs: number, lockedOut: boolean): RepAttempt {
  return { ...open, endMs, lockedOut };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/repCounter.test.ts && npm run typecheck`
Expected: 5 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/repCounter.ts tests/core/repCounter.test.ts
git commit -m "feat(core): add hysteresis rep counter with elbow-based lockout"
```

### Task 10: Judge + thresholds

**Implementer:** general

**Files:**
- Create: `src/core/judge.ts`
- Test: `tests/core/judge.test.ts`

**Interfaces:**
- Consumes: `RepAttempt` (Task 9), `Calibration` (Task 7), `median` (Task 6).
- Produces:
  - `Reason`, `Thresholds { lockoutElbowDeg; depthLine: number | null; hipBaselinePct }`
  - `isValid(rep)`, `judge(attempt, thresholds): Reason[]`
  - `provisionalThresholds(calibration)`, `calibratedThresholds(provisional, reps)`, `isShallow(thresholds)`

- [ ] **Step 1: Write the failing test**

`tests/core/judge.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { calibratedThresholds, isShallow, isValid, judge, provisionalThresholds, type Thresholds } from '../../src/core/judge';
import type { RepAttempt } from '../../src/core/repCounter';

const GOOD: RepAttempt = { startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 1, hipMinPct: -1, kneeMinDeg: 175, lockedOut: true };
const THRESHOLDS: Thresholds = { lockoutElbowDeg: 160, depthLine: 0.57, hipBaselinePct: 0 };

describe('judge', () => {
  it('passes a good rep', () => {
    expect(judge(GOOD, THRESHOLDS)).toEqual([]);
    expect(isValid({ reasons: judge(GOOD, THRESHOLDS) })).toBe(true);
  });

  it.each([
    ['not_low_enough', { bottom: 0.7 }],
    ['no_lockout', { lockedOut: false }],
    ['butt_high', { hipMaxPct: 8 }],
    ['hips_sagging', { hipMinPct: -8 }],
    ['knees_down', { kneeMinDeg: 120 }],
  ])('flags %s', (reason, change) => {
    expect(judge({ ...GOOD, ...change }, THRESHOLDS)).toEqual([reason]);
  });

  it('skips depth until calibrated', () => {
    expect(judge({ ...GOOD, bottom: 0.9 }, { ...THRESHOLDS, depthLine: null })).toEqual([]);
  });

  it('judges hips relative to the calibrated baseline', () => {
    expect(judge({ ...GOOD, hipMaxPct: 8 }, { ...THRESHOLDS, hipBaselinePct: 4 })).toEqual([]);
  });
});

describe('thresholds', () => {
  const calibration = { side: 'right', up: { x: 0, y: -1 }, setupHeight: 0.3, setupElbowDeg: 170 } as const;

  it('starts from the setup hold', () => {
    expect(provisionalThresholds(calibration)).toEqual({ lockoutElbowDeg: 158, depthLine: null, hipBaselinePct: 0 });
  });

  it('sets the depth line and hip baseline from the calibration reps', () => {
    const reps = [0.4, 0.5, 0.45].map((bottom, i) => ({ ...GOOD, bottom, hipMaxPct: i, hipMinPct: i }));
    const thresholds = calibratedThresholds(provisionalThresholds(calibration), reps);
    expect(thresholds.depthLine).toBeCloseTo(0.57);
    expect(thresholds.hipBaselinePct).toBe(1);
    expect(isShallow(thresholds)).toBe(false);
  });

  it('calls calibration shallow when the median bottom is above 0.6', () => {
    expect(isShallow({ ...THRESHOLDS, depthLine: 0.75 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/judge.test.ts`
Expected: FAIL on unresolved `src/core/judge`.

- [ ] **Step 3: Implement `src/core/judge.ts`**

```ts
import { median } from './geometry';
import type { RepAttempt } from './repCounter';
import { RULES } from './rules.config';
import type { Calibration } from './setup';

export type Reason = 'knees_down' | 'not_low_enough' | 'no_lockout' | 'butt_high' | 'hips_sagging';

export interface Thresholds {
  readonly lockoutElbowDeg: number;
  /** Null until the calibration reps are done. */
  readonly depthLine: number | null;
  readonly hipBaselinePct: number;
}

type Check = readonly [Reason, (attempt: RepAttempt, thresholds: Thresholds) => boolean];

const CHECKS: readonly Check[] = [
  ['knees_down', (a) => a.kneeMinDeg < RULES.minKneeDeg],
  ['not_low_enough', (a, t) => t.depthLine !== null && a.bottom > t.depthLine],
  ['no_lockout', (a) => !a.lockedOut],
  ['butt_high', (a, t) => a.hipMaxPct - t.hipBaselinePct > RULES.hipTolerancePct],
  ['hips_sagging', (a, t) => t.hipBaselinePct - a.hipMinPct > RULES.hipTolerancePct],
];

export const isValid = (rep: { readonly reasons: readonly Reason[] }): boolean => rep.reasons.length === 0;

export function judge(attempt: RepAttempt, thresholds: Thresholds): Reason[] {
  return CHECKS.filter(([, fails]) => fails(attempt, thresholds)).map(([reason]) => reason);
}

export function provisionalThresholds(calibration: Calibration): Thresholds {
  return {
    lockoutElbowDeg: calibration.setupElbowDeg - RULES.lockoutElbowToleranceDeg,
    depthLine: null,
    hipBaselinePct: 0,
  };
}

export function calibratedThresholds(provisional: Thresholds, reps: readonly RepAttempt[]): Thresholds {
  return {
    ...provisional,
    depthLine: median(reps.map((r) => r.bottom)) + RULES.depthTolerance,
    hipBaselinePct: median(reps.map((r) => (r.hipMaxPct + r.hipMinPct) / 2)),
  };
}

export function isShallow(thresholds: Thresholds): boolean {
  return thresholds.depthLine !== null && thresholds.depthLine - RULES.depthTolerance > RULES.maxCalibrationBottom;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/judge.test.ts && npm run typecheck`
Expected: 11 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/judge.ts tests/core/judge.test.ts
git commit -m "feat(core): judge reps against calibrated depth, lockout, hip and knee rules"
```

### Task 11: Session reducer

**Implementer:** general

**Files:**
- Create: `src/core/session.ts`
- Test: `tests/helpers.ts` (test helper), `tests/core/session.test.ts`

**Interfaces:**
- Consumes: Tasks 6–10.
- Produces:
  - `RepResult`, `SessionEvent` (`ready | rep | calibrated | lost | timeLeft | done`), `SessionState`, `SessionStep`
  - `newSession(mode)`, `stepSession(state, frame): SessionStep`, `stopSession(state, tMs)`, `reachedNewBottom(previous, next)`
  - Test helper `runSession(frames, mode)` and `TimedEvent`

- [ ] **Step 1: Write the helper and the failing test**

`tests/helpers.ts`:
```ts
import type { Frame } from '../src/core/pose';
import type { Mode } from '../src/core/mode';
import { newSession, stepSession, type SessionEvent, type SessionState } from '../src/core/session';

export interface TimedEvent {
  readonly tMs: number;
  readonly event: SessionEvent;
}

export function runSession(frames: readonly Frame[], mode: Mode): { state: SessionState; events: TimedEvent[] } {
  let state = newSession(mode);
  const events: TimedEvent[] = [];
  for (const frame of frames) {
    const step = stepSession(state, frame);
    state = step.state;
    events.push(...step.events.map((event) => ({ tMs: frame.tMs, event })));
  }
  return { state, events };
}
```

`tests/core/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newSession, reachedNewBottom, stepSession, stopSession, type SessionEvent } from '../../src/core/session';
import { runSession, type TimedEvent } from '../helpers';
import { hidden, hold, rep, reps, sequence } from '../synthetic';

type RepEvent = Extract<SessionEvent, { type: 'rep' }>;
const types = (events: readonly TimedEvent[]) => events.map((e) => e.event.type);
const repEvents = (events: readonly TimedEvent[]) =>
  events.map((e) => e.event).filter((event): event is RepEvent => event.type === 'rep');

describe('session setup', () => {
  it('says ready after a steady one-second hold', () => {
    const { events } = runSession(sequence(hold(1200)), 'untimed');
    expect(types(events)).toEqual(['ready']);
    expect(events[0].tMs).toBeGreaterThanOrEqual(1000);
  });

  it('does not get ready while kneeling', () => {
    expect(runSession(sequence(hold(2000, { kneeDeg: 90 })), 'untimed').events).toEqual([]);
  });

  it('ignores reps before ready', () => {
    expect(runSession(sequence(reps(3), hold(1200), reps(2)), 'untimed').state.reps).toHaveLength(2);
  });
});

describe('session counting', () => {
  it('counts clean reps and calibrates after the third', () => {
    const { events } = runSession(sequence(hold(1200), reps(5)), 'untimed');
    expect(types(events)).toEqual(['ready', 'rep', 'rep', 'rep', 'calibrated', 'rep', 'rep']);
    expect(repEvents(events).map((e) => e.validCount)).toEqual([1, 2, 3, 4, 5]);
  });

  it('flags a half rep once calibrated', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ bottom: 0.75 }), rep()), 'untimed');
    expect(state.reps.map((r) => r.reasons)).toEqual([[], [], [], ['not_low_enough'], []]);
  });

  it.each([
    ['butt_high', { hipLift: 0.1 }],
    ['hips_sagging', { hipLift: -0.1 }],
    ['knees_down', { kneeDeg: 110 }],
  ] as const)('flags %s', (reason, shape) => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep(shape), rep()), 'untimed');
    expect(state.reps[3].reasons).toEqual([reason]);
  });

  it('flags a rep that goes down again without locking out', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ topElbowDeg: 140 }), rep({ topElbowDeg: 140 })), 'untimed');
    expect(state.reps.map((r) => r.reasons)).toEqual([[], [], [], ['no_lockout']]);
  });
});

describe('session timing', () => {
  const ippt = runSession(sequence(hold(1200), reps(70)), 'ippt60');

  it('starts the clock when the first rep begins', () => {
    expect(ippt.state.startMs).toBeGreaterThanOrEqual(1000);
    expect(ippt.state.startMs).toBeLessThan(ippt.state.reps[0].endMs);
  });

  it('ends at 60 s and ignores reps finishing later', () => {
    expect(ippt.events.at(-1)?.event).toMatchObject({ type: 'done', timeUp: true, validCount: 60 });
    expect(ippt.state.endMs! - ippt.state.startMs!).toBe(60_000);
    expect(ippt.state.reps.every((r) => r.endMs <= ippt.state.endMs!)).toBe(true);
  });

  it('announces 30 and 10 seconds left', () => {
    const warnings = ippt.events.filter((e) => e.event.type === 'timeLeft');
    expect(warnings.map((e) => e.event)).toEqual([{ type: 'timeLeft', seconds: 30 }, { type: 'timeLeft', seconds: 10 }]);
    expect(warnings[0].tMs - ippt.state.startMs!).toBeGreaterThanOrEqual(30_000);
  });

  it('ends an untimed set after 5 s resting on the knees', () => {
    const { state } = runSession(sequence(hold(1200), reps(2), hold(6000, { kneeDeg: 90 })), 'untimed');
    expect(state.phase).toBe('done');
  });

  it('ends an untimed set 5 s after leaving position', () => {
    const { state, events } = runSession(sequence(hold(1200), reps(2), hold(6000, { standing: true })), 'untimed');
    expect(state.phase).toBe('done');
    expect(events.at(-1)?.event).toEqual({ type: 'done', timeUp: false, validCount: 2, noCount: 0 });
  });
});

describe('session tracking', () => {
  it('says it cannot see you once after a second without a pose', () => {
    const { events } = runSession(sequence(hold(1200), hidden(2500), reps(1)), 'untimed');
    expect(types(events).filter((type) => type === 'lost')).toHaveLength(1);
  });

  it('drops a final knees-down attempt when the set ends', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ kneeDeg: 100 })), 'untimed');
    expect(state.reps).toHaveLength(4);
    expect(stopSession(state, 99_999).state.reps).toHaveLength(3);
  });
});

describe('reachedNewBottom', () => {
  it('fires only while the rep in progress is going lower', () => {
    let state = newSession('untimed');
    const flags = sequence(hold(1200), rep()).map((frame) => {
      const next = stepSession(state, frame).state;
      const flag = reachedNewBottom(state, next);
      state = next;
      return flag;
    });
    const holdFrames = 36;
    expect(flags.slice(0, holdFrames).some(Boolean)).toBe(false);
    expect(flags.slice(holdFrames).filter(Boolean).length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/session.test.ts`
Expected: FAIL on unresolved `src/core/session`.

- [ ] **Step 3: Implement `src/core/session.ts`**

```ts
import { computeFeatures, type Features } from './features';
import type { Mode } from './mode';
import { calibratedThresholds, isShallow, isValid, judge, provisionalThresholds, type Reason, type Thresholds } from './judge';
import type { Frame } from './pose';
import { INITIAL_COUNTER, stepCounter, type CounterState, type RepAttempt, type Signals } from './repCounter';
import { RULES } from './rules.config';
import { calibrateFromHold, extendRun, setupSample, type Calibration, type SetupSample } from './setup';
import { smooth, type Smoothed } from './smoothing';

export interface RepResult extends RepAttempt {
  readonly index: number;
  readonly reasons: readonly Reason[];
}

export type SessionEvent =
  | { readonly type: 'ready' }
  | { readonly type: 'rep'; readonly rep: RepResult; readonly validCount: number }
  | { readonly type: 'calibrated'; readonly shallow: boolean }
  | { readonly type: 'lost' }
  | { readonly type: 'timeLeft'; readonly seconds: number }
  | { readonly type: 'done'; readonly timeUp: boolean; readonly validCount: number; readonly noCount: number };

interface Tracking {
  readonly lastSeenMs: number;
  readonly lastPlankMs: number;
  readonly lostAnnounced: boolean;
}

export interface SessionState {
  readonly mode: Mode;
  readonly phase: 'setup' | 'active' | 'done';
  readonly run: readonly SetupSample[];
  readonly calibration: Calibration | null;
  readonly thresholds: Thresholds | null;
  readonly counter: CounterState;
  readonly smoothed: Smoothed<Signals> | null;
  readonly reps: readonly RepResult[];
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly warnings: number;
  readonly tracking: Tracking;
}

export interface SessionStep {
  readonly state: SessionState;
  readonly events: readonly SessionEvent[];
}

const NO_EVENTS: readonly SessionEvent[] = [];

export function newSession(mode: Mode): SessionState {
  return {
    mode,
    phase: 'setup',
    run: [],
    calibration: null,
    thresholds: null,
    counter: INITIAL_COUNTER,
    smoothed: null,
    reps: [],
    startMs: null,
    endMs: null,
    warnings: 0,
    tracking: { lastSeenMs: 0, lastPlankMs: 0, lostAnnounced: false },
  };
}

export function stepSession(state: SessionState, frame: Frame): SessionStep {
  if (state.phase === 'setup') return stepSetup(state, frame);
  if (state.phase === 'active') return stepActive(state, frame);
  return { state, events: NO_EVENTS };
}

/** True when this frame is the lowest point so far of the rep in progress. */
export function reachedNewBottom(previous: SessionState, next: SessionState): boolean {
  const bottom = next.counter.open?.bottom;
  const before = previous.counter.open?.bottom;
  return bottom !== undefined && (before === undefined || bottom < before);
}

export function stopSession(state: SessionState, tMs: number): SessionStep {
  return state.phase === 'done' ? { state, events: NO_EVENTS } : finish(state, tMs, false);
}

function stepSetup(state: SessionState, frame: Frame): SessionStep {
  const run = extendRun(state.run, setupSample(frame));
  const calibration = calibrateFromHold(run);
  if (!calibration) return { state: { ...state, run }, events: NO_EVENTS };
  return {
    state: {
      ...state,
      phase: 'active',
      run: [],
      calibration,
      thresholds: provisionalThresholds(calibration),
      tracking: { lastSeenMs: frame.tMs, lastPlankMs: frame.tMs, lostAnnounced: false },
    },
    events: [{ type: 'ready' }],
  };
}

function stepActive(state: SessionState, frame: Frame): SessionStep {
  if (isTimeUp(state, frame.tMs)) return finish(state, state.startMs! + RULES.ipptDurationMs, true);
  if (isIdle(state, frame.tMs)) return finish(state, frame.tMs, false);
  const warned = warnTime(state, frame.tMs);
  const features = computeFeatures(frame, state.calibration!);
  const next = features ? stepVisible(warned.state, features) : stepHidden(warned.state, frame.tMs);
  return { state: next.state, events: [...warned.events, ...next.events] };
}

function isTimeUp(state: SessionState, tMs: number): boolean {
  return state.mode === 'ippt60' && state.startMs !== null && tMs - state.startMs >= RULES.ipptDurationMs;
}

function isIdle(state: SessionState, tMs: number): boolean {
  return state.mode === 'untimed' && state.startMs !== null && tMs - state.tracking.lastPlankMs >= RULES.untimedEndAfterMs;
}

function warnTime(state: SessionState, tMs: number): SessionStep {
  if (state.mode !== 'ippt60' || state.startMs === null) return { state, events: NO_EVENTS };
  const remainingMs = RULES.ipptDurationMs - (tMs - state.startMs);
  const due = RULES.timeWarningsSecondsLeft.filter((s) => remainingMs <= s * 1000).length;
  if (due === state.warnings) return { state, events: NO_EVENTS };
  return { state: { ...state, warnings: due }, events: [{ type: 'timeLeft', seconds: RULES.timeWarningsSecondsLeft[due - 1] }] };
}

function stepHidden(state: SessionState, tMs: number): SessionStep {
  const { tracking } = state;
  if (tracking.lostAnnounced || tMs - tracking.lastSeenMs <= RULES.lostAfterMs) return { state, events: NO_EVENTS };
  return { state: { ...state, tracking: { ...tracking, lostAnnounced: true } }, events: [{ type: 'lost' }] };
}

function stepVisible(state: SessionState, features: Features): SessionStep {
  const { tMs, inPosition } = features;
  const lastPlankMs = isPlank(features) ? tMs : state.tracking.lastPlankMs;
  const seen = { ...state, tracking: { lastSeenMs: tMs, lastPlankMs, lostAnnounced: false } };
  return inPosition ? stepInPosition(seen, features) : { state: seen, events: NO_EVENTS };
}

/** In position with straight legs; kneeling still feeds the counter (to flag knees) but counts as resting. */
function isPlank(features: Features): boolean {
  return features.inPosition && features.kneeDeg >= RULES.minKneeDeg;
}

function stepInPosition(state: SessionState, features: Features): SessionStep {
  const { tMs, height, elbowDeg, hipOffsetPct, kneeDeg } = features;
  const smoothed = smooth(state.smoothed, { height, elbowDeg, hipOffsetPct, kneeDeg }, tMs);
  const step = stepCounter(state.counter, { tMs, ...smoothed.values }, state.thresholds!.lockoutElbowDeg);
  const next = { ...state, smoothed, counter: step.state };
  return step.attempt ? recordRep(next, step.attempt) : { state: next, events: NO_EVENTS };
}

function recordRep(state: SessionState, attempt: RepAttempt): SessionStep {
  const rep: RepResult = { ...attempt, index: state.reps.length + 1, reasons: judge(attempt, state.thresholds!) };
  const reps = [...state.reps, rep];
  const next = { ...state, reps, startMs: state.startMs ?? attempt.startMs };
  const repEvent: SessionEvent = { type: 'rep', rep, validCount: reps.filter(isValid).length };
  if (reps.length !== RULES.calibrationReps) return { state: next, events: [repEvent] };
  const thresholds = calibratedThresholds(next.thresholds!, reps);
  return { state: { ...next, thresholds }, events: [repEvent, { type: 'calibrated', shallow: isShallow(thresholds) }] };
}

function finish(state: SessionState, endMs: number, timeUp: boolean): SessionStep {
  const reps = withoutGettingUp(state.reps);
  const validCount = reps.filter(isValid).length;
  return {
    state: { ...state, phase: 'done', endMs, reps },
    events: [{ type: 'done', timeUp, validCount, noCount: reps.length - validCount }],
  };
}

/** A final no-count with knees down is the user getting up, not a rep. */
function withoutGettingUp(reps: readonly RepResult[]): readonly RepResult[] {
  return reps.at(-1)?.reasons.includes('knees_down') ? reps.slice(0, -1) : reps;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/session.test.ts && npm run typecheck`
Expected: 17 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/session.ts tests/helpers.ts tests/core/session.test.ts
git commit -m "feat(core): add session reducer with setup, calibration, timer, tracking and auto-end"
```

### Task 12: Speech + summary

**Implementer:** general

**Files:**
- Create: `src/core/speech.ts`, `src/core/summary.ts`
- Test: `tests/core/speech.test.ts`, `tests/core/summary.test.ts`

**Interfaces:**
- Consumes: `SessionEvent`, `SessionState`, `RepResult` (Task 11); `isValid` and `Reason` (Task 10).
- Produces: `speechFor(event): string`, `Summary { valid; noCount; byReason; durationMs }`, `summarize(state): Summary`.

- [ ] **Step 1: Write the failing tests**

`tests/core/speech.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { RepResult, SessionEvent } from '../../src/core/session';
import { speechFor } from '../../src/core/speech';

const rep = (reasons: RepResult['reasons']): RepResult => ({
  index: 1, reasons, startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 0, hipMinPct: 0, kneeMinDeg: 175, lockedOut: true,
});

describe('speechFor', () => {
  it.each<[SessionEvent, string]>([
    [{ type: 'ready' }, 'Ready'],
    [{ type: 'rep', rep: rep([]), validCount: 12 }, '12'],
    [{ type: 'rep', rep: rep(['not_low_enough']), validCount: 12 }, 'No count, lower'],
    [{ type: 'rep', rep: rep(['knees_down', 'butt_high']), validCount: 3 }, 'No count, knees'],
    [{ type: 'calibrated', shallow: false }, 'Calibrated'],
    [{ type: 'calibrated', shallow: true }, 'Calibration too shallow. Restart and go lower'],
    [{ type: 'lost' }, "Can't see you"],
    [{ type: 'timeLeft', seconds: 10 }, '10 seconds'],
    [{ type: 'done', timeUp: true, validCount: 42, noCount: 5 }, 'Time. 42, 5 no counts'],
    [{ type: 'done', timeUp: false, validCount: 20, noCount: 0 }, 'Done. 20, 0 no counts'],
    [{ type: 'done', timeUp: false, validCount: 24, noCount: 1 }, 'Done. 24, 1 no count'],
  ])('%j → %s', (event, text) => {
    expect(speechFor(event)).toBe(text);
  });
});
```

`tests/core/summary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newSession, type RepResult } from '../../src/core/session';
import { summarize } from '../../src/core/summary';

const rep = (index: number, reasons: RepResult['reasons']): RepResult => ({
  index, reasons, startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 0, hipMinPct: 0, kneeMinDeg: 175, lockedOut: true,
});

describe('summarize', () => {
  it('totals valid reps, no-counts by reason, and duration', () => {
    const state = {
      ...newSession('ippt60'),
      startMs: 1000,
      endMs: 61_000,
      reps: [rep(1, []), rep(2, ['not_low_enough']), rep(3, ['not_low_enough', 'butt_high']), rep(4, [])],
    };
    expect(summarize(state)).toEqual({ valid: 2, noCount: 2, byReason: { not_low_enough: 2, butt_high: 1 }, durationMs: 60_000 });
  });

  it('has zero duration before the first rep', () => {
    expect(summarize(newSession('untimed')).durationMs).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/core/speech.test.ts tests/core/summary.test.ts`
Expected: FAIL on unresolved `src/core/speech` and `src/core/summary`.

- [ ] **Step 3: Implement**

`src/core/speech.ts`:
```ts
import { isValid, type Reason } from './judge';
import type { SessionEvent } from './session';

const REASON_WORDS: Record<Reason, string> = {
  not_low_enough: 'lower',
  no_lockout: 'lock arms',
  butt_high: 'butt high',
  hips_sagging: 'hips sagging',
  knees_down: 'knees',
};

export function speechFor(event: SessionEvent): string {
  switch (event.type) {
    case 'ready':
      return 'Ready';
    case 'rep':
      return isValid(event.rep) ? String(event.validCount) : `No count, ${REASON_WORDS[event.rep.reasons[0]]}`;
    case 'calibrated':
      return event.shallow ? 'Calibration too shallow. Restart and go lower' : 'Calibrated';
    case 'lost':
      return "Can't see you";
    case 'timeLeft':
      return `${event.seconds} seconds`;
    case 'done':
      return `${event.timeUp ? 'Time' : 'Done'}. ${event.validCount}, ${event.noCount} no count${event.noCount === 1 ? '' : 's'}`;
  }
}
```

`src/core/summary.ts`:
```ts
import { isValid, type Reason } from './judge';
import type { SessionState } from './session';

export interface Summary {
  readonly valid: number;
  readonly noCount: number;
  readonly byReason: Readonly<Partial<Record<Reason, number>>>;
  readonly durationMs: number;
}

export function summarize(state: SessionState): Summary {
  const valid = state.reps.filter(isValid).length;
  const byReason: Partial<Record<Reason, number>> = {};
  for (const reason of state.reps.flatMap((rep) => rep.reasons)) byReason[reason] = (byReason[reason] ?? 0) + 1;
  const durationMs = state.startMs === null || state.endMs === null ? 0 : state.endMs - state.startMs;
  return { valid, noCount: state.reps.length - valid, byReason, durationMs };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/speech.test.ts tests/core/summary.test.ts && npm run typecheck`
Expected: 13 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/speech.ts src/core/summary.ts tests/core/speech.test.ts tests/core/summary.test.ts
git commit -m "feat(core): add voice lines and session summary"
```

### Task 13: Golden fixtures from IMG_8568

**Implementer:** general

**Files:**
- Create: `tools/extract_landmarks.py`, `tests/fixtures/img8568.lite.json.gz`, `tests/fixtures/img8568.full.json.gz`, `tests/golden.test.ts`
- Modify: `tests/helpers.ts` (replace entirely; adds `loadFixture`)

**Interfaces:**
- Consumes: `test-assets/img8568.mp4` (Task 3), `public/mediapipe/*.task` (Task 1; run `npm run assets` if missing), `runSession`.
- Produces: `loadFixture(name, everyNthFrame?)` and two committed fixtures (~230 KB each).

- [ ] **Step 1: Add the extractor and generate fixtures**

`tools/extract_landmarks.py`:
```python
"""Extract MediaPipe pose landmarks from a video into a gzipped JSON test fixture.

Usage:
  uv run --python 3.12 --with mediapipe==0.10.21 --with opencv-python-headless \
    python tools/extract_landmarks.py <clip.mp4> <model.task> <out.json.gz>
"""
import gzip
import json
import sys

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision


def compact(result):
    if not result.pose_landmarks:
        return None
    return [[round(p.x, 4), round(p.y, 4), round(p.visibility, 3)] for p in result.pose_landmarks[0]]


def main(video: str, model: str, out: str) -> None:
    options = vision.PoseLandmarkerOptions(
        base_options=mpp.BaseOptions(model_asset_path=model),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )
    landmarker = vision.PoseLandmarker.create_from_options(options)
    capture = cv2.VideoCapture(video)
    fps = capture.get(cv2.CAP_PROP_FPS)
    aspect = capture.get(cv2.CAP_PROP_FRAME_WIDTH) / capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
    frames = []
    while True:
        ok, bgr = capture.read()
        if not ok:
            break
        t_ms = round(len(frames) * 1000 / fps)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        frames.append({"tMs": t_ms, "pose": compact(landmarker.detect_for_video(image, t_ms))})
    with gzip.open(out, "wt") as f:
        json.dump({"model": model.split("/")[-1], "aspect": aspect, "frames": frames}, f, separators=(",", ":"))
    print(f"{out}: {len(frames)} frames, {sum(f['pose'] is not None for f in frames)} with pose")


if __name__ == "__main__":
    main(*sys.argv[1:4])
```

Run:
```bash
mkdir -p tests/fixtures
for m in lite full; do
  uv run --python 3.12 --with mediapipe==0.10.21 --with opencv-python-headless \
    python tools/extract_landmarks.py test-assets/img8568.mp4 public/mediapipe/pose_landmarker_$m.task tests/fixtures/img8568.$m.json.gz
done
```
Expected (MediaPipe log noise aside):
```
tests/fixtures/img8568.lite.json.gz: 1336 frames, 1182 with pose
tests/fixtures/img8568.full.json.gz: 1336 frames, 1210 with pose
```

- [ ] **Step 2: Extend the helper and write the golden test**

`tests/helpers.ts` (replace entirely):
```ts
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Frame } from '../src/core/pose';
import type { Mode } from '../src/core/mode';
import { newSession, stepSession, type SessionEvent, type SessionState } from '../src/core/session';

type CompactPose = readonly (readonly [number, number, number])[];
interface CompactFixture {
  readonly aspect: number;
  readonly frames: readonly { readonly tMs: number; readonly pose: CompactPose | null }[];
}

export function loadFixture(name: string, everyNthFrame = 1): Frame[] {
  const buffer = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  const text = name.endsWith('.gz') ? gunzipSync(buffer).toString() : buffer.toString();
  const { aspect, frames } = JSON.parse(text) as CompactFixture;
  return frames
    .filter((_, i) => i % everyNthFrame === 0)
    .map(({ tMs, pose }) => ({ tMs, aspect, pose: pose && pose.map(([x, y, visibility]) => ({ x, y, visibility })) }));
}

export interface TimedEvent {
  readonly tMs: number;
  readonly event: SessionEvent;
}

export function runSession(frames: readonly Frame[], mode: Mode): { state: SessionState; events: TimedEvent[] } {
  let state = newSession(mode);
  const events: TimedEvent[] = [];
  for (const frame of frames) {
    const step = stepSession(state, frame);
    state = step.state;
    events.push(...step.events.map((event) => ({ tMs: frame.tMs, event })));
  }
  return { state, events };
}
```

`tests/golden.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { stopSession } from '../src/core/session';
import { loadFixture, runSession } from './helpers';

const SHALLOW_REP = 10;

describe.each([
  ['img8568.lite.json.gz', 1],
  ['img8568.lite.json.gz', 2],
  ['img8568.full.json.gz', 1],
  ['img8568.full.json.gz', 2],
])('IMG_8568 golden run (%s, every %i frames)', (fixture, everyNth) => {
  const frames = loadFixture(fixture, everyNth);
  const untimed = runSession(frames, 'untimed');
  const { state } = stopSession(untimed.state, frames.at(-1)!.tMs);

  it('gets ready once in plank, around 0:09', () => {
    const readyMs = untimed.events.find((e) => e.event.type === 'ready')?.tMs ?? 0;
    expect(readyMs).toBeGreaterThan(8_000);
    expect(readyMs).toBeLessThan(10_000);
  });

  it('counts all 25 reps', () => {
    expect(state.reps).toHaveLength(25);
  });

  it('finds no faults except, possibly, the shallow rep at 0:21', () => {
    const faults = state.reps.filter((r) => r.reasons.length > 0);
    for (const fault of faults) expect(fault).toMatchObject({ index: SHALLOW_REP, reasons: ['not_low_enough'] });
  });

  it('starts the IPPT clock as the first rep begins, and warns at 30 s left', () => {
    const ippt = runSession(frames, 'ippt60');
    expect(ippt.state.startMs).toBeGreaterThan(12_000);
    expect(ippt.state.startMs).toBeLessThan(13_300);
    expect(ippt.events.filter((e) => e.event.type === 'timeLeft')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: 16 golden tests pass, 106 total (22 from M0 + 84 from M1); `tsc` clean.

If a golden test fails, don't loosen the assertions. Print the reps to see which rule misfired:
```ts
console.table(state.reps.map(({ index, bottom, hipMaxPct, hipMinPct, kneeMinDeg, lockedOut, reasons }) => ({ index, bottom, hipMaxPct, hipMinPct, kneeMinDeg, lockedOut, reasons: reasons.join('+') })));
```
Run it with `npx vitest run tests/golden.test.ts --disableConsoleIntercept`, then fix the logic.

- [ ] **Step 4: Commit and open the M1 PR**

```bash
git add tools/extract_landmarks.py tests/fixtures tests/helpers.ts tests/golden.test.ts
git commit -m "test: add golden fixtures from IMG_8568 (lite and full, 30 and 15 fps)"
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m1-core
gh pr create --draft --base main --head m1-core --title "M1: rep counting and form rules (pure core)" --body "Pure core: setup, features, rep counter, judge, session, speech, summary. Golden runs on IMG_8568: 25/25 reps, no false no-counts."
gh pr checks --watch
```
Expected: CI passes. Merge after the user approves (`gh pr ready && gh pr merge --squash --delete-branch`).

---

## M2 — Live session

Start on a fresh branch: `git checkout main && git pull && git checkout -b m2-live`.

### Task 14: Live controller, history store, live text

**Implementer:** general

**Files:**
- Create: `src/io/wakeLock.ts`, `src/app/finishedSession.ts`, `src/app/bottomSnapshots.ts`, `src/app/liveSession.ts`, `src/app/liveText.ts`, `src/store/history.ts`, `src/app/sessionFrames.ts`, `src/app/finishSession.ts`, `src/app/liveScreen.ts`
- Test: `tests/app/liveText.test.ts`, `tests/store/history.test.ts`

**Interfaces:**
- Consumes: M0 io/pose/app modules, M1 core.
- Produces:
  - `keepScreenOn()`
  - `FinishedSession { state; frames }`, `createBottomSnapshots(video)`
  - `SessionView { render(state, pose, tMs); announce(events) }`, `LiveSession { done; stop() }`, `runLiveSession(mode, video, estimator, voice, view)`
  - `timerText(state, tMs)`, `statusText(state)`
  - `SavedSession`, `SessionMeta`, `toSavedSession`, `loadSessions`, `saveSession`
  - `rememberFrames`, `framesFor`, `finishSession(finished, meta, deps)`
  - `LiveScreenView extends SessionView { video; showError(message); onStop(handler) }`, `startLiveScreen(mode, view, deps): () => void`

- [ ] **Step 1: Write the failing tests**

`tests/app/liveText.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { statusText, timerText } from '../../src/app/liveText';
import { newSession } from '../../src/core/session';

describe('timerText', () => {
  it('counts down from 1:00 in IPPT mode', () => {
    expect(timerText(newSession('ippt60'), 5_000)).toBe('1:00');
    expect(timerText({ ...newSession('ippt60'), startMs: 1_000 }, 18_500)).toBe('0:43');
  });

  it('counts up in untimed mode and freezes when done', () => {
    expect(timerText({ ...newSession('untimed'), startMs: 1_000 }, 66_000)).toBe('1:05');
    expect(timerText({ ...newSession('untimed'), startMs: 1_000, endMs: 31_000 }, 99_000)).toBe('0:30');
  });
});

describe('statusText', () => {
  it('guides setup, says ready, then stays quiet during the set', () => {
    const active = { ...newSession('ippt60'), phase: 'active' as const };
    expect(statusText(newSession('ippt60'))).toBe('Get into a plank, side-on to the camera');
    expect(statusText(active)).toBe('Ready. Start when you like');
    expect(statusText({ ...active, startMs: 0 })).toBe('');
    expect(statusText({ ...active, tracking: { ...active.tracking, lostAnnounced: true } })).toBe("Can't see you. Check the camera");
  });
});
```

`tests/store/history.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newSession } from '../../src/core/session';
import { loadSessions, saveSession, toSavedSession } from '../../src/store/history';
import { memoryStorage } from '../memoryStorage';

const saved = (iso: string) =>
  toSavedSession({ ...newSession('ippt60'), startMs: 0, endMs: 60_000 }, { startedAt: new Date(iso), source: 'camera', model: 'lite' });

describe('history', () => {
  it('starts empty', () => {
    expect(loadSessions(memoryStorage())).toEqual([]);
  });

  it('keeps sessions newest first', () => {
    const storage = memoryStorage();
    saveSession(saved('2026-09-26T09:00:00Z'), storage);
    saveSession(saved('2026-09-27T09:00:00Z'), storage);
    expect(loadSessions(storage).map((s) => s.startedAt)).toEqual(['2026-09-27T09:00:00.000Z', '2026-09-26T09:00:00.000Z']);
  });

  it('stores the summary with the session', () => {
    const storage = memoryStorage();
    saveSession(saved('2026-09-26T09:00:00Z'), storage);
    expect(loadSessions(storage)[0]).toMatchObject({ mode: 'ippt60', source: 'camera', summary: { valid: 0, durationMs: 60_000 } });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/app/liveText.test.ts tests/store/history.test.ts`
Expected: FAIL on unresolved `src/app/liveText` and `src/store/history`.

- [ ] **Step 3: Implement**

`src/io/wakeLock.ts`:
```ts
/** Keeps the screen on where supported; resolves to a release function. */
export async function keepScreenOn(): Promise<() => void> {
  const lock = await navigator.wakeLock?.request('screen').catch(() => null);
  return () => void lock?.release();
}
```

`src/app/finishedSession.ts`:
```ts
import type { SessionState } from '../core/session';

export interface FinishedSession {
  readonly state: SessionState;
  readonly frames: ReadonlyMap<number, string>;
}
```

`src/app/bottomSnapshots.ts` (keeps the lowest frame of the rep in progress; attaches it to no-count reps):
```ts
import { isValid } from '../core/judge';
import { reachedNewBottom, type SessionState, type SessionStep } from '../core/session';

const WIDTH = 320;

export interface BottomSnapshots {
  /** No-count rep index → JPEG data URL of its lowest frame. Memory only. */
  readonly frames: ReadonlyMap<number, string>;
  observe(previous: SessionState, step: SessionStep): void;
}

export function createBottomSnapshots(video: HTMLVideoElement): BottomSnapshots {
  const canvas = document.createElement('canvas');
  const frames = new Map<number, string>();
  const capture = () => {
    canvas.width = WIDTH;
    canvas.height = Math.round((WIDTH * video.videoHeight) / video.videoWidth);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  };
  return {
    frames,
    observe(previous, step) {
      for (const event of step.events) {
        if (event.type === 'rep' && !isValid(event.rep)) frames.set(event.rep.index, canvas.toDataURL('image/jpeg', 0.7));
      }
      if (reachedNewBottom(previous, step.state)) capture();
    },
  };
}
```

`src/app/liveSession.ts` (events from one frame are spoken as one line, so "3" isn't cut off by "Calibrated"):
```ts
import type { Pose } from '../core/pose';
import type { Mode } from '../core/mode';
import { newSession, stepSession, stopSession, type SessionEvent, type SessionState, type SessionStep } from '../core/session';
import { speechFor } from '../core/speech';
import { eachVideoFrame } from '../io/videoFrames';
import type { Voice } from '../io/voice';
import type { PoseEstimator } from '../pose/poseEstimator';
import { createBottomSnapshots } from './bottomSnapshots';
import type { FinishedSession } from './finishedSession';

export interface SessionView {
  render(state: SessionState, pose: Pose | null, tMs: number): void;
  announce(events: readonly SessionEvent[]): void;
}

export interface LiveSession {
  readonly done: Promise<FinishedSession>;
  stop(): void;
}

export function runLiveSession(mode: Mode, video: HTMLVideoElement, estimator: PoseEstimator, voice: Voice, view: SessionView): LiveSession {
  let state = newSession(mode);
  let finish: (session: FinishedSession) => void = () => {};
  const done = new Promise<FinishedSession>((resolve) => (finish = resolve));
  const snapshots = createBottomSnapshots(video);
  const apply = (step: SessionStep, pose: Pose | null, tMs: number) => {
    snapshots.observe(state, step);
    state = step.state;
    if (step.events.length > 0) voice.say(step.events.map(speechFor).join('. '));
    view.announce(step.events);
    view.render(state, pose, tMs);
    if (state.phase !== 'done') return;
    stopFrames();
    finish({ state, frames: snapshots.frames });
  };
  const stopFrames = eachVideoFrame(video, (tMs) => {
    const pose = estimator.detect(video, tMs);
    apply(stepSession(state, { tMs, pose, aspect: video.videoWidth / video.videoHeight }), pose, tMs);
  });
  const stop = () => {
    const tMs = performance.now();
    apply(stopSession(state, tMs), null, tMs);
  };
  return { done, stop };
}
```

`src/app/liveText.ts`:
```ts
import { RULES } from '../core/rules.config';
import type { SessionState } from '../core/session';

const clock = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** IPPT: time left. Untimed: time elapsed. */
export function timerText(state: SessionState, tMs: number): string {
  const elapsedMs = state.startMs === null ? 0 : (state.endMs ?? tMs) - state.startMs;
  return clock(state.mode === 'ippt60' ? RULES.ipptDurationMs - elapsedMs : elapsedMs);
}

export function statusText(state: SessionState): string {
  if (state.phase === 'setup') return 'Get into a plank, side-on to the camera';
  if (state.phase === 'done') return 'Done';
  if (state.tracking.lostAnnounced) return "Can't see you. Check the camera";
  return state.startMs === null ? 'Ready. Start when you like' : '';
}
```

`src/store/history.ts`:
```ts
import type { Thresholds } from '../core/judge';
import type { Mode } from '../core/mode';
import type { RepResult, SessionState } from '../core/session';
import { summarize, type Summary } from '../core/summary';
import type { ModelVariant } from '../pose/poseEstimator';

export interface SavedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly mode: Mode;
  readonly source: 'camera' | 'upload';
  readonly model: ModelVariant;
  readonly summary: Summary;
  readonly thresholds: Thresholds | null;
  readonly reps: readonly RepResult[];
}

export interface SessionMeta {
  readonly startedAt: Date;
  readonly source: SavedSession['source'];
  readonly model: ModelVariant;
}

const KEY = 'ippt-pushups.sessions.v1';
const MAX_SESSIONS = 200;

export function toSavedSession(state: SessionState, meta: SessionMeta): SavedSession {
  return {
    id: meta.startedAt.toISOString(),
    startedAt: meta.startedAt.toISOString(),
    mode: state.mode,
    source: meta.source,
    model: meta.model,
    summary: summarize(state),
    thresholds: state.thresholds,
    reps: state.reps,
  };
}

/** Newest first. */
export function loadSessions(storage: Pick<Storage, 'getItem'>): SavedSession[] {
  return JSON.parse(storage.getItem(KEY) ?? '[]') as SavedSession[];
}

export function saveSession(session: SavedSession, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const others = loadSessions(storage).filter((s) => s.id !== session.id);
  storage.setItem(KEY, JSON.stringify([session, ...others].slice(0, MAX_SESSIONS)));
}
```

`src/app/sessionFrames.ts`:
```ts
const framesBySession = new Map<string, ReadonlyMap<number, string>>();

/** No-count snapshots live in memory only; they are gone after a reload. */
export function rememberFrames(sessionId: string, frames: ReadonlyMap<number, string>): void {
  framesBySession.set(sessionId, frames);
}

export function framesFor(sessionId: string): ReadonlyMap<number, string> {
  return framesBySession.get(sessionId) ?? new Map();
}
```

`src/app/finishSession.ts`:
```ts
import { saveSession, toSavedSession, type SessionMeta } from '../store/history';
import type { AppDeps } from './deps';
import type { FinishedSession } from './finishedSession';
import { routeHash } from './routes';
import { rememberFrames } from './sessionFrames';

/** Saves a session with reps and shows its summary; an empty session just goes home. */
export function finishSession({ state, frames }: FinishedSession, meta: SessionMeta, deps: Pick<AppDeps, 'storage' | 'navigate'>): void {
  if (state.reps.length === 0) return deps.navigate(routeHash({ name: 'home' }));
  const saved = toSavedSession(state, meta);
  saveSession(saved, deps.storage);
  rememberFrames(saved.id, frames);
  deps.navigate(routeHash({ name: 'summary', id: saved.id }));
}
```

`src/app/liveScreen.ts`:
```ts
import type { Mode } from '../core/mode';
import { startCamera } from '../io/camera';
import { keepScreenOn } from '../io/wakeLock';
import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { finishSession } from './finishSession';
import { runLiveSession, type LiveSession, type SessionView } from './liveSession';

export interface LiveScreenView extends SessionView {
  readonly video: HTMLVideoElement;
  showError(message: string): void;
  onStop(handler: () => void): void;
}

/** Runs one live set on the view; returns a cleanup that stops it (the set is still saved). */
export function startLiveScreen(mode: Mode, view: LiveScreenView, deps: AppDeps): () => void {
  let left = false;
  const guarded = { ...deps, navigate: (hash: string) => left || deps.navigate(hash) };
  const started = begin(mode, view, guarded).catch((error: unknown) => {
    view.showError(error instanceof Error ? error.message : String(error));
    return null;
  });
  const stop = () => void started.then((live) => live?.stop());
  view.onStop(stop);
  return () => {
    left = true;
    stop();
  };
}

async function begin(mode: Mode, view: LiveScreenView, deps: AppDeps): Promise<LiveSession> {
  const startedAt = new Date();
  const estimator = await getEstimator(deps.settings);
  const stopCamera = await startCamera(view.video);
  const releaseScreen = await keepScreenOn();
  const live = runLiveSession(mode, view.video, estimator, deps.voice, view);
  const stopWhenHidden = () => document.hidden && live.stop();
  document.addEventListener('visibilitychange', stopWhenHidden);
  void live.done.then((finished) => {
    document.removeEventListener('visibilitychange', stopWhenHidden);
    stopCamera();
    releaseScreen();
    finishSession(finished, { startedAt, source: 'camera', model: deps.settings.model }, deps);
  });
  return live;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test && npm run typecheck`
Expected: 112 tests pass; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/io/wakeLock.ts src/app/finishedSession.ts src/app/bottomSnapshots.ts src/app/liveSession.ts src/app/liveText.ts src/store src/app/sessionFrames.ts src/app/finishSession.ts src/app/liveScreen.ts tests/app/liveText.test.ts tests/store
git commit -m "feat: add live session controller, snapshots, history store and live text"
```

### Task 15: Home start buttons, live + summary screens, full-set checkpoint

**Implementer:** slides-ui-dev. Controllers exist; build the views to this contract. The user joins at the checkpoint.

**Files:**
- Modify: `src/app/screens.ts` (replace entirely, verbatim below), `src/ui/home.ts`, `src/ui/styles.css`
- Create: `src/ui/live.ts`, `src/ui/summary.ts`, `e2e/live.spec.ts` (verbatim below)

**Interfaces:**
- Consumes:
  - `LiveScreenView` (`src/app/liveScreen.ts`), `SavedSession` (`src/store/history.ts`), `Mode`
  - `timerText` and `statusText` (`src/app/liveText.ts`), `speechFor` (`src/core/speech.ts`), `isValid` (`src/core/judge.ts`)
  - `createFpsMeter` (`src/app/fpsMeter.ts`), `drawSkeleton` (`src/ui/skeleton.ts`)
- Produces (contract):
  - `renderHome(root: HTMLElement, actions: { startIppt(): void; startUntimed(): void }): void`. Two big buttons, `data-testid="start-ippt"` ("IPPT 1-min test") and `data-testid="start-untimed"` ("Free training"), plus a short tip ("Phone landscape on the floor, side-on, whole body in frame. Your first 3 reps set the depth line, so make them your best.") and the existing `debug-link`.
  - `renderLive(root: HTMLElement, mode: Mode): LiveScreenView`:
    - `video` with the skeleton canvas overlaid.
    - Until the first `render` call, `data-testid="status"` reads "Loading the pose model…".
    - `render(state, pose, tMs)` updates:
      - `data-testid="count"`: valid reps, number only
      - `data-testid="no-count"`: number only
      - `data-testid="timer"`: `timerText(state, tMs)`
      - `data-testid="status"`: `statusText(state)`, or "Low frame rate. Switch to the lite model in Debug" when `createFpsMeter` reads below 12 more than 3 s after the screen opened
      - the skeleton via `drawSkeleton`
    - `announce(events)` shows the latest rep event's `speechFor` text in `data-testid="verdict"`, green if valid and red if not.
    - `showError(message)` shows the message with a Retry button that reloads.
    - `onStop(handler)` binds `data-testid="stop"`.
    - Layout: the count dominates. It must stay readable in landscape with the phone on the floor.
  - `renderSummary(root: HTMLElement, session: SavedSession | undefined, frames: ReadonlyMap<number, string>): void`:
    - Container `data-testid="summary"`, holding `data-testid="valid-total"` and `data-testid="nocount-total"` (numbers only).
    - A no-count breakdown by reason with human labels (knees_down "Knees down", not_low_enough "Not low enough", no_lockout "Arms not locked", butt_high "Butt high", hips_sagging "Hips sagging"), plus the duration.
    - One `data-testid="rep-chip"` button per rep, with `data-valid="true|false"`, showing the rep number.
    - Tapping a chip shows `data-testid="rep-detail"`: reason labels (or "Good rep"), plus `<img>` from `frames.get(index)` when present, else "Frame not kept after reload".
    - A Home button. `session === undefined` renders "Session not found" with a Home link.

- [ ] **Step 1: Write the failing E2E test**

`e2e/live.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { recordSpeech, spokenLines } from './speech';

test('live free-training set is counted aloud and summarised', async ({ page }) => {
  await recordSpeech(page);
  await page.goto('?delegate=CPU#/');
  await page.getByTestId('start-untimed').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('rep-chip')).toHaveCount(25);
  const spoken = await spokenLines(page);
  expect(spoken).toContain('Ready');
  expect(spoken).toContain('3. Calibrated');
  expect(spoken.at(-1)).toMatch(/^Done\. \d+, \d+ no counts?$/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e -- e2e/live.spec.ts`
Expected: FAIL (no `start-untimed` button).

- [ ] **Step 3: Replace the wiring (verbatim)**

`src/app/screens.ts`:
```ts
import type { Mode } from '../core/mode';
import { loadSessions } from '../store/history';
import { renderDebug } from '../ui/debug';
import { renderHome } from '../ui/home';
import { renderLive } from '../ui/live';
import { renderSummary } from '../ui/summary';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import { startLiveScreen } from './liveScreen';
import { routeHash, type Route } from './routes';
import { framesFor } from './sessionFrames';

const START_LINE = 'Get into position, side-on to the camera';
const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  switch (route.name) {
    case 'live':
      return startLiveScreen(route.mode, renderLive(root, route.mode), deps);
    case 'summary':
      renderSummary(root, loadSessions(deps.storage).find((s) => s.id === route.id), framesFor(route.id));
      return NO_CLEANUP;
    case 'debug':
      return startDebugScreen(renderDebug(root), deps);
    case 'history':
    case 'home':
      return showHome(root, deps);
  }
}

function showHome(root: HTMLElement, deps: AppDeps): () => void {
  const start = (mode: Mode) => {
    deps.voice.say(START_LINE);
    deps.navigate(routeHash({ name: 'live', mode }));
  };
  renderHome(root, { startIppt: () => start('ippt60'), startUntimed: () => start('untimed') });
  return NO_CLEANUP;
}
```

- [ ] **Step 4: Build the views**

Update `src/ui/home.ts`, and implement `src/ui/live.ts`, `src/ui/summary.ts` and the styles to the contract and the UI rules in Global Constraints. Review them with Playwright screenshots at 844×390 and 390×844: the live screen mid-set (fake camera, about 20 s after Start) and the summary after the set, with a no-count chip tapped.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: `tsc` clean, 112 unit tests pass, and `2 passed`: debug, plus live (25 rep chips; spoken lines include "Ready" and "3. Calibrated" and end with "Done. …").

- [ ] **Step 6: Commit, PR, deploy**

```bash
git add src/app/screens.ts src/ui e2e/live.spec.ts
git commit -m "feat: add live counting and summary screens"
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m2-live
gh pr create --draft --base main --head m2-live --title "M2: live counting with voice and summary" --body "Live session: plank hold → Ready → auto-start on rep 1, voice counts/no-counts, summary with no-count frames. E2E live spec: 25/25 on IMG_8568 via fake camera."
gh pr checks --watch
```
Merge after the user approves (`gh pr ready && gh pr merge --squash --delete-branch`), then wait for the Deploy run.

- [ ] **Step 7: CHECKPOINT: a full set on the phone**

Ask the user to open https://daviddl9.github.io/ippt-pushups/ on the iPhone and do one IPPT 1-min test. Ask them to report:
- whether the counts matched what they did
- whether any no-count was wrong
- whether the voice stayed in time
- whether the screen stayed on

Log the findings in the PR description. Real miscounts become input for Task 18.

---

## M3 — History

Branch: `git checkout main && git pull && git checkout -b m3-history`.

### Task 16: History screen

**Implementer:** slides-ui-dev

**Files:**
- Modify: `src/app/screens.ts` (replace entirely, verbatim below), `src/ui/home.ts`, `src/ui/summary.ts`, `src/ui/styles.css`
- Create: `src/ui/history.ts`, `e2e/history.spec.ts` (verbatim below)

**Interfaces:**
- Consumes: `SavedSession` (`src/store/history.ts`).
- Produces (contract):
  - `renderHistory(root: HTMLElement, sessions: readonly SavedSession[]): void`:
    - Sessions arrive newest first. Each is one `data-testid="history-item"` link to `#/summary/<encodeURIComponent(id)>`, showing the local date/time, the mode ("IPPT 1-min" / "Free"), valid reps and no-counts.
    - Above the list, a small inline-SVG trend line of valid reps across IPPT sessions, oldest to newest. It's hidden when there are fewer than 2.
    - The empty state is "No sessions yet" with a Home link.
  - Home gains `data-testid="history-link"` to `#/history`; Summary gains a History button.

- [ ] **Step 1: Write the failing E2E test**

`e2e/history.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

const session = (startedAt: string, valid: number) => ({
  id: startedAt,
  startedAt,
  mode: 'ippt60',
  source: 'camera',
  model: 'lite',
  summary: { valid, noCount: 1, byReason: { not_low_enough: 1 }, durationMs: 60_000 },
  thresholds: null,
  reps: [],
});

test('history lists saved sessions newest first and opens their summary', async ({ page }) => {
  const sessions = [session('2026-09-27T09:00:00.000Z', 42), session('2026-09-26T09:00:00.000Z', 38)];
  await page.addInitScript((saved) => localStorage.setItem('ippt-pushups.sessions.v1', JSON.stringify(saved)), sessions);
  await page.goto('#/history');
  await expect(page.getByTestId('history-item')).toHaveCount(2);
  await page.getByTestId('history-item').first().click();
  await expect(page.getByTestId('valid-total')).toHaveText('42');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e -- e2e/history.spec.ts`
Expected: FAIL (no `history-item`).

- [ ] **Step 3: Replace the wiring (verbatim)**

`src/app/screens.ts`:
```ts
import type { Mode } from '../core/mode';
import { loadSessions } from '../store/history';
import { renderDebug } from '../ui/debug';
import { renderHistory } from '../ui/history';
import { renderHome } from '../ui/home';
import { renderLive } from '../ui/live';
import { renderSummary } from '../ui/summary';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import { startLiveScreen } from './liveScreen';
import { routeHash, type Route } from './routes';
import { framesFor } from './sessionFrames';

const START_LINE = 'Get into position, side-on to the camera';
const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  switch (route.name) {
    case 'live':
      return startLiveScreen(route.mode, renderLive(root, route.mode), deps);
    case 'summary':
      renderSummary(root, loadSessions(deps.storage).find((s) => s.id === route.id), framesFor(route.id));
      return NO_CLEANUP;
    case 'debug':
      return startDebugScreen(renderDebug(root), deps);
    case 'history':
      renderHistory(root, loadSessions(deps.storage));
      return NO_CLEANUP;
    case 'home':
      return showHome(root, deps);
  }
}

function showHome(root: HTMLElement, deps: AppDeps): () => void {
  const start = (mode: Mode) => {
    deps.voice.say(START_LINE);
    deps.navigate(routeHash({ name: 'live', mode }));
  };
  renderHome(root, { startIppt: () => start('ippt60'), startUntimed: () => start('untimed') });
  return NO_CLEANUP;
}
```

- [ ] **Step 4: Build the view and links**

Implement `src/ui/history.ts`, and add the Home and Summary links, following the UI rules.

- [ ] **Step 5: Verify, commit, PR**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: `tsc` clean, 112 unit tests pass, `3 passed`.

```bash
git add src/app/screens.ts src/ui e2e/history.spec.ts
git commit -m "feat: add session history with valid-rep trend"
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m3-history
gh pr create --draft --base main --head m3-history --title "M3: session history" --body "History list (newest first) with IPPT valid-rep trend; sessions open their summary. E2E history spec passes."
gh pr checks --watch
```
Merge after the user approves.

---

## M4 — Upload

Branch: `git checkout main && git pull && git checkout -b m4-upload`.

### Task 17: Upload mode

**Implementer:** slides-ui-dev. The controller code is provided verbatim; the UI part is the home upload control.

**Files:**
- Create: `src/app/uploadSession.ts`, `src/app/uploadFlow.ts` (both verbatim below), `e2e/upload.spec.ts` (verbatim below)
- Modify: `src/app/screens.ts` (replace entirely, verbatim below), `src/ui/home.ts`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `getEstimator`, `finishSession`, `createBottomSnapshots`, `seekFrames`, the session reducer.
- Produces:
  - `analyzeVideo(file, video, estimator, onProgress): Promise<FinishedSession>`
  - `analyzeUpload(file, deps, onProgress): Promise<void>`
  - Contract: `renderHome(root, actions: { startIppt(): void; startUntimed(): void; upload(file: File): void }): { showProgress(fraction: number): void; showError(message: string): void }`. The home adds:
    - an "Analyse a video" control wrapping `<input type="file" accept="video/*" data-testid="upload-input">`
    - `data-testid="upload-progress"`: a percentage while analysing, the error text on failure
    - the start buttons disabled while analysing

- [ ] **Step 1: Write the failing E2E test**

`e2e/upload.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('uploaded clip is analysed into a summary', async ({ page }) => {
  await page.goto('?delegate=CPU#/');
  await page.getByTestId('upload-input').setInputFiles('test-assets/img8568.webm');
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('rep-chip')).toHaveCount(25);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run e2e -- e2e/upload.spec.ts`
Expected: FAIL (no `upload-input`).

- [ ] **Step 3: Add the controllers and wiring (verbatim)**

`src/app/uploadSession.ts`:
```ts
import { newSession, stepSession, stopSession } from '../core/session';
import { seekFrames } from '../io/videoFrames';
import type { PoseEstimator } from '../pose/poseEstimator';
import { createBottomSnapshots } from './bottomSnapshots';
import type { FinishedSession } from './finishedSession';

const UPLOAD_FPS = 15;

/** Runs a video file through the same pipeline as the camera, voice off. Analyses the first set. */
export async function analyzeVideo(file: File, video: HTMLVideoElement, estimator: PoseEstimator, onProgress: (fraction: number) => void): Promise<FinishedSession> {
  video.src = URL.createObjectURL(file);
  await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  const snapshots = createBottomSnapshots(video);
  let state = newSession('untimed');
  let lastMs = 0;
  for await (const tMs of seekFrames(video, UPLOAD_FPS)) {
    const step = stepSession(state, { tMs, pose: estimator.detect(video, tMs), aspect: video.videoWidth / video.videoHeight });
    snapshots.observe(state, step);
    state = step.state;
    lastMs = tMs;
    onProgress(tMs / 1000 / video.duration);
    if (state.phase === 'done') break;
  }
  URL.revokeObjectURL(video.src);
  return { state: stopSession(state, lastMs).state, frames: snapshots.frames };
}
```

`src/app/uploadFlow.ts`:
```ts
import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { finishSession } from './finishSession';
import { analyzeVideo } from './uploadSession';

/** Analyses a picked video in a hidden <video> (Safari only decodes attached elements) and opens its summary. */
export async function analyzeUpload(file: File, deps: AppDeps, onProgress: (fraction: number) => void): Promise<void> {
  const startedAt = new Date();
  const estimator = await getEstimator(deps.settings);
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true });
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(video);
  try {
    const finished = await analyzeVideo(file, video, estimator, onProgress);
    finishSession(finished, { startedAt, source: 'upload', model: deps.settings.model }, deps);
  } finally {
    video.remove();
  }
}
```

`src/app/screens.ts`:
```ts
import type { Mode } from '../core/mode';
import { loadSessions } from '../store/history';
import { renderDebug } from '../ui/debug';
import { renderHistory } from '../ui/history';
import { renderHome } from '../ui/home';
import { renderLive } from '../ui/live';
import { renderSummary } from '../ui/summary';
import { startDebugScreen } from './debugScreen';
import type { AppDeps } from './deps';
import { startLiveScreen } from './liveScreen';
import { routeHash, type Route } from './routes';
import { framesFor } from './sessionFrames';
import { analyzeUpload } from './uploadFlow';

const START_LINE = 'Get into position, side-on to the camera';
const NO_CLEANUP = () => {};

/** Renders the screen for a route into root; returns its cleanup. */
export function showScreen(route: Route, root: HTMLElement, deps: AppDeps): () => void {
  switch (route.name) {
    case 'live':
      return startLiveScreen(route.mode, renderLive(root, route.mode), deps);
    case 'summary':
      renderSummary(root, loadSessions(deps.storage).find((s) => s.id === route.id), framesFor(route.id));
      return NO_CLEANUP;
    case 'debug':
      return startDebugScreen(renderDebug(root), deps);
    case 'history':
      renderHistory(root, loadSessions(deps.storage));
      return NO_CLEANUP;
    case 'home':
      return showHome(root, deps);
  }
}

function showHome(root: HTMLElement, deps: AppDeps): () => void {
  const start = (mode: Mode) => {
    deps.voice.say(START_LINE);
    deps.navigate(routeHash({ name: 'live', mode }));
  };
  const view = renderHome(root, {
    startIppt: () => start('ippt60'),
    startUntimed: () => start('untimed'),
    upload: (file) =>
      void analyzeUpload(file, deps, view.showProgress).catch((error: unknown) =>
        view.showError(error instanceof Error ? error.message : String(error)),
      ),
  });
  return NO_CLEANUP;
}
```

- [ ] **Step 4: Build the upload control**

Update `src/ui/home.ts` and the styles to the contract.

- [ ] **Step 5: Verify, commit, PR**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: `tsc` clean, 112 unit tests pass, `4 passed`. The upload spec takes about 45 s: 25 rep chips.

```bash
git add src/app/uploadSession.ts src/app/uploadFlow.ts src/app/screens.ts src/ui e2e/upload.spec.ts
git commit -m "feat: analyse uploaded videos with the same pipeline"
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m4-upload
gh pr create --draft --base main --head m4-upload --title "M4: upload analysis" --body "Pick a video → same pipeline at 15 fps (seek-based, deterministic) → summary. E2E upload spec: 25/25 on IMG_8568."
gh pr checks --watch
```
Merge after the user approves. Ask the user to try uploading `IMG_8568.MOV` on the iPhone. It's HEVC, which Safari decodes natively. If Safari analyses 0 frames, `seeked` isn't presenting frames. Fix it in `seekFrames` by awaiting `video.requestVideoFrameCallback` after each `seeked` event, and re-run the upload spec.

---

## M5 — Tune on a labelled clip, camera guide, final deploy

Branch: `git checkout main && git pull && git checkout -b m5-tune`.

### Task 18: Labelled clip, threshold tuning, camera guide, final deploy

**Implementer:** general + user

**Files:**
- Create: `tests/labelled.test.ts`, `tests/fixtures/labelled.lite.json.gz`, `tests/fixtures/labelled.full.json.gz`, `docs/superpowers/m5-tuning.md`
- Modify: `src/core/rules.config.ts` (values only), `README.md`

- [ ] **Step 1: User records the labelled clip**

Ask the user to record with the iPhone Camera app. Setup: phone landscape at floor level, about 2 m away, side-on, whole body in frame. Script:
1. Hold a plank for 2 s.
2. 3 good reps (your best: chest a fist from the floor).
3. 2 half reps (stop halfway down).
4. 2 reps with the butt high.
5. 2 reps with the hips sagging.
6. 2 reps without straightening the arms at the top (go straight into the next rep), then 1 good rep.
7. 2 reps letting the knees touch the floor at the bottom.
8. 2 good reps, then stand up.

Have them AirDrop it to `~/Downloads/labelled.MOV`.

- [ ] **Step 2: Prepare assets and extract fixtures**

```bash
tools/prepare_clip.sh ~/Downloads/labelled.MOV labelled
for m in lite full; do
  uv run --python 3.12 --with mediapipe==0.10.21 --with opencv-python-headless \
    python tools/extract_landmarks.py test-assets/labelled.mp4 public/mediapipe/pose_landmarker_$m.task tests/fixtures/labelled.$m.json.gz
done
```
Expected: two `…: N frames, M with pose` lines, with M/N ≥ 0.85.

- [ ] **Step 3: Write the labelled test**

`tests/labelled.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Reason } from '../src/core/judge';
import { stopSession } from '../src/core/session';
import { loadFixture, runSession } from './helpers';

/** The recording script from Task 18, one entry per rep. */
const SCRIPT: readonly (Reason | 'good')[] = [
  'good', 'good', 'good',
  'not_low_enough', 'not_low_enough',
  'butt_high', 'butt_high',
  'hips_sagging', 'hips_sagging',
  'no_lockout', 'no_lockout', 'good',
  'knees_down', 'knees_down',
  'good', 'good',
];

describe.each(['labelled.lite.json.gz', 'labelled.full.json.gz'])('labelled clip (%s)', (fixture) => {
  const frames = loadFixture(fixture);
  const { state } = stopSession(runSession(frames, 'untimed').state, frames.at(-1)!.tMs);

  it('finds one attempt per scripted rep', () => {
    expect(state.reps).toHaveLength(SCRIPT.length);
  });

  it.each(SCRIPT.map((expected, i) => [i + 1, expected] as const))('rep %i is %s', (index, expected) => {
    const reasons = state.reps[index - 1]?.reasons ?? [];
    if (expected === 'good') expect(reasons).toEqual([]);
    else expect(reasons).toContain(expected);
  });
});
```

Run: `npx vitest run tests/labelled.test.ts`
Expected: some failures. This is the tuning input.

- [ ] **Step 4: Tune**

Print the metrics with the `console.table` snippet from Task 13 (run with `--disableConsoleIntercept`). For each misjudged rep, adjust **only** the matching constant in `src/core/rules.config.ts`:

| Misjudged | Constant |
|---|---|
| Half rep passes / good rep flagged "lower" | `depthTolerance` |
| Butt high or sag missed / false | `hipTolerancePct` |
| No-lockout missed / false | `lockoutElbowToleranceDeg` |
| Knees missed / false | `minKneeDeg` |
| Reps missing or doubled | `prominence` |

After each change run `npm test`. Golden (IMG_8568) and labelled tests must pass together. If no single value satisfies both, stop and show the user the conflicting reps' metrics; don't special-case.

Record every change in `docs/superpowers/m5-tuning.md`:

```markdown
# M5 threshold tuning

| Constant | Before | After | Evidence (rep, metric) |
|---|---|---|---|
```

- [ ] **Step 5: Add the camera guide to the README**

Insert this section after the first paragraph of `README.md`:

```markdown
## Camera setup

- Phone in landscape on the floor (or a low step), about 2 m away, side-on. A 45° front angle also works.
- Whole body in frame, hands to feet, in a bright room with nothing between you and the phone.
- Tap Start, get into a plank and hold still until you hear "Ready". Your first 3 reps set the depth line, so make them your best.
```

- [ ] **Step 6: Verify everything, commit, PR, deploy**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: all green.

```bash
git add tests/labelled.test.ts tests/fixtures/labelled.lite.json.gz tests/fixtures/labelled.full.json.gz src/core/rules.config.ts README.md docs/superpowers/m5-tuning.md
git commit -m "test: tune thresholds on a labelled fault clip; add camera guide"
export GH_TOKEN=$(gh auth token --user daviddl9)
git push -u origin m5-tune
gh pr create --draft --base main --head m5-tune --title "M5: tune thresholds on labelled clip" --body "Labelled clip (16 scripted reps incl. every fault) + golden clip both pass. Tuning log in docs/superpowers/m5-tuning.md."
gh pr checks --watch
```
Merge after the user approves.

- [ ] **Step 7: CHECKPOINT: on-device acceptance**

Ask the user to confirm on the iPhone (deployed build):
- at least 15 fps with the default model
- voice counts in time, with the screen on for a full IPPT 1-min test
- the faults they deliberately make are called
- the session shows in History after a reload
- upload of a phone video works

Record the answers in the PR. Done when all pass.
