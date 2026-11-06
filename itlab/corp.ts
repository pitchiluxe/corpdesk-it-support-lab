/**
 * CORP Desk's globals (app.js, windows.js, desktop.js), and the lab's own
 * saved data under state.itlab. Every change ends in save(); onChange tells
 * open tools once per frame so a change made anywhere shows everywhere.
 */
declare const state: any;
declare const apps: { id: string; name: string; short: string; bg: string; fg: string; icon: string }[];
declare const tickets: any[];
declare const checkLabels: Record<string, string>;
export const G = globalThis as any;
export const S = (): any => state;
export const APPS = (): typeof apps => apps;
export const TICKETS = (): any[] => tickets;
export const CHECK_LABELS = (): Record<string, string> => checkLabels;
export const DOMAIN = 'corp.example.test';

export const corpUser = (sam: string): any => state.users.find((u: any) => u.sam.toLowerCase() === String(sam).toLowerCase());
export const log = (id: number, message: string): void => G.log(id, message);
export const evidence = (key: string): void => G.evidence(key);
export const toast = (message: string): void => G.toast(message);
export const openApp = (id: string): void => G.openApp(id);
export const save = (): void => G.save();

/** Run a CORP Desk PowerShell command; returns its text or throws its first error line. */
export function ps(command: string): string {
  const r = G.runCommand(command);
  if (r.error) throw new Error(String(r.output).split('\n')[0]);
  return String(r.output ?? '');
}
export const q = (v: unknown): string => `'${String(v ?? '').replace(/'/g, "''")}'`;

const listeners = new Set<() => void>();
let queued = false;
const original = G.save as (...a: unknown[]) => unknown;
G.save = function (this: unknown, ...a: unknown[]) {
  const r = original.apply(this, a);
  if (!queued && listeners.size) { queued = true; requestAnimationFrame(() => { queued = false; listeners.forEach((fn) => fn()); }); }
  return r;
};
export function onChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

export interface Mailbox { address: string; name: string; type: 'user' | 'shared'; owner?: string; fullAccess: string[]; sendAs: string[]; sizeGb: number; quotaGb: number }
export interface AuthMethod { id: string; type: string; detail: string; added: string }
export interface Device { name: string; owner: string; os: string; compliant: boolean; lastSync: string; keys: { id: string; key: string; created: string }[] }
export interface PrintJob { id: number; printer: string; owner: string; document: string; pages: number; status: 'Queued' | 'Printing' | 'Error - Printing' | 'Paused'; submitted: string }
export interface Mail { id: string; from: string; fromName: string; to: string; subject: string; body: string; received: string; headers: string; read: boolean; phishing?: boolean; reported?: boolean; recipients?: string[]; /** Evidence recorded when the message is opened. */ evidence?: string; /** Not in the service desk mailbox (only Explorer sees it). */ hidden?: boolean }
export interface ItLab {
  version: 1;
  synced: string[];
  licenses: Record<string, string | null>;
  licenseTotal: number;
  blocked: string[];
  sessionsRevoked: Record<string, string>;
  mailboxes: Mailbox[];
  methods: Record<string, AuthMethod[]>;
  reregister: Record<string, boolean>;
  devices: Device[];
  printers: { name: string; location: string; driver: string; port: string }[];
  jobs: PrintJob[];
  testPages: Record<string, string>;
  inbox: Mail[];
  blockedSenders: string[];
  purged: string[];
  verified: Record<string, string>;
  bitlockerProvided: Record<string, string>;
  completedModules: string[];
  /** When each lab incident was started (acceptance checks need actions after it). */
  started?: Record<number, string>;
  /** The scenario rolled for each lab run (who, what, which variant). */
  runs?: Record<number, Record<string, any>>;
  /** Training passwords for the lab's accounts (listed in Desktop\Pwd.txt). */
  passwords?: Record<string, string>;
  /** Failed sign-ins since the last success, for lockout after 5. */
  badLogons?: Record<string, number>;
  /** Accounts created in the cloud only (Entra), not in Active Directory. */
  cloudOnly?: { sam: string; name: string; dept: string; title: string; usageLocation: string; created: string; enabled: boolean }[];
  /** Escalations raised from a ticket (e.g. to Security). */
  escalated?: Record<number, string>;
  /** Callers who failed verification (impersonation attempts). */
  impostor?: Record<string, boolean>;
  /** Name printed on the certificate. */
  certName?: string;
  certIssued?: string;
}

/** A seeded random generator, so a scenario can be replayed from its seed. */
export function rng(seed: number): { next: () => number; int: (min: number, max: number) => number; pick: <T>(list: readonly T[]) => T; chance: (p: number) => boolean; shuffle: <T>(list: readonly T[]) => T[] } {
  let t = seed >>> 0;
  const next = (): number => { t = (t + 0x6d2b79f5) >>> 0; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)]!,
    chance: (p) => next() < p,
    shuffle: (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; },
  };
}

/** A password that meets CORP's domain policy (14+ characters, upper, lower, digit, symbol). */
export function makePassword(r: ReturnType<typeof rng>): string {
  const words = ['Harbor', 'Copper', 'Maple', 'Falcon', 'Cobalt', 'Summit', 'River', 'Lantern', 'Orchid', 'Granite', 'Willow', 'Comet', 'Juniper', 'Beacon'];
  return `${r.pick(words)}-${r.pick(words).toLowerCase()}-${r.int(10, 99)}${r.pick(['!', '#', '$', '%', '?'])}${r.int(100, 999)}`;
}

/** Desktop\Pwd.txt: every lab account and its current training password. */
export function writePwdFile(): void {
  const s = state;
  const L = lab();
  const r = rng(Date.now());
  L.passwords ||= {};
  for (const u of s.users) L.passwords[u.sam] ||= makePassword(r);
  const rows = [...s.users].sort((a: any, b: any) => a.sam.localeCompare(b.sam)).map((u: any) => `${u.sam.padEnd(12)} ${u.name.padEnd(20)} ${(L.passwords![u.sam] ?? '').padEnd(26)} ${!u.enabled ? 'Disabled' : u.locked ? 'Locked out' : 'Enabled'}`);
  const cloud = (L.cloudOnly ?? []).map((c) => `${c.sam.padEnd(12)} ${c.name.padEnd(20)} ${(L.passwords![c.sam] ?? '').padEnd(26)} Cloud-only`);
  const text = [
    'CORP Desk training accounts (domain: CORP / corp.example.test)',
    '================================================================',
    'TRAINING ONLY. In a real job you never keep passwords in a file: use a password',
    'manager, give temporary passwords over a verified channel, and let users set their own.',
    '',
    'Sign in as these users in Remote Desktop > Verify a sign-in. Five wrong passwords',
    'lock the account (event 4740). Resets you make in ADUC, Microsoft 365 or at first',
    'sign-in update this file.',
    '',
    `${'Logon'.padEnd(12)} ${'Name'.padEnd(20)} ${'Password'.padEnd(26)} State`,
    `${'-----'.padEnd(12)} ${'----'.padEnd(20)} ${'--------'.padEnd(26)} -----`,
    ...rows, ...cloud, '',
    `Updated ${new Date().toLocaleString()}`,
  ].join('\r\n');
  s.files ||= {};
  s.files[`C:\\Users\\${s.technician}\\Desktop\\Pwd.txt`] = text;
}
export function setLabPassword(sam: string, password: string): void { const L = lab(); (L.passwords ||= {})[sam] = password; (L.badLogons ||= {})[sam] = 0; writePwdFile(); }
/** Check a sign-in; five failures in a row lock the account, as the domain policy says. */
export function checkLabPassword(sam: string, password: string): 'ok' | 'bad' | 'locked' {
  const L = lab();
  const u = corpUser(sam);
  if (!u) return 'bad';
  const expected = (L.passwords ||= {})[u.sam];
  if (!expected || expected === password) { (L.badLogons ||= {})[u.sam] = 0; return 'ok'; }
  const n = ((L.badLogons ||= {})[u.sam] ?? 0) + 1;
  L.badLogons[u.sam] = n;
  if (n >= 5) { u.locked = true; log(4740, `${u.sam}: account locked out after ${n} bad passwords`); writePwdFile(); return 'locked'; }
  return 'bad';
}

export const nowIso = (): string => new Date().toISOString();
export const daysAgo = (d: number): string => new Date(Date.now() - d * 864e5).toISOString();
function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
/** A 48-digit BitLocker recovery password, in eight groups of six, derived from a seed. */
export const recoveryKey = (seed: string): string => Array.from({ length: 8 }, (_, i) => String(hash(seed, i * 7919) % 1000000).padStart(6, '0')).join('-');
/** A BitLocker key protector ID (a GUID), derived from a seed. */
export const keyId = (seed: string): string => {
  const hex = Array.from({ length: 4 }, (_, i) => hash(seed, 31 + i).toString(16).padStart(8, '0')).join('').toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};
export const deviceFor = (u: any): string => `${({ HR: 'HR', IT: 'IT', Finance: 'FIN' } as Record<string, string>)[u.dept] ?? 'CORP'}-PC${(String(u.sam).match(/\d+$/) ?? ['01'])[0].padStart(2, '0')}`;

/** The training tenant: directory users synced and licensed, their devices, printers and the support mailbox. */
export function lab(): ItLab {
  const s = state;
  if (s.itlab?.version === 1) return s.itlab;
  const users: any[] = s.users;
  const data: ItLab = {
    version: 1,
    synced: users.map((u) => u.sam),
    licenses: Object.fromEntries(users.map((u) => [u.sam, 'Microsoft 365 E3'])),
    licenseTotal: 30,
    blocked: [],
    sessionsRevoked: {},
    mailboxes: [
      ...users.map((u, i) => ({ address: `${u.sam}@${DOMAIN}`, name: u.name, type: 'user' as const, owner: u.sam, fullAccess: [], sendAs: [], sizeGb: Math.round((3 + (i * 7) % 31) * 10) / 10, quotaGb: 50 })),
      { address: `hr@${DOMAIN}`, name: 'HR Team', type: 'shared', fullAccess: ['hr01'], sendAs: ['hr01'], sizeGb: 12.4, quotaGb: 50 },
      { address: `finance@${DOMAIN}`, name: 'Finance Team', type: 'shared', fullAccess: ['finance01'], sendAs: ['finance01'], sizeGb: 18.9, quotaGb: 50 },
      { address: `servicedesk@${DOMAIN}`, name: 'IT Service Desk', type: 'shared', fullAccess: ['it01', 'it02'], sendAs: ['it01'], sizeGb: 7.2, quotaGb: 50 },
    ],
    methods: Object.fromEntries(users.map((u, i) => [u.sam, [
      { id: `${u.sam}-app`, type: 'Microsoft Authenticator', detail: `${u.name.split(' ')[0]}'s iPhone`, added: daysAgo(200 + i) },
      { id: `${u.sam}-sms`, type: 'Phone (SMS)', detail: `+1 555 01${String(10 + i).slice(-2)}`, added: daysAgo(420 + i) },
    ]])),
    reregister: {},
    devices: users.map((u, i) => ({
      name: deviceFor(u), owner: u.sam, os: 'Windows 11 Enterprise 23H2', compliant: true, lastSync: daysAgo(i % 3),
      keys: [{ id: keyId(`${u.sam}-a`), key: recoveryKey(`${u.sam}-a`), created: daysAgo(300 + i) }],
    })),
    printers: [
      { name: 'HR-PRN01', location: 'Building 1, Floor 2 (HR)', driver: 'HP Universal Printing PCL 6', port: '10.77.0.61' },
      { name: 'FIN-PRN01', location: 'Building 1, Floor 3 (Finance)', driver: 'HP Universal Printing PCL 6', port: '10.77.0.62' },
      { name: 'IT-PRN01', location: 'Building 2, IT workroom', driver: 'Microsoft IPP Class Driver', port: '10.77.0.63' },
    ],
    jobs: [],
    testPages: {},
    inbox: [{
      id: 'm-welcome', from: `it01@${DOMAIN}`, fromName: 'Alex Morgan', to: `servicedesk@${DOMAIN}`, subject: 'Welcome to the service desk mailbox',
      body: 'Hi team,\n\nThis is the shared IT Service Desk mailbox. Users forward suspicious messages here, and managers send onboarding and termination notices.\n\nAlways check a request against its ticket and approval before you act on it.\n\nAlex\nIT Lead',
      received: daysAgo(3), headers: `From: Alex Morgan <it01@${DOMAIN}>\nTo: servicedesk@${DOMAIN}\nReturn-Path: <it01@${DOMAIN}>\nAuthentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`, read: true,
    }],
    blockedSenders: [],
    purged: [],
    verified: {},
    bitlockerProvided: {},
    completedModules: [],
  };
  s.itlab = data;
  return data;
}
/** Everyone in the Microsoft 365 tenant: AD users that have synced, plus cloud-only accounts made in Entra. */
export const cloudUsers = (): any[] => [...state.users.filter((u: any) => lab().synced.includes(u.sam)), ...(lab().cloudOnly ?? []).map(cloudView)];
const cloudView = (c: any): any => Object.assign(c, { cloud: true, accountOptions: c.accountOptions ?? {}, groups: c.groups ?? [], path: '(cloud only)' });
/** A tenant user by logon name, from Active Directory or cloud-only. */
export const tenantUser = (sam: string): any => corpUser(sam) ?? (() => { const c = (lab().cloudOnly ?? []).find((x) => x.sam.toLowerCase() === String(sam).toLowerCase()); return c ? cloudView(c) : undefined; })();

/** The welcome email from the hiring manager, addressed to the person doing the lab. */
export function welcomeMail(): void {
  const L = lab();
  if (L.inbox.some((m) => m.id === 'm-hired')) return;
  const name: string = state.technician || 'there';
  const sam = name.toLowerCase().replace(/\s+/g, '.');
  L.inbox.push({
    id: 'm-hired', from: `it01@${DOMAIN}`, fromName: 'Alex Morgan (IT Lead)', to: `${sam}@${DOMAIN}`, received: new Date(Date.now() - 3600e3).toISOString(), read: false,
    subject: `Welcome to CORP, ${name.split(' ')[0]}! Your first day on the Service Desk`,
    headers: [`From: Alex Morgan <it01@${DOMAIN}>`, `To: ${sam}@${DOMAIN}`, `Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`].join('\n'),
    body: [
      `Hi ${name.split(' ')[0]},`, '',
      'Welcome to CORP! I am delighted you accepted our offer for the IT Service Desk Analyst role. Here is what you need for your first days.', '',
      'Your role', '- Tier 1 service desk for about 25 staff across HR, IT and Finance.', '- You own tickets from first contact to verified resolution, and you write notes a colleague could follow.', '- Your manager is me, Alex Morgan (it01). Sam Rivera (it02) is your buddy for the first month.', '',
      'Your first week', '1. Open the IT Support Career Path on your desktop and work through the labs in order.', '2. Every request starts in the Service Desk. Never act on a phone call or an email alone: check the ticket and the approval.', '3. Verify every caller before you reset a password or MFA. If verification fails, change nothing and escalate to Security.', '4. Disable leavers, never delete them. Grant exactly what was approved, nothing more.', '',
      'Your tools', '- Service Desk, Active Directory Users and Computers, Microsoft 365 admin center, Microsoft Entra admin center, Outlook (this shared mailbox), Services, Print Management, PowerShell, Event Viewer, Remote Desktop.', '- The Pwd file on your desktop lists the lab accounts\' training passwords for testing sign-ins.', '',
      'We are glad you are here. Ask questions early and often.', '', 'Alex Morgan', 'IT Lead, CORP',
    ].join('\n'),
  });
}
