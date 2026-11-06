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
  function rng(seed) {
    let t = seed >>> 0;
    const next = () => {
      t = t + 1831565813 >>> 0;
      let x = t;
      x = Math.imul(x ^ x >>> 15, x | 1);
      x ^= x + Math.imul(x ^ x >>> 7, x | 61);
      return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (min, max) => min + Math.floor(next() * (max - min + 1)),
      pick: (list) => list[Math.floor(next() * list.length)],
      chance: (p) => next() < p,
      shuffle: (list) => {
        const a = [...list];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
    };
  }
  function makePassword(r) {
    const words = ["Harbor", "Copper", "Maple", "Falcon", "Cobalt", "Summit", "River", "Lantern", "Orchid", "Granite", "Willow", "Comet", "Juniper", "Beacon"];
    return `${r.pick(words)}-${r.pick(words).toLowerCase()}-${r.int(10, 99)}${r.pick(["!", "#", "$", "%", "?"])}${r.int(100, 999)}`;
  }
  function writePwdFile() {
    var _a7, _b;
    const s = state;
    const L = lab();
    const r = rng(Date.now());
    L.passwords || (L.passwords = {});
    for (const u of s.users) (_a7 = L.passwords)[_b = u.sam] || (_a7[_b] = makePassword(r));
    const rows = [...s.users].sort((a, b) => a.sam.localeCompare(b.sam)).map((u) => `${u.sam.padEnd(12)} ${u.name.padEnd(20)} ${(L.passwords[u.sam] ?? "").padEnd(26)} ${!u.enabled ? "Disabled" : u.locked ? "Locked out" : "Enabled"}`);
    const cloud = (L.cloudOnly ?? []).map((c) => `${c.sam.padEnd(12)} ${c.name.padEnd(20)} ${(L.passwords[c.sam] ?? "").padEnd(26)} Cloud-only`);
    const text = [
      "CORP Desk training accounts (domain: CORP / corp.example.test)",
      "================================================================",
      "TRAINING ONLY. In a real job you never keep passwords in a file: use a password",
      "manager, give temporary passwords over a verified channel, and let users set their own.",
      "",
      "Sign in as these users in Remote Desktop > Verify a sign-in. Five wrong passwords",
      "lock the account (event 4740). Resets you make in ADUC, Microsoft 365 or at first",
      "sign-in update this file.",
      "",
      `${"Logon".padEnd(12)} ${"Name".padEnd(20)} ${"Password".padEnd(26)} State`,
      `${"-----".padEnd(12)} ${"----".padEnd(20)} ${"--------".padEnd(26)} -----`,
      ...rows,
      ...cloud,
      "",
      `Updated ${(/* @__PURE__ */ new Date()).toLocaleString()}`
    ].join("\r\n");
    s.files || (s.files = {});
    s.files[`C:\\Users\\${s.technician}\\Desktop\\Pwd.txt`] = text;
  }
  function setLabPassword(sam, password) {
    const L = lab();
    (L.passwords || (L.passwords = {}))[sam] = password;
    (L.badLogons || (L.badLogons = {}))[sam] = 0;
    writePwdFile();
  }
  function checkLabPassword(sam, password) {
    const L = lab();
    const u = corpUser(sam);
    if (!u) return "bad";
    const expected = (L.passwords || (L.passwords = {}))[u.sam];
    if (!expected || expected === password) {
      (L.badLogons || (L.badLogons = {}))[u.sam] = 0;
      return "ok";
    }
    const n = ((L.badLogons || (L.badLogons = {}))[u.sam] ?? 0) + 1;
    L.badLogons[u.sam] = n;
    if (n >= 5) {
      u.locked = true;
      log(4740, `${u.sam}: account locked out after ${n} bad passwords`);
      writePwdFile();
      return "locked";
    }
    return "bad";
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
    const users2 = s.users;
    const data = {
      version: 1,
      synced: users2.map((u) => u.sam),
      licenses: Object.fromEntries(users2.map((u) => [u.sam, "Microsoft 365 E3"])),
      licenseTotal: 30,
      blocked: [],
      sessionsRevoked: {},
      mailboxes: [
        ...users2.map((u, i) => ({ address: `${u.sam}@${DOMAIN}`, name: u.name, type: "user", owner: u.sam, fullAccess: [], sendAs: [], sizeGb: Math.round((3 + i * 7 % 31) * 10) / 10, quotaGb: 50 })),
        { address: `hr@${DOMAIN}`, name: "HR Team", type: "shared", fullAccess: ["hr01"], sendAs: ["hr01"], sizeGb: 12.4, quotaGb: 50 },
        { address: `finance@${DOMAIN}`, name: "Finance Team", type: "shared", fullAccess: ["finance01"], sendAs: ["finance01"], sizeGb: 18.9, quotaGb: 50 },
        { address: `servicedesk@${DOMAIN}`, name: "IT Service Desk", type: "shared", fullAccess: ["it01", "it02"], sendAs: ["it01"], sizeGb: 7.2, quotaGb: 50 }
      ],
      methods: Object.fromEntries(users2.map((u, i) => [u.sam, [
        { id: `${u.sam}-app`, type: "Microsoft Authenticator", detail: `${u.name.split(" ")[0]}'s iPhone`, added: daysAgo(200 + i) },
        { id: `${u.sam}-sms`, type: "Phone (SMS)", detail: `+1 555 01${String(10 + i).slice(-2)}`, added: daysAgo(420 + i) }
      ]])),
      reregister: {},
      devices: users2.map((u, i) => ({
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
  var cloudUsers = () => [...state.users.filter((u) => lab().synced.includes(u.sam)), ...(lab().cloudOnly ?? []).map(cloudView)];
  var cloudView = (c) => Object.assign(c, { cloud: true, accountOptions: c.accountOptions ?? {}, groups: c.groups ?? [], path: "(cloud only)" });
  var tenantUser = (sam) => corpUser(sam) ?? (() => {
    const c = (lab().cloudOnly ?? []).find((x) => x.sam.toLowerCase() === String(sam).toLowerCase());
    return c ? cloudView(c) : void 0;
  })();
  function welcomeMail() {
    const L = lab();
    if (L.inbox.some((m) => m.id === "m-hired")) return;
    const name = state.technician || "there";
    const sam = name.toLowerCase().replace(/\s+/g, ".");
    L.inbox.push({
      id: "m-hired",
      from: `it01@${DOMAIN}`,
      fromName: "Alex Morgan (IT Lead)",
      to: `${sam}@${DOMAIN}`,
      received: new Date(Date.now() - 36e5).toISOString(),
      read: false,
      subject: `Welcome to CORP, ${name.split(" ")[0]}! Your first day on the Service Desk`,
      headers: [`From: Alex Morgan <it01@${DOMAIN}>`, `To: ${sam}@${DOMAIN}`, `Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`].join("\n"),
      body: [
        `Hi ${name.split(" ")[0]},`,
        "",
        "Welcome to CORP! I am delighted you accepted our offer for the IT Service Desk Analyst role. Here is what you need for your first days.",
        "",
        "Your role",
        "- Tier 1 service desk for about 25 staff across HR, IT and Finance.",
        "- You own tickets from first contact to verified resolution, and you write notes a colleague could follow.",
        "- Your manager is me, Alex Morgan (it01). Sam Rivera (it02) is your buddy for the first month.",
        "",
        "Your first week",
        "1. Open the IT Support Career Path on your desktop and work through the labs in order.",
        "2. Every request starts in the Service Desk. Never act on a phone call or an email alone: check the ticket and the approval.",
        "3. Verify every caller before you reset a password or MFA. If verification fails, change nothing and escalate to Security.",
        "4. Disable leavers, never delete them. Grant exactly what was approved, nothing more.",
        "",
        "Your tools",
        "- Service Desk, Active Directory Users and Computers, Microsoft 365 admin center, Microsoft Entra admin center, Outlook (this shared mailbox), Services, Print Management, PowerShell, Event Viewer, Remote Desktop.",
        "- The Pwd file on your desktop lists the lab accounts' training passwords for testing sign-ins.",
        "",
        "We are glad you are here. Ask questions early and often.",
        "",
        "Alex Morgan",
        "IT Lead, CORP"
      ].join("\n")
    });
  }

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
    var _a7;
    ((_a7 = S()).preferences || (_a7.preferences = {})).theme = dark ? "Dark" : "Light";
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

  // itlab/darkmode.ts
  var SKIP = /(^|[\s>+~(,])(\.lk|#login|\.lock|\.landing|\.jam|\.dj-|\.pen-|\.ia-pen|\.cert|\.word-page|#wordEditor|\.ppt-slide|\.ppt-thumb|\.calc-key|\.wallpaper|\.desktop-icon|#desktopIcons|\.wf-|\.workflow|\.mm-shield|\.taskbar|#startMenu|\.st-|\.ia-fs|\.ia-theme)|data-theme|settings-dark|::selection|::-webkit-scrollbar|:root|^html\b|^body\b(?![.#[])/i;
  var ID = "ia-dark-auto";
  var probe = null;
  function rgba(value) {
    const v = value.trim().toLowerCase();
    if (!v || v.includes("var(") || v === "transparent" || v === "currentcolor" || v === "inherit" || v === "initial" || v === "unset" || v === "none") return null;
    probe || (probe = document.createElement("canvas").getContext("2d"));
    if (!probe) return null;
    probe.fillStyle = "#010203";
    probe.fillStyle = v;
    const out = String(probe.fillStyle);
    if (out === "#010203" && v !== "#010203") return null;
    if (out.startsWith("#")) return [parseInt(out.slice(1, 3), 16), parseInt(out.slice(3, 5), 16), parseInt(out.slice(5, 7), 16), 1];
    const m = out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  function hsl([r, g, b]) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h2 = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h2 * 60, s, l];
  }
  var css = (h2, s, l, a) => `hsl(${h2.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(1)}%${a < 1 ? ` / ${a}` : ""})`;
  function darkBg(value) {
    const c = rgba(value);
    if (!c || c[3] === 0) return null;
    const [h2, s, l] = hsl(c);
    if (!(l >= 0.85 || s < 0.18 && l >= 0.6)) return null;
    return css(h2, s * 0.45, 0.125 + (1 - l) * 0.95, c[3]);
  }
  function lightInk(value) {
    const c = rgba(value);
    if (!c) return null;
    const [h2, s, l] = hsl(c);
    if (l > 0.62 || l > 0.45 && s > 0.3) return null;
    return css(h2, Math.min(s, 0.85), Math.max(0.78, 0.93 - l * 0.3), c[3]);
  }
  function darkLine(value) {
    const c = rgba(value);
    if (!c || c[3] === 0) return null;
    const [h2, s, l] = hsl(c);
    if (l < 0.75) return null;
    return css(h2, s * 0.3, 0.25, c[3]);
  }
  var COLOR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\bwhite\b/gi;
  function darkGradient(value) {
    if (!/gradient\(/i.test(value) || /url\(/i.test(value)) return null;
    let changed = false;
    const out = value.replace(COLOR_TOKEN, (tok) => {
      const d = darkBg(tok);
      if (d) {
        changed = true;
        return d;
      }
      return tok;
    });
    return changed ? out : null;
  }
  function rulesOf(list, out, media = "") {
    for (const rule of [...list]) {
      if (rule instanceof CSSMediaRule) {
        if (!/print/i.test(rule.conditionText)) {
          const inner = [];
          rulesOf(rule.cssRules, inner);
          if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join("")}}`);
        }
        continue;
      }
      if (typeof CSSSupportsRule !== "undefined" && rule instanceof CSSSupportsRule) {
        const inner = [];
        rulesOf(rule.cssRules, inner);
        if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join("")}}`);
        continue;
      }
      if (!(rule instanceof CSSStyleRule)) continue;
      const st = rule.style, decls = [];
      const imp = (p) => st.getPropertyPriority(p) === "important" ? "!important" : "";
      const bg = st.getPropertyValue("background-color"), bgi = st.getPropertyValue("background-image");
      const dbg = bg ? darkBg(bg) : null;
      if (dbg) decls.push(`background-color:${dbg}${imp("background-color")}`);
      const dgi = bgi ? darkGradient(bgi) : null;
      if (dgi) decls.push(`background-image:${dgi}${imp("background-image")}`);
      const color = st.getPropertyValue("color");
      const ink = color ? lightInk(color) : null;
      if (ink) decls.push(`color:${ink}${imp("color")}`);
      for (const side of ["top", "right", "bottom", "left"]) {
        const v = st.getPropertyValue(`border-${side}-color`);
        const d = v ? darkLine(v) : null;
        if (d) decls.push(`border-${side}-color:${d}${imp(`border-${side}-color`)}`);
      }
      if (st.getPropertyValue("color-scheme") === "light") decls.push("color-scheme:dark");
      if (!decls.length) continue;
      const sels = rule.selectorText.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => s && !SKIP.test(s));
      if (!sels.length) continue;
      out.push(`${sels.map((s) => `html[data-theme=dark] ${s}`).join(",")}{${decls.join(";")}}`);
    }
  }
  function build() {
    if (!document.head) return;
    const out = [];
    for (const sheet of [...document.styleSheets]) {
      const owner = sheet.ownerNode;
      if (owner?.id === ID) continue;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      rulesOf(rules, out);
    }
    let style = document.getElementById(ID);
    if (!style) {
      style = document.createElement("style");
      style.id = ID;
      const itlab = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => /itlab\.css/.test(l.href));
      if (itlab) itlab.before(style);
      else document.head.append(style);
    }
    const text = out.join("\n");
    if (style.textContent !== text) style.textContent = text;
  }
  var timer = 0;
  var later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(build, 150);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", build);
  else build();
  addEventListener("load", later);
  new MutationObserver((list) => {
    if (list.some((m) => [...m.addedNodes].some((n) => n.tagName === "STYLE" && n.id !== ID || n.tagName === "LINK"))) later();
  }).observe(document.head, { childList: true });

  // itlab/fullscreen.ts
  var ENTER = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  var EXIT = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  var old = document.getElementById("fullscreen");
  var btn = h("button", { id: "fullscreen", class: "ia-fs", type: "button" });
  old?.replaceWith(btn);
  var pageFull = () => !!document.fullscreenElement;
  var browserFull = () => !pageFull() && matchMedia("(display-mode: fullscreen)").matches;
  var isFull = () => pageFull() || browserFull();
  function paint() {
    const on = isFull();
    btn.replaceChildren(svg(on ? EXIT : ENTER, 16));
    btn.title = on ? "Exit full screen (F11)" : "Full screen (F11)";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("on", on);
  }
  async function toggle2() {
    try {
      if (pageFull()) await document.exitFullscreen();
      else if (browserFull()) globalThis.toast?.("Your browser is in full screen. Press F11 (or Esc) to leave it.");
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      globalThis.toast?.("Full screen is blocked here. Use your browser's full-screen shortcut (usually F11).");
    }
    paint();
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    void toggle2();
  });
  document.addEventListener("fullscreenchange", paint);
  addEventListener("resize", paint);
  document.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      void toggle2();
    }
  });
  paint();

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
    let group3 = "";
    const nav3 = [];
    for (const n of o.nav) {
      if (n.group && n.group !== group3) {
        group3 = n.group;
        nav3.push(h("div", { class: "ad2-navgroup" }, group3));
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
  var cmd = (icon2, label, onClick, disabled = false) => h("button", { class: "ad2-cmdbtn", type: "button", disabled, onClick }, svg(icon2, 16), label);
  var btn2 = (label, onClick, kind = "", disabled = false) => h("button", { class: `ad2-btn ${kind}`, type: "button", disabled, onClick }, label);
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
  function panel(title, sub, onClose, tabs, active2, onTab, ...kids) {
    return h(
      "aside",
      { class: "ad2-panel", role: "dialog", "aria-label": title },
      h("div", { class: "ad2-panel-head" }, h("div", null, h("h2", null, title), sub ? h("small", null, sub) : null), h("button", { class: "ad2-x", type: "button", "aria-label": "Close", onClick: onClose }, svg(I.close, 16))),
      tabs ? h("div", { class: "ad2-tabs", role: "tablist" }, tabs.map((t) => h("button", { class: `ad2-tab ${t === active2 ? "on" : ""}`, type: "button", role: "tab", onClick: () => onTab?.(t) }, t))) : null,
      h("div", { class: "ad2-panel-body", "data-scroll": "panel" }, ...kids)
    );
  }
  function menubar(cls, menus) {
    const bar = h("div", { class: `${cls} ia-menubar`, role: "menubar" });
    let open2 = null;
    const close2 = () => {
      open2?.remove();
      open2 = null;
      bar.querySelectorAll(".on").forEach((b) => b.classList.remove("on"));
      document.removeEventListener("pointerdown", outside, true);
    };
    const outside = (e) => {
      if (!open2?.contains(e.target) && !bar.contains(e.target)) close2();
    };
    for (const [label, items] of menus) {
      const b = h("button", { class: "ia-mtop", type: "button", role: "menuitem" }, label);
      const show = () => {
        close2();
        b.classList.add("on");
        const list = h("div", { class: "ia-mdrop", role: "menu" }, items().map((it) => it === "-" ? h("div", { class: "ia-msep" }) : h("button", { class: "ia-mitem", type: "button", role: "menuitem", disabled: !!it.disabled, onClick: () => {
          close2();
          it.action?.();
        } }, h("span", { class: "ia-mcheck" }, it.checked ? "✓" : ""), h("span", null, it.label), h("span", { class: "ia-mkey" }, it.shortcut ?? ""))));
        const r = b.getBoundingClientRect();
        list.style.left = `${r.left}px`;
        list.style.top = `${r.bottom}px`;
        document.body.appendChild(list);
        open2 = list;
        setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
      };
      b.addEventListener("click", () => open2 && b.classList.contains("on") ? close2() : show());
      b.addEventListener("pointerenter", () => {
        if (open2 && !b.classList.contains("on")) show();
      });
      bar.append(b);
    }
    return bar;
  }
  function dialog(title, body4, buttons) {
    const shade = h("div", { class: "ia-shade" });
    const close2 = () => shade.remove();
    shade.append(h(
      "div",
      { class: "ia-dialog ia", role: "dialog", "aria-label": title },
      h("h2", null, title),
      h("div", { class: "ia-dialog-body" }, body4),
      h("div", { class: "ia-dialog-foot" }, buttons.map(([label, fn, kind]) => h("button", { class: `ad2-btn ${kind ?? ""}`, type: "button", onClick: () => {
        if (fn() !== false) close2();
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
    const apps3 = APPS();
    const entry = { id: t.id, name: t.name, short: t.short, bg: "transparent", fg: "#fff", icon: `<svg viewBox="0 0 34 34" aria-hidden="true">${t.icon}</svg>` };
    const existing = apps3.find((a) => a.id === t.id);
    if (existing) Object.assign(existing, entry);
    else apps3.push(entry);
  }
  function refreshShortcuts() {
    const apps3 = APPS();
    const desk = document.getElementById("desktopIcons");
    if (desk) desk.innerHTML = apps3.map((a) => G.appButton(a, "desktop")).join("");
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
      const active2 = document.activeElement;
      const focusKey = active2 && host.contains(active2) ? active2.dataset.key : void 0;
      const caret = focusKey && "selectionStart" in active2 ? active2.selectionStart : null;
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
  function redrawTool(id) {
    const it = live.get(id);
    if (it?.host.isConnected) {
      const tool = tools.get(id);
      it.host.replaceChildren();
      tool.draw(it.host);
    }
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
    var _a7, _b;
    const L = lab();
    const users2 = S().users;
    const added = users2.map((u) => u.sam).filter((sam) => !L.synced.includes(sam));
    const removed = L.synced.filter((sam) => !users2.some((u) => u.sam === sam));
    L.synced = users2.map((u) => u.sam);
    for (const sam of removed) {
      delete L.licenses[sam];
    }
    for (const sam of added) (_a7 = L.licenses)[sam] ?? (_a7[sam] = null);
    ((_b = S()).preferences || (_b.preferences = {})).lastSync = nowIso();
    log(6946, `Entra Connect delta sync: ${added.length} added, ${removed.length} removed`);
    evidence("sync");
    save();
    return { added, removed };
  }
  function ensureMailbox(sam) {
    const L = lab();
    const u = tenantUser(sam);
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
      h("div", { class: "ad2-perm-head" }, h("b", null, label), btn2("+ Add permissions", () => pickUser(`Add ${label.toLowerCase()} permission`, onAdd))),
      list.length ? h("ul", null, list.map((sam) => h("li", null, h("span", null, tenantUser(sam)?.name ?? sam, h("small", null, ` ${sam}@${DOMAIN}`)), h("button", { class: "ad2-link", type: "button", onClick: () => onRemove(sam) }, "Remove")))) : h("p", { class: "ad2-muted" }, "No one has this permission.")
    );
  }
  function userPanel(sam) {
    const L = lab();
    const u = tenantUser(sam);
    const close2 = () => {
      selected = null;
      save();
    };
    if (!u) return panel("User not found", "", close2, null, null, null, note("This account no longer exists in Active Directory. Run a delta sync to remove it."));
    const blocked = L.blocked.includes(sam);
    const mbx2 = L.mailboxes.find((m) => m.owner === sam);
    let body4;
    if (tab === "Account") {
      body4 = h(
        "div",
        null,
        kv([["Username", `${sam}@${DOMAIN}`], ["Display name", u.name], ["Department", u.dept], ["Job title", u.title || "—"], ["Source", u.cloud ? "Cloud only (created in Microsoft Entra)" : "Windows Server AD (synced with Entra Connect)"], ["Last password change", u.passwordLastSet ? fmtDate(u.passwordLastSet) : "Not recorded"]]),
        card(
          "Sign-in",
          h("p", { class: "ad2-muted" }, blocked ? "This user is blocked from signing in to Microsoft 365." : "This user can sign in to Microsoft 365."),
          h(
            "div",
            { class: "ad2-row" },
            btn2(blocked ? "Unblock sign-in" : "Block sign-in", () => {
              L.blocked = blocked ? L.blocked.filter((x) => x !== sam) : [...L.blocked, sam];
              log(blocked ? 6005 : 6004, `${sam}: Microsoft 365 sign-in ${blocked ? "allowed" : "blocked"}`);
              save();
            }, blocked ? "" : "primary"),
            btn2("Sign out of all sessions", () => {
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
          btn2("Reset password", () => {
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
              setLabPassword(sam, v);
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
        btn2("Save changes", () => {
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
      body4 = mbx2 ? h(
        "div",
        null,
        kv([["Email address", mbx2.address], ["Mailbox type", mbx2.type === "shared" ? "Shared mailbox" : "User mailbox"], ["Usage", `${mbx2.sizeGb} GB of ${mbx2.quotaGb} GB`]]),
        mbx2.type === "user" ? card("Convert mailbox", h("p", { class: "ad2-muted" }, "Convert a leaver's mailbox to a shared mailbox to keep their email without a licence, then give their manager access."), btn2("Convert to shared mailbox", () => {
          mbx2.type = "shared";
          log(6030, `${sam}: mailbox converted to shared`);
          save();
        })) : note("This is a shared mailbox. It keeps the email and needs no licence (under 50 GB).", "ok"),
        card(
          "Mailbox permissions",
          perms(mbx2.fullAccess, "Read and manage (Full Access)", (x) => {
            if (!mbx2.fullAccess.includes(x)) mbx2.fullAccess.push(x);
            log(6031, `${x}: Full Access to ${mbx2.address}`);
            save();
          }, (x) => {
            mbx2.fullAccess = mbx2.fullAccess.filter((y) => y !== x);
            log(6032, `${x}: Full Access removed from ${mbx2.address}`);
            save();
          }),
          perms(mbx2.sendAs, "Send as", (x) => {
            if (!mbx2.sendAs.includes(x)) mbx2.sendAs.push(x);
            log(6033, `${x}: Send As on ${mbx2.address}`);
            save();
          }, (x) => {
            mbx2.sendAs = mbx2.sendAs.filter((y) => y !== x);
            log(6034, `${x}: Send As removed from ${mbx2.address}`);
            save();
          })
        )
      ) : note("No mailbox yet. Assign an Exchange Online licence (Microsoft 365 E3) to create it.", "warn");
    }
    return panel(u.name, `${sam}@${DOMAIN}`, close2, ["Account", "Licenses and apps", "Mail"], tab, (t) => {
      tab = t;
      save();
    }, body4);
  }
  function sharedPanel(address) {
    const L = lab();
    const m = L.mailboxes.find((x) => x.address === address);
    const close2 = () => {
      sharedSel = null;
      save();
    };
    return panel(
      m.name,
      m.address,
      close2,
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
    const users2 = cloudUsers();
    if (nav === "home") {
      const unsynced = S().users.filter((u) => !L.synced.includes(u.sam)).length;
      return { panel: null, page: page(
        "Home",
        h(
          "div",
          { class: "ad2-cards" },
          card("User management", h("p", { class: "ad2-muted" }, `${users2.length} active users`), btn2("Go to Active users", () => {
            nav = "users";
            save();
          }, "primary")),
          card("Licences", h("p", { class: "ad2-muted" }, `${assigned()} of ${L.licenseTotal} ${LICENSE} assigned`), btn2("Manage licences", () => {
            nav = "licenses";
            save();
          })),
          card("Directory sync", unsynced ? badge(`${unsynced} AD account(s) waiting for sync`, "warn") : badge("Up to date", "ok"), h("p", { class: "ad2-muted" }, `Last sync: ${S().preferences?.lastSync ? fmtDate(S().preferences.lastSync) : "over 30 minutes ago"}`), btn2("Directory sync status", () => {
            nav = "sync";
            save();
          })),
          card("Email security", h("p", { class: "ad2-muted" }, "Find and remove phishing that reached mailboxes."), btn2("Open Explorer", () => {
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
          cmdbar(cmd(I.user, "Add a user", () => toast("Staff accounts are created in Active Directory and synced. For a cloud-only account (contractor, shared device, service account), use Microsoft Entra admin center > Users > New user.")), cmd(I.sync, "Run delta sync", () => {
            const r = deltaSync();
            toast(`Delta sync complete: ${r.added.length} added, ${r.removed.length} removed.`);
          }), cmd(I.refresh, "Refresh", () => save())),
          table([
            ["Display name", (u) => h("b", null, u.name)],
            ["Username", (u) => `${u.sam}@${DOMAIN}`],
            ["Licences", (u) => L.licenses[u.sam] ?? h("span", { class: "ad2-muted" }, "Unlicensed")],
            ["Sign-in", (u) => L.blocked.includes(u.sam) ? badge("Blocked", "bad") : badge("Allowed", "ok")],
            ["Sync status", (u) => u.cloud ? badge("Cloud only", "") : badge("Synced from on-premises", "info")]
          ], users2, { onRow: (u) => {
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
        h("div", { class: "ad2-row" }, btn2("Run delta sync now", () => {
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
        h("div", { class: "ad2-row" }, input2, btn2("Search", () => {
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
            ["", (m) => L.purged.includes(m.id) ? "" : btn2("Soft delete from all mailboxes", () => {
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
      h("div", { class: "ad2-row" }, input, btn2("Block", () => {
        const v = input.value.trim().toLowerCase();
        if (!v) return;
        if (!L.blockedSenders.includes(v)) L.blockedSenders.push(v);
        log(6041, `Sender ${v} blocked tenant-wide`);
        save();
      }, "primary")),
      table([["Blocked sender", (s) => h("b", null, s)], ["", (s) => btn2("Remove", () => {
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
    const u = tenantUser(sam);
    const close2 = () => {
      selected2 = null;
      save();
    };
    if (!u) return panel("User not found", "", close2, null, null, null, note("This account no longer exists."));
    const methods = L.methods[sam] ?? [];
    let body4;
    if (tab2 === "Overview") {
      body4 = h(
        "div",
        null,
        kv([["User principal name", `${sam}@${DOMAIN}`], ["Account enabled", u.enabled ? "Yes" : "No"], ["On-premises sync", u.cloud ? "No (cloud only)" : "Yes (Entra Connect)"], ["Department", u.dept], ["Last sign-in", u.lastLogon ? fmtDate(u.lastLogon) : "Today"], ["Sessions revoked", L.sessionsRevoked[sam] ? fmtDate(L.sessionsRevoked[sam]) : "Never"]]),
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
        table([["Method", (m) => h("b", null, m.type)], ["Detail", (m) => m.detail], ["Added", (m) => fmtDate(m.added)], ["", (m) => btn2("Delete", () => {
          dialog("Delete authentication method?", h("p", null, `Delete ${m.type} (${m.detail}) from ${u.name}?`), [["Delete", () => {
            L.methods[sam] = (L.methods[sam] ?? []).filter((x) => x.id !== m.id);
            log(6050, `${sam}: authentication method ${m.type} (${m.detail}) deleted`);
            save();
          }, "primary"], ["Cancel", () => void 0]]);
        })]], methods, { empty: "No authentication methods. The user will register new ones at next sign-in." }),
        card(
          "Multifactor authentication",
          L.reregister[sam] ? note("The user must register MFA again at next sign-in.", "ok") : h("p", { class: "ad2-muted" }, "Ask the user to register their MFA methods again the next time they sign in (for a new phone)."),
          h("div", { class: "ad2-row" }, btn2("Require re-register multifactor authentication", () => {
            L.reregister[sam] = true;
            log(6051, `${sam}: required to re-register MFA`);
            save();
          }, "primary"))
        )
      );
    }
    return panel(u.name, `${sam}@${DOMAIN}`, close2, ["Overview", "Authentication methods"], tab2, (t) => {
      tab2 = t;
      save();
    }, body4);
  }
  function devicePanel(name) {
    const L = lab();
    const d = L.devices.find((x) => x.name === name);
    const close2 = () => {
      device = null;
      save();
    };
    if (!d) return panel("Device not found", "", close2, null, null, null);
    const owner = corpUser(d.owner);
    return panel(
      d.name,
      `Owner: ${owner?.name ?? d.owner}`,
      close2,
      null,
      null,
      null,
      kv([["Operating system", d.os], ["Join type", "Microsoft Entra hybrid joined"], ["Compliant", d.compliant ? "Yes" : "No"], ["MDM", "Microsoft Intune"], ["Last check-in", fmtDate(d.lastSync)]]),
      card(
        "BitLocker keys",
        note("Match the Key ID the user reads from the recovery screen (the first 8 characters are enough) before you give out a key. Each key you view is audited.", "warn"),
        table([["Key ID", (k) => h("code", null, k.id)], ["Created", (k) => fmtDate(k.created)], ["Recovery key", (k) => shownKeys.has(k.id) ? h("code", { class: "ad2-key" }, k.key) : btn2("Show recovery key", () => {
          shownKeys.add(k.id);
          log(6060, `BitLocker recovery key ${k.id.slice(0, 8)} for ${d.name} viewed by ${S().technician}`);
          evidence("bitlocker-view");
          save();
        })]], d.keys)
      )
    );
  }
  function newUserDialog() {
    const L = lab();
    const name = h("input", { class: "ad2-input", placeholder: "Jordan Contractor", "aria-label": "Display name" });
    const alias = h("input", { class: "ad2-input", placeholder: "jcontractor", "aria-label": "User principal name" });
    const dept = h("select", { class: "ad2-input", "aria-label": "Department" }, ["IT", "HR", "Finance"].map((d) => h("option", null, d)));
    const title = h("input", { class: "ad2-input", placeholder: "Contractor", "aria-label": "Job title" });
    dialog("New user (cloud only)", h(
      "div",
      null,
      h("p", { class: "ad2-muted" }, "Create a user that exists only in Microsoft Entra ID. Staff accounts belong in Active Directory instead."),
      h("label", { class: "ad2-field" }, "Display name", name),
      h("label", { class: "ad2-field" }, `User principal name (@${DOMAIN})`, alias),
      h("label", { class: "ad2-field" }, "Department", dept),
      h("label", { class: "ad2-field" }, "Job title", title)
    ), [["Create", () => {
      const sam = alias.value.trim().toLowerCase();
      if (!name.value.trim() || !/^[a-z][a-z0-9._-]{1,19}$/.test(sam)) {
        toast("Enter a display name and a 2–20 character user name (letters, digits, . _ -).");
        return false;
      }
      if (tenantUser(sam)) {
        toast("Another object with this user principal name already exists.");
        return false;
      }
      const password = makePassword(rng(Date.now()));
      (L.cloudOnly || (L.cloudOnly = [])).push({ sam, name: name.value.trim(), dept: dept.value, title: title.value.trim() || "Contractor", usageLocation: "US", created: nowIso(), enabled: true });
      L.licenses[sam] = null;
      L.methods[sam] = [];
      setLabPassword(sam, password);
      log(6070, `${sam}: cloud-only user created in Microsoft Entra ID`);
      save();
      setTimeout(() => dialog("User created", h("div", null, h("p", null, `${name.value.trim()} (${sam}@${DOMAIN}) was created.`), h("p", null, "Temporary password: ", h("code", { class: "ad2-key" }, password)), h("p", { class: "ad2-muted" }, "They must change it at first sign-in. It is also in Pwd.txt on your desktop. Assign a licence in the Microsoft 365 admin center if they need email.")), [["Done", () => void 0, "primary"]]), 0);
    }, "primary"], ["Cancel", () => void 0]]);
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
        note("Staff accounts are created in Active Directory and arrive here by Entra Connect sync. Use New user only for cloud-only accounts: contractors, shared devices or service accounts."),
        cmdbar(cmd(I.user, "New user", newUserDialog), cmd(I.refresh, "Refresh", () => save())),
        search2("Search by name or username"),
        table([["Display name", (u) => h("b", null, u.name)], ["User principal name", (u) => `${u.sam}@${DOMAIN}`], ["Account enabled", (u) => u.enabled ? badge("Yes", "ok") : badge("No", "bad")], ["Source", (u) => u.cloud ? badge("Cloud", "") : badge("Windows Server AD", "info")], ["MFA methods", (u) => String((L.methods[u.sam] ?? []).length)]], list, { onRow: (u) => {
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
  var G2 = globalThis;
  var closeTool = (id) => G2.CorpDesk?.closeApp?.(id);
  var about = (title, text) => dialog(title, h("p", null, text), [["OK", () => void 0, "primary"]]);
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
  var standardView = false;
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
    const tb = (icon2, title, fn, disabled) => h("button", { class: "svc-tb", type: "button", title, "aria-label": title, disabled, onClick: fn }, svg(icon2, 14));
    const PLAY = '<path d="M7 5l12 7-12 7z" fill="#2c9a3c"/>', STOP = '<rect x="6" y="6" width="12" height="12" fill="#333"/>', RESTART = '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#2c9a3c" stroke-width="2.2"/><path d="M17.5 3v4.2h-4.2" fill="none" stroke="#2c9a3c" stroke-width="2.2"/>';
    const props = () => {
      if (!sel) return;
      dialog(`${sel.DisplayName} Properties (Local Computer)`, h("dl", { class: "ad2-kv" }, h("dt", null, "Service name"), h("dd", null, sel.Name), h("dt", null, "Display name"), h("dd", null, sel.DisplayName), h("dt", null, "Description"), h("dd", null, INFO[sel.Name]?.[0] ?? ""), h("dt", null, "Startup type"), h("dd", null, INFO[sel.Name]?.[1] ?? "Manual"), h("dt", null, "Log on as"), h("dd", null, INFO[sel.Name]?.[2] ?? "Local System"), h("dt", null, "Service status"), h("dd", null, sel.Status)), [["OK", () => void 0, "primary"]]);
    };
    const menus = [
      ["File", () => [{ label: "Exit", action: () => closeTool("services") }]],
      ["Action", () => [{ label: "Start", disabled: !sel || sel.Status === "Running", action: () => act("Start") }, { label: "Stop", disabled: !sel || sel.Status !== "Running", action: () => act("Stop") }, { label: "Restart", disabled: !sel || sel.Status !== "Running", action: () => act("Restart") }, "-", { label: "Refresh", shortcut: "F5", action: () => save() }, "-", { label: "Properties", disabled: !sel, action: props }]],
      ["View", () => [{ label: "Extended", checked: !standardView, action: () => {
        standardView = false;
        save();
      } }, { label: "Standard", checked: standardView, action: () => {
        standardView = true;
        save();
      } }, "-", { label: "Refresh", shortcut: "F5", action: () => save() }]],
      ["Help", () => [{ label: "Help Topics", action: () => about("Services help", "Services lists the Windows services on this computer. Select one to start, stop or restart it, or open Properties for its description and startup type. The same services are in PowerShell: Get-Service, Start-Service, Restart-Service.") }, { label: "About Services", action: () => about("About Services", "Services (services.msc), Microsoft Management Console snap-in. CORP Desk training edition.") }]]
    ];
    host.append(h(
      "div",
      { class: "svc" },
      menubar("svc-menu", menus),
      h("div", { class: "svc-toolbar" }, tb(PLAY, "Start Service", () => act("Start"), !sel || sel.Status === "Running"), tb(STOP, "Stop Service", () => act("Stop"), !sel || sel.Status !== "Running"), tb(RESTART, "Restart Service", () => act("Restart"), !sel || sel.Status !== "Running")),
      h(
        "div",
        { class: "svc-main" },
        h("aside", { class: "svc-tree" }, h("div", { class: "svc-node" }, "Services (Local)")),
        standardView ? null : h("section", { class: "svc-desc" }, sel ? [
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
              setTimeout(props, 0);
            } },
            h("td", null, x.DisplayName),
            h("td", null, (INFO[x.Name]?.[0] ?? "").slice(0, 48) + ((INFO[x.Name]?.[0] ?? "").length > 48 ? "…" : "")),
            h("td", null, x.Status === "Running" ? "Running" : ""),
            h("td", null, INFO[x.Name]?.[1] ?? "Manual"),
            h("td", null, INFO[x.Name]?.[2] ?? "Local System")
          )))
        ))
      ),
      h("div", { class: "svc-tabs" }, h("button", { class: standardView ? "" : "on", type: "button", onClick: () => {
        standardView = false;
        save();
      } }, "Extended"), h("button", { class: standardView ? "on" : "", type: "button", onClick: () => {
        standardView = true;
        save();
      } }, "Standard"))
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
    const cancelAll = () => {
      if (!sel) return;
      const n = L.jobs.filter((j) => j.printer === sel.name).length;
      if (!n) {
        toast("There are no documents in this queue.");
        return;
      }
      dialog("Cancel All Jobs", h("p", null, `Cancel all ${n} document(s) on ${sel.name}? Their owners will have to print them again. Prefer cancelling only the job that is in error.`), [["Yes", () => {
        if (L.jobs.some((j) => j.printer === sel.name && j.status === "Error - Printing")) evidence("print-queue");
        L.jobs = L.jobs.filter((j) => j.printer !== sel.name);
        log(13, `All print jobs on ${sel.name} cancelled`);
        save();
      }, "primary"], ["No", () => void 0]]);
    };
    const menus = [
      ["File", () => [{ label: "Exit", action: () => closeTool("printmgmt") }]],
      ["Action", () => [{ label: "Open Printer Queue", disabled: !sel, action: () => {
        evidence("print-queue-view");
        save();
      } }, { label: "Print Test Page", disabled: !sel, action: () => {
        if (sel) printTestPage(sel.name);
      } }, { label: "Cancel All Jobs", disabled: !sel, action: cancelAll }, "-", { label: "Refresh", shortcut: "F5", action: () => save() }, "-", { label: "Properties", disabled: !sel, action: () => {
        if (sel) dialog(`${sel.name} Properties`, h("dl", { class: "ad2-kv" }, h("dt", null, "Location"), h("dd", null, sel.location), h("dt", null, "Driver"), h("dd", null, sel.driver), h("dt", null, "Port"), h("dd", null, sel.port), h("dt", null, "Queue status"), h("dd", null, queueStatus(sel.name))), [["OK", () => void 0, "primary"]]);
      } }]],
      ["View", () => [{ label: "All Printers", checked: filter === "all", action: () => {
        filter = "all";
        save();
      } }, { label: "Printers Not Ready", checked: filter === "notready", action: () => {
        filter = "notready";
        save();
      } }, { label: "Printers With Jobs", checked: filter === "jobs", action: () => {
        filter = "jobs";
        save();
      } }]],
      ["Help", () => [{ label: "Help Topics", action: () => about("Print Management help", 'Select a printer to open its queue. A job in "Error - Printing" at the top blocks every job behind it: cancel that job, then print a test page. If the queue shows Offline, start the Print Spooler in Services. PowerShell: Get-Printer, Get-PrintJob, Remove-PrintJob.') }, { label: "About Print Management", action: () => about("About Print Management", "Print Management (printmanagement.msc), Microsoft Management Console snap-in. CORP Desk training edition.") }]]
    ];
    host.append(h(
      "div",
      { class: "svc pm" },
      menubar("svc-menu", menus),
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

  // itlab/tools/pwd.ts
  var path = () => `C:\\Users\\${S().technician}\\Desktop\\Pwd.txt`;
  var zoom = 100;
  var wrap = false;
  var status = true;
  function find(area) {
    const input = h("input", { class: "ad2-input", "aria-label": "Find what" });
    dialog("Find", h("label", { class: "ad2-field" }, "Find what:", input), [["Find Next", () => {
      const q2 = input.value;
      if (!q2) return false;
      const i = area.value.toLowerCase().indexOf(q2.toLowerCase(), area.selectionEnd);
      const at = i >= 0 ? i : area.value.toLowerCase().indexOf(q2.toLowerCase());
      if (at < 0) {
        toast(`Cannot find "${q2}"`);
        return false;
      }
      area.focus();
      area.setSelectionRange(at, at + q2.length);
    }, "primary"], ["Cancel", () => void 0]]);
  }
  registerTool({
    id: "pwd",
    name: "Pwd - Notepad",
    short: "Pwd",
    width: 880,
    height: 620,
    icon: '<path d="M8 3h13l6 6v22H8z" fill="#fff" stroke="#7a8591" stroke-width="1.4"/><path d="M21 3v6h6" fill="#e6e9ee" stroke="#7a8591" stroke-width="1.4"/><path d="M11 14h12M11 18h12M11 22h9" stroke="#2f7fd8" stroke-width="1.6"/><rect x="18" y="22" width="11" height="9" rx="1.5" fill="#f3b23a"/><path d="M20.5 22v-2.5a3 3 0 0 1 6 0V22" fill="none" stroke="#8a6d1f" stroke-width="1.4"/>',
    draw(host) {
      if (!S().files?.[path()]) writePwdFile();
      const text = S().files?.[path()] ?? "";
      const area = h("textarea", { class: "np-text", readonly: true, spellcheck: "false", "aria-label": "Pwd.txt", "data-scroll": "np", style: `font-size:${13 * zoom / 100}px;white-space:${wrap ? "pre-wrap" : "pre"}` }, text);
      const redraw = () => redrawTool("pwd");
      host.append(h(
        "div",
        { class: "np" },
        menubar("np-menu", [
          ["File", () => [
            { label: "Save as...", shortcut: "Ctrl+Shift+S", action: () => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
              a.download = "Pwd.txt";
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
            } },
            { label: "Refresh from lab", action: () => {
              writePwdFile();
              redraw();
            } },
            "-",
            { label: "Exit", action: () => globalThis.CorpDesk?.closeApp?.("pwd") }
          ]],
          ["Edit", () => [
            { label: "Copy", shortcut: "Ctrl+C", action: () => {
              const sel = area.value.slice(area.selectionStart, area.selectionEnd) || area.value;
              void navigator.clipboard?.writeText(sel).then(() => toast("Copied."), () => toast("Copy is blocked here: select the text and press Ctrl+C."));
            } },
            { label: "Find...", shortcut: "Ctrl+F", action: () => find(area) },
            { label: "Select all", shortcut: "Ctrl+A", action: () => {
              area.focus();
              area.select();
            } }
          ]],
          ["View", () => [
            { label: "Zoom in", shortcut: "Ctrl+Plus", action: () => {
              zoom = Math.min(300, zoom + 10);
              redraw();
            } },
            { label: "Zoom out", shortcut: "Ctrl+Minus", action: () => {
              zoom = Math.max(50, zoom - 10);
              redraw();
            } },
            { label: "Restore default zoom", shortcut: "Ctrl+0", action: () => {
              zoom = 100;
              redraw();
            } },
            "-",
            { label: "Word wrap", checked: wrap, action: () => {
              wrap = !wrap;
              redraw();
            } },
            { label: "Status bar", checked: status, action: () => {
              status = !status;
              redraw();
            } }
          ]]
        ]),
        area,
        status ? h("div", { class: "np-status" }, h("span", null, path()), h("span", null, `${zoom}%   |   ${text.split(/\r?\n/).length} lines   |   Windows (CRLF)   |   UTF-8`)) : null
      ));
      area.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === "f") {
          e.preventDefault();
          find(area);
        }
      });
    }
  });

  // itlab/tools/jam.ts
  var DECKS = ["A", "B"];
  var other = (d) => d === "A" ? "B" : "A";
  var FX_LABELS = { flanger: "Flanger", echo: "Echo", filter: "Filter sweep" };
  var YT_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})|^([\w-]{11})$/;
  var youtubeId = (text) => {
    const m = YT_ID.exec(String(text).trim());
    return m ? m[1] ?? m[2] ?? null : null;
  };
  var thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  var embedUrl = (id) => `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`;
  var SANDBOX = "allow-scripts allow-same-origin allow-presentation";
  var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  var clamp01 = (v) => clamp(v, 0, 1);
  function fmtTime(sec, tenths = true) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), t = Math.floor(sec * 10 % 10);
    return tenths ? `${m}:${String(s).padStart(2, "0")}.${t}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  var parseLength = (s) => String(s).split(":").reduce((a, p) => a * 60 + (Number(p) || 0), 0);
  var newDeck = () => ({ trackId: null, vol: 0.8, pitch: 0, keylock: true, cues: [null, null, null], loopBeats: 4, stems: { vocal: true, instru: true, bass: true, kick: true, hihat: true }, filter: 0.5, fxType: "flanger", fx: { on: false, str: 0.6, spd: 0.4 }, eq: { high: 0.5, mid: 0.5, low: 0.5 }, gain: 0.5 });
  function jam() {
    var _a7;
    const s = S();
    const j = s.jam || (s.jam = {});
    j.library || (j.library = []);
    j.queue || (j.queue = []);
    for (const t of j.library) {
      t.kind || (t.kind = "yt");
      t.artist ?? (t.artist = t.channel ?? "");
      t.duration || (t.duration = 0);
      t.bpm || (t.bpm = 0);
    }
    j.decks || (j.decks = { A: newDeck(), B: newDeck() });
    for (const d of DECKS) {
      const deck = (_a7 = j.decks)[d] || (_a7[d] = {});
      for (const [k, v] of Object.entries(newDeck())) if (deck[k] === void 0) deck[k] = v;
      if (deck.vol > 1) deck.vol /= 100;
      if (deck.filter < 0) deck.filter = (deck.filter + 1) / 2;
    }
    if (typeof j.xfade !== "number" || j.xfade > 1) j.xfade = typeof j.xfade === "number" ? j.xfade / 100 : 0.5;
    if (typeof j.master !== "number" || j.master > 1) j.master = typeof j.master === "number" ? j.master / 100 : 0.85;
    j.automix ?? (j.automix = false);
    j.sandbox ?? (j.sandbox = false);
    j.samplerLevel ?? (j.samplerLevel = 0.8);
    j.samplerPitch ?? (j.samplerPitch = 0.5);
    j.covers ?? (j.covers = true);
    if (!j.remain || typeof j.remain !== "object") j.remain = { A: false, B: false };
    j.view || (j.view = "video");
    j.source || (j.source = "youtube");
    return j;
  }
  var files = /* @__PURE__ */ new Map();
  var ENV_RATE = 100;
  var envs = /* @__PURE__ */ new Map();
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function synthEnv(id, seconds, bpm) {
    let h2 = 2166136261;
    for (const ch of id) h2 = Math.imul(h2 ^ ch.charCodeAt(0), 16777619);
    const rnd = seeded(h2), n = Math.max(1, Math.ceil(seconds * ENV_RATE)), amp = new Float32Array(n), low = new Float32Array(n);
    const beat = 60 / bpm, sections = Array.from({ length: 64 }, () => 0.45 + rnd() * 0.55), grain = Array.from({ length: 997 }, () => rnd());
    for (let f = 0; f < n; f++) {
      const t = f / ENV_RATE, b = t / beat, ph = b - Math.floor(b), bar = Math.floor(b / 4);
      const level = sections[Math.floor(bar / 8) % sections.length];
      const kick = Math.exp(-ph * 9), off = Math.exp(-Math.abs(ph - 0.5) * 18) * 0.45, hat = grain[f % grain.length] * 0.22;
      const edge = Math.min(1, t / 6, Math.max(0, seconds - t) / 6);
      amp[f] = Math.min(1, edge * level * (0.28 + 0.6 * kick + off * 0.5 + hat));
      low[f] = Math.min(1, (kick * 0.95 + 0.12) * (level > 0.62 ? 1 : 0.7));
    }
    return { amp, low, real: false, key: `${id}:${Math.round(seconds)}:${bpm}` };
  }
  function envFor(t, duration) {
    const e = envs.get(t.id);
    if (t.kind === "file") return e ?? null;
    const seconds = duration || t.duration || 420, bpm = t.bpm || 120, key = `${t.id}:${Math.round(seconds)}:${bpm}`;
    if (e?.key === key) return e;
    const made = synthEnv(t.id, seconds, bpm);
    envs.set(t.id, made);
    return made;
  }
  var searchResults = null;
  var searchQuery = "";
  var searching = false;
  var searchError = "";
  var filterText = "";
  var selected4 = null;
  var trackOf = (id) => id ? jam().library.find((t) => t.id === id) ?? files.get(id)?.track ?? searchResults?.find((t) => t.id === id) ?? null : null;
  var deckTrack = (d) => trackOf(jam().decks[d].trackId);
  var ICONS = {
    play: '<path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="5" y="3" width="5" height="18" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="3" width="5" height="18" rx="1" fill="currentColor" stroke="none"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" stroke="none"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eject: '<path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    youtube: '<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    folderPlus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    drive: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01"/><path d="M10 16h.01"/>',
    list: '<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.46-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.97a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.04a4 4 0 0 1-3.3-1.8l-.36-.45"/>',
    maximize: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    wave: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    circle: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    images: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L12 17"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
    listPlus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>'
  };
  function ic(name, size = 12, cls = "") {
    const t = document.createElement("template");
    t.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ""}>${ICONS[name] ?? ""}</svg>`;
    return t.content.firstChild;
  }
  function svgEl(markup) {
    const t = document.createElement("template");
    t.innerHTML = markup;
    return t.content.firstElementChild;
  }
  var actx = null;
  var masterGain = null;
  var masterAnalyser = [];
  var recDest = null;
  function ctx() {
    if (!actx) {
      actx = new AudioContext();
      masterGain = actx.createGain();
      const split = actx.createChannelSplitter(2);
      masterAnalyser = [actx.createAnalyser(), actx.createAnalyser()];
      for (const a of masterAnalyser) a.fftSize = 1024;
      masterGain.connect(split);
      split.connect(masterAnalyser[0], 0);
      split.connect(masterAnalyser[1], 1);
      masterGain.connect(actx.destination);
      recDest = actx.createMediaStreamDestination();
      masterGain.connect(recDest);
      applyMasterOut();
    }
    if (actx.state === "suspended") void actx.resume();
    return actx;
  }
  function applyMasterOut() {
    if (masterGain) masterGain.gain.value = jam().sandbox ? 0 : 1;
  }
  var graphs = {};
  function graph(d) {
    if (graphs[d]) return graphs[d];
    const c = ctx();
    const audio = new Audio();
    audio.preload = "auto";
    const src = c.createMediaElementSource(audio);
    const trim = c.createGain();
    const eq = { low: c.createBiquadFilter(), mid: c.createBiquadFilter(), high: c.createBiquadFilter() };
    eq.low.type = "lowshelf";
    eq.low.frequency.value = 250;
    eq.mid.type = "peaking";
    eq.mid.frequency.value = 1e3;
    eq.mid.Q.value = 0.8;
    eq.high.type = "highshelf";
    eq.high.frequency.value = 4e3;
    src.connect(trim);
    trim.connect(eq.low);
    eq.low.connect(eq.mid);
    eq.mid.connect(eq.high);
    const sum = c.createGain();
    const band = (lo, hi) => {
      let node = eq.high;
      if (lo) {
        const f = c.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = lo;
        node.connect(f);
        node = f;
      }
      if (hi) {
        const f = c.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = hi;
        node.connect(f);
        node = f;
      }
      const g = c.createGain();
      node.connect(g);
      g.connect(sum);
      return g;
    };
    const bands = { kick: band(null, 110), bass: band(110, 280), vocal: band(280, 3500), instru: band(3500, 7e3), hihat: band(7e3, null) };
    const filter2 = c.createBiquadFilter();
    filter2.type = "allpass";
    sum.connect(filter2);
    const delay = c.createDelay(4);
    delay.delayTime.value = 4e-3;
    const feedback = c.createGain();
    feedback.gain.value = 0;
    const wet = c.createGain();
    wet.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.3;
    const depth = c.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();
    const channel2 = c.createGain();
    filter2.connect(channel2);
    filter2.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(channel2);
    const meter = c.createAnalyser();
    meter.fftSize = 1024;
    channel2.connect(meter);
    channel2.connect(masterGain);
    audio.addEventListener("ended", () => {
      live2[d].playing = false;
      G.save();
    });
    graphs[d] = { audio, trim, eq, bands, filter: filter2, delay, wet, feedback, lfo, depth, channel: channel2, meter };
    return graphs[d];
  }
  var eqDb = (v) => v < 0.5 ? -40 * (1 - v * 2) : (v - 0.5) * 2 * 6;
  function applyFx(d) {
    const g = graphs[d];
    if (!g) return;
    const ds = jam().decks[d];
    g.trim.gain.value = Math.pow(10, (ds.gain - 0.5) * 24 / 20);
    for (const b of ["low", "mid", "high"]) g.eq[b].gain.value = eqDb(ds.eq[b]);
    for (const s of Object.keys(g.bands)) g.bands[s].gain.value = ds.stems[s] ? 1 : 0;
    const v = ds.filter * 2 - 1;
    if (Math.abs(v) < 0.04) g.filter.type = "allpass";
    else if (v < 0) {
      g.filter.type = "lowpass";
      g.filter.frequency.value = 2e4 * Math.pow(2, v * 10);
      g.filter.Q.value = 4;
    } else {
      g.filter.type = "highpass";
      g.filter.frequency.value = 20 * Math.pow(2, v * 10);
      g.filter.Q.value = 4;
    }
    const on = ds.fx.on, str = ds.fx.str, spd = ds.fx.spd;
    if (ds.fxType === "echo") {
      g.depth.gain.value = 0;
      g.delay.delayTime.value = beatLen(d) * (spd < 0.33 ? 0.5 : spd < 0.66 ? 0.75 : 1);
      g.feedback.gain.value = on ? str * 0.6 : 0;
      g.wet.gain.value = on ? str * 0.8 : 0;
    } else if (ds.fxType === "filter") {
      g.wet.gain.value = 0;
      g.feedback.gain.value = 0;
      g.depth.gain.value = 0;
    } else {
      g.delay.delayTime.value = 4e-3;
      g.depth.gain.value = on ? 1e-3 + str * 3e-3 : 0;
      g.lfo.frequency.value = 0.05 + spd * 4;
      g.wet.gain.value = on ? 0.4 + str * 0.6 : 0;
      g.feedback.gain.value = on ? str * 0.7 : 0;
    }
  }
  function noise(c, secs) {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const n = c.createBufferSource();
    n.buffer = b;
    return n;
  }
  var HITS = [
    { id: "horn", label: "HORN", title: "Air horn (Z)", play: (c, out, t, k) => {
      for (const [i, f] of [[0, 466], [0.18, 466], [0.36, 554]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sawtooth";
        o.frequency.value = f * k;
        g.gain.setValueAtTime(0.25, t + i);
        g.gain.exponentialRampToValueAtTime(1e-3, t + i + 0.16);
        o.connect(g).connect(out);
        o.start(t + i);
        o.stop(t + i + 0.17);
      }
    } },
    { id: "siren", label: "SIREN", title: "Siren (X)", play: (c, out, t, k) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle";
      for (let n = 0; n < 6; n++) {
        o.frequency.setValueAtTime(600 * k, t + n * 0.3);
        o.frequency.linearRampToValueAtTime(1200 * k, t + n * 0.3 + 0.15);
        o.frequency.linearRampToValueAtTime(600 * k, t + n * 0.3 + 0.3);
      }
      g.gain.setValueAtTime(0.25, t);
      g.gain.setValueAtTime(0.25, t + 1.6);
      g.gain.linearRampToValueAtTime(0, t + 1.8);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.8);
    } },
    { id: "laser", label: "LASER", title: "Laser (C)", play: (c, out, t, k) => {
      for (let n = 0; n < 3; n++) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(2400 * k, t + n * 0.12);
        o.frequency.exponentialRampToValueAtTime(120 * k, t + n * 0.12 + 0.11);
        g.gain.setValueAtTime(0.15, t + n * 0.12);
        g.gain.exponentialRampToValueAtTime(1e-3, t + n * 0.12 + 0.11);
        o.connect(g).connect(out);
        o.start(t + n * 0.12);
        o.stop(t + n * 0.12 + 0.12);
      }
    } },
    { id: "riser", label: "RISE", title: "Riser (V)", play: (c, out, t, k) => {
      const n = noise(c, 2), f = c.createBiquadFilter(), g = c.createGain();
      f.type = "bandpass";
      f.Q.value = 6;
      f.frequency.setValueAtTime(200 * k, t);
      f.frequency.exponentialRampToValueAtTime(9e3 * k, t + 2);
      g.gain.setValueAtTime(0.05, t);
      g.gain.linearRampToValueAtTime(0.5, t + 1.9);
      g.gain.linearRampToValueAtTime(0, t + 2);
      n.connect(f).connect(g).connect(out);
      n.start(t);
    } },
    { id: "impact", label: "HIT", title: "Impact (B)", play: (c, out, t, k) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(160 * k, t);
      o.frequency.exponentialRampToValueAtTime(40 * k, t + 0.5);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(1e-3, t + 0.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.6);
      const n = noise(c, 0.3), ng = c.createGain();
      ng.gain.setValueAtTime(0.4, t);
      ng.gain.exponentialRampToValueAtTime(1e-3, t + 0.3);
      n.connect(ng).connect(out);
      n.start(t);
    } },
    { id: "clap", label: "CLAP", title: "Clap (N)", play: (c, out, t, k) => {
      for (const n0 of [0, 0.012, 0.025]) {
        const n = noise(c, 0.2), f = c.createBiquadFilter(), g = c.createGain();
        f.type = "bandpass";
        f.frequency.value = 1500 * k;
        g.gain.setValueAtTime(0.6, t + n0);
        g.gain.exponentialRampToValueAtTime(1e-3, t + n0 + 0.18);
        n.connect(f).connect(g).connect(out);
        n.start(t + n0);
      }
    } },
    { id: "rewind", label: "REW", title: "Rewind (G)", play: (c, out, t, k) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(900 * k, t);
      o.frequency.exponentialRampToValueAtTime(60 * k, t + 0.9);
      g.gain.setValueAtTime(0.2, t);
      g.gain.linearRampToValueAtTime(0, t + 0.9);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.9);
    } },
    { id: "tom", label: "TOM", title: "Tom fill (H)", play: (c, out, t, k) => {
      for (const [n0, f] of [[0, 220], [0.15, 170], [0.3, 120]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(f * k, t + n0);
        o.frequency.exponentialRampToValueAtTime(f * k / 2.2, t + n0 + 0.3);
        g.gain.setValueAtTime(0.7, t + n0);
        g.gain.exponentialRampToValueAtTime(1e-3, t + n0 + 0.35);
        o.connect(g).connect(out);
        o.start(t + n0);
        o.stop(t + n0 + 0.36);
      }
    } }
  ];
  var samplerOut = null;
  var hitLit = null;
  function fire(id) {
    const c = ctx();
    if (!samplerOut) {
      samplerOut = c.createGain();
      samplerOut.connect(masterGain);
    }
    const j = jam();
    samplerOut.gain.value = j.samplerLevel;
    HITS.find((x) => x.id === id)?.play(c, samplerOut, c.currentTime + 0.01, Math.pow(2, (j.samplerPitch - 0.5) * 2));
    hitLit = { id, at: performance.now() };
  }
  async function analyse(id, blob) {
    try {
      const buf = await ctx().decodeAudioData(await blob.arrayBuffer());
      const ch = buf.getChannelData(0), N = 2e3, step = Math.max(1, Math.floor(ch.length / N)), peaks2 = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let m = 0;
        for (let k = i * step, e = Math.min(ch.length, k + step); k < e; k += 8) m = Math.max(m, Math.abs(ch[k]));
        peaks2[i] = m;
      }
      const hop = 512, frames = Math.min(Math.floor(ch.length / hop), Math.floor(buf.sampleRate * 90 / hop)), env = new Float32Array(frames);
      let prev = 0;
      for (let f = 0; f < frames; f++) {
        let e = 0;
        for (let k = f * hop; k < f * hop + hop; k += 2) e += ch[k] * ch[k];
        env[f] = Math.max(0, e - prev);
        prev = e;
      }
      const fps = buf.sampleRate / hop;
      let best = 0, bestLag = 0;
      for (let lag = Math.floor(fps * 60 / 180); lag <= Math.ceil(fps * 60 / 70); lag++) {
        let s = 0;
        for (let f = lag; f < frames; f++) s += env[f] * env[f - lag];
        if (s > best) {
          best = s;
          bestLag = lag;
        }
      }
      const hopE = Math.max(1, Math.floor(buf.sampleRate / ENV_RATE)), nE = Math.floor(ch.length / hopE), amp = new Float32Array(nE), low = new Float32Array(nE);
      const kLp = 1 - Math.exp(-2 * Math.PI * 150 / buf.sampleRate);
      let lp = 0, maxA = 0;
      for (let f = 0; f < nE; f++) {
        let a = 0, l = 0;
        for (let i = f * hopE, e = i + hopE; i < e; i++) {
          const s = ch[i];
          lp += kLp * (s - lp);
          const as = s < 0 ? -s : s, al = lp < 0 ? -lp : lp;
          if (as > a) a = as;
          if (al > l) l = al;
        }
        amp[f] = a;
        low[f] = a ? Math.min(1, l / a * 1.6) : 0;
        if (a > maxA) maxA = a;
      }
      if (maxA) for (let f = 0; f < nE; f++) amp[f] /= maxA;
      envs.set(id, { amp, low, real: true, key: id });
      const entry = files.get(id);
      if (!entry) return;
      entry.peaks = peaks2;
      entry.track.duration = buf.duration;
      if (bestLag) entry.track.bpm = Math.round(fps * 60 / bestLag * 100) / 100;
      G.save();
    } catch {
    }
  }
  function addFiles(list) {
    const out = [];
    for (const f of [...list].filter((x) => x.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(x.name))) {
      const id = `file:${f.name}:${f.size}`;
      if (!files.has(id)) {
        const base = f.name.replace(/\.[^.]+$/, ""), parts = base.split(" - ");
        const track = { id, kind: "file", title: parts.length > 1 ? parts.slice(1).join(" - ") : base, artist: parts.length > 1 ? parts[0] : "", duration: 0, bpm: 0 };
        files.set(id, { track, url: URL.createObjectURL(f) });
        void analyse(id, f);
      }
      out.push(files.get(id).track);
    }
    if (!out.length) toast("No audio files found there.");
    else {
      jam().source = "music";
      save();
    }
    return out;
  }
  function pickFiles(folder2) {
    const i = h("input", { type: "file", accept: "audio/*", multiple: true });
    if (folder2) i.setAttribute("webkitdirectory", "");
    i.addEventListener("change", () => {
      if (i.files) addFiles(i.files);
    });
    i.click();
  }
  var SEARCH_HOSTED = "https://corpdesk-it-support-lab.vercel.app/api/yt-search";
  async function searchYouTube(query2) {
    const q2 = query2.replace(/\s+/g, " ").trim();
    if (!q2) return;
    const direct = youtubeId(q2);
    if (direct) {
      const t = addToLibrary(direct);
      selected4 = t.id;
      jam().source = "saved";
      save();
      toast("Added to My YouTube songs.");
      return;
    }
    searchQuery = q2;
    searching = true;
    searchError = "";
    jam().source = "youtube";
    G.save();
    const urls = location.protocol.startsWith("http") ? [`/api/yt-search`, SEARCH_HOSTED] : [SEARCH_HOSTED];
    let lastError = "YouTube search is unavailable right now.";
    for (const base of urls) {
      try {
        const res = await fetch(`${base}?q=${encodeURIComponent(q2)}`, { signal: AbortSignal.timeout(15e3) });
        const body4 = await res.json().catch(() => null);
        if (res.ok && Array.isArray(body4?.results)) {
          searchResults = body4.results.filter((r) => youtubeId(r.id)).map((r) => ({ id: r.id, kind: "yt", title: String(r.title), artist: String(r.channel ?? ""), duration: parseLength(r.duration), bpm: 0, album: r.views ? `${r.views} views` : "" }));
          selected4 = searchResults[0]?.id ?? null;
          searching = false;
          G.save();
          if (!searchResults.length) toast("No playable videos found. Try other words.");
          return;
        }
        if (res.status === 400 && body4?.error) {
          lastError = body4.error;
          break;
        }
        if (body4?.error) lastError = body4.error;
      } catch {
      }
    }
    searching = false;
    searchError = lastError;
    searchResults = [];
    G.save();
  }
  var apiReady = null;
  function loadApi() {
    if (apiReady) return apiReady;
    apiReady = new Promise((resolve) => {
      if (globalThis.YT?.Player) {
        resolve();
        return;
      }
      const prev = globalThis.onYouTubeIframeAPIReady;
      globalThis.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => toast("Jam could not reach YouTube. Check the internet connection.");
      document.head.appendChild(s);
    });
    return apiReady;
  }
  var players = {};
  var live2 = {
    A: { playing: false, time: 0, duration: 0, error: "", loopIn: null, loopOut: null, loop: false },
    B: { playing: false, time: 0, duration: 0, error: "", loopIn: null, loopOut: null, loop: false }
  };
  var dock = h("div", { class: "jam-dock", "aria-label": "Jam video players" });
  var slots = { A: h("div", { class: "jam-video-slot", "data-deck": "A" }), B: h("div", { class: "jam-video-slot", "data-deck": "B" }) };
  var covers = { A: h("div", { class: "jam-cover" }), B: h("div", { class: "jam-cover" }) };
  dock.append(slots.A, slots.B);
  var attachDock = () => {
    if (!dock.isConnected) document.body.appendChild(dock);
  };
  if (document.body) attachDock();
  else addEventListener("DOMContentLoaded", attachDock);
  var ytOn = (d) => !!players[d] && deckTrack(d)?.kind === "yt";
  function placeDock() {
    const locked = [...document.querySelectorAll(".lk")].some((e) => e.getClientRects().length > 0);
    dock.style.visibility = locked ? "hidden" : "";
    const monitor = document.querySelector('[data-jam-video="main"]');
    let r = monitor?.isConnected ? monitor.getBoundingClientRect() : null;
    if (r && r.width > 40) {
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
      const covered = pts.some(([x, y]) => {
        const top = document.elementsFromPoint(x, y).find((e) => !dock.contains(e));
        return !!top && !monitor.contains(top);
      });
      if (covered) r = null;
    }
    const shown = DECKS.filter(ytOn);
    const front = shown.length === 2 ? outputVolume("A") >= outputVolume("B") ? "A" : "B" : shown[0];
    let mini = 0;
    for (const d of DECKS) {
      const slot = slots[d];
      if (!ytOn(d)) {
        slot.style.display = "none";
        continue;
      }
      slot.style.display = "";
      if (r && r.width > 40 && r.height > 30) {
        slot.classList.remove("mini");
        const pip = d !== front;
        const w = pip ? r.width * 0.34 : r.width, hgt = pip ? r.height * 0.34 : r.height;
        const left = pip ? r.right - w - 5 : r.left, top = pip ? r.top + 5 : r.top;
        const c = monitor.closest(".ia")?.getBoundingClientRect() ?? r;
        const t = Math.max(0, c.top - top), b = Math.max(0, top + hgt - c.bottom), l = Math.max(0, c.left - left), rt = Math.max(0, left + w - c.right);
        Object.assign(slot.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${hgt}px`, right: "", bottom: "", zIndex: pip ? "2" : "1", clipPath: `inset(${t}px ${rt}px ${b}px ${l}px round 3px)`, visibility: t + b >= hgt || l + rt >= w ? "hidden" : "" });
      } else {
        slot.classList.add("mini");
        Object.assign(slot.style, { left: "-10000px", top: "0px", right: "", bottom: "", width: "320px", height: "180px", zIndex: "", clipPath: "", visibility: "" });
        mini++;
      }
    }
  }
  var frameLoop = () => {
    placeDock();
    requestAnimationFrame(frameLoop);
  };
  requestAnimationFrame(frameLoop);
  setInterval(placeDock, 200);
  function showError(d, code) {
    const t = deckTrack(d);
    const blocked = [101, 150, 100, 152].includes(code);
    const desktopApp = !!globalThis.chrome?.webview;
    live2[d].error = blocked ? "The song's owner limits which sites may play it. Pick another upload (lyric or audio versions usually play)." : "YouTube could not play this video here.";
    live2[d].playing = false;
    covers[d].replaceChildren(
      h("b", null, blocked ? "This upload is limited by its owner" : "Video unavailable"),
      h("p", null, blocked ? "Record labels often block their videos on other sites. Load another upload of the same song." : "YouTube refused this video. Try another upload."),
      h(
        "div",
        null,
        desktopApp && t ? h("button", { type: "button", onClick: () => G.CorpDesk?.newBrowserTab?.(`https://www.youtube.com/watch?v=${t.id}`) }, "Play in the lab browser") : null,
        h("button", { type: "button", onClick: () => {
          openApp("jam");
          void searchYouTube(t && !t.title.startsWith("YouTube video") ? `${t.title} audio` : "official audio");
        } }, "Find another upload"),
        h("button", { type: "button", onClick: () => {
          covers[d].classList.remove("on");
          jam().decks[d].trackId = null;
          players[d]?.stopVideo?.();
          save();
        } }, "Eject")
      )
    );
    covers[d].classList.add("on");
    G.save();
  }
  async function ensurePlayer(d, id) {
    await loadApi();
    if (players[d]) return players[d];
    attachDock();
    const frame = h("iframe", { src: embedUrl(id), title: `Jam deck ${d} video`, allow: "autoplay; encrypted-media; fullscreen; picture-in-picture", allowfullscreen: true, sandbox: SANDBOX, referrerpolicy: "strict-origin-when-cross-origin" });
    slots[d].replaceChildren(frame, covers[d], h("span", { class: "jam-slot-label", title: "Open Jam", onClick: () => openApp("jam") }, `JAM · DECK ${d}`));
    await new Promise((resolve) => {
      players[d] = new YT.Player(frame, {
        events: {
          onReady: () => resolve(),
          onStateChange: (e) => {
            if (deckTrack(d)?.kind !== "yt") return;
            live2[d].playing = e.data === 1;
            if (e.data === 1) covers[d].classList.remove("on");
            fillTitle(d);
            G.save();
          },
          onError: (e) => showError(d, Number(e.data))
        }
      });
    });
    return players[d];
  }
  function fillTitle(d) {
    const t = deckTrack(d), info = players[d]?.getVideoData?.();
    if (!t || t.kind !== "yt" || !info?.title || info.video_id !== t.id) return;
    const dur = players[d]?.getDuration?.() ?? 0;
    if (!t.title.startsWith("YouTube video") && t.duration) return;
    if (t.title.startsWith("YouTube video")) {
      t.title = String(info.title);
      t.artist = String(info.author ?? "");
    }
    if (dur) t.duration = dur;
    save();
  }
  function outputVolume(d) {
    const j = jam();
    const curve = d === "A" ? Math.cos(j.xfade * Math.PI / 2) : Math.sin(j.xfade * Math.PI / 2);
    return j.sandbox ? 0 : Math.round(100 * j.decks[d].vol * Math.min(1, curve * Math.SQRT2) * j.master);
  }
  function applyMix() {
    for (const d of DECKS) {
      players[d]?.setVolume?.(outputVolume(d));
      if (graphs[d]) {
        const j = jam();
        const curve = d === "A" ? Math.cos(j.xfade * Math.PI / 2) : Math.sin(j.xfade * Math.PI / 2);
        graphs[d].channel.gain.value = j.decks[d].vol * Math.min(1, curve * Math.SQRT2) * j.master;
      }
    }
    applyMasterOut();
  }
  function applyRate(d) {
    const ds = jam().decks[d], rate = 1 + ds.pitch;
    if (deckTrack(d)?.kind === "yt") players[d]?.setPlaybackRate?.(rate);
    const g = graphs[d];
    if (g) {
      g.audio.playbackRate = rate;
      g.audio.preservesPitch = ds.keylock;
    }
  }
  var now = (d) => deckTrack(d)?.kind === "file" ? graphs[d]?.audio.currentTime ?? 0 : players[d]?.getCurrentTime?.() ?? 0;
  var length = (d) => {
    const t = deckTrack(d);
    if (t?.kind === "file") return graphs[d]?.audio.duration || t.duration || 0;
    return players[d]?.getDuration?.() || t?.duration || 0;
  };
  function seek(d, t) {
    t = Math.max(0, t);
    if (deckTrack(d)?.kind === "file") {
      if (graphs[d]) graphs[d].audio.currentTime = t;
    } else players[d]?.seekTo?.(t, true);
    live2[d].time = t;
  }
  var PITCH_RANGE = 0.08;
  async function loadTrack(d, t, autoplay = false) {
    const j = jam(), ds = j.decks[d];
    if (t.kind === "yt" && !j.library.some((x) => x.id === t.id)) addToLibrary(t.id, t.title, t.artist, t.duration);
    players[d]?.pauseVideo?.();
    graphs[d]?.audio.pause();
    covers[d].classList.remove("on");
    ds.trackId = t.id;
    ds.cues = [null, null, null];
    Object.assign(live2[d], { playing: false, time: 0, duration: t.duration, error: "", loopIn: null, loopOut: null, loop: false });
    save();
    if (t.kind === "file") {
      const g = graph(d), f = files.get(t.id);
      if (!f) {
        live2[d].error = "This song was added in an earlier session. Add it again from your computer.";
        G.save();
        return;
      }
      g.audio.src = f.url;
      applyFx(d);
      applyRate(d);
      applyMix();
      if (autoplay) await play(d);
    } else {
      const p = await ensurePlayer(d, t.id);
      if (autoplay) p.loadVideoById(t.id);
      else p.cueVideoById(t.id);
      applyRate(d);
      applyMix();
      setTimeout(() => fillTitle(d), 1500);
    }
  }
  async function play(d) {
    const t = deckTrack(d);
    if (!t) {
      toast(`Load a song on deck ${d} first.`);
      return;
    }
    applyMix();
    if (t.kind === "file") {
      const g = graph(d);
      try {
        await g.audio.play();
        live2[d].playing = true;
      } catch {
        toast("The browser blocked playback. Press play again.");
      }
      G.save();
    } else {
      const p = await ensurePlayer(d, t.id);
      if (p.getVideoData?.()?.video_id !== t.id) p.cueVideoById(t.id);
      p.playVideo();
    }
  }
  function pause(d) {
    if (deckTrack(d)?.kind === "file") {
      graphs[d]?.audio.pause();
      live2[d].playing = false;
      G.save();
    } else players[d]?.pauseVideo?.();
  }
  var toggle3 = (d) => {
    if (live2[d].playing) pause(d);
    else void play(d);
  };
  function stop(d) {
    pause(d);
    seek(d, 0);
  }
  function eject(d) {
    if (live2[d].playing) return;
    players[d]?.stopVideo?.();
    graphs[d]?.audio.removeAttribute("src");
    covers[d].classList.remove("on");
    jam().decks[d].trackId = null;
    live2[d] = { ...live2[d], time: 0, duration: 0, error: "" };
    save();
  }
  function cue(d) {
    const ds = jam().decks[d];
    if (!deckTrack(d)) return;
    if (live2[d].playing) {
      pause(d);
      seek(d, ds.cues[0] ?? 0);
      return;
    }
    ds.cues[0] = now(d);
    save();
  }
  function hotCue(d, i) {
    const ds = jam().decks[d];
    if (!deckTrack(d)) {
      toast(`Load a song on deck ${d} first.`);
      return;
    }
    if (ds.cues[i] == null) ds.cues[i] = now(d);
    else {
      seek(d, ds.cues[i]);
      if (!live2[d].playing) void play(d);
    }
    save();
  }
  var beatLen = (d) => 60 / ((deckTrack(d)?.bpm || 120) * (1 + jam().decks[d].pitch));
  function sync(d) {
    const a = deckTrack(d), b = deckTrack(other(d)), j = jam();
    if (!a?.bpm || !b?.bpm) {
      toast("SYNC needs the BPM of both songs. Jam measures BPM for songs from your computer; match YouTube songs by ear with the pitch fader.");
      return false;
    }
    const target = b.bpm * (1 + j.decks[other(d)].pitch);
    j.decks[d].pitch = clamp(target / a.bpm - 1, -PITCH_RANGE, PITCH_RANGE);
    applyRate(d);
    save();
    return true;
  }
  var fading = false;
  function fadeTo(to) {
    const j = jam();
    if (!deckTrack(to)) {
      toast(`Load a song on deck ${to} to mix into.`);
      return;
    }
    if (fading) {
      fading = false;
      return;
    }
    fading = true;
    void play(to);
    const start = j.xfade, end = to === "B" ? 1 : 0, t0 = performance.now();
    const timer2 = setInterval(() => {
      if (!fading) {
        clearInterval(timer2);
        save();
        return;
      }
      const k = Math.min(1, (performance.now() - t0) / 8e3);
      j.xfade = start + (end - start) * k;
      applyMix();
      document.querySelectorAll(".jam-dj .dj-xfader .dj-hfader-cap").forEach((c) => {
        c.style.left = `calc(${j.xfade} * (100% - 18px))`;
      });
      if (k >= 1) {
        clearInterval(timer2);
        fading = false;
        pause(other(to));
        save();
      }
    }, 50);
  }
  var recorder = null;
  var recChunks = [];
  var recStarted = 0;
  var recBytes = 0;
  function toggleRec() {
    if (recorder) {
      recorder.stop();
      return;
    }
    ctx();
    if (DECKS.some((d) => deckTrack(d)?.kind === "yt")) toast("Recording the mix. YouTube decks play inside YouTube's player, so only songs from your computer and the sampler are captured.");
    const mime = ["audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(recDest.stream, mime ? { mimeType: mime } : void 0);
    recChunks = [];
    recBytes = 0;
    recStarted = performance.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        recChunks.push(e.data);
        recBytes += e.data.size;
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(recChunks, { type: "audio/webm" });
      recorder = null;
      G.save();
      if (!blob.size) {
        toast("Nothing was recorded.");
        return;
      }
      const a = h("a", { href: URL.createObjectURL(blob), download: `jam-mix-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm` });
      document.body.append(a);
      a.click();
      a.remove();
      toast("Mix saved to your Downloads.");
    };
    recorder.start(1e3);
    G.save();
  }
  function addToLibrary(id, title, artist = "", duration = 0) {
    const j = jam();
    let t = j.library.find((x) => x.id === id);
    if (!t) {
      t = { id, kind: "yt", title: title || `YouTube video ${id}`, artist, duration, bpm: 0 };
      j.library.unshift(t);
      j.library = j.library.slice(0, 300);
      save();
    }
    return t;
  }
  function sendToJam(url, title, deck) {
    const id = youtubeId(url);
    if (!id) {
      toast("That is not a YouTube video link.");
      return;
    }
    const t = addToLibrary(id, title), j = jam();
    const d = deck ?? (!j.decks.A.trackId ? "A" : !j.decks.B.trackId ? "B" : live2.A.playing ? "B" : "A");
    openApp("jam");
    void loadTrack(d, t);
    toast(`Loaded on deck ${d}.`);
  }
  var knobSeq = 0;
  function knob(o) {
    const size = o.size ?? 34, center = o.center ?? 0.5, color = o.color ?? "#3b82f6", def = o.def ?? 0.5;
    let value = o.value;
    const c = size / 2, r = size / 2 - 3, ridges = Math.max(18, Math.round(size * 0.75));
    const arc = (from, to) => {
      const a0 = (-135 + from * 270 - 90) * Math.PI / 180, a1 = (-135 + to * 270 - 90) * Math.PI / 180;
      const R = r + 1.5, x0 = c + R * Math.cos(a0), y0 = c + R * Math.sin(a0), x1 = c + R * Math.cos(a1), y1 = c + R * Math.sin(a1);
      return `M${x0} ${y0} A${R} ${R} 0 ${Math.abs(to - from) * 270 > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1} ${y1}`;
    };
    const id = `jk${++knobSeq}`;
    const lines = Array.from({ length: ridges }, (_, i) => {
      const a = i / ridges * Math.PI * 2;
      return `<line x1="${c + Math.cos(a) * (r - 1.2)}" y1="${c + Math.sin(a) * (r - 1.2)}" x2="${c + Math.cos(a) * (r - 2.6)}" y2="${c + Math.sin(a) * (r - 2.6)}" stroke="rgba(0,0,0,0.4)" stroke-width="0.7"/>`;
    }).join("");
    const svg2 = svgEl(`<svg width="${size}" height="${size}" role="slider" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}g" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#c9ccd1"/><stop offset="100%" stop-color="#7d828a"/></radialGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#eceef0"/><stop offset="100%" stop-color="#80858c"/></linearGradient><radialGradient id="${id}p" cx="35%" cy="28%" r="45%"><stop offset="0%" stop-color="#fff" stop-opacity="0.9"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle class="dj-knob-base" cx="${c}" cy="${c}" r="${r + 2.5}" fill="#1d1f23"/><path class="jam-knob-arc" d="" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="${c + 0.6}" cy="${c + 1.2}" r="${r - 0.6}" fill="rgba(0,0,0,0.45)"/><g class="jam-knob-turn"><circle class="dj-knob-skirt" cx="${c}" cy="${c}" r="${r - 1}" fill="url(#${id}s)" stroke="#0e0f11" stroke-width="0.8"/>${lines}</g><circle class="dj-knob-cap" cx="${c}" cy="${c}" r="${r - 2.6}" fill="url(#${id}g)" stroke="#6b7078" stroke-width="0.6"/><ellipse cx="${c - r * 0.18}" cy="${c - r * 0.3}" rx="${r * 0.5}" ry="${r * 0.32}" fill="url(#${id}p)"/><g class="jam-knob-turn"><rect class="dj-knob-lip" x="${c - 1.1 + 0.5}" y="4.6" width="2.2" height="${r * 0.55}" rx="1" fill="rgba(255,255,255,0.7)"/><rect class="dj-knob-ptr" x="${c - 1.1}" y="4" width="2.2" height="${r * 0.55}" rx="1" fill="#16181b"/></g></svg>`);
    const paint2 = () => {
      const angle = -135 + value * 270;
      svg2.querySelectorAll(".jam-knob-turn").forEach((g) => g.setAttribute("transform", `rotate(${angle} ${c} ${c})`));
      const p = svg2.querySelector(".jam-knob-arc");
      p.setAttribute("d", Math.abs(value - center) > 4e-3 ? arc(Math.min(center, value), Math.max(center, value)) : "");
      svg2.setAttribute("aria-valuenow", String(Math.round(value * 100)));
    };
    paint2();
    svg2.setAttribute("aria-label", o.title ?? o.label ?? "");
    const set = (v) => {
      value = clamp01(v);
      paint2();
      o.onChange(value);
    };
    let start = null;
    svg2.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || o.disabled) return;
      svg2.setPointerCapture(e.pointerId);
      start = { y: e.clientY, v: value };
      e.preventDefault();
    });
    svg2.addEventListener("pointermove", (e) => {
      if (!start) return;
      let dv = (start.y - e.clientY) / 160;
      if (e.shiftKey) dv *= 0.2;
      set(start.v + dv);
    });
    const end = () => {
      if (start) {
        start = null;
        save();
      }
    };
    svg2.addEventListener("pointerup", end);
    svg2.addEventListener("pointercancel", end);
    svg2.addEventListener("wheel", (e) => {
      if (o.disabled) return;
      e.preventDefault();
      set(value + (e.shiftKey ? 5e-3 : 0.025) * (e.deltaY < 0 ? 1 : -1));
      save();
    }, { passive: false });
    svg2.addEventListener("dblclick", () => {
      if (!o.disabled) {
        set(def);
        save();
      }
    });
    return h("div", { class: "dj-knob", title: o.title ?? o.label }, svg2, o.label ? h("span", { class: "dj-knob-label" }, o.label) : null);
  }
  function vfader(o) {
    const height = o.height ?? 120;
    let value = o.value;
    const cap = h("div", { class: "dj-vfader-cap" });
    const paint2 = () => {
      cap.style.top = `calc(${o.invert ? value : 1 - value} * (100% - 22px))`;
    };
    paint2();
    const el = h(
      "div",
      { class: `dj-vfader ${o.cls ?? ""}`, style: `height:${height}px`, title: o.title, role: "slider", "aria-label": o.title },
      h("div", { class: "dj-vfader-ticks" }, Array.from({ length: o.ticks ?? 11 }, () => h("i"))),
      h("div", { class: "dj-vfader-slot" }),
      cap
    );
    const set = (v) => {
      value = clamp01(v);
      paint2();
      o.onChange(value);
    };
    let start = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      start = { y: e.clientY, v: value };
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (!start) return;
      let dv = (start.y - e.clientY) / (height - 22);
      if (o.invert) dv = -dv;
      if (e.shiftKey) dv *= 0.2;
      set(start.v + dv);
    });
    const end = () => {
      if (start) {
        start = null;
        save();
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      set(value + (e.shiftKey ? 5e-3 : 0.025) * (e.deltaY < 0 ? 1 : -1) * (o.invert ? -1 : 1));
      save();
    }, { passive: false });
    el.addEventListener("dblclick", () => {
      set(o.def ?? 0.75);
      save();
    });
    return el;
  }
  function hfader(o) {
    const width = o.width ?? 150;
    let value = o.value;
    const cap = h("div", { class: "dj-hfader-cap" });
    const paint2 = () => {
      cap.style.left = `calc(${value} * (100% - 18px))`;
    };
    paint2();
    const el = h("div", { class: "dj-hfader", style: `width:${width}px`, title: o.title, role: "slider", "aria-label": o.title }, h("div", { class: "dj-hfader-slot" }), cap);
    const set = (v) => {
      value = clamp01(v);
      paint2();
      o.onChange(value);
    };
    let start = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      start = { x: e.clientX, v: value };
      fading = false;
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (!start) return;
      let dv = (e.clientX - start.x) / (width - 18);
      if (e.shiftKey) dv *= 0.2;
      set(start.v + dv);
    });
    const end = () => {
      if (start) {
        start = null;
        save();
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("dblclick", () => {
      set(o.def ?? 0.5);
      save();
    });
    return el;
  }
  function vu(key, segments = 16, horizontal = false, height = 120) {
    return h(
      "div",
      { class: `dj-vu ${horizontal ? "dj-vu-h" : ""}`, style: horizontal ? null : `height:${height}px`, "data-segments": String(segments), "data-jam-vu": key },
      Array.from({ length: segments }, (_, i) => h("i", { class: "lit", "data-zone": i < 3 ? "red" : i < 6 ? "amber" : "green" })),
      h("div", { class: "dj-vu-cover" }),
      h("div", { class: "dj-vu-hold", style: `${horizontal ? "width" : "height"}:${100 / segments}%` })
    );
  }
  var led = (label, on, color, onClick, cls = "", title) => h("button", { type: "button", class: `dj-btn ${on ? `dj-on dj-on-${color}` : ""} ${cls}`, title, onClick }, label);
  function dropTarget(el, d) {
    el.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      el.classList.add("dj-drop-hot");
    });
    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) el.classList.remove("dj-drop-hot");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("dj-drop-hot");
      const dt = e.dataTransfer;
      if (!dt) return;
      const id = dt.getData("application/x-jam-track");
      if (id && trackOf(id)) {
        void loadTrack(d, trackOf(id));
        return;
      }
      if (dt.files.length) {
        const t = addFiles(dt.files)[0];
        if (t) void loadTrack(d, t);
        return;
      }
      const text = dt.getData("text/uri-list") || dt.getData("text/plain");
      if (text) sendToJam(text, void 0, d);
    });
    return el;
  }
  function deckDb(d) {
    const g = graphs[d];
    if (g && live2[d].playing && deckTrack(d)?.kind === "file") return rmsDb(g.meter);
    if (live2[d].playing) return 20 * Math.log10(Math.max(1e-4, outputVolume(d) / 100 * (0.35 + Math.random() * 0.25)));
    return -96;
  }
  var fbuf = new Float32Array(1024);
  function rmsDb(a) {
    a.getFloatTimeDomainData(fbuf);
    let s = 0;
    for (let i = 0; i < a.fftSize; i++) s += fbuf[i] * fbuf[i];
    return 10 * Math.log10(s / a.fftSize + 1e-10);
  }
  function masterDb(i) {
    let db = actx && masterAnalyser[i] ? rmsDb(masterAnalyser[i]) : -96;
    for (const d of DECKS) if (live2[d].playing && deckTrack(d)?.kind === "yt") db = Math.max(db, deckDb(d));
    return db;
  }
  var peaks = /* @__PURE__ */ new Map();
  function paintVu(el, db) {
    const segments = Number(el.dataset.segments) || 16, horizontal = el.classList.contains("dj-vu-h");
    const key = el.dataset.jamVu, t = performance.now(), p = peaks.get(key) ?? { db: -96, at: 0 };
    if (db > p.db || t - p.at > 900) peaks.set(key, { db, at: t });
    const level = (x) => clamp01((x + 42) / 42);
    const lit = Math.round(level(db) * segments), hold = Math.round(level(peaks.get(key).db) * segments);
    const cover = el.querySelector(".dj-vu-cover"), holdEl = el.querySelector(".dj-vu-hold");
    if (cover) cover.style.transform = horizontal ? `scaleX(${1 - lit / segments})` : `scaleY(${1 - lit / segments})`;
    if (holdEl) {
      holdEl.style.opacity = hold > lit ? "1" : "0";
      holdEl.style.transform = horizontal ? `translateX(${Math.max(0, hold - 1) * 100}%)` : `translateY(${(segments - Math.max(1, hold)) * 100}%)`;
    }
  }
  var cpuLast = performance.now();
  var cpuLag = 0;
  setInterval(() => {
    const t = performance.now();
    cpuLag = cpuLag * 0.7 + clamp01((t - cpuLast - 100) / 100) * 0.3;
    cpuLast = t;
  }, 100);
  setInterval(() => {
    const j = jam();
    for (const d of DECKS) {
      const t = deckTrack(d);
      if (!t) continue;
      const L = live2[d];
      if (t.kind === "file" && graphs[d]) L.playing = !graphs[d].audio.paused;
      L.time = now(d);
      L.duration = length(d);
      if (L.loop && L.loopIn != null && L.loopOut != null && L.time >= L.loopOut) seek(d, L.loopIn);
      if (t.kind === "file" && j.decks[d].fxType === "filter" && j.decks[d].fx.on && graphs[d]) {
        const sweep = 0.5 + Math.sin(performance.now() / 1e3 * (0.2 + j.decks[d].fx.spd * 2)) * 0.45 * j.decks[d].fx.str;
        const g = graphs[d];
        g.filter.type = sweep < 0.5 ? "lowpass" : "highpass";
        g.filter.frequency.value = sweep < 0.5 ? 2e4 * Math.pow(2, (sweep * 2 - 1) * 10) : 20 * Math.pow(2, (sweep * 2 - 1) * 10);
      }
      if (j.automix && L.playing && !fading && L.duration > 20 && L.duration - L.time < 12 && !live2[other(d)].playing) {
        const next = trackOf(j.queue[0] ?? null);
        if (next) {
          j.queue.shift();
          void loadTrack(other(d), next).then(() => fadeTo(other(d)));
        }
      }
    }
    paintLive();
  }, 50);
  function paintLive() {
    const root = document.querySelector(".jam-dj");
    if (!root) return;
    const j = jam();
    const clock2 = root.querySelector("[data-jam-clock]");
    if (clock2) clock2.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const rec = root.querySelector("[data-jam-rec]");
    if (rec) {
      const secs = recorder ? (performance.now() - recStarted) / 1e3 : 0, kb = recBytes / 1024;
      rec.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(Math.floor(secs % 60)).padStart(2, "0")} / ${kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`}`;
    }
    const lit = Math.round(cpuLag * 8);
    root.querySelectorAll(".dj-cpu-bar i").forEach((el, i) => {
      el.className = i < lit ? i >= 6 ? "hot" : i >= 4 ? "warm" : "on" : "";
    });
    root.querySelectorAll(".dj-hit").forEach((el) => el.classList.toggle("dj-hit-lit", !!hitLit && el.dataset.hit === hitLit.id && performance.now() - hitLit.at < 160));
    for (const d of DECKS) {
      const L = live2[d], ds = j.decks[d], t = deckTrack(d);
      root.querySelectorAll(`[data-jam-time="${d}"]`).forEach((el) => {
        el.textContent = (j.remain[d] && t ? "-" : "") + fmtTime(j.remain[d] ? Math.max(0, L.duration - L.time) : L.time);
      });
      root.querySelector(`.dj-time[data-deck="${d}"]`)?.classList.toggle("dj-warn", !!t && L.playing && L.duration - L.time < 30);
      root.querySelector(`.dj-deck-letter[data-deck="${d}"]`)?.classList.toggle("dj-live", L.playing);
      const platter2 = root.querySelector(`.dj-platter[data-deck="${d}"]`);
      if (platter2) {
        platter2.classList.toggle("jam-spinning", L.playing);
        const arm = platter2.querySelector(".dj-tonearm");
        const angle = t ? 19 + clamp01(L.duration ? L.time / L.duration : 0) * 24 : 0;
        if (arm && Math.abs(Number(arm.dataset.angle ?? -1) - angle) > 0.05) {
          arm.dataset.angle = String(angle);
          arm.style.transform = `rotate(${angle.toFixed(2)}deg)`;
        }
        platter2.querySelector(".dj-hw-target")?.classList.toggle("dj-on", !!t);
      }
      root.querySelector(`.dj-hw-lamp[data-deck="${d}"]`)?.classList.toggle("dj-on", L.playing);
      const pb = root.querySelector(`.dj-play[data-deck="${d}"]`);
      if (pb && pb.classList.contains("dj-playing") !== L.playing) {
        pb.classList.toggle("dj-playing", L.playing);
        pb.replaceChildren(ic(L.playing ? "pause" : "play", 22));
        pb.title = L.playing ? "Pause" : "Play";
      }
      const bpm = root.querySelector(`[data-jam-bpm="${d}"]`);
      if (bpm) bpm.textContent = t?.bpm ? (t.bpm * (1 + ds.pitch)).toFixed(2) : "00.00";
      paintZoom(root.querySelector(`canvas[data-jam-strip="${d}"]`), [d], true);
      paintOverview(root.querySelector(`canvas[data-jam-overview="${d}"]`), d);
    }
    paintZoom(root.querySelector("canvas.dj-zoomwave"), DECKS, false);
    root.querySelectorAll("[data-jam-vu]").forEach((el) => {
      const k = el.dataset.jamVu;
      paintVu(el, k === "A" || k === "B" ? deckDb(k) : masterDb(k.endsWith("R") ? 1 : 0));
    });
    const np = root.querySelector(".dj-nowplaying");
    if (np) {
      const air = DECKS.filter((d) => live2[d].playing).sort((a, b) => outputVolume(b) - outputVolume(a))[0];
      const shown = air ?? DECKS.find((d) => deckTrack(d));
      const t = shown ? deckTrack(shown) : null;
      np.classList.toggle("dj-np-live", !!air);
      const lamp = np.querySelector(".dj-np-lamp");
      if (lamp) lamp.firstChild.textContent = air ? "ON AIR" : shown ? "READY" : "IDLE";
      const tt = np.querySelector(".dj-np-text b");
      if (tt) tt.textContent = t ? t.title : "Load a song to begin";
      const ts = np.querySelector(".dj-np-text small");
      if (ts) ts.textContent = t ? [t.artist, `Deck ${shown}`].filter(Boolean).join(" · ") : "Search YouTube below, or add songs from your computer";
      const time = np.querySelector(".dj-np-time span"), bar = np.querySelector(".dj-np-bar div");
      if (shown && live2[shown].duration) {
        if (time) time.textContent = `-${fmtTime(Math.max(0, live2[shown].duration - live2[shown].time), false)}`;
        if (bar) bar.style.transform = `scaleX(${Math.min(1, live2[shown].time / live2[shown].duration)})`;
      } else {
        if (time) time.textContent = "--:--";
        if (bar) bar.style.transform = "scaleX(0)";
      }
      const nb = np.querySelector(".dj-np-stat b");
      if (nb) nb.textContent = t?.bpm ? (t.bpm * (1 + j.decks[shown].pitch)).toFixed(1) : "--";
      const nxt = shown ? deckTrack(other(shown)) : null;
      const nn = np.querySelector(".dj-np-next b");
      if (nn) nn.textContent = nxt && !live2[other(shown)].playing ? nxt.title : "—";
    }
    const scope = root.querySelector(".dj-scope-menu canvas");
    if (scope && actx && masterAnalyser[0]) {
      const g = scope.getContext("2d"), bins = new Uint8Array(masterAnalyser[0].frequencyBinCount);
      masterAnalyser[0].getByteFrequencyData(bins);
      if (g) {
        const w = scope.width, hh = scope.height, n = 48, nyq = actx.sampleRate / 2;
        g.fillStyle = "#07090b";
        g.fillRect(0, 0, w, hh);
        for (let i = 0; i < n; i++) {
          const f0 = 40 * Math.pow(400, i / n), f1 = 40 * Math.pow(400, (i + 1) / n), b0 = Math.floor(f0 / nyq * bins.length), b1 = Math.max(b0 + 1, Math.floor(f1 / nyq * bins.length));
          let m = 0;
          for (let b = b0; b < b1 && b < bins.length; b++) m = Math.max(m, bins[b]);
          const bh = m / 255 * (hh - 4), gr = g.createLinearGradient(0, hh, 0, 0);
          gr.addColorStop(0, "#22c55e");
          gr.addColorStop(0.65, "#facc15");
          gr.addColorStop(1, "#ef4444");
          g.fillStyle = gr;
          g.fillRect(i * (w / n) + 1, hh - bh, w / n - 2, bh);
        }
      }
    }
  }
  var DECK_COLORS = { A: { hi: "#4cc3ff", lo: "#1d5fff" }, B: { hi: "#ff8a3d", lo: "#ff2d55" } };
  var ZOOM_SECONDS = 12;
  var STRIP_SECONDS = 6;
  function pixel(hex, alpha = 255) {
    const n = parseInt(hex.slice(1), 16);
    return (alpha << 24 | (n & 255) << 16 | n & 65280 | n >> 16 & 255) >>> 0;
  }
  var rasters = /* @__PURE__ */ new WeakMap();
  function sizeCanvas(cv) {
    const w = cv.clientWidth, hh = cv.clientHeight;
    if (!w || !hh) return null;
    const k = Math.min(1.5, devicePixelRatio || 1);
    if (cv.width !== Math.round(w * k) || cv.height !== Math.round(hh * k)) {
      cv.width = Math.round(w * k);
      cv.height = Math.round(hh * k);
    }
    const g = cv.getContext("2d");
    if (!g) return null;
    g.setTransform(k, 0, 0, k, 0, 0);
    return { g, w, h: hh, k };
  }
  function paintZoom(cv, decks, compact) {
    if (!cv) return;
    const f = sizeCanvas(cv);
    if (!f) return;
    const { g, w, h: h2, k } = f, W = cv.width, H = cv.height, lane = h2 / decks.length, center = w / 2, seconds = compact ? STRIP_SECONDS : ZOOM_SECONDS;
    let r = rasters.get(cv);
    if (!r || r.img.width !== W || r.img.height !== H) {
      const img2 = g.createImageData(W, H);
      r = { img: img2, px: new Uint32Array(img2.data.buffer) };
      rasters.set(cv, r);
    } else r.px.fill(0);
    const { img, px } = r;
    decks.forEach((d, i) => {
      const t = deckTrack(d), L = live2[d];
      if (!t) return;
      const env = envFor(t, L.duration);
      if (!env) return;
      const col = DECK_COLORS[d], hi = pixel(col.hi), lo = pixel(col.lo), hiPast = pixel(col.hi, 140), loPast = pixel(col.lo, 140);
      const laneD = H / decks.length, midD = i * laneD + laneD / 2, half = (lane / 2 - 2) * k;
      const rate = 1 + jam().decks[d].pitch, sppD = seconds * rate / w / k, t0 = L.time - W / 2 * sppD;
      for (let x = 0; x < W; x++) {
        const ta = t0 + x * sppD;
        const f0 = Math.max(0, Math.floor(ta * ENV_RATE)), f1 = Math.min(env.amp.length, Math.max(f0 + 1, Math.floor((ta + sppD) * ENV_RATE)));
        let a = 0, l = 0;
        for (let q2 = f0; q2 < f1; q2++) {
          if (env.amp[q2] > a) a = env.amp[q2];
          if (env.low[q2] > l) l = env.low[q2];
        }
        if (!a) continue;
        const past = x < W / 2, ah = Math.max(0.5, a * half), lh = l * a * half;
        const bar = (y0, y1, c) => {
          const a0 = Math.max(0, Math.floor(y0)), b0 = Math.min(H, Math.ceil(y1));
          for (let y = a0; y < b0; y++) px[y * W + x] = c;
        };
        bar(midD - ah, midD + ah, past ? hiPast : hi);
        if (lh >= 0.5) bar(midD - lh, midD + lh, past ? loPast : lo);
      }
    });
    g.putImageData(img, 0, 0);
    decks.forEach((d, i) => {
      const t = deckTrack(d), L = live2[d], top = i * lane, mid = top + lane / 2;
      const spp = seconds * (1 + jam().decks[d].pitch) / w, t0 = L.time - center * spp, xOf = (s) => (s - t0) / spp;
      if (t) {
        const bl = beatLen(d), bars = new Path2D(), beats = new Path2D();
        for (let n = Math.ceil(t0 / bl); n * bl < t0 + w * spp; n++) {
          const x = xOf(n * bl), isBar = (n % 4 + 4) % 4 === 0, p = isBar ? bars : beats;
          p.rect(x, top + 1, isBar ? 1.5 : 1, isBar ? 6 : 4);
          p.rect(x, top + lane - (isBar ? 7 : 5), isBar ? 1.5 : 1, isBar ? 6 : 4);
        }
        g.fillStyle = "rgba(255,255,255,0.75)";
        g.fill(bars);
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.fill(beats);
        if (L.loopIn != null && L.loopOut != null) {
          g.fillStyle = L.loop ? "rgba(74,222,128,0.22)" : "rgba(255,255,255,0.08)";
          g.fillRect(xOf(L.loopIn), top, xOf(L.loopOut) - xOf(L.loopIn), lane);
        }
        g.fillStyle = "#ffd60a";
        g.fillRect(xOf(jam().decks[d].cues[0] ?? 0), top, 1.5, lane);
      }
      if (i > 0) {
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(0, top, w, 1);
      }
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.font = "bold 11px Inter, Arial";
      if (!compact) g.fillText(d, 4, top + 11);
      else if (t?.kind === "yt" && !L.duration) {
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.fillText("Loading from YouTube…", 6, mid + 4);
      }
    });
    g.fillStyle = "#ffffff";
    g.fillRect(center - 1, 0, 2, h2);
    g.beginPath();
    g.moveTo(center - 5, 0);
    g.lineTo(center + 5, 0);
    g.lineTo(center, 6);
    g.moveTo(center - 5, h2);
    g.lineTo(center + 5, h2);
    g.lineTo(center, h2 - 6);
    g.fill();
  }
  function paintOverview(cv, d) {
    if (!cv) return;
    const f = sizeCanvas(cv);
    if (!f) return;
    const { g, w, h: h2 } = f, t = deckTrack(d), L = live2[d];
    g.clearRect(0, 0, w, h2);
    if (!t) return;
    const dur = L.duration || t.duration, env = envFor(t, dur);
    if (!env || !dur) return;
    const head = Math.min(1, L.time / dur) * w, col = DECK_COLORS[d];
    for (let x = 0; x < w; x++) {
      const f0 = Math.floor(x / w * env.amp.length), f1 = Math.max(f0 + 1, Math.floor((x + 1) / w * env.amp.length));
      let a = 0, l = 0;
      for (let q2 = f0; q2 < f1 && q2 < env.amp.length; q2++) {
        if (env.amp[q2] > a) a = env.amp[q2];
        if (env.low[q2] > l) l = env.low[q2];
      }
      const ah = Math.max(0.5, a * h2 / 2);
      g.globalAlpha = x < head ? 1 : 0.45;
      g.fillStyle = col.hi;
      g.fillRect(x, h2 / 2 - ah, 1, ah * 2);
      if (l * a > 0.05) {
        g.fillStyle = col.lo;
        g.fillRect(x, h2 / 2 - l * a * h2 / 2, 1, l * a * h2);
      }
    }
    g.globalAlpha = 1;
    for (const c of jam().decks[d].cues) if (c != null) {
      g.fillStyle = "#ffd60a";
      g.fillRect(c / dur * w, 0, 1.5, h2);
    }
    if (L.loopIn != null && L.loopOut != null) {
      g.fillStyle = "rgba(74,222,128,0.35)";
      g.fillRect(L.loopIn / dur * w, 0, (L.loopOut - L.loopIn) / dur * w, h2);
    }
    g.fillStyle = "#fff";
    g.fillRect(head - 1, 0, 2, h2);
  }
  var scopeOpen = false;
  var uiZoom = (() => {
    try {
      const v = parseFloat(localStorage.getItem("jam-zoom") ?? "");
      return v >= 0.55 && v <= 1 ? v : 1;
    } catch {
      return 1;
    }
  })();
  function topBar() {
    const j = jam();
    return h(
      "div",
      { class: "dj-top" },
      h("div", { class: "dj-brand" }, h("span", null, "Jam"), h("b", null, "DJ")),
      h("div", { class: "dj-lcd dj-top-clock" }, h("span", { "data-jam-clock": "" })),
      h("div", { class: "dj-cpu", title: "Load" }, h("span", null, "CPU"), h("div", { class: "dj-cpu-bar" }, Array.from({ length: 8 }, () => h("i")))),
      h("div", { class: "dj-top-meter", title: "Master level" }, h("span", null, "MASTER"), h("div", { class: "dj-hmeter" }, vu("ML", 24, true), vu("MR", 24, true))),
      h("button", { type: "button", class: `dj-top-automix ${j.automix ? "dj-on dj-on-green" : ""}`, title: "Automix — mix through the set list (A)", onClick: () => {
        j.automix = !j.automix;
        save();
      } }, `AUTOMIX ${j.automix ? "ON" : "OFF"}`),
      h(
        "div",
        { class: "dj-sandbox" },
        h("button", { type: "button", class: `dj-top-btn dj-icon-btn ${j.sandbox ? "dj-on dj-on-orange" : ""}`, title: "Sandbox — silence the speakers while you set up the next song", onClick: () => {
          j.sandbox = !j.sandbox;
          applyMix();
          save();
        } }, ic("box", 14)),
        h("div", { class: `dj-lcd dj-sandbox-bar ${j.sandbox ? "dj-sandbox-on" : ""}` }, j.sandbox ? "SANDBOX · speakers muted" : "SANDBOX")
      ),
      h(
        "div",
        { class: "dj-bank", role: "group", "aria-label": "Sampler" },
        knob({ value: j.samplerLevel, onChange: (v) => {
          j.samplerLevel = v;
        }, size: 22, center: 0, def: 0.8, color: "#22c55e", title: "Sampler volume" }),
        h("div", { class: "dj-bank-pads" }, HITS.map((x, i) => {
          const b = h("button", { type: "button", class: `dj-hit ${i < 4 ? "dj-hit-a" : "dj-hit-b"}`, title: x.title, "data-hit": x.id }, x.label);
          b.addEventListener("pointerdown", () => fire(x.id));
          return b;
        })),
        knob({ value: j.samplerPitch, onChange: (v) => {
          j.samplerPitch = v;
        }, size: 22, center: 0.5, def: 0.5, color: "#38bdf8", title: "Sampler pitch (±1 octave, double-click to reset)" })
      ),
      h(
        "div",
        { class: "dj-lcd dj-nowplaying", title: "Now playing" },
        h("span", { class: "dj-np-lamp" }, "IDLE", h("i")),
        h("div", { class: "dj-np-cover" }),
        h("div", { class: "dj-np-text" }, h("b", null, "Load a song to begin"), h("small", null, "")),
        h("div", { class: "dj-np-stat" }, h("small", null, "BPM"), h("b", null, "--")),
        h("div", { class: "dj-np-time" }, h("span", null, "--:--"), h("div", { class: "dj-np-bar" }, h("div"))),
        h("div", { class: "dj-np-next" }, h("small", null, "NEXT"), h("b", null, "—"))
      ),
      h(
        "div",
        { class: "dj-zoomctl", title: "Console size" },
        h("button", { type: "button", "aria-label": "Smaller", disabled: uiZoom <= 0.55, onClick: () => setZoom(uiZoom - 0.05) }, ic("minus", 11)),
        h("span", null, `${Math.round(uiZoom * 100)}%`),
        h("button", { type: "button", "aria-label": "Bigger", disabled: uiZoom >= 1, onClick: () => setZoom(uiZoom + 0.05) }, ic("plus", 11))
      ),
      h(
        "div",
        { class: "dj-rec" },
        h("button", { type: "button", class: `dj-rec-btn ${recorder ? "dj-recording" : ""}`, title: recorder ? "Stop and save the recording" : "Record your mix", onClick: toggleRec }, ic(recorder ? "square" : "circle", 9), " REC"),
        h("span", { class: "dj-lcd dj-rec-info", "data-jam-rec": "" }, "00:00 / 0 KB")
      ),
      h(
        "div",
        { class: "dj-out" },
        h("button", { type: "button", class: `dj-top-btn dj-icon-btn ${scopeOpen ? "dj-on dj-on-blue" : ""}`, title: "Master spectrum", onClick: () => {
          scopeOpen = !scopeOpen;
          G.save();
        } }, ic("wave", 14)),
        scopeOpen ? h("div", { class: "dj-out-menu dj-scope-menu" }, h("div", { class: "dj-out-title" }, "Master spectrum"), h("canvas", { width: "300", height: "110" }), h("p", null, "Songs from your computer and the sampler. YouTube audio stays inside its player.")) : null
      ),
      h(
        "div",
        { class: "dj-out" },
        h("button", { type: "button", class: "dj-top-btn dj-icon-btn", title: "Find songs on YouTube in the lab's Chrome", onClick: () => G.CorpDesk?.newBrowserTab?.("https://www.youtube.com") }, ic("youtube", 14))
      )
    );
  }
  function setZoom(z) {
    uiZoom = clamp(Math.round(z * 100) / 100, 0.55, 1);
    try {
      localStorage.setItem("jam-zoom", String(uiZoom));
    } catch {
    }
    G.save();
  }
  function deckClock(d) {
    const j = jam();
    const letter = h("div", { class: `dj-deck-letter ${live2[d].playing ? "dj-live" : ""}`, "data-deck": d }, d);
    return dropTarget(h(
      "div",
      { class: `dj-clock dj-panel ${d === "B" ? "dj-mirror" : ""}` },
      d === "A" ? letter : null,
      h(
        "button",
        { type: "button", class: "dj-lcd dj-time", "data-deck": d, title: "Toggle elapsed / remaining", onClick: () => {
          j.remain[d] = !j.remain[d];
          save();
        } },
        h("span", { class: "dj-lcd-labels" }, h("b", { class: j.remain[d] ? "" : "on" }, "ELAPSED"), " ", h("b", { class: j.remain[d] ? "on" : "" }, "REMAIN")),
        h("span", { class: "dj-lcd-big", "data-jam-time": d }, "0:00.0")
      ),
      d === "B" ? letter : null
    ), d);
  }
  function deckInfo(d) {
    const t = deckTrack(d), ds = jam().decks[d], L = live2[d];
    const cover = h("div", { class: "dj-cover" }, t?.kind === "yt" ? h("img", { src: thumb(t.id), alt: "" }) : h("div", { class: "dj-cover-empty" }));
    const pct2 = ds.pitch * 100;
    const readout = h(
      "div",
      { class: "dj-lcd dj-readout" },
      h("div", { class: "dj-ro-row" }, h("span", null, "BPM"), h("b", { class: "dj-lcd-mid", "data-jam-bpm": d }, "00.00")),
      h("div", { class: "dj-ro-row" }, h("span", null, "PITCH"), h("b", null, `${pct2 >= 0 ? "+" : ""}${pct2.toFixed(1)}`)),
      h("div", { class: "dj-ro-row" }, h("span", null, "KEY"), h("b", { class: "dj-key" }, ""), ds.keylock && t ? ic("lock", 9) : null)
    );
    const overview = h("canvas", { class: "dj-overview", "data-jam-overview": d });
    overview.addEventListener("click", (e) => {
      const r = overview.getBoundingClientRect();
      if (L.duration) seek(d, (e.clientX - r.left) / r.width * L.duration);
    });
    const title = h(
      "div",
      { class: "dj-lcd dj-title-box" },
      h(
        "div",
        { class: "dj-title-line" },
        t?.kind === "yt" ? h("span", { class: "dj-src-badge dj-src-direct", title: "YouTube — direct playback: volume, crossfader, pitch, loops and cues" }, ic("youtube", 9)) : null,
        h("span", { class: "dj-title-text" }, t ? [h("b", null, t.artist ? `${t.artist} - ` : ""), t.title] : h("span", { class: "dj-dim" }, "- Drag a song on this deck to load it"))
      ),
      L.error ? h("div", { class: "dj-err" }, L.error) : null,
      h("div", { class: "dj-stripwave-wrap" }, h("canvas", { class: "dj-stripwave", "data-jam-strip": d })),
      h("div", { class: "dj-overview-wrap", style: "height:10px" }, overview)
    );
    return dropTarget(h("div", { class: `dj-info dj-panel ${d === "B" ? "dj-mirror" : ""}` }, ...d === "A" ? [cover, title, readout] : [readout, title, cover]), d);
  }
  var STEMS = [
    { k: "vocal", label: "Vocal", color: "#22c55e" },
    { k: "instru", label: "Instru", color: "#f97316" },
    { k: "bass", label: "Bass", color: "#ef4444" },
    { k: "kick", label: "Kick", color: "#3b82f6" },
    { k: "hihat", label: "HiHat", color: "#38bdf8" }
  ];
  function deckPads(d) {
    const ds = jam().decks[d], t = deckTrack(d), L = live2[d];
    const full = !t || t.kind === "file";
    const s = ds.stems;
    const fx = () => {
      applyFx(d);
      save();
    };
    const stemBtn = (x) => h("button", { type: "button", class: `dj-stem ${s[x.k] ? "dj-stem-on" : ""}`, style: `--stem:${x.color}`, title: s[x.k] ? `Mute ${x.label}` : `Bring back ${x.label}`, onClick: () => {
      s[x.k] = !s[x.k];
      fx();
    } }, x.label, h("i"));
    const acapella = s.vocal && !s.instru, instrumental = !s.vocal && s.instru;
    const loopLabel = ds.loopBeats >= 1 ? String(ds.loopBeats) : `1/${Math.round(1 / ds.loopBeats)}`;
    const relen = () => {
      if (L.loop && L.loopIn != null) L.loopOut = L.loopIn + ds.loopBeats * beatLen(d);
    };
    const select = h("select", { class: "dj-lcd dj-fx-select", "aria-label": "Effect" }, Object.keys(FX_LABELS).map((k) => h("option", { value: k, selected: ds.fxType === k }, FX_LABELS[k])));
    select.addEventListener("change", () => {
      ds.fxType = select.value;
      fx();
    });
    return dropTarget(h(
      "div",
      { class: `dj-pads dj-panel ${d === "B" ? "dj-mirror" : ""} ${full ? "" : "dj-limited"}`, title: full ? null : "This YouTube video plays directly from YouTube, so stems and effects cannot reach it" },
      h(
        "div",
        { class: "dj-section dj-stems" },
        h("div", { class: "dj-section-title" }, "STEMS"),
        h(
          "div",
          { class: "dj-stem-grid" },
          STEMS.slice(0, 3).map(stemBtn),
          led("Acapella", acapella, "green", () => {
            for (const x of STEMS) s[x.k] = false;
            s.vocal = true;
            fx();
          }, "dj-small", "Acapella — vocals only"),
          STEMS.slice(3).map(stemBtn),
          led("Reset", false, "green", () => {
            for (const x of STEMS) s[x.k] = true;
            fx();
          }, "dj-small", "Bring every stem back"),
          led("Instrum.", instrumental, "orange", () => {
            for (const x of STEMS) s[x.k] = true;
            s.vocal = false;
            fx();
          }, "dj-small", "Instrumental — remove vocals")
        )
      ),
      h(
        "div",
        { class: "dj-pads-body" },
        h(
          "div",
          { class: "dj-col dj-hotcues" },
          ds.cues.map((c, i) => {
            const b = h("button", { type: "button", class: `dj-pad ${c != null ? `dj-pad-set dj-pad-${i}` : ""}`, title: c != null ? `Hot cue ${i + 1} at ${fmtTime(c)} — right-click to clear` : `Set hot cue ${i + 1}`, onClick: () => hotCue(d, i) }, c != null ? String(i + 1) : "");
            b.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              ds.cues[i] = null;
              save();
            });
            return b;
          }),
          knob({ value: ds.filter, onChange: (v) => {
            ds.filter = v;
            applyFx(d);
          }, label: "FILTER", size: 36, color: "#a855f7", title: "Filter — left low-pass, right high-pass" })
        ),
        h(
          "div",
          { class: "dj-col dj-grow" },
          h(
            "div",
            { class: "dj-section" },
            h("div", { class: "dj-fx-row" }, select),
            h(
              "div",
              { class: "dj-fx-row" },
              led("ON", ds.fx.on, "orange", () => {
                ds.fx.on = !ds.fx.on;
                fx();
              }, "dj-big"),
              knob({ value: ds.fx.str, onChange: (v) => {
                ds.fx.str = v;
                applyFx(d);
              }, label: "STR", center: 0, def: 0.6, color: "#f97316", title: "Effect strength" }),
              knob({ value: ds.fx.spd, onChange: (v) => {
                ds.fx.spd = v;
                applyFx(d);
              }, label: "SPD", center: 0, def: 0.4, color: "#f97316", title: ds.fxType === "echo" ? "Echo length (beats)" : "Speed" })
            )
          ),
          h(
            "div",
            { class: "dj-section dj-loop" },
            h("div", { class: "dj-section-title" }, "LOOP"),
            h(
              "div",
              { class: "dj-loop-grid" },
              led("/2", false, "green", () => {
                ds.loopBeats = Math.max(0.25, ds.loopBeats / 2);
                relen();
                save();
              }, "", "Halve loop"),
              led("X2", false, "green", () => {
                ds.loopBeats = Math.min(32, ds.loopBeats * 2);
                relen();
                save();
              }, "", "Double loop"),
              h("button", { type: "button", class: `dj-lcd dj-loop-len ${L.loop ? "dj-loop-on" : ""}`, title: "Loop on / off", onClick: () => {
                if (L.loopIn != null && L.loopOut != null) {
                  L.loop = !L.loop;
                  G.save();
                }
              } }, loopLabel),
              led("IN", L.loopIn != null && !L.loop, "green", () => {
                if (!deckTrack(d)) return;
                L.loopIn = now(d);
                L.loopOut = null;
                L.loop = false;
                G.save();
              }, "", "Loop in"),
              led("OUT", L.loop, "green", () => {
                if (L.loop) L.loop = false;
                else if (L.loopIn != null && now(d) > L.loopIn) {
                  L.loopOut = now(d);
                  L.loop = true;
                  seek(d, L.loopIn);
                } else toast("Press IN first, then OUT later in the song.");
                G.save();
              }, "", "Loop out"),
              led("AUTO", L.loop, "green", () => {
                if (!deckTrack(d)) return;
                if (L.loop) L.loop = false;
                else {
                  L.loopIn = now(d);
                  L.loopOut = L.loopIn + ds.loopBeats * beatLen(d);
                  L.loop = true;
                }
                G.save();
              }, "dj-small", "Beat-sized loop from here")
            )
          )
        )
      )
    ), d);
  }
  var P = 300;
  var glossUrl = "";
  function glossImage() {
    if (glossUrl) return glossUrl;
    const d = Math.round(P * 0.92), cv = document.createElement("canvas");
    cv.width = cv.height = d * 2;
    const g = cv.getContext("2d");
    if (!g || typeof g.createConicGradient !== "function") return "";
    g.scale(2, 2);
    const c = d / 2, conic = g.createConicGradient(-Math.PI / 2, c, c);
    for (const [a, o] of [[0, 0], [16, 0.08], [34, 0.42], [40, 0.62], [46, 0.4], [64, 0.08], [84, 0], [180, 0], [196, 0.06], [214, 0.34], [220, 0.48], [226, 0.3], [244, 0.06], [262, 0], [360, 0]]) conic.addColorStop(a / 360, `rgba(255,255,255,${o})`);
    g.fillStyle = conic;
    g.fillRect(0, 0, d, d);
    g.strokeStyle = "rgba(255,255,255,0.05)";
    g.lineWidth = 1;
    for (let r = 1.5; r < c; r += 3) {
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    }
    const glare = g.createRadialGradient(d * 0.3, d * 0.24, 0, d * 0.3, d * 0.24, d * 0.41);
    glare.addColorStop(0, "rgba(255,255,255,0.28)");
    glare.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glare;
    g.fillRect(0, 0, d, d);
    const ring2 = g.createRadialGradient(c, c, 0, c, c, c * Math.SQRT2);
    ring2.addColorStop(0, "rgba(0,0,0,0)");
    ring2.addColorStop(0.385, "rgba(0,0,0,0)");
    ring2.addColorStop(0.4, "rgba(0,0,0,1)");
    ring2.addColorStop(0.99, "rgba(0,0,0,1)");
    ring2.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = ring2;
    g.fillRect(0, 0, d, d);
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    glossUrl = cv.toDataURL("image/png");
    return glossUrl;
  }
  function platter(d) {
    const t = deckTrack(d), cover = t?.kind === "yt" ? thumb(t.id) : "";
    const s = P, c = s / 2;
    const dots = Array.from({ length: 72 }, (_, i) => {
      const a = i / 72 * Math.PI * 2;
      return `<circle cx="${(c + Math.cos(a) * c * 0.955).toFixed(2)}" cy="${(c + Math.sin(a) * c * 0.955).toFixed(2)}" r="1.3" fill="#9aa0a8"/>`;
    }).join("");
    let grooves = "";
    for (let r = c * 0.42; r < c * 0.9; r += 2.2) grooves += `<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="0.6"/>`;
    const label = cover ? `<image class="dj-record-artwork" href="${cover}" x="${c - c * 0.9}" y="${c - c * 0.9}" width="${c * 1.8}" height="${c * 1.8}" preserveAspectRatio="xMidYMid slice" clip-path="url(#jdc${d})"/><circle cx="${c}" cy="${c}" r="${c * 0.9}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="2"/><circle cx="${c}" cy="${c}" r="${c * 0.12}" fill="rgba(0,0,0,0.25)"/><rect x="${c - 2.5}" y="${c - c * 0.42}" width="5" height="${c * 0.24}" rx="2" fill="#fff" stroke="rgba(0,0,0,0.4)" stroke-width="0.6"/>` : `<circle class="dj-record-label" cx="${c}" cy="${c}" r="${c * 0.36}" fill="var(--dj-record-label, #d71920)"/><circle cx="${c}" cy="${c}" r="${c * 0.36}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/><rect x="${c - 2.5}" y="${c - c * 0.35}" width="5" height="${c * 0.27}" rx="2" fill="#fff"/><text class="dj-label-text" x="${c}" y="${c + c * 0.1}" text-anchor="middle" font-size="${c * 0.12}" font-weight="800" fill="#fff" font-family="Inter, Arial, sans-serif" letter-spacing="0.5">Jam</text><text class="dj-label-text dj-label-sub" x="${c}" y="${c + c * 0.24}" text-anchor="middle" font-size="${c * 0.1}" font-weight="800" fill="#ffd2d2" font-family="Inter, Arial, sans-serif" letter-spacing="2">DJ</text>`;
    const px = s * 0.98, py = s * 0.12, tube = `M${px} ${py} L${s * 1.03} ${s * 0.7} Q${s * 1.035} ${s * 0.76}, ${s * 1.005} ${s * 0.8}`;
    const el = h("div", { class: "dj-platter", "data-deck": d });
    el.innerHTML = `<svg viewBox="0 0 ${s} ${s}" class="jam-layer"><defs><radialGradient id="jpl${d}" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#e8eaed"/><stop offset="100%" stop-color="#8d939b"/></radialGradient></defs><circle cx="${c}" cy="${c}" r="${c - 1}" fill="url(#jpl${d})" stroke="#6b7078"/></svg><div class="dj-disc jam-layer"><svg viewBox="0 0 ${s} ${s}" style="display:block;width:100%;height:100%"><defs><radialGradient id="jvy${d}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#2a2a2e"/><stop offset="60%" stop-color="#111114"/><stop offset="100%" stop-color="#050506"/></radialGradient><clipPath id="jdc${d}"><circle cx="${c}" cy="${c}" r="${c * 0.9}"/></clipPath></defs>${dots}<circle cx="${c}" cy="${c}" r="${c * 0.92}" fill="var(--dj-record-fill, url(#jvy${d}))"/>${grooves}${label}</svg></div><svg viewBox="0 0 ${s} ${s}" class="jam-layer"><defs><linearGradient id="jsh${d}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="45%" stop-color="rgba(255,255,255,0)"/><stop offset="55%" stop-color="rgba(255,255,255,0)"/><stop offset="100%" stop-color="rgba(255,255,255,0.10)"/></linearGradient><radialGradient id="jlg${d}" cx="35%" cy="25%" r="75%"><stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="35%" stop-color="rgba(255,255,255,0.12)"/><stop offset="60%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><circle cx="${c}" cy="${c}" r="${c * 0.92}" fill="url(#jsh${d})"/>${cover ? "" : `<circle cx="${c}" cy="${c}" r="${c * 0.36}" fill="url(#jlg${d})"/>`}<circle cx="${c}" cy="${c}" r="${c * 0.035}" fill="#d9dce0" stroke="#555" stroke-width="0.5"/></svg><svg viewBox="0 0 ${s} ${s}" class="dj-arm-rest jam-layer" style="overflow:visible" aria-hidden="true"><rect x="${s * 1.012}" y="${s * 0.6}" width="${s * 0.036}" height="${s * 0.05}" rx="${s * 6e-3}" fill="#1c1d20" stroke="#7a8087" stroke-width="0.8"/><path d="M${s * 1.014} ${s * 0.6} Q${s * 1.03} ${s * 0.585}, ${s * 1.046} ${s * 0.6}" stroke="#b8bdc3" stroke-width="1.2" fill="none"/></svg><div class="dj-tonearm jam-layer" style="transform-origin:98% 12%;transform:rotate(0deg);will-change:transform;transition:transform 0.7s cubic-bezier(.2,.7,.2,1)"><svg viewBox="0 0 ${s} ${s}" class="dj-arm" style="display:block;overflow:visible;width:100%;height:100%"><defs><linearGradient id="jac${d}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8e949b"/><stop offset="45%" stop-color="#ffffff"/><stop offset="100%" stop-color="#7c828a"/></linearGradient><linearGradient id="jaw${d}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1b1c1f"/><stop offset="50%" stop-color="#4a4d53"/><stop offset="100%" stop-color="#151618"/></linearGradient></defs><circle class="dj-arm-board" cx="${px}" cy="${py}" r="${s * 0.085}" fill="#141517" stroke="#5a5f66" stroke-width="1.5"/><circle cx="${px}" cy="${py}" r="${s * 0.065}" fill="#202225" stroke="rgba(255,255,255,0.14)" stroke-width="1"/><line x1="${px}" y1="${py}" x2="${px - s * 4e-3}" y2="${py - s * 0.085}" stroke="url(#jac${d})" stroke-width="${s * 0.016}"/><rect class="dj-arm-weight" x="${px - s * 0.032}" y="${py - s * 0.12}" width="${s * 0.06}" height="${s * 0.06}" rx="${s * 8e-3}" fill="url(#jaw${d})" stroke="#6f747b" stroke-width="0.8"/><line x1="${px - s * 0.03}" y1="${py - s * 0.075}" x2="${px + s * 0.026}" y2="${py - s * 0.075}" stroke="#9aa0a8" stroke-width="0.8"/><circle cx="${px}" cy="${py}" r="${s * 0.03}" fill="#c9cdd2" stroke="#4d5157" stroke-width="1"/><path d="${tube}" stroke="#3a3d42" stroke-width="${s * 0.022}" fill="none" stroke-linecap="round"/><path class="dj-arm-tube" d="${tube}" stroke="url(#jac${d})" stroke-width="${s * 0.015}" fill="none" stroke-linecap="round"/><g transform="rotate(-14 ${s * 1.005} ${s * 0.8})"><rect class="dj-arm-head" x="${s * 0.983}" y="${s * 0.79}" width="${s * 0.044}" height="${s * 0.085}" rx="${s * 6e-3}" fill="#2a2c30" stroke="#8a9097" stroke-width="0.8"/><line x1="${s * 1.027}" y1="${s * 0.805}" x2="${s * 1.06}" y2="${s * 0.795}" stroke="#d4d8dd" stroke-width="${s * 7e-3}" stroke-linecap="round"/></g></svg></div><svg class="dj-hw-adapter" viewBox="0 0 40 40" aria-hidden="true" style="position:absolute;left:-2%;top:-2%;width:15%;height:15%;pointer-events:none"><defs><radialGradient id="jad${d}" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#c9cdd2"/><stop offset="100%" stop-color="#8d939b"/></radialGradient></defs><circle cx="20" cy="20" r="19" fill="#2a2c30"/><circle cx="20" cy="20" r="17" fill="url(#jad${d})" stroke="#7d838b" stroke-width="0.8"/><circle cx="20" cy="20" r="11" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.6"/><circle cx="20" cy="20" r="3.4" fill="#1b1c1f" stroke="#9aa0a8" stroke-width="0.8"/></svg><span class="dj-hw-target ${t ? "dj-on" : ""}" aria-hidden="true" style="left:0.5%;bottom:0.5%;width:8.5%;height:8.5%"></span>` + (glossImage() ? `<img class="dj-vinyl-gloss-img" src="${glossImage()}" alt="" draggable="false" style="position:absolute;left:4%;top:4%;width:92%;height:92%;pointer-events:none">` : "");
    let scrub = null;
    const angle = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
    };
    el.addEventListener("pointerdown", (e) => {
      if (!deckTrack(d) || e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      scrub = { a: angle(e), t: now(d) };
      el.style.cursor = "grabbing";
    });
    el.addEventListener("pointermove", (e) => {
      if (!scrub) return;
      let da = angle(e) - scrub.a;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > 0.03) {
        scrub.a = angle(e);
        scrub.t += da / (2 * Math.PI) * 1.8;
        seek(d, scrub.t);
      }
    });
    const end = () => {
      scrub = null;
      el.style.cursor = deckTrack(d) ? "grab" : "default";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.style.cursor = t ? "grab" : "default";
    return el;
  }
  function pitchText(p) {
    const pct2 = Math.round(p * 1e3) / 10;
    return `${pct2 > 0 ? "+" : ""}${pct2.toFixed(1)}%`;
  }
  function turntable(d) {
    const ds = jam().decks[d], t = deckTrack(d), L = live2[d];
    const rangeBtn = h("button", { type: "button", class: `dj-lcd dj-range ${Math.abs(ds.pitch) > 5e-4 ? "dj-range-moved" : ""}`, title: `Pitch ${pitchText(ds.pitch)} (±8%)` }, h("b", null, pitchText(ds.pitch)), h("small", null, "±8"));
    const main = h(
      "div",
      { class: "dj-tt-main" },
      platter(d),
      h(
        "div",
        { class: "dj-tt-side" },
        h("span", { class: `dj-hw-lamp ${L.playing ? "dj-on" : ""}`, "data-deck": d, title: L.playing ? "Playing" : "Stopped" }),
        h("button", { type: "button", class: "dj-mini", title: "Eject", disabled: !t || L.playing, onClick: () => eject(d) }, ic("eject", 11)),
        rangeBtn,
        vfader({ value: 0.5 + ds.pitch / PITCH_RANGE / 2, onChange: (v) => {
          ds.pitch = (v - 0.5) * 2 * PITCH_RANGE;
          applyRate(d);
          rangeBtn.querySelector("b").textContent = pitchText(ds.pitch);
        }, height: 150, def: 0.5, invert: true, cls: "dj-pitch", title: "Pitch ±8% (double-click to reset)", ticks: 9 })
      )
    );
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const size = Math.round(Math.max(130, Math.min(320, height - 4, (width - 52) / 1.09)));
      const p = main.querySelector(".dj-platter");
      if (p) {
        p.style.width = p.style.height = `${size}px`;
        p.style.marginRight = `${size * 0.09}px`;
      }
    }).observe(main);
    return dropTarget(h(
      "div",
      { class: `dj-tt dj-panel dj-deck-turntable dj-tt-furnished ${d === "B" ? "dj-mirror" : ""}`, title: t ? null : "Drop a song here, then press play" },
      h("div", { class: "dj-reference-deck-header", "aria-hidden": "true" }, h("span", null, "Jam ", h("b", null, "DIRECT DRIVE")), h("span", { class: "dj-reference-speed" }, "33 ", h("i"), " 45 ", h("i"))),
      main,
      h(
        "div",
        { class: "dj-transport" },
        h("button", { type: "button", class: "dj-tbtn dj-cue", disabled: !t, title: "CUE", onClick: () => cue(d) }, "CUE"),
        h("button", { type: "button", class: "dj-tbtn", disabled: !t, title: "Stop", onClick: () => stop(d) }, ic("square", 16)),
        h("button", { type: "button", class: `dj-tbtn dj-play ${L.playing ? "dj-playing" : ""}`, "data-deck": d, disabled: !t, title: L.playing ? "Pause" : "Play", "aria-label": "Play / pause", onClick: () => toggle3(d) }, ic(L.playing ? "pause" : "play", 22)),
        h("button", { type: "button", class: `dj-mini dj-keylock ${ds.keylock ? "dj-on dj-on-blue" : ""}`, title: "Key lock — keep pitch when changing tempo", onClick: () => {
          ds.keylock = !ds.keylock;
          applyRate(d);
          save();
        } }, ic("lock", 10)),
        h("button", { type: "button", class: "dj-tbtn dj-sync", disabled: !t, title: `Match tempo to deck ${other(d)}`, onClick: (e) => {
          const ok = sync(d);
          e.currentTarget.classList.toggle("dj-on", ok);
          e.currentTarget.classList.toggle("dj-on-blue", ok);
        } }, "SYNC")
      )
    ), d);
  }
  function channel(d) {
    const ds = jam().decks[d], full = deckTrack(d)?.kind !== "yt";
    const set = () => applyFx(d);
    return h(
      "div",
      { class: `dj-ch ${full ? "" : "dj-limited"}`, title: full ? null : "This YouTube video plays directly — only volume and the crossfader reach it" },
      knob({ value: ds.gain, onChange: (v) => {
        ds.gain = v;
        set();
      }, label: "GAIN", size: 24, color: "#e5e7eb", title: "Trim ±12 dB" }),
      ["high", "mid", "low"].map((b) => knob({ value: ds.eq[b], onChange: (v) => {
        ds.eq[b] = v;
        set();
      }, label: b.toUpperCase(), size: 26, color: ds.eq[b] < 0.5 ? "#ef4444" : "#22c55e", title: `${b.toUpperCase()} EQ — full left kills the band` }))
    );
  }
  function strip(d) {
    const j = jam();
    return h(
      "div",
      { class: "dj-strip" },
      h("button", { type: "button", class: "dj-mini dj-pfl", title: "Pre-listen needs a second audio output (headphones) — in AIHub DJ desktop", disabled: true }, ic("headphones", 10)),
      vfader({ value: j.decks[d].vol, onChange: (v) => {
        j.decks[d].vol = v;
        applyMix();
      }, height: 84, def: 0.8, title: `Deck ${d} volume` })
    );
  }
  function mixer() {
    const j = jam(), video = j.view === "video";
    const monitor = h(
      "div",
      { class: "dj-video", "data-jam-video": "main" },
      DECKS.some((d) => deckTrack(d)?.kind === "yt") ? null : h("span", { class: "jam-video-idle" }, "Load a song — YouTube videos and music videos play here"),
      h("button", { type: "button", class: "dj-video-size", title: "Big screen", onClick: () => {
        const d = DECKS.filter(ytOn).sort((a, b) => outputVolume(b) - outputVolume(a))[0];
        if (d) void slots[d].requestFullscreen?.();
        else toast("Load a YouTube video first.");
      } }, ic("maximize", 12))
    );
    return h(
      "div",
      { class: `dj-mixer dj-panel ${video ? "dj-video-up" : ""}` },
      h(
        "div",
        { class: "dj-mixer-tabs" },
        h("span", null, "CH A"),
        h(
          "div",
          { class: "dj-mixer-switch", role: "tablist" },
          h("button", { type: "button", role: "tab", "aria-selected": String(!video), class: video ? "" : "on", onClick: () => {
            j.view = "mixer";
            save();
          } }, "MIXER"),
          h("button", { type: "button", role: "tab", "aria-selected": String(video), class: video ? "on" : "", onClick: () => {
            j.view = "video";
            save();
          } }, "VIDEO")
        ),
        h("span", null, "CH B")
      ),
      video ? h("div", { class: "dj-mixer-video" }, monitor) : h(
        "div",
        { class: "dj-mixer-body" },
        channel("A"),
        h(
          "div",
          { class: "dj-mixer-center" },
          h("div", { class: "dj-meters" }, vu("A", 16, false, 96), h("div", { class: "dj-master-meters" }, vu("L", 16, false, 96), vu("R", 16, false, 96)), vu("B", 16, false, 96)),
          knob({ value: j.master, onChange: (v) => {
            j.master = v;
            applyMix();
          }, label: "MASTER", size: 30, center: 0, def: 0.85, color: "#22c55e" }),
          h("div", { class: "dj-section-title dj-tight" }, "HEADPHONES"),
          h(
            "div",
            { class: "dj-row dj-limited", title: "Headphone cueing needs a second audio output — in AIHub DJ desktop" },
            knob({ value: 0.8, onChange: () => void 0, label: "VOL", size: 26, center: 0, def: 0.8, disabled: true }),
            knob({ value: 0, onChange: () => void 0, label: "CUE MIX", size: 26, center: 0, def: 0, disabled: true })
          )
        ),
        channel("B")
      ),
      h(
        "div",
        { class: "dj-mixer-faders" },
        strip("A"),
        h("div", { class: "dj-mixer-logo" }, h("span", { class: "dj-logo-ai" }, "Jam"), h("span", { class: "dj-logo-dj" }, "DJ"), h("small", null, "2-DECK MIX ENGINE")),
        strip("B")
      ),
      h(
        "div",
        { class: "dj-xfader" },
        h("span", null, "◂ A"),
        hfader({ value: j.xfade, onChange: (v) => {
          j.xfade = v;
          applyMix();
        }, width: 130, title: "Crossfader (double-click to centre)" }),
        h("span", null, "B ▸"),
        h("button", { type: "button", class: `dj-mini dj-fade-btn ${fading ? "dj-on dj-on-blue" : ""}`, title: fading ? "Stop the fade here" : "Fade across to the other deck over 8 s", onClick: () => fadeTo(j.xfade < 0.5 ? "B" : "A") }, ic("swap", 10))
      )
    );
  }
  function rowsNow() {
    const j = jam();
    const all = j.source === "music" ? [...files.values()].map((f) => f.track) : j.source === "youtube" ? searchResults ?? j.library : j.library;
    const q2 = filterText.toLowerCase();
    return q2 && !(j.source === "youtube") ? all.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q2)) : all;
  }
  function coverflow(rows) {
    const size = 96, k = size / 96, span = 4;
    const index = Math.max(0, rows.findIndex((t) => t.id === selected4));
    const box = h("div", { class: "dj-coverflow", style: `--cf:${size}px`, title: "Scroll to flip through songs" });
    for (let o = -span; o <= span; o++) {
      const t = rows[index + o];
      if (!t) continue;
      const abs = Math.abs(o), x = o === 0 ? 0 : Math.sign(o) * (0.82 + 0.6 * (abs - 1)) * size;
      const tile = (mirror) => t.kind === "yt" ? h("img", { class: "dj-cf-img", src: thumb(t.id), alt: "", draggable: "false" }) : h("div", { class: "dj-cf-ph", style: `background:hsl(${[...t.title].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360} 45% 32%)` }, mirror ? null : [h("b", null, t.title), h("small", null, t.artist)]);
      const item = h(
        "div",
        { class: `dj-cf-item ${o === 0 ? "dj-cf-center" : ""}`, style: `transform:translateX(calc(-50% + ${x}px)) translateZ(${o === 0 ? 40 * k : 0}px) rotateY(${o === 0 ? 0 : o < 0 ? 52 : -52}deg) scale(${1 - abs * 0.03});z-index:${10 - abs};opacity:${abs === span ? 0.5 : 1}`, draggable: "true", onClick: () => {
          selected4 = t.id;
          G.save();
        }, onDblclick: () => void loadTrack(!live2.A.playing ? "A" : "B", t) },
        tile(false),
        h("div", { class: "dj-cf-mirror", "aria-hidden": "true" }, tile(true))
      );
      item.addEventListener("dragstart", (e) => e.dataTransfer?.setData("application/x-jam-track", t.id));
      box.append(item);
    }
    let acc = 0;
    box.addEventListener("wheel", (e) => {
      e.preventDefault();
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const n = Math.trunc(acc / 100);
      if (n) {
        acc -= n * 100;
        const next = rows[clamp(index + n, 0, rows.length - 1)];
        if (next) {
          selected4 = next.id;
          G.save();
        }
      }
    }, { passive: false });
    return box;
  }
  function library() {
    const j = jam();
    const node = (label, icon2, on, act, opts = {}) => h(
      "div",
      { class: `dj-node ${on ? "dj-node-on" : ""}`, style: "padding-left:6px", title: opts.title, onClick: act },
      opts.caret ? h("button", { type: "button", class: "dj-caret", "aria-label": "Expand", onClick: (e) => {
        e.stopPropagation();
        act();
      } }, ic("chevron", 10)) : null,
      icon2,
      h("span", { class: "dj-node-name" }, label),
      opts.count ? h("span", { class: "dj-side-n" }, String(opts.count)) : null
    );
    const pick = () => pickFiles(false);
    const tree = h("div", { class: "dj-tree" }, h(
      "div",
      { class: "dj-tree-scroll" },
      h(
        "div",
        { class: "dj-tree-group" },
        h("div", { class: "dj-tree-title" }, "Computer"),
        node("Music", ic("music", 13, "dj-ic-music"), j.source === "music", () => {
          j.source = "music";
          save();
          if (!files.size) pick();
        }, { caret: true, count: files.size, title: "Songs from your computer (this session)" }),
        node("Desktop", ic("monitor", 13), false, pick, { caret: true, title: "Pick songs from your Desktop" }),
        node("Downloads", ic("download", 13), false, pick, { caret: true, title: "Pick songs from Downloads" }),
        node("Documents", ic("file", 13), false, pick, { caret: true, title: "Pick songs from Documents" }),
        node("Videos", ic("video", 13, "dj-ic-video"), false, pick, { caret: true, title: "Pick music videos" }),
        node("Home", ic("home", 13), false, pick, { caret: true, title: "Pick songs from your user folder" })
      ),
      h(
        "div",
        { class: "dj-tree-group" },
        h("div", { class: "dj-tree-title" }, "Drives"),
        node("C:", ic("drive", 13), false, () => pickFiles(true), { caret: true, title: "Pick a folder with music in it" })
      ),
      h(
        "div",
        { class: "dj-tree-group" },
        h("div", { class: "dj-tree-title" }, "Online"),
        node("YouTube", ic("youtube", 13, "dj-ic-yt"), j.source === "youtube", () => {
          j.source = "youtube";
          save();
          setTimeout(() => document.querySelector(".jam-dj .dj-search input")?.focus(), 30);
        }, { title: "Search YouTube for anything" }),
        node("My YouTube songs", ic("list", 13, "dj-ic-fav"), j.source === "saved", () => {
          j.source = "saved";
          save();
        }, { count: j.library.length, title: "Songs you loaded or sent from YouTube" })
      ),
      h(
        "div",
        { class: "dj-tree-group" },
        h("div", { class: "dj-tree-title" }, "My Folders", h("button", { type: "button", class: "dj-icon-btn", title: "Add a music folder", onClick: () => pickFiles(true) }, ic("folderPlus", 13))),
        h("div", { class: "dj-tree-hint" }, "Add any folder with music in it")
      )
    ));
    const rows = rowsNow();
    const yt = j.source === "youtube";
    const input = h("input", { placeholder: yt ? "Search YouTube — type anything, press Enter" : j.source === "music" ? "Filter Music — Enter searches all sub-folders" : "Filter your YouTube songs, or paste a link", value: yt ? searchQuery || "" : filterText, "data-key": `jam-search-${j.source}`, "aria-label": yt ? "Search YouTube" : "Filter songs" });
    input.addEventListener("input", () => {
      if (!yt) {
        filterText = input.value;
        G.save();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const v = input.value.trim();
      if (yt) {
        void searchYouTube(v);
        return;
      }
      if (youtubeId(v)) {
        addToLibrary(youtubeId(v));
        filterText = "";
        G.save();
        return;
      }
      if (j.source === "saved" && v) {
        j.source = "youtube";
        void searchYouTube(v);
      }
    });
    const count = h("span", { class: "dj-count" }, searching && yt ? ic("loader", 12, "dj-spin") : null, yt ? searching ? `Searching “${searchQuery}”…` : searchResults ? `${rows.length} results` : `${rows.length} saved` : `${rows.length} ${j.source === "music" ? "files" : "songs"}`);
    const search2 = h(
      "div",
      { class: "dj-search" },
      ic("search", 13),
      input,
      (yt ? searchQuery : filterText) ? h("button", { type: "button", class: "dj-icon-btn", title: "Clear", onClick: () => {
        if (yt) {
          searchQuery = "";
          searchResults = null;
        } else filterText = "";
        G.save();
      } }, ic("x", 12)) : null,
      h("button", { type: "button", class: `dj-icon-btn dj-covers-btn ${j.covers ? "on" : ""}`, title: "Cover flow", onClick: () => {
        j.covers = !j.covers;
        save();
      } }, ic("images", 13)),
      yt && searchResults?.length ? h("button", { type: "button", class: "dj-icon-btn dj-queue-all", title: "Add every result to the set list", onClick: () => {
        for (const t of searchResults) {
          addToLibrary(t.id, t.title, t.artist, t.duration);
          j.queue.push(t.id);
        }
        save();
        toast(`${searchResults.length} songs added to the set.`);
      } }, ic("listPlus", 13)) : null,
      count
    );
    const empty = yt ? searchError ? searchError : searching ? "" : 'Type anything — a song, an artist, a style ("afrobeats 2026", "90s r&b", "gospel choir") — and press Enter. Results play right here on the decks.' : j.source === "music" ? "Add songs from your computer (Music, Desktop, Downloads… on the left), or drop audio files here." : "Songs you load or send from YouTube are kept here. Search YouTube on the left, or paste a link above.";
    const tbody = h(
      "div",
      { class: "dj-tbody", "data-scroll": "jam-tbody" },
      rows.length ? rows.slice(0, 300).map((t) => {
        const tr = h(
          "div",
          { class: `dj-tr ${t.id === selected4 ? "dj-sel" : ""}`, draggable: "true", onClick: () => {
            selected4 = t.id;
            G.save();
          }, onDblclick: () => void loadTrack(!live2.A.playing ? "A" : "B", t), title: "Drag onto a deck, or double-click to load" },
          h("span", { class: "dj-td dj-c-title" }, ic(t.kind === "yt" ? "youtube" : "music", 11, t.kind === "yt" ? "dj-note dj-ic-yt" : "dj-note"), t.title),
          h("span", { class: "dj-td dj-c-artist" }, t.artist),
          h("span", { class: "dj-td dj-c-album" }, t.album ?? ""),
          h("span", { class: "dj-td dj-c-length" }, t.duration ? fmtTime(t.duration, false) : ""),
          h("span", { class: "dj-td dj-c-bpm" }, t.bpm ? t.bpm.toFixed(1) : ""),
          h("span", { class: "dj-td dj-c-key" }, ""),
          h(
            "span",
            { class: "dj-td dj-c-act" },
            h("button", { type: "button", title: "Load on deck A", onClick: (e) => {
              e.stopPropagation();
              void loadTrack("A", t);
            } }, "A"),
            h("button", { type: "button", title: "Load on deck B", onClick: (e) => {
              e.stopPropagation();
              void loadTrack("B", t);
            } }, "B"),
            h("button", { type: "button", title: "Add to the set list", onClick: (e) => {
              e.stopPropagation();
              if (t.kind === "yt") addToLibrary(t.id, t.title, t.artist, t.duration);
              j.queue.push(t.id);
              save();
            } }, ic("plus", 11)),
            j.source !== "youtube" ? h("button", { type: "button", title: "Remove", onClick: (e) => {
              e.stopPropagation();
              if (t.kind === "yt") j.library = j.library.filter((x) => x.id !== t.id);
              else {
                URL.revokeObjectURL(files.get(t.id).url);
                files.delete(t.id);
              }
              j.queue = j.queue.filter((x) => x !== t.id);
              save();
            } }, ic("x", 11)) : null
          )
        );
        tr.addEventListener("dragstart", (e) => e.dataTransfer?.setData("application/x-jam-track", t.id));
        return tr;
      }) : h("div", { class: "dj-empty" }, empty)
    );
    const browser = h(
      "div",
      { class: "dj-browser", tabIndex: 0 },
      search2,
      j.covers ? coverflow(rows) : null,
      h(
        "div",
        { class: "dj-table" },
        h("div", { class: "dj-thead" }, ["Title", "Artist", "Album", "Length", "Bpm", "Key"].map((x) => h("button", { type: "button", class: `dj-th dj-c-${x.toLowerCase()}` }, x)), h("span", { class: "dj-th dj-c-act" })),
        tbody
      )
    );
    browser.addEventListener("dragover", (e) => e.preventDefault());
    browser.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
      else {
        const id = youtubeId(e.dataTransfer?.getData("text/plain") ?? "");
        if (id) addToLibrary(id);
      }
    });
    const side = h(
      "div",
      { class: "dj-side" },
      h(
        "div",
        { class: "dj-side-head" },
        h("button", { type: "button", class: "dj-side-tab on", title: "Set list — the songs Automix plays next" }, ic("list", 12), " SET ", h("span", { class: "dj-side-n" }, String(j.queue.length))),
        h("button", { type: "button", class: "dj-icon-btn", title: "Clear the set", onClick: () => {
          j.queue = [];
          save();
        } }, ic("trash", 12))
      ),
      h(
        "div",
        { class: "dj-side-body", style: "display:flex" },
        h("button", { type: "button", class: `dj-automix ${j.automix ? "dj-on dj-on-green" : ""}`, title: "Automix — crossfade through the set as each song ends", onClick: () => {
          j.automix = !j.automix;
          save();
        } }, ic("shuffle", 13), " AUTOMIX"),
        h(
          "div",
          { class: "dj-side-list", "data-scroll": "jam-set" },
          j.queue.length ? j.queue.map((id, i) => {
            const t = trackOf(id);
            const item = h("div", { class: "dj-side-item", draggable: "true" }, h("span", { class: "dj-side-i" }, String(i + 1)), h("div", { class: "dj-side-t" }, h("b", null, t?.title ?? "Song from an earlier session"), h("small", null, t?.artist ?? "")), h("button", { type: "button", class: "dj-icon-btn", title: "Remove", onClick: () => {
              j.queue.splice(i, 1);
              save();
            } }, ic("x", 11)));
            item.addEventListener("dragstart", (e) => e.dataTransfer?.setData("application/x-jam-track", id));
            return item;
          }) : h("div", { class: "dj-side-empty" }, ic("list", 22), h("p", null, "Drag songs here or press + on a row to build a set. Turn on Automix and Jam crossfades through it as each song ends."))
        )
      )
    );
    side.addEventListener("dragover", (e) => e.preventDefault());
    side.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData("application/x-jam-track");
      if (id && trackOf(id)) {
        const t = trackOf(id);
        if (t.kind === "yt") addToLibrary(t.id, t.title, t.artist, t.duration);
        j.queue.push(id);
        save();
      }
    });
    return h("div", { class: "dj-library dj-panel" }, tree, browser, side);
  }
  var DESIGN_W = 1300;
  var DESIGN_H = 892;
  var sized = /* @__PURE__ */ new WeakSet();
  function fit(host) {
    const root = host.querySelector(".jam-dj");
    const w = host.clientWidth, hh = host.clientHeight;
    if (!root || !w || !hh) return;
    root.style.zoom = String(Math.max(0.4, Math.min(1, w / DESIGN_W, hh / DESIGN_H) * uiZoom));
  }
  registerTool({
    id: "jam",
    name: "Jam",
    short: "Jam",
    width: 1320,
    height: 940,
    icon: '<rect x="2" y="5" width="30" height="24" rx="4" fill="#d4d7db"/><circle cx="13" cy="17" r="9" fill="#141518"/><circle cx="13" cy="17" r="3.4" fill="#d71920"/><path d="M27 8v13" stroke="#3b3f46" stroke-width="2.2" stroke-linecap="round"/><path d="M25 21l-5 4" stroke="#3b3f46" stroke-width="2.2" stroke-linecap="round"/>',
    draw(host) {
      jam();
      host.append(h(
        "div",
        { class: "jam-dj" },
        topBar(),
        h("div", { class: "dj-row-clocks" }, deckClock("A"), h("div", { class: "dj-panel dj-zoom" }, h("canvas", { class: "dj-zoomwave" })), deckClock("B")),
        h("div", { class: "dj-row-info" }, deckInfo("A"), h("div", { class: "dj-info-gap" }), deckInfo("B")),
        h("div", { class: "dj-row-decks" }, deckPads("A"), turntable("A"), mixer(), turntable("B"), deckPads("B")),
        library()
      ));
      fit(host);
      if (!sized.has(host) && typeof ResizeObserver !== "undefined") {
        sized.add(host);
        new ResizeObserver(() => fit(host)).observe(host);
      }
      paintLive();
    }
  });
  addEventListener("keydown", (e) => {
    const root = document.querySelector(".jam-dj");
    if (!root || !root.offsetParent || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const win = root.closest(".app-window");
    if (win && [...document.querySelectorAll("#desktop .app-window:not(.hidden)")].some((w) => w !== win && Number(getComputedStyle(w).zIndex) > Number(getComputedStyle(win).zIndex))) return;
    const tgt = e.target;
    if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
    const j = jam(), k = e.key.toLowerCase();
    const keys = {
      q: () => toggle3("A"),
      w: () => cue("A"),
      p: () => toggle3("B"),
      o: () => cue("B"),
      s: () => {
        if (!sync("B")) sync("A");
      },
      1: () => hotCue("A", 0),
      2: () => hotCue("A", 1),
      3: () => hotCue("A", 2),
      8: () => hotCue("B", 0),
      9: () => hotCue("B", 1),
      0: () => hotCue("B", 2),
      arrowleft: () => {
        if (e.shiftKey) fadeTo("A");
        else {
          j.xfade = clamp01(j.xfade - 0.05);
          applyMix();
          save();
        }
      },
      arrowright: () => {
        if (e.shiftKey) fadeTo("B");
        else {
          j.xfade = clamp01(j.xfade + 0.05);
          applyMix();
          save();
        }
      },
      arrowdown: () => {
        j.xfade = 0.5;
        applyMix();
        save();
      },
      m: () => fadeTo(j.xfade < 0.5 ? "B" : "A"),
      a: () => {
        j.automix = !j.automix;
        save();
      },
      z: () => fire("horn"),
      x: () => fire("siren"),
      c: () => fire("laser"),
      v: () => fire("riser"),
      b: () => fire("impact"),
      n: () => fire("clap"),
      g: () => fire("rewind"),
      h: () => fire("tom")
    };
    const fn = keys[k];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });
  function decorateChrome() {
    const bar = document.querySelector(".browser-app .browser-toolbar");
    if (!bar) return;
    const b = G.CorpDesk?.browserState?.();
    const address = b?.tabs?.[b.active]?.url ?? bar.querySelector("#browserAddress")?.value ?? "";
    const id = youtubeId(address);
    let box = bar.querySelector(".jam-send");
    if (!id) {
      box?.remove();
      return;
    }
    if (box?.dataset.id === id) return;
    box?.remove();
    box = h(
      "span",
      { class: "jam-send" },
      h("button", { type: "button", title: "Send this video to Jam, deck A", onClick: () => sendToJam(address, void 0, "A") }, "🎧 Jam A"),
      h("button", { type: "button", title: "Send this video to Jam, deck B", onClick: () => sendToJam(address, void 0, "B") }, "Jam B")
    );
    box.dataset.id = id;
    bar.append(box);
  }
  new MutationObserver(decorateChrome).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(decorateChrome, 1e3);
  var _a2;
  Object.assign((_a2 = G).CorpDesk || (_a2.CorpDesk = {}), { sendToJam, searchYouTube });

  // itlab/recorder.ts
  var canRecord = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function" && !!navigator.mediaDevices?.getDisplayMedia;
  var canRecordCamera = () => !!navigator.mediaDevices?.getUserMedia;
  async function videoFor(stream) {
    const el = document.createElement("video");
    el.srcObject = stream;
    el.muted = true;
    el.playsInline = true;
    await el.play();
    await new Promise((resolve) => {
      let tries = 0;
      const check = () => {
        if (el.videoWidth > 0 && tries > 2 || tries > 60) resolve();
        else {
          tries++;
          setTimeout(check, 16);
        }
      };
      check();
    });
    return el;
  }
  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      return null;
    }
    try {
      const v = await videoFor(stream);
      if (!v.videoWidth) return null;
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      v.srcObject = null;
      return c.toDataURL("image/png");
    } catch {
      return null;
    } finally {
      for (const t of stream.getTracks()) t.stop();
    }
  }
  async function saveCapture(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
    return `Saved to Downloads as ${name}`;
  }
  async function startRecording(opts) {
    if (!canRecord()) return null;
    let screen;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: true });
    } catch {
      return null;
    }
    const open2 = [screen];
    const stopAll = () => {
      for (const s of open2) for (const t of s.getTracks()) t.stop();
    };
    let screenVideo;
    try {
      screenVideo = await videoFor(screen);
    } catch {
      stopAll();
      return null;
    }
    let cam = null;
    if (opts.camera && canRecordCamera()) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        open2.push(s);
        cam = await videoFor(s);
      } catch {
        cam = null;
      }
    }
    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      open2.push(mic);
    } catch {
      mic = null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = screenVideo.videoWidth || 1280;
    canvas.height = screenVideo.videoHeight || 720;
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) {
      stopAll();
      return null;
    }
    const out = canvas.captureStream(30);
    const system = screen.getAudioTracks();
    let audioCtx = null;
    let hasAudio = false;
    if (mic || system.length) {
      try {
        audioCtx = new AudioContext();
        const mix = audioCtx.createMediaStreamDestination();
        if (mic) audioCtx.createMediaStreamSource(mic).connect(mix);
        if (system.length) {
          const g = audioCtx.createGain();
          g.gain.value = 0.6;
          audioCtx.createMediaStreamSource(new MediaStream(system)).connect(g);
          g.connect(mix);
        }
        for (const t of mix.stream.getAudioTracks()) out.addTrack(t);
        hasAudio = true;
      } catch {
        audioCtx = null;
        if (mic) {
          for (const t of mic.getAudioTracks()) out.addTrack(t);
          hasAudio = true;
        }
      }
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(out, mime ? { mimeType: mime } : void 0);
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.start(1e3);
    const started2 = performance.now();
    let corner = opts.corner;
    let running = true;
    const paint2 = () => {
      if (!running) return;
      ctx2.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      if (cam && cam.videoWidth) {
        const size = Math.round(Math.min(canvas.width, canvas.height) * 0.18);
        const m = Math.round(size * 0.16);
        const x = corner.endsWith("right") ? canvas.width - size - m : m;
        const y = corner.startsWith("bottom") ? canvas.height - size - m : m;
        const r = size / 2;
        ctx2.save();
        ctx2.shadowColor = "rgba(0,0,0,0.45)";
        ctx2.shadowBlur = Math.round(size * 0.08);
        ctx2.beginPath();
        ctx2.arc(x + r, y + r, r, 0, Math.PI * 2);
        ctx2.fillStyle = "#000";
        ctx2.fill();
        ctx2.restore();
        ctx2.save();
        ctx2.beginPath();
        ctx2.arc(x + r, y + r, r, 0, Math.PI * 2);
        ctx2.clip();
        const side = Math.min(cam.videoWidth, cam.videoHeight);
        ctx2.drawImage(cam, (cam.videoWidth - side) / 2, (cam.videoHeight - side) / 2, side, side, x, y, size, size);
        ctx2.restore();
        ctx2.save();
        ctx2.beginPath();
        ctx2.arc(x + r, y + r, r - 1, 0, Math.PI * 2);
        ctx2.lineWidth = Math.max(2, Math.round(size * 0.02));
        ctx2.strokeStyle = "rgba(255,255,255,0.85)";
        ctx2.stroke();
        ctx2.restore();
      }
    };
    const timer2 = window.setInterval(paint2, 1e3 / 30);
    let stopped = null;
    const finish = () => {
      stopped ?? (stopped = new Promise((resolve) => {
        running = false;
        clearInterval(timer2);
        const done2 = () => {
          stopAll();
          for (const t of out.getTracks()) t.stop();
          void audioCtx?.close().catch(() => void 0);
          screenVideo.srcObject = null;
          if (cam) cam.srcObject = null;
          resolve(chunks.length ? new Blob(chunks, { type: mime ?? "video/webm" }) : null);
        };
        if (rec.state === "inactive") done2();
        else {
          rec.onstop = done2;
          rec.stop();
        }
      }));
      return stopped;
    };
    for (const t of screen.getVideoTracks()) t.addEventListener("ended", () => {
      if (running) void finish().then(opts.onEnded);
    });
    return {
      stop: finish,
      elapsed: () => Math.floor((performance.now() - started2) / 1e3),
      hasAudio: () => hasAudio,
      hasCamera: () => cam !== null,
      hasSystemAudio: () => system.length > 0,
      setCameraCorner: (c) => {
        corner = c;
      }
    };
  }

  // itlab/pen.ts
  var I2 = {
    pen: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
    highlight: '<path d="M9 11l6-6 4 4-6 6"/><path d="M9 11l-3 3v3h3l3-3"/><path d="M4 21h9"/>',
    arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
    box: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    eraser: '<path d="M16 4l5 5-9.5 9.5H7L3 14.5z"/><path d="M10 10l5 5"/><path d="M11.5 18.5H21"/>',
    grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    clear: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    record: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>',
    video: '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
    videoOff: '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/><path d="M3 3l18 18"/>',
    corner: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M4 4l6 6"/><path d="M20 20l-6-6"/>',
    pointer: '<path d="M5 3l14 8-6 2 4 7-3 1.5-4-7-5 4z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  var icon = (name) => {
    const s = document.createElement("span");
    s.className = "pen-ic";
    s.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I2[name] ?? ""}</svg>`;
    return s;
  };
  var TOOLS = [
    { id: "pen", title: "Pen" },
    { id: "highlight", title: "Highlighter: translucent, so the text stays readable" },
    { id: "arrow", title: "Arrow" },
    { id: "box", title: "Box" },
    { id: "eraser", title: "Eraser" }
  ];
  var COLORS = ["#e81123", "#ffb900", "#16c60c", "#0078d4", "#ffffff", "#000000"];
  var POS_KEY = "corpdesk-pen-toolbar";
  var CAM_KEY = "corpdesk-pen-camera";
  var read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  var write = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
    }
  };
  var stamp = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  var clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  var nextFrame = () => new Promise((r) => {
    let done2 = false;
    const go = () => {
      if (!done2) {
        done2 = true;
        r();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 120);
  });
  var close = null;
  function toggleScreenPen() {
    if (close) {
      close();
      return;
    }
    let tool = "pen";
    let color = COLORS[0];
    let size = 3;
    let drawing = false;
    let strokes = [];
    const redo = [];
    let current = null;
    let recorder2 = null;
    let tick = 0;
    let camera = (read(CAM_KEY) ?? (canRecordCamera() ? "1" : "0")) === "1";
    let corner = "bottom-right";
    const canvas = h("canvas", { class: "pen-canvas" });
    const overlay = h("div", { class: "pen-sheet click-through", "data-label": "Drawing: clicks go to the pen. Press Esc to use the desktop." }, canvas);
    const bar = h("div", { class: "pen-bar", role: "toolbar", "aria-label": "Screen Pen" });
    const saved = (() => {
      try {
        return JSON.parse(read(POS_KEY) ?? "");
      } catch {
        return null;
      }
    })();
    const place = (p) => {
      bar.style.left = `${Math.min(window.innerWidth - 120, Math.max(0, p.x))}px`;
      bar.style.top = `${Math.min(window.innerHeight - 50, Math.max(0, p.y))}px`;
    };
    place(saved && typeof saved.x === "number" ? saved : { x: Math.round(window.innerWidth / 2 - 330), y: 16 });
    function sizeCanvas2() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint2();
    }
    function drawStroke(ctx2, s) {
      const first2 = s.points[0], last = s.points[s.points.length - 1];
      if (!first2 || !last) return;
      ctx2.save();
      ctx2.strokeStyle = s.color;
      ctx2.fillStyle = s.color;
      ctx2.lineCap = "round";
      ctx2.lineJoin = "round";
      ctx2.lineWidth = s.size;
      if (s.tool === "highlight") {
        ctx2.globalAlpha = 0.3;
        ctx2.lineWidth = s.size * 5 + 4;
        ctx2.lineCap = "square";
      }
      if (s.tool === "eraser") {
        ctx2.globalCompositeOperation = "destination-out";
        ctx2.lineWidth = s.size * 6 + 12;
      }
      if (s.tool === "box") ctx2.strokeRect(first2.x, first2.y, last.x - first2.x, last.y - first2.y);
      else if (s.tool === "arrow") {
        const a = Math.atan2(last.y - first2.y, last.x - first2.x), head = 12 + s.size * 2;
        ctx2.beginPath();
        ctx2.moveTo(first2.x, first2.y);
        ctx2.lineTo(last.x - Math.cos(a) * head * 0.6, last.y - Math.sin(a) * head * 0.6);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.moveTo(last.x, last.y);
        ctx2.lineTo(last.x - head * Math.cos(a - Math.PI / 7), last.y - head * Math.sin(a - Math.PI / 7));
        ctx2.lineTo(last.x - head * Math.cos(a + Math.PI / 7), last.y - head * Math.sin(a + Math.PI / 7));
        ctx2.closePath();
        ctx2.fill();
      } else {
        ctx2.beginPath();
        ctx2.moveTo(first2.x, first2.y);
        for (let i = 1; i < s.points.length - 1; i++) {
          const p = s.points[i], n = s.points[i + 1];
          ctx2.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
        }
        ctx2.lineTo(last.x, last.y);
        ctx2.stroke();
      }
      ctx2.restore();
    }
    function paint2() {
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) return;
      ctx2.save();
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      ctx2.restore();
      for (const s of strokes) drawStroke(ctx2, s);
      if (current) drawStroke(ctx2, current);
    }
    const at = (e) => ({ x: e.clientX, y: e.clientY });
    canvas.addEventListener("pointerdown", (e) => {
      if (!drawing || e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      current = { tool, color, size, points: [at(e)] };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!current) return;
      if (current.tool === "arrow" || current.tool === "box") current.points = [current.points[0], at(e)];
      else current.points.push(at(e));
      paint2();
    });
    const finish = () => {
      if (!current) return;
      if (current.points.length > 1) {
        strokes.push(current);
        redo.length = 0;
      }
      current = null;
      paint2();
      render();
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    function setMode(next) {
      drawing = next;
      overlay.className = `pen-sheet ${next ? "draw" : "click-through"}`;
      render();
    }
    const undo = () => {
      const s = strokes.pop();
      if (s) {
        redo.push(s);
        paint2();
        render();
      }
    };
    const redoOne = () => {
      const s = redo.pop();
      if (s) {
        strokes.push(s);
        paint2();
        render();
      }
    };
    const onKey = (e) => {
      if (!drawing) return;
      const k = (e.key ?? "").toLowerCase();
      if (k === "escape") {
        e.preventDefault();
        e.stopPropagation();
        setMode(false);
        toast("Click-through: the apps take clicks again.");
      } else if (e.ctrlKey && k === "z") {
        e.preventDefault();
        e.stopPropagation();
        undo();
      } else if (e.ctrlKey && k === "y") {
        e.preventDefault();
        e.stopPropagation();
        redoOne();
      }
    };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", sizeCanvas2);
    async function screenshot() {
      bar.style.visibility = "hidden";
      overlay.classList.add("capturing");
      await nextFrame();
      const url = await captureScreen();
      bar.style.visibility = "";
      overlay.classList.remove("capturing");
      if (!url) {
        toast("Nothing was captured.");
        return;
      }
      const bin = atob(url.slice(url.indexOf(",") + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      toast(`Screenshot taken. ${await saveCapture(new Blob([bytes], { type: "image/png" }), `corpdesk-${stamp()}.png`)}`);
    }
    async function deliver(handle) {
      const blob = await handle.stop();
      if (!blob) {
        toast("The recording produced nothing.");
        return;
      }
      toast(`Recording saved. ${await saveCapture(blob, `corpdesk-${stamp()}.webm`)}`);
    }
    async function toggleRecording() {
      if (recorder2) {
        const handle2 = recorder2;
        recorder2 = null;
        clearInterval(tick);
        render();
        await deliver(handle2);
        return;
      }
      if (!canRecord()) {
        toast("Recording is not available in this browser.");
        return;
      }
      toast("Choose what to share...");
      const handle = await startRecording({ camera, corner, onEnded: () => {
        if (!recorder2) return;
        const ending = recorder2;
        recorder2 = null;
        clearInterval(tick);
        render();
        void deliver(ending);
      } });
      if (!handle) {
        toast("No screen was shared, so nothing is being recorded.");
        return;
      }
      recorder2 = handle;
      tick = window.setInterval(render, 1e3);
      render();
      const parts = ["Recording the screen you picked"];
      if (handle.hasCamera()) parts.push("with your camera in the corner");
      if (handle.hasAudio()) parts.push(handle.hasSystemAudio() ? "and microphone + system audio" : "and your microphone");
      toast(handle.hasAudio() ? `${parts.join(" ")}.` : `${parts.join(" ")}, but with no audio: no microphone, or permission was declined.`);
    }
    const btn3 = (ic2, title, on, fn, extra = "") => h("button", { class: `pen-btn ${on ? "on" : ""} ${extra}`, type: "button", title, "aria-label": title, "aria-pressed": on ? "true" : "false", onClick: fn }, icon(ic2));
    const sep = () => h("span", { class: "pen-sep" });
    const grip = h("span", { class: "pen-grip", title: "Drag to move", "aria-hidden": "true" }, icon("grip"));
    let drag = null;
    grip.addEventListener("pointerdown", (e) => {
      const r = bar.getBoundingClientRect();
      drag = { x: e.clientX - r.left, y: e.clientY - r.top };
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener("pointermove", (e) => {
      if (drag) place({ x: e.clientX - drag.x, y: e.clientY - drag.y });
    });
    grip.addEventListener("pointerup", () => {
      if (!drag) return;
      drag = null;
      write(POS_KEY, JSON.stringify({ x: parseInt(bar.style.left, 10), y: parseInt(bar.style.top, 10) }));
    });
    function render() {
      bar.replaceChildren(...[
        grip,
        ...TOOLS.map((t) => btn3(t.id, t.title, drawing && tool === t.id, () => {
          tool = t.id;
          if (!drawing) setMode(true);
          else render();
        })),
        sep(),
        ...COLORS.map((c) => h("button", { class: `pen-swatch ${c === color ? "on" : ""}`, type: "button", title: c, "aria-label": `Colour ${c}`, style: `background:${c}`, onClick: () => {
          color = c;
          if (tool === "eraser") tool = "pen";
          if (!drawing) setMode(true);
          else render();
        } })),
        sep(),
        ...[2, 3, 6].map((w) => h("button", { class: `pen-size ${size === w ? "on" : ""}`, type: "button", title: `${w === 2 ? "Thin" : w === 3 ? "Medium" : "Thick"} line`, "aria-label": `Line width ${w}`, onClick: () => {
          size = w;
          render();
        } }, h("span", { style: `width:${w * 2 + 2}px;height:${w * 2 + 2}px` }))),
        sep(),
        btn3("undo", "Undo (Ctrl+Z)", false, undo, strokes.length ? "" : "dim"),
        btn3("redo", "Redo (Ctrl+Y)", false, redoOne, redo.length ? "" : "dim"),
        btn3("clear", "Clear every mark", false, () => {
          if (!strokes.length) return;
          redo.push(...strokes.reverse());
          strokes = [];
          paint2();
          render();
        }, strokes.length ? "" : "dim"),
        sep(),
        btn3("camera", "Screenshot: the screen with your marks on it", false, () => {
          void screenshot();
        }),
        recorder2 ? h("button", { class: "pen-btn rec on", type: "button", title: "Stop recording and save", onClick: () => {
          void toggleRecording();
        } }, icon("stop"), clock(recorder2.elapsed())) : btn3("record", "Record a screen you pick, with your camera and narration", false, () => {
          void toggleRecording();
        }, "rec"),
        canRecordCamera() ? btn3(camera ? "video" : "videoOff", recorder2 ? "The camera cannot be changed while recording" : camera ? "Camera bubble on: click to record the screen alone" : "Camera bubble off: click to include yourself", camera, () => {
          if (recorder2) {
            toast("Stop the recording before changing the camera.");
            return;
          }
          camera = !camera;
          write(CAM_KEY, camera ? "1" : "0");
          render();
        }) : null,
        canRecordCamera() && camera ? btn3("corner", `Camera bubble: ${corner.replace("-", " ")}. Click to move it.`, false, () => {
          const order = ["bottom-right", "bottom-left", "top-left", "top-right"];
          corner = order[(order.indexOf(corner) + 1) % order.length];
          recorder2?.setCameraCorner(corner);
          render();
          toast(`Camera bubble: ${corner.replace("-", " ")}`);
        }) : null,
        // The mode switch is the control that keeps the desktop usable.
        h(
          "button",
          { class: `pen-mode ${drawing ? "drawing" : ""}`, type: "button", title: drawing ? "The pen is taking clicks. Switch to let them reach the desktop (Esc)." : "Clicks reach the desktop. Switch to draw again.", onClick: () => setMode(!drawing) },
          icon(drawing ? "pen" : "pointer"),
          drawing ? "Drawing" : "Click-through"
        ),
        btn3("close", "Close Screen Pen", false, () => close?.())
      ].filter((x) => !!x));
    }
    close = () => {
      if (recorder2) void toggleRecording();
      clearInterval(tick);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", sizeCanvas2);
      overlay.remove();
      bar.remove();
      trayBtn.classList.remove("on");
      close = null;
    };
    render();
    document.body.append(overlay, bar);
    sizeCanvas2();
    trayBtn.classList.add("on");
    toast("Screen Pen is ready in Click-through. Pick a tool to draw; Esc gives the desktop back.");
  }
  var trayBtn = h("button", { class: "ia-pen-toggle", type: "button", title: "Screen Pen (Ctrl+Shift+D)\nDraw on the screen, take a screenshot or record", "aria-label": "Screen Pen", onClick: () => toggleScreenPen() }, icon("pen"));
  document.querySelector(".system-tray")?.prepend(trayBtn);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key ?? "").toLowerCase() === "d") {
      e.preventDefault();
      toggleScreenPen();
    }
  });
  var apps2 = APPS();
  if (!apps2.some((a) => a.id === "pen")) apps2.push({ id: "pen", name: "Screen Pen", short: "Screen Pen", bg: "transparent", fg: "#fff", icon: `<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="2" y="2" width="30" height="30" rx="7" fill="#0f6cbd"/><path d="M20.5 8.5l5 5L15 24h-5v-5z" fill="#fff"/><path d="M18.5 10.5l5 5" stroke="#0f6cbd" stroke-width="1.6"/><path d="M8 27h18" stroke="#ffb900" stroke-width="2.4" stroke-linecap="round"/></svg>` });
  var previousOpen = G.openApp;
  G.openApp = (id) => {
    if (id === "pen") toggleScreenPen();
    else previousOpen(id);
  };
  var _a3;
  Object.assign((_a3 = G).CorpDesk || (_a3.CorpDesk = {}), { toggleScreenPen });

  // itlab/ribbons.ts
  var active = { word: "Home", excel: "Home", powerpoint: "Home" };
  var lastCell = "A1";
  document.addEventListener("focusin", (e) => {
    const c = e.target?.dataset?.cell;
    if (c) lastCell = c;
  });
  var office = () => S().office;
  var rb = (label, fn, title) => h("button", { type: "button", title: title ?? label, onMousedown: (e) => e.preventDefault(), onClick: fn }, label);
  var group = (name, ...kids) => h("div", { class: "rb-group" }, h("div", { class: "rb-items" }, kids), h("div", { class: "rb-name" }, name));
  function wordPanel(tab4) {
    var _a7;
    const editor = document.getElementById("wordEditor");
    if (!editor) return null;
    const w = (_a7 = office().word).view || (_a7.view = { margin: "Normal", orient: "Portrait", cols: 1, zoom: 100, spell: true, dark: false });
    const exec = (cmd2, arg) => {
      editor.focus();
      document.execCommand(cmd2, false, arg);
      editor.dispatchEvent(new Event("input"));
    };
    const apply = () => {
      save();
      G.CorpDesk.renderWord();
    };
    if (tab4 === "Insert") return h(
      "div",
      { class: "rb" },
      group("Tables", rb("▦ Table 3×3", () => exec("insertHTML", `<table class="doc-table"><tbody>${("<tr>" + "<td>&nbsp;</td>".repeat(3) + "</tr>").repeat(3)}</tbody></table><p></p>`))),
      group("Text", rb("📅 Date & Time", () => exec("insertText", (/* @__PURE__ */ new Date()).toLocaleString())), rb("🔗 Link", () => {
        const i = h("input", { class: "ad2-input", placeholder: "https://" });
        dialog("Insert link", h("label", { class: "ad2-field" }, "Address", i), [["OK", () => {
          const url = i.value.trim();
          if (!/^https?:\/\/\S+$/i.test(url)) {
            toast("Enter a web address starting with http:// or https://");
            return false;
          }
          exec("createLink", url);
        }, "primary"], ["Cancel", () => void 0]]);
      })),
      group("Pages", rb("— Horizontal line", () => exec("insertHorizontalRule")), rb("⤓ Page break", () => exec("insertHTML", '<hr class="page-break"><p></p>'))),
      group("IT templates", rb("Incident report", () => exec("insertHTML", "<h2>Incident report</h2><p><b>Ticket:</b> LAB-___ &nbsp; <b>Priority:</b> ___</p><p><b>Symptom:</b> </p><p><b>Root cause:</b> </p><p><b>Fix applied:</b> </p><p><b>Verified by:</b> </p>")), rb("Change request", () => exec("insertHTML", "<h2>Change request</h2><p><b>Change:</b> </p><p><b>Reason:</b> </p><p><b>Risk and rollback:</b> </p><p><b>Approved by:</b> </p>")))
    );
    if (tab4 === "Layout") return h(
      "div",
      { class: "rb" },
      group("Margins", ...["Narrow", "Normal", "Wide"].map((m) => rb(`${w.margin === m ? "✓ " : ""}${m}`, () => {
        w.margin = m;
        apply();
      }))),
      group("Orientation", ...["Portrait", "Landscape"].map((o) => rb(`${w.orient === o ? "✓ " : ""}${o}`, () => {
        w.orient = o;
        apply();
      }))),
      group("Columns", ...[1, 2].map((c) => rb(`${w.cols === c ? "✓ " : ""}${c === 1 ? "One" : "Two"}`, () => {
        w.cols = c;
        apply();
      })))
    );
    if (tab4 === "Review") return h(
      "div",
      { class: "rb" },
      group("Proofing", rb(`${w.spell ? "✓ " : ""}Spelling & Grammar`, () => {
        w.spell = !w.spell;
        apply();
      }), rb("Word Count", () => {
        const text = editor.innerText;
        dialog("Word Count", h("dl", { class: "ad2-kv" }, h("dt", null, "Pages"), h("dd", null, String(Math.max(1, Math.ceil(text.length / 3e3)))), h("dt", null, "Words"), h("dd", null, String(text.trim().split(/\s+/).filter(Boolean).length)), h("dt", null, "Characters (with spaces)"), h("dd", null, String(text.length)), h("dt", null, "Paragraphs"), h("dd", null, String(editor.querySelectorAll("p,h1,h2,li").length))), [["Close", () => void 0, "primary"]]);
      })),
      group("Comments", rb("💬 New Comment", () => {
        const sel = window.getSelection()?.toString();
        if (!sel) {
          toast("Select some text to comment on.");
          return;
        }
        const i = h("input", { class: "ad2-input" });
        dialog("New comment", h("label", { class: "ad2-field" }, `On "${sel.slice(0, 40)}"`, i), [["Post", () => {
          exec("insertHTML", `<mark class="doc-comment" title="${i.value.replace(/[<>"&]/g, "")}">${sel.replace(/[<>&]/g, "")}</mark>`);
        }, "primary"], ["Cancel", () => void 0]]);
      })),
      group("Speech", rb("🔊 Read Aloud", () => {
        if (!("speechSynthesis" in window)) {
          toast("Read Aloud is not available here.");
          return;
        }
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(editor.innerText.slice(0, 4e3)));
      }), rb("■ Stop", () => speechSynthesis?.cancel()))
    );
    if (tab4 === "View") return h(
      "div",
      { class: "rb" },
      group("Zoom", rb("－", () => {
        w.zoom = Math.max(50, w.zoom - 10);
        apply();
      }), h("span", { class: "rb-val" }, `${w.zoom}%`), rb("＋", () => {
        w.zoom = Math.min(200, w.zoom + 10);
        apply();
      }), rb("100%", () => {
        w.zoom = 100;
        apply();
      })),
      group("Page", rb(`${w.dark ? "✓ " : ""}Dark page`, () => {
        w.dark = !w.dark;
        apply();
      }))
    );
    return null;
  }
  function styleWord() {
    const editor = document.getElementById("wordEditor");
    const w = office()?.word?.view;
    if (!editor || !w) return;
    editor.style.padding = { Narrow: "24px 28px", Normal: "56px 64px", Wide: "72px 110px" }[w.margin] ?? "";
    editor.style.maxWidth = w.orient === "Landscape" ? "1000px" : "";
    editor.style.columnCount = String(w.cols ?? 1);
    editor.style.zoom = String((w.zoom ?? 100) / 100);
    editor.spellcheck = w.spell !== false;
    editor.style.background = w.dark ? "#1f1f1f" : "";
    editor.style.color = w.dark ? "#eee" : "";
  }
  var COLS = "ABCDEFGHIJKL".split("");
  function excelPanel(tab4) {
    const d = office().excel;
    const view3 = d.view || (d.view = { grid: true, freeze: false, zoom: 100 });
    const apply = () => {
      save();
      G.CorpDesk.renderExcel();
    };
    const set = (ref, v) => {
      d.cells[ref] = v;
      apply();
    };
    const col = lastCell.replace(/\d+/g, ""), row = Number(lastCell.replace(/\D+/g, "")) || 1;
    const above = (fn) => {
      if (row < 2) {
        toast("Select the empty cell under a column of numbers first.");
        return;
      }
      set(lastCell, `=${fn}(${col}1:${col}${row - 1})`);
    };
    if (tab4 === "Insert") return h(
      "div",
      { class: "rb" },
      group("Values", rb("Today's date", () => set(lastCell, (/* @__PURE__ */ new Date()).toLocaleDateString())), rb("Current time", () => set(lastCell, (/* @__PURE__ */ new Date()).toLocaleTimeString()))),
      group("IT templates", rb("Ticket log header", () => {
        ["Ticket", "Requester", "Category", "Priority", "Status", "Opened", "Resolved", "Minutes"].forEach((t, i) => {
          d.cells[`${COLS[i]}1`] = t;
        });
        apply();
      }), rb("Asset inventory header", () => {
        ["Asset tag", "Device", "Owner", "Department", "OS", "Warranty end", "Status"].forEach((t, i) => {
          d.cells[`${COLS[i]}1`] = t;
        });
        apply();
      }))
    );
    if (tab4 === "Formulas") return h(
      "div",
      { class: "rb" },
      group(`Function library (into ${lastCell})`, ...["SUM", "AVERAGE", "COUNT", "MIN", "MAX"].map((f) => rb(f === "SUM" ? "Σ AutoSum" : f, () => above(f), `${f} of the cells above ${lastCell}`))),
      group("Formula auditing", rb("Show formula", () => toast(`${lastCell}: ${d.cells[lastCell] ?? "(empty)"}`)))
    );
    if (tab4 === "Data") {
      const sort = (desc) => {
        const rows = Array.from({ length: 29 }, (_, i) => i + 2).map((r) => COLS.map((c) => d.cells[`${c}${r}`]));
        const ci = COLS.indexOf(col);
        const filled = rows.filter((r) => r.some((v) => v !== void 0 && v !== ""));
        filled.sort((a, b) => {
          const x = a[ci] ?? "", y = b[ci] ?? "";
          const nx = Number(x), ny = Number(y);
          const cmp = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== "" && y !== "" ? nx - ny : String(x).localeCompare(String(y));
          return desc ? -cmp : cmp;
        });
        for (let r = 2; r <= 30; r++) for (const c of COLS) delete d.cells[`${c}${r}`];
        filled.forEach((vals, i) => vals.forEach((v, j) => {
          if (v !== void 0 && v !== "") d.cells[`${COLS[j]}${i + 2}`] = v;
        }));
        apply();
      };
      return h("div", { class: "rb" }, group(`Sort by column ${col} (row 1 is the header)`, rb("A→Z Sort ascending", () => sort(false)), rb("Z→A Sort descending", () => sort(true))), group("Data tools", rb(`Clear column ${col}`, () => {
        for (let r = 1; r <= 30; r++) delete d.cells[`${col}${r}`];
        apply();
      })));
    }
    if (tab4 === "View") return h(
      "div",
      { class: "rb" },
      group("Show", rb(`${view3.grid ? "✓ " : ""}Gridlines`, () => {
        view3.grid = !view3.grid;
        apply();
      }), rb(`${view3.freeze ? "✓ " : ""}Freeze top row`, () => {
        view3.freeze = !view3.freeze;
        apply();
      })),
      group("Zoom", rb("－", () => {
        view3.zoom = Math.max(50, view3.zoom - 10);
        apply();
      }), h("span", { class: "rb-val" }, `${view3.zoom}%`), rb("＋", () => {
        view3.zoom = Math.min(200, view3.zoom + 10);
        apply();
      }), rb("100%", () => {
        view3.zoom = 100;
        apply();
      }))
    );
    return null;
  }
  function styleExcel() {
    const grid2 = document.querySelector("#appBody .excel-grid");
    const v = office()?.excel?.view;
    if (!grid2 || !v) return;
    grid2.classList.toggle("rb-nogrid", !v.grid);
    grid2.classList.toggle("rb-freeze", !!v.freeze);
    grid2.style.zoom = String((v.zoom ?? 100) / 100);
  }
  var THEMES = { light: ["#ffffff", "#1b1b1b", "Office"], dark: ["#18314e", "#ffffff", "Midnight"], blue: ["linear-gradient(135deg,#0f6cbd,#2e8ae6)", "#ffffff", "Blue"], green: ["linear-gradient(135deg,#107c41,#2fb380)", "#ffffff", "Fresh"], warm: ["linear-gradient(135deg,#fff4e5,#ffd8a8)", "#4a2a00", "Sunrise"] };
  function slideShow(from) {
    const d = office().powerpoint;
    let i = from;
    const stage = h("div", { class: "rb-show", tabindex: "0" });
    const draw3 = () => {
      const s = d.slides[i];
      const [bg, fg] = THEMES[s.theme] ?? THEMES.light;
      stage.replaceChildren(h("div", { class: "rb-slide", style: `background:${bg};color:${fg}` }, h("h1", null, s.title), h("p", null, s.body)), h("div", { class: "rb-show-bar" }, `${i + 1} / ${d.slides.length} · ←/→ to move · Esc to end`));
    };
    const end = () => {
      stage.remove();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => void 0);
    };
    stage.addEventListener("keydown", (e) => {
      if (e.key === "Escape") end();
      if (["ArrowRight", " ", "PageDown", "Enter"].includes(e.key)) {
        if (i < d.slides.length - 1) {
          i++;
          draw3();
        } else end();
      }
      if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key) && i > 0) {
        i--;
        draw3();
      }
    });
    stage.addEventListener("click", () => {
      if (i < d.slides.length - 1) {
        i++;
        draw3();
      } else end();
    });
    document.body.appendChild(stage);
    draw3();
    stage.focus();
    void stage.requestFullscreen?.().catch(() => void 0);
  }
  function pptPanel(tab4) {
    const d = office().powerpoint;
    const apply = () => {
      save();
      G.CorpDesk.renderPowerPoint();
    };
    const click = (id) => document.getElementById(id)?.click();
    if (tab4 === "Insert") return h(
      "div",
      { class: "rb" },
      group("Slides", rb("＋ New Slide", () => click("pptAdd")), rb("⧉ Duplicate", () => click("pptDuplicate"))),
      group("Text", rb("• Bullet point", () => {
        const s = d.slides[d.active];
        s.body = `${s.body}${s.body ? "\n" : ""}• New point`;
        apply();
      }), rb("📅 Date", () => {
        const s = d.slides[d.active];
        s.body = `${s.body}${s.body ? "\n" : ""}${(/* @__PURE__ */ new Date()).toLocaleDateString()}`;
        apply();
      })),
      group("IT templates", rb("Incident review slide", () => {
        d.slides.splice(d.active + 1, 0, { title: "Incident review: LAB-___", body: "• What happened\n• Impact and who was affected\n• Root cause\n• Fix and verification\n• What we will do differently", theme: d.slides[d.active]?.theme ?? "light" });
        d.active++;
        apply();
      }))
    );
    if (tab4 === "Design") return h(
      "div",
      { class: "rb" },
      group("Themes (this slide)", ...Object.entries(THEMES).map(([k, [bg, fg, name]]) => h("button", { type: "button", class: "rb-theme", title: name, style: `background:${bg};color:${fg}`, onClick: () => {
        d.slides[d.active].theme = k;
        apply();
      } }, name))),
      group("Apply", rb("Apply theme to all slides", () => {
        const t = d.slides[d.active].theme;
        d.slides.forEach((s) => {
          s.theme = t;
        });
        apply();
      }))
    );
    if (tab4 === "Slide Show") return h("div", { class: "rb" }, group("Start Slide Show", rb("▶ From Beginning", () => slideShow(0)), rb("▶ From Current Slide", () => slideShow(d.active))));
    if (tab4 === "View") return h("div", { class: "rb" }, group("Presentation views", rb("Normal", () => apply()), rb("Slide Sorter", () => {
      const grid2 = h("div", { class: "rb-sorter" }, d.slides.map((s, i) => {
        const [bg, fg] = THEMES[s.theme] ?? THEMES.light;
        return h("button", { type: "button", class: "rb-sort-slide", style: `background:${bg};color:${fg}`, onClick: () => {
          d.active = i;
          shade.remove();
          apply();
        } }, h("b", null, `${i + 1}. ${s.title}`));
      }));
      const shade = h("div", { class: "ia-shade" }, h("div", { class: "ia-dialog ia", style: "width:min(900px,96vw)" }, h("h2", null, "Slide Sorter"), grid2, h("div", { class: "ia-dialog-foot" }, h("button", { class: "ad2-btn primary", type: "button", onClick: () => shade.remove() }, "Close"))));
      document.body.appendChild(shade);
    })));
    return null;
  }
  function stylePpt() {
    const s = office()?.powerpoint?.slides?.[office().powerpoint.active];
    const slide = document.querySelector("#appBody .ppt-slide");
    if (!s || !slide) return;
    const [bg, fg] = THEMES[s.theme] ?? THEMES.light;
    slide.style.background = bg;
    slide.style.color = fg;
    document.querySelectorAll("#appBody .ppt-thumb").forEach((t, i) => {
      const th = THEMES[office().powerpoint.slides[i]?.theme] ?? THEMES.light;
      t.style.borderLeft = `6px solid ${th[0].includes("gradient") ? "#0f6cbd" : th[0]}`;
    });
  }
  var PANELS = { word: wordPanel, excel: excelPanel, powerpoint: pptPanel };
  var STYLE = { word: styleWord, excel: styleExcel, powerpoint: stylePpt };
  function decorateOffice() {
    const appEl = document.querySelector("#appBody .office-app:not([data-rb])");
    if (!appEl) return;
    const win = appEl.closest(".app-window");
    const id = win?.dataset.app ?? "";
    if (!PANELS[id]) return;
    appEl.dataset.rb = "1";
    const home = appEl.querySelector(".office-ribbon");
    const tabs = [...appEl.querySelectorAll("[data-office-tab]")];
    const show = (tab4) => {
      active[id] = tab4;
      tabs.forEach((b) => b.classList.toggle("selected", b.dataset.officeTab === tab4));
      appEl.querySelector(".rb")?.remove();
      const panel2 = tab4 === "Home" ? null : PANELS[id](tab4);
      if (home) home.style.display = panel2 ? "none" : "";
      if (panel2) home?.after(panel2);
    };
    for (const b of tabs) b.onclick = () => {
      if (b.dataset.officeTab === "File") {
        G.openApp("office");
        return;
      }
      show(b.dataset.officeTab);
    };
    show(active[id] ?? "Home");
    STYLE[id]?.();
  }
  function decorateEvents() {
    const menu2 = document.querySelector('.app-window[data-app="events"] .mmc-menu:not([data-rb])');
    if (!menu2) return;
    menu2.dataset.rb = "1";
    const click = (sel) => document.querySelector(`.app-window[data-app="events"] ${sel}`)?.click();
    const filter2 = () => {
      const input = h("input", { class: "ad2-input", placeholder: "Event ID, account or text (e.g. 4740 or hr01)", "aria-label": "Filter" });
      dialog("Filter Current Log", h("label", { class: "ad2-field" }, "Show events containing", input), [["OK", () => {
        const box = document.querySelector('.app-window[data-app="events"] input');
        if (box) {
          box.value = input.value;
          box.dispatchEvent(new Event("input", { bubbles: true }));
        } else toast("Use the search box above the event list.");
      }, "primary"], ["Cancel", () => void 0]]);
    };
    const bar = menubar("mmc-menu ev-menubar", [
      ["File", () => [{ label: "Save All Events As...", action: () => click("#eventExportTool") }, "-", { label: "Exit", action: () => G.CorpDesk?.closeApp?.("events") }]],
      ["Action", () => [{ label: "Refresh", shortcut: "F5", action: () => click("#eventRefresh") }, { label: "Filter Current Log...", action: filter2 }, { label: "Clear Filter", action: () => {
        const box = document.querySelector('.app-window[data-app="events"] input');
        if (box) {
          box.value = "";
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } }, "-", { label: "Save All Events As...", action: () => click("#eventExportTool") }]],
      ["View", () => [{ label: "Refresh", shortcut: "F5", action: () => click("#eventRefresh") }]],
      ["Help", () => [{ label: "Help Topics", action: () => click("#eventHelp") }, { label: "Common event IDs", action: () => dialog("Common event IDs for the service desk", h("dl", { class: "ad2-kv" }, ...[["4624", "Successful logon"], ["4625", "Failed logon (bad password, disabled, locked)"], ["4634", "Logoff"], ["4724", "Password reset by an admin"], ["4723", "User changed own password"], ["4740", "Account locked out"], ["4767", "Account unlocked"], ["4722 / 4725", "Account enabled / disabled"], ["7031", "Service terminated unexpectedly"], ["5136", "Directory object modified"]].flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)])), [["Close", () => void 0, "primary"]]) }]]
    ]);
    menu2.replaceWith(bar);
    bar.dataset.rb = "1";
    menu2.style.display = "none";
    bar.after(menu2);
  }
  new MutationObserver(() => {
    decorateOffice();
    decorateEvents();
  }).observe(document.body, { childList: true, subtree: true });

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
  var DEPTS = ["HR", "IT", "Finance"];
  var SHARED = { HR: `hr@${DOMAIN}`, Finance: `finance@${DOMAIN}`, IT: `servicedesk@${DOMAIN}` };
  var SHARED_NAME = { HR: "HR Team", Finance: "Finance Team", IT: "IT Service Desk" };
  var BASELINE = { [`hr@${DOMAIN}`]: { fa: ["hr01"], sa: ["hr01"] }, [`finance@${DOMAIN}`]: { fa: ["finance01"], sa: ["finance01"] }, [`servicedesk@${DOMAIN}`]: { fa: ["it01", "it02"], sa: ["it01"] } };
  var TITLES = {
    HR: ["HR Generalist", "Recruitment Coordinator", "Payroll Specialist", "HR Business Partner"],
    IT: ["Service Desk Analyst", "Desktop Support Technician", "Systems Administrator", "Network Technician"],
    Finance: ["Financial Analyst", "Accounts Payable Clerk", "Payroll Accountant", "Budget Analyst"]
  };
  var FIRST = ["Priya", "Marcus", "Elena", "Kwame", "Sofia", "Daniel", "Aisha", "Tomás", "Grace", "Hiroshi", "Leila", "Owen", "Nadia", "Samuel", "Chloe", "Ibrahim"];
  var LAST = ["Shah", "Bennett", "Okafor", "Novak", "Lindqvist", "Moreau", "Haddad", "Castillo", "Kim", "Fischer", "Mensah", "Rossi", "Walsh", "Tanaka"];
  var RESERVED = ["hr01", "hr02", "hr03", "finance01"];
  var after = (iso, id) => !!iso && iso >= (lab().started?.[id] ?? "");
  var started = () => {
    var _a7;
    return (_a7 = lab()).started || (_a7.started = {});
  };
  var runs = () => {
    var _a7;
    return (_a7 = lab()).runs || (_a7.runs = {});
  };
  var pad = (n) => String(n).padStart(3, "0");
  var users = () => S().users;
  var staff = (dept) => users().filter((u) => u.enabled && !u.locked && u.path?.startsWith("Lab/Users/") && !RESERVED.includes(u.sam) && (!dept || u.dept === dept));
  var group2 = (dept) => `GG_${dept}_Staff`;
  var mbx = (address) => lab().mailboxes.find((m) => m.address === address);
  var first = (u) => String(u?.name ?? "").split(" ")[0] ?? "";
  var mail = (m) => {
    const L = lab();
    L.inbox = L.inbox.filter((x) => x.id !== m.id);
    L.inbox.push({ to: `servicedesk@${DOMAIN}`, received: nowIso(), read: false, headers: [`From: ${m.fromName} <${m.from}>`, `To: servicedesk@${DOMAIN}`, `Return-Path: <${m.from}>`, `Authentication-Results: spf=pass smtp.mailfrom=${DOMAIN}; dkim=pass header.d=${DOMAIN}; dmarc=pass`].join(NL), ...m });
    L.purged = L.purged.filter((x) => x !== m.id && x !== `del:${m.id}`);
  };
  var unmail = (id) => {
    const L = lab();
    L.inbox = L.inbox.filter((x) => x.id !== id);
  };
  var resetShared = (address) => {
    const m = mbx(address), b = BASELINE[address];
    if (m && b) {
      m.fullAccess = [...b.fa];
      m.sendAs = [...b.sa];
    }
  };
  var LABS = [
    // ---------------------------------------------------------------- Joiner
    {
      id: 6,
      category: "Onboarding (joiner)",
      priority: "Medium",
      tools: ["outlook", "directory", "m365"],
      generic: "New hire starts soon: create the new starter's accounts",
      baseChecks: ["onboard-request", "sync"],
      realWorld: "Joiners are the most common planned work on a service desk. Accounts are built from an approved HR request, never from a phone call, and in hybrid companies they reach Microsoft 365 through Entra Connect sync before a licence and mailbox can be assigned.",
      interview: "Walk me through onboarding a new hire: HR request, AD account in the right OU with role groups, sync to Entra ID, licence for a mailbox, and a first-logon password handed over securely.",
      roll(r) {
        const dept = r.pick(DEPTS);
        let fn = r.pick(FIRST), ln = r.pick(LAST), sam = (fn[0] + ln).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
        for (let i = 0; corpUser(sam) && i < 20; i++) {
          fn = r.pick(FIRST);
          ln = r.pick(LAST);
          sam = (fn[0] + ln).toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
        }
        const manager = r.pick(staff(dept).length ? staff(dept) : users().filter((u) => u.dept === dept));
        return { seed: 0, dept, first: fn, last: ln, sam, title: r.pick(TITLES[dept]), manager: manager.sam, managerName: manager.name, shared: r.chance(0.5), day: r.pick(["Monday", "Tuesday", "Wednesday"]), ref: `HR-${r.int(2100, 2999)}` };
      },
      text: (p) => ({
        title: `New hire starts ${p.day}: create ${p.first} ${p.last}'s accounts`,
        user: p.manager,
        summary: `${p.managerName} (${p.dept} manager) has sent an approved onboarding request (${p.ref}) to the service desk mailbox. ${p.first} ${p.last} joins ${p.dept} as ${p.title} on ${p.day}. Build the account exactly as requested, get it into Microsoft 365, license it, and make sure the mailbox exists.`,
        hint: `Read the request in Outlook. ADUC: create ${p.sam} in Lab > Users > ${p.dept}, set the job title and manager, add ${group2(p.dept)}, require a password change at first logon. Then run a delta sync (M365 admin or Start-ADSyncSyncCycle -PolicyType Delta) and assign ${E3}.${p.shared ? " The request also asks for shared mailbox access: grant only what it says." : ""}`,
        checks: ["onboard-request", "sync"]
      }),
      inject(p) {
        S().users = users().filter((u) => u.sam !== p.sam);
        const L = lab();
        L.synced = L.synced.filter((x) => x !== p.sam);
        delete L.licenses[p.sam];
        L.mailboxes = L.mailboxes.filter((m) => m.owner !== p.sam);
        if (p.shared) resetShared(SHARED[p.dept]);
        mail({
          id: "m-onboard",
          from: `${p.manager}@${DOMAIN}`,
          fromName: p.managerName,
          subject: `New starter ${p.day}: ${p.first} ${p.last} (${p.dept})`,
          evidence: "onboard-request",
          body: [`Hi service desk,`, "", `Please set up access for our new starter (HR reference ${p.ref}, approved).`, "", `Name: ${p.first} ${p.last}`, `Logon name: ${p.sam}`, `Job title: ${p.title}`, `Department: ${p.dept}`, `Manager: ${p.managerName} (${p.manager})`, `Start date: ${p.day}`, `Access: ${p.dept} team role (${group2(p.dept)}), email (${E3})`, ...p.shared ? [`Also: read access to the ${SHARED_NAME[p.dept]} shared mailbox (${SHARED[p.dept]}). Read only: no Send As.`] : [], "", "Please make them change the password the first time they sign in.", "", "Thanks,", first({ name: p.managerName })].join(NL)
        });
      },
      restore(p) {
        S().users = users().filter((u) => u.sam !== p.sam);
        const L = lab();
        L.synced = L.synced.filter((x) => x !== p.sam);
        delete L.licenses[p.sam];
        L.mailboxes = L.mailboxes.filter((m) => m.owner !== p.sam);
        if (p.shared) resetShared(SHARED[p.dept]);
        unmail("m-onboard");
      },
      criteria(p) {
        const u = corpUser(p.sam), L = lab(), sh = mbx(SHARED[p.dept]);
        return !!u && u.path === `Lab/Users/${p.dept}` && u.groups.includes(group2(p.dept)) && String(u.title ?? "").toLowerCase() === p.title.toLowerCase() && u.manager === p.manager && u.enabled && !!u.accountOptions?.mustChange && L.synced.includes(p.sam) && L.licenses[p.sam] === E3 && L.mailboxes.some((m) => m.owner === p.sam) && (p.shared ? sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam) : !sh.fullAccess.includes(p.sam));
      }
    },
    // ---------------------------------------------------------------- Mover
    {
      id: 13,
      category: "Transfer (mover)",
      priority: "Medium",
      tools: ["outlook", "directory", "m365"],
      generic: "Internal transfer: move an employee to their new team",
      baseChecks: ["mover-notice"],
      realWorld: "Movers are where access quietly piles up: people change teams and keep everything they had. The fix is to grant the new role and remove the old one on the same day, and to update the directory (OU, department, title, manager) so policies and approvals follow the person.",
      interview: "Someone moves from HR to Finance. What changes in AD and Microsoft 365, and what do you remove?",
      roll(r) {
        const candidates = staff();
        const u = r.pick(candidates);
        const to = r.pick(DEPTS.filter((d) => d !== u.dept));
        const mgrs = staff(to).filter((x) => x.sam !== u.sam);
        const mgr = r.pick(mgrs.length ? mgrs : users().filter((x) => x.dept === to));
        return { seed: 0, sam: u.sam, name: u.name, from: u.dept, to, title: r.pick(TITLES[to]), manager: mgr.sam, managerName: mgr.name, oldShared: r.chance(0.6), effective: r.pick(["today", "Monday"]), ref: `HR-${r.int(3100, 3999)}` };
      },
      text: (p) => ({
        title: `Transfer: ${p.name} moves from ${p.from} to ${p.to}`,
        user: p.manager,
        summary: `HR has sent a transfer notice (${p.ref}). ${p.name} (${p.sam}) moves from ${p.from} to ${p.to} as ${p.title}, reporting to ${p.managerName}, effective ${p.effective}. Give them the new team's access, take away the old team's, and update the directory so it shows who they are now.`,
        hint: `ADUC: move ${p.sam} to Lab > Users > ${p.to}; on Member Of remove ${group2(p.from)} and add ${group2(p.to)}; on Organization set Department ${p.to}, Job title and Manager.${p.oldShared ? ` Microsoft 365 admin: remove their access to the ${SHARED_NAME[p.from]} shared mailbox.` : ""}`,
        checks: ["mover-notice"]
      }),
      inject(p) {
        const u = corpUser(p.sam);
        if (u) {
          u.path = `Lab/Users/${p.from}`;
          u.dept = p.from;
          u.groups = [group2(p.from)];
          u.enabled = true;
          u.locked = false;
        }
        const sh = mbx(SHARED[p.from]);
        if (sh) {
          resetShared(SHARED[p.from]);
          if (p.oldShared) {
            sh.fullAccess.push(p.sam);
            sh.sendAs.push(p.sam);
          }
        }
        mail({
          id: "m-mover",
          from: `hr01@${DOMAIN}`,
          fromName: "Maya Chen",
          subject: `Transfer notice: ${p.name} — ${p.from} to ${p.to}`,
          evidence: "mover-notice",
          body: ["Hello IT,", "", `${p.name} (${p.sam}) is transferring (HR reference ${p.ref}), effective ${p.effective}.`, "", `From: ${p.from}`, `To: ${p.to}`, `New job title: ${p.title}`, `New manager: ${p.managerName} (${p.manager})`, "", `Please give ${first(p)} the ${p.to} team access and remove everything that belonged to the ${p.from} role${p.oldShared ? `, including the ${SHARED_NAME[p.from]} shared mailbox` : ""}. Update the directory details too.`, "", "Thanks,", "Maya Chen, HR"].join(NL)
        });
      },
      restore(p) {
        const u = corpUser(p.sam);
        if (u) {
          u.path = `Lab/Users/${p.from}`;
          u.dept = p.from;
          u.groups = [group2(p.from)];
        }
        resetShared(SHARED[p.from]);
        unmail("m-mover");
      },
      criteria(p) {
        const u = corpUser(p.sam), sh = mbx(SHARED[p.from]);
        return !!u && u.path === `Lab/Users/${p.to}` && u.groups.includes(group2(p.to)) && !u.groups.includes(group2(p.from)) && u.dept === p.to && String(u.title ?? "").toLowerCase() === p.title.toLowerCase() && u.manager === p.manager && !sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam);
      }
    },
    // ---------------------------------------------------------------- Leaver
    {
      id: 7,
      category: "Offboarding (leaver)",
      priority: "High",
      tools: ["outlook", "directory", "m365"],
      generic: "Termination today: offboard a leaver",
      baseChecks: ["leaver-notice", "revoke"],
      realWorld: "Leavers are a security task: the account must stop working at the agreed time, sessions already open must be ended, and data is kept (shared mailbox) for the business. Deleting accounts on day one loses mail and audit history.",
      interview: "What do you do when someone is terminated? Disable (not delete), revoke sessions, remove groups, block cloud sign-in, convert the mailbox to shared for the manager, reclaim the licence and the laptop, and document everything on the ticket.",
      roll(r) {
        const u = r.pick(staff());
        const mgrs = staff(u.dept).filter((x) => x.sam !== u.sam);
        const mgr = r.pick(mgrs.length ? mgrs : users().filter((x) => x.dept === u.dept && x.sam !== u.sam));
        return { seed: 0, sam: u.sam, name: u.name, dept: u.dept, manager: mgr.sam, managerName: mgr.name, hadShared: r.chance(0.5), time: r.pick(["12:00", "15:30", "17:00"]), ref: `HR-${r.int(2300, 2999)}` };
      },
      text: (p) => ({
        title: `Termination today: offboard ${p.name}`,
        user: p.manager,
        summary: `HR has confirmed ${p.name} (${p.sam}, ${p.dept}) leaves today at ${p.time}. Follow the leaver checklist in the HR notice: lock the account everywhere, keep the mailbox for the manager, and free the licence. Nothing may be deleted.`,
        hint: `ADUC: disable ${p.sam}, move it to Lab > Disabled, remove its group memberships. Microsoft 365 admin: block sign-in and sign out of all sessions, convert the mailbox to shared, give ${p.managerName} (${p.manager}) Full Access, then remove the licence.${p.hadShared ? ` Their access to the ${SHARED_NAME[p.dept]} shared mailbox goes too.` : ""}`,
        checks: ["leaver-notice", "revoke"]
      }),
      inject(p) {
        const u = corpUser(p.sam);
        if (u) {
          u.enabled = true;
          u.locked = false;
          u.path = `Lab/Users/${p.dept}`;
          u.groups = [group2(p.dept)];
        }
        const L = lab();
        if (!L.synced.includes(p.sam)) L.synced.push(p.sam);
        L.licenses[p.sam] = E3;
        L.blocked = L.blocked.filter((x) => x !== p.sam);
        const m = L.mailboxes.find((x) => x.owner === p.sam);
        if (m) {
          m.type = "user";
          m.fullAccess = [];
          m.sendAs = [];
        }
        resetShared(SHARED[p.dept]);
        if (p.hadShared) {
          const sh = mbx(SHARED[p.dept]);
          sh.fullAccess.push(p.sam);
          sh.sendAs.push(p.sam);
        }
        mail({
          id: "m-leaver",
          from: `hr01@${DOMAIN}`,
          fromName: "Maya Chen",
          subject: `Leaver notice: ${p.name} (${p.dept}) — today ${p.time}`,
          evidence: "leaver-notice",
          body: ["Hello IT,", "", `${p.name} (${p.sam}), ${p.dept} department, leaves the company today. Last working time: ${p.time}. HR reference ${p.ref}.`, "", "Leaver checklist:", "1. Disable the account and move it to the Disabled OU. Do not delete it.", "2. Remove all group memberships.", "3. Block Microsoft 365 sign-in and sign them out everywhere.", `4. Convert the mailbox to a shared mailbox and give the manager, ${p.managerName} (${p.manager}), Full Access.`, "5. Remove the Microsoft 365 licence.", ...p.hadShared ? [`6. Remove their access to the ${SHARED_NAME[p.dept]} shared mailbox.`] : [], "", "Thank you,", "Maya Chen, HR"].join(NL)
        });
      },
      restore(p) {
        const u = corpUser(p.sam);
        if (u) {
          u.enabled = true;
          u.path = `Lab/Users/${p.dept}`;
          u.groups = [group2(p.dept)];
        }
        const L = lab();
        L.licenses[p.sam] = E3;
        L.blocked = L.blocked.filter((x) => x !== p.sam);
        const m = L.mailboxes.find((x) => x.owner === p.sam);
        if (m) {
          m.type = "user";
          m.fullAccess = [];
          m.sendAs = [];
        }
        resetShared(SHARED[p.dept]);
        unmail("m-leaver");
      },
      criteria(p) {
        const u = corpUser(p.sam), L = lab(), m = L.mailboxes.find((x) => x.owner === p.sam), sh = mbx(SHARED[p.dept]);
        return !!u && !u.enabled && u.path === "Lab/Disabled" && u.groups.length === 0 && L.blocked.includes(p.sam) && after(L.sessionsRevoked[p.sam], 7) && !!m && m.type === "shared" && m.fullAccess.includes(p.manager) && !L.licenses[p.sam] && !sh.fullAccess.includes(p.sam) && !sh.sendAs.includes(p.sam);
      }
    },
    // ---------------------------------------------------------------- Printing
    {
      id: 8,
      category: "Printing",
      priority: "Medium",
      tools: ["printmgmt", "services", "terminal"],
      generic: "A department cannot print",
      baseChecks: ["print-queue", "print-test"],
      realWorld: `"I can't print" is one of the most frequent service desk calls. The usual causes are a stopped or crashed Print Spooler and a corrupt job jamming the queue. Find which one it is, clear only the bad job, and prove it works with a test page.`,
      interview: "A department cannot print. How do you troubleshoot? Check the printer and its queue, the Print Spooler service, clear the stuck job, restart the spooler if needed, then print a test page and confirm with the users.",
      roll(r) {
        const printer = r.pick(lab().printers);
        const dept = printer.name.startsWith("HR") ? "HR" : printer.name.startsWith("FIN") ? "Finance" : "IT";
        const people = r.shuffle(users().filter((u) => u.dept === dept));
        const docs = r.shuffle(["Payroll_Summary_Q3.pdf", "Board pack FINAL v7.pdf", "Scanned contracts (412 pages).pdf", "Benefits enrolment forms.pdf", "Asset register export.xlsx", "Annual report draft.docx"]);
        const base = r.int(20, 80);
        const jobs = [0, 1, 2, 3].slice(0, r.int(3, 4)).map((i) => ({ id: base + i, owner: people[i % people.length].sam, document: i === 0 ? docs[0] : r.pick(["Interview schedule.docx", "Leave request.pdf", "Meeting notes.docx", "Expense claim.xlsx", "Rota.xlsx"]), pages: i === 0 ? r.int(180, 420) : r.int(1, 6), minutes: 50 - i * 10 }));
        return { seed: 0, printer: printer.name, dept, jobs, spoolerDown: r.chance(0.6), reporter: people[1]?.sam ?? people[0].sam, reporterName: people[1]?.name ?? people[0].name };
      },
      text: (p) => ({
        title: `${p.dept} cannot print: jobs stuck on ${p.printer}`,
        user: p.reporter,
        summary: `Several people in ${p.dept} say nothing prints on ${p.printer}, and the printer itself shows no error. ${corpUser(p.jobs[0].owner)?.name ?? p.jobs[0].owner} sent a large document just before it stopped. Find out why the queue is not moving, fix it without deleting other people's documents unnecessarily, and prove printing works.`,
        hint: "Print Management shows the queue and its status. Is the Print Spooler service running (Services, or Get-Service Spooler)? A corrupt job at the top of a queue blocks everything behind it: cancel only that one, then print a test page.",
        checks: p.spoolerDown ? ["spooler", "print-queue", "print-test"] : ["print-queue", "print-test"]
      }),
      inject(p) {
        ensureServices();
        const sp = S().services.find((x) => x.Name === "Spooler");
        if (sp) sp.Status = p.spoolerDown ? "Stopped" : "Running";
        const L = lab();
        L.jobs = L.jobs.filter((j) => j.printer !== p.printer);
        for (const [i, j] of p.jobs.entries()) L.jobs.push({ id: j.id, printer: p.printer, owner: j.owner, document: j.document, pages: j.pages, status: i === 0 ? "Error - Printing" : "Queued", submitted: new Date(Date.now() - j.minutes * 6e4).toISOString() });
        delete L.testPages[p.printer];
        if (p.spoolerDown) log(7031, "The Print Spooler service terminated unexpectedly.");
      },
      restore(p) {
        ensureServices();
        const sp = S().services.find((x) => x.Name === "Spooler");
        if (sp) sp.Status = "Running";
        const L = lab();
        L.jobs = L.jobs.filter((j) => j.printer !== p.printer);
      },
      criteria(p) {
        const L = lab(), sp = S().services.find((x) => x.Name === "Spooler");
        return sp?.Status === "Running" && !L.jobs.some((j) => j.printer === p.printer && j.status === "Error - Printing") && after(L.testPages[p.printer], 8);
      }
    },
    // ---------------------------------------------------------------- MFA
    {
      id: 9,
      category: "Identity & MFA",
      priority: "High",
      tools: ["entra"],
      generic: "New phone: a caller needs their MFA reset",
      baseChecks: ["verify"],
      realWorld: "MFA resets are a favourite target of social engineering: attackers phone the help desk pretending to be employees. Real service desks verify identity with a call-back to a number on file or a manager-approved code before resetting anything, and escalate when verification fails.",
      interview: "Someone calls saying they lost their phone and need MFA reset. What do you do, and what if you cannot verify them?",
      roll(r) {
        const u = r.pick(staff());
        return { seed: 0, sam: u.sam, name: u.name, impostor: r.chance(0.3), oldPhone: r.pick(["iPhone 12", "Galaxy S21", "Pixel 6", "iPhone 13 mini"]), newPhone: r.pick(["iPhone 15", "Galaxy S24", "Pixel 8"]) };
      },
      text: (p) => ({
        title: `New phone: reset MFA for ${p.name}?`,
        user: p.sam,
        summary: `A caller says they are ${p.name} (${p.sam}), got a new ${p.newPhone} this weekend and can no longer approve sign-ins. Verify who is calling before you touch anything. If they are who they say, remove the old authenticator, make them register MFA again and sign them out everywhere. If verification fails, change nothing and escalate.`,
        hint: 'Use "Verify caller" on this ticket first. Verified: Entra admin center > Users > the user > Authentication methods: delete the old Microsoft Authenticator, "Require re-register multifactor authentication", then Revoke sessions. Not verified: leave the account alone and use "Escalate to Security".',
        checks: ["verify"]
      }),
      verify: (p) => ({ sam: p.sam, impostor: !!p.impostor, good: "Call back on the mobile number in the HR directory and confirm a one-time code sent to their manager", bad: [["Ask them to confirm their password", "Never ask for a password. A real employee does not need to give it, and an attacker would."], ["They know their manager's name and department, so it is them", "Names and departments are on LinkedIn. That is exactly how help desk social engineering works."]] }),
      inject(p) {
        const L = lab();
        L.methods[p.sam] = [{ id: `${p.sam}-oldapp`, type: "Microsoft Authenticator", detail: `${p.oldPhone} (old phone)`, added: new Date(Date.now() - 500 * 864e5).toISOString() }, { id: `${p.sam}-sms`, type: "Phone (SMS)", detail: `+1 555 01${String(L.methods ? Object.keys(L.methods).length % 90 + 10 : 42)}`, added: new Date(Date.now() - 520 * 864e5).toISOString() }];
        L.reregister[p.sam] = false;
        delete L.verified[p.sam];
        delete (L.impostor || (L.impostor = {}))[p.sam];
        delete (L.escalated || (L.escalated = {}))[9];
      },
      restore(p) {
        const L = lab();
        L.reregister[p.sam] = false;
        delete L.verified[p.sam];
        delete (L.impostor || (L.impostor = {}))[p.sam];
        delete (L.escalated || (L.escalated = {}))[9];
      },
      criteria(p) {
        const L = lab();
        const oldStill = (L.methods[p.sam] ?? []).some((m) => m.id === `${p.sam}-oldapp`);
        if (p.impostor) return !!L.impostor?.[p.sam] && oldStill && !L.reregister[p.sam] && !after(L.sessionsRevoked[p.sam], 9) && after(L.escalated?.[9], 9);
        return !oldStill && !!L.reregister[p.sam] && after(L.sessionsRevoked[p.sam], 9) && after(L.verified[p.sam], 9);
      }
    },
    // ---------------------------------------------------------------- BitLocker
    {
      id: 10,
      category: "Endpoint & encryption",
      priority: "High",
      tools: ["entra"],
      generic: "Laptop stuck on the BitLocker recovery screen",
      baseChecks: ["verify", "bitlocker-view", "bitlocker-provided"],
      realWorld: "Firmware updates, docking changes and TPM resets trigger BitLocker recovery. The key is stored in Entra ID (or AD). Giving out the wrong key wastes the user's time; giving a key to an unverified caller hands over an encrypted laptop.",
      interview: "A user is on the BitLocker recovery screen. Where do you find the key, and how do you make sure it is the right one for the right person?",
      roll(r) {
        const u = r.pick(staff());
        const extra = r.int(1, 2);
        const seeds = Array.from({ length: extra }, () => `${u.sam}-${r.int(1e3, 9999)}`);
        return { seed: 0, sam: u.sam, name: u.name, device: deviceFor(u), seeds, shownIndex: r.int(0, extra), cause: r.pick(["installed a BIOS update last night", "swapped to a new docking station", "had the motherboard replaced under warranty", "reset the TPM while troubleshooting"]) };
      },
      text: (p) => {
        const k = blShown(p);
        return {
          title: `${p.device} stuck on the BitLocker recovery screen`,
          user: p.sam,
          summary: `${p.name} (${p.sam}) ${p.cause}. This morning ${p.device} asks for a BitLocker recovery key. They read this from the screen: "Recovery key ID: ${k.id.slice(0, 8)}…". Verify them, find the matching key for their device, and give them the right recovery key.`,
          hint: `Verify caller first. Entra admin center > Devices > ${p.device} > BitLocker keys. The device has more than one key: match the Key ID the user read out, then use "Provide recovery key" on this ticket.`,
          checks: ["verify", "bitlocker-view", "bitlocker-provided"]
        };
      },
      verify: (p) => ({ sam: p.sam, impostor: false, good: "Call them back on the desk phone listed in the HR directory and confirm their employee number", bad: [["Read the key to whoever is calling, it is urgent", "Urgency is the attacker's favourite tool. Verify first, every time."], ["Email the key to the personal address they give you", "Recovery keys never go to unverified or personal addresses."]] }),
      provideKey: (p) => {
        const k = blShown(p);
        return { device: p.device, key: k.key, shown: k.id.slice(0, 8), owner: p.name };
      },
      inject(p) {
        const L = lab();
        let d = L.devices.find((x) => x.name === p.device);
        if (!d) {
          d = { name: p.device, owner: p.sam, os: "Windows 11 Enterprise 23H2", compliant: true, lastSync: nowIso(), keys: [] };
          L.devices.push(d);
        }
        d.keys = d.keys.filter((k) => !p.seeds.some((s) => k.id === keyId(s)));
        p.seeds.forEach((s, i) => d.keys.push({ id: keyId(s), key: recoveryKey(s), created: new Date(Date.now() - (i + 1) * 3 * 864e5).toISOString() }));
        delete L.bitlockerProvided[p.device];
        delete L.verified[p.sam];
      },
      restore(p) {
        const L = lab();
        delete L.bitlockerProvided[p.device];
        delete L.verified[p.sam];
      },
      criteria(p) {
        const L = lab();
        return L.bitlockerProvided[p.device] === blShown(p).key && after(L.verified[p.sam], 10);
      }
    },
    // ---------------------------------------------------------------- Phishing
    {
      id: 11,
      category: "Security incident",
      priority: "Critical",
      tools: ["outlook", "m365", "entra", "directory"],
      generic: "Phishing reported by a user",
      baseChecks: ["phish-headers", "phish-report", "explorer"],
      realWorld: "Phishing is the most common way accounts are compromised. Tier 1 contains it: confirm with the headers, purge the message tenant-wide, block the sender, and if credentials were entered reset the password and revoke sessions, then escalate to security with what you found.",
      interview: "A user clicked a phishing link. What do you do if they entered their password, and what if they did not?",
      roll(r) {
        const domain = r.pick(["corp-example-payments.com", "corpexample-sharepoint.net", "docusign-corp-example.com", "corp-example-hr-portal.org", "microsoft-corp-example.support"]);
        const lure = r.pick([
          { subject: "URGENT Invoice #{n} overdue – payment details required", from: "billing", display: "CORP Payroll", text: "Your department has an overdue invoice. To avoid late fees, sign in within 24 hours to confirm payment details:" },
          { subject: "You have a new shared document: Q{q} salary review.xlsx", from: "share", display: "SharePoint Online", text: "A colleague shared a confidential file with you. Sign in to view it before the link expires:" },
          { subject: "Action required: your mailbox password expires today", from: "it-support", display: "IT Helpdesk", text: "Your password expires in 2 hours. Keep your current password by verifying here:" },
          { subject: "Please review and sign: Employment agreement amendment", from: "dse", display: "DocuSign", text: "You have a document waiting for your signature. Review and sign:" }
        ]);
        const reporter = r.pick(staff());
        const others = r.shuffle(users().filter((u) => u.sam !== reporter.sam && u.enabled)).slice(0, r.int(1, 3)).map((u) => u.sam);
        return { seed: 0, domain, from: lure.from, display: lure.display, subject: lure.subject.replace("{n}", String(r.int(1e4, 99999))).replace("{q}", String(r.int(1, 4))), text: lure.text, path: r.pick(["sso/login", "auth/verify", "secure/signin"]), reporter: reporter.sam, reporterName: reporter.name, recipients: [reporter.sam, ...others], entered: r.chance(0.6), ip: `203.0.113.${r.int(2, 250)}` };
      },
      text: (p) => ({
        title: p.entered ? `Phishing: ${p.reporterName} entered their password on a fake page` : `Phishing reported by ${p.reporterName}`,
        user: p.reporter,
        summary: `${p.reporterName} (${p.reporter}) forwarded a suspicious "${p.subject}" email to the service desk mailbox. ${p.entered ? "They say they typed their password into the page it opened." : "They opened the link but closed the page without typing anything."} The same message reached other people. Confirm it is phishing, remove it from every mailbox, and stop more arriving.${p.entered ? " Then secure their account." : ""}`,
        hint: `Outlook: View message details (sender domain, Return-Path, SPF/DMARC), then Report phishing. Microsoft 365 admin > Explorer: search the sender and soft delete it from all mailboxes; Tenant Allow/Block List: block the domain.${p.entered ? ` Then reset ${p.reporter}'s password (ADUC or M365) and revoke their sessions.` : " No credentials were entered, so a password reset is not required."}`,
        checks: ["phish-headers", "phish-report", "explorer"]
      }),
      inject(p) {
        const L = lab();
        const original2 = ["Dear colleague,", "", p.text, `https://${p.domain}/${p.path}`, "", p.display].join(NL);
        const headers = [`From: "${p.display}" <${p.from}@${p.domain}>`, `Reply-To: <collect@${p.domain}>`, `Return-Path: <bounce-${p.ip.split(".").pop()}@mailer.${p.domain}>`, `To: ${p.recipients.map((s) => `${s}@${DOMAIN}`).join(", ")}`, `Received: from mailer.${p.domain} (${p.ip})`, `Authentication-Results: spf=fail (sender IP is ${p.ip}) smtp.mailfrom=${p.domain}; dkim=none; dmarc=fail action=none header.from=${p.domain}`, "X-MS-Exchange-Organization-SCL: 5"].join(NL);
        mail({
          id: "m-phish-fwd",
          from: `${p.reporter}@${DOMAIN}`,
          fromName: p.reporterName,
          subject: `FW: ${p.subject}`,
          phishing: true,
          headers,
          body: [p.entered ? "Hi IT, I clicked this and put my password in before I noticed the address looked odd. Sorry! Can you check?" : "Hi IT, this looks suspicious. I opened the link but closed it without typing anything.", first({ name: p.reporterName }), "", "-------- Forwarded message (attached) --------", `From: ${p.display} <${p.from}@${p.domain}>`, `Subject: ${p.subject}`, "", original2].join(NL)
        });
        mail({ id: "m-phish", from: `${p.from}@${p.domain}`, fromName: p.display, to: `${p.reporter}@${DOMAIN}`, subject: p.subject, body: original2, hidden: true, read: true, recipients: p.recipients, headers });
        L.blockedSenders = L.blockedSenders.filter((x) => !x.includes(p.domain));
      },
      restore() {
        unmail("m-phish");
        unmail("m-phish-fwd");
      },
      criteria(p) {
        const L = lab(), u = corpUser(p.reporter);
        return L.purged.includes("m-phish") && L.blockedSenders.some((x) => x.includes(p.domain)) && (!p.entered || after(u?.passwordLastSet, 11) && after(L.sessionsRevoked[p.reporter], 11));
      }
    },
    // ---------------------------------------------------------------- Shared mailbox access
    {
      id: 12,
      category: "Microsoft 365 access",
      priority: "Low",
      tools: ["outlook", "m365"],
      generic: "Access request: shared mailbox",
      baseChecks: ["mailbox-approval"],
      realWorld: "Access requests are daily work. The rule is least privilege with recorded approval: grant what the owner approved, to the person named, and note the approval on the ticket.",
      interview: "Someone asks for access to a shared mailbox. What do you check before you grant it?",
      roll(r) {
        const address = r.pick(Object.keys(BASELINE));
        const owner = corpUser(BASELINE[address].fa[0]);
        const requester = r.pick(staff().filter((u) => !BASELINE[address].fa.includes(u.sam)));
        return { seed: 0, address, mailboxName: mbx(address)?.name ?? address, owner: owner.sam, ownerName: owner.name, sam: requester.sam, name: requester.name, sendAs: r.chance(0.5), reason: r.pick(["covers the inbox while a colleague is on leave", "joins the team rota for the shared inbox", "handles supplier emails for the next quarter"]) };
      },
      text: (p) => ({
        title: `Access request: ${p.mailboxName} mailbox for ${p.name}`,
        user: p.sam,
        summary: `${p.name} (${p.sam}) needs access to the ${p.mailboxName} shared mailbox (${p.address}): ${p.reason}. Check what the mailbox owner approved, then grant exactly that, nothing more.`,
        hint: `Read the approval in Outlook. Microsoft 365 admin > Shared mailboxes > ${p.mailboxName}: add ${p.sam} to what was approved (Read and manage, and Send as only if approved). Do not add anyone else.`,
        checks: ["mailbox-approval"]
      }),
      inject(p) {
        resetShared(p.address);
        mail({
          id: "m-approval",
          from: `${p.owner}@${DOMAIN}`,
          fromName: p.ownerName,
          subject: `Approved: ${p.mailboxName} mailbox access for ${p.name}`,
          evidence: "mailbox-approval",
          body: ["Hi IT,", "", `As owner of the ${p.mailboxName} shared mailbox I approve access for ${p.name} (${p.sam}): ${p.reason}.`, "", p.sendAs ? `They need to read the mailbox and send as ${p.address}.` : `Read access only, please. They must NOT send as ${p.address}.`, "", "No one else needs access.", "", p.ownerName].join(NL)
        });
      },
      restore(p) {
        resetShared(p.address);
        unmail("m-approval");
      },
      criteria(p) {
        const m = mbx(p.address), b = BASELINE[p.address];
        const faOk = m.fullAccess.includes(p.sam) && m.fullAccess.every((x) => b.fa.includes(x) || x === p.sam);
        const saOk = p.sendAs ? m.sendAs.includes(p.sam) && m.sendAs.every((x) => b.sa.includes(x) || x === p.sam) : !m.sendAs.includes(p.sam) && m.sendAs.every((x) => b.sa.includes(x));
        return !!m && faOk && saOk;
      }
    }
  ];
  function blShown(p) {
    const owner = corpUser(p.sam);
    const all = [`${p.sam}-a`, ...p.seeds];
    const seed = all[Math.min(p.shownIndex + 1, all.length - 1)] ?? all[0];
    void owner;
    return { id: keyId(seed), key: recoveryKey(seed) };
  }
  var LAB = new Map(LABS.map((l) => [l.id, l]));
  var labById = (id) => LAB.get(id);
  var runOf = (id) => runs()[id];
  function applyText(l) {
    const p = runs()[l.id];
    const t = TICKETS().find((x) => x.id === l.id) ?? (() => {
      const x = { id: l.id, lab: true };
      TICKETS().push(x);
      return x;
    })();
    if (p) Object.assign(t, l.text(p), { category: l.category, priority: l.priority, lab: true });
    else Object.assign(t, { title: l.generic, user: "Assigned on start", category: l.category, priority: l.priority, lab: true, checks: l.baseChecks, hint: "Start the incident to receive the details.", summary: `${l.generic}. Start the incident to receive the caller, the people involved and the details. Every run is a different scenario, so you have to read the ticket and investigate rather than remember an answer.` });
  }
  LABS.sort((a, b) => a.id - b.id).forEach(applyText);
  Object.assign(CHECK_LABELS(), {
    "onboard-request": "Read the approved onboarding request",
    sync: "Run an Entra Connect delta sync",
    "leaver-notice": "Read the HR leaver notice",
    "mover-notice": "Read the HR transfer notice",
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
    const p = runs()[l.id];
    if (!p) return false;
    try {
      return l.criteria(p);
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
      toast('This ticket is resolved. Use "Practise again" for a new scenario, or reset the lab.');
      return;
    }
    if (s.active === id) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 2147483647)) >>> 0;
    const p = { ...l.roll(rng(seed)), seed };
    runs()[id] = p;
    l.inject(p);
    started()[id] = nowIso();
    applyText(l);
    s.statuses[id] = "In progress";
    s.active = id;
    s.evidence[id] = [];
    log(9e3, `LAB-${pad(id)} started: ${l.text(p).title}`);
    save();
    redrawDesk();
    toast(`Incident started. Tools for this one: ${l.tools.map(toolName).join(", ")}.`);
  };
  var oldCancel = G.cancelIncident;
  G.cancelIncident = (id) => {
    const l = LAB.get(id);
    if (!l) return oldCancel(id);
    if (!confirm("Cancel this incident and restore the affected baseline?")) return;
    const p = runs()[id];
    if (p) l.restore(p);
    delete runs()[id];
    applyText(l);
    const s = S();
    s.statuses[id] = "New";
    s.active = null;
    s.evidence[id] = [];
    log(9002, `LAB-${pad(id)} cancelled; baseline restored`);
    save();
    redrawDesk();
  };
  function practiseAgain(id) {
    const s = S();
    if (s.active) {
      toast("Resolve or cancel the current incident first.");
      return;
    }
    const l = LAB.get(id);
    if (l) {
      delete runs()[id];
      applyText(l);
    }
    s.statuses[id] = "New";
    s.evidence[id] = [];
    log(9003, `LAB-${pad(id)} reopened for practice${l ? " with a new scenario" : ""}`);
    save();
    redrawDesk();
  }
  function toolName(id) {
    return APPS().find((a) => a.id === id)?.name ?? { outlook: "Outlook", directory: "Active Directory Users and Computers", m365: "Microsoft 365 admin center", entra: "Microsoft Entra admin center", printmgmt: "Print Management", services: "Services", terminal: "Windows PowerShell" }[id] ?? id;
  }
  function openTicket(id) {
    openApp("tickets");
    ticketView = id;
    G.renderTickets();
  }
  var _a4;
  ((_a4 = G).CorpDesk || (_a4.CorpDesk = {})).openTicket = openTicket;
  function verifyDialog(l, p) {
    const v = l.verify(p);
    const options = rng(p.seed + 7).shuffle([[v.good, ""], ...v.bad]);
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
        log(9010, `LAB-${pad(l.id)}: unsafe verification method chosen`);
        return false;
      }
      const L = lab();
      evidence("verify");
      if (v.impostor) {
        (L.impostor || (L.impostor = {}))[v.sam] = true;
        log(9014, `${v.sam}: call-back reached the real employee, who did not call the service desk`);
        save();
        setTimeout(() => dialog("Verification failed", h("div", null, h("p", null, `You called ${corpUser(v.sam)?.name ?? v.sam} back on the number in the HR directory. They answered from their own phone: they still have it and did not call the service desk.`), h("p", null, h("b", null, "This is a social engineering attempt. "), "Do not change the account. Escalate to Security with the caller's details.")), [["Understood", () => void 0, "primary"]]), 0);
        return;
      }
      L.verified[v.sam] = nowIso();
      log(9011, `${v.sam}: identity verified by call-back`);
      save();
      toast("Caller verified: the call-back and the code check out.");
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function provideKeyDialog(l, p) {
    const k = l.provideKey(p);
    const input = h("input", { class: "ad2-input", placeholder: "000000-000000-000000-000000-000000-000000-000000-000000", "aria-label": "Recovery key" });
    dialog(`Provide recovery key to ${k.owner} (${k.device})`, h("div", null, h("p", null, `Paste the 48-digit recovery key whose Key ID starts with ${k.shown}.`), input), [["Read key to user", () => {
      const v = input.value.trim();
      if (!/^\d{6}(-\d{6}){7}$/.test(v)) {
        toast("A BitLocker recovery key is 48 digits in eight groups of six.");
        return false;
      }
      lab().bitlockerProvided[k.device] = v;
      if (v === k.key) {
        evidence("bitlocker-provided");
        log(9012, `${k.device}: correct recovery key provided, device unlocked`);
        toast(`${k.device} unlocked and booted to Windows.`);
      } else {
        log(9013, `${k.device}: recovery key rejected`);
        toast("The laptop says the key is wrong. Check you matched the Key ID the user read out.");
      }
      save();
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function decorate() {
    const grid2 = document.querySelector("#appBody .sd-detail-grid");
    if (!grid2 || grid2.dataset.lab) return;
    const id = Number(/LAB-(\d+)/.exec(document.querySelector("#appBody .page-top h1, #appBody h1")?.textContent ?? "")?.[1]);
    if (!id) return;
    grid2.dataset.lab = String(id);
    const s = S();
    const l = LAB.get(id);
    const p = runs()[id];
    const activeHere = s.active === id;
    const resolved = ["Resolved", "Closed"].includes(s.statuses[id]);
    const L = lab();
    const v = l?.verify && p ? l.verify(p) : null;
    const panelEl = h(
      "div",
      { class: "panel ia-labpanel" },
      l ? [h("h3", null, "Tools for this incident"), h("div", { class: "ia-toolbtns" }, l.tools.map((t) => h("button", { class: "secondary", type: "button", onClick: () => openApp(t) }, toolName(t))))] : null,
      v ? h(
        "div",
        { class: "ia-verify" },
        h("b", null, "Caller verification: "),
        L.impostor?.[v.sam] && activeHere ? [h("span", { class: "ia-bad" }, "failed (not the real employee) "), after(L.escalated?.[id], id) ? "escalated ✓" : h("button", { class: "primary", type: "button", onClick: () => {
          (L.escalated || (L.escalated = {}))[id] = nowIso();
          evidence("escalate");
          log(9020, `LAB-${pad(id)}: impersonation attempt escalated to Security`);
          save();
          G.renderTickets();
        } }, "Escalate to Security")] : after(L.verified[v.sam], id) ? "verified ✓" : h("button", { class: "primary", type: "button", disabled: !activeHere, onClick: () => verifyDialog(l, p) }, "Verify caller")
      ) : null,
      l?.provideKey && p ? h("div", { class: "ia-verify" }, h("b", null, "Recovery key: "), h("button", { class: "secondary", type: "button", disabled: !activeHere, onClick: () => provideKeyDialog(l, p) }, "Provide recovery key")) : null,
      l ? h("details", null, h("summary", null, "Why this matters in a real job"), h("p", null, l.realWorld), h("p", null, h("b", null, "Interview practice: "), l.interview)) : null,
      resolved ? h("div", { class: "ia-verify" }, h("button", { class: "secondary", type: "button", onClick: () => practiseAgain(id) }, l ? "Practise again with a new scenario" : "Practise this incident again")) : null,
      l && !activeHere && !resolved ? h("p", { class: "ia-muted" }, "Start the incident to receive a new scenario and unlock these steps.") : null
    );
    const left = grid2.firstElementChild;
    left?.insertBefore(panelEl, left.children[1] ?? null);
  }
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  for (const l of LABS) applyText(l);
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
      const rows = lab().printers.map((p) => `${p.name.padEnd(12)} ${"LAB-DC01".padEnd(12)} ${p.driver.padEnd(30)} ${p.port}`);
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
      return ok(jobs.length ? `Id  ComputerName PrinterName DocumentName                     JobStatus
--  ------------ ----------- ------------                     ---------
${jobs.map((j) => `${String(j.id).padEnd(3)} LAB-DC01     ${j.printer.padEnd(11)} ${j.document.slice(0, 32).padEnd(32)} ${j.status}`).join("\n")}` : "");
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
    { id: "jml", title: "2. Joiners, movers and leavers (JML)", goal: "Build, change and remove access exactly as HR and managers request it: the full identity lifecycle.", labs: [6, 13, 4, 7], skills: ["AD users, OUs and role groups", "Entra Connect sync", "Licences and mailboxes", "Removing old access on transfer", "Disable, do not delete"] },
    { id: "identity", title: "3. Identity, MFA and access", goal: "Change sign-in and permissions safely, with verification and least privilege.", labs: [9, 12, 3], skills: ["Caller verification against social engineering", "MFA re-registration and session revocation", "Shared mailbox permissions", "Local admin rights review"] },
    { id: "endpoint", title: "4. Devices, printing and policy", goal: "Fix the endpoint problems users call about every day.", labs: [8, 10, 5], skills: ["Print Spooler and print queues", "BitLocker recovery keys", "Group Policy scope and gpupdate"] },
    { id: "security", title: "5. Security incident response", goal: "Contain a phishing compromise the way a Tier 1 analyst would.", labs: [11], skills: ["Reading email headers (SPF, DKIM, DMARC)", "Tenant-wide message removal", "Password reset and session revocation"] }
  ];
  var ORDER = MODULES.flatMap((m) => m.labs);
  var TOOLS2 = [
    ["tickets", "Service Desk (ServiceNow, Jira Service Management, Freshservice)", "Your queue: every piece of work starts and ends here."],
    ["directory", "Active Directory Users and Computers", "Run dsa.msc, or Server Manager > Tools."],
    ["m365", "Microsoft 365 admin center", "admin.microsoft.com: users, licences, mailboxes, Explorer."],
    ["entra", "Microsoft Entra admin center", "entra.microsoft.com: users (incl. cloud-only), MFA methods, sessions, devices and BitLocker keys."],
    ["outlook", "Outlook", "outlook.office.com: the shared service desk mailbox."],
    ["services", "Services", "Run services.msc. Also Get-Service / Restart-Service."],
    ["printmgmt", "Print Management", "Run printmanagement.msc. Also Get-PrintJob / Remove-PrintJob."],
    ["terminal", "Windows PowerShell", "Get-ADUser, Unlock-ADAccount, Start-ADSyncSyncCycle, gpupdate /force."],
    ["events", "Event Viewer", "Run eventvwr.msc. Lockouts (4740), logons (4624/4625), service crashes (7031)."],
    ["rdp", "Remote Desktop Connection", "Run mstsc. Help a user on their PC, or test a sign-in with the passwords in Pwd."],
    ["pwd", "Pwd (training passwords)", "Desktop\\Pwd.txt. In a real job you would never keep this file: use a password manager."],
    ["taskmanager", "Task Manager", "Ctrl+Shift+Esc, or Run taskmgr. Processes, performance, startup apps."],
    ["control", "Control Panel", "Run control. Windows Tools, Programs and Features, Mouse."]
  ];
  var status2 = (id) => S().statuses?.[id] ?? "New";
  var done = (id) => ["Resolved", "Closed"].includes(status2(id));
  var ticket = (id) => TICKETS().find((t) => t.id === id);
  var nextLab = () => S().active && ORDER.includes(S().active) ? S().active : ORDER.find((id) => !done(id));
  var pct = () => Math.round(ORDER.filter(done).length / ORDER.length * 100);
  var earned = () => ORDER.every(done);
  var practice = () => S().customTickets ?? [];
  var pad2 = (n) => String(n).padStart(3, "0");
  function startOrOpen(id) {
    const s = S();
    if (!s.active && status2(id) === "New") {
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
  function askName(after2) {
    const input = h("input", { class: "ad2-input", value: lab().certName ?? S().technician ?? "", placeholder: "First and last name", "aria-label": "Your full name" });
    dialog("Your name for the certificate", h("div", null, h("p", null, "Type your full name exactly as you want it printed on your IT Support Career Path certificate. You can change it later in the Certificate tab."), input), [["Save", () => {
      const v = input.value.trim().replace(/\s+/g, " ");
      if (v.length < 3) {
        toast("Enter your full name.");
        return false;
      }
      lab().certName = v;
      save();
      after2?.();
    }, "primary"], ["Later", () => void 0]]);
  }
  var certId = (name, date) => {
    let x = 2166136261;
    for (const c of `${name}|${date}`) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
    return `CDK-${date.slice(0, 4)}-${(x >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
  };
  var SEAL = '<defs><radialGradient id="sg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f3d27a"/><stop offset=".7" stop-color="#c99a2e"/><stop offset="1" stop-color="#9c7419"/></radialGradient></defs><g transform="translate(60 60)">' + Array.from({ length: 24 }, (_, i) => `<path d="M0 -58 L6 -46 L-6 -46Z" fill="#b8892a" transform="rotate(${i * 15})"/>`).join("") + '<circle r="47" fill="url(#sg)" stroke="#8a6512" stroke-width="2"/><circle r="38" fill="none" stroke="#fff6d6" stroke-width="1.2" stroke-dasharray="2 3"/><text y="-8" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#5a3e06" letter-spacing="2">CORP DESK</text><text y="9" text-anchor="middle" font-family="Georgia,serif" font-size="16" font-weight="700" fill="#5a3e06">IT</text><text y="24" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="#5a3e06" letter-spacing="1.5">SUPPORT</text></g>';
  function showCertificate() {
    const name = lab().certName;
    if (!name) {
      askName(showCertificate);
      return;
    }
    const ok = earned();
    const date = lab().certIssued ?? (ok ? (/* @__PURE__ */ new Date()).toISOString() : (/* @__PURE__ */ new Date()).toISOString());
    if (ok && !lab().certIssued) {
      lab().certIssued = date;
      save();
    }
    const nice = new Date(date).toLocaleDateString(void 0, { day: "numeric", month: "long", year: "numeric" });
    const skills = ["Ticket lifecycle and documentation", "Active Directory user and group administration", "Joiner, mover and leaver (JML) processes", "Microsoft 365 licences and mailboxes", "Entra ID, MFA and session management", "Caller verification and social engineering defence", "Printing and Windows services troubleshooting", "BitLocker recovery and endpoint support", "Phishing triage and containment", "DNS, Group Policy and least privilege"];
    const seal = document.createElement("span");
    seal.className = "cert-seal";
    seal.innerHTML = `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${SEAL}</svg>`;
    const cert = h(
      "div",
      { class: `cert ${ok ? "" : "preview"}`, role: "document", "aria-label": "Certificate of completion" },
      h(
        "div",
        { class: "cert-frame" },
        h("div", { class: "cert-issuer" }, "CORP DESK · IT SUPPORT TRAINING PROGRAM"),
        h("h1", { class: "cert-title" }, "Certificate of Completion"),
        h("div", { class: "cert-rule" }),
        h("p", { class: "cert-intro" }, "This is to certify that"),
        h("div", { class: "cert-name" }, name),
        h("p", { class: "cert-text" }, `has successfully completed the IT Support Career Path, a hands-on program of ${ORDER.length} randomized, real-world service desk incidents performed in a simulated enterprise environment with Active Directory, Microsoft 365, Microsoft Entra ID, Windows services and endpoint tools, each validated against the live system state.`),
        h("div", { class: "cert-skills" }, skills.map((s) => h("span", null, s))),
        h(
          "div",
          { class: "cert-foot" },
          h("div", { class: "cert-sign" }, h("div", { class: "cert-sig" }, "Erick Omari"), h("div", { class: "cert-line" }), h("b", null, "Erick Omari"), h("small", null, "Program Creator, CORP Desk")),
          seal,
          h("div", { class: "cert-sign" }, h("div", { class: "cert-date" }, nice), h("div", { class: "cert-line" }), h("b", null, "Date of completion"), h("small", null, `Certificate ID ${certId(name, date)}`))
        ),
        h("p", { class: "cert-note" }, "Completed in the CORP Desk training simulator. Skills were practised on simulated systems; no real accounts or devices were changed.")
      ),
      ok ? null : h("div", { class: "cert-watermark" }, `PREVIEW · ${ORDER.filter(done).length} of ${ORDER.length} labs`)
    );
    const shade = h(
      "div",
      { class: "cert-shade" },
      h(
        "div",
        { class: "cert-bar" },
        h("span", null, ok ? 'Your certificate is ready. Print it or "Save as PDF" from the print dialog.' : `Finish all ${ORDER.length} labs to unlock printing. This is a preview.`),
        h("button", { class: "ad2-btn", type: "button", onClick: () => askName(() => {
          shade.remove();
          showCertificate();
        }) }, "Change name"),
        h("button", { class: "ad2-btn primary", type: "button", disabled: !ok, onClick: () => {
          document.body.classList.add("printing-cert");
          window.print();
          setTimeout(() => document.body.classList.remove("printing-cert"), 500);
        } }, "Print / Save as PDF"),
        h("button", { class: "ad2-btn", type: "button", onClick: () => shade.remove() }, "Close")
      ),
      cert
    );
    document.body.appendChild(shade);
  }
  function exportPortfolio() {
    const name = lab().certName ?? S().technician ?? "Technician";
    const lines = [`# ${name}: IT Support hands-on lab portfolio`, "", `Completed in CORP Desk, a Windows and Microsoft 365 service desk simulator, between ${(/* @__PURE__ */ new Date()).toLocaleDateString()} and now.`, "", `**Progress:** ${ORDER.filter(done).length} of ${ORDER.length} career-path labs resolved${earned() ? " (certificate earned)" : ""}; ${practice().filter((t) => done(t.id)).length} practice tickets resolved.`, ""];
    for (const m of MODULES) {
      lines.push(`## ${m.title}`, "", m.goal, "", `Skills: ${m.skills.join(", ")}.`, "");
      for (const id of m.labs) {
        const t = ticket(id), l = labById(id);
        lines.push(`### LAB-${pad2(id)}: ${t?.title ?? ""} — ${done(id) ? "Resolved ✅" : status2(id)}`, "");
        if (done(id)) {
          lines.push(`- **Scenario:** ${t?.summary ?? ""}`);
          if (l) lines.push(`- **Tools:** ${l.tools.map(toolName).join(", ")}`);
          const notes = (S().notes?.[id] ?? "").trim();
          if (notes) lines.push(`- **My resolution notes:** ${notes.replace(/\s+/g, " ")}`);
          if (l) lines.push(`- **Why it matters:** ${l.realWorld}`);
          lines.push("");
        }
      }
    }
    const p = practice();
    if (p.length) {
      lines.push("## Practice tickets", "");
      for (const t of p) lines.push(`- ${t.title} — ${status2(t.id)}${(S().notes?.[t.id] ?? "").trim() ? `: ${S().notes[t.id].replace(/\s+/g, " ")}` : ""}`);
      lines.push("");
    }
    lines.push("---", "", "Built with CORP Desk by Erick Omari: https://corpdesk-it-support-lab.vercel.app", "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    a.download = `CORP-Desk-Portfolio-${name.replace(/\s+/g, "-")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    toast("Portfolio exported. Add screenshots, then post it (see LABS-AND-PORTFOLIO-GUIDE.md).");
  }
  var KEEP_KEY = "corpdesk-reset-keep";
  function resetDialog() {
    const keep = h("input", { type: "checkbox", checked: true });
    const typed = h("input", { class: "ad2-input", placeholder: "RESET", "aria-label": "Type RESET to confirm" });
    dialog("Reset the lab and start over", h(
      "div",
      null,
      h("p", null, "This erases every incident, your notes, practice tickets, settings and changes you made in every tool, and starts the lab fresh with new random scenarios."),
      h("label", { class: "ad2-check" }, keep, "Keep my name (sign-in and certificate)"),
      h("label", { class: "ad2-field" }, "Type RESET to confirm", typed)
    ), [["Reset everything", () => {
      if (typed.value.trim().toUpperCase() !== "RESET") {
        toast("Type RESET to confirm.");
        return false;
      }
      try {
        if (keep.checked) localStorage.setItem(KEEP_KEY, JSON.stringify({ technician: S().technician, certName: lab().certName }));
        localStorage.removeItem("corpdesk-lab-v1");
        localStorage.removeItem("corpdesk-custom-lock-screen");
      } catch {
      }
      G.save = () => void 0;
      location.reload();
    }, "primary"], ["Cancel", () => void 0]]);
  }
  function applyResetKeep() {
    try {
      const raw = localStorage.getItem(KEEP_KEY);
      if (!raw) return;
      localStorage.removeItem(KEEP_KEY);
      const keep = JSON.parse(raw);
      if (keep.technician) {
        S().technician = keep.technician;
        const t = document.getElementById("technician");
        if (t) t.value = keep.technician;
      }
      if (keep.certName) lab().certName = keep.certName;
      save();
    } catch {
    }
  }
  var _a5;
  ((_a5 = G).CorpDesk || (_a5.CorpDesk = {})).resetLab = resetDialog;
  var tab3 = "path";
  function draw(host) {
    if (!lab().certName && !host.dataset.asked) {
      host.dataset.asked = "1";
      setTimeout(() => askName(), 50);
    }
    const next = nextLab();
    const nt = next ? ticket(next) : null;
    const labRow = (id) => {
      const t = ticket(id), l = labById(id), st = status2(id);
      return h(
        "div",
        { class: `pw-lab ${done(id) ? "done" : ""} ${S().active === id ? "active" : ""}` },
        h("span", { class: "pw-dot" }, done(id) ? svg(ICON.check, 14) : String(ORDER.indexOf(id) + 1)),
        h("div", { class: "pw-lab-text" }, h("b", null, `LAB-${pad2(id)} · ${t?.title ?? ""}`), h("small", null, `${t?.category ?? ""} · ${t?.priority ?? ""} priority${l ? ` · Tools: ${l.tools.map(toolName).join(", ")}` : ""}${l && !runOf(id) && !done(id) ? " · new random scenario on start" : ""}`)),
        h("span", { class: `pw-status s-${st.replace(/\s+/g, "").toLowerCase()}` }, st),
        done(id) && !S().active ? h("button", { class: "secondary", type: "button", onClick: () => practiseAgain(id) }, "Practise again") : null,
        h("button", { class: done(id) ? "secondary" : "primary", type: "button", onClick: () => startOrOpen(id) }, done(id) ? "Review" : S().active === id ? "Continue" : "Start")
      );
    };
    let page2;
    if (tab3 === "path") {
      page2 = h("div", { class: "pw-modules" }, MODULES.map((m) => h(
        "section",
        { class: "pw-module" },
        h("div", { class: "pw-mhead" }, h("div", null, h("h3", null, m.title), h("p", null, m.goal)), h("span", { class: "pw-count" }, `${m.labs.filter(done).length}/${m.labs.length}`)),
        h("div", { class: "pw-skills" }, m.skills.map((s) => h("span", null, s))),
        m.labs.map(labRow)
      )));
    } else if (tab3 === "practice") {
      const list = practice();
      page2 = h(
        "div",
        null,
        h("p", { class: "pw-intro" }, 'Tickets you create in the Service Desk ("New" or "Generate practice tickets") show up here. They are extra practice: they count in your portfolio, not toward the certificate, because they have no automatic acceptance checks.'),
        h("div", { class: "pw-stats" }, h("div", null, h("b", null, String(list.length)), h("small", null, "practice tickets")), h("div", null, h("b", null, String(list.filter((t) => done(t.id)).length)), h("small", null, "resolved")), h("div", null, h("b", null, String(list.filter((t) => status2(t.id) === "In progress").length)), h("small", null, "in progress"))),
        list.length ? h("section", { class: "pw-module" }, list.map((t) => h(
          "div",
          { class: `pw-lab ${done(t.id) ? "done" : ""}` },
          h("span", { class: "pw-dot" }, done(t.id) ? svg(ICON.check, 14) : "•"),
          h("div", { class: "pw-lab-text" }, h("b", null, `LAB-${pad2(t.id)} · ${t.title}`), h("small", null, `${t.category ?? "Request"} · ${t.generated ? "Generated practice ticket" : "Ticket you created"}`)),
          h("span", { class: `pw-status s-${status2(t.id).replace(/\s+/g, "").toLowerCase()}` }, status2(t.id)),
          h("button", { class: "secondary", type: "button", onClick: () => openTicket(t.id) }, "Open")
        ))) : h("div", { class: "ad2-empty" }, 'No practice tickets yet. In the Service Desk, use "Generate practice tickets" or create a New incident.'),
        h("div", { class: "ad2-row" }, h("button", { class: "primary", type: "button", onClick: () => openApp("tickets") }, "Open the Service Desk"))
      );
    } else if (tab3 === "tools") {
      page2 = h(
        "div",
        { class: "pw-tools" },
        h("p", { class: "pw-intro" }, "These are the tools a service desk technician lives in. Each one here works like the real thing, so you will know where to click on your first day."),
        TOOLS2.map(([id, name, how]) => h("button", { class: "pw-tool", type: "button", onClick: () => openApp(id) }, (() => {
          const s = document.createElement("span");
          s.className = "pw-tool-icon";
          s.innerHTML = APPS().find((a) => a.id === id)?.icon ?? "";
          return s;
        })(), h("span", null, h("b", null, name), h("small", null, how))))
      );
    } else if (tab3 === "ready") {
      page2 = h(
        "div",
        { class: "pw-ready" },
        h("p", { class: "pw-intro" }, "Practise answering out loud. Each question is one interviewers ask service desk and desktop support candidates, and each lab is your real example."),
        h("div", { class: "ad2-row" }, h("button", { class: "primary", type: "button", onClick: exportPortfolio }, "Export my portfolio (Markdown)"), h("span", { class: "ad2-muted" }, "Your completed labs, scenarios and resolution notes, ready for LinkedIn and GitHub.")),
        ORDER.map((id) => {
          const l = labById(id), t = ticket(id);
          return h("details", { class: "pw-q" }, h("summary", null, l?.interview ?? `Tell me how you would handle: ${t?.title}`), h("p", null, l?.realWorld ?? t?.summary ?? ""), h("p", { class: "pw-proof" }, done(id) ? `✓ You have done this: LAB-${pad2(id)}. Use it as your example.` : `Do LAB-${pad2(id)} to have a real example.`));
        })
      );
    } else {
      page2 = h(
        "div",
        { class: "pw-cert-tab" },
        h(
          "div",
          { class: "pw-cert-card" },
          h("h3", null, "Certificate of Completion"),
          h("p", null, earned() ? "You finished every lab. Your certificate is ready to print or save as PDF." : `Finish all ${ORDER.length} career-path labs to earn it. ${ORDER.filter(done).length} done so far.`),
          h("p", null, h("b", null, "Name on certificate: "), lab().certName ?? h("i", null, "not set")),
          h("div", { class: "ad2-row" }, h("button", { class: "secondary", type: "button", onClick: () => askName() }, lab().certName ? "Change name" : "Set my name"), h("button", { class: "primary", type: "button", onClick: showCertificate }, earned() ? "Open certificate" : "Preview certificate"))
        ),
        h("div", { class: "pw-cert-card" }, h("h3", null, "Start over"), h("p", null, "Reset the whole lab: every incident, note, practice ticket and change. New random scenarios are rolled when you start each lab again."), h("button", { class: "secondary", type: "button", onClick: resetDialog }, "Reset lab..."))
      );
    }
    host.append(h(
      "div",
      { class: "pw" },
      h(
        "header",
        { class: "pw-hero" },
        ring(pct(), 76),
        h("div", null, h("h1", null, "IT Support Career Path"), h("p", null, `${ORDER.filter(done).length} of ${ORDER.length} real-world labs complete. Every lab rolls a new scenario when you start it, so read the ticket and investigate: there is nothing to memorise.`)),
        nt ? h("div", { class: "pw-next" }, h("small", null, S().active === next ? "In progress" : "Next up"), h("b", null, nt.title), h("button", { class: "primary", type: "button", onClick: () => startOrOpen(next) }, S().active === next ? "Continue" : "Start lab")) : h("div", { class: "pw-next" }, h("b", null, "Path complete!"), h("button", { class: "primary", type: "button", onClick: showCertificate }, "View certificate"))
      ),
      h("nav", { class: "pw-tabs" }, [["path", "Learning path"], ["practice", `Practice tickets (${practice().length})`], ["tools", "Where to find the tools"], ["ready", "Interview & portfolio"], ["cert", "Certificate"]].map(([id, label]) => h("button", { class: tab3 === id ? "on" : "", type: "button", onClick: () => {
        tab3 = id;
        save();
      } }, label))),
      h("div", { class: "pw-body", "data-scroll": "pw" }, page2)
    ));
  }
  registerTool({ id: "pathway", name: "IT Support Career Path", short: "Career Path", icon: ICON.path, width: 1040, height: 740, draw });
  var desktop = document.getElementById("desktop");
  var card2 = h("aside", { class: "pw-card", "aria-label": "IT Support Career Path" });
  function drawCard() {
    const next = nextLab();
    const t = next ? ticket(next) : null;
    card2.replaceChildren(
      h("div", { class: "pw-card-top" }, ring(pct(), 54), h("div", null, h("small", null, "IT SUPPORT CAREER PATH"), h("b", null, `${ORDER.filter(done).length} of ${ORDER.length} labs complete`))),
      t ? h("div", { class: "pw-card-next" }, h("small", null, S().active === next ? "IN PROGRESS" : "NEXT UP"), h("b", null, `LAB-${pad2(next)} · ${t.title}`), h("span", null, t.category)) : h("div", { class: "pw-card-next" }, h("b", null, "All labs complete!"), h("span", null, "Your certificate is ready.")),
      h("div", { class: "pw-card-actions" }, t ? h("button", { class: "pw-go", type: "button", onClick: () => startOrOpen(next) }, S().active === next ? "Continue lab" : "Start lab") : h("button", { class: "pw-go", type: "button", onClick: showCertificate }, "Certificate"), h("button", { class: "pw-open", type: "button", onClick: () => openApp("pathway") }, "Open career path"))
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
    var _a7;
    return (_a7 = S()).preferences || (_a7.preferences = {});
  };
  var PINNED = ["tickets", "directory", "pathway", "pwd", "outlook", "m365", "entra", "terminal", "chrome", "files", "network", "control", "taskmanager", "rdp", "services", "printmgmt", "events", "mentor", "calculator", "notepadpp", "word", "excel", "jam", "pen", "lab"];
  var appIconSvg = (a) => a.icon;
  function appTile(a, kind) {
    const icon2 = document.createElement("span");
    icon2.className = "st-icon";
    icon2.innerHTML = appIconSvg(a);
    return h("button", { class: kind === "tile" ? "st-tile" : "st-row", type: "button", "data-open": a.id, title: a.name }, icon2, h("span", { class: "st-label" }, kind === "tile" ? a.short : a.name));
  }
  function recommended() {
    const apps3 = APPS();
    const items = [];
    const active2 = S().active;
    const ticket2 = TICKETS().find((t) => t.id === active2);
    if (ticket2) items.push(h("button", { class: "st-rec", type: "button", onClick: () => {
      G.CorpDesk?.openTicket?.(ticket2.id);
      hide();
    } }, svg(ICON2.ticket, 26), h("span", null, h("b", null, `LAB-${String(ticket2.id).padStart(3, "0")} · ${ticket2.title}`), h("small", null, "Active incident"))));
    for (const id of (prefs().recentApps ?? []).slice(0, ticket2 ? 5 : 6)) {
      const a = apps3.find((x) => x.id === id);
      if (!a) continue;
      const icon2 = document.createElement("span");
      icon2.className = "st-icon";
      icon2.innerHTML = a.icon;
      items.push(h("button", { class: "st-rec", type: "button", "data-open": a.id }, icon2, h("span", null, h("b", null, a.name), h("small", null, "Recently opened"))));
    }
    if (!items.length) items.push(h("p", { class: "st-empty" }, "The more you use the lab, the more you'll see your recent apps and incidents here."));
    return items;
  }
  function results(q2) {
    const query2 = q2.trim().toLowerCase();
    const apps3 = APPS().filter((a) => `${a.name} ${a.short} ${a.id}`.toLowerCase().includes(query2));
    const settings = (G.CorpDesk?.settingsCategories ?? []).map((c) => c[0]).filter((n) => n.toLowerCase().includes(query2));
    const tix = TICKETS().filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(query2)).slice(0, 4);
    const best = apps3[0];
    return h(
      "div",
      { class: "st-results" },
      best ? h("div", { class: "st-best" }, h("div", { class: "st-h" }, "Best match"), appTile(best, "row")) : h("p", { class: "st-empty" }, `No results for "${q2}"`),
      apps3.length > 1 ? h("div", null, h("div", { class: "st-h" }, "Apps"), apps3.slice(1, 8).map((a) => appTile(a, "row"))) : null,
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
    const apps3 = APPS();
    if (view2 === "pinned") {
      const pinned = [...PINNED.map((id) => apps3.find((a) => a.id === id)).filter(Boolean), ...apps3.filter((a) => !PINNED.includes(a.id))];
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
      const sorted = [...apps3].sort((a, b) => a.name.localeCompare(b.name));
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
    const item = (icon2, label, fn) => h("button", { class: "st-fly", type: "button", onClick: () => {
      flyout.hidden = true;
      fn();
    } }, svg(icon2, 16), label);
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
    }), item(ICON2.restart, "Reset lab (start over)...", () => {
      hide();
      G.CorpDesk?.resetLab?.();
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
      const first2 = body3.querySelector(".st-best button, .st-row, .st-tile");
      first2?.click();
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
  if (G.corpDesktop?.isNative) document.documentElement.classList.add("ia-native");
  lab();
  applyResetKeep();
  ensureServices();
  welcomeMail();
  writePwdFile();
  save();
  var _a6;
  Object.assign((_a6 = G).CorpDesk || (_a6.CorpDesk = {}), { setLabPassword, checkLabPassword });
  refreshShortcuts();
})();
