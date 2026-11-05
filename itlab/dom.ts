/** Small DOM helpers. Text always goes in as text nodes; attributes are set, never parsed as HTML. */
export type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') (el as any)[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}
function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}
/** A fixed SVG icon (constant markup from this bundle only). */
export function svg(markup: string, size = 20, viewBox = '0 0 24 24'): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ia-svg';
  span.style.cssText = `width:${size}px;height:${size}px`;
  span.innerHTML = `<svg viewBox="${viewBox}" width="${size}" height="${size}" aria-hidden="true">${markup}</svg>`;
  return span;
}
export const fmtDate = (iso: string | number | Date): string => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
