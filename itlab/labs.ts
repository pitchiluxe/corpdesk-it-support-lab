/**
 * Real-world service desk incidents (LAB-006 to LAB-013), graded the same way
 * as CORP Desk's first five: start the incident to inject the fault, collect
 * evidence while you work, then "Validate & resolve" checks the evidence, the
 * live system state and your resolution notes.
 *
 * Nothing is fixed: each start rolls a new scenario (who, which department,
 * which printer, which key, which phishing domain) and often a different
 * variant (an impostor caller, an approval for Full Access only, a spooler
 * that is running but a queue that is jammed). "Practise again" rolls another.
 */
import { APPS, CHECK_LABELS, DOMAIN, G, S, TICKETS, corpUser, deviceFor, evidence, keyId, lab, log, nowIso, openApp, recoveryKey, rng, save, setLabPassword, toast, type Mail } from './corp.ts';
import { h } from './dom.ts';
import { dialog } from './ui.ts';
import { deltaSync } from './tools/m365.ts';
import { ensureServices, printTestPage } from './tools/services.ts';

declare let ticketView: number | null;
declare let currentApp: string | null;
/** Redraw the Service Desk only when it is the window in front (it draws into #appBody). */
const redrawDesk = (): void => { if (currentApp === 'tickets') G.renderTickets(); };
// CORP Desk's renderTickets() draws into whichever window is in front; only let it draw into the Service Desk.
const renderTicketsUnguarded = G.renderTickets as () => void;
G.renderTickets = (): void => { if (currentApp === 'tickets') renderTicketsUnguarded(); };

type R = ReturnType<typeof rng>;
type Run = Record<string, any> & { seed: number };
interface Text { title: string; user: string; summary: string; hint: string; checks: string[] }
export interface LabDef {
  id: number;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  tools: string[];
  realWorld: string;
  interview: string;
  /** Title and checks shown before a scenario is rolled. */
  generic: string;
  baseChecks: string[];
  roll(r: R): Run;
  text(p: Run): Text;
  inject(p: Run): void;
  restore(p: Run): void;
  criteria(p: Run): boolean;
  verify?: (p: Run) => { sam: string; impostor: boolean; good: string; bad: [string, string][] };
  provideKey?: (p: Run) => { device: string; key: string; shown: string; owner: string };
}

const E3 = 'Microsoft 365 E3';
const NL = '\n';
const DEPTS = ['HR', 'IT', 'Finance'] as const;
const SHARED: Record<string, string> = { HR: `hr@${DOMAIN}`, Finance: `finance@${DOMAIN}`, IT: `servicedesk@${DOMAIN}` };
const SHARED_NAME: Record<string, string> = { HR: 'HR Team', Finance: 'Finance Team', IT: 'IT Service Desk' };
const BASELINE: Record<string, { fa: string[]; sa: string[] }> = { [`hr@${DOMAIN}`]: { fa: ['hr01'], sa: ['hr01'] }, [`finance@${DOMAIN}`]: { fa: ['finance01'], sa: ['finance01'] }, [`servicedesk@${DOMAIN}`]: { fa: ['it01', 'it02'], sa: ['it01'] } };
const TITLES: Record<string, string[]> = {
  HR: ['HR Generalist', 'Recruitment Coordinator', 'Payroll Specialist', 'HR Business Partner'],
  IT: ['Service Desk Analyst', 'Desktop Support Technician', 'Systems Administrator', 'Network Technician'],
  Finance: ['Financial Analyst', 'Accounts Payable Clerk', 'Payroll Accountant', 'Budget Analyst'],
};
const FIRST = ['Priya', 'Marcus', 'Elena', 'Kwame', 'Sofia', 'Daniel', 'Aisha', 'Tomás', 'Grace', 'Hiroshi', 'Leila', 'Owen', 'Nadia', 'Samuel', 'Chloe', 'Ibrahim'];
const LAST = ['Shah', 'Bennett', 'Okafor', 'Novak', 'Lindqvist', 'Moreau', 'Haddad', 'Castillo', 'Kim', 'Fischer', 'Mensah', 'Rossi', 'Walsh', 'Tanaka'];
/** Accounts the original five incidents rely on; the random scenarios leave them alone. */
const RESERVED = ['hr01', 'hr02', 'hr03', 'finance01'];

const after = (iso: string | undefined, id: number): boolean => !!iso && iso >= (lab().started?.[id] ?? '');
const started = (): Record<number, string> => (lab().started ||= {});
const runs = (): Record<number, Run> => (lab().runs ||= {}) as Record<number, Run>;
const pad = (n: number): string => String(n).padStart(3, '0');
const users = (): any[] => S().users;
/** People a scenario can be about: enabled staff in a department OU, not used by the original five. */
const staff = (dept?: string): any[] => users().filter((u) => u.enabled && !u.locked && u.path?.startsWith('Lab/Users/') && !RESERVED.includes(u.sam) && (!dept || u.dept === dept));
const group = (dept: string): string => `GG_${dept}_Staff`;
const mbx = (address: string): any => lab().mailboxes.find((m) => m.address === address);
const first = (u: any): string => String(u?.name ?? '').split(' ')[0] ?? '';

const mail = (m: Partial<Mail> & Pick<Mail, 'id' | 'from' | 'fromName' | 'subject' | 'body'>): void => {
  const L = lab();
  L.inbox = L.inbox.filter((x) => x.id !== m.id);
  L.inbox.push({ to: `servicedesk@${DOMAIN}`, received: nowIso(), read: false, headers: [`From: ${m.fromName} <${m.from}>`, `To: servicedesk@${DOMAIN}`, `Return-Path: <${m.from}>`, `Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`].join(NL), ...m } as Mail);
  L.purged = L.purged.filter((x) => x !== m.id && x !== `del:${m.id}`);
};
const unmail = (id: string): void => { const L = lab(); L.inbox = L.inbox.filter((x) => x.id !== id); };
const resetShared = (address: string): void => { const m = mbx(address), b = BASELINE[address]; if (m && b) { m.fullAccess = [...b.fa]; m.sendAs = [...b.sa]; } };

export const LABS: LabDef[] = [
  // ---------------------------------------------------------------- Joiner
  {
    id: 6, category: 'Onboarding (joiner)', priority: 'Medium', tools: ['outlook', 'directory', 'm365'],
    generic: 'New hire starts soon: create the new starter\'s accounts', baseChecks: ['onboard-request', 'sync'],
    realWorld: 'Joiners are the most common planned work on a service desk. Accounts are built from an approved HR request, never from a phone call, and in hybrid companies they reach Microsoft 365 through Entra Connect sync before a licence and mailbox can be assigned.',
    interview: 'Walk me through onboarding a new hire: HR request, AD account in the right OU with role groups, sync to Entra ID, licence for a mailbox, and a first-logon password handed over securely.',
    roll(r) {
      const dept = r.pick(DEPTS);
      let fn = r.pick(FIRST), ln = r.pick(LAST), sam = (fn[0] + ln).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
      for (let i = 0; corpUser(sam) && i < 20; i++) { fn = r.pick(FIRST); ln = r.pick(LAST); sam = (fn[0] + ln).toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''); }
      const manager = r.pick(staff(dept).length ? staff(dept) : users().filter((u) => u.dept === dept));
      return { seed: 0, dept, first: fn, last: ln, sam, title: r.pick(TITLES[dept]!), manager: manager.sam, managerName: manager.name, shared: r.chance(0.5), day: r.pick(['Monday', 'Tuesday', 'Wednesday']), ref: `HR-${r.int(2100, 2999)}` };
    },
    text: (p) => ({
      title: `New hire starts ${p.day}: create ${p.first} ${p.last}'s accounts`, user: p.manager,
      summary: `${p.managerName} (${p.dept} manager) has sent an approved onboarding request (${p.ref}) to the service desk mailbox. ${p.first} ${p.last} joins ${p.dept} as ${p.title} on ${p.day}. Build the account exactly as requested, get it into Microsoft 365, license it, and make sure the mailbox exists.`,
      hint: `Read the request in Outlook. ADUC: create ${p.sam} in Lab > Users > ${p.dept}, set the job title and manager, add ${group(p.dept)}, require a password change at first logon. Then run a delta sync (M365 admin or Start-ADSyncSyncCycle -PolicyType Delta) and assign ${E3}.${p.shared ? ' The request also asks for shared mailbox access: grant only what it says.' : ''}`,
      checks: ['onboard-request', 'sync'],
    }),
    inject(p) {
      S().users = users().filter((u) => u.sam !== p.sam);
      const L = lab(); L.synced = L.synced.filter((x) => x !== p.sam); delete L.licenses[p.sam]; L.mailboxes = L.mailboxes.filter((m) => m.owner !== p.sam);
      if (p.shared) resetShared(SHARED[p.dept]!);
      mail({ id: 'm-onboard', from: `${p.manager}@${DOMAIN}`, fromName: p.managerName, subject: `New starter ${p.day}: ${p.first} ${p.last} (${p.dept})`, evidence: 'onboard-request',
        body: [`Hi service desk,`, '', `Please set up access for our new starter (HR reference ${p.ref}, approved).`, '', `Name: ${p.first} ${p.last}`, `Logon name: ${p.sam}`, `Job title: ${p.title}`, `Department: ${p.dept}`, `Manager: ${p.managerName} (${p.manager})`, `Start date: ${p.day}`, `Access: ${p.dept} team role (${group(p.dept)}), email (${E3})`, ...(p.shared ? [`Also: read access to the ${SHARED_NAME[p.dept]} shared mailbox (${SHARED[p.dept]}). Read only: no Send As.`] : []), '', 'Please make them change the password the first time they sign in.', '', 'Thanks,', first({ name: p.managerName })].join(NL) });
    },
    restore(p) { S().users = users().filter((u) => u.sam !== p.sam); const L = lab(); L.synced = L.synced.filter((x) => x !== p.sam); delete L.licenses[p.sam]; L.mailboxes = L.mailboxes.filter((m) => m.owner !== p.sam); if (p.shared) resetShared(SHARED[p.dept]!); unmail('m-onboard'); },
    criteria(p) {
      const u = corpUser(p.sam), L = lab(), sh = mbx(SHARED[p.dept]!);
      return !!u && u.path === `Lab/Users/${p.dept}` && u.groups.includes(group(p.dept)) && String(u.title ?? '').toLowerCase() === p.title.toLowerCase() && u.manager === p.manager && u.enabled && !!u.accountOptions?.mustChange
        && L.synced.includes(p.sam) && L.licenses[p.sam] === E3 && L.mailboxes.some((m) => m.owner === p.sam)
        && (p.shared ? sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam) : !sh.fullAccess.includes(p.sam));
    },
  },
  // ---------------------------------------------------------------- Mover
  {
    id: 13, category: 'Transfer (mover)', priority: 'Medium', tools: ['outlook', 'directory', 'm365'],
    generic: 'Internal transfer: move an employee to their new team', baseChecks: ['mover-notice'],
    realWorld: 'Movers are where access quietly piles up: people change teams and keep everything they had. The fix is to grant the new role and remove the old one on the same day, and to update the directory (OU, department, title, manager) so policies and approvals follow the person.',
    interview: 'Someone moves from HR to Finance. What changes in AD and Microsoft 365, and what do you remove?',
    roll(r) {
      const candidates = staff();
      const u = r.pick(candidates);
      const to = r.pick(DEPTS.filter((d) => d !== u.dept));
      const mgrs = staff(to).filter((x) => x.sam !== u.sam);
      const mgr = r.pick(mgrs.length ? mgrs : users().filter((x) => x.dept === to));
      return { seed: 0, sam: u.sam, name: u.name, from: u.dept, to, title: r.pick(TITLES[to]!), manager: mgr.sam, managerName: mgr.name, oldShared: r.chance(0.6), effective: r.pick(['today', 'Monday']), ref: `HR-${r.int(3100, 3999)}` };
    },
    text: (p) => ({
      title: `Transfer: ${p.name} moves from ${p.from} to ${p.to}`, user: p.manager,
      summary: `HR has sent a transfer notice (${p.ref}). ${p.name} (${p.sam}) moves from ${p.from} to ${p.to} as ${p.title}, reporting to ${p.managerName}, effective ${p.effective}. Give them the new team's access, take away the old team's, and update the directory so it shows who they are now.`,
      hint: `ADUC: move ${p.sam} to Lab > Users > ${p.to}; on Member Of remove ${group(p.from)} and add ${group(p.to)}; on Organization set Department ${p.to}, Job title and Manager.${p.oldShared ? ` Microsoft 365 admin: remove their access to the ${SHARED_NAME[p.from]} shared mailbox.` : ''}`,
      checks: ['mover-notice'],
    }),
    inject(p) {
      const u = corpUser(p.sam);
      if (u) { u.path = `Lab/Users/${p.from}`; u.dept = p.from; u.groups = [group(p.from)]; u.enabled = true; u.locked = false; }
      const sh = mbx(SHARED[p.from]!);
      if (sh) { resetShared(SHARED[p.from]!); if (p.oldShared) { sh.fullAccess.push(p.sam); sh.sendAs.push(p.sam); } }
      mail({ id: 'm-mover', from: `hr01@${DOMAIN}`, fromName: 'Maya Chen', subject: `Transfer notice: ${p.name} — ${p.from} to ${p.to}`, evidence: 'mover-notice',
        body: ['Hello IT,', '', `${p.name} (${p.sam}) is transferring (HR reference ${p.ref}), effective ${p.effective}.`, '', `From: ${p.from}`, `To: ${p.to}`, `New job title: ${p.title}`, `New manager: ${p.managerName} (${p.manager})`, '', `Please give ${first(p)} the ${p.to} team access and remove everything that belonged to the ${p.from} role${p.oldShared ? `, including the ${SHARED_NAME[p.from]} shared mailbox` : ''}. Update the directory details too.`, '', 'Thanks,', 'Maya Chen, HR'].join(NL) });
    },
    restore(p) {
      const u = corpUser(p.sam);
      if (u) { u.path = `Lab/Users/${p.from}`; u.dept = p.from; u.groups = [group(p.from)]; }
      resetShared(SHARED[p.from]!);
      unmail('m-mover');
    },
    criteria(p) {
      const u = corpUser(p.sam), sh = mbx(SHARED[p.from]!);
      return !!u && u.path === `Lab/Users/${p.to}` && u.groups.includes(group(p.to)) && !u.groups.includes(group(p.from)) && u.dept === p.to
        && String(u.title ?? '').toLowerCase() === p.title.toLowerCase() && u.manager === p.manager && !sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam);
    },
  },
  // ---------------------------------------------------------------- Leaver
  {
    id: 7, category: 'Offboarding (leaver)', priority: 'High', tools: ['outlook', 'directory', 'm365'],
    generic: 'Termination today: offboard a leaver', baseChecks: ['leaver-notice', 'revoke'],
    realWorld: 'Leavers are a security task: the account must stop working at the agreed time, sessions already open must be ended, and data is kept (shared mailbox) for the business. Deleting accounts on day one loses mail and audit history.',
    interview: 'What do you do when someone is terminated? Disable (not delete), revoke sessions, remove groups, block cloud sign-in, convert the mailbox to shared for the manager, reclaim the licence and the laptop, and document everything on the ticket.',
    roll(r) {
      const u = r.pick(staff());
      const mgrs = staff(u.dept).filter((x) => x.sam !== u.sam);
      const mgr = r.pick(mgrs.length ? mgrs : users().filter((x) => x.dept === u.dept && x.sam !== u.sam));
      return { seed: 0, sam: u.sam, name: u.name, dept: u.dept, manager: mgr.sam, managerName: mgr.name, hadShared: r.chance(0.5), time: r.pick(['12:00', '15:30', '17:00']), ref: `HR-${r.int(2300, 2999)}` };
    },
    text: (p) => ({
      title: `Termination today: offboard ${p.name}`, user: p.manager,
      summary: `HR has confirmed ${p.name} (${p.sam}, ${p.dept}) leaves today at ${p.time}. Follow the leaver checklist in the HR notice: lock the account everywhere, keep the mailbox for the manager, and free the licence. Nothing may be deleted.`,
      hint: `ADUC: disable ${p.sam}, move it to Lab > Disabled, remove its group memberships. Microsoft 365 admin: block sign-in and sign out of all sessions, convert the mailbox to shared, give ${p.managerName} (${p.manager}) Full Access, then remove the licence.${p.hadShared ? ` Their access to the ${SHARED_NAME[p.dept]} shared mailbox goes too.` : ''}`,
      checks: ['leaver-notice', 'revoke'],
    }),
    inject(p) {
      const u = corpUser(p.sam);
      if (u) { u.enabled = true; u.locked = false; u.path = `Lab/Users/${p.dept}`; u.groups = [group(p.dept)]; }
      const L = lab();
      if (!L.synced.includes(p.sam)) L.synced.push(p.sam);
      L.licenses[p.sam] = E3; L.blocked = L.blocked.filter((x) => x !== p.sam);
      const m = L.mailboxes.find((x) => x.owner === p.sam); if (m) { m.type = 'user'; m.fullAccess = []; m.sendAs = []; }
      resetShared(SHARED[p.dept]!);
      if (p.hadShared) { const sh = mbx(SHARED[p.dept]!); sh.fullAccess.push(p.sam); sh.sendAs.push(p.sam); }
      mail({ id: 'm-leaver', from: `hr01@${DOMAIN}`, fromName: 'Maya Chen', subject: `Leaver notice: ${p.name} (${p.dept}) — today ${p.time}`, evidence: 'leaver-notice',
        body: ['Hello IT,', '', `${p.name} (${p.sam}), ${p.dept} department, leaves the company today. Last working time: ${p.time}. HR reference ${p.ref}.`, '', 'Leaver checklist:', '1. Disable the account and move it to the Disabled OU. Do not delete it.', '2. Remove all group memberships.', '3. Block Microsoft 365 sign-in and sign them out everywhere.', `4. Convert the mailbox to a shared mailbox and give the manager, ${p.managerName} (${p.manager}), Full Access.`, '5. Remove the Microsoft 365 licence.', ...(p.hadShared ? [`6. Remove their access to the ${SHARED_NAME[p.dept]} shared mailbox.`] : []), '', 'Thank you,', 'Maya Chen, HR'].join(NL) });
    },
    restore(p) {
      const u = corpUser(p.sam);
      if (u) { u.enabled = true; u.path = `Lab/Users/${p.dept}`; u.groups = [group(p.dept)]; }
      const L = lab(); L.licenses[p.sam] = E3; L.blocked = L.blocked.filter((x) => x !== p.sam);
      const m = L.mailboxes.find((x) => x.owner === p.sam); if (m) { m.type = 'user'; m.fullAccess = []; m.sendAs = []; }
      resetShared(SHARED[p.dept]!);
      unmail('m-leaver');
    },
    criteria(p) {
      const u = corpUser(p.sam), L = lab(), m = L.mailboxes.find((x) => x.owner === p.sam), sh = mbx(SHARED[p.dept]!);
      return !!u && !u.enabled && u.path === 'Lab/Disabled' && u.groups.length === 0 && L.blocked.includes(p.sam) && after(L.sessionsRevoked[p.sam], 7)
        && !!m && m.type === 'shared' && m.fullAccess.includes(p.manager) && !L.licenses[p.sam] && !sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam);
    },
  },
  // ---------------------------------------------------------------- Printing
  {
    id: 8, category: 'Printing', priority: 'Medium', tools: ['printmgmt', 'services', 'terminal'],
    generic: 'A department cannot print', baseChecks: ['print-queue', 'print-test'],
    realWorld: '"I can\'t print" is one of the most frequent service desk calls. The usual causes are a stopped or crashed Print Spooler and a corrupt job jamming the queue. Find which one it is, clear only the bad job, and prove it works with a test page.',
    interview: 'A department cannot print. How do you troubleshoot? Check the printer and its queue, the Print Spooler service, clear the stuck job, restart the spooler if needed, then print a test page and confirm with the users.',
    roll(r) {
      const printer = r.pick(lab().printers);
      const dept = printer.name.startsWith('HR') ? 'HR' : printer.name.startsWith('FIN') ? 'Finance' : 'IT';
      const people = r.shuffle(users().filter((u) => u.dept === dept));
      const docs = r.shuffle(['Payroll_Summary_Q3.pdf', 'Board pack FINAL v7.pdf', 'Scanned contracts (412 pages).pdf', 'Benefits enrolment forms.pdf', 'Asset register export.xlsx', 'Annual report draft.docx']);
      const base = r.int(20, 80);
      const jobs = [0, 1, 2, 3].slice(0, r.int(3, 4)).map((i) => ({ id: base + i, owner: people[i % people.length].sam, document: i === 0 ? docs[0] : r.pick(['Interview schedule.docx', 'Leave request.pdf', 'Meeting notes.docx', 'Expense claim.xlsx', 'Rota.xlsx']), pages: i === 0 ? r.int(180, 420) : r.int(1, 6), minutes: 50 - i * 10 }));
      return { seed: 0, printer: printer.name, dept, jobs, spoolerDown: r.chance(0.6), reporter: people[1]?.sam ?? people[0].sam, reporterName: people[1]?.name ?? people[0].name };
    },
    text: (p) => ({
      title: `${p.dept} cannot print: jobs stuck on ${p.printer}`, user: p.reporter,
      summary: `Several people in ${p.dept} say nothing prints on ${p.printer}, and the printer itself shows no error. ${corpUser(p.jobs[0].owner)?.name ?? p.jobs[0].owner} sent a large document just before it stopped. Find out why the queue is not moving, fix it without deleting other people's documents unnecessarily, and prove printing works.`,
      hint: 'Print Management shows the queue and its status. Is the Print Spooler service running (Services, or Get-Service Spooler)? A corrupt job at the top of a queue blocks everything behind it: cancel only that one, then print a test page.',
      checks: p.spoolerDown ? ['spooler', 'print-queue', 'print-test'] : ['print-queue', 'print-test'],
    }),
    inject(p) {
      ensureServices();
      const sp = (S().services as any[]).find((x) => x.Name === 'Spooler');
      if (sp) sp.Status = p.spoolerDown ? 'Stopped' : 'Running';
      const L = lab();
      L.jobs = L.jobs.filter((j) => j.printer !== p.printer);
      for (const [i, j] of p.jobs.entries()) L.jobs.push({ id: j.id, printer: p.printer, owner: j.owner, document: j.document, pages: j.pages, status: i === 0 ? 'Error - Printing' : 'Queued', submitted: new Date(Date.now() - j.minutes * 60000).toISOString() });
      delete L.testPages[p.printer];
      if (p.spoolerDown) log(7031, 'The Print Spooler service terminated unexpectedly.');
    },
    restore(p) { ensureServices(); const sp = (S().services as any[]).find((x) => x.Name === 'Spooler'); if (sp) sp.Status = 'Running'; const L = lab(); L.jobs = L.jobs.filter((j) => j.printer !== p.printer); },
    criteria(p) {
      const L = lab(), sp = (S().services as any[]).find((x) => x.Name === 'Spooler');
      return sp?.Status === 'Running' && !L.jobs.some((j) => j.printer === p.printer && j.status === 'Error - Printing') && after(L.testPages[p.printer], 8);
    },
  },
  // ---------------------------------------------------------------- MFA
  {
    id: 9, category: 'Identity & MFA', priority: 'High', tools: ['entra'],
    generic: 'New phone: a caller needs their MFA reset', baseChecks: ['verify'],
    realWorld: 'MFA resets are a favourite target of social engineering: attackers phone the help desk pretending to be employees. Real service desks verify identity with a call-back to a number on file or a manager-approved code before resetting anything, and escalate when verification fails.',
    interview: 'Someone calls saying they lost their phone and need MFA reset. What do you do, and what if you cannot verify them?',
    roll(r) {
      const u = r.pick(staff());
      return { seed: 0, sam: u.sam, name: u.name, impostor: r.chance(0.3), oldPhone: r.pick(['iPhone 12', 'Galaxy S21', 'Pixel 6', 'iPhone 13 mini']), newPhone: r.pick(['iPhone 15', 'Galaxy S24', 'Pixel 8']) };
    },
    text: (p) => ({
      title: `New phone: reset MFA for ${p.name}?`, user: p.sam,
      summary: `A caller says they are ${p.name} (${p.sam}), got a new ${p.newPhone} this weekend and can no longer approve sign-ins. Verify who is calling before you touch anything. If they are who they say, remove the old authenticator, make them register MFA again and sign them out everywhere. If verification fails, change nothing and escalate.`,
      hint: 'Use "Verify caller" on this ticket first. Verified: Entra admin center > Users > the user > Authentication methods: delete the old Microsoft Authenticator, "Require re-register multifactor authentication", then Revoke sessions. Not verified: leave the account alone and use "Escalate to Security".',
      checks: ['verify'],
    }),
    verify: (p) => ({ sam: p.sam, impostor: !!p.impostor, good: 'Call back on the mobile number in the HR directory and confirm a one-time code sent to their manager', bad: [['Ask them to confirm their password', 'Never ask for a password. A real employee does not need to give it, and an attacker would.'], ['They know their manager\'s name and department, so it is them', 'Names and departments are on LinkedIn. That is exactly how help desk social engineering works.']] }),
    inject(p) {
      const L = lab();
      L.methods[p.sam] = [{ id: `${p.sam}-oldapp`, type: 'Microsoft Authenticator', detail: `${p.oldPhone} (old phone)`, added: new Date(Date.now() - 500 * 864e5).toISOString() }, { id: `${p.sam}-sms`, type: 'Phone (SMS)', detail: `+1 555 01${String(L.methods ? Object.keys(L.methods).length % 90 + 10 : 42)}`, added: new Date(Date.now() - 520 * 864e5).toISOString() }];
      L.reregister[p.sam] = false; delete L.verified[p.sam]; delete (L.impostor ||= {})[p.sam]; delete (L.escalated ||= {})[9];
    },
    restore(p) { const L = lab(); L.reregister[p.sam] = false; delete L.verified[p.sam]; delete (L.impostor ||= {})[p.sam]; delete (L.escalated ||= {})[9]; },
    criteria(p) {
      const L = lab();
      const oldStill = (L.methods[p.sam] ?? []).some((m) => m.id === `${p.sam}-oldapp`);
      if (p.impostor) return !!L.impostor?.[p.sam] && oldStill && !L.reregister[p.sam] && !after(L.sessionsRevoked[p.sam], 9) && after(L.escalated?.[9], 9);
      return !oldStill && !!L.reregister[p.sam] && after(L.sessionsRevoked[p.sam], 9) && after(L.verified[p.sam], 9);
    },
  },
  // ---------------------------------------------------------------- BitLocker
  {
    id: 10, category: 'Endpoint & encryption', priority: 'High', tools: ['entra'],
    generic: 'Laptop stuck on the BitLocker recovery screen', baseChecks: ['verify', 'bitlocker-view', 'bitlocker-provided'],
    realWorld: 'Firmware updates, docking changes and TPM resets trigger BitLocker recovery. The key is stored in Entra ID (or AD). Giving out the wrong key wastes the user\'s time; giving a key to an unverified caller hands over an encrypted laptop.',
    interview: 'A user is on the BitLocker recovery screen. Where do you find the key, and how do you make sure it is the right one for the right person?',
    roll(r) {
      const u = r.pick(staff());
      const extra = r.int(1, 2);
      const seeds = Array.from({ length: extra }, () => `${u.sam}-${r.int(1000, 9999)}`);
      return { seed: 0, sam: u.sam, name: u.name, device: deviceFor(u), seeds, shownIndex: r.int(0, extra), cause: r.pick(['installed a BIOS update last night', 'swapped to a new docking station', 'had the motherboard replaced under warranty', 'reset the TPM while troubleshooting']) };
    },
    text: (p) => {
      const k = blShown(p);
      return { title: `${p.device} stuck on the BitLocker recovery screen`, user: p.sam,
        summary: `${p.name} (${p.sam}) ${p.cause}. This morning ${p.device} asks for a BitLocker recovery key. They read this from the screen: "Recovery key ID: ${k.id.slice(0, 8)}…". Verify them, find the matching key for their device, and give them the right recovery key.`,
        hint: `Verify caller first. Entra admin center > Devices > ${p.device} > BitLocker keys. The device has more than one key: match the Key ID the user read out, then use "Provide recovery key" on this ticket.`, checks: ['verify', 'bitlocker-view', 'bitlocker-provided'] };
    },
    verify: (p) => ({ sam: p.sam, impostor: false, good: 'Call them back on the desk phone listed in the HR directory and confirm their employee number', bad: [['Read the key to whoever is calling, it is urgent', 'Urgency is the attacker\'s favourite tool. Verify first, every time.'], ['Email the key to the personal address they give you', 'Recovery keys never go to unverified or personal addresses.']] }),
    provideKey: (p) => { const k = blShown(p); return { device: p.device, key: k.key, shown: k.id.slice(0, 8), owner: p.name }; },
    inject(p) {
      const L = lab();
      let d = L.devices.find((x) => x.name === p.device);
      if (!d) { d = { name: p.device, owner: p.sam, os: 'Windows 11 Enterprise 23H2', compliant: true, lastSync: nowIso(), keys: [] }; L.devices.push(d); }
      d.keys = d.keys.filter((k) => !p.seeds.some((s: string) => k.id === keyId(s)));
      p.seeds.forEach((s: string, i: number) => d!.keys.push({ id: keyId(s), key: recoveryKey(s), created: new Date(Date.now() - (i + 1) * 3 * 864e5).toISOString() }));
      delete L.bitlockerProvided[p.device]; delete L.verified[p.sam];
    },
    restore(p) { const L = lab(); delete L.bitlockerProvided[p.device]; delete L.verified[p.sam]; },
    criteria(p) { const L = lab(); return L.bitlockerProvided[p.device] === blShown(p).key && after(L.verified[p.sam], 10); },
  },
  // ---------------------------------------------------------------- Phishing
  {
    id: 11, category: 'Security incident', priority: 'Critical', tools: ['outlook', 'm365', 'entra', 'directory'],
    generic: 'Phishing reported by a user', baseChecks: ['phish-headers', 'phish-report', 'explorer'],
    realWorld: 'Phishing is the most common way accounts are compromised. Tier 1 contains it: confirm with the headers, purge the message tenant-wide, block the sender, and if credentials were entered reset the password and revoke sessions, then escalate to security with what you found.',
    interview: 'A user clicked a phishing link. What do you do if they entered their password, and what if they did not?',
    roll(r) {
      const domain = r.pick(['corp-example-payments.com', 'corpexample-sharepoint.net', 'docusign-corp-example.com', 'corp-example-hr-portal.org', 'microsoft-corp-example.support']);
      const lure = r.pick([
        { subject: 'URGENT Invoice #{n} overdue – payment details required', from: 'billing', display: 'CORP Payroll', text: 'Your department has an overdue invoice. To avoid late fees, sign in within 24 hours to confirm payment details:' },
        { subject: 'You have a new shared document: Q{q} salary review.xlsx', from: 'share', display: 'SharePoint Online', text: 'A colleague shared a confidential file with you. Sign in to view it before the link expires:' },
        { subject: 'Action required: your mailbox password expires today', from: 'it-support', display: 'IT Helpdesk', text: 'Your password expires in 2 hours. Keep your current password by verifying here:' },
        { subject: 'Please review and sign: Employment agreement amendment', from: 'dse', display: 'DocuSign', text: 'You have a document waiting for your signature. Review and sign:' },
      ]);
      const reporter = r.pick(staff());
      const others = r.shuffle(users().filter((u) => u.sam !== reporter.sam && u.enabled)).slice(0, r.int(1, 3)).map((u) => u.sam);
      return { seed: 0, domain, from: lure.from, display: lure.display, subject: lure.subject.replace('{n}', String(r.int(10000, 99999))).replace('{q}', String(r.int(1, 4))), text: lure.text, path: r.pick(['sso/login', 'auth/verify', 'secure/signin']), reporter: reporter.sam, reporterName: reporter.name, recipients: [reporter.sam, ...others], entered: r.chance(0.6), ip: `203.0.113.${r.int(2, 250)}` };
    },
    text: (p) => ({
      title: p.entered ? `Phishing: ${p.reporterName} entered their password on a fake page` : `Phishing reported by ${p.reporterName}`, user: p.reporter,
      summary: `${p.reporterName} (${p.reporter}) forwarded a suspicious "${p.subject}" email to the service desk mailbox. ${p.entered ? 'They say they typed their password into the page it opened.' : 'They opened the link but closed the page without typing anything.'} The same message reached other people. Confirm it is phishing, remove it from every mailbox, and stop more arriving.${p.entered ? ' Then secure their account.' : ''}`,
      hint: `Outlook: View message details (sender domain, Return-Path, SPF/DMARC), then Report phishing. Microsoft 365 admin > Explorer: search the sender and soft delete it from all mailboxes; Tenant Allow/Block List: block the domain.${p.entered ? ` Then reset ${p.reporter}'s password (ADUC or M365) and revoke their sessions.` : ' No credentials were entered, so a password reset is not required.'}`,
      checks: ['phish-headers', 'phish-report', 'explorer'],
    }),
    inject(p) {
      const L = lab();
      const original = ['Dear colleague,', '', p.text, `https://${p.domain}/${p.path}`, '', p.display].join(NL);
      const headers = [`From: "${p.display}" <${p.from}@${p.domain}>`, `Reply-To: <collect@${p.domain}>`, `Return-Path: <bounce-${p.ip.split('.').pop()}@mailer.${p.domain}>`, `To: ${p.recipients.map((s: string) => `${s}@${DOMAIN}`).join(', ')}`, `Received: from mailer.${p.domain} (${p.ip})`, `Authentication-Results: spf=fail (sender IP is ${p.ip}) smtp.mailfrom=${p.domain}; dkim=none; dmarc=fail action=none header.from=${p.domain}`, 'X-MS-Exchange-Organization-SCL: 5'].join(NL);
      mail({ id: 'm-phish-fwd', from: `${p.reporter}@${DOMAIN}`, fromName: p.reporterName, subject: `FW: ${p.subject}`, phishing: true, headers,
        body: [p.entered ? 'Hi IT, I clicked this and put my password in before I noticed the address looked odd. Sorry! Can you check?' : 'Hi IT, this looks suspicious. I opened the link but closed it without typing anything.', first({ name: p.reporterName }), '', '-------- Forwarded message (attached) --------', `From: ${p.display} <${p.from}@${p.domain}>`, `Subject: ${p.subject}`, '', original].join(NL) });
      mail({ id: 'm-phish', from: `${p.from}@${p.domain}`, fromName: p.display, to: `${p.reporter}@${DOMAIN}`, subject: p.subject, body: original, hidden: true, read: true, recipients: p.recipients, headers });
      L.blockedSenders = L.blockedSenders.filter((x) => !x.includes(p.domain));
    },
    restore() { unmail('m-phish'); unmail('m-phish-fwd'); },
    criteria(p) {
      const L = lab(), u = corpUser(p.reporter);
      return L.purged.includes('m-phish') && L.blockedSenders.some((x) => x.includes(p.domain)) && (!p.entered || (after(u?.passwordLastSet, 11) && after(L.sessionsRevoked[p.reporter], 11)));
    },
  },
  // ---------------------------------------------------------------- Shared mailbox access
  {
    id: 12, category: 'Microsoft 365 access', priority: 'Low', tools: ['outlook', 'm365'],
    generic: 'Access request: shared mailbox', baseChecks: ['mailbox-approval'],
    realWorld: 'Access requests are daily work. The rule is least privilege with recorded approval: grant what the owner approved, to the person named, and note the approval on the ticket.',
    interview: 'Someone asks for access to a shared mailbox. What do you check before you grant it?',
    roll(r) {
      const address = r.pick(Object.keys(BASELINE));
      const owner = corpUser(BASELINE[address]!.fa[0]!);
      const requester = r.pick(staff().filter((u) => !BASELINE[address]!.fa.includes(u.sam)));
      return { seed: 0, address, mailboxName: mbx(address)?.name ?? address, owner: owner.sam, ownerName: owner.name, sam: requester.sam, name: requester.name, sendAs: r.chance(0.5), reason: r.pick(['covers the inbox while a colleague is on leave', 'joins the team rota for the shared inbox', 'handles supplier emails for the next quarter']) };
    },
    text: (p) => ({
      title: `Access request: ${p.mailboxName} mailbox for ${p.name}`, user: p.sam,
      summary: `${p.name} (${p.sam}) needs access to the ${p.mailboxName} shared mailbox (${p.address}): ${p.reason}. Check what the mailbox owner approved, then grant exactly that, nothing more.`,
      hint: `Read the approval in Outlook. Microsoft 365 admin > Shared mailboxes > ${p.mailboxName}: add ${p.sam} to what was approved (Read and manage, and Send as only if approved). Do not add anyone else.`,
      checks: ['mailbox-approval'],
    }),
    inject(p) {
      resetShared(p.address);
      mail({ id: 'm-approval', from: `${p.owner}@${DOMAIN}`, fromName: p.ownerName, subject: `Approved: ${p.mailboxName} mailbox access for ${p.name}`, evidence: 'mailbox-approval',
        body: ['Hi IT,', '', `As owner of the ${p.mailboxName} shared mailbox I approve access for ${p.name} (${p.sam}): ${p.reason}.`, '', p.sendAs ? `They need to read the mailbox and send as ${p.address}.` : `Read access only, please. They must NOT send as ${p.address}.`, '', 'No one else needs access.', '', p.ownerName].join(NL) });
    },
    restore(p) { resetShared(p.address); unmail('m-approval'); },
    criteria(p) {
      const m = mbx(p.address), b = BASELINE[p.address]!;
      const faOk = m.fullAccess.includes(p.sam) && m.fullAccess.every((x: string) => b.fa.includes(x) || x === p.sam);
      const saOk = p.sendAs ? m.sendAs.includes(p.sam) && m.sendAs.every((x: string) => b.sa.includes(x) || x === p.sam) : !m.sendAs.includes(p.sam) && m.sendAs.every((x: string) => b.sa.includes(x));
      return !!m && faOk && saOk;
    },
  },
];
function blShown(p: Run): { id: string; key: string } {
  const owner = corpUser(p.sam);
  const all = [`${p.sam}-a`, ...p.seeds];
  const seed = all[Math.min(p.shownIndex + 1, all.length - 1)] ?? all[0]!;
  void owner;
  return { id: keyId(seed), key: recoveryKey(seed) };
}
const LAB = new Map(LABS.map((l) => [l.id, l]));
export const labById = (id: number): LabDef | undefined => LAB.get(id);
export const runOf = (id: number): Run | undefined => runs()[id];

// ---- register with the Service Desk
function applyText(l: LabDef): void {
  const p = runs()[l.id];
  const t = TICKETS().find((x) => x.id === l.id) ?? (() => { const x: any = { id: l.id, lab: true }; TICKETS().push(x); return x; })();
  if (p) Object.assign(t, l.text(p), { category: l.category, priority: l.priority, lab: true });
  else Object.assign(t, { title: l.generic, user: 'Assigned on start', category: l.category, priority: l.priority, lab: true, checks: l.baseChecks, hint: 'Start the incident to receive the details.', summary: `${l.generic}. Start the incident to receive the caller, the people involved and the details. Every run is a different scenario, so you have to read the ticket and investigate rather than remember an answer.` });
}
LABS.sort((a, b) => a.id - b.id).forEach(applyText);
Object.assign(CHECK_LABELS(), {
  'onboard-request': 'Read the approved onboarding request', sync: 'Run an Entra Connect delta sync', 'leaver-notice': 'Read the HR leaver notice', 'mover-notice': 'Read the HR transfer notice',
  revoke: 'Revoke the user\'s sessions', spooler: 'Start or restart the Print Spooler', 'print-queue': 'Cancel the corrupt print job', 'print-test': 'Print a test page',
  verify: 'Verify the caller\'s identity', 'bitlocker-view': 'Look up the device\'s BitLocker keys', 'bitlocker-provided': 'Give the user the matching recovery key',
  'phish-headers': 'Inspect the message headers', 'phish-report': 'Report the message as phishing', explorer: 'Search Explorer for every copy',
  'mailbox-approval': 'Read the mailbox owner\'s approval',
});

const oldCriteria = G.criteria as (t: any) => boolean;
G.criteria = (t: any): boolean => { const l = LAB.get(t?.id); if (!l) return oldCriteria(t); const p = runs()[l.id]; if (!p) return false; try { return l.criteria(p); } catch { return false; } };

const oldStart = G.startIncident as (id: number) => void;
G.startIncident = (id: number): void => {
  const l = LAB.get(id);
  if (!l) return oldStart(id);
  const s = S();
  if (s.active && s.active !== id) { toast('Resolve or cancel the current incident before starting another.'); return; }
  if (s.statuses[id] === 'Resolved') { toast('This ticket is resolved. Use "Practise again" for a new scenario, or reset the lab.'); return; }
  if (s.active === id) return;
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const p = { ...l.roll(rng(seed)), seed };
  runs()[id] = p;
  l.inject(p);
  started()[id] = nowIso();
  applyText(l);
  s.statuses[id] = 'In progress';
  s.active = id;
  s.evidence[id] = [];
  log(9000, `LAB-${pad(id)} started: ${l.text(p).title}`);
  save();
  redrawDesk();
  toast(`Incident started. Tools for this one: ${l.tools.map(toolName).join(', ')}.`);
};

const oldCancel = G.cancelIncident as (id: number) => void;
G.cancelIncident = (id: number): void => {
  const l = LAB.get(id);
  if (!l) return oldCancel(id);
  if (!confirm('Cancel this incident and restore the affected baseline?')) return;
  const p = runs()[id];
  if (p) l.restore(p);
  delete runs()[id];
  applyText(l);
  const s = S();
  s.statuses[id] = 'New'; s.active = null; s.evidence[id] = [];
  log(9002, `LAB-${pad(id)} cancelled; baseline restored`);
  save();
  redrawDesk();
};

/** Resolved: practise the same kind of incident again, with a new scenario. */
export function practiseAgain(id: number): void {
  const s = S();
  if (s.active) { toast('Resolve or cancel the current incident first.'); return; }
  const l = LAB.get(id);
  if (l) { delete runs()[id]; applyText(l); }
  s.statuses[id] = 'New';
  s.evidence[id] = [];
  log(9003, `LAB-${pad(id)} reopened for practice${l ? ' with a new scenario' : ''}`);
  save();
  redrawDesk();
}

export function toolName(id: string): string { return APPS().find((a) => a.id === id)?.name ?? ({ outlook: 'Outlook', directory: 'Active Directory Users and Computers', m365: 'Microsoft 365 admin center', entra: 'Microsoft Entra admin center', printmgmt: 'Print Management', services: 'Services', terminal: 'Windows PowerShell' } as Record<string, string>)[id] ?? id; }

/** Open a ticket in the Service Desk. */
export function openTicket(id: number): void {
  openApp('tickets');
  ticketView = id;
  G.renderTickets();
}
(G.CorpDesk ||= {}).openTicket = openTicket;

// ---- extra controls on the ticket page: verification, escalation, recovery key, tools, practise again
function verifyDialog(l: LabDef, p: Run): void {
  const v = l.verify!(p);
  const options = rng(p.seed + 7).shuffle([[v.good, ''] as [string, string], ...v.bad]);
  const radios = options.map(([text], i) => h('label', { class: 'ad2-check' }, h('input', { type: 'radio', name: 'verify', value: String(i) }), text));
  dialog(`Verify caller: ${corpUser(v.sam)?.name ?? v.sam}`, h('div', null, h('p', null, 'How will you confirm the caller really is this employee before you change anything?'), radios), [['Confirm', () => {
    const picked = radios.findIndex((r) => (r.querySelector('input') as HTMLInputElement).checked);
    if (picked < 0) { toast('Choose how you will verify the caller.'); return false; }
    const [text, why] = options[picked]!;
    if (text !== v.good) { toast(`Not safe: ${why}`); log(9010, `LAB-${pad(l.id)}: unsafe verification method chosen`); return false; }
    const L = lab();
    evidence('verify');
    if (v.impostor) {
      (L.impostor ||= {})[v.sam] = true;
      log(9014, `${v.sam}: call-back reached the real employee, who did not call the service desk`);
      save();
      setTimeout(() => dialog('Verification failed', h('div', null, h('p', null, `You called ${corpUser(v.sam)?.name ?? v.sam} back on the number in the HR directory. They answered from their own phone: they still have it and did not call the service desk.`), h('p', null, h('b', null, 'This is a social engineering attempt. '), 'Do not change the account. Escalate to Security with the caller\'s details.')), [['Understood', () => undefined, 'primary']]), 0);
      return;
    }
    L.verified[v.sam] = nowIso();
    log(9011, `${v.sam}: identity verified by call-back`);
    save();
    toast('Caller verified: the call-back and the code check out.');
  }, 'primary'], ['Cancel', () => undefined]]);
}

function provideKeyDialog(l: LabDef, p: Run): void {
  const k = l.provideKey!(p);
  const input = h('input', { class: 'ad2-input', placeholder: '000000-000000-000000-000000-000000-000000-000000-000000', 'aria-label': 'Recovery key' });
  dialog(`Provide recovery key to ${k.owner} (${k.device})`, h('div', null, h('p', null, `Paste the 48-digit recovery key whose Key ID starts with ${k.shown}.`), input), [['Read key to user', () => {
    const v = input.value.trim();
    if (!/^\d{6}(-\d{6}){7}$/.test(v)) { toast('A BitLocker recovery key is 48 digits in eight groups of six.'); return false; }
    lab().bitlockerProvided[k.device] = v;
    if (v === k.key) { evidence('bitlocker-provided'); log(9012, `${k.device}: correct recovery key provided, device unlocked`); toast(`${k.device} unlocked and booted to Windows.`); }
    else { log(9013, `${k.device}: recovery key rejected`); toast('The laptop says the key is wrong. Check you matched the Key ID the user read out.'); }
    save();
  }, 'primary'], ['Cancel', () => undefined]]);
}

function decorate(): void {
  const grid = document.querySelector<HTMLElement>('#appBody .sd-detail-grid');
  if (!grid || grid.dataset.lab) return;
  const id = Number(/LAB-(\d+)/.exec(document.querySelector('#appBody .page-top h1, #appBody h1')?.textContent ?? '')?.[1]);
  if (!id) return;
  grid.dataset.lab = String(id);
  const s = S();
  const l = LAB.get(id);
  const p = runs()[id];
  const activeHere = s.active === id;
  const resolved = ['Resolved', 'Closed'].includes(s.statuses[id]);
  const L = lab();
  const v = l?.verify && p ? l.verify(p) : null;
  const panelEl = h('div', { class: 'panel ia-labpanel' },
    l ? [h('h3', null, 'Tools for this incident'), h('div', { class: 'ia-toolbtns' }, l.tools.map((t) => h('button', { class: 'secondary', type: 'button', onClick: () => openApp(t) }, toolName(t))))] : null,
    v ? h('div', { class: 'ia-verify' }, h('b', null, 'Caller verification: '),
      L.impostor?.[v.sam] && activeHere ? [h('span', { class: 'ia-bad' }, 'failed (not the real employee) '), after(L.escalated?.[id], id) ? 'escalated ✓' : h('button', { class: 'primary', type: 'button', onClick: () => { (L.escalated ||= {})[id] = nowIso(); evidence('escalate'); log(9020, `LAB-${pad(id)}: impersonation attempt escalated to Security`); save(); G.renderTickets(); } }, 'Escalate to Security')]
        : after(L.verified[v.sam], id) ? 'verified ✓' : h('button', { class: 'primary', type: 'button', disabled: !activeHere, onClick: () => verifyDialog(l!, p!) }, 'Verify caller')) : null,
    l?.provideKey && p ? h('div', { class: 'ia-verify' }, h('b', null, 'Recovery key: '), h('button', { class: 'secondary', type: 'button', disabled: !activeHere, onClick: () => provideKeyDialog(l, p) }, 'Provide recovery key')) : null,
    l ? h('details', null, h('summary', null, 'Why this matters in a real job'), h('p', null, l.realWorld), h('p', null, h('b', null, 'Interview practice: '), l.interview)) : null,
    resolved ? h('div', { class: 'ia-verify' }, h('button', { class: 'secondary', type: 'button', onClick: () => practiseAgain(id) }, l ? 'Practise again with a new scenario' : 'Practise this incident again')) : null,
    l && !activeHere && !resolved ? h('p', { class: 'ia-muted' }, 'Start the incident to receive a new scenario and unlock these steps.') : null);
  const left = grid.firstElementChild;
  left?.insertBefore(panelEl, left.children[1] ?? null);
}
new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });

// Restore the texts of scenarios already in progress (after a reload).
for (const l of LABS) applyText(l);

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
    const rows = lab().printers.map((p) => `${p.name.padEnd(12)} ${'LAB-DC01'.padEnd(12)} ${p.driver.padEnd(30)} ${p.port}`);
    return ok(`Name         ComputerName DriverName                     PortName\n----         ------------ ----------                     --------\n${rows.join('\n')}`);
  }
  const pj = /^Get-PrintJob\s+(?:-PrinterName\s+)?['"]?([\w-]+)['"]?/i.exec(c);
  if (pj) {
    const sp = (S().services as any[]).find((x) => x.Name === 'Spooler');
    if (sp?.Status !== 'Running') return { output: 'Get-PrintJob : The spooler service is not reachable. Ensure the spooler service is running.', error: true };
    const jobs = lab().jobs.filter((j) => j.printer.toLowerCase() === pj[1]!.toLowerCase());
    evidence('print-queue-view');
    return ok(jobs.length ? `Id  ComputerName PrinterName DocumentName                     JobStatus\n--  ------------ ----------- ------------                     ---------\n${jobs.map((j) => `${String(j.id).padEnd(3)} LAB-DC01     ${j.printer.padEnd(11)} ${j.document.slice(0, 32).padEnd(32)} ${j.status}`).join('\n')}` : '');
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
export { setLabPassword };
