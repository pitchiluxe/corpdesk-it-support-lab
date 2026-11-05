// Business-flow checks in an isolated VM context. This is not browser/layout QA.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const elements = new Map();
const values = new Map();
const element = () => {
  const classes=new Set(),children=new Map();let id='';
  return {
    value:'',textContent:'',innerHTML:'',style:{setProperty(k,v){this[k]=v;}},dataset:{},offsetWidth:220,offsetHeight:300,
    get id(){return id;},set id(v){id=v;elements.set('#'+v,this);},
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},toggle(n,force){if(force===true)classes.add(n);else if(force===false)classes.delete(n);else classes.has(n)?classes.delete(n):classes.add(n);},contains(n){return classes.has(n);}},
    addEventListener(){},append(){},prepend(){},replaceChildren(){},focus(){},remove(){},setAttribute(){},
    removeAttribute(name){if(name==='id'&&elements.get('#'+id)===this)elements.delete('#'+id);},
    querySelector(q){if(!children.has(q))children.set(q,element());return children.get(q);},querySelectorAll(){return [];},
    scrollIntoView(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,bottom:25};}
  };
};
const context = vm.createContext({
  document:{body:element(),documentElement:element(),getElementById(id){return elements.get('#'+id)||null;},querySelector(q){if(!elements.has(q))elements.set(q,element());return elements.get(q);},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){},createElement:element,createTextNode(text){return {textContent:text};}},
  localStorage:{getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,v);}},
  window:{},location:{protocol:'file:',hostname:'',port:''},innerWidth:1400,innerHeight:900,navigator:{},setInterval(){},setTimeout(){},clearTimeout(){},confirm(){return true;},console
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'dist/app.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'dist/windows.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'dist/desktop.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'dist/workflow.js'),'utf8'),context);
const run = code => vm.runInContext(code,context);
assert.equal(run('state.users.length'),24);
assert.equal(run('new Set(state.users.map(u=>u.sam)).size'),24);
assert.equal(run('completed()'),0);
assert.equal(run("runCommand('Remove-Item C:/').error"),true);
const flows = [
  {id:1,checks:['Get-ADUser hr01 -Properties LockedOut'],fix:['Unlock-ADAccount hr01'],verify:['Get-ADUser hr01 -Properties LockedOut','Test-LabSignIn hr01']},
  {id:2,checks:['ipconfig /all','Resolve-DnsName LAB-DC01.corp.example.test'],fix:['Set-DnsClientServerAddress -InterfaceAlias LabNIC -ServerAddresses 10.77.0.10'],verify:['Resolve-DnsName LAB-DC01.corp.example.test']},
  {id:3,checks:['Get-LocalGroupMember -Group Administrators'],fix:['Remove-LocalGroupMember -Group Administrators -Member CORP\\hr02'],verify:['Get-LocalGroupMember -Group Administrators']},
  {id:4,checks:['Get-ADPrincipalGroupMembership hr03'],fix:['Remove-ADGroupMember GG_Finance_Staff -Members hr03'],verify:['Get-ADPrincipalGroupMembership hr03','Test-LabAccess hr03 Finance','Test-LabAccess hr03 HR','Test-LabAccess finance01 Finance']},
  {id:5,checks:['gpresult /r'],fix:['Move-LabComputer Workstations','gpupdate /force'],verify:['gpresult /r']}
];
for (const flow of flows) {
  run(`startIncident(${flow.id})`);
  assert.equal(run(`criteria(tickets[${flow.id-1}])`),false,`incident ${flow.id} fault injected`);
  run(`resolveTicket(tickets[${flow.id-1}])`);
  assert.equal(run('state.active'),flow.id,'premature resolution rejected');
  const cmds=[...flow.checks,...flow.fix,...flow.verify];
  for(const command of cmds){const result=run(`runCommand(${JSON.stringify(command)})`);if(command.startsWith('Resolve-DnsName')&&flow.checks.includes(command)&&!run("state.dns==='10.77.0.10'"))continue;assert.equal(result.error,false,command+' => '+result.output);}
  assert.equal(run(`criteria(tickets[${flow.id-1}])`),true,`incident ${flow.id} corrected`);
  assert.equal(run(`tickets[${flow.id-1}].checks.every(k=>state.evidence[${flow.id}].includes(k))`),true,'required evidence collected');
  run(`state.notes[${flow.id}]='Diagnosed the recorded fault, applied the minimal correction, and repeated verification.';resolveTicket(tickets[${flow.id-1}])`);
  assert.equal(run(`state.statuses[${flow.id}]`),'Resolved');
  assert.equal(run('state.active'),null);
}
assert.equal(run('completed()'),5);
assert.equal(JSON.parse(values.get('corpdesk-lab-v1')).statuses['5'],'Resolved','progress persisted');
assert.equal(run("testAccess('hr03','Finance').includes('ACCESS DENIED')"),true);
assert.equal(run("testAccess('hr03','HR').includes('ACCESS GRANTED')"),true);
assert.equal(run("state.admins.includes('CORP\\\\SupportAdmin')"),true);
// Mutation-resistant closure: collected checks alone cannot close an unfixed fault.
run("state=initialState();startIncident(2);state.evidence[2]=['ipconfig','dns'];state.notes[2]='Notes with sufficient detail to pass the text gate.';resolveTicket(tickets[1])");
assert.equal(run('state.active'),2,'incorrect current state blocks closure');
run('cancelIncident(2)');
assert.equal(run('state.dns'),'10.77.0.10','cancel restores affected setting');
assert.equal(run('state.active'),null);
// Ensure every application renderer can execute against the element fixture.
for (const app of ['lab','tickets','directory','terminal','network','files','mentor','events'])run(`openApp('${app}')`);
assert.equal(run('window.CorpDesk.windowCount()'),8,'each application gets an independent window');
assert.equal(run('new Set(window.CorpDesk.windowElements()).size'),8,'window elements are not reused across applications');
run("openApp('directory');openApp('terminal');openApp('files')");
assert.equal(run('window.CorpDesk.windowCount()'),8,'reopening an application reuses only its own window');
function command(text){const response=run(`runCommand(${JSON.stringify(text)})`);assert.equal(response.error,false,text+' => '+response.output);return response.output;}
assert.match(command('Get-ADUser -Filter * | Where-Object { $_.Department -eq "HR" } | Select-Object SamAccountName,Enabled | Sort-Object SamAccountName'),/hr08/);
assert.doesNotMatch(command('Get-ADUser -Filter * | Where-Object { $_.Department -eq "HR" } | Select-Object SamAccountName'),/finance01/);
assert.match(command('Get-ADUser -Filter "Department -eq \'Finance\'" | Measure-Object'),/Count\s+: 8/);
assert.equal(command('$u = Get-ADUser -Identity hr01 -Properties *; $u.Department'),'HR');
assert.equal(command('$allUsers = Get-ADUser -Filter *; $allUsers.Count'),'24');
command('Set-ADUser -Description "Moved by help desk" -Identity hr01 -Title "People Associate"');
assert.equal(run("user('hr01').description"),'Moved by help desk');
const before=run('JSON.stringify(state.users)');command('Set-ADUser hr01 -Department Finance -WhatIf');assert.equal(run('JSON.stringify(state.users)'),before);
command('New-ADUser -Name "Dana Jones" -SamAccountName djones -Department IT -Enabled $true -Path "OU=IT,OU=Users,OU=Lab,DC=corp,DC=example,DC=test"');
assert.equal(run("user('djones').path"),'Lab/Users/IT');
command('New-ADGroup -Name Helpdesk-Test -GroupScope Global -Path "OU=Groups,OU=Lab,DC=corp,DC=example,DC=test"');
command('Add-ADGroupMember -Members djones,hr01 -Identity Helpdesk-Test');
assert.match(command('Get-ADGroupMember Helpdesk-Test'),/djones/);
command('Remove-ADGroupMember Helpdesk-Test -Members hr01 -Confirm:$false');
assert.equal(run("user('hr01').groups.includes('Helpdesk-Test')"),false);
command('Disable-ADAccount djones');assert.equal(run("user('djones').enabled"),false);
command('Enable-ADAccount -Identity djones');assert.equal(run("user('djones').enabled"),true);
command('New-ADOrganizationalUnit -Name Staging -Path "OU=Lab,DC=corp,DC=example,DC=test"');
assert.equal(run('runCommand(\'Remove-ADOrganizationalUnit -Identity "OU=Staging,OU=Lab,DC=corp,DC=example,DC=test" -Confirm:$false\').error'),true);
command('Set-ADOrganizationalUnit -Identity "OU=Staging,OU=Lab,DC=corp,DC=example,DC=test" -ProtectedFromAccidentalDeletion $false');
command('Remove-ADOrganizationalUnit -Identity "OU=Staging,OU=Lab,DC=corp,DC=example,DC=test" -Confirm:$false');
assert.equal(run("state.ous.includes('Lab/Staging')"),false);
command('Get-ADComputer LAB-PC01 | Move-ADObject -TargetPath "CN=Computers,DC=corp,DC=example,DC=test"');assert.equal(run('state.ou'),'Computers');
command('Move-ADObject -Identity "CN=LAB-PC01,CN=Computers,DC=corp,DC=example,DC=test" -TargetPath "OU=Workstations,OU=Lab,DC=corp,DC=example,DC=test"');command('gpupdate /force');
assert.equal(run('state.policyApplied'),true);
command('New-ADGroup -Name NestA -GroupScope Global');command('New-ADGroup -Name NestB -GroupScope Global');command('Add-ADGroupMember NestA -Members NestB');
assert.equal(run("runCommand('Add-ADGroupMember NestB -Members NestA').error"),true,'circular nesting blocked');
command('Set-Content -Path C:\\Lab\\sample.txt -Value "Hello desk"');assert.equal(command('Get-Content C:\\Lab\\sample.txt'),'Hello desk');
command('Copy-Item C:\\Lab\\sample.txt -Destination C:\\Lab\\copy.txt');assert.equal(command('Test-Path C:\\Lab\\copy.txt'),'True');
command('Get-ADUser -Filter * | Select-Object SamAccountName,Department | Export-Csv C:\\Lab\\users.csv -NoTypeInformation');
assert.match(command('Import-Csv C:\\Lab\\users.csv | Measure-Object'),/25/);
command('Remove-Item C:\\Lab\\copy.txt');assert.equal(command('Test-Path C:\\Lab\\copy.txt'),'False');
run('window.CorpDesk.restoreLast()');assert.equal(command('Test-Path C:\\Lab\\copy.txt'),'True');
assert.equal(run("runCommand('Get-ADUser -ImaginaryOption bad').error"),true);
assert.equal(run("runCommand('Get-ADUser -Identity missing').error"),true);
assert.equal(run("runCommand('Get-ADUser \"unterminated').error"),true);
assert.match(command('Get-Command *ADUser'),/New-ADUser/);
assert.equal(run("window.CorpDesk.parseCSV('Name,Note\\r\\nDana,\"hello, desk\"')[0].Note"),'hello, desk');
console.log('PASS: all 5 incident lifecycles, 8 renderer fixtures, PowerShell pipelines/filters/variables/WhatIf, AD user/group/OU CRUD, circular nesting, computer moves, virtual file/CSV roundtrip, recovery, validation, and persistence.');
console.log('Independent application windows: '+run('window.CorpDesk.windowCount()')+'. Supported command entries: '+run('window.CorpDesk.commandCount()')+'.');
assert.equal(run('window.CorpDesk.cellValue("B4",state.office.excel.cells)'),35);
assert.equal(run('window.CorpDesk.evaluateFormula("2+3*4",{})'),14);
assert.equal(run('window.CorpDesk.evaluateFormula("(2+3)*4",{})'),20);
assert.equal(run('window.CorpDesk.cellValue("A1",{A1:"=A2",A2:"=A1"})'),'#CIRC!');
assert.equal(run('window.CorpDesk.cellValue("A1",{A1:"=1/0"})'),'#DIV/0!');
assert.equal(run('window.CorpDesk.cellValue("A1",{A1:"=SUM(B1:B3)",B1:"3",B2:"4",B3:"notes"})'),7);
assert.equal(run('window.CorpDesk.cellValue("A1",{A1:"=AVERAGE(B1:B3)",B1:"2",B2:"4",B3:"6"})'),4);
assert.equal(run('window.CorpDesk.cellValue("A1",{A1:"=process.exit()"})'),'#NAME?');
for(const app of ['chrome','notepadpp','office','word','excel','powerpoint'])run(`openApp('${app}')`);
assert.equal(run('window.CorpDesk.windowCount()'),14,'new applications have independent windows');
assert.equal(run('new Set(window.CorpDesk.windowElements()).size'),14);
assert.equal(run('window.CorpDesk.settingsCategories.length'),12);
const winSource=fs.readFileSync(require('node:path').join(__dirname,'dist/windows.js'),'utf8');
assert.ok(winSource.includes('p.toLowerCase()!==local.toLowerCase()&&p.toLowerCase().startsWith(prefix.toLowerCase())'),'Explorer excludes its current folder from its own child listing');
for(const page of ['Home','System','Display','Sound','Notifications','Power & battery','Storage','Multitasking','About','Bluetooth & devices','Mouse','Network & internet','Ethernet','Personalization','Background','Themes','Colors','Lock screen','Taskbar','Apps','Installed apps','Accounts','Time & language','Date & time','Gaming','Accessibility','Privacy & security','Windows Update','AI assistant'])run(`window.CorpDesk.settingsNavigate('${page}')`);
assert.match(run('window.CorpDesk.offlineAnswer("What mode are you?")'),/offline training coach/);
assert.ok(!fs.readFileSync(require('node:path').join(__dirname,'dist/windows.css'),'utf8').includes('.explorer-items .folder'),'folder tile rules cannot match inline folder icons');
const fixes=fs.readFileSync(require('node:path').join(__dirname,'dist/desktop.css'),'utf8');
assert.match(fixes,/\.system-tray\{position:absolute!important;right:8px;left:auto!important/);
assert.match(fixes,/\.explorer-items \.mmc-object-icon\{display:inline-block!important;width:19px!important/);
console.log('PASS: 14 independent app windows; 29 Settings pages; safe spreadsheet arithmetic, ranges, circular/error handling; office/editor/browser render fixtures; and regression rules for tray alignment and Explorer icon spacing.');
for(const id of ['files','terminal','mentor','chrome','directory']){
  const b=run(`window.CorpDesk.windowBounds('${id}',1440,900,0)`);assert.ok(b.width<=1416&&b.height<=824&&b.left>=0&&b.top>=0);assert.ok(b.left+b.width<=1440&&b.top+b.height<852);
}
assert.equal(run("window.CorpDesk.windowBounds('mentor',1440,900,0).width"),550,'chat has a compact app-specific opening width');
run("state.history=[{command:'Get-ADUser hr01',output:'example'}];runCommand('$temporary = Get-ADUser hr01');window.CorpDesk.closeApp('terminal')");
assert.equal(run('state.history.length'),0,'close clears the terminal transcript');assert.equal(command('$temporary'),'','close clears shell variables');
assert.ok(run('state.commandAudit.length')>0,'closed-console evidence remains available privately');
run("openApp('terminal')");assert.equal(run('state.history.length'),0,'reopened shell starts clean');
run("state.browser={tabs:[{title:'Old work',url:'corp://knowledge',back:[],forward:[]}],active:0};window.CorpDesk.closeApp('chrome');openApp('chrome')");
assert.equal(run('state.browser.tabs[0].url'),'chrome://newtab','reopened browser starts a new session');
run("window.CorpDesk.setIconSize('small')");assert.equal(run('state.preferences.iconSize'),'small');run("window.CorpDesk.setIconSize('large')");assert.equal(run('state.preferences.iconSize'),'large');
run("window.CorpDesk.createDirectoryExtra('computer','LAB-PC02','Lab/Workstations','Second training PC')");
assert.match(command('Get-ADComputer LAB-PC02'),/LAB-PC02/);
run("window.CorpDesk.createDirectoryExtra('contact','Supplier Contact','Lab/Users/IT','supplier@example.test')");assert.equal(run("window.CorpDesk.objectById('Supplier Contact').type"),'contact');
assert.ok(run("window.CorpDesk.adContainerMenu()[0].children.some(c=>c.label==='Organizational Unit')"));
const names=new Set();for(let i=0;i<100;i++){const scenario=run("window.CorpDesk.generateOfflineScenario('All categories','Advanced')");assert.ok(scenario.evidenceToCollect.length>=2);assert.ok(scenario.validationSteps.length>=2);names.add(scenario.category);run(`window.CorpDesk.addGeneratedTicket(${JSON.stringify(scenario)})`);}
assert.ok(names.size>=20,'scenario generation covers broad daily support categories');assert.equal(run('state.customTickets.filter(t=>t.generated).length'),100,'generation is not restricted to five tickets');
assert.equal(run('new Set(state.customTickets.map(t=>t.id)).size'),100,'generated ticket IDs remain unique');
assert.throws(()=>run("window.CorpDesk.validateGeneratedScenario({title:'Bad response'})"),/missing/);
assert.equal(run('state.users.some(u=>u.sam==="hr01")'),true,'closing apps preserves directory data');
console.log('PASS: app-specific default bounds, clean terminal/browser close-reopen sessions, retained audit/data, desktop sizes, AD computer/contact creation, nested New OU menu, and 100 generated tickets across 20+ categories.');
console.log('Not verified: browser rendering, layout, downloads, or native browser interaction.');
