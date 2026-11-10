/* Test isolati di Padel Booking Leon v1.3: Google Apps Script simulato. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let passed=0;
function test(name,fn){fn();console.log('✓ '+name);passed++;}
class Sheet {
  constructor(name){this.name=name;this.rows=[];}
  getLastRow(){return this.rows.length;}
  appendRow(row){this.rows.push(row.map(String));return this;}
  setFrozenRows(){return this;}
  getMaxRows(){return 1000;}
  getDataRange(){return {getDisplayValues:()=>this.rows.map(r=>r.slice())};}
  getRange(row,col,numRows){return {
    setNumberFormat:()=>this,
    setFontWeight:()=>({setBackground:()=>({setFontColor:()=>this})}),
    setValues:rows=>{rows.forEach((values,i)=>this.rows[row-1+i]=values.map(String));return this;}
  };}
}
class SS {
  constructor(){this.sheets={};this.id='private-sheet-id';}
  getId(){return this.id;}
  getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id+'/edit';}
  getSheetByName(name){return this.sheets[name]||null;}
  insertSheet(name){return this.sheets[name]=new Sheet(name);}
  getSheets(){return Object.values(this.sheets);}
  deleteSheet(sheet){delete this.sheets[sheet.name];}
}
const sheets=new Map();let nextId=0;const properties=new Map(),triggers=[];
function romanFormat(date,format){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  if(format==='yyyy-MM-dd')return `${p.year}-${p.month}-${p.day}`;
  if(format==='yyyy-MM-dd HH:mm')return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  throw Error('Unexpected format '+format);
}
const context=vm.createContext({
  console,Date,JSON,Math,Number,String,Object,Array,Set,Error,RegExp,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)}),getUserProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),setProperties:obj=>Object.entries(obj).forEach(([k,v])=>properties.set(k,v)),deleteProperty:k=>properties.delete(k)})},
  SpreadsheetApp:{create:()=>{const s=new SS();s.id='sheet-'+(++nextId);sheets.set(s.id,s);return s;},openById:id=>{const s=sheets.get(id);if(!s)throw Error('Sheet missing');return s;}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>true})},
  Utilities:{formatDate:(date,timezone,format)=>romanFormat(date,format),getUuid:()=>`test-id-${++nextId}`},
  ScriptApp:{getProjectTriggers:()=>triggers.slice(),newTrigger:name=>({timeBased:()=>({everyMinutes:minutes=>({create:()=>triggers.push({getHandlerFunction:()=>name,minutes})})})}),deleteTrigger:trigger=>triggers.splice(triggers.indexOf(trigger),1)},
  UrlFetchApp:{fetch:(url,options)=>({getResponseCode:()=>url.includes('wansport')?200:403})},
});
const code=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
new vm.Script(code,{filename:'Code.gs'}).runInContext(context);
new vm.Script(fs.readFileSync(path.join(__dirname,'../apps-script/Gunners.gs'),'utf8'),{filename:'Gunners.gs'}).runInContext(context);
new vm.Script(fs.readFileSync(path.join(__dirname,'../apps-script/WansportExtra.gs'),'utf8'),{filename:'WansportExtra.gs'}).runInContext(context);
const run=s=>vm.runInContext(s,context);

test('Google Sheets creato e 4 club senza regole presunte',()=>{
  const setup=run('setupApp()');assert.match(setup.spreadsheetUrl,/docs.google.com/);
  const dashboard=run('getDashboard()');assert.equal(dashboard.version,'v1.5');assert.equal(dashboard.clubs.length,4);
  assert.ok(dashboard.clubs.every(c=>!c.connector.ready&&c.rule_type==='unknown'));
});
test('Ricerca reale non simulata',()=>{
  const result=run(`searchAvailability({date:'2099-11-17',time:'20:00',duration:90,tolerance:30,clubs:['gunners','hero']})`);
  assert.equal(result.results.length,2);assert.equal(result.results[0].status,'auth_required');assert.equal(result.results[1].status,'not_configured');
  assert.ok(result.results.every(r=>r.slots.length===0));
});
test('Finestra a giorni di calendario Europe/Rome',()=>{
  run(`saveClubRule({id:'gunners',priority:1,enabled:true,rule_type:'calendar_days',advance_value:7,release_time:'00:01'})`);
  assert.equal(run(`getOpeningPreview('2026-11-17','20:00').find(c=>c.club_id==='gunners').opening_at`),'2026-11-09T23:01:00.000Z');
});
test('Cambio ora legale calcolato senza spostamento del giorno',()=>{
  assert.equal(run(`getOpeningPreview('2027-04-02','20:00').find(c=>c.club_id==='gunners').opening_at`),'2027-03-25T23:01:00.000Z');
});
test('Finestra mobile in ore è durata reale',()=>{
  run(`saveClubRule({id:'pro',priority:2,enabled:true,rule_type:'rolling_hours',advance_value:168,release_time:'00:01'})`);
  assert.equal(run(`getOpeningPreview('2026-11-17','20:00').find(c=>c.club_id==='pro').opening_at`),'2026-11-10T19:00:00.000Z');
});
test('Richiesta salvata, duplicati bloccati',()=>{
  const req=`{date:'2099-11-17',time:'20:00',duration:90,tolerance:30,mode:'notify',clubs:['gunners','pro','hero']}`;
  const created=run(`createRequest(${req})`);assert.ok(created.ok);
  assert.equal(run('getDashboard()').jobs.length,1);
  assert.throws(()=>run(`createRequest(${req})`),/Esiste già/);
});
test('Trigger idempotente e disattivabile',()=>{
  run('installScheduler()');run('installScheduler()');assert.equal(triggers.length,1);run('removeScheduler()');assert.equal(triggers.length,0);
});
test('Scheduler non esegue prenotazioni e segnala connettore assente',()=>{
  const sheet=sheets.get(properties.get('PBL_SHEET_ID')).getSheetByName('Attempts');
  sheet.rows[1][4]='2026-01-01T00:00:00.000Z';
  const tick=run('schedulerTick()');assert.equal(tick.processed,1);
  const j=run('getDashboard().jobs[0]');assert.equal(j.clubs[0].state,'needs_connector');
  assert.ok(!j.clubs.some(c=>c.state==='booked'));
});
test('Scheduler live registra risultati reali invece di dichiarare una prenotazione',()=>{
  const req=`{date:'2099-11-18',time:'20:00',duration:90,tolerance:30,mode:'notify',clubs:['gunners']}`;
  const created=run(`createRequest(${req})`);
  const sheet=sheets.get(properties.get('PBL_SHEET_ID')).getSheetByName('Attempts');
  const row=sheet.rows.find(r=>r[1]===created.id);
  row[4]='2026-01-01T00:00:00.000Z';
  run(`searchClubAvailability_ = function(id) {return {club_id:id,status:'available',slots:[{court:'Campo 2',start:'19:30',end:'21:00'}]}}`);
  const r=run('schedulerTick()');
  assert.equal(r.found,1);
  const detail=run(`getRequestDetail('${created.id}')`);
  assert.equal(detail.clubs[0].state,'found');
  assert.match(detail.clubs[0].detail,/Campo 2/);
  assert.equal(run('schedulerTick().processed'),0); // Non duplica il controllo.
  assert.ok(!JSON.stringify(detail).includes('booked'));
});
test('Annullamento mantiene storico',()=>{
  const id=run('getDashboard().jobs[0].id');
  assert.ok(context.cancelRequest(id).ok);assert.equal(run('getDashboard().jobs[0].status'),'cancelled');
});
test('Sonda pagina pubblica su URL conosciuto, non calendario',()=>{
  const s=run(`checkPublicPortal('gunners')`);assert.equal(s.http_status,200);assert.match(s.note,/pubblica/);
  assert.throws(()=>run(`checkPublicPortal('https://myserver.example')`),/Centro non valido/);
});
console.log(`\n${passed} test superati.`);
