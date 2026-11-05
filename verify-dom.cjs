// Real DOM/event regression checks; no browser automation or host actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let jsdom;try{jsdom=require('jsdom');}catch{jsdom=require('./.build/dom-tests/node_modules/jsdom');}
const {JSDOM,VirtualConsole}=jsdom;
const root=path.join(__dirname,'dist'),errors=[];
const consoleEvents=new VirtualConsole();consoleEvents.on('jsdomError',error=>errors.push(error));
const html=fs.readFileSync(path.join(root,'lab.html'),'utf8').replace(/<script\s+src="[^"]+"><\/script>/g,'').replace(/<link[^>]+>/g,'');
const dom=new JSDOM(html,{url:'https://corpdesk.local/lab.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:consoleEvents,beforeParse(window){window.matchMedia=()=>({matches:false});window.confirm=()=>true;window.setInterval=()=>0;window.setTimeout=()=>0;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.setPointerCapture=function(){};}});
const w=dom.window,d=w.document;
for(const name of ['app','windows','desktop','lock','workflow','native-bridge','aduc','rdp','winapps','itlab']){const before=errors.length;const script=d.createElement('script');script.textContent=fs.readFileSync(path.join(root,name+'.js'),'utf8')+'\n//# sourceURL='+name+'.js';d.body.append(script);if(errors.length!==before)console.error('Boot failure in '+name+'.js',errors.at(-1).cause?.stack||errors.at(-1).detail?.stack||errors.at(-1).message);}
if(errors.length)throw Error('Application boot produced '+errors.length+' DOM errors.');
const api=w.CorpDesk;
// Lock screen as in the IAM Range: clock card first, then the sign-in panel; Lock keeps the desktop's windows.
{const login=d.querySelector('#login');assert.ok(login.classList.contains('lk'),'lock screen is built');assert.equal(login.querySelector('.lk-clock').hidden,false);assert.equal(login.querySelector('.lk-panel').hidden,true);login.click();assert.equal(login.querySelector('.lk-panel').hidden,false,'click shows the sign-in panel');assert.ok(login.querySelector('.lk-panel #loginForm #technician'),'CORP Desk sign-in form lives in the panel');assert.ok(d.querySelector('#lockButton'),'Start menu offers Lock');}
function click(node){assert.ok(node,'click target exists');node.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));node.click();}
function context(node){assert.ok(node,'context target exists');node.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:2}));node.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:150,clientY:150}));}
function checkErrors(label){if(errors.length){for(const e of errors)console.error(e.stack);throw Error(label+': '+errors.length+' DOM errors');}}
context(d.getElementById('desktop'));assert.ok(d.querySelector('[role="menu"]'),'desktop context menu opens');assert.match(d.querySelector('[role="menu"]').textContent,/View/);checkErrors('desktop context menu');
api.openApp('files');let explorer=d.querySelector('[data-app="files"]');assert.ok(explorer?.querySelector('.explorer-nav'),'Explorer navigation is rendered');
click([...explorer.querySelectorAll('[data-explorer-nav]')].find(b=>b.dataset.explorerNav==='C:\\'));
assert.ok([...explorer.querySelectorAll('[data-explorer-item]')].every(row=>row.textContent.trim().length),'root folder entries have names');
context(explorer.querySelector('.explorer-items'));assert.match([...d.querySelectorAll('[role="menu"]')].at(-1).textContent,/New.*Folder/s);checkErrors('Explorer right click');
click(explorer.querySelector('[data-win="close"]'));assert.equal(explorer.isConnected,false,'Explorer X removes its window');
api.openApp('files');explorer=d.querySelector('[data-app="files"]');assert.equal(explorer.querySelector('#explorerAddress').value,'This PC','Explorer reopens at its start location');
// Active Directory Users and Computers: the Meridian IAM Range console mounted on CORP Desk's directory.
api.openApp('directory');let ad=d.querySelector('[data-app="directory"]');assert.ok(ad.querySelector('.corp-aduc .ad-tree'),'ADUC console mounts');const trow=key=>ad.querySelector(`.ad-trow[data-key="${key}"]`);assert.ok(trow('ou:Lab'),'Lab OU is in the tree');
context(trow('ou:Lab'));let menu=[...d.querySelectorAll('.ad-menu')].at(-1);assert.match(menu.textContent,/New/);click([...menu.querySelectorAll('.ad-mi')].find(b=>b.textContent.trim().startsWith('New')));
menu=[...d.querySelectorAll('.ad-menu')].at(-1);assert.match(menu.textContent,/Organizational Unit/);checkErrors('AD New submenu');
click([...menu.querySelectorAll('.ad-mi')].find(b=>b.textContent.trim()==='Organizational Unit'));let dlg=[...d.querySelectorAll('.ad-dlg')].at(-1);const nameInput=dlg.querySelector('input');assert.ok(nameInput,'New OU dialog is functional');nameInput.value='Support Test';nameInput.dispatchEvent(new w.Event('input',{bubbles:true}));click([...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='OK'));assert.ok(api.getState().ous.includes('Lab/Support Test'),'right-click New OU creates the directory object');checkErrors('AD New OU');
{const cap=(id,a)=>api.aducCapability(id,a),S=()=>api.getState(),U=s=>S().users.find(u=>u.sam===s);
 cap('user.create',{Name:'Pat Kim',SamAccountName:'pkim',GivenName:'Pat',Surname:'Kim',Path:'corp.example.test/Lab/Users/IT',AccountPassword:'set',ChangePasswordAtLogon:'true'});assert.equal(U('pkim').path,'Lab/Users/IT');assert.equal(U('pkim').enabled,true);assert.equal(U('pkim').dept,'IT');
 cap('user.disable',{Identity:'pkim'});assert.equal(U('pkim').enabled,false);cap('user.enable',{Identity:'pkim'});assert.equal(U('pkim').enabled,true);
 w.eval("state.users.find(u=>u.sam==='hr01').locked=true");assert.equal(U('hr01').locked,true);cap('account.unlock',{Identity:'hr01'});assert.equal(U('hr01').locked,false);
 assert.throws(()=>cap('password.reset',{Identity:'hr01',NewPassword:'short'}),/14 characters/);cap('password.reset',{Identity:'hr01',NewPassword:'Training-Pass-2026',ChangePasswordAtLogon:'true'});assert.ok(U('hr01').passwordLastSet);
 cap('group.addMember',{Group:'GG_IT_Staff',Identity:'hr02'});assert.ok(U('hr02').groups.includes('GG_IT_Staff'));cap('group.removeMember',{Group:'GG_IT_Staff',Identity:'hr02'});assert.ok(!U('hr02').groups.includes('GG_IT_Staff'));
 cap('user.move',{Identity:'pkim',TargetPath:'corp.example.test/Lab/Disabled'});assert.equal(U('pkim').path,'Lab/Disabled');
 cap('user.update',{Identity:'pkim',Title:'Analyst',OfficePhone:'555-0100',Initials:'P',Manager:'it01'});assert.equal(U('pkim').title,'Analyst');assert.equal(U('pkim').telephone,'555-0100');assert.equal(U('pkim').attributes.initials,'P');assert.equal(U('pkim').manager,'it01');
 cap('group.create',{Name:'GG_QA',Path:'corp.example.test/Lab/Groups',GroupScope:'Global',GroupCategory:'Security',Description:'QA'});assert.ok(S().groups.some(g=>g.name==='GG_QA'&&g.path==='Lab/Groups'));cap('group.update',{Identity:'GG_QA',Description:'Quality'});cap('object.rename',{Identity:'group:GG_QA',NewName:'GG_Quality'});assert.ok(S().groups.some(g=>g.name==='GG_Quality'&&g.description==='Quality'));cap('group.delete',{Name:'GG_Quality'});assert.ok(!S().groups.some(g=>g.name==='GG_Quality'));
 cap('user.delete',{Identity:'pkim'});assert.equal(U('pkim'),undefined);
 assert.throws(()=>cap('ou.delete',{Name:'Lab/Support Test'}),/protected/i);cap('ou.update',{Identity:'Lab/Support Test',Description:'Desk',ProtectedFromAccidentalDeletion:'false'});cap('ou.delete',{Name:'Lab/Support Test'});assert.ok(!S().ous.includes('Lab/Support Test'));checkErrors('AD capabilities');}
click(ad.querySelector('[data-win="close"]'));assert.equal(ad.isConnected,false,'AD X removes its window');api.openApp('directory');ad=d.querySelector('[data-app="directory"]');assert.ok(ad.querySelector('.corp-aduc .ad-tree'),'ADUC console remounts');
// Remote Desktop Connection: verify a sign-in (real refusals, must-change), help a user, and sign-out on close.
{const live=sam=>w.eval(`state.users.find(u=>u.sam==='${sam}')`),ev=()=>w.eval('state.events[0].id');api.openApp('rdp');let rdp=d.querySelector('[data-app="rdp"]');const q=sel=>rdp.querySelector(sel);assert.ok(q('.rdp-connect'),'Remote Desktop opens on its connect page');
 live('hr02').enabled=false;click(q('#rdpVerify'));q('#rdpUser').value='hr02';q('#rdpPw').value='x';click(q('#rdpOk'));assert.match(q('.rdp-msg').textContent,/disabled/);assert.equal(ev(),4625);live('hr02').enabled=true;
 live('it03').accountOptions.mustChange=true;q('#rdpUser').value='it03';q('#rdpPw').value='x';click(q('#rdpOk'));assert.ok(q('#rdpNew1'),'must change password asks for a new one');q('#rdpNew1').value=q('#rdpNew2').value='weak';click(q('#rdpOk'));assert.match(q('.rdp-msg').textContent,/requirements/);
 q('#rdpNew1').value=q('#rdpNew2').value='Training-Pass-2026';click(q('#rdpOk'));assert.ok(q('.rdp-remote'),'session shows the remote workstation');assert.equal(live('it03').accountOptions.mustChange,false);assert.equal(ev(),4624);
 click(q('#rdpSignOut'));assert.equal(ev(),4634);click(q('#rdpReconnect'));click(q('#rdpHelp'));q('#rdpPw').value='x';click(q('#rdpOk'));assert.ok(q('.rdp-remote'),'help session connects');
 click(rdp.querySelector('[data-win="close"]'));assert.equal(ev(),4634,'closing Remote Desktop signs the session out');checkErrors('Remote Desktop');}
// Calculator, Task Manager and Control Panel (the IAM Range apps): arithmetic, live processes, End task, and Control Panel navigation.
{w.openApp('calculator');const calc=d.querySelector('[data-app="calculator"] .calc');assert.ok(calc,'Calculator opens');const key=l=>click([...calc.querySelectorAll('.calc-key')].find(b=>b.getAttribute('aria-label')===l));for(const k of ['1','2','×','3','='])key(k);assert.equal(calc.querySelector('.calc-display').textContent,'36');
 w.openApp('taskmanager');const tm=d.querySelector('[data-app="taskmanager"] .tm');assert.ok(tm,'Task Manager opens');const calcRow=[...tm.querySelectorAll('.tm-row')].find(r=>r.textContent.includes('Calculator'));assert.ok(calcRow,'open windows are listed as Apps');click(calcRow);click([...d.querySelectorAll('[data-app="taskmanager"] .tm-act')].find(b=>b.textContent.includes('End task')));assert.equal(d.querySelector('[data-app="calculator"]'),null,'End task closes the window');
 w.openApp('control');const cp=()=>d.querySelector('[data-app="control"] .cp');assert.match(cp().textContent,/Adjust your computer/);click([...cp().querySelectorAll('.cp-link')].find(a=>a.textContent==='Administrative Tools'));assert.match(cp().querySelector('.cp-h').textContent,/Windows Tools/);
 click(cp().querySelector('.fx-crumb'));click([...cp().querySelectorAll('.cp-link')].find(a=>a.textContent==='Mouse'));assert.ok(d.querySelector('.mm-dlg'),'Mouse Properties opens');click([...d.querySelectorAll('.mm-dlg .mm-btn')].find(b=>b.textContent==='Cancel'));
 for(const id of ['taskmanager','control'])click(d.querySelector(`[data-app="${id}"] [data-win="close"]`));checkErrors('Calculator, Task Manager, Control Panel');}
// IT support lab: Windows 11 Start, dark mode, and the real-world labs' acceptance checks (including wrong answers).
{const live=()=>w.eval('state');
 click(d.querySelector('#startButton'));const start=d.querySelector('#startMenu');assert.ok(!start.classList.contains('hidden'),'Start opens');assert.ok(start.querySelector('.st-grid [data-open="outlook"]'),'Start pins the new tools');
 const search=start.querySelector('#appSearch');search.value='entra';search.dispatchEvent(new w.Event('input'));assert.match(start.querySelector('.st-best').textContent,/Entra/);click(d.querySelector('#startButton'));
 click(d.querySelector('.ia-theme-toggle'));assert.equal(d.documentElement.dataset.theme,'dark','tray toggle turns on dark mode');click(d.querySelector('.ia-theme-toggle'));assert.equal(d.documentElement.dataset.theme,'light');
 const resolve=id=>{live().notes[id]='Verified fix with the user and recorded the approval on the ticket.';w.eval('resolveTicket')(w.eval('tickets').find(t=>t.id===id));return live().statuses[id];};
 const ev=k=>w.eval('evidence')(k);
 api.openTicket(12);w.eval('startIncident')(12);assert.equal(live().active,12,'LAB-012 starts');ev('mailbox-approval');
 const hr=live().itlab.mailboxes.find(m=>m.address==='hr@corp.example.test');hr.fullAccess.push('hr02','hr03');hr.sendAs.push('hr02');assert.notEqual(resolve(12),'Resolved','granting someone not approved fails least privilege');
 hr.fullAccess=hr.fullAccess.filter(x=>x!=='hr03');assert.equal(resolve(12),'Resolved','exactly the approved access resolves');
 w.eval('startIncident')(10);ev('verify');ev('bitlocker-view');live().itlab.verified.hr04=new Date(Date.now()+1000).toISOString();const dev=live().itlab.devices.find(x=>x.name==='HR-PC04');assert.equal(dev.keys.length,2,'the device has an old and a new key');
 const shown=w.eval('tickets').find(t=>t.id===10).summary.match(/ID: ([0-9A-F]{8})/)[1];const wrong=dev.keys.find(k=>!k.id.startsWith(shown)),right=dev.keys.find(k=>k.id.startsWith(shown));live().itlab.bitlockerProvided['HR-PC04']=wrong.key;ev('bitlocker-provided');assert.notEqual(resolve(10),'Resolved','the wrong recovery key fails');
 live().itlab.bitlockerProvided['HR-PC04']=right.key;assert.equal(resolve(10),'Resolved','the key matching the Key ID resolves');
 w.eval('startIncident')(8);assert.equal(live().services.find(x=>x.Name==='Spooler').Status,'Stopped','LAB-008 stops the spooler');assert.equal(w.runCommand('Get-PrintJob -PrinterName HR-PRN01').error,true,'print jobs are unreachable while the spooler is down');
 assert.equal(w.runCommand('Start-Service -Name Spooler').error,false);assert.equal(w.runCommand('Remove-PrintJob -PrinterName HR-PRN01 -ID 41').error,false);w.runCommand('Print-TestPage HR-PRN01');assert.equal(resolve(8),'Resolved','spooler, bad job and test page resolve LAB-008');
 checkErrors('IT support lab');}
api.openApp('terminal');const terminal=d.querySelector('[data-app="terminal"]');click(terminal.querySelector('[data-win="close"]'));assert.equal(terminal.isConnected,false,'PowerShell X closes its session');
checkErrors('window close/reopen');
context(d.querySelector('.taskbar'));assert.match([...d.querySelectorAll('[role="menu"]')].at(-1).textContent,/Task Manager/);checkErrors('taskbar menu');
console.log('PASS: full HTML boot, desktop right-click, Explorer layout and context menu, ADUC console tree New OU submenu and every console change path, Remote Desktop sign-in verification and sessions, Calculator/Task Manager/Control Panel, Windows 11 Start and dark mode, real-world lab acceptance checks (right and wrong answers), and real close-button click/reopen event sequences.');
dom.window.close();
