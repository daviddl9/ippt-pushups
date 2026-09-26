/** Keeps the screen on where supported; resolves to a release function. */
export async function keepScreenOn(): Promise<() => void> {
  const lock = await navigator.wakeLock?.request('screen').catch(() => null);
  return () => void lock?.release();
}
