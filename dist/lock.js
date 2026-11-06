(() => {
  // lock/wallpaperGenerator.ts
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var PALETTES = [
    { name: "Midnight", bg: ["#0a0d12", "#111a24"], ink: "#4ec9b0", accent: "#7fd1c1" },
    { name: "Cobalt", bg: ["#080f1e", "#12203a"], ink: "#5b8def", accent: "#89b4ff" },
    { name: "Graphite", bg: ["#0c0c0e", "#1a1a1f"], ink: "#8a95a3", accent: "#c3ccd8" },
    { name: "Plum", bg: ["#120a18", "#241033"], ink: "#b57edc", accent: "#d3aef0" },
    { name: "Ember", bg: ["#140b06", "#2a1408"], ink: "#d7853d", accent: "#f0b477" },
    { name: "Moss", bg: ["#07120c", "#0f2418"], ink: "#5aa871", accent: "#8fd3a3" },
    { name: "Slate", bg: ["#0b0f14", "#16202b"], ink: "#6b8ba4", accent: "#a3c0d6" },
    { name: "Rust", bg: ["#150a0a", "#2b1212"], ink: "#c1615b", accent: "#e59a95" }
  ];
  var MOTIFS = ["Mesh", "Orbit", "Lattice", "Drift", "Ridge", "Bloom"];
  var W = 1920;
  var H = 1080;
  function span(r, lo, hi) {
    return lo + r() * (hi - lo);
  }
  function mesh(r, ink, accent) {
    const count = Math.round(span(r, 14, 26));
    const nodes2 = Array.from({ length: count }, () => ({
      x: span(r, 60, W - 60),
      y: span(r, 60, H - 60),
      size: span(r, 2, 5)
    }));
    const edges = [];
    for (let i = 0; i < nodes2.length; i += 1) {
      const a = nodes2[i];
      const others = nodes2.map((n, j) => ({ n, j, d: Math.hypot(n.x - a.x, n.y - a.y) })).filter((o) => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2);
      for (const o of others) {
        edges.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${o.n.x.toFixed(1)} ${o.n.y.toFixed(1)}`);
      }
    }
    return `<path d="${edges.join("")}" stroke="${ink}" stroke-width="0.8" fill="none" opacity="0.20"/>` + nodes2.map(
      (n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.size.toFixed(1)}" fill="${accent}" opacity="0.42"/>`
    ).join("");
  }
  function orbit(r, ink, accent) {
    const cx = span(r, W * 0.3, W * 0.7);
    const cy = span(r, H * 0.3, H * 0.7);
    const rings = Math.round(span(r, 7, 14));
    const gap = span(r, 55, 110);
    const out = [];
    for (let i = 1; i <= rings; i += 1) {
      const radius = i * gap;
      const dash = r() > 0.6 ? ` stroke-dasharray="${span(r, 4, 22).toFixed(0)} ${span(r, 6, 26).toFixed(0)}"` : "";
      out.push(
        `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${radius.toFixed(0)}" fill="none" stroke="${ink}" stroke-width="${span(r, 0.6, 1.6).toFixed(2)}" opacity="${(0.3 - i * 0.016).toFixed(3)}"${dash}/>`
      );
    }
    out.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="7" fill="${accent}" opacity="0.5"/>`);
    return out.join("");
  }
  function lattice(r, ink, accent) {
    const step = span(r, 70, 130);
    const skew = span(r, -0.35, 0.35);
    const out = [];
    for (let x = -H; x < W + H; x += step) {
      out.push(`M${x.toFixed(0)} 0L${(x + skew * H).toFixed(0)} ${H}`);
    }
    for (let y = 0; y < H; y += step) {
      out.push(`M0 ${y.toFixed(0)}L${W} ${y.toFixed(0)}`);
    }
    const dots = Math.round(span(r, 5, 12));
    const marks = Array.from({ length: dots }, () => {
      const gx = Math.round(span(r, 1, W / step - 1)) * step;
      const gy = Math.round(span(r, 1, H / step - 1)) * step;
      return `<rect x="${(gx - 4).toFixed(0)}" y="${(gy - 4).toFixed(0)}" width="8" height="8" fill="${accent}" opacity="0.45"/>`;
    }).join("");
    return `<path d="${out.join("")}" stroke="${ink}" stroke-width="0.6" fill="none" opacity="0.13"/>${marks}`;
  }
  function drift(r, ink, accent) {
    const lines = Math.round(span(r, 8, 16));
    const amp = span(r, 30, 110);
    const out = [];
    for (let i = 0; i < lines; i += 1) {
      const y = H / (lines + 1) * (i + 1);
      const phase = span(r, 0, Math.PI * 2);
      const pts = [];
      for (let x = 0; x <= W; x += 60) {
        const yy = y + Math.sin(x / span(r, 240, 420) + phase) * amp * (0.4 + r() * 0.2);
        pts.push(`${x === 0 ? "M" : "L"}${x} ${yy.toFixed(1)}`);
      }
      out.push(
        `<path d="${pts.join("")}" fill="none" stroke="${i % 4 === 0 ? accent : ink}" stroke-width="${span(r, 0.7, 1.8).toFixed(2)}" opacity="${span(r, 0.1, 0.28).toFixed(3)}"/>`
      );
    }
    return out.join("");
  }
  function ridge(r, ink, accent) {
    const layers = Math.round(span(r, 3, 6));
    const out = [];
    for (let i = 0; i < layers; i += 1) {
      const base = H * (0.55 + i * 0.09);
      const pts = [`M0 ${H}`, `L0 ${base.toFixed(0)}`];
      for (let x = 0; x <= W; x += span(r, 90, 200)) {
        pts.push(`L${x.toFixed(0)} ${(base - span(r, 0, 130)).toFixed(0)}`);
      }
      pts.push(`L${W} ${H}Z`);
      out.push(
        `<path d="${pts.join("")}" fill="${i === layers - 1 ? accent : ink}" opacity="${(0.06 + i * 0.02).toFixed(3)}"/>`
      );
    }
    return out.join("");
  }
  function bloom(r, ink, accent) {
    const count = Math.round(span(r, 5, 11));
    return Array.from({ length: count }, (_, i) => {
      const cx = span(r, 0, W);
      const cy = span(r, 0, H);
      const rad = span(r, 140, 460);
      return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${i % 3 === 0 ? accent : ink}" opacity="${span(r, 0.03, 0.09).toFixed(3)}"/>`;
    }).join("");
  }
  var DRAW = {
    Mesh: mesh,
    Orbit: orbit,
    Lattice: lattice,
    Drift: drift,
    Ridge: ridge,
    Bloom: bloom
  };
  function seedToId(seed, kind) {
    return `gen-${kind}-${(seed >>> 0).toString(36)}`;
  }
  function idToSeed(id) {
    const m = /^gen-(wall|lock)-([0-9a-z]+)$/.exec(id);
    if (!m) return null;
    const seed = parseInt(m[2], 36);
    if (!Number.isFinite(seed)) return null;
    return { seed, kind: m[1] };
  }
  function generateWallpaper(seed, kind = "wall") {
    const r = rng(seed);
    const palette = PALETTES[Math.floor(r() * PALETTES.length)];
    const motif = MOTIFS[Math.floor(r() * MOTIFS.length)];
    const angle = Math.round(span(r, 100, 200));
    const strength = kind === "lock" ? 0.75 : 1;
    const art = DRAW[motif](r, palette.ink, palette.accent);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><defs><linearGradient id='g' gradientTransform='rotate(${angle})'><stop offset='0' stop-color='${palette.bg[0]}'/><stop offset='1' stop-color='${palette.bg[1]}'/></linearGradient></defs><rect width='${W}' height='${H}' fill='url(#g)'/><g opacity='${strength}'>${art}</g></svg>`;
    return {
      id: seedToId(seed, kind),
      label: `${palette.name} ${motif}`,
      gradient: `${palette.bg[0]} url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover no-repeat`
    };
  }
  function randomSeed() {
    return Math.floor(Math.random() * 4294967295) >>> 0;
  }
  function generateBatch(count, kind, existingIds = []) {
    const taken = new Set(existingIds);
    const out = [];
    let guard = 0;
    while (out.length < count && guard < count * 20) {
      guard += 1;
      const wp = generateWallpaper(randomSeed(), kind);
      if (taken.has(wp.id)) continue;
      taken.add(wp.id);
      out.push(wp);
    }
    return out;
  }

  // lock/wallpapers.ts
  function wordmark(bg, word, ink) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'>
    <rect width='100%' height='100%' fill='${bg}'/>
    <text x='50%' y='50%' font-family='Segoe UI, -apple-system, sans-serif' font-size='200'
      font-weight='800' fill='${ink}' fill-opacity='0.32' text-anchor='middle'
      dominant-baseline='middle' letter-spacing='6'>${word}</text>
  </svg>`;
    return `${bg} url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover no-repeat`;
  }
  var COLOURS = [
    { id: "deep-blue", label: "Deep Blue", gradient: "linear-gradient(150deg,#0b3a5e 0%,#123f63 40%,#0e2438 100%)" },
    { id: "slate", label: "Slate", gradient: "linear-gradient(150deg,#141a21 0%,#1e262f 45%,#0d1117 100%)" },
    { id: "dusk", label: "Dusk", gradient: "linear-gradient(160deg,#2a1b3d 0%,#44318d 45%,#1b1032 100%)" },
    { id: "forest", label: "Forest", gradient: "linear-gradient(150deg,#0d2818 0%,#14432a 45%,#08170f 100%)" },
    { id: "magenta", label: "Magenta", gradient: "linear-gradient(160deg,#2a0d1e 0%,#5a1e42 45%,#2a0d1e 100%)" },
    { id: "obsidian", label: "Obsidian", gradient: "linear-gradient(150deg,#0c0c0c 0%,#1f1f1f 45%,#0c0c0c 100%)" },
    { id: "copper", label: "Copper", gradient: "linear-gradient(160deg,#2a1b0e 0%,#5a3a1e 45%,#2a1b0e 100%)" },
    { id: "midnight-blue", label: "Midnight Blue", gradient: "linear-gradient(145deg,#0a1128 0%,#1a2456 60%,#0a1128 100%)" },
    { id: "warm-amber", label: "Warm Amber", gradient: "linear-gradient(145deg,#241a0d 0%,#3d2e10 60%,#1a1000 100%)" },
    { id: "purple-haze", label: "Purple Haze", gradient: "linear-gradient(160deg,#1a1029 0%,#3a2468 50%,#1a1029 100%)" },
    { id: "rose-gold", label: "Rose Gold", gradient: "linear-gradient(150deg,#2b181c 0%,#5a333e 50%,#2b181c 100%)" },
    { id: "windows-blue", label: "Windows Blue", gradient: "linear-gradient(135deg,#0b3d91 0%,#1e5fbf 35%,#5b8def 70%,#a7c7f2 100%)" }
  ];
  var MARKS = [
    { id: "corp-dark", label: "CORP Dark", gradient: wordmark("#0a0c10", "CORP", "#5a6570") },
    { id: "corp-navy", label: "CORP Navy", gradient: wordmark("#08101a", "CORP", "#3a5a7a") },
    { id: "corp-teal", label: "CORP Teal", gradient: wordmark("#07151a", "CORP", "#3a8a8a") },
    { id: "corp-forest", label: "CORP Forest", gradient: wordmark("#09180f", "CORP", "#3a7a4a") },
    { id: "corp-purple", label: "CORP Purple", gradient: wordmark("#120a1c", "CORP", "#6a4a8a") },
    { id: "corp-crimson", label: "CORP Crimson", gradient: wordmark("#1a0a0e", "CORP", "#8a3a45") },
    { id: "corp-gold", label: "CORP Gold", gradient: wordmark("#141008", "CORP", "#8a6a2a") },
    { id: "it-slate", label: "IT Slate", gradient: wordmark("#10151c", "IT", "#4a5a6a") }
  ];
  var ART = [
    { id: "blue-shield", label: "Blue Glass Shield", gradient: '#07121f url("wallpapers/blue-shield.webp") center/cover no-repeat' },
    { id: "network-constellation", label: "Network Constellation", gradient: '#06121a url("wallpapers/network-constellation.webp") center/cover no-repeat' },
    { id: "emerald-core", label: "Emerald Secure Core", gradient: '#061411 url("wallpapers/emerald-core.webp") center/cover no-repeat' }
  ];
  var LOCK_SCREENS = [...COLOURS, ...MARKS, ...ART];
  var DEFAULT_LOCK_SCREEN_ID = "deep-blue";
  var CUSTOM_LOCK_KEY = "corpdesk-custom-lock-screen";
  function custom() {
    try {
      const data = localStorage.getItem(CUSTOM_LOCK_KEY);
      return data ? `#0b1a2c url("${data}") center/cover no-repeat` : null;
    } catch {
      return null;
    }
  }
  function backgroundFor(id) {
    if (id === "custom") return custom() ?? backgroundFor(DEFAULT_LOCK_SCREEN_ID);
    const hit = LOCK_SCREENS.find((w) => w.id === id);
    if (hit) return hit.gradient;
    const seed = id ? idToSeed(id) : null;
    if (seed) return generateWallpaper(seed.seed, seed.kind).gradient;
    return LOCK_SCREENS.find((w) => w.id === DEFAULT_LOCK_SCREEN_ID).gradient;
  }
  function allLockScreens(generated) {
    const gen = generated.map((id) => idToSeed(id)).filter((x) => !!x).map((x) => generateWallpaper(x.seed, x.kind));
    const own = custom();
    return [...LOCK_SCREENS, ...gen, ...own ? [{ id: "custom", label: "Your picture", gradient: own }] : []];
  }

  // lock/lockscreen.ts
  var g = globalThis;
  var $ = (sel) => document.querySelector(sel);
  var el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== void 0) e.textContent = text;
    return e;
  };
  var prefs = () => state.preferences || (state.preferences = {});
  var lockId = () => prefs().lockScreen || DEFAULT_LOCK_SCREEN_ID;
  var initials = (name2) => name2.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join("").slice(0, 2) || "T";
  var samOf = (name2) => name2.toLowerCase().replace(/\s+/g, ".");
  var login = $("#login");
  var form = $("#loginForm");
  var input = $("#technician");
  var time = $("#lockTime");
  var date = $("#lockDate");
  var submit = form.querySelector('button[type="submit"]');
  login.className = `lk${login.classList.contains("hidden") ? " hidden" : ""}`;
  login.setAttribute("role", "dialog");
  login.setAttribute("aria-label", "Lock screen");
  login.tabIndex = 0;
  login.replaceChildren();
  var graph = el("div", "lk-graph");
  graph.setAttribute("aria-hidden", "true");
  var nodes = [[26, 21], [14, 44], [31, 68], [44, 12], [52, 82], [69, 26], [83, 49], [74, 71], [61, 55], [38, 40]];
  graph.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${nodes.map(([x, y], i) => `<path d="M50 50 L${x} ${y}" style="animation-delay:${180 + i * 110}ms"/>`).join("")}${nodes.map(([x, y], i) => `<circle class="node" cx="${x}" cy="${y}" r="0.7" style="animation-delay:${i * 350}ms"/>`).join("")}<circle class="hub-ring" cx="50" cy="50" r="2.6"/><circle class="hub" cx="50" cy="50" r="1.2"/></svg>`;
  var brand = el("div", "lk-pill lk-brand", "CORP Desk");
  var author = el("div", "lk-pill lk-author", "Created by Erick Omari");
  var overview = el("a", "lk-pill lk-web", "← Lab overview");
  overview.href = "index.html";
  overview.addEventListener("click", (e) => e.stopPropagation());
  time.className = "lk-time";
  date.className = "lk-date";
  var clock = el("div", "lk-glass lk-clock");
  clock.append(time, date, el("div", "lk-hint", "Press any key or click to sign in"));
  var avatar = el("div", "avatar lk-avatar");
  var name = el("div", "lk-name");
  var upn = el("div", "lk-upn");
  var label = el("label", "lk-label", "Your display name");
  label.setAttribute("for", "technician");
  input.className = "lk-input";
  submit.className = "lk-btn";
  submit.textContent = "Sign in";
  form.className = "lk-form";
  form.replaceChildren(label, input, submit);
  var panel = el("div", "lk-glass lk-panel");
  panel.append(avatar, name, upn, form, el("div", "lk-cred", "Training profile · No password required"), el("div", "lk-domain", "Sign in to: CORP"));
  panel.addEventListener("click", (e) => e.stopPropagation());
  login.append(graph, brand, overview, author, clock, panel);
  function who() {
    const n = input.value.trim() || "Technician";
    if (!prefs().accountPicture) avatar.textContent = initials(n);
    name.textContent = n;
    upn.textContent = `CORP\\${samOf(n)} · Service Desk Technician`;
  }
  input.addEventListener("input", who);
  var stage = "lock";
  function showLock() {
    stage = "lock";
    login.style.background = backgroundFor(lockId());
    clock.hidden = false;
    panel.hidden = true;
    login.focus({ preventScroll: true });
  }
  function showSignIn() {
    if (stage === "signin") return;
    stage = "signin";
    who();
    clock.hidden = true;
    panel.hidden = false;
    panel.classList.remove("lk-in");
    void panel.offsetWidth;
    panel.classList.add("lk-in");
    input.focus();
    input.select();
  }
  login.addEventListener("click", () => {
    if (stage === "lock") showSignIn();
  });
  login.addEventListener("keydown", (e) => {
    if (stage === "lock" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      showSignIn();
    }
  });
  function showScreen() {
    showLock();
    showSignIn();
  }
  new MutationObserver(() => {
    if (!login.classList.contains("hidden")) showScreen();
  }).observe(login, { attributes: true, attributeFilter: ["class"] });
  showScreen();
  function lockNow() {
    $("#startMenu")?.classList.add("hidden");
    $("#desktop")?.classList.add("hidden");
    login.classList.remove("hidden");
  }
  var signOut = $("#signOut");
  if (signOut && !$("#lockButton")) {
    const lock = el("button", void 0, "Lock 🔒");
    lock.id = "lockButton";
    lock.title = "Lock (your windows stay open)";
    lock.addEventListener("click", lockNow);
    signOut.before(lock);
  }
  (g.CorpDesk || (g.CorpDesk = {})).lockNow = lockNow;
  function lockSettings(main) {
    const heading = main.querySelector("h1");
    if (!heading) return;
    for (const n of [...main.children]) if (n !== heading) n.remove();
    const preview = el("div", "lk-preview");
    preview.style.background = backgroundFor(lockId());
    preview.append(el("span", "lk-preview-time", (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })));
    const group = el("div", "lk-settings-group");
    group.append(el("h3", void 0, "Personalize your lock screen"));
    const pics = el("div", "lk-pics");
    for (const wp of allLockScreens(prefs().generatedLockScreens || [])) {
      const b = el("button", `lk-pic${wp.id === lockId() ? " on" : ""}`);
      b.type = "button";
      b.title = wp.label;
      b.setAttribute("aria-label", wp.label);
      b.style.background = wp.gradient;
      b.addEventListener("click", () => {
        prefs().lockScreen = wp.id;
        save();
        g.renderNetwork();
      });
      pics.append(b);
    }
    const actions = el("div", "lk-settings-actions");
    const generate = el("button", "secondary", "Generate new backgrounds");
    generate.addEventListener("click", () => {
      const have = prefs().generatedLockScreens || [];
      const batch = generateBatch(6, "lock", have);
      prefs().generatedLockScreens = [...have, ...batch.map((w) => w.id)].slice(-24);
      save();
      g.renderNetwork();
    });
    const browse = el("button", "secondary", "Browse photos");
    const file = el("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.hidden = true;
    browse.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files?.[0];
      if (!f) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 2 * 1024 * 1024) {
        g.toast?.("Choose a PNG, JPEG or WebP image smaller than 2 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          localStorage.setItem(CUSTOM_LOCK_KEY, String(reader.result));
          prefs().lockScreen = "custom";
          save();
          g.renderNetwork();
        } catch {
          g.toast?.("Browser storage is full. Choose a smaller picture.");
        }
      };
      reader.readAsDataURL(f);
    });
    actions.append(generate, browse, file, el("span", "lk-settings-note", "Generated on this computer from a seed. No download, no AI model."));
    group.append(pics, actions);
    const lockRow = el("div", "settings-card");
    lockRow.innerHTML = `<span class="setting-symbol">🔒</span><span class="setting-text"><b>Lock now</b><small>Shows the lock screen; sign in again to continue where you left off</small></span>`;
    const lockBtn = el("button", "secondary", "Lock");
    lockBtn.addEventListener("click", lockNow);
    lockRow.append(lockBtn);
    main.append(preview, group, lockRow, el("p", "settings-caption", `CORP training desktop · Lock screen: ${allLockScreens(prefs().generatedLockScreens || []).find((w) => w.id === lockId())?.label ?? "Deep Blue"}`));
  }
  var previous = g.renderNetwork;
  g.renderNetwork = () => {
    previous();
    const main = $("#appBody .settings-main");
    if (main?.querySelector("h1")?.textContent === "Lock screen") lockSettings(main);
  };
})();
