'use strict';
(() => {
const native=!!window.corpDesktop?.isNative&&!!window.chrome?.webview;
function normalize(value){value=String(value).trim();if(/^https?:\/\//i.test(value)){try{return new URL(value).href;}catch{return null;}}if(/^[\w.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(value))return 'https://'+value;return 'https://www.google.com/search?q='+encodeURIComponent(value);}
// Websites always open as tabs of the lab's Chrome window, never in a separate or real browser.
function browse(value){const url=normalize(value);if(url)window.CorpDesk?.newBrowserTab?.(url);}
// Desktop app: the host shows each website tab in a WebView2 laid exactly over the Chrome page
// area, and hides it whenever that area is not visible (minimized, another window, menu or dialog on top).
if(native){const post=message=>window.chrome.webview.postMessage(message);let last='';
  const covered=(el,r)=>{for(const fx of [.08,.5,.92])for(const fy of [.08,.5,.92]){const hit=document.elementFromPoint(r.left+r.width*fx,r.top+r.height*fy);if(!hit||!el.contains(hit))return true;}return false;};
  const sync=()=>{const el=document.querySelector('.browser-web[data-web-tab]');let message={action:'webView',tabs:(state.browser?.tabs||[]).map(t=>t.id).filter(Boolean),visible:false};
    if(el&&!document.hidden){const r=el.getBoundingClientRect(),win=el.closest('.app-window');if(r.width>20&&r.height>20&&win&&!win.classList.contains('hidden')&&!covered(el,r)){const d=devicePixelRatio;message={...message,visible:true,tab:el.dataset.webTab,url:el.dataset.webUrl,x:Math.round(r.left*d),y:Math.round(r.top*d),w:Math.round(r.width*d),h:Math.round(r.height*d)};}}
    const key=JSON.stringify(message);if(key!==last){last=key;post(message);}};
  setInterval(sync,120);addEventListener('resize',sync);document.addEventListener('visibilitychange',sync);
  // The page inside a tab navigated by itself (a link, a form, a redirect): record it in that tab.
  window.addEventListener('corp-web',event=>{const d=event.detail||{};if(d.open){browse(d.open);return;}const b=state.browser,index=b?.tabs.findIndex(t=>t.id===d.tab)??-1;if(index<0)return;const t=b.tabs[index];
    if(d.title)t.title=d.title.length>40?d.title.slice(0,40)+'…':d.title;if(d.url&&d.url!==t.url){if(!d.replace){t.back.push(t.url);t.forward=[];}t.url=d.url;}save();
    const active=document.querySelector('#appWindow[data-app=chrome] .browser-app');if(active&&b.active===index&&document.activeElement?.id!=='browserAddress')window.CorpDesk.renderChrome();else{const label=document.querySelector('.app-window[data-app=chrome] [data-browser-tab="'+index+'"] span');if(label)label.textContent=t.title;}});
  post({action:'labReady'});}
// Native discovery runs outside page CORS restrictions and never pulls or starts a model automatically.
window.addEventListener('corp-ollama',event=>{if(!native||typeof state==='undefined')return;const probe=event.detail;state.nativeOllama={available:!!probe.available,installed:!!probe.installed,models:probe.models||[]};if(probe.available&&probe.models?.length){const models=probe.models.map(m=>m.name);if(!state.preferences.ollamaAutoConfigured){state.assistant.model=models.find(m=>/3b|4b|7b|8b/i.test(m))||models[0];state.assistant.mode='ollama';state.preferences.ollamaAutoConfigured=true;}else if(state.assistant.mode==='ollama'&&!models.includes(state.assistant.model))state.assistant.model=models[0];}save();const settingsNode=document.getElementById('settingsOllamaStatus');if(settingsNode&&window.CorpDesk?.ollamaStatusText)settingsNode.textContent=window.CorpDesk.ollamaStatusText();const node=document.getElementById('nativeOllamaStatus');if(node)node.textContent=probe.available?`Ollama detected · ${probe.models.length} local model(s)`:probe.installed?'Ollama installed · click to start':'Ollama not detected · offline coach available';});
if(native){window.chrome.webview.postMessage({action:'probeOllama'});const status=document.createElement('button');status.id='nativeOllamaStatus';status.style.cssText='position:absolute;right:22px;top:14px;color:#d9e9f7;font:10px Segoe UI,sans-serif;background:#173c56aa;border:1px solid #d9e9f744;border-radius:4px;padding:8px;cursor:pointer';status.textContent='Checking local Ollama…';status.title='Open installed Ollama, or refresh its status';status.onclick=()=>{const info=state.nativeOllama;if(!info?.available)window.chrome.webview.postMessage({action:'startOllama'});window.chrome.webview.postMessage({action:'probeOllama'});};document.getElementById('desktop')?.append(status);}
window.CorpDesk={...window.CorpDesk,nativeBrowser:native,browseRealPage:browse,reloadWeb:native?id=>{window.chrome.webview.postMessage({action:'webReload',tab:id});return true;}:null};
})();
