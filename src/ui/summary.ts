import { formatClock } from '../app/liveText';
import { isValid, type Reason } from '../core/judge';
import type { RepPhotos } from '../app/repSnapshots';
import type { RepResult } from '../core/session';
import type { SavedSession } from '../store/history';
import { el } from './dom';
import { MODE_LABELS, REASON_LABELS } from './labels';

export function renderSummary(root: HTMLElement, session: SavedSession | undefined, photos: ReadonlyMap<number, RepPhotos>): void {
  root.append(session ? summaryScreen(session, photos) : missingScreen());
}

function summaryScreen(session: SavedSession, photos: ReadonlyMap<number, RepPhotos>): HTMLElement {
  const detail = el('div', { className: 'rep-detail', testId: 'rep-detail', attrs: { hidden: '' } });
  const chips = session.reps.map((rep) => repChip(rep, () => showRep(detail, chips, rep, photos.get(rep.index))));
  const { summary } = session;
  return el(
    'section',
    { className: 'screen summary', testId: 'summary' },
    el('header', { className: 'summary-header' }, el('h1', { text: 'Summary' }), el('p', { text: subtitle(session) })),
    el(
      'dl',
      { className: 'totals' },
      total('Valid', 'valid-total', String(summary.valid), 'valid'),
      total('No-count', 'nocount-total', String(summary.noCount), 'invalid'),
      total('Time', 'duration', formatClock(summary.durationMs), ''),
    ),
    reasonList(summary.byReason),
    el('div', { className: 'chips' }, ...chips),
    detail,
    el(
      'nav',
      { className: 'links' },
      el('a', { className: 'button', text: 'Home', attrs: { href: '#/' } }),
      el('a', { className: 'button secondary', text: 'History', attrs: { href: '#/history' } }),
    ),
  );
}

function subtitle(session: SavedSession): string {
  const when = new Date(session.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const source = session.source === 'upload' ? ' · Video' : '';
  return `${MODE_LABELS[session.mode]} · ${when}${source}`;
}

function total(label: string, testId: string, value: string, tone: string): HTMLElement {
  return el('div', { className: `total ${tone}` }, el('dt', { text: label }), el('dd', { testId, text: value }));
}

function reasonList(byReason: Readonly<Partial<Record<Reason, number>>>): HTMLElement {
  const items = Object.entries(byReason).map(([reason, n]) => el('li', { text: `${REASON_LABELS[reason as Reason]} ×${n}` }));
  return el('ul', { className: 'reasons' }, ...items);
}

function repChip(rep: RepResult, onSelect: () => void): HTMLButtonElement {
  const chip = el('button', {
    className: 'rep-chip',
    testId: 'rep-chip',
    text: String(rep.index),
    attrs: { type: 'button', 'data-valid': String(isValid(rep)), 'aria-pressed': 'false' },
  });
  chip.onclick = onSelect;
  return chip;
}

function showRep(detail: HTMLElement, chips: readonly HTMLButtonElement[], rep: RepResult, photos: RepPhotos | undefined): void {
  chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(i === rep.index - 1)));
  const verdict = isValid(rep) ? 'Good rep' : rep.reasons.map((reason) => REASON_LABELS[reason]).join(', ');
  const pictures = photos ? photoPair(rep.index, photos) : el('p', { className: 'hint', text: 'Photos are not kept after a reload.' });
  detail.replaceChildren(el('p', { className: 'rep-verdict', text: `Rep ${rep.index} · ${verdict}` }), pictures);
  detail.hidden = false;
}

function photoPair(index: number, photos: RepPhotos): HTMLElement {
  return el('div', { className: 'rep-photos' }, photo(photos.bottom, 'Bottom', index), photo(photos.top, 'Top', index));
}

function photo(src: string, label: string, index: number): HTMLElement {
  return el('figure', {}, el('img', { attrs: { src, alt: `${label} of rep ${index}` } }), el('figcaption', { text: label }));
}

function missingScreen(): HTMLElement {
  return el(
    'section',
    { className: 'screen summary' },
    el('h1', { text: 'Session not found' }),
    el('nav', { className: 'links' }, el('a', { className: 'button', text: 'Home', attrs: { href: '#/' } })),
  );
}
