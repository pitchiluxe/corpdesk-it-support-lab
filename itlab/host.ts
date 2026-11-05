/**
 * Registers the lab's tools as CORP Desk apps: desktop icon, Start menu entry,
 * window, and a live view that redraws when anything in the lab changes.
 */
import { APPS, G, onChange } from './corp.ts';

declare let currentApp: string | null;

export interface Tool {
  id: string;
  name: string;
  short: string;
  /** Inner SVG markup for a 34x34 icon (constant). */
  icon: string;
  width: number;
  height: number;
  /** Draw the whole tool into host; called again on every lab change. */
  draw(host: HTMLElement): void;
}

const tools = new Map<string, Tool>();
const live = new Map<string, { host: HTMLElement; stop: () => void }>();

export function registerTool(t: Tool): void {
  tools.set(t.id, t);
  const apps = APPS();
  const entry = { id: t.id, name: t.name, short: t.short, bg: 'transparent', fg: '#fff', icon: `<svg viewBox="0 0 34 34" aria-hidden="true">${t.icon}</svg>` };
  const existing = apps.find((a) => a.id === t.id);
  if (existing) Object.assign(existing, entry); else apps.push(entry);
}

export function refreshShortcuts(): void {
  const apps = APPS();
  const desk = document.getElementById('desktopIcons');
  if (desk) desk.innerHTML = apps.map((a) => G.appButton(a, 'desktop')).join('');
}

function frameOf(id: string): HTMLElement | null {
  return document.querySelector(`#desktop .app-window[data-app="${id}"]`);
}

function mount(id: string): void {
  const body = document.getElementById('appBody');
  const tool = tools.get(id);
  if (!body || !tool) return;
  const current = live.get(id);
  if (current && current.host.parentElement === body) return;
  current?.stop();
  body.replaceChildren();
  const host = document.createElement('div');
  host.className = 'ia';
  host.dataset.tool = id;
  body.appendChild(host);
  const frame = frameOf(id);
  if (frame && !frame.dataset.iaSized) {
    frame.dataset.iaSized = 'true';
    if (!frame.classList.contains('maximized')) {
      const w = Math.min(tool.width, innerWidth - 24), hgt = Math.min(tool.height, innerHeight - 76);
      frame.style.width = `${w}px`;
      frame.style.height = `${hgt}px`;
      // Keep the whole window on screen.
      const r = frame.getBoundingClientRect();
      frame.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 12))}px`;
      frame.style.top = `${Math.max(8, Math.min(r.top, innerHeight - hgt - 60))}px`;
    }
  }
  const redraw = (): void => {
    if (!host.isConnected) return;
    // Keep typing and scroll position across redraws.
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active && host.contains(active) ? active.dataset.key : undefined;
    const caret = focusKey && 'selectionStart' in active! ? active!.selectionStart : null;
    const scrolls = [...host.querySelectorAll<HTMLElement>('[data-scroll]')].map((e) => [e.dataset.scroll, e.scrollTop] as const);
    host.replaceChildren();
    tool.draw(host);
    for (const [k, top] of scrolls) { const e = host.querySelector<HTMLElement>(`[data-scroll="${k}"]`); if (e) e.scrollTop = top; }
    if (focusKey) { const e = host.querySelector<HTMLInputElement>(`[data-key="${focusKey}"]`); if (e) { e.focus(); if (caret !== null) try { e.setSelectionRange(caret, caret); } catch { /* not a text field */ } } }
  };
  redraw();
  live.set(id, { host, stop: onChange(redraw) });
}

/** Redraw one tool now (after a change that does not go through save()). */
export function redrawTool(id: string): void {
  const it = live.get(id);
  if (it?.host.isConnected) { const tool = tools.get(id)!; it.host.replaceChildren(); tool.draw(it.host); }
}

const previousRender = G.render as () => void;
G.render = (): void => { if (currentApp && tools.has(currentApp)) mount(currentApp); else previousRender(); };

const api = (G.CorpDesk ||= {});
const afterClose = api.afterCloseApp;
api.afterCloseApp = (id: string): void => {
  const it = live.get(id);
  if (it) { it.stop(); live.delete(id); }
  afterClose?.(id);
};
