/**
 * Services (services.msc) and Print Management (printmanagement.msc), the two
 * consoles a technician opens for "I can't print". Services reads and changes
 * the same state.services that Get-Service / Restart-Service use in PowerShell.
 */
import { S, evidence, lab, log, nowIso, ps, q, save, toast } from '../corp.ts';
import { fmtDate, h, svg } from '../dom.ts';
import { I } from '../ui.ts';
import { registerTool } from '../host.ts';

const MORE = [
  { Name: 'W32Time', DisplayName: 'Windows Time', Status: 'Running' },
  { Name: 'Dhcp', DisplayName: 'DHCP Client', Status: 'Running' },
  { Name: 'Dnscache', DisplayName: 'DNS Client', Status: 'Running' },
  { Name: 'LanmanWorkstation', DisplayName: 'Workstation', Status: 'Running' },
  { Name: 'BITS', DisplayName: 'Background Intelligent Transfer Service', Status: 'Running' },
  { Name: 'wuauserv', DisplayName: 'Windows Update', Status: 'Running' },
  { Name: 'WinDefend', DisplayName: 'Microsoft Defender Antivirus Service', Status: 'Running' },
  { Name: 'EventLog', DisplayName: 'Windows Event Log', Status: 'Running' },
];
const INFO: Record<string, [string, string, string]> = {
  DNS: ['Enables DNS clients to resolve DNS names by answering DNS queries.', 'Automatic', 'Local System'],
  Netlogon: ['Maintains a secure channel between this computer and the domain controller for authenticating users and services.', 'Automatic', 'Local System'],
  Spooler: ['This service spools print jobs and handles interaction with the printer. If you turn off this service, you won\'t be able to print or see your printers.', 'Automatic', 'Local System'],
  WinRM: ['Windows Remote Management (WinRM) service implements the WS-Management protocol for remote management.', 'Automatic (Delayed Start)', 'Network Service'],
  W32Time: ['Maintains date and time synchronization on all clients and servers in the network. Kerberos needs clocks within 5 minutes.', 'Automatic (Trigger Start)', 'Local Service'],
  Dhcp: ['Registers and updates IP addresses and DNS records for this computer.', 'Automatic', 'Local Service'],
  Dnscache: ['Caches Domain Name System (DNS) names and registers the full computer name for this computer.', 'Automatic (Trigger Start)', 'Network Service'],
  LanmanWorkstation: ['Creates and maintains client network connections to remote servers using the SMB protocol (mapped drives).', 'Automatic', 'Network Service'],
  BITS: ['Transfers files in the background using idle network bandwidth.', 'Manual', 'Local System'],
  wuauserv: ['Enables the detection, download, and installation of updates for Windows and other programs.', 'Manual (Trigger Start)', 'Local System'],
  WinDefend: ['Helps protect users from malware and other potentially unwanted software.', 'Automatic', 'Local System'],
  EventLog: ['This service manages events and event logs.', 'Automatic', 'Local Service'],
};

export function ensureServices(): void {
  const s = S();
  s.services ||= [];
  for (const m of MORE) if (!s.services.some((x: any) => x.Name === m.Name)) s.services.push({ ...m });
}

let selService: string | null = null;
function servicesView(host: HTMLElement): void {
  ensureServices();
  const list = [...S().services].sort((a: any, b: any) => a.DisplayName.localeCompare(b.DisplayName));
  const sel = list.find((x: any) => x.Name === selService);
  const act = (verb: 'Start' | 'Stop' | 'Restart'): void => {
    if (!sel) return;
    try { ps(`${verb}-Service -Name ${q(sel.Name)}`); if (sel.Name === 'Spooler') evidence('spooler'); save(); } catch (e) { toast((e as Error).message); }
  };
  const tb = (icon: string, title: string, fn: () => void, disabled: boolean): HTMLElement => h('button', { class: 'svc-tb', type: 'button', title, 'aria-label': title, disabled, onClick: fn }, svg(icon, 14));
  const PLAY = '<path d="M7 5l12 7-12 7z" fill="#2c9a3c"/>', STOP = '<rect x="6" y="6" width="12" height="12" fill="#333"/>', RESTART = '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#2c9a3c" stroke-width="2.2"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="#2c9a3c" stroke-width="2.2"/>';
  host.append(h('div', { class: 'svc' },
    h('div', { class: 'svc-menu' }, ['File', 'Action', 'View', 'Help'].map((m) => h('span', null, m))),
    h('div', { class: 'svc-toolbar' }, tb(PLAY, 'Start Service', () => act('Start'), !sel || sel.Status === 'Running'), tb(STOP, 'Stop Service', () => act('Stop'), !sel || sel.Status !== 'Running'), tb(RESTART, 'Restart Service', () => act('Restart'), !sel || sel.Status !== 'Running')),
    h('div', { class: 'svc-main' },
      h('aside', { class: 'svc-tree' }, h('div', { class: 'svc-node' }, 'Services (Local)')),
      h('section', { class: 'svc-desc' }, sel ? [h('h3', null, sel.DisplayName),
        sel.Status === 'Running' ? h('p', null, h('a', { href: '#', onClick: (e: Event) => { e.preventDefault(); act('Stop'); } }, 'Stop'), ' the service', h('br'), h('a', { href: '#', onClick: (e: Event) => { e.preventDefault(); act('Restart'); } }, 'Restart'), ' the service')
          : h('p', null, h('a', { href: '#', onClick: (e: Event) => { e.preventDefault(); act('Start'); } }, 'Start'), ' the service'),
        h('p', null, h('b', null, 'Description:'), h('br'), INFO[sel.Name]?.[0] ?? '')] : h('p', null, 'Select an item to view its description.')),
      h('div', { class: 'svc-list', 'data-scroll': 'svc' }, h('table', null,
        h('thead', null, h('tr', null, ['Name', 'Description', 'Status', 'Startup Type', 'Log On As'].map((c) => h('th', null, c)))),
        h('tbody', null, list.map((x: any) => h('tr', { class: x.Name === selService ? 'on' : '', tabindex: '0', onClick: () => { selService = x.Name; save(); }, onDblclick: () => { selService = x.Name; save(); } },
          h('td', null, x.DisplayName), h('td', null, (INFO[x.Name]?.[0] ?? '').slice(0, 48) + ((INFO[x.Name]?.[0] ?? '').length > 48 ? '…' : '')), h('td', null, x.Status === 'Running' ? 'Running' : ''), h('td', null, INFO[x.Name]?.[1] ?? 'Manual'), h('td', null, INFO[x.Name]?.[2] ?? 'Local System'))))))),
    h('div', { class: 'svc-tabs' }, h('span', { class: 'on' }, 'Extended'), h('span', null, 'Standard'))));
}

registerTool({
  id: 'services', name: 'Services', short: 'Services', width: 980, height: 620,
  icon: '<circle cx="14" cy="14" r="8" fill="#7a8591"/><circle cx="14" cy="14" r="3.2" fill="#e6e9ee"/><g stroke="#7a8591" stroke-width="3"><path d="M14 3v4M14 21v4M3 14h4M21 14h4M6.2 6.2l2.8 2.8M19 19l2.8 2.8M6.2 21.8L9 19M19 9l2.8-2.8"/></g><circle cx="25" cy="25" r="6" fill="#2f7fd8"/><circle cx="25" cy="25" r="2.2" fill="#fff"/>',
  draw: servicesView,
});

// ---------------------------------------------------------------- Print Management
const spoolerRunning = (): boolean => (S().services ?? []).find((x: any) => x.Name === 'Spooler')?.Status === 'Running';
let selPrinter: string | null = null;
let filter: 'all' | 'notready' | 'jobs' = 'all';

function queueStatus(name: string): string {
  if (!spoolerRunning()) return 'Offline (Print Spooler not running)';
  const jobs = lab().jobs.filter((j) => j.printer === name);
  if (jobs.some((j) => j.status === 'Error - Printing')) return 'Error';
  return jobs.length ? 'Printing' : 'Ready';
}

export function printTestPage(name: string): void {
  const L = lab();
  if (!spoolerRunning()) { toast('The Print Spooler service is not running. Start it in Services first.'); return; }
  const jobs = L.jobs.filter((j) => j.printer === name);
  if (jobs.some((j) => j.status === 'Error - Printing')) { toast('A job in error is blocking the queue. Cancel it, then print the test page.'); return; }
  L.testPages[name] = nowIso();
  // The stuck jobs behind the bad one print once the queue moves.
  L.jobs = L.jobs.filter((j) => j.printer !== name);
  log(307, `Test page printed on ${name}`);
  evidence('print-test');
  save();
  toast(`Test page sent to ${name}.`);
}

function printView(host: HTMLElement): void {
  const L = lab();
  const printers = L.printers.filter((p) => filter === 'all' || (filter === 'notready' ? queueStatus(p.name) !== 'Ready' : L.jobs.some((j) => j.printer === p.name)));
  const sel = L.printers.find((p) => p.name === selPrinter);
  const jobs = sel ? L.jobs.filter((j) => j.printer === sel.name) : [];
  const node = (label: string, f: typeof filter, depth: number): HTMLElement => h('button', { class: `pm-node ${filter === f ? 'on' : ''}`, type: 'button', style: `padding-left:${8 + depth * 14}px`, onClick: () => { filter = f; save(); } }, svg(f === 'all' ? I.printer : I.flag, 14), label);
  host.append(h('div', { class: 'svc pm' },
    h('div', { class: 'svc-menu' }, ['File', 'Action', 'View', 'Help'].map((m) => h('span', null, m))),
    h('div', { class: 'svc-main' },
      h('aside', { class: 'svc-tree' }, h('div', { class: 'svc-node' }, 'Print Management'), h('div', { class: 'svc-node', style: 'padding-left:18px' }, 'Custom Filters'),
        node('Printers Not Ready', 'notready', 2), node('Printers With Jobs', 'jobs', 2), h('div', { class: 'svc-node', style: 'padding-left:18px' }, 'Print Servers'), h('div', { class: 'svc-node', style: 'padding-left:32px' }, 'LAB-DC01 (local)'), node('Printers', 'all', 3)),
      h('div', { class: 'pm-right' },
        h('div', { class: 'svc-list', 'data-scroll': 'pm' }, h('table', null,
          h('thead', null, h('tr', null, ['Printer Name', 'Queue Status', 'Jobs In Queue', 'Server Name', 'Driver Name', 'Location'].map((c) => h('th', null, c)))),
          h('tbody', null, printers.map((p) => h('tr', { class: p.name === selPrinter ? 'on' : '', tabindex: '0', onClick: () => { selPrinter = p.name; evidence('print-queue-view'); save(); } },
            h('td', null, p.name), h('td', null, queueStatus(p.name)), h('td', null, String(L.jobs.filter((j) => j.printer === p.name).length)), h('td', null, 'LAB-DC01 (local)'), h('td', null, p.driver), h('td', null, p.location)))))),
        sel ? h('section', { class: 'pm-queue' },
          h('div', { class: 'pm-qhead' }, h('b', null, `${sel.name} — Print queue`), h('span', null, queueStatus(sel.name)), h('button', { class: 'ad2-btn primary', type: 'button', onClick: () => printTestPage(sel.name) }, 'Print Test Page')),
          jobs.length ? h('table', null, h('thead', null, h('tr', null, ['Document Name', 'Status', 'Owner', 'Pages', 'Submitted', ''].map((c) => h('th', null, c)))),
            h('tbody', null, jobs.map((j) => h('tr', { class: j.status === 'Error - Printing' ? 'err' : '' }, h('td', null, j.document), h('td', null, j.status), h('td', null, j.owner), h('td', null, String(j.pages)), h('td', null, fmtDate(j.submitted)),
              h('td', null, h('button', { class: 'ad2-btn', type: 'button', onClick: () => { L.jobs = L.jobs.filter((x) => x.id !== j.id); log(13, `Print job ${j.id} (${j.document}) on ${sel.name} cancelled`); if (j.status === 'Error - Printing') evidence('print-queue'); save(); } }, 'Cancel')))))) : h('p', { class: 'ad2-muted' }, 'There are no documents in the queue.'),
          L.testPages[sel.name] ? h('p', { class: 'ad2-muted' }, `Last test page: ${fmtDate(L.testPages[sel.name]!)}`) : null) : h('p', { class: 'pm-hint' }, 'Select a printer to open its queue.')))));
}

registerTool({
  id: 'printmgmt', name: 'Print Management', short: 'Print Mgmt', width: 1060, height: 640,
  icon: '<rect x="9" y="4" width="16" height="8" fill="#fff" stroke="#5f6770" stroke-width="1.4"/><rect x="4" y="12" width="26" height="12" rx="2" fill="#5f6b7a"/><rect x="10" y="20" width="14" height="10" fill="#fff" stroke="#5f6770" stroke-width="1.4"/><circle cx="26" cy="16" r="1.5" fill="#4caf50"/>',
  draw: printView,
});
