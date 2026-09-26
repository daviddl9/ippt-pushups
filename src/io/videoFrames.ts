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
