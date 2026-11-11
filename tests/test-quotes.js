/* Padel Booking Leon v1.19 — test quotazioni automatiche 60/90/120, senza HTTP esterno. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const day='2026-11-10';
let quotedBody,quoteStatus=200,requests=[],calendarWithId=true,sessionCount=0,calendarCount=0,rateLimit=false;
const cookies={sid:'authorized'},cache=new Map();
const availableTimes=['17:30','18:00','18:30','19:00','19:30','20:00'];
const calendar=()=>({success:true,dati:{sedi:[{nome:'PRO PARMA',risorse:[{
  id:2,nome:'Campo Centrale Open N.1 - PRO PARMA',isFuoriFinestraTemporale:false,
  listaPrenotazioni:[],
  tslots:availableTimes.map((h,i)=>({
    starttime:h,ts_start:day+' '+h+':00',published:true,full_tslot:false,
    ...(calendarWithId?{id:17911+i}:{})
  }))
}]}]}});
let quoteDuration=60;
function responsePrice(){
  const endMinutes=(17*60+30)+quoteDuration;
  return {success:true,dati:{costoTotalePrenotazioneNF:quoteDuration===60?52:quoteDuration===90?64:80,
    costoTotalePrenotazione:'€ 52,00',startTime:'17:30',
    endTime:String(Math.floor(endMinutes/60)).padStart(2,'0')+':'+String(endMinutes%60).padStart(2,'0'),currencyCode:'EUR'}};
}
quotedBody=responsePrice();
const ctx=vm.createContext({console,Date,Map,Set,String,Number,Array,Object,RegExp,JSON,Math,Error,CacheService:{
 getUserCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
 now_:()=> '2026-11-10T17:30:00.000Z',
 dateCheck_:d=>{if(d!==day)throw Error('Data non valida');return d;},
 timeCheck_:v=>{if(!/^\d{2}:\d{2}$/.test(v))throw Error('Ora non valida');return v;},
 extraConnStatus_:()=>({configured:true}),
 extraSession_:()=>{sessionCount++;return cookies;},
 extraCalendar_:(id,date,session)=>{calendarCount++;assert.equal(id,'pro');assert.equal(date,day);assert.equal(session,cookies);return calendar();},
 extraProp_:(id,key)=>id+'_'+key,extraConfig_:()=>({origin:'https://propadelclub.wansport.com'}),
 PropertiesService:{getUserProperties:()=>({getProperty:k=>k==='pro_SPORT_ID'?'15':null})},
 extraFetch_:(id,path,session,opt)=>{
  requests.push({id,path,session,opt});
  const duration=new URL(path,'https://propadelclub.wansport.com').searchParams.get('duration');
  if(rateLimit)return {getResponseCode:()=>429,getContentText:()=>''};
  if(!quotedBody)quotedBody=responsePrice();
  return {getResponseCode:()=>quoteStatus,getContentText:()=>JSON.stringify(quotedBody)};
 }
});
for(const name of ['Gunners.gs','WansportQuotes.gs']){
 new vm.Script(fs.readFileSync('apps-script/'+name,'utf8'),{filename:name}).runInContext(ctx);
}
const run=script=>vm.runInContext(script,ctx);
const base={club_id:'pro',court_id:'2',date:day,start:'17:30',duration:60};
const batch=slots=>run('getWansportQuotesBatch('+JSON.stringify({club_id:'pro',date:day,slots})+')');
let count=0;function test(name,fn){fn();count++;console.log('✓ '+name);}
test('Preventivo GET 60 minuti senza prenotazione',()=>{
 quoteDuration=60;quotedBody=responsePrice();
 const r=batch([base]);assert.equal(r.quotes.length,1);assert.equal(r.quotes[0].ok,true);
 assert.equal(r.quotes[0].price,'52,00 €');
 const call=requests.at(-1),url=new URL(call.path,'https://propadelclub.wansport.com');
 assert.equal(call.opt.method,'get');assert.equal(call.opt.payload,undefined);
 assert.equal(url.searchParams.get('task'),'prenotazioni.getPrenotazioneNuovaModal');
 assert.equal(url.searchParams.get('tslotId'),'17911');
 assert.equal(url.searchParams.get('duration'),'');
 assert.equal(url.searchParams.get('sportId'),'15');
 assert.equal(url.searchParams.get('dataSelezionata'),day);
});
test('90 minuti accettati solo se il JSON conferma termine alle 19:00',()=>{
 quoteDuration=90;quotedBody=responsePrice();
 const r=batch([{...base,duration:90}]);
 assert.equal(r.quotes[0].ok,true);assert.equal(r.quotes[0].price,'64,00 €');
 assert.equal(new URL(requests.at(-1).path,'https://x.test').searchParams.get('duration'),'90');
});
test('120 minuti accettati solo con termine alle 19:30',()=>{
 quoteDuration=120;quotedBody=responsePrice();
 const r=batch([{...base,duration:120}]);
 assert.equal(r.quotes[0].ok,true);assert.equal(r.quotes[0].price,'80,00 €');
 assert.equal(new URL(requests.at(-1).path,'https://x.test').searchParams.get('duration'),'120');
});
test('Non mostra prezzi da 60 minuti a richiesta di 90 o 120',()=>{
 quoteDuration=60;quotedBody=responsePrice();const c=cache.size;
 const r=batch([{...base,start:'18:00',duration:90}]);
 assert.equal(r.quotes[0].ok,false);assert.match(r.quotes[0].error,/non ha confermato/);
 assert.equal(cache.size,c);
});
test('Batch massimo 3 e una sola sessione, un solo calendario',()=>{
 quoteDuration=60;quotedBody=responsePrice();
 const previous=sessionCount,prevCalendar=calendarCount;
 const slots=[{...base,start:'17:30'},{...base,start:'18:00'},{...base,start:'18:30'}];
 const r=batch(slots);
 assert.equal(r.quotes.length,3);
 assert.equal(sessionCount-previous,1);assert.equal(calendarCount-prevCalendar,1);
 assert.throws(()=>batch([...slots,{...base,start:'19:00'}]),/da 1 a 3/);
});
test('ID timeslot assente: errore per singolo campo, nessun GET modale',()=>{
 calendarWithId=false;const before=requests.length;
 const r=batch([{...base,start:'19:00'}]);
 assert.equal(r.quotes[0].ok,false);assert.match(r.quotes[0].error,/ID tslotId/);
 assert.equal(requests.length,before);calendarWithId=true;
});
test('Risposte 403, 429 e senza JSON non diventano prezzi',()=>{
 quoteStatus=403;
 let r=batch([{...base,start:'19:00'}]);assert.equal(r.quotes[0].ok,false);assert.match(r.quotes[0].error,/403/);
 quoteStatus=200;rateLimit=true;
 r=batch([{...base,start:'19:00'},{...base,start:'19:30'}]);
 assert.equal(r.rate_limited,true);assert.equal(r.quotes[1].ok,false);
 rateLimit=false;
});
test('Campi, giorni, durate e richieste duplicate vengono validati',()=>{
 for(const item of [{...base,court_id:'5'},{...base,start:'22:00'}]){
  const r=batch([item]);assert.equal(r.quotes[0].ok,false);
 }
 assert.throws(()=>batch([{...base,duration:45}]),/Durata/);
 assert.throws(()=>batch([base,base]),/duplicate/);
 assert.throws(()=>run('getWansportQuotesBatch('+JSON.stringify({club_id:'puntog',date:day,slots:[base]})+')'),/solo per Pro Padel/);
});
test('Cache breve riusa lo stesso preventivo verificato',()=>{
 quoteDuration=60;quotedBody=responsePrice();
 const before=requests.length;const r=batch([base]);
 assert.equal(r.quotes[0].ok,true);
 assert.equal(requests.length,before);
 assert.equal(r.quotes[0].cached,true);
});
console.log('Preventivi Wansport v1.19: '+count+' test superati.');
