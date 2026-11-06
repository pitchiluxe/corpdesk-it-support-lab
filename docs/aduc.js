(() => {
  // aduc/shim/config.ts
  var VM_HOST = {
    name: "LAB-PC01",
    domain: "corp.example.test",
    netbiosDomain: "CORP",
    domainController: "LAB-DC01",
    os: "Microsoft Windows 11 Enterprise",
    osVersion: "10.0.22631"
  };
  var DEPARTMENTS = ["HR", "IT", "Finance"];
  var DELEGATION_TASKS = [
    "Create, delete, and manage user accounts",
    "Reset user passwords and force password change at next logon",
    "Read all user information",
    "Create, delete and manage groups",
    "Modify the membership of a group",
    "Manage Group Policy links",
    "Generate Resultant Set of Policy (Planning)",
    "Generate Resultant Set of Policy (Logging)",
    "Create, delete, and manage inetOrgPerson accounts",
    "Reset inetOrgPerson passwords and force password change at next logon",
    "Read all inetOrgPerson information"
  ];
  function scopeChangeAllowed(from, to) {
    if (from === to) return true;
    return from === "Universal" || to === "Universal";
  }

  // aduc/shim/adAttributes.ts
  var USER_ATTR_PARAMS = {
    GivenName: "givenName",
    Surname: "sn",
    Initials: "initials",
    Description: "description",
    Office: "physicalDeliveryOfficeName",
    OfficePhone: "telephoneNumber",
    HomePage: "wWWHomePage",
    StreetAddress: "streetAddress",
    POBox: "postOfficeBox",
    City: "l",
    State: "st",
    PostalCode: "postalCode",
    Country: "c",
    Company: "company",
    Manager: "manager",
    MobilePhone: "mobile",
    HomePhone: "homePhone",
    Fax: "facsimileTelephoneNumber",
    ProfilePath: "profilePath",
    ScriptPath: "scriptPath",
    HomeDirectory: "homeDirectory",
    HomeDrive: "homeDrive",
    LogonWorkstations: "userWorkstations",
    AccountExpirationDate: "accountExpires"
  };
  var USER_FLAG_PARAMS = [
    "CannotChangePassword",
    "PasswordNeverExpires",
    "AllowReversiblePasswordEncryption",
    "SmartcardLogonRequired",
    "AccountNotDelegated",
    "UseDESKeyOnly",
    "DoesNotRequirePreAuth"
  ];
  var USER_FLAG_LABELS = {
    CannotChangePassword: "User cannot change password",
    PasswordNeverExpires: "Password never expires",
    AllowReversiblePasswordEncryption: "Store password using reversible encryption",
    SmartcardLogonRequired: "Smart card is required for interactive logon",
    AccountNotDelegated: "Account is sensitive and cannot be delegated",
    UseDESKeyOnly: "Use only Kerberos DES encryption types for this account",
    DoesNotRequirePreAuth: "Do not require Kerberos preauthentication"
  };
  var UAC_BITS = {
    ACCOUNTDISABLE: 2,
    LOCKOUT: 16,
    PASSWD_CANT_CHANGE: 64,
    ENCRYPTED_TEXT_PWD_ALLOWED: 128,
    NORMAL_ACCOUNT: 512,
    DONT_EXPIRE_PASSWORD: 65536,
    SMARTCARD_REQUIRED: 262144,
    NOT_DELEGATED: 1048576,
    USE_DES_KEY_ONLY: 2097152,
    DONT_REQ_PREAUTH: 4194304
  };
  var FLAG_BIT = {
    CannotChangePassword: UAC_BITS.PASSWD_CANT_CHANGE,
    PasswordNeverExpires: UAC_BITS.DONT_EXPIRE_PASSWORD,
    AllowReversiblePasswordEncryption: UAC_BITS.ENCRYPTED_TEXT_PWD_ALLOWED,
    SmartcardLogonRequired: UAC_BITS.SMARTCARD_REQUIRED,
    AccountNotDelegated: UAC_BITS.NOT_DELEGATED,
    UseDESKeyOnly: UAC_BITS.USE_DES_KEY_ONLY,
    DoesNotRequirePreAuth: UAC_BITS.DONT_REQ_PREAUTH
  };
  function userAccountControl(attrs, status) {
    let v = UAC_BITS.NORMAL_ACCOUNT;
    if (status === "disabled") v |= UAC_BITS.ACCOUNTDISABLE;
    if (status === "locked") v |= UAC_BITS.LOCKOUT;
    for (const f of USER_FLAG_PARAMS) if (isTrue(attrs?.[f])) v |= FLAG_BIT[f];
    const names = Object.entries(UAC_BITS).filter(([, bit]) => (v & bit) !== 0).map(([n]) => n);
    return { value: v, names };
  }
  function isTrue(v) {
    return v !== void 0 && /^(\$?true|1|yes)$/i.test(v.trim());
  }

  // aduc/model.ts
  var DOMAIN = VM_HOST.domain;
  var NETBIOS = VM_HOST.netbiosDomain;
  var DC_FQDN = `${VM_HOST.domainController}.${VM_HOST.domain}`;
  var DOMAIN_DN = DOMAIN.split(".").map((p) => `DC=${p}`).join(",");
  var CONTAINERS = [
    { id: "builtin", name: "Builtin", type: "builtinDomain", description: "", icon: "container" },
    { id: "computers", name: "Computers", type: "Container", description: "Default container for upgraded computer accounts", icon: "container" },
    { id: "dcs", name: "Domain Controllers", type: "Organizational Unit", description: "Default container for domain controllers", icon: "ou" },
    { id: "fsp", name: "ForeignSecurityPrincipals", type: "Container", description: "Default container for security identifiers (SIDs) associated with objects from external, trusted domains", icon: "container" },
    { id: "keys", name: "Keys", type: "Container", description: "Default container for key credential objects", advanced: true, icon: "container" },
    { id: "lostandfound", name: "LostAndFound", type: "lostAndFound", description: "Default container for orphaned objects", advanced: true, icon: "container" },
    { id: "msa", name: "Managed Service Accounts", type: "Container", description: "Default container for managed service accounts", icon: "container" },
    { id: "programdata", name: "Program Data", type: "Container", description: "Default location for storage of application data.", advanced: true, icon: "container" },
    { id: "system", name: "System", type: "Container", description: "Builtin system settings", advanced: true, icon: "container" },
    { id: "users", name: "Users", type: "Container", description: "Default container for upgraded user accounts", icon: "container" },
    { id: "ntdsquotas", name: "NTDS Quotas", type: "msDS-QuotaContainer", description: "Quota specifications container", advanced: true, last: true, icon: "container" },
    { id: "tpm", name: "TPM Devices", type: "msTPM-InformationObjectsContainer", description: "", advanced: true, last: true, icon: "container" }
  ];
  var containerById = (id) => CONTAINERS.find((c) => c.id === id);
  var G = (name, scope, description, container = "users") => ({ name, kind: "group", scope, description, container });
  var BUILTIN_OBJECTS = [
    { name: "Administrator", kind: "user", description: "Built-in account for administering the computer/domain", container: "users" },
    G("Allowed RODC Password Replication Group", "DomainLocal", "Members in this group can have their passwords replicated to all read-only domain controllers in the domain"),
    G("Cert Publishers", "DomainLocal", "Members of this group are permitted to publish certificates to the directory"),
    G("Cloneable Domain Controllers", "Global", "Members of this group that are domain controllers may be cloned."),
    G("Denied RODC Password Replication Group", "DomainLocal", "Members in this group cannot have their passwords replicated to any read-only domain controllers in the domain"),
    G("DnsAdmins", "DomainLocal", "DNS Administrators Group"),
    G("DnsUpdateProxy", "Global", "DNS clients who are permitted to perform dynamic updates on behalf of some other clients (such as DHCP servers)."),
    G("Domain Admins", "Global", "Designated administrators of the domain"),
    G("Domain Computers", "Global", "All workstations and servers joined to the domain"),
    G("Domain Controllers", "Global", "All domain controllers in the domain"),
    G("Domain Guests", "Global", "All domain guests"),
    G("Domain Users", "Global", "All domain users"),
    G("Enterprise Admins", "Universal", "Designated administrators of the enterprise"),
    G("Enterprise Key Admins", "Universal", "Members of this group can perform administrative actions on key objects within the forest."),
    G("Enterprise Read-only Domain Controllers", "Universal", "Members of this group are Read-Only Domain Controllers in the enterprise"),
    G("Group Policy Creator Owners", "Global", "Members in this group can modify group policy for the domain"),
    { name: "Guest", kind: "user", description: "Built-in account for guest access to the computer/domain", disabled: true, container: "users" },
    G("Key Admins", "Global", "Members of this group can perform administrative actions on key objects within the domain."),
    { name: "krbtgt", kind: "user", description: "Key Distribution Center Service Account", disabled: true, container: "users" },
    G("Protected Users", "Global", "Members of this group are afforded additional protections against authentication security threats."),
    G("RAS and IAS Servers", "DomainLocal", "Servers in this group can access remote access properties of users"),
    G("Read-only Domain Controllers", "Global", "Members of this group are Read-Only Domain Controllers in the domain"),
    G("Schema Admins", "Universal", "Designated administrators of the schema"),
    G("Access Control Assistance Operators", "DomainLocal", "Members of this group can remotely query authorization attributes and permissions for resources on this computer.", "builtin"),
    G("Account Operators", "DomainLocal", "Members can administer domain user and group accounts", "builtin"),
    G("Administrators", "DomainLocal", "Administrators have complete and unrestricted access to the computer/domain", "builtin"),
    G("Backup Operators", "DomainLocal", "Backup Operators can override security restrictions for the sole purpose of backing up or restoring files", "builtin"),
    G("Certificate Service DCOM Access", "DomainLocal", "Members of this group are allowed to connect to Certification Authorities in the enterprise", "builtin"),
    G("Cryptographic Operators", "DomainLocal", "Members are authorized to perform cryptographic operations.", "builtin"),
    G("Distributed COM Users", "DomainLocal", "Members are allowed to launch, activate and use Distributed COM objects on this machine.", "builtin"),
    G("Event Log Readers", "DomainLocal", "Members of this group can read event logs from local machine", "builtin"),
    G("Guests", "DomainLocal", "Guests have the same access as members of the Users group by default, except for the Guest account which is further restricted", "builtin"),
    G("Hyper-V Administrators", "DomainLocal", "Members of this group have complete and unrestricted access to all features of Hyper-V.", "builtin"),
    G("IIS_IUSRS", "DomainLocal", "Built-in group used by Internet Information Services.", "builtin"),
    G("Incoming Forest Trust Builders", "DomainLocal", "Members of this group can create incoming, one-way trusts to this forest", "builtin"),
    G("Network Configuration Operators", "DomainLocal", "Members in this group can have some administrative privileges to manage configuration of networking features", "builtin"),
    G("Performance Log Users", "DomainLocal", "Members of this group may schedule logging of performance counters, enable trace providers, and collect event traces both locally and via remote access to this computer", "builtin"),
    G("Performance Monitor Users", "DomainLocal", "Members of this group can access performance counter data locally and remotely", "builtin"),
    G("Pre-Windows 2000 Compatible Access", "DomainLocal", "A backward compatibility group which allows read access on all users and groups in the domain", "builtin"),
    G("Print Operators", "DomainLocal", "Members can administer printers installed on domain controllers", "builtin"),
    G("Remote Desktop Users", "DomainLocal", "Members in this group are granted the right to logon remotely", "builtin"),
    G("Remote Management Users", "DomainLocal", "Members of this group can access WMI resources over management protocols (such as WS-Management via the Windows Remote Management service).", "builtin"),
    G("Replicator", "DomainLocal", "Supports file replication in a domain", "builtin"),
    G("Server Operators", "DomainLocal", "Members can administer domain servers", "builtin"),
    G("Storage Replica Administrators", "DomainLocal", "Members of this group have complete and unrestricted access to all features of Storage Replica.", "builtin"),
    G("Terminal Server License Servers", "DomainLocal", "Members of this group can update user accounts in Active Directory with information about license issuance", "builtin"),
    G("Users", "DomainLocal", "Users are prevented from making accidental or intentional system-wide changes and can run most applications", "builtin"),
    G("Windows Authorization Access Group", "DomainLocal", "Members of this group have access to the computed tokenGroupsGlobalAndUniversal attribute on User objects", "builtin")
  ];
  var COMPUTERS = [];
  function setComputers(list) {
    COMPUTERS.splice(0, COMPUTERS.length, ...list);
  }
  function groupTypeLabel(scope, category) {
    const s = scope === "DomainLocal" ? "Domain Local" : scope ?? "Global";
    return `${category ?? "Security"} Group - ${s}`;
  }
  function userRow(u) {
    return {
      key: `user:${u.id}`,
      kind: "user",
      name: u.displayName,
      type: "User",
      description: u.attrs?.description ?? "",
      icon: u.status === "disabled" ? "userDisabled" : "user",
      user: u
    };
  }
  function groupRow(g2) {
    return {
      key: `group:${g2.id}`,
      kind: "group",
      name: g2.name,
      type: groupTypeLabel(g2.scope, g2.category),
      description: g2.description,
      icon: "group",
      group: g2
    };
  }
  function ouRow(o) {
    return {
      key: `ou:${o.id}`,
      kind: "ou",
      name: o.name,
      type: "Organizational Unit",
      description: o.description,
      icon: "ou",
      ou: o,
      nodeKey: `ou:${o.id}`
    };
  }
  function containerRow(c) {
    return { key: `c:${c.id}`, kind: "container", name: c.name, type: c.type, description: c.description, icon: c.icon, nodeKey: `c:${c.id}` };
  }
  function builtinRow(b) {
    return {
      key: `b:${b.name}`,
      kind: b.kind === "user" ? "builtin-user" : "builtin-group",
      name: b.name,
      type: b.kind === "user" ? "User" : groupTypeLabel(b.scope, "Security"),
      description: b.description,
      icon: b.kind === "user" ? b.disabled ? "userDisabled" : "user" : "group",
      builtin: b
    };
  }
  function computerRow(c) {
    return { key: `computer:${c.name}`, kind: "computer", name: c.name, type: "Computer", description: c.description, icon: "computer", computer: c };
  }
  function builtinsIn(container, dir) {
    const taken = /* @__PURE__ */ new Set([
      ...dir.listUsers().filter((u) => !u.ouId).map((u) => u.displayName.toLowerCase()),
      // A default group made real on first use (Domain Admins...) replaces its placeholder.
      ...dir.listGroups().map((g2) => g2.name.toLowerCase())
    ]);
    for (const u of dir.listUsers()) if (u.username.toLowerCase() === "admin") taken.add("administrator");
    return BUILTIN_OBJECTS.filter((b) => b.container === container && !taken.has(b.name.toLowerCase())).map(builtinRow);
  }
  function byName(a, b) {
    const la = a.kind === "container" && containerById(a.key.slice(2))?.last ? 1 : 0;
    const lb = b.kind === "container" && containerById(b.key.slice(2))?.last ? 1 : 0;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
  }
  function childrenOf(nodeKey, dir, view) {
    let rows = [];
    if (nodeKey === "root") {
      rows = [
        { key: "saved", kind: "saved", name: "Saved Queries", type: "", description: "Folder to store your favorite queries", icon: "savedQueries", nodeKey: "saved" },
        { key: "domain", kind: "domain", name: DOMAIN, type: "Domain", description: "", icon: "domain", nodeKey: "domain" }
      ];
      return rows;
    }
    if (nodeKey === "saved") return [];
    if (nodeKey === "domain") {
      rows = [
        ...CONTAINERS.filter((c) => view.advanced || !c.advanced).map(containerRow),
        ...dir.childOus(void 0).map(ouRow)
      ];
    } else if (nodeKey === "c:users") {
      rows = [...dir.listUsers().filter((u) => !u.ouId).map(userRow), ...dir.listGroups().filter((g2) => !g2.ouId).map(groupRow), ...builtinsIn("users", dir)];
    } else if (nodeKey === "c:builtin") {
      rows = builtinsIn("builtin", dir);
    } else if (nodeKey === "c:computers") {
      rows = COMPUTERS.filter((c) => c.container === "computers").map(computerRow);
    } else if (nodeKey === "c:dcs") {
      rows = COMPUTERS.filter((c) => c.container === "dcs").map(computerRow);
    } else if (nodeKey === "c:system" && view.advanced) {
      rows = ["AdminSDHolder", "ComPartitions", "ComPartitionSets", "DomainUpdates", "IP Security", "Meetings", "MicrosoftDNS", "Password Settings Container", "Policies", "RAS and IAS Servers Access Check", "WinsockServices", "WMIPolicy"].map(
        (n) => ({ key: `sys:${n}`, kind: "container", name: n, type: "Container", description: "", icon: "container" })
      );
    } else if (nodeKey.startsWith("ou:")) {
      const id = nodeKey.slice(3);
      rows = [
        ...dir.childOus(id).map(ouRow),
        ...dir.listUsers().filter((u) => u.ouId === id).map(userRow),
        ...dir.listGroups().filter((g2) => g2.ouId === id).map(groupRow),
        ...COMPUTERS.filter((c) => c.container === `ou:${id}`).map(computerRow)
      ];
    }
    if (view.types) {
      const t = view.types;
      rows = rows.filter((r) => {
        if (r.kind === "user" || r.kind === "builtin-user") return t.has("user");
        if (r.kind === "group" || r.kind === "builtin-group") return t.has("group");
        if (r.kind === "computer") return t.has("computer");
        if (r.kind === "ou") return t.has("ou");
        return t.has("container");
      });
    }
    return rows.sort(byName);
  }
  function treeChildren(nodeKey, dir, view, objectsAsContainers) {
    const all = childrenOf(nodeKey, dir, { ...view, types: null });
    return all.filter((r) => r.nodeKey || objectsAsContainers && r.kind !== "saved");
  }
  function objectByKey(key, dir) {
    if (key === "root") return { key, kind: "root", name: "Active Directory Users and Computers", type: "", description: "", icon: "root", nodeKey: "root" };
    if (key === "domain") return { key, kind: "domain", name: DOMAIN, type: "Domain", description: "", icon: "domain", nodeKey: "domain" };
    if (key === "saved") return { key, kind: "saved", name: "Saved Queries", type: "", description: "", icon: "savedQueries", nodeKey: "saved" };
    if (key.startsWith("c:")) {
      const c = containerById(key.slice(2));
      return c ? containerRow(c) : void 0;
    }
    if (key.startsWith("ou:")) {
      const o = dir.getOu(key.slice(3));
      return o ? ouRow(o) : void 0;
    }
    if (key.startsWith("user:")) {
      const u = dir.getUser(key.slice(5));
      return u ? userRow(u) : void 0;
    }
    if (key.startsWith("group:")) {
      const g2 = dir.getGroup(key.slice(6));
      return g2 ? groupRow(g2) : void 0;
    }
    if (key.startsWith("computer:")) {
      const c = COMPUTERS.find((x) => x.name === key.slice(9));
      return c ? computerRow(c) : void 0;
    }
    if (key.startsWith("b:")) {
      const b = BUILTIN_OBJECTS.find((x) => x.name === key.slice(2));
      return b ? builtinRow(b) : void 0;
    }
    return void 0;
  }
  function parentKey(key, dir) {
    if (key === "root") return void 0;
    if (key === "domain" || key === "saved") return "root";
    if (key.startsWith("c:")) return "domain";
    if (key.startsWith("ou:")) {
      const o = dir.getOu(key.slice(3));
      return o?.parentId ? `ou:${o.parentId}` : "domain";
    }
    if (key.startsWith("user:")) {
      const u = dir.getUser(key.slice(5));
      return u?.ouId ? `ou:${u.ouId}` : "c:users";
    }
    if (key.startsWith("group:")) {
      const g2 = dir.getGroup(key.slice(6));
      return g2?.ouId ? `ou:${g2.ouId}` : "c:users";
    }
    if (key.startsWith("computer:")) {
      const c = COMPUTERS.find((x) => x.name === key.slice(9));
      return c?.container === "dcs" ? "c:dcs" : "c:computers";
    }
    if (key.startsWith("b:")) return BUILTIN_OBJECTS.find((x) => x.name === key.slice(2))?.container === "builtin" ? "c:builtin" : "c:users";
    return void 0;
  }
  function canonicalOf(nodeKey, dir) {
    if (nodeKey === "domain") return DOMAIN;
    if (nodeKey.startsWith("ou:")) return `${DOMAIN}/${dir.ouPath(nodeKey.slice(3))}`;
    if (nodeKey.startsWith("c:")) return `${DOMAIN}/${containerById(nodeKey.slice(2))?.name ?? ""}`;
    return DOMAIN;
  }
  function homeOf(o) {
    return o.ouId ? `ou:${o.ouId}` : "c:users";
  }
  function pathArgOf(nodeKey, dir) {
    return nodeKey.startsWith("ou:") ? dir.ouPath(nodeKey.slice(3)) : void 0;
  }
  function canCreateObjectsIn(nodeKey) {
    return nodeKey === "c:users" || nodeKey.startsWith("ou:");
  }
  function canCreateOuIn(nodeKey) {
    return nodeKey === "domain" || nodeKey.startsWith("ou:");
  }
  var attr = (o, k) => o.user?.attrs?.[k] ?? "";
  var ALL_COLUMNS = [
    { id: "name", label: "Name", width: 220, value: (o) => o.name },
    { id: "type", label: "Type", width: 190, value: (o) => o.type },
    { id: "description", label: "Description", width: 420, value: (o) => o.description },
    { id: "givenName", label: "First Name", width: 110, value: (o) => attr(o, "givenName") || (o.user ? o.user.displayName.split(" ")[0] ?? "" : "") },
    { id: "sn", label: "Last Name", width: 110, value: (o) => attr(o, "sn") || (o.user ? o.user.displayName.split(" ").slice(1).join(" ") : "") },
    { id: "displayName", label: "Display Name", width: 150, value: (o) => o.user?.displayName ?? "" },
    { id: "upn", label: "User Logon Name", width: 170, value: (o) => o.user ? o.user.upn ?? `${o.user.username}@${DOMAIN}` : "" },
    { id: "sam", label: "Pre-Windows 2000 Logon Name", width: 170, value: (o) => o.user ? `${NETBIOS}\\${o.user.username}` : o.group ? `${NETBIOS}\\${o.group.attrs?.sAMAccountName ?? o.group.name}` : "" },
    { id: "mail", label: "E-Mail Address", width: 170, value: (o) => o.user?.email ?? o.group?.attrs?.mail ?? "" },
    { id: "department", label: "Department", width: 110, value: (o) => o.user?.department ?? "" },
    { id: "title", label: "Job Title", width: 130, value: (o) => o.user?.title ?? "" },
    { id: "office", label: "Office", width: 100, value: (o) => attr(o, "physicalDeliveryOfficeName") },
    { id: "phone", label: "Telephone Number", width: 120, value: (o) => attr(o, "telephoneNumber") },
    { id: "company", label: "Company", width: 110, value: (o) => attr(o, "company") },
    { id: "city", label: "City", width: 90, value: (o) => attr(o, "l") },
    { id: "manager", label: "Manager", width: 130, value: (o, dir) => {
      const m = attr(o, "manager") || (o.user?.managerId ? dir.getUser(o.user.managerId)?.username ?? "" : "");
      return m ? dir.getUserByUsername(m)?.displayName ?? m : "";
    } },
    { id: "status", label: "Account Status", width: 100, value: (o) => o.user ? o.user.status === "disabled" ? "Disabled" : o.user.status === "locked" ? "Locked out" : "Enabled" : "" },
    { id: "created", label: "Created", width: 140, value: (o) => o.user ? new Date(o.user.createdAt).toLocaleString() : o.ou ? new Date(o.ou.createdAt).toLocaleString() : "" }
  ];
  var DEFAULT_COLUMNS = ["name", "type", "description"];

  // aduc/shim/session.ts
  var AdError = class extends Error {
  };
  var DOMAIN2 = VM_HOST.domain;
  var BASE = "DC=corp,DC=example,DC=test";
  var CONTAINERS2 = ["Users", "Computers", "Builtin"];
  var bool = (v) => /^(\$?true|1|yes)$/i.test((v ?? "").trim());
  var q = (v) => `'${String(v ?? "").replace(/'/g, "''")}'`;
  var ms = (iso) => iso ? Date.parse(iso) || void 0 : void 0;
  function pathDN(path) {
    if (!path) return BASE;
    const parts = path.split("/");
    return parts.reverse().map((p) => `${parts.length === 1 && CONTAINERS2.includes(p) ? "CN" : "OU"}=${p}`).join(",") + "," + BASE;
  }
  var escapeRdn = (v) => v.replace(/([,+=<>;"\\])/g, "\\$1");
  function ps(command) {
    const r = runCommand(command);
    if (r.error) throw new AdError(String(r.output).split("\n")[0].replace(/^[\w-]+\s*:\s*/, "").trim() || "The operation failed.");
  }
  var findUser = (id) => state.users.find((u) => u.sam.toLowerCase() === String(id).toLowerCase());
  var findGroup = (name) => (state.groups || []).find((g2) => g2.name.toLowerCase() === String(name).toLowerCase());
  function requireUser(id) {
    const u = findUser(id);
    if (!u) throw new AdError(`Cannot find an object with identity: '${id}' under: '${BASE}'.`);
    return u;
  }
  var ouIdOf = (path) => path && state.ous.includes(path) ? path : void 0;
  function toPath(ref) {
    const raw = String(ref ?? "").trim().replace(/\\/g, "/").replace(new RegExp(`^${DOMAIN2.replace(/\./g, "\\.")}/?`, "i"), "").replace(/^\/+|\/+$/g, "");
    if (!raw) return null;
    const all = [...CONTAINERS2, "Domain Controllers", ...state.ous];
    const exact = all.find((p) => p.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
    const byName2 = state.ous.filter((p) => p.split("/").at(-1).toLowerCase() === raw.toLowerCase());
    if (byName2.length === 1) return byName2[0];
    throw new AdError(`Directory object not found: ${ref}`);
  }
  var DEPT_FROM_PATH = (path) => path.split("/").find((p) => ["HR", "IT", "Finance"].includes(p));
  function userView(u) {
    const a = u.attributes || {};
    const o = u.accountOptions || {};
    const attrs = { ...a };
    const set = (k, v) => {
      if (v !== void 0 && v !== null && v !== "") attrs[k] = String(v);
    };
    set("givenName", u.givenName);
    set("sn", u.surname);
    set("displayName", u.name);
    set("mail", u.email);
    set("description", u.description);
    set("physicalDeliveryOfficeName", u.office);
    set("telephoneNumber", u.telephone);
    set("l", u.city);
    set("st", u.region);
    set("c", u.country);
    set("streetAddress", u.street);
    set("postalCode", u.postalCode);
    set("wWWHomePage", u.web);
    set("profilePath", u.profilePath);
    set("scriptPath", u.logonScript);
    set("homeDirectory", u.homeDirectory);
    set("homeDrive", u.homeDrive);
    set("title", u.title);
    set("department", u.dept);
    set("manager", u.manager);
    attrs.company ?? (attrs.company = "CORP");
    if (o.neverExpires) attrs.PasswordNeverExpires = "TRUE";
    return {
      id: u.sam,
      username: u.sam,
      displayName: u.name,
      email: u.email || `${u.sam}@${DOMAIN2}`,
      upn: u.upn || `${u.sam}@${DOMAIN2}`,
      department: u.dept || "",
      title: u.title || "",
      managerId: u.manager || void 0,
      status: !u.enabled ? "disabled" : u.locked ? "locked" : "active",
      mfa: "none",
      groupIds: [...u.groups || []],
      lastSignInAt: ms(u.lastLogon),
      createdAt: ms(u.created) ?? Date.parse("2026-01-05T09:00:00Z"),
      mustChangePassword: !!o.mustChange,
      ouId: ouIdOf(u.path),
      attrs
    };
  }
  function groupView(g2) {
    const members = state.users.filter((u) => (u.groups || []).includes(g2.name));
    return {
      id: g2.name,
      name: g2.name,
      description: g2.description || "",
      memberIds: members.map((u) => u.sam),
      ouId: ouIdOf(g2.path),
      scope: g2.scope,
      category: g2.category,
      attrs: { ...g2.attributes || {}, ...g2.managedBy ? { managedBy: g2.managedBy } : {} }
    };
  }
  function ouView(path) {
    const parts = path.split("/");
    const meta = state.ouMeta?.[path] || {};
    const isProtected = state.ouProtected?.[path] !== false;
    return {
      id: path,
      name: parts.at(-1),
      parentId: parts.length > 1 ? parts.slice(0, -1).join("/") : void 0,
      description: meta.description ?? (path.startsWith("Lab") ? "Training organizational unit" : ""),
      createdAt: ms(meta.created) ?? Date.parse("2026-01-05T09:00:00Z"),
      protectedFromDeletion: isProtected,
      attrs: { ...meta.attrs || {}, ...isProtected ? { ProtectedFromAccidentalDeletion: "TRUE" } : {} }
    };
  }
  function syncComputers() {
    const ou = String(state.ou || "Workstations");
    const pcPath = ou === "Computers" ? "Computers" : ou.includes("/") ? ou : `Lab/${ou}`;
    const where = (path) => path === "Computers" ? "computers" : path === "Domain Controllers" ? "dcs" : `ou:${path}`;
    setComputers([
      { name: "LAB-PC01", description: "Windows 11 training workstation", os: "Windows 11 Enterprise", osVersion: "10.0 (22631)", role: "Workstation or server", container: where(pcPath) },
      { name: "LAB-DC01", description: "", os: "Windows Server 2025 Datacenter", osVersion: "10.0 (26100)", role: "Domain controller", container: "dcs" },
      ...(state.directoryExtras || []).filter((o) => o.type === "computer").map((o) => ({
        name: o.name,
        description: o.description || "",
        os: "",
        osVersion: "",
        role: "Workstation or server",
        container: where(o.path)
      }))
    ]);
  }
  var Dir = class {
    get domainName() {
      return DOMAIN2;
    }
    upnSuffixes() {
      return [DOMAIN2];
    }
    listOus() {
      return state.ous.map(ouView);
    }
    getOu(id) {
      return state.ous.includes(id) ? ouView(id) : void 0;
    }
    childOus(parentId) {
      return this.listOus().filter((o) => o.parentId === parentId);
    }
    ouPath(id) {
      return id;
    }
    resolveOuRef(ref) {
      const raw = ref.trim().replace(/\\/g, "/").replace(new RegExp(`^${DOMAIN2}/`, "i"), "");
      if (!raw) return { error: "An OU name is required." };
      const exact = state.ous.find((p) => p.toLowerCase() === raw.toLowerCase());
      if (exact) return { ou: ouView(exact) };
      const matches2 = this.listOus().filter((o) => o.name.toLowerCase() === raw.toLowerCase());
      if (matches2.length === 1) return { ou: matches2[0] };
      if (matches2.length > 1) return { error: `More than one OU is named '${raw}'. Use its path.`, matches: matches2 };
      return { error: `Cannot find an OU at '${ref}'.` };
    }
    listDelegations() {
      return (state.delegations || []).map((d) => ({ ...d.ou ? { ouId: d.ou } : {}, trustee: d.trustee, tasks: [...d.tasks], at: Date.parse(d.at) }));
    }
    listUsers(filter) {
      const all = state.users.map(userView);
      if (!filter) return all;
      return all.filter((u) => (!filter.department || u.department === filter.department) && (!filter.status || u.status === filter.status));
    }
    getUser(id) {
      const u = findUser(id);
      if (!u) return void 0;
      if (u.sam === "hr01") evidence("account");
      if (u.sam === "hr03") evidence("groups");
      return userView(u);
    }
    getUserByUsername(username) {
      return this.getUser(username);
    }
    listGroups() {
      return (state.groups || []).map(groupView);
    }
    getGroup(id) {
      return this.getGroupByName(id);
    }
    getGroupByName(name) {
      const g2 = findGroup(name);
      return g2 ? groupView(g2) : void 0;
    }
  };
  function validatePassword(p) {
    if (p.length < 14) return { ok: false, reason: "Minimum password length is 14 characters." };
    if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p)) return { ok: false, reason: "The password must contain upper case, lower case and digits." };
    return { ok: true };
  }
  var SET_ADUSER = ["GivenName", "Surname", "DisplayName", "Description", "Office", "OfficePhone", "City", "State", "Country", "StreetAddress", "PostalCode", "HomePage", "ProfilePath", "ScriptPath", "HomeDirectory", "HomeDrive", "Title", "Department", "EmailAddress", "Manager", "ChangePasswordAtLogon", "PasswordNeverExpires"];
  var LDAP_TO_PARAM = {
    givenname: "GivenName",
    sn: "Surname",
    displayname: "DisplayName",
    description: "Description",
    physicaldeliveryofficename: "Office",
    telephonenumber: "OfficePhone",
    l: "City",
    st: "State",
    c: "Country",
    streetaddress: "StreetAddress",
    postalcode: "PostalCode",
    wwwhomepage: "HomePage",
    profilepath: "ProfilePath",
    scriptpath: "ScriptPath",
    homedirectory: "HomeDirectory",
    homedrive: "HomeDrive",
    title: "Title",
    department: "Department",
    mail: "EmailAddress",
    manager: "Manager"
  };
  function parsePairs(raw) {
    const out = {};
    let body2 = raw.trim();
    const m = /^@\{([\s\S]*)\}$/.exec(body2);
    if (m) body2 = m[1];
    for (const part of body2.split(/[;\n]/)) {
      const t = part.trim();
      const eq = t.indexOf("=");
      if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
    return out;
  }
  function updateUser(a) {
    const u = requireUser(a.Identity ?? "");
    if (a.SamAccountName && a.SamAccountName.toLowerCase() !== u.sam.toLowerCase()) throw new AdError("Changing the pre-Windows 2000 logon name is not supported in this training directory.");
    const params = {};
    const bag = {};
    const take = (k, v) => {
      if (SET_ADUSER.includes(k)) params[k] = k === "Manager" && v ? findUser(v.replace(/^CN=([^,]+),.*$/, "$1"))?.sam ?? state.users.find((x) => x.name === v.replace(/^CN=([^,]+),.*$/, "$1"))?.sam ?? v : v;
      else if (USER_ATTR_PARAMS[k]) bag[USER_ATTR_PARAMS[k]] = v || null;
      else bag[k] = bool(v) ? "TRUE" : v === "false" || v === "" ? null : v;
    };
    for (const [k, v] of Object.entries(a)) {
      if (["Identity", "SamAccountName", "Replace", "Clear", "AccountExpirationDate", "UserPrincipalName", "EmployeeID"].includes(k)) continue;
      take(k, v);
    }
    if (a.Replace) for (const [k, v] of Object.entries(parsePairs(a.Replace))) {
      const p = LDAP_TO_PARAM[k.toLowerCase()];
      if (p) take(p, v);
      else if (k !== "ProtectedFromAccidentalDeletion") bag[k] = v;
    }
    if (a.Clear) for (const k of a.Clear.split(",").map((x) => x.trim()).filter(Boolean)) {
      const p = LDAP_TO_PARAM[k.toLowerCase()];
      if (p) params[p] = "";
      else bag[k] = null;
    }
    const args = Object.entries(params).map(([k, v]) => ["ChangePasswordAtLogon", "PasswordNeverExpires"].includes(k) ? `-${k} $${bool(v)}` : `-${k} ${q(v)}`);
    if (args.length) ps(`Set-ADUser -Identity ${q(u.sam)} ${args.join(" ")}`);
    if (a.UserPrincipalName !== void 0) u.upn = a.UserPrincipalName.includes("@") ? a.UserPrincipalName : `${a.UserPrincipalName}@${DOMAIN2}`;
    if (a.EmployeeID !== void 0) bag.employeeID = a.EmployeeID || null;
    if (a.AccountExpirationDate !== void 0) bag.accountExpires = a.AccountExpirationDate ? a.AccountExpirationDate.slice(0, 10) : null;
    if (Object.keys(bag).length) {
      u.attributes || (u.attributes = {});
      for (const [k, v] of Object.entries(bag)) {
        if (v === null) delete u.attributes[k];
        else u.attributes[k] = v;
      }
      log(4738, `${u.sam}: attributes updated`);
    }
    return `Updated ${u.sam}`;
  }
  var userDN = (u) => `CN=${escapeRdn(u.name)},${pathDN(u.path)}`;
  var groupDN = (g2) => `CN=${escapeRdn(g2.name)},${pathDN(g2.path)}`;
  function runCapability(_w, capId, a) {
    var _a;
    switch (capId) {
      case "user.create": {
        const path = toPath(a.Path) ?? "Users";
        const name = (a.Name ?? "").trim();
        const [first, ...rest] = name.split(/\s+/);
        const dept = a.Department || DEPT_FROM_PATH(path) || "IT";
        const enabled = !!a.AccountPassword;
        ps(`New-ADUser -Name ${q(name)} -SamAccountName ${q(a.SamAccountName)} -GivenName ${q(a.GivenName ?? first ?? "")} -Surname ${q(a.Surname ?? rest.join(" "))} -Department ${q(dept)} -Path ${q(pathDN(path))} -Enabled $${enabled}${a.Title ? ` -Title ${q(a.Title)}` : ""}${a.Description ? ` -Description ${q(a.Description)}` : ""} -ChangePasswordAtLogon $${a.ChangePasswordAtLogon === void 0 ? true : bool(a.ChangePasswordAtLogon)}`);
        const u = findUser(a.SamAccountName ?? "");
        if (u) {
          if (a.UserPrincipalName) u.upn = a.UserPrincipalName.includes("@") ? a.UserPrincipalName : `${a.UserPrincipalName}@${DOMAIN2}`;
          u.accountOptions || (u.accountOptions = {});
          u.accountOptions.mustChange = a.ChangePasswordAtLogon === void 0 ? true : bool(a.ChangePasswordAtLogon);
          if (a.AccountPassword) {
            u.passwordLastSet = (/* @__PURE__ */ new Date()).toISOString();
            globalThis.CorpDesk?.setLabPassword?.(u.sam, a.AccountPassword);
          }
        }
        return `Created ${a.SamAccountName}`;
      }
      case "user.update":
        return updateUser(a);
      case "user.disable":
        ps(`Disable-ADAccount -Identity ${q(a.Identity)}`);
        return "Disabled";
      case "user.enable":
        ps(`Enable-ADAccount -Identity ${q(a.Identity)}`);
        return "Enabled";
      case "user.delete":
        ps(`Remove-ADUser -Identity ${q(a.Identity)} -Confirm:$false`);
        return "Deleted";
      case "user.move": {
        const u = requireUser(a.Identity ?? "");
        if (a.TargetPath !== void 0 || !a.TargetDepartment) {
          const target = toPath(a.TargetPath) ?? "Users";
          if (target !== u.path) ps(`Move-ADObject -Identity ${q(userDN(u))} -TargetPath ${q(pathDN(target))}`);
        }
        if (a.TargetDepartment) ps(`Set-ADUser -Identity ${q(u.sam)} -Department ${q(a.TargetDepartment)}`);
        return "Moved";
      }
      case "account.unlock":
        ps(`Unlock-ADAccount -Identity ${q(a.Identity)}`);
        return "Unlocked";
      case "password.reset": {
        const u = requireUser(a.Identity ?? "");
        const v = validatePassword(a.NewPassword ?? "");
        if (!v.ok) throw new AdError(`The password does not meet the length, complexity, or history requirement of the domain. ${v.reason}`);
        u.accountOptions || (u.accountOptions = {});
        u.accountOptions.mustChange = a.ChangePasswordAtLogon === void 0 ? true : bool(a.ChangePasswordAtLogon);
        u.passwordLastSet = (/* @__PURE__ */ new Date()).toISOString();
        globalThis.CorpDesk?.setLabPassword?.(u.sam, a.NewPassword ?? "");
        log(4724, `${u.sam}: password reset`);
        return "Password reset";
      }
      case "group.addMember":
        ps(`Add-ADGroupMember -Identity ${q(a.Group)} -Members ${q(a.Identity)}`);
        return "Added";
      case "group.removeMember":
        ps(`Remove-ADGroupMember -Identity ${q(a.Group)} -Members ${q(a.Identity)} -Confirm:$false`);
        return "Removed";
      case "group.create": {
        const path = toPath(a.Path) ?? "Users";
        ps(`New-ADGroup -Name ${q((a.Name ?? "").trim())} -GroupScope ${a.GroupScope || "Global"} -GroupCategory ${a.GroupCategory || "Security"} -Path ${q(pathDN(path))}${a.Description ? ` -Description ${q(a.Description)}` : ""}`);
        return `Created ${a.Name}`;
      }
      case "group.update": {
        const g2 = findGroup(a.Identity ?? "");
        if (!g2) throw new AdError(`Cannot find an object with identity: '${a.Identity}'.`);
        const args = [a.Description !== void 0 ? `-Description ${q(a.Description)}` : "", a.GroupScope ? `-GroupScope ${a.GroupScope}` : "", a.GroupCategory ? `-GroupCategory ${a.GroupCategory}` : ""].filter(Boolean);
        if (args.length) ps(`Set-ADGroup -Identity ${q(g2.name)} ${args.join(" ")}`);
        g2.attributes || (g2.attributes = {});
        if (a.ManagedBy !== void 0) g2.managedBy = a.ManagedBy || null;
        if (a.Replace) for (const [k, v] of Object.entries(parsePairs(a.Replace))) {
          if (k.toLowerCase() === "managedby") g2.managedBy = v || null;
          else g2.attributes[k] = v;
        }
        if (a.Clear) for (const k of a.Clear.split(",").map((x) => x.trim())) {
          if (k.toLowerCase() === "managedby") g2.managedBy = null;
          else delete g2.attributes[k];
        }
        return "Updated";
      }
      case "group.delete":
        ps(`Remove-ADGroup -Identity ${q(a.Name ?? a.Identity)} -Confirm:$false`);
        return "Deleted";
      case "ou.create": {
        const parent = toPath(a.Path) ?? "";
        const name = (a.Name ?? "").trim();
        const protect = a.ProtectedFromAccidentalDeletion === void 0 ? true : bool(a.ProtectedFromAccidentalDeletion);
        ps(`New-ADOrganizationalUnit -Name ${q(name)} -Path ${q(pathDN(parent))} -ProtectedFromAccidentalDeletion $${protect}`);
        if (a.Description) {
          const path = parent ? `${parent}/${name}` : name;
          (state.ouMeta || (state.ouMeta = {}))[path] = { ...state.ouMeta[path] || {}, description: a.Description };
        }
        return "Created";
      }
      case "ou.update": {
        const path = toPath(a.Identity);
        if (!path || !state.ous.includes(path)) throw new AdError(`Not an organizational unit: ${a.Identity}`);
        const meta = (_a = state.ouMeta || (state.ouMeta = {}))[path] || (_a[path] = {});
        meta.attrs || (meta.attrs = {});
        if (a.Description !== void 0) meta.description = a.Description;
        for (const k of ["StreetAddress", "City", "State", "PostalCode", "Country", "ManagedBy"]) if (a[k] !== void 0) meta.attrs[k] = a[k];
        let protect = a.ProtectedFromAccidentalDeletion !== void 0 ? bool(a.ProtectedFromAccidentalDeletion) : void 0;
        if (a.Clear) for (const k of a.Clear.split(",").map((x) => x.trim())) {
          if (/protected/i.test(k)) protect = false;
          else delete meta.attrs[k];
        }
        if (protect !== void 0) ps(`Set-ADOrganizationalUnit -Identity ${q(pathDN(path))} -ProtectedFromAccidentalDeletion $${protect}`);
        else log(5136, `${path}: attributes updated`);
        return "Updated";
      }
      case "ou.delete": {
        const path = toPath(a.Name ?? a.Identity);
        if (!path) throw new AdError("An OU is required.");
        ps(`Remove-ADOrganizationalUnit -Identity ${q(pathDN(path))} -Confirm:$false`);
        return "Deleted";
      }
      case "ou.delegate": {
        const tasks = (a.Tasks ?? "").split(/[;,]/).map((t) => t.trim()).filter(Boolean);
        (state.delegations || (state.delegations = [])).push({ ou: toPath(a.Path), trustee: a.Trustee, tasks, at: (/* @__PURE__ */ new Date()).toISOString() });
        log(5136, `${a.Trustee}: control delegated on ${a.Path || DOMAIN2}`);
        return "Delegated";
      }
      case "object.rename": {
        const id = (a.Identity ?? "").replace(/^(user|group|ou):/, "");
        const u = findUser(id);
        if (u) {
          ps(`Rename-ADObject -Identity ${q(userDN(u))} -NewName ${q(a.NewName)}`);
          return "Renamed";
        }
        const g2 = findGroup(id);
        if (g2) {
          ps(`Rename-ADObject -Identity ${q(groupDN(g2))} -NewName ${q(a.NewName)}`);
          return "Renamed";
        }
        const path = toPath(id);
        if (path) {
          ps(`Rename-ADObject -Identity ${q(pathDN(path))} -NewName ${q(a.NewName)}`);
          return "Renamed";
        }
        throw new AdError(`Cannot find an object with identity: '${a.Identity}'.`);
      }
      default:
        throw new AdError(`The operation ${capId} is not available on this domain controller.`);
    }
  }

  // aduc/icons.ts
  var FOLDER_BACK = "#dcae3b";
  var FOLDER_FRONT = "#f4cf5a";
  var FOLDER_EDGE = "#b8892a";
  var folder = (extra = "") => `<path d="M1 4.5h5l1.2-1.5H15v10.5H1z" fill="${FOLDER_BACK}" stroke="${FOLDER_EDGE}" stroke-width=".6"/><path d="M1 6h14v7.5H1z" fill="${FOLDER_FRONT}" stroke="${FOLDER_EDGE}" stroke-width=".6"/>` + extra;
  var ouBook = '<path d="M5.2 7.6l5.6-1.4 1.9 4.2-5.6 1.4z" fill="#9aa3ad" stroke="#5d6670" stroke-width=".5"/><path d="M6 8.1l4.3-1.1 1.3 2.9-4.3 1.1z" fill="#dfe4ea"/>';
  var head = (cx, cy, hair, scale = 1) => `<circle cx="${cx}" cy="${cy}" r="${2.6 * scale}" fill="#f1c9a5" stroke="#b98a64" stroke-width=".5"/><path d="M${cx - 2.7 * scale} ${cy - 0.3 * scale}a${2.7 * scale} ${2.9 * scale} 0 0 1 ${5.4 * scale} 0c-1-1.4-3.6-1.7-5.4 0z" fill="${hair}"/>`;
  var body = (cx, top, color, scale = 1) => `<path d="M${cx - 4.2 * scale} ${top + 5.5 * scale}c0-3.4 1.9-5.3 4.2-5.3s4.2 1.9 4.2 5.3z" fill="${color}" stroke="#1f4f86" stroke-width=".5"/>`;
  var USER = body(8, 9, "#3a7bd5") + head(8, 6, "#5a3a22");
  var GROUP = body(10.6, 9.2, "#3a7bd5", 0.85) + head(10.6, 6.4, "#3b2a1c", 0.85) + body(5.6, 9.6, "#5c9e3f", 0.85) + head(5.6, 6.8, "#7a4b25", 0.85);
  var disabledBadge = '<circle cx="12" cy="12" r="3.4" fill="#fff" stroke="#222" stroke-width=".8"/><path d="M12 9.8v3.6M10.4 11.8l1.6 1.8 1.6-1.8" stroke="#111" stroke-width="1.1" fill="none"/>';
  var star = '<path d="M12.5 .8l.9 2 2.1.2-1.6 1.4.5 2.1-1.9-1.1-1.9 1.1.5-2.1-1.6-1.4 2.1-.2z" fill="#f7c600" stroke="#b58a00" stroke-width=".4"/>';
  var monitor = '<rect x="1.5" y="2.5" width="13" height="9" rx=".8" fill="#e8eef5" stroke="#5c6b7a" stroke-width=".8"/><rect x="3" y="4" width="10" height="6" fill="#4d9be6"/><path d="M6 11.5h4l.8 2H5.2z" fill="#8795a3"/><rect x="4" y="13.3" width="8" height="1.2" fill="#6b7886"/>';
  var tower = (x) => `<rect x="${x}" y="1.5" width="5.4" height="12.5" rx=".6" fill="#c9ced4" stroke="#5f6770" stroke-width=".6"/><rect x="${x + 1}" y="3" width="3.4" height=".9" fill="#6f7a86"/><rect x="${x + 1}" y="4.6" width="3.4" height=".9" fill="#6f7a86"/><circle cx="${x + 2.7}" cy="11.6" r=".7" fill="#46b04a"/>`;
  var SHAPES = {
    // ── directory objects ─────────────────────────────────────────────────
    root: '<rect x="2" y="1.5" width="11" height="13" rx=".8" fill="#f2d27a" stroke="#b8892a" stroke-width=".6"/><rect x="4" y="3" width="7.5" height="10" fill="#fff8e1"/><path d="M5.5 5h4.5M5.5 7h4.5M5.5 9h3" stroke="#8a6d1f" stroke-width=".8"/>',
    domain: tower(1.2) + tower(8.8) + '<path d="M6.6 8h2.2" stroke="#2f6fb5" stroke-width="1"/><path d="M3 15h10" stroke="#2f6fb5" stroke-width="1"/>',
    container: folder(),
    ou: folder(ouBook),
    savedQueries: folder('<circle cx="10.5" cy="10" r="2" fill="none" stroke="#2f6fb5" stroke-width="1"/>'),
    user: USER,
    userDisabled: USER + disabledBadge,
    group: GROUP,
    computer: monitor,
    computerDisabled: monitor + disabledBadge,
    server: tower(5.3),
    contact: '<rect x="2" y="1.5" width="12" height="13" rx="1" fill="#f7f7f7" stroke="#6f7a86" stroke-width=".7"/><path d="M4.5 5h7M4.5 7.5h7M4.5 10h4.5" stroke="#3a9c4a" stroke-width="1.1"/>',
    printer: '<rect x="2" y="6" width="12" height="6" rx="1" fill="#b9c0c8" stroke="#5f6770" stroke-width=".6"/><rect x="4" y="2" width="8" height="4.5" fill="#fff" stroke="#5f6770" stroke-width=".6"/><rect x="4" y="10" width="8" height="4" fill="#fff" stroke="#5f6770" stroke-width=".6"/>',
    // ── toolbar ──────────────────────────────────────────────────────────
    back: '<path d="M14 8H4M8 3.5L3.5 8 8 12.5" stroke="#1f6fd1" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    forward: '<path d="M2 8h10M8 3.5l4.5 4.5L8 12.5" stroke="#1f6fd1" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    up: folder('<path d="M8 13V7.5M5.6 9.6L8 7.2l2.4 2.4" stroke="#1d7a2c" stroke-width="1.5" fill="none"/>'),
    tree: '<rect x="1.5" y="2" width="13" height="12" fill="#fff" stroke="#5f6770" stroke-width=".8"/><rect x="1.5" y="2" width="13" height="2.2" fill="#3a7bd5"/><path d="M6 4.2V14" stroke="#5f6770" stroke-width=".8"/><path d="M2.8 6.5h2M2.8 8.5h2M2.8 10.5h2" stroke="#9aa3ad" stroke-width=".8"/>',
    properties: '<rect x="2.5" y="1.5" width="10" height="13" fill="#fff" stroke="#5f6770" stroke-width=".7"/><path d="M4.5 4.5h6M4.5 6.5h6M4.5 8.5h4" stroke="#7a8591" stroke-width=".8"/><path d="M9.5 10.5l2.8-2.2 1.5 1.5-2.4 2.9-2.3.4z" fill="#e8b93a" stroke="#8a6d1f" stroke-width=".5"/>',
    refresh: '<path d="M13 7.2A5 5 0 0 0 4.1 4.6" stroke="#2c9a3c" stroke-width="1.8" fill="none"/><path d="M3 1.8v3.6h3.6z" fill="#2c9a3c"/><path d="M3 8.8a5 5 0 0 0 8.9 2.6" stroke="#2c9a3c" stroke-width="1.8" fill="none"/><path d="M13 14.2v-3.6H9.4z" fill="#2c9a3c"/>',
    export: '<rect x="1.5" y="1.5" width="9" height="12" fill="#fff" stroke="#5f6770" stroke-width=".7"/><path d="M3.5 4.5h5M3.5 6.5h5M3.5 8.5h3" stroke="#7a8591" stroke-width=".8"/><path d="M8 11h6M11.5 8.5L14 11l-2.5 2.5" stroke="#1f6fd1" stroke-width="1.5" fill="none"/>',
    help: '<circle cx="8" cy="8" r="6.5" fill="#1f6fd1"/><path d="M6 6.2a2 2 0 1 1 2.7 1.9c-.5.2-.7.6-.7 1.1v.6" stroke="#fff" stroke-width="1.4" fill="none"/><circle cx="8" cy="11.7" r=".9" fill="#fff"/>',
    newUser: USER + star,
    newGroup: GROUP + star,
    newOu: folder(ouBook) + star,
    filter: '<path d="M1.5 2h13l-5 6v5.5l-3 1.5V8z" fill="#8fb8ea" stroke="#1f5fa8" stroke-width=".8"/>',
    find: folder('<circle cx="9.3" cy="9.3" r="2.6" fill="#e3f0ff" stroke="#1f5fa8" stroke-width="1"/><path d="M11.2 11.2l2.6 2.6" stroke="#1f5fa8" stroke-width="1.6"/>'),
    addToGroup: GROUP + '<path d="M12.5 1v5M10 3.5h5" stroke="#1d7a2c" stroke-width="1.6"/>',
    delete: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="#d13438" stroke-width="2.2" stroke-linecap="round"/>',
    cut: '<circle cx="4.5" cy="12" r="2" fill="none" stroke="#333" stroke-width="1"/><circle cx="11.5" cy="12" r="2" fill="none" stroke="#333" stroke-width="1"/><path d="M5.8 10.5L11 2M10.2 10.5L5 2" stroke="#333" stroke-width="1"/>',
    info: '<circle cx="8" cy="8" r="7" fill="#1f6fd1"/><rect x="7.1" y="6.6" width="1.8" height="5.4" fill="#fff"/><circle cx="8" cy="4.5" r="1.1" fill="#fff"/>',
    warning: '<path d="M8 1.2L15.2 14H.8z" fill="#f7c600" stroke="#a37e00" stroke-width=".6"/><rect x="7.2" y="5.2" width="1.6" height="5" fill="#222"/><circle cx="8" cy="11.9" r=".95" fill="#222"/>',
    error: '<circle cx="8" cy="8" r="7" fill="#d13438"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.7"/>',
    question: '<circle cx="8" cy="8" r="7" fill="#1f6fd1"/><path d="M6 6.2a2 2 0 1 1 2.7 1.9c-.5.2-.7.6-.7 1.1v.6" stroke="#fff" stroke-width="1.4" fill="none"/><circle cx="8" cy="11.7" r=".9" fill="#fff"/>',
    flashlight: '<path d="M2 11l5-5 3 3-5 5z" fill="#f2c94c" stroke="#8a6d1f" stroke-width=".6"/><path d="M7 6l3-3 3 3-3 3z" fill="#d7dde3" stroke="#5f6770" stroke-width=".6"/><path d="M12 1.5l2.5-1M14.5 3.5l1.2-.3M13.5 .3l.2-1" stroke="#e8b93a" stroke-width=".8"/>'
  };
  var cache = /* @__PURE__ */ new Map();
  function uri(name) {
    let u = cache.get(name);
    if (!u) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${SHAPES[name]}</svg>`;
      u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      cache.set(name, u);
    }
    return u;
  }
  function icon(name, size = 16) {
    const img = document.createElement("img");
    img.src = uri(name);
    img.width = size;
    img.height = size;
    img.alt = "";
    img.draggable = false;
    img.style.cssText = `width:${size}px;height:${size}px;flex-shrink:0;display:inline-block;vertical-align:middle;`;
    return img;
  }

  // aduc/ui.ts
  var STYLE_ID = "aduc-styles";
  var CSS = `
.ad-root, .ad-dlg, .ad-menu {
  font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; color: #000;
  -webkit-font-smoothing: antialiased; user-select: none;
  /* Native checkboxes, radios and selects draw light, as on the server,
     whatever scheme the workstation theme sets. */
  color-scheme: light;
}
.ad-root { background: #fff; }
.ad-root *, .ad-dlg *, .ad-menu * { box-sizing: border-box; }
.ad-root ::-webkit-scrollbar, .ad-dlg ::-webkit-scrollbar { width: 17px; height: 17px; }
.ad-root ::-webkit-scrollbar-track, .ad-dlg ::-webkit-scrollbar-track { background: #f0f0f0; }
.ad-root ::-webkit-scrollbar-thumb, .ad-dlg ::-webkit-scrollbar-thumb {
  background: #cdcdcd; border: 4px solid #f0f0f0; border-radius: 0;
}
.ad-root ::-webkit-scrollbar-thumb:hover, .ad-dlg ::-webkit-scrollbar-thumb:hover { background: #a6a6a6; }

/* menu bar */
.ad-menubar { display: flex; background: #fff; padding: 1px 2px; border-bottom: 1px solid #f0f0f0; }
.ad-menubar > span { padding: 2px 7px; border: 1px solid transparent; cursor: default; }
.ad-menubar > span:hover, .ad-menubar > span.open { background: #e5f3ff; border-color: #cce8ff; }

/* toolbar */
.ad-toolbar { display: flex; align-items: center; gap: 1px; padding: 2px 4px; background: #fff;
  border-bottom: 1px solid #d9d9d9; }
.ad-tb { width: 24px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; background: transparent; padding: 0; cursor: default; }
.ad-tb:hover:not(:disabled) { background: #e5f3ff; border-color: #cce8ff; }
.ad-tb:active:not(:disabled) { background: #cce8ff; border-color: #99d1ff; }
.ad-tb:disabled img { opacity: .35; filter: grayscale(1); }
.ad-tb.on { background: #cce8ff; border-color: #99d1ff; }
.ad-tbsep { width: 1px; height: 18px; background: #d9d9d9; margin: 0 4px; }

/* panes */
.ad-panes { flex: 1; display: flex; min-height: 0; background: #fff; }
.ad-tree { overflow: auto; background: #fff; border-right: 1px solid #d9d9d9; padding: 2px 0; outline: none; }
.ad-splitter { width: 4px; cursor: col-resize; background: #f0f0f0; flex-shrink: 0; }
.ad-list { flex: 1; min-width: 0; overflow: auto; background: #fff; outline: none; position: relative; }
.ad-trow { display: flex; align-items: center; height: 20px; white-space: nowrap; cursor: default; padding-right: 8px; }
.ad-trow .ad-twisty { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center;
  color: #6b6b6b; font-size: 10px; flex-shrink: 0; }
.ad-chev { width: 6px; height: 6px; border-right: 1.3px solid #7a7a7a; border-bottom: 1.3px solid #7a7a7a;
  transform: rotate(-45deg); margin-left: -2px; }
.ad-chev.open { transform: rotate(45deg); margin: -3px 0 0 0; border-color: #404040; }
.ad-trow .ad-twisty:hover .ad-chev { border-color: #1c97ea; }
.ad-trow .ad-tlabel { padding: 1px 3px; border: 1px solid transparent; margin-left: 3px; }
.ad-trow:hover .ad-tlabel { background: #e5f3ff; }
.ad-trow.sel .ad-tlabel { background: #d9d9d9; }
.ad-tree:focus .ad-trow.sel .ad-tlabel { background: #cce8ff; border-color: #99d1ff; }
.ad-trow.cut { opacity: .5; }

/* details view */
.ad-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.ad-table th { position: sticky; top: 0; z-index: 1; background: #fff; font-weight: 400; text-align: left;
  padding: 3px 6px 4px; border-right: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; color: #4c607a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
.ad-table th:hover { background: #d9ebf9; }
.ad-table th .ad-grip { position: absolute; right: -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; }
.ad-table td { padding: 1px 6px; height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-table td { vertical-align: middle; line-height: 18px; }
.ad-namecell { display: flex; align-items: center; gap: 4px; min-width: 0; }
.ad-namecell img { flex: none; }
.ad-namecell span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ad-table th.ad-fill { cursor: default; border-right: 0; }
.ad-table th.ad-fill:hover { background: #fff; }
.ad-table tr.row:hover td { background: #e5f3ff; }
.ad-table tr.row.sel td { background: #d9d9d9; }
.ad-list:focus .ad-table tr.row.sel td { background: #cce8ff; }
.ad-table tr.row.cut td { opacity: .5; }
.ad-icons { display: flex; flex-wrap: wrap; align-content: flex-start; padding: 4px; gap: 2px; }
.ad-icons.list { flex-direction: column; flex-wrap: wrap; height: 100%; }
.ad-icon-item { display: flex; align-items: center; gap: 4px; padding: 2px 4px; border: 1px solid transparent; cursor: default; }
.ad-icons.large .ad-icon-item { flex-direction: column; width: 76px; text-align: center; padding: 4px 2px; }
.ad-icon-item:hover { background: #e5f3ff; }
.ad-icon-item.sel { background: #d9d9d9; }
.ad-list:focus .ad-icon-item.sel { background: #cce8ff; border-color: #99d1ff; }
.ad-empty { padding: 10px 14px; color: #000; }

.ad-status { display: flex; height: 22px; align-items: center; background: #f0f0f0; border-top: 1px solid #d9d9d9;
  padding: 0 6px; color: #000; white-space: nowrap; overflow: hidden; }

/* menus */
.ad-menu { position: fixed; background: #f2f2f2; border: 1px solid #cccccc; padding: 2px;
  box-shadow: 2px 2px 3px rgba(0,0,0,.28); min-width: 180px; z-index: 2147483000; }
.ad-mi { display: flex; align-items: center; height: 22px; padding: 0 22px 0 28px; position: relative;
  white-space: nowrap; cursor: default; border: 1px solid transparent; }
.ad-mi:hover:not(.dis), .ad-mi.hot { background: #91c9f7; border-color: #91c9f7; }
.ad-mi.dis { color: #6d6d6d; }
.ad-mi.bold { font-weight: 700; }
.ad-mi .chk { position: absolute; left: 8px; font-size: 11px; }
.ad-mi .sub { position: absolute; right: 7px; font-size: 10px; }
.ad-msep { height: 1px; background: #d7d7d7; margin: 3px 2px 3px 28px; }

/* dialogs */
.ad-dlg { position: fixed; background: #f0f0f0; border: 1px solid #7a7a7a;
  box-shadow: 0 6px 22px rgba(0,0,0,.33); display: flex; flex-direction: column; }
.ad-dlg.active { border-color: #1883d7; }
.ad-dlg-title { height: 30px; display: flex; align-items: center; background: #fff; padding-left: 8px;
  gap: 6px; flex-shrink: 0; cursor: default; }
.ad-dlg-title .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ad-dlg-x { width: 46px; height: 30px; border: none; background: transparent; font-size: 16px; line-height: 1; cursor: default; }
.ad-dlg-x:hover { background: #e81123; color: #fff; }
.ad-dlg-body { flex: 1; padding: 10px 11px; overflow: auto; min-height: 0; }
.ad-dlg-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 0 11px 11px; flex-shrink: 0; }
.ad-modal-shield { position: fixed; inset: 0; background: transparent; }

.ad-root ::selection, .ad-dlg ::selection { background: #0078d7; color: #fff; }
.ad-btn { min-width: 75px; height: 23px; padding: 0 10px; white-space: nowrap; background: #e1e1e1; border: 1px solid #adadad;
  font: inherit; color: #000; cursor: default; }
.ad-btn:hover:not(:disabled) { background: #e5f1fb; border-color: #0078d7; }
.ad-btn:active:not(:disabled) { background: #cce4f7; border-color: #005499; }
.ad-btn.default { border: 1px solid #0078d7; box-shadow: inset 0 0 0 1px #0078d7; }
.ad-btn:disabled { background: #cccccc; border-color: #bfbfbf; color: #838383; }
.ad-btn:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }

.ad-dlg input[type=text], .ad-dlg input[type=password], .ad-dlg input[type=date], .ad-dlg select, .ad-dlg textarea,
.ad-root input[type=text] {
  height: 23px; border: 1px solid #7a7a7a; background: #fff; padding: 1px 4px; font: inherit; color: #000;
  outline: none; user-select: text; min-width: 0;
}
.ad-dlg textarea { height: auto; resize: none; padding: 3px 4px; }
.ad-dlg input:hover:not(:disabled), .ad-dlg select:hover:not(:disabled), .ad-dlg textarea:hover:not(:disabled) { border-color: #171717; }
.ad-dlg input[type=text]:focus, .ad-dlg input[type=password]:focus, .ad-dlg input[type=date]:focus,
.ad-dlg select:focus, .ad-dlg textarea:focus, .ad-root input[type=text]:focus {
  border-color: #0078d7 !important; outline: 1px solid #0078d7 !important; outline-offset: -2px !important;
}
.ad-dlg input:disabled, .ad-dlg select:disabled, .ad-dlg textarea:disabled, .ad-dlg input[readonly] {
  background: #f0f0f0; border-color: #cccccc; color: #6d6d6d;
}
.ad-dlg input[readonly].ad-plain { background: transparent; border-color: transparent; color: #000; }
.ad-dlg label { cursor: default; }
.ad-chk { display: flex; align-items: center; gap: 5px; min-height: 20px; }
.ad-chk input { margin: 0; width: 13px; height: 13px; accent-color: #0078d7; }
.ad-chk.dis { color: #6d6d6d; }
.ad-fs { border: 1px solid #dcdcdc; padding: 6px 9px 8px; margin: 0; }
.ad-fs legend { padding: 0 3px; }
.ad-hr { height: 0; border-top: 1px solid #a0a0a0; border-bottom: 1px solid #fff; margin: 10px 0; }
.ad-grid { display: grid; column-gap: 8px; row-gap: 7px; align-items: center; }
.ad-link { color: #0066cc; text-decoration: underline; cursor: pointer; }
.ad-note { color: #000; line-height: 1.45; }

/* property-sheet tabs */
.ad-tabs { position: relative; }
.ad-tabrow { display: flex; margin-bottom: -1px; position: relative; }
.ad-tab { flex: 1 1 auto; padding: 2px 6px 3px; border: 1px solid #d9d9d9; border-bottom: none; background: #f0f0f0;
  text-align: center; white-space: nowrap; cursor: default; margin-right: -1px; }
.ad-tab:hover { background: #d8eaf9; }
.ad-tab.sel { background: #fff; position: relative; z-index: 2; padding-bottom: 5px; margin-top: -2px; }
.ad-tabpanel { background: #fff; border: 1px solid #d9d9d9; padding: 10px 11px; position: relative; z-index: 1; }

/* list boxes inside dialogs */
.ad-lb { background: #fff; border: 1px solid #828790; overflow: auto; outline: none; }
.ad-lb table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.ad-lb th { background: #fff; font-weight: 400; text-align: left; padding: 3px 6px; border-right: 1px solid #e5e5e5;
  border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-lb td { padding: 1px 6px; height: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-lb tr.row:hover td { background: #e5f3ff; }
.ad-lb tr.row.sel td { background: #d9d9d9; }
.ad-lb:focus tr.row.sel td { background: #cce8ff; }
.ad-lb .ad-lbline { display: flex; align-items: center; gap: 5px; }

/* wizard */
.ad-wiz-head { background: #fff; margin: -10px -11px 10px; padding: 12px 16px; border-bottom: 1px solid #a0a0a0; }
.ad-wiz-head b { display: block; margin-bottom: 3px; }
.ad-wiz-side { background: linear-gradient(#1b5aa6, #3d86d6); }
.ad-createin { display: flex; align-items: center; gap: 22px; padding: 4px 4px 12px; border-bottom: 1px solid #a0a0a0;
  margin-bottom: 14px; }
.ad-logon-grid { display: grid; grid-template-columns: 7px repeat(24, 1fr); gap: 1px; }
.ad-hour { height: 18px; background: #fff; border: 1px solid #b5b5b5; }
.ad-hour.on { background: #1f5fbf; border-color: #1f5fbf; }
`;
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== void 0) e.textContent = text;
    return e;
  }
  function textbox(value = "", opts = {}) {
    const i = document.createElement("input");
    i.type = opts.type ?? "text";
    i.value = value;
    i.spellcheck = false;
    i.autocomplete = "off";
    if (opts.width) i.style.width = opts.width;
    if (opts.disabled) i.disabled = true;
    if (opts.readOnly) i.readOnly = true;
    return i;
  }
  function button(label, onClick, opts = {}) {
    const b = el("button", "ad-btn" + (opts.primary ? " default" : ""), label);
    b.type = "button";
    if (opts.disabled) b.disabled = true;
    if (opts.width) b.style.width = opts.width;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      if (!b.disabled) onClick();
    });
    return b;
  }
  var uid = 0;
  var nextId = () => `ad-${++uid}`;
  function checkbox(label, checked = false, onChange) {
    const row = el("div", "ad-chk");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = nextId();
    input.checked = checked;
    const lab = el("label", void 0, label);
    lab.htmlFor = input.id;
    row.append(input, lab);
    if (onChange) input.addEventListener("change", () => onChange(input.checked));
    return {
      el: row,
      input,
      get checked() {
        return input.checked;
      },
      set checked(v) {
        input.checked = v;
      },
      setDisabled(v) {
        input.disabled = v;
        row.classList.toggle("dis", v);
      }
    };
  }
  function radio(name, label, checked = false, onChange) {
    const c = checkbox(label, checked);
    c.input.type = "radio";
    c.input.name = name;
    if (onChange) c.input.addEventListener("change", () => c.input.checked && onChange());
    return c;
  }
  function select(options, value, width) {
    const s = document.createElement("select");
    for (const o of options) s.appendChild(new Option(o, o));
    if (value !== void 0) s.value = value;
    if (width) s.style.width = width;
    return s;
  }
  function fieldset(legend) {
    const f = el("fieldset", "ad-fs");
    f.appendChild(el("legend", void 0, legend));
    return f;
  }
  function hr() {
    return el("div", "ad-hr");
  }
  function grid(cols, ...cells) {
    const g2 = el("div", "ad-grid");
    g2.style.gridTemplateColumns = cols;
    for (const c of cells) g2.appendChild(typeof c === "string" ? el("label", void 0, c) : c);
    return g2;
  }
  function headerStrip(iconName, text, label) {
    const h = el("div", "ad-createin");
    h.appendChild(icon(iconName, 32));
    if (label) {
      const l = el("span", void 0, label);
      const v = el("span", void 0, text);
      const wrap = el("div");
      wrap.style.cssText = "display:flex;gap:18px;";
      wrap.append(l, v);
      h.appendChild(wrap);
    } else {
      h.appendChild(el("span", void 0, text));
    }
    return h;
  }
  var zTop = 1e5;
  var openDialogs = /* @__PURE__ */ new Set();
  var ownerOf = /* @__PURE__ */ new WeakMap();
  function closeDialogsOf(owner) {
    for (const d of [...openDialogs]) if (ownerOf.get(d) === owner) d.close();
  }
  function openDialog(opts) {
    ensureStyles();
    const shield = opts.modal ? el("div", "ad-modal-shield") : null;
    const root = el("div", "ad-dlg active");
    root.setAttribute("role", "dialog");
    root.style.width = `${opts.width}px`;
    if (opts.height) root.style.height = `${opts.height}px`;
    root.style.maxHeight = "calc(100vh - 20px)";
    const title = el("div", "ad-dlg-title");
    if (opts.iconName) title.appendChild(icon(opts.iconName, 16));
    const t = el("span", "t", opts.title);
    const x = el("button", "ad-dlg-x", "✕");
    x.type = "button";
    x.title = "Close";
    title.append(t, x);
    const body2 = el("div", "ad-dlg-body");
    const foot = el("div", "ad-dlg-foot");
    root.append(title, body2, foot);
    const bring = () => {
      zTop += 2;
      if (shield) shield.style.zIndex = String(zTop - 1);
      root.style.zIndex = String(zTop);
      document.querySelectorAll(".ad-dlg.active").forEach((d) => d.classList.remove("active"));
      root.classList.add("active");
    };
    const dlg = {
      root,
      body: body2,
      foot,
      buttons: [],
      close() {
        if (!root.isConnected) return;
        root.remove();
        shield?.remove();
        openDialogs.delete(dlg);
        dlg.onClose?.();
      },
      setTitle(s) {
        t.textContent = s;
      }
    };
    openDialogs.add(dlg);
    if (opts.owner) ownerOf.set(dlg, opts.owner);
    const cancel = () => {
      const c = (opts.buttons ?? []).find((b) => b.cancel);
      if (c?.onClick && c.onClick() === false) return;
      dlg.close();
    };
    x.addEventListener("click", cancel);
    for (const spec of opts.buttons ?? []) {
      const b = button(
        spec.label,
        () => {
          if (spec.cancel) return cancel();
          if (spec.onClick && spec.onClick() === false) return;
          if (spec.label !== "Apply") dlg.close();
        },
        { primary: spec.primary, disabled: spec.disabled, width: spec.width }
      );
      dlg.buttons.push(b);
      foot.appendChild(b);
    }
    if (!foot.childElementCount) foot.style.display = "none";
    root.addEventListener("keydown", (e) => {
      const target = e.target;
      if (e.key === "Enter" && target?.tagName !== "TEXTAREA" && target?.tagName !== "BUTTON") {
        const def = dlg.buttons.find((b) => b.classList.contains("default") && !b.disabled);
        if (def) {
          e.preventDefault();
          def.click();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    });
    title.addEventListener("mousedown", (e) => {
      if (e.target === x) return;
      const r = root.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev) => {
        root.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dx))}px`;
        root.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - dy))}px`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      e.preventDefault();
    });
    root.addEventListener("mousedown", bring, true);
    shield?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      root.animate?.([{ borderColor: "#1883d7" }, { borderColor: "#7a7a7a" }, { borderColor: "#1883d7" }], { duration: 240, iterations: 2 });
      focusFirstField(root);
    });
    if (shield) document.body.appendChild(shield);
    document.body.appendChild(root);
    bring();
    const n = openDialogs.size - 1;
    const w = root.offsetWidth || opts.width;
    const h = root.offsetHeight || opts.height || 300;
    root.style.left = `${Math.max(8, (window.innerWidth - w) / 2 + n % 6 * 22)}px`;
    root.style.top = `${Math.max(8, (window.innerHeight - h) / 2 + n % 6 * 22)}px`;
    queueMicrotask(() => focusFirstField(root));
    return dlg;
  }
  function focusFirstField(scope) {
    const first = scope.querySelector(
      "input[type=text]:not(:disabled):not([readonly]), input[type=password]:not(:disabled), textarea:not(:disabled), select:not(:disabled)"
    );
    const target = first ?? scope.querySelector(".ad-btn.default:not(:disabled)");
    if (!target) return;
    target.focus();
    if (target instanceof HTMLInputElement && target.value) target.select();
  }
  function messageBox(text, opts = {}) {
    const kind = opts.kind ?? "info";
    const buttons = opts.yesNo ? [
      { label: "Yes", primary: true, onClick: () => void opts.onYes?.() },
      { label: "No", cancel: true, onClick: () => void opts.onNo?.() }
    ] : [{ label: "OK", primary: true, cancel: true }];
    const d = openDialog({ title: opts.title ?? "Active Directory Domain Services", width: 420, modal: true, buttons });
    const row = el("div");
    row.style.cssText = "display:flex;gap:14px;align-items:flex-start;padding:10px 6px 14px;";
    const ic = icon(kind, 32);
    const p = el("div", "ad-note", text);
    p.style.cssText = "white-space:pre-wrap;padding-top:6px;user-select:text;";
    row.append(ic, p);
    d.body.style.background = "#fff";
    d.body.appendChild(row);
    d.foot.style.cssText += "padding-top:11px;";
    queueMicrotask(() => d.buttons[0]?.focus());
    return d;
  }
  var menuHint = null;
  function setMenuHintSink(fn) {
    menuHint = fn;
  }
  function closeMenus() {
    document.querySelectorAll(".ad-menu").forEach((m) => m.remove());
    menuHint?.(null);
  }
  function openMenu(x, y, items, level = 0, onClosed) {
    ensureStyles();
    if (level === 0) closeMenus();
    const menu = el("div", "ad-menu");
    menu.dataset.level = String(level);
    menu.setAttribute("role", "menu");
    let openSub = null;
    let subTimer = 0;
    const closeSub = () => {
      if (openSub) {
        document.querySelectorAll(".ad-menu").forEach((m) => {
          if (Number(m.dataset.level) > level) m.remove();
        });
        openSub = null;
      }
    };
    for (const item of items) {
      if ("separator" in item) {
        menu.appendChild(el("div", "ad-msep"));
        continue;
      }
      const row = el("div", "ad-mi" + (item.disabled ? " dis" : "") + (item.bold ? " bold" : ""));
      row.setAttribute("role", "menuitem");
      if (item.checked) row.appendChild(el("span", "chk", item.radio ? "●" : "✔"));
      row.appendChild(el("span", void 0, item.label));
      if (item.submenu) row.appendChild(el("span", "sub", "▶"));
      const showSub = () => {
        if (!item.submenu || item.disabled) return;
        closeSub();
        const r2 = row.getBoundingClientRect();
        openSub = openMenu(r2.right - 3, r2.top - 3, item.submenu, level + 1);
        row.classList.add("hot");
      };
      row.addEventListener("mouseenter", () => {
        menu.querySelectorAll(".ad-mi.hot").forEach((m) => m.classList.remove("hot"));
        menuHint?.(item.hint ?? null);
        window.clearTimeout(subTimer);
        if (item.submenu) subTimer = window.setTimeout(showSub, 220);
        else subTimer = window.setTimeout(closeSub, 220);
      });
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.disabled) return;
        if (item.submenu) {
          showSub();
          return;
        }
        closeMenus();
        onClosed?.();
        item.onClick?.();
      });
      menu.appendChild(row);
    }
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = `${Math.max(0, level ? x - r.width - 180 : window.innerWidth - r.width - 2)}px`;
    if (r.bottom > window.innerHeight) menu.style.top = `${Math.max(0, window.innerHeight - r.height - 2)}px`;
    if (level === 0) {
      const away = (ev) => {
        if (ev.target?.closest?.(".ad-menu")) return;
        closeMenus();
        onClosed?.();
        document.removeEventListener("mousedown", away, true);
        document.removeEventListener("keydown", esc, true);
      };
      const esc = (ev) => {
        if (ev.key !== "Escape") return;
        ev.stopPropagation();
        closeMenus();
        onClosed?.();
        document.removeEventListener("mousedown", away, true);
        document.removeEventListener("keydown", esc, true);
      };
      setTimeout(() => {
        document.addEventListener("mousedown", away, true);
        document.addEventListener("keydown", esc, true);
      }, 0);
    }
    return menu;
  }
  function propertySheet(parent, rows, initial) {
    const tabsEl = el("div", "ad-tabs");
    const panel = el("div", "ad-tabpanel");
    panel.style.height = "100%";
    const built = /* @__PURE__ */ new Map();
    let order = rows.map((r) => r);
    let active = initial;
    const paint = () => {
      const idx = order.findIndex((r) => r.some((t) => t.label === active));
      if (idx >= 0 && idx !== order.length - 1) {
        const front = order[idx];
        order = [...order.slice(0, idx), ...order.slice(idx + 1), front];
      }
      tabsEl.textContent = "";
      for (const row of order) {
        const r = el("div", "ad-tabrow");
        for (const tab of row) {
          const t = el("div", "ad-tab" + (tab.label === active ? " sel" : ""), tab.label);
          t.addEventListener("mousedown", (e) => {
            e.preventDefault();
            select2(tab.label);
          });
          r.appendChild(t);
        }
        tabsEl.appendChild(r);
      }
      for (const [label, page] of built) page.style.display = label === active ? "" : "none";
      if (!built.has(active)) {
        const page = el("div");
        page.style.height = "100%";
        const spec = rows.flat().find((t) => t.label === active);
        spec?.build(page);
        built.set(active, page);
        panel.appendChild(page);
      }
    };
    const select2 = (label) => {
      active = label;
      paint();
    };
    const wrap = el("div");
    wrap.style.cssText = "display:flex;flex-direction:column;height:100%;";
    wrap.append(tabsEl, panel);
    parent.appendChild(wrap);
    paint();
    return { select: select2 };
  }
  function listBox(columns, opts) {
    const box = el("div", "ad-lb");
    box.tabIndex = 0;
    box.style.height = opts.height;
    const table = el("table");
    const thead = el("thead");
    const hr_ = el("tr");
    for (const c of columns) {
      const th = el("th", void 0, c.label);
      if (c.width) th.style.width = c.width;
      hr_.appendChild(th);
    }
    thead.appendChild(hr_);
    const tbody = el("tbody");
    table.append(thead, tbody);
    box.appendChild(table);
    let rows = [];
    const sel = /* @__PURE__ */ new Set();
    const api = {
      el: box,
      setRows(r) {
        rows = r;
        sel.clear();
        paint();
        api.onSelect?.([]);
      },
      selected: () => [...sel].sort((a, b) => a - b).map((i) => rows[i])
    };
    const paint = () => {
      tbody.textContent = "";
      rows.forEach((row, i) => {
        const tr = el("tr", "row" + (sel.has(i) ? " sel" : ""));
        columns.forEach((c, ci) => {
          const td = el("td");
          if (ci === 0 && c.iconOf) {
            const line = el("div", "ad-lbline");
            line.append(icon(c.iconOf(row)), el("span", void 0, c.render(row)));
            td.appendChild(line);
          } else {
            td.textContent = c.render(row);
          }
          td.title = c.render(row);
          tr.appendChild(td);
        });
        tr.addEventListener("mousedown", (e) => {
          if (opts.multi && (e.ctrlKey || e.metaKey)) {
            if (sel.has(i)) sel.delete(i);
            else sel.add(i);
          } else if (!(e.button === 2 && sel.has(i))) {
            sel.clear();
            sel.add(i);
          }
          paint();
          api.onSelect?.(api.selected());
        });
        tr.addEventListener("dblclick", () => opts.onOpen?.(row));
        tr.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          opts.onContext?.(row, e);
        });
        tbody.appendChild(tr);
      });
    };
    return api;
  }

  // aduc/context.ts
  function makeRunner(conductor, refresh) {
    return (capId, args, opts = {}) => {
      try {
        const message = runCapability(conductor.world(), capId, args);
        conductor.changed();
        refresh();
        return { ok: true, message };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        conductor.changed();
        if (!opts.quiet) messageBox(error, { kind: "error" });
        return { ok: false, message: error };
      }
    };
  }

  // aduc/pickers.ts
  var typeLabel = (kinds) => {
    const parts = [];
    if (kinds.includes("user")) parts.push("Users");
    if (kinds.includes("group")) parts.push("Groups");
    if (kinds.length === 1 && kinds[0] === "group") return "Groups or Built-in security principals";
    return `${parts.join(", ")}, or Built-in security principals`;
  };
  function candidates(aduc, kinds, scope) {
    const dir = aduc.dir;
    const inScope = (home) => {
      if (scope === "domain") return true;
      for (let k = home; k; ) {
        if (k === scope) return true;
        if (!k.startsWith("ou:")) return false;
        const parent = dir.getOu(k.slice(3))?.parentId;
        k = parent ? `ou:${parent}` : void 0;
      }
      return false;
    };
    const out = [];
    if (kinds.includes("user")) out.push(...dir.listUsers().filter((u) => inScope(homeOf(u))).map(userRow));
    if (kinds.includes("group")) {
      out.push(...dir.listGroups().filter((g2) => inScope(homeOf(g2))).map(groupRow));
      if (scope === "domain" || scope === "c:users" || scope === "c:builtin") {
        const real = new Set(dir.listGroups().map((g2) => g2.name.toLowerCase()));
        for (const b of BUILTIN_OBJECTS) {
          if (b.kind !== "group" || real.has(b.name.toLowerCase())) continue;
          if (scope !== "domain" && `c:${b.container}` !== scope) continue;
          out.push({ key: `b:${b.name}`, kind: "builtin-group", name: b.name, type: "Group", description: b.description, icon: "group", builtin: b });
        }
      }
    }
    return out;
  }
  function matches(o, q2, exact) {
    const names = [o.name, o.user?.username, o.user?.email, o.user ? o.user.upn ?? `${o.user.username}@${DOMAIN}` : void 0].filter((s) => !!s).map((s) => s.toLowerCase());
    const want = q2.toLowerCase();
    return exact ? names.includes(want) : names.some((n) => n.startsWith(want));
  }
  var display = (o) => o.user ? `${o.name} (${o.user.upn ?? `${o.user.username}@${DOMAIN}`})` : o.name;
  function selectObjects(aduc, opts) {
    let kinds = [...opts.kinds];
    let scope = "domain";
    let resolved = null;
    const d = openDialog({ title: opts.title, width: 470, modal: true, owner: aduc.owner });
    const b = d.body;
    b.style.cssText += "display:flex;flex-direction:column;gap:4px;";
    const typeBox = textbox(typeLabel(kinds), { readOnly: true });
    typeBox.style.flex = "1";
    const locBox = textbox(DOMAIN, { readOnly: true });
    locBox.style.flex = "1";
    const names = document.createElement("textarea");
    names.rows = 4;
    names.style.cssText = "flex:1;height:78px;";
    names.spellcheck = false;
    const line = (...c) => {
      const r = el("div");
      r.style.cssText = "display:flex;gap:10px;align-items:flex-start;";
      r.append(...c);
      return r;
    };
    const objTypesBtn = button("Object Types...", () => {
      const t = openDialog({ title: "Object Types", width: 340, modal: true, owner: aduc.owner });
      t.body.appendChild(el("div", void 0, "Select the types of objects you want to find."));
      const box = el("div", "ad-lb");
      box.style.cssText += "height:120px;padding:4px;margin-top:6px;";
      const u = checkbox("Users", kinds.includes("user"));
      const g2 = checkbox("Groups", kinds.includes("group"));
      const bsp = checkbox("Built-in security principals", true);
      bsp.setDisabled(true);
      if (!opts.kinds.includes("user")) u.setDisabled(true);
      if (!opts.kinds.includes("group")) g2.setDisabled(true);
      box.append(bsp.el, g2.el, u.el);
      t.body.appendChild(box);
      const ok = button("OK", () => {
        const next = [];
        if (u.checked && opts.kinds.includes("user")) next.push("user");
        if (g2.checked && opts.kinds.includes("group")) next.push("group");
        if (next.length) {
          kinds = next;
          typeBox.value = typeLabel(kinds);
        }
        t.close();
      }, { primary: true });
      t.foot.style.display = "flex";
      t.foot.append(ok, button("Cancel", () => t.close()));
      t.buttons.push(ok);
    }, { width: "110px" });
    const locBtn = button("Locations...", () => {
      browseContainer(aduc, {
        title: "Locations",
        prompt: "Select the location you want to search.",
        allowDomain: true,
        onOk: (key) => {
          scope = key;
          locBox.value = key === "domain" ? DOMAIN : key.startsWith("ou:") ? `${DOMAIN}/${aduc.dir.ouPath(key.slice(3))}` : `${DOMAIN}/${CONTAINERS.find((c) => `c:${c.id}` === key)?.name ?? ""}`;
        }
      });
    }, { width: "110px" });
    const checkBtn = button("Check Names", () => void checkNames(), { width: "110px" });
    checkBtn.disabled = true;
    b.append(
      el("label", void 0, "Select this object type:"),
      line(typeBox, objTypesBtn),
      el("label", void 0, "From this location:"),
      line(locBox, locBtn)
    );
    const ex = el("div");
    ex.appendChild(document.createTextNode("Enter the object name" + (opts.multi === false ? "" : "s") + " to select ("));
    const exLink = el("span", "ad-link", "examples");
    exLink.addEventListener(
      "click",
      () => messageBox(
        "Examples:\n\nDisplayName		FirstName LastName\nObjectName		User1; Group2\nUserName		logon1\nObjectName@Domain	user1@" + DOMAIN + "\n\nPart of a name also works: type the start of it and click Check Names.",
        { title: "Examples", kind: "info" }
      )
    );
    ex.append(exLink, document.createTextNode("):"));
    b.append(ex, line(names, checkBtn));
    names.addEventListener("input", () => {
      resolved = null;
      names.style.textDecoration = "";
      checkBtn.disabled = !names.value.trim();
      okBtn.disabled = !names.value.trim();
    });
    const checkNames = async () => {
      const tokens = names.value.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
      const pool = candidates(aduc, kinds, scope).filter((o) => !opts.exclude?.has(o.key));
      const out = [];
      for (const tok of tokens) {
        const bare = tok.replace(/\s*\([^)]*@[^)]*\)\s*$/, "");
        let hits = pool.filter((o) => matches(o, bare, true));
        if (hits.length === 0) hits = pool.filter((o) => matches(o, bare, false));
        if (hits.length === 0) {
          await new Promise((done) => {
            const m = messageBox(
              `An object named "${bare}" cannot be found. Check the selected object types and location for accuracy and ensure that you typed the object name correctly, or remove this object from the selection.`,
              { title: "Name Not Found", kind: "warning" }
            );
            m.onClose = done;
          });
          return false;
        }
        if (hits.length > 1) {
          const pick = await chooseOne(aduc, bare, hits);
          if (!pick) return false;
          hits = [pick];
        }
        if (!out.some((o) => o.key === hits[0].key)) out.push(hits[0]);
      }
      if (opts.multi === false && out.length > 1) {
        messageBox("Only one object can be selected here.", { kind: "warning" });
        return false;
      }
      resolved = out;
      names.value = out.map(display).join("; ");
      names.style.textDecoration = "underline";
      return out.length > 0;
    };
    const advBtn = button("Advanced...", () => {
      advancedSearch(aduc, kinds, scope, opts, (picked) => {
        const existing = names.value.trim();
        names.value = [existing, ...picked.map(display)].filter(Boolean).join("; ");
        names.dispatchEvent(new Event("input"));
        void checkNames();
      });
    }, { width: "90px" });
    const okBtn = button("OK", () => {
      void (async () => {
        if (!resolved && !await checkNames()) return;
        const picked = resolved ?? [];
        d.close();
        opts.onOk(picked);
      })();
    }, { primary: true, disabled: true });
    const cancelBtn = button("Cancel", () => d.close());
    d.buttons.push(okBtn, cancelBtn);
    d.foot.style.display = "flex";
    d.foot.style.justifyContent = "space-between";
    const right = el("div");
    right.style.cssText = "display:flex;gap:8px;";
    right.append(okBtn, cancelBtn);
    d.foot.append(advBtn, right);
    queueMicrotask(() => names.focus());
  }
  function chooseOne(aduc, typed, hits) {
    return new Promise((resolve) => {
      let chosen = null;
      const d = openDialog({
        title: "Multiple Names Found",
        width: 440,
        modal: true,
        owner: aduc.owner,
        buttons: [
          { label: "OK", primary: true, onClick: () => chosen ? void 0 : false },
          { label: "Cancel", cancel: true, onClick: () => void (chosen = null) }
        ]
      });
      d.body.appendChild(el("div", void 0, `More than one object matched the name "${typed}". Select one or more names from this list, or, reenter the name.`));
      const lb = listBox(
        [
          { label: "Name", render: (o) => o.name, iconOf: (o) => o.icon, width: "45%" },
          { label: "E-Mail Address", render: (o) => o.user?.email ?? "" },
          { label: "In Folder", render: (o) => o.user ? locationOf(aduc, homeOf(o.user)) : o.group ? locationOf(aduc, homeOf(o.group)) : `${DOMAIN}/Users` }
        ],
        { height: "160px", onOpen: (o) => {
          chosen = o;
          d.buttons[0].click();
        } }
      );
      lb.onSelect = (rows) => chosen = rows[0] ?? null;
      lb.setRows(hits);
      lb.el.style.marginTop = "8px";
      d.body.appendChild(lb.el);
      d.onClose = () => resolve(chosen);
    });
  }
  function locationOf(aduc, home) {
    return home.startsWith("ou:") ? `${DOMAIN}/${aduc.dir.ouPath(home.slice(3))}` : `${DOMAIN}/Users`;
  }
  function advancedSearch(aduc, kinds, scope, opts, onPick) {
    let picked = [];
    const d = openDialog({
      title: opts.title,
      width: 560,
      modal: true,
      owner: aduc.owner,
      buttons: [
        { label: "OK", primary: true, onClick: () => {
          if (picked.length) onPick(picked);
        } },
        { label: "Cancel", cancel: true }
      ]
    });
    const fs = el("fieldset", "ad-fs");
    fs.appendChild(el("legend", void 0, "Common Queries"));
    const nameMode = document.createElement("select");
    for (const m of ["Starts with", "Is exactly"]) nameMode.appendChild(new Option(m, m));
    const nameBox = textbox("");
    const descBox = textbox("");
    const disabled = checkbox("Disabled accounts", false);
    const noExpire = checkbox("Non expiring password", false);
    const g2 = el("div", "ad-grid");
    g2.style.gridTemplateColumns = "80px 110px 1fr 90px";
    const findBtn = button("Find Now", () => run(), { primary: true, width: "90px" });
    g2.append(el("label", void 0, "Name:"), nameMode, nameBox, findBtn, el("label", void 0, "Description:"), el("span"), descBox, el("span"));
    const opts2 = el("div");
    opts2.style.cssText = "display:flex;gap:18px;margin-top:6px;";
    opts2.append(disabled.el, noExpire.el);
    fs.append(g2, opts2);
    d.body.appendChild(fs);
    d.body.appendChild(css(el("div", void 0, "Search results:"), "margin:8px 0 3px;"));
    const lb = listBox(
      [
        { label: "Name", render: (o) => o.name, iconOf: (o) => o.icon, width: "38%" },
        { label: "E-Mail Address", render: (o) => o.user?.email ?? "" },
        { label: "Description", render: (o) => o.description },
        { label: "In Folder", render: (o) => o.user ? locationOf(aduc, homeOf(o.user)) : o.group ? locationOf(aduc, homeOf(o.group)) : `${DOMAIN}/Users` }
      ],
      { height: "190px", multi: opts.multi !== false, onOpen: (o) => {
        picked = [o];
        d.buttons[0].click();
      } }
    );
    lb.onSelect = (rows) => picked = rows;
    d.body.appendChild(lb.el);
    const run = () => {
      const q2 = nameBox.value.trim().toLowerCase();
      const dq = descBox.value.trim().toLowerCase();
      const rows = candidates(aduc, kinds, scope).filter((o) => {
        if (opts.exclude?.has(o.key)) return false;
        if (q2) {
          const n = o.name.toLowerCase();
          const sam = o.user?.username.toLowerCase() ?? "";
          const hit = nameMode.value === "Is exactly" ? n === q2 || sam === q2 : n.startsWith(q2) || sam.startsWith(q2);
          if (!hit) return false;
        }
        if (dq && !o.description.toLowerCase().startsWith(dq)) return false;
        if (disabled.checked && o.user?.status !== "disabled") return false;
        if (noExpire.checked && o.user?.attrs?.PasswordNeverExpires !== "TRUE") return false;
        return true;
      });
      lb.setRows(rows.sort((a, b2) => a.name.localeCompare(b2.name)));
    };
    run();
  }
  function css(e, s) {
    e.style.cssText += s;
    return e;
  }
  function browseContainer(aduc, opts) {
    let chosen = opts.initial ?? null;
    const expanded = /* @__PURE__ */ new Set(["domain"]);
    const d = openDialog({
      title: opts.title,
      width: 380,
      modal: true,
      owner: aduc.owner,
      buttons: [
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!chosen) return false;
            if (chosen === "domain" && !opts.allowDomain) {
              messageBox("Objects cannot be moved directly into the domain in this lab. Choose an organizational unit or the Users container.", { kind: "warning" });
              return false;
            }
            if (opts.forbid?.(chosen)) {
              messageBox("The object cannot be moved into that container.", { kind: "error" });
              return false;
            }
            opts.onOk(chosen);
          }
        },
        { label: "Cancel", cancel: true }
      ]
    });
    d.body.appendChild(css(el("div", void 0, opts.prompt), "margin-bottom:6px;"));
    const tree = el("div", "ad-lb");
    tree.style.cssText += "height:250px;padding:3px 2px;";
    tree.tabIndex = 0;
    d.body.appendChild(tree);
    const kids = (key) => {
      if (key === "domain") {
        const cs = CONTAINERS.filter((c) => !c.advanced && (!opts.ousOnly || c.id === "dcs")).filter((c) => ["builtin", "computers", "dcs", "fsp", "msa", "users"].includes(c.id)).map((c) => ({ key: `c:${c.id}`, name: c.name, iconName: c.icon }));
        const os = aduc.dir.childOus(void 0).map((o) => ({ key: `ou:${o.id}`, name: o.name, iconName: "ou" }));
        return [...cs, ...os].sort((a, b2) => a.name.localeCompare(b2.name));
      }
      if (key.startsWith("ou:")) {
        return aduc.dir.childOus(key.slice(3)).map((o) => ({ key: `ou:${o.id}`, name: o.name, iconName: "ou" })).sort((a, b2) => a.name.localeCompare(b2.name));
      }
      return [];
    };
    const paint = () => {
      tree.textContent = "";
      const draw = (key, name, iconName, depth) => {
        const children = kids(key);
        const row = el("div");
        row.style.cssText = `display:flex;align-items:center;gap:3px;height:19px;padding-left:${depth * 18}px;white-space:nowrap;`;
        const box = el("span");
        box.style.cssText = "width:9px;height:9px;border:1px solid #919191;position:relative;flex-shrink:0;background:#fff;margin:0 3px;" + (children.length ? "" : "visibility:hidden;");
        const bar = (v) => {
          const b = el("span");
          b.style.cssText = v ? "position:absolute;left:3px;top:1px;width:1px;height:5px;background:#333;" : "position:absolute;left:1px;top:3px;width:5px;height:1px;background:#333;";
          return b;
        };
        box.appendChild(bar(false));
        if (!expanded.has(key)) box.appendChild(bar(true));
        box.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          if (expanded.has(key)) expanded.delete(key);
          else expanded.add(key);
          paint();
        });
        const label = el("span", void 0, name);
        label.style.cssText = "padding:0 2px;" + (chosen === key ? "background:#0078d7;color:#fff;" : "");
        row.append(box, icon(iconName), label);
        row.addEventListener("mousedown", () => {
          chosen = key;
          paint();
        });
        row.addEventListener("dblclick", () => {
          if (expanded.has(key)) expanded.delete(key);
          else expanded.add(key);
          paint();
        });
        tree.appendChild(row);
        if (expanded.has(key)) for (const c of children) draw(c.key, c.name, c.iconName, depth + 1);
      };
      draw("domain", DOMAIN, "domain", 0);
    };
    if (opts.initial?.startsWith("ou:")) {
      for (let k = opts.initial; k?.startsWith("ou:"); ) {
        const p = aduc.dir.getOu(k.slice(3))?.parentId;
        k = p ? `ou:${p}` : void 0;
        if (k) expanded.add(k);
      }
    }
    paint();
  }

  // aduc/actions.ts
  function materializeGroup(aduc, o) {
    if (o.group) return o.group;
    const b = o.builtin;
    if (!b || b.kind !== "group") return null;
    const existing = aduc.dir.getGroupByName(b.name);
    if (existing) return existing;
    if (b.container === "builtin") {
      messageBox(
        `${b.name} is a built-in local group of the domain controllers. This lab directory does not manage its membership. Use a group from the Users container or one you created.`,
        { kind: "warning" }
      );
      return null;
    }
    const r = aduc.run("group.create", { Name: b.name, Description: b.description, GroupScope: b.scope ?? "Global", GroupCategory: "Security" });
    return r.ok ? aduc.dir.getGroupByName(b.name) ?? null : null;
  }
  function addUsersToGroups(aduc, users, groups) {
    let done = 0;
    for (const go of groups) {
      const g2 = materializeGroup(aduc, go);
      if (!g2) continue;
      for (const u of users) {
        if (g2.memberIds.includes(u.id)) continue;
        const r = aduc.run("group.addMember", { Identity: u.username, Group: g2.name });
        if (!r.ok) return;
        done++;
      }
    }
    if (done > 0 || groups.length) messageBox("The Add to Group operation was successfully completed.", { kind: "info" });
  }
  function addToGroupDialog(aduc, users) {
    selectObjects(aduc, {
      title: "Select Groups",
      kinds: ["group"],
      multi: true,
      onOk: (groups) => addUsersToGroups(aduc, users, groups)
    });
  }
  function setEnabled(aduc, users, enable) {
    for (const u of users) {
      const r = aduc.run(enable ? "user.enable" : "user.disable", { Identity: u.username });
      if (!r.ok) return;
    }
    const what = users.length === 1 ? `Object ${users[0].displayName} has been ${enable ? "enabled" : "disabled"}.` : `The selected objects have been ${enable ? "enabled" : "disabled"}.`;
    messageBox(what, { kind: "info" });
  }
  function resetPasswordDialog(aduc, u) {
    const pwd = textbox("", { type: "password" });
    const confirm = textbox("", { type: "password" });
    const must = checkbox("User must change password at next logon", true);
    const unlock = checkbox("Unlock the user's account", false);
    const locked = u.status === "locked";
    if (!locked) unlock.setDisabled(true);
    const d = openDialog({
      title: "Reset Password",
      width: 400,
      modal: true,
      owner: aduc.owner,
      buttons: [
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (pwd.value !== confirm.value) {
              messageBox("The New and Confirm passwords must match. Please re-type them.", { kind: "error" });
              return false;
            }
            const v = aduc.conductor.idp.validatePassword(pwd.value);
            if (!v.ok) {
              messageBox(
                `Windows cannot complete the password change for ${u.displayName} because:

The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.

(${v.reason})`,
                { kind: "error" }
              );
              return false;
            }
            const r = aduc.run("password.reset", {
              Identity: u.username,
              NewPassword: pwd.value,
              ChangePasswordAtLogon: must.checked ? "true" : "false"
            });
            if (!r.ok) return false;
            if (unlock.checked) aduc.run("account.unlock", { Identity: u.username });
            messageBox(`The password for ${u.displayName} has been changed.`, { kind: "info" });
          }
        },
        { label: "Cancel", cancel: true }
      ]
    });
    d.body.append(
      grid("130px 1fr", "New password:", pwd, "Confirm password:", confirm),
      el("div")
    );
    const opts = el("div");
    opts.style.cssText = "margin:10px 0 4px;";
    opts.append(must.el, el("div", "ad-note", "The user must logoff and then logon again for the change to take effect."));
    d.body.appendChild(opts);
    d.body.appendChild(hr());
    const status = el("div");
    status.append(
      el("div", void 0, "Account Lockout Status on this Domain Controller: " + (locked ? "Locked" : "Unlocked")),
      unlock.el
    );
    d.body.appendChild(status);
  }
  function moveDialog(aduc, objs) {
    const movingOus = objs.filter((o) => o.ou);
    const others = objs.filter((o) => o.user || o.group);
    if (!movingOus.length && !others.length) return;
    const first = objs[0];
    browseContainer(aduc, {
      title: "Move",
      prompt: "Move object into container:",
      allowDomain: movingOus.length > 0 && others.length === 0,
      initial: first.user ? homeOf(first.user) : first.group ? homeOf(first.group) : void 0,
      forbid: (key) => {
        if (movingOus.length && others.length === 0) {
          if (!(key === "domain" || key.startsWith("ou:"))) return true;
          for (const o of movingOus) {
            for (let k = key; k?.startsWith("ou:"); ) {
              if (k === `ou:${o.ou.id}`) return true;
              const p = aduc.dir.getOu(k.slice(3))?.parentId;
              k = p ? `ou:${p}` : void 0;
            }
          }
          return false;
        }
        return !(key === "c:users" || key.startsWith("ou:"));
      },
      onOk: (key) => {
        const target = key === "c:users" ? `CN=Users,${DOMAIN}` : key === "domain" ? `DC=${DOMAIN}` : aduc.dir.ouPath(key.slice(3));
        for (const o of objs) {
          const id = o.user ? o.user.username : o.group ? o.group.name : o.ou ? aduc.dir.ouPath(o.ou.id) : "";
          if (!id) continue;
          if (!aduc.run("user.move", { Identity: id, TargetPath: target }).ok) return;
        }
        aduc.reveal(key);
      }
    });
  }
  function renameDialog(aduc, o, newName) {
    if (o.user) {
      const u = o.user;
      const gap = u.displayName.indexOf(" ");
      const full = textbox(newName ?? u.displayName);
      const first = textbox(u.attrs?.givenName ?? (gap === -1 ? u.displayName : u.displayName.slice(0, gap)));
      const last = textbox(u.attrs?.sn ?? (gap === -1 ? "" : u.displayName.slice(gap + 1)));
      const disp = textbox(newName ?? u.displayName);
      const at = (u.upn ?? "").lastIndexOf("@");
      const upn = textbox(at > 0 ? u.upn.slice(0, at) : u.username);
      const suffix = el("select");
      const current2 = at > 0 ? u.upn.slice(at) : `@${DOMAIN}`;
      const suffixes = aduc.dir.upnSuffixes().map((s) => `@${s}`);
      for (const s of suffixes.includes(current2) ? suffixes : [current2, ...suffixes]) suffix.appendChild(new Option(s, s, s === current2, s === current2));
      const pre = textbox(`${NETBIOS}\\`, { readOnly: true });
      const sam = textbox(u.username);
      upn.addEventListener("input", () => sam.value = upn.value.slice(0, 20));
      full.addEventListener("input", () => disp.value = full.value);
      disp.readOnly = true;
      openDialog({
        title: "Rename User",
        width: 440,
        modal: true,
        owner: aduc.owner,
        buttons: [
          {
            label: "OK",
            primary: true,
            onClick: () => {
              if (!full.value.trim()) {
                messageBox("The full name cannot be empty.", { kind: "error" });
                return false;
              }
              const r = aduc.run("user.update", {
                Identity: u.username,
                SamAccountName: sam.value.trim() || upn.value.trim(),
                UserPrincipalName: `${upn.value.trim() || sam.value.trim()}${suffix.value}`,
                DisplayName: full.value.trim(),
                GivenName: first.value.trim(),
                Surname: last.value.trim()
              });
              if (!r.ok) return false;
            }
          },
          { label: "Cancel", cancel: true }
        ]
      }).body.append(
        grid("150px 1fr", "Full name:", full, "First name:", first, "Last name:", last, "Display name:", disp),
        hr(),
        el("div", void 0, "User logon name:"),
        grid("1fr 150px", upn, suffix),
        el("div", void 0, "User logon name (pre-Windows 2000):"),
        grid("150px 1fr", pre, sam)
      );
      return;
    }
    const current = o.group?.name ?? o.ou?.name ?? o.name;
    const box = textbox(newName ?? current);
    openDialog({
      title: "Rename",
      width: 360,
      modal: true,
      owner: aduc.owner,
      buttons: [
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const name = box.value.trim();
            if (!name || name === current) return;
            const id = o.group ? o.group.name : o.ou ? aduc.dir.ouPath(o.ou.id) : current;
            if (!aduc.run("object.rename", { Identity: id, NewName: name }).ok) return false;
          }
        },
        { label: "Cancel", cancel: true }
      ]
    }).body.append(grid("60px 1fr", "Name:", box));
  }
  function deleteObjects(aduc, objs) {
    const real = objs.filter((o) => o.user || o.group || o.ou);
    if (real.length !== objs.length) {
      messageBox("Built-in objects and system containers cannot be deleted from this console.", { kind: "error" });
      return;
    }
    if (!real.length) return;
    const typeWord = (o) => o.user ? "User" : o.group ? "Group" : "Organizational Unit";
    const text = real.length === 1 ? `Are you sure you want to delete the ${typeWord(real[0])} named '${real[0].name}'?` : "Are you sure you want to delete these objects?";
    messageBox(text, {
      kind: "warning",
      yesNo: true,
      onYes: () => {
        for (const o of real) {
          if (o.user) {
            if (!aduc.run("user.delete", { Identity: o.user.username }).ok) return;
          } else if (o.group) {
            if (!aduc.run("group.delete", { Name: o.group.name }).ok) return;
          } else if (o.ou) {
            if (!deleteOu(aduc, o.ou.id)) return;
          }
        }
      }
    });
  }
  function deleteOu(aduc, id) {
    const ou = aduc.dir.getOu(id);
    if (!ou) return true;
    if (ou.protectedFromDeletion) {
      messageBox(
        `You do not have sufficient privileges to delete ${ou.name}, or this object is protected from accidental deletion.`,
        { kind: "error" }
      );
      return false;
    }
    const hasContents = aduc.dir.childOus(id).length > 0 || aduc.dir.listUsers().some((u) => u.ouId === id) || aduc.dir.listGroups().some((g2) => g2.ouId === id);
    if (!hasContents) return aduc.run("ou.delete", { Name: aduc.dir.ouPath(id) }).ok;
    messageBox(
      `Object ${ou.name} contains other objects. Are you sure you want to delete object ${ou.name} and all of the objects that it contains?`,
      {
        kind: "warning",
        yesNo: true,
        onYes: () => {
          const protectedChild = descendants(aduc, id).find((o) => aduc.dir.getOu(o)?.protectedFromDeletion);
          if (protectedChild) {
            messageBox(
              `Windows cannot delete object ${ou.name} because: Access is denied.

${aduc.dir.getOu(protectedChild).name} is protected from accidental deletion.`,
              { kind: "error" }
            );
            return;
          }
          for (const oid of [...descendants(aduc, id), id].reverse()) {
            for (const u of aduc.dir.listUsers().filter((x) => x.ouId === oid)) aduc.run("user.delete", { Identity: u.username });
            for (const g2 of aduc.dir.listGroups().filter((x) => x.ouId === oid)) aduc.run("group.delete", { Name: g2.name });
          }
          for (const oid of [...descendants(aduc, id)].reverse()) aduc.run("ou.delete", { Name: aduc.dir.ouPath(oid) });
          aduc.run("ou.delete", { Name: aduc.dir.ouPath(id) });
        }
      }
    );
    return false;
  }
  function descendants(aduc, id) {
    const out = [];
    const walk = (p) => {
      for (const c of aduc.dir.childOus(p)) {
        out.push(c.id);
        walk(c.id);
      }
    };
    walk(id);
    return out;
  }

  // aduc/wizards.ts
  function departmentFor(aduc, nodeKey) {
    for (let k = nodeKey; k?.startsWith("ou:"); ) {
      const ou = aduc.dir.getOu(k.slice(3));
      const hit = DEPARTMENTS.find((d) => d.toLowerCase() === ou?.name.toLowerCase());
      if (hit) return hit;
      k = ou?.parentId ? `ou:${ou.parentId}` : void 0;
    }
    return void 0;
  }
  function newUserWizard(aduc, nodeKey, template) {
    const where = canonicalOf(nodeKey, aduc.dir);
    let page = 0;
    const first = textbox("");
    const initials = textbox("", { width: "70px" });
    initials.maxLength = 6;
    const last = textbox("");
    const full = textbox("");
    const logon = textbox("");
    const suffix = select(aduc.dir.upnSuffixes().map((s) => `@${s}`));
    const pre = textbox(`${NETBIOS}\\`, { readOnly: true });
    const sam = textbox("");
    sam.maxLength = 20;
    let fullTouched = false;
    let samTouched = false;
    const pwd = textbox("", { type: "password" });
    const pwd2 = textbox("", { type: "password" });
    const tflags = template?.attrs ?? {};
    const must = checkbox("User must change password at next logon", template ? !!template.mustChangePassword || !isTrue(tflags.PasswordNeverExpires) : true);
    const cannot = checkbox("User cannot change password", isTrue(tflags.CannotChangePassword));
    const never = checkbox("Password never expires", isTrue(tflags.PasswordNeverExpires));
    const disabled = checkbox("Account is disabled", template?.status === "disabled");
    if (never.checked) must.checked = false;
    const syncFull = () => {
      if (fullTouched) return;
      const mid = initials.value.trim() ? ` ${initials.value.trim()}.` : "";
      full.value = `${first.value.trim()}${mid} ${last.value.trim()}`.trim();
    };
    first.addEventListener("input", () => {
      syncFull();
      update();
    });
    initials.addEventListener("input", () => {
      syncFull();
      update();
    });
    last.addEventListener("input", () => {
      syncFull();
      update();
    });
    full.addEventListener("input", () => {
      fullTouched = true;
      update();
    });
    logon.addEventListener("input", () => {
      if (!samTouched) sam.value = logon.value.slice(0, 20);
      update();
    });
    sam.addEventListener("input", () => {
      samTouched = true;
      update();
    });
    never.input.addEventListener("change", () => {
      if (never.checked && must.checked) {
        messageBox("You specified that the password should never expire. The user will not be required to change the password at next logon.", { kind: "info" });
        must.checked = false;
      }
    });
    const conflict = () => {
      if (must.checked && cannot.checked) {
        messageBox("You cannot check both User must change password at next logon and User cannot change password for the same user.", { kind: "warning" });
        cannot.checked = false;
      }
    };
    must.input.addEventListener("change", conflict);
    cannot.input.addEventListener("change", conflict);
    const d = openDialog({ title: template ? "Copy Object - User" : "New Object - User", width: 480, height: 440, modal: true, owner: aduc.owner });
    const pages = [el("div"), el("div"), el("div")];
    for (const p of pages) d.body.appendChild(p);
    pages[0].append(
      headerStrip("user", where, "Create in:"),
      grid("130px 1fr auto 70px", "First name:", first, "Initials:", initials),
      grid("130px 1fr", "Last name:", last, "Full name:", full)
    );
    pages[0].children[1].style.marginBottom = "7px";
    const lab1 = el("div", void 0, "User logon name:");
    lab1.style.margin = "14px 0 3px";
    const lab2 = el("div", void 0, "User logon name (pre-Windows 2000):");
    lab2.style.margin = "8px 0 3px";
    pages[0].append(lab1, grid("1fr 170px", logon, suffix), lab2, grid("1fr 1fr", pre, sam));
    const opts = el("div");
    opts.style.cssText = "display:flex;flex-direction:column;gap:6px;margin-top:14px;";
    opts.append(must.el, cannot.el, never.el, disabled.el);
    pages[1].append(headerStrip("user", where, "Create in:"), grid("130px 1fr", "Password:", pwd, "Confirm password:", pwd2), opts);
    const summary = document.createElement("textarea");
    summary.readOnly = true;
    summary.style.cssText = "width:100%;height:190px;";
    pages[2].append(headerStrip("user", where, "Create in:"), el("div", void 0, "When you click Finish, the following object will be created:"), summary);
    summary.style.marginTop = "6px";
    const back = button("< Back", () => go(page - 1));
    const next = button("Next >", () => void onNext(), { primary: true });
    const cancel = button("Cancel", () => d.close());
    d.foot.style.display = "flex";
    d.foot.append(back, next, cancel);
    d.buttons.push(next, back, cancel);
    function update() {
      back.disabled = page === 0;
      if (page === 0) next.disabled = !full.value.trim() || !(logon.value.trim() || sam.value.trim());
      else next.disabled = false;
      next.textContent = page === 2 ? "Finish" : "Next >";
    }
    function go(p) {
      page = Math.max(0, Math.min(2, p));
      pages.forEach((el_, i) => el_.style.display = i === page ? "" : "none");
      if (page === 2) {
        const lines = [
          `Full name: ${full.value.trim()}`,
          "",
          `User logon name: ${logon.value.trim() || sam.value.trim()}${suffix.value}`,
          ""
        ];
        if (must.checked) lines.push("The user must change the password at next logon.");
        if (cannot.checked) lines.push("The user cannot change the password.");
        if (never.checked) lines.push("The password never expires.");
        if (disabled.checked) lines.push("The account is disabled.");
        if (template) lines.push("", `Copied from: ${template.displayName} (groups, department, organization and account options)`);
        summary.value = lines.join("\n");
      }
      update();
      queueMicrotask(() => (page === 0 ? first : page === 1 ? pwd : next).focus());
    }
    async function onNext() {
      if (page === 0) {
        const name = logon.value.trim() || sam.value.trim();
        if (/[\s"/\\[\]:;|=,+*?<>]/.test(name)) {
          messageBox(`The user logon name "${name}" contains one or more illegal characters.`, { kind: "error" });
          return;
        }
        if (aduc.dir.getUserByUsername(sam.value.trim() || name)) {
          messageBox(`The pre-Windows 2000 user logon name you have chosen is already in use in this domain. Choose another pre-Windows 2000 logon name, and then try again.`, { kind: "error" });
          return;
        }
        go(1);
        return;
      }
      if (page === 1) {
        if (pwd.value !== pwd2.value) {
          messageBox("The passwords do not match. Type the new password in both text boxes.", { kind: "error" });
          return;
        }
        const v = aduc.conductor.idp.validatePassword(pwd.value);
        if (!v.ok) {
          messageBox(
            `Windows cannot set the password for ${full.value.trim()} because: The password does not meet the password policy requirements. Check the minimum password length, password complexity and password history requirements.

(${v.reason})`,
            { kind: "error" }
          );
          return;
        }
        go(2);
        return;
      }
      finish();
    }
    function finish() {
      const username = sam.value.trim() || logon.value.trim();
      const dept = template?.department ?? departmentFor(aduc, nodeKey);
      const path = pathArgOf(nodeKey, aduc.dir);
      const r = aduc.run("user.create", {
        SamAccountName: username,
        UserPrincipalName: `${logon.value.trim() || username}${suffix.value}`,
        Name: full.value.trim(),
        ...dept ? { Department: dept } : {},
        ...template ? { Title: template.title } : {},
        AccountPassword: pwd.value,
        ChangePasswordAtLogon: must.checked ? "true" : "false",
        ...path ? { Path: path } : {}
      });
      if (!r.ok) return;
      const attrs = {
        GivenName: first.value.trim(),
        Surname: last.value.trim(),
        Initials: initials.value.trim(),
        CannotChangePassword: cannot.checked ? "true" : "false",
        PasswordNeverExpires: never.checked ? "true" : "false"
      };
      if (template) {
        const t = template.attrs ?? {};
        const carry = {
          Company: t.company ?? "",
          City: t.l ?? "",
          State: t.st ?? "",
          PostalCode: t.postalCode ?? "",
          Country: t.c ?? "",
          POBox: t.postOfficeBox ?? "",
          Manager: t.manager ?? "",
          ProfilePath: (t.profilePath ?? "").replace(new RegExp(template.username, "ig"), username),
          HomeDirectory: (t.homeDirectory ?? "").replace(new RegExp(template.username, "ig"), username),
          HomeDrive: t.homeDrive ?? "",
          ScriptPath: t.scriptPath ?? ""
        };
        for (const [k, v] of Object.entries(carry)) if (v) attrs[k] = v;
      }
      aduc.run("user.update", { Identity: username, ...attrs });
      if (template) {
        for (const g2 of aduc.dir.listGroups().filter((x) => x.memberIds.includes(template.id))) {
          aduc.run("group.addMember", { Identity: username, Group: g2.name });
        }
      }
      if (disabled.checked) aduc.run("user.disable", { Identity: username });
      d.close();
      const u = aduc.dir.getUserByUsername(username);
      if (u) aduc.reveal(nodeKey, `user:${u.id}`);
    }
    go(0);
  }
  function newGroupDialog(aduc, nodeKey) {
    const name = textbox("");
    const pre = textbox("");
    let preTouched = false;
    name.addEventListener("input", () => {
      if (!preTouched) pre.value = name.value.slice(0, 256);
      ok.disabled = !name.value.trim();
    });
    pre.addEventListener("input", () => preTouched = true);
    let scope = "Global";
    let type = "Security";
    const scopeFs = el("fieldset", "ad-fs");
    scopeFs.appendChild(el("legend", void 0, "Group scope"));
    scopeFs.append(
      radio("ng-scope", "Domain local", false, () => scope = "DomainLocal").el,
      radio("ng-scope", "Global", true, () => scope = "Global").el,
      radio("ng-scope", "Universal", false, () => scope = "Universal").el
    );
    const typeFs = el("fieldset", "ad-fs");
    typeFs.appendChild(el("legend", void 0, "Group type"));
    typeFs.append(
      radio("ng-type", "Security", true, () => type = "Security").el,
      radio("ng-type", "Distribution", false, () => type = "Distribution").el
    );
    const d = openDialog({
      title: "New Object - Group",
      width: 460,
      modal: true,
      owner: aduc.owner,
      buttons: [
        {
          label: "OK",
          primary: true,
          disabled: true,
          onClick: () => {
            const path = pathArgOf(nodeKey, aduc.dir);
            const r = aduc.run("group.create", {
              Name: name.value.trim(),
              Description: "",
              GroupScope: scope,
              GroupCategory: type,
              ...path ? { Path: path } : {}
            });
            if (!r.ok) return false;
            if (pre.value.trim() && pre.value.trim() !== name.value.trim()) {
              aduc.run("group.update", { Identity: name.value.trim(), Replace: `sAMAccountName=${pre.value.trim()}` }, { quiet: true });
            }
            const g2 = aduc.dir.getGroupByName(name.value.trim());
            if (g2) aduc.reveal(nodeKey, `group:${g2.id}`);
          }
        },
        { label: "Cancel", cancel: true }
      ]
    });
    const ok = d.buttons[0];
    const cols = el("div");
    cols.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px;";
    cols.append(scopeFs, typeFs);
    const l1 = el("div", void 0, "Group name:");
    const l2 = el("div", void 0, "Group name (pre-Windows 2000):");
    l2.style.marginTop = "10px";
    name.style.width = "100%";
    pre.style.width = "100%";
    d.body.append(headerStrip("group", canonicalOf(nodeKey, aduc.dir), "Create in:"), l1, name, l2, pre, cols);
  }
  function newOuDialog(aduc, nodeKey) {
    const name = textbox("");
    name.style.width = "100%";
    const protect = checkbox("Protect container from accidental deletion", true);
    const d = openDialog({
      title: "New Object - Organizational Unit",
      width: 460,
      modal: true,
      owner: aduc.owner,
      buttons: [
        {
          label: "OK",
          primary: true,
          disabled: true,
          onClick: () => {
            const path = pathArgOf(nodeKey, aduc.dir);
            const r = aduc.run("ou.create", {
              Name: name.value.trim(),
              ProtectedFromAccidentalDeletion: protect.checked ? "true" : "false",
              ...path ? { Path: path } : {}
            });
            if (!r.ok) return false;
            const parent = path ? aduc.dir.resolveOuRef(path).ou?.id : void 0;
            const ou = aduc.dir.childOus(parent).find((o) => o.name.toLowerCase() === name.value.trim().toLowerCase());
            aduc.reveal(nodeKey, ou ? `ou:${ou.id}` : void 0);
          }
        },
        { label: "Cancel", cancel: true },
        { label: "Help", onClick: () => {
          messageBox("An organizational unit (OU) is a container you use to organize users, groups and computers, and to which you can delegate administration and link Group Policy. It is not a security principal: you cannot grant it permissions. Groups are how you grant access.", { title: "Help", kind: "info" });
          return false;
        } }
      ]
    });
    const ok = d.buttons[0];
    name.addEventListener("input", () => ok.disabled = !name.value.trim());
    const l = el("div", void 0, "Name:");
    l.style.marginBottom = "3px";
    protect.el.style.marginTop = "6px";
    d.body.append(headerStrip("ou", canonicalOf(nodeKey, aduc.dir), "Create in:"), l, name, protect.el);
    d.body.style.minHeight = "230px";
  }
  function delegationWizard(aduc, nodeKey) {
    const where = canonicalOf(nodeKey, aduc.dir);
    let page = 0;
    const trustees = [];
    const checks = DELEGATION_TASKS.map((t) => checkbox(t, false));
    const d = openDialog({ title: "Delegation of Control Wizard", width: 520, height: 420, modal: true, owner: aduc.owner });
    d.body.style.padding = "0";
    const pages = [el("div"), el("div"), el("div"), el("div")];
    for (const p of pages) {
      p.style.cssText = "height:100%;";
      d.body.appendChild(p);
    }
    const inner = (title, sub, content) => {
      const head2 = el("div", "ad-wiz-head");
      head2.style.margin = "0";
      const b = el("b", void 0, title);
      const s = el("div", void 0, sub);
      s.style.paddingLeft = "14px";
      head2.append(b, s);
      const body2 = el("div");
      body2.style.cssText = "padding:12px 20px;";
      body2.append(...content);
      return [head2, body2];
    };
    const sidePage = (title, text) => {
      const wrap = el("div");
      wrap.style.cssText = "display:flex;height:100%;background:#fff;";
      const side = el("div", "ad-wiz-side");
      side.style.cssText += "width:150px;flex-shrink:0;display:flex;align-items:flex-start;justify-content:center;padding-top:22px;";
      side.appendChild(icon("ou", 48));
      const main = el("div");
      main.style.cssText = "padding:18px 20px;flex:1;";
      const h = el("div", void 0, title);
      h.style.cssText = "font-size:16px;margin-bottom:14px;";
      main.append(h, text);
      wrap.append(side, main);
      return wrap;
    };
    pages[0].appendChild(
      sidePage(
        "Welcome to the Delegation of Control Wizard",
        el("div", "ad-note", "This wizard helps you delegate control of Active Directory objects. You can grant users permission to manage users, groups, computers, organizational units, and other objects stored in Active Directory Domain Services.\n\nTo continue, click Next.")
      )
    );
    pages[0].querySelector(".ad-note").style.whiteSpace = "pre-wrap";
    const lb = listBox([{ label: "Selected users and groups:", render: (o) => o.user ? `${o.name} (${NETBIOS}\\${o.user.username})` : `${o.name} (${NETBIOS}\\${o.name})`, iconOf: (o) => o.icon }], { height: "170px", multi: true });
    const addBtn = button(
      "Add...",
      () => selectObjects(aduc, {
        title: "Select Users, Computers, or Groups",
        kinds: ["user", "group"],
        multi: true,
        onOk: (picked) => {
          for (const p of picked) if (!trustees.some((t) => t.key === p.key)) trustees.push(p);
          lb.setRows([...trustees]);
          update();
        }
      })
    );
    const rmBtn = button("Remove", () => {
      for (const s of lb.selected()) trustees.splice(trustees.indexOf(s), 1);
      lb.setRows([...trustees]);
      update();
    });
    const btns = el("div");
    btns.style.cssText = "display:flex;gap:8px;margin-top:8px;";
    btns.append(addBtn, rmBtn);
    pages[1].append(...inner("Users or Groups", "Select one or more users or groups to whom you want to delegate control.", [lb.el, btns]));
    const taskList = el("div", "ad-lb");
    taskList.style.cssText += "height:170px;padding:3px 5px;margin-left:18px;";
    for (const c of checks) {
      taskList.appendChild(c.el);
      c.input.addEventListener("change", () => update());
    }
    const common = radio("dlg-task", "Delegate the following common tasks:", true);
    const custom = radio("dlg-task", "Create a custom task to delegate", false, () => {
      messageBox("Custom tasks write individual permissions (ACEs) on object types. On a real domain controller use this, or dsacls, for anything the common tasks do not cover. This lab records the common tasks only.", { kind: "info" });
      common.checked = true;
    });
    pages[2].append(...inner("Tasks to Delegate", "You can select common tasks or customize your own.", [common.el, taskList, custom.el]));
    const summary = document.createElement("textarea");
    summary.readOnly = true;
    summary.style.cssText = "width:100%;height:170px;";
    pages[3].appendChild(sidePage("Completing the Delegation of Control Wizard", summary));
    const back = button("< Back", () => go(page - 1));
    const next = button("Next >", () => onNext(), { primary: true });
    const cancel = button("Cancel", () => d.close());
    const help = button("Help", () => messageBox("Delegation grants a group the right to perform specific tasks on the objects in one OU, without making it a domain administrator. The classic use is letting the help desk reset passwords in the user OUs.", { title: "Help", kind: "info" }));
    d.foot.style.display = "flex";
    d.foot.style.paddingTop = "10px";
    d.foot.append(back, next, cancel, help);
    d.buttons.push(next, back, cancel);
    function update() {
      back.disabled = page === 0;
      if (page === 1) next.disabled = trustees.length === 0;
      else if (page === 2) next.disabled = !checks.some((c) => c.checked);
      else next.disabled = false;
      next.textContent = page === 3 ? "Finish" : "Next >";
    }
    function go(p) {
      page = Math.max(0, Math.min(3, p));
      pages.forEach((x, i) => x.style.display = i === page ? "" : "none");
      if (page === 3) {
        summary.value = [
          "You have successfully completed the Delegation of Control wizard.",
          "",
          "You chose to delegate control of objects in the following Active Directory folder:",
          `        ${where}`,
          "",
          "The groups, users, or computers to which you have given control are:",
          ...trustees.map((t) => `        ${t.name}`),
          "",
          "They have the following permissions:",
          ...DELEGATION_TASKS.filter((_, i) => checks[i].checked).map((t) => `        ${t}`),
          "",
          "To close this wizard, click Finish."
        ].join("\n");
      }
      update();
    }
    function onNext() {
      if (page < 3) return go(page + 1);
      const tasks = DELEGATION_TASKS.map((_, i) => i + 1).filter((n) => checks[n - 1].checked).join(",");
      const path = pathArgOf(nodeKey, aduc.dir);
      for (const t of trustees) {
        const g2 = t.builtin ? materializeGroup(aduc, t) : t.group;
        if (t.builtin && !g2) return;
        const trustee = t.user?.username ?? g2?.name ?? t.name;
        if (!aduc.run("ou.delegate", { ...path ? { Path: path } : {}, Trustee: trustee, Tasks: tasks }).ok) return;
      }
      d.close();
    }
    go(0);
  }

  // aduc/shim/adObjects.ts
  var domainDn = (domain) => domain.split(".").map((p) => `DC=${p}`).join(",");
  var escRdn = (v) => v.replace(/([,+"\\<>;=])/g, "\\$1");
  function ouChain(dir, ouId) {
    const out = [];
    let cur = ouId ? dir.getOu(ouId) : void 0;
    const seen = /* @__PURE__ */ new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.push(cur);
      cur = cur.parentId ? dir.getOu(cur.parentId) : void 0;
    }
    return out;
  }
  function ouDn(dir, ouId) {
    return `${ouChain(dir, ouId).map((o) => `OU=${escRdn(o.name)}`).join(",")},${domainDn(dir.domainName)}`;
  }
  function containerDn(dir, ouId) {
    return ouId && dir.getOu(ouId) ? ouDn(dir, ouId) : `CN=Users,${domainDn(dir.domainName)}`;
  }
  var userDn = (dir, u) => `CN=${escRdn(u.displayName)},${containerDn(dir, u.ouId)}`;
  var groupDn = (dir, g2) => `CN=${escRdn(g2.name)},${containerDn(dir, g2.ouId)}`;
  function hash(s, seed = 2166136261) {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  var hex = (n, len) => (n >>> 0).toString(16).padStart(8, "0").slice(-len);
  function guidFor(id) {
    const a = hash(id, 1), b = hash(id, 2), c = hash(id, 3), d = hash(id, 4);
    return `${hex(a, 8)}-${hex(b, 4)}-4${hex(b >>> 16, 3)}-${hex(8 + (c & 3), 1)}${hex(c >>> 4, 3)}-${hex(d, 8)}${hex(c >>> 16, 4)}`;
  }
  var domainSid = (d) => `S-1-5-21-${hash(d, 11) % 4e9}-${hash(d, 12) % 4e9}-${hash(d, 13) % 4e9}`;
  var WELL_KNOWN_RID = { administrator: 500, guest: 501, krbtgt: 502 };
  function sidFor(id, samAccountName, domain = VM_HOST.domain) {
    const rid = WELL_KNOWN_RID[samAccountName.toLowerCase()] ?? 1100 + hash(id, 7) % 8e5;
    return `${domainSid(domain)}-${rid}`;
  }

  // aduc/properties.ts
  var openSheets = /* @__PURE__ */ new Map();
  function openSheet(aduc, key, title, rows, initial, width = 440, readOnly = false) {
    const existing = openSheets.get(key);
    if (existing?.root.isConnected) {
      existing.root.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      return null;
    }
    const appliers = [];
    let applyBtn = null;
    const apply = () => {
      for (const fn of appliers) if (fn() === false) return false;
      if (applyBtn) applyBtn.disabled = true;
      aduc.refresh();
      return true;
    };
    const dlg = openDialog({
      title,
      width,
      height: 560,
      owner: aduc.owner,
      buttons: readOnly ? [{ label: "OK", primary: true }, { label: "Cancel", cancel: true }, { label: "Apply", disabled: true }, { label: "Help", onClick: () => false }] : [
        { label: "OK", primary: true, onClick: () => apply() ? void 0 : false },
        { label: "Cancel", cancel: true },
        { label: "Apply", disabled: true, onClick: () => void apply() },
        { label: "Help", onClick: () => false }
      ]
    });
    applyBtn = dlg.buttons[2] ?? null;
    dlg.body.style.padding = "8px 9px 10px";
    dlg.body.style.overflow = "hidden";
    openSheets.set(key, dlg);
    dlg.onClose = () => openSheets.delete(key);
    propertySheet(dlg.body, rows, initial);
    return {
      dlg,
      dirty: () => {
        if (applyBtn && !readOnly) applyBtn.disabled = false;
      },
      onApply: (fn) => appliers.push(fn)
    };
  }
  function bound(sheet, pending, key, value, opts = {}) {
    const t = textbox(value, { width: opts.width, readOnly: opts.readOnly });
    t.style.width = opts.width ?? "100%";
    t.addEventListener("input", () => {
      pending[key] = t.value;
      sheet()?.dirty();
    });
    return t;
  }
  function area(sheet, onChange, value, rows = 3) {
    const a = document.createElement("textarea");
    a.value = value;
    a.rows = rows;
    a.style.width = "100%";
    a.addEventListener("input", () => {
      onChange(a.value);
      sheet()?.dirty();
    });
    return a;
  }
  var nameHeader = (iconName, name) => {
    const h = el("div");
    h.style.cssText = "display:flex;align-items:center;gap:26px;padding:2px 0 10px;";
    h.append(icon(iconName, 32), el("span", void 0, name));
    return h;
  };
  function otherValues(aduc, title, current, onOk) {
    const values = current ? current.split(";").map((s) => s.trim()).filter(Boolean) : [];
    const d = openDialog({ title, width: 360, modal: true, owner: aduc.owner, buttons: [{ label: "OK", primary: true, onClick: () => onOk(values.join("; ")) }, { label: "Cancel", cancel: true }] });
    const lb = listBox([{ label: "Values", render: (v) => v }], { height: "130px" });
    lb.setRows(values);
    const input = textbox("");
    const add = button("Add", () => {
      if (!input.value.trim()) return;
      values.push(input.value.trim());
      input.value = "";
      lb.setRows([...values]);
    });
    const rm = button("Remove", () => {
      for (const s of lb.selected()) values.splice(values.indexOf(s), 1);
      lb.setRows([...values]);
    });
    const row = el("div");
    row.style.cssText = "display:flex;gap:6px;margin-top:6px;";
    row.append(input, add, rm);
    input.style.flex = "1";
    d.body.append(el("div", void 0, "New value:"), row, el("div", void 0, "Values:"), lb.el);
  }
  var COUNTRIES = ["", "United States", "Canada", "Mexico", "United Kingdom", "France", "Germany", "Spain", "Italy", "Netherlands", "Ireland", "India", "Japan", "China", "Singapore", "Australia", "Brazil", "South Africa", "Nigeria", "Kenya", "Ghana", "Philippines", "Haiti"];
  function delegationsOver(aduc, home) {
    const chain = /* @__PURE__ */ new Set(["domain"]);
    for (let k = home; k?.startsWith("ou:"); ) {
      chain.add(k);
      const p = aduc.dir.getOu(k.slice(3))?.parentId;
      k = p ? `ou:${p}` : void 0;
    }
    const out = /* @__PURE__ */ new Map();
    for (const d of aduc.dir.listDelegations()) {
      if (!chain.has(d.ouId ? `ou:${d.ouId}` : "domain")) continue;
      const s = out.get(d.trustee) ?? /* @__PURE__ */ new Set();
      for (const t of d.tasks) s.add(t);
      out.set(d.trustee, s);
    }
    return [...out].map(([trustee, s]) => ({ trustee, tasks: [...s] }));
  }
  function securityTab(aduc, objName, objectClass, home) {
    return {
      label: "Security",
      build: (p) => {
        const delegated = delegationsOver(aduc, home);
        const principals = [
          { name: "Everyone", perms: [] },
          ...objectClass === "user" ? [{ name: "SELF", perms: ["Read", "Change password"] }] : [],
          { name: "Authenticated Users", perms: ["Read"] },
          { name: "SYSTEM", perms: ["Full control"] },
          { name: `Domain Admins (${NETBIOS}\\Domain Admins)`, perms: ["Full control"] },
          { name: `Enterprise Admins (${NETBIOS}\\Enterprise Admins)`, perms: ["Full control"] },
          ...objectClass === "user" ? [{ name: `Account Operators (${NETBIOS}\\Account Operators)`, perms: ["Full control"] }] : [],
          { name: `Administrators (${NETBIOS}\\Administrators)`, perms: ["Read", "Write", "Create all child objects", "Special permissions"] },
          ...delegated.map((d) => ({
            name: `${d.trustee} (${NETBIOS}\\${d.trustee})`,
            perms: [
              ...d.tasks.some((t) => /manage user accounts|manage groups/.test(t)) ? ["Create all child objects", "Delete all child objects"] : [],
              ...d.tasks.some((t) => t.startsWith("Reset user passwords")) ? ["Reset password"] : [],
              ...d.tasks.some((t) => t.startsWith("Read all user")) ? ["Read"] : [],
              ...d.tasks.some((t) => t.startsWith("Modify the membership")) ? ["Write"] : [],
              "Special permissions"
            ]
          }))
        ];
        const lb = listBox([{ label: "Group or user names:", render: (x) => x.name, iconOf: (x) => x.name.startsWith("SELF") ? "user" : "group" }], { height: "120px" });
        lb.setRows(principals);
        const permsHost = el("div");
        const perms = objectClass === "user" ? ["Full control", "Read", "Write", "Create all child objects", "Delete all child objects", "Allowed to authenticate", "Change password", "Receive as", "Reset password", "Send as", "Special permissions"] : ["Full control", "Read", "Write", "Create all child objects", "Delete all child objects", "Special permissions"];
        const paint = (sel) => {
          permsHost.textContent = "";
          const t = el("table");
          t.style.cssText = "width:100%;border-collapse:collapse;";
          const head2 = el("tr");
          head2.append(el("td", void 0, `Permissions for ${sel?.name.split(" (")[0] ?? ""}`), css2(el("td", void 0, "Allow"), "width:50px;text-align:center;"), css2(el("td", void 0, "Deny"), "width:50px;text-align:center;"));
          t.appendChild(head2);
          for (const perm of perms) {
            const tr = el("tr");
            const a = document.createElement("input");
            a.type = "checkbox";
            a.disabled = true;
            a.checked = !!sel && (sel.perms.includes("Full control") || sel.perms.includes(perm));
            const dny = document.createElement("input");
            dny.type = "checkbox";
            dny.disabled = true;
            const ca = css2(el("td"), "text-align:center;");
            ca.appendChild(a);
            const cd = css2(el("td"), "text-align:center;");
            cd.appendChild(dny);
            tr.append(el("td", void 0, perm), ca, cd);
            t.appendChild(tr);
          }
          const box = el("div", "ad-lb");
          box.style.cssText += "height:175px;padding:2px 4px;";
          box.appendChild(t);
          permsHost.appendChild(box);
        };
        lb.onSelect = (rows) => paint(rows[0]);
        paint();
        const adv = el("div");
        adv.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:8px;";
        adv.append(el("span", "ad-note", "For special permissions or advanced settings, click Advanced."), button("Advanced", () => messageBox(
          delegated.length ? `Delegated on ${objName}'s location:

` + delegated.map((d) => `${d.trustee}:
  - ${d.tasks.join("\n  - ")}`).join("\n\n") : "No delegations apply to this object. Use Delegate Control... on an OU to add some.",
          { title: `Advanced Security Settings for ${objName}`, kind: "info" }
        )));
        const addRm = el("div");
        addRm.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin:6px 0;";
        addRm.append(button("Add...", () => messageBox("Use Delegate Control... on the OU to grant permissions in this lab.", { kind: "info" })), button("Remove", () => void 0, { disabled: true }));
        p.append(lb.el, addRm, permsHost, adv);
      }
    };
  }
  function objectTab(aduc, sheet, info) {
    return {
      label: "Object",
      build: (p) => {
        const created = info.created ? new Date(info.created).toLocaleString() : (/* @__PURE__ */ new Date()).toLocaleString();
        const usn = String(12e3 + parseInt(guidFor(info.id).slice(0, 4), 16) % 9e3);
        const prot = checkbox("Protect object from accidental deletion", info.protectedNow, (v) => {
          info.onProtect(v);
          sheet()?.dirty();
        });
        prot.el.style.marginTop = "14px";
        p.append(
          el("div", void 0, "Canonical name of object:"),
          css2(textbox(info.canonical, { readOnly: true }), "width:100%;margin:3px 0 10px;"),
          grid("150px 1fr", "Object class:", textbox(info.cls, { readOnly: true }), "Created:", textbox(created, { readOnly: true }), "Modified:", textbox((/* @__PURE__ */ new Date()).toLocaleString(), { readOnly: true })),
          css2(el("div", void 0, "Update Sequence Numbers (USNs):"), "margin-top:12px;"),
          grid("150px 1fr", "Current:", textbox(String(Number(usn) + 7), { readOnly: true }), "Original:", textbox(usn, { readOnly: true })),
          prot.el
        );
        void aduc;
      }
    };
  }
  function attributeEditorTab(aduc, rows, onEdit, sheet) {
    return {
      label: "Attribute Editor",
      build: (p) => {
        let onlyValues = true;
        const lb = listBox(
          [
            { label: "Attribute", render: (r) => r.name, width: "42%" },
            { label: "Value", render: (r) => r.value || "<not set>" }
          ],
          { height: "290px", onOpen: (r) => edit(r) }
        );
        const repaint = () => lb.setRows(rows().filter((r) => !onlyValues || r.value).sort((a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" })));
        const edit = (r) => {
          if (!r) return;
          if (!r.editable) {
            messageBox(`${r.name} is maintained by the directory or by another tab and cannot be edited here.`, { kind: "info" });
            return;
          }
          const v = textbox(r.value);
          v.style.width = "100%";
          const d = openDialog({
            title: "String Attribute Editor",
            width: 400,
            modal: true,
            owner: aduc.owner,
            buttons: [
              { label: "OK", primary: true, onClick: () => {
                onEdit(r.name, v.value.trim() || void 0);
                sheet()?.dirty();
                repaint();
              } },
              { label: "Cancel", cancel: true }
            ]
          });
          d.body.append(el("div", void 0, "Attribute:  " + r.name), css2(el("div", void 0, "Value:"), "margin:8px 0 3px;"), v, css2(button("Clear", () => v.value = ""), "margin-top:10px;"));
        };
        const only = checkbox("Show only attributes that have values", true, (v) => {
          onlyValues = v;
          repaint();
        });
        const bar = el("div");
        bar.style.cssText = "display:flex;justify-content:space-between;margin-top:8px;";
        bar.append(button("Edit", () => edit(lb.selected()[0])), button("Filter", () => void 0, { disabled: true }));
        p.append(el("div", void 0, "Attributes:"), lb.el, only.el, bar);
        repaint();
      }
    };
  }
  function css2(e, s) {
    e.style.cssText += s;
    return e;
  }
  var fileTime = (ms2) => new Date(ms2).toISOString().replace(/[-:T]/g, "").slice(0, 14) + ".0Z";
  function userProperties(aduc, u, initialTab = "General") {
    const advanced = aduc.advanced();
    const pending = {};
    const replace = {};
    let enable;
    let doUnlock = false;
    let dept;
    const addGroups = [];
    const removeGroups = /* @__PURE__ */ new Set();
    let sheet = null;
    const S = () => sheet;
    const attrs = u.attrs ?? {};
    const gap = u.displayName.indexOf(" ");
    const firstIn = attrs.givenName ?? (gap === -1 ? u.displayName : u.displayName.slice(0, gap));
    const lastIn = attrs.sn ?? (gap === -1 ? "" : u.displayName.slice(gap + 1));
    const setReplace = (k, v) => {
      replace[k] = v;
      sheet?.dirty();
    };
    const general = {
      label: "General",
      build: (p) => {
        const phone = bound(S, pending, "OfficePhone", attrs.telephoneNumber ?? "");
        const web = bound(S, pending, "HomePage", attrs.wWWHomePage ?? "");
        p.append(
          nameHeader("user", u.displayName),
          hr(),
          grid("110px 1fr 50px 70px", "First name:", bound(S, pending, "GivenName", firstIn), "Initials:", bound(S, pending, "Initials", attrs.initials ?? "", { width: "70px" })),
          css2(grid("110px 1fr", "Last name:", bound(S, pending, "Surname", lastIn), "Display name:", bound(S, pending, "DisplayName", u.displayName), "Description:", bound(S, pending, "Description", attrs.description ?? ""), "Office:", bound(S, pending, "Office", attrs.physicalDeliveryOfficeName ?? "")), "margin-top:7px;"),
          hr(),
          grid("110px 1fr 80px", "Telephone number:", phone, button("Other...", () => otherValues(aduc, "Phone Number (Others)", replace.otherTelephone ?? attrs.otherTelephone ?? "", (v) => setReplace("otherTelephone", v))), "E-mail:", bound(S, pending, "EmailAddress", u.email), el("span"), "Web page:", web, button("Other...", () => otherValues(aduc, "Web Page Address (Others)", replace.url ?? attrs.url ?? "", (v) => setReplace("url", v))))
        );
      }
    };
    const address = {
      label: "Address",
      build: (p) => {
        const street = area(S, (v) => pending.StreetAddress = v, attrs.streetAddress ?? "", 3);
        const country = select(COUNTRIES, attrs.c ?? "");
        country.style.width = "100%";
        country.addEventListener("change", () => {
          pending.Country = country.value;
          S()?.dirty();
        });
        p.append(grid("110px 1fr", "Street:", street, "P.O. Box:", bound(S, pending, "POBox", attrs.postOfficeBox ?? ""), "City:", bound(S, pending, "City", attrs.l ?? ""), "State/province:", bound(S, pending, "State", attrs.st ?? ""), "Zip/Postal Code:", bound(S, pending, "PostalCode", attrs.postalCode ?? ""), "Country/region:", country));
      }
    };
    const account = {
      label: "Account",
      build: (p) => {
        const at = (u.upn ?? `${u.username}@${DOMAIN}`).lastIndexOf("@");
        const logon = bound(S, pending, "SamAccountName", at > 0 ? u.upn.slice(0, at) : u.username);
        const suffixes = aduc.dir.upnSuffixes().map((s) => `@${s}`);
        const current = at > 0 ? u.upn.slice(at) : `@${DOMAIN}`;
        const suffix = select(suffixes.includes(current) ? suffixes : [current, ...suffixes], current);
        const setUpn = () => {
          pending.UserPrincipalName = `${logon.value.trim()}${suffix.value}`;
          S()?.dirty();
        };
        logon.addEventListener("input", setUpn);
        suffix.addEventListener("change", setUpn);
        const pre = textbox(`${NETBIOS}\\`, { readOnly: true });
        const sam = textbox(u.username);
        logon.addEventListener("input", () => sam.value = logon.value.slice(0, 20));
        sam.addEventListener("input", () => {
          pending.SamAccountName = sam.value;
          S()?.dirty();
        });
        const hours = button("Logon Hours...", () => logonHoursDialog(aduc, replace.logonHours ?? attrs.logonHours, (v) => setReplace("logonHours", v)));
        const logonTo = button("Log On To...", () => logOnToDialog(aduc, pending.LogonWorkstations ?? attrs.userWorkstations ?? "", (v) => {
          pending.LogonWorkstations = v;
          S()?.dirty();
        }));
        const btns = el("div");
        btns.style.cssText = "display:flex;gap:10px;margin:10px 0 8px;";
        btns.append(hours, logonTo);
        const locked = u.status === "locked";
        const unlock = checkbox(locked ? "Unlock account. This account is currently locked out on this Active Directory Domain Controller." : "Unlock account", false, (v) => {
          doUnlock = v;
          S()?.dirty();
        });
        if (!locked) unlock.setDisabled(true);
        const optBox = el("div", "ad-lb");
        optBox.style.cssText += "height:84px;padding:2px 4px;";
        const must = checkbox("User must change password at next logon", !!u.mustChangePassword);
        const flagChecks = /* @__PURE__ */ new Map();
        const disabledChk = checkbox("Account is disabled", u.status === "disabled", (v) => {
          enable = !v;
          S()?.dirty();
        });
        must.input.addEventListener("change", () => {
          if (must.checked && flagChecks.get("CannotChangePassword")?.checked) {
            messageBox("You cannot check both User must change password at next logon and User cannot change password for the same user.", { kind: "warning" });
            must.checked = false;
            return;
          }
          if (must.checked && flagChecks.get("PasswordNeverExpires")?.checked) {
            messageBox("You specified that the password should never expire. The user will not be required to change the password at next logon.", { kind: "info" });
            must.checked = false;
            return;
          }
          pending.ChangePasswordAtLogon = String(must.checked);
          S()?.dirty();
        });
        optBox.appendChild(must.el);
        const order = ["CannotChangePassword", "PasswordNeverExpires", "AllowReversiblePasswordEncryption"];
        for (const f of [...order, ...USER_FLAG_PARAMS.filter((x) => !order.includes(x))]) {
          const c = checkbox(USER_FLAG_LABELS[f], isTrue(attrs[f]), (v) => {
            if (f === "PasswordNeverExpires" && v && must.checked) {
              messageBox("You specified that the password should never expire. The user will not be required to change the password at next logon.", { kind: "info" });
              must.checked = false;
              pending.ChangePasswordAtLogon = "false";
            }
            if (f === "CannotChangePassword" && v && must.checked) {
              messageBox("You cannot check both User must change password at next logon and User cannot change password for the same user.", { kind: "warning" });
              c.checked = false;
              return;
            }
            pending[f] = String(v);
            S()?.dirty();
          });
          flagChecks.set(f, c);
          optBox.appendChild(c.el);
          if (f === "AllowReversiblePasswordEncryption") optBox.appendChild(disabledChk.el);
        }
        const expFs = fieldset("Account expires");
        const expIn = attrs.accountExpires ?? "";
        const date = textbox(expIn, { type: "date" });
        const never = radio(`exp-${u.id}`, "Never", !expIn, () => {
          date.disabled = true;
          pending.AccountExpirationDate = "";
          S()?.dirty();
        });
        const endOf = radio(`exp-${u.id}`, "End of:", !!expIn, () => {
          date.disabled = false;
          if (!date.value) date.value = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
          pending.AccountExpirationDate = date.value;
          S()?.dirty();
        });
        date.disabled = !expIn;
        date.addEventListener("change", () => {
          pending.AccountExpirationDate = date.value;
          S()?.dirty();
        });
        const endRow = el("div");
        endRow.style.cssText = "display:flex;align-items:center;gap:12px;";
        endRow.append(endOf.el, date);
        expFs.append(never.el, endRow);
        p.append(
          el("div", void 0, "User logon name:"),
          css2(grid("1fr 170px", logon, suffix), "margin:3px 0 8px;"),
          el("div", void 0, "User logon name (pre-Windows 2000):"),
          css2(grid("1fr 1fr", pre, sam), "margin-top:3px;"),
          btns,
          unlock.el,
          css2(el("div", void 0, "Account options:"), "margin:8px 0 3px;"),
          optBox,
          css2(expFs, "margin-top:10px;")
        );
      }
    };
    const profile = {
      label: "Profile",
      build: (p) => {
        const upFs = fieldset("User profile");
        upFs.appendChild(grid("100px 1fr", "Profile path:", bound(S, pending, "ProfilePath", attrs.profilePath ?? ""), "Logon script:", bound(S, pending, "ScriptPath", attrs.scriptPath ?? "")));
        const hfFs = fieldset("Home folder");
        const local = textbox(attrs.homeDrive ? "" : attrs.homeDirectory ?? "");
        const drive = select(["Z:", "Y:", "X:", "W:", "V:", "U:", "H:"], attrs.homeDrive ?? "Z:", "70px");
        const to = textbox(attrs.homeDrive ? attrs.homeDirectory ?? "" : "");
        const useLocal = radio(`hf-${u.id}`, "Local path:", !attrs.homeDrive, () => {
          local.disabled = false;
          drive.disabled = to.disabled = true;
          pending.HomeDrive = "";
          pending.HomeDirectory = local.value;
          S()?.dirty();
        });
        const connect = radio(`hf-${u.id}`, "Connect:", !!attrs.homeDrive, () => {
          local.disabled = true;
          drive.disabled = to.disabled = false;
          pending.HomeDrive = drive.value;
          pending.HomeDirectory = to.value;
          S()?.dirty();
        });
        local.disabled = !!attrs.homeDrive;
        drive.disabled = to.disabled = !attrs.homeDrive;
        local.addEventListener("input", () => {
          pending.HomeDirectory = local.value;
          S()?.dirty();
        });
        to.addEventListener("input", () => {
          pending.HomeDirectory = to.value;
          pending.HomeDrive = drive.value;
          S()?.dirty();
        });
        drive.addEventListener("change", () => {
          pending.HomeDrive = drive.value;
          S()?.dirty();
        });
        to.placeholder = "\\\\server\\share\\%username%";
        const r1 = el("div");
        r1.style.cssText = "display:grid;grid-template-columns:100px 1fr;gap:8px;align-items:center;";
        r1.append(useLocal.el, local);
        const r2 = el("div");
        r2.style.cssText = "display:grid;grid-template-columns:100px 70px 26px 1fr;gap:8px;align-items:center;margin-top:7px;";
        r2.append(connect.el, drive, el("span", void 0, "To:"), to);
        hfFs.append(r1, r2);
        p.append(upFs, css2(hfFs, "margin-top:12px;"));
      }
    };
    const telephones = {
      label: "Telephones",
      build: (p) => {
        const other = (label, attr2) => button("Other...", () => otherValues(aduc, `${label} (Others)`, replace[attr2] ?? attrs[attr2] ?? "", (v) => setReplace(attr2, v)));
        const pager = textbox(attrs.pager ?? "");
        pager.addEventListener("input", () => setReplace("pager", pager.value));
        const ip = textbox(attrs.ipPhone ?? "");
        ip.addEventListener("input", () => setReplace("ipPhone", ip.value));
        const fs = fieldset("Telephone numbers");
        fs.appendChild(grid(
          "80px 1fr 80px",
          "Home:",
          bound(S, pending, "HomePhone", attrs.homePhone ?? ""),
          other("Home Phone", "otherHomePhone"),
          "Pager:",
          pager,
          other("Pager", "otherPager"),
          "Mobile:",
          bound(S, pending, "MobilePhone", attrs.mobile ?? ""),
          other("Mobile", "otherMobile"),
          "Fax:",
          bound(S, pending, "Fax", attrs.facsimileTelephoneNumber ?? ""),
          other("Fax", "otherFacsimileTelephoneNumber"),
          "IP phone:",
          ip,
          other("IP Phone", "otherIpPhone")
        ));
        p.append(fs, css2(el("div", void 0, "Notes:"), "margin:12px 0 3px;"), area(S, (v) => replace.info = v, attrs.info ?? "", 7));
      }
    };
    const organization = {
      label: "Organization",
      build: (p) => {
        const deptBox = textbox(u.department);
        deptBox.style.width = "100%";
        deptBox.addEventListener("input", () => {
          dept = deptBox.value;
          S()?.dirty();
        });
        const mgrName = () => {
          const m = pending.Manager ?? attrs.manager ?? (u.managerId ? aduc.dir.getUser(u.managerId)?.username : "") ?? "";
          return m ? aduc.dir.getUserByUsername(m)?.displayName ?? m : "";
        };
        const mgr = textbox(mgrName(), { readOnly: true });
        mgr.style.width = "100%";
        const mfs = fieldset("Manager");
        const mbtns = el("div");
        mbtns.style.cssText = "display:flex;gap:8px;margin-top:6px;";
        mbtns.append(
          button("Change...", () => selectObjects(aduc, {
            title: "Select User or Contact",
            kinds: ["user"],
            multi: false,
            exclude: /* @__PURE__ */ new Set([`user:${u.id}`]),
            onOk: (picked) => {
              const m = picked[0]?.user;
              if (!m) return;
              pending.Manager = m.username;
              mgr.value = m.displayName;
              S()?.dirty();
            }
          })),
          button("Properties", () => {
            const m = aduc.dir.getUserByUsername(pending.Manager ?? attrs.manager ?? "") ?? (u.managerId ? aduc.dir.getUser(u.managerId) : void 0);
            if (m) userProperties(aduc, m);
          }),
          button("Clear", () => {
            pending.Manager = "";
            mgr.value = "";
            S()?.dirty();
          })
        );
        mfs.append(grid("50px 1fr", "Name:", mgr), mbtns);
        const reports = listBox([{ label: "Direct reports:", render: (x) => x.displayName, iconOf: () => "user" }], { height: "90px", onOpen: (x) => userProperties(aduc, x) });
        reports.setRows(aduc.dir.listUsers().filter((x) => x.attrs?.manager === u.username || !x.attrs?.manager && x.managerId === u.id));
        p.append(
          grid("90px 1fr", "Job Title:", bound(S, pending, "Title", u.title), "Department:", deptBox, "Company:", bound(S, pending, "Company", attrs.company ?? "")),
          css2(mfs, "margin-top:12px;"),
          css2(el("div", void 0, "Direct reports:"), "margin:10px 0 3px;"),
          reports.el
        );
      }
    };
    const memberOf = {
      label: "Member Of",
      build: (p) => {
        const rows2 = () => {
          const out = [{ key: "primary", name: "Domain Users", folder: `${DOMAIN}/Users` }];
          for (const g2 of aduc.dir.listGroups()) {
            if (g2.name === "Domain Users" || !g2.memberIds.includes(u.id) || removeGroups.has(g2.id)) continue;
            out.push({ key: g2.id, name: g2.name, folder: canonicalOf(homeOf(g2), aduc.dir) });
          }
          for (const a of addGroups) out.push({ key: a.key, name: a.name, folder: a.group ? canonicalOf(homeOf(a.group), aduc.dir) : `${DOMAIN}/Users`, obj: a });
          return out;
        };
        const lb = listBox([
          { label: "Name", render: (r) => r.name, width: "40%", iconOf: () => "group" },
          { label: "Active Directory Domain Services Folder", render: (r) => r.folder }
        ], { height: "230px", multi: true });
        lb.setRows(rows2());
        const add = button("Add...", () => selectObjects(aduc, {
          title: "Select Groups",
          kinds: ["group"],
          multi: true,
          exclude: new Set(rows2().map((r) => r.obj ? r.obj.key : `group:${r.key}`)),
          onOk: (picked) => {
            for (const g2 of picked) {
              if (g2.group && removeGroups.has(g2.group.id)) removeGroups.delete(g2.group.id);
              else if (!addGroups.some((a) => a.key === g2.key)) addGroups.push(g2);
            }
            lb.setRows(rows2());
            S()?.dirty();
          }
        }));
        const rm = button("Remove", () => {
          const sel = lb.selected();
          if (!sel.length) return;
          if (sel.some((r) => r.key === "primary")) {
            messageBox("The primary group cannot be removed. Set another group as primary if you want to remove this one.", { kind: "error" });
            return;
          }
          messageBox(`Do you want to remove ${u.displayName} from the selected group(s)?`, {
            kind: "question",
            yesNo: true,
            onYes: () => {
              for (const r of sel) {
                const i = addGroups.findIndex((a) => a.key === r.key);
                if (i >= 0) addGroups.splice(i, 1);
                else removeGroups.add(r.key);
              }
              lb.setRows(rows2());
              S()?.dirty();
            }
          });
        });
        const btns = el("div");
        btns.style.cssText = "display:flex;gap:8px;margin:8px 0;";
        btns.append(add, rm);
        const primary = el("div");
        primary.style.cssText = "display:grid;grid-template-columns:110px 1fr;row-gap:8px;align-items:center;";
        primary.append(el("span", void 0, "Primary group:"), el("span", void 0, "Domain Users"), button("Set Primary Group", () => void 0, { disabled: true }), css2(el("span", "ad-note", "There is no need to change Primary group unless you have Macintosh clients or POSIX-compliant applications."), "padding-left:10px;"));
        p.append(el("div", void 0, "Member of:"), lb.el, btns, hr(), primary);
      }
    };
    const dialIn = {
      label: "Dial-in",
      build: (p) => {
        const cur = attrs.msNPAllowDialin;
        const fs = fieldset("Network Access Permission");
        fs.append(
          radio(`nap-${u.id}`, "Allow access", cur === "TRUE", () => setReplace("msNPAllowDialin", "TRUE")).el,
          radio(`nap-${u.id}`, "Deny access", cur === "FALSE", () => setReplace("msNPAllowDialin", "FALSE")).el,
          radio(`nap-${u.id}`, "Control access through NPS Network Policy", !cur, () => setReplace("msNPAllowDialin", void 0)).el
        );
        const verify = checkbox("Verify Caller-ID:", false);
        const cb = fieldset("Callback Options");
        const cbv = attrs.msRADIUSServiceType ?? "";
        cb.append(
          radio(`cb-${u.id}`, "No Callback", !cbv, () => setReplace("msRADIUSServiceType", void 0)).el,
          radio(`cb-${u.id}`, "Set by Caller (Routing and Remote Access Service only)", cbv === "4", () => setReplace("msRADIUSServiceType", "4")).el,
          radio(`cb-${u.id}`, "Always Callback to:", cbv === "3", () => setReplace("msRADIUSServiceType", "3")).el
        );
        const ip = checkbox("Assign Static IP Addresses", false);
        const routes = checkbox("Apply Static Routes", false);
        p.append(fs, css2(verify.el, "margin:8px 0;"), cb, css2(ip.el, "margin-top:8px;"), routes.el, css2(el("div", "ad-note", "Define routes to enable for this Dial-in connection."), "margin-left:18px;"));
      }
    };
    const environment = {
      label: "Environment",
      build: (p) => {
        p.appendChild(el("div", "ad-note", "Use this tab to configure the Remote Desktop Services startup environment. These settings override client-specified settings."));
        const sp = fieldset("Starting program");
        const start = checkbox("Start the following program at logon:", !!attrs.msTSInitialProgram);
        const prog = textbox(attrs.msTSInitialProgram ?? "");
        const dir_ = textbox(attrs.msTSWorkDirectory ?? "");
        prog.addEventListener("input", () => setReplace("msTSInitialProgram", prog.value));
        dir_.addEventListener("input", () => setReplace("msTSWorkDirectory", dir_.value));
        sp.append(start.el, grid("130px 1fr", "Program file name:", prog, "Start in:", dir_));
        const cd = fieldset("Client devices");
        cd.append(checkbox("Connect client drives at logon", true).el, checkbox("Connect client printers at logon", true).el, checkbox("Default to main client printer", true).el);
        p.append(css2(sp, "margin-top:10px;"), css2(cd, "margin-top:10px;"));
      }
    };
    const sessions = {
      label: "Sessions",
      build: (p) => {
        const limits = ["Never", "1 minute", "5 minutes", "10 minutes", "15 minutes", "30 minutes", "1 hour", "2 hours", "1 day", "2 days"];
        const sel = (attr2) => {
          const s = select(limits, attrs[attr2] ?? "Never", "100%");
          s.addEventListener("change", () => setReplace(attr2, s.value === "Never" ? void 0 : s.value));
          return s;
        };
        p.appendChild(el("div", "ad-note", "Use this tab to set Remote Desktop Services timeout and reconnection settings."));
        p.appendChild(css2(grid("170px 1fr", "End a disconnected session:", sel("msTSMaxDisconnectionTime"), "Active session limit:", sel("msTSMaxConnectionTime"), "Idle session limit:", sel("msTSMaxIdleTime")), "margin-top:12px;"));
        const lim = fieldset("When a session limit is reached or connection is broken:");
        lim.append(radio(`sl-${u.id}`, "Disconnect from session", true).el, radio(`sl-${u.id}`, "End session", false).el);
        const rec = fieldset("Allow reconnection:");
        rec.append(radio(`rc-${u.id}`, "From any client", true).el, radio(`rc-${u.id}`, "From originating client only", false).el);
        p.append(css2(lim, "margin-top:12px;"), css2(rec, "margin-top:10px;"));
      }
    };
    const remoteControl = {
      label: "Remote control",
      build: (p) => {
        p.appendChild(el("div", "ad-note", "Use this tab to configure Remote Desktop Services remote control settings. To remotely control or observe a user's session, select the following check box:"));
        const en = checkbox("Enable remote control", true);
        const req = checkbox("Require user's permission", true);
        const lvl = fieldset("Level of control");
        lvl.append(radio(`rcl-${u.id}`, "View the user's session", false).el, radio(`rcl-${u.id}`, "Interact with the session", true).el);
        p.append(css2(en.el, "margin-top:10px;"), css2(req.el, "margin-left:18px;"), css2(lvl, "margin:8px 0 0 18px;"));
      }
    };
    const rdsProfile = {
      label: "Remote Desktop Services Profile",
      build: (p) => {
        p.appendChild(el("div", "ad-note", "Use this tab to configure the Remote Desktop Services user profile. Settings in this profile apply to Remote Desktop Services."));
        const prof = fieldset("Remote Desktop Services User Profile");
        const pp = textbox(attrs.msTSProfilePath ?? "");
        pp.addEventListener("input", () => setReplace("msTSProfilePath", pp.value));
        prof.appendChild(grid("80px 1fr", "Profile Path:", pp));
        const hf = fieldset("Remote Desktop Services Home Folder");
        const hp = textbox(attrs.msTSHomeDirectory ?? "");
        hp.addEventListener("input", () => setReplace("msTSHomeDirectory", hp.value));
        hf.append(radio(`rdh-${u.id}`, "Local path:", true).el, hp);
        const deny = checkbox("Deny this user permissions to log on to Remote Desktop Session Host server", attrs.msTSAllowLogon === "FALSE", (v) => setReplace("msTSAllowLogon", v ? "FALSE" : void 0));
        p.append(css2(prof, "margin-top:10px;"), css2(hf, "margin-top:10px;"), css2(deny.el, "margin-top:10px;"));
      }
    };
    const complus = {
      label: "COM+",
      build: (p) => {
        const s = select(["<none>"], "<none>", "100%");
        p.append(css2(el("div", void 0, "Make this user a member of the following COM+ partition set:"), "margin-bottom:6px;"), grid("90px 1fr", "Partition Set:", s));
      }
    };
    const pwdRepl = {
      label: "Password Replication",
      build: (p) => {
        p.appendChild(el("div", "ad-note", "This is a Password Replication Policy for Read-only Domain Controllers (RODCs). An RODC stores user or computer passwords only if they are in the Allow group."));
        const lb = listBox([{ label: "Groups, users and computers", render: (r) => r[0], iconOf: () => "group" }, { label: "Setting", render: (r) => r[1] }], { height: "200px" });
        lb.setRows([["Account Operators", "Deny"], ["Administrators", "Deny"], ["Allowed RODC Password Replication Group", "Allow"], ["Backup Operators", "Deny"], ["Denied RODC Password Replication Group", "Deny"], ["Server Operators", "Deny"]]);
        p.append(css2(lb.el, "margin-top:8px;"));
      }
    };
    const certs = {
      label: "Published Certificates",
      build: (p) => {
        const lb = listBox([{ label: "Issued To", render: (s) => s }, { label: "Issued By", render: () => "" }, { label: "Intended Purposes", render: () => "" }, { label: "Expiration Date", render: () => "" }], { height: "220px" });
        lb.setRows([]);
        const b = el("div");
        b.style.cssText = "display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;";
        b.append(button("Add from Store...", () => void 0, { disabled: true }), button("Add from File...", () => void 0, { disabled: true }), button("Remove", () => void 0, { disabled: true }), button("Copy to File...", () => void 0, { disabled: true }));
        p.append(el("div", void 0, "List of X509 certificates published for the user account"), css2(lb.el, "margin-top:4px;"), b);
      }
    };
    let protect;
    const object = objectTab(aduc, S, {
      canonical: `${canonicalOf(homeOf(u), aduc.dir)}/${u.displayName}`,
      cls: "User",
      created: u.createdAt,
      id: u.id,
      protectedNow: isTrue(attrs.ProtectedFromAccidentalDeletion),
      onProtect: (v) => protect = v
    });
    const security = securityTab(aduc, u.displayName, "user", homeOf(u));
    const attrEditor = attributeEditorTab(aduc, () => {
      const cur = aduc.dir.getUser(u.id) ?? u;
      return userAttributeRows(aduc, cur, { ...cur.attrs ?? {}, ...Object.fromEntries(Object.entries(replace).map(([k, v]) => [k, v ?? ""])) });
    }, (k, v) => replace[k] = v, S);
    const rows = advanced ? [[certs, memberOf, pwdRepl, dialIn, object], [security, environment, sessions, remoteControl], [rdsProfile, complus, attrEditor], [general, address, account, profile, telephones, organization]] : [[memberOf, pwdRepl, dialIn, environment], [sessions, remoteControl, rdsProfile, complus], [general, address, account, profile, telephones, organization]];
    sheet = openSheet(aduc, `user:${u.id}`, `${u.displayName} Properties`, rows, initialTab, advanced ? 520 : 470);
    if (!sheet) return;
    sheet.onApply(() => {
      let identity = u.username;
      const args = { ...pending };
      const rep = Object.entries(replace).filter(([, v]) => v !== void 0 && v !== "");
      const clr = Object.entries(replace).filter(([, v]) => v === void 0 || v === "").map(([k]) => k);
      if (protect !== void 0) {
        if (protect) rep.push(["ProtectedFromAccidentalDeletion", "TRUE"]);
        else clr.push("ProtectedFromAccidentalDeletion");
      }
      if (rep.length) args.Replace = rep.map(([k, v]) => `${k}=${v.replace(/;/g, ",")}`).join(";");
      if (clr.length) args.Clear = clr.join(",");
      if (args.Manager === "") {
        delete args.Manager;
        args.Clear = [args.Clear, "manager"].filter(Boolean).join(",");
      }
      if (Object.keys(args).length) {
        const r = aduc.run("user.update", { Identity: identity, ...args });
        if (!r.ok) return false;
        identity = pending.SamAccountName?.trim() || identity;
      }
      if (dept !== void 0 && dept.trim() && dept.trim() !== u.department) {
        if (!aduc.run("user.move", { Identity: identity, TargetDepartment: dept.trim() }).ok) return false;
      }
      if (enable !== void 0 && enable !== (u.status !== "disabled")) {
        if (!aduc.run(enable ? "user.enable" : "user.disable", { Identity: identity }).ok) return false;
      }
      if (doUnlock && u.status === "locked") aduc.run("account.unlock", { Identity: identity });
      const cur = aduc.dir.getUserByUsername(identity);
      if (cur && addGroups.length) addUsersToGroupsQuiet(aduc, cur, addGroups);
      for (const gid of removeGroups) {
        const g2 = aduc.dir.getGroup(gid);
        if (g2) aduc.run("group.removeMember", { Identity: identity, Group: g2.name });
      }
      for (const k of Object.keys(pending)) delete pending[k];
      for (const k of Object.keys(replace)) delete replace[k];
      addGroups.length = 0;
      removeGroups.clear();
      dept = void 0;
      enable = void 0;
      doUnlock = false;
      protect = void 0;
      return true;
    });
  }
  function addUsersToGroupsQuiet(aduc, u, groups) {
    for (const go of groups) {
      const g2 = materializeGroup(aduc, go);
      if (g2 && !g2.memberIds.includes(u.id)) aduc.run("group.addMember", { Identity: u.username, Group: g2.name });
    }
  }
  function userAttributeRows(aduc, u, attrs) {
    const dir = aduc.dir;
    const uac = userAccountControl(attrs, u.status);
    const groups = dir.listGroups().filter((g2) => g2.memberIds.includes(u.id));
    const mgr = attrs.manager ? dir.getUserByUsername(attrs.manager) : u.managerId ? dir.getUser(u.managerId) : void 0;
    const flagNames = /* @__PURE__ */ new Set([...USER_FLAG_PARAMS, "ProtectedFromAccidentalDeletion"]);
    const known = [
      { name: "accountExpires", value: attrs.accountExpires ? `${attrs.accountExpires} 11:59:59 PM` : "(never)" },
      { name: "badPwdCount", value: "0" },
      { name: "cn", value: u.displayName },
      { name: "department", value: u.department },
      { name: "displayName", value: u.displayName },
      { name: "distinguishedName", value: userDn(dir, u) },
      { name: "instanceType", value: "0x4 = ( WRITE )" },
      { name: "mail", value: u.email },
      { name: "manager", value: mgr ? userDn(dir, mgr) : "" },
      { name: "memberOf", value: groups.map((g2) => groupDn(dir, g2)).join("; ") },
      { name: "name", value: u.displayName },
      { name: "objectCategory", value: `CN=Person,CN=Schema,CN=Configuration,${DOMAIN_DN}` },
      { name: "objectClass", value: "top; person; organizationalPerson; user" },
      { name: "objectGUID", value: guidFor(u.id) },
      { name: "objectSid", value: sidFor(u.id, u.username, aduc.dir.domainName) },
      { name: "primaryGroupID", value: "513 = ( GROUP_RID_USERS )" },
      { name: "pwdLastSet", value: u.mustChangePassword ? "0" : new Date(u.createdAt).toLocaleString() },
      { name: "sAMAccountName", value: u.username },
      { name: "sAMAccountType", value: "805306368 = ( NORMAL_USER_ACCOUNT )" },
      { name: "title", value: u.title },
      { name: "userAccountControl", value: `0x${uac.value.toString(16)} = ( ${uac.names.join(" | ")} )` },
      { name: "userPrincipalName", value: `${u.username}@${DOMAIN}` },
      { name: "whenChanged", value: fileTime(Date.now()) },
      { name: "whenCreated", value: fileTime(u.createdAt) }
    ];
    const seen = new Set(known.map((k) => k.name.toLowerCase()));
    const extra = Object.entries(attrs).filter(([k]) => !flagNames.has(k) && !seen.has(k.toLowerCase())).map(([k, v]) => ({ name: k, value: k === "manager" ? "" : v, editable: true }));
    const editableEmpty = ["physicalDeliveryOfficeName", "telephoneNumber", "description", "givenName", "sn", "initials", "company", "streetAddress", "l", "st", "postalCode", "wWWHomePage", "info", "employeeID", "employeeNumber", "employeeType", "extensionAttribute1"].filter((k) => !attrs[k]).map((k) => ({ name: k, value: "", editable: true }));
    return [...known, ...extra, ...editableEmpty];
  }
  function logonHoursDialog(aduc, current, onOk) {
    const cells = (current && current.length === 168 ? current : "1".repeat(168)).split("").map((c) => c === "1");
    const d = openDialog({
      title: `Logon Hours`,
      width: 620,
      modal: true,
      owner: aduc.owner,
      buttons: [
        { label: "OK", primary: true, onClick: () => onOk(cells.every(Boolean) ? "" : cells.map((c) => c ? "1" : "0").join("")) },
        { label: "Cancel", cancel: true }
      ]
    });
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const wrap = el("div");
    wrap.style.cssText = "display:grid;grid-template-columns:80px 1fr 120px;gap:10px;";
    const labels = el("div");
    labels.style.cssText = "display:flex;flex-direction:column;gap:1px;padding-top:20px;";
    const g2 = el("div");
    g2.style.cssText = "display:grid;grid-template-columns:repeat(24,1fr);gap:1px;";
    const head2 = el("div");
    head2.style.cssText = "display:grid;grid-template-columns:repeat(24,1fr);font-size:10px;color:#444;height:18px;";
    for (let h = 0; h < 24; h++) head2.appendChild(el("span", void 0, h % 6 === 0 ? `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "AM" : "PM"}` : ""));
    const cellEls = [];
    let painting = null;
    const paint = () => cellEls.forEach((c, i) => c.classList.toggle("on", cells[i]));
    for (let day = 0; day < 7; day++) {
      labels.appendChild(css2(el("div", void 0, days[day]), "height:18px;line-height:18px;"));
      for (let h = 0; h < 24; h++) {
        const i = day * 24 + h;
        const c = el("div", "ad-hour");
        c.addEventListener("mousedown", (e) => {
          e.preventDefault();
          painting = !cells[i];
          cells[i] = painting;
          paint();
        });
        c.addEventListener("mouseenter", () => {
          if (painting === null) return;
          cells[i] = painting;
          paint();
        });
        cellEls.push(c);
        g2.appendChild(c);
      }
    }
    document.addEventListener("mouseup", () => painting = null);
    const gridWrap = el("div");
    gridWrap.append(head2, g2);
    const side = el("div");
    side.style.cssText = "display:flex;flex-direction:column;gap:6px;padding-top:20px;";
    side.append(
      radio("lh", "Logon Permitted", true).el,
      radio("lh", "Logon Denied", false).el,
      button("All permitted", () => {
        cells.fill(true);
        paint();
      }),
      button("Weekdays 8-6", () => {
        cells.fill(false);
        for (let d_ = 1; d_ <= 5; d_++) for (let h = 8; h < 18; h++) cells[d_ * 24 + h] = true;
        paint();
      })
    );
    wrap.append(labels, gridWrap, side);
    d.body.appendChild(wrap);
    d.body.appendChild(css2(el("div", "ad-note", "Drag across the grid to permit (blue) or deny (white) hours. Stored in the logonHours attribute."), "margin-top:10px;"));
    paint();
  }
  function logOnToDialog(aduc, current, onOk) {
    const list = current ? current.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const d = openDialog({ title: "Logon Workstations", width: 420, modal: true, owner: aduc.owner, buttons: [{ label: "OK", primary: true, onClick: () => onOk(all.checked ? "" : list.join(",")) }, { label: "Cancel", cancel: true }] });
    d.body.appendChild(el("div", "ad-note", "In Computer name, type the computer's NetBIOS or Domain Name System (DNS) name."));
    const fs = fieldset("This user can log on to:");
    const all = radio("lot", "All computers", list.length === 0);
    const some = radio("lot", "The following computers", list.length > 0);
    const name = textbox("");
    const lb = listBox([{ label: "Computers", render: (s) => s, iconOf: () => "computer" }], { height: "100px" });
    lb.setRows(list);
    const add = button("Add", () => {
      if (name.value.trim()) {
        list.push(name.value.trim().toUpperCase());
        name.value = "";
        lb.setRows([...list]);
        some.checked = true;
      }
    });
    const rm = button("Remove", () => {
      for (const s of lb.selected()) list.splice(list.indexOf(s), 1);
      lb.setRows([...list]);
    });
    fs.append(all.el, some.el, grid("110px 1fr 70px", "Computer name:", name, add), css2(lb.el, "margin-top:6px;"), css2(rm, "margin-top:6px;"));
    d.body.appendChild(css2(fs, "margin-top:8px;"));
  }
  function groupProperties(aduc, g2, initialTab = "General") {
    const advanced = aduc.advanced();
    let sheet = null;
    const S = () => sheet;
    const attrs = g2.attrs ?? {};
    let desc;
    let scope;
    let category;
    const replace = {};
    const addMembers = [];
    const removeMembers = /* @__PURE__ */ new Set();
    let managedBy;
    let protect;
    const general = {
      label: "General",
      build: (p) => {
        const pre = textbox(attrs.sAMAccountName ?? g2.name);
        pre.style.width = "100%";
        pre.addEventListener("input", () => {
          replace.sAMAccountName = pre.value;
          S()?.dirty();
        });
        const d_ = textbox(g2.description);
        d_.style.width = "100%";
        d_.addEventListener("input", () => {
          desc = d_.value;
          S()?.dirty();
        });
        const mail = textbox(attrs.mail ?? "");
        mail.style.width = "100%";
        mail.addEventListener("input", () => {
          replace.mail = mail.value;
          S()?.dirty();
        });
        const cur = g2.scope ?? "Global";
        const scFs = fieldset("Group scope");
        const opt = (label, value) => {
          const r = radio(`gs-${g2.id}`, label, cur === value, () => {
            scope = value;
            S()?.dirty();
          });
          if (!scopeChangeAllowed(cur, value)) r.setDisabled(true);
          return r.el;
        };
        scFs.append(opt("Domain local", "DomainLocal"), opt("Global", "Global"), opt("Universal", "Universal"));
        const tyFs = fieldset("Group type");
        const ct = g2.category ?? "Security";
        tyFs.append(
          radio(`gt-${g2.id}`, "Security", ct === "Security", () => {
            category = "Security";
            S()?.dirty();
          }).el,
          radio(`gt-${g2.id}`, "Distribution", ct === "Distribution", () => {
            category = "Distribution";
            S()?.dirty();
          }).el
        );
        const cols = el("div");
        cols.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;";
        cols.append(scFs, tyFs);
        p.append(
          nameHeader("group", g2.name),
          grid("150px 1fr", "Group name (pre-Windows 2000):", pre),
          hr(),
          grid("90px 1fr", "Description:", d_, "E-mail:", mail),
          cols,
          css2(el("div", void 0, "Notes:"), "margin:10px 0 3px;"),
          area(S, (v) => replace.info = v, attrs.info ?? "", 4)
        );
      }
    };
    const members = {
      label: "Members",
      build: (p) => {
        const rows2 = () => [
          ...g2.memberIds.filter((id) => !removeMembers.has(id)).map((id) => aduc.dir.getUser(id)).filter((u) => !!u),
          ...addMembers
        ];
        const lb = listBox([
          { label: "Name", render: (u) => u.displayName, width: "40%", iconOf: (u) => u.status === "disabled" ? "userDisabled" : "user" },
          { label: "Active Directory Domain Services Folder", render: (u) => canonicalOf(homeOf(u), aduc.dir) }
        ], { height: "300px", multi: true, onOpen: (u) => userProperties(aduc, u) });
        lb.setRows(rows2());
        const add = button("Add...", () => selectObjects(aduc, {
          title: "Select Users, Contacts, Computers, Service Accounts, or Groups",
          kinds: ["user"],
          multi: true,
          exclude: new Set(rows2().map((u) => `user:${u.id}`)),
          onOk: (picked) => {
            for (const o of picked) {
              if (!o.user) continue;
              if (removeMembers.has(o.user.id)) removeMembers.delete(o.user.id);
              else if (!g2.memberIds.includes(o.user.id)) addMembers.push(o.user);
            }
            lb.setRows(rows2());
            S()?.dirty();
          }
        }));
        const rm = button("Remove", () => {
          const sel = lb.selected();
          if (!sel.length) return;
          messageBox("Do you want to remove the selected member(s) from the group?", {
            kind: "question",
            yesNo: true,
            onYes: () => {
              for (const u of sel) {
                const i = addMembers.indexOf(u);
                if (i >= 0) addMembers.splice(i, 1);
                else removeMembers.add(u.id);
              }
              lb.setRows(rows2());
              S()?.dirty();
            }
          });
        });
        const b = el("div");
        b.style.cssText = "display:flex;gap:8px;margin-top:8px;";
        b.append(add, rm);
        p.append(el("div", void 0, "Members:"), lb.el, b);
      }
    };
    const memberOf = {
      label: "Member Of",
      build: (p) => {
        const lb = listBox([{ label: "Name", render: (s) => s, width: "40%" }, { label: "Active Directory Domain Services Folder", render: () => "" }], { height: "300px" });
        lb.setRows([]);
        const b = el("div");
        b.style.cssText = "display:flex;gap:8px;margin-top:8px;";
        b.append(
          button("Add...", () => messageBox("Group nesting (AGDLP: accounts into Global groups, Global groups into Domain Local groups) is not modelled in this lab directory. Grant access by adding accounts to the group that holds the permission.", { kind: "info" })),
          button("Remove", () => void 0, { disabled: true })
        );
        p.append(el("div", void 0, "Member of:"), lb.el, b);
      }
    };
    const managed = managedByTab(aduc, S, attrs.managedBy, (v) => managedBy = v);
    const object = objectTab(aduc, S, {
      canonical: `${canonicalOf(homeOf(g2), aduc.dir)}/${g2.name}`,
      cls: "Group",
      id: g2.id,
      protectedNow: isTrue(attrs.ProtectedFromAccidentalDeletion),
      onProtect: (v) => protect = v
    });
    const security = securityTab(aduc, g2.name, "group", homeOf(g2));
    const attrEditor = attributeEditorTab(aduc, () => {
      const a = { ...aduc.dir.getGroup(g2.id)?.attrs ?? {}, ...Object.fromEntries(Object.entries(replace).map(([k, v]) => [k, v ?? ""])) };
      const scopeCode = { Global: "0x80000002 = ( GROUP_TYPE_ACCOUNT_GROUP | GROUP_TYPE_SECURITY_ENABLED )", DomainLocal: "0x80000004 = ( GROUP_TYPE_RESOURCE_GROUP | GROUP_TYPE_SECURITY_ENABLED )", Universal: "0x80000008 = ( GROUP_TYPE_UNIVERSAL_GROUP | GROUP_TYPE_SECURITY_ENABLED )" }[g2.scope ?? "Global"];
      const rows2 = [
        { name: "cn", value: g2.name },
        { name: "description", value: g2.description },
        { name: "distinguishedName", value: groupDn(aduc.dir, g2) },
        { name: "groupType", value: g2.category === "Distribution" ? scopeCode.replace(" | GROUP_TYPE_SECURITY_ENABLED", "").replace("0x8000000", "0x") : scopeCode },
        { name: "member", value: g2.memberIds.map((id) => aduc.dir.getUser(id)).filter((u) => !!u).map((u) => userDn(aduc.dir, u)).join("; ") },
        { name: "name", value: g2.name },
        { name: "objectClass", value: "top; group" },
        { name: "objectGUID", value: guidFor(g2.id) },
        { name: "objectSid", value: sidFor(g2.id, g2.name, aduc.dir.domainName) },
        { name: "sAMAccountName", value: a.sAMAccountName ?? g2.name },
        { name: "mail", value: a.mail ?? "", editable: true },
        { name: "info", value: a.info ?? "", editable: true },
        { name: "managedBy", value: a.managedBy ? aduc.dir.getUserByUsername(a.managedBy) ? userDn(aduc.dir, aduc.dir.getUserByUsername(a.managedBy)) : a.managedBy : "" }
      ];
      return rows2;
    }, (k, v) => replace[k] = v, S);
    const rows = advanced ? [[object, security, attrEditor], [general, members, memberOf, managed]] : [[general, members, memberOf, managed]];
    sheet = openSheet(aduc, `group:${g2.id}`, `${g2.name} Properties`, rows, initialTab, 460);
    if (!sheet) return;
    sheet.onApply(() => {
      const args = {};
      if (desc !== void 0) args.Description = desc;
      if (scope && scope !== (g2.scope ?? "Global")) args.GroupScope = scope;
      if (category && category !== (g2.category ?? "Security")) args.GroupCategory = category;
      if (managedBy !== void 0) args.ManagedBy = managedBy;
      const rep = Object.entries(replace).filter(([, v]) => v);
      const clr = Object.entries(replace).filter(([, v]) => !v).map(([k]) => k);
      if (protect !== void 0) {
        if (protect) rep.push(["ProtectedFromAccidentalDeletion", "TRUE"]);
        else clr.push("ProtectedFromAccidentalDeletion");
      }
      if (rep.length) args.Replace = rep.map(([k, v]) => `${k}=${v.replace(/;/g, ",")}`).join(";");
      if (clr.length) args.Clear = clr.join(",");
      if (desc === "") {
        delete args.Description;
        args.Clear = [args.Clear, "description"].filter(Boolean).join(",");
      }
      if (Object.keys(args).length && !aduc.run("group.update", { Identity: g2.name, ...args }).ok) return false;
      for (const u of addMembers) aduc.run("group.addMember", { Identity: u.username, Group: g2.name });
      for (const id of removeMembers) {
        const u = aduc.dir.getUser(id);
        if (u) aduc.run("group.removeMember", { Identity: u.username, Group: g2.name });
      }
      addMembers.length = 0;
      removeMembers.clear();
      for (const k of Object.keys(replace)) delete replace[k];
      desc = scope = category = managedBy = void 0;
      protect = void 0;
      return true;
    });
  }
  function managedByTab(aduc, S, current, set) {
    return {
      label: "Managed By",
      build: (p) => {
        const who = () => cur ? aduc.dir.getUserByUsername(cur) : void 0;
        let cur = current;
        const name = textbox(who()?.displayName ?? "", { readOnly: true });
        name.style.width = "100%";
        const fields = {
          office: textbox("", { readOnly: true }),
          street: document.createElement("textarea"),
          city: textbox("", { readOnly: true }),
          state: textbox("", { readOnly: true }),
          country: textbox("", { readOnly: true }),
          phone: textbox("", { readOnly: true }),
          fax: textbox("", { readOnly: true })
        };
        fields.street.readOnly = true;
        fields.street.rows = 2;
        const fill = () => {
          const u = who();
          const a = u?.attrs ?? {};
          name.value = u?.displayName ?? "";
          fields.office.value = a.physicalDeliveryOfficeName ?? "";
          fields.street.value = a.streetAddress ?? "";
          fields.city.value = a.l ?? "";
          fields.state.value = a.st ?? "";
          fields.country.value = a.c ?? "";
          fields.phone.value = a.telephoneNumber ?? "";
          fields.fax.value = a.facsimileTelephoneNumber ?? "";
        };
        const btns = el("div");
        btns.style.cssText = "display:flex;gap:8px;margin:6px 0 10px 90px;";
        btns.append(
          button("Change...", () => selectObjects(aduc, {
            title: "Select User, Contact, or Group",
            kinds: ["user"],
            multi: false,
            onOk: (picked) => {
              if (!picked[0]?.user) return;
              cur = picked[0].user.username;
              set(cur);
              fill();
              S()?.dirty();
            }
          })),
          button("Properties", () => {
            const u = who();
            if (u) userProperties(aduc, u);
          }),
          button("Clear", () => {
            cur = void 0;
            set("");
            fill();
            S()?.dirty();
          })
        );
        const canUpdate = checkbox("Manager can update membership list", false);
        p.append(
          grid("90px 1fr", "Name:", name),
          btns,
          canUpdate.el,
          css2(grid("90px 1fr", "Office:", fields.office, "Street:", fields.street, "City:", fields.city, "State/province:", fields.state, "Country/region:", fields.country, "Telephone number:", fields.phone, "Fax number:", fields.fax), "margin-top:10px;")
        );
        fill();
      }
    };
  }
  function ouProperties(aduc, ou, initialTab = "General") {
    const advanced = aduc.advanced();
    let sheet = null;
    const S = () => sheet;
    const pending = {};
    let protect;
    let managedBy;
    const a = ou.attrs ?? {};
    const general = {
      label: "General",
      build: (p) => {
        const street = area(S, (v) => pending.StreetAddress = v, a.street ?? "", 3);
        const country = select(COUNTRIES, a.c ?? "");
        country.style.width = "100%";
        country.addEventListener("change", () => {
          pending.Country = country.value;
          S()?.dirty();
        });
        p.append(
          nameHeader("ou", ou.name),
          grid("110px 1fr", "Description:", bound(S, pending, "Description", ou.description)),
          hr(),
          grid("110px 1fr", "Street:", street, "City:", bound(S, pending, "City", a.l ?? ""), "State/province:", bound(S, pending, "State", a.st ?? ""), "Zip/Postal Code:", bound(S, pending, "PostalCode", a.postalCode ?? ""), "Country/region:", country)
        );
      }
    };
    const managed = managedByTab(aduc, S, a.managedBy, (v) => managedBy = v);
    const complus = { label: "COM+", build: (p) => p.append(css2(el("div", void 0, "Link this organizational unit to the following COM+ partition set:"), "margin-bottom:6px;"), grid("90px 1fr", "Partition Set:", select(["<none>"], "<none>", "100%"))) };
    const object = objectTab(aduc, S, {
      canonical: `${DOMAIN}/${aduc.dir.ouPath(ou.id)}`,
      cls: "Organizational Unit",
      created: ou.createdAt,
      id: ou.id,
      protectedNow: !!ou.protectedFromDeletion,
      onProtect: (v) => protect = v
    });
    const security = securityTab(aduc, ou.name, "ou", `ou:${ou.id}`);
    const attrEditor = attributeEditorTab(aduc, () => [
      { name: "description", value: ou.description },
      { name: "distinguishedName", value: ouDn(aduc.dir, ou.id) },
      { name: "gPLink", value: "" },
      { name: "instanceType", value: "0x4 = ( WRITE )" },
      { name: "l", value: a.l ?? "" },
      { name: "name", value: ou.name },
      { name: "objectCategory", value: `CN=Organizational-Unit,CN=Schema,CN=Configuration,${DOMAIN_DN}` },
      { name: "objectClass", value: "top; organizationalUnit" },
      { name: "objectGUID", value: guidFor(ou.id) },
      { name: "ou", value: ou.name },
      { name: "postalCode", value: a.postalCode ?? "" },
      { name: "st", value: a.st ?? "" },
      { name: "street", value: a.street ?? "" },
      { name: "whenCreated", value: fileTime(ou.createdAt) }
    ], () => void 0, S);
    const rows = advanced ? [[object, security, attrEditor], [general, managed, complus]] : [[general, managed, complus]];
    sheet = openSheet(aduc, `ou:${ou.id}`, `${ou.name} Properties`, rows, initialTab, 430);
    if (!sheet) return;
    sheet.onApply(() => {
      const args = { ...pending };
      if (protect !== void 0) args.ProtectedFromAccidentalDeletion = String(protect);
      if (managedBy !== void 0) args.ManagedBy = managedBy;
      if (args.Description === "") {
        delete args.Description;
        args.Clear = "description";
      }
      if (Object.keys(args).length && !aduc.run("ou.update", { Identity: aduc.dir.ouPath(ou.id), ...args }).ok) return false;
      for (const k of Object.keys(pending)) delete pending[k];
      protect = void 0;
      managedBy = void 0;
      return true;
    });
  }
  function readOnlyProperties(aduc, o) {
    const ro = (v) => {
      const t = textbox(v, { readOnly: true });
      t.style.width = "100%";
      return t;
    };
    if (o.computer) {
      const c = o.computer;
      const general2 = {
        label: "General",
        build: (p) => p.append(
          nameHeader("computer", c.name),
          grid("170px 1fr", "Computer name (pre-Windows 2000):", ro(c.name), "DNS name:", ro(`${c.name}.${DOMAIN}`.toLowerCase()), "DC Type:", ro(c.role === "Domain controller" ? "GC" : "Workstation or server"), "Site:", ro(c.role === "Domain controller" ? "Default-First-Site-Name" : ""), "Description:", ro(c.description)),
          css2(checkbox("Trust computer for delegation", c.role === "Domain controller").el, "margin-top:12px;")
        )
      };
      const os = { label: "Operating System", build: (p) => p.appendChild(grid("100px 1fr", "Name:", ro(c.os), "Version:", ro(c.osVersion), "Service pack:", ro(""))) };
      const mo = {
        label: "Member Of",
        build: (p) => {
          const lb = listBox([{ label: "Name", render: (r) => r[0], iconOf: () => "group" }, { label: "Active Directory Domain Services Folder", render: (r) => r[1] }], { height: "240px" });
          lb.setRows(c.role === "Domain controller" ? [["Domain Controllers", `${DOMAIN}/Users`]] : [["Domain Computers", `${DOMAIN}/Users`]]);
          p.append(el("div", void 0, "Member of:"), lb.el);
        }
      };
      const loc = { label: "Location", build: (p) => p.appendChild(grid("70px 1fr", "Location:", ro(""))) };
      const deleg = { label: "Delegation", build: (p) => p.append(el("div", "ad-note", "Delegation is a security-sensitive operation, which allows services to act on behalf of another user."), css2(radio("dl", "Do not trust this computer for delegation", c.role !== "Domain controller").el, "margin-top:10px;"), radio("dl", "Trust this computer for delegation to any service (Kerberos only)", c.role === "Domain controller").el) };
      openSheet(aduc, o.key, `${c.name} Properties`, [[general2, os, mo, deleg, loc]], "General", 440, true);
      return;
    }
    if (o.kind === "domain") {
      const general2 = {
        label: "General",
        build: (p) => p.append(
          nameHeader("domain", DOMAIN),
          grid("180px 1fr", "Domain name (pre-Windows 2000):", ro(NETBIOS), "Description:", ro(""), "Domain functional level:", ro("Windows Server 2016"), "Forest functional level:", ro("Windows Server 2016"))
        )
      };
      openSheet(aduc, "domain", `${DOMAIN} Properties`, [[general2, managedByTab(aduc, () => null, void 0, () => void 0)]], "General", 440, true);
      return;
    }
    if (o.builtin) {
      const b = o.builtin;
      const general2 = {
        label: "General",
        build: (p) => {
          p.append(nameHeader(b.kind === "user" ? "user" : "group", b.name));
          if (b.kind === "group") {
            p.append(grid("150px 1fr", "Group name (pre-Windows 2000):", ro(b.name)), hr(), grid("90px 1fr", "Description:", ro(b.description), "E-mail:", ro("")), css2(grid("1fr 1fr", ro(`Group scope: ${groupTypeLabel(b.scope, "Security").replace("Security Group - ", "")}`), ro("Group type: Security")), "margin-top:10px;"));
          } else {
            p.append(hr(), grid("110px 1fr", "Description:", ro(b.description), "Account:", ro(b.disabled ? "Disabled" : "Enabled")));
          }
          p.append(css2(el("div", "ad-note", "This is a default object created with the domain. It is shown so the console looks as it does on a new domain controller; this lab directory does not change it."), "margin-top:16px;color:#555;"));
        }
      };
      openSheet(aduc, o.key, `${b.name} Properties`, [[general2]], "General", 440, true);
      return;
    }
    const general = {
      label: "General",
      build: (p) => p.append(nameHeader(o.icon, o.name), grid("90px 1fr", "Description:", ro(o.description)))
    };
    openSheet(aduc, o.key, `${o.name} Properties`, [[general]], "General", 400, true);
  }
  function openProperties(aduc, o, tab) {
    if (o.user) userProperties(aduc, aduc.dir.getUser(o.user.id) ?? o.user, tab);
    else if (o.group) groupProperties(aduc, aduc.dir.getGroup(o.group.id) ?? o.group, tab);
    else if (o.ou) ouProperties(aduc, aduc.dir.getOu(o.ou.id) ?? o.ou, tab);
    else readOnlyProperties(aduc, o);
  }

  // aduc/find.ts
  var KINDS = ["Users, Contacts, and Groups", "Computers", "Organizational Units"];
  var FIELDS = {
    "Department": (o) => o.user?.department ?? "",
    "Job Title": (o) => o.user?.title ?? "",
    "Office": (o) => o.user?.attrs?.physicalDeliveryOfficeName ?? "",
    "City": (o) => o.user?.attrs?.l ?? "",
    "E-Mail Address": (o) => o.user?.email ?? o.group?.attrs?.mail ?? "",
    "Logon Name": (o) => o.user?.username ?? "",
    "First Name": (o) => o.user?.attrs?.givenName ?? "",
    "Last Name": (o) => o.user?.attrs?.sn ?? "",
    "Account Status": (o) => o.user ? o.user.status : ""
  };
  var CONDS = ["Starts with", "Ends with", "Is (exactly)", "Is not", "Present", "Not present"];
  function findDialog(aduc, startIn) {
    let scope = startIn.startsWith("ou:") ? startIn : "domain";
    const conditions = [];
    const d = openDialog({ title: "Find Users, Contacts, and Groups", width: 640, owner: aduc.owner, iconName: "find" });
    d.body.style.padding = "0";
    const menubar = el("div", "ad-menubar");
    menubar.style.borderBottom = "none";
    menubar.style.background = "#f0f0f0";
    for (const m of ["File", "Edit", "View"]) {
      const s = el("span", void 0, m);
      s.addEventListener("click", () => {
        if (m === "File") d.close();
      });
      s.title = m === "File" ? "File > Close" : "";
      menubar.appendChild(s);
    }
    const top = el("div");
    top.style.cssText = "display:grid;grid-template-columns:36px 210px 24px 1fr 90px;gap:8px;align-items:center;padding:8px 11px 6px;";
    const kind = select(KINDS, KINDS[0]);
    const inBox = select([DOMAIN], DOMAIN);
    const syncIn = () => {
      inBox.textContent = "";
      const label = scope === "domain" ? DOMAIN : `${DOMAIN}/${aduc.dir.ouPath(scope.slice(3))}`;
      inBox.appendChild(new Option(label, label));
    };
    syncIn();
    top.append(
      el("label", void 0, "Find:"),
      kind,
      el("label", void 0, "In:"),
      inBox,
      button(
        "Browse...",
        () => browseContainer(aduc, { title: "Browse for Container", prompt: "Select the container to search.", allowDomain: true, onOk: (k) => {
          scope = k.startsWith("ou:") ? k : "domain";
          syncIn();
        } })
      )
    );
    const mid = el("div");
    mid.style.cssText = "display:grid;grid-template-columns:1fr 110px;gap:12px;padding:0 11px;";
    const tabs = el("div");
    const tabRow = el("div", "ad-tabrow");
    const panel = el("div", "ad-tabpanel");
    panel.style.height = "150px";
    tabs.append(tabRow, panel);
    const name = textbox("");
    const desc = textbox("");
    name.style.width = desc.style.width = "100%";
    const basic = el("div");
    basic.style.cssText = "display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;padding-top:10px;";
    const nameLabel = el("label", void 0, "Name:");
    basic.append(nameLabel, name, el("label", void 0, "Description:"), desc);
    const adv = el("div");
    const fieldSel = select(Object.keys(FIELDS), "Department");
    const condSel = select(CONDS, "Starts with");
    const valBox = textbox("");
    const condList = listBox([{ label: "Condition List", render: (c) => `${c.field} ${c.cond.toLowerCase()} ${c.value}`.trim() }], { height: "64px" });
    const advRow = el("div");
    advRow.style.cssText = "display:grid;grid-template-columns:auto 1fr auto 1fr;gap:6px;align-items:center;";
    advRow.append(el("label", void 0, "Field"), fieldSel, el("label", void 0, "Condition:"), condSel);
    const valRow = el("div");
    valRow.style.cssText = "display:grid;grid-template-columns:auto 1fr auto auto;gap:6px;align-items:center;margin:6px 0;";
    valRow.append(
      el("label", void 0, "Value:"),
      valBox,
      button("Add", () => {
        conditions.push({ field: fieldSel.value, cond: condSel.value, value: valBox.value.trim() });
        condList.setRows([...conditions]);
        valBox.value = "";
      }),
      button("Remove", () => {
        for (const c of condList.selected()) conditions.splice(conditions.indexOf(c), 1);
        condList.setRows([...conditions]);
      })
    );
    adv.append(advRow, valRow, condList.el);
    const pages = [["Users, Contacts, and Groups", basic], ["Advanced", adv]];
    let activeTab = 0;
    const paintTabs = () => {
      tabRow.textContent = "";
      pages.forEach(([label], i) => {
        const t = el("div", "ad-tab" + (i === activeTab ? " sel" : ""), i === 0 ? kind.value : label);
        t.style.flex = "0 0 auto";
        t.addEventListener("mousedown", (e) => {
          e.preventDefault();
          activeTab = i;
          paintTabs();
        });
        tabRow.appendChild(t);
      });
      panel.textContent = "";
      panel.appendChild(pages[activeTab][1]);
    };
    kind.addEventListener("change", () => {
      nameLabel.textContent = kind.value === "Computers" ? "Computer name:" : "Name:";
      d.setTitle(`Find ${kind.value}`);
      paintTabs();
    });
    paintTabs();
    const side = el("div");
    side.style.cssText = "display:flex;flex-direction:column;gap:8px;padding-top:24px;align-items:stretch;";
    const findNow = button("Find Now", () => run(), { primary: true });
    const stop = button("Stop", () => void 0, { disabled: true });
    const clear = button("Clear All", () => {
      name.value = desc.value = "";
      conditions.length = 0;
      condList.setRows([]);
      results.el.style.display = resultsLabel.style.display = "none";
      status.textContent = "";
    });
    const flash = icon("flashlight", 32);
    flash.style.margin = "14px auto 0";
    side.append(findNow, stop, clear, flash);
    d.buttons.push(findNow);
    mid.append(tabs, side);
    const resultsLabel = el("div", void 0, "Search results:");
    resultsLabel.style.cssText = "padding:10px 11px 3px;display:none;";
    const results = listBox(
      [
        { label: "Name", render: (o) => o.name, iconOf: (o) => o.icon, width: "34%" },
        { label: "Type", render: (o) => o.type, width: "26%" },
        { label: "Description", render: (o) => o.description }
      ],
      {
        height: "190px",
        multi: true,
        onOpen: (o) => aduc.openProperties(o),
        onContext: (o, e) => aduc.contextMenuFor(o, e.clientX, e.clientY)
      }
    );
    results.el.style.cssText += "margin:0 11px;display:none;";
    const status = el("div");
    status.style.cssText = "padding:4px 11px 8px;min-height:22px;";
    d.body.append(menubar, top, mid, resultsLabel, results.el, status);
    const inScope = (home) => {
      if (scope === "domain") return true;
      for (let k = home; k; ) {
        if (k === scope) return true;
        if (!k.startsWith("ou:")) return false;
        const p = aduc.dir.getOu(k.slice(3))?.parentId;
        k = p ? `ou:${p}` : void 0;
      }
      return false;
    };
    function run() {
      const q2 = name.value.trim().toLowerCase();
      const dq = desc.value.trim().toLowerCase();
      let pool;
      if (kind.value === "Computers") {
        pool = scope === "domain" ? COMPUTERS.map((c) => ({ key: `computer:${c.name}`, kind: "computer", name: c.name, type: "Computer", description: c.description, icon: "computer", computer: c })) : [];
      } else if (kind.value === "Organizational Units") {
        pool = aduc.dir.listOus().filter((o) => inScope(o.parentId ? `ou:${o.parentId}` : "domain") || scope === `ou:${o.id}`).map(ouRow);
      } else {
        pool = [
          ...aduc.dir.listUsers().filter((u) => inScope(homeOf(u))).map(userRow),
          ...aduc.dir.listGroups().filter((g2) => inScope(homeOf(g2))).map(groupRow)
        ];
      }
      const hits = pool.filter((o) => {
        const names = [o.name, o.user?.username ?? "", o.user?.attrs?.givenName ?? "", o.user?.attrs?.sn ?? ""].map((s) => s.toLowerCase());
        if (q2 && !names.some((n) => n.startsWith(q2) || n.split(/\s+/).some((w) => w.startsWith(q2)))) return false;
        if (dq && !o.description.toLowerCase().startsWith(dq)) return false;
        for (const c of conditions) {
          const v = (FIELDS[c.field]?.(o) ?? "").toLowerCase();
          const want = c.value.toLowerCase();
          const ok = c.cond === "Starts with" ? v.startsWith(want) : c.cond === "Ends with" ? v.endsWith(want) : c.cond === "Is (exactly)" ? v === want : c.cond === "Is not" ? v !== want : c.cond === "Present" ? v !== "" : v === "";
          if (!ok) return false;
        }
        return true;
      });
      hits.sort((a, b) => a.name.localeCompare(b.name));
      results.setRows(hits);
      results.el.style.display = resultsLabel.style.display = "";
      status.textContent = `${hits.length} item(s) found`;
      const box = d.root.getBoundingClientRect();
      if (box.bottom > window.innerHeight - 4) d.root.style.top = `${Math.max(4, window.innerHeight - box.height - 8)}px`;
    }
    queueMicrotask(() => name.focus());
  }

  // aduc/window.ts
  var PREFS_KEY = "aduc.view.v1";
  function loadPrefs() {
    const base = {
      advanced: false,
      asContainers: false,
      mode: "detail",
      columns: [...DEFAULT_COLUMNS],
      widths: {},
      treeWidth: 250,
      showTree: true,
      showToolbar: true,
      showStatus: true,
      showDescription: false,
      filter: null
    };
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch {
    }
    return base;
  }
  function savePrefs(p) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
    }
  }
  function renderActiveDirectoryWindow(body2, conductor) {
    ensureStyles();
    body2.innerHTML = "";
    Object.assign(body2.style, { overflow: "hidden", background: "#fff", flex: "1", minHeight: "0" });
    const prefs = loadPrefs();
    const owner = {};
    let selectedNode = "domain";
    let selectedKeys = /* @__PURE__ */ new Set();
    let anchorIndex = -1;
    let sortCol = "name";
    let sortAsc = true;
    let cutKeys = /* @__PURE__ */ new Set();
    const expanded = /* @__PURE__ */ new Set(["root", "domain"]);
    const history = ["domain"];
    let historyAt = 0;
    let focusPane = "tree";
    let rows = [];
    const view = () => ({
      advanced: prefs.advanced,
      types: prefs.filter ? new Set(prefs.filter) : null
    });
    const root = el("div", "ad-root");
    root.style.cssText = "display:flex;flex-direction:column;height:100%;min-height:0;";
    body2.appendChild(root);
    const menubar = el("div", "ad-menubar");
    const toolbar = el("div", "ad-toolbar");
    const panes = el("div", "ad-panes");
    const tree = el("div", "ad-tree");
    tree.tabIndex = 0;
    const splitter = el("div", "ad-splitter");
    const right = el("div");
    right.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;";
    const descBar = el("div");
    descBar.style.cssText = "padding:3px 8px;background:#f0f0f0;border-bottom:1px solid #d9d9d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    const list = el("div", "ad-list");
    list.tabIndex = 0;
    right.append(descBar, list);
    panes.append(tree, splitter, right);
    const status = el("div", "ad-status");
    root.append(menubar, toolbar, panes, status);
    const applyChrome = () => {
      tree.style.width = `${prefs.treeWidth}px`;
      tree.style.display = splitter.style.display = prefs.showTree ? "" : "none";
      toolbar.style.display = prefs.showToolbar ? "" : "none";
      status.style.display = prefs.showStatus ? "" : "none";
      descBar.style.display = prefs.showDescription ? "" : "none";
    };
    splitter.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = prefs.treeWidth;
      const move = (ev) => {
        prefs.treeWidth = Math.max(120, Math.min(560, startW + ev.clientX - startX));
        tree.style.width = `${prefs.treeWidth}px`;
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        savePrefs(prefs);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    const stopWorld = conductor.onWorldChange(() => {
      if (root.isConnected) refresh();
    });
    const watch = window.setInterval(() => {
      if (!root.isConnected) {
        stopWorld();
        closeDialogsOf(owner);
        closeMenus();
        setMenuHintSink(null);
        window.clearInterval(watch);
      }
    }, 1e3);
    const refresh = () => {
      if (!objectByKey(selectedNode, conductor.dir)) selectedNode = parentKey(selectedNode, conductor.dir) ?? "domain";
      renderTree();
      renderList();
    };
    const aduc = {
      conductor,
      dir: conductor.dir,
      owner,
      advanced: () => prefs.advanced,
      run: makeRunner(conductor, () => refresh()),
      refresh,
      reveal: (nodeKey, objectKey) => navigate(nodeKey, objectKey),
      openProperties: (o, tab) => openProperties(aduc, o, tab),
      contextMenuFor: (o, x, y) => openMenu(x, y, menuForObjects([o]))
    };
    function navigate(nodeKey, objectKey, fromHistory = false) {
      if (!objectByKey(nodeKey, conductor.dir)) return;
      selectedNode = nodeKey;
      for (let k = parentKey(nodeKey, conductor.dir); k; k = parentKey(k, conductor.dir)) expanded.add(k);
      if (objectKey) expanded.add(nodeKey);
      selectedKeys = new Set(objectKey ? [objectKey] : []);
      if (!fromHistory && history[historyAt] !== nodeKey) {
        history.splice(historyAt + 1);
        history.push(nodeKey);
        historyAt = history.length - 1;
      }
      refresh();
      if (objectKey) {
        list.focus();
        focusPane = "list";
        list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
      }
    }
    const viewItems = () => [
      { label: "Add/Remove Columns...", onClick: () => columnsDialog(), hint: "Adds or removes columns in the result pane" },
      { separator: true },
      { label: "Large Icons", radio: true, checked: prefs.mode === "large", onClick: () => setMode("large"), hint: "Displays items by using large icons" },
      { label: "Small Icons", radio: true, checked: prefs.mode === "small", onClick: () => setMode("small"), hint: "Displays items by using small icons" },
      { label: "List", radio: true, checked: prefs.mode === "list", onClick: () => setMode("list"), hint: "Displays items in a list" },
      { label: "Detail", radio: true, checked: prefs.mode === "detail", onClick: () => setMode("detail"), hint: "Displays information about each item in the window" },
      { separator: true },
      {
        label: "Users, Contacts, Groups, and Computers as containers",
        checked: prefs.asContainers,
        onClick: () => {
          prefs.asContainers = !prefs.asContainers;
          savePrefs(prefs);
          refresh();
        },
        hint: "Shows users, contacts, groups and computers in the console tree"
      },
      {
        label: "Advanced Features",
        checked: prefs.advanced,
        onClick: () => {
          prefs.advanced = !prefs.advanced;
          savePrefs(prefs);
          if (!prefs.advanced && !objectByKey(selectedNode, conductor.dir)) selectedNode = "domain";
          refresh();
        },
        hint: "Shows advanced objects and the Object, Security and Attribute Editor tabs"
      },
      { separator: true },
      { label: "Filter Options...", onClick: () => filterDialog(), hint: "Specifies which objects are displayed" },
      { separator: true },
      { label: "Customize...", onClick: () => customizeDialog(), hint: "Customizes the view" }
    ];
    const newItems = (nodeKey) => {
      const objs = canCreateObjectsIn(nodeKey);
      const na = { disabled: true, hint: "This object type is not available in this lab" };
      return [
        { label: "Computer", ...na },
        { label: "Contact", ...na },
        { label: "Group", disabled: !objs, onClick: () => newGroupDialog(aduc, nodeKey), hint: "Creates a new group" },
        { label: "InetOrgPerson", ...na },
        { label: "msDS-ShadowPrincipalContainer", ...na },
        { label: "msImaging-PSPs", ...na },
        { label: "MSMQ Queue Alias", ...na },
        { label: "Organizational Unit", disabled: !canCreateOuIn(nodeKey), onClick: () => newOuDialog(aduc, nodeKey), hint: "Creates a new organizational unit" },
        { label: "Printer", ...na },
        { label: "User", disabled: !objs, onClick: () => newUserWizard(aduc, nodeKey), hint: "Creates a new user" },
        { label: "Shared Folder", ...na }
      ];
    };
    const domainTasks = () => [
      { label: "Delegate Control...", onClick: () => delegationWizard(aduc, "domain"), hint: "Delegates control of this container" },
      { label: "Find...", onClick: () => findDialog(aduc, "domain"), hint: "Finds objects in the directory" },
      { label: "Change Domain...", onClick: () => changeDomainDialog(), hint: "Connects to another domain" },
      { label: "Change Domain Controller...", onClick: () => changeDcDialog(), hint: "Connects to another domain controller" },
      { label: "Raise domain functional level...", onClick: () => raiseLevelDialog(), hint: "Raises the domain functional level" },
      { label: "Operations Masters...", onClick: () => opsMastersDialog(), hint: "Shows the operations master roles" }
    ];
    const tail = (o) => [
      { separator: true },
      { label: "Refresh", onClick: () => refresh(), hint: "Refreshes the current view" },
      ...o.exportable === false ? [] : [{ label: "Export List...", onClick: () => exportList(), hint: "Exports the current list to a text file" }],
      { separator: true },
      ...o.props ? [{ label: "Properties", bold: false, onClick: o.props, hint: "Opens the properties dialog box for the current selection" }, { separator: true }] : [],
      { label: "Help", onClick: () => helpDialog(), hint: "Help for the current selection" }
    ];
    function menuForNode(nodeKey) {
      const o = objectByKey(nodeKey, conductor.dir);
      if (!o) return [];
      if (o.kind === "root") {
        return [
          { label: "Change Domain...", onClick: () => changeDomainDialog() },
          { label: "Change Domain Controller...", onClick: () => changeDcDialog() },
          { label: "Operations Masters...", onClick: () => opsMastersDialog() },
          { separator: true },
          { label: "View", submenu: viewItems() },
          ...tail({ exportable: true })
        ];
      }
      if (o.kind === "saved") {
        return [
          { label: "New", submenu: [{ label: "Query", disabled: true }] },
          { label: "Import Query Definition...", disabled: true },
          { separator: true },
          { label: "View", submenu: viewItems() },
          ...tail({})
        ];
      }
      if (o.kind === "domain") {
        return [
          ...domainTasks(),
          { separator: true },
          { label: "New", submenu: newItems("domain") },
          { label: "All Tasks", submenu: domainTasks() },
          { separator: true },
          { label: "View", submenu: viewItems() },
          ...tail({ props: () => openProperties(aduc, o) })
        ];
      }
      if (o.kind === "ou") {
        const tasks = [
          { label: "Delegate Control...", onClick: () => delegationWizard(aduc, nodeKey), hint: "Delegates control of this organizational unit" },
          { label: "Move...", onClick: () => moveDialog(aduc, [o]), hint: "Moves the current selection to another container" },
          { label: "Find...", onClick: () => findDialog(aduc, nodeKey), hint: "Finds objects in this organizational unit" }
        ];
        return [
          ...tasks,
          { separator: true },
          { label: "New", submenu: newItems(nodeKey) },
          { label: "All Tasks", submenu: tasks },
          { separator: true },
          { label: "View", submenu: viewItems() },
          { separator: true },
          { label: "Cut", onClick: () => cut([o]), hint: "Removes the current selection and places it on the clipboard" },
          { label: "Delete", onClick: () => deleteObjects(aduc, [o]), hint: "Deletes the current selection" },
          { label: "Rename", onClick: () => renameDialog(aduc, o), hint: "Renames the current selection" },
          ...tail({ props: () => openProperties(aduc, o) })
        ];
      }
      const canDelegate = ["c:users", "c:computers", "c:dcs"].includes(nodeKey);
      return [
        ...canDelegate ? [{ label: "Delegate Control...", onClick: () => delegationWizard(aduc, nodeKey) }] : [],
        { label: "Find...", onClick: () => findDialog(aduc, nodeKey.startsWith("ou:") ? nodeKey : "domain") },
        { separator: true },
        { label: "New", submenu: newItems(nodeKey), disabled: !canCreateObjectsIn(nodeKey) && !canCreateOuIn(nodeKey) },
        { label: "All Tasks", submenu: [{ label: "Find...", onClick: () => findDialog(aduc, "domain") }] },
        { separator: true },
        { label: "View", submenu: viewItems() },
        ...nodeKey === "c:dcs" ? [{ separator: true }, { label: "Cut", disabled: true }, { label: "Delete", disabled: true }, { label: "Rename", disabled: true }] : [],
        ...tail({ props: () => openProperties(aduc, o) })
      ];
    }
    function menuForObjects(objs) {
      if (objs.length === 0) return menuForBlank();
      const one = objs.length === 1 ? objs[0] : null;
      if (one?.nodeKey) return menuForNode(one.nodeKey);
      const users = objs.map((o) => o.user).filter((u) => !!u);
      const allUsers = users.length === objs.length;
      const props = one ? () => openProperties(aduc, one) : void 0;
      const rsop = [
        { label: "Resultant Set of Policy (Planning)...", disabled: true },
        { label: "Resultant Set of Policy (Logging)...", disabled: true }
      ];
      if (one?.user) {
        const u = one.user;
        return [
          { label: "Copy...", onClick: () => newUserWizard(aduc, homeKey(u), u), hint: "Creates a new user from this template" },
          { label: "Add to a group...", onClick: () => addToGroupDialog(aduc, [u]), hint: "Adds the selected objects to a group" },
          { label: "Name Mappings...", onClick: () => nameMappingsDialog(u.displayName), hint: "Maps certificates and Kerberos names to this account" },
          u.status === "disabled" ? { label: "Enable Account", onClick: () => setEnabled(aduc, [u], true), hint: "Enables the selected accounts" } : { label: "Disable Account", onClick: () => setEnabled(aduc, [u], false), hint: "Disables the selected accounts" },
          { label: "Reset Password...", onClick: () => resetPasswordDialog(aduc, u), hint: "Resets the password for the selected user" },
          { label: "Move...", onClick: () => moveDialog(aduc, objs), hint: "Moves the current selection to another container" },
          { label: "Open Home Page", onClick: () => openHomePage(u), hint: "Opens the user's home page" },
          { label: "Send Mail", onClick: () => messageBox(`No e-mail program is configured on ${VM_HOST.name}. The address is ${u.email}.`, { kind: "info" }), hint: "Sends mail to the selected user" },
          { separator: true },
          { label: "All Tasks", submenu: rsop },
          { separator: true },
          { label: "Cut", onClick: () => cut(objs), hint: "Removes the current selection and places it on the clipboard" },
          { label: "Delete", onClick: () => deleteObjects(aduc, objs), hint: "Deletes the current selection" },
          { label: "Rename", onClick: () => renameDialog(aduc, one), hint: "Renames the current selection" },
          { separator: true },
          { label: "Properties", bold: true, onClick: props, hint: "Opens the properties dialog box for the current selection" },
          { separator: true },
          { label: "Help", onClick: () => helpDialog() }
        ];
      }
      if (allUsers) {
        return [
          { label: "Add to a group...", onClick: () => addToGroupDialog(aduc, users) },
          { label: "Enable Account", onClick: () => setEnabled(aduc, users, true) },
          { label: "Disable Account", onClick: () => setEnabled(aduc, users, false) },
          { label: "Move...", onClick: () => moveDialog(aduc, objs) },
          { label: "Send Mail", disabled: true },
          { separator: true },
          { label: "All Tasks", submenu: rsop },
          { separator: true },
          { label: "Cut", onClick: () => cut(objs) },
          { label: "Delete", onClick: () => deleteObjects(aduc, objs) },
          { separator: true },
          { label: "Properties", bold: true, disabled: true },
          { separator: true },
          { label: "Help", onClick: () => helpDialog() }
        ];
      }
      if (one?.group) {
        return [
          { label: "Add to a group...", onClick: () => messageBox("Group nesting is not modelled in this lab directory. Add the accounts to the group that holds the permission instead.", { kind: "info" }) },
          { label: "Move...", onClick: () => moveDialog(aduc, objs) },
          { label: "Send Mail", disabled: !one.group.attrs?.mail, onClick: () => messageBox(`No e-mail program is configured. The group address is ${one.group.attrs?.mail}.`, { kind: "info" }) },
          { separator: true },
          { label: "All Tasks", submenu: [{ label: "Find...", onClick: () => findDialog(aduc, "domain") }] },
          { separator: true },
          { label: "Cut", onClick: () => cut(objs) },
          { label: "Delete", onClick: () => deleteObjects(aduc, objs) },
          { label: "Rename", onClick: () => renameDialog(aduc, one) },
          { separator: true },
          { label: "Properties", bold: true, onClick: props },
          { separator: true },
          { label: "Help", onClick: () => helpDialog() }
        ];
      }
      if (one?.computer) {
        const dis = { disabled: true };
        return [
          { label: "Add to a group...", ...dis },
          { label: "Disable Account", ...dis },
          { label: "Reset Account", ...dis },
          { label: "Move...", ...dis },
          { label: "Manage", ...dis },
          { separator: true },
          { label: "All Tasks", submenu: rsop },
          { separator: true },
          { label: "Cut", ...dis },
          { label: "Delete", ...dis },
          { separator: true },
          { label: "Properties", bold: true, onClick: props },
          { separator: true },
          { label: "Help", onClick: () => helpDialog() }
        ];
      }
      if (one?.builtin) {
        return [
          { label: "Add to a group...", disabled: true },
          { label: "Move...", disabled: true },
          { separator: true },
          { label: "Cut", disabled: true },
          { label: "Delete", disabled: true },
          { label: "Rename", disabled: true },
          { separator: true },
          { label: "Properties", bold: true, onClick: props },
          { separator: true },
          { label: "Help", onClick: () => helpDialog() }
        ];
      }
      return [
        { label: "Move...", onClick: () => moveDialog(aduc, objs) },
        { separator: true },
        { label: "Cut", onClick: () => cut(objs) },
        { label: "Delete", onClick: () => deleteObjects(aduc, objs) },
        { separator: true },
        { label: "Help", onClick: () => helpDialog() }
      ];
    }
    function menuForBlank() {
      const n = selectedNode;
      const creatable = canCreateObjectsIn(n) || canCreateOuIn(n);
      return [
        ...creatable ? [{ label: "New", submenu: newItems(n) }] : [],
        { label: "All Tasks", submenu: [{ label: "Find...", onClick: () => findDialog(aduc, n.startsWith("ou:") ? n : "domain") }] },
        ...cutKeys.size && (n === "c:users" || n.startsWith("ou:") || n === "domain") ? [{ label: "Paste", onClick: () => paste(n) }] : [],
        { separator: true },
        { label: "Refresh", onClick: () => refresh() },
        { label: "Export List...", onClick: () => exportList() },
        { separator: true },
        { label: "View", submenu: viewItems() },
        { label: "Arrange Icons", submenu: [{ label: "by Name", onClick: () => {
          sortCol = "name";
          sortAsc = true;
          renderList();
        } }, { label: "by Type", onClick: () => {
          sortCol = "type";
          sortAsc = true;
          renderList();
        } }, { label: "by Description", onClick: () => {
          sortCol = "description";
          sortAsc = true;
          renderList();
        } }] },
        { label: "Line up Icons", disabled: prefs.mode === "detail" || prefs.mode === "list" },
        { separator: true },
        { label: "Properties", onClick: () => {
          const o = objectByKey(n, conductor.dir);
          if (o) openProperties(aduc, o);
        } },
        { separator: true },
        { label: "Help", onClick: () => helpDialog() }
      ];
    }
    const homeKey = (u) => u.ouId ? `ou:${u.ouId}` : "c:users";
    function actionMenu() {
      if (focusPane === "list") return menuForObjects(selectedObjects());
      return menuForNode(selectedNode);
    }
    const MENUS = {
      File: () => [
        { label: "Options...", onClick: () => messageBox("Console options are managed by the Microsoft Management Console. This console opens in User mode - full access.", { title: "Options", kind: "info" }) },
        { separator: true },
        { label: "Exit", onClick: () => root.closest(".apex-window")?.querySelector("button[title=close]")?.click(), hint: "Closes the console" }
      ],
      Action: () => actionMenu(),
      View: () => viewItems(),
      Help: () => [
        { label: "Help Topics", onClick: () => helpDialog() },
        { separator: true },
        { label: "About Active Directory Users and Computers...", onClick: () => aboutDialog() }
      ]
    };
    for (const label of Object.keys(MENUS)) {
      const m = el("span", void 0, label);
      m.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = m.getBoundingClientRect();
        m.classList.add("open");
        openMenu(r.left, r.bottom, MENUS[label](), 0, () => m.classList.remove("open"));
      });
      menubar.appendChild(m);
    }
    setMenuHintSink((t) => {
      if (t) status.textContent = t;
      else paintStatus();
    });
    const tb = (name, title, onClick) => {
      const b = el("button", "ad-tb");
      b.type = "button";
      b.title = title;
      b.appendChild(icon(name));
      b.addEventListener("click", onClick);
      b.addEventListener("mouseenter", () => status.textContent = title);
      b.addEventListener("mouseleave", () => paintStatus());
      return b;
    };
    const sep = () => el("span", "ad-tbsep");
    const tBack = tb("back", "Back", () => {
      if (historyAt > 0) navigate(history[--historyAt], void 0, true);
    });
    const tFwd = tb("forward", "Forward", () => {
      if (historyAt < history.length - 1) navigate(history[++historyAt], void 0, true);
    });
    const tUp = tb("up", "Up One Level", () => {
      const p = parentKey(selectedNode, conductor.dir);
      if (p) navigate(p);
    });
    const tTree = tb("tree", "Show/Hide Console Tree", () => {
      prefs.showTree = !prefs.showTree;
      savePrefs(prefs);
      applyChrome();
    });
    const tDel = tb("delete", "Delete", () => deleteObjects(aduc, selectedObjects()));
    const tProps = tb("properties", "Properties", () => {
      const s = selectedObjects();
      const o = s.length === 1 ? s[0] : focusPane === "tree" ? objectByKey(selectedNode, conductor.dir) : void 0;
      if (o) openProperties(aduc, o);
    });
    const tRefresh = tb("refresh", "Refresh", () => refresh());
    const tExport = tb("export", "Export List", () => exportList());
    const tHelp = tb("help", "Help", () => helpDialog());
    const tNewUser = tb("newUser", "Create a new user in the current container.", () => newUserWizard(aduc, selectedNode));
    const tNewGroup = tb("newGroup", "Create a new group in the current container.", () => newGroupDialog(aduc, selectedNode));
    const tNewOu = tb("newOu", "Create a new organizational unit in the current container.", () => newOuDialog(aduc, selectedNode));
    const tFilter = tb("filter", "Add a filter to the current list.", () => filterDialog());
    const tFind = tb("find", "Find objects in Active Directory Domain Services.", () => findDialog(aduc, selectedNode.startsWith("ou:") ? selectedNode : "domain"));
    const tAddGroup = tb("addToGroup", "Add the selected object to a group you specify.", () => {
      const users = selectedObjects().map((o) => o.user).filter((u) => !!u);
      if (users.length) addToGroupDialog(aduc, users);
    });
    toolbar.append(tBack, tFwd, tUp, sep(), tTree, sep(), tDel, tProps, tRefresh, tExport, sep(), tHelp, sep(), tNewUser, tNewGroup, tNewOu, tFilter, tFind, tAddGroup);
    function paintToolbar() {
      tBack.disabled = historyAt === 0;
      tFwd.disabled = historyAt >= history.length - 1;
      tUp.disabled = !parentKey(selectedNode, conductor.dir);
      const sel = selectedObjects();
      tDel.disabled = !sel.length || sel.some((o) => !(o.user || o.group || o.ou));
      tProps.disabled = !(sel.length === 1 || focusPane === "tree" && selectedNode !== "root" && selectedNode !== "saved");
      tNewUser.disabled = tNewGroup.disabled = !canCreateObjectsIn(selectedNode);
      tNewOu.disabled = !canCreateOuIn(selectedNode);
      tAddGroup.disabled = !sel.length || !sel.every((o) => o.user);
      tFilter.classList.toggle("on", !!prefs.filter);
      tTree.classList.toggle("on", prefs.showTree);
    }
    const rootLabel = () => `Active Directory Users and Computers [${DC_FQDN}]`;
    function renderTree() {
      const scroll = tree.scrollTop;
      tree.textContent = "";
      const draw = (key, label, iconName, depth) => {
        const kids = treeChildren(key, conductor.dir, view(), prefs.asContainers);
        const row = el("div", "ad-trow" + (key === selectedNode ? " sel" : "") + (cutKeys.has(key) ? " cut" : ""));
        row.style.paddingLeft = `${2 + depth * 16}px`;
        row.dataset.key = key;
        const tw = el("span", "ad-twisty");
        if (kids.length) {
          const chev = el("span", "ad-chev" + (expanded.has(key) ? " open" : ""));
          tw.appendChild(chev);
          tw.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (expanded.has(key)) expanded.delete(key);
            else expanded.add(key);
            renderTree();
          });
        }
        const lab = el("span", "ad-tlabel", label);
        row.append(tw, icon(iconName), lab);
        row.addEventListener("mousedown", (e) => {
          focusPane = "tree";
          const obj = objectByKey(key, conductor.dir);
          if (obj && !obj.nodeKey) {
            const p = parentKey(key, conductor.dir);
            if (p) navigate(p, key);
            if (e.button === 2) openMenu(e.clientX, e.clientY, menuForObjects([obj]));
            return;
          }
          if (key !== selectedNode) navigate(key);
        });
        row.addEventListener("dblclick", () => {
          if (!kids.length) return;
          if (expanded.has(key)) expanded.delete(key);
          else expanded.add(key);
          renderTree();
        });
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const obj = objectByKey(key, conductor.dir);
          if (obj?.nodeKey) openMenu(e.clientX, e.clientY, menuForNode(key));
        });
        row.addEventListener("dragover", (e) => {
          if (key === "c:users" || key.startsWith("ou:") || key === "domain") {
            e.preventDefault();
            lab.style.outline = "1px dashed #0078d7";
          }
        });
        row.addEventListener("dragleave", () => lab.style.outline = "");
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          lab.style.outline = "";
          const keys = (e.dataTransfer?.getData("text/aduc") ?? "").split("\n").filter(Boolean);
          dropMove(keys, key);
        });
        tree.appendChild(row);
        if (expanded.has(key)) for (const c of kids) draw(c.nodeKey ?? c.key, c.name, c.icon, depth + 1);
      };
      draw("root", rootLabel(), "root", 0);
      tree.scrollTop = scroll;
      const selRow = tree.querySelector(".ad-trow.sel");
      if (selRow) {
        const r = selRow.getBoundingClientRect();
        const t = tree.getBoundingClientRect();
        if (r.top < t.top || r.bottom > t.bottom) selRow.scrollIntoView({ block: "nearest" });
      }
    }
    function selectedObjects() {
      return rows.filter((r) => selectedKeys.has(r.key));
    }
    function sortRows(input) {
      const colDef = ALL_COLUMNS.find((c) => c.id === sortCol) ?? ALL_COLUMNS[0];
      const sorted = [...input].sort((a, b) => colDef.value(a, conductor.dir).localeCompare(colDef.value(b, conductor.dir), void 0, { sensitivity: "base", numeric: true }));
      if (sortCol === "name") return sortAsc ? input : [...input].reverse();
      return sortAsc ? sorted : sorted.reverse();
    }
    function renderList() {
      const scroll = list.scrollTop;
      list.textContent = "";
      rows = sortRows(childrenOf(selectedNode, conductor.dir, view()));
      for (const k of [...selectedKeys]) if (!rows.some((r) => r.key === k)) selectedKeys.delete(k);
      const o = objectByKey(selectedNode, conductor.dir);
      descBar.textContent = o ? o.kind === "root" ? rootLabel() : o.kind === "domain" ? DOMAIN : `${o.name}${o.description ? "    " + o.description : ""}` : "";
      if (rows.length === 0) {
        list.appendChild(el("div", "ad-empty", "There are no items to show in this view."));
      } else if (prefs.mode === "detail") {
        renderDetails();
      } else {
        renderIcons();
      }
      list.scrollTop = scroll;
      paintStatus();
      paintToolbar();
    }
    function rowEvents(node, r, i) {
      node.draggable = !!(r.user || r.group || r.ou);
      node.addEventListener("mousedown", (e) => {
        focusPane = "list";
        if (e.shiftKey && anchorIndex >= 0) {
          const [a, b] = [Math.min(anchorIndex, i), Math.max(anchorIndex, i)];
          selectedKeys = new Set(rows.slice(a, b + 1).map((x) => x.key));
        } else if (e.ctrlKey || e.metaKey) {
          if (selectedKeys.has(r.key)) selectedKeys.delete(r.key);
          else selectedKeys.add(r.key);
          anchorIndex = i;
        } else if (!(e.button === 2 && selectedKeys.has(r.key))) {
          selectedKeys = /* @__PURE__ */ new Set([r.key]);
          anchorIndex = i;
        }
        paintSelection();
      });
      node.addEventListener("dblclick", () => {
        if (r.nodeKey) navigate(r.nodeKey);
        else openProperties(aduc, r);
      });
      node.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMenu(e.clientX, e.clientY, menuForObjects(selectedObjects()));
      });
      node.addEventListener("dragstart", (e) => {
        if (!selectedKeys.has(r.key)) {
          selectedKeys = /* @__PURE__ */ new Set([r.key]);
          paintSelection();
        }
        e.dataTransfer?.setData("text/aduc", [...selectedKeys].join("\n"));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
    }
    function paintSelection() {
      list.querySelectorAll("[data-key]").forEach((n) => n.classList.toggle("sel", selectedKeys.has(n.dataset.key)));
      paintStatus();
      paintToolbar();
    }
    function renderDetails() {
      const cols = prefs.columns.map((id) => ALL_COLUMNS.find((c) => c.id === id)).filter((c) => !!c);
      const table = el("table", "ad-table");
      const colgroup = el("colgroup");
      const thead = el("thead");
      const hr_ = el("tr");
      let total = 0;
      for (const c of cols) {
        const w = prefs.widths[c.id] ?? c.width;
        total += w;
        const cg = el("col");
        cg.style.width = `${w}px`;
        colgroup.appendChild(cg);
        const th = el("th", void 0, c.label + (sortCol === c.id && c.id !== "name" ? sortAsc ? "  ↑" : "  ↓" : sortCol === c.id && !sortAsc ? "  ↓" : ""));
        th.style.position = "sticky";
        th.addEventListener("click", () => {
          if (sortCol === c.id) sortAsc = !sortAsc;
          else {
            sortCol = c.id;
            sortAsc = true;
          }
          renderList();
        });
        const grip = el("span", "ad-grip");
        grip.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startW = prefs.widths[c.id] ?? c.width;
          const move = (ev) => {
            prefs.widths[c.id] = Math.max(40, startW + ev.clientX - startX);
            cg.style.width = `${prefs.widths[c.id]}px`;
          };
          const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            savePrefs(prefs);
            renderList();
          };
          document.addEventListener("mousemove", move);
          document.addEventListener("mouseup", up);
        });
        grip.addEventListener("click", (e) => e.stopPropagation());
        th.appendChild(grip);
        hr_.appendChild(th);
      }
      colgroup.appendChild(el("col"));
      hr_.appendChild(el("th", "ad-fill"));
      table.style.minWidth = `${total}px`;
      thead.appendChild(hr_);
      const tbody = el("tbody");
      rows.forEach((r, i) => {
        const tr = el("tr", "row" + (selectedKeys.has(r.key) ? " sel" : "") + (cutKeys.has(r.key) ? " cut" : ""));
        tr.dataset.key = r.key;
        cols.forEach((c, ci) => {
          const td = el("td");
          const v = c.value(r, conductor.dir);
          if (ci === 0) td.appendChild(el("div", "ad-namecell")).append(icon(r.icon), el("span", void 0, v));
          else td.textContent = v;
          td.title = v;
          tr.appendChild(td);
        });
        tr.appendChild(el("td", "ad-fill"));
        rowEvents(tr, r, i);
        tbody.appendChild(tr);
      });
      table.append(colgroup, thead, tbody);
      list.appendChild(table);
    }
    function renderIcons() {
      const wrap = el("div", "ad-icons" + (prefs.mode === "large" ? " large" : prefs.mode === "list" ? " list" : ""));
      rows.forEach((r, i) => {
        const it = el("div", "ad-icon-item" + (selectedKeys.has(r.key) ? " sel" : ""));
        it.dataset.key = r.key;
        it.append(icon(r.icon, prefs.mode === "large" ? 32 : 16), el("span", void 0, r.name));
        if (prefs.mode === "small") it.style.width = "200px";
        rowEvents(it, r, i);
        wrap.appendChild(it);
      });
      list.appendChild(wrap);
    }
    function paintStatus() {
      const n = rows.length;
      const sel = selectedKeys.size;
      const filtered = prefs.filter ? " [Filter Activated]" : "";
      status.textContent = sel > 1 ? `${sel} object(s) selected` : `${n} Object${n === 1 ? "" : "s"}${filtered}`;
    }
    list.addEventListener("mousedown", (e) => {
      focusPane = "list";
      if (e.target === list || e.target.classList.contains("ad-icons") || e.target.classList.contains("ad-empty")) {
        selectedKeys.clear();
        paintSelection();
      }
    });
    list.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      selectedKeys.clear();
      paintSelection();
      openMenu(e.clientX, e.clientY, menuForBlank());
    });
    list.addEventListener("dragover", (e) => {
      if (selectedNode === "c:users" || selectedNode.startsWith("ou:")) e.preventDefault();
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      const keys = (e.dataTransfer?.getData("text/aduc") ?? "").split("\n").filter(Boolean);
      const onto = e.target.closest("[data-key]")?.dataset.key;
      const target = onto && objectByKey(onto, conductor.dir)?.nodeKey ? onto : selectedNode;
      dropMove(keys, target);
    });
    tree.addEventListener("mousedown", () => focusPane = "tree");
    list.addEventListener("keydown", (e) => {
      const sel = selectedObjects();
      const idx = rows.findIndex((r) => selectedKeys.has(r.key));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, Math.min(rows.length - 1, (idx < 0 ? -1 : idx) + (e.key === "ArrowDown" ? 1 : -1)));
        if (rows[next]) {
          selectedKeys = /* @__PURE__ */ new Set([rows[next].key]);
          anchorIndex = next;
          paintSelection();
          list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const one = sel[0];
        if (!one) return;
        if (e.altKey || !one.nodeKey) openProperties(aduc, one);
        else navigate(one.nodeKey);
      } else if (e.key === "Delete") {
        e.preventDefault();
        if (sel.length) deleteObjects(aduc, sel);
      } else if (e.key === "F2") {
        e.preventDefault();
        if (sel.length === 1 && (sel[0].user || sel[0].group || sel[0].ou)) renameDialog(aduc, sel[0]);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const p = parentKey(selectedNode, conductor.dir);
        if (p) navigate(p);
      } else if ((e.ctrlKey || e.metaKey) && (e.key ?? "").toLowerCase() === "a") {
        e.preventDefault();
        selectedKeys = new Set(rows.map((r) => r.key));
        paintSelection();
      } else if ((e.ctrlKey || e.metaKey) && (e.key ?? "").toLowerCase() === "x") {
        e.preventDefault();
        cut(sel);
      } else if ((e.ctrlKey || e.metaKey) && (e.key ?? "").toLowerCase() === "v") {
        e.preventDefault();
        paste(selectedNode);
      } else if (e.key === "F5") {
        e.preventDefault();
        refresh();
      }
    });
    tree.addEventListener("keydown", (e) => {
      const visible = [...tree.querySelectorAll(".ad-trow")].map((r) => r.dataset.key);
      const i = visible.indexOf(selectedNode);
      if (e.key === "ArrowDown" && i < visible.length - 1) {
        e.preventDefault();
        navigate(visible[i + 1]);
      } else if (e.key === "ArrowUp" && i > 0) {
        e.preventDefault();
        navigate(visible[i - 1]);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        expanded.add(selectedNode);
        renderTree();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (expanded.has(selectedNode)) {
          expanded.delete(selectedNode);
          renderTree();
        } else {
          const p = parentKey(selectedNode, conductor.dir);
          if (p) navigate(p);
        }
      } else if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        const o = objectByKey(selectedNode, conductor.dir);
        if (o) openProperties(aduc, o);
      } else if (e.key === "F5") {
        e.preventDefault();
        refresh();
      } else if (e.key === "Delete" && selectedNode.startsWith("ou:")) {
        e.preventDefault();
        const o = objectByKey(selectedNode, conductor.dir);
        if (o) deleteObjects(aduc, [o]);
      }
    });
    function cut(objs) {
      cutKeys = new Set(objs.filter((o) => o.user || o.group || o.ou).map((o) => o.key));
      renderTree();
      renderList();
    }
    function paste(target) {
      if (!cutKeys.size) return;
      const keys = [...cutKeys];
      cutKeys.clear();
      moveKeysTo(keys, target);
    }
    function dropMove(keys, target) {
      if (!keys.length || keys.includes(target)) return;
      messageBox(
        "Moving objects in Active Directory Domain Services can prevent your existing system from working the way it was designed. For example, moving an organizational unit (OU) can affect the way that group policies are applied to the accounts within it.\n\nAre you sure you want to move this object?",
        { kind: "warning", title: "Active Directory Domain Services", yesNo: true, onYes: () => moveKeysTo(keys, target) }
      );
    }
    function moveKeysTo(keys, target) {
      const dest = target === "c:users" ? `CN=Users,${DOMAIN}` : target === "domain" ? `DC=${DOMAIN}` : target.startsWith("ou:") ? conductor.dir.ouPath(target.slice(3)) : null;
      if (!dest) {
        messageBox("Objects can be moved into an organizational unit or the Users container.", { kind: "error" });
        return;
      }
      for (const k of keys) {
        const o = objectByKey(k, conductor.dir);
        if (!o) continue;
        if (target === "domain" && !o.ou) {
          messageBox("Accounts and groups cannot be placed directly in the domain in this lab. Choose an OU or the Users container.", { kind: "warning" });
          return;
        }
        if ((o.user || o.group) && target !== "c:users" && !target.startsWith("ou:")) continue;
        const id = o.user ? o.user.username : o.group ? o.group.name : o.ou ? conductor.dir.ouPath(o.ou.id) : "";
        if (!id) continue;
        if (!aduc.run("user.move", { Identity: id, TargetPath: dest }).ok) break;
      }
      refresh();
    }
    function setMode(m) {
      prefs.mode = m;
      savePrefs(prefs);
      renderList();
    }
    function columnsDialog() {
      const displayed = [...prefs.columns];
      const available = () => ALL_COLUMNS.map((c) => c.id).filter((id) => !displayed.includes(id));
      const label = (id) => ALL_COLUMNS.find((c) => c.id === id)?.label ?? id;
      const d = openDialog({
        title: "Add/Remove Columns",
        width: 520,
        modal: true,
        owner,
        buttons: [
          { label: "OK", primary: true, onClick: () => {
            prefs.columns = displayed.length ? displayed : [...DEFAULT_COLUMNS];
            if (!prefs.columns.includes("name")) prefs.columns.unshift("name");
            savePrefs(prefs);
            renderList();
          } },
          { label: "Cancel", cancel: true }
        ]
      });
      const avail = listBox([{ label: "Available columns:", render: label }], { height: "220px", multi: true });
      const disp = listBox([{ label: "Displayed columns:", render: label }], { height: "220px", multi: true });
      const paint = () => {
        avail.setRows(available());
        disp.setRows([...displayed]);
      };
      const mid = el("div");
      mid.style.cssText = "display:flex;flex-direction:column;gap:8px;justify-content:center;";
      mid.append(
        button("Add ->", () => {
          for (const id of avail.selected()) displayed.push(id);
          paint();
        }),
        button("<- Remove", () => {
          for (const id of disp.selected()) if (id !== "name") displayed.splice(displayed.indexOf(id), 1);
          paint();
        })
      );
      const side = el("div");
      side.style.cssText = "display:flex;flex-direction:column;gap:8px;justify-content:center;";
      const move = (delta) => {
        const s = disp.selected()[0];
        if (!s) return;
        const i = displayed.indexOf(s);
        const j = i + delta;
        if (j < 0 || j >= displayed.length) return;
        displayed.splice(i, 1);
        displayed.splice(j, 0, s);
        paint();
      };
      side.append(button("Move Up", () => move(-1)), button("Move Down", () => move(1)));
      const g2 = el("div");
      g2.style.cssText = "display:grid;grid-template-columns:1fr 90px 1fr 90px;gap:10px;";
      g2.append(avail.el, mid, disp.el, side);
      const restore = button("Restore Defaults", () => {
        displayed.splice(0, displayed.length, ...DEFAULT_COLUMNS);
        paint();
      });
      restore.style.marginTop = "8px";
      d.body.append(g2, restore);
      paint();
    }
    function filterDialog() {
      const types = [["user", "Users"], ["group", "Groups"], ["computer", "Computers"], ["ou", "Organizational Units"], ["container", "Containers and other objects"]];
      const all = radio("flt", "Show all types of objects", !prefs.filter);
      const some = radio("flt", "Show only the following types of objects:", !!prefs.filter);
      const checks = types.map(([id, lab]) => [id, checkbox(lab, !prefs.filter || prefs.filter.includes(id))]);
      const box = el("div", "ad-lb");
      box.style.cssText += "height:120px;padding:3px 6px;margin:4px 0 10px 18px;";
      for (const [, c] of checks) box.appendChild(c.el);
      const max = textbox("2000", { width: "70px" });
      openDialog({
        title: "Filter Options",
        width: 420,
        modal: true,
        owner,
        buttons: [
          {
            label: "OK",
            primary: true,
            onClick: () => {
              prefs.filter = all.checked ? null : checks.filter(([, c]) => c.checked).map(([id]) => id);
              savePrefs(prefs);
              renderList();
            }
          },
          { label: "Cancel", cancel: true }
        ]
      }).body.append(all.el, some.el, box, (() => {
        const r = el("div");
        r.style.cssText = "display:flex;gap:8px;align-items:center;";
        r.append(el("span", void 0, "Maximum number of items displayed per folder:"), max);
        return r;
      })());
    }
    function customizeDialog() {
      const c1 = checkbox("Console tree", prefs.showTree);
      const c2 = checkbox("Standard toolbar", prefs.showToolbar);
      const c3 = checkbox("Status bar", prefs.showStatus);
      const c4 = checkbox("Description bar", prefs.showDescription);
      const c5 = checkbox("Standard menus (Action and View)", true);
      c5.setDisabled(true);
      openDialog({
        title: "Customize View",
        width: 360,
        modal: true,
        owner,
        buttons: [
          {
            label: "OK",
            primary: true,
            onClick: () => {
              prefs.showTree = c1.checked;
              prefs.showToolbar = c2.checked;
              prefs.showStatus = c3.checked;
              prefs.showDescription = c4.checked;
              savePrefs(prefs);
              applyChrome();
            }
          },
          { label: "Cancel", cancel: true }
        ]
      }).body.append(el("div", void 0, "Select or clear the check boxes to show or hide items in the console window."), (() => {
        const f = el("fieldset", "ad-fs");
        f.appendChild(el("legend", void 0, "MMC"));
        f.append(c1.el, c5.el, c2.el, c3.el, c4.el);
        f.style.marginTop = "8px";
        return f;
      })());
    }
    function exportList() {
      const cols = prefs.columns.map((id) => ALL_COLUMNS.find((c) => c.id === id)).filter((c) => !!c);
      const lines = [cols.map((c) => c.label).join("	"), ...rows.map((r) => cols.map((c) => c.value(r, conductor.dir)).join("	"))];
      const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const o = objectByKey(selectedNode, conductor.dir);
      a.href = url;
      a.download = `${(o?.name ?? "export").replace(/[^\w.-]+/g, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
    }
    function changeDomainDialog() {
      const s = select(conductor.domains?.() ?? [DOMAIN], DOMAIN, "100%");
      openDialog({ title: "Change Domain", width: 400, modal: true, owner, buttons: [{ label: "OK", primary: true, onClick: () => {
        if (s.value === DOMAIN || !conductor.changeDomain) return;
        try {
          conductor.changeDomain(s.value);
          selectedNode = "domain";
          expanded.add("domain");
          refresh();
        } catch (e) {
          messageBox(e instanceof Error ? e.message : String(e), { kind: "error" });
        }
      } }, { label: "Cancel", cancel: true }] }).body.append(el("div", void 0, "Current domain:  " + DOMAIN), (() => {
        const r = el("div");
        r.style.cssText = "display:grid;grid-template-columns:60px 1fr;gap:8px;align-items:center;margin-top:10px;";
        r.append(el("label", void 0, "Domain:"), s);
        return r;
      })(), (() => {
        const c = checkbox("Save this domain setting for the current console", false);
        c.el.style.marginTop = "10px";
        return c.el;
      })());
    }
    function changeDcDialog() {
      const d = openDialog({ title: "Change Directory Server", width: 460, modal: true, owner, buttons: [{ label: "OK", primary: true }, { label: "Cancel", cancel: true }] });
      const lb = listBox([{ label: "Name", render: (r) => r[0], iconOf: () => "server" }, { label: "Site", render: (r) => r[1] }, { label: "DC Type", render: (r) => r[2] }], { height: "110px" });
      lb.setRows([[DC_FQDN, "Default-First-Site-Name", "GC"]]);
      d.body.append(el("div", void 0, `Current Directory Server: ${DC_FQDN}`), (() => {
        const f = el("fieldset", "ad-fs");
        f.appendChild(el("legend", void 0, "Change to:"));
        f.append(radio("cds", "Any Writable Domain Controller", false).el, radio("cds", "This Domain Controller or AD LDS instance", true).el, lb.el);
        f.style.marginTop = "8px";
        return f;
      })());
    }
    function raiseLevelDialog() {
      const d = openDialog({ title: "Raise domain functional level", width: 440, modal: true, owner, buttons: [{ label: "Raise", disabled: true }, { label: "Cancel", cancel: true, primary: true }] });
      d.body.append(
        el("div", void 0, "Domain name:"),
        el("div", void 0, DOMAIN),
        (() => {
          const e = el("div", void 0, "Current domain functional level:");
          e.style.marginTop = "10px";
          return e;
        })(),
        el("div", void 0, "Windows Server 2016"),
        (() => {
          const e = el("div", "ad-note", "Select an available domain functional level:");
          e.style.marginTop = "10px";
          return e;
        })(),
        select(["Windows Server 2016"], "Windows Server 2016", "100%"),
        (() => {
          const e = el("div", "ad-note", "The domain functional level is already at the highest level these domain controllers support. Raising it is irreversible: every DC must run that Windows Server version or later.");
          e.style.marginTop = "10px";
          return e;
        })()
      );
    }
    function opsMastersDialog() {
      const d = openDialog({ title: "Operations Masters", width: 460, modal: true, owner, buttons: [{ label: "Close", primary: true, cancel: true }] });
      const roles = [
        ["RID", "The operations master manages the allocation of RID pools to other domain controllers. Only one server in the domain performs this role."],
        ["PDC", "The operations master emulates the functions of a Windows NT 4.0 primary domain controller (PDC). It is also the authoritative time source and receives urgent password and lockout changes first. Only one server in the domain performs this role."],
        ["Infrastructure", "The infrastructure operations master ensures that cross-domain object references are correctly handled. Only one server in the domain performs this role."]
      ];
      const rowsEl = el("div");
      for (const [r, text] of roles) {
        const f = el("fieldset", "ad-fs");
        f.appendChild(el("legend", void 0, r));
        f.append(el("div", "ad-note", text), (() => {
          const g2 = el("div");
          g2.style.cssText = "display:grid;grid-template-columns:120px 1fr;gap:6px;margin-top:6px;";
          g2.append(el("span", void 0, "Operations master:"), textbox(DC_FQDN, { readOnly: true }));
          return g2;
        })());
        f.style.marginBottom = "8px";
        rowsEl.appendChild(f);
      }
      d.body.appendChild(rowsEl);
    }
    function nameMappingsDialog(name) {
      const d = openDialog({ title: `Security Identity Mapping`, width: 440, modal: true, owner, buttons: [{ label: "OK", primary: true }, { label: "Cancel", cancel: true }] });
      const lb = listBox([{ label: "Issued To", render: (s) => s }, { label: "Issued By", render: () => "" }], { height: "160px" });
      lb.setRows([]);
      d.body.append(el("div", void 0, `Mapped user account: ${name}`), (() => {
        lb.el.style.marginTop = "8px";
        return lb.el;
      })(), (() => {
        const r = el("div");
        r.style.cssText = "display:flex;gap:8px;margin-top:8px;";
        r.append(button("Add...", () => void 0, { disabled: true }), button("Remove", () => void 0, { disabled: true }));
        return r;
      })());
    }
    function openHomePage(u) {
      const url = u.attrs?.wWWHomePage;
      if (!url) {
        messageBox(`No home page is set for ${u.displayName}. Enter one on the General tab (Web page).`, { kind: "info" });
        return;
      }
      messageBox(`${u.displayName}'s home page is ${url}. Open it in the Browser app.`, { kind: "info" });
    }
    function helpDialog() {
      messageBox(
        "Active Directory Users and Computers\n\n- Right-click the domain or an OU and choose New to create an Organizational Unit, User or Group.\n- Right-click a user for Reset Password..., Disable Account, Add to a group..., Move... and Copy...\n- Double-click an object for its Properties; Member Of lists its groups.\n- View > Advanced Features shows the Object, Security and Attribute Editor tabs.\n- Every action here is also a cmdlet in the Terminal (New-ADUser, Set-ADAccountPassword, Add-ADGroupMember, Move-ADObject...).",
        { title: "Help", kind: "info" }
      );
    }
    function aboutDialog() {
      messageBox(
        `Active Directory Users and Computers
Version 10.0.20348

Connected to ${DC_FQDN} in ${DOMAIN}.

A simulated console for practice. Everything it does is also a cmdlet in the terminal; Get-Help lists them.`,
        { title: "About Active Directory Users and Computers", kind: "info" }
      );
    }
    applyChrome();
    refresh();
    tree.focus();
  }

  // aduc/entry.ts
  var g = globalThis;
  var listeners = /* @__PURE__ */ new Set();
  var queued = false;
  var originalSave = g.save;
  g.save = function(...args) {
    const r = originalSave.apply(this, args);
    if (!queued && listeners.size) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        syncComputers();
        listeners.forEach((fn) => fn());
      });
    }
    return r;
  };
  function services() {
    return {
      dir: new Dir(),
      idp: { validatePassword },
      audit: null,
      cloud: null,
      pim: null,
      tickets: null,
      changed: () => g.save(),
      onWorldChange: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      world: () => g.state,
      domains: () => ["corp.example.test"]
    };
  }
  g.renderDirectory = () => {
    const body2 = document.getElementById("appBody");
    if (!body2 || body2.querySelector(":scope > .corp-aduc")) return;
    body2.innerHTML = "";
    const host = document.createElement("div");
    host.className = "corp-aduc";
    host.style.cssText = "display:flex;flex-direction:column;height:100%;";
    body2.appendChild(host);
    syncComputers();
    renderActiveDirectoryWindow(host, services());
  };
  (g.CorpDesk || (g.CorpDesk = {})).aducCapability = (capId, args) => runCapability(g.state, capId, args);
})();
