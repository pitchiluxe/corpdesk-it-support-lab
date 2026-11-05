/**
 * Real-world service desk incidents (LAB-006 to LAB-012), graded the same way
 * as CORP Desk's first five: start the incident to inject the fault, collect
 * evidence while you work, then "Validate & resolve" checks the evidence, the
 * live system state and your resolution notes.
 */
import { APPS, CHECK_LABELS, DOMAIN, G, S, TICKETS, corpUser, deviceFor, evidence, keyId, lab, log, nowIso, openApp, recoveryKey, save, toast, type Mail } from './corp.ts';
import { h } from './dom.ts';
import { dialog } from './ui.ts';
import { deltaSync } from './tools/m365.ts';
import { ensureServices, printTestPage } from './tools/services.ts';

declare let ticketView: number | null;
declare let currentApp: string | null;
/** Redraw the Service Desk only when it is the window in front (it draws into #appBody). */
const redrawDesk = (): void => { if (currentApp === 'tickets') G.renderTickets(); };
// CORP Desk's renderTickets() draws into whichever window is in front; only let it draw into the Service Desk.
// (It redraws when the Service Desk is brought back to the front.)
const renderTicketsUnguarded = G.renderTickets as () => void;
G.renderTickets = (): void => { if (currentApp === 'tickets') renderTicketsUnguarded(); };

const E3 = 'Microsoft 365 E3';
const NL = '\n';
const after = (iso: string | undefined, id: number): boolean => !!iso && iso >= (lab() as any).started?.[id];
const started = (): Record<number, string> => ((lab() as any).started ||= {});

export interface LabDef {
  id: number;
  title: string;
  user: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  hint: string;
  checks: string[];
  tools: string[];
  realWorld: string;
  interview: string;
  verify?: { sam: string; good: string; bad: [string, string][] };
  inject(): void;
  restore(): void;
  criteria(): boolean;
}

const mail = (m: Partial<Mail> & Pick<Mail, 'id' | 'from' | 'fromName' | 'subject' | 'body'>): void => {
  const L = lab();
  L.inbox = L.inbox.filter((x) => x.id !== m.id);
  L.inbox.push({ to: `servicedesk@${DOMAIN}`, received: nowIso(), read: false, headers: `From: ${m.fromName} <${m.from}>\nTo: servicedesk@${DOMAIN}\nReturn-Path: <${m.from}>\nAuthentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`, ...m } as Mail);
  L.purged = L.purged.filter((x) => x !== m.id && x !== `del:${m.id}`);
};
const unmail = (id: string): void => { const L = lab(); L.inbox = L.inbox.filter((x) => x.id !== id); };

const NEW_HIRE = 'pshah';
const PHISH_DOMAIN = 'corp-example-payments.com';
const BL_DEVICE = 'HR-PC04';
const blKey = (): { id: string; key: string } => ({ id: keyId('hr04-bios'), key: recoveryKey('hr04-bios') });

export const LABS: LabDef[] = [
  {
    id: 6, title: 'New hire starts Monday: create Priya Shah\'s accounts', user: 'finance01', category: 'Onboarding (joiner)', priority: 'Medium',
    summary: 'Olivia Grant (Finance manager) has sent the onboarding request to the service desk mailbox. Priya Shah joins Finance as a Financial Analyst on Monday. Create her account exactly as requested, get it into Microsoft 365, license it, and confirm she has a mailbox.',
    hint: 'Read the request in Outlook. Create the user in ADUC in Lab > Users > Finance (logon pshah), set the title and manager, add GG_Finance_Staff, and require a password change at first logon. Then run a delta sync (M365 admin or Start-ADSyncSyncCycle -PolicyType Delta) and assign Microsoft 365 E3.',
    checks: ['onboard-request', 'sync'],
    tools: ['outlook', 'directory', 'm365'],
    realWorld: 'Joiners are the most common planned work on a service desk. Accounts are built from an HR request, never from a phone call, and in hybrid companies they reach Microsoft 365 through Entra Connect sync before a licence and mailbox can be assigned.',
    interview: 'Walk me through onboarding a new hire: HR request, AD account in the right OU with role groups, sync to Entra ID, licence for a mailbox, and a first-logon password handed over securely.',
    inject() {
      const s = S();
      s.users = s.users.filter((u: any) => u.sam !== NEW_HIRE);
      const L = lab(); L.synced = L.synced.filter((x) => x !== NEW_HIRE); delete L.licenses[NEW_HIRE]; L.mailboxes = L.mailboxes.filter((m) => m.owner !== NEW_HIRE);
      mail({ id: 'm-onboard', from: `finance01@${DOMAIN}`, fromName: 'Olivia Grant', subject: 'New starter Monday: Priya Shah (Finance)', evidence: 'onboard-request',
        body: 'Hi service desk,\n\nPlease set up access for our new starter (HR reference HR-2291, approved).\n\nName: Priya Shah\nLogon name: pshah\nJob title: Financial Analyst\nDepartment: Finance\nManager: Olivia Grant (finance01)\nStart date: Monday\nAccess: Finance team role (GG_Finance_Staff), email (Microsoft 365 E3)\n\nPlease make her change the password the first time she signs in. I will collect her laptop from IT on Monday morning.\n\nThanks,\nOlivia' });
    },
    restore() { S().users = S().users.filter((u: any) => u.sam !== NEW_HIRE); const L = lab(); L.synced = L.synced.filter((x) => x !== NEW_HIRE); delete L.licenses[NEW_HIRE]; L.mailboxes = L.mailboxes.filter((m) => m.owner !== NEW_HIRE); unmail('m-onboard'); },
    criteria() {
      const u = corpUser(NEW_HIRE), L = lab();
      return !!u && u.path === 'Lab/Users/Finance' && u.groups.includes('GG_Finance_Staff') && /financial analyst/i.test(u.title ?? '') && u.manager === 'finance01' && u.enabled && !!u.accountOptions?.mustChange
        && L.synced.includes(NEW_HIRE) && L.licenses[NEW_HIRE] === E3 && L.mailboxes.some((m) => m.owner === NEW_HIRE);
    },
  },
  {
    id: 7, title: 'Termination today: offboard Jordan Wells', user: 'it01', category: 'Offboarding (leaver)', priority: 'High',
    summary: 'HR has confirmed Jordan Wells (it08) leaves today at 17:00. Follow the leaver checklist in the HR notice: lock the account everywhere, keep the mailbox for his manager, and free the licence. Nothing may be deleted.',
    hint: 'ADUC: disable it08, move it to Lab > Disabled, remove its group memberships. Microsoft 365 admin: block sign-in and sign out of all sessions, convert the mailbox to shared, give Alex Morgan (it01) Full Access, then remove the licence.',
    checks: ['leaver-notice', 'revoke'],
    tools: ['outlook', 'directory', 'm365'],
    realWorld: 'Leavers are a security task: the account must stop working at the agreed time, sessions already open must be ended, and data is kept (shared mailbox) for the business. Deleting accounts on day one loses mail and audit history.',
    interview: 'What do you do when someone is terminated? Disable (not delete), revoke sessions, remove groups, block cloud sign-in, convert the mailbox to shared for the manager, reclaim the licence and the laptop, and document everything on the ticket.',
    inject() {
      const u = corpUser('it08');
      if (u) { u.enabled = true; u.locked = false; u.path = 'Lab/Users/IT'; if (!u.groups.includes('GG_IT_Staff')) u.groups.push('GG_IT_Staff'); }
      const L = lab();
      if (!L.synced.includes('it08')) L.synced.push('it08');
      L.licenses.it08 = E3; L.blocked = L.blocked.filter((x) => x !== 'it08');
      const m = L.mailboxes.find((x) => x.owner === 'it08'); if (m) { m.type = 'user'; m.fullAccess = []; m.sendAs = []; }
      mail({ id: 'm-leaver', from: `hr01@${DOMAIN}`, fromName: 'Maya Chen', subject: 'Leaver notice: Jordan Wells (IT) — today 17:00', evidence: 'leaver-notice',
        body: 'Hello IT,\n\nJordan Wells (it08), IT department, leaves the company today. Last working time: 17:00. HR reference HR-2307.\n\nLeaver checklist:\n1. Disable the account and move it to the Disabled OU. Do not delete it.\n2. Remove all group memberships.\n3. Block Microsoft 365 sign-in and sign him out everywhere.\n4. Convert his mailbox to a shared mailbox and give his manager, Alex Morgan (it01), Full Access.\n5. Remove his Microsoft 365 licence.\n\nThank you,\nMaya Chen, HR' });
    },
    restore() {
      const u = corpUser('it08');
      if (u) { u.enabled = true; u.path = 'Lab/Users/IT'; if (!u.groups.includes('GG_IT_Staff')) u.groups.push('GG_IT_Staff'); }
      const L = lab(); L.licenses.it08 = E3; L.blocked = L.blocked.filter((x) => x !== 'it08');
      const m = L.mailboxes.find((x) => x.owner === 'it08'); if (m) { m.type = 'user'; m.fullAccess = []; m.sendAs = []; }
      unmail('m-leaver');
    },
    criteria() {
      const u = corpUser('it08'), L = lab(), m = L.mailboxes.find((x) => x.owner === 'it08');
      return !!u && !u.enabled && u.path === 'Lab/Disabled' && u.groups.length === 0 && L.blocked.includes('it08') && after(L.sessionsRevoked.it08, 7)
        && !!m && m.type === 'shared' && m.fullAccess.includes('it01') && !L.licenses.it08;
    },
  },
  {
    id: 8, title: 'HR cannot print: jobs stuck on HR-PRN01', user: 'hr06', category: 'Printing', priority: 'Medium',
    summary: 'Several people in HR say nothing prints on HR-PRN01, and the printer itself shows no error. Liam Park (hr06) sent a large payroll PDF just before it stopped. Find out why the queue is not moving, fix it without losing other people\'s documents unnecessarily, and prove printing works.',
    hint: 'Print Management shows the queue. Is the Print Spooler service running (Services, or Get-Service Spooler)? A corrupt job at the top of a queue blocks everything behind it: cancel only that one, then print a test page.',
    checks: ['spooler', 'print-queue', 'print-test'],
    tools: ['printmgmt', 'services', 'terminal'],
    realWorld: '"I can\'t print" is one of the most frequent service desk calls. The usual causes are a stopped or crashed Print Spooler and a corrupt job jamming the queue. Restarting the spooler and clearing only the bad job is the standard fix.',
    interview: 'A department cannot print. How do you troubleshoot? Check the printer and its queue, the Print Spooler service, clear the stuck job, restart the spooler, then print a test page and confirm with the users.',
    inject() {
      ensureServices();
      const sp = (S().services as any[]).find((x) => x.Name === 'Spooler'); if (sp) sp.Status = 'Stopped';
      const L = lab();
      const t = Date.now();
      L.jobs = L.jobs.filter((j) => j.printer !== 'HR-PRN01');
      L.jobs.push(
        { id: 41, printer: 'HR-PRN01', owner: 'hr06', document: 'Payroll_Summary_Q3.pdf', pages: 214, status: 'Error - Printing', submitted: new Date(t - 50 * 60000).toISOString() },
        { id: 42, printer: 'HR-PRN01', owner: 'hr02', document: 'Interview schedule.docx', pages: 2, status: 'Queued', submitted: new Date(t - 40 * 60000).toISOString() },
        { id: 43, printer: 'HR-PRN01', owner: 'hr05', document: 'Leave request - Zoe Reed.pdf', pages: 1, status: 'Queued', submitted: new Date(t - 22 * 60000).toISOString() });
      delete L.testPages['HR-PRN01'];
      log(7031, 'The Print Spooler service terminated unexpectedly.');
    },
    restore() { ensureServices(); const sp = (S().services as any[]).find((x) => x.Name === 'Spooler'); if (sp) sp.Status = 'Running'; const L = lab(); L.jobs = L.jobs.filter((j) => j.printer !== 'HR-PRN01'); },
    criteria() {
      const L = lab(), sp = (S().services as any[]).find((x) => x.Name === 'Spooler');
      return sp?.Status === 'Running' && !L.jobs.some((j) => j.printer === 'HR-PRN01' && j.status === 'Error - Printing') && after(L.testPages['HR-PRN01'], 8);
    },
  },
  {
    id: 9, title: 'New phone: reset MFA for a Finance user', user: 'finance02', category: 'Identity & MFA', priority: 'High',
    summary: 'A caller says she is a Finance user (finance02), bought a new phone this weekend and can no longer approve sign-ins. Verify who she is before you touch anything, then remove the old authenticator, make her register MFA again and sign her out everywhere.',
    hint: 'Use "Verify caller" on this ticket first. Then Entra admin center > Users > the user > Authentication methods: delete the old Microsoft Authenticator, choose "Require re-register multifactor authentication", and Revoke sessions.',
    checks: ['verify', 'revoke'],
    tools: ['entra'],
    realWorld: 'MFA resets are a favourite target of social engineering (attackers phone the help desk pretending to be employees). Real service desks verify identity with a call-back to a number on file or a manager-approved code before resetting anything.',
    interview: 'Someone calls saying they lost their phone and need MFA reset. What do you do? Verify identity through an approved method, remove the old method, require re-registration, revoke sessions, and note the verification on the ticket.',
    verify: { sam: 'finance02', good: 'Call her back on the mobile number in the HR directory and confirm with a one-time code sent to her manager', bad: [['Ask her to confirm her password', 'Never ask for a password. A real employee does not need to give it, and an attacker would.'], ['She knows her manager\'s name and department, so it is her', 'Names and departments are on LinkedIn. That is how help desk social engineering works.']] },
    inject() {
      const L = lab();
      L.methods.finance02 = [{ id: 'finance02-oldapp', type: 'Microsoft Authenticator', detail: 'iPhone 12 (old phone)', added: new Date(Date.now() - 500 * 864e5).toISOString() }, { id: 'finance02-sms', type: 'Phone (SMS)', detail: '+1 555 0142', added: new Date(Date.now() - 520 * 864e5).toISOString() }];
      L.reregister.finance02 = false;
      delete L.verified.finance02;
    },
    restore() { const L = lab(); L.reregister.finance02 = false; delete L.verified.finance02; },
    criteria() {
      const L = lab();
      return !(L.methods.finance02 ?? []).some((m) => m.id === 'finance02-oldapp') && !!L.reregister.finance02 && after(L.sessionsRevoked.finance02, 9) && after(L.verified.finance02, 9);
    },
  },
  {
    id: 10, title: 'Laptop stuck on the BitLocker recovery screen', user: 'hr04', category: 'Endpoint & encryption', priority: 'High',
    summary: 'Eli Foster (hr04) installed a BIOS update last night. This morning HR-PC04 asks for a BitLocker recovery key. He reads this from the screen: "Recovery key ID: {KEYID}…". Verify him, find the matching key for his device, and give him the right recovery key.',
    hint: 'Verify caller first. Entra admin center > Devices > HR-PC04 > BitLocker keys. The device has more than one key: match the Key ID the user read out, then use "Provide recovery key" on this ticket.',
    checks: ['verify', 'bitlocker-view', 'bitlocker-provided'],
    tools: ['entra'],
    realWorld: 'Firmware updates, docking changes and TPM resets trigger BitLocker recovery. The key is stored in Entra ID (or AD). Giving out the wrong key wastes the user\'s time; giving a key to an unverified caller hands over an encrypted laptop.',
    interview: 'A user is on the BitLocker recovery screen. Where do you find the key, and how do you make sure it is the right one for the right person?',
    verify: { sam: 'hr04', good: 'Call him back on the desk phone listed in the HR directory and confirm his employee number', bad: [['Read the key to whoever is calling, it is urgent', 'Urgency is the attacker\'s favourite tool. Verify first, every time.'], ['Email the key to his personal address he gives you', 'Recovery keys never go to unverified or personal addresses.']] },
    inject() {
      const L = lab();
      const d = L.devices.find((x) => x.name === BL_DEVICE) ?? (() => { const u = corpUser('hr04'); const dev = { name: deviceFor(u), owner: 'hr04', os: 'Windows 11 Enterprise 23H2', compliant: true, lastSync: nowIso(), keys: [] as any[] }; L.devices.push(dev); return dev; })();
      const k = blKey();
      d.keys = d.keys.filter((x) => x.id !== k.id);
      d.keys.push({ ...k, created: new Date(Date.now() - 2 * 864e5).toISOString() });
      delete L.bitlockerProvided[BL_DEVICE];
      delete L.verified.hr04;
    },
    restore() { const L = lab(); delete L.bitlockerProvided[BL_DEVICE]; delete L.verified.hr04; },
    criteria() { const L = lab(); return L.bitlockerProvided[BL_DEVICE] === blKey().key && after(L.verified.hr04, 10); },
  },
  {
    id: 11, title: 'Phishing: user entered her password on a fake payroll page', user: 'finance01', category: 'Security incident', priority: 'Critical',
    summary: 'Olivia Grant (finance01) forwarded an "invoice overdue" email to the service desk mailbox and says she typed her password into the page it opened. The same message reached other people. Confirm it is phishing, remove it from every mailbox, stop more arriving, and secure her account.',
    hint: 'Outlook: View message details (look at the sender domain, Return-Path and SPF/DMARC results), then Report phishing. Microsoft 365 admin > Explorer: search the sender and soft delete it from all mailboxes; Tenant Allow/Block List: block the domain. Then reset finance01\'s password (ADUC or M365) and revoke her sessions.',
    checks: ['phish-headers', 'phish-report', 'explorer'],
    tools: ['outlook', 'm365', 'entra', 'directory'],
    realWorld: 'Phishing is the most common way accounts are compromised. Tier 1 contains it: confirm with the headers, purge the message tenant-wide, block the sender, reset the password and revoke sessions, then escalate to security with what you found.',
    interview: 'A user clicked a phishing link and entered their password. What are your first five steps?',
    inject() {
      const L = lab();
      const original = ['Dear colleague,', '', 'Your department has an overdue invoice. To avoid late fees, sign in within 24 hours to confirm payment details:', 'https://corp-example-payments.com/sso/login', '', 'Accounts Payable'].join(NL);
      const headers = [
        `From: "CORP Payroll" <billing@${PHISH_DOMAIN}>`,
        `Reply-To: <collect@${PHISH_DOMAIN}>`,
        `Return-Path: <bounce-7731@mailer.${PHISH_DOMAIN}>`,
        `To: finance01@${DOMAIN}, finance03@${DOMAIN}, hr02@${DOMAIN}`,
        `Received: from mailer.${PHISH_DOMAIN} (203.0.113.45)`,
        `Authentication-Results: spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=${PHISH_DOMAIN}; dkim=none; dmarc=fail action=none header.from=${PHISH_DOMAIN}`,
        'X-MS-Exchange-Organization-SCL: 5',
      ].join(NL);
      // The user's report, forwarded as an attachment (Message details show the original's headers).
      mail({ id: 'm-phish-fwd', from: `finance01@${DOMAIN}`, fromName: 'Olivia Grant', subject: 'FW: URGENT Invoice #88412 overdue – payment details required', phishing: true, headers,
        body: ['Hi IT, this came in this morning. I clicked it and put my password in before I noticed the address looked odd. Sorry! Can you check?', 'Olivia', '', '-------- Forwarded message (attached) --------', 'From: CORP Payroll <billing@corp-example-payments.com>', 'Subject: URGENT Invoice #88412 overdue – payment details required', '', original].join(NL) });
      // Every delivered copy of the original, as Explorer finds it.
      mail({ id: 'm-phish', from: `billing@${PHISH_DOMAIN}`, fromName: 'CORP Payroll', to: `finance01@${DOMAIN}`, subject: 'URGENT Invoice #88412 overdue – payment details required', body: original, hidden: true, read: true, recipients: ['finance01', 'finance03', 'hr02'], headers });
      L.blockedSenders = L.blockedSenders.filter((x) => !x.includes(PHISH_DOMAIN));
    },
    restore() { unmail('m-phish'); unmail('m-phish-fwd'); },
    criteria() {
      const L = lab(), u = corpUser('finance01');
      return L.purged.includes('m-phish') && L.blockedSenders.some((x) => x.includes(PHISH_DOMAIN)) && after(u?.passwordLastSet, 11) && after(L.sessionsRevoked.finance01, 11);
    },
  },
  {
    id: 12, title: 'Access request: HR Team shared mailbox for Noah Brooks', user: 'hr02', category: 'Microsoft 365 access', priority: 'Low',
    summary: 'Noah Brooks (hr02) needs to read and send from the HR Team shared mailbox (hr@corp.example.test) to cover the HR inbox. Check the request was approved by the mailbox owner, then grant exactly what is approved, nothing more.',
    hint: 'Read the approval in Outlook. Microsoft 365 admin > Shared mailboxes > HR Team: add hr02 to Read and manage (Full Access) and Send as. Do not add anyone else.',
    checks: ['mailbox-approval'],
    tools: ['outlook', 'm365'],
    realWorld: 'Access requests are daily work. The rule is least privilege with recorded approval: grant what the owner approved, to the person named, and note the approval on the ticket.',
    interview: 'Someone asks for access to a shared mailbox. What do you check before you grant it?',
    inject() {
      const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`);
      if (m) { m.fullAccess = ['hr01']; m.sendAs = ['hr01']; }
      mail({ id: 'm-approval', from: `hr01@${DOMAIN}`, fromName: 'Maya Chen', subject: 'Approved: HR Team mailbox access for Noah Brooks', evidence: 'mailbox-approval',
        body: 'Hi IT,\n\nAs owner of the HR Team shared mailbox I approve access for Noah Brooks (hr02): he needs to read the mailbox and send as hr@ while he covers the HR inbox.\n\nNo one else needs access.\n\nMaya Chen\nHR Team mailbox owner' });
    },
    restore() { const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`); if (m) { m.fullAccess = ['hr01']; m.sendAs = ['hr01']; } unmail('m-approval'); },
    criteria() {
      const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`);
      return !!m && m.fullAccess.includes('hr02') && m.sendAs.includes('hr02') && m.fullAccess.every((x) => ['hr01', 'hr02'].includes(x)) && m.sendAs.every((x) => ['hr01', 'hr02'].includes(x));
    },
  },
];
const LAB = new Map(LABS.map((l) => [l.id, l]));
export const labById = (id: number): LabDef | undefined => LAB.get(id);

// ---- register with the Service Desk
const keyIdShown = blKey().id.slice(0, 8);
for (const l of LABS) {
  const summary = l.summary.replace('{KEYID}', keyIdShown);
  const existing = TICKETS().find((t) => t.id === l.id);
  const t = { id: l.id, title: l.title, user: l.user, category: l.category, priority: l.priority, summary, checks: l.checks, hint: l.hint, lab: true };
  if (existing) Object.assign(existing, t); else TICKETS().push(t);
}
Object.assign(CHECK_LABELS(), {
  'onboard-request': 'Read the approved onboarding request', sync: 'Run an Entra Connect delta sync', 'leaver-notice': 'Read the HR leaver notice',
  revoke: 'Revoke the user\'s sessions', spooler: 'Start or restart the Print Spooler', 'print-queue': 'Cancel the corrupt print job', 'print-test': 'Print a test page',
  verify: 'Verify the caller\'s identity', 'bitlocker-view': 'Look up the device\'s BitLocker keys', 'bitlocker-provided': 'Give the user the matching recovery key',
  'phish-headers': 'Inspect the message headers', 'phish-report': 'Report the message as phishing', explorer: 'Search Explorer for every copy',
  'mailbox-approval': 'Read the mailbox owner\'s approval',
});

const oldCriteria = G.criteria as (t: any) => boolean;
G.criteria = (t: any): boolean => { const l = LAB.get(t?.id); if (!l) return oldCriteria(t); try { return l.criteria(); } catch { return false; } };

const oldStart = G.startIncident as (id: number) => void;
G.startIncident = (id: number): void => {
  const l = LAB.get(id);
  if (!l) return oldStart(id);
  const s = S();
  if (s.active && s.active !== id) { toast('Resolve or cancel the current incident before starting another.'); return; }
  if (s.statuses[id] === 'Resolved') { toast('This ticket is resolved. Reset the lab in Settings to replay all incidents.'); return; }
  if (s.active === id) return;
  l.inject();
  started()[id] = nowIso();
  s.statuses[id] = 'In progress';
  s.active = id;
  s.evidence[id] = [];
  log(9000, `LAB-${String(id).padStart(3, '0')} started: ${l.title}`);
  save();
  redrawDesk();
  toast(`Incident started. Tools for this one: ${l.tools.map(toolName).join(', ')}.`);
};

const oldCancel = G.cancelIncident as (id: number) => void;
G.cancelIncident = (id: number): void => {
  const l = LAB.get(id);
  if (!l) return oldCancel(id);
  if (!confirm('Cancel this incident and restore the affected baseline?')) return;
  l.restore();
  const s = S();
  s.statuses[id] = 'New'; s.active = null; s.evidence[id] = [];
  log(9002, `LAB-${String(id).padStart(3, '0')} cancelled; baseline restored`);
  save();
  redrawDesk();
};

export function toolName(id: string): string { return APPS().find((a) => a.id === id)?.name ?? ({ outlook: 'Outlook', directory: 'Active Directory Users and Computers', m365: 'Microsoft 365 admin center', entra: 'Microsoft Entra admin center', printmgmt: 'Print Management', services: 'Services', terminal: 'Windows PowerShell' } as Record<string, string>)[id] ?? id; }

/** Open a ticket in the Service Desk. */
export function openTicket(id: number): void {
  openApp('tickets');
  ticketView = id;
  G.renderTickets();
}
(G.CorpDesk ||= {}).openTicket = openTicket;

// ---- extra controls on the ticket page: caller verification, BitLocker key, tools to open
function verifyDialog(l: LabDef): void {
  const v = l.verify!;
  const options = [[v.good, ''] as [string, string], ...v.bad].sort(() => 0.5 - Math.random());
  const radios = options.map(([text], i) => h('label', { class: 'ad2-check' }, h('input', { type: 'radio', name: 'verify', value: String(i) }), text));
  dialog(`Verify caller: ${corpUser(v.sam)?.name ?? v.sam}`, h('div', null, h('p', null, 'How will you confirm the caller really is this employee before you change anything?'), radios), [['Confirm', () => {
    const picked = radios.findIndex((r) => (r.querySelector('input') as HTMLInputElement).checked);
    if (picked < 0) { toast('Choose how you will verify the caller.'); return false; }
    const [text, why] = options[picked]!;
    if (text !== v.good) { toast(`Not safe: ${why}`); log(9010, `LAB-${String(l.id).padStart(3, '0')}: unsafe verification method chosen`); return false; }
    lab().verified[v.sam] = nowIso();
    evidence('verify');
    log(9011, `${v.sam}: identity verified by call-back`);
    save();
  }, 'primary'], ['Cancel', () => undefined]]);
}

function provideKeyDialog(): void {
  const input = h('input', { class: 'ad2-input', placeholder: '000000-000000-000000-000000-000000-000000-000000-000000', 'aria-label': 'Recovery key' });
  dialog('Provide recovery key to Eli Foster (HR-PC04)', h('div', null, h('p', null, `Paste the 48-digit recovery key whose Key ID starts with ${keyIdShown}.`), input), [['Read key to user', () => {
    const v = input.value.trim();
    if (!/^\d{6}(-\d{6}){7}$/.test(v)) { toast('A BitLocker recovery key is 48 digits in eight groups of six.'); return false; }
    lab().bitlockerProvided[BL_DEVICE] = v;
    if (v === blKey().key) { evidence('bitlocker-provided'); log(9012, 'HR-PC04: correct recovery key provided, device unlocked'); toast('HR-PC04 unlocked and booted to Windows.'); }
    else { log(9013, 'HR-PC04: recovery key rejected'); toast('The laptop says the key is wrong. Check you matched the Key ID the user read out.'); }
    save();
  }, 'primary'], ['Cancel', () => undefined]]);
}

function decorate(): void {
  const grid = document.querySelector<HTMLElement>('#appBody .sd-detail-grid');
  if (!grid || grid.dataset.lab) return;
  const id = Number(/LAB-(\d+)/.exec(document.querySelector('#appBody .page-top h1, #appBody h1')?.textContent ?? '')?.[1]);
  const l = LAB.get(id);
  if (!l) return;
  grid.dataset.lab = String(id);
  const s = S();
  const activeHere = s.active === id;
  const panelEl = h('div', { class: 'panel ia-labpanel' },
    h('h3', null, 'Tools for this incident'),
    h('div', { class: 'ia-toolbtns' }, l.tools.map((t) => h('button', { class: 'secondary', type: 'button', onClick: () => openApp(t) }, toolName(t)))),
    l.verify ? h('div', { class: 'ia-verify' }, h('b', null, 'Caller verification: '), after(lab().verified[l.verify.sam], id) ? 'verified ✓' : h('button', { class: 'primary', type: 'button', disabled: !activeHere, onClick: () => verifyDialog(l) }, 'Verify caller')) : null,
    id === 10 ? h('div', { class: 'ia-verify' }, h('b', null, 'Recovery key: '), h('button', { class: 'secondary', type: 'button', disabled: !activeHere, onClick: provideKeyDialog }, 'Provide recovery key')) : null,
    h('details', null, h('summary', null, 'Why this matters in a real job'), h('p', null, l.realWorld), h('p', null, h('b', null, 'Interview practice: '), l.interview)),
    activeHere ? null : h('p', { class: 'ia-muted' }, 'Start the incident to inject the fault and unlock these steps.'));
  const left = grid.firstElementChild;
  left?.insertBefore(panelEl, left.children[1] ?? null);
}
new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });

// ---- PowerShell: the real cmdlets for these tasks
const oldRun = G.runCommand as (c: string) => { output: unknown; error: boolean };
G.runCommand = (command: string): { output: unknown; error: boolean } => {
  const c = String(command).trim();
  const ok = (output: string): { output: string; error: boolean } => ({ output, error: false });
  if (/^Start-ADSyncSyncCycle\b/i.test(c)) {
    if (!/-PolicyType\s+(Delta|Initial)\b/i.test(c)) return { output: 'Start-ADSyncSyncCycle : Supply -PolicyType Delta (or Initial for a full sync).', error: true };
    const r = deltaSync();
    return ok(`Result\n------\nSuccess\n\n(${r.added.length} object(s) added, ${r.removed.length} removed in Microsoft Entra ID)`);
  }
  if (/^Get-Printer\b/i.test(c)) {
    const L = lab();
    const rows = L.printers.map((p) => `${p.name.padEnd(12)} ${'LAB-DC01'.padEnd(10)} ${p.driver.padEnd(30)} ${p.port}`);
    return ok(`Name         ComputerName DriverName                     PortName\n----         ------------ ----------                     --------\n${rows.join('\n')}`);
  }
  const pj = /^Get-PrintJob\s+(?:-PrinterName\s+)?['"]?([\w-]+)['"]?/i.exec(c);
  if (pj) {
    const sp = (S().services as any[]).find((x) => x.Name === 'Spooler');
    if (sp?.Status !== 'Running') return { output: 'Get-PrintJob : The spooler service is not reachable. Ensure the spooler service is running.', error: true };
    const jobs = lab().jobs.filter((j) => j.printer.toLowerCase() === pj[1]!.toLowerCase());
    evidence('print-queue-view');
    return ok(jobs.length ? `Id  ComputerName PrinterName DocumentName                  SubmittedTime        JobStatus\n--  ------------ ----------- ------------                  -------------        ---------\n${jobs.map((j) => `${String(j.id).padEnd(3)} LAB-DC01     ${j.printer.padEnd(11)} ${j.document.padEnd(29)} ${new Date(j.submitted).toLocaleTimeString().padEnd(20)} ${j.status}`).join('\n')}` : '');
  }
  const rj = /^Remove-PrintJob\s+(?:-PrinterName\s+)?['"]?([\w-]+)['"]?\s+-ID\s+(\d+)/i.exec(c);
  if (rj) {
    const L = lab();
    const j = L.jobs.find((x) => x.printer.toLowerCase() === rj[1]!.toLowerCase() && x.id === Number(rj[2]));
    if (!j) return { output: `Remove-PrintJob : No print job with ID ${rj[2]} on ${rj[1]}.`, error: true };
    L.jobs = L.jobs.filter((x) => x !== j);
    if (j.status === 'Error - Printing') evidence('print-queue');
    log(13, `Print job ${j.id} (${j.document}) on ${j.printer} removed with PowerShell`);
    save();
    return ok('');
  }
  const tp = /^(?:Invoke-CimMethod.*PrintTestPage|Print-TestPage)\s+(?:-PrinterName\s+)?['"]?([\w-]+)/i.exec(c);
  if (tp) { printTestPage(tp[1]!); return ok(`Test page sent to ${tp[1]}.`); }
  const result = oldRun(command);
  // Starting or restarting the spooler from PowerShell counts the same as from Services.
  if (!result.error && /^(Start|Restart)-Service\b.*\bSpooler\b/i.test(c)) evidence('spooler');
  return result;
};
