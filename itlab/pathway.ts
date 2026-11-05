/**
 * IT Support Career Path: the order to work the labs in, what each one teaches
 * for a real service desk job, where the real tools live, and a desktop card
 * that always shows the next step.
 */
import { APPS, G, S, TICKETS, onChange, openApp } from './corp.ts';
import { h, svg } from './dom.ts';
import { registerTool } from './host.ts';
import { labById, openTicket, toolName } from './labs.ts';

interface Module { id: string; title: string; goal: string; labs: number[]; skills: string[] }
const MODULES: Module[] = [
  { id: 'basics', title: '1. Service desk basics', goal: 'Take a ticket from first call to verified resolution, with notes a colleague could follow.', labs: [1, 2], skills: ['Ticket lifecycle and priority', 'Account lockout vs disabled', 'ipconfig, DNS and name resolution', 'Writing resolution notes'] },
  { id: 'jml', title: '2. Joiners, movers and leavers', goal: 'Build, change and remove access exactly as HR and managers request it.', labs: [6, 4, 7], skills: ['AD users, OUs and role groups', 'Entra Connect sync', 'Licences and mailboxes', 'Disable, do not delete'] },
  { id: 'identity', title: '3. Identity, MFA and access', goal: 'Change sign-in and permissions safely, with verification and least privilege.', labs: [9, 12, 3], skills: ['Caller verification against social engineering', 'MFA re-registration and session revocation', 'Shared mailbox permissions', 'Local admin rights review'] },
  { id: 'endpoint', title: '4. Devices, printing and policy', goal: 'Fix the endpoint problems users call about every day.', labs: [8, 10, 5], skills: ['Print Spooler and print queues', 'BitLocker recovery keys', 'Group Policy scope and gpupdate'] },
  { id: 'security', title: '5. Security incident response', goal: 'Contain a phishing compromise the way a Tier 1 analyst would.', labs: [11], skills: ['Reading email headers (SPF, DKIM, DMARC)', 'Tenant-wide message removal', 'Password reset and session revocation'] },
];
const ORDER = MODULES.flatMap((m) => m.labs);

/** Where the real tools are, so you can find them on day one. */
const TOOLS: [string, string, string][] = [
  ['tickets', 'Service Desk (ServiceNow, Jira Service Management, Freshservice)', 'Your queue: every piece of work starts and ends here.'],
  ['directory', 'Active Directory Users and Computers', 'Run dsa.msc, or Server Manager > Tools.'],
  ['m365', 'Microsoft 365 admin center', 'admin.microsoft.com: users, licences, mailboxes, Explorer.'],
  ['entra', 'Microsoft Entra admin center', 'entra.microsoft.com: MFA methods, sessions, devices and BitLocker keys.'],
  ['outlook', 'Outlook', 'outlook.office.com: the shared service desk mailbox.'],
  ['services', 'Services', 'Run services.msc. Also Get-Service / Restart-Service.'],
  ['printmgmt', 'Print Management', 'Run printmanagement.msc. Also Get-PrintJob / Remove-PrintJob.'],
  ['terminal', 'Windows PowerShell', 'Get-ADUser, Unlock-ADAccount, Start-ADSyncSyncCycle, gpupdate /force.'],
  ['events', 'Event Viewer', 'Run eventvwr.msc. Lockouts (4740), logons (4624/4625), service crashes (7031).'],
  ['rdp', 'Remote Desktop Connection', 'Run mstsc. Help a user on their PC, or test a sign-in.'],
  ['taskmanager', 'Task Manager', 'Ctrl+Shift+Esc, or Run taskmgr. Processes, performance, startup apps.'],
  ['control', 'Control Panel', 'Run control. Windows Tools, Programs and Features, Mouse.'],
];

const status = (id: number): string => S().statuses?.[id] ?? 'New';
const done = (id: number): boolean => ['Resolved', 'Closed'].includes(status(id));
const ticket = (id: number): any => TICKETS().find((t) => t.id === id);
const nextLab = (): number | undefined => (S().active ? S().active : ORDER.find((id) => !done(id)));
const pct = (): number => Math.round((ORDER.filter(done).length / ORDER.length) * 100);

function startOrOpen(id: number): void {
  const s = S();
  if (!s.active && status(id) === 'New') { openTicket(id); G.startIncident(id); return; }
  openTicket(id);
}

const ICON = {
  path: '<circle cx="7" cy="27" r="4" fill="#0f6cbd"/><circle cx="27" cy="7" r="4" fill="#2fb380"/><path d="M7 23V17a4 4 0 0 1 4-4h12a4 4 0 0 0 4-4V11" fill="none" stroke="#5a6b7c" stroke-width="2.4" stroke-dasharray="3 3"/><circle cx="17" cy="13" r="3" fill="#f3b23a"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function ring(value: number, size = 64): HTMLElement {
  const r = 26, c = 2 * Math.PI * r;
  return svg(`<circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pw-track)" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pw-accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * value) / 100} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="600" fill="currentColor">${value}%</text>`, size, '0 0 64 64');
}

let tab: 'path' | 'tools' | 'ready' = 'path';
function draw(host: HTMLElement): void {
  const next = nextLab();
  const nt = next ? ticket(next) : null;
  const labRow = (id: number): HTMLElement => {
    const t = ticket(id);
    const l = labById(id);
    const st = status(id);
    return h('div', { class: `pw-lab ${done(id) ? 'done' : ''} ${S().active === id ? 'active' : ''}` },
      h('span', { class: 'pw-dot' }, done(id) ? svg(ICON.check, 14) : String(ORDER.indexOf(id) + 1)),
      h('div', { class: 'pw-lab-text' }, h('b', null, `LAB-${String(id).padStart(3, '0')} · ${t?.title ?? ''}`), h('small', null, `${t?.category ?? ''} · ${t?.priority ?? ''} priority${l ? ` · Tools: ${l.tools.map(toolName).join(', ')}` : ''}`)),
      h('span', { class: `pw-status s-${st.replace(/\s+/g, '').toLowerCase()}` }, st),
      h('button', { class: done(id) ? 'secondary' : 'primary', type: 'button', onClick: () => startOrOpen(id) }, done(id) ? 'Review' : S().active === id ? 'Continue' : 'Start'));
  };
  const page = tab === 'path'
    ? h('div', { class: 'pw-modules' }, MODULES.map((m) => {
      const complete = m.labs.filter(done).length;
      return h('section', { class: 'pw-module' },
        h('div', { class: 'pw-mhead' }, h('div', null, h('h3', null, m.title), h('p', null, m.goal)), h('span', { class: 'pw-count' }, `${complete}/${m.labs.length}`)),
        h('div', { class: 'pw-skills' }, m.skills.map((s) => h('span', null, s))),
        m.labs.map(labRow));
    }))
    : tab === 'tools'
      ? h('div', { class: 'pw-tools' }, h('p', { class: 'pw-intro' }, 'These are the tools a service desk technician lives in. Each one here works like the real thing, so you will know where to click on your first day.'),
        TOOLS.map(([id, name, how]) => h('button', { class: 'pw-tool', type: 'button', onClick: () => openApp(id) }, (() => { const s = document.createElement('span'); s.className = 'pw-tool-icon'; s.innerHTML = APPS().find((a) => a.id === id)?.icon ?? ''; return s; })(), h('span', null, h('b', null, name), h('small', null, how)))))
      : h('div', { class: 'pw-ready' }, h('p', { class: 'pw-intro' }, 'Practise answering out loud. Each question is one interviewers ask service desk and desktop support candidates, and each lab is your real example.'),
        ORDER.map((id) => { const l = labById(id); const t = ticket(id); return h('details', { class: 'pw-q' }, h('summary', null, l?.interview ?? `Tell me how you would handle: ${t?.title}`), h('p', null, l?.realWorld ?? t?.summary ?? ''), h('p', { class: 'pw-proof' }, done(id) ? `✓ You have done this: LAB-${String(id).padStart(3, '0')}. Use it as your example.` : `Do LAB-${String(id).padStart(3, '0')} to have a real example.`)); }));
  host.append(h('div', { class: 'pw' },
    h('header', { class: 'pw-hero' }, ring(pct(), 76), h('div', null, h('h1', null, 'IT Support Career Path'), h('p', null, `${ORDER.filter(done).length} of ${ORDER.length} real-world labs complete. Work through them in order: each one is a ticket you would get in your first months on a service desk.`)),
      nt ? h('div', { class: 'pw-next' }, h('small', null, S().active ? 'In progress' : 'Next up'), h('b', null, nt.title), h('button', { class: 'primary', type: 'button', onClick: () => startOrOpen(next!) }, S().active ? 'Continue' : 'Start lab')) : h('div', { class: 'pw-next' }, h('b', null, 'Path complete. You are ready for the interview.'))),
    h('nav', { class: 'pw-tabs' }, ([['path', 'Learning path'], ['tools', 'Where to find the tools'], ['ready', 'Interview prep']] as const).map(([id, label]) => h('button', { class: tab === id ? 'on' : '', type: 'button', onClick: () => { tab = id; G.save(); } }, label))),
    h('div', { class: 'pw-body', 'data-scroll': 'pw' }, page)));
}

registerTool({ id: 'pathway', name: 'IT Support Career Path', short: 'Career Path', icon: ICON.path, width: 1000, height: 720, draw });

// ---- desktop card: progress and the next lab, one click away
const desktop = document.getElementById('desktop');
const card = h('aside', { class: 'pw-card', 'aria-label': 'IT Support Career Path' });
function drawCard(): void {
  const next = nextLab();
  const t = next ? ticket(next) : null;
  card.replaceChildren(
    h('div', { class: 'pw-card-top' }, ring(pct(), 54), h('div', null, h('small', null, 'IT SUPPORT CAREER PATH'), h('b', null, `${ORDER.filter(done).length} of ${ORDER.length} labs complete`))),
    t ? h('div', { class: 'pw-card-next' }, h('small', null, S().active ? 'IN PROGRESS' : 'NEXT UP'), h('b', null, `LAB-${String(next).padStart(3, '0')} · ${t.title}`), h('span', null, t.category)) : h('div', { class: 'pw-card-next' }, h('b', null, 'All labs complete!')),
    h('div', { class: 'pw-card-actions' }, t ? h('button', { class: 'pw-go', type: 'button', onClick: () => startOrOpen(next!) }, S().active ? 'Continue lab' : 'Start lab') : null, h('button', { class: 'pw-open', type: 'button', onClick: () => openApp('pathway') }, 'Open career path')));
}
desktop?.querySelector('.desktop-widget')?.classList.add('pw-replaced');
desktop?.appendChild(card);
drawCard();
onChange(drawCard);
