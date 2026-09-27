# IPPT Push-up Coach — Design

**Status:** approved design, 2026-09-26, revised after prototyping · **Owner:** daviddl9

## Goal

A phone web app that watches a push-up set through the camera, counts valid reps out loud, and calls out no-counts with a correction cue, like an IPPT tester. It also analyses uploaded videos and keeps a history of sessions.

**Done when:** on an iPhone 13 Pro (iOS 26 Safari) it runs at ≥15 fps, counts a full 60 s set correctly, and flags the deliberate faults in a labelled test clip.

## IPPT rules → checks

| IPPT rule ([MINDEF](https://www.mindef.gov.sg/news-and-events/latest-releases/2015feb27-news-releases-00009/)) | Check | Voice |
|---|---|---|
| Chest down to a fist's distance from the ground | bottom height ≤ depth line | "No count, go lower" |
| Arms straight at top (ELISS is strict) | elbow angle at top ≥ setup-hold angle − 12° | "No count, straighten arms" |
| Body straight | hip offset within ±5% of baseline | "No count, straighten back" |
| No resting on knees | knee angle ≥ 150° | "No count, knees up" |

A phone camera can't measure "a fist" in absolute terms, so depth is judged against your own calibration reps. Lockout uses the elbow angle rather than height, because height can't tell a bent top from a straight one. With the upper arm and forearm the same length, a 150° elbow still gives 97% of full height.

## Approach

MediaPipe Pose Landmarker runs on the phone, feeding a small rule engine written in TypeScript. It's a static site on GitHub Pages; no server is involved.

Rejected options:
- **Server-side pose:** adds network lag and a server to run, with no accuracy gain.
- **Vision-LLM API:** it samples about 1 frame per second, which misses reps at a 0.8 s cadence. It also costs money and can't give live feedback.

**Evidence** from prototyping on `IMG_8568.MOV` (45 s, iPhone, floor level, ~45° front-oblique angle):

| Finding | Value |
|---|---|
| Pose found | lite 88%, full 91%, heavy 95% of frames |
| Camera-side limb visibility | 0.98 (far side 0.56, unusable) |
| Reps counted | 25/25: lite and full models, at 30 and 15 fps, offline and in the browser |
| Form faults | none on body line (−3.2% to +2.3%), knees (≥169°) or lockout. Rep 10 (0:21) is 0.05–0.15 shallower than calibration depending on the model, so it's flagged on some runs |
| Headless Chromium | MediaPipe 1.0.1 runs. A fake camera at 26–30 fps (CPU delegate) counts 25/25 live; upload analysis takes 40 s |

## Architecture

```
 Camera ──┐                                                                ┌─► Voice
          ├─► PoseEstimator ─► features ─► repCounter ─► judge ─► session ─┼─► Live UI (count, timer, skeleton)
 Video ───┘   (MediaPipe,      (per frame)  (state machine)                 └─► Summary ─► History (localStorage)
 file         one instance)    └──────────── src/core/ (pure TS, no DOM) ───┘
```

| Unit | Purpose | Interface |
|---|---|---|
| `io/videoFrames` | Camera frames via `requestVideoFrameCallback`, or a file sampled at 15 fps by seeking (deterministic) | `eachVideoFrame`, `seekFrames` |
| `pose/poseEstimator` | One reused MediaPipe instance (lite or full) | `detect(source, tMs) → Pose \| null` |
| `core/setup` | Steady top hold → calibration (side, up, height, elbow) | `setupSample`, `calibrateFromHold` |
| `core/features` | Per-frame signals from the camera-side limbs | `computeFeatures(frame, calibration)` |
| `core/repCounter` | Hysteresis state machine | `stepCounter(state, sample, lockoutElbowDeg)` |
| `core/judge` | Rules and thresholds | `judge(attempt, thresholds) → Reason[]` |
| `core/session` | Phases, timer, tally, events | `stepSession(state, frame) → {state, events}` |
| `app/liveSession`, `app/uploadSession` | Wire frames → session → voice/view | `runLiveSession`, `analyzeVideo` |
| `store/history` | Persists sessions | `saveSession`, `loadSessions` |

## Signals and rules

Per frame, using the camera-side shoulder, elbow, wrist, hip, knee and ankle:

- **height** = (shoulder − wrist) · up ÷ setup height. It is about 0.95 at a rep's top and 0.35–0.55 at the bottom.
- **elbowDeg**, **kneeDeg**: joint angles.
- **hipOffsetPct**: signed distance of the hip from the shoulder→ankle line, as a % of that line's length. Positive means the hip is above the line.
- **inPosition**: body within 40° of level and joint visibility ≥ 0.5. **Plank** means in position with knees at 150° or more.

All four signals are smoothed with a time-based EMA (τ = 50 ms), so results don't depend on fps.

```
 TOP ──drops 0.12──► DOWN ──rises 0.12 above min──► UP ──height ≥ 0.85 and elbow ≥ lockout──► judge + speak ──► TOP
                                                     └─ drops 0.12 before that ──► attempt with no_lockout ──► DOWN
```

**Calibration**

1. **Setup:** hold a plank with straight arms (elbow ≥ 150°) and legs for 1 s. The voice then says "Ready". This picks the camera-facing side, sets "up" as the mean wrist→shoulder direction, records the setup height, and sets the lockout angle to the mean elbow angle − 12°.
2. **Auto-start, no countdown:** the set starts when the first rep is done. That rep counts as "one", and the 60 s timer is backdated to when it began.
3. **Reps 1–3:** the depth line is set to their median bottom + 0.12, and the hip baseline to their median hip offset. The voice says "Calibrated". Reps 1–3 count and are judged on every rule except depth.
4. **Sanity check:** if the calibration bottom is above 0.60, the voice says "Calibration too shallow. Restart and go lower".

All constants live in `src/core/rules.config.ts` and are tuned in M5.

## Session flow and UI

```
 Home ─tap Start─► Live: "Get into position" ─► plank 1 s: "Ready" ─► rep 1 done: timer runs ─► Summary ─► History
       (unlocks voice)                                                  (60 s, or untimed)            (auto-saved)
```

- **Live:** big count, timer, status, last verdict, and a skeleton overlay. The voice counts good reps ("12") and calls no-counts with a correction cue ("No count, go lower"), plus "Ready", "Calibrated", 30 s, 10 s and the final tally. Lines from the same frame are joined. A **Flip camera** button switches between front and back cameras; the choice is remembered, and flipping restarts the screen in place (no page reload, so iOS speech stays unlocked).
- **Summary:** valid / no-count totals by reason. Each rep is a chip; tapping one shows its **bottom and top photos** (kept in memory only) and the verdict. The top photo is the most extended frame, taken until the next rep starts, or at most 400 ms after the rep is judged while still in a plank, so resting or getting up never replaces it. For camera sessions, a **Redo** button starts the next set in the same mode straight away.
- **History:** a list of sessions plus a valid-reps trend.
- **Untimed mode** ends with a Stop tap, or after 5 s without a plank (standing, kneeling or out of view).
- **Upload:** pick a video; it runs through the same pipeline at 15 fps with voice off and analyses the first set.
- **Debug** (`#/debug`): camera, skeleton, fps, model load time, model/delegate/camera choice, and a voice test.

**Data**

```ts
type Reason = 'knees_down' | 'not_low_enough' | 'no_lockout' | 'butt_high' | 'hips_sagging';
interface Calibration { side: 'left' | 'right'; up: Point; setupHeight: number; setupElbowDeg: number }
interface Thresholds { lockoutElbowDeg: number; depthLine: number | null; hipBaselinePct: number }
interface RepResult { index: number; startMs: number; endMs: number; bottom: number; hipMaxPct: number;
  hipMinPct: number; kneeMinDeg: number; lockedOut: boolean; reasons: Reason[] }
interface SavedSession { id: string; startedAt: string; mode: 'ippt60' | 'untimed'; source: 'camera' | 'upload';
  model: 'lite' | 'full'; summary: Summary; thresholds: Thresholds | null; reps: RepResult[] }
```

## Edge cases

| Case | Behaviour |
|---|---|
| Tracking lost for > 1 s | Say "Can't see you" once |
| Resting at the top | Allowed; the timer keeps running |
| Kneeling or getting up | Still fed to the counter, so a knee touch gets "No count, knees up". A final knees-down no-count is dropped when the set ends, because it's you getting up |
| Reps before "Ready" | Ignored |
| Rep finishing after "Time" | Not counted (same as IPPT) |
| fps < 12 | Live screen shows a warning suggesting the lite model |
| Speech falls behind | Cancel the current line and speak the latest |
| Tab hidden | Stop and save the partial session |
| Camera denied or model fails to load | Error message with retry; model files are self-hosted |

## Testing

- **Unit (vitest):** every `core/` module. Session tests use a synthetic side-on pose builder to cover clean reps, half reps, butt high, sagging, knees, no lockout, the 60 s timer, lost tracking and auto-end.
- **Golden fixtures:** landmarks from `IMG_8568.MOV` (Python MediaPipe 0.10.21, lite and full), run at 30 and 15 fps. Expect "Ready" at 8–10 s, 25 reps, no faults except possibly rep 10 `not_low_enough`, and the IPPT clock starting at 12–13.3 s. The video itself is never committed.
- **E2E (Playwright, CPU delegate):**
  - **Upload:** the clip as VP9 WebM, because Playwright's Chromium lacks H.264/HEVC. Expect 25 rep chips.
  - **Live:** the clip as a fake MJPEG camera. Expect "Ready", spoken counts including "3. Calibrated", an auto-end, 25 chips, and two photos per rep.
  - **Debug:** expect fps above 10.
- **Labelled clip** (recorded by you, side-on): 3 good reps, then 2 each of half rep, butt high, hips sagging, no lockout and knees, then 2 more good reps. It becomes golden fixture #2 and is used to tune the thresholds.
- **On device:** fps ≥ 15, voice audible with the camera on, screen stays awake, full 60 s set.

## Build order

| # | Milestone | Exit criterion |
|---|---|---|
| M0 | Scaffold, pose + camera, debug screen, deployed to Pages | You report fps, load time and voice on your iPhone (go/no-go, pick the default model) |
| M1 | `core/` with TDD + golden fixtures | All unit + golden tests pass |
| M2 | Live session: controller, home + live screens | Live E2E passes; a full set works on your phone |
| M3 | Summary + history | Sessions persist across reloads |
| M4 | Upload mode | Upload E2E shows 25 |
| M5 | Tune on the labelled clip, README camera guide, final deploy | Labelled faults flagged correctly |

## Risks

| Risk | Mitigation |
|---|---|
| iPhone fps unmeasured (no published data) | M0 first. Fallbacks: lite model, lower camera resolution |
| MediaPipe GPU delegate gives wrong results on iOS ([#6142](https://github.com/google-ai-edge/mediapipe/issues/6142), segmenter) | Visual check in M0; fall back to the CPU delegate |
| Slow first model load on iOS ([#5171](https://github.com/google-ai-edge/mediapipe/issues/5171)) | Measure in M0; show progress; self-host the model |
| Lite-model depth noise (±0.05) flips borderline reps | Depth tolerance 0.12; tune on the labelled clip; choose the full model if the phone is fast enough |
| Shallow calibration reps make the depth line lenient | Sanity check + "make your first 3 your best" prompt |
