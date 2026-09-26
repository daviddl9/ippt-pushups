import { createFpsMeter } from '../app/fpsMeter';
import type { LiveScreenView } from '../app/liveScreen';
import { formatClock, statusText, timerText } from '../app/liveText';
import { isValid } from '../core/judge';
import type { Mode } from '../core/mode';
import type { SessionEvent, SessionState } from '../core/session';
import { speechFor } from '../core/speech';
import { el } from './dom';
import { MODE_LABELS } from './labels';
import { drawSkeleton } from './skeleton';

type RepEvent = Extract<SessionEvent, { type: 'rep' }>;

const LOW_FPS = 12;
const FPS_GRACE_MS = 3000;
const LOW_FPS_MESSAGE = 'Low frame rate. Switch to the lite model in Camera check';
const IPPT_START_MS = 60_000;

const setText = (node: Node, text: string) => {
  if (node.textContent !== text) node.textContent = text;
};

export function renderLive(root: HTMLElement, mode: Mode): LiveScreenView {
  const video = el('video', { attrs: { muted: '', playsinline: '' } });
  const canvas = el('canvas');
  const count = el('output', { className: 'count', testId: 'count', text: '0' });
  const noCount = el('span', { testId: 'no-count', text: '0' });
  const timer = el('span', { className: 'timer', testId: 'timer', text: formatClock(mode === 'ippt60' ? IPPT_START_MS : 0) });
  const verdict = el('p', { className: 'verdict', testId: 'verdict', attrs: { 'aria-live': 'polite' } });
  const status = el('p', { className: 'status', testId: 'status', text: 'Loading the pose model…' });
  const stop = el('button', { className: 'button secondary stop', testId: 'stop', text: 'Stop', attrs: { type: 'button' } });
  root.append(
    el(
      'section',
      { className: 'screen live' },
      el('div', { className: 'stage' }, video, canvas),
      el(
        'div',
        { className: 'scoreboard' },
        el('header', { className: 'live-header' }, el('span', { className: 'chip', text: MODE_LABELS[mode] }), timer),
        count,
        el('p', { className: 'no-count' }, noCount, ' no‑count'),
        verdict,
        status,
        stop,
      ),
    ),
  );
  const fps = createFpsMeter();
  const openedAt = performance.now();
  const lowFps = (tMs: number) => fps(tMs) < LOW_FPS && performance.now() - openedAt > FPS_GRACE_MS;
  return {
    video,
    render(state: SessionState, pose, tMs) {
      const valid = state.reps.filter(isValid).length;
      if (count.textContent !== String(valid)) pulse(count, String(valid));
      setText(noCount, String(state.reps.length - valid));
      setText(timer, timerText(state, tMs));
      setText(status, lowFps(tMs) ? LOW_FPS_MESSAGE : statusText(state));
      drawSkeleton(canvas, pose, video);
    },
    announce(events) {
      const rep = events.findLast((event): event is RepEvent => event.type === 'rep');
      if (!rep) return;
      const valid = isValid(rep.rep);
      verdict.textContent = valid ? 'Good rep' : (speechFor(rep) ?? '');
      verdict.className = `verdict ${valid ? 'valid' : 'invalid'}`;
    },
    showError(message) {
      status.textContent = message;
      status.classList.add('error');
      stop.textContent = 'Retry';
      stop.onclick = () => location.reload();
    },
    onStop(handler) {
      stop.onclick = handler;
    },
  };
}

function pulse(node: HTMLElement, text: string): void {
  node.textContent = text;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
}
