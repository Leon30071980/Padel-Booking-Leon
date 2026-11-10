/* v1.8 · Bridge Chrome ↔ Padel Booking Leon · nessun dato segreto. */
(()=>{
 'use strict';
 const CHANNEL='pbl-playtomic-chrome-v1',ORIGIN='https://leon30071980.github.io';
 let serial=0,ready=false;
 const pending=new Map();
 function send(kind,data){window.postMessage(Object.assign({channel:CHANNEL,kind},data||{}),ORIGIN);}
 window.addEventListener('message',event=>{
  if(event.origin!==ORIGIN||event.source!==window)return;
  const msg=event.data;
  if(!msg||msg.channel!==CHANNEL)return;
  if(msg.kind==='ready'){ready=true;document.dispatchEvent(new Event('pbl-chrome-ready'));return;}
  if(msg.kind!=='result'||!Number.isSafeInteger(msg.id))return;
  const p=pending.get(msg.id);if(!p)return;
  pending.delete(msg.id);clearTimeout(p.timer);
  if(msg.ok===true)p.resolve(msg.data);
  else p.reject(Error(typeof msg.error==='string'?msg.error:'Impossibile leggere Playtomic.'));
 });
 function installed(){return ready;}
 function probe(){
  send('ping');
  return new Promise(resolve=>{
   if(ready){resolve(true);return;}
   let ended=false;
   const f=()=>{if(!ended){ended=true;clearTimeout(timer);resolve(true);}};
   document.addEventListener('pbl-chrome-ready',f,{once:true});
   const timer=setTimeout(()=>{ended=true;document.removeEventListener('pbl-chrome-ready',f);resolve(ready);},1300);
  });
 }
 async function query(q){
  if(!ready && !(await probe()))throw Error('Estensione Padel Booking Leon non rilevata in Chrome. Installarla per leggere Padel Hero.');
  const id=++serial;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Nessuna risposta dall’estensione Chrome entro 25 secondi.'));},25000);
   pending.set(id,{resolve,reject,timer});
   send('query',{id,query:{date:q.date,time:q.time,duration:Number(q.duration),tolerance:Number(q.tolerance)}});
  });
 }
 window.PBL_CHROME={installed,probe,query};
 send('ping');
 document.addEventListener('DOMContentLoaded',()=>send('ping'));
})();
