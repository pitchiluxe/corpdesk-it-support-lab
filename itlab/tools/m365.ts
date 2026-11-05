/**
 * Microsoft 365 admin center (training). Hybrid identity, as most companies run
 * it: accounts are created in Active Directory and reach the cloud with Entra
 * Connect sync; licences, mailboxes and sign-in are managed here.
 */
import { DOMAIN, S, cloudUsers, corpUser, evidence, lab, log, nowIso, save, toast } from '../corp.ts';
import { h, fmtDate } from '../dom.ts';
import { I, adminShell, badge, btn, card, cmd, cmdbar, dialog, kv, note, page, panel, table } from '../ui.ts';
import { registerTool } from '../host.ts';

const LICENSE = 'Microsoft 365 E3';
let nav = 'users';
let selected: string | null = null;
let tab = 'Account';
let sharedSel: string | null = null;
let explorerQuery = '';

/** Entra Connect delta sync: new AD users appear in the cloud; deleted ones leave. */
export function deltaSync(): { added: string[]; removed: string[] } {
  const L = lab();
  const users: any[] = S().users;
  const added = users.map((u) => u.sam).filter((sam) => !L.synced.includes(sam));
  const removed = L.synced.filter((sam) => !users.some((u) => u.sam === sam));
  L.synced = users.map((u) => u.sam);
  for (const sam of removed) { delete L.licenses[sam]; }
  for (const sam of added) L.licenses[sam] ??= null;
  (S().preferences ||= {}).lastSync = nowIso();
  log(6946, `Entra Connect delta sync: ${added.length} added, ${removed.length} removed`);
  evidence('sync');
  save();
  return { added, removed };
}

function ensureMailbox(sam: string): void {
  const L = lab();
  const u = corpUser(sam);
  if (u && !L.mailboxes.some((m) => m.owner === sam)) L.mailboxes.push({ address: `${sam}@${DOMAIN}`, name: u.name, type: 'user', owner: sam, fullAccess: [], sendAs: [], sizeGb: 0.1, quotaGb: 50 });
}
const assigned = (): number => Object.values(lab().licenses).filter((v) => v === LICENSE).length;

function pickUser(title: string, onPick: (sam: string) => void): void {
  const sel = h('select', { class: 'ad2-input', 'aria-label': 'User' }, cloudUsers().map((u) => h('option', { value: u.sam }, `${u.name} (${u.sam}@${DOMAIN})`)));
  dialog(title, h('label', { class: 'ad2-field' }, 'User', sel), [['Add', () => { onPick(sel.value); }, 'primary'], ['Cancel', () => undefined]]);
}

function perms(list: string[], label: string, onAdd: (sam: string) => void, onRemove: (sam: string) => void): HTMLElement {
  return h('div', { class: 'ad2-perm' }, h('div', { class: 'ad2-perm-head' }, h('b', null, label), btn('+ Add permissions', () => pickUser(`Add ${label.toLowerCase()} permission`, onAdd))),
    list.length ? h('ul', null, list.map((sam) => h('li', null, h('span', null, corpUser(sam)?.name ?? sam, h('small', null, ` ${sam}@${DOMAIN}`)), h('button', { class: 'ad2-link', type: 'button', onClick: () => onRemove(sam) }, 'Remove')))) : h('p', { class: 'ad2-muted' }, 'No one has this permission.'));
}

function userPanel(sam: string): HTMLElement {
  const L = lab();
  const u = corpUser(sam);
  const close = (): void => { selected = null; save(); };
  if (!u) return panel('User not found', '', close, null, null, null, note('This account no longer exists in Active Directory. Run a delta sync to remove it.'));
  const blocked = L.blocked.includes(sam);
  const mbx = L.mailboxes.find((m) => m.owner === sam);
  let body: HTMLElement;
  if (tab === 'Account') {
    body = h('div', null,
      kv([['Username', `${sam}@${DOMAIN}`], ['Display name', u.name], ['Department', u.dept], ['Job title', u.title || '—'], ['Source', 'Windows Server AD (synced with Entra Connect)'], ['Last password change', u.passwordLastSet ? fmtDate(u.passwordLastSet) : 'Not recorded']]),
      card('Sign-in', h('p', { class: 'ad2-muted' }, blocked ? 'This user is blocked from signing in to Microsoft 365.' : 'This user can sign in to Microsoft 365.'),
        h('div', { class: 'ad2-row' }, btn(blocked ? 'Unblock sign-in' : 'Block sign-in', () => { L.blocked = blocked ? L.blocked.filter((x) => x !== sam) : [...L.blocked, sam]; log(blocked ? 6005 : 6004, `${sam}: Microsoft 365 sign-in ${blocked ? 'allowed' : 'blocked'}`); save(); }, blocked ? '' : 'primary'),
          btn('Sign out of all sessions', () => { L.sessionsRevoked[sam] = nowIso(); log(6010, `${sam}: all Microsoft 365 sessions revoked`); evidence('revoke'); save(); toast(`${u.name} will be signed out of every app within the hour.`); }))),
      card('Password', h('p', { class: 'ad2-muted' }, 'Password writeback is on: a reset here is written to Active Directory.'),
        btn('Reset password', () => {
          const pw = h('input', { class: 'ad2-input', type: 'password', 'aria-label': 'Temporary password', autocomplete: 'new-password' });
          const must = h('input', { type: 'checkbox', checked: true });
          dialog(`Reset password for ${u.name}`, h('div', null, h('label', { class: 'ad2-field' }, 'Temporary password (14+ characters, upper, lower, digit)', pw), h('label', { class: 'ad2-check' }, must, 'Require this user to change their password when they first sign in'), h('p', { class: 'ad2-muted' }, 'Give the temporary password to the user over a verified channel, never in the ticket.')), [['Reset password', () => {
            const v = pw.value;
            if (v.length < 14 || !/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/[0-9]/.test(v)) { toast('The password does not meet the domain policy (14+ characters with upper, lower and a digit).'); return false; }
            u.accountOptions ||= {}; u.accountOptions.mustChange = must.checked; u.passwordLastSet = nowIso();
            log(4724, `${sam}: password reset from Microsoft 365 admin center (written back to AD; no password stored)`);
            save();
          }, 'primary'], ['Cancel', () => undefined]]);
        })));
  } else if (tab === 'Licenses and apps') {
    const has = L.licenses[sam] === LICENSE;
    const box = h('input', { type: 'checkbox', checked: has, 'aria-label': LICENSE });
    body = h('div', null, h('p', { class: 'ad2-muted' }, 'Select a location and licences. The mailbox is created when an Exchange licence is assigned.'),
      h('label', { class: 'ad2-check big' }, box, h('span', null, h('b', null, LICENSE), h('small', null, `${30 - assigned()} of 30 licences available`))),
      btn('Save changes', () => {
        if (box.checked && !has && assigned() >= lab().licenseTotal) { toast('There are no licences left. Remove one from a leaver or buy more under Billing.'); return; }
        L.licenses[sam] = box.checked ? LICENSE : null;
        if (box.checked) ensureMailbox(sam);
        log(6020, `${sam}: ${LICENSE} ${box.checked ? 'assigned' : 'removed'}`);
        save();
        toast('Licences updated.');
      }, 'primary'));
  } else {
    body = mbx ? h('div', null,
      kv([['Email address', mbx.address], ['Mailbox type', mbx.type === 'shared' ? 'Shared mailbox' : 'User mailbox'], ['Usage', `${mbx.sizeGb} GB of ${mbx.quotaGb} GB`]]),
      mbx.type === 'user' ? card('Convert mailbox', h('p', { class: 'ad2-muted' }, 'Convert a leaver\'s mailbox to a shared mailbox to keep their email without a licence, then give their manager access.'), btn('Convert to shared mailbox', () => { mbx.type = 'shared'; log(6030, `${sam}: mailbox converted to shared`); save(); })) : note('This is a shared mailbox. It keeps the email and needs no licence (under 50 GB).', 'ok'),
      card('Mailbox permissions',
        perms(mbx.fullAccess, 'Read and manage (Full Access)', (x) => { if (!mbx.fullAccess.includes(x)) mbx.fullAccess.push(x); log(6031, `${x}: Full Access to ${mbx.address}`); save(); }, (x) => { mbx.fullAccess = mbx.fullAccess.filter((y) => y !== x); log(6032, `${x}: Full Access removed from ${mbx.address}`); save(); }),
        perms(mbx.sendAs, 'Send as', (x) => { if (!mbx.sendAs.includes(x)) mbx.sendAs.push(x); log(6033, `${x}: Send As on ${mbx.address}`); save(); }, (x) => { mbx.sendAs = mbx.sendAs.filter((y) => y !== x); log(6034, `${x}: Send As removed from ${mbx.address}`); save(); })))
      : note('No mailbox yet. Assign an Exchange Online licence (Microsoft 365 E3) to create it.', 'warn');
  }
  return panel(u.name, `${sam}@${DOMAIN}`, close, ['Account', 'Licenses and apps', 'Mail'], tab, (t) => { tab = t; save(); }, body);
}

function sharedPanel(address: string): HTMLElement {
  const L = lab();
  const m = L.mailboxes.find((x) => x.address === address)!;
  const close = (): void => { sharedSel = null; save(); };
  return panel(m.name, m.address, close, null, null, null,
    kv([['Type', 'Shared mailbox'], ['Usage', `${m.sizeGb} GB of ${m.quotaGb} GB`]]),
    note('Grant access only with the mailbox owner\'s or manager\'s approval recorded on the ticket.'),
    perms(m.fullAccess, 'Read and manage (Full Access)', (x) => { if (!m.fullAccess.includes(x)) m.fullAccess.push(x); log(6031, `${x}: Full Access to ${m.address}`); save(); }, (x) => { m.fullAccess = m.fullAccess.filter((y) => y !== x); log(6032, `${x}: Full Access removed from ${m.address}`); save(); }),
    perms(m.sendAs, 'Send as', (x) => { if (!m.sendAs.includes(x)) m.sendAs.push(x); log(6033, `${x}: Send As on ${m.address}`); save(); }, (x) => { m.sendAs = m.sendAs.filter((y) => y !== x); log(6034, `${x}: Send As removed from ${m.address}`); save(); }));
}

function body(): { page: HTMLElement; panel: HTMLElement | null } {
  const L = lab();
  const users = cloudUsers();
  if (nav === 'home') {
    const unsynced = S().users.filter((u: any) => !L.synced.includes(u.sam)).length;
    return { panel: null, page: page('Home',
      h('div', { class: 'ad2-cards' },
        card('User management', h('p', { class: 'ad2-muted' }, `${users.length} active users`), btn('Go to Active users', () => { nav = 'users'; save(); }, 'primary')),
        card('Licences', h('p', { class: 'ad2-muted' }, `${assigned()} of ${L.licenseTotal} ${LICENSE} assigned`), btn('Manage licences', () => { nav = 'licenses'; save(); })),
        card('Directory sync', unsynced ? badge(`${unsynced} AD account(s) waiting for sync`, 'warn') : badge('Up to date', 'ok'), h('p', { class: 'ad2-muted' }, `Last sync: ${S().preferences?.lastSync ? fmtDate(S().preferences.lastSync) : 'over 30 minutes ago'}`), btn('Directory sync status', () => { nav = 'sync'; save(); })),
        card('Email security', h('p', { class: 'ad2-muted' }, 'Find and remove phishing that reached mailboxes.'), btn('Open Explorer', () => { nav = 'explorer'; save(); })))) };
  }
  if (nav === 'users') {
    return {
      panel: selected ? userPanel(selected) : null,
      page: page('Active users',
        note('Hybrid organization: create and delete accounts in Active Directory, then run a delta sync. Manage licences, mailboxes and sign-in here.'),
        cmdbar(cmd(I.user, 'Add a user', () => toast('This organization syncs from Active Directory. Create the account in Active Directory Users and Computers, then run a delta sync.')), cmd(I.sync, 'Run delta sync', () => { const r = deltaSync(); toast(`Delta sync complete: ${r.added.length} added, ${r.removed.length} removed.`); }), cmd(I.refresh, 'Refresh', () => save())),
        table<any>([
          ['Display name', (u) => h('b', null, u.name)],
          ['Username', (u) => `${u.sam}@${DOMAIN}`],
          ['Licences', (u) => L.licenses[u.sam] ?? h('span', { class: 'ad2-muted' }, 'Unlicensed')],
          ['Sign-in', (u) => (L.blocked.includes(u.sam) ? badge('Blocked', 'bad') : badge('Allowed', 'ok'))],
          ['Sync status', () => badge('Synced from on-premises', 'info')],
        ], users, { onRow: (u) => { selected = u.sam; tab = 'Account'; save(); }, selected: (u) => u.sam === selected })),
    };
  }
  if (nav === 'shared') {
    const shared = L.mailboxes.filter((m) => m.type === 'shared');
    return {
      panel: sharedSel ? sharedPanel(sharedSel) : null,
      page: page('Shared mailboxes', h('p', { class: 'ad2-muted' }, 'Mailboxes a team shares, and the mailboxes of people who have left.'),
        table<any>([['Name', (m) => h('b', null, m.name)], ['Email address', (m) => m.address], ['Members with Full Access', (m) => String(m.fullAccess.length)]], shared, { onRow: (m) => { sharedSel = m.address; save(); }, selected: (m) => m.address === sharedSel })),
    };
  }
  if (nav === 'licenses') {
    return { panel: null, page: page('Licences', table<any>([['Product', (r) => h('b', null, r.p)], ['Available', (r) => String(r.total - r.used)], ['Assigned', (r) => String(r.used)], ['Total', (r) => String(r.total)]], [{ p: LICENSE, total: L.licenseTotal, used: assigned() }]),
      note('When someone leaves, remove their licence (after converting the mailbox to shared) so a new hire can use it.')) };
  }
  if (nav === 'sync') {
    const pending = S().users.filter((u: any) => !L.synced.includes(u.sam));
    return { panel: null, page: page('Directory sync status',
      kv([['Directory sync', 'Enabled (Microsoft Entra Connect on LAB-DC01)'], ['Last sync', S().preferences?.lastSync ? fmtDate(S().preferences.lastSync) : 'Over 30 minutes ago'], ['Sync interval', 'Every 30 minutes'], ['Password hash sync', 'Enabled'], ['Password writeback', 'Enabled']]),
      pending.length ? note(`${pending.length} new account(s) in Active Directory have not synced yet: ${pending.map((u: any) => u.sam).join(', ')}`, 'warn') : note('All Active Directory accounts are in Microsoft 365.', 'ok'),
      h('div', { class: 'ad2-row' }, btn('Run delta sync now', () => { const r = deltaSync(); toast(`Delta sync complete: ${r.added.length} added, ${r.removed.length} removed.`); }, 'primary')),
      h('p', { class: 'ad2-muted' }, 'On the server this is: Start-ADSyncSyncCycle -PolicyType Delta (you can run it in PowerShell too).')) };
  }
  if (nav === 'explorer') {
    const all = L.inbox.filter((m) => m.recipients?.length);
    const hits = all.filter((m) => !explorerQuery || `${m.from} ${m.subject}`.toLowerCase().includes(explorerQuery.toLowerCase()));
    const input = h('input', { class: 'ad2-input', placeholder: 'Sender address or domain, or subject', value: explorerQuery, 'data-key': 'explorer-q', 'aria-label': 'Search messages' });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { explorerQuery = input.value; evidence('explorer'); save(); } });
    return { panel: null, page: page('Explorer (email & collaboration)', h('p', { class: 'ad2-muted' }, 'Find every copy of a message that was delivered, then remove it from all mailboxes.'),
      h('div', { class: 'ad2-row' }, input, btn('Search', () => { explorerQuery = input.value; evidence('explorer'); save(); }, 'primary')),
      table<any>([['Received', (m) => fmtDate(m.received)], ['Sender', (m) => m.from], ['Subject', (m) => m.subject], ['Recipients', (m) => String(m.recipients.length)], ['Delivery', (m) => (L.purged.includes(m.id) ? badge('Removed (soft delete)', 'ok') : badge('Inbox', 'warn'))],
        ['', (m) => (L.purged.includes(m.id) ? '' : btn('Soft delete from all mailboxes', () => { L.purged.push(m.id); log(6040, `Message "${m.subject}" from ${m.from} soft-deleted from ${m.recipients.length} mailboxes`); save(); toast('Message removed from every mailbox it reached.'); }, 'primary'))]],
      hits, { empty: explorerQuery ? 'No delivered messages match.' : 'Search for a sender or subject.' })) };
  }
  // Tenant Allow/Block List
  const input = h('input', { class: 'ad2-input', placeholder: 'Sender address or domain, e.g. bad.example', 'data-key': 'block-input', 'aria-label': 'Sender to block' });
  return { panel: null, page: page('Tenant Allow/Block List', h('p', { class: 'ad2-muted' }, 'Block a sender or domain so future messages are rejected for everyone.'),
    h('div', { class: 'ad2-row' }, input, btn('Block', () => { const v = input.value.trim().toLowerCase(); if (!v) return; if (!L.blockedSenders.includes(v)) L.blockedSenders.push(v); log(6041, `Sender ${v} blocked tenant-wide`); save(); }, 'primary')),
    table<string>([['Blocked sender', (s) => h('b', null, s)], ['', (s) => btn('Remove', () => { L.blockedSenders = L.blockedSenders.filter((x) => x !== s); save(); })]], L.blockedSenders, { empty: 'No senders are blocked.' })) };
}

registerTool({
  id: 'm365', name: 'Microsoft 365 admin center', short: 'M365 Admin', width: 1180, height: 720,
  icon: '<rect x="3" y="3" width="13" height="13" rx="2" fill="#eb3c00"/><rect x="18" y="3" width="13" height="13" rx="2" fill="#2fb300"/><rect x="3" y="18" width="13" height="13" rx="2" fill="#0078d4"/><rect x="18" y="18" width="13" height="13" rx="2" fill="#ffb900"/>',
  draw(host) {
    const b = body();
    host.append(adminShell({
      product: 'Microsoft 365 admin center', accent: '#0f6cbd', active: nav, user: S().technician || 'Technician',
      onNav: (id) => { nav = id; selected = null; sharedSel = null; save(); },
      nav: [
        { id: 'home', label: 'Home', icon: I.home },
        { id: 'users', label: 'Active users', icon: I.user, group: 'Users' },
        { id: 'shared', label: 'Shared mailboxes', icon: I.mail, group: 'Teams & groups' },
        { id: 'licenses', label: 'Licences', icon: I.license, group: 'Billing' },
        { id: 'sync', label: 'Directory sync status', icon: I.sync, group: 'Health' },
        { id: 'explorer', label: 'Explorer', icon: I.search, group: 'Email & collaboration' },
        { id: 'block', label: 'Tenant Allow/Block List', icon: I.block, group: 'Email & collaboration' },
      ],
      page: b.page, panel: b.panel,
    }));
  },
});
