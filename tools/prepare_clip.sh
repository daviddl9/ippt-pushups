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
