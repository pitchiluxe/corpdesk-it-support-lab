/**
 * App icons for the copied apps: CORP Desk's own desktop icons where the app
 * exists there, and Windows-style glyphs for Control Panel's categories.
 * All markup here is fixed SVG; nothing typed by a user is inserted.
 */
declare const apps: { id: string; icon: string }[];
const g = globalThis as any;

/** IAM Range icon names that are CORP Desk apps. */
const CORP_APP: Record<string, string> = {
  aduc: 'directory', eventviewer: 'events', powershell: 'terminal', explorer: 'files', notepad: 'notepadpp', settings: 'network',
  browser: 'chrome', rdp: 'rdp', taskmgr: 'taskmanager', calculator: 'calculator', control: 'control',
};

const SVG: Record<string, string> = {
  control: '<rect x="3" y="5" width="28" height="22" rx="2" fill="#2f7fd8"/><rect x="5" y="9" width="24" height="16" fill="#e8f2fc"/><rect x="8" y="12" width="7" height="4" fill="#4caf50"/><rect x="18" y="12" width="8" height="4" fill="#f3b23a"/><rect x="8" y="18" width="18" height="4" fill="#9ec3ea"/>',
  network: '<circle cx="17" cy="17" r="13" fill="#2f7fd8"/><path d="M4 17h26M17 4c-6 7-6 19 0 26M17 4c6 7 6 19 0 26M7 10h20M7 24h20" stroke="#dff0ff" stroke-width="1.4" fill="none"/>',
  mouse: '<rect x="10" y="4" width="14" height="26" rx="7" fill="#e6e9ee" stroke="#7a8591" stroke-width="1.2"/><path d="M17 4v10M10 14h14" stroke="#7a8591" stroke-width="1.2"/><rect x="15.8" y="7" width="2.4" height="4" rx="1.2" fill="#2f7fd8"/><path d="M26 12l5-3v10l-5-3" fill="#f3b23a"/>',
  programs: '<rect x="4" y="9" width="26" height="20" rx="2" fill="#c98b2b"/><rect x="4" y="9" width="26" height="6" fill="#e0a83e"/><rect x="12" y="4" width="10" height="7" rx="1" fill="none" stroke="#7a5214" stroke-width="2"/><rect x="14" y="15" width="6" height="5" fill="#ffe2a8"/>',
  user: '<circle cx="17" cy="11" r="6.5" fill="#f1c9a5" stroke="#b98a64"/><path d="M5 31c0-8 5.4-12 12-12s12 4 12 12z" fill="#3a7bd5"/>',
  clock: '<circle cx="17" cy="17" r="13" fill="#fff" stroke="#2f7fd8" stroke-width="2.5"/><path d="M17 9v8l6 4" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M27 26l5 2-2 3z" fill="#4caf50"/>',
  access: '<circle cx="17" cy="17" r="13" fill="#2f7fd8"/><circle cx="17" cy="9.5" r="2.4" fill="#fff"/><path d="M9 13.5l8 1.6 8-1.6M17 15v6l-4 7M17 21l4 7" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  calculator: '<rect x="6" y="3" width="22" height="28" rx="3" fill="#3b3b3b"/><rect x="9" y="6" width="16" height="6" rx="1" fill="#9fd6ff"/><g fill="#d9d9d9"><rect x="9" y="15" width="4" height="3" rx=".6"/><rect x="15" y="15" width="4" height="3" rx=".6"/><rect x="9" y="20" width="4" height="3" rx=".6"/><rect x="15" y="20" width="4" height="3" rx=".6"/><rect x="9" y="25" width="10" height="3" rx=".6"/></g><rect x="21" y="15" width="4" height="13" rx=".6" fill="#2f7fd8"/>',
  taskmgr: '<rect x="3" y="5" width="28" height="24" rx="2" fill="#1f6b3a"/><path d="M6 22l5-7 4 4 5-9 4 6 4-3" stroke="#8ff0a4" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  properties: '<rect x="7" y="3" width="20" height="28" fill="#fff" stroke="#5f6770" stroke-width="1.2"/><path d="M11 9h12M11 13h12M11 17h8" stroke="#7a8591" stroke-width="1.5"/><path d="M19 22l6-5 3 3-5 6-4 1z" fill="#e8b93a" stroke="#8a6d1f"/>',
};

function svgFor(name: string): string {
  // A CORP Desk app's own icon for the apps it has; Windows glyphs for Control Panel's categories.
  const app = CORP_APP[name] ? (typeof apps !== 'undefined' ? apps : []).find((x) => x.id === CORP_APP[name]) : undefined;
  if (app?.icon) return app.icon;
  return `<svg viewBox="0 0 34 34" aria-hidden="true">${SVG[name] ?? SVG.programs}</svg>`;
}
/** A Windows-style icon by name, for registering the new apps. */
export const iconSvg = (name: string): string => `<svg viewBox="0 0 34 34" aria-hidden="true">${SVG[name] ?? SVG.programs}</svg>`;

/** The named app's icon at `size` pixels. */
export function appIcon(name: string, size = 16): HTMLElement {
  const span = document.createElement('span');
  span.className = 'wa-icon';
  span.style.cssText = `width:${size}px;height:${size}px;display:inline-grid;flex:none;vertical-align:middle`;
  span.innerHTML = svgFor(name);
  const svg = span.querySelector('svg');
  if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }
  return span;
}
export const glyph = (name: string): HTMLElement => appIcon(name, 16);
