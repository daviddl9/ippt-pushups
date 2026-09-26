import { nearSide, type Pose } from '../core/pose';

type Limb = readonly [from: number, to: number];

const LIMBS: readonly Limb[] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23],
  [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
const NEAR_COLOUR = '#4ade80';
const FAR_COLOUR = 'rgba(148, 163, 184, 0.45)';

/** Overlays the body lines on a canvas that shares the video's intrinsic size; camera side bright, far side dim. */
export function drawSkeleton(canvas: HTMLCanvasElement, pose: Pose | null, video: HTMLVideoElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !fitToVideo(canvas, video)) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!pose) return;
  const nearParity = nearSide(pose) === 'left' ? 1 : 0;
  const isNear = (index: number) => index % 2 === nearParity;
  const unit = canvas.height / 120;
  ctx.lineCap = 'round';
  for (const [from, to] of LIMBS) {
    const near = isNear(from) && isNear(to);
    strokeLimb(ctx, pose, [from, to], near ? NEAR_COLOUR : FAR_COLOUR, near ? unit : unit / 2);
  }
  for (const index of new Set(LIMBS.flat().filter(isNear))) dot(ctx, pose, index, unit * 1.2);
}

function fitToVideo(canvas: HTMLCanvasElement, video: HTMLVideoElement): boolean {
  if (!video.videoWidth) return false;
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  return true;
}

function strokeLimb(ctx: CanvasRenderingContext2D, pose: Pose, [from, to]: Limb, colour: string, width: number): void {
  const { width: w, height: h } = ctx.canvas;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pose[from].x * w, pose[from].y * h);
  ctx.lineTo(pose[to].x * w, pose[to].y * h);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, pose: Pose, index: number, radius: number): void {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = NEAR_COLOUR;
  ctx.beginPath();
  ctx.arc(pose[index].x * w, pose[index].y * h, radius, 0, 2 * Math.PI);
  ctx.fill();
}
