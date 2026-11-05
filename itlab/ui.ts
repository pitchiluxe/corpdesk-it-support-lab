/** Building blocks for the admin-center style tools (Fluent look, light and dark). */
import { h, svg, type Child } from './dom.ts';

export const I = {
  waffle: '<g fill="currentColor"><circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/></g>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  key: '<circle cx="8" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l8-8M16 6l2.5 2.5M14 8l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.6"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  license: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6"/>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  block: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  printer: '<rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="9" width="18" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

export interface NavItem { id: string; label: string; icon: string; group?: string }

/** Admin center frame: top bar with the product name, a left navigation, and the page. */
export function adminShell(o: { product: string; accent: string; nav: NavItem[]; active: string; onNav: (id: string) => void; page: HTMLElement; user: string; panel?: HTMLElement | null }): HTMLElement {
  let group = '';
  const nav: Child[] = [];
  for (const n of o.nav) {
    if (n.group && n.group !== group) { group = n.group; nav.push(h('div', { class: 'ad2-navgroup' }, group)); }
    nav.push(h('button', { class: `ad2-navitem ${n.id === o.active ? 'on' : ''}`, type: 'button', onClick: () => o.onNav(n.id) }, svg(n.icon, 18), h('span', null, n.label)));
  }
  return h('div', { class: 'ad2', style: `--ad2-accent:${o.accent}` },
    h('header', { class: 'ad2-top' }, svg(I.waffle, 18), h('strong', null, o.product), h('label', { class: 'ad2-search' }, svg(I.search, 14), h('input', { placeholder: 'Search', 'aria-label': 'Search', 'data-key': 'top-search' })), h('span', { class: 'ad2-me', title: o.user }, o.user.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase())),
    h('div', { class: 'ad2-main' }, h('nav', { class: 'ad2-nav', 'aria-label': `${o.product} navigation` }, nav), h('main', { class: 'ad2-page', 'data-scroll': 'page' }, o.page), o.panel ?? null));
}

export const page = (title: string, ...kids: Child[]): HTMLElement => h('div', null, h('h1', { class: 'ad2-h1' }, title), ...kids);
export const cmdbar = (...kids: Child[]): HTMLElement => h('div', { class: 'ad2-cmd' }, ...kids);
export const cmd = (icon: string, label: string, onClick: () => void, disabled = false): HTMLElement => h('button', { class: 'ad2-cmdbtn', type: 'button', disabled, onClick }, svg(icon, 16), label);
export const btn = (label: string, onClick: () => void, kind: 'primary' | '' = '', disabled = false): HTMLElement => h('button', { class: `ad2-btn ${kind}`, type: 'button', disabled, onClick }, label);
export const badge = (text: string, kind: 'ok' | 'warn' | 'bad' | 'info' | '' = ''): HTMLElement => h('span', { class: `ad2-badge ${kind}` }, text);
export const card = (title: string, ...kids: Child[]): HTMLElement => h('section', { class: 'ad2-card' }, h('h2', null, title), ...kids);
export const kv = (pairs: [string, Child][]): HTMLElement => h('dl', { class: 'ad2-kv' }, pairs.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
export const note = (text: Child, kind: 'info' | 'warn' | 'ok' = 'info'): HTMLElement => h('div', { class: `ad2-note ${kind}` }, svg(I.info, 16), h('div', null, text));

export function table<T>(cols: [string, (row: T) => Child][], rows: T[], o: { onRow?: (row: T) => void; selected?: (row: T) => boolean; empty?: string } = {}): HTMLElement {
  if (!rows.length) return h('p', { class: 'ad2-empty' }, o.empty ?? 'No items to show.');
  return h('table', { class: 'ad2-table' },
    h('thead', null, h('tr', null, cols.map(([c]) => h('th', null, c)))),
    h('tbody', null, rows.map((r) => h('tr', { class: o.selected?.(r) ? 'on' : '', tabindex: o.onRow ? '0' : null, onClick: o.onRow ? () => o.onRow!(r) : undefined, onKeydown: o.onRow ? (e: KeyboardEvent) => { if (e.key === 'Enter') o.onRow!(r); } : undefined }, cols.map(([, f]) => h('td', null, f(r)))))));
}

/** The right-hand details panel Microsoft admin centers open over the page. */
export function panel(title: string, sub: string, onClose: () => void, tabs: string[] | null, active: string | null, onTab: ((t: string) => void) | null, ...kids: Child[]): HTMLElement {
  return h('aside', { class: 'ad2-panel', role: 'dialog', 'aria-label': title },
    h('div', { class: 'ad2-panel-head' }, h('div', null, h('h2', null, title), sub ? h('small', null, sub) : null), h('button', { class: 'ad2-x', type: 'button', 'aria-label': 'Close', onClick: onClose }, svg(I.close, 16))),
    tabs ? h('div', { class: 'ad2-tabs', role: 'tablist' }, tabs.map((t) => h('button', { class: `ad2-tab ${t === active ? 'on' : ''}`, type: 'button', role: 'tab', onClick: () => onTab?.(t) }, t))) : null,
    h('div', { class: 'ad2-panel-body', 'data-scroll': 'panel' }, ...kids));
}

/** A modal dialog over the tool, resolved by one of its buttons. */
export function dialog(title: string, body: Child, buttons: [string, () => boolean | void, ('primary' | '')?][]): void {
  const shade = h('div', { class: 'ia-shade' });
  const close = (): void => shade.remove();
  shade.append(h('div', { class: 'ia-dialog ia', role: 'dialog', 'aria-label': title },
    h('h2', null, title),
    h('div', { class: 'ia-dialog-body' }, body),
    h('div', { class: 'ia-dialog-foot' }, buttons.map(([label, fn, kind]) => h('button', { class: `ad2-btn ${kind ?? ''}`, type: 'button', onClick: () => { if (fn() !== false) close(); } }, label)))));
  document.body.appendChild(shade);
  shade.querySelector<HTMLElement>('input,select,textarea,button.primary')?.focus();
}
