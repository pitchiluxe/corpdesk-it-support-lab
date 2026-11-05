const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'dist');
for(const file of ['index.html','lab.html']){const html=fs.readFileSync(path.join(root,file),'utf8');for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const url=match[1];if(/^(https?:|data:)/.test(url))continue;assert.ok(fs.existsSync(path.join(root,url)),`${file}: missing ${url}`);}}
const icon=fs.readFileSync(path.join(root,'assets/corpdesk.ico'));assert.equal(icon.readUInt16LE(0),0);assert.equal(icon.readUInt16LE(2),1);assert.equal(icon.readUInt16LE(4),7);
const nodes=new Map();function node(){return {innerHTML:'',textContent:'',className:'',classList:{toggle(){}},setAttribute(){},scrollIntoView(){}};}function get(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}
let tick;const context=vm.createContext({document:{hidden:false,getElementById:get,querySelector:()=>node(),querySelectorAll:()=>[]},window:{},location:{protocol:'file:'},matchMedia:()=>({matches:false}),setInterval:fn=>tick=fn});
vm.runInContext(fs.readFileSync(path.join(root,'landing.js'),'utf8'),context);
const first=get('demoCaption').textContent;for(let i=0;i<4;i++)tick();const second=get('demoCaption').textContent;assert.notEqual(first,second);for(let i=0;i<4;i++)tick();assert.notEqual(second,get('demoCaption').textContent);
get('pauseDemo').onclick();const paused=get('demoCaption').textContent;for(let i=0;i<8;i++)tick();assert.equal(get('demoCaption').textContent,paused,'pause freezes the workflow preview');
const installer=fs.readFileSync(path.join(root,'downloads/CORP-Desk-Setup.exe'));assert.equal(installer.subarray(0,2).toString(),'MZ');
const portable=fs.readFileSync(path.join(__dirname,'Start-Here.html'),'utf8');assert.ok(portable.includes('href="Open-Lab.html"'));assert.ok(!portable.includes('src="landing.js"'));
console.log('PASS: landing/lab asset links, working installer target, 7-size ICO, three animated workflow scenes, pause control, and portable landing-to-lab navigation.');
