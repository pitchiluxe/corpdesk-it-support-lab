/**
 * Dark mode for every app, generated from the styles actually loaded.
 *
 * The hand-written dark rules (itlab.css, desktop.css) cover the shell: the
 * taskbar, Start, window frames, dialogs. Each app also has its own light
 * surfaces (ADUC panes, MMC toolbars, Explorer ribbon, Office ribbons,
 * Notepad++, Service Desk cards...) and some inject their styles at runtime.
 * Listing them by hand misses some, and a missed one shows light text on a
 * white panel. So this reads every stylesheet in the page and writes a dark
 * counterpart of each rule, scoped to html[data-theme=dark]:
 *
 *   light background  -> dark surface with a hint of the same hue (a pale blue
 *                        selection stays a blue selection, white becomes #202020)
 *   dark text         -> light text of the same hue (links stay blue)
 *   light border      -> dark border
 *
 * Mid-tone accent colours (blue buttons, red badges) are left as they are.
 * The generated sheet is inserted before itlab.css so every hand-written dark
 * rule still wins, and it is rebuilt when an app adds a stylesheet.
 *
 * Left alone: the lock screen, Jam (its own console skin), Screen Pen, the
 * certificate, and documents: the Word page and PowerPoint slides stay paper
 * white with dark text, as Office does in dark mode.
 */
const SKIP = /(^|[\s>+~(,])(\.lk|#login|\.lock|\.landing|\.jam|\.dj-|\.pen-|\.ia-pen|\.cert|\.word-page|#wordEditor|\.ppt-slide|\.ppt-thumb|\.calc-key|\.wallpaper|\.desktop-icon|#desktopIcons|\.wf-|\.workflow|\.mm-shield|\.taskbar|#startMenu|\.st-|\.ia-fs|\.ia-theme)|data-theme|settings-dark|::selection|::-webkit-scrollbar|:root|^html\b|^body\b(?![.#[])/i;
const ID = 'ia-dark-auto';

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour to [r, g, b, a], or null for var(), currentColor, transparent and the like. */
function rgba(value: string): [number, number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (!v || v.includes('var(') || v === 'transparent' || v === 'currentcolor' || v === 'inherit' || v === 'initial' || v === 'unset' || v === 'none') return null;
  probe ||= document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.fillStyle = '#010203';
  probe.fillStyle = v;
  const out = String(probe.fillStyle);
  if (out === '#010203' && v !== '#010203') return null;
  if (out.startsWith('#')) return [parseInt(out.slice(1, 3), 16), parseInt(out.slice(3, 5), 16), parseInt(out.slice(5, 7), 16), 1];
  const m = out.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1]!.split(',').map((x) => parseFloat(x));
  return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
}
function hsl([r, g, b]: number[]): [number, number, number] {
  r! /= 255; g! /= 255; b! /= 255;
  const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g! - b!) / d + (g! < b! ? 6 : 0) : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return [h * 60, s, l];
}
const css = (h: number, s: number, l: number, a: number): string => `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(1)}%${a < 1 ? ` / ${a}` : ''})`;
/** Light surface -> dark surface. */
function darkBg(value: string): string | null {
  const c = rgba(value);
  if (!c || c[3] === 0) return null;
  const [h, s, l] = hsl(c);
  if (!(l >= 0.85 || (s < 0.18 && l >= 0.6))) return null;
  return css(h, s * 0.45, 0.125 + (1 - l) * 0.95, c[3]);
}
/** Dark text -> light text of the same hue. */
function lightInk(value: string): string | null {
  const c = rgba(value);
  if (!c) return null;
  const [h, s, l] = hsl(c);
  // Dark ink, and mid greys that would sit too close to a dark surface; saturated mid tones (accents) stay.
  if (l > 0.62 || (l > 0.45 && s > 0.3)) return null;
  return css(h, Math.min(s, 0.85), Math.max(0.78, 0.93 - l * 0.3), c[3]);
}
function darkLine(value: string): string | null {
  const c = rgba(value);
  if (!c || c[3] === 0) return null;
  const [h, s, l] = hsl(c);
  if (l < 0.75) return null;
  return css(h, s * 0.3, 0.25, c[3]);
}
const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\bwhite\b/gi;
/** Light gradients: map each light stop, keep the rest. */
function darkGradient(value: string): string | null {
  if (!/gradient\(/i.test(value) || /url\(/i.test(value)) return null;
  let changed = false;
  const out = value.replace(COLOR_TOKEN, (tok) => { const d = darkBg(tok); if (d) { changed = true; return d; } return tok; });
  return changed ? out : null;
}

function rulesOf(list: CSSRuleList, out: string[], media = ''): void {
  for (const rule of [...list]) {
    if (rule instanceof CSSMediaRule) { if (!/print/i.test(rule.conditionText)) { const inner: string[] = []; rulesOf(rule.cssRules, inner); if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join('')}}`); } continue; }
    if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) { const inner: string[] = []; rulesOf(rule.cssRules, inner); if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join('')}}`); continue; }
    if (!(rule instanceof CSSStyleRule)) continue;
    const st = rule.style, decls: string[] = [];
    const imp = (p: string): string => (st.getPropertyPriority(p) === 'important' ? '!important' : '');
    const bg = st.getPropertyValue('background-color'), bgi = st.getPropertyValue('background-image');
    const dbg = bg ? darkBg(bg) : null; if (dbg) decls.push(`background-color:${dbg}${imp('background-color')}`);
    const dgi = bgi ? darkGradient(bgi) : null; if (dgi) decls.push(`background-image:${dgi}${imp('background-image')}`);
    const color = st.getPropertyValue('color'); const ink = color ? lightInk(color) : null; if (ink) decls.push(`color:${ink}${imp('color')}`);
    for (const side of ['top', 'right', 'bottom', 'left']) { const v = st.getPropertyValue(`border-${side}-color`); const d = v ? darkLine(v) : null; if (d) decls.push(`border-${side}-color:${d}${imp(`border-${side}-color`)}`); }
    if (st.getPropertyValue('color-scheme') === 'light') decls.push('color-scheme:dark');
    if (!decls.length) continue;
    const sels = rule.selectorText.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => s && !SKIP.test(s));
    if (!sels.length) continue;
    out.push(`${sels.map((s) => `html[data-theme=dark] ${s}`).join(',')}{${decls.join(';')}}`);
  }
}
function build(): void {
  if (!document.head) return;
  const out: string[] = [];
  for (const sheet of [...document.styleSheets]) {
    const owner = sheet.ownerNode as HTMLElement | null;
    if (owner?.id === ID) continue;
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // another origin (fonts)
    rulesOf(rules, out);
  }
  let style = document.getElementById(ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = ID;
    // Before itlab.css: the hand-written dark rules win every tie.
    const itlab = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find((l) => /itlab\.css/.test(l.href));
    if (itlab) itlab.before(style); else document.head.append(style);
  }
  const text = out.join('\n');
  if (style.textContent !== text) style.textContent = text;
}

let timer = 0;
const later = (): void => { clearTimeout(timer); timer = window.setTimeout(build, 150); };
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', build); else build();
addEventListener('load', later);
// Apps that inject their styles when they first open (ADUC, Pwd, Jam...).
new MutationObserver((list) => { if (list.some((m) => [...m.addedNodes].some((n) => (n as Element).tagName === 'STYLE' && (n as Element).id !== ID || (n as Element).tagName === 'LINK'))) later(); })
  .observe(document.head, { childList: true });
