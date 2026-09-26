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
