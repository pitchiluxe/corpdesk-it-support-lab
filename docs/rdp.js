/* Remote Desktop Connection (mstsc), as in the Meridian IAM Range.
 *
 * Two reasons a service desk opens it:
 *   Help a user: connect to their computer with your own technician account
 *   and work on their desktop. The desk never needs the user's password.
 *   Verify a sign-in: sign in to the training workstation AS a directory
 *   account to prove a fix worked. The domain refuses disabled and locked-out
 *   accounts in Windows' own words, and "must change password at next logon"
 *   asks for a new one that meets the domain policy.
 * Either way you land on a remote workstation, and Sign out writes the logoff
 * event. CORP Desk keeps no passwords, so any typed password is accepted once
 * the account itself may sign in; the account's state is what is verified.
 */
'use strict';
(() => {
const E = escapeHTML;
const TEST_HOST = 'LAB-PC01';
const TEST_IP = '10.77.0.21';
const DEPT_PREFIX = {HR:'HR', IT:'IT', Finance:'FIN'};

apps.push({id:'rdp', name:'Remote Desktop Connection', short:'Remote Desktop', bg:'transparent', fg:'#fff',
  icon:'<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="3" y="5" width="28" height="19" rx="2" fill="#1f6fd1"/><rect x="5.5" y="7.5" width="23" height="14" fill="#7cc4ff"/><path d="M13 27h8l1 2.5h-10z" fill="#5b6b7c"/><path d="M10 15.5h9.5m-3-3 3 3-3 3" stroke="#0b3a6e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 15.5h-3" stroke="#0b3a6e" stroke-width="2" stroke-linecap="round"/></svg>'});
$('#desktopIcons').innerHTML = apps.map(a => appButton(a, 'desktop')).join('');
$('#startApps').innerHTML = apps.map(a => appButton(a, 'start')).join('');

/** Each person's computer: hr01 -> HR-PC01, finance03 -> FIN-PC03. */
const machineOf = u => `${DEPT_PREFIX[u.dept] || 'CORP'}-PC${(u.sam.match(/\d+$/) || ['01'])[0].padStart(2, '0')}`;
const accountState = u => !u.enabled ? 'disabled' : u.locked ? 'locked' : 'ok';
const people = () => state.users.map(u => ({sam:u.sam, name:u.name, machine:machineOf(u), state:accountState(u)})).sort((a, b) => a.name.localeCompare(b.name));
const me = () => state.technician.toLowerCase().replace(/\s+/g, '.');
const fmtTime = d => d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});

let screen = 'connect', machine = '', computer = '', account = '', error = '', session = null, ended = '', remoteFrame = null, root = null;

function go(next) { screen = next; draw(); }
function done(msg) { if (!session) return; log(4634, msg); session = null; remoteFrame = null; }

function connectScreen() {
  const list = people();
  if (!list.some(p => p.machine === machine)) machine = list[0]?.machine || '';
  const target = list.find(p => p.machine === machine);
  return `<div class="rdp-connect">
    <div class="rdp-brand">${apps.find(a => a.id === 'rdp').icon.replace('<svg', '<svg width="40" height="40"')}<div><span>Remote Desktop</span><strong>Connection</strong></div></div>
    <section class="rdp-card"><h3>Choose who you are working on</h3>
      <label class="rdp-field"><span>Company:</span><select class="rdp-input" aria-label="Company"><option>CORP (corp.example.test)</option></select></label>
      ${list.length ? `<label class="rdp-field"><span>User:</span><select class="rdp-input" id="rdpWho" aria-label="User">${list.map(p => `<option value="${E(p.machine)}" ${p.machine === machine ? 'selected' : ''}>${E(p.name)} — ${E(p.machine)}${p.state === 'ok' ? '' : ` (${p.state})`}</option>`).join('')}</select></label>` : '<p class="muted">Nobody at CORP has a computer yet. Create their account first: every new hire gets a workstation.</p>'}
    </section>
    <section class="rdp-card"><h3>Help a user: connect to their computer</h3>
      <p class="muted">Sign in with your own technician account and work on their desktop. You never need the user's password.</p>
      <div class="rdp-actions"><button class="primary" id="rdpHelp" ${target ? '' : 'disabled'}>${target ? `Connect to ${E(target.machine)}` : 'Connect'}</button></div>
    </section>
    <section class="rdp-card"><h3>Verify a sign-in: test an account</h3>
      <p class="muted">Sign in AS a directory account on ${TEST_HOST} (${TEST_IP}) to prove a reset, unlock or new account works. Real refusals: disabled, locked out, must change password.</p>
      <div class="rdp-actions"><button class="secondary" id="rdpVerify">Connect to ${TEST_HOST}</button></div>
    </section></div>`;
}

function credentialsScreen() {
  const target = people().find(p => p.machine === computer);
  return `<div class="rdp-center"><div class="rdp-dialog">
    <div class="rdp-dialog-title">Windows Security</div>
    <div class="rdp-dialog-body"><h3>Enter your credentials</h3>
      <p>These credentials will be used to connect to ${E(computer)}${target ? ` (${E(target.name)}'s computer)` : ''}.</p>
      <input class="rdp-input" value="CORP\\${E(me())}" readonly aria-label="User name">
      <input class="rdp-input" id="rdpPw" type="password" placeholder="Password" aria-label="Password">
      <p class="muted" style="margin:0;font-size:11.5px">Training profile: type any password. CORP Desk never stores one.</p>
      ${error ? `<p class="rdp-error">${E(error)}</p>` : ''}
      <div class="rdp-actions"><button class="primary" id="rdpOk">OK</button><button class="secondary" id="rdpCancel">Cancel</button></div>
    </div></div></div>`;
}

function signInScreen() {
  return `<div class="rdp-remote-login"><div class="rdp-conn">Connecting to ${TEST_IP} (${TEST_HOST})</div>
    <div class="rdp-glass rdp-login">
      <div class="rdp-avatar">&#128100;</div><div class="rdp-name">Other user</div><div class="rdp-upn">Sign in to: CORP</div>
      <datalist id="rdpUsers">${state.users.map(u => `<option value="${E(u.sam)}">${E(u.name)}</option>`).join('')}</datalist>
      <div class="rdp-login-fields"><input class="rdp-glass-input" id="rdpUser" placeholder="User name" autocomplete="off" list="rdpUsers" aria-label="User name" value="${E(account)}"><input class="rdp-glass-input" id="rdpPw" type="password" placeholder="Password" aria-label="Password"></div>
      <div class="rdp-msg">${E(error)}</div>
      <button class="rdp-glass-btn" id="rdpOk">Sign in</button><button class="rdp-cancel" id="rdpCancel">Cancel</button>
    </div></div>`;
}

function changeScreen() {
  return `<div class="rdp-remote-login"><div class="rdp-glass rdp-login">
      <div class="rdp-name">${E(account)}</div><p class="rdp-upn">The user's password must be changed before signing in.</p>
      <div class="rdp-login-fields"><input class="rdp-glass-input" id="rdpNew1" type="password" placeholder="New password" aria-label="New password"><input class="rdp-glass-input" id="rdpNew2" type="password" placeholder="Confirm password" aria-label="Confirm password"></div>
      <div class="rdp-msg">${E(error)}</div>
      <button class="rdp-glass-btn" id="rdpOk">Change password and sign in</button><button class="rdp-cancel" id="rdpCancel">Cancel</button>
    </div></div>`;
}

function sessionScreen() {
  const s = session, u = user(s.user);
  const who = `CORP\\${s.user} · ${s.mode === 'verify' ? 'sign-in verified by the domain controller' : `helping ${s.helping}`}`;
  return `<div class="rdp-session rdp-session-remote"><div class="rdp-bar" role="toolbar" aria-label="Connection bar">
      <strong>${E(s.host)}</strong><span class="rdp-bar-who">${E(u?.name || s.user)} · ${E(who)}</span>
      <button class="rdp-bar-btn rdp-bar-text" id="rdpSignOut" title="Sign out">Sign out</button>
      <button class="rdp-bar-btn" id="rdpDisconnect" title="Disconnect" aria-label="Disconnect">✕</button>
    </div><div class="rdp-frame-slot"></div></div>`;
}

function endedScreen() {
  return `<div class="rdp-center"><div class="rdp-dialog"><div class="rdp-dialog-title">Remote Desktop Connection</div>
    <div class="rdp-dialog-body"><p>${E(ended)}</p><p class="muted">The sign-in and sign-out are in Event Viewer (4624, 4634).</p>
      <div class="rdp-actions"><button class="primary" id="rdpReconnect">Reconnect</button><button class="secondary" id="rdpClose">Close</button></div></div></div></div>`;
}

function startSession(sam, host, mode, helping) {
  session = {user:sam, host, mode, helping, started:new Date()};
  error = '';
  go('session');
}

function trySignIn(sam, password) {
  const u = user(sam);
  const refuse = (msg, status) => { log(4625, `${sam || '(blank)'}: logon failure on ${TEST_HOST} — ${status}`); error = msg; draw(); };
  if (!sam) { error = 'Type a user name.'; draw(); return; }
  if (!u || !password) return refuse('The user name or password is incorrect. Try again.', 'unknown user name or bad password');
  if (!u.enabled) return refuse('Your account has been disabled. Please see your system administrator.', 'account disabled');
  if (u.locked) return refuse('The referenced account is currently locked out and may not be logged on to.', 'account locked out');
  account = u.sam;
  if (u.accountOptions?.mustChange) { error = ''; go('change'); return; }
  u.lastLogon = new Date().toISOString();
  log(4624, `${u.sam}: logged on to ${TEST_HOST} (Remote Desktop, logon type 10)`);
  startSession(u.sam, TEST_HOST, 'verify');
}

function bind() {
  const on = (id, fn) => { const el = root.querySelector('#' + id); if (el) el.onclick = fn; };
  const enter = (id, fn) => { const el = root.querySelector('#' + id); if (el) el.onkeydown = e => { if (e.key === 'Enter') fn(); }; };
  if (screen === 'connect') {
    const who = root.querySelector('#rdpWho'); if (who) who.onchange = () => { machine = who.value; draw(); };
    on('rdpHelp', () => { computer = machine; error = ''; go('credentials'); });
    on('rdpVerify', () => { account = ''; error = ''; go('signin'); });
  } else if (screen === 'credentials') {
    const ok = () => {
      if (!root.querySelector('#rdpPw').value) { error = 'The logon attempt failed.'; draw(); return; }
      const target = people().find(p => p.machine === computer);
      log(4624, `${me()}: logged on to ${computer} (Remote Desktop, logon type 10) to help ${target?.sam || 'the user'}`);
      startSession(me(), computer, 'help', target?.name || 'the user');
    };
    on('rdpOk', ok); enter('rdpPw', ok); on('rdpCancel', () => { error = ''; go('connect'); });
    root.querySelector('#rdpPw')?.focus();
  } else if (screen === 'signin') {
    const ok = () => trySignIn(root.querySelector('#rdpUser').value.trim(), root.querySelector('#rdpPw').value);
    on('rdpOk', ok); enter('rdpPw', ok); on('rdpCancel', () => { error = ''; go('connect'); });
    (account ? root.querySelector('#rdpPw') : root.querySelector('#rdpUser'))?.focus();
  } else if (screen === 'change') {
    const ok = () => {
      const p1 = root.querySelector('#rdpNew1').value, p2 = root.querySelector('#rdpNew2').value;
      if (p1 !== p2) { error = "The passwords don't match."; draw(); return; }
      if (p1.length < 14 || !/[A-Z]/.test(p1) || !/[a-z]/.test(p1) || !/[0-9]/.test(p1)) { error = 'Unable to update the password. The value provided for the new password does not meet the length, complexity, or history requirements of the domain.'; draw(); return; }
      const u = user(account);
      u.accountOptions ||= {}; u.accountOptions.mustChange = false; u.passwordLastSet = new Date().toISOString(); u.lastLogon = u.passwordLastSet;
      log(4723, `${u.sam}: changed own password at sign-in (no password stored)`);
      log(4624, `${u.sam}: logged on to ${TEST_HOST} (Remote Desktop, logon type 10)`);
      startSession(u.sam, TEST_HOST, 'verify');
    };
    on('rdpOk', ok); enter('rdpNew2', ok); on('rdpCancel', () => { error = ''; go('signin'); });
    root.querySelector('#rdpNew1')?.focus();
  } else if (screen === 'session') {
    remoteFrame ||= Object.assign(document.createElement('iframe'), {className:'rdp-remote', src:'remote-pc/index.html', title:`${session.host} (Remote Desktop)`});
    root.querySelector('.rdp-frame-slot').replaceWith(remoteFrame);
    on('rdpSignOut', () => {
      const s = session;
      ended = `${s.mode === 'verify' ? `${s.user} signed out of ${s.host}.` : `You signed out of ${s.host}.`} The session lasted from ${fmtTime(s.started)} to ${fmtTime(new Date())}.`;
      done(`${s.user}: logged off ${s.host} (Remote Desktop)`); go('ended');
    });
    on('rdpDisconnect', () => { ended = `Your remote session to ${session.host} was disconnected. The user is still signed in there.`; session = null; remoteFrame = null; go('ended'); });
  } else if (screen === 'ended') {
    on('rdpReconnect', () => go('connect'));
    on('rdpClose', () => window.CorpDesk?.closeApp ? window.CorpDesk.closeApp('rdp') : closeWindow());
  }
}

function draw() {
  if (!root) return;
  root.innerHTML = {connect:connectScreen, credentials:credentialsScreen, signin:signInScreen, change:changeScreen, session:sessionScreen, ended:endedScreen}[screen]();
  const title = document.querySelector('.app-window[data-app="rdp"] .window-caption > span:last-child');
  if (title) title.textContent = screen === 'session' && session ? `${session.host} - Remote Desktop Connection` : 'Remote Desktop Connection';
  bind();
}

/** CORP Desk calls render() when the window is shown; keep a live session (and its iframe) as it is. */
function renderRdp() {
  const body = $('#appBody');
  if (!body) return;
  if (root && root.parentElement === body) return;
  root = document.createElement('div');
  root.className = 'rdp';
  body.innerHTML = '';
  body.append(root);
  draw();
}
const previousRender = render;
render = () => { if (currentApp === 'rdp') renderRdp(); else previousRender(); };

// Closing the window signs the remote session out, as closing mstsc does.
const api = (window.CorpDesk ||= {});
const afterClose = api.afterCloseApp;
api.afterCloseApp = id => { if (id === 'rdp') { if (session) done(`${session.user}: logged off ${session.host} (Remote Desktop window closed)`); screen = 'connect'; error = ''; root = null; } afterClose?.(id); };
})();
