/* Simulazione del connettore Gunners: nessun accesso al sito e nessuna credenziale reale. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
let n=0;
function test(name,callback){callback();console.log('✓ '+name);n++;}
const P='abcdef0123456789abcdef0123456789';
let requestLog=[],expectedLogin=true,invalidToken=false;
const properties=new Map();
const response=(status,body,headers={})=>({getResponseCode:()=>status,getContentText:()=>body,getAllHeaders:()=>headers});
const data={success:true,dati:{sedi:[{risorse:[
 {id:1,nome:'Campo 1',isFuoriFinestraTemporale:false,tslots:[],listaPrenotazioni:[]},
 {id:2,nome:'Campo 2',isFuoriFinestraTemporale:false,tslots:[],listaPrenotazioni:[]}
]}]}};
const slot=(hour,id=1,published=true)=>({resource_id:id,starttime:hour,ts_start:'2026-11-23 '+hour+':00',published,
  full_tslot:false,is_inizio_prenotazioni_disabilitato:false,crea_prenotazioni_in_ts_inizio_disabilitato:false});
for(let t=17*60;t<24*60;t+=30){
 const h=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
 data.dati.sedi[0].risorse[0].tslots.push(slot(h,1,t!==23*60+30));
 data.dati.sedi[0].risorse[1].tslots.push(slot(h,2,t!==23*60+30));
}
data.dati.sedi[0].risorse[0].listaPrenotazioni=[{startdate:'2026-11-23',starttime:'19:00:00',endtime:'20:30:00',idSport:27},
 {startdate:'2026-11-23',starttime:'21:00:00',endtime:'22:30:00',idSport:15}];
data.dati.sedi[0].risorse[1].listaPrenotazioni=[{startdate:'2026-11-23',starttime:'19:30:00',endtime:'21:00:00',idSport:15}];
const mockFetch=(url,options)=>{
 requestLog.push({url,method:options.method,payload:options.payload,headers:options.headers});
 if(url==='https://gunnerspadel.wansport.com/'&&options.method==='get')return response(302,'',{'Set-Cookie':'a=anon; Path=/','Location':'/it-it/'});
 if(url==='https://gunnerspadel.wansport.com/it-it/')return response(200,
  `<form action="/index.php" method="post"><input name='username' value=''><input value="" name="password" type="password"><input type="hidden" name="option" value="com_users"><input name="task" value="user.login"><input name="return" value="abc"><input name="${invalidToken?'wrong':'abcdef0123456789abcdef0123456789'}" value="${invalidToken?'0':'1'}"></form>`,{'Set-Cookie':'b=csrf; Path=/'});
 if(url==='https://gunnerspadel.wansport.com/index.php'&&options.method==='post'){
   if(!options.headers.Cookie?.includes('a=anon')||!options.headers.Cookie?.includes('b=csrf'))return response(403,'');
   if(!options.payload.includes('option=com_users&task=user.login')&&(!options.payload.includes('option=com_users')||!options.payload.includes('task=user.login')))return response(403,'');
   return expectedLogin?response(303,'',{'Set-Cookie':'sid=loggedin; Path=/','Location':'/start'}):response(403,'');
 }
 if(url==='https://gunnerspadel.wansport.com/start')return response(200,'<html>dashboard</html>');
 if(url.includes('getPannelloPrenotazioni')){
  if(!options.headers.Cookie?.includes('sid=loggedin'))return response(401,'unauthorized');
  return response(200,JSON.stringify(data),{'Content-Type':'application/json'});
 }
 throw Error('Unexpected mock request '+url);
};
const props=()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),
 setProperties:kv=>Object.entries(kv).forEach(([k,v])=>properties.set(k,v)),deleteProperty:k=>properties.delete(k)});
const ctx=vm.createContext({console,Date,Object,Array,Number,String,Map,RegExp,Error,Math,Set,JSON,
 PropertiesService:{getUserProperties:props},UrlFetchApp:{fetch:mockFetch},
 dateCheck_:d=>d,romeToday_:()=> '2026-11-23',now_:()=> '2026-11-10T09:00:00.000Z'});
new vm.Script(fs.readFileSync(path.join(__dirname,'../apps-script/Gunners.gs'),'utf8')).runInContext(ctx);
const run=s=>vm.runInContext(s,ctx);

test('Credenziali assenti: risposta senza dati fittizi',()=>{
 const r=run(`searchGunners_({date:'2026-11-23',time:'20:00',duration:90,tolerance:30})`);
 assert.equal(r.status,'auth_required');assert.equal(requestLog.length,0);
});
test('Credenziali salvate solo nelle User Properties',()=>{
 const response=run(`saveGunnersCredentials({username:'me@example.org',password:'secret@value'})`);
 assert.equal(response.ok,true);assert.ok(!JSON.stringify(response).includes('secret'));
 assert.equal(properties.get('PBL_GUNNERS_PASSWORD'),'secret@value');
});
test('Login iniziale: CSRF + cookie GET/POST/303/GET fino al JSON',()=>{
 const r=run(`searchGunners_({date:'2026-11-23',time:'18:00',duration:90,tolerance:0})`);
 assert.equal(r.status,'available');assert.ok(!JSON.stringify(r).includes('secret'));
 assert.equal(r.slots.length,1);assert.equal(r.slots[0].court,'Campo 2');
});

test('Allenamenti occupano il campo: nessun falso positivo',()=>{
 const r=run(`searchGunners_({date:'2026-11-23',time:'20:00',duration:90,tolerance:0})`);
 assert.equal(r.status,'no_slots');assert.equal(r.slots.length,0);
});
test('Slot 21:30-23:00 sul Campo 1 non è valido se sovrapposto a Padel',()=>{
 const r=run(`searchGunners_({date:'2026-11-23',time:'21:30',duration:90,tolerance:0})`);
 assert.equal(r.status,'available');assert.equal(r.slots.length,1);assert.equal(r.slots[0].court,'Campo 2');
});
test('Un intervallo non pubblicato rende la durata non prenotabile',()=>{
 const r=run(`searchGunners_({date:'2026-11-23',time:'22:30',duration:90,tolerance:0})`);
 assert.equal(r.status,'no_slots');
});
test('Nessun cookie inoltrato ad altri host',()=>{
 assert.throws(()=>run(`gunnersAbsoluteUrl_('https://evil.example/path')`),/non consentito/);
 assert.throws(()=>run(`gunnersAbsoluteUrl_('http://gunnerspadel.wansport.com/')`),/non consentito/);
});
test('Errore di login non esposto con segreti',()=>{
 expectedLogin=false;const r=run(`searchGunners_({date:'2026-11-23',time:'20:00',duration:90,tolerance:30})`);
 assert.equal(r.status,'error');assert.ok(!JSON.stringify(r).includes('secret'));expectedLogin=true;
});
test('Token CSRF non trovato: il codice rifiuta invio form',()=>{
 invalidToken=true;const before=requestLog.filter(r=>r.method==='post').length;
 const r=run(`searchGunners_({date:'2026-11-23',time:'20:00',duration:90,tolerance:30})`);
 assert.equal(r.status,'error');assert.equal(requestLog.filter(r=>r.method==='post').length,before);invalidToken=false;
});
test('Rimozione completa delle credenziali',()=>{
 run('deleteGunnersCredentials()');assert.equal(properties.has('PBL_GUNNERS_PASSWORD'),false);
});
console.log(`\n${n} test del connettore superati.`);
