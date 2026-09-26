# IPPT Push-up Coach

Phone web app that counts push-ups and calls out no-counts (not low enough, arms not locked, butt high, hips sagging, knees) with a correction cue, like an IPPT tester. Good reps stay silent. Pose tracking runs on the phone with MediaPipe; video never leaves the device.

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
