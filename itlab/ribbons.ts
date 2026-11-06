/**
 * Working ribbons for the practice Word, Excel and PowerPoint, and real menus
 * for Event Viewer. CORP Desk draws each app; this layer takes over the ribbon
 * tabs (which only showed "requires native Office") so every tab switches to
 * its own commands, and replaces Event Viewer's single "Action" button with
 * Action / View / Help menus. The apps' own Home ribbons and handlers are kept.
 */
import { G, S, save, toast } from './corp.ts';
import { h } from './dom.ts';
import { dialog, menubar } from './ui.ts';

const active: Record<string, string> = { word: 'Home', excel: 'Home', powerpoint: 'Home' };
let lastCell = 'A1';
document.addEventListener('focusin', (e) => { const c = (e.target as HTMLElement)?.dataset?.cell; if (c) lastCell = c; });

const office = (): any => S().office;
const rb = (label: string, fn: () => void, title?: string): HTMLElement => h('button', { type: 'button', title: title ?? label, onMousedown: (e: Event) => e.preventDefault(), onClick: fn }, label);
const group = (name: string, ...kids: HTMLElement[]): HTMLElement => h('div', { class: 'rb-group' }, h('div', { class: 'rb-items' }, kids), h('div', { class: 'rb-name' }, name));
const sep = (): HTMLElement => h('span', { class: 'rb-sep' });

// ---------------------------------------------------------------- Word
function wordPanel(tab: string): HTMLElement | null {
  const editor = document.getElementById('wordEditor') as HTMLElement | null;
  if (!editor) return null;
  const w = (office().word.view ||= { margin: 'Normal', orient: 'Portrait', cols: 1, zoom: 100, spell: true, dark: false });
  const exec = (cmd: string, arg?: string): void => { editor.focus(); document.execCommand(cmd, false, arg); editor.dispatchEvent(new Event('input')); };
  const apply = (): void => { save(); G.CorpDesk.renderWord(); };
  if (tab === 'Insert') return h('div', { class: 'rb' },
    group('Tables', rb('▦ Table 3×3', () => exec('insertHTML', `<table class="doc-table"><tbody>${('<tr>' + '<td>&nbsp;</td>'.repeat(3) + '</tr>').repeat(3)}</tbody></table><p></p>`))),
    group('Text', rb('📅 Date & Time', () => exec('insertText', new Date().toLocaleString())), rb('🔗 Link', () => { const i = h('input', { class: 'ad2-input', placeholder: 'https://' }); dialog('Insert link', h('label', { class: 'ad2-field' }, 'Address', i), [['OK', () => { const url = i.value.trim(); if (!/^https?:\/\/\S+$/i.test(url)) { toast('Enter a web address starting with http:// or https://'); return false; } exec('createLink', url); }, 'primary'], ['Cancel', () => undefined]]); })),
    group('Pages', rb('— Horizontal line', () => exec('insertHorizontalRule')), rb('⤓ Page break', () => exec('insertHTML', '<hr class="page-break"><p></p>'))),
    group('IT templates', rb('Incident report', () => exec('insertHTML', '<h2>Incident report</h2><p><b>Ticket:</b> LAB-___ &nbsp; <b>Priority:</b> ___</p><p><b>Symptom:</b> </p><p><b>Root cause:</b> </p><p><b>Fix applied:</b> </p><p><b>Verified by:</b> </p>')), rb('Change request', () => exec('insertHTML', '<h2>Change request</h2><p><b>Change:</b> </p><p><b>Reason:</b> </p><p><b>Risk and rollback:</b> </p><p><b>Approved by:</b> </p>'))));
  if (tab === 'Layout') return h('div', { class: 'rb' },
    group('Margins', ...['Narrow', 'Normal', 'Wide'].map((m) => rb(`${w.margin === m ? '✓ ' : ''}${m}`, () => { w.margin = m; apply(); }))),
    group('Orientation', ...['Portrait', 'Landscape'].map((o) => rb(`${w.orient === o ? '✓ ' : ''}${o}`, () => { w.orient = o; apply(); }))),
    group('Columns', ...[1, 2].map((c) => rb(`${w.cols === c ? '✓ ' : ''}${c === 1 ? 'One' : 'Two'}`, () => { w.cols = c; apply(); }))));
  if (tab === 'Review') return h('div', { class: 'rb' },
    group('Proofing', rb(`${w.spell ? '✓ ' : ''}Spelling & Grammar`, () => { w.spell = !w.spell; apply(); }), rb('Word Count', () => {
      const text = editor.innerText;
      dialog('Word Count', h('dl', { class: 'ad2-kv' }, h('dt', null, 'Pages'), h('dd', null, String(Math.max(1, Math.ceil(text.length / 3000)))), h('dt', null, 'Words'), h('dd', null, String(text.trim().split(/\s+/).filter(Boolean).length)), h('dt', null, 'Characters (with spaces)'), h('dd', null, String(text.length)), h('dt', null, 'Paragraphs'), h('dd', null, String(editor.querySelectorAll('p,h1,h2,li').length))), [['Close', () => undefined, 'primary']]);
    })),
    group('Comments', rb('💬 New Comment', () => { const sel = window.getSelection()?.toString(); if (!sel) { toast('Select some text to comment on.'); return; } const i = h('input', { class: 'ad2-input' }); dialog('New comment', h('label', { class: 'ad2-field' }, `On "${sel.slice(0, 40)}"`, i), [['Post', () => { exec('insertHTML', `<mark class="doc-comment" title="${i.value.replace(/[<>"&]/g, '')}">${sel.replace(/[<>&]/g, '')}</mark>`); }, 'primary'], ['Cancel', () => undefined]]); })),
    group('Speech', rb('🔊 Read Aloud', () => { if (!('speechSynthesis' in window)) { toast('Read Aloud is not available here.'); return; } speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(editor.innerText.slice(0, 4000))); }), rb('■ Stop', () => speechSynthesis?.cancel())));
  if (tab === 'View') return h('div', { class: 'rb' },
    group('Zoom', rb('－', () => { w.zoom = Math.max(50, w.zoom - 10); apply(); }), h('span', { class: 'rb-val' }, `${w.zoom}%`), rb('＋', () => { w.zoom = Math.min(200, w.zoom + 10); apply(); }), rb('100%', () => { w.zoom = 100; apply(); })),
    group('Page', rb(`${w.dark ? '✓ ' : ''}Dark page`, () => { w.dark = !w.dark; apply(); })));
  return null;
}
function styleWord(): void {
  const editor = document.getElementById('wordEditor') as HTMLElement | null;
  const w = office()?.word?.view;
  if (!editor || !w) return;
  editor.style.padding = { Narrow: '24px 28px', Normal: '56px 64px', Wide: '72px 110px' }[w.margin as string] ?? '';
  editor.style.maxWidth = w.orient === 'Landscape' ? '1000px' : '';
  editor.style.columnCount = String(w.cols ?? 1);
  editor.style.zoom = String((w.zoom ?? 100) / 100);
  editor.spellcheck = w.spell !== false;
  editor.style.background = w.dark ? '#1f1f1f' : '';
  editor.style.color = w.dark ? '#eee' : '';
}

// ---------------------------------------------------------------- Excel
const COLS = 'ABCDEFGHIJKL'.split('');
function excelPanel(tab: string): HTMLElement | null {
  const d = office().excel;
  const view = (d.view ||= { grid: true, freeze: false, zoom: 100 });
  const apply = (): void => { save(); G.CorpDesk.renderExcel(); };
  const set = (ref: string, v: string): void => { d.cells[ref] = v; apply(); };
  const col = lastCell.replace(/\d+/g, ''), row = Number(lastCell.replace(/\D+/g, '')) || 1;
  const above = (fn: string): void => { if (row < 2) { toast('Select the empty cell under a column of numbers first.'); return; } set(lastCell, `=${fn}(${col}1:${col}${row - 1})`); };
  if (tab === 'Insert') return h('div', { class: 'rb' },
    group('Values', rb("Today's date", () => set(lastCell, new Date().toLocaleDateString())), rb('Current time', () => set(lastCell, new Date().toLocaleTimeString()))),
    group('IT templates', rb('Ticket log header', () => { ['Ticket', 'Requester', 'Category', 'Priority', 'Status', 'Opened', 'Resolved', 'Minutes'].forEach((t, i) => { d.cells[`${COLS[i]}1`] = t; }); apply(); }), rb('Asset inventory header', () => { ['Asset tag', 'Device', 'Owner', 'Department', 'OS', 'Warranty end', 'Status'].forEach((t, i) => { d.cells[`${COLS[i]}1`] = t; }); apply(); })));
  if (tab === 'Formulas') return h('div', { class: 'rb' },
    group(`Function library (into ${lastCell})`, ...(['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX'] as const).map((f) => rb(f === 'SUM' ? 'Σ AutoSum' : f, () => above(f), `${f} of the cells above ${lastCell}`))),
    group('Formula auditing', rb('Show formula', () => toast(`${lastCell}: ${d.cells[lastCell] ?? '(empty)'}`))));
  if (tab === 'Data') {
    const sort = (desc: boolean): void => {
      const rows = Array.from({ length: 29 }, (_, i) => i + 2).map((r) => COLS.map((c) => d.cells[`${c}${r}`]));
      const ci = COLS.indexOf(col);
      const filled = rows.filter((r) => r.some((v) => v !== undefined && v !== ''));
      filled.sort((a, b) => { const x = a[ci] ?? '', y = b[ci] ?? ''; const nx = Number(x), ny = Number(y); const cmp = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '' ? nx - ny : String(x).localeCompare(String(y)); return desc ? -cmp : cmp; });
      for (let r = 2; r <= 30; r++) for (const c of COLS) delete d.cells[`${c}${r}`];
      filled.forEach((vals, i) => vals.forEach((v, j) => { if (v !== undefined && v !== '') d.cells[`${COLS[j]}${i + 2}`] = v; }));
      apply();
    };
    return h('div', { class: 'rb' }, group(`Sort by column ${col} (row 1 is the header)`, rb('A→Z Sort ascending', () => sort(false)), rb('Z→A Sort descending', () => sort(true))), group('Data tools', rb(`Clear column ${col}`, () => { for (let r = 1; r <= 30; r++) delete d.cells[`${col}${r}`]; apply(); })));
  }
  if (tab === 'View') return h('div', { class: 'rb' },
    group('Show', rb(`${view.grid ? '✓ ' : ''}Gridlines`, () => { view.grid = !view.grid; apply(); }), rb(`${view.freeze ? '✓ ' : ''}Freeze top row`, () => { view.freeze = !view.freeze; apply(); })),
    group('Zoom', rb('－', () => { view.zoom = Math.max(50, view.zoom - 10); apply(); }), h('span', { class: 'rb-val' }, `${view.zoom}%`), rb('＋', () => { view.zoom = Math.min(200, view.zoom + 10); apply(); }), rb('100%', () => { view.zoom = 100; apply(); })));
  return null;
}
function styleExcel(): void {
  const grid = document.querySelector<HTMLElement>('#appBody .excel-grid');
  const v = office()?.excel?.view;
  if (!grid || !v) return;
  grid.classList.toggle('rb-nogrid', !v.grid);
  grid.classList.toggle('rb-freeze', !!v.freeze);
  grid.style.zoom = String((v.zoom ?? 100) / 100);
}

// ---------------------------------------------------------------- PowerPoint
const THEMES: Record<string, [string, string, string]> = { light: ['#ffffff', '#1b1b1b', 'Office'], dark: ['#18314e', '#ffffff', 'Midnight'], blue: ['linear-gradient(135deg,#0f6cbd,#2e8ae6)', '#ffffff', 'Blue'], green: ['linear-gradient(135deg,#107c41,#2fb380)', '#ffffff', 'Fresh'], warm: ['linear-gradient(135deg,#fff4e5,#ffd8a8)', '#4a2a00', 'Sunrise'] };
function slideShow(from: number): void {
  const d = office().powerpoint;
  let i = from;
  const stage = h('div', { class: 'rb-show', tabindex: '0' });
  const draw = (): void => {
    const s = d.slides[i];
    const [bg, fg] = THEMES[s.theme] ?? THEMES.light!;
    stage.replaceChildren(h('div', { class: 'rb-slide', style: `background:${bg};color:${fg}` }, h('h1', null, s.title), h('p', null, s.body)), h('div', { class: 'rb-show-bar' }, `${i + 1} / ${d.slides.length} · ←/→ to move · Esc to end`));
  };
  const end = (): void => { stage.remove(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
  stage.addEventListener('keydown', (e) => { if (e.key === 'Escape') end(); if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { if (i < d.slides.length - 1) { i++; draw(); } else end(); } if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key) && i > 0) { i--; draw(); } });
  stage.addEventListener('click', () => { if (i < d.slides.length - 1) { i++; draw(); } else end(); });
  document.body.appendChild(stage);
  draw();
  stage.focus();
  void stage.requestFullscreen?.().catch(() => undefined);
}
function pptPanel(tab: string): HTMLElement | null {
  const d = office().powerpoint;
  const apply = (): void => { save(); G.CorpDesk.renderPowerPoint(); };
  const click = (id: string): void => (document.getElementById(id) as HTMLButtonElement | null)?.click();
  if (tab === 'Insert') return h('div', { class: 'rb' },
    group('Slides', rb('＋ New Slide', () => click('pptAdd')), rb('⧉ Duplicate', () => click('pptDuplicate'))),
    group('Text', rb('• Bullet point', () => { const s = d.slides[d.active]; s.body = `${s.body}${s.body ? '\n' : ''}• New point`; apply(); }), rb('📅 Date', () => { const s = d.slides[d.active]; s.body = `${s.body}${s.body ? '\n' : ''}${new Date().toLocaleDateString()}`; apply(); })),
    group('IT templates', rb('Incident review slide', () => { d.slides.splice(d.active + 1, 0, { title: 'Incident review: LAB-___', body: '• What happened\n• Impact and who was affected\n• Root cause\n• Fix and verification\n• What we will do differently', theme: d.slides[d.active]?.theme ?? 'light' }); d.active++; apply(); })));
  if (tab === 'Design') return h('div', { class: 'rb' },
    group('Themes (this slide)', ...Object.entries(THEMES).map(([k, [bg, fg, name]]) => h('button', { type: 'button', class: 'rb-theme', title: name, style: `background:${bg};color:${fg}`, onClick: () => { d.slides[d.active].theme = k; apply(); } }, name))),
    group('Apply', rb('Apply theme to all slides', () => { const t = d.slides[d.active].theme; d.slides.forEach((s: any) => { s.theme = t; }); apply(); })));
  if (tab === 'Slide Show') return h('div', { class: 'rb' }, group('Start Slide Show', rb('▶ From Beginning', () => slideShow(0)), rb('▶ From Current Slide', () => slideShow(d.active))));
  if (tab === 'View') return h('div', { class: 'rb' }, group('Presentation views', rb('Normal', () => apply()), rb('Slide Sorter', () => {
    const grid = h('div', { class: 'rb-sorter' }, d.slides.map((s: any, i: number) => { const [bg, fg] = THEMES[s.theme] ?? THEMES.light!; return h('button', { type: 'button', class: 'rb-sort-slide', style: `background:${bg};color:${fg}`, onClick: () => { d.active = i; shade.remove(); apply(); } }, h('b', null, `${i + 1}. ${s.title}`)); }));
    const shade = h('div', { class: 'ia-shade' }, h('div', { class: 'ia-dialog ia', style: 'width:min(900px,96vw)' }, h('h2', null, 'Slide Sorter'), grid, h('div', { class: 'ia-dialog-foot' }, h('button', { class: 'ad2-btn primary', type: 'button', onClick: () => shade.remove() }, 'Close'))));
    document.body.appendChild(shade);
  })));
  return null;
}
function stylePpt(): void {
  const s = office()?.powerpoint?.slides?.[office().powerpoint.active];
  const slide = document.querySelector<HTMLElement>('#appBody .ppt-slide');
  if (!s || !slide) return;
  const [bg, fg] = THEMES[s.theme] ?? THEMES.light!;
  slide.style.background = bg; slide.style.color = fg;
  document.querySelectorAll<HTMLElement>('#appBody .ppt-thumb').forEach((t, i) => { const th = THEMES[office().powerpoint.slides[i]?.theme] ?? THEMES.light!; t.style.borderLeft = `6px solid ${th[0].includes('gradient') ? '#0f6cbd' : th[0]}`; });
}

// ---------------------------------------------------------------- take over the tabs after each draw
const PANELS: Record<string, (tab: string) => HTMLElement | null> = { word: wordPanel, excel: excelPanel, powerpoint: pptPanel };
const STYLE: Record<string, () => void> = { word: styleWord, excel: styleExcel, powerpoint: stylePpt };
function decorateOffice(): void {
  const appEl = document.querySelector<HTMLElement>('#appBody .office-app:not([data-rb])');
  if (!appEl) return;
  const win = appEl.closest<HTMLElement>('.app-window');
  const id = win?.dataset.app ?? '';
  if (!PANELS[id]) return;
  appEl.dataset.rb = '1';
  const home = appEl.querySelector<HTMLElement>('.office-ribbon');
  const tabs = [...appEl.querySelectorAll<HTMLButtonElement>('[data-office-tab]')];
  const show = (tab: string): void => {
    active[id] = tab;
    tabs.forEach((b) => b.classList.toggle('selected', b.dataset.officeTab === tab));
    appEl.querySelector('.rb')?.remove();
    const panel = tab === 'Home' ? null : PANELS[id]!(tab);
    if (home) home.style.display = panel ? 'none' : '';
    if (panel) home?.after(panel);
  };
  for (const b of tabs) b.onclick = () => { if (b.dataset.officeTab === 'File') { G.openApp('office'); return; } show(b.dataset.officeTab!); };
  show(active[id] ?? 'Home');
  STYLE[id]?.();
}

// ---------------------------------------------------------------- Event Viewer menus
function decorateEvents(): void {
  const menu = document.querySelector<HTMLElement>('.app-window[data-app="events"] .mmc-menu:not([data-rb])');
  if (!menu) return;
  menu.dataset.rb = '1';
  const click = (sel: string): void => (document.querySelector(`.app-window[data-app="events"] ${sel}`) as HTMLElement | null)?.click();
  const filter = (): void => {
    const input = h('input', { class: 'ad2-input', placeholder: 'Event ID, account or text (e.g. 4740 or hr01)', 'aria-label': 'Filter' });
    dialog('Filter Current Log', h('label', { class: 'ad2-field' }, 'Show events containing', input), [['OK', () => { const box = document.querySelector<HTMLInputElement>('.app-window[data-app="events"] input'); if (box) { box.value = input.value; box.dispatchEvent(new Event('input', { bubbles: true })); } else toast('Use the search box above the event list.'); }, 'primary'], ['Cancel', () => undefined]]);
  };
  const bar = menubar('mmc-menu ev-menubar', [
    ['File', () => [{ label: 'Save All Events As...', action: () => click('#eventExportTool') }, '-', { label: 'Exit', action: () => G.CorpDesk?.closeApp?.('events') }]],
    ['Action', () => [{ label: 'Refresh', shortcut: 'F5', action: () => click('#eventRefresh') }, { label: 'Filter Current Log...', action: filter }, { label: 'Clear Filter', action: () => { const box = document.querySelector<HTMLInputElement>('.app-window[data-app="events"] input'); if (box) { box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true })); } } }, '-', { label: 'Save All Events As...', action: () => click('#eventExportTool') }]],
    ['View', () => [{ label: 'Refresh', shortcut: 'F5', action: () => click('#eventRefresh') }]],
    ['Help', () => [{ label: 'Help Topics', action: () => click('#eventHelp') }, { label: 'Common event IDs', action: () => dialog('Common event IDs for the service desk', h('dl', { class: 'ad2-kv' }, ...[['4624', 'Successful logon'], ['4625', 'Failed logon (bad password, disabled, locked)'], ['4634', 'Logoff'], ['4724', 'Password reset by an admin'], ['4723', 'User changed own password'], ['4740', 'Account locked out'], ['4767', 'Account unlocked'], ['4722 / 4725', 'Account enabled / disabled'], ['7031', 'Service terminated unexpectedly'], ['5136', 'Directory object modified']].flatMap(([k, v]) => [h('dt', null, k!), h('dd', null, v!)])), [['Close', () => undefined, 'primary']]) }]],
  ]);
  menu.replaceWith(bar);
  bar.dataset.rb = '1';
  // Keep the original buttons in the page (hidden) so their handlers still work.
  menu.style.display = 'none';
  bar.after(menu);
}

new MutationObserver(() => { decorateOffice(); decorateEvents(); }).observe(document.body, { childList: true, subtree: true });
