/**
 * Active Directory Users and Computers for CORP Desk: the Meridian IAM Range
 * console (aduc/*.ts, copied unchanged) mounted in CORP Desk's AD window and
 * connected to its directory through aduc/shim/session.ts.
 *
 * Built into dist/aduc.js by `npm run build:aduc`; loaded after windows.js.
 */
import { renderActiveDirectoryWindow } from './window';
import { Dir, runCapability, syncComputers, validatePassword, type VmServices } from './shim/session';

const g = globalThis as any;
const listeners = new Set<() => void>();
let queued = false;

// Every CORP Desk change ends in save(): tell open consoles once per frame, so a
// change made in PowerShell, a ticket or another window shows up here too.
const originalSave = g.save as (...args: unknown[]) => unknown;
g.save = function (this: unknown, ...args: unknown[]) {
  const r = originalSave.apply(this, args);
  if (!queued && listeners.size) {
    queued = true;
    requestAnimationFrame(() => { queued = false; syncComputers(); listeners.forEach((fn) => fn()); });
  }
  return r;
};

function services(): VmServices {
  return {
    dir: new Dir(),
    idp: { validatePassword },
    audit: null,
    cloud: null,
    pim: null,
    tickets: null,
    changed: () => g.save(),
    onWorldChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    world: () => g.state,
    domains: () => ['corp.example.test'],
  };
}

/** CORP Desk calls renderDirectory() whenever the AD window is shown; the console keeps itself current after that. */
g.renderDirectory = (): void => {
  const body = document.getElementById('appBody');
  if (!body || body.querySelector(':scope > .corp-aduc')) return;
  body.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'corp-aduc';
  host.style.cssText = 'display:flex;flex-direction:column;height:100%;';
  body.appendChild(host);
  syncComputers();
  renderActiveDirectoryWindow(host, services());
};

// The console's change path, for verify-dom.cjs to drive every capability against CORP Desk's state.
(g.CorpDesk ||= {}).aducCapability = (capId: string, args: Record<string, string>) => runCapability(g.state, capId, args);
