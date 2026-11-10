/* Padel Booking Leon v1.11 — preventivo Pro Wansport: test senza HTTP esterno. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const day='2026-11-10';let quotedBody=null,quoteStatus=200,requests=[],calendarWithId=true;
const cookies={sid:'authorized'};
const calendar=()=>({success:true,dati:{sedi:[{nome:'PRO PARMA',risorse:[{
  id:2,nome:'Campo Centrale Open N.1 - PRO PARMA',isFuoriFinestraTemporale:false,
  listaPrenotazioni:[],
  tslots:['17:30','18:00'].map((h,i)=>({
    starttime:h,ts_start:day+' '+h+':00',published:true,full_tslot:false,
    ...(calendarWithId?{id:17911+i}:{})
  }))
}]}]}});
const ctx=vm.createContext({console,Date,Map,Set,String,Number,Array,Object,RegExp,JSON,Math,Error,
  dateCheck_:d=>{if(d!==day)throw Error('Data non valida');return d;},
  timeCheck_:v=>{if(!/^\d{2}:\d{2}$/.test(v))throw Error('Ora non valida');return v;},
  integer_:(v,min,max)=>{const x=Number(v);if(!Number.isInteger(x)||x<min||x>max)throw Error('Durata non valida');return x;},
  extraConnStatus_:()=>({configured:true}),
  extraSession_:()=>cookies,
  extraCalendar_:(id,date,session)=>{assert.equal(id,'pro');assert.equal(date,day);assert.equal(session,cookies);return calendar();},
  extraProp_:(id,key)=>id+'_'+key,extraConfig_:()=>({origin:'https://propadelclub.wansport.com'}),
  PropertiesService:{getUserProperties:()=>({getProperty:k=>k==='pro_SPORT_ID'?'15':null})},
  extraFetch_:(id,path,session,opt)=>{
    requests.push({id,path,session,opt});
    return {getResponseCode:()=>quoteStatus,getContentText:()=>JSON.stringify(quotedBody)};
  }
});
for(const name of ['Gunners.gs','WansportQuotes.gs']){
  new vm.Script(fs.readFileSync('apps-script/'+name,'utf8'),{filename:name}).runInContext(ctx);
}
const run=script=>vm.runInContext(script,ctx);
let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
const example={club_id:'pro',court_id:'2',date:day,start:'17:30',duration:60};
const invoke=(x=example)=>run('getWansportQuote('+JSON.stringify(x)+')');
quotedBody={success:true,dati:{
  costoTotalePrenotazioneNF:52,costoTotalePrenotazione:'€ 52,00',
  startTime:'17:30',endTime:'18:30',currencyCode:'EUR'
}};
test('GET al solo endpoint modale, senza POST né addebiti',()=>{
 const r=invoke();assert.equal(r.total,52);assert.equal(r.price,'52,00 €');
 assert.equal(r.duration,60);assert.equal(requests.length,1);
 const req=requests[0];assert.equal(req.id,'pro');assert.equal(req.session,cookies);
 assert.equal(req.opt.method,'get');assert.equal(req.opt.payload,undefined);
 const url=new URL(req.path,'https://propadelclub.wansport.com');
 assert.equal(url.searchParams.get('task'),'prenotazioni.getPrenotazioneNuovaModal');
 assert.equal(url.searchParams.get('tslotId'),'17911');
 assert.equal(url.searchParams.get('sportId'),'15');
 assert.equal(url.searchParams.get('dataSelezionata'),day);
 assert.equal(url.searchParams.get('duration'),'');
});
test('La richiesta non conferma alcuna prenotazione',()=>{
 const path=requests[0].path;assert.doesNotMatch(path,/task=prenotazioni\.(?:create|save|confirm|book)/i);
});
test('Il calendario deve esporre il suo timeslot numerico',()=>{
 calendarWithId=false;const before=requests.length;
 assert.throws(()=>invoke(),/ID della fascia/);
 assert.equal(requests.length,before);calendarWithId=true;
});
test('Durate diverse da quella osservata non vengono quotate',()=>{
 assert.throws(()=>invoke({...example,duration:90}),/Durata/);
});
test('Giorno, club, campo e orario sono verificati prima della chiamata',()=>{
 for(const input of [
  {...example,club_id:'puntog'},{...example,court_id:'3'},
  {...example,start:'19:00'},{...example,date:'2026-11-11'}
 ])assert.throws(()=>invoke(input));
});
test('Preventivo discordante nell orario viene rifiutato',()=>{
 quotedBody={success:true,dati:{costoTotalePrenotazioneNF:52,startTime:'17:30',endTime:'19:00'}};
 assert.throws(()=>invoke(),/orario o una durata diversa/);
});
test('Prezzo mancante e risposta HTTP non valida vengono rifiutati',()=>{
 quotedBody={success:true,dati:{startTime:'17:30',endTime:'18:30',currencyCode:'EUR'}};
 assert.throws(()=>invoke(),/Prezzo totale/);
 quoteStatus=403;assert.throws(()=>invoke(),/403/);
 quoteStatus=200;
});
test('Prezzo decimalizzato dall API viene letto senza arrotondamenti arbitrari',()=>{
 quotedBody={success:true,dati:{costoTotalePrenotazione:'€ 64,50',startTime:'17:30',endTime:'18:30'}};
 const r=invoke();assert.equal(r.total,64.5);assert.equal(r.price,'64,50 €');
});
console.log('Preventivo Pro Padel: '+count+' test superati.');
