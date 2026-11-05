(() => {
  // winapps/ui/dom.ts
  function h(tag, attrs = null, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === void 0 || v === null || v === false) continue;
        if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "class") el.className = String(v);
        else if (k === "style") el.setAttribute("style", String(v));
        else if (k === "value" && "value" in el) el.value = String(v);
        else if (k === "checked" && "checked" in el) el.checked = !!v;
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, String(v));
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (c === null || c === void 0 || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function button(label, onClick, cls = "btn", title) {
    return h("button", { class: cls, type: "button", onClick: (e) => {
      e.stopPropagation();
      onClick();
    }, title }, label);
  }
  var toastHost = null;
  var toastPrefs = { muted: false };
  var toastHook = null;
  function setToastHook(fn) {
    toastHook = fn;
  }
  function toast(message, kind = "info") {
    if (toastHook && !toastHook(message, kind)) return;
    if (!toastHook && toastPrefs.muted && kind !== "err") return;
    if (!toastHost) {
      toastHost = h("div", { class: "toasts", role: "status", "aria-live": "polite" });
      document.body.appendChild(toastHost);
    }
    const t = h("div", { class: `toast toast-${kind}` }, message);
    toastHost.appendChild(t);
    setTimeout(() => t.remove(), kind === "err" ? 7e3 : 3500);
  }

  // winapps/core/calculator.ts
  var MAX_DIGITS = 16;
  function calcInit(keep) {
    return { entry: "0", acc: null, op: null, fresh: true, provided: false, last: null, expression: "", justEvaluated: false, error: null, memory: keep?.memory ?? null, history: keep?.history ?? [] };
  }
  function fmtNum(n) {
    if (Object.is(n, -0)) n = 0;
    const clean = Number.parseFloat(n.toPrecision(15));
    const abs = Math.abs(clean);
    if (abs !== 0 && (abs >= 1e16 || abs < 1e-15)) return clean.toExponential();
    return String(clean);
  }
  var num = (s) => Number.parseFloat(s) || 0;
  function group(raw) {
    if (/e/i.test(raw)) return raw;
    const neg = raw.startsWith("-");
    const [int, frac] = (neg ? raw.slice(1) : raw).split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${neg ? "-" : ""}${grouped}${frac !== void 0 ? `.${frac}` : ""}`;
  }
  function displayText(s) {
    return s.error ?? group(s.entry);
  }
  function fail(s, message) {
    return { ...s, error: message, fresh: true, provided: false };
  }
  function apply(a, op, b) {
    switch (op) {
      case "+":
        return a + b;
      case "−":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? a === 0 ? "Result is undefined" : "Cannot divide by zero" : a / b;
    }
  }
  function result(s, value, expression) {
    if (typeof value === "string") return fail({ ...s, expression }, value);
    if (!Number.isFinite(value)) return fail({ ...s, expression }, "Overflow");
    return { ...s, entry: fmtNum(value), expression };
  }
  function press(state2, key) {
    let s = state2;
    if (s.error) {
      if (!/^[0-9.]$/.test(key) && key !== "C" && key !== "CE") return s;
      s = calcInit(s);
      if (key === "C" || key === "CE") return s;
    }
    switch (key) {
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9": {
        if (s.fresh) {
          const reset = s.justEvaluated && !s.op ? { acc: null, expression: "", last: null } : {};
          return { ...s, ...reset, entry: key, fresh: false, provided: false, justEvaluated: false };
        }
        if (s.entry.replace(/[-.]/g, "").length >= MAX_DIGITS) return s;
        return { ...s, entry: s.entry === "0" ? key : s.entry === "-0" ? `-${key}` : s.entry + key };
      }
      case ".": {
        if (s.fresh) {
          const reset = s.justEvaluated && !s.op ? { acc: null, expression: "", last: null } : {};
          return { ...s, ...reset, entry: "0.", fresh: false, provided: false, justEvaluated: false };
        }
        return s.entry.includes(".") ? s : { ...s, entry: `${s.entry}.` };
      }
      case "+":
      case "−":
      case "×":
      case "÷": {
        const x = num(s.entry);
        const typed = !s.fresh || s.provided;
        if (s.acc !== null && s.op && typed && !s.justEvaluated) {
          const v = apply(s.acc, s.op, x);
          if (typeof v === "string") return fail({ ...s, expression: `${fmtNum(s.acc)} ${s.op} ${fmtNum(x)}` }, v);
          return { ...s, acc: v, entry: fmtNum(v), op: key, fresh: true, provided: false, justEvaluated: false, expression: `${fmtNum(v)} ${key}` };
        }
        const acc = s.acc !== null && s.op && !typed ? s.acc : x;
        return { ...s, acc, op: key, fresh: true, provided: false, justEvaluated: false, expression: `${fmtNum(acc)} ${key}` };
      }
      case "=": {
        if (s.op && s.acc !== null) {
          const operand = !s.fresh || s.provided ? num(s.entry) : s.acc;
          const expr = `${fmtNum(s.acc)} ${s.op} ${fmtNum(operand)} =`;
          const out = result(s, apply(s.acc, s.op, operand), expr);
          if (out.error) return out;
          return { ...out, acc: num(out.entry), op: null, last: { op: s.op, operand }, fresh: true, provided: false, justEvaluated: true, history: [{ expression: expr, result: out.entry }, ...s.history].slice(0, 50) };
        }
        if (s.last) {
          const x = num(s.entry);
          const expr = `${fmtNum(x)} ${s.last.op} ${fmtNum(s.last.operand)} =`;
          const out = result(s, apply(x, s.last.op, s.last.operand), expr);
          if (out.error) return out;
          return { ...out, acc: num(out.entry), fresh: true, provided: false, justEvaluated: true, history: [{ expression: expr, result: out.entry }, ...s.history].slice(0, 50) };
        }
        return { ...s, expression: `${fmtNum(num(s.entry))} =`, fresh: true, provided: false, justEvaluated: true };
      }
      case "%": {
        const x = num(s.entry);
        const v = s.op && s.acc !== null ? s.op === "+" || s.op === "−" ? s.acc * x / 100 : x / 100 : 0;
        return { ...s, entry: fmtNum(v), fresh: true, provided: true, expression: s.op && s.acc !== null ? `${fmtNum(s.acc)} ${s.op} ${fmtNum(v)}` : fmtNum(v) };
      }
      case "√":
      case "x²":
      case "1/x": {
        const x = num(s.entry);
        const lead = s.op && s.acc !== null && !s.justEvaluated ? `${fmtNum(s.acc)} ${s.op} ` : "";
        const label = key === "√" ? `√(${fmtNum(x)})` : key === "x²" ? `sqr(${fmtNum(x)})` : `1/(${fmtNum(x)})`;
        const v = key === "√" ? x < 0 ? "Invalid input" : Math.sqrt(x) : key === "x²" ? x * x : x === 0 ? "Cannot divide by zero" : 1 / x;
        const out = result(s, v, lead + label);
        return out.error ? out : { ...out, fresh: true, provided: true, justEvaluated: false };
      }
      case "±": {
        if (s.entry === "0") return s;
        const entry = s.entry.startsWith("-") ? s.entry.slice(1) : `-${s.entry}`;
        return { ...s, entry, provided: s.fresh ? true : s.provided, justEvaluated: false };
      }
      case "⌫": {
        if (s.justEvaluated) return { ...s, expression: "" };
        if (s.fresh) return s;
        const next = s.entry.slice(0, -1);
        return { ...s, entry: next === "" || next === "-" ? "0" : next };
      }
      case "CE":
        return { ...s, entry: "0", fresh: true, provided: false, expression: s.justEvaluated ? "" : s.expression, justEvaluated: false };
      case "C":
        return calcInit(s);
      case "MS":
        return { ...s, memory: num(s.entry), fresh: true, provided: true };
      case "M+":
        return { ...s, memory: (s.memory ?? 0) + num(s.entry), fresh: true, provided: true };
      case "M-":
        return { ...s, memory: (s.memory ?? 0) - num(s.entry), fresh: true, provided: true };
      case "MR":
        return s.memory === null ? s : { ...s, entry: fmtNum(s.memory), fresh: true, provided: true, justEvaluated: false };
      case "MC":
        return { ...s, memory: null };
    }
  }

  // winapps/ui/apps/calculator.ts
  var KEYS = [
    ["%", "CE", "C", "⌫"],
    ["1/x", "x²", "√", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["±", "0", ".", "="]
  ];
  var LABEL = { "1/x": "¹⁄ₓ", "x²": "x²", "√": "²√x", "⌫": "⌫", "±": "+/−" };
  var KEYBOARD = {
    "+": "+",
    "-": "−",
    "*": "×",
    "x": "×",
    "/": "÷",
    "=": "=",
    Enter: "=",
    "%": "%",
    ".": ".",
    ",": ".",
    Backspace: "⌫",
    Escape: "C",
    Delete: "CE",
    "@": "√",
    q: "x²",
    r: "1/x",
    F9: "±"
  };
  var calculatorApp = {
    id: "calc",
    title: "Calculator",
    icon: "calculator",
    width: 340,
    height: 540,
    mount(host) {
      let s = calcInit();
      let pane = "none";
      const root = h("div", { class: "calc", tabindex: "0", "aria-label": "Calculator" });
      host.appendChild(root);
      const go = (k) => {
        s = press(s, k);
        draw();
      };
      function sidePane() {
        if (pane === "none") return null;
        const items = pane === "history" ? s.history.map((x) => h("button", { class: "calc-hist", type: "button", onClick: () => {
          s = { ...s, entry: x.result.replace(/,/g, ""), fresh: true, provided: true, expression: x.expression };
          draw();
        } }, h("span", null, x.expression), h("strong", null, x.result))) : s.memory === null ? [] : [h("div", { class: "calc-hist" }, h("strong", null, displayText({ ...s, entry: String(s.memory), error: null })))];
        return h(
          "div",
          { class: "calc-pane" },
          h(
            "div",
            { class: "calc-pane-head" },
            h("strong", null, pane === "history" ? "History" : "Memory"),
            h("button", { class: "calc-mini", type: "button", onClick: () => {
              if (pane === "history") s = { ...s, history: [] };
              else go("MC");
              pane = "none";
              draw();
            } }, pane === "history" ? "Clear history" : "Clear memory")
          ),
          items.length ? items : h("p", { class: "calc-empty" }, pane === "history" ? "There’s no history yet" : "There’s nothing saved in memory")
        );
      }
      function draw() {
        clear(root);
        const err = !!s.error;
        const text = displayText(s);
        root.append(
          h(
            "div",
            { class: "calc-head" },
            h("span", { class: "calc-mode" }, "Standard"),
            h("button", { class: `calc-mini ${pane === "history" ? "on" : ""}`, type: "button", title: "History (Ctrl+H)", onClick: () => {
              pane = pane === "history" ? "none" : "history";
              draw();
            } }, "⏲")
          ),
          h("div", { class: "calc-expr", "aria-live": "polite" }, s.expression),
          h("div", { class: `calc-display ${text.length > 12 ? "small" : ""}`, "aria-live": "polite" }, text),
          h(
            "div",
            { class: "calc-mem" },
            ["MC", "MR", "M+", "M-", "MS"].map((k) => h("button", { class: "calc-mkey", type: "button", disabled: err || (k === "MC" || k === "MR") && s.memory === null, onClick: () => go(k) }, k)),
            h("button", { class: `calc-mkey ${pane === "memory" ? "on" : ""}`, type: "button", disabled: s.memory === null, title: "Memory", onClick: () => {
              pane = pane === "memory" ? "none" : "memory";
              draw();
            } }, "M˅")
          ),
          sidePane() ?? h("div", { class: "calc-keys" }, KEYS.flat().map((k) => {
            const digit = /^[0-9.]$/.test(k);
            const disabled = err && !digit && k !== "C" && k !== "CE" && k !== "⌫";
            return h("button", { class: `calc-key ${digit || k === "±" ? "num" : ""} ${k === "=" ? "eq" : ""}`, type: "button", disabled, "aria-label": k, onClick: () => go(k) }, LABEL[k] ?? k);
          }))
        );
      }
      root.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === "h") {
          e.preventDefault();
          pane = pane === "history" ? "none" : "history";
          draw();
          return;
        }
        if (e.ctrlKey && /^[mprlq]$/i.test(e.key)) {
          const k2 = { m: "MS", p: "M+", q: "M-", r: "MR", l: "MC" }[e.key.toLowerCase()];
          if (k2) {
            e.preventDefault();
            go(k2);
          }
          return;
        }
        const k = /^[0-9]$/.test(e.key) ? e.key : KEYBOARD[e.key];
        if (k) {
          e.preventDefault();
          go(k);
        }
      });
      draw();
      setTimeout(() => root.focus(), 30);
      return { dispose: () => root.remove() };
    }
  };

  // winapps/core/taskmgr.ts
  var MS = "Microsoft Corporation";
  var APP_IMAGES = {
    browser: { exe: "chrome.exe", name: "Google Chrome", description: "Google Chrome", publisher: "Google LLC", baseMb: 410, cpu: 3 },
    aduc: { exe: "mmc.exe", name: "Active Directory Users and Computers", description: "Microsoft Management Console", publisher: MS, baseMb: 38, cpu: 0.6 },
    eventviewer: { exe: "mmc.exe", name: "Event Viewer", description: "Microsoft Management Console", publisher: MS, baseMb: 44, cpu: 0.6 },
    terminal: { exe: "WindowsTerminal.exe", name: "Terminal", description: "Windows Terminal", publisher: MS, baseMb: 96, cpu: 0.8 },
    powershell: { exe: "powershell.exe", name: "Windows PowerShell", description: "Windows PowerShell", publisher: MS, baseMb: 72, cpu: 0.5 },
    ise: { exe: "powershell_ise.exe", name: "Windows PowerShell ISE", description: "Windows PowerShell ISE", publisher: MS, baseMb: 140, cpu: 0.7 },
    rdp: { exe: "mstsc.exe", name: "Remote Desktop Connection", description: "Remote Desktop Connection", publisher: MS, baseMb: 64, cpu: 1.2 },
    explorer: { exe: "explorer.exe", name: "File Explorer", description: "Windows Explorer", publisher: MS, baseMb: 52, cpu: 0.4 },
    notepad: { exe: "Notepad.exe", name: "Notepad", description: "Notepad", publisher: MS, baseMb: 24, cpu: 0.1 },
    control: { exe: "control.exe", name: "Control Panel", description: "Windows Control Panel", publisher: MS, baseMb: 30, cpu: 0.2 },
    settings: { exe: "SystemSettings.exe", name: "Settings", description: "Settings", publisher: MS, baseMb: 58, cpu: 0.3 },
    security: { exe: "SecHealthUI.exe", name: "Windows Security", description: "Windows Security", publisher: MS, baseMb: 46, cpu: 0.2 },
    coach: { exe: "IAMCoach.exe", name: "IAM Coach", description: "IAM Coach", publisher: "Meridian Health System", baseMb: 88, cpu: 0.6 },
    career: { exe: "IAMCoach.exe", name: "Career Record", description: "IAM Coach", publisher: "Meridian Health System", baseMb: 40, cpu: 0.2 },
    word: { exe: "WINWORD.EXE", name: "Word", description: "Microsoft Word", publisher: MS, baseMb: 180, cpu: 0.6 },
    excel: { exe: "EXCEL.EXE", name: "Excel", description: "Microsoft Excel", publisher: MS, baseMb: 170, cpu: 0.6 },
    powerpoint: { exe: "POWERPNT.EXE", name: "PowerPoint", description: "Microsoft PowerPoint", publisher: MS, baseMb: 190, cpu: 0.6 },
    stickynotes: { exe: "Microsoft.Notes.exe", name: "Sticky Notes", description: "Microsoft Sticky Notes", publisher: MS, baseMb: 34, cpu: 0.1 },
    taskmgr: { exe: "Taskmgr.exe", name: "Task Manager", description: "Task Manager", publisher: MS, baseMb: 36, cpu: 1.1 }
  };
  function imageFor(appId, title) {
    return APP_IMAGES[appId] ?? { exe: `${appId}.exe`, name: title, description: title, publisher: "", baseMb: 40, cpu: 0.3 };
  }
  var SYSTEM = "SYSTEM";
  var LOCAL = "LOCAL SERVICE";
  var NET = "NETWORK SERVICE";
  function fixedProcs(user) {
    return [
      { pid: 4, exe: "System", name: "System", description: "NT Kernel & System", publisher: MS, group: "windows", user: SYSTEM, baseMb: 0.1, cpu: 0.4, critical: true, disk: 0.1 },
      { pid: 140, exe: "Registry", name: "Registry", description: "NT Kernel & System", publisher: MS, group: "windows", user: SYSTEM, baseMb: 12, cpu: 0, critical: true },
      { pid: 512, exe: "smss.exe", name: "Windows Session Manager", description: "Windows Session Manager", publisher: MS, group: "windows", user: SYSTEM, baseMb: 0.4, cpu: 0, critical: true },
      { pid: 724, exe: "csrss.exe", name: "Client Server Runtime Process", description: "Client Server Runtime Process", publisher: MS, group: "windows", user: SYSTEM, baseMb: 1.4, cpu: 0.1, critical: true },
      { pid: 812, exe: "wininit.exe", name: "Windows Start-Up Application", description: "Windows Start-Up Application", publisher: MS, group: "windows", user: SYSTEM, baseMb: 1.1, cpu: 0, critical: true },
      { pid: 880, exe: "services.exe", name: "Services and Controller app", description: "Services and Controller app", publisher: MS, group: "windows", user: SYSTEM, baseMb: 5.6, cpu: 0.1, critical: true },
      { pid: 896, exe: "lsass.exe", name: "Local Security Authority Process", description: "Local Security Authority Process", publisher: MS, group: "windows", user: SYSTEM, baseMb: 9.8, cpu: 0.2, critical: true },
      { pid: 1012, exe: "winlogon.exe", name: "Windows Logon Application", description: "Windows Logon Application", publisher: MS, group: "windows", user: SYSTEM, baseMb: 2.2, cpu: 0, critical: true },
      { pid: 1188, exe: "dwm.exe", name: "Desktop Window Manager", description: "Desktop Window Manager", publisher: MS, group: "windows", user: "DWM-1", baseMb: 74, cpu: 1.6, critical: true },
      { pid: 1316, exe: "svchost.exe", name: "Service Host: DCOM Server Process Launcher", description: "Host Process for Windows Services", publisher: MS, group: "windows", user: SYSTEM, baseMb: 14, cpu: 0.1, critical: true },
      { pid: 1460, exe: "svchost.exe", name: "Service Host: Netlogon", description: "Host Process for Windows Services", publisher: MS, group: "windows", user: SYSTEM, baseMb: 4.1, cpu: 0.1, critical: true, net: 0.01 },
      { pid: 1596, exe: "svchost.exe", name: "Service Host: Windows Event Log", description: "Host Process for Windows Services", publisher: MS, group: "windows", user: LOCAL, baseMb: 9.2, cpu: 0.1, critical: true, disk: 0.1 },
      { pid: 1744, exe: "svchost.exe", name: "Service Host: Windows Time", description: "Host Process for Windows Services", publisher: MS, group: "windows", user: LOCAL, baseMb: 2, cpu: 0, critical: true },
      { pid: 1808, exe: "svchost.exe", name: "Service Host: DNS Client", description: "Host Process for Windows Services", publisher: MS, group: "windows", user: NET, baseMb: 3.4, cpu: 0, critical: true, net: 0.01 },
      { pid: 2216, exe: "spoolsv.exe", name: "Spooler SubSystem App", description: "Spooler SubSystem App", publisher: MS, group: "windows", user: SYSTEM, baseMb: 6, cpu: 0, critical: false },
      { pid: 2540, exe: "explorer.exe", name: "Windows Explorer", description: "Windows Explorer", publisher: MS, group: "windows", user, baseMb: 118, cpu: 0.6, critical: false },
      { pid: 3112, exe: "MsMpEng.exe", name: "Antimalware Service Executable", description: "Antimalware Service Executable", publisher: MS, group: "background", user: SYSTEM, baseMb: 210, cpu: 1.4, critical: true, disk: 0.3 },
      { pid: 3388, exe: "SearchHost.exe", name: "Search", description: "Search", publisher: MS, group: "background", user, baseMb: 66, cpu: 0.1, critical: false },
      { pid: 3540, exe: "StartMenuExperienceHost.exe", name: "Start", description: "Start", publisher: MS, group: "background", user, baseMb: 48, cpu: 0.1, critical: false },
      { pid: 3716, exe: "Microsoft.AAD.BrokerPlugin.exe", name: "Work or school account", description: "Microsoft Entra ID sign-in broker", publisher: MS, group: "background", user, baseMb: 21, cpu: 0, critical: false, net: 0.02 },
      { pid: 4128, exe: "SecurityHealthSystray.exe", name: "Windows Security notification icon", description: "Windows Security notification icon", publisher: MS, group: "background", user, baseMb: 3.2, cpu: 0, critical: false },
      { pid: 4296, exe: "RuntimeBroker.exe", name: "Runtime Broker", description: "Runtime Broker", publisher: MS, group: "background", user, baseMb: 8.4, cpu: 0, critical: false }
    ];
  }
  function pidFor(winId) {
    let h2 = 2166136261;
    for (let i = 0; i < winId.length; i++) h2 = Math.imul(h2 ^ winId.charCodeAt(i), 16777619) >>> 0;
    return 5e3 + h2 % 5e3 * 4;
  }
  function noise(pid, tick, salt) {
    let x = Math.imul(pid * 2654435761 + tick * 40503 + salt * 9973, 1540483477) >>> 0;
    x = (x ^ x >>> 15) >>> 0;
    return x % 1e4 / 1e4;
  }
  function processes(input) {
    const { tick, user } = input;
    const out = [];
    const used = /* @__PURE__ */ new Set();
    const usage = (pid, cpu, efficient) => {
      const v = cpu * (0.4 + 1.2 * noise(pid, tick, 1));
      return Math.round((efficient ? v * 0.3 : v) * 10) / 10;
    };
    for (const w of input.windows) {
      const img = imageFor(w.appId, w.title);
      let pid = pidFor(w.id);
      while (used.has(pid)) pid += 4;
      used.add(pid);
      const eff = !!input.efficiency?.has(pid);
      out.push({
        pid,
        name: img.name,
        exe: img.exe,
        description: img.description,
        publisher: img.publisher,
        group: "app",
        user,
        status: eff ? "Efficiency mode" : "Running",
        cpu: w.minimized ? Math.round(usage(pid, img.cpu, eff) * 0.2 * 10) / 10 : usage(pid, img.cpu, eff),
        memMb: Math.round(img.baseMb * (0.95 + 0.1 * noise(pid, Math.floor(tick / 10), 2)) * 10) / 10,
        diskMbs: noise(pid, tick, 3) > 0.85 ? Math.round(noise(pid, tick, 4) * 10) / 10 : 0,
        netMbps: input.online && w.appId === "browser" ? Math.round(noise(pid, tick, 5) * 15) / 10 : 0,
        winId: w.id,
        critical: false
      });
    }
    const fixed = fixedProcs(user);
    if (input.aiOnline) fixed.push({ pid: 4472, exe: "ollama.exe", name: "Ollama", description: "Ollama", publisher: "Ollama", group: "background", user, baseMb: 1450, cpu: 2.5, critical: false });
    for (const f of fixed) {
      const eff = !!input.efficiency?.has(f.pid);
      out.push({
        pid: f.pid,
        name: f.name,
        exe: f.exe,
        description: f.description,
        publisher: f.publisher,
        group: f.group,
        user: f.user,
        status: eff ? "Efficiency mode" : "Running",
        cpu: usage(f.pid, f.cpu, eff),
        memMb: Math.round(f.baseMb * (0.97 + 0.06 * noise(f.pid, Math.floor(tick / 10), 2)) * 10) / 10,
        diskMbs: f.disk ? Math.round(f.disk * noise(f.pid, tick, 3) * 10) / 10 : 0,
        netMbps: input.online && f.net ? Math.round(f.net * noise(f.pid, tick, 5) * 100) / 100 : 0,
        critical: f.critical
      });
    }
    return out;
  }
  var INSTALLED_MB = 16 * 1024;
  var OS_BASE_MB = 3900;
  function totals(procs) {
    const cpu = Math.min(100, Math.round(procs.reduce((n, p) => n + p.cpu, 0) * 10) / 10);
    const memMb = Math.round(OS_BASE_MB + procs.reduce((n, p) => n + p.memMb, 0));
    return {
      cpu,
      memMb,
      memPct: Math.round(memMb / INSTALLED_MB * 100),
      diskMbs: Math.round(procs.reduce((n, p) => n + p.diskMbs, 0) * 10) / 10,
      netMbps: Math.round(procs.reduce((n, p) => n + p.netMbps, 0) * 100) / 100,
      count: procs.length + 118,
      threads: 1800 + procs.length * 23,
      handles: 61e3 + procs.length * 410
    };
  }
  function sortProcs(procs, key, desc) {
    const dir = desc ? -1 : 1;
    return [...procs].sort((a, b) => {
      const av = a[key], bv = b[key];
      const c = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return c * dir || a.pid - b.pid;
    });
  }
  var SERVICES = [
    { name: "Dnscache", display: "DNS Client", group: "NetworkService", status: "Running", pid: 1808, description: "Caches DNS names and registers this computer in DNS." },
    { name: "EventLog", display: "Windows Event Log", group: "LocalServiceNetworkRestricted", status: "Running", pid: 1596, description: "Manages events and event logs." },
    { name: "LanmanWorkstation", display: "Workstation", group: "NetworkService", status: "Running", pid: 1808, description: "Creates and maintains client network connections to servers using the SMB protocol." },
    { name: "Netlogon", display: "Netlogon", group: "", status: "Running", pid: 1460, description: "Maintains a secure channel between this computer and the domain controller for authenticating users and services." },
    { name: "W32Time", display: "Windows Time", group: "LocalService", status: "Running", pid: 1744, description: "Keeps date and time in sync with the domain hierarchy; Kerberos fails if clocks drift more than 5 minutes." },
    { name: "WinDefend", display: "Microsoft Defender Antivirus Service", group: "", status: "Running", pid: 3112, description: "Helps protect users from malware and other potentially unwanted software." },
    { name: "mpssvc", display: "Windows Defender Firewall", group: "LocalServiceNoNetworkFirewall", status: "Running", pid: 1316, description: "Helps protect this computer by preventing unauthorized users from gaining access through the network." },
    { name: "KeyIso", display: "CNG Key Isolation", group: "", status: "Running", pid: 896, description: "Hosts key operations in the LSA process." },
    { name: "SamSs", display: "Security Accounts Manager", group: "", status: "Running", pid: 896, description: "Signals other services that the Security Accounts Manager is ready." },
    { name: "gpsvc", display: "Group Policy Client", group: "netsvcs", status: "Running", pid: 1316, description: "Applies settings configured by administrators through Group Policy." },
    { name: "Spooler", display: "Print Spooler", group: "", status: "Running", pid: 2216, description: "Spools print jobs and handles interaction with the printer." },
    { name: "TermService", display: "Remote Desktop Services", group: "NetworkService", status: "Stopped", pid: null, description: "Allows users to connect interactively to this computer. Inbound RDP is off on IAM workstations." },
    { name: "RemoteRegistry", display: "Remote Registry", group: "localService", status: "Stopped", pid: null, description: "Enables remote users to modify registry settings. Disabled by the workstation baseline." },
    { name: "wuauserv", display: "Windows Update", group: "netsvcs", status: "Running", pid: 1316, description: "Enables the detection, download and installation of updates." },
    { name: "AADBrokerPluginSvc", display: "Web Account Manager", group: "netsvcs", status: "Running", pid: 1316, description: "Single sign-on to Microsoft Entra ID for apps on this computer." },
    { name: "SCardSvr", display: "Smart Card", group: "LocalServiceAndNoImpersonation", status: "Stopped", pid: null, description: "Manages access to smart cards read by this computer." }
  ];

  // winapps/ui/icons.ts
  var CORP_APP = {
    aduc: "directory",
    eventviewer: "events",
    powershell: "terminal",
    explorer: "files",
    notepad: "notepadpp",
    settings: "network",
    browser: "chrome",
    rdp: "rdp",
    taskmgr: "taskmanager",
    calculator: "calculator",
    control: "control"
  };
  var SVG = {
    control: '<rect x="3" y="5" width="28" height="22" rx="2" fill="#2f7fd8"/><rect x="5" y="9" width="24" height="16" fill="#e8f2fc"/><rect x="8" y="12" width="7" height="4" fill="#4caf50"/><rect x="18" y="12" width="8" height="4" fill="#f3b23a"/><rect x="8" y="18" width="18" height="4" fill="#9ec3ea"/>',
    network: '<circle cx="17" cy="17" r="13" fill="#2f7fd8"/><path d="M4 17h26M17 4c-6 7-6 19 0 26M17 4c6 7 6 19 0 26M7 10h20M7 24h20" stroke="#dff0ff" stroke-width="1.4" fill="none"/>',
    mouse: '<rect x="10" y="4" width="14" height="26" rx="7" fill="#e6e9ee" stroke="#7a8591" stroke-width="1.2"/><path d="M17 4v10M10 14h14" stroke="#7a8591" stroke-width="1.2"/><rect x="15.8" y="7" width="2.4" height="4" rx="1.2" fill="#2f7fd8"/><path d="M26 12l5-3v10l-5-3" fill="#f3b23a"/>',
    programs: '<rect x="4" y="9" width="26" height="20" rx="2" fill="#c98b2b"/><rect x="4" y="9" width="26" height="6" fill="#e0a83e"/><rect x="12" y="4" width="10" height="7" rx="1" fill="none" stroke="#7a5214" stroke-width="2"/><rect x="14" y="15" width="6" height="5" fill="#ffe2a8"/>',
    user: '<circle cx="17" cy="11" r="6.5" fill="#f1c9a5" stroke="#b98a64"/><path d="M5 31c0-8 5.4-12 12-12s12 4 12 12z" fill="#3a7bd5"/>',
    clock: '<circle cx="17" cy="17" r="13" fill="#fff" stroke="#2f7fd8" stroke-width="2.5"/><path d="M17 9v8l6 4" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M27 26l5 2-2 3z" fill="#4caf50"/>',
    access: '<circle cx="17" cy="17" r="13" fill="#2f7fd8"/><circle cx="17" cy="9.5" r="2.4" fill="#fff"/><path d="M9 13.5l8 1.6 8-1.6M17 15v6l-4 7M17 21l4 7" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    calculator: '<rect x="6" y="3" width="22" height="28" rx="3" fill="#3b3b3b"/><rect x="9" y="6" width="16" height="6" rx="1" fill="#9fd6ff"/><g fill="#d9d9d9"><rect x="9" y="15" width="4" height="3" rx=".6"/><rect x="15" y="15" width="4" height="3" rx=".6"/><rect x="9" y="20" width="4" height="3" rx=".6"/><rect x="15" y="20" width="4" height="3" rx=".6"/><rect x="9" y="25" width="10" height="3" rx=".6"/></g><rect x="21" y="15" width="4" height="13" rx=".6" fill="#2f7fd8"/>',
    taskmgr: '<rect x="3" y="5" width="28" height="24" rx="2" fill="#1f6b3a"/><path d="M6 22l5-7 4 4 5-9 4 6 4-3" stroke="#8ff0a4" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    properties: '<rect x="7" y="3" width="20" height="28" fill="#fff" stroke="#5f6770" stroke-width="1.2"/><path d="M11 9h12M11 13h12M11 17h8" stroke="#7a8591" stroke-width="1.5"/><path d="M19 22l6-5 3 3-5 6-4 1z" fill="#e8b93a" stroke="#8a6d1f"/>'
  };
  function svgFor(name) {
    const app = CORP_APP[name] ? (typeof apps !== "undefined" ? apps : []).find((x) => x.id === CORP_APP[name]) : void 0;
    if (app?.icon) return app.icon;
    return `<svg viewBox="0 0 34 34" aria-hidden="true">${SVG[name] ?? SVG.programs}</svg>`;
  }
  var iconSvg = (name) => `<svg viewBox="0 0 34 34" aria-hidden="true">${SVG[name] ?? SVG.programs}</svg>`;
  function appIcon(name, size = 16) {
    const span = document.createElement("span");
    span.className = "wa-icon";
    span.style.cssText = `width:${size}px;height:${size}px;display:inline-grid;flex:none;vertical-align:middle`;
    span.innerHTML = svgFor(name);
    const svg = span.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
    }
    return span;
  }
  var glyph = (name) => appIcon(name, 16);

  // winapps/ui/store.ts
  var g = globalThis;
  var prefs = () => state.preferences || (state.preferences = {});
  var store = {
    /** Task Manager and similar app settings live in state.preferences.winApps. */
    get settings() {
      var _a;
      return (_a = prefs()).winApps || (_a.winApps = {});
    },
    get world() {
      const name = state.technician || "Technician";
      const sam = name.toLowerCase().replace(/\s+/g, ".");
      return {
        ad: { netbios: "CORP", domain: "corp.example.test" },
        player: { sam, displayName: name, adminSam: sam }
      };
    }
  };
  function persist() {
    g.save();
  }

  // winapps/ui/aiState.ts
  var ai = {
    get status() {
      return state?.nativeOllama?.available || state?.assistant?.mode === "ollama" ? "online" : "offline";
    }
  };

  // winapps/ui/system.ts
  var g2 = globalThis;
  var prefs2 = () => state.preferences || (state.preferences = {});
  var STARTUP_APPS = [
    ["tickets", "Service Desk"],
    ["mentor", "IT Assistant"],
    ["chrome", "Google Chrome"],
    ["notepadpp", "Notepad++"],
    ["terminal", "Windows PowerShell"]
  ];
  function sys() {
    return { airplane: false, startupApps: [...prefs2().startupApps ?? []] };
  }
  function setSys(patch) {
    if (patch.startupApps) prefs2().startupApps = patch.startupApps;
    g2.save();
  }

  // winapps/ui/ctxmenu.ts
  function showMenu(x, y, items) {
    document.querySelectorAll(".cm").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "cm";
    menu.setAttribute("role", "menu");
    for (const it of items) {
      if (it === "-") {
        menu.appendChild(Object.assign(document.createElement("div"), { className: "cm-sep" }));
        continue;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cm-item";
      b.setAttribute("role", "menuitem");
      b.disabled = !!it.disabled;
      const check = document.createElement("span");
      check.className = "cm-check";
      check.textContent = it.checked ? "✓" : "";
      const label = document.createElement("span");
      label.textContent = it.label;
      b.append(check, label);
      b.addEventListener("click", () => {
        menu.remove();
        it.onClick?.();
      });
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(0, Math.min(x, innerWidth - r.width - 4))}px`;
    menu.style.top = `${Math.max(0, Math.min(y, innerHeight - r.height - 4))}px`;
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", close, true);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  }

  // winapps/ui/wm.ts
  var RANGE_ID = {
    chrome: "browser",
    directory: "aduc",
    events: "eventviewer",
    terminal: "powershell",
    files: "explorer",
    notepadpp: "notepad",
    network: "settings",
    rdp: "rdp",
    taskmanager: "taskmgr",
    control: "control",
    calculator: "CalculatorApp",
    word: "word",
    excel: "excel",
    powerpoint: "powerpoint",
    office: "OfficeHub",
    tickets: "ServiceDesk",
    mentor: "ITAssistant",
    lab: "LabGuide"
  };
  var g3 = globalThis;
  function windowList() {
    return [...document.querySelectorAll("#desktop .app-window[data-app]")].map((w) => ({
      id: w.dataset.app,
      appId: RANGE_ID[w.dataset.app] ?? w.dataset.app,
      title: w.querySelector(".window-caption > span:last-child")?.textContent || w.getAttribute("aria-label") || w.dataset.app,
      minimized: w.classList.contains("hidden"),
      icon: w.dataset.app
    }));
  }
  function closeWindow(id) {
    g3.CorpDesk?.closeApp ? g3.CorpDesk.closeApp(id) : g3.closeWindow?.();
  }
  function focusWindow(id) {
    g3.openApp(id);
  }
  var openArgs = /* @__PURE__ */ new WeakMap();
  function onOpenArg(win, fn) {
    openArgs.set(win, fn);
  }
  function deliverOpenArg(win, arg) {
    openArgs.get(win)?.(arg);
  }

  // winapps/ui/apps/taskmgr.ts
  var NAV = [
    ["processes", "Processes", ""],
    ["performance", "Performance", ""],
    ["startup", "Startup apps", ""],
    ["users", "Users", ""],
    ["details", "Details", ""],
    ["services", "Services", ""]
  ];
  var SPEED_MS = { high: 500, normal: 1e3, low: 4e3, paused: 0 };
  var HISTORY = 60;
  var runHook = () => {
  };
  function setRunNewTask(fn) {
    runHook = fn;
  }
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }
  function graph(values, max, cls, big) {
    const w = 300, hgt = 100;
    const svg = svgEl("svg", { viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "none", class: `tm-graph ${cls} ${big ? "big" : ""}`, "aria-hidden": "true" });
    if (big) for (let i = 1; i < 10; i++) svg.appendChild(svgEl("line", { x1: String(w / 10 * i), y1: "0", x2: String(w / 10 * i), y2: String(hgt), class: "tm-gridline" }));
    if (big) for (let i = 1; i < 10; i++) svg.appendChild(svgEl("line", { x1: "0", y1: String(hgt / 10 * i), x2: String(w), y2: String(hgt / 10 * i), class: "tm-gridline" }));
    const pad = Array(Math.max(0, HISTORY - values.length)).fill(0).concat(values.slice(-HISTORY));
    const pts = pad.map((v, i) => `${i / (HISTORY - 1) * w},${hgt - Math.min(1, v / (max || 1)) * hgt}`);
    svg.appendChild(svgEl("polygon", { points: `0,${hgt} ${pts.join(" ")} ${w},${hgt}`, class: "tm-area" }));
    svg.appendChild(svgEl("polyline", { points: pts.join(" "), class: "tm-line", fill: "none" }));
    return svg;
  }
  var fmtMb = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  var pct = (n) => `${n.toFixed(n < 10 && n > 0 ? 1 : 0)}%`;
  var taskManagerApp = {
    id: "taskmgr",
    title: "Task Manager",
    icon: "taskmgr",
    width: 1e3,
    height: 660,
    mount(host) {
      const prefs3 = () => store.settings.taskManager ?? {};
      let page = prefs3().startPage || "processes";
      let navOpen = true;
      let query = "";
      let selected = null;
      let sort = { key: "name", desc: false };
      let perfView = "cpu";
      const collapsed = /* @__PURE__ */ new Set();
      let userOpen = true;
      const efficiency = /* @__PURE__ */ new Set();
      let tick = 0;
      let procs = [];
      const hist = { cpu: [], mem: [], disk: [], net: [] };
      const started = Date.now();
      const sample = () => {
        tick++;
        const online = navigator.onLine && !sys().airplane;
        procs = processes({ windows: windowList(), aiOnline: ai.status === "online", online, tick, user: `${store.world.ad.netbios}\\${store.world.player.sam}`, efficiency });
        for (const pid of [...efficiency]) if (!procs.some((p) => p.pid === pid)) efficiency.delete(pid);
        const t = totals(procs);
        for (const [k, v] of [["cpu", t.cpu], ["mem", t.memPct], ["disk", Math.min(100, t.diskMbs * 8)], ["net", t.netMbps]]) {
          hist[k].push(v);
          if (hist[k].length > HISTORY) hist[k].shift();
        }
      };
      const endTask = (p) => {
        if (p.winId) {
          closeWindow(p.winId);
          selected = null;
          sample();
          draw();
          return;
        }
        if (p.exe === "explorer.exe") {
          toast("Windows Explorer restarted", "ok");
          return;
        }
        toast(p.critical ? `Unable to terminate process: ${p.name}. Access is denied.` : `${p.name} is a background process this lab keeps running. End the app windows instead.`, "err");
      };
      const toggleEfficiency = (p) => {
        if (p.critical) return void toast(`Efficiency mode is not available for ${p.name}: it is a core Windows process.`, "err");
        if (efficiency.has(p.pid)) efficiency.delete(p.pid);
        else efficiency.add(p.pid);
        sample();
        draw();
      };
      const procMenu = (e, p) => {
        e.preventDefault();
        selected = p.pid;
        showMenu(e.clientX, e.clientY, [
          ...p.winId ? [{ label: "Switch to", onClick: () => focusWindow(p.winId) }] : [],
          { label: p.exe === "explorer.exe" ? "Restart" : "End task", onClick: () => endTask(p) },
          { label: "Efficiency mode", checked: efficiency.has(p.pid), onClick: () => toggleEfficiency(p) },
          "-",
          { label: "Go to details", onClick: () => {
            page = "details";
            draw();
          } },
          { label: "Search online", onClick: () => window.open(`https://www.bing.com/search?q=${encodeURIComponent(p.exe)}`, "_blank", "noopener,noreferrer") }
        ]);
        draw();
      };
      function toolbar(title, ...actions) {
        const search = h("input", {
          class: "tm-search",
          type: "search",
          placeholder: "Type a name, publisher, or PID to search",
          value: query,
          "aria-label": "Search processes",
          onInput: (e) => {
            query = e.target.value;
            draw();
            const el = host.querySelector(".tm-search");
            el?.focus();
            el?.setSelectionRange(query.length, query.length);
          }
        });
        return h("div", { class: "tm-top" }, h("h1", null, title), h("div", { class: "tm-actions" }, ...actions), page === "processes" || page === "details" ? search : null);
      }
      const sel = () => procs.find((p) => p.pid === selected);
      const runBtn = () => h("button", { class: "tm-act", type: "button", onClick: () => runHook() }, h("span", { class: "mdl" }, ""), "Run new task");
      const endBtn = () => h("button", { class: "tm-act", type: "button", disabled: !sel(), onClick: () => {
        const p = sel();
        if (p) endTask(p);
      } }, h("span", { class: "mdl" }, ""), sel()?.exe === "explorer.exe" ? "Restart" : "End task");
      const effBtn = () => h("button", { class: "tm-act", type: "button", disabled: !sel(), "aria-pressed": String(!!selected && efficiency.has(selected)), onClick: () => {
        const p = sel();
        if (p) toggleEfficiency(p);
      } }, h("span", { class: "mdl" }, ""), "Efficiency mode");
      const matches = (p) => {
        const q = query.trim().toLowerCase();
        return !q || p.name.toLowerCase().includes(q) || p.exe.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q) || String(p.pid) === q;
      };
      const header = (cols) => h("tr", null, cols.map(([k, label, cls]) => h("th", { class: `${cls} ${k && sort.key === k ? "sorted" : ""}`, onClick: k ? () => {
        sort = { key: k, desc: sort.key === k ? !sort.desc : k !== "name" && k !== "pid" };
        draw();
      } : void 0 }, label, k && sort.key === k ? h("span", { class: "mdl tm-caret" }, sort.desc ? "" : "") : null)));
      function processesPage() {
        const t = totals(procs);
        const heat = (v, max) => `--heat:${Math.min(1, v / max).toFixed(2)}`;
        const row = (p) => h(
          "tr",
          {
            class: `tm-row ${selected === p.pid ? "on" : ""}`,
            tabIndex: 0,
            onClick: () => {
              selected = p.pid;
              draw();
            },
            onDblclick: () => {
              if (p.winId) focusWindow(p.winId);
            },
            onContextmenu: (e) => procMenu(e, p),
            onKeydown: (e) => {
              if (e.key === "Delete") endTask(p);
            }
          },
          h("td", { class: "tm-name" }, p.winId ? appIcon(windowList().find((w) => w.id === p.winId)?.icon ?? "programs", 16) : h("span", { class: "mdl tm-pi" }, p.group === "windows" ? "" : ""), h("span", null, p.name)),
          h("td", { class: "tm-status" }, p.status === "Efficiency mode" ? h("span", { class: "mdl tm-leaf", title: "Efficiency mode" }, "") : null),
          h("td", { class: "num heat", style: heat(p.cpu, 10) }, pct(p.cpu)),
          h("td", { class: "num heat", style: heat(p.memMb, 600) }, fmtMb(p.memMb)),
          h("td", { class: "num heat", style: heat(p.diskMbs, 2) }, `${p.diskMbs.toFixed(1)} MB/s`),
          h("td", { class: "num heat", style: heat(p.netMbps, 2) }, `${p.netMbps.toFixed(1)} Mbps`)
        );
        const group2 = (g6, label) => {
          const list = sortProcs(procs.filter((p) => p.group === g6 && matches(p)), sort.key, sort.desc);
          if (!list.length) return [];
          const open = !collapsed.has(g6);
          return [h("tr", { class: "tm-group", onClick: () => {
            if (open) collapsed.add(g6);
            else collapsed.delete(g6);
            draw();
          } }, h("td", { colspan: "6" }, h("span", { class: "mdl" }, open ? "" : ""), `${label} (${list.length})`)), ...open ? list.map(row) : []];
        };
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Processes", runBtn(), endBtn(), effBtn()),
          h("div", { class: "tm-scroll" }, h(
            "table",
            { class: "tm-table" },
            h("thead", null, header([["name", "Name", ""], [null, "Status", "tm-status"], ["cpu", `${pct(t.cpu)}
CPU`, "num"], ["memMb", `${t.memPct}%
Memory`, "num"], ["diskMbs", `${Math.min(100, Math.round(t.diskMbs * 8))}%
Disk`, "num"], ["netMbps", `${Math.round(t.netMbps * 10)}%
Network`, "num"]])),
            h("tbody", null, ...group2("app", "Apps"), ...group2("background", "Background processes"), ...group2("windows", "Windows processes"))
          ))
        );
      }
      function performancePage() {
        const t = totals(procs);
        const online = navigator.onLine && !sys().airplane;
        const up = Math.floor((Date.now() - started) / 1e3) + 3 * 86400 + 4 * 3600;
        const upText = `${Math.floor(up / 86400)}:${String(Math.floor(up % 86400 / 3600)).padStart(2, "0")}:${String(Math.floor(up % 3600 / 60)).padStart(2, "0")}:${String(up % 60).padStart(2, "0")}`;
        const tiles = [
          ["cpu", "CPU", `${pct(t.cpu)}  2.70 GHz`, hist.cpu, 100, "c-cpu"],
          ["memory", "Memory", `${fmtMb(t.memMb)}/${fmtMb(INSTALLED_MB)} (${t.memPct}%)`, hist.mem, 100, "c-mem"],
          ["disk", "Disk 0 (C:)", `SSD
${Math.min(100, Math.round(t.diskMbs * 8))}%`, hist.disk, 100, "c-disk"],
          ["ethernet", "Ethernet", online ? `Ethernet
S: 0.1  R: ${(t.netMbps * 1e3).toFixed(0)} Kbps` : "Not connected", hist.net, 5, "c-net"]
        ];
        const cur = tiles.find((x) => x[0] === perfView);
        const kv = (pairs) => h("div", { class: "tm-kv" }, pairs.map(([k, v]) => h("div", null, h("span", null, k), h("strong", null, v))));
        const details = {
          cpu: kv([["Utilization", pct(t.cpu)], ["Speed", "2.70 GHz"], ["Processes", String(t.count)], ["Threads", String(t.threads)], ["Handles", String(t.handles)], ["Up time", upText], ["Base speed", "2.70 GHz"], ["Sockets", "1"], ["Cores", "10"], ["Logical processors", "12"], ["Virtualization", "Enabled"], ["L3 cache", "12.0 MB"]]),
          memory: kv([["In use", fmtMb(t.memMb)], ["Available", fmtMb(INSTALLED_MB - t.memMb)], ["Committed", `${fmtMb(t.memMb * 1.3)}/${fmtMb(INSTALLED_MB * 1.4)}`], ["Cached", fmtMb(INSTALLED_MB * 0.28)], ["Speed", "4800 MT/s"], ["Slots used", "2 of 2"], ["Form factor", "SODIMM"], ["Hardware reserved", "241 MB"]]),
          disk: kv([["Active time", `${Math.min(100, Math.round(t.diskMbs * 8))}%`], ["Average response time", "0.4 ms"], ["Read speed", `${(t.diskMbs * 0.7).toFixed(1)} MB/s`], ["Write speed", `${(t.diskMbs * 0.3).toFixed(1)} MB/s`], ["Capacity", "477 GB"], ["Formatted", "476 GB"], ["System disk", "Yes"], ["Type", "SSD (NVMe)"]]),
          ethernet: kv([["Send", online ? "0.1 Kbps" : "0 Kbps"], ["Receive", `${(t.netMbps * 1e3).toFixed(0)} Kbps`], ["Adapter name", "Ethernet"], ["DNS name", store.world.ad.domain], ["Connection type", "Ethernet"], ["IPv4 address", String(globalThis.CorpDesk?.getState?.()?.ip ?? "10.77.0.21")], ["IPv6 address", "fe80::1c4f:9a2e:6b11:3d07%12"], ["Status", online ? "Connected" : sys().airplane ? "Disconnected (Airplane mode)" : "Disconnected"]])
        };
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Performance", runBtn()),
          h(
            "div",
            { class: "tm-perf" },
            h("div", { class: "tm-tiles" }, tiles.map(([id, name, sub, data, max, cls]) => h(
              "button",
              { class: `tm-tile ${perfView === id ? "on" : ""}`, type: "button", onClick: () => {
                perfView = id;
                draw();
              } },
              graph(data, max, cls, false),
              h("span", { class: "tm-tile-text" }, h("strong", null, name), h("span", null, sub))
            ))),
            h(
              "div",
              { class: "tm-detail" },
              h("div", { class: "tm-dhead" }, h("h2", null, cur[1]), h("span", null, perfView === "cpu" ? "12th Gen Intel(R) Core(TM) i7-1265U" : perfView === "memory" ? "16.0 GB" : perfView === "disk" ? "SAMSUNG MZVL2512HCJQ" : "Intel(R) Ethernet Connection (16) I219-LM")),
              h("div", { class: "tm-gcap" }, h("span", null, perfView === "cpu" ? "% Utilization over 60 seconds" : perfView === "memory" ? "Memory usage" : perfView === "disk" ? "Active time" : "Throughput"), h("span", null, perfView === "ethernet" ? "5 Mbps" : "100%")),
              graph(cur[3], cur[4], cur[5], true),
              details[perfView]
            )
          )
        );
      }
      function startupPage() {
        const y = sys();
        const impact = { coach: "Medium", notes: "Low", browser: "High", copilot: "Medium", terminal: "Low" };
        const publisher = { coach: "Meridian Health System", notes: "Microsoft Corporation", browser: "Google LLC", copilot: "Meridian Health System", terminal: "Microsoft Corporation" };
        let pick = host.dataset.startupPick ?? "";
        const enabled = (id) => y.startupApps.includes(id);
        const flip = (id) => {
          setSys({ startupApps: enabled(id) ? y.startupApps.filter((x) => x !== id) : [...y.startupApps, id] });
          draw();
        };
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Startup apps", runBtn(), pick ? button(enabled(pick) ? "Disable" : "Enable", () => flip(pick), "tm-act") : null),
          h("p", { class: "tm-note" }, "Apps that open when you sign in. The same list as Settings > Apps > Startup."),
          h("div", { class: "tm-scroll" }, h(
            "table",
            { class: "tm-table" },
            h("thead", null, h("tr", null, ["Name", "Publisher", "Status", "Startup impact"].map((c) => h("th", null, c)))),
            h("tbody", null, STARTUP_APPS.map(([id, label]) => h(
              "tr",
              {
                class: `tm-row ${pick === id ? "on" : ""}`,
                tabIndex: 0,
                onClick: () => {
                  pick = id;
                  host.dataset.startupPick = id;
                  draw();
                },
                onContextmenu: (e) => {
                  e.preventDefault();
                  showMenu(e.clientX, e.clientY, [{ label: enabled(id) ? "Disable" : "Enable", onClick: () => flip(id) }]);
                }
              },
              h("td", null, label),
              h("td", null, publisher[id] ?? ""),
              h("td", null, enabled(id) ? "Enabled" : "Disabled"),
              h("td", null, enabled(id) ? impact[id] ?? "Low" : "Not measured")
            )))
          ))
        );
      }
      function usersPage() {
        const t = totals(procs);
        const mine = procs.filter((p) => p.user.endsWith(`\\${store.world.player.sam}`));
        const cpu = mine.reduce((n, p) => n + p.cpu, 0), mem = mine.reduce((n, p) => n + p.memMb, 0);
        const open = userOpen;
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Users", runBtn()),
          h("div", { class: "tm-scroll" }, h(
            "table",
            { class: "tm-table" },
            h("thead", null, h("tr", null, h("th", null, "User"), h("th", null, "Status"), h("th", { class: "num" }, `${pct(t.cpu)}
CPU`), h("th", { class: "num" }, `${t.memPct}%
Memory`))),
            h(
              "tbody",
              null,
              h(
                "tr",
                { class: "tm-group", onClick: () => {
                  userOpen = !userOpen;
                  draw();
                } },
                h("td", null, h("span", { class: "mdl" }, open ? "" : ""), `${store.world.player.displayName} (${mine.length})`),
                h("td", null, "Active"),
                h("td", { class: "num" }, pct(cpu)),
                h("td", { class: "num" }, fmtMb(mem))
              ),
              ...open ? mine.map((p) => h("tr", { class: "tm-row", onContextmenu: (e) => procMenu(e, p) }, h("td", { class: "tm-name sub" }, h("span", null, p.name)), h("td", null, ""), h("td", { class: "num" }, pct(p.cpu)), h("td", { class: "num" }, fmtMb(p.memMb)))) : []
            )
          )),
          h("p", { class: "tm-note" }, `Signed in as ${store.world.ad.netbios}\\${store.world.player.sam} at the console. Other people sign in on their own workstations.`)
        );
      }
      function detailsPage() {
        const list = sortProcs(procs.filter(matches), sort.key === "diskMbs" || sort.key === "netMbps" ? "name" : sort.key, sort.desc);
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Details", runBtn(), endBtn(), effBtn()),
          h("div", { class: "tm-scroll" }, h(
            "table",
            { class: "tm-table dense" },
            h("thead", null, header([["name", "Name", ""], ["pid", "PID", "num"], [null, "Status", ""], [null, "User name", ""], ["cpu", "CPU", "num"], ["memMb", "Memory (active private working set)", "num"], [null, "Architecture", ""], [null, "Description", ""]])),
            h("tbody", null, list.map((p) => h(
              "tr",
              { class: `tm-row ${selected === p.pid ? "on" : ""}`, tabIndex: 0, onClick: () => {
                selected = p.pid;
                draw();
              }, onContextmenu: (e) => procMenu(e, p) },
              h("td", null, p.exe),
              h("td", { class: "num" }, String(p.pid)),
              h("td", null, p.status),
              h("td", null, p.user),
              h("td", { class: "num" }, String(Math.round(p.cpu)).padStart(2, "0")),
              h("td", { class: "num" }, `${Math.round(p.memMb * 1024).toLocaleString()} K`),
              h("td", null, "x64"),
              h("td", null, p.description)
            )))
          ))
        );
      }
      function servicesPage() {
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Services", runBtn()),
          h("div", { class: "tm-scroll" }, h(
            "table",
            { class: "tm-table dense" },
            h("thead", null, h("tr", null, ["Name", "PID", "Description", "Status", "Group"].map((c) => h("th", null, c)))),
            h("tbody", null, SERVICES.map((s) => h("tr", { class: "tm-row", title: s.description }, h("td", null, s.name), h("td", { class: "num" }, s.pid ? String(s.pid) : ""), h("td", null, s.display), h("td", null, s.status), h("td", null, s.group))))
          )),
          h("p", { class: "tm-note" }, "Netlogon keeps the secure channel to the domain controller; Windows Time keeps the clock within the 5 minutes Kerberos allows. Hover a service for what it does.")
        );
      }
      function settingsPage() {
        const p = prefs3();
        const save = (patch) => {
          store.settings.taskManager = { ...p, ...patch };
          persist();
          restartTimer();
          draw();
        };
        const selectEl = (value, options, onChange, label) => h("select", { class: "input", "aria-label": label, onChange: (e) => onChange(e.target.value) }, options.map(([v, l]) => h("option", { value: v, selected: v === value }, l)));
        return h(
          "div",
          { class: "tm-page" },
          toolbar("Settings"),
          h(
            "div",
            { class: "tm-settings" },
            h("div", { class: "tm-set" }, h("span", null, h("strong", null, "Default start page"), h("small", null, "Which page Task Manager opens on")), selectEl(p.startPage ?? "processes", NAV.map(([id, l]) => [id, l]), (v) => save({ startPage: v }), "Default start page")),
            h("div", { class: "tm-set" }, h("span", null, h("strong", null, "Real time update speed"), h("small", null, "How often the figures refresh")), selectEl(p.speed ?? "normal", [["high", "High"], ["normal", "Normal"], ["low", "Low"], ["paused", "Paused"]], (v) => save({ speed: v }), "Update speed"))
          )
        );
      }
      function draw() {
        const scroller = host.querySelector(".tm-scroll");
        const top = scroller?.scrollTop ?? 0;
        clear(host);
        const body = page === "processes" ? processesPage() : page === "performance" ? performancePage() : page === "startup" ? startupPage() : page === "users" ? usersPage() : page === "details" ? detailsPage() : page === "services" ? servicesPage() : settingsPage();
        const navBtn = (id, label, icon) => h("button", { class: `tm-nav-item ${page === id ? "on" : ""}`, type: "button", title: label, "aria-label": label, onClick: () => {
          page = id;
          selected = null;
          draw();
        } }, h("span", { class: "mdl" }, icon), navOpen ? h("span", null, label) : null);
        host.appendChild(h(
          "div",
          { class: `tm ${navOpen ? "" : "narrow"}` },
          h(
            "nav",
            { class: "tm-nav", "aria-label": "Task Manager" },
            h("button", { class: "tm-nav-item", type: "button", title: navOpen ? "Collapse navigation" : "Expand navigation", "aria-label": "Navigation", onClick: () => {
              navOpen = !navOpen;
              draw();
            } }, h("span", { class: "mdl" }, "")),
            NAV.map(([id, label, icon]) => navBtn(id, label, icon)),
            h("div", { class: "tm-nav-fill" }),
            navBtn("settings", "Settings", "")
          ),
          body
        ));
        const next = host.querySelector(".tm-scroll");
        if (next) next.scrollTop = top;
      }
      let timer = 0;
      const restartTimer = () => {
        clearInterval(timer);
        const ms = SPEED_MS[prefs3().speed ?? "normal"];
        if (!ms) return;
        timer = window.setInterval(() => {
          sample();
          if (document.querySelector(".cm") || host.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
          draw();
        }, ms);
      };
      for (let i = 0; i < 8; i++) sample();
      draw();
      restartTimer();
      return { dispose: () => clearInterval(timer) };
    }
  };

  // winapps/ui/theme.ts
  function appearance() {
    const p = state?.preferences?.pointer ?? {};
    return { pointerStyle: p.pointerStyle ?? "white", pointerSize: p.pointerSize ?? 1, pointerColor: p.pointerColor ?? "#00b7ff" };
  }
  function applyPointer() {
    const a = appearance();
    const desktop = document.getElementById("desktop");
    if (!desktop) return;
    if (a.pointerStyle === "white" && a.pointerSize === 1) {
      desktop.style.cursor = "";
      return;
    }
    const fill = a.pointerStyle === "black" ? "#000" : a.pointerStyle === "custom" ? a.pointerColor : a.pointerStyle === "inverted" ? "#000" : "#fff";
    const stroke = a.pointerStyle === "black" || a.pointerStyle === "inverted" ? "#fff" : "#000";
    const px = Math.round(16 * (1 + (a.pointerSize - 1) * 0.5));
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${Math.round(px * 1.5)}' viewBox='0 0 16 24'><path d='M1 1v19l5-5 3.5 7 3-1.5-3.5-7H16z' fill='${fill}' stroke='${stroke}' stroke-width='1.2'/></svg>`;
    desktop.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 1 1, default`;
  }

  // winapps/ui/apps/settings.ts
  var g4 = globalThis;
  function setAppearance(patch) {
    const prefs3 = state.preferences || (state.preferences = {});
    prefs3.pointer = { ...appearance(), ...patch };
    g4.save();
    applyPointer();
  }

  // winapps/ui/apps/control.ts
  var launch = () => {
  };
  function setControlPanelLauncher(fn) {
    launch = fn;
  }
  var SCHEMES = [
    ["Windows Default (system scheme)", { pointerStyle: "white", pointerSize: 1 }],
    ["Windows Default (large) (system scheme)", { pointerStyle: "white", pointerSize: 3 }],
    ["Windows Default (extra large) (system scheme)", { pointerStyle: "white", pointerSize: 4 }],
    ["Windows Black (system scheme)", { pointerStyle: "black", pointerSize: 1 }],
    ["Windows Black (large) (system scheme)", { pointerStyle: "black", pointerSize: 3 }],
    ["Windows Inverted (system scheme)", { pointerStyle: "inverted", pointerSize: 1 }],
    ["Windows Inverted (large) (system scheme)", { pointerStyle: "inverted", pointerSize: 3 }],
    ["Windows Standard (custom colour)", { pointerStyle: "custom", pointerSize: 2 }]
  ];
  function openMouseProperties() {
    const before = appearance();
    let tab = "pointers";
    let pending = {};
    const shield = h("div", { class: "mm-shield", style: "position:fixed;z-index:100000" });
    const body = h("div", { class: "mm-dlg-body" });
    const close = () => shield.remove();
    const current = () => ({ ...before, ...pending });
    const draw = () => {
      clear(body);
      const a = current();
      const scheme = SCHEMES.find(([, p]) => p.pointerStyle === a.pointerStyle && p.pointerSize === a.pointerSize)?.[0] ?? "(None)";
      body.appendChild(h("div", { class: "mm-tabrow" }, ["buttons", "pointers", "options"].map((t) => h("div", { class: `mm-tab ${tab === t ? "sel" : ""}`, onClick: () => {
        tab = t;
        draw();
      } }, t === "buttons" ? "Buttons" : t === "pointers" ? "Pointers" : "Pointer Options"))));
      if (tab === "pointers") {
        body.appendChild(h(
          "div",
          { class: "mm-tabpanel", style: "min-height:300px" },
          h(
            "fieldset",
            { class: "mm-fs" },
            h("legend", null, "Scheme"),
            h(
              "select",
              { onChange: (e) => {
                const s = SCHEMES.find(([n]) => n === e.target.value);
                if (s) {
                  pending = { ...pending, ...s[1] };
                  draw();
                }
              } },
              h("option", { selected: scheme === "(None)" }, "(None)"),
              SCHEMES.map(([n]) => h("option", { selected: n === scheme }, n))
            )
          ),
          h("div", null, "Customize:"),
          h("div", { class: "mm-lb", style: "height:180px" }, ...["Normal Select", "Help Select", "Working in Background", "Busy", "Precision Select", "Text Select", "Handwriting", "Unavailable", "Link Select"].map((n, i) => h("div", { class: "cp-cursor-row" }, h("span", null, n), h("span", { class: "cp-cursor", style: `background:${a.pointerStyle === "black" ? "#000" : a.pointerStyle === "custom" ? a.pointerColor : "#fff"};width:${10 + a.pointerSize * 3}px;height:${14 + a.pointerSize * 4}px;${i === 5 ? "width:3px" : ""}` })))),
          h("div", { class: "mm-chk" }, h("input", { type: "checkbox", id: "cp-shadow", checked: true }), h("label", { for: "cp-shadow" }, "Enable pointer shadow"))
        ));
      } else if (tab === "options") {
        body.appendChild(h(
          "div",
          { class: "mm-tabpanel", style: "min-height:300px" },
          h("fieldset", { class: "mm-fs" }, h("legend", null, "Motion"), "Select a pointer speed:", h("input", { type: "range", min: "1", max: "20", value: "10" }), h("div", { class: "mm-chk" }, h("input", { type: "checkbox", id: "cp-prec", checked: true }), h("label", { for: "cp-prec" }, "Enhance pointer precision"))),
          h("fieldset", { class: "mm-fs" }, h("legend", null, "Visibility"), h("div", { class: "mm-chk" }, h("input", { type: "checkbox", id: "cp-hide", checked: true }), h("label", { for: "cp-hide" }, "Hide pointer while typing")))
        ));
      } else {
        body.appendChild(h(
          "div",
          { class: "mm-tabpanel", style: "min-height:300px" },
          h("fieldset", { class: "mm-fs" }, h("legend", null, "Button configuration"), h("div", { class: "mm-chk" }, h("input", { type: "checkbox", id: "cp-swap", disabled: true }), h("label", { for: "cp-swap" }, "Switch primary and secondary buttons"))),
          h("fieldset", { class: "mm-fs" }, h("legend", null, "Double-click speed"), h("input", { type: "range", min: "1", max: "10", value: "5" }))
        ));
      }
    };
    shield.appendChild(h(
      "div",
      { class: "mm-dlg", style: "width:min(420px, calc(100% - 16px))" },
      h("div", { class: "mm-dlg-title" }, glyph("properties"), h("span", { class: "t" }, "Mouse Properties"), h("button", { class: "mm-dlg-x", type: "button", onClick: close }, "✕")),
      body,
      h(
        "div",
        { class: "mm-dlg-foot" },
        h("button", { class: "mm-btn default", type: "button", onClick: () => {
          setAppearance(pending);
          close();
        } }, "OK"),
        h("button", { class: "mm-btn", type: "button", onClick: close }, "Cancel"),
        h("button", { class: "mm-btn", type: "button", onClick: () => setAppearance(pending) }, "Apply")
      )
    ));
    draw();
    document.body.appendChild(shield);
  }
  function dateTimeDialog() {
    const shield = h("div", { class: "mm-shield", style: "position:fixed;z-index:100000" });
    const close = () => shield.remove();
    const now = /* @__PURE__ */ new Date();
    shield.appendChild(h(
      "div",
      { class: "mm-dlg", style: "width:min(400px, calc(100% - 16px))" },
      h("div", { class: "mm-dlg-title" }, h("span", { class: "t" }, "Date and Time"), h("button", { class: "mm-dlg-x", type: "button", onClick: close }, "✕")),
      h("div", { class: "mm-dlg-body" }, h(
        "div",
        { class: "mm-tabpanel", style: "min-height:0" },
        h("p", null, `Date: ${now.toLocaleDateString(void 0, { dateStyle: "full" })}`),
        h("p", null, `Time: ${now.toLocaleTimeString()}`),
        h("fieldset", { class: "mm-fs" }, h("legend", null, "Time zone"), Intl.DateTimeFormat().resolvedOptions().timeZone),
        h("p", { class: "muted" }, "Time is synchronized with LAB-DC01.corp.example.test. Kerberos needs clocks within 5 minutes of the DC.")
      )),
      h("div", { class: "mm-dlg-foot" }, h("button", { class: "mm-btn default", type: "button", onClick: close }, "OK"))
    ));
    document.body.appendChild(shield);
  }
  var controlPanelApp = {
    id: "control",
    title: "Control Panel",
    icon: "control",
    width: 900,
    height: 600,
    mount(host, win) {
      let page = "home";
      onOpenArg(win, (p) => {
        if (p) {
          page = p;
          draw();
        }
      });
      const go = (p) => {
        page = p;
        draw();
      };
      const link = (label, fn) => h("a", { href: "#", class: "cp-link", onClick: (e) => {
        e.preventDefault();
        fn();
      } }, label);
      const category = (icon, title, open, links) => h("div", { class: "cp-cat" }, appIcon(icon, 48), h("div", null, link(title, open), h("div", { class: "cp-sub" }, links.map(([l, f]) => link(l, f)))));
      function body() {
        switch (page) {
          case "home":
            return h(
              "div",
              null,
              h("h2", { class: "cp-h" }, "Adjust your computer's settings"),
              h(
                "div",
                { class: "cp-grid" },
                category("control", "System and Security", () => go("system"), [["Review your computer's status", () => go("system")], ["Administrative Tools", () => go("admin")]]),
                category("network", "Network and Internet", () => launch("settings:network"), [["View network status and tasks", () => launch("settings:network")]]),
                category("mouse", "Hardware and Sound", () => go("hardware"), [["Mouse", openMouseProperties], ["Devices and Printers", () => go("hardware")]]),
                category("programs", "Programs", () => go("programs"), [["Uninstall a program", () => go("programs")]]),
                category("user", "User Accounts", () => go("users"), [["Change account type", () => go("users")]]),
                category("settings", "Appearance and Personalization", () => launch("settings:personalization"), [["Change the theme", () => launch("settings:themes")], ["Change desktop background", () => launch("settings:background")]]),
                category("clock", "Clock and Region", () => go("clock"), [["Change date, time, or number formats", dateTimeDialog]]),
                category("access", "Ease of Access", () => launch("settings:pointer"), [["Change how your mouse works", () => launch("settings:pointer")]])
              )
            );
          case "system":
            return h("div", null, h("h2", { class: "cp-h" }, "System and Security"), h(
              "div",
              { class: "cp-list" },
              link("Security and Maintenance", () => launch("settings:privacy")),
              link("Windows Defender Firewall", () => launch("settings:privacy")),
              link("System", () => launch("settings:about")),
              link("Windows Tools / Administrative Tools", () => go("admin")),
              link("Event Viewer", () => launch("eventvwr"))
            ));
          case "admin":
            return h("div", null, h("h2", { class: "cp-h" }, "Windows Tools"), h(
              "div",
              { class: "cp-tools" },
              ...[["aduc", "Active Directory Users and Computers", "dsa.msc"], ["aduc", "Active Directory Domains and Trusts", "domain.msc"], ["eventviewer", "Event Viewer", "eventvwr"], ["powershell", "Windows PowerShell", "powershell"], ["powershell", "Windows PowerShell ISE", "ise"], ["explorer", "File Explorer", "explorer"], ["notepad", "Notepad", "notepad"], ["control", "Control Panel", "control"]].map(([icon, label, cmd]) => h("button", { class: "cp-tool", type: "button", onDblclick: () => launch(cmd), onKeydown: (e) => {
                if (e.key === "Enter") launch(cmd);
              } }, appIcon(icon, 40), h("span", null, label)))
            ));
          case "hardware":
            return h("div", null, h("h2", { class: "cp-h" }, "Hardware and Sound"), h("div", { class: "cp-list" }, link("Mouse", openMouseProperties), link("Devices and Printers", () => launch("settings:devices")), link("Display", () => launch("settings:display"))));
          case "programs":
            return h(
              "div",
              null,
              h("h2", { class: "cp-h" }, "Programs and Features"),
              h("p", { class: "muted" }, "To uninstall a program, select it from the list. Uninstall is restricted by your organization."),
              h(
                "table",
                { class: "grid" },
                h("thead", null, h("tr", null, h("th", null, "Name"), h("th", null, "Publisher"), h("th", null, "Version"))),
                h("tbody", null, [["Google Chrome", "Google LLC", "129.0.6668.90"], ["Microsoft Edge WebView2 Runtime", "Microsoft Corporation", "129.0.2792.79"], ["Remote Server Administration Tools", "Microsoft Corporation", "10.0.22621"], ["Microsoft Graph PowerShell SDK", "Microsoft Corporation", "2.25.0"], ["Ollama", "Ollama", "local"]].map((r) => h("tr", null, r.map((c) => h("td", null, c)))))
              )
            );
          case "users":
            return h("div", null, h("h2", { class: "cp-h" }, "User Accounts"), h("div", { class: "cp-cat" }, appIcon("user", 64), h("div", null, h("strong", null, store.world.player.displayName), h("div", { class: "muted" }, `${store.world.ad.netbios}\\${store.world.player.sam}, Domain user`), h("div", { class: "muted" }, `Administrative work runs as ${store.world.ad.netbios}\\${store.world.player.adminSam}`))));
          case "clock":
            return h("div", null, h("h2", { class: "cp-h" }, "Clock and Region"), h("div", { class: "cp-list" }, link("Date and Time", dateTimeDialog), link("Change date, time, or number formats", () => launch("settings:time"))));
          default:
            launch("settings:personalization");
            page = "home";
            return body();
        }
      }
      function draw() {
        clear(host);
        const crumbs = page === "home" ? [["Control Panel", "home"]] : [["Control Panel", "home"], [{ system: "System and Security", admin: "Windows Tools", appearance: "Appearance and Personalization", clock: "Clock and Region", programs: "Programs and Features", users: "User Accounts", hardware: "Hardware and Sound", home: "" }[page], page]];
        host.appendChild(h(
          "div",
          { class: "cp" },
          h(
            "div",
            { class: "fx-addr" },
            h("button", { class: "fx-nav", type: "button", title: "Back", disabled: page === "home", onClick: () => go("home") }, ""),
            h("div", { class: "fx-crumbs" }, crumbs.map(([t, p], i) => [i ? h("span", { class: "fx-chev" }, "") : null, h("button", { class: "fx-crumb", type: "button", onClick: () => go(p) }, t)])),
            h("input", { class: "fx-search", type: "search", placeholder: "Search Control Panel", "aria-label": "Search Control Panel", onKeydown: (e) => {
              if (e.key === "Enter") {
                const q = e.target.value.toLowerCase();
                if (/mouse|pointer|cursor/.test(q)) openMouseProperties();
                else if (/admin|tool/.test(q)) go("admin");
                else if (/program|uninstall/.test(q)) go("programs");
                else launch("settings:home");
              }
            } })
          ),
          h("div", { class: "cp-body", "data-keep-scroll": "" }, body())
        ));
        win.setTitle(crumbs.at(-1)[0]);
      }
      draw();
      return { redraw: draw };
    }
  };

  // winapps/host.ts
  var g5 = globalThis;
  var REGISTRY = {
    calculator: { def: calculatorApp, name: "Calculator", short: "Calculator", icon: "calculator" },
    taskmanager: { def: taskManagerApp, name: "Task Manager", short: "Task Manager", icon: "taskmgr" },
    control: { def: controlPanelApp, name: "Control Panel", short: "Control Panel", icon: "control" }
  };
  for (const [id, r] of Object.entries(REGISTRY)) {
    const existing = apps.find((a) => a.id === id);
    if (existing) Object.assign(existing, { name: r.name, short: r.short, icon: iconSvg(r.icon) });
    else apps.push({ id, name: r.name, short: r.short, bg: "transparent", fg: "#fff", icon: iconSvg(r.icon) });
  }
  var $ = (s) => document.querySelector(s);
  var desktopIcons = $("#desktopIcons");
  var startApps = $("#startApps");
  if (desktopIcons) desktopIcons.innerHTML = apps.map((a) => appButton(a, "desktop")).join("");
  if (startApps) startApps.innerHTML = apps.map((a) => appButton(a, "start")).join("");
  setToastHook((message) => {
    g5.toast?.(message);
    return false;
  });
  var live = /* @__PURE__ */ new Map();
  function frameOf(id) {
    return document.querySelector(`#desktop .app-window[data-app="${id}"]`);
  }
  function mount(id) {
    const body = document.getElementById("appBody");
    const entry = REGISTRY[id];
    if (!body || !entry) return;
    const current = live.get(id);
    if (current && current.host.parentElement === body) return;
    current?.handle && current.handle.dispose?.();
    body.replaceChildren();
    const host = document.createElement("div");
    host.className = "wa";
    host.dataset.wa = id;
    body.appendChild(host);
    const frame = frameOf(id);
    if (frame && !frame.dataset.waSized) {
      frame.dataset.waSized = "true";
      if (!frame.classList.contains("maximized")) {
        frame.style.width = `${Math.min(entry.def.width, innerWidth - 24)}px`;
        frame.style.height = `${Math.min(entry.def.height, innerHeight - 76)}px`;
      }
    }
    const win = {
      id,
      setTitle: (title) => {
        const s = frameOf(id)?.querySelector(".window-caption > span:last-child");
        if (s) s.textContent = title === entry.name ? entry.name : `${title}`;
      },
      close: () => g5.CorpDesk?.closeApp?.(id)
    };
    const handle = entry.def.mount(host, win);
    live.set(id, { host, win, handle });
  }
  var previousRender = g5.render;
  g5.render = () => {
    if (currentApp && REGISTRY[currentApp]) mount(currentApp);
    else previousRender();
  };
  var api = g5.CorpDesk || (g5.CorpDesk = {});
  var afterClose = api.afterCloseApp;
  api.afterCloseApp = (id) => {
    const it = live.get(id);
    if (it) {
      it.handle && it.handle.dispose?.();
      live.delete(id);
    }
    afterClose?.(id);
  };
  api.openControlPanel = (page) => {
    g5.openApp("control");
    const it = live.get("control");
    if (it && page) deliverOpenArg(it.win, page);
  };
  var SETTINGS_PAGE = {
    network: "Network & internet",
    personalization: "Personalization",
    themes: "Themes",
    background: "Background",
    pointer: "Mouse",
    privacy: "Privacy & security",
    about: "About",
    devices: "Bluetooth & devices",
    display: "Display",
    time: "Date & time",
    home: "Home"
  };
  var COMMAND_APP = {
    eventvwr: "events",
    "dsa.msc": "directory",
    "domain.msc": "directory",
    powershell: "terminal",
    ise: "terminal",
    explorer: "files",
    notepad: "notepadpp",
    control: "control"
  };
  setControlPanelLauncher((what) => {
    if (what.startsWith("settings:")) {
      const page = SETTINGS_PAGE[what.slice(9)] ?? "Home";
      g5.CorpDesk?.settingsNavigate ? g5.CorpDesk.settingsNavigate(page) : g5.openApp("network");
      return;
    }
    const app = COMMAND_APP[what];
    if (app) g5.openApp(app);
  });
  setRunNewTask(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "r", altKey: true, bubbles: true })));
  document.getElementById("loginForm")?.addEventListener("submit", () => {
    const list = globalThis.CorpDesk?.getState?.()?.preferences?.startupApps ?? [];
    setTimeout(() => {
      for (const id of list) if (apps.some((a) => a.id === id)) g5.openApp(id);
    }, 0);
  });
  applyPointer();
})();
