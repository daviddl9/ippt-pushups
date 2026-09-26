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
