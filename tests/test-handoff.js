/* Padel Booking Leon v1.17 — test percorso Chrome → Wansport, nessun accesso live. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners=[],tabs=[],session=new Map();
const chrome={runtime:{id:'local-test',lastError:null,onMessage:{addListener(fn){listeners.push(fn);}}},
  tabs:{create({url,active},callback){const tab={id:101,url,active};tabs.push(tab);callback(tab);},
    async update(id,{url}){const tab=tabs.find(t=>t.id===id);if(!session.has('pbl_wshandoff_'+id))throw Error('Navigated before storage');tab.updated_url=url;}},
  storage:{session:{
    async set(values){for(const [k,v] of Object.entries(values))session.set(k,v);},
    async get(key){return {[key]:session.get(key)};},async remove(key){session.delete(key);}
  }}};
const context=vm.createContext({chrome,URL,Date,Set,Map,Object,String,Number,Array,Math,JSON,Error,
  AbortSignal,fetch:async()=>({ok:true,status:200,json:async()=>[]})});
vm.runInContext(fs.readFileSync('chrome-extension/background.js','utf8'),context);
function message(kind,payload,sender){
 return new Promise((resolve,reject)=>{
  let received=false;
  for(const fn of listeners){
    const did=fn({channel:'pbl-playtomic-chrome-v1',kind,payload},sender,response=>{
      if(!received){received=true;resolve(response);}
    });
    if(did===true)break;
  }
  setTimeout(()=>{if(!received)reject(Error('No response'));},500);
 });
}
let count=0;async function test(name,fn){await fn();count++;console.log('✓ '+name);}
(async()=>{
 const originSender={id:'local-test',url:'https://leon30071980.github.io/Padel-Booking-Leon/',tab:{id:88}};
 const selection={club_id:'pro',court_id:'24',tslot_id:'17911',date:'2026-11-17',
   start:'20:00',end:'21:30',duration:90,court:'Campo N. 4 - PRO GREEN',price:'64,00 €'};
 await test('Chrome apre solo il portale ufficiale con dati separati per scheda',async()=>{
   const response=await message('handoff',selection,originSender);
   assert.equal(response.ok,true);assert.equal(tabs.length,1);
   assert.equal(tabs[0].url,'about:blank');
   assert.equal(tabs[0].updated_url,'https://propadelclub.wansport.com/start');
   assert.equal(tabs[0].active,true);
   const saved=session.get('pbl_wshandoff_101');
   assert.equal(saved.court,'Campo N. 4 - PRO GREEN');
   assert.equal(saved.tslot_id,'17911');
   assert.ok(!('password' in saved)&&!('cookie' in saved));
 });
 await test('Pagina Wansport recupera solo la propria scheda',async()=>{
   const response=await message('getHandoff',null,{tab:{id:101},url:tabs[0].updated_url});
   assert.equal(response.ok,true);
   assert.equal(response.data.date,'2026-11-17');
 });
 await test('Domini estranei non possono leggere i dati di handoff',async()=>{
   const response=await message('getHandoff',null,{tab:{id:101},url:'https://attacker.example/'});
   assert.equal(response.ok,false);
 });
 await test('Origine estranea non può aprire schede di prenotazione',async()=>{
   const before=tabs.length;
   const response=await message('handoff',selection,{...originSender,url:'https://evil.example/'});
   assert.equal(response.ok,false);assert.equal(tabs.length,before);
 });
 await test('Non accetta URL di destinazione arbitrario o durata non valida',async()=>{
   for(const value of [{...selection,club_id:'evil'}, {...selection,duration:120},
      {...selection,tslot_id:'1; DROP TABLE'}, {...selection,date:'2026-02-31'}]){
     const response=await message('handoff',value,originSender);
     assert.equal(response.ok,false);
   }
 });
 await test('La pagina Wansport richiede clic esplicito e non conferma prenotazioni',async()=>{
   const src=fs.readFileSync('chrome-extension/wansport-handoff.js','utf8');
   assert.match(src,/openButton\.onclick=\(\)=>/);
   assert.match(src,/target\.click\(\)/);
   assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|task=prenotazioni\.(?:save|confirm|book)/i);
   const manifest=JSON.parse(fs.readFileSync('chrome-extension/manifest.json','utf8'));
   assert.equal(manifest.version,'1.17.0');
   assert.deepEqual(manifest.permissions,['storage','tabs']);
   assert.equal(manifest.content_scripts.length,2);
 });
 console.log('Chrome/Wansport handoff v1.17: '+count+' test superati.');
})().catch(e=>{console.error(e);process.exitCode=1;});
