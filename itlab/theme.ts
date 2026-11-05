/**
 * Dark mode for the whole desktop, as Windows' Settings > Personalization >
 * Colors > "Choose your mode" does it. CORP Desk already saves the choice
 * (preferences.theme) and marks <body> with settings-dark; this mirrors it to
 * <html data-theme> so every window, the taskbar and Start follow, and adds a
 * quick toggle to the system tray.
 */
import { G, S, save } from './corp.ts';
import { h, svg } from './dom.ts';

const MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
const SUN = '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

const isDark = (): boolean => (S().preferences?.theme ?? 'Light') === 'Dark';
const tray = document.querySelector('.system-tray');
const toggle = h('button', { class: 'ia-theme-toggle', type: 'button' });

export function applyTheme(): void {
  const dark = isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.body.classList.toggle('settings-dark', dark);
  toggle.replaceChildren(svg(dark ? SUN : MOON, 16));
  toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  toggle.setAttribute('aria-label', toggle.title);
}

export function setDark(dark: boolean): void {
  (S().preferences ||= {}).theme = dark ? 'Dark' : 'Light';
  save();
  applyTheme();
  // Settings redraws so its "Choose your mode" box shows the new value.
  if (document.querySelector('#appBody .settings-shell')) G.renderNetwork?.();
}

toggle.addEventListener('click', () => setDark(!isDark()));
tray?.prepend(toggle);
// Settings changes preferences.theme and toggles body.settings-dark; follow it.
new MutationObserver(() => { const dark = document.body.classList.contains('settings-dark'); if ((document.documentElement.dataset.theme === 'dark') !== dark) applyTheme(); })
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });
applyTheme();
