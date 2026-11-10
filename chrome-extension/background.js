/* Padel Booking Leon v1.11 · MV3: Playtomic solo GET, senza cookie o password. */
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
