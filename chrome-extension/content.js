/* Padel Booking Leon v1.19 · Ponte solo su GitHub Pages, senza token e cookie. */
(()=>{
 'use strict';
 const CHANNEL='pbl-playtomic-chrome-v1',ORIGIN='https://leon30071980.github.io';
 if(location.origin!==ORIGIN||!location.pathname.startsWith('/Padel-Booking-Leon/'))return;
 function post(kind,payload){window.postMessage(Object.assign({channel:CHANNEL,kind},payload||{}),ORIGIN);}
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==ORIGIN)return;
  const msg=event.data;
  if(!msg||msg.channel!==CHANNEL)return;
  if(msg.kind==='ping'){post('ready',{version:'v1.19',features:['wansport-handoff','playtomic-availability']});return;}
  if(msg.kind==='handoff'&&Number.isSafeInteger(msg.id)&&msg.id>0&&msg.payload&&typeof msg.payload==='object'){
   chrome.runtime.sendMessage({channel:CHANNEL,kind:'handoff',payload:msg.payload},result=>{
    const err=chrome.runtime.lastError;
    if(err)post('handoff-result',{id:msg.id,ok:false,error:err.message});
    else post('handoff-result',{id:msg.id,ok:result?.ok===true,error:result?.error||''});
   });
   return;
  }

  if(msg.kind!=='query'||!Number.isSafeInteger(msg.id)||msg.id<1||
     !msg.query||typeof msg.query!=='object')return;
  try{
   chrome.runtime.sendMessage({channel:CHANNEL,kind:'availability',query:msg.query},result=>{
    const err=chrome.runtime.lastError;
    if(err)post('result',{id:msg.id,ok:false,error:'Estensione non disponibile: '+err.message});
    else if(result&&result.ok===true)post('result',{id:msg.id,ok:true,data:result.data});
    else post('result',{id:msg.id,ok:false,error:result?.error||'Errore Playtomic.'});
   });
  }catch(err){post('result',{id:msg.id,ok:false,error:String(err.message||err).slice(0,220)});}
 });
 post('ready',{version:'v1.19',features:['wansport-handoff','playtomic-availability']});
})();
