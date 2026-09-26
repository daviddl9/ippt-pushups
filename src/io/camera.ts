/** Starts the front camera in `video`; resolves to a function that turns it off. */
export async function startCamera(video: HTMLVideoElement): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return () => stream.getTracks().forEach((track) => track.stop());
}
