// Create a portable, single-file copy that also opens without a local server.
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
let html=fs.readFileSync(path.join(root,'dist/lab.html'),'utf8');
for (const name of ['style','windows','desktop','workflow','rdp','lock','winapps']) {
  const css=fs.readFileSync(path.join(root,'dist',name+'.css'),'utf8').replace(/^@import[^;]+;\s*/gm,'');
  html=html.replace('<link rel="stylesheet" href="'+name+'.css">',()=>'<style>'+css+'</style>');
}
for (const name of ['app','windows','desktop','lock','workflow','native-bridge','aduc','rdp','winapps']) {
  const js=fs.readFileSync(path.join(root,'dist',name+'.js'),'utf8');
  html=html.replace('<script src="'+name+'.js"></script>',()=>'<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>');
}
const icon='data:image/png;base64,'+fs.readFileSync(path.join(root,'dist/assets/corpdesk.png')).toString('base64');
html=html.replace('href="index.html"','href="Start-Here.html"').replace('href="assets/corpdesk.ico"','href="'+icon+'"');
fs.writeFileSync(path.join(root,'Open-Lab.html'),html.replace("src:'remote-pc/index.html'","src:'dist/remote-pc/index.html'").replaceAll('url("wallpapers/','url("dist/wallpapers/'));
let landing=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
landing=landing.replace('<link rel="stylesheet" href="landing.css">',()=>'<style>'+fs.readFileSync(path.join(root,'dist/landing.css'),'utf8')+'</style>');
landing=landing.replace('<script src="landing.js"></script>',()=>'<script>'+fs.readFileSync(path.join(root,'dist/landing.js'),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
landing=landing.replaceAll('href="lab.html"','href="Open-Lab.html"').replaceAll('src="assets/corpdesk.png"','src="'+icon+'"').replace('href="assets/corpdesk.ico"','href="'+icon+'"').replace('href="downloads/CORP-Desk-Setup.exe"','href="dist/downloads/CORP-Desk-Setup.exe"');
fs.writeFileSync(path.join(root,'Start-Here.html'),landing);
console.log('Created portable landing page Start-Here.html and simulator Open-Lab.html.');
