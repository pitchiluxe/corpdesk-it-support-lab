/**
 * Screen Pen: drawing on the live workstation, ported from Erick Omari's IAM
 * Range (ui/pen.ts). A transparent sheet over the whole desktop with a
 * floating toolbar you can drag out of your own way, so you can circle a field
 * in Active Directory while it is on screen: teaching, walking a colleague
 * through a change, or narrating a recording for a LinkedIn post.
 *
 * What makes or breaks a tool like this is what happens to clicks, so the
 * sheet has two states and the toolbar always says which one it is in:
 *
 *   Drawing        the sheet takes the pointer; the desktop is frozen behind it
 *   Click-through  clicks reach the apps underneath; the marks stay visible
 *
 * It opens in Click-through (a pen that silently swallows every click looks
 * like a broken workstation), picking a tool switches to Drawing, and Esc
 * always hands the desktop back.
 *
 * Opened from the system tray, Start ("Screen Pen"), the desktop icon or
 * Ctrl+Shift+D (Win+Shift+D where the browser lets the page see it).
 */
import { APPS, G, toast } from './corp.ts';
import { h } from './dom.ts';
import { type CameraCorner, type RecorderHandle, canRecord, canRecordCamera, captureScreen, saveCapture, startRecording } from './recorder.ts';

type Tool = 'pen' | 'highlight' | 'arrow' | 'box' | 'eraser';
interface Point { x: number; y: number }
interface Stroke { tool: Tool; color: string; size: number; points: Point[] }

// Fluent-style line icons (24x24), drawn in currentColor.
const I: Record<string, string> = {
  pen: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
  highlight: '<path d="M9 11l6-6 4 4-6 6"/><path d="M9 11l-3 3v3h3l3-3"/><path d="M4 21h9"/>',
  arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
  box: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  eraser: '<path d="M16 4l5 5-9.5 9.5H7L3 14.5z"/><path d="M10 10l5 5"/><path d="M11.5 18.5H21"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  clear: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  record: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>',
  video: '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
  videoOff: '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/><path d="M3 3l18 18"/>',
  corner: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M4 4l6 6"/><path d="M20 20l-6-6"/>',
  pointer: '<path d="M5 3l14 8-6 2 4 7-3 1.5-4-7-5 4z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = (name: string): HTMLElement => {
  const s = document.createElement('span');
  s.className = 'pen-ic';
  // Constant markup from I only.
  s.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] ?? ''}</svg>`;
  return s;
};

const TOOLS: { id: Tool; title: string }[] = [
  { id: 'pen', title: 'Pen' },
  { id: 'highlight', title: 'Highlighter: translucent, so the text stays readable' },
  { id: 'arrow', title: 'Arrow' },
  { id: 'box', title: 'Box' },
  { id: 'eraser', title: 'Eraser' },
];
const COLORS = ['#e81123', '#ffb900', '#16c60c', '#0078d4', '#ffffff', '#000000'];
const POS_KEY = 'corpdesk-pen-toolbar';
const CAM_KEY = 'corpdesk-pen-camera';

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* lasts the session */ } };
const stamp = (): string => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const nextFrame = (): Promise<void> => new Promise((r) => { let done = false; const go = (): void => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 120); });

let close: (() => void) | null = null;
export const screenPenActive = (): boolean => close !== null;

/** Open Screen Pen, or close it if it is already up (one entry point, one obvious way off). */
export function toggleScreenPen(): void {
  if (close) { close(); return; }

  let tool: Tool = 'pen';
  let color = COLORS[0]!;
  let size = 3;
  let drawing = false;
  let strokes: Stroke[] = [];
  const redo: Stroke[] = [];
  let current: Stroke | null = null;
  let recorder: RecorderHandle | null = null;
  let tick = 0;
  let camera = (read(CAM_KEY) ?? (canRecordCamera() ? '1' : '0')) === '1';
  let corner: CameraCorner = 'bottom-right';

  const canvas = h('canvas', { class: 'pen-canvas' }) as HTMLCanvasElement;
  const overlay = h('div', { class: 'pen-sheet click-through', 'data-label': 'Drawing: clicks go to the pen. Press Esc to use the desktop.' }, canvas);
  const bar = h('div', { class: 'pen-bar', role: 'toolbar', 'aria-label': 'Screen Pen' });
  const saved = (() => { try { return JSON.parse(read(POS_KEY) ?? '') as Point; } catch { return null; } })();
  const place = (p: Point): void => {
    bar.style.left = `${Math.min(window.innerWidth - 120, Math.max(0, p.x))}px`;
    bar.style.top = `${Math.min(window.innerHeight - 50, Math.max(0, p.y))}px`;
  };
  place(saved && typeof saved.x === 'number' ? saved : { x: Math.round(window.innerWidth / 2 - 330), y: 16 });

  // ------------------------------------------------------------ drawing
  function sizeCanvas(): void {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint();
  }
  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
    const first = s.points[0], last = s.points[s.points.length - 1];
    if (!first || !last) return;
    ctx.save();
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.size;
    if (s.tool === 'highlight') { ctx.globalAlpha = 0.3; ctx.lineWidth = s.size * 5 + 4; ctx.lineCap = 'square'; }
    // The eraser cuts a hole in the annotation layer, so the desktop shows through exactly as before.
    if (s.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = s.size * 6 + 12; }
    if (s.tool === 'box') ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
    else if (s.tool === 'arrow') {
      const a = Math.atan2(last.y - first.y, last.x - first.x), head = 12 + s.size * 2;
      ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.lineTo(last.x - Math.cos(a) * head * 0.6, last.y - Math.sin(a) * head * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x - head * Math.cos(a - Math.PI / 7), last.y - head * Math.sin(a - Math.PI / 7));
      ctx.lineTo(last.x - head * Math.cos(a + Math.PI / 7), last.y - head * Math.sin(a + Math.PI / 7));
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(first.x, first.y);
      // Midpoint curves, so fast strokes come out smooth rather than as polylines.
      for (let i = 1; i < s.points.length - 1; i++) { const p = s.points[i]!, n = s.points[i + 1]!; ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2); }
      ctx.lineTo(last.x, last.y); ctx.stroke();
    }
    ctx.restore();
  }
  function paint(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    for (const s of strokes) drawStroke(ctx, s);
    if (current) drawStroke(ctx, current);
  }
  const at = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });
  canvas.addEventListener('pointerdown', (e) => { if (!drawing || e.button !== 0) return; canvas.setPointerCapture(e.pointerId); current = { tool, color, size, points: [at(e)] }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    if (current.tool === 'arrow' || current.tool === 'box') current.points = [current.points[0]!, at(e)]; else current.points.push(at(e));
    paint();
  });
  const finish = (): void => { if (!current) return; if (current.points.length > 1) { strokes.push(current); redo.length = 0; } current = null; paint(); render(); };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });

  function setMode(next: boolean): void { drawing = next; overlay.className = `pen-sheet ${next ? 'draw' : 'click-through'}`; render(); }
  const undo = (): void => { const s = strokes.pop(); if (s) { redo.push(s); paint(); render(); } };
  const redoOne = (): void => { const s = redo.pop(); if (s) { strokes.push(s); paint(); render(); } };

  // Esc hands the desktop back; Ctrl+Z / Ctrl+Y work while drawing. Capture
  // phase so the pen wins over an app's own keys only while it holds the screen.
  const onKey = (e: KeyboardEvent): void => {
    if (!drawing) return;
    const k = (e.key ?? '').toLowerCase();
    if (k === 'escape') { e.preventDefault(); e.stopPropagation(); setMode(false); toast('Click-through: the apps take clicks again.'); }
    else if (e.ctrlKey && k === 'z') { e.preventDefault(); e.stopPropagation(); undo(); }
    else if (e.ctrlKey && k === 'y') { e.preventDefault(); e.stopPropagation(); redoOne(); }
  };
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', sizeCanvas);

  // ------------------------------------------------------------ capture
  async function screenshot(): Promise<void> {
    // The toolbar and the "Drawing" frame are not part of the picture anybody wanted.
    bar.style.visibility = 'hidden';
    overlay.classList.add('capturing');
    await nextFrame();
    const url = await captureScreen();
    bar.style.visibility = '';
    overlay.classList.remove('capturing');
    if (!url) { toast('Nothing was captured.'); return; }
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    toast(`Screenshot taken. ${await saveCapture(new Blob([bytes], { type: 'image/png' }), `corpdesk-${stamp()}.png`)}`);
  }
  async function deliver(handle: RecorderHandle): Promise<void> {
    const blob = await handle.stop();
    if (!blob) { toast('The recording produced nothing.'); return; }
    toast(`Recording saved. ${await saveCapture(blob, `corpdesk-${stamp()}.webm`)}`);
  }
  async function toggleRecording(): Promise<void> {
    if (recorder) { const handle = recorder; recorder = null; clearInterval(tick); render(); await deliver(handle); return; }
    if (!canRecord()) { toast('Recording is not available in this browser.'); return; }
    toast('Choose what to share...');
    const handle = await startRecording({ camera, corner, onEnded: () => {
      // Stopped from the browser's own "Stop sharing" bar.
      if (!recorder) return;
      const ending = recorder; recorder = null; clearInterval(tick); render(); void deliver(ending);
    } });
    if (!handle) { toast('No screen was shared, so nothing is being recorded.'); return; }
    recorder = handle;
    tick = window.setInterval(render, 1000);
    render();
    const parts = ['Recording the screen you picked'];
    if (handle.hasCamera()) parts.push('with your camera in the corner');
    if (handle.hasAudio()) parts.push(handle.hasSystemAudio() ? 'and microphone + system audio' : 'and your microphone');
    toast(handle.hasAudio() ? `${parts.join(' ')}.` : `${parts.join(' ')}, but with no audio: no microphone, or permission was declined.`);
  }

  // ------------------------------------------------------------ toolbar
  const btn = (ic: string, title: string, on: boolean, fn: () => void, extra = ''): HTMLButtonElement =>
    h('button', { class: `pen-btn ${on ? 'on' : ''} ${extra}`, type: 'button', title, 'aria-label': title, 'aria-pressed': on ? 'true' : 'false', onClick: fn }, icon(ic));
  const sep = (): HTMLElement => h('span', { class: 'pen-sep' });
  const grip = h('span', { class: 'pen-grip', title: 'Drag to move', 'aria-hidden': 'true' }, icon('grip'));
  let drag: Point | null = null;
  grip.addEventListener('pointerdown', (e) => { const r = bar.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top }; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
  grip.addEventListener('pointermove', (e) => { if (drag) place({ x: e.clientX - drag.x, y: e.clientY - drag.y }); });
  grip.addEventListener('pointerup', () => { if (!drag) return; drag = null; write(POS_KEY, JSON.stringify({ x: parseInt(bar.style.left, 10), y: parseInt(bar.style.top, 10) })); });

  function render(): void {
    bar.replaceChildren(...[
      grip,
      ...TOOLS.map((t) => btn(t.id, t.title, drawing && tool === t.id, () => { tool = t.id; if (!drawing) setMode(true); else render(); })),
      sep(),
      ...COLORS.map((c) => h('button', { class: `pen-swatch ${c === color ? 'on' : ''}`, type: 'button', title: c, 'aria-label': `Colour ${c}`, style: `background:${c}`, onClick: () => { color = c; if (tool === 'eraser') tool = 'pen'; if (!drawing) setMode(true); else render(); } })),
      sep(),
      ...[2, 3, 6].map((w) => h('button', { class: `pen-size ${size === w ? 'on' : ''}`, type: 'button', title: `${w === 2 ? 'Thin' : w === 3 ? 'Medium' : 'Thick'} line`, 'aria-label': `Line width ${w}`, onClick: () => { size = w; render(); } }, h('span', { style: `width:${w * 2 + 2}px;height:${w * 2 + 2}px` }))),
      sep(),
      btn('undo', 'Undo (Ctrl+Z)', false, undo, strokes.length ? '' : 'dim'),
      btn('redo', 'Redo (Ctrl+Y)', false, redoOne, redo.length ? '' : 'dim'),
      btn('clear', 'Clear every mark', false, () => { if (!strokes.length) return; redo.push(...strokes.reverse()); strokes = []; paint(); render(); }, strokes.length ? '' : 'dim'),
      sep(),
      btn('camera', 'Screenshot: the screen with your marks on it', false, () => { void screenshot(); }),
      recorder
        ? h('button', { class: 'pen-btn rec on', type: 'button', title: 'Stop recording and save', onClick: () => { void toggleRecording(); } }, icon('stop'), clock(recorder.elapsed()))
        : btn('record', 'Record a screen you pick, with your camera and narration', false, () => { void toggleRecording(); }, 'rec'),
      canRecordCamera() ? btn(camera ? 'video' : 'videoOff', recorder ? 'The camera cannot be changed while recording' : camera ? 'Camera bubble on: click to record the screen alone' : 'Camera bubble off: click to include yourself', camera, () => {
        if (recorder) { toast('Stop the recording before changing the camera.'); return; }
        camera = !camera; write(CAM_KEY, camera ? '1' : '0'); render();
      }) : null,
      canRecordCamera() && camera ? btn('corner', `Camera bubble: ${corner.replace('-', ' ')}. Click to move it.`, false, () => {
        const order: CameraCorner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
        corner = order[(order.indexOf(corner) + 1) % order.length]!;
        recorder?.setCameraCorner(corner);
        render();
        toast(`Camera bubble: ${corner.replace('-', ' ')}`);
      }) : null,
      // The mode switch is the control that keeps the desktop usable.
      h('button', { class: `pen-mode ${drawing ? 'drawing' : ''}`, type: 'button', title: drawing ? 'The pen is taking clicks. Switch to let them reach the desktop (Esc).' : 'Clicks reach the desktop. Switch to draw again.', onClick: () => setMode(!drawing) },
        icon(drawing ? 'pen' : 'pointer'), drawing ? 'Drawing' : 'Click-through'),
      btn('close', 'Close Screen Pen', false, () => close?.()),
    ].filter((x): x is HTMLElement => !!x));
  }

  close = (): void => {
    // A recording left running when the toolbar goes is a recording nobody can stop.
    if (recorder) void toggleRecording();
    clearInterval(tick);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', sizeCanvas);
    overlay.remove(); bar.remove();
    trayBtn.classList.remove('on');
    close = null;
  };

  render();
  document.body.append(overlay, bar);
  sizeCanvas();
  trayBtn.classList.add('on');
  toast('Screen Pen is ready in Click-through. Pick a tool to draw; Esc gives the desktop back.');
}

// ---------------------------------------------------------------- entry points
const trayBtn = h('button', { class: 'ia-pen-toggle', type: 'button', title: 'Screen Pen (Ctrl+Shift+D)\nDraw on the screen, take a screenshot or record', 'aria-label': 'Screen Pen', onClick: () => toggleScreenPen() }, icon('pen'));
document.querySelector('.system-tray')?.prepend(trayBtn);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key ?? '').toLowerCase() === 'd') { e.preventDefault(); toggleScreenPen(); }
});
// Start menu, search and the desktop: an app entry that toggles the pen instead of opening a window.
const apps = APPS();
if (!apps.some((a) => a.id === 'pen')) apps.push({ id: 'pen', name: 'Screen Pen', short: 'Screen Pen', bg: 'transparent', fg: '#fff', icon: `<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="2" y="2" width="30" height="30" rx="7" fill="#0f6cbd"/><path d="M20.5 8.5l5 5L15 24h-5v-5z" fill="#fff"/><path d="M18.5 10.5l5 5" stroke="#0f6cbd" stroke-width="1.6"/><path d="M8 27h18" stroke="#ffb900" stroke-width="2.4" stroke-linecap="round"/></svg>` });
const previousOpen = G.openApp as (id: string) => void;
G.openApp = (id: string): void => { if (id === 'pen') toggleScreenPen(); else previousOpen(id); };
Object.assign((G.CorpDesk ||= {}), { toggleScreenPen });
