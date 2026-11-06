/**
 * "Pwd" on the desktop: Notepad open on C:\Users\<you>\Desktop\Pwd.txt, the
 * lab accounts and their training passwords (kept current as you reset them).
 * The same file is in File Explorer and Get-Content in PowerShell.
 */
import { S, toast, writePwdFile } from '../corp.ts';
import { h } from '../dom.ts';
import { registerTool, redrawTool } from '../host.ts';
import { dialog, menubar } from '../ui.ts';

const path = (): string => `C:\\Users\\${S().technician}\\Desktop\\Pwd.txt`;
let zoom = 100;
let wrap = false;
let status = true;

function find(area: HTMLTextAreaElement): void {
  const input = h('input', { class: 'ad2-input', 'aria-label': 'Find what' });
  dialog('Find', h('label', { class: 'ad2-field' }, 'Find what:', input), [['Find Next', () => {
    const q = input.value;
    if (!q) return false;
    const i = area.value.toLowerCase().indexOf(q.toLowerCase(), area.selectionEnd);
    const at = i >= 0 ? i : area.value.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) { toast(`Cannot find "${q}"`); return false; }
    area.focus();
    area.setSelectionRange(at, at + q.length);
  }, 'primary'], ['Cancel', () => undefined]]);
}

registerTool({
  id: 'pwd', name: 'Pwd - Notepad', short: 'Pwd', width: 880, height: 620,
  icon: '<path d="M8 3h13l6 6v22H8z" fill="#fff" stroke="#7a8591" stroke-width="1.4"/><path d="M21 3v6h6" fill="#e6e9ee" stroke="#7a8591" stroke-width="1.4"/><path d="M11 14h12M11 18h12M11 22h9" stroke="#2f7fd8" stroke-width="1.6"/><rect x="18" y="22" width="11" height="9" rx="1.5" fill="#f3b23a"/><path d="M20.5 22v-2.5a3 3 0 0 1 6 0V22" fill="none" stroke="#8a6d1f" stroke-width="1.4"/>',
  draw(host) {
    if (!S().files?.[path()]) writePwdFile();
    const text: string = S().files?.[path()] ?? '';
    const area = h('textarea', { class: 'np-text', readonly: true, spellcheck: 'false', 'aria-label': 'Pwd.txt', 'data-scroll': 'np', style: `font-size:${(13 * zoom) / 100}px;white-space:${wrap ? 'pre-wrap' : 'pre'}` }, text) as HTMLTextAreaElement;
    const redraw = (): void => redrawTool('pwd');
    host.append(h('div', { class: 'np' },
      menubar('np-menu', [
        ['File', () => [
          { label: 'Save as...', shortcut: 'Ctrl+Shift+S', action: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'Pwd.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } },
          { label: 'Refresh from lab', action: () => { writePwdFile(); redraw(); } },
          '-',
          { label: 'Exit', action: () => (globalThis as any).CorpDesk?.closeApp?.('pwd') },
        ]],
        ['Edit', () => [
          { label: 'Copy', shortcut: 'Ctrl+C', action: () => { const sel = area.value.slice(area.selectionStart, area.selectionEnd) || area.value; void navigator.clipboard?.writeText(sel).then(() => toast('Copied.'), () => toast('Copy is blocked here: select the text and press Ctrl+C.')); } },
          { label: 'Find...', shortcut: 'Ctrl+F', action: () => find(area) },
          { label: 'Select all', shortcut: 'Ctrl+A', action: () => { area.focus(); area.select(); } },
        ]],
        ['View', () => [
          { label: 'Zoom in', shortcut: 'Ctrl+Plus', action: () => { zoom = Math.min(300, zoom + 10); redraw(); } },
          { label: 'Zoom out', shortcut: 'Ctrl+Minus', action: () => { zoom = Math.max(50, zoom - 10); redraw(); } },
          { label: 'Restore default zoom', shortcut: 'Ctrl+0', action: () => { zoom = 100; redraw(); } },
          '-',
          { label: 'Word wrap', checked: wrap, action: () => { wrap = !wrap; redraw(); } },
          { label: 'Status bar', checked: status, action: () => { status = !status; redraw(); } },
        ]],
      ]),
      area,
      status ? h('div', { class: 'np-status' }, h('span', null, path()), h('span', null, `${zoom}%   |   ${text.split(/\r?\n/).length} lines   |   Windows (CRLF)   |   UTF-8`)) : null));
    area.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); find(area); } });
  },
});
