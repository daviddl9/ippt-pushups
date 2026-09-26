import type { DebugView } from '../app/debugScreen';
import type { Settings } from '../app/settings';
import { el } from './dom';
import { drawSkeleton } from './skeleton';

const option = (value: string, label: string) => el('option', { text: label, attrs: { value } });

export function renderDebug(root: HTMLElement): DebugView {
  const video = el('video', { attrs: { muted: '', playsinline: '' } });
  const canvas = el('canvas');
  const fps = el('dd', { testId: 'fps', text: '–' });
  const loadMs = el('span', { testId: 'load-ms', text: '–' });
  const model = el('select', { testId: 'model-select' }, option('lite', 'Lite'), option('full', 'Full'));
  const delegate = el('select', { testId: 'delegate-select' }, option('GPU', 'GPU'), option('CPU', 'CPU'));
  const camera = el('select', { testId: 'camera-select' }, option('user', 'Front'), option('environment', 'Back'));
  const voice = el('button', { className: 'button', testId: 'voice-test', text: 'Test voice', attrs: { type: 'button' } });
  const error = el('p', { className: 'error', attrs: { role: 'alert' } });
  root.append(
    el(
      'section',
      { className: 'screen debug' },
      el('div', { className: 'stage' }, video, canvas),
      el(
        'aside',
        { className: 'panel' },
        el('header', { className: 'panel-header' }, el('a', { className: 'back', text: '‹ Home', attrs: { href: '#/' } }), el('h1', { text: 'Camera check' })),
        el('dl', { className: 'stats' }, stat('Frames / s', fps), stat('Model load', el('dd', {}, loadMs, ' ms'))),
        el('div', { className: 'fields' }, field('Model', model), field('Delegate', delegate), field('Camera', camera)),
        voice,
        error,
        el('p', { className: 'hint', text: 'Phone landscape on the floor, side-on, whole body in frame.' }),
      ),
    ),
  );
  const settings = (): Settings => ({
    model: model.value as Settings['model'],
    delegate: delegate.value as Settings['delegate'],
    camera: camera.value as Settings['camera'],
  });
  return {
    video,
    drawPose: (pose) => drawSkeleton(canvas, pose, video),
    showFps: (value) => void (fps.textContent = String(Math.round(value))),
    showLoadMs: (ms) => void (loadMs.textContent = String(Math.round(ms))),
    showSettings: (current) => {
      model.value = current.model;
      delegate.value = current.delegate;
      camera.value = current.camera;
    },
    showError: (message) => void (error.textContent = message),
    onSettingsChange: (handler) => {
      for (const select of [model, delegate, camera]) select.onchange = () => handler(settings());
    },
    onVoiceTest: (handler) => void (voice.onclick = handler),
  };
}

function stat(label: string, value: HTMLElement): HTMLElement {
  return el('div', { className: 'stat' }, el('dt', { text: label }), value);
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { className: 'field' }, el('span', { text: label }), control);
}
