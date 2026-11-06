/**
 * The full-screen button at the far right of the taskbar: on and off with one
 * click (or F11), with its icon and tooltip showing which one you will get.
 * In the desktop app the host window follows (Program.cs handles WebView2's
 * full-screen request).
 */
import { h, svg } from './dom.ts';

const ENTER = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
const EXIT = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

const old = document.getElementById('fullscreen');
const btn = h('button', { id: 'fullscreen', class: 'ia-fs', type: 'button' });
old?.replaceWith(btn);

/**
 * Two kinds of full screen: the page's own (requestFullscreen, which this
 * button controls) and the browser's (Chrome takes F11 itself before the page
 * sees it). The button shows "exit" for either, so it never claims the wrong state.
 */
const pageFull = (): boolean => !!document.fullscreenElement;
// The browser reports its own F11 mode as display-mode: fullscreen (window size alone is not proof: a kiosk or a maximised app window can match the screen).
const browserFull = (): boolean => !pageFull() && matchMedia('(display-mode: fullscreen)').matches;
const isFull = (): boolean => pageFull() || browserFull();
function paint(): void {
  const on = isFull();
  btn.replaceChildren(svg(on ? EXIT : ENTER, 16));
  btn.title = on ? 'Exit full screen (F11)' : 'Full screen (F11)';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('on', on);
}
async function toggle(): Promise<void> {
  try {
    if (pageFull()) await document.exitFullscreen();
    else if (browserFull()) (globalThis as any).toast?.('Your browser is in full screen. Press F11 (or Esc) to leave it.');
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    (globalThis as any).toast?.('Full screen is blocked here. Use your browser\'s full-screen shortcut (usually F11).');
  }
  paint();
}
btn.addEventListener('click', (e) => { e.stopPropagation(); void toggle(); });
document.addEventListener('fullscreenchange', paint);
addEventListener('resize', paint);
// F11 inside the page (the desktop app, and browsers that pass it on) toggles the same way.
document.addEventListener('keydown', (e) => { if (e.key === 'F11') { e.preventDefault(); void toggle(); } });
paint();
