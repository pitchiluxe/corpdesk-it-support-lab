/**
 * CORP Desk's lock and sign-in screen, built like the Meridian IAM Range one
 * (src/ui/desktop.ts): the chosen lock screen background with the identity
 * graph drifting behind glass, a clock card ("Press any key or click to sign
 * in"), then the sign-in panel.
 *
 * CORP Desk's own sign-in form (#loginForm, #technician) is moved into the
 * panel rather than rebuilt, so app.js keeps handling the sign-in exactly as
 * before. Settings > Personalization > Lock screen gets the background picker,
 * generated backgrounds, your own picture, and Lock now.
 *
 * Built into dist/lock.js by `npm run build:lock`; loaded after desktop.js.
 */
import { allLockScreens, backgroundFor, CUSTOM_LOCK_KEY, DEFAULT_LOCK_SCREEN_ID } from './wallpapers.ts';
import { generateBatch } from './wallpaperGenerator.ts';

declare const state: any;
declare function save(): void;

const g = globalThis as any;
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);
const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const prefs = (): any => (state.preferences ||= {});
const lockId = (): string => prefs().lockScreen || DEFAULT_LOCK_SCREEN_ID;
const initials = (name: string): string => name.split(/\s+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).join('').slice(0, 2) || 'T';
const samOf = (name: string): string => name.toLowerCase().replace(/\s+/g, '.');

const login = $('#login')!;
const form = $<HTMLFormElement>('#loginForm')!;
const input = $<HTMLInputElement>('#technician')!;
const time = $('#lockTime')!;
const date = $('#lockDate')!;
const submit = form.querySelector('button[type="submit"]')!;

// ---- build the screen around CORP Desk's own clock and form elements
login.className = `lk${login.classList.contains('hidden') ? ' hidden' : ''}`;
login.setAttribute('role', 'dialog');
login.setAttribute('aria-label', 'Lock screen');
login.tabIndex = 0;
login.replaceChildren();

// The identity graph behind the glass: one directory at the centre, its principals joined to it.
const graph = el('div', 'lk-graph');
graph.setAttribute('aria-hidden', 'true');
const nodes = [[26, 21], [14, 44], [31, 68], [44, 12], [52, 82], [69, 26], [83, 49], [74, 71], [61, 55], [38, 40]];
graph.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${nodes.map(([x, y], i) => `<path d="M50 50 L${x} ${y}" style="animation-delay:${180 + i * 110}ms"/>`).join('')}${nodes.map(([x, y], i) => `<circle class="node" cx="${x}" cy="${y}" r="0.7" style="animation-delay:${i * 350}ms"/>`).join('')}<circle class="hub-ring" cx="50" cy="50" r="2.6"/><circle class="hub" cx="50" cy="50" r="1.2"/></svg>`;
const brand = el('div', 'lk-pill lk-brand', 'CORP Desk');
const author = el('div', 'lk-pill lk-author', 'Created by Erick Omari');
const overview = el('a', 'lk-pill lk-web', '← Lab overview') as HTMLAnchorElement;
overview.href = 'index.html';
overview.addEventListener('click', (e) => e.stopPropagation());

time.className = 'lk-time';
date.className = 'lk-date';
const clock = el('div', 'lk-glass lk-clock');
clock.append(time, date, el('div', 'lk-hint', 'Press any key or click to sign in'));

// Keeps CORP Desk's .avatar class: its account picture (workflow.js) is shown and changed here.
const avatar = el('div', 'avatar lk-avatar');
const name = el('div', 'lk-name');
const upn = el('div', 'lk-upn');
const label = el('label', 'lk-label', 'Your display name');
label.setAttribute('for', 'technician');
input.className = 'lk-input';
submit.className = 'lk-btn';
submit.textContent = 'Sign in';
form.className = 'lk-form';
form.replaceChildren(label, input, submit);
const panel = el('div', 'lk-glass lk-panel');
panel.append(avatar, name, upn, form, el('div', 'lk-cred', 'Training profile · No password required'), el('div', 'lk-domain', 'Sign in to: CORP'));
panel.addEventListener('click', (e) => e.stopPropagation());

login.append(graph, brand, overview, author, clock, panel);

function who(): void {
  const n = input.value.trim() || 'Technician';
  if (!prefs().accountPicture) avatar.textContent = initials(n);
  name.textContent = n;
  upn.textContent = `CORP\\${samOf(n)} · Service Desk Technician`;
}
input.addEventListener('input', who);

let stage: 'lock' | 'signin' = 'lock';
function showLock(): void {
  stage = 'lock';
  login.style.background = backgroundFor(lockId());
  clock.hidden = false;
  panel.hidden = true;
  login.focus({ preventScroll: true });
}
function showSignIn(): void {
  if (stage === 'signin') return;
  stage = 'signin';
  who();
  clock.hidden = true;
  panel.hidden = false;
  panel.classList.remove('lk-in');
  void panel.offsetWidth;
  panel.classList.add('lk-in');
  input.focus();
  input.select();
}
login.addEventListener('click', () => { if (stage === 'lock') showSignIn(); });
login.addEventListener('keydown', (e) => {
  if (stage === 'lock' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); showSignIn(); }
  else if (stage === 'signin' && e.key === 'Escape') showLock();
});
// As on Windows: the clock first; a click or a key brings up the sign-in card.
// Every time the screen is shown again (Sign out, Lock), start from the clock.
new MutationObserver(() => { if (!login.classList.contains('hidden')) showLock(); }).observe(login, { attributes: true, attributeFilter: ['class'] });
showLock();

/** Lock: the desktop and its windows stay as they are; signing in returns to them. */
function lockNow(): void {
  $('#startMenu')?.classList.add('hidden');
  $('#desktop')?.classList.add('hidden');
  login.classList.remove('hidden');
}
const signOut = $('#signOut');
if (signOut && !$('#lockButton')) {
  const lock = el('button', undefined, 'Lock 🔒');
  lock.id = 'lockButton';
  lock.title = 'Lock (your windows stay open)';
  lock.addEventListener('click', lockNow);
  signOut.before(lock);
}
(g.CorpDesk ||= {}).lockNow = lockNow;

// ---- Settings > Personalization > Lock screen
function lockSettings(main: HTMLElement): void {
  const heading = main.querySelector('h1');
  if (!heading) return;
  for (const n of [...main.children]) if (n !== heading) n.remove();
  const preview = el('div', 'lk-preview');
  preview.style.background = backgroundFor(lockId());
  preview.append(el('span', 'lk-preview-time', new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
  const group = el('div', 'lk-settings-group');
  group.append(el('h3', undefined, 'Personalize your lock screen'));
  const pics = el('div', 'lk-pics');
  for (const wp of allLockScreens(prefs().generatedLockScreens || [])) {
    const b = el('button', `lk-pic${wp.id === lockId() ? ' on' : ''}`) as HTMLButtonElement;
    b.type = 'button';
    b.title = wp.label;
    b.setAttribute('aria-label', wp.label);
    b.style.background = wp.gradient;
    b.addEventListener('click', () => { prefs().lockScreen = wp.id; save(); g.renderNetwork(); });
    pics.append(b);
  }
  const actions = el('div', 'lk-settings-actions');
  const generate = el('button', 'secondary', 'Generate new backgrounds');
  generate.addEventListener('click', () => {
    const have: string[] = prefs().generatedLockScreens || [];
    const batch = generateBatch(6, 'lock', have);
    prefs().generatedLockScreens = [...have, ...batch.map((w: { id: string }) => w.id)].slice(-24);
    save();
    g.renderNetwork();
  });
  const browse = el('button', 'secondary', 'Browse photos');
  const file = el('input') as HTMLInputElement;
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp';
  file.hidden = true;
  browse.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 2 * 1024 * 1024) { g.toast?.('Choose a PNG, JPEG or WebP image smaller than 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try { localStorage.setItem(CUSTOM_LOCK_KEY, String(reader.result)); prefs().lockScreen = 'custom'; save(); g.renderNetwork(); }
      catch { g.toast?.('Browser storage is full. Choose a smaller picture.'); }
    };
    reader.readAsDataURL(f);
  });
  actions.append(generate, browse, file, el('span', 'lk-settings-note', 'Generated on this computer from a seed. No download, no AI model.'));
  group.append(pics, actions);
  const lockRow = el('div', 'settings-card');
  lockRow.innerHTML = `<span class="setting-symbol">🔒</span><span class="setting-text"><b>Lock now</b><small>Shows the lock screen; sign in again to continue where you left off</small></span>`;
  const lockBtn = el('button', 'secondary', 'Lock');
  lockBtn.addEventListener('click', lockNow);
  lockRow.append(lockBtn);
  main.append(preview, group, lockRow, el('p', 'settings-caption', `CORP training desktop · Lock screen: ${allLockScreens(prefs().generatedLockScreens || []).find((w) => w.id === lockId())?.label ?? 'Deep Blue'}`));
}
const previous = g.renderNetwork as () => void;
g.renderNetwork = () => {
  previous();
  const main = $('#appBody .settings-main');
  if (main?.querySelector('h1')?.textContent === 'Lock screen') lockSettings(main);
};
