import { el } from './dom';

export function renderHome(root: HTMLElement): void {
  root.append(
    el(
      'section',
      { className: 'screen home' },
      el(
        'header',
        { className: 'hero' },
        el('p', { className: 'eyebrow', text: 'IPPT trainer' }),
        el('h1', { text: 'Push-ups' }),
        el('p', { className: 'lede', text: 'Counts your reps out loud and calls no‑counts like an IPPT tester.' }),
      ),
      el('div', { className: 'actions' }),
      el(
        'nav',
        { className: 'links' },
        el('a', { className: 'button secondary', testId: 'debug-link', text: 'Camera check', attrs: { href: '#/debug' } }),
      ),
    ),
  );
}
