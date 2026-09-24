// Temporary verification of the controls-remap fix (no repo changes).
import {writeFileSync} from 'node:fs';
const tab = (await (await fetch('http://127.0.0.1:9229/json')).json()).find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{let m=JSON.parse(e.data);if(m.id){let p=pending.get(m.id);if(p){clearTimeout(p.t);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails.text.split('\n')[0])}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id,t=setTimeout(()=>reject(new Error('timeout '+method)),12000);pending.set(i,{resolve,reject,t});ws.send(JSON.stringify({id:i,method,params}))});
const evalJS=async expression=>{const d=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(d.exceptionDetails)throw Error(d.exceptionDetails.text);return d.result.value};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:8765/index.html'});
const waitSel=async sel=>{for(let i=0;i<50&&!await evalJS(`!!document.querySelector(${JSON.stringify(sel)})`);i++)await sleep(150);};
const getMoveUp=()=>evalJS(`[...document.querySelectorAll('.controls-remap__key')].find(b=>b.dataset.action==='moveUp')?.textContent`);
const getFirst=()=>evalJS(`[...document.querySelectorAll('.controls-remap__key')].find(b=>b.dataset.action==='moveUp')?.dataset.index`);
// Título -> Opções -> Controles
await waitSel('#btn-options');
await evalJS(`document.querySelector('#btn-options').click()`);
await waitSel('[data-action="controls"]');
await evalJS(`document.querySelector('[data-action="controls"]').click()`);
await waitSel('.controls-remap__key');
const moveUpBefore=await getMoveUp();
// 1) Clica na tecla moveUp (ouvinte ativo) e fecha por VOLTAR
await evalJS(`[...document.querySelectorAll('.controls-remap__key')].find(b=>b.dataset.action==='moveUp').click()`);
await sleep(250);
const listeningWasOn=await evalJS(`[...document.querySelectorAll('.controls-remap__key')].some(b=>b.classList.contains('controls-remap__key--listening'))`);
await evalJS(`document.querySelector('.controls-panel__back').click()`);
await sleep(250);
const closedAfterBack=!await evalJS(`!!document.querySelector('.controls-overlay')`);
// 2) Apertar T depois de fechar não deve alterar o bind nem lançar exceção
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT',windowsVirtualKeyCode:84,nativeVirtualKeyCode:84});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT',windowsVirtualKeyCode:84,nativeVirtualKeyCode:84});
await sleep(300);
// Reabre pelos controles para ler o estado sem remap
await evalJS(`document.querySelector('[data-action="controls"]').click()`);
await waitSel('.controls-remap__key');
const moveUpAfter=await getMoveUp();
await evalJS(`document.querySelector('.controls-panel__back').click()`);
console.log('REMAP_VERIFY',JSON.stringify({listeningWasOn,closedAfterBack,moveUpBefore,moveUpAfter,bindUnchanged:moveUpBefore===moveUpAfter,exceptionCount:errors.length,errors}));
let png=await send('Page.captureScreenshot',{format:'png'});
writeFileSync('C:/Users/LMlim/AppData/Local/Temp/opencode/verify-fix.png',Buffer.from(png.data,'base64'));
ws.close();