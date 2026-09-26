import { el } from './dom';

export interface HomeActions {
  startIppt(): void;
  startUntimed(): void;
}

const TIP = 'Phone landscape on the floor, side-on, whole body in frame. Your first 3 reps set the depth line, so make them your best.';

export function renderHome(root: HTMLElement, actions: HomeActions): void {
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
        startButton('start-ippt', 'IPPT 1-min test', '60 seconds, like the real station', actions.startIppt),
        startButton('start-untimed', 'Free training', 'No timer. Stand up to finish', actions.startUntimed),
        el('p', { className: 'hint', text: TIP }),
      ),
      el(
        'nav',
        { className: 'links' },
        el('a', { className: 'button secondary', testId: 'history-link', text: 'History', attrs: { href: '#/history' } }),
        el('a', { className: 'button secondary', testId: 'debug-link', text: 'Camera check', attrs: { href: '#/debug' } }),
      ),
    ),
  );
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
