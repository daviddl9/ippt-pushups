import { el } from './dom';

export interface HomeActions {
  startIppt(): void;
  startUntimed(): void;
  upload(file: File): void;
}

export interface HomeView {
  showProgress(fraction: number): void;
  showError(message: string): void;
}

const TIP = 'Phone landscape on the floor, side-on, whole body in frame. Your first 3 reps set the depth line, so make them your best.';

export function renderHome(root: HTMLElement, actions: HomeActions): HomeView {
  const ippt = startButton('start-ippt', 'IPPT 1-min test', '60 seconds, like the real station', actions.startIppt);
  const untimed = startButton('start-untimed', 'Free training', 'No timer. Stand up to finish', actions.startUntimed);
  const input = el('input', { className: 'visually-hidden', testId: 'upload-input', attrs: { type: 'file', accept: 'video/*' } });
  const progress = el('p', { className: 'hint upload-progress', testId: 'upload-progress', attrs: { 'aria-live': 'polite' } });
  const controls = [ippt, untimed, input];
  const setBusy = (busy: boolean) => controls.forEach((control) => (control.disabled = busy));
  const showProgress = (fraction: number) => {
    setBusy(true);
    progress.textContent = `Analysing video… ${Math.round(fraction * 100)}%`;
  };
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    showProgress(0);
    actions.upload(file);
  };
  root.append(
    el(
      'section',
      { className: 'screen home' },
      el(
        'header',
        { className: 'hero' },
        el('p', { className: 'eyebrow', text: 'IPPT trainer' }),
        el('h1', { text: 'Push-ups' }),
        el('p', { className: 'lede', text: 'Counts your reps and calls out no‑counts like an IPPT tester.' }),
      ),
      el(
        'div',
        { className: 'actions' },
        ippt,
        untimed,
        el('p', { className: 'hint', text: TIP }),
        el('label', { className: 'button secondary upload' }, input, 'Analyse a video'),
        progress,
      ),
      el(
        'nav',
        { className: 'links' },
        el('a', { className: 'button secondary', testId: 'history-link', text: 'History', attrs: { href: '#/history' } }),
        el('a', { className: 'button secondary', testId: 'debug-link', text: 'Camera check', attrs: { href: '#/debug' } }),
      ),
    ),
  );
  return {
    showProgress,
    showError(message) {
      setBusy(false);
      progress.textContent = message;
      progress.classList.add('error');
    },
  };
}

function startButton(testId: string, title: string, subtitle: string, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    { className: 'button start', testId, attrs: { type: 'button' } },
    el('span', { className: 'start-title', text: title }),
    el('span', { className: 'start-subtitle', text: subtitle }),
  );
  button.onclick = onClick;
  return button;
}
