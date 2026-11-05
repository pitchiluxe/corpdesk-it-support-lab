/** CORP Desk's window manager, as the copied Meridian IAM Range apps expect it (src/ui/wm.ts). */
import type { OpenWindow } from '../core/taskmgr.ts';

export interface WinHandle {
  id: string;
  setTitle(title: string): void;
  close(): void;
}
export interface AppDef {
  id: string;
  title: string;
  icon: string;
  width: number;
  height: number;
  mount(host: HTMLElement, win: WinHandle): { dispose?: () => void; redraw?: () => void } | void;
}

/** CORP Desk app ids, named as the IAM Range's (so Task Manager shows chrome.exe, mmc.exe...). */
export const RANGE_ID: Record<string, string> = {
  chrome: 'browser', directory: 'aduc', events: 'eventviewer', terminal: 'powershell', files: 'explorer', notepadpp: 'notepad',
  network: 'settings', rdp: 'rdp', taskmanager: 'taskmgr', control: 'control', calculator: 'CalculatorApp', word: 'word', excel: 'excel',
  powerpoint: 'powerpoint', office: 'OfficeHub', tickets: 'ServiceDesk', mentor: 'ITAssistant', lab: 'LabGuide',
};

const g = globalThis as any;

/** The open CORP Desk windows, newest last, with each one's app icon id. */
export function windowList(): (OpenWindow & { icon: string })[] {
  return [...document.querySelectorAll<HTMLElement>('#desktop .app-window[data-app]')].map((w) => ({
    id: w.dataset.app!,
    appId: RANGE_ID[w.dataset.app!] ?? w.dataset.app!,
    title: w.querySelector('.window-caption > span:last-child')?.textContent || w.getAttribute('aria-label') || w.dataset.app!,
    minimized: w.classList.contains('hidden'),
    icon: w.dataset.app!,
  }));
}
export function closeWindow(id: string): void { g.CorpDesk?.closeApp ? g.CorpDesk.closeApp(id) : g.closeWindow?.(); }
export function focusWindow(id: string): void { g.openApp(id); }

const openArgs = new WeakMap<WinHandle, (arg: string | undefined) => void>();
/** Control Panel pages can be opened directly (control /name ...). */
export function onOpenArg(win: WinHandle, fn: (arg: string | undefined) => void): void { openArgs.set(win, fn); }
export function deliverOpenArg(win: WinHandle, arg: string | undefined): void { openArgs.get(win)?.(arg); }
