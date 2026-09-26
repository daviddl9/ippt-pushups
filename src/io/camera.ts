export type CameraFacing = 'user' | 'environment';

export const otherCamera = (facing: CameraFacing): CameraFacing => (facing === 'user' ? 'environment' : 'user');

/** Starts the requested camera in `video` (falls back to any camera); resolves to a function that turns it off. */
export async function startCamera(video: HTMLVideoElement, facing: CameraFacing): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return () => stream.getTracks().forEach((track) => track.stop());
}
