/**
 * Calculator, Task Manager and Control Panel for CORP Desk: the Meridian IAM
 * Range apps (winapps/ui/apps/*.ts and winapps/core/*.ts, copied from
 * range/src with only CORP names changed) mounted in CORP Desk windows. The
 * files in winapps/ui/ stand in for the range's window manager, store and
 * icons, backed by CORP Desk's state.
 *
 * Built into dist/winapps.js by `npm run build:winapps`; loaded last.
 */
import { calculatorApp } from './ui/apps/calculator.ts';
import { setRunNewTask, taskManagerApp } from './ui/apps/taskmgr.ts';
import { controlPanelApp, setControlPanelLauncher } from './ui/apps/control.ts';
import { setToastHook } from './ui/dom.ts';
import { iconSvg } from './ui/icons.ts';
import { applyPointer } from './ui/theme.ts';
import { deliverOpenArg, type AppDef, type WinHandle } from './ui/wm.ts';

declare const apps: { id: string; name: string; short: string; bg: string; fg: string; icon: string }[];
declare let currentApp: string | null;
declare function appButton(app: unknown, where: string): string;

const g = globalThis as any;

/** CORP Desk app id -> the copied app, with its Windows icon and default window size. */
const REGISTRY: Record<string, { def: AppDef; name: string; short: string; icon: string }> = {
  calculator: { def: calculatorApp, name: 'Calculator', short: 'Calculator', icon: 'calculator' },
  taskmanager: { def: taskManagerApp, name: 'Task Manager', short: 'Task Manager', icon: 'taskmgr' },
  control: { def: controlPanelApp, name: 'Control Panel', short: 'Control Panel', icon: 'control' },
};

for (const [id, r] of Object.entries(REGISTRY)) {
  const existing = apps.find((a) => a.id === id);
  if (existing) Object.assign(existing, { name: r.name, short: r.short, icon: iconSvg(r.icon) });
  else apps.push({ id, name: r.name, short: r.short, bg: 'transparent', fg: '#fff', icon: iconSvg(r.icon) });
}
const $ = (s: string): HTMLElement | null => document.querySelector(s);
const desktopIcons = $('#desktopIcons');
const startApps = $('#startApps');
if (desktopIcons) desktopIcons.innerHTML = apps.map((a) => appButton(a, 'desktop')).join('');
if (startApps) startApps.innerHTML = apps.map((a) => appButton(a, 'start')).join('');

// CORP Desk's toasts for the apps' messages ("Unable to terminate process ...").
setToastHook((message) => { g.toast?.(message); return false; });

/** Live app instances: their host element, window handle and dispose. */
const live = new Map<string, { host: HTMLElement; win: WinHandle; handle: { dispose?: () => void; redraw?: () => void } | void }>();

function frameOf(id: string): HTMLElement | null {
  return document.querySelector(`#desktop .app-window[data-app="${id}"]`);
}

function mount(id: string): void {
  const body = document.getElementById('appBody');
  const entry = REGISTRY[id];
  if (!body || !entry) return;
  const current = live.get(id);
  if (current && current.host.parentElement === body) return;
  current?.handle && current.handle.dispose?.();
  body.replaceChildren();
  const host = document.createElement('div');
  host.className = 'wa';
  host.dataset.wa = id;
  body.appendChild(host);
  const frame = frameOf(id);
  // First open: the window size the app is designed for (Calculator is a narrow window, as on Windows).
  if (frame && !frame.dataset.waSized) {
    frame.dataset.waSized = 'true';
    if (!frame.classList.contains('maximized')) {
      frame.style.width = `${Math.min(entry.def.width, innerWidth - 24)}px`;
      frame.style.height = `${Math.min(entry.def.height, innerHeight - 76)}px`;
    }
  }
  const win: WinHandle = {
    id,
    setTitle: (title) => { const s = frameOf(id)?.querySelector('.window-caption > span:last-child'); if (s) s.textContent = title === entry.name ? entry.name : `${title}`; },
    close: () => g.CorpDesk?.closeApp?.(id),
  };
  const handle = entry.def.mount(host, win);
  live.set(id, { host, win, handle });
}

const previousRender = g.render as () => void;
g.render = (): void => { if (currentApp && REGISTRY[currentApp]) mount(currentApp); else previousRender(); };

const api = (g.CorpDesk ||= {});
const afterClose = api.afterCloseApp;
api.afterCloseApp = (id: string): void => {
  const it = live.get(id);
  if (it) { it.handle && it.handle.dispose?.(); live.delete(id); }
  afterClose?.(id);
};
/** Open Control Panel on one of its pages ("admin", "programs"...), as `control admintools` does. */
api.openControlPanel = (page?: string): void => { g.openApp('control'); const it = live.get('control'); if (it && page) deliverOpenArg(it.win, page); };

// Control Panel links go to CORP Desk's own apps and Settings pages.
const SETTINGS_PAGE: Record<string, string> = {
  network: 'Network & internet', personalization: 'Personalization', themes: 'Themes', background: 'Background', pointer: 'Mouse',
  privacy: 'Privacy & security', about: 'About', devices: 'Bluetooth & devices', display: 'Display', time: 'Date & time', home: 'Home',
};
const COMMAND_APP: Record<string, string> = {
  eventvwr: 'events', 'dsa.msc': 'directory', 'domain.msc': 'directory', powershell: 'terminal', ise: 'terminal', explorer: 'files', notepad: 'notepadpp', control: 'control',
};
setControlPanelLauncher((what) => {
  if (what.startsWith('settings:')) { const page = SETTINGS_PAGE[what.slice(9)] ?? 'Home'; g.CorpDesk?.settingsNavigate ? g.CorpDesk.settingsNavigate(page) : g.openApp('network'); return; }
  const app = COMMAND_APP[what];
  if (app) g.openApp(app);
});

// Task Manager's "Run new task" opens CORP Desk's Run dialog (Alt+R).
setRunNewTask(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true })));

// Startup apps chosen in Task Manager open when you sign in.
document.getElementById('loginForm')?.addEventListener('submit', () => {
  const list: string[] = (globalThis as any).CorpDesk?.getState?.()?.preferences?.startupApps ?? [];
  setTimeout(() => { for (const id of list) if (apps.some((a) => a.id === id)) g.openApp(id); }, 0);
});

applyPointer();
