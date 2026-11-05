// Real DOM/event regression checks; no browser automation or host actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let jsdom;try{jsdom=require('jsdom');}catch{jsdom=require('./.build/dom-tests/node_modules/jsdom');}
const {JSDOM,VirtualConsole}=jsdom;
const root=path.join(__dirname,'dist'),errors=[];
const consoleEvents=new VirtualConsole();consoleEvents.on('jsdomError',error=>errors.push(error));
const html=fs.readFileSync(path.join(root,'lab.html'),'utf8').replace(/<script\s+src="[^"]+"><\/script>/g,'').replace(/<link[^>]+>/g,'');
const dom=new JSDOM(html,{url:'https://corpdesk.local/lab.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:consoleEvents,beforeParse(window){window.matchMedia=()=>({matches:false});window.confirm=()=>true;window.setInterval=()=>0;window.setTimeout=()=>0;window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.setPointerCapture=function(){};}});
const w=dom.window,d=w.document;
for(const name of ['app','windows','desktop','workflow','native-bridge']){const before=errors.length;const script=d.createElement('script');script.textContent=fs.readFileSync(path.join(root,name+'.js'),'utf8')+'\n//# sourceURL='+name+'.js';d.body.append(script);if(errors.length!==before)console.error('Boot failure in '+name+'.js',errors.at(-1).cause?.stack||errors.at(-1).detail?.stack||errors.at(-1).message);}
if(errors.length)throw Error('Application boot produced '+errors.length+' DOM errors.');
const api=w.CorpDesk;
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
api.openApp('directory');let ad=d.querySelector('[data-app="directory"]');assert.ok(ad.querySelector('.mmc-tree'));context([...ad.querySelectorAll('[data-tree]')].find(n=>n.dataset.tree==='Lab'));
let menu=[...d.querySelectorAll('[role="menu"]')].at(-1);assert.match(menu.textContent,/New/);click([...menu.querySelectorAll('button')].find(b=>b.textContent.includes('New')));
menu=[...d.querySelectorAll('[role="menu"]')].at(-1);assert.match(menu.textContent,/Organizational Unit/);checkErrors('AD New submenu');
click([...menu.querySelectorAll('button')].find(b=>b.textContent.includes('Organizational Unit')));const nameInput=d.querySelector('#prop-name');assert.ok(nameInput,'New OU dialog is functional');nameInput.value='Support Test';click(d.querySelector('[data-dialog-action="0"]'));assert.ok(api.getState().ous.includes('Lab/Support Test'),'right-click New OU creates the directory object');
click(ad.querySelector('[data-win="close"]'));assert.equal(ad.isConnected,false,'AD X removes its window');api.openApp('directory');ad=d.querySelector('[data-app="directory"]');assert.ok(ad.querySelector('.mmc-tree'));
api.openApp('terminal');const terminal=d.querySelector('[data-app="terminal"]');click(terminal.querySelector('[data-win="close"]'));assert.equal(terminal.isConnected,false,'PowerShell X closes its session');
checkErrors('window close/reopen');
context(d.querySelector('.taskbar'));assert.match([...d.querySelectorAll('[role="menu"]')].at(-1).textContent,/Task Manager/);checkErrors('taskbar menu');
console.log('PASS: full HTML boot, desktop right-click, Explorer layout and context menu, AD tree New OU submenu, and real close-button click/reopen event sequences.');
dom.window.close();
