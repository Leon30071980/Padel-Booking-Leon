/* Padel Booking Leon v1.17 — Playtomic read-only mock tests. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let mockStatus=200, mockBody=[], requests=[];
const day='2026-11-11', resource='5264d11d-27cd-43e3-952e-6d41faf0da95';
const valid=()=>[{resource_id:resource,start_date:day,slots:[
  {start_time:'08:00:00',duration:90,price:'60 EUR'},
  {start_time:'19:00:00',duration:90,price:'64 EUR'},
  {start_time:'19:30:00',duration:120,price:'75 EUR'}
]},{resource_id:'bd799ad3-7857-4097-a9f5-82b838c6c814',start_date:day,
  slots:[{start_time:'19:15:00',duration:90,price:'62 EUR'}]}];
const props=new Map();
const ctx=vm.createContext({Date,JSON,Map,Set,URL,Error,String,Number,Object,Array,Math,
  PropertiesService:{getUserProperties:()=>({
    getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
  UrlFetchApp:{fetch:(url,opts)=>{
    requests.push({url,opts});
    return {getResponseCode:()=>mockStatus,getContentText:()=>typeof mockBody==='string'?mockBody:JSON.stringify(mockBody)};
  }},
  dateCheck_:v=>v,now_:()=> '2026-11-10T15:00:00.000Z',romeToday_:()=>day});
new vm.Script(fs.readFileSync('apps-script/Playtomic.gs','utf8'),{filename:'Playtomic.gs'}).runInContext(ctx);
const run=src=>vm.runInContext(src,ctx);
let tests=0;function test(name,fn){fn();tests++;console.log('✓ '+name);}
test('Configurato ma non verificato all avvio',()=>{
 const state=run('playtomicConnectionStatus_()');
 assert.equal(state.configured,true);assert.equal(state.ready,false);assert.equal(state.booking_ready,false);
});
test('Solo GET https sul tenant Padel Hero, senza credenziali o payload',()=>{
 mockBody=valid();
 const r=run("searchPlaytomic_({date:'2026-11-11',time:'19:00',duration:90,tolerance:15})");
 assert.equal(r.status,'available');assert.equal(r.slots.length,2);
 const req=requests.at(-1);
 assert.equal(req.opts.method,'get');assert.ok(!req.opts.payload);
 const u=new URL(req.url);
 assert.equal(u.origin,'https://playtomic.com');
 assert.equal(u.pathname,'/api/clubs/availability');
 assert.equal(u.searchParams.get('tenant_id'),'15bfd441-153f-40ed-9da0-e3a12dd1b0d5');
 assert.equal(u.searchParams.get('date'),day);
 assert.equal(u.searchParams.get('sport_id'),'PADEL');
 assert.equal(props.get('PBL_PLAYTOMIC_LAST_VERIFIED'),'2026-11-10T15:00:00.000Z');
});
test('Durata esatta, tolleranza, prezzo e risorse preservati',()=>{
 const r=run("searchPlaytomic_({date:'2026-11-11',time:'19:00',duration:90,tolerance:0})");
 assert.equal(r.status,'available');assert.equal(r.slots.length,1);
 assert.equal(r.slots[0].price,'64 EUR');
 assert.equal(r.slots[0].court_id,resource);
 assert.match(r.slots[0].court,/5264d11d/);
 const r120=run("searchPlaytomic_({date:'2026-11-11',time:'19:30',duration:120,tolerance:0})");
 assert.equal(r120.slots.length,1);assert.equal(r120.slots[0].end,'21:30');
});
test('Durata assente o diversa non produce falsi positivi',()=>{
 const r=run("searchPlaytomic_({date:'2026-11-11',time:'20:00',duration:60,tolerance:0})");
 assert.equal(r.status,'no_slots');assert.equal(r.slots.length,0);
});
test('Array vuoto produce risultato prudente, non finge fuori finestra',()=>{
 mockBody=[];
 const r=run("searchPlaytomic_({date:'2026-11-11',time:'19:00',duration:90,tolerance:0})");
 assert.equal(r.status,'no_slots');assert.match(r.reason,/finestra/);
});
test('403 e 429 non trasformati in assenza disponibilita',()=>{
 mockBody=valid();
 for(const status of [403,429]){
   mockStatus=status;
   const r=run("searchPlaytomic_({date:'2026-11-11',time:'19:00',duration:90,tolerance:0})");
   assert.equal(r.status,'error');assert.equal(r.slots.length,0);assert.equal(props.has('PBL_PLAYTOMIC_LAST_VERIFIED'),false);
 }
 mockStatus=200;
});
test('Risposte HTML o struttura mutata restano errori',()=>{
 for(const bad of ['<html>login</html>',{slots:[]},[{resource_id:'abc',start_date:day}], [{resource_id:resource,start_date:'2026-11-12',slots:[]}] ]){
   mockBody=bad;
   const r=run("searchPlaytomic_({date:'2026-11-11',time:'19:00',duration:90,tolerance:0})");
   assert.equal(r.status,'error');assert.equal(r.slots.length,0);
 }
});
test('Test collegamento misura accessibilita cloud con risposta reale mock',()=>{
 mockBody=valid();const r=run('testPlaytomicConnection()');assert.equal(r.ok,true);
 mockStatus=403;const fail=run('testPlaytomicConnection()');assert.equal(fail.ok,false);mockStatus=200;
});
console.log('Playtomic v1.17: '+tests+' test superati.');
