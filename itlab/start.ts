/**
 * Windows 11 Start: search at the top, Pinned apps (with All apps), Recommended
 * (recently opened apps and the active lab), and the account and power buttons
 * at the bottom. CORP Desk's own elements (#appSearch, #startApps, #startUser,
 * #signOut, #lockButton) are kept, so its handlers keep working.
 */
import { APPS, G, S, TICKETS, save } from './corp.ts';
import { h, svg } from './dom.ts';

const ICON = {
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  power: '<path d="M12 3v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.5 6.3A7.5 7.5 0 1 0 16.5 6.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  chevron: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  signout: '<path d="M14 4H6v16h8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  restart: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  ticket: '<rect x="3" y="5" width="18" height="14" rx="2" fill="#deebfe" stroke="#437dce"/><path d="M7 10h10M7 14h6" stroke="#437dce" stroke-width="1.5"/>',
};

const menu = document.getElementById('startMenu')!;
const search = document.getElementById('appSearch') as HTMLInputElement;
const grid = document.getElementById('startApps')!;
const userLabel = document.getElementById('startUser')!;
const signOut = document.getElementById('signOut')!;
const lockBtn = document.getElementById('lockButton');

type View = 'pinned' | 'all';
let view: View = 'pinned';
const prefs = (): any => (S().preferences ||= {});

/** Windows' pinned order: the tools a service desk technician opens most. */
const PINNED = ['tickets', 'directory', 'pathway', 'outlook', 'm365', 'entra', 'terminal', 'chrome', 'files', 'network', 'control', 'taskmanager', 'rdp', 'services', 'printmgmt', 'events', 'mentor', 'calculator', 'notepadpp', 'word', 'excel', 'lab'];

const appIconSvg = (a: { icon: string }): string => a.icon;
function appTile(a: { id: string; name: string; short: string; icon: string }, kind: 'tile' | 'row'): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'st-icon';
  icon.innerHTML = appIconSvg(a);
  return h('button', { class: kind === 'tile' ? 'st-tile' : 'st-row', type: 'button', 'data-open': a.id, title: a.name }, icon, h('span', { class: 'st-label' }, kind === 'tile' ? a.short : a.name));
}

function recommended(): HTMLElement[] {
  const apps = APPS();
  const items: HTMLElement[] = [];
  const active = S().active;
  const ticket = TICKETS().find((t) => t.id === active);
  if (ticket) items.push(h('button', { class: 'st-rec', type: 'button', onClick: () => { G.CorpDesk?.openTicket?.(ticket.id); hide(); } }, svg(ICON.ticket, 26), h('span', null, h('b', null, `LAB-${String(ticket.id).padStart(3, '0')} · ${ticket.title}`), h('small', null, 'Active incident'))));
  for (const id of (prefs().recentApps ?? []).slice(0, ticket ? 5 : 6)) {
    const a = apps.find((x) => x.id === id);
    if (!a) continue;
    const icon = document.createElement('span');
    icon.className = 'st-icon';
    icon.innerHTML = a.icon;
    items.push(h('button', { class: 'st-rec', type: 'button', 'data-open': a.id }, icon, h('span', null, h('b', null, a.name), h('small', null, 'Recently opened'))));
  }
  if (!items.length) items.push(h('p', { class: 'st-empty' }, 'The more you use the lab, the more you\'ll see your recent apps and incidents here.'));
  return items;
}

function results(q: string): HTMLElement {
  const query = q.trim().toLowerCase();
  const apps = APPS().filter((a) => `${a.name} ${a.short} ${a.id}`.toLowerCase().includes(query));
  const settings: string[] = (G.CorpDesk?.settingsCategories ?? []).map((c: [string]) => c[0]).filter((n: string) => n.toLowerCase().includes(query));
  const tix = TICKETS().filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(query)).slice(0, 4);
  const best = apps[0];
  return h('div', { class: 'st-results' },
    best ? h('div', { class: 'st-best' }, h('div', { class: 'st-h' }, 'Best match'), appTile(best, 'row')) : h('p', { class: 'st-empty' }, `No results for "${q}"`),
    apps.length > 1 ? h('div', null, h('div', { class: 'st-h' }, 'Apps'), apps.slice(1, 8).map((a) => appTile(a, 'row'))) : null,
    settings.length ? h('div', null, h('div', { class: 'st-h' }, 'Settings'), settings.map((n) => h('button', { class: 'st-row', type: 'button', onClick: () => { G.CorpDesk.settingsNavigate(n); hide(); } }, svg(ICON.gear, 22), h('span', { class: 'st-label' }, n)))) : null,
    tix.length ? h('div', null, h('div', { class: 'st-h' }, 'Incidents'), tix.map((t) => h('button', { class: 'st-row', type: 'button', onClick: () => { G.CorpDesk?.openTicket?.(t.id); hide(); } }, svg(ICON.ticket, 22), h('span', { class: 'st-label' }, `LAB-${String(t.id).padStart(3, '0')} · ${t.title}`)))) : null);
}

const body = h('div', { class: 'st-body' });
// CORP Desk's Lock and Sign out buttons live in the power menu (kept in the page so their handlers stay bound).
const flyout = h('div', { class: 'st-flyout', hidden: true }, lockBtn, signOut);

function draw(): void {
  const q = search.value;
  body.replaceChildren();
  grid.className = 'st-grid';
  if (q.trim()) { body.append(results(q)); return; }
  const apps = APPS();
  if (view === 'pinned') {
    const pinned = [...PINNED.map((id) => apps.find((a) => a.id === id)).filter(Boolean), ...apps.filter((a) => !PINNED.includes(a.id))] as typeof apps;
    grid.replaceChildren(...pinned.map((a) => appTile(a, 'tile')));
    body.append(
      h('div', { class: 'st-section' }, h('span', null, 'Pinned'), h('button', { class: 'st-pill', type: 'button', onClick: () => { view = 'all'; draw(); } }, 'All apps', svg(ICON.chevron, 14))),
      grid,
      h('div', { class: 'st-section' }, h('span', null, 'Recommended')),
      h('div', { class: 'st-recs' }, recommended()));
  } else {
    const sorted = [...apps].sort((a, b) => a.name.localeCompare(b.name));
    const groups = new Map<string, typeof apps>();
    for (const a of sorted) { const k = /[a-z]/i.test(a.name[0]!) ? a.name[0]!.toUpperCase() : '#'; groups.set(k, [...(groups.get(k) ?? []), a]); }
    body.append(
      h('div', { class: 'st-section' }, h('span', null, 'All apps'), h('button', { class: 'st-pill', type: 'button', onClick: () => { view = 'pinned'; draw(); } }, svg(ICON.back, 14), 'Back')),
      h('div', { class: 'st-all', 'data-scroll': 'all' }, [...groups].map(([k, list]) => [h('div', { class: 'st-letter' }, k), list.map((a) => appTile(a, 'row'))])));
  }
}

function power(kind: 'account' | 'power', anchor: HTMLElement): void {
  if (!flyout.hidden && flyout.dataset.kind === kind) { flyout.hidden = true; return; }
  flyout.dataset.kind = kind;
  const item = (icon: string, label: string, fn: () => void): HTMLElement => h('button', { class: 'st-fly', type: 'button', onClick: () => { flyout.hidden = true; fn(); } }, svg(icon, 16), label);
  signOut.className = 'st-fly';
  signOut.replaceChildren(svg(ICON.signout, 16), 'Sign out');
  if (lockBtn) { lockBtn.className = 'st-fly'; lockBtn.replaceChildren(svg(ICON.lock, 16), 'Lock'); }
  flyout.replaceChildren(...(kind === 'account'
    ? [item(ICON.gear, 'Change account settings', () => { G.CorpDesk.settingsNavigate('Accounts'); hide(); }), ...(lockBtn ? [lockBtn] : []), signOut]
    : [...(lockBtn ? [lockBtn] : []), signOut, item(ICON.restart, 'Restart', () => { save(); location.reload(); }), item(ICON.power, 'Shut down', () => { hide(); signOut.click(); })]));
  flyout.hidden = false;
  const r = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
  flyout.style.left = kind === 'account' ? `${r.left - m.left}px` : '';
  flyout.style.right = kind === 'power' ? `${m.right - r.right}px` : '';
}

function hide(): void { menu.classList.add('hidden'); }

// ---- build
menu.classList.add('st');
search.placeholder = 'Search for apps, settings, and incidents';
search.setAttribute('aria-label', 'Search for apps, settings, and incidents');
const avatar = h('span', { class: 'st-avatar' });
const accountBtn = h('button', { class: 'st-account', type: 'button', onClick: (e: Event) => power('account', e.currentTarget as HTMLElement) }, avatar, userLabel);
const powerBtn = h('button', { class: 'st-power', type: 'button', title: 'Power', 'aria-label': 'Power', onClick: (e: Event) => power('power', e.currentTarget as HTMLElement) }, svg(ICON.power, 18));
const searchBox = h('label', { class: 'st-search' }, svg(ICON.search, 16), search);
menu.replaceChildren(searchBox, body, h('footer', { class: 'st-foot' }, accountBtn, powerBtn), flyout);
search.oninput = () => draw();
search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const first = body.querySelector<HTMLButtonElement>('.st-best button, .st-row, .st-tile'); first?.click(); }
  if (e.key === 'Escape') hide();
});

// Recently opened apps for Recommended.
const open = G.openApp as (id: string) => void;
G.openApp = (id: string): void => {
  open(id);
  const list: string[] = prefs().recentApps ?? [];
  prefs().recentApps = [id, ...list.filter((x) => x !== id)].slice(0, 8);
};
// Refresh each time Start opens; Ctrl+Esc opens it as on Windows.
new MutationObserver(() => {
  if (menu.classList.contains('hidden')) { flyout.hidden = true; return; }
  view = 'pinned';
  search.value = '';
  const name: string = S().technician || 'Technician';
  avatar.textContent = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  userLabel.textContent = name;
  draw();
  requestAnimationFrame(() => search.focus());
}).observe(menu, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Escape' && !document.getElementById('desktop')?.classList.contains('hidden')) { e.preventDefault(); menu.classList.toggle('hidden'); }
});
// CORP Desk rewrites #startApps with its own buttons; Start redraws its grid when shown, so nothing is lost.
draw();
