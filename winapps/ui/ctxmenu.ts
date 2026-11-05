/** A Windows 11 context menu for the copied apps (class "cm", which Task Manager checks before redrawing). */
export type MenuEntry = { label: string; onClick?: () => void; checked?: boolean; disabled?: boolean; shortcut?: string } | '-';

export function showMenu(x: number, y: number, items: MenuEntry[]): void {
  document.querySelectorAll('.cm').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'cm';
  menu.setAttribute('role', 'menu');
  for (const it of items) {
    if (it === '-') { menu.appendChild(Object.assign(document.createElement('div'), { className: 'cm-sep' })); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cm-item';
    b.setAttribute('role', 'menuitem');
    b.disabled = !!it.disabled;
    const check = document.createElement('span');
    check.className = 'cm-check';
    check.textContent = it.checked ? '✓' : '';
    const label = document.createElement('span');
    label.textContent = it.label;
    b.append(check, label);
    b.addEventListener('click', () => { menu.remove(); it.onClick?.(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(x, innerWidth - r.width - 4))}px`;
  menu.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height - 4))}px`;
  const close = (e: Event): void => { if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
