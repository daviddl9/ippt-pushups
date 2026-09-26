# IPPT Push-up Coach — Design

**Status:** approved design, 2026-09-26 · **Owner:** daviddl9

## Goal

A phone web app that watches a push-up set through the camera, counts valid reps out loud, and calls out no-counts with a reason, like an IPPT tester. It also analyses uploaded videos and keeps a history of sessions.

**Done when:** on an iPhone 13 Pro (iOS 26 Safari) it runs at ≥15 fps, counts a full 60 s set correctly by voice, and flags the deliberate faults in a labelled test clip.

## IPPT rules → checks

| IPPT rule ([MINDEF](https://www.mindef.gov.sg/news-and-events/latest-releases/2015feb27-news-releases-00009/)) | Check | Voice |
|---|---|---|
| Chest down to a fist's distance from the ground | bottom height ≤ depth line | "No count, lower" |
| Arms straight at top (ELISS is strict) | top height ≥ lockout line | "No count, lock arms" |
| Body straight | hip offset within ±5% of baseline | "No count, butt high" / "No count, hips sagging" |
| No resting on knees | knee angle ≥ 150° | "No count, knees" |

A phone camera can't measure "a fist" in absolute terms. Depth is judged relative to the user's own calibration reps.

## Approach

MediaPipe Pose Landmarker runs on the phone, feeding a small rule engine written in TypeScript. It's a static site on GitHub Pages; no server is involved.

Rejected options:
- **Server-side pose:** adds network lag and a server to run, with no accuracy gain.
- **Vision-LLM API:** it samples about 1 frame per second, which misses reps at a 0.8 s cadence. It also costs money and can't give live feedback.

**Evidence** from `IMG_8568.MOV` (45 s, iPhone, floor level, ~45° front-oblique angle):

| Finding | Value |
|---|---|
| Pose found | lite 88%, full 91%, heavy 95% of frames |
| Camera-side limb visibility | 0.98 (far side 0.56, unusable) |
| Reps counted by the proposed logic | 25/25 on all 3 models (lite adds 1 false attempt while standing up; the stand-up rule discards it) |
| No-counts flagged | lite and full: 1 (the shallow rep at 0:21, confirmed visually); heavy: 0 |
| Body line | within ±2.5% on every rep (no bad examples in this clip) |

## Architecture

```
 Camera ──┐                                                               ┌─► Voice
          ├─► PoseEstimator ─► features ─► RepCounter ─► rules ─► Session ┼─► Live UI (count, timer, skeleton)
 Video ───┘   (MediaPipe)      (per frame)  (state machine)                └─► Summary ─► History (localStorage)
 file         `pose/`          └────────────── `core/` (pure TS, no DOM) ──┘
```

| Unit | Purpose | Interface |
|---|---|---|
| `io/frameSource` | Camera stream, or video file sampled at a fixed 15 fps by seeking (deterministic) | yields `{image, tMs}` |
| `pose/poseEstimator` | One reused MediaPipe instance (lite or full) | `detect(image, tMs) → Landmark[33] \| null` |
| `core/features` | Landmarks → per-frame signals using the camera-side limbs | `features(lm, calib) → Features` |
| `core/repCounter` | Hysteresis state machine | `step(features, tMs) → RepAttempt \| null` |
| `core/calibration` | Setup hold + first 3 reps → thresholds | `calibrate(setup, reps) → Thresholds` |
| `core/rules` | Judge one attempt | `judge(attempt, thresholds) → {valid, reasons[]}` |
| `core/session` | Phases, timer, tally | reducer: `(state, event) → state` |
| `io/voice`, `io/wakeLock` | speechSynthesis (unlocked on first tap), screen wake lock | `say(text)`, `keepAwake()` |
| `store/history` | Persists sessions | `save(session)`, `list()` |

## Signals and rules

Per frame, using the camera-side shoulder, elbow, wrist, hip, knee and ankle:

- **height** = (shoulder − wrist) · up ÷ setup height. It is about 0.95 at a rep's top and about 0.45 at the bottom.
- **hipOffset** = signed distance of the hip from the shoulder→ankle line, as a % of that line's length. Positive means the hip is above the line (butt high).
- **kneeAngle** = the hip–knee–ankle angle.
- **inPosition** = body within 40° of horizontal and joint visibility ≥ 0.5.

Height is smoothed with a time-based EMA (τ = 50 ms) so results don't depend on fps.

```
 TOP ──height drops 0.12──► DOWN ──rises 0.12 above min──► UP ──height ≥ lockout──► judge + speak ──► TOP
                                                            └─ drops 0.12 before lockout ──► attempt with no_lockout ──► DOWN
```

**Calibration**

1. **Setup:** get into the top position. After 1 s steady, the voice says "Ready". This picks the camera-facing side (higher visibility), sets "up" as the mean wrist→shoulder direction, and records the setup height.
2. **Auto-start, no countdown:** the set starts when the first rep is done. That rep is counted as "one", and the 60 s timer is backdated to when it began (its first descent), to match a real test's "go".
3. **Reps 1–3:** the depth line is set to their median bottom + 0.08, the lockout line to their median top − 0.05, and the hip baseline to their median hip offset. The voice then says "Calibrated". Reps 1–3 count. They're judged on body line, knees and a lenient provisional lockout of 0.85, but not on depth. On the clip, the tops of reps sat 5–8% below the static setup hold.
4. **Sanity check:** if the calibration bottom is above 0.60, show "calibration reps look shallow — redo".

Starting thresholds (all constants in one file; tuned in M5): prominence 0.12, depth +0.08, lockout −0.05, hip ±5%, knee 150°, tilt 40°, visibility 0.5.

## Session flow and UI

```
 Home ─tap Start─► Framing check ─► Hold top: "Ready" ─► Rep 1 done: "one", timer runs ─► Summary ─► History
       (unlocks voice)  (body in frame)                       (60 s or untimed)            (auto-saved)
```

- **Live:** big count, timer, last verdict, and a skeleton overlay. The voice speaks the count number, or "No count, <reason>". It announces 30 s, 10 s and "Time".
- **Summary:** valid / no-count totals and reps per minute. Each rep is a chip; tapping a no-count shows its bottom frame (kept in memory only) and the reason.
- **History:** a list of sessions plus a valid-reps trend.
- **Untimed mode** ends with a Stop tap, or after 5 s out of position.
- **Upload:** pick a video file; it runs through the same pipeline with voice off and produces the same summary.

**Data**

```ts
type Reason = 'not_low_enough' | 'no_lockout' | 'butt_high' | 'hips_sagging' | 'knees_down';
interface RepResult { index: number; startMs: number; endMs: number; valid: boolean; reasons: Reason[];
  bottom: number; top: number; hipMax: number; hipMin: number; kneeMin: number }
interface Thresholds { side: 'left' | 'right'; up: [number, number]; setupHeightPx: number;
  depthLine: number; lockoutLine: number; hipBaseline: number }
interface Session { id: string; startedAt: string; mode: 'ippt60' | 'untimed'; source: 'camera' | 'upload';
  durationMs: number; model: 'lite' | 'full'; thresholds: Thresholds; reps: RepResult[] }
```

## Edge cases

| Case | Behaviour |
|---|---|
| Tracking lost for > 1 s | Pause detection and say "Can't see you" once |
| Resting at the top | Allowed; the timer keeps running |
| Reps before "Ready" | Ignored; the set starts with the first rep after "Ready" |
| Rep finishing after "Time" | Not counted (same as IPPT) |
| Standing up at the end | Discard the last attempt if the user leaves position within 2 s |
| fps < 12 over 3 s | Show a warning and suggest the lite model |
| Speech falls behind | Cancel the queued line and speak the latest |
| Tab hidden or WebGL lost | Stop and save the partial session; show retry |
| Model fails to load | Error screen with retry; model files are self-hosted |

## Testing

- **Unit (vitest):** geometry, features, calibration and rules; `repCounter` on synthetic height curves (clean reps, half rep, no lockout, jitter).
- **Golden fixture:** landmarks extracted from `IMG_8568.MOV` (Python MediaPipe 0.10.21, the same model). Expect 25 reps, 0 hip faults, and exactly one `not_low_enough` at about 21 s. Expect the same result with the fixture cut to 15 fps, which proves results don't depend on fps. The video itself is never committed.
- **E2E (Playwright):** upload the clip, converted to VP9 WebM because Playwright's Chromium lacks H.264/HEVC. The summary should show 25 reps.
- **Labelled clip** (recorded by you, side-on): 3 good reps, then 2 each of half rep, butt high, hips sagging, no lockout, knees, and 2 more good reps. It becomes golden fixture #2 and is used to tune the thresholds.
- **On device:** fps ≥ 15, voice audible with the camera on, screen stays awake, full 60 s set.

## Build order (one PR each)

| # | Milestone | Exit criterion |
|---|---|---|
| M0 | Spike: camera + MediaPipe + skeleton + fps + model toggle + voice test, deployed to Pages | You report fps, load time and voice working on your iPhone (go/no-go) |
| M1 | `core/` with TDD + golden fixture | 25/25 golden test passes |
| M2 | Live session: setup, calibration, timer, voice, wake lock | Full set works on your phone |
| M3 | Summary + history | Sessions persist across reloads |
| M4 | Upload mode + E2E | Playwright shows 25 |
| M5 | Tune on the labelled clip, README camera guide, final deploy | Labelled faults flagged correctly |

## Risks

| Risk | Mitigation |
|---|---|
| iPhone fps unmeasured (no published data) | M0 first. Fallbacks: lite model, lower input resolution |
| MediaPipe GPU delegate gives wrong results on iOS ([#6142](https://github.com/google-ai-edge/mediapipe/issues/6142), segmenter) | Visual check in M0; fall back to the CPU delegate |
| Slow first model load on iOS ([#5171](https://github.com/google-ai-edge/mediapipe/issues/5171)) | Measure in M0; show progress; self-host the model |
| Thresholds tuned on one clip | Labelled clip in M5 |
| Shallow calibration reps make the depth line lenient | Sanity check + "make your first 3 your best" prompt |
