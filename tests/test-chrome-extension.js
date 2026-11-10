/* Padel Booking Leon v1.11 — unit tests extension MV3, senza rete o sessioni. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const manifest=JSON.parse(fs.readFileSync('chrome-extension/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.host_permissions,['https://playtomic.com/*']);
assert.equal(manifest.content_scripts.length,1);
assert.ok(manifest.content_scripts[0].matches[0].includes('Padel-Booking-Leon'));
const source=fs.readFileSync('chrome-extension/background.js','utf8');
const listener={};let status=200,body=[],fetchCalls=[];
const sampleDate='2026-11-11';
const browserFetch=async (url,opts)=>{
 fetchCalls.push({url,opts});
 return {ok:status===200,status,json:async()=>body};
};
const chrome={runtime:{id:'test-extension',onMessage:{addListener:fn=>listener.onMessage=fn}}};
const ctx=vm.createContext({console,chrome,fetch:browserFetch,Date,JSON,Set,Map,URL,AbortSignal,
  Number,String,Array,Object,Math,Error});
vm.runInContext(source,ctx,{filename:'background.js'});
const allowedSender={id:'test-extension',tab:{id:1},url:'https://leon30071980.github.io/Padel-Booking-Leon/'};
const query={date:sampleDate,time:'19:00',duration:90,tolerance:15};
const send=(q=query,sender=allowedSender)=>new Promise(resolve=>{
 listener.onMessage({channel:'pbl-playtomic-chrome-v1',kind:'availability',query:q},sender,resolve);
});
let n=0;async function test(name,fn){await fn();n++;console.log('✓ '+name);}
(async()=>{
 await test('GET pubblico sul tenant fisso, senza cookie o POST',async()=>{
  body=[{resource_id:'abc123456',start_date:sampleDate,slots:[
   {start_time:'19:00:00',duration:90,price:'60 EUR'},
   {start_time:'19:15:00',duration:90,price:'64 EUR'},
   {start_time:'19:30:00',duration:120,price:'75 EUR'}]}];
  const r=await send();assert.equal(r.ok,true);assert.equal(r.data.status,'available');
  assert.equal(r.data.slots.length,2);assert.equal(r.data.slots[0].price,'60 EUR');
  const call=fetchCalls.at(-1);assert.equal(call.opts.method,'GET');
  assert.equal(call.opts.credentials,'omit');assert.equal(call.opts.redirect,'error');
  assert.equal(new URL(call.url).searchParams.get('tenant_id'),'15bfd441-153f-40ed-9da0-e3a12dd1b0d5');
 });
 await test('Richieste fuori origine respinte prima di accesso a rete',async()=>{
  const count=fetchCalls.length;
  for(const sender of [
   {id:'test-extension',tab:{id:2},url:'https://evil.example/'},
   {id:'another-extension',tab:{id:3},url:allowedSender.url},
   {id:'test-extension',tab:{id:4},url:'https://leon30071980.github.io/OTHER/'}
  ]){
   const result=await send(query,sender);assert.equal(result.ok,false);
  }
  assert.equal(fetchCalls.length,count);
 });
 await test('Date e durate non valide non chiamano Playtomic',async()=>{
  const count=fetchCalls.length;
  for(const item of [{...query,date:'2026-02-30'},{...query,duration:999},{...query,time:'25:00'}]){
   const result=await send(item);assert.equal(result.ok,false);
  }
  assert.equal(fetchCalls.length,count);
 });
 await test('Non inventa slot se Playtomic restituisce elenco vuoto',async()=>{
  body=[];const result=await send();
  assert.equal(result.ok,true);assert.equal(result.data.status,'no_slots');assert.equal(result.data.slots.length,0);
 });
 await test('403 non viene interpretato come nessun campo libero',async()=>{
  status=403;const result=await send();assert.equal(result.ok,false);assert.match(result.error,/403/);
  status=200;
 });
 await test('Durata e tolleranza devono coincidere',async()=>{
  body=[{resource_id:'test-court-1',start_date:sampleDate,slots:[{start_time:'19:00:00',duration:120,price:'75 EUR'}]}];
  const r=await send();assert.equal(r.data.status,'no_slots');
 });
 await test('Ponte GitHub e pagina presenti',async()=>{
  const page=fs.readFileSync('github-pages/index.html','utf8');
  assert.match(page,/chrome-bridge\.js/);
  const bridge=fs.readFileSync('github-pages/chrome-bridge.js','utf8');
  assert.match(bridge,/pbl-playtomic-chrome-v1/);
  const app=fs.readFileSync('github-pages/app.js','utf8');
  assert.match(app,/PBL_CHROME\.query/);
  assert.match(app,/otherClubs=clubs\.filter\(id=>id!=='hero'\)/);
 });
 console.log('Chrome Playtomic: '+n+' test superati.');
})().catch(e=>{console.error(e);process.exitCode=1;});
