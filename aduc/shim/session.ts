/**
 * The adapter between the Meridian IAM Range ADUC console (copied unchanged into
 * aduc/) and CORP Desk's simulated directory.
 *
 * `Dir` presents CORP Desk's `state` (users, groups, OUs) the way the console
 * expects, read live on every call. `runCapability` makes the console's changes
 * through CORP Desk's own PowerShell cmdlets wherever one exists, so the GUI,
 * the terminal, the event log and the incident checks never disagree. The few
 * things those cmdlets cannot express (extra attributes, OU descriptions,
 * delegation, password resets, which CORP Desk only does through a dialog) are
 * written to `state` directly with the same event IDs CORP Desk logs.
 */
import { USER_ATTR_PARAMS } from './adAttributes';
import { VM_HOST } from './config';
import { setComputers } from '../model';
import type { Delegation, Group, OrganizationalUnit, OuId, User } from './domain';

/* CORP Desk globals (app.js / windows.js), loaded before this bundle. */
declare const state: any;
declare function runCommand(command: string): { output: unknown; error: boolean };
declare function log(id: number, message: string): void;
declare function evidence(key: string): void;

/** CORP Desk's state object. */
export type World = any;

export class AdError extends Error {}

const DOMAIN = VM_HOST.domain;
const BASE = 'DC=corp,DC=example,DC=test';
const CONTAINERS = ['Users', 'Computers', 'Builtin'];
const bool = (v: string | undefined): boolean => /^(\$?true|1|yes)$/i.test((v ?? '').trim());
const q = (v: unknown): string => `'${String(v ?? '').replace(/'/g, "''")}'`;
const ms = (iso: string | null | undefined): number | undefined => (iso ? Date.parse(iso) || undefined : undefined);

/** CORP Desk's distinguished names: Users, Computers and Builtin are CN= containers, everything else OU=. */
export function pathDN(path: string): string {
  if (!path) return BASE;
  const parts = path.split('/');
  return parts.reverse().map((p) => `${parts.length === 1 && CONTAINERS.includes(p) ? 'CN' : 'OU'}=${p}`).join(',') + ',' + BASE;
}
const escapeRdn = (v: string): string => v.replace(/([,+=<>;"\\])/g, '\\$1');

export function localYmd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Run a CORP Desk cmdlet; its error text becomes the message box the console shows. */
function ps(command: string): void {
  const r = runCommand(command);
  // First line only: CORP Desk's shell adds PowerShell's CategoryInfo / FullyQualifiedErrorId lines.
  if (r.error) throw new AdError(String(r.output).split('\n')[0]!.replace(/^[\w-]+\s*:\s*/, '').trim() || 'The operation failed.');
}

const findUser = (id: string): any => state.users.find((u: any) => u.sam.toLowerCase() === String(id).toLowerCase());
const findGroup = (name: string): any => (state.groups || []).find((g: any) => g.name.toLowerCase() === String(name).toLowerCase());
function requireUser(id: string): any {
  const u = findUser(id);
  if (!u) throw new AdError(`Cannot find an object with identity: '${id}' under: '${BASE}'.`);
  return u;
}

/** The container a user or group is in, as the console's OU id (undefined is CN=Users). */
const ouIdOf = (path: string): OuId | undefined => (path && state.ous.includes(path) ? path : undefined);

/** A console path reference ("corp.example.test/Lab/Users", "Lab\\Users" or "Lab/Users") as a CORP path. */
function toPath(ref: string | undefined): string | null {
  const raw = String(ref ?? '').trim().replace(/\\/g, '/').replace(new RegExp(`^${DOMAIN.replace(/\./g, '\\.')}/?`, 'i'), '').replace(/^\/+|\/+$/g, '');
  if (!raw) return null;
  const all = [...CONTAINERS, 'Domain Controllers', ...state.ous];
  const exact = all.find((p) => p.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const byName = state.ous.filter((p: string) => p.split('/').at(-1)!.toLowerCase() === raw.toLowerCase());
  if (byName.length === 1) return byName[0];
  throw new AdError(`Directory object not found: ${ref}`);
}

const DEPT_FROM_PATH = (path: string): string | undefined => path.split('/').find((p) => ['HR', 'IT', 'Finance'].includes(p));

function userView(u: any): User {
  const a = u.attributes || {};
  const o = u.accountOptions || {};
  const attrs: Record<string, string> = { ...a };
  const set = (k: string, v: unknown): void => { if (v !== undefined && v !== null && v !== '') attrs[k] = String(v); };
  set('givenName', u.givenName); set('sn', u.surname); set('displayName', u.name); set('mail', u.email);
  set('description', u.description); set('physicalDeliveryOfficeName', u.office); set('telephoneNumber', u.telephone);
  set('l', u.city); set('st', u.region); set('c', u.country); set('streetAddress', u.street); set('postalCode', u.postalCode);
  set('wWWHomePage', u.web); set('profilePath', u.profilePath); set('scriptPath', u.logonScript);
  set('homeDirectory', u.homeDirectory); set('homeDrive', u.homeDrive); set('title', u.title); set('department', u.dept);
  set('manager', u.manager);
  attrs.company ??= 'CORP';
  if (o.neverExpires) attrs.PasswordNeverExpires = 'TRUE';
  return {
    id: u.sam,
    username: u.sam,
    displayName: u.name,
    email: u.email || `${u.sam}@${DOMAIN}`,
    upn: u.upn || `${u.sam}@${DOMAIN}`,
    department: u.dept || '',
    title: u.title || '',
    managerId: u.manager || undefined,
    status: !u.enabled ? 'disabled' : u.locked ? 'locked' : 'active',
    mfa: 'none',
    groupIds: [...(u.groups || [])],
    lastSignInAt: ms(u.lastLogon),
    createdAt: ms(u.created) ?? Date.parse('2026-01-05T09:00:00Z'),
    mustChangePassword: !!o.mustChange,
    ouId: ouIdOf(u.path),
    attrs,
  };
}

function groupView(g: any): Group {
  const members = state.users.filter((u: any) => (u.groups || []).includes(g.name));
  return {
    id: g.name,
    name: g.name,
    description: g.description || '',
    memberIds: members.map((u: any) => u.sam),
    ouId: ouIdOf(g.path),
    scope: g.scope,
    category: g.category,
    attrs: { ...(g.attributes || {}), ...(g.managedBy ? { managedBy: g.managedBy } : {}) },
  };
}

function ouView(path: string): OrganizationalUnit {
  const parts = path.split('/');
  const meta = state.ouMeta?.[path] || {};
  const isProtected = state.ouProtected?.[path] !== false;
  return {
    id: path,
    name: parts.at(-1)!,
    parentId: parts.length > 1 ? parts.slice(0, -1).join('/') : undefined,
    description: meta.description ?? (path.startsWith('Lab') ? 'Training organizational unit' : ''),
    createdAt: ms(meta.created) ?? Date.parse('2026-01-05T09:00:00Z'),
    protectedFromDeletion: isProtected,
    attrs: { ...(meta.attrs || {}), ...(isProtected ? { ProtectedFromAccidentalDeletion: 'TRUE' } : {}) },
  };
}

/** CORP Desk's computers, as the console's display-only list. */
export function syncComputers(): void {
  const ou = String(state.ou || 'Workstations');
  const pcPath = ou === 'Computers' ? 'Computers' : ou.includes('/') ? ou : `Lab/${ou}`;
  const where = (path: string): string => (path === 'Computers' ? 'computers' : path === 'Domain Controllers' ? 'dcs' : `ou:${path}`);
  setComputers([
    { name: 'LAB-PC01', description: 'Windows 11 training workstation', os: 'Windows 11 Enterprise', osVersion: '10.0 (22631)', role: 'Workstation or server', container: where(pcPath) },
    { name: 'LAB-DC01', description: '', os: 'Windows Server 2025 Datacenter', osVersion: '10.0 (26100)', role: 'Domain controller', container: 'dcs' },
    ...(state.directoryExtras || []).filter((o: any) => o.type === 'computer').map((o: any) => ({
      name: o.name, description: o.description || '', os: '', osVersion: '', role: 'Workstation or server', container: where(o.path),
    })),
  ] as any);
}

export class Dir {
  get domainName(): string { return DOMAIN; }
  upnSuffixes(): string[] { return [DOMAIN]; }
  listOus(): OrganizationalUnit[] { return state.ous.map(ouView); }
  getOu(id: OuId): OrganizationalUnit | undefined { return state.ous.includes(id) ? ouView(id) : undefined; }
  childOus(parentId?: OuId): OrganizationalUnit[] { return this.listOus().filter((o) => o.parentId === parentId); }
  ouPath(id: OuId): string { return id; }
  resolveOuRef(ref: string): { ou?: OrganizationalUnit; error?: string; matches?: OrganizationalUnit[] } {
    const raw = ref.trim().replace(/\\/g, '/').replace(new RegExp(`^${DOMAIN}/`, 'i'), '');
    if (!raw) return { error: 'An OU name is required.' };
    const exact = state.ous.find((p: string) => p.toLowerCase() === raw.toLowerCase());
    if (exact) return { ou: ouView(exact) };
    const matches = this.listOus().filter((o) => o.name.toLowerCase() === raw.toLowerCase());
    if (matches.length === 1) return { ou: matches[0] };
    if (matches.length > 1) return { error: `More than one OU is named '${raw}'. Use its path.`, matches };
    return { error: `Cannot find an OU at '${ref}'.` };
  }
  listDelegations(): Delegation[] {
    return (state.delegations || []).map((d: any) => ({ ...(d.ou ? { ouId: d.ou } : {}), trustee: d.trustee, tasks: [...d.tasks], at: Date.parse(d.at) }));
  }
  listUsers(filter?: { department?: string; status?: User['status'] }): User[] {
    const all = state.users.map(userView);
    if (!filter) return all;
    return all.filter((u: User) => (!filter.department || u.department === filter.department) && (!filter.status || u.status === filter.status));
  }
  getUser(id: string): User | undefined {
    const u = findUser(id);
    if (!u) return undefined;
    // CORP Desk's incidents count opening these accounts in the console as investigation.
    if (u.sam === 'hr01') evidence('account');
    if (u.sam === 'hr03') evidence('groups');
    return userView(u);
  }
  getUserByUsername(username: string): User | undefined { return this.getUser(username); }
  listGroups(): Group[] { return (state.groups || []).map(groupView); }
  getGroup(id: string): Group | undefined { return this.getGroupByName(id); }
  getGroupByName(name: string): Group | undefined {
    const g = findGroup(name);
    return g ? groupView(g) : undefined;
  }
}

export interface VmServices {
  dir: Dir;
  idp: { validatePassword(p: string): { ok: boolean; reason?: string } };
  audit: unknown;
  cloud: unknown;
  pim: unknown;
  tickets: unknown;
  changed(): void;
  onWorldChange(fn: () => void): () => void;
  world(): World;
  domains?(): string[];
  changeDomain?(domain: string): void;
}

/** CORP Desk's domain password policy (Get-ADDefaultDomainPasswordPolicy): 14+ characters, upper, lower and a digit. */
export function validatePassword(p: string): { ok: boolean; reason?: string } {
  if (p.length < 14) return { ok: false, reason: 'Minimum password length is 14 characters.' };
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p)) return { ok: false, reason: 'The password must contain upper case, lower case and digits.' };
  return { ok: true };
}

/** Set-ADUser parameters CORP Desk's cmdlet accepts, and the user fields everything else lands in. */
const SET_ADUSER = ['GivenName', 'Surname', 'DisplayName', 'Description', 'Office', 'OfficePhone', 'City', 'State', 'Country', 'StreetAddress', 'PostalCode', 'HomePage', 'ProfilePath', 'ScriptPath', 'HomeDirectory', 'HomeDrive', 'Title', 'Department', 'EmailAddress', 'Manager', 'ChangePasswordAtLogon', 'PasswordNeverExpires'];
const LDAP_TO_PARAM: Record<string, string> = {
  givenname: 'GivenName', sn: 'Surname', displayname: 'DisplayName', description: 'Description', physicaldeliveryofficename: 'Office',
  telephonenumber: 'OfficePhone', l: 'City', st: 'State', c: 'Country', streetaddress: 'StreetAddress', postalcode: 'PostalCode',
  wwwhomepage: 'HomePage', profilepath: 'ProfilePath', scriptpath: 'ScriptPath', homedirectory: 'HomeDirectory', homedrive: 'HomeDrive',
  title: 'Title', department: 'Department', mail: 'EmailAddress', manager: 'Manager',
};

function parsePairs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let body = raw.trim();
  const m = /^@\{([\s\S]*)\}$/.exec(body);
  if (m) body = m[1]!;
  for (const part of body.split(/[;\n]/)) {
    const t = part.trim();
    const eq = t.indexOf('=');
    if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function updateUser(a: Record<string, string>): string {
  const u = requireUser(a.Identity ?? '');
  if (a.SamAccountName && a.SamAccountName.toLowerCase() !== u.sam.toLowerCase()) throw new AdError('Changing the pre-Windows 2000 logon name is not supported in this training directory.');
  const params: Record<string, string> = {};
  const bag: Record<string, string | null> = {};
  const take = (k: string, v: string): void => {
    if (SET_ADUSER.includes(k)) params[k] = k === 'Manager' && v ? (findUser(v.replace(/^CN=([^,]+),.*$/, '$1'))?.sam ?? state.users.find((x: any) => x.name === v.replace(/^CN=([^,]+),.*$/, '$1'))?.sam ?? v) : v;
    else if (USER_ATTR_PARAMS[k]) bag[USER_ATTR_PARAMS[k]!] = v || null;
    else bag[k] = bool(v) ? 'TRUE' : v === 'false' || v === '' ? null : v;
  };
  for (const [k, v] of Object.entries(a)) {
    if (['Identity', 'SamAccountName', 'Replace', 'Clear', 'AccountExpirationDate', 'UserPrincipalName', 'EmployeeID'].includes(k)) continue;
    take(k, v);
  }
  if (a.Replace) for (const [k, v] of Object.entries(parsePairs(a.Replace))) { const p = LDAP_TO_PARAM[k.toLowerCase()]; if (p) take(p, v); else if (k !== 'ProtectedFromAccidentalDeletion') bag[k] = v; }
  if (a.Clear) for (const k of a.Clear.split(',').map((x) => x.trim()).filter(Boolean)) { const p = LDAP_TO_PARAM[k.toLowerCase()]; if (p) params[p] = ''; else bag[k] = null; }
  const args = Object.entries(params).map(([k, v]) => (['ChangePasswordAtLogon', 'PasswordNeverExpires'].includes(k) ? `-${k} $${bool(v)}` : `-${k} ${q(v)}`));
  if (args.length) ps(`Set-ADUser -Identity ${q(u.sam)} ${args.join(' ')}`);
  // Attributes CORP Desk's Set-ADUser has no parameter for.
  if (a.UserPrincipalName !== undefined) u.upn = a.UserPrincipalName.includes('@') ? a.UserPrincipalName : `${a.UserPrincipalName}@${DOMAIN}`;
  if (a.EmployeeID !== undefined) bag.employeeID = a.EmployeeID || null;
  if (a.AccountExpirationDate !== undefined) bag.accountExpires = a.AccountExpirationDate ? a.AccountExpirationDate.slice(0, 10) : null;
  if (Object.keys(bag).length) {
    u.attributes ||= {};
    for (const [k, v] of Object.entries(bag)) { if (v === null) delete u.attributes[k]; else u.attributes[k] = v; }
    log(4738, `${u.sam}: attributes updated`);
  }
  return `Updated ${u.sam}`;
}

const userDN = (u: any): string => `CN=${escapeRdn(u.name)},${pathDN(u.path)}`;
const groupDN = (g: any): string => `CN=${escapeRdn(g.name)},${pathDN(g.path)}`;

/** Perform one console capability. Throws with the text the snap-in shows. */
export function runCapability(_w: World, capId: string, a: Record<string, string>): string {
  switch (capId) {
    case 'user.create': {
      const path = toPath(a.Path) ?? 'Users';
      const name = (a.Name ?? '').trim();
      const [first, ...rest] = name.split(/\s+/);
      const dept = a.Department || DEPT_FROM_PATH(path) || 'IT';
      const enabled = !!a.AccountPassword;
      ps(`New-ADUser -Name ${q(name)} -SamAccountName ${q(a.SamAccountName)} -GivenName ${q(a.GivenName ?? first ?? '')} -Surname ${q(a.Surname ?? rest.join(' '))} -Department ${q(dept)} -Path ${q(pathDN(path))} -Enabled $${enabled}` +
        `${a.Title ? ` -Title ${q(a.Title)}` : ''}${a.Description ? ` -Description ${q(a.Description)}` : ''} -ChangePasswordAtLogon $${a.ChangePasswordAtLogon === undefined ? true : bool(a.ChangePasswordAtLogon)}`);
      const u = findUser(a.SamAccountName ?? '');
      if (u) {
        if (a.UserPrincipalName) u.upn = a.UserPrincipalName.includes('@') ? a.UserPrincipalName : `${a.UserPrincipalName}@${DOMAIN}`;
        u.accountOptions ||= {};
        u.accountOptions.mustChange = a.ChangePasswordAtLogon === undefined ? true : bool(a.ChangePasswordAtLogon);
        if (a.AccountPassword) { u.passwordLastSet = new Date().toISOString(); (globalThis as any).CorpDesk?.setLabPassword?.(u.sam, a.AccountPassword); }
      }
      return `Created ${a.SamAccountName}`;
    }
    case 'user.update': return updateUser(a);
    case 'user.disable': ps(`Disable-ADAccount -Identity ${q(a.Identity)}`); return 'Disabled';
    case 'user.enable': ps(`Enable-ADAccount -Identity ${q(a.Identity)}`); return 'Enabled';
    case 'user.delete': ps(`Remove-ADUser -Identity ${q(a.Identity)} -Confirm:$false`); return 'Deleted';
    case 'user.move': {
      const u = requireUser(a.Identity ?? '');
      if (a.TargetPath !== undefined || !a.TargetDepartment) {
        const target = toPath(a.TargetPath) ?? 'Users';
        if (target !== u.path) ps(`Move-ADObject -Identity ${q(userDN(u))} -TargetPath ${q(pathDN(target))}`);
      }
      if (a.TargetDepartment) ps(`Set-ADUser -Identity ${q(u.sam)} -Department ${q(a.TargetDepartment)}`);
      return 'Moved';
    }
    case 'account.unlock': ps(`Unlock-ADAccount -Identity ${q(a.Identity)}`); return 'Unlocked';
    case 'password.reset': {
      const u = requireUser(a.Identity ?? '');
      const v = validatePassword(a.NewPassword ?? '');
      if (!v.ok) throw new AdError(`The password does not meet the length, complexity, or history requirement of the domain. ${v.reason}`);
      // CORP Desk resets passwords only through a dialog (Set-ADAccountPassword -Reset); the value is checked and discarded.
      u.accountOptions ||= {};
      u.accountOptions.mustChange = a.ChangePasswordAtLogon === undefined ? true : bool(a.ChangePasswordAtLogon);
      u.passwordLastSet = new Date().toISOString();
      // The lab keeps training passwords (DesktopPwd.txt) so sign-ins can be tested in Remote Desktop.
      (globalThis as any).CorpDesk?.setLabPassword?.(u.sam, a.NewPassword ?? '');
      log(4724, `${u.sam}: password reset`);
      return 'Password reset';
    }
    case 'group.addMember': ps(`Add-ADGroupMember -Identity ${q(a.Group)} -Members ${q(a.Identity)}`); return 'Added';
    case 'group.removeMember': ps(`Remove-ADGroupMember -Identity ${q(a.Group)} -Members ${q(a.Identity)} -Confirm:$false`); return 'Removed';
    case 'group.create': {
      const path = toPath(a.Path) ?? 'Users';
      ps(`New-ADGroup -Name ${q((a.Name ?? '').trim())} -GroupScope ${a.GroupScope || 'Global'} -GroupCategory ${a.GroupCategory || 'Security'} -Path ${q(pathDN(path))}${a.Description ? ` -Description ${q(a.Description)}` : ''}`);
      return `Created ${a.Name}`;
    }
    case 'group.update': {
      const g = findGroup(a.Identity ?? '');
      if (!g) throw new AdError(`Cannot find an object with identity: '${a.Identity}'.`);
      const args = [a.Description !== undefined ? `-Description ${q(a.Description)}` : '', a.GroupScope ? `-GroupScope ${a.GroupScope}` : '', a.GroupCategory ? `-GroupCategory ${a.GroupCategory}` : ''].filter(Boolean);
      if (args.length) ps(`Set-ADGroup -Identity ${q(g.name)} ${args.join(' ')}`);
      g.attributes ||= {};
      if (a.ManagedBy !== undefined) g.managedBy = a.ManagedBy || null;
      if (a.Replace) for (const [k, v] of Object.entries(parsePairs(a.Replace))) { if (k.toLowerCase() === 'managedby') g.managedBy = v || null; else g.attributes[k] = v; }
      if (a.Clear) for (const k of a.Clear.split(',').map((x) => x.trim())) { if (k.toLowerCase() === 'managedby') g.managedBy = null; else delete g.attributes[k]; }
      return 'Updated';
    }
    case 'group.delete': ps(`Remove-ADGroup -Identity ${q(a.Name ?? a.Identity)} -Confirm:$false`); return 'Deleted';
    case 'ou.create': {
      const parent = toPath(a.Path) ?? '';
      const name = (a.Name ?? '').trim();
      const protect = a.ProtectedFromAccidentalDeletion === undefined ? true : bool(a.ProtectedFromAccidentalDeletion);
      ps(`New-ADOrganizationalUnit -Name ${q(name)} -Path ${q(pathDN(parent))} -ProtectedFromAccidentalDeletion $${protect}`);
      if (a.Description) { const path = parent ? `${parent}/${name}` : name; (state.ouMeta ||= {})[path] = { ...(state.ouMeta[path] || {}), description: a.Description }; }
      return 'Created';
    }
    case 'ou.update': {
      const path = toPath(a.Identity);
      if (!path || !state.ous.includes(path)) throw new AdError(`Not an organizational unit: ${a.Identity}`);
      const meta = ((state.ouMeta ||= {})[path] ||= {});
      meta.attrs ||= {};
      if (a.Description !== undefined) meta.description = a.Description;
      for (const k of ['StreetAddress', 'City', 'State', 'PostalCode', 'Country', 'ManagedBy']) if (a[k] !== undefined) meta.attrs[k] = a[k]!;
      let protect: boolean | undefined = a.ProtectedFromAccidentalDeletion !== undefined ? bool(a.ProtectedFromAccidentalDeletion) : undefined;
      if (a.Clear) for (const k of a.Clear.split(',').map((x) => x.trim())) { if (/protected/i.test(k)) protect = false; else delete meta.attrs[k]; }
      if (protect !== undefined) ps(`Set-ADOrganizationalUnit -Identity ${q(pathDN(path))} -ProtectedFromAccidentalDeletion $${protect}`);
      else log(5136, `${path}: attributes updated`);
      return 'Updated';
    }
    case 'ou.delete': {
      const path = toPath(a.Name ?? a.Identity);
      if (!path) throw new AdError('An OU is required.');
      ps(`Remove-ADOrganizationalUnit -Identity ${q(pathDN(path))} -Confirm:$false`);
      return 'Deleted';
    }
    case 'ou.delegate': {
      const tasks = (a.Tasks ?? '').split(/[;,]/).map((t) => t.trim()).filter(Boolean);
      (state.delegations ||= []).push({ ou: toPath(a.Path), trustee: a.Trustee, tasks, at: new Date().toISOString() });
      log(5136, `${a.Trustee}: control delegated on ${a.Path || DOMAIN}`);
      return 'Delegated';
    }
    case 'object.rename': {
      const id = (a.Identity ?? '').replace(/^(user|group|ou):/, '');
      const u = findUser(id);
      if (u) { ps(`Rename-ADObject -Identity ${q(userDN(u))} -NewName ${q(a.NewName)}`); return 'Renamed'; }
      const g = findGroup(id);
      if (g) { ps(`Rename-ADObject -Identity ${q(groupDN(g))} -NewName ${q(a.NewName)}`); return 'Renamed'; }
      const path = toPath(id);
      if (path) { ps(`Rename-ADObject -Identity ${q(pathDN(path))} -NewName ${q(a.NewName)}`); return 'Renamed'; }
      throw new AdError(`Cannot find an object with identity: '${a.Identity}'.`);
    }
    default:
      throw new AdError(`The operation ${capId} is not available on this domain controller.`);
  }
}
