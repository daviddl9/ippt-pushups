/** Returns a function that records a frame time and gives frames per second over the last second. */
export function createFpsMeter(windowMs = 1000): (tMs: number) => number {
  const times: number[] = [];
  return (tMs) => {
    times.push(tMs);
    while (times[0] <= tMs - windowMs) times.shift();
    return (times.length * 1000) / windowMs;
  };
}
