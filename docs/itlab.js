(() => {
  // itlab/corp.ts
  var G = globalThis;
  var S = () => state;
  var APPS = () => apps;
  var TICKETS = () => tickets;
  var CHECK_LABELS = () => checkLabels;
  var DOMAIN = "corp.example.test";
  var corpUser = (sam) => state.users.find((u) => u.sam.toLowerCase() === String(sam).toLowerCase());
  var log = (id, message) => G.log(id, message);
  var evidence = (key) => G.evidence(key);
  var toast = (message) => G.toast(message);
  var openApp = (id) => G.openApp(id);
  var save = () => G.save();
  function ps(command) {
    const r = G.runCommand(command);
    if (r.error) throw new Error(String(r.output).split("\n")[0]);
    return String(r.output ?? "");
  }
  var q = (v) => `'${String(v ?? "").replace(/'/g, "''")}'`;
  var listeners = /* @__PURE__ */ new Set();
  var queued = false;
  var original = G.save;
  G.save = function(...a) {
    const r = original.apply(this, a);
    if (!queued && listeners.size) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        listeners.forEach((fn) => fn());
      });
    }
    return r;
  };
  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
  var daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
  function hash(seed, salt) {
    let h2 = 2166136261 ^ salt;
    for (const c of seed) h2 = Math.imul(h2 ^ c.charCodeAt(0), 16777619) >>> 0;
    return h2 >>> 0;
  }
  var recoveryKey = (seed) => Array.from({ length: 8 }, (_, i) => String(hash(seed, i * 7919) % 1e6).padStart(6, "0")).join("-");
  var keyId = (seed) => {
    const hex = Array.from({ length: 4 }, (_, i) => hash(seed, 31 + i).toString(16).padStart(8, "0")).join("").toUpperCase();
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  };
  var deviceFor = (u) => `${{ HR: "HR", IT: "IT", Finance: "FIN" }[u.dept] ?? "CORP"}-PC${(String(u.sam).match(/\d+$/) ?? ["01"])[0].padStart(2, "0")}`;
  function lab() {
    const s = state;
    if (s.itlab?.version === 1) return s.itlab;
    const users = s.users;
    const data = {
      version: 1,
      synced: users.map((u) => u.sam),
      licenses: Object.fromEntries(users.map((u) => [u.sam, "Microsoft 365 E3"])),
      licenseTotal: 30,
      blocked: [],
      sessionsRevoked: {},
      mailboxes: [
        ...users.map((u, i) => ({ address: `${u.sam}@${DOMAIN}`, name: u.name, type: "user", owner: u.sam, fullAccess: [], sendAs: [], sizeGb: Math.round((3 + i * 7 % 31) * 10) / 10, quotaGb: 50 })),
        { address: `hr@${DOMAIN}`, name: "HR Team", type: "shared", fullAccess: ["hr01"], sendAs: ["hr01"], sizeGb: 12.4, quotaGb: 50 },
        { address: `finance@${DOMAIN}`, name: "Finance Team", type: "shared", fullAccess: ["finance01"], sendAs: ["finance01"], sizeGb: 18.9, quotaGb: 50 },
        { address: `servicedesk@${DOMAIN}`, name: "IT Service Desk", type: "shared", fullAccess: ["it01", "it02"], sendAs: ["it01"], sizeGb: 7.2, quotaGb: 50 }
      ],
      methods: Object.fromEntries(users.map((u, i) => [u.sam, [
        { id: `${u.sam}-app`, type: "Microsoft Authenticator", detail: `${u.name.split(" ")[0]}'s iPhone`, added: daysAgo(200 + i) },
        { id: `${u.sam}-sms`, type: "Phone (SMS)", detail: `+1 555 01${String(10 + i).slice(-2)}`, added: daysAgo(420 + i) }
      ]])),
      reregister: {},
      devices: users.map((u, i) => ({
        name: deviceFor(u),
        owner: u.sam,
        os: "Windows 11 Enterprise 23H2",
        compliant: true,
        lastSync: daysAgo(i % 3),
        keys: [{ id: keyId(`${u.sam}-a`), key: recoveryKey(`${u.sam}-a`), created: daysAgo(300 + i) }]
      })),
      printers: [
        { name: "HR-PRN01", location: "Building 1, Floor 2 (HR)", driver: "HP Universal Printing PCL 6", port: "10.77.0.61" },
        { name: "FIN-PRN01", location: "Building 1, Floor 3 (Finance)", driver: "HP Universal Printing PCL 6", port: "10.77.0.62" },
        { name: "IT-PRN01", location: "Building 2, IT workroom", driver: "Microsoft IPP Class Driver", port: "10.77.0.63" }
      ],
      jobs: [],
      testPages: {},
      inbox: [{
        id: "m-welcome",
        from: `it01@${DOMAIN}`,
        fromName: "Alex Morgan",
        to: `servicedesk@${DOMAIN}`,
        subject: "Welcome to the service desk mailbox",
        body: "Hi team,\n\nThis is the shared IT Service Desk mailbox. Users forward suspicious messages here, and managers send onboarding and termination notices.\n\nAlways check a request against its ticket and approval before you act on it.\n\nAlex\nIT Lead",
        received: daysAgo(3),
        headers: `From: Alex Morgan <it01@${DOMAIN}>
To: servicedesk@${DOMAIN}
Return-Path: <it01@${DOMAIN}>
Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`,
        read: true
      }],
      blockedSenders: [],
      purged: [],
      verified: {},
      bitlockerProvided: {},
      completedModules: []
    };
    s.itlab = data;
    return data;
  }
  var cloudUsers = () => state.users.filter((u) => lab().synced.includes(u.sam));

  // itlab/dom.ts
  function h(tag, attrs = null, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === void 0 || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "class") el.className = String(v);
      else if (k === "style") el.style.cssText = String(v);
      else if (k === "value" && "value" in el) el.value = String(v);
      else if (k === "checked" || k === "disabled" || k === "selected" || k === "hidden") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (c === null || c === void 0 || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    }
  }
  function svg(markup, size = 20, viewBox = "0 0 24 24") {
    const span = document.createElement("span");
    span.className = "ia-svg";
    span.style.cssText = `width:${size}px;height:${size}px`;
    span.innerHTML = `<svg viewBox="${viewBox}" width="${size}" height="${size}" aria-hidden="true">${markup}</svg>`;
    return span;
  }
  var fmtDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  // itlab/theme.ts
  var MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
  var SUN = '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
  var isDark = () => (S().preferences?.theme ?? "Light") === "Dark";
  var tray = document.querySelector(".system-tray");
  var toggle = h("button", { class: "ia-theme-toggle", type: "button" });
  function applyTheme() {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.body.classList.toggle("settings-dark", dark);
    toggle.replaceChildren(svg(dark ? SUN : MOON, 16));
    toggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
    toggle.setAttribute("aria-label", toggle.title);
  }
  function setDark(dark) {
    var _a3;
    ((_a3 = S()).preferences || (_a3.preferences = {})).theme = dark ? "Dark" : "Light";
    save();
    applyTheme();
    if (document.querySelector("#appBody .settings-shell")) G.renderNetwork?.();
  }
  toggle.addEventListener("click", () => setDark(!isDark()));
  tray?.prepend(toggle);
  new MutationObserver(() => {
    const dark = document.body.classList.contains("settings-dark");
    if (document.documentElement.dataset.theme === "dark" !== dark) applyTheme();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  applyTheme();

  // itlab/ui.ts
  var I = {
    waffle: '<g fill="currentColor"><circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/></g>',
    search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    key: '<circle cx="8" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l8-8M16 6l2.5 2.5M14 8l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    device: '<rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.6"/>',
    sync: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    license: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6"/>',
    health: '<path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    block: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    printer: '<rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="9" width="18" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  };
  function adminShell(o) {
    let group = "";
    const nav3 = [];
    for (const n of o.nav) {
      if (n.group && n.group !== group) {
        group = n.group;
        nav3.push(h("div", { class: "ad2-navgroup" }, group));
      }
      nav3.push(h("button", { class: `ad2-navitem ${n.id === o.active ? "on" : ""}`, type: "button", onClick: () => o.onNav(n.id) }, svg(n.icon, 18), h("span", null, n.label)));
    }
    return h(
      "div",
      { class: "ad2", style: `--ad2-accent:${o.accent}` },
      h("header", { class: "ad2-top" }, svg(I.waffle, 18), h("strong", null, o.product), h("label", { class: "ad2-search" }, svg(I.search, 14), h("input", { placeholder: "Search", "aria-label": "Search", "data-key": "top-search" })), h("span", { class: "ad2-me", title: o.user }, o.user.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase())),
      h("div", { class: "ad2-main" }, h("nav", { class: "ad2-nav", "aria-label": `${o.product} navigation` }, nav3), h("main", { class: "ad2-page", "data-scroll": "page" }, o.page), o.panel ?? null)
    );
  }
  var page = (title, ...kids) => h("div", null, h("h1", { class: "ad2-h1" }, title), ...kids);
  var cmdbar = (...kids) => h("div", { class: "ad2-cmd" }, ...kids);
  var cmd = (icon, label, onClick, disabled = false) => h("button", { class: "ad2-cmdbtn", type: "button", disabled, onClick }, svg(icon, 16), label);
  var btn = (label, onClick, kind = "", disabled = false) => h("button", { class: `ad2-btn ${kind}`, type: "button", disabled, onClick }, label);
  var badge = (text, kind = "") => h("span", { class: `ad2-badge ${kind}` }, text);
  var card = (title, ...kids) => h("section", { class: "ad2-card" }, h("h2", null, title), ...kids);
  var kv = (pairs) => h("dl", { class: "ad2-kv" }, pairs.map(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  var note = (text, kind = "info") => h("div", { class: `ad2-note ${kind}` }, svg(I.info, 16), h("div", null, text));
  function table(cols, rows, o = {}) {
    if (!rows.length) return h("p", { class: "ad2-empty" }, o.empty ?? "No items to show.");
    return h(
      "table",
      { class: "ad2-table" },
      h("thead", null, h("tr", null, cols.map(([c]) => h("th", null, c)))),
      h("tbody", null, rows.map((r) => h("tr", { class: o.selected?.(r) ? "on" : "", tabindex: o.onRow ? "0" : null, onClick: o.onRow ? () => o.onRow(r) : void 0, onKeydown: o.onRow ? (e) => {
        if (e.key === "Enter") o.onRow(r);
      } : void 0 }, cols.map(([, f]) => h("td", null, f(r))))))
    );
  }
  function panel(title, sub, onClose, tabs, active, onTab, ...kids) {
    return h(
      "aside",
      { class: "ad2-panel", role: "dialog", "aria-label": title },
      h("div", { class: "ad2-panel-head" }, h("div", null, h("h2", null, title), sub ? h("small", null, sub) : null), h("button", { class: "ad2-x", type: "button", "aria-label": "Close", onClick: onClose }, svg(I.close, 16))),
      tabs ? h("div", { class: "ad2-tabs", role: "tablist" }, tabs.map((t) => h("button", { class: `ad2-tab ${t === active ? "on" : ""}`, type: "button", role: "tab", onClick: () => onTab?.(t) }, t))) : null,
      h("div", { class: "ad2-panel-body", "data-scroll": "panel" }, ...kids)
    );
  }
  function dialog(title, body4, buttons) {
    const shade = h("div", { class: "ia-shade" });
    const close = () => shade.remove();
    shade.append(h(
      "div",
      { class: "ia-dialog ia", role: "dialog", "aria-label": title },
      h("h2", null, title),
      h("div", { class: "ia-dialog-body" }, body4),
      h("div", { class: "ia-dialog-foot" }, buttons.map(([label, fn, kind]) => h("button", { class: `ad2-btn ${kind ?? ""}`, type: "button", onClick: () => {
        if (fn() !== false) close();
      } }, label)))
    ));
    document.body.appendChild(shade);
    shade.querySelector("input,select,textarea,button.primary")?.focus();
  }

  // itlab/host.ts
  var tools = /* @__PURE__ */ new Map();
  var live = /* @__PURE__ */ new Map();
  function registerTool(t) {
    tools.set(t.id, t);
    const apps2 = APPS();
    const entry = { id: t.id, name: t.name, short: t.short, bg: "transparent", fg: "#fff", icon: `<svg viewBox="0 0 34 34" aria-hidden="true">${t.icon}</svg>` };
    const existing = apps2.find((a) => a.id === t.id);
    if (existing) Object.assign(existing, entry);
    else apps2.push(entry);
  }
  function refreshShortcuts() {
    const apps2 = APPS();
    const desk = document.getElementById("desktopIcons");
    if (desk) desk.innerHTML = apps2.map((a) => G.appButton(a, "desktop")).join("");
  }
  function frameOf(id) {
    return document.querySelector(`#desktop .app-window[data-app="${id}"]`);
  }
  function mount(id) {
    const body4 = document.getElementById("appBody");
    const tool = tools.get(id);
    if (!body4 || !tool) return;
    const current = live.get(id);
    if (current && current.host.parentElement === body4) return;
    current?.stop();
    body4.replaceChildren();
    const host = document.createElement("div");
    host.className = "ia";
    host.dataset.tool = id;
    body4.appendChild(host);
    const frame = frameOf(id);
    if (frame && !frame.dataset.iaSized) {
      frame.dataset.iaSized = "true";
      if (!frame.classList.contains("maximized")) {
        const w = Math.min(tool.width, innerWidth - 24), hgt = Math.min(tool.height, innerHeight - 76);
        frame.style.width = `${w}px`;
        frame.style.height = `${hgt}px`;
        const r = frame.getBoundingClientRect();
        frame.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 12))}px`;
        frame.style.top = `${Math.max(8, Math.min(r.top, innerHeight - hgt - 60))}px`;
      }
    }
    const redraw = () => {
      if (!host.isConnected) return;
      const active = document.activeElement;
      const focusKey = active && host.contains(active) ? active.dataset.key : void 0;
      const caret = focusKey && "selectionStart" in active ? active.selectionStart : null;
      const scrolls = [...host.querySelectorAll("[data-scroll]")].map((e) => [e.dataset.scroll, e.scrollTop]);
      host.replaceChildren();
      tool.draw(host);
      for (const [k, top] of scrolls) {
        const e = host.querySelector(`[data-scroll="${k}"]`);
        if (e) e.scrollTop = top;
      }
      if (focusKey) {
        const e = host.querySelector(`[data-key="${focusKey}"]`);
        if (e) {
          e.focus();
          if (caret !== null) try {
            e.setSelectionRange(caret, caret);
          } catch {
          }
        }
      }
    };
    redraw();
    live.set(id, { host, stop: onChange(redraw) });
  }
  var previousRender = G.render;
  G.render = () => {
    if (currentApp && tools.has(currentApp)) mount(currentApp);
    else previousRender();
  };
  var _a;
  var api = (_a = G).CorpDesk || (_a.CorpDesk = {});
  var afterClose = api.afterCloseApp;
  api.afterCloseApp = (id) => {
    const it = live.get(id);
    if (it) {
      it.stop();
      live.delete(id);
    }
    afterClose?.(id);
  };

  // itlab/tools/m365.ts
  var LICENSE = "Microsoft 365 E3";
  var nav = "users";
  var selected = null;
  var tab = "Account";
  var sharedSel = null;
  var explorerQuery = "";
  function deltaSync() {
    var _a3, _b;
    const L = lab();
    const users = S().users;
    const added = users.map((u) => u.sam).filter((sam) => !L.synced.includes(sam));
    const removed = L.synced.filter((sam) => !users.some((u) => u.sam === sam));
    L.synced = users.map((u) => u.sam);
    for (const sam of removed) {
      delete L.licenses[sam];
    }
    for (const sam of added) (_a3 = L.licenses)[sam] ?? (_a3[sam] = null);
    ((_b = S()).preferences || (_b.preferences = {})).lastSync = nowIso();
    log(6946, `Entra Connect delta sync: ${added.length} added, ${removed.length} removed`);
    evidence("sync");
    save();
    return { added, removed };
  }
  function ensureMailbox(sam) {
    const L = lab();
    const u = corpUser(sam);
    if (u && !L.mailboxes.some((m) => m.owner === sam)) L.mailboxes.push({ address: `${sam}@${DOMAIN}`, name: u.name, type: "user", owner: sam, fullAccess: [], sendAs: [], sizeGb: 0.1, quotaGb: 50 });
  }
  var assigned = () => Object.values(lab().licenses).filter((v) => v === LICENSE).length;
  function pickUser(title, onPick) {
    const sel = h("select", { class: "ad2-input", "aria-label": "User" }, cloudUsers().map((u) => h("option", { value: u.sam }, `${u.name} (${u.sam}@${DOMAIN})`)));
    dialog(title, h("label", { class: "ad2-field" }, "User", sel), [["Add", () => {
      onPick(sel.value);
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function perms(list, label, onAdd, onRemove) {
    return h(
      "div",
      { class: "ad2-perm" },
      h("div", { class: "ad2-perm-head" }, h("b", null, label), btn("+ Add permissions", () => pickUser(`Add ${label.toLowerCase()} permission`, onAdd))),
      list.length ? h("ul", null, list.map((sam) => h("li", null, h("span", null, corpUser(sam)?.name ?? sam, h("small", null, ` ${sam}@${DOMAIN}`)), h("button", { class: "ad2-link", type: "button", onClick: () => onRemove(sam) }, "Remove")))) : h("p", { class: "ad2-muted" }, "No one has this permission.")
    );
  }
  function userPanel(sam) {
    const L = lab();
    const u = corpUser(sam);
    const close = () => {
      selected = null;
      save();
    };
    if (!u) return panel("User not found", "", close, null, null, null, note("This account no longer exists in Active Directory. Run a delta sync to remove it."));
    const blocked = L.blocked.includes(sam);
    const mbx = L.mailboxes.find((m) => m.owner === sam);
    let body4;
    if (tab === "Account") {
      body4 = h(
        "div",
        null,
        kv([["Username", `${sam}@${DOMAIN}`], ["Display name", u.name], ["Department", u.dept], ["Job title", u.title || "—"], ["Source", "Windows Server AD (synced with Entra Connect)"], ["Last password change", u.passwordLastSet ? fmtDate(u.passwordLastSet) : "Not recorded"]]),
        card(
          "Sign-in",
          h("p", { class: "ad2-muted" }, blocked ? "This user is blocked from signing in to Microsoft 365." : "This user can sign in to Microsoft 365."),
          h(
            "div",
            { class: "ad2-row" },
            btn(blocked ? "Unblock sign-in" : "Block sign-in", () => {
              L.blocked = blocked ? L.blocked.filter((x) => x !== sam) : [...L.blocked, sam];
              log(blocked ? 6005 : 6004, `${sam}: Microsoft 365 sign-in ${blocked ? "allowed" : "blocked"}`);
              save();
            }, blocked ? "" : "primary"),
            btn("Sign out of all sessions", () => {
              L.sessionsRevoked[sam] = nowIso();
              log(6010, `${sam}: all Microsoft 365 sessions revoked`);
              evidence("revoke");
              save();
              toast(`${u.name} will be signed out of every app within the hour.`);
            })
          )
        ),
        card(
          "Password",
          h("p", { class: "ad2-muted" }, "Password writeback is on: a reset here is written to Active Directory."),
          btn("Reset password", () => {
            const pw = h("input", { class: "ad2-input", type: "password", "aria-label": "Temporary password", autocomplete: "new-password" });
            const must = h("input", { type: "checkbox", checked: true });
            dialog(`Reset password for ${u.name}`, h("div", null, h("label", { class: "ad2-field" }, "Temporary password (14+ characters, upper, lower, digit)", pw), h("label", { class: "ad2-check" }, must, "Require this user to change their password when they first sign in"), h("p", { class: "ad2-muted" }, "Give the temporary password to the user over a verified channel, never in the ticket.")), [["Reset password", () => {
              const v = pw.value;
              if (v.length < 14 || !/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/[0-9]/.test(v)) {
                toast("The password does not meet the domain policy (14+ characters with upper, lower and a digit).");
                return false;
              }
              u.accountOptions || (u.accountOptions = {});
              u.accountOptions.mustChange = must.checked;
              u.passwordLastSet = nowIso();
              log(4724, `${sam}: password reset from Microsoft 365 admin center (written back to AD; no password stored)`);
              save();
            }, "primary"], ["Cancel", () => void 0]]);
          })
        )
      );
    } else if (tab === "Licenses and apps") {
      const has = L.licenses[sam] === LICENSE;
      const box = h("input", { type: "checkbox", checked: has, "aria-label": LICENSE });
      body4 = h(
        "div",
        null,
        h("p", { class: "ad2-muted" }, "Select a location and licences. The mailbox is created when an Exchange licence is assigned."),
        h("label", { class: "ad2-check big" }, box, h("span", null, h("b", null, LICENSE), h("small", null, `${30 - assigned()} of 30 licences available`))),
        btn("Save changes", () => {
          if (box.checked && !has && assigned() >= lab().licenseTotal) {
            toast("There are no licences left. Remove one from a leaver or buy more under Billing.");
            return;
          }
          L.licenses[sam] = box.checked ? LICENSE : null;
          if (box.checked) ensureMailbox(sam);
          log(6020, `${sam}: ${LICENSE} ${box.checked ? "assigned" : "removed"}`);
          save();
          toast("Licences updated.");
        }, "primary")
      );
    } else {
      body4 = mbx ? h(
        "div",
        null,
        kv([["Email address", mbx.address], ["Mailbox type", mbx.type === "shared" ? "Shared mailbox" : "User mailbox"], ["Usage", `${mbx.sizeGb} GB of ${mbx.quotaGb} GB`]]),
        mbx.type === "user" ? card("Convert mailbox", h("p", { class: "ad2-muted" }, "Convert a leaver's mailbox to a shared mailbox to keep their email without a licence, then give their manager access."), btn("Convert to shared mailbox", () => {
          mbx.type = "shared";
          log(6030, `${sam}: mailbox converted to shared`);
          save();
        })) : note("This is a shared mailbox. It keeps the email and needs no licence (under 50 GB).", "ok"),
        card(
          "Mailbox permissions",
          perms(mbx.fullAccess, "Read and manage (Full Access)", (x) => {
            if (!mbx.fullAccess.includes(x)) mbx.fullAccess.push(x);
            log(6031, `${x}: Full Access to ${mbx.address}`);
            save();
          }, (x) => {
            mbx.fullAccess = mbx.fullAccess.filter((y) => y !== x);
            log(6032, `${x}: Full Access removed from ${mbx.address}`);
            save();
          }),
          perms(mbx.sendAs, "Send as", (x) => {
            if (!mbx.sendAs.includes(x)) mbx.sendAs.push(x);
            log(6033, `${x}: Send As on ${mbx.address}`);
            save();
          }, (x) => {
            mbx.sendAs = mbx.sendAs.filter((y) => y !== x);
            log(6034, `${x}: Send As removed from ${mbx.address}`);
            save();
          })
        )
      ) : note("No mailbox yet. Assign an Exchange Online licence (Microsoft 365 E3) to create it.", "warn");
    }
    return panel(u.name, `${sam}@${DOMAIN}`, close, ["Account", "Licenses and apps", "Mail"], tab, (t) => {
      tab = t;
      save();
    }, body4);
  }
  function sharedPanel(address) {
    const L = lab();
    const m = L.mailboxes.find((x) => x.address === address);
    const close = () => {
      sharedSel = null;
      save();
    };
    return panel(
      m.name,
      m.address,
      close,
      null,
      null,
      null,
      kv([["Type", "Shared mailbox"], ["Usage", `${m.sizeGb} GB of ${m.quotaGb} GB`]]),
      note("Grant access only with the mailbox owner's or manager's approval recorded on the ticket."),
      perms(m.fullAccess, "Read and manage (Full Access)", (x) => {
        if (!m.fullAccess.includes(x)) m.fullAccess.push(x);
        log(6031, `${x}: Full Access to ${m.address}`);
        save();
      }, (x) => {
        m.fullAccess = m.fullAccess.filter((y) => y !== x);
        log(6032, `${x}: Full Access removed from ${m.address}`);
        save();
      }),
      perms(m.sendAs, "Send as", (x) => {
        if (!m.sendAs.includes(x)) m.sendAs.push(x);
        log(6033, `${x}: Send As on ${m.address}`);
        save();
      }, (x) => {
        m.sendAs = m.sendAs.filter((y) => y !== x);
        log(6034, `${x}: Send As removed from ${m.address}`);
        save();
      })
    );
  }
  function body() {
    const L = lab();
    const users = cloudUsers();
    if (nav === "home") {
      const unsynced = S().users.filter((u) => !L.synced.includes(u.sam)).length;
      return { panel: null, page: page(
        "Home",
        h(
          "div",
          { class: "ad2-cards" },
          card("User management", h("p", { class: "ad2-muted" }, `${users.length} active users`), btn("Go to Active users", () => {
            nav = "users";
            save();
          }, "primary")),
          card("Licences", h("p", { class: "ad2-muted" }, `${assigned()} of ${L.licenseTotal} ${LICENSE} assigned`), btn("Manage licences", () => {
            nav = "licenses";
            save();
          })),
          card("Directory sync", unsynced ? badge(`${unsynced} AD account(s) waiting for sync`, "warn") : badge("Up to date", "ok"), h("p", { class: "ad2-muted" }, `Last sync: ${S().preferences?.lastSync ? fmtDate(S().preferences.lastSync) : "over 30 minutes ago"}`), btn("Directory sync status", () => {
            nav = "sync";
            save();
          })),
          card("Email security", h("p", { class: "ad2-muted" }, "Find and remove phishing that reached mailboxes."), btn("Open Explorer", () => {
            nav = "explorer";
            save();
          }))
        )
      ) };
    }
    if (nav === "users") {
      return {
        panel: selected ? userPanel(selected) : null,
        page: page(
          "Active users",
          note("Hybrid organization: create and delete accounts in Active Directory, then run a delta sync. Manage licences, mailboxes and sign-in here."),
          cmdbar(cmd(I.user, "Add a user", () => toast("This organization syncs from Active Directory. Create the account in Active Directory Users and Computers, then run a delta sync.")), cmd(I.sync, "Run delta sync", () => {
            const r = deltaSync();
            toast(`Delta sync complete: ${r.added.length} added, ${r.removed.length} removed.`);
          }), cmd(I.refresh, "Refresh", () => save())),
          table([
            ["Display name", (u) => h("b", null, u.name)],
            ["Username", (u) => `${u.sam}@${DOMAIN}`],
            ["Licences", (u) => L.licenses[u.sam] ?? h("span", { class: "ad2-muted" }, "Unlicensed")],
            ["Sign-in", (u) => L.blocked.includes(u.sam) ? badge("Blocked", "bad") : badge("Allowed", "ok")],
            ["Sync status", () => badge("Synced from on-premises", "info")]
          ], users, { onRow: (u) => {
            selected = u.sam;
            tab = "Account";
            save();
          }, selected: (u) => u.sam === selected })
        )
      };
    }
    if (nav === "shared") {
      const shared = L.mailboxes.filter((m) => m.type === "shared");
      return {
        panel: sharedSel ? sharedPanel(sharedSel) : null,
        page: page(
          "Shared mailboxes",
          h("p", { class: "ad2-muted" }, "Mailboxes a team shares, and the mailboxes of people who have left."),
          table([["Name", (m) => h("b", null, m.name)], ["Email address", (m) => m.address], ["Members with Full Access", (m) => String(m.fullAccess.length)]], shared, { onRow: (m) => {
            sharedSel = m.address;
            save();
          }, selected: (m) => m.address === sharedSel })
        )
      };
    }
    if (nav === "licenses") {
      return { panel: null, page: page(
        "Licences",
        table([["Product", (r) => h("b", null, r.p)], ["Available", (r) => String(r.total - r.used)], ["Assigned", (r) => String(r.used)], ["Total", (r) => String(r.total)]], [{ p: LICENSE, total: L.licenseTotal, used: assigned() }]),
        note("When someone leaves, remove their licence (after converting the mailbox to shared) so a new hire can use it.")
      ) };
    }
    if (nav === "sync") {
      const pending = S().users.filter((u) => !L.synced.includes(u.sam));
      return { panel: null, page: page(
        "Directory sync status",
        kv([["Directory sync", "Enabled (Microsoft Entra Connect on LAB-DC01)"], ["Last sync", S().preferences?.lastSync ? fmtDate(S().preferences.lastSync) : "Over 30 minutes ago"], ["Sync interval", "Every 30 minutes"], ["Password hash sync", "Enabled"], ["Password writeback", "Enabled"]]),
        pending.length ? note(`${pending.length} new account(s) in Active Directory have not synced yet: ${pending.map((u) => u.sam).join(", ")}`, "warn") : note("All Active Directory accounts are in Microsoft 365.", "ok"),
        h("div", { class: "ad2-row" }, btn("Run delta sync now", () => {
          const r = deltaSync();
          toast(`Delta sync complete: ${r.added.length} added, ${r.removed.length} removed.`);
        }, "primary")),
        h("p", { class: "ad2-muted" }, "On the server this is: Start-ADSyncSyncCycle -PolicyType Delta (you can run it in PowerShell too).")
      ) };
    }
    if (nav === "explorer") {
      const all = L.inbox.filter((m) => m.recipients?.length);
      const hits = all.filter((m) => !explorerQuery || `${m.from} ${m.subject}`.toLowerCase().includes(explorerQuery.toLowerCase()));
      const input2 = h("input", { class: "ad2-input", placeholder: "Sender address or domain, or subject", value: explorerQuery, "data-key": "explorer-q", "aria-label": "Search messages" });
      input2.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          explorerQuery = input2.value;
          evidence("explorer");
          save();
        }
      });
      return { panel: null, page: page(
        "Explorer (email & collaboration)",
        h("p", { class: "ad2-muted" }, "Find every copy of a message that was delivered, then remove it from all mailboxes."),
        h("div", { class: "ad2-row" }, input2, btn("Search", () => {
          explorerQuery = input2.value;
          evidence("explorer");
          save();
        }, "primary")),
        table(
          [
            ["Received", (m) => fmtDate(m.received)],
            ["Sender", (m) => m.from],
            ["Subject", (m) => m.subject],
            ["Recipients", (m) => String(m.recipients.length)],
            ["Delivery", (m) => L.purged.includes(m.id) ? badge("Removed (soft delete)", "ok") : badge("Inbox", "warn")],
            ["", (m) => L.purged.includes(m.id) ? "" : btn("Soft delete from all mailboxes", () => {
              L.purged.push(m.id);
              log(6040, `Message "${m.subject}" from ${m.from} soft-deleted from ${m.recipients.length} mailboxes`);
              save();
              toast("Message removed from every mailbox it reached.");
            }, "primary")]
          ],
          hits,
          { empty: explorerQuery ? "No delivered messages match." : "Search for a sender or subject." }
        )
      ) };
    }
    const input = h("input", { class: "ad2-input", placeholder: "Sender address or domain, e.g. bad.example", "data-key": "block-input", "aria-label": "Sender to block" });
    return { panel: null, page: page(
      "Tenant Allow/Block List",
      h("p", { class: "ad2-muted" }, "Block a sender or domain so future messages are rejected for everyone."),
      h("div", { class: "ad2-row" }, input, btn("Block", () => {
        const v = input.value.trim().toLowerCase();
        if (!v) return;
        if (!L.blockedSenders.includes(v)) L.blockedSenders.push(v);
        log(6041, `Sender ${v} blocked tenant-wide`);
        save();
      }, "primary")),
      table([["Blocked sender", (s) => h("b", null, s)], ["", (s) => btn("Remove", () => {
        L.blockedSenders = L.blockedSenders.filter((x) => x !== s);
        save();
      })]], L.blockedSenders, { empty: "No senders are blocked." })
    ) };
  }
  registerTool({
    id: "m365",
    name: "Microsoft 365 admin center",
    short: "M365 Admin",
    width: 1180,
    height: 720,
    icon: '<rect x="3" y="3" width="13" height="13" rx="2" fill="#eb3c00"/><rect x="18" y="3" width="13" height="13" rx="2" fill="#2fb300"/><rect x="3" y="18" width="13" height="13" rx="2" fill="#0078d4"/><rect x="18" y="18" width="13" height="13" rx="2" fill="#ffb900"/>',
    draw(host) {
      const b = body();
      host.append(adminShell({
        product: "Microsoft 365 admin center",
        accent: "#0f6cbd",
        active: nav,
        user: S().technician || "Technician",
        onNav: (id) => {
          nav = id;
          selected = null;
          sharedSel = null;
          save();
        },
        nav: [
          { id: "home", label: "Home", icon: I.home },
          { id: "users", label: "Active users", icon: I.user, group: "Users" },
          { id: "shared", label: "Shared mailboxes", icon: I.mail, group: "Teams & groups" },
          { id: "licenses", label: "Licences", icon: I.license, group: "Billing" },
          { id: "sync", label: "Directory sync status", icon: I.sync, group: "Health" },
          { id: "explorer", label: "Explorer", icon: I.search, group: "Email & collaboration" },
          { id: "block", label: "Tenant Allow/Block List", icon: I.block, group: "Email & collaboration" }
        ],
        page: b.page,
        panel: b.panel
      }));
    }
  });

  // itlab/tools/entra.ts
  var nav2 = "users";
  var selected2 = null;
  var tab2 = "Overview";
  var device = null;
  var shownKeys = /* @__PURE__ */ new Set();
  var query = "";
  function userPanel2(sam) {
    const L = lab();
    const u = corpUser(sam);
    const close = () => {
      selected2 = null;
      save();
    };
    if (!u) return panel("User not found", "", close, null, null, null, note("This account no longer exists."));
    const methods = L.methods[sam] ?? [];
    let body4;
    if (tab2 === "Overview") {
      body4 = h(
        "div",
        null,
        kv([["User principal name", `${sam}@${DOMAIN}`], ["Account enabled", u.enabled ? "Yes" : "No"], ["On-premises sync", "Yes (Entra Connect)"], ["Department", u.dept], ["Last sign-in", u.lastLogon ? fmtDate(u.lastLogon) : "Today"], ["Sessions revoked", L.sessionsRevoked[sam] ? fmtDate(L.sessionsRevoked[sam]) : "Never"]]),
        cmdbar(cmd(I.block, "Revoke sessions", () => {
          dialog("Revoke sessions?", h("p", null, `${u.name} will have to sign in again on every device and app, with MFA. Use this after a password reset, a lost device or a suspected compromise.`), [["Yes", () => {
            L.sessionsRevoked[sam] = nowIso();
            log(6010, `${sam}: all sessions and refresh tokens revoked (Entra)`);
            evidence("revoke");
            save();
          }, "primary"], ["No", () => void 0]]);
        }))
      );
    } else {
      body4 = h(
        "div",
        null,
        note("Remove a method only after you have verified who is asking. A caller who cannot be verified must not have their MFA changed.", "warn"),
        table([["Method", (m) => h("b", null, m.type)], ["Detail", (m) => m.detail], ["Added", (m) => fmtDate(m.added)], ["", (m) => btn("Delete", () => {
          dialog("Delete authentication method?", h("p", null, `Delete ${m.type} (${m.detail}) from ${u.name}?`), [["Delete", () => {
            L.methods[sam] = (L.methods[sam] ?? []).filter((x) => x.id !== m.id);
            log(6050, `${sam}: authentication method ${m.type} (${m.detail}) deleted`);
            save();
          }, "primary"], ["Cancel", () => void 0]]);
        })]], methods, { empty: "No authentication methods. The user will register new ones at next sign-in." }),
        card(
          "Multifactor authentication",
          L.reregister[sam] ? note("The user must register MFA again at next sign-in.", "ok") : h("p", { class: "ad2-muted" }, "Ask the user to register their MFA methods again the next time they sign in (for a new phone)."),
          h("div", { class: "ad2-row" }, btn("Require re-register multifactor authentication", () => {
            L.reregister[sam] = true;
            log(6051, `${sam}: required to re-register MFA`);
            save();
          }, "primary"))
        )
      );
    }
    return panel(u.name, `${sam}@${DOMAIN}`, close, ["Overview", "Authentication methods"], tab2, (t) => {
      tab2 = t;
      save();
    }, body4);
  }
  function devicePanel(name) {
    const L = lab();
    const d = L.devices.find((x) => x.name === name);
    const close = () => {
      device = null;
      save();
    };
    if (!d) return panel("Device not found", "", close, null, null, null);
    const owner = corpUser(d.owner);
    return panel(
      d.name,
      `Owner: ${owner?.name ?? d.owner}`,
      close,
      null,
      null,
      null,
      kv([["Operating system", d.os], ["Join type", "Microsoft Entra hybrid joined"], ["Compliant", d.compliant ? "Yes" : "No"], ["MDM", "Microsoft Intune"], ["Last check-in", fmtDate(d.lastSync)]]),
      card(
        "BitLocker keys",
        note("Match the Key ID the user reads from the recovery screen (the first 8 characters are enough) before you give out a key. Each key you view is audited.", "warn"),
        table([["Key ID", (k) => h("code", null, k.id)], ["Created", (k) => fmtDate(k.created)], ["Recovery key", (k) => shownKeys.has(k.id) ? h("code", { class: "ad2-key" }, k.key) : btn("Show recovery key", () => {
          shownKeys.add(k.id);
          log(6060, `BitLocker recovery key ${k.id.slice(0, 8)} for ${d.name} viewed by ${S().technician}`);
          evidence("bitlocker-view");
          save();
        })]], d.keys)
      )
    );
  }
  function body2() {
    const L = lab();
    const search2 = (placeholder) => {
      const input = h("input", { class: "ad2-input", placeholder, value: query, "data-key": `${nav2}-q`, "aria-label": placeholder });
      input.addEventListener("input", () => {
        query = input.value;
        save();
      });
      return input;
    };
    if (nav2 === "users") {
      const list = cloudUsers().filter((u) => !query || `${u.name} ${u.sam}`.toLowerCase().includes(query.toLowerCase()));
      return { panel: selected2 ? userPanel2(selected2) : null, page: page(
        "Users",
        cmdbar(cmd(I.refresh, "Refresh", () => save())),
        search2("Search by name or username"),
        table([["Display name", (u) => h("b", null, u.name)], ["User principal name", (u) => `${u.sam}@${DOMAIN}`], ["Account enabled", (u) => u.enabled ? badge("Yes", "ok") : badge("No", "bad")], ["MFA methods", (u) => String((L.methods[u.sam] ?? []).length)]], list, { onRow: (u) => {
          selected2 = u.sam;
          tab2 = "Overview";
          save();
        }, selected: (u) => u.sam === selected2 })
      ) };
    }
    if (nav2 === "devices") {
      const list = L.devices.filter((d) => !query || `${d.name} ${d.owner}`.toLowerCase().includes(query.toLowerCase()));
      return { panel: device ? devicePanel(device) : null, page: page(
        "Devices",
        search2("Search by device name or owner"),
        table([["Name", (d) => h("b", null, d.name)], ["Owner", (d) => corpUser(d.owner)?.name ?? d.owner], ["OS", (d) => d.os], ["Compliant", (d) => d.compliant ? badge("Yes", "ok") : badge("No", "bad")], ["Last check-in", (d) => fmtDate(d.lastSync)]], list, { onRow: (d) => {
          device = d.name;
          save();
        }, selected: (d) => d.name === device })
      ) };
    }
    return { panel: null, page: page("Overview", h(
      "div",
      { class: "ad2-cards" },
      card("Tenant", kv([["Name", "CORP"], ["Primary domain", DOMAIN], ["Users", String(cloudUsers().length)], ["Devices", String(L.devices.length)]])),
      card("Service desk tasks", h("ul", { class: "ad2-list" }, h("li", null, "Lost phone: delete the old method, require MFA re-registration, revoke sessions"), h("li", null, "BitLocker recovery: Devices, then the device, then BitLocker keys"), h("li", null, "Compromised account: reset password, revoke sessions")))
    )) };
  }
  registerTool({
    id: "entra",
    name: "Microsoft Entra admin center",
    short: "Entra Admin",
    width: 1180,
    height: 720,
    icon: '<path d="M17 3l12 7v14l-12 7-12-7V10z" fill="#0078d4"/><path d="M17 3l12 7-12 7-12-7z" fill="#50a8ff"/><path d="M17 17v14l12-7V10z" fill="#005ba1"/>',
    draw(host) {
      const b = body2();
      host.append(adminShell({
        product: "Microsoft Entra admin center",
        accent: "#0f6cbd",
        active: nav2,
        user: S().technician || "Technician",
        onNav: (id) => {
          nav2 = id;
          selected2 = null;
          device = null;
          query = "";
          save();
        },
        nav: [{ id: "overview", label: "Overview", icon: I.home }, { id: "users", label: "Users", icon: I.users, group: "Identity" }, { id: "devices", label: "Devices", icon: I.device, group: "Identity" }],
        page: b.page,
        panel: b.panel
      }));
    }
  });

  // itlab/tools/outlook.ts
  var selected3 = null;
  var folder = "inbox";
  function view(host) {
    const L = lab();
    const deleted = (m2) => L.purged.includes(`del:${m2.id}`);
    const list = [...L.inbox].filter((m2) => !m2.hidden && (folder === "deleted" ? deleted(m2) : !deleted(m2))).sort((a, b) => b.received.localeCompare(a.received));
    const m = list.find((x) => x.id === selected3) ?? null;
    const unread = L.inbox.filter((x) => !x.hidden && !x.read && !deleted(x)).length;
    const open2 = (id) => {
      selected3 = id;
      const x = L.inbox.find((y) => y.id === id);
      if (x && !x.read) {
        x.read = true;
      }
      if (x?.evidence) evidence(x.evidence);
      save();
    };
    host.append(h(
      "div",
      { class: "ol" },
      h("header", { class: "ol-top" }, svg(I.waffle, 18), h("strong", null, "Outlook"), h("label", { class: "ol-search" }, svg(I.search, 14), h("input", { placeholder: "Search", "aria-label": "Search mail" }))),
      h(
        "div",
        { class: "ol-main" },
        h(
          "nav",
          { class: "ol-folders" },
          h("div", { class: "ol-acct" }, "IT Service Desk", h("small", null, `servicedesk@${DOMAIN}`)),
          h("button", { class: `ol-folder ${folder === "inbox" ? "on" : ""}`, type: "button", onClick: () => {
            folder = "inbox";
            selected3 = null;
            save();
          } }, svg(I.mail, 16), "Inbox", unread ? h("b", null, String(unread)) : null),
          h("button", { class: `ol-folder ${folder === "deleted" ? "on" : ""}`, type: "button", onClick: () => {
            folder = "deleted";
            selected3 = null;
            save();
          } }, svg(I.trash, 16), "Deleted Items")
        ),
        h(
          "section",
          { class: "ol-list", "data-scroll": "ol" },
          h("div", { class: "ol-list-head" }, folder === "inbox" ? "Focused" : "Deleted Items"),
          list.length ? list.map((x) => h(
            "button",
            { class: `ol-item ${x.id === selected3 ? "on" : ""} ${x.read ? "" : "unread"}`, type: "button", onClick: () => open2(x.id) },
            h("span", { class: "ol-from" }, x.fromName),
            h("span", { class: "ol-subj" }, x.subject),
            h("span", { class: "ol-prev" }, x.body.replace(/\s+/g, " ").slice(0, 80)),
            h("span", { class: "ol-time" }, new Date(x.received).toLocaleDateString())
          )) : h("p", { class: "ad2-muted", style: "padding:16px" }, "Nothing here.")
        ),
        h("article", { class: "ol-read", "data-scroll": "olr" }, m ? [
          h(
            "div",
            { class: "ol-actions" },
            h("button", { class: "ad2-cmdbtn", type: "button", onClick: () => {
              L.purged.push(`del:${m.id}`);
              selected3 = null;
              save();
            } }, svg(I.trash, 16), "Delete"),
            h("button", { class: "ad2-cmdbtn", type: "button", disabled: !!m.reported, onClick: () => {
              dialog("Report phishing", h("p", null, "This message will be sent to Microsoft and your security team, and moved to Deleted Items for this mailbox. It will still be in other people's mailboxes until it is removed with Explorer."), [["Report", () => {
                m.reported = true;
                log(6042, `Message "${m.subject}" from ${m.from} reported as phishing`);
                evidence("phish-report");
                save();
                toast("Reported. Now find and remove every copy in Microsoft 365 > Explorer.");
              }, "primary"], ["Cancel", () => void 0]]);
            } }, svg(I.flag, 16), m.reported ? "Reported" : "Report phishing"),
            h("button", { class: "ad2-cmdbtn", type: "button", onClick: () => {
              evidence("phish-headers");
              dialog("Message details", h("pre", { class: "ol-headers" }, m.headers), [["Close", () => void 0, "primary"]]);
            } }, svg(I.info, 16), "View message details")
          ),
          h("h2", { class: "ol-subject" }, m.subject),
          h("div", { class: "ol-sender" }, h("span", { class: "ol-avatar" }, m.fromName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()), h("div", null, h("b", null, m.fromName), h("small", null, ` <${m.from}>`), h("div", null, h("small", null, `To: ${m.to} · ${fmtDate(m.received)}`)))),
          m.phishing && !m.reported ? h("div", { class: "ol-banner" }, "Caution: This message came from outside your organization. Be careful with links and attachments.") : null,
          h("div", { class: "ol-body" }, m.body.split("\n").map((line) => h("p", null, line || " ")))
        ] : h("div", { class: "ol-empty" }, svg(I.mail, 48), h("p", null, "Select an item to read")))
      )
    ));
  }
  registerTool({
    id: "outlook",
    name: "Outlook",
    short: "Outlook",
    width: 1120,
    height: 700,
    icon: '<rect x="12" y="6" width="19" height="22" rx="2" fill="#28a8ea"/><path d="M12 12l9.5 6 9.5-6" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="3" y="9" width="15" height="16" rx="2" fill="#0a5dc2"/><ellipse cx="10.5" cy="17" rx="4" ry="4.6" fill="none" stroke="#fff" stroke-width="2"/>',
    draw: view
  });

  // itlab/tools/services.ts
  var MORE = [
    { Name: "W32Time", DisplayName: "Windows Time", Status: "Running" },
    { Name: "Dhcp", DisplayName: "DHCP Client", Status: "Running" },
    { Name: "Dnscache", DisplayName: "DNS Client", Status: "Running" },
    { Name: "LanmanWorkstation", DisplayName: "Workstation", Status: "Running" },
    { Name: "BITS", DisplayName: "Background Intelligent Transfer Service", Status: "Running" },
    { Name: "wuauserv", DisplayName: "Windows Update", Status: "Running" },
    { Name: "WinDefend", DisplayName: "Microsoft Defender Antivirus Service", Status: "Running" },
    { Name: "EventLog", DisplayName: "Windows Event Log", Status: "Running" }
  ];
  var INFO = {
    DNS: ["Enables DNS clients to resolve DNS names by answering DNS queries.", "Automatic", "Local System"],
    Netlogon: ["Maintains a secure channel between this computer and the domain controller for authenticating users and services.", "Automatic", "Local System"],
    Spooler: ["This service spools print jobs and handles interaction with the printer. If you turn off this service, you won't be able to print or see your printers.", "Automatic", "Local System"],
    WinRM: ["Windows Remote Management (WinRM) service implements the WS-Management protocol for remote management.", "Automatic (Delayed Start)", "Network Service"],
    W32Time: ["Maintains date and time synchronization on all clients and servers in the network. Kerberos needs clocks within 5 minutes.", "Automatic (Trigger Start)", "Local Service"],
    Dhcp: ["Registers and updates IP addresses and DNS records for this computer.", "Automatic", "Local Service"],
    Dnscache: ["Caches Domain Name System (DNS) names and registers the full computer name for this computer.", "Automatic (Trigger Start)", "Network Service"],
    LanmanWorkstation: ["Creates and maintains client network connections to remote servers using the SMB protocol (mapped drives).", "Automatic", "Network Service"],
    BITS: ["Transfers files in the background using idle network bandwidth.", "Manual", "Local System"],
    wuauserv: ["Enables the detection, download, and installation of updates for Windows and other programs.", "Manual (Trigger Start)", "Local System"],
    WinDefend: ["Helps protect users from malware and other potentially unwanted software.", "Automatic", "Local System"],
    EventLog: ["This service manages events and event logs.", "Automatic", "Local Service"]
  };
  function ensureServices() {
    const s = S();
    s.services || (s.services = []);
    for (const m of MORE) if (!s.services.some((x) => x.Name === m.Name)) s.services.push({ ...m });
  }
  var selService = null;
  function servicesView(host) {
    ensureServices();
    const list = [...S().services].sort((a, b) => a.DisplayName.localeCompare(b.DisplayName));
    const sel = list.find((x) => x.Name === selService);
    const act = (verb) => {
      if (!sel) return;
      try {
        ps(`${verb}-Service -Name ${q(sel.Name)}`);
        if (sel.Name === "Spooler") evidence("spooler");
        save();
      } catch (e) {
        toast(e.message);
      }
    };
    const tb = (icon, title, fn, disabled) => h("button", { class: "svc-tb", type: "button", title, "aria-label": title, disabled, onClick: fn }, svg(icon, 14));
    const PLAY = '<path d="M7 5l12 7-12 7z" fill="#2c9a3c"/>', STOP = '<rect x="6" y="6" width="12" height="12" fill="#333"/>', RESTART = '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#2c9a3c" stroke-width="2.2"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="#2c9a3c" stroke-width="2.2"/>';
    host.append(h(
      "div",
      { class: "svc" },
      h("div", { class: "svc-menu" }, ["File", "Action", "View", "Help"].map((m) => h("span", null, m))),
      h("div", { class: "svc-toolbar" }, tb(PLAY, "Start Service", () => act("Start"), !sel || sel.Status === "Running"), tb(STOP, "Stop Service", () => act("Stop"), !sel || sel.Status !== "Running"), tb(RESTART, "Restart Service", () => act("Restart"), !sel || sel.Status !== "Running")),
      h(
        "div",
        { class: "svc-main" },
        h("aside", { class: "svc-tree" }, h("div", { class: "svc-node" }, "Services (Local)")),
        h("section", { class: "svc-desc" }, sel ? [
          h("h3", null, sel.DisplayName),
          sel.Status === "Running" ? h("p", null, h("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            act("Stop");
          } }, "Stop"), " the service", h("br"), h("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            act("Restart");
          } }, "Restart"), " the service") : h("p", null, h("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            act("Start");
          } }, "Start"), " the service"),
          h("p", null, h("b", null, "Description:"), h("br"), INFO[sel.Name]?.[0] ?? "")
        ] : h("p", null, "Select an item to view its description.")),
        h("div", { class: "svc-list", "data-scroll": "svc" }, h(
          "table",
          null,
          h("thead", null, h("tr", null, ["Name", "Description", "Status", "Startup Type", "Log On As"].map((c) => h("th", null, c)))),
          h("tbody", null, list.map((x) => h(
            "tr",
            { class: x.Name === selService ? "on" : "", tabindex: "0", onClick: () => {
              selService = x.Name;
              save();
            }, onDblclick: () => {
              selService = x.Name;
              save();
            } },
            h("td", null, x.DisplayName),
            h("td", null, (INFO[x.Name]?.[0] ?? "").slice(0, 48) + ((INFO[x.Name]?.[0] ?? "").length > 48 ? "…" : "")),
            h("td", null, x.Status === "Running" ? "Running" : ""),
            h("td", null, INFO[x.Name]?.[1] ?? "Manual"),
            h("td", null, INFO[x.Name]?.[2] ?? "Local System")
          )))
        ))
      ),
      h("div", { class: "svc-tabs" }, h("span", { class: "on" }, "Extended"), h("span", null, "Standard"))
    ));
  }
  registerTool({
    id: "services",
    name: "Services",
    short: "Services",
    width: 980,
    height: 620,
    icon: '<circle cx="14" cy="14" r="8" fill="#7a8591"/><circle cx="14" cy="14" r="3.2" fill="#e6e9ee"/><g stroke="#7a8591" stroke-width="3"><path d="M14 3v4M14 21v4M3 14h4M21 14h4M6.2 6.2l2.8 2.8M19 19l2.8 2.8M6.2 21.8L9 19M19 9l2.8-2.8"/></g><circle cx="25" cy="25" r="6" fill="#2f7fd8"/><circle cx="25" cy="25" r="2.2" fill="#fff"/>',
    draw: servicesView
  });
  var spoolerRunning = () => (S().services ?? []).find((x) => x.Name === "Spooler")?.Status === "Running";
  var selPrinter = null;
  var filter = "all";
  function queueStatus(name) {
    if (!spoolerRunning()) return "Offline (Print Spooler not running)";
    const jobs = lab().jobs.filter((j) => j.printer === name);
    if (jobs.some((j) => j.status === "Error - Printing")) return "Error";
    return jobs.length ? "Printing" : "Ready";
  }
  function printTestPage(name) {
    const L = lab();
    if (!spoolerRunning()) {
      toast("The Print Spooler service is not running. Start it in Services first.");
      return;
    }
    const jobs = L.jobs.filter((j) => j.printer === name);
    if (jobs.some((j) => j.status === "Error - Printing")) {
      toast("A job in error is blocking the queue. Cancel it, then print the test page.");
      return;
    }
    L.testPages[name] = nowIso();
    L.jobs = L.jobs.filter((j) => j.printer !== name);
    log(307, `Test page printed on ${name}`);
    evidence("print-test");
    save();
    toast(`Test page sent to ${name}.`);
  }
  function printView(host) {
    const L = lab();
    const printers = L.printers.filter((p) => filter === "all" || (filter === "notready" ? queueStatus(p.name) !== "Ready" : L.jobs.some((j) => j.printer === p.name)));
    const sel = L.printers.find((p) => p.name === selPrinter);
    const jobs = sel ? L.jobs.filter((j) => j.printer === sel.name) : [];
    const node = (label, f, depth) => h("button", { class: `pm-node ${filter === f ? "on" : ""}`, type: "button", style: `padding-left:${8 + depth * 14}px`, onClick: () => {
      filter = f;
      save();
    } }, svg(f === "all" ? I.printer : I.flag, 14), label);
    host.append(h(
      "div",
      { class: "svc pm" },
      h("div", { class: "svc-menu" }, ["File", "Action", "View", "Help"].map((m) => h("span", null, m))),
      h(
        "div",
        { class: "svc-main" },
        h(
          "aside",
          { class: "svc-tree" },
          h("div", { class: "svc-node" }, "Print Management"),
          h("div", { class: "svc-node", style: "padding-left:18px" }, "Custom Filters"),
          node("Printers Not Ready", "notready", 2),
          node("Printers With Jobs", "jobs", 2),
          h("div", { class: "svc-node", style: "padding-left:18px" }, "Print Servers"),
          h("div", { class: "svc-node", style: "padding-left:32px" }, "LAB-DC01 (local)"),
          node("Printers", "all", 3)
        ),
        h(
          "div",
          { class: "pm-right" },
          h("div", { class: "svc-list", "data-scroll": "pm" }, h(
            "table",
            null,
            h("thead", null, h("tr", null, ["Printer Name", "Queue Status", "Jobs In Queue", "Server Name", "Driver Name", "Location"].map((c) => h("th", null, c)))),
            h("tbody", null, printers.map((p) => h(
              "tr",
              { class: p.name === selPrinter ? "on" : "", tabindex: "0", onClick: () => {
                selPrinter = p.name;
                evidence("print-queue-view");
                save();
              } },
              h("td", null, p.name),
              h("td", null, queueStatus(p.name)),
              h("td", null, String(L.jobs.filter((j) => j.printer === p.name).length)),
              h("td", null, "LAB-DC01 (local)"),
              h("td", null, p.driver),
              h("td", null, p.location)
            )))
          )),
          sel ? h(
            "section",
            { class: "pm-queue" },
            h("div", { class: "pm-qhead" }, h("b", null, `${sel.name} — Print queue`), h("span", null, queueStatus(sel.name)), h("button", { class: "ad2-btn primary", type: "button", onClick: () => printTestPage(sel.name) }, "Print Test Page")),
            jobs.length ? h(
              "table",
              null,
              h("thead", null, h("tr", null, ["Document Name", "Status", "Owner", "Pages", "Submitted", ""].map((c) => h("th", null, c)))),
              h("tbody", null, jobs.map((j) => h(
                "tr",
                { class: j.status === "Error - Printing" ? "err" : "" },
                h("td", null, j.document),
                h("td", null, j.status),
                h("td", null, j.owner),
                h("td", null, String(j.pages)),
                h("td", null, fmtDate(j.submitted)),
                h("td", null, h("button", { class: "ad2-btn", type: "button", onClick: () => {
                  L.jobs = L.jobs.filter((x) => x.id !== j.id);
                  log(13, `Print job ${j.id} (${j.document}) on ${sel.name} cancelled`);
                  if (j.status === "Error - Printing") evidence("print-queue");
                  save();
                } }, "Cancel"))
              )))
            ) : h("p", { class: "ad2-muted" }, "There are no documents in the queue."),
            L.testPages[sel.name] ? h("p", { class: "ad2-muted" }, `Last test page: ${fmtDate(L.testPages[sel.name])}`) : null
          ) : h("p", { class: "pm-hint" }, "Select a printer to open its queue.")
        )
      )
    ));
  }
  registerTool({
    id: "printmgmt",
    name: "Print Management",
    short: "Print Mgmt",
    width: 1060,
    height: 640,
    icon: '<rect x="9" y="4" width="16" height="8" fill="#fff" stroke="#5f6770" stroke-width="1.4"/><rect x="4" y="12" width="26" height="12" rx="2" fill="#5f6b7a"/><rect x="10" y="20" width="14" height="10" fill="#fff" stroke="#5f6770" stroke-width="1.4"/><circle cx="26" cy="16" r="1.5" fill="#4caf50"/>',
    draw: printView
  });

  // itlab/labs.ts
  var redrawDesk = () => {
    if (currentApp === "tickets") G.renderTickets();
  };
  var renderTicketsUnguarded = G.renderTickets;
  G.renderTickets = () => {
    if (currentApp === "tickets") renderTicketsUnguarded();
  };
  var E3 = "Microsoft 365 E3";
  var NL = "\n";
  var after = (iso, id) => !!iso && iso >= lab().started?.[id];
  var started = () => {
    var _a3;
    return (_a3 = lab()).started || (_a3.started = {});
  };
  var mail = (m) => {
    const L = lab();
    L.inbox = L.inbox.filter((x) => x.id !== m.id);
    L.inbox.push({ to: `servicedesk@${DOMAIN}`, received: nowIso(), read: false, headers: `From: ${m.fromName} <${m.from}>
To: servicedesk@${DOMAIN}
Return-Path: <${m.from}>
Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`, ...m });
    L.purged = L.purged.filter((x) => x !== m.id && x !== `del:${m.id}`);
  };
  var unmail = (id) => {
    const L = lab();
    L.inbox = L.inbox.filter((x) => x.id !== id);
  };
  var NEW_HIRE = "pshah";
  var PHISH_DOMAIN = "corp-example-payments.com";
  var BL_DEVICE = "HR-PC04";
  var blKey = () => ({ id: keyId("hr04-bios"), key: recoveryKey("hr04-bios") });
  var LABS = [
    {
      id: 6,
      title: "New hire starts Monday: create Priya Shah's accounts",
      user: "finance01",
      category: "Onboarding (joiner)",
      priority: "Medium",
      summary: "Olivia Grant (Finance manager) has sent the onboarding request to the service desk mailbox. Priya Shah joins Finance as a Financial Analyst on Monday. Create her account exactly as requested, get it into Microsoft 365, license it, and confirm she has a mailbox.",
      hint: "Read the request in Outlook. Create the user in ADUC in Lab > Users > Finance (logon pshah), set the title and manager, add GG_Finance_Staff, and require a password change at first logon. Then run a delta sync (M365 admin or Start-ADSyncSyncCycle -PolicyType Delta) and assign Microsoft 365 E3.",
      checks: ["onboard-request", "sync"],
      tools: ["outlook", "directory", "m365"],
      realWorld: "Joiners are the most common planned work on a service desk. Accounts are built from an HR request, never from a phone call, and in hybrid companies they reach Microsoft 365 through Entra Connect sync before a licence and mailbox can be assigned.",
      interview: "Walk me through onboarding a new hire: HR request, AD account in the right OU with role groups, sync to Entra ID, licence for a mailbox, and a first-logon password handed over securely.",
      inject() {
        const s = S();
        s.users = s.users.filter((u) => u.sam !== NEW_HIRE);
        const L = lab();
        L.synced = L.synced.filter((x) => x !== NEW_HIRE);
        delete L.licenses[NEW_HIRE];
        L.mailboxes = L.mailboxes.filter((m) => m.owner !== NEW_HIRE);
        mail({
          id: "m-onboard",
          from: `finance01@${DOMAIN}`,
          fromName: "Olivia Grant",
          subject: "New starter Monday: Priya Shah (Finance)",
          evidence: "onboard-request",
          body: "Hi service desk,\n\nPlease set up access for our new starter (HR reference HR-2291, approved).\n\nName: Priya Shah\nLogon name: pshah\nJob title: Financial Analyst\nDepartment: Finance\nManager: Olivia Grant (finance01)\nStart date: Monday\nAccess: Finance team role (GG_Finance_Staff), email (Microsoft 365 E3)\n\nPlease make her change the password the first time she signs in. I will collect her laptop from IT on Monday morning.\n\nThanks,\nOlivia"
        });
      },
      restore() {
        S().users = S().users.filter((u) => u.sam !== NEW_HIRE);
        const L = lab();
        L.synced = L.synced.filter((x) => x !== NEW_HIRE);
        delete L.licenses[NEW_HIRE];
        L.mailboxes = L.mailboxes.filter((m) => m.owner !== NEW_HIRE);
        unmail("m-onboard");
      },
      criteria() {
        const u = corpUser(NEW_HIRE), L = lab();
        return !!u && u.path === "Lab/Users/Finance" && u.groups.includes("GG_Finance_Staff") && /financial analyst/i.test(u.title ?? "") && u.manager === "finance01" && u.enabled && !!u.accountOptions?.mustChange && L.synced.includes(NEW_HIRE) && L.licenses[NEW_HIRE] === E3 && L.mailboxes.some((m) => m.owner === NEW_HIRE);
      }
    },
    {
      id: 7,
      title: "Termination today: offboard Jordan Wells",
      user: "it01",
      category: "Offboarding (leaver)",
      priority: "High",
      summary: "HR has confirmed Jordan Wells (it08) leaves today at 17:00. Follow the leaver checklist in the HR notice: lock the account everywhere, keep the mailbox for his manager, and free the licence. Nothing may be deleted.",
      hint: "ADUC: disable it08, move it to Lab > Disabled, remove its group memberships. Microsoft 365 admin: block sign-in and sign out of all sessions, convert the mailbox to shared, give Alex Morgan (it01) Full Access, then remove the licence.",
      checks: ["leaver-notice", "revoke"],
      tools: ["outlook", "directory", "m365"],
      realWorld: "Leavers are a security task: the account must stop working at the agreed time, sessions already open must be ended, and data is kept (shared mailbox) for the business. Deleting accounts on day one loses mail and audit history.",
      interview: "What do you do when someone is terminated? Disable (not delete), revoke sessions, remove groups, block cloud sign-in, convert the mailbox to shared for the manager, reclaim the licence and the laptop, and document everything on the ticket.",
      inject() {
        const u = corpUser("it08");
        if (u) {
          u.enabled = true;
          u.locked = false;
          u.path = "Lab/Users/IT";
          if (!u.groups.includes("GG_IT_Staff")) u.groups.push("GG_IT_Staff");
        }
        const L = lab();
        if (!L.synced.includes("it08")) L.synced.push("it08");
        L.licenses.it08 = E3;
        L.blocked = L.blocked.filter((x) => x !== "it08");
        const m = L.mailboxes.find((x) => x.owner === "it08");
        if (m) {
          m.type = "user";
          m.fullAccess = [];
          m.sendAs = [];
        }
        mail({
          id: "m-leaver",
          from: `hr01@${DOMAIN}`,
          fromName: "Maya Chen",
          subject: "Leaver notice: Jordan Wells (IT) — today 17:00",
          evidence: "leaver-notice",
          body: "Hello IT,\n\nJordan Wells (it08), IT department, leaves the company today. Last working time: 17:00. HR reference HR-2307.\n\nLeaver checklist:\n1. Disable the account and move it to the Disabled OU. Do not delete it.\n2. Remove all group memberships.\n3. Block Microsoft 365 sign-in and sign him out everywhere.\n4. Convert his mailbox to a shared mailbox and give his manager, Alex Morgan (it01), Full Access.\n5. Remove his Microsoft 365 licence.\n\nThank you,\nMaya Chen, HR"
        });
      },
      restore() {
        const u = corpUser("it08");
        if (u) {
          u.enabled = true;
          u.path = "Lab/Users/IT";
          if (!u.groups.includes("GG_IT_Staff")) u.groups.push("GG_IT_Staff");
        }
        const L = lab();
        L.licenses.it08 = E3;
        L.blocked = L.blocked.filter((x) => x !== "it08");
        const m = L.mailboxes.find((x) => x.owner === "it08");
        if (m) {
          m.type = "user";
          m.fullAccess = [];
          m.sendAs = [];
        }
        unmail("m-leaver");
      },
      criteria() {
        const u = corpUser("it08"), L = lab(), m = L.mailboxes.find((x) => x.owner === "it08");
        return !!u && !u.enabled && u.path === "Lab/Disabled" && u.groups.length === 0 && L.blocked.includes("it08") && after(L.sessionsRevoked.it08, 7) && !!m && m.type === "shared" && m.fullAccess.includes("it01") && !L.licenses.it08;
      }
    },
    {
      id: 8,
      title: "HR cannot print: jobs stuck on HR-PRN01",
      user: "hr06",
      category: "Printing",
      priority: "Medium",
      summary: "Several people in HR say nothing prints on HR-PRN01, and the printer itself shows no error. Liam Park (hr06) sent a large payroll PDF just before it stopped. Find out why the queue is not moving, fix it without losing other people's documents unnecessarily, and prove printing works.",
      hint: "Print Management shows the queue. Is the Print Spooler service running (Services, or Get-Service Spooler)? A corrupt job at the top of a queue blocks everything behind it: cancel only that one, then print a test page.",
      checks: ["spooler", "print-queue", "print-test"],
      tools: ["printmgmt", "services", "terminal"],
      realWorld: `"I can't print" is one of the most frequent service desk calls. The usual causes are a stopped or crashed Print Spooler and a corrupt job jamming the queue. Restarting the spooler and clearing only the bad job is the standard fix.`,
      interview: "A department cannot print. How do you troubleshoot? Check the printer and its queue, the Print Spooler service, clear the stuck job, restart the spooler, then print a test page and confirm with the users.",
      inject() {
        ensureServices();
        const sp = S().services.find((x) => x.Name === "Spooler");
        if (sp) sp.Status = "Stopped";
        const L = lab();
        const t = Date.now();
        L.jobs = L.jobs.filter((j) => j.printer !== "HR-PRN01");
        L.jobs.push(
          { id: 41, printer: "HR-PRN01", owner: "hr06", document: "Payroll_Summary_Q3.pdf", pages: 214, status: "Error - Printing", submitted: new Date(t - 50 * 6e4).toISOString() },
          { id: 42, printer: "HR-PRN01", owner: "hr02", document: "Interview schedule.docx", pages: 2, status: "Queued", submitted: new Date(t - 40 * 6e4).toISOString() },
          { id: 43, printer: "HR-PRN01", owner: "hr05", document: "Leave request - Zoe Reed.pdf", pages: 1, status: "Queued", submitted: new Date(t - 22 * 6e4).toISOString() }
        );
        delete L.testPages["HR-PRN01"];
        log(7031, "The Print Spooler service terminated unexpectedly.");
      },
      restore() {
        ensureServices();
        const sp = S().services.find((x) => x.Name === "Spooler");
        if (sp) sp.Status = "Running";
        const L = lab();
        L.jobs = L.jobs.filter((j) => j.printer !== "HR-PRN01");
      },
      criteria() {
        const L = lab(), sp = S().services.find((x) => x.Name === "Spooler");
        return sp?.Status === "Running" && !L.jobs.some((j) => j.printer === "HR-PRN01" && j.status === "Error - Printing") && after(L.testPages["HR-PRN01"], 8);
      }
    },
    {
      id: 9,
      title: "New phone: reset MFA for a Finance user",
      user: "finance02",
      category: "Identity & MFA",
      priority: "High",
      summary: "A caller says she is a Finance user (finance02), bought a new phone this weekend and can no longer approve sign-ins. Verify who she is before you touch anything, then remove the old authenticator, make her register MFA again and sign her out everywhere.",
      hint: 'Use "Verify caller" on this ticket first. Then Entra admin center > Users > the user > Authentication methods: delete the old Microsoft Authenticator, choose "Require re-register multifactor authentication", and Revoke sessions.',
      checks: ["verify", "revoke"],
      tools: ["entra"],
      realWorld: "MFA resets are a favourite target of social engineering (attackers phone the help desk pretending to be employees). Real service desks verify identity with a call-back to a number on file or a manager-approved code before resetting anything.",
      interview: "Someone calls saying they lost their phone and need MFA reset. What do you do? Verify identity through an approved method, remove the old method, require re-registration, revoke sessions, and note the verification on the ticket.",
      verify: { sam: "finance02", good: "Call her back on the mobile number in the HR directory and confirm with a one-time code sent to her manager", bad: [["Ask her to confirm her password", "Never ask for a password. A real employee does not need to give it, and an attacker would."], ["She knows her manager's name and department, so it is her", "Names and departments are on LinkedIn. That is how help desk social engineering works."]] },
      inject() {
        const L = lab();
        L.methods.finance02 = [{ id: "finance02-oldapp", type: "Microsoft Authenticator", detail: "iPhone 12 (old phone)", added: new Date(Date.now() - 500 * 864e5).toISOString() }, { id: "finance02-sms", type: "Phone (SMS)", detail: "+1 555 0142", added: new Date(Date.now() - 520 * 864e5).toISOString() }];
        L.reregister.finance02 = false;
        delete L.verified.finance02;
      },
      restore() {
        const L = lab();
        L.reregister.finance02 = false;
        delete L.verified.finance02;
      },
      criteria() {
        const L = lab();
        return !(L.methods.finance02 ?? []).some((m) => m.id === "finance02-oldapp") && !!L.reregister.finance02 && after(L.sessionsRevoked.finance02, 9) && after(L.verified.finance02, 9);
      }
    },
    {
      id: 10,
      title: "Laptop stuck on the BitLocker recovery screen",
      user: "hr04",
      category: "Endpoint & encryption",
      priority: "High",
      summary: 'Eli Foster (hr04) installed a BIOS update last night. This morning HR-PC04 asks for a BitLocker recovery key. He reads this from the screen: "Recovery key ID: {KEYID}…". Verify him, find the matching key for his device, and give him the right recovery key.',
      hint: 'Verify caller first. Entra admin center > Devices > HR-PC04 > BitLocker keys. The device has more than one key: match the Key ID the user read out, then use "Provide recovery key" on this ticket.',
      checks: ["verify", "bitlocker-view", "bitlocker-provided"],
      tools: ["entra"],
      realWorld: "Firmware updates, docking changes and TPM resets trigger BitLocker recovery. The key is stored in Entra ID (or AD). Giving out the wrong key wastes the user's time; giving a key to an unverified caller hands over an encrypted laptop.",
      interview: "A user is on the BitLocker recovery screen. Where do you find the key, and how do you make sure it is the right one for the right person?",
      verify: { sam: "hr04", good: "Call him back on the desk phone listed in the HR directory and confirm his employee number", bad: [["Read the key to whoever is calling, it is urgent", "Urgency is the attacker's favourite tool. Verify first, every time."], ["Email the key to his personal address he gives you", "Recovery keys never go to unverified or personal addresses."]] },
      inject() {
        const L = lab();
        const d = L.devices.find((x) => x.name === BL_DEVICE) ?? (() => {
          const u = corpUser("hr04");
          const dev = { name: deviceFor(u), owner: "hr04", os: "Windows 11 Enterprise 23H2", compliant: true, lastSync: nowIso(), keys: [] };
          L.devices.push(dev);
          return dev;
        })();
        const k = blKey();
        d.keys = d.keys.filter((x) => x.id !== k.id);
        d.keys.push({ ...k, created: new Date(Date.now() - 2 * 864e5).toISOString() });
        delete L.bitlockerProvided[BL_DEVICE];
        delete L.verified.hr04;
      },
      restore() {
        const L = lab();
        delete L.bitlockerProvided[BL_DEVICE];
        delete L.verified.hr04;
      },
      criteria() {
        const L = lab();
        return L.bitlockerProvided[BL_DEVICE] === blKey().key && after(L.verified.hr04, 10);
      }
    },
    {
      id: 11,
      title: "Phishing: user entered her password on a fake payroll page",
      user: "finance01",
      category: "Security incident",
      priority: "Critical",
      summary: 'Olivia Grant (finance01) forwarded an "invoice overdue" email to the service desk mailbox and says she typed her password into the page it opened. The same message reached other people. Confirm it is phishing, remove it from every mailbox, stop more arriving, and secure her account.',
      hint: "Outlook: View message details (look at the sender domain, Return-Path and SPF/DMARC results), then Report phishing. Microsoft 365 admin > Explorer: search the sender and soft delete it from all mailboxes; Tenant Allow/Block List: block the domain. Then reset finance01's password (ADUC or M365) and revoke her sessions.",
      checks: ["phish-headers", "phish-report", "explorer"],
      tools: ["outlook", "m365", "entra", "directory"],
      realWorld: "Phishing is the most common way accounts are compromised. Tier 1 contains it: confirm with the headers, purge the message tenant-wide, block the sender, reset the password and revoke sessions, then escalate to security with what you found.",
      interview: "A user clicked a phishing link and entered their password. What are your first five steps?",
      inject() {
        const L = lab();
        const original2 = ["Dear colleague,", "", "Your department has an overdue invoice. To avoid late fees, sign in within 24 hours to confirm payment details:", "https://corp-example-payments.com/sso/login", "", "Accounts Payable"].join(NL);
        const headers = [
          `From: "CORP Payroll" <billing@${PHISH_DOMAIN}>`,
          `Reply-To: <collect@${PHISH_DOMAIN}>`,
          `Return-Path: <bounce-7731@mailer.${PHISH_DOMAIN}>`,
          `To: finance01@${DOMAIN}, finance03@${DOMAIN}, hr02@${DOMAIN}`,
          `Received: from mailer.${PHISH_DOMAIN} (203.0.113.45)`,
          `Authentication-Results: spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=${PHISH_DOMAIN}; dkim=none; dmarc=fail action=none header.from=${PHISH_DOMAIN}`,
          "X-MS-Exchange-Organization-SCL: 5"
        ].join(NL);
        mail({
          id: "m-phish-fwd",
          from: `finance01@${DOMAIN}`,
          fromName: "Olivia Grant",
          subject: "FW: URGENT Invoice #88412 overdue – payment details required",
          phishing: true,
          headers,
          body: ["Hi IT, this came in this morning. I clicked it and put my password in before I noticed the address looked odd. Sorry! Can you check?", "Olivia", "", "-------- Forwarded message (attached) --------", "From: CORP Payroll <billing@corp-example-payments.com>", "Subject: URGENT Invoice #88412 overdue – payment details required", "", original2].join(NL)
        });
        mail({ id: "m-phish", from: `billing@${PHISH_DOMAIN}`, fromName: "CORP Payroll", to: `finance01@${DOMAIN}`, subject: "URGENT Invoice #88412 overdue – payment details required", body: original2, hidden: true, read: true, recipients: ["finance01", "finance03", "hr02"], headers });
        L.blockedSenders = L.blockedSenders.filter((x) => !x.includes(PHISH_DOMAIN));
      },
      restore() {
        unmail("m-phish");
        unmail("m-phish-fwd");
      },
      criteria() {
        const L = lab(), u = corpUser("finance01");
        return L.purged.includes("m-phish") && L.blockedSenders.some((x) => x.includes(PHISH_DOMAIN)) && after(u?.passwordLastSet, 11) && after(L.sessionsRevoked.finance01, 11);
      }
    },
    {
      id: 12,
      title: "Access request: HR Team shared mailbox for Noah Brooks",
      user: "hr02",
      category: "Microsoft 365 access",
      priority: "Low",
      summary: "Noah Brooks (hr02) needs to read and send from the HR Team shared mailbox (hr@corp.example.test) to cover the HR inbox. Check the request was approved by the mailbox owner, then grant exactly what is approved, nothing more.",
      hint: "Read the approval in Outlook. Microsoft 365 admin > Shared mailboxes > HR Team: add hr02 to Read and manage (Full Access) and Send as. Do not add anyone else.",
      checks: ["mailbox-approval"],
      tools: ["outlook", "m365"],
      realWorld: "Access requests are daily work. The rule is least privilege with recorded approval: grant what the owner approved, to the person named, and note the approval on the ticket.",
      interview: "Someone asks for access to a shared mailbox. What do you check before you grant it?",
      inject() {
        const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`);
        if (m) {
          m.fullAccess = ["hr01"];
          m.sendAs = ["hr01"];
        }
        mail({
          id: "m-approval",
          from: `hr01@${DOMAIN}`,
          fromName: "Maya Chen",
          subject: "Approved: HR Team mailbox access for Noah Brooks",
          evidence: "mailbox-approval",
          body: "Hi IT,\n\nAs owner of the HR Team shared mailbox I approve access for Noah Brooks (hr02): he needs to read the mailbox and send as hr@ while he covers the HR inbox.\n\nNo one else needs access.\n\nMaya Chen\nHR Team mailbox owner"
        });
      },
      restore() {
        const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`);
        if (m) {
          m.fullAccess = ["hr01"];
          m.sendAs = ["hr01"];
        }
        unmail("m-approval");
      },
      criteria() {
        const m = lab().mailboxes.find((x) => x.address === `hr@${DOMAIN}`);
        return !!m && m.fullAccess.includes("hr02") && m.sendAs.includes("hr02") && m.fullAccess.every((x) => ["hr01", "hr02"].includes(x)) && m.sendAs.every((x) => ["hr01", "hr02"].includes(x));
      }
    }
  ];
  var LAB = new Map(LABS.map((l) => [l.id, l]));
  var labById = (id) => LAB.get(id);
  var keyIdShown = blKey().id.slice(0, 8);
  for (const l of LABS) {
    const summary = l.summary.replace("{KEYID}", keyIdShown);
    const existing = TICKETS().find((t2) => t2.id === l.id);
    const t = { id: l.id, title: l.title, user: l.user, category: l.category, priority: l.priority, summary, checks: l.checks, hint: l.hint, lab: true };
    if (existing) Object.assign(existing, t);
    else TICKETS().push(t);
  }
  Object.assign(CHECK_LABELS(), {
    "onboard-request": "Read the approved onboarding request",
    sync: "Run an Entra Connect delta sync",
    "leaver-notice": "Read the HR leaver notice",
    revoke: "Revoke the user's sessions",
    spooler: "Start or restart the Print Spooler",
    "print-queue": "Cancel the corrupt print job",
    "print-test": "Print a test page",
    verify: "Verify the caller's identity",
    "bitlocker-view": "Look up the device's BitLocker keys",
    "bitlocker-provided": "Give the user the matching recovery key",
    "phish-headers": "Inspect the message headers",
    "phish-report": "Report the message as phishing",
    explorer: "Search Explorer for every copy",
    "mailbox-approval": "Read the mailbox owner's approval"
  });
  var oldCriteria = G.criteria;
  G.criteria = (t) => {
    const l = LAB.get(t?.id);
    if (!l) return oldCriteria(t);
    try {
      return l.criteria();
    } catch {
      return false;
    }
  };
  var oldStart = G.startIncident;
  G.startIncident = (id) => {
    const l = LAB.get(id);
    if (!l) return oldStart(id);
    const s = S();
    if (s.active && s.active !== id) {
      toast("Resolve or cancel the current incident before starting another.");
      return;
    }
    if (s.statuses[id] === "Resolved") {
      toast("This ticket is resolved. Reset the lab in Settings to replay all incidents.");
      return;
    }
    if (s.active === id) return;
    l.inject();
    started()[id] = nowIso();
    s.statuses[id] = "In progress";
    s.active = id;
    s.evidence[id] = [];
    log(9e3, `LAB-${String(id).padStart(3, "0")} started: ${l.title}`);
    save();
    redrawDesk();
    toast(`Incident started. Tools for this one: ${l.tools.map(toolName).join(", ")}.`);
  };
  var oldCancel = G.cancelIncident;
  G.cancelIncident = (id) => {
    const l = LAB.get(id);
    if (!l) return oldCancel(id);
    if (!confirm("Cancel this incident and restore the affected baseline?")) return;
    l.restore();
    const s = S();
    s.statuses[id] = "New";
    s.active = null;
    s.evidence[id] = [];
    log(9002, `LAB-${String(id).padStart(3, "0")} cancelled; baseline restored`);
    save();
    redrawDesk();
  };
  function toolName(id) {
    return APPS().find((a) => a.id === id)?.name ?? { outlook: "Outlook", directory: "Active Directory Users and Computers", m365: "Microsoft 365 admin center", entra: "Microsoft Entra admin center", printmgmt: "Print Management", services: "Services", terminal: "Windows PowerShell" }[id] ?? id;
  }
  function openTicket(id) {
    openApp("tickets");
    ticketView = id;
    G.renderTickets();
  }
  var _a2;
  ((_a2 = G).CorpDesk || (_a2.CorpDesk = {})).openTicket = openTicket;
  function verifyDialog(l) {
    const v = l.verify;
    const options = [[v.good, ""], ...v.bad].sort(() => 0.5 - Math.random());
    const radios = options.map(([text], i) => h("label", { class: "ad2-check" }, h("input", { type: "radio", name: "verify", value: String(i) }), text));
    dialog(`Verify caller: ${corpUser(v.sam)?.name ?? v.sam}`, h("div", null, h("p", null, "How will you confirm the caller really is this employee before you change anything?"), radios), [["Confirm", () => {
      const picked = radios.findIndex((r) => r.querySelector("input").checked);
      if (picked < 0) {
        toast("Choose how you will verify the caller.");
        return false;
      }
      const [text, why] = options[picked];
      if (text !== v.good) {
        toast(`Not safe: ${why}`);
        log(9010, `LAB-${String(l.id).padStart(3, "0")}: unsafe verification method chosen`);
        return false;
      }
      lab().verified[v.sam] = nowIso();
      evidence("verify");
      log(9011, `${v.sam}: identity verified by call-back`);
      save();
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function provideKeyDialog() {
    const input = h("input", { class: "ad2-input", placeholder: "000000-000000-000000-000000-000000-000000-000000-000000", "aria-label": "Recovery key" });
    dialog("Provide recovery key to Eli Foster (HR-PC04)", h("div", null, h("p", null, `Paste the 48-digit recovery key whose Key ID starts with ${keyIdShown}.`), input), [["Read key to user", () => {
      const v = input.value.trim();
      if (!/^\d{6}(-\d{6}){7}$/.test(v)) {
        toast("A BitLocker recovery key is 48 digits in eight groups of six.");
        return false;
      }
      lab().bitlockerProvided[BL_DEVICE] = v;
      if (v === blKey().key) {
        evidence("bitlocker-provided");
        log(9012, "HR-PC04: correct recovery key provided, device unlocked");
        toast("HR-PC04 unlocked and booted to Windows.");
      } else {
        log(9013, "HR-PC04: recovery key rejected");
        toast("The laptop says the key is wrong. Check you matched the Key ID the user read out.");
      }
      save();
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function decorate() {
    const grid2 = document.querySelector("#appBody .sd-detail-grid");
    if (!grid2 || grid2.dataset.lab) return;
    const id = Number(/LAB-(\d+)/.exec(document.querySelector("#appBody .page-top h1, #appBody h1")?.textContent ?? "")?.[1]);
    const l = LAB.get(id);
    if (!l) return;
    grid2.dataset.lab = String(id);
    const s = S();
    const activeHere = s.active === id;
    const panelEl = h(
      "div",
      { class: "panel ia-labpanel" },
      h("h3", null, "Tools for this incident"),
      h("div", { class: "ia-toolbtns" }, l.tools.map((t) => h("button", { class: "secondary", type: "button", onClick: () => openApp(t) }, toolName(t)))),
      l.verify ? h("div", { class: "ia-verify" }, h("b", null, "Caller verification: "), after(lab().verified[l.verify.sam], id) ? "verified ✓" : h("button", { class: "primary", type: "button", disabled: !activeHere, onClick: () => verifyDialog(l) }, "Verify caller")) : null,
      id === 10 ? h("div", { class: "ia-verify" }, h("b", null, "Recovery key: "), h("button", { class: "secondary", type: "button", disabled: !activeHere, onClick: provideKeyDialog }, "Provide recovery key")) : null,
      h("details", null, h("summary", null, "Why this matters in a real job"), h("p", null, l.realWorld), h("p", null, h("b", null, "Interview practice: "), l.interview)),
      activeHere ? null : h("p", { class: "ia-muted" }, "Start the incident to inject the fault and unlock these steps.")
    );
    const left = grid2.firstElementChild;
    left?.insertBefore(panelEl, left.children[1] ?? null);
  }
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  var oldRun = G.runCommand;
  G.runCommand = (command) => {
    const c = String(command).trim();
    const ok = (output) => ({ output, error: false });
    if (/^Start-ADSyncSyncCycle\b/i.test(c)) {
      if (!/-PolicyType\s+(Delta|Initial)\b/i.test(c)) return { output: "Start-ADSyncSyncCycle : Supply -PolicyType Delta (or Initial for a full sync).", error: true };
      const r = deltaSync();
      return ok(`Result
------
Success

(${r.added.length} object(s) added, ${r.removed.length} removed in Microsoft Entra ID)`);
    }
    if (/^Get-Printer\b/i.test(c)) {
      const L = lab();
      const rows = L.printers.map((p) => `${p.name.padEnd(12)} ${"LAB-DC01".padEnd(10)} ${p.driver.padEnd(30)} ${p.port}`);
      return ok(`Name         ComputerName DriverName                     PortName
----         ------------ ----------                     --------
${rows.join("\n")}`);
    }
    const pj = /^Get-PrintJob\s+(?:-PrinterName\s+)?['"]?([\w-]+)['"]?/i.exec(c);
    if (pj) {
      const sp = S().services.find((x) => x.Name === "Spooler");
      if (sp?.Status !== "Running") return { output: "Get-PrintJob : The spooler service is not reachable. Ensure the spooler service is running.", error: true };
      const jobs = lab().jobs.filter((j) => j.printer.toLowerCase() === pj[1].toLowerCase());
      evidence("print-queue-view");
      return ok(jobs.length ? `Id  ComputerName PrinterName DocumentName                  SubmittedTime        JobStatus
--  ------------ ----------- ------------                  -------------        ---------
${jobs.map((j) => `${String(j.id).padEnd(3)} LAB-DC01     ${j.printer.padEnd(11)} ${j.document.padEnd(29)} ${new Date(j.submitted).toLocaleTimeString().padEnd(20)} ${j.status}`).join("\n")}` : "");
    }
    const rj = /^Remove-PrintJob\s+(?:-PrinterName\s+)?['"]?([\w-]+)['"]?\s+-ID\s+(\d+)/i.exec(c);
    if (rj) {
      const L = lab();
      const j = L.jobs.find((x) => x.printer.toLowerCase() === rj[1].toLowerCase() && x.id === Number(rj[2]));
      if (!j) return { output: `Remove-PrintJob : No print job with ID ${rj[2]} on ${rj[1]}.`, error: true };
      L.jobs = L.jobs.filter((x) => x !== j);
      if (j.status === "Error - Printing") evidence("print-queue");
      log(13, `Print job ${j.id} (${j.document}) on ${j.printer} removed with PowerShell`);
      save();
      return ok("");
    }
    const tp = /^(?:Invoke-CimMethod.*PrintTestPage|Print-TestPage)\s+(?:-PrinterName\s+)?['"]?([\w-]+)/i.exec(c);
    if (tp) {
      printTestPage(tp[1]);
      return ok(`Test page sent to ${tp[1]}.`);
    }
    const result = oldRun(command);
    if (!result.error && /^(Start|Restart)-Service\b.*\bSpooler\b/i.test(c)) evidence("spooler");
    return result;
  };

  // itlab/pathway.ts
  var MODULES = [
    { id: "basics", title: "1. Service desk basics", goal: "Take a ticket from first call to verified resolution, with notes a colleague could follow.", labs: [1, 2], skills: ["Ticket lifecycle and priority", "Account lockout vs disabled", "ipconfig, DNS and name resolution", "Writing resolution notes"] },
    { id: "jml", title: "2. Joiners, movers and leavers", goal: "Build, change and remove access exactly as HR and managers request it.", labs: [6, 4, 7], skills: ["AD users, OUs and role groups", "Entra Connect sync", "Licences and mailboxes", "Disable, do not delete"] },
    { id: "identity", title: "3. Identity, MFA and access", goal: "Change sign-in and permissions safely, with verification and least privilege.", labs: [9, 12, 3], skills: ["Caller verification against social engineering", "MFA re-registration and session revocation", "Shared mailbox permissions", "Local admin rights review"] },
    { id: "endpoint", title: "4. Devices, printing and policy", goal: "Fix the endpoint problems users call about every day.", labs: [8, 10, 5], skills: ["Print Spooler and print queues", "BitLocker recovery keys", "Group Policy scope and gpupdate"] },
    { id: "security", title: "5. Security incident response", goal: "Contain a phishing compromise the way a Tier 1 analyst would.", labs: [11], skills: ["Reading email headers (SPF, DKIM, DMARC)", "Tenant-wide message removal", "Password reset and session revocation"] }
  ];
  var ORDER = MODULES.flatMap((m) => m.labs);
  var TOOLS = [
    ["tickets", "Service Desk (ServiceNow, Jira Service Management, Freshservice)", "Your queue: every piece of work starts and ends here."],
    ["directory", "Active Directory Users and Computers", "Run dsa.msc, or Server Manager > Tools."],
    ["m365", "Microsoft 365 admin center", "admin.microsoft.com: users, licences, mailboxes, Explorer."],
    ["entra", "Microsoft Entra admin center", "entra.microsoft.com: MFA methods, sessions, devices and BitLocker keys."],
    ["outlook", "Outlook", "outlook.office.com: the shared service desk mailbox."],
    ["services", "Services", "Run services.msc. Also Get-Service / Restart-Service."],
    ["printmgmt", "Print Management", "Run printmanagement.msc. Also Get-PrintJob / Remove-PrintJob."],
    ["terminal", "Windows PowerShell", "Get-ADUser, Unlock-ADAccount, Start-ADSyncSyncCycle, gpupdate /force."],
    ["events", "Event Viewer", "Run eventvwr.msc. Lockouts (4740), logons (4624/4625), service crashes (7031)."],
    ["rdp", "Remote Desktop Connection", "Run mstsc. Help a user on their PC, or test a sign-in."],
    ["taskmanager", "Task Manager", "Ctrl+Shift+Esc, or Run taskmgr. Processes, performance, startup apps."],
    ["control", "Control Panel", "Run control. Windows Tools, Programs and Features, Mouse."]
  ];
  var status = (id) => S().statuses?.[id] ?? "New";
  var done = (id) => ["Resolved", "Closed"].includes(status(id));
  var ticket = (id) => TICKETS().find((t) => t.id === id);
  var nextLab = () => S().active ? S().active : ORDER.find((id) => !done(id));
  var pct = () => Math.round(ORDER.filter(done).length / ORDER.length * 100);
  function startOrOpen(id) {
    const s = S();
    if (!s.active && status(id) === "New") {
      openTicket(id);
      G.startIncident(id);
      return;
    }
    openTicket(id);
  }
  var ICON = {
    path: '<circle cx="7" cy="27" r="4" fill="#0f6cbd"/><circle cx="27" cy="7" r="4" fill="#2fb380"/><path d="M7 23V17a4 4 0 0 1 4-4h12a4 4 0 0 0 4-4V11" fill="none" stroke="#5a6b7c" stroke-width="2.4" stroke-dasharray="3 3"/><circle cx="17" cy="13" r="3" fill="#f3b23a"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function ring(value, size = 64) {
    const r = 26, c = 2 * Math.PI * r;
    return svg(`<circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pw-track)" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pw-accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c * value / 100} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="600" fill="currentColor">${value}%</text>`, size, "0 0 64 64");
  }
  var tab3 = "path";
  function draw(host) {
    const next = nextLab();
    const nt = next ? ticket(next) : null;
    const labRow = (id) => {
      const t = ticket(id);
      const l = labById(id);
      const st = status(id);
      return h(
        "div",
        { class: `pw-lab ${done(id) ? "done" : ""} ${S().active === id ? "active" : ""}` },
        h("span", { class: "pw-dot" }, done(id) ? svg(ICON.check, 14) : String(ORDER.indexOf(id) + 1)),
        h("div", { class: "pw-lab-text" }, h("b", null, `LAB-${String(id).padStart(3, "0")} · ${t?.title ?? ""}`), h("small", null, `${t?.category ?? ""} · ${t?.priority ?? ""} priority${l ? ` · Tools: ${l.tools.map(toolName).join(", ")}` : ""}`)),
        h("span", { class: `pw-status s-${st.replace(/\s+/g, "").toLowerCase()}` }, st),
        h("button", { class: done(id) ? "secondary" : "primary", type: "button", onClick: () => startOrOpen(id) }, done(id) ? "Review" : S().active === id ? "Continue" : "Start")
      );
    };
    const page2 = tab3 === "path" ? h("div", { class: "pw-modules" }, MODULES.map((m) => {
      const complete = m.labs.filter(done).length;
      return h(
        "section",
        { class: "pw-module" },
        h("div", { class: "pw-mhead" }, h("div", null, h("h3", null, m.title), h("p", null, m.goal)), h("span", { class: "pw-count" }, `${complete}/${m.labs.length}`)),
        h("div", { class: "pw-skills" }, m.skills.map((s) => h("span", null, s))),
        m.labs.map(labRow)
      );
    })) : tab3 === "tools" ? h(
      "div",
      { class: "pw-tools" },
      h("p", { class: "pw-intro" }, "These are the tools a service desk technician lives in. Each one here works like the real thing, so you will know where to click on your first day."),
      TOOLS.map(([id, name, how]) => h("button", { class: "pw-tool", type: "button", onClick: () => openApp(id) }, (() => {
        const s = document.createElement("span");
        s.className = "pw-tool-icon";
        s.innerHTML = APPS().find((a) => a.id === id)?.icon ?? "";
        return s;
      })(), h("span", null, h("b", null, name), h("small", null, how))))
    ) : h(
      "div",
      { class: "pw-ready" },
      h("p", { class: "pw-intro" }, "Practise answering out loud. Each question is one interviewers ask service desk and desktop support candidates, and each lab is your real example."),
      ORDER.map((id) => {
        const l = labById(id);
        const t = ticket(id);
        return h("details", { class: "pw-q" }, h("summary", null, l?.interview ?? `Tell me how you would handle: ${t?.title}`), h("p", null, l?.realWorld ?? t?.summary ?? ""), h("p", { class: "pw-proof" }, done(id) ? `✓ You have done this: LAB-${String(id).padStart(3, "0")}. Use it as your example.` : `Do LAB-${String(id).padStart(3, "0")} to have a real example.`));
      })
    );
    host.append(h(
      "div",
      { class: "pw" },
      h(
        "header",
        { class: "pw-hero" },
        ring(pct(), 76),
        h("div", null, h("h1", null, "IT Support Career Path"), h("p", null, `${ORDER.filter(done).length} of ${ORDER.length} real-world labs complete. Work through them in order: each one is a ticket you would get in your first months on a service desk.`)),
        nt ? h("div", { class: "pw-next" }, h("small", null, S().active ? "In progress" : "Next up"), h("b", null, nt.title), h("button", { class: "primary", type: "button", onClick: () => startOrOpen(next) }, S().active ? "Continue" : "Start lab")) : h("div", { class: "pw-next" }, h("b", null, "Path complete. You are ready for the interview."))
      ),
      h("nav", { class: "pw-tabs" }, [["path", "Learning path"], ["tools", "Where to find the tools"], ["ready", "Interview prep"]].map(([id, label]) => h("button", { class: tab3 === id ? "on" : "", type: "button", onClick: () => {
        tab3 = id;
        G.save();
      } }, label))),
      h("div", { class: "pw-body", "data-scroll": "pw" }, page2)
    ));
  }
  registerTool({ id: "pathway", name: "IT Support Career Path", short: "Career Path", icon: ICON.path, width: 1e3, height: 720, draw });
  var desktop = document.getElementById("desktop");
  var card2 = h("aside", { class: "pw-card", "aria-label": "IT Support Career Path" });
  function drawCard() {
    const next = nextLab();
    const t = next ? ticket(next) : null;
    card2.replaceChildren(
      h("div", { class: "pw-card-top" }, ring(pct(), 54), h("div", null, h("small", null, "IT SUPPORT CAREER PATH"), h("b", null, `${ORDER.filter(done).length} of ${ORDER.length} labs complete`))),
      t ? h("div", { class: "pw-card-next" }, h("small", null, S().active ? "IN PROGRESS" : "NEXT UP"), h("b", null, `LAB-${String(next).padStart(3, "0")} · ${t.title}`), h("span", null, t.category)) : h("div", { class: "pw-card-next" }, h("b", null, "All labs complete!")),
      h("div", { class: "pw-card-actions" }, t ? h("button", { class: "pw-go", type: "button", onClick: () => startOrOpen(next) }, S().active ? "Continue lab" : "Start lab") : null, h("button", { class: "pw-open", type: "button", onClick: () => openApp("pathway") }, "Open career path"))
    );
  }
  desktop?.querySelector(".desktop-widget")?.classList.add("pw-replaced");
  desktop?.appendChild(card2);
  drawCard();
  onChange(drawCard);

  // itlab/start.ts
  var ICON2 = {
    search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    power: '<path d="M12 3v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.5 6.3A7.5 7.5 0 1 0 16.5 6.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    chevron: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    back: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    signout: '<path d="M14 4H6v16h8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    restart: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    ticket: '<rect x="3" y="5" width="18" height="14" rx="2" fill="#deebfe" stroke="#437dce"/><path d="M7 10h10M7 14h6" stroke="#437dce" stroke-width="1.5"/>'
  };
  var menu = document.getElementById("startMenu");
  var search = document.getElementById("appSearch");
  var grid = document.getElementById("startApps");
  var userLabel = document.getElementById("startUser");
  var signOut = document.getElementById("signOut");
  var lockBtn = document.getElementById("lockButton");
  var view2 = "pinned";
  var prefs = () => {
    var _a3;
    return (_a3 = S()).preferences || (_a3.preferences = {});
  };
  var PINNED = ["tickets", "directory", "pathway", "outlook", "m365", "entra", "terminal", "chrome", "files", "network", "control", "taskmanager", "rdp", "services", "printmgmt", "events", "mentor", "calculator", "notepadpp", "word", "excel", "lab"];
  var appIconSvg = (a) => a.icon;
  function appTile(a, kind) {
    const icon = document.createElement("span");
    icon.className = "st-icon";
    icon.innerHTML = appIconSvg(a);
    return h("button", { class: kind === "tile" ? "st-tile" : "st-row", type: "button", "data-open": a.id, title: a.name }, icon, h("span", { class: "st-label" }, kind === "tile" ? a.short : a.name));
  }
  function recommended() {
    const apps2 = APPS();
    const items = [];
    const active = S().active;
    const ticket2 = TICKETS().find((t) => t.id === active);
    if (ticket2) items.push(h("button", { class: "st-rec", type: "button", onClick: () => {
      G.CorpDesk?.openTicket?.(ticket2.id);
      hide();
    } }, svg(ICON2.ticket, 26), h("span", null, h("b", null, `LAB-${String(ticket2.id).padStart(3, "0")} · ${ticket2.title}`), h("small", null, "Active incident"))));
    for (const id of (prefs().recentApps ?? []).slice(0, ticket2 ? 5 : 6)) {
      const a = apps2.find((x) => x.id === id);
      if (!a) continue;
      const icon = document.createElement("span");
      icon.className = "st-icon";
      icon.innerHTML = a.icon;
      items.push(h("button", { class: "st-rec", type: "button", "data-open": a.id }, icon, h("span", null, h("b", null, a.name), h("small", null, "Recently opened"))));
    }
    if (!items.length) items.push(h("p", { class: "st-empty" }, "The more you use the lab, the more you'll see your recent apps and incidents here."));
    return items;
  }
  function results(q2) {
    const query2 = q2.trim().toLowerCase();
    const apps2 = APPS().filter((a) => `${a.name} ${a.short} ${a.id}`.toLowerCase().includes(query2));
    const settings = (G.CorpDesk?.settingsCategories ?? []).map((c) => c[0]).filter((n) => n.toLowerCase().includes(query2));
    const tix = TICKETS().filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(query2)).slice(0, 4);
    const best = apps2[0];
    return h(
      "div",
      { class: "st-results" },
      best ? h("div", { class: "st-best" }, h("div", { class: "st-h" }, "Best match"), appTile(best, "row")) : h("p", { class: "st-empty" }, `No results for "${q2}"`),
      apps2.length > 1 ? h("div", null, h("div", { class: "st-h" }, "Apps"), apps2.slice(1, 8).map((a) => appTile(a, "row"))) : null,
      settings.length ? h("div", null, h("div", { class: "st-h" }, "Settings"), settings.map((n) => h("button", { class: "st-row", type: "button", onClick: () => {
        G.CorpDesk.settingsNavigate(n);
        hide();
      } }, svg(ICON2.gear, 22), h("span", { class: "st-label" }, n)))) : null,
      tix.length ? h("div", null, h("div", { class: "st-h" }, "Incidents"), tix.map((t) => h("button", { class: "st-row", type: "button", onClick: () => {
        G.CorpDesk?.openTicket?.(t.id);
        hide();
      } }, svg(ICON2.ticket, 22), h("span", { class: "st-label" }, `LAB-${String(t.id).padStart(3, "0")} · ${t.title}`)))) : null
    );
  }
  var body3 = h("div", { class: "st-body" });
  var flyout = h("div", { class: "st-flyout", hidden: true }, lockBtn, signOut);
  function draw2() {
    const q2 = search.value;
    body3.replaceChildren();
    grid.className = "st-grid";
    if (q2.trim()) {
      body3.append(results(q2));
      return;
    }
    const apps2 = APPS();
    if (view2 === "pinned") {
      const pinned = [...PINNED.map((id) => apps2.find((a) => a.id === id)).filter(Boolean), ...apps2.filter((a) => !PINNED.includes(a.id))];
      grid.replaceChildren(...pinned.map((a) => appTile(a, "tile")));
      body3.append(
        h("div", { class: "st-section" }, h("span", null, "Pinned"), h("button", { class: "st-pill", type: "button", onClick: () => {
          view2 = "all";
          draw2();
        } }, "All apps", svg(ICON2.chevron, 14))),
        grid,
        h("div", { class: "st-section" }, h("span", null, "Recommended")),
        h("div", { class: "st-recs" }, recommended())
      );
    } else {
      const sorted = [...apps2].sort((a, b) => a.name.localeCompare(b.name));
      const groups = /* @__PURE__ */ new Map();
      for (const a of sorted) {
        const k = /[a-z]/i.test(a.name[0]) ? a.name[0].toUpperCase() : "#";
        groups.set(k, [...groups.get(k) ?? [], a]);
      }
      body3.append(
        h("div", { class: "st-section" }, h("span", null, "All apps"), h("button", { class: "st-pill", type: "button", onClick: () => {
          view2 = "pinned";
          draw2();
        } }, svg(ICON2.back, 14), "Back")),
        h("div", { class: "st-all", "data-scroll": "all" }, [...groups].map(([k, list]) => [h("div", { class: "st-letter" }, k), list.map((a) => appTile(a, "row"))]))
      );
    }
  }
  function power(kind, anchor) {
    if (!flyout.hidden && flyout.dataset.kind === kind) {
      flyout.hidden = true;
      return;
    }
    flyout.dataset.kind = kind;
    const item = (icon, label, fn) => h("button", { class: "st-fly", type: "button", onClick: () => {
      flyout.hidden = true;
      fn();
    } }, svg(icon, 16), label);
    signOut.className = "st-fly";
    signOut.replaceChildren(svg(ICON2.signout, 16), "Sign out");
    if (lockBtn) {
      lockBtn.className = "st-fly";
      lockBtn.replaceChildren(svg(ICON2.lock, 16), "Lock");
    }
    flyout.replaceChildren(...kind === "account" ? [item(ICON2.gear, "Change account settings", () => {
      G.CorpDesk.settingsNavigate("Accounts");
      hide();
    }), ...lockBtn ? [lockBtn] : [], signOut] : [...lockBtn ? [lockBtn] : [], signOut, item(ICON2.restart, "Restart", () => {
      save();
      location.reload();
    }), item(ICON2.power, "Shut down", () => {
      hide();
      signOut.click();
    })]);
    flyout.hidden = false;
    const r = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
    flyout.style.left = kind === "account" ? `${r.left - m.left}px` : "";
    flyout.style.right = kind === "power" ? `${m.right - r.right}px` : "";
  }
  function hide() {
    menu.classList.add("hidden");
  }
  menu.classList.add("st");
  search.placeholder = "Search for apps, settings, and incidents";
  search.setAttribute("aria-label", "Search for apps, settings, and incidents");
  var avatar = h("span", { class: "st-avatar" });
  var accountBtn = h("button", { class: "st-account", type: "button", onClick: (e) => power("account", e.currentTarget) }, avatar, userLabel);
  var powerBtn = h("button", { class: "st-power", type: "button", title: "Power", "aria-label": "Power", onClick: (e) => power("power", e.currentTarget) }, svg(ICON2.power, 18));
  var searchBox = h("label", { class: "st-search" }, svg(ICON2.search, 16), search);
  menu.replaceChildren(searchBox, body3, h("footer", { class: "st-foot" }, accountBtn, powerBtn), flyout);
  search.oninput = () => draw2();
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = body3.querySelector(".st-best button, .st-row, .st-tile");
      first?.click();
    }
    if (e.key === "Escape") hide();
  });
  var open = G.openApp;
  G.openApp = (id) => {
    open(id);
    const list = prefs().recentApps ?? [];
    prefs().recentApps = [id, ...list.filter((x) => x !== id)].slice(0, 8);
  };
  new MutationObserver(() => {
    if (menu.classList.contains("hidden")) {
      flyout.hidden = true;
      return;
    }
    view2 = "pinned";
    search.value = "";
    const name = S().technician || "Technician";
    avatar.textContent = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    userLabel.textContent = name;
    draw2();
    requestAnimationFrame(() => search.focus());
  }).observe(menu, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Escape" && !document.getElementById("desktop")?.classList.contains("hidden")) {
      e.preventDefault();
      menu.classList.toggle("hidden");
    }
  });
  draw2();

  // itlab/entry.ts
  lab();
  ensureServices();
  refreshShortcuts();
})();
