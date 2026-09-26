import { routeHash } from '../app/routes';
import type { SavedSession } from '../store/history';
import { el } from './dom';
import { MODE_LABELS } from './labels';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;
const SPARK_PAD = 3;

/** Sessions arrive newest first. */
export function renderHistory(root: HTMLElement, sessions: readonly SavedSession[]): void {
  const body = sessions.length ? [trendCard(sessions), list(sessions)] : [emptyState()];
  root.append(el('section', { className: 'screen history' }, header(), ...body.filter((node): node is HTMLElement => node !== null)));
}

function header(): HTMLElement {
  return el('header', { className: 'panel-header' }, el('a', { className: 'back', text: '‹ Home', attrs: { href: '#/' } }), el('h1', { text: 'History' }));
}

function trendCard(sessions: readonly SavedSession[]): HTMLElement | null {
  const valid = sessions.filter((s) => s.mode === 'ippt60').map((s) => s.summary.valid).reverse();
  if (valid.length < 2) return null;
  return el(
    'div',
    { className: 'trend' },
    el('p', { className: 'trend-label', text: 'IPPT valid reps' }),
    sparkline(valid),
    el('p', { className: 'trend-values', text: `Latest ${valid.at(-1)} · Best ${Math.max(...valid)}` }),
  );
}

function sparkline(values: readonly number[]): SVGSVGElement {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * SPARK_WIDTH;
  const y = (v: number) => SPARK_HEIGHT - SPARK_PAD - ((v - min) / span) * (SPARK_HEIGHT - 2 * SPARK_PAD);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sparkline');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Valid reps per IPPT test: ${values.join(', ')}`);
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', values.map((v, i) => `${x(i)},${y(v)}`).join(' '));
  svg.append(line);
  return svg;
}

function list(sessions: readonly SavedSession[]): HTMLElement {
  return el('div', { className: 'history-list' }, ...sessions.map(item));
}

function item(session: SavedSession): HTMLElement {
  const when = new Date(session.startedAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const mode = `${MODE_LABELS[session.mode]}${session.source === 'upload' ? ' · Video' : ''}`;
  return el(
    'a',
    { className: 'history-item', testId: 'history-item', attrs: { href: routeHash({ name: 'summary', id: session.id }) } },
    el('span', { className: 'history-when' }, el('span', { text: when }), el('span', { className: 'chip', text: mode })),
    el('span', { className: 'history-score' }, el('strong', { text: String(session.summary.valid) }), el('small', { text: `${session.summary.noCount} no‑count` })),
  );
}

function emptyState(): HTMLElement {
  return el(
    'div',
    { className: 'empty' },
    el('p', { text: 'No sessions yet.' }),
    el('a', { className: 'button', text: 'Start one', attrs: { href: '#/' } }),
  );
}
