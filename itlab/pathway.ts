/**
 * IT Support Career Path: the order to work the labs in, what each one teaches
 * for a real service desk job, where the real tools live, your own practice
 * tickets, a certificate with your name, a portfolio export for LinkedIn and
 * GitHub, a full reset, and a desktop card that always shows the next step.
 */
import { APPS, G, S, TICKETS, lab, onChange, openApp, save, toast } from './corp.ts';
import { h, svg } from './dom.ts';
import { registerTool } from './host.ts';
import { labById, openTicket, practiseAgain, runOf, toolName } from './labs.ts';
import { dialog } from './ui.ts';

interface Module { id: string; title: string; goal: string; labs: number[]; skills: string[] }
const MODULES: Module[] = [
  { id: 'basics', title: '1. Service desk basics', goal: 'Take a ticket from first call to verified resolution, with notes a colleague could follow.', labs: [1, 2], skills: ['Ticket lifecycle and priority', 'Account lockout vs disabled', 'ipconfig, DNS and name resolution', 'Writing resolution notes'] },
  { id: 'jml', title: '2. Joiners, movers and leavers (JML)', goal: 'Build, change and remove access exactly as HR and managers request it: the full identity lifecycle.', labs: [6, 13, 4, 7], skills: ['AD users, OUs and role groups', 'Entra Connect sync', 'Licences and mailboxes', 'Removing old access on transfer', 'Disable, do not delete'] },
  { id: 'identity', title: '3. Identity, MFA and access', goal: 'Change sign-in and permissions safely, with verification and least privilege.', labs: [9, 12, 3], skills: ['Caller verification against social engineering', 'MFA re-registration and session revocation', 'Shared mailbox permissions', 'Local admin rights review'] },
  { id: 'endpoint', title: '4. Devices, printing and policy', goal: 'Fix the endpoint problems users call about every day.', labs: [8, 10, 5], skills: ['Print Spooler and print queues', 'BitLocker recovery keys', 'Group Policy scope and gpupdate'] },
  { id: 'security', title: '5. Security incident response', goal: 'Contain a phishing compromise the way a Tier 1 analyst would.', labs: [11], skills: ['Reading email headers (SPF, DKIM, DMARC)', 'Tenant-wide message removal', 'Password reset and session revocation'] },
];
export const ORDER = MODULES.flatMap((m) => m.labs);

const TOOLS: [string, string, string][] = [
  ['tickets', 'Service Desk (ServiceNow, Jira Service Management, Freshservice)', 'Your queue: every piece of work starts and ends here.'],
  ['directory', 'Active Directory Users and Computers', 'Run dsa.msc, or Server Manager > Tools.'],
  ['m365', 'Microsoft 365 admin center', 'admin.microsoft.com: users, licences, mailboxes, Explorer.'],
  ['entra', 'Microsoft Entra admin center', 'entra.microsoft.com: users (incl. cloud-only), MFA methods, sessions, devices and BitLocker keys.'],
  ['outlook', 'Outlook', 'outlook.office.com: the shared service desk mailbox.'],
  ['services', 'Services', 'Run services.msc. Also Get-Service / Restart-Service.'],
  ['printmgmt', 'Print Management', 'Run printmanagement.msc. Also Get-PrintJob / Remove-PrintJob.'],
  ['terminal', 'Windows PowerShell', 'Get-ADUser, Unlock-ADAccount, Start-ADSyncSyncCycle, gpupdate /force.'],
  ['events', 'Event Viewer', 'Run eventvwr.msc. Lockouts (4740), logons (4624/4625), service crashes (7031).'],
  ['rdp', 'Remote Desktop Connection', 'Run mstsc. Help a user on their PC, or test a sign-in with the passwords in Pwd.'],
  ['pwd', 'Pwd (training passwords)', 'Desktop\\Pwd.txt. In a real job you would never keep this file: use a password manager.'],
  ['taskmanager', 'Task Manager', 'Ctrl+Shift+Esc, or Run taskmgr. Processes, performance, startup apps.'],
  ['control', 'Control Panel', 'Run control. Windows Tools, Programs and Features, Mouse.'],
];

const status = (id: number): string => S().statuses?.[id] ?? 'New';
const done = (id: number): boolean => ['Resolved', 'Closed'].includes(status(id));
const ticket = (id: number): any => TICKETS().find((t) => t.id === id);
const nextLab = (): number | undefined => (S().active && ORDER.includes(S().active) ? S().active : ORDER.find((id) => !done(id)));
const pct = (): number => Math.round((ORDER.filter(done).length / ORDER.length) * 100);
const earned = (): boolean => ORDER.every(done);
const practice = (): any[] => (S().customTickets ?? []) as any[];
const pad = (n: number): string => String(n).padStart(3, '0');

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

// ---------------------------------------------------------------- name, certificate
function askName(after?: () => void): void {
  const input = h('input', { class: 'ad2-input', value: lab().certName ?? S().technician ?? '', placeholder: 'First and last name', 'aria-label': 'Your full name' });
  dialog('Your name for the certificate', h('div', null, h('p', null, 'Type your full name exactly as you want it printed on your IT Support Career Path certificate. You can change it later in the Certificate tab.'), input), [['Save', () => {
    const v = input.value.trim().replace(/\s+/g, ' ');
    if (v.length < 3) { toast('Enter your full name.'); return false; }
    lab().certName = v;
    save();
    after?.();
  }, 'primary'], ['Later', () => undefined]]);
}

const certId = (name: string, date: string): string => {
  let x = 2166136261;
  for (const c of `${name}|${date}`) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  return `CDK-${date.slice(0, 4)}-${(x >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7)}`;
};

const SEAL = '<defs><radialGradient id="sg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f3d27a"/><stop offset=".7" stop-color="#c99a2e"/><stop offset="1" stop-color="#9c7419"/></radialGradient></defs><g transform="translate(60 60)">' + Array.from({ length: 24 }, (_, i) => `<path d="M0 -58 L6 -46 L-6 -46Z" fill="#b8892a" transform="rotate(${i * 15})"/>`).join('') + '<circle r="47" fill="url(#sg)" stroke="#8a6512" stroke-width="2"/><circle r="38" fill="none" stroke="#fff6d6" stroke-width="1.2" stroke-dasharray="2 3"/><text y="-8" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#5a3e06" letter-spacing="2">CORP DESK</text><text y="9" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#5a3e06">IT</text><text y="24" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#5a3e06" letter-spacing="1.5">SUPPORT</text></g>';

export function showCertificate(): void {
  const name = lab().certName;
  if (!name) { askName(showCertificate); return; }
  const ok = earned();
  const date = lab().certIssued ?? (ok ? new Date().toISOString() : new Date().toISOString());
  if (ok && !lab().certIssued) { lab().certIssued = date; save(); }
  const nice = new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const skills = ['Ticket lifecycle and documentation', 'Active Directory user and group administration', 'Joiner, mover and leaver (JML) processes', 'Microsoft 365 licences and mailboxes', 'Entra ID, MFA and session management', 'Caller verification and social engineering defence', 'Printing and Windows services troubleshooting', 'BitLocker recovery and endpoint support', 'Phishing triage and containment', 'DNS, Group Policy and least privilege'];
  const seal = document.createElement('span'); seal.className = 'cert-seal'; seal.innerHTML = `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${SEAL}</svg>`;
  const cert = h('div', { class: `cert ${ok ? '' : 'preview'}`, role: 'document', 'aria-label': 'Certificate of completion' },
    h('div', { class: 'cert-frame' },
      h('div', { class: 'cert-issuer' }, 'CORP DESK · IT SUPPORT TRAINING PROGRAM'),
      h('h1', { class: 'cert-title' }, 'Certificate of Completion'),
      h('div', { class: 'cert-rule' }),
      h('p', { class: 'cert-intro' }, 'This is to certify that'),
      h('div', { class: 'cert-name' }, name),
      h('p', { class: 'cert-text' }, `has successfully completed the IT Support Career Path, a hands-on program of ${ORDER.length} randomized, real-world service desk incidents performed in a simulated enterprise environment with Active Directory, Microsoft 365, Microsoft Entra ID, Windows services and endpoint tools, each validated against the live system state.`),
      h('div', { class: 'cert-skills' }, skills.map((s) => h('span', null, s))),
      h('div', { class: 'cert-foot' },
        h('div', { class: 'cert-sign' }, h('div', { class: 'cert-sig' }, 'Erick Omari'), h('div', { class: 'cert-line' }), h('b', null, 'Erick Omari'), h('small', null, 'Program Creator, CORP Desk')),
        seal,
        h('div', { class: 'cert-sign' }, h('div', { class: 'cert-date' }, nice), h('div', { class: 'cert-line' }), h('b', null, 'Date of completion'), h('small', null, `Certificate ID ${certId(name, date)}`))),
      h('p', { class: 'cert-note' }, 'Completed in the CORP Desk training simulator. Skills were practised on simulated systems; no real accounts or devices were changed.')),
    ok ? null : h('div', { class: 'cert-watermark' }, `PREVIEW · ${ORDER.filter(done).length} of ${ORDER.length} labs`));
  const shade = h('div', { class: 'cert-shade' },
    h('div', { class: 'cert-bar' },
      h('span', null, ok ? 'Your certificate is ready. Print it or "Save as PDF" from the print dialog.' : `Finish all ${ORDER.length} labs to unlock printing. This is a preview.`),
      h('button', { class: 'ad2-btn', type: 'button', onClick: () => askName(() => { shade.remove(); showCertificate(); }) }, 'Change name'),
      h('button', { class: 'ad2-btn primary', type: 'button', disabled: !ok, onClick: () => { document.body.classList.add('printing-cert'); window.print(); setTimeout(() => document.body.classList.remove('printing-cert'), 500); } }, 'Print / Save as PDF'),
      h('button', { class: 'ad2-btn', type: 'button', onClick: () => shade.remove() }, 'Close')),
    cert);
  document.body.appendChild(shade);
}

// ---------------------------------------------------------------- portfolio export
function exportPortfolio(): void {
  const name = lab().certName ?? S().technician ?? 'Technician';
  const lines = [`# ${name}: IT Support hands-on lab portfolio`, '', `Completed in CORP Desk, a Windows and Microsoft 365 service desk simulator, between ${new Date().toLocaleDateString()} and now.`, '', `**Progress:** ${ORDER.filter(done).length} of ${ORDER.length} career-path labs resolved${earned() ? ' (certificate earned)' : ''}; ${practice().filter((t) => done(t.id)).length} practice tickets resolved.`, ''];
  for (const m of MODULES) {
    lines.push(`## ${m.title}`, '', m.goal, '', `Skills: ${m.skills.join(', ')}.`, '');
    for (const id of m.labs) {
      const t = ticket(id), l = labById(id);
      lines.push(`### LAB-${pad(id)}: ${t?.title ?? ''} — ${done(id) ? 'Resolved ✅' : status(id)}`, '');
      if (done(id)) {
        lines.push(`- **Scenario:** ${t?.summary ?? ''}`);
        if (l) lines.push(`- **Tools:** ${l.tools.map(toolName).join(', ')}`);
        const notes = (S().notes?.[id] ?? '').trim();
        if (notes) lines.push(`- **My resolution notes:** ${notes.replace(/\s+/g, ' ')}`);
        if (l) lines.push(`- **Why it matters:** ${l.realWorld}`);
        lines.push('');
      }
    }
  }
  const p = practice();
  if (p.length) { lines.push('## Practice tickets', ''); for (const t of p) lines.push(`- ${t.title} — ${status(t.id)}${(S().notes?.[t.id] ?? '').trim() ? `: ${(S().notes[t.id] as string).replace(/\s+/g, ' ')}` : ''}`); lines.push(''); }
  lines.push('---', '', 'Built with CORP Desk by Erick Omari: https://corpdesk-it-support-lab.vercel.app', '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' }));
  a.download = `CORP-Desk-Portfolio-${name.replace(/\s+/g, '-')}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Portfolio exported. Add screenshots, then post it (see LABS-AND-PORTFOLIO-GUIDE.md).');
}

// ---------------------------------------------------------------- hard reset
const KEEP_KEY = 'corpdesk-reset-keep';
function resetDialog(): void {
  const keep = h('input', { type: 'checkbox', checked: true });
  const typed = h('input', { class: 'ad2-input', placeholder: 'RESET', 'aria-label': 'Type RESET to confirm' });
  dialog('Reset the lab and start over', h('div', null,
    h('p', null, 'This erases every incident, your notes, practice tickets, settings and changes you made in every tool, and starts the lab fresh with new random scenarios.'),
    h('label', { class: 'ad2-check' }, keep, 'Keep my name (sign-in and certificate)'),
    h('label', { class: 'ad2-field' }, 'Type RESET to confirm', typed)), [['Reset everything', () => {
    if (typed.value.trim().toUpperCase() !== 'RESET') { toast('Type RESET to confirm.'); return false; }
    try {
      if (keep.checked) localStorage.setItem(KEEP_KEY, JSON.stringify({ technician: S().technician, certName: lab().certName }));
      localStorage.removeItem('corpdesk-lab-v1');
      localStorage.removeItem('corpdesk-custom-lock-screen');
    } catch { /* storage blocked: the reload still starts fresh in memory */ }
    G.save = (): void => undefined; // nothing more is written before the reload
    location.reload();
  }, 'primary'], ['Cancel', () => undefined]]);
}
/** After a reset that kept the name, put it back. */
export function applyResetKeep(): void {
  try {
    const raw = localStorage.getItem(KEEP_KEY);
    if (!raw) return;
    localStorage.removeItem(KEEP_KEY);
    const keep = JSON.parse(raw);
    if (keep.technician) { S().technician = keep.technician; const t = document.getElementById('technician') as HTMLInputElement | null; if (t) t.value = keep.technician; }
    if (keep.certName) lab().certName = keep.certName;
    save();
  } catch { /* nothing kept */ }
}
(G.CorpDesk ||= {}).resetLab = resetDialog;

// ---------------------------------------------------------------- the app
let tab: 'path' | 'practice' | 'tools' | 'ready' | 'cert' = 'path';
function draw(host: HTMLElement): void {
  if (!lab().certName && !host.dataset.asked) { host.dataset.asked = '1'; setTimeout(() => askName(), 50); }
  const next = nextLab();
  const nt = next ? ticket(next) : null;
  const labRow = (id: number): HTMLElement => {
    const t = ticket(id), l = labById(id), st = status(id);
    return h('div', { class: `pw-lab ${done(id) ? 'done' : ''} ${S().active === id ? 'active' : ''}` },
      h('span', { class: 'pw-dot' }, done(id) ? svg(ICON.check, 14) : String(ORDER.indexOf(id) + 1)),
      h('div', { class: 'pw-lab-text' }, h('b', null, `LAB-${pad(id)} · ${t?.title ?? ''}`), h('small', null, `${t?.category ?? ''} · ${t?.priority ?? ''} priority${l ? ` · Tools: ${l.tools.map(toolName).join(', ')}` : ''}${l && !runOf(id) && !done(id) ? ' · new random scenario on start' : ''}`)),
      h('span', { class: `pw-status s-${st.replace(/\s+/g, '').toLowerCase()}` }, st),
      done(id) && !S().active ? h('button', { class: 'secondary', type: 'button', onClick: () => practiseAgain(id) }, 'Practise again') : null,
      h('button', { class: done(id) ? 'secondary' : 'primary', type: 'button', onClick: () => startOrOpen(id) }, done(id) ? 'Review' : S().active === id ? 'Continue' : 'Start'));
  };
  let page: HTMLElement;
  if (tab === 'path') {
    page = h('div', { class: 'pw-modules' }, MODULES.map((m) => h('section', { class: 'pw-module' },
      h('div', { class: 'pw-mhead' }, h('div', null, h('h3', null, m.title), h('p', null, m.goal)), h('span', { class: 'pw-count' }, `${m.labs.filter(done).length}/${m.labs.length}`)),
      h('div', { class: 'pw-skills' }, m.skills.map((s) => h('span', null, s))),
      m.labs.map(labRow))));
  } else if (tab === 'practice') {
    const list = practice();
    page = h('div', null, h('p', { class: 'pw-intro' }, 'Tickets you create in the Service Desk ("New" or "Generate practice tickets") show up here. They are extra practice: they count in your portfolio, not toward the certificate, because they have no automatic acceptance checks.'),
      h('div', { class: 'pw-stats' }, h('div', null, h('b', null, String(list.length)), h('small', null, 'practice tickets')), h('div', null, h('b', null, String(list.filter((t) => done(t.id)).length)), h('small', null, 'resolved')), h('div', null, h('b', null, String(list.filter((t) => status(t.id) === 'In progress').length)), h('small', null, 'in progress'))),
      list.length ? h('section', { class: 'pw-module' }, list.map((t) => h('div', { class: `pw-lab ${done(t.id) ? 'done' : ''}` },
        h('span', { class: 'pw-dot' }, done(t.id) ? svg(ICON.check, 14) : '•'),
        h('div', { class: 'pw-lab-text' }, h('b', null, `LAB-${pad(t.id)} · ${t.title}`), h('small', null, `${t.category ?? 'Request'} · ${t.generated ? 'Generated practice ticket' : 'Ticket you created'}`)),
        h('span', { class: `pw-status s-${status(t.id).replace(/\s+/g, '').toLowerCase()}` }, status(t.id)),
        h('button', { class: 'secondary', type: 'button', onClick: () => openTicket(t.id) }, 'Open'))))
        : h('div', { class: 'ad2-empty' }, 'No practice tickets yet. In the Service Desk, use "Generate practice tickets" or create a New incident.'),
      h('div', { class: 'ad2-row' }, h('button', { class: 'primary', type: 'button', onClick: () => openApp('tickets') }, 'Open the Service Desk')));
  } else if (tab === 'tools') {
    page = h('div', { class: 'pw-tools' }, h('p', { class: 'pw-intro' }, 'These are the tools a service desk technician lives in. Each one here works like the real thing, so you will know where to click on your first day.'),
      TOOLS.map(([id, name, how]) => h('button', { class: 'pw-tool', type: 'button', onClick: () => openApp(id) }, (() => { const s = document.createElement('span'); s.className = 'pw-tool-icon'; s.innerHTML = APPS().find((a) => a.id === id)?.icon ?? ''; return s; })(), h('span', null, h('b', null, name), h('small', null, how)))));
  } else if (tab === 'ready') {
    page = h('div', { class: 'pw-ready' }, h('p', { class: 'pw-intro' }, 'Practise answering out loud. Each question is one interviewers ask service desk and desktop support candidates, and each lab is your real example.'),
      h('div', { class: 'ad2-row' }, h('button', { class: 'primary', type: 'button', onClick: exportPortfolio }, 'Export my portfolio (Markdown)'), h('span', { class: 'ad2-muted' }, 'Your completed labs, scenarios and resolution notes, ready for LinkedIn and GitHub.')),
      ORDER.map((id) => { const l = labById(id), t = ticket(id); return h('details', { class: 'pw-q' }, h('summary', null, l?.interview ?? `Tell me how you would handle: ${t?.title}`), h('p', null, l?.realWorld ?? t?.summary ?? ''), h('p', { class: 'pw-proof' }, done(id) ? `✓ You have done this: LAB-${pad(id)}. Use it as your example.` : `Do LAB-${pad(id)} to have a real example.`)); }));
  } else {
    page = h('div', { class: 'pw-cert-tab' },
      h('div', { class: 'pw-cert-card' }, h('h3', null, 'Certificate of Completion'),
        h('p', null, earned() ? 'You finished every lab. Your certificate is ready to print or save as PDF.' : `Finish all ${ORDER.length} career-path labs to earn it. ${ORDER.filter(done).length} done so far.`),
        h('p', null, h('b', null, 'Name on certificate: '), lab().certName ?? h('i', null, 'not set')),
        h('div', { class: 'ad2-row' }, h('button', { class: 'secondary', type: 'button', onClick: () => askName() }, lab().certName ? 'Change name' : 'Set my name'), h('button', { class: 'primary', type: 'button', onClick: showCertificate }, earned() ? 'Open certificate' : 'Preview certificate'))),
      h('div', { class: 'pw-cert-card' }, h('h3', null, 'Start over'), h('p', null, 'Reset the whole lab: every incident, note, practice ticket and change. New random scenarios are rolled when you start each lab again.'), h('button', { class: 'secondary', type: 'button', onClick: resetDialog }, 'Reset lab...')));
  }
  host.append(h('div', { class: 'pw' },
    h('header', { class: 'pw-hero' }, ring(pct(), 76), h('div', null, h('h1', null, 'IT Support Career Path'), h('p', null, `${ORDER.filter(done).length} of ${ORDER.length} real-world labs complete. Every lab rolls a new scenario when you start it, so read the ticket and investigate: there is nothing to memorise.`)),
      nt ? h('div', { class: 'pw-next' }, h('small', null, S().active === next ? 'In progress' : 'Next up'), h('b', null, nt.title), h('button', { class: 'primary', type: 'button', onClick: () => startOrOpen(next!) }, S().active === next ? 'Continue' : 'Start lab')) : h('div', { class: 'pw-next' }, h('b', null, 'Path complete!'), h('button', { class: 'primary', type: 'button', onClick: showCertificate }, 'View certificate'))),
    h('nav', { class: 'pw-tabs' }, ([['path', 'Learning path'], ['practice', `Practice tickets (${practice().length})`], ['tools', 'Where to find the tools'], ['ready', 'Interview & portfolio'], ['cert', 'Certificate']] as const).map(([id, label]) => h('button', { class: tab === id ? 'on' : '', type: 'button', onClick: () => { tab = id; save(); } }, label))),
    h('div', { class: 'pw-body', 'data-scroll': 'pw' }, page)));
}

registerTool({ id: 'pathway', name: 'IT Support Career Path', short: 'Career Path', icon: ICON.path, width: 1040, height: 740, draw });

// ---- desktop card: progress and the next lab, one click away
const desktop = document.getElementById('desktop');
const card = h('aside', { class: 'pw-card', 'aria-label': 'IT Support Career Path' });
function drawCard(): void {
  const next = nextLab();
  const t = next ? ticket(next) : null;
  card.replaceChildren(
    h('div', { class: 'pw-card-top' }, ring(pct(), 54), h('div', null, h('small', null, 'IT SUPPORT CAREER PATH'), h('b', null, `${ORDER.filter(done).length} of ${ORDER.length} labs complete`))),
    t ? h('div', { class: 'pw-card-next' }, h('small', null, S().active === next ? 'IN PROGRESS' : 'NEXT UP'), h('b', null, `LAB-${pad(next!)} · ${t.title}`), h('span', null, t.category)) : h('div', { class: 'pw-card-next' }, h('b', null, 'All labs complete!'), h('span', null, 'Your certificate is ready.')),
    h('div', { class: 'pw-card-actions' }, t ? h('button', { class: 'pw-go', type: 'button', onClick: () => startOrOpen(next!) }, S().active === next ? 'Continue lab' : 'Start lab') : h('button', { class: 'pw-go', type: 'button', onClick: showCertificate }, 'Certificate'), h('button', { class: 'pw-open', type: 'button', onClick: () => openApp('pathway') }, 'Open career path')));
}
desktop?.querySelector('.desktop-widget')?.classList.add('pw-replaced');
desktop?.appendChild(card);
drawCard();
onChange(drawCard);
