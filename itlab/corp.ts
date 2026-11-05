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
/** Directory users that have reached Microsoft 365 (Entra Connect sync). */
export const cloudUsers = (): any[] => state.users.filter((u: any) => lab().synced.includes(u.sam));
