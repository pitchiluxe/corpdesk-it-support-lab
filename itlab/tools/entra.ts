/**
 * Microsoft Entra admin center (training): authentication methods and MFA
 * re-registration, revoking sessions, and devices with their BitLocker
 * recovery keys, which is where a service desk finds them.
 */
import { DOMAIN, S, cloudUsers, corpUser, evidence, lab, log, nowIso, save, toast } from '../corp.ts';
import { fmtDate, h } from '../dom.ts';
import { I, adminShell, badge, btn, card, cmd, cmdbar, dialog, kv, note, page, panel, table } from '../ui.ts';
import { registerTool } from '../host.ts';

let nav = 'users';
let selected: string | null = null;
let tab = 'Overview';
let device: string | null = null;
const shownKeys = new Set<string>();
let query = '';

function userPanel(sam: string): HTMLElement {
  const L = lab();
  const u = corpUser(sam);
  const close = (): void => { selected = null; save(); };
  if (!u) return panel('User not found', '', close, null, null, null, note('This account no longer exists.'));
  const methods = L.methods[sam] ?? [];
  let body: HTMLElement;
  if (tab === 'Overview') {
    body = h('div', null,
      kv([['User principal name', `${sam}@${DOMAIN}`], ['Account enabled', u.enabled ? 'Yes' : 'No'], ['On-premises sync', 'Yes (Entra Connect)'], ['Department', u.dept], ['Last sign-in', u.lastLogon ? fmtDate(u.lastLogon) : 'Today'], ['Sessions revoked', L.sessionsRevoked[sam] ? fmtDate(L.sessionsRevoked[sam]!) : 'Never']]),
      cmdbar(cmd(I.block, 'Revoke sessions', () => {
        dialog('Revoke sessions?', h('p', null, `${u.name} will have to sign in again on every device and app, with MFA. Use this after a password reset, a lost device or a suspected compromise.`), [['Yes', () => { L.sessionsRevoked[sam] = nowIso(); log(6010, `${sam}: all sessions and refresh tokens revoked (Entra)`); evidence('revoke'); save(); }, 'primary'], ['No', () => undefined]]);
      })));
  } else {
    body = h('div', null,
      note('Remove a method only after you have verified who is asking. A caller who cannot be verified must not have their MFA changed.', 'warn'),
      table<any>([['Method', (m) => h('b', null, m.type)], ['Detail', (m) => m.detail], ['Added', (m) => fmtDate(m.added)], ['', (m) => btn('Delete', () => {
        dialog('Delete authentication method?', h('p', null, `Delete ${m.type} (${m.detail}) from ${u.name}?`), [['Delete', () => { L.methods[sam] = (L.methods[sam] ?? []).filter((x) => x.id !== m.id); log(6050, `${sam}: authentication method ${m.type} (${m.detail}) deleted`); save(); }, 'primary'], ['Cancel', () => undefined]]);
      })]], methods, { empty: 'No authentication methods. The user will register new ones at next sign-in.' }),
      card('Multifactor authentication',
        L.reregister[sam] ? note('The user must register MFA again at next sign-in.', 'ok') : h('p', { class: 'ad2-muted' }, 'Ask the user to register their MFA methods again the next time they sign in (for a new phone).'),
        h('div', { class: 'ad2-row' }, btn('Require re-register multifactor authentication', () => { L.reregister[sam] = true; log(6051, `${sam}: required to re-register MFA`); save(); }, 'primary'))));
  }
  return panel(u.name, `${sam}@${DOMAIN}`, close, ['Overview', 'Authentication methods'], tab, (t) => { tab = t; save(); }, body);
}

function devicePanel(name: string): HTMLElement {
  const L = lab();
  const d = L.devices.find((x) => x.name === name);
  const close = (): void => { device = null; save(); };
  if (!d) return panel('Device not found', '', close, null, null, null);
  const owner = corpUser(d.owner);
  return panel(d.name, `Owner: ${owner?.name ?? d.owner}`, close, null, null, null,
    kv([['Operating system', d.os], ['Join type', 'Microsoft Entra hybrid joined'], ['Compliant', d.compliant ? 'Yes' : 'No'], ['MDM', 'Microsoft Intune'], ['Last check-in', fmtDate(d.lastSync)]]),
    card('BitLocker keys',
      note('Match the Key ID the user reads from the recovery screen (the first 8 characters are enough) before you give out a key. Each key you view is audited.', 'warn'),
      table<any>([['Key ID', (k) => h('code', null, k.id)], ['Created', (k) => fmtDate(k.created)], ['Recovery key', (k) => (shownKeys.has(k.id) ? h('code', { class: 'ad2-key' }, k.key) : btn('Show recovery key', () => { shownKeys.add(k.id); log(6060, `BitLocker recovery key ${k.id.slice(0, 8)} for ${d.name} viewed by ${S().technician}`); evidence('bitlocker-view'); save(); }))]], d.keys)));
}

function body(): { page: HTMLElement; panel: HTMLElement | null } {
  const L = lab();
  const search = (placeholder: string): HTMLElement => {
    const input = h('input', { class: 'ad2-input', placeholder, value: query, 'data-key': `${nav}-q`, 'aria-label': placeholder });
    input.addEventListener('input', () => { query = input.value; save(); });
    return input;
  };
  if (nav === 'users') {
    const list = cloudUsers().filter((u) => !query || `${u.name} ${u.sam}`.toLowerCase().includes(query.toLowerCase()));
    return { panel: selected ? userPanel(selected) : null, page: page('Users', cmdbar(cmd(I.refresh, 'Refresh', () => save())), search('Search by name or username'),
      table<any>([['Display name', (u) => h('b', null, u.name)], ['User principal name', (u) => `${u.sam}@${DOMAIN}`], ['Account enabled', (u) => (u.enabled ? badge('Yes', 'ok') : badge('No', 'bad'))], ['MFA methods', (u) => String((L.methods[u.sam] ?? []).length)]], list, { onRow: (u) => { selected = u.sam; tab = 'Overview'; save(); }, selected: (u) => u.sam === selected })) };
  }
  if (nav === 'devices') {
    const list = L.devices.filter((d) => !query || `${d.name} ${d.owner}`.toLowerCase().includes(query.toLowerCase()));
    return { panel: device ? devicePanel(device) : null, page: page('Devices', search('Search by device name or owner'),
      table<any>([['Name', (d) => h('b', null, d.name)], ['Owner', (d) => corpUser(d.owner)?.name ?? d.owner], ['OS', (d) => d.os], ['Compliant', (d) => (d.compliant ? badge('Yes', 'ok') : badge('No', 'bad'))], ['Last check-in', (d) => fmtDate(d.lastSync)]], list, { onRow: (d) => { device = d.name; save(); }, selected: (d) => d.name === device })) };
  }
  return { panel: null, page: page('Overview', h('div', { class: 'ad2-cards' },
    card('Tenant', kv([['Name', 'CORP'], ['Primary domain', DOMAIN], ['Users', String(cloudUsers().length)], ['Devices', String(L.devices.length)]])),
    card('Service desk tasks', h('ul', { class: 'ad2-list' }, h('li', null, 'Lost phone: delete the old method, require MFA re-registration, revoke sessions'), h('li', null, 'BitLocker recovery: Devices, then the device, then BitLocker keys'), h('li', null, 'Compromised account: reset password, revoke sessions'))))) };
}

registerTool({
  id: 'entra', name: 'Microsoft Entra admin center', short: 'Entra Admin', width: 1180, height: 720,
  icon: '<path d="M17 3l12 7v14l-12 7-12-7V10z" fill="#0078d4"/><path d="M17 3l12 7-12 7-12-7z" fill="#50a8ff"/><path d="M17 17v14l12-7V10z" fill="#005ba1"/>',
  draw(host) {
    const b = body();
    host.append(adminShell({
      product: 'Microsoft Entra admin center', accent: '#0f6cbd', active: nav, user: S().technician || 'Technician',
      onNav: (id) => { nav = id; selected = null; device = null; query = ''; save(); },
      nav: [{ id: 'overview', label: 'Overview', icon: I.home }, { id: 'users', label: 'Users', icon: I.users, group: 'Identity' }, { id: 'devices', label: 'Devices', icon: I.device, group: 'Identity' }],
      page: b.page, panel: b.panel,
    }));
  },
});
export { toast };
