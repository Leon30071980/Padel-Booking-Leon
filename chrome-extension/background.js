/* Padel Booking Leon v1.26 · MV3: Playtomic assistito; Wansport invariato. */
'use strict';
const CHANNEL='pbl-playtomic-chrome-v1';
const ORIGIN='https://leon30071980.github.io';
function senderAllowed(sender){
 if(!sender||sender.id!==chrome.runtime.id||!sender.tab||typeof sender.url!=='string')return false;
 try{const u=new URL(sender.url);return u.origin===ORIGIN&&u.pathname.startsWith('/Padel-Booking-Leon/');}
 catch{return false;}
}
function validDate(day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(day+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
}
const CLOCK=/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
function mins(hm){const m=typeof hm==='string'?hm.match(CLOCK):null;return m?Number(m[1])*60+Number(m[2]):NaN;}
function hm(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function txt(v,max=90){return v==null?'':String(v).slice(0,max);}
// L'accesso diretto a Playtomic è sospeso; nessuna chiamata di rete.
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(!msg||msg.channel!==CHANNEL||msg.kind!=='availability')return false;
 if(!senderAllowed(sender)){respond({ok:false,error:'Origine non autorizzata.'});return false;}
 respond({ok:false,error:'Accesso API Playtomic sospeso. Utilizzi la modalità assistita.'});
 return false;
});


/* Handoff Wansport: aperto SOLO su richiesta dell'utente dalla pagina ufficiale
 * Github; la selezione viene conservata in session storage per una sola scheda.
 * I cookie/login restano esclusivamente sul sito Wansport.
 */
const WS_HOSTS=Object.freeze({
 gunners:'gunnerspadel.wansport.com',
 pro:'propadelclub.wansport.com',
 puntog:'puntogpadel.wansport.com',
 donbosco:'pgsdonbosco.wansport.com',
 inzani:'circoloinzani.wansport.com'
});
function validHandoff(value){
 if(!value||typeof value!=='object'||!Object.hasOwn(WS_HOSTS,value.club_id))return null;
 if(!validDate(value.date)||!Number.isFinite(mins(value.start))||!Number.isFinite(mins(value.end)))return null;
 if(![60,90,120].includes(Number(value.duration)))return null;
 if(mins(value.end)-mins(value.start)!==Number(value.duration))return null;
 if(typeof value.court_id!=='string'||!/^[1-9]\d{0,11}$/.test(value.court_id))return null;
 if(value.tslot_id!==''&&value.tslot_id!==null&&value.tslot_id!==undefined&&
   !/^[1-9]\d{0,11}$/.test(String(value.tslot_id)))return null;
 return {club_id:value.club_id,court_id:value.court_id,
   tslot_id:value.tslot_id?String(value.tslot_id):'',date:value.date,
   start:value.start,end:value.end,duration:Number(value.duration),
   court:txt(value.court,110),price:txt(value.price,50),created_at:Date.now()};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(!msg||msg.channel!==CHANNEL)return false;
 if(msg.kind==='handoff'){
   if(!senderAllowed(sender)){respond({ok:false,error:'Origine non autorizzata.'});return false;}
   const data=validHandoff(msg.payload);
   if(!data){respond({ok:false,error:'Dati della fascia non validi.'});return false;}
   const url='https://'+WS_HOSTS[data.club_id]+'/start';
   // Cruciale: prima registrare il riepilogo per ID scheda,
   // poi navigare verso Wansport, evitando la corsa col content script.
   chrome.tabs.create({url:'about:blank',active:true},async tab=>{
     if(chrome.runtime.lastError||!tab||!Number.isInteger(tab.id)){
       respond({ok:false,error:'Impossibile creare la scheda Wansport.'});return;
     }
     const key='pbl_wshandoff_'+tab.id;
     try{
       await chrome.storage.session.set({[key]:data});
       await chrome.tabs.update(tab.id,{url});
       respond({ok:true,tab_id:tab.id});
     }catch(err){
       try{await chrome.storage.session.remove(key);}catch(ignored){}
       respond({ok:false,error:'Impossibile preparare la scheda Wansport: '+txt(err?.message||err,110)});
     }
   });
   return true;
 }
 if(msg.kind==='getHandoff'){
   const host=typeof sender?.url==='string'?new URL(sender.url).hostname:'';
   if(!sender?.tab||!Number.isInteger(sender.tab.id)||!Object.values(WS_HOSTS).includes(host)){
     respond({ok:false,error:'Pagina non consentita.'});return false;
   }
   chrome.storage.session.get('pbl_wshandoff_'+sender.tab.id).then(values=>{
     const record=values['pbl_wshandoff_'+sender.tab.id];
     if(record&&WS_HOSTS[record.club_id]===host&&Date.now()-record.created_at<10*60000)
       respond({ok:true,data:record});
     else respond({ok:false,error:'Nessuna fascia selezionata.'});
   }).catch(()=>respond({ok:false,error:'Nessun dato temporaneo.'}));
   return true;
 }
 return false;
});
