/* Padel Booking Leon v1.20 · MV3: Playtomic solo GET, senza cookie o password. */
'use strict';
const CHANNEL='pbl-playtomic-chrome-v1';
const ORIGIN='https://leon30071980.github.io';
const TENANT='15bfd441-153f-40ed-9da0-e3a12dd1b0d5';
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
function validateQuery(q){
 if(!q||typeof q!=='object'||!validDate(q.date))throw Error('Data Playtomic non valida.');
 if(!Number.isFinite(mins(q.time)))throw Error('Orario Playtomic non valido.');
 if(![60,90,120].includes(q.duration))throw Error('Durata non supportata.');
 if(![0,15,30,60].includes(q.tolerance))throw Error('Tolleranza non supportata.');
 return {date:q.date,time:q.time,duration:q.duration,tolerance:q.tolerance};
}
function txt(v,max=90){return v==null?'':String(v).slice(0,max);}
function parseSlots(data,q){
 if(!Array.isArray(data)||data.length>200)throw Error('Risposta Playtomic inattesa.');
 const out=[],target=mins(q.time);
 for(const r of data){
  if(!r||typeof r.resource_id!=='string'||r.start_date!==q.date||!Array.isArray(r.slots)||r.slots.length>500)
   throw Error('Risorsa o data Playtomic inattesa.');
  for(const s of r.slots){
   if(!s||typeof s!=='object')continue;
   const start=mins(s.start_time);
   if(!Number.isFinite(start)||Number(s.duration)!==q.duration||
      Math.abs(start-target)>q.tolerance||start+q.duration>1440)continue;
   const label=r.resource_name||r.name||'Campo '+r.resource_id.slice(0,8);
   out.push({club_id:'hero',court_id:r.resource_id,court:txt(label),date:q.date,location:'San Prospero',cover:'unknown',
     start:hm(start),end:hm(start+q.duration),duration:q.duration,price:txt(s.price,40)});
  }
 }
 out.sort((a,b)=>Math.abs(mins(a.start)-target)-Math.abs(mins(b.start)-target)||
   a.start.localeCompare(b.start)||a.court_id.localeCompare(b.court_id));
 return out.slice(0,30);
}
async function availability(raw){
 const q=validateQuery(raw);
 const u=new URL('https://playtomic.com/api/clubs/availability');
 u.searchParams.set('tenant_id',TENANT);u.searchParams.set('date',q.date);u.searchParams.set('sport_id','PADEL');
 const r=await fetch(u.href,{method:'GET',credentials:'omit',redirect:'error',
   cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
 if(r.status===401||r.status===403)throw Error('Playtomic rifiuta la lettura dall’estensione Chrome (HTTP '+r.status+').');
 if(r.status===429)throw Error('Playtomic limita le richieste (HTTP 429).');
 if(!r.ok)throw Error('Calendario Playtomic HTTP '+r.status+'.');
 let data;
 try{data=await r.json();}catch{throw Error('Playtomic non ha restituito JSON valido.');}
 const slots=parseSlots(data,q);
 return {club_id:'hero',status:slots.length?'available':'no_slots',slots,
  reason:slots.length?'Slot Playtomic letti da Chrome; verificare sul sito prima di prenotare.':
    'Nessuno slot compatibile nel calendario Playtomic (orario, durata o finestra da verificare).',
  checked_at:new Date().toISOString()};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(!msg||msg.channel!==CHANNEL||msg.kind!=='availability')return false;
 if(!senderAllowed(sender)){respond({ok:false,error:'Origine non autorizzata.'});return false;}
 availability(msg.query).then(data=>respond({ok:true,data}))
 .catch(error=>respond({ok:false,error:txt(error?.message||error,220)}));
 return true;
});


/* Handoff Wansport: aperto SOLO su richiesta dell'utente dalla pagina ufficiale
 * Github; la selezione viene conservata in session storage per una sola scheda.
 * I cookie/login restano esclusivamente sul sito Wansport.
 */
const WS_HOSTS=Object.freeze({
 gunners:'gunnerspadel.wansport.com',
 pro:'propadelclub.wansport.com',
 puntog:'puntogpadel.wansport.com'
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
