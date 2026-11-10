/* Test del connettore multi-club v1.3: richieste simulate, nessun accesso live. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const props=new Map(),calls=[];
let n=0, failLogin=false;
function test(name,fn){fn();console.log('✓ '+name);n++;}
const response=(code,body='',headers={})=>({getResponseCode:()=>code,getContentText:()=>body,getAllHeaders:()=>headers});
const fixture=(id,day)=>({success:true,dati:{sportId:id==='pro'?42:15,sedi:[{risorse:[
  {id:3,nome:id==='pro'?'Campo Padel Coperto N.4 PRO GREEN':'Campo Blu',isFuoriFinestraTemporale:false,
    tslots:['18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'].map(starttime=>({starttime,ts_start:day+' '+starttime+':00',published:true,full_tslot:false})),
    listaPrenotazioni:[{startdate:day,starttime:'19:30:00',endtime:'21:00:00'}]}
]}]}});
const loginForm='<form action="/index.php" method="post"><input name="username"><input name="password"><input type="hidden" name="option" value="com_users"><input name="task" value="user.login"><input name="return" value="a"><input type="hidden" name="abcdef0123456789abcdef0123456789" value="1"></form>';
const mockFetch=(url,opts)=>{
  calls.push({url,method:opts.method,headers:opts.headers,payload:opts.payload});
  const id=url.includes('propadelclub')?'pro':url.includes('puntogpadel')?'puntog':null;
  if(!id)throw Error('Called unknown domain');
  const origin=id==='pro'?'https://propadelclub.wansport.com':'https://puntogpadel.wansport.com';
  if(url===origin+'/'&&opts.method==='get')return response(200,loginForm,{'Set-Cookie':'anon=s1; Path=/'});
  if(url===origin+'/index.php'&&opts.method==='post'){
    if(failLogin)return response(403,'invalid');
    assert.ok(opts.headers.Cookie.includes('anon=s1'));
    assert.ok(opts.payload.includes('task=user.login'));
    return response(303,'',{'Set-Cookie':'sid=ok; Path=/','Location':'/start'});
  }
  if(url===origin+'/start'&&opts.method==='get')return response(200,'dashboard');
  if(url.includes('getPannelloPrenotazioni')){
    assert.ok(opts.headers.Cookie.includes('sid=ok'));
    const sport=Number(new URL(url).searchParams.get('filtroSport'));
    const day=new URL(url).searchParams.get('filtroData');
    return response(200,JSON.stringify({...fixture(id,day),dati:{...fixture(id,day).dati,sportId:sport}}));
  }
  throw Error('Unexpected URL '+url);
};
const userProps=()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),
  setProperties:obj=>Object.entries(obj).forEach(([k,v])=>props.set(k,v)),deleteProperty:k=>props.delete(k)});
const ctx=vm.createContext({console,Date,JSON,Map,Set,URL,Error,RegExp,Array,Object,String,Number,Math,
  PropertiesService:{getUserProperties:userProps},UrlFetchApp:{fetch:mockFetch},
  dateCheck_:d=>d,romeToday_:()=> '2026-11-23',now_:()=> '2026-11-10T10:00:00.000Z'});
for(const name of ['Gunners.gs','WansportExtra.gs'])new vm.Script(fs.readFileSync(path.join(__dirname,'../apps-script',name),'utf8'),{filename:name}).runInContext(ctx);
const run=s=>vm.runInContext(s,ctx);
test('Credenziali mancanti: niente richiesta di rete',()=>{
  const r=run(`searchExtraWansport_('pro',{date:'2026-11-23',time:'18:00',duration:90,tolerance:0})`);
  assert.equal(r.status,'auth_required');assert.equal(calls.length,0);
});
test('Configurazione credenziali isolata per centro',()=>{
  run(`saveWansportCredentials({clubId:'pro',username:'pro@example.org',password:'proSecret',sportId:42})`);
  run(`saveWansportCredentials({clubId:'puntog',username:'punto@example.org',password:'puntoSecret',sportId:15})`);
  assert.notEqual(props.get('PBL_WANSPORT_PRO_PASSWORD'),props.get('PBL_WANSPORT_PUNTOG_PASSWORD'));
});
test('Ricerca reale simulata da Pro senza falso positivo',()=>{
  const r=run(`searchExtraWansport_('pro',{date:'2026-11-23',time:'18:00',duration:90,tolerance:0})`);
  assert.equal(r.status,'available');assert.equal(r.slots.length,1);assert.equal(r.slots[0].club_id,'pro');
  assert.ok(calls.some(c=>c.url.includes('filtroSport=42')));assert.ok(!JSON.stringify(r).includes('proSecret'));
});
test('PRO GREEN e Coperto riconosciuti dal nome del campo',()=>{
  const r=run(`searchExtraWansport_('pro',{date:'2026-11-23',time:'18:00',duration:90,tolerance:0})`);
  assert.equal(r.status,'available');
  assert.equal(r.slots[0].location,'Vigatto');
  assert.equal(r.slots[0].cover,'indoor');
  assert.equal(r.slots[0].cover_source,'nome campo');
});
test('PRO PARMA e Open riconosciuti dal nome senza inventare il prezzo',()=>{
  const resource=fixture('pro','2026-11-23').dati.sedi[0].risorse[0];
  resource.nome='Campo Centrale Open N.1 - PRO PARMA';
  const normalized=run('gunnersSlots_') // funzione esistente, nessuna richiesta HTTP
  const slots=normalized({dati:{sedi:[{nome:'',risorse:[resource]}]}},'2026-11-23','18:00',90,0);
  assert.equal(slots.length,1);
  assert.equal(slots[0].cover,'outdoor');
  assert.equal(slots[0].price,'');
});
test('Sovrapposizioni prenotate escluse per Punto G',()=>{
  const r=run(`searchExtraWansport_('puntog',{date:'2026-11-23',time:'20:00',duration:90,tolerance:0})`);
  assert.equal(r.status,'no_slots');assert.equal(r.slots.length,0);
});
test('Domini estranei e protocollo HTTP respinti',()=>{
  assert.throws(()=>run(`extraAbsolute_('pro','https://evil.example/redirect')`),/non consentito/);
  assert.throws(()=>run(`extraAbsolute_('pro','http://propadelclub.wansport.com')`),/non consentito/);
});
test('Login fallito: nessuna disponibilità inventata e password non esposta',()=>{
  failLogin=true;const r=run(`searchExtraWansport_('pro',{date:'2026-11-23',time:'18:00',duration:90,tolerance:0})`);
  assert.equal(r.status,'error');assert.equal(r.slots.length,0);assert.ok(!JSON.stringify(r).includes('proSecret'));failLogin=false;
});
test('Test collegamento non prenota e non rivela credenziali',()=>{
  const r=run(`testWansportConnection('pro')`);assert.ok(r.ok);
  assert.ok(calls.every(c=>!c.url.includes('task=prenotazioni.prenota')));
});
test('Eliminazione credenziali non tocca altri centri',()=>{
  run(`deleteWansportCredentials('pro')`);
  assert.equal(props.has('PBL_WANSPORT_PRO_PASSWORD'),false);
  assert.equal(props.get('PBL_WANSPORT_PUNTOG_PASSWORD'),'puntoSecret');
});
console.log(`\n${n} test aggiuntivi superati.`);
