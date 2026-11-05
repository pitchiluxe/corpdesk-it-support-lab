/** Mouse pointer appearance (Control Panel > Mouse), kept in CORP Desk's preferences and applied to its desktop. */
declare const state: any;
const g = globalThis as any;
export interface Appearance { pointerStyle: 'white' | 'black' | 'inverted' | 'custom'; pointerSize: number; pointerColor: string }
export function appearance(): Appearance {
  const p = state?.preferences?.pointer ?? {};
  return { pointerStyle: p.pointerStyle ?? 'white', pointerSize: p.pointerSize ?? 1, pointerColor: p.pointerColor ?? '#00b7ff' };
}
/** Draw the Windows arrow in the chosen scheme and size, and use it on the CORP Desk desktop. */
export function applyPointer(): void {
  const a = appearance();
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  if (a.pointerStyle === 'white' && a.pointerSize === 1) { desktop.style.cursor = ''; return; }
  const fill = a.pointerStyle === 'black' ? '#000' : a.pointerStyle === 'custom' ? a.pointerColor : a.pointerStyle === 'inverted' ? '#000' : '#fff';
  const stroke = a.pointerStyle === 'black' || a.pointerStyle === 'inverted' ? '#fff' : '#000';
  const px = Math.round(16 * (1 + (a.pointerSize - 1) * 0.5));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${Math.round(px * 1.5)}' viewBox='0 0 16 24'><path d='M1 1v19l5-5 3.5 7 3-1.5-3.5-7H16z' fill='${fill}' stroke='${stroke}' stroke-width='1.2'/></svg>`;
  desktop.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 1 1, default`;
}
