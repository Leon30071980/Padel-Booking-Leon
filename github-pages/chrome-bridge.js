/* v1.28 · Bridge Chrome ↔ Padel Booking Leon · nessun dato segreto. */
(()=>{
 'use strict';
 const CHANNEL='pbl-playtomic-chrome-v1',ORIGIN='https://leon30071980.github.io';
 let serial=0,ready=false,capabilities=new Set(),extensionVersion='';
 const pending=new Map();
 function send(kind,data){window.postMessage(Object.assign({channel:CHANNEL,kind},data||{}),ORIGIN);}
 window.addEventListener('message',event=>{
  if(event.origin!==ORIGIN||event.source!==window)return;
  const msg=event.data;
  if(!msg||msg.channel!==CHANNEL)return;
  if(msg.kind==='ready'){ready=true;extensionVersion=String(msg.version||'');capabilities=new Set(Array.isArray(msg.features)?msg.features:[]);document.dispatchEvent(new Event('pbl-chrome-ready'));return;}
  if(msg.kind==='hero-imported'){document.dispatchEvent(new CustomEvent('pbl-hero-imported',{detail:msg.data}));return;}
  if(!['result','handoff-result','hero-result'].includes(msg.kind)||!Number.isSafeInteger(msg.id))return;
  const p=pending.get(msg.id);if(!p)return;
  pending.delete(msg.id);clearTimeout(p.timer);
  if(msg.ok===true)p.resolve(msg.kind==='handoff-result'?{ok:true}:msg.data);
  else p.reject(Error(typeof msg.error==='string'?msg.error:'Impossibile leggere Playtomic.'));
 });
 function installed(){return ready;}
 let probing=null;
 function probe(){
  if(probing)return probing;
  probing=new Promise(resolve=>{
   const f=()=>{clearTimeout(timer);document.removeEventListener('pbl-chrome-ready',f);resolve(true);};
   const timer=setTimeout(()=>{document.removeEventListener('pbl-chrome-ready',f);ready=false;extensionVersion='';capabilities.clear();resolve(false);},2000);
   document.addEventListener('pbl-chrome-ready',f);
   send('ping');
  }).finally(()=>{probing=null;});
  return probing;
 }
 async function query(){throw Error('Accesso API Playtomic sospeso. Utilizzi la modalità assistita.');}
 async function heroCommand(kind,payload){
  if(!ready&&!(await probe()))throw Error('Estensione Chrome non rilevata.');
  if(!capabilities.has('hero-visible-import'))throw Error('Ricarichi l’estensione Chrome v1.28 e la pagina.');
  const id=++serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Nessuna risposta dall’estensione.'));},12000);
   pending.set(id,{resolve,reject,timer});send(kind,{id,payload});
  });
 }
 async function handoff(details){
  if(!ready && !(await probe()))throw Error('Estensione Chrome non rilevata. Aggiorni il repository, ricarichi l’estensione e aggiorni questa pagina.');
  if(!['v1.22','v1.24','v1.25','v1.26','v1.27','v1.28'].includes(extensionVersion)||!capabilities.has('wansport-handoff'))throw Error('L’estensione Chrome '+(extensionVersion||'installata')+' non supporta la guida Wansport. Ricarichi l’estensione dalla cartella Google Drive in chrome://extensions, poi Ctrl+F5 su questa pagina.');
  const id=++serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('L’estensione non ha aperto Wansport entro 15 secondi.'));},15000);
   pending.set(id,{resolve,reject,timer});
   send('handoff',{id,payload:details});
  });
 }
 window.PBL_CHROME={installed,probe,query,handoff,heroOpen:p=>heroCommand('hero-open',p),heroPull:()=>heroCommand('hero-pull'),heroCapable:()=>capabilities.has('hero-visible-import'),version:()=>extensionVersion};
 send('ping');
 document.addEventListener('DOMContentLoaded',()=>send('ping'));
})();
