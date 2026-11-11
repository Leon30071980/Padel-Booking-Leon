/**
 * Padel Booking Leon — v1.20 (Google Apps Script + Google Sheets)
 * Web app personale: deployment Esegui come me / Accesso solo io.
 * Ricerca di sola lettura Wansport: Gunners verificato dall’utente; Pro/Punto G da validare.
 */
const PBL_VERSION = 'v1.20';
const PBL_TZ = 'Europe/Rome';
const PBL_CLUBS = Object.freeze([
  {id:'gunners', name:'Gunners Padel', platform:'Wansport', url:'https://gunnerspadel.wansport.com/start'},
  {id:'pro', name:'Pro Padel Club', platform:'Wansport', url:'https://propadelclub.wansport.com/start'},
  {id:'puntog', name:'Punto G Padel', platform:'Wansport', url:'https://puntogpadel.wansport.com/start'},
  {id:'hero', name:'Padel Hero Parma', platform:'Playtomic', url:'https://playtomic.com/clubs/padel-hero-parma'}
]);
const PBL_HEADERS = Object.freeze({
  Clubs:['id','name','platform','url','priority','enabled','rule_type','advance_value','release_time'],
  Requests:['id','match_date','match_time','duration','tolerance','mode','club_ids','status','created_at','updated_at'],
  Attempts:['id','request_id','club_id','state','open_at','checked_at','detail'],
  Events:['stamp','request_id','club_id','message']
});

function doGet(e){
  // Il ponte comunica SOLO con GitHub Pages e NON espone endpoint pubblici.
  // La Web App deve restare privata (solo il proprietario).
  if (e && e.parameter && e.parameter.bridge === '1') {
    const nonce = String(e.parameter.nonce || '');
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      return HtmlService.createHtmlOutput('Parametri ponte non validi.');
    }
    const t = HtmlService.createTemplateFromFile('Bridge');
    t.nonceJson = JSON.stringify(nonce);
    // Il documento ponte non contiene pulsanti: protegge il canale con
    // controlli di origine, nonce e lista esplicita delle funzioni ammesse.
    return t.evaluate().setTitle('Padel Booking Leon — Google Bridge')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const t = HtmlService.createTemplateFromFile('Index');
  t.version = PBL_VERSION;
  return t.evaluate().setTitle('Padel Booking Leon — ' + PBL_VERSION)
      .addMetaTag('viewport','width=device-width,initial-scale=1');
}
function include_(name){return HtmlService.createHtmlOutputFromFile(name).getContent();}

function withLock_(fn){
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(15000)) throw Error('Archivio occupato: riprovare.');
  try{return fn();}finally{lock.releaseLock();}
}
function spreadsheet_(){
  const id = PropertiesService.getScriptProperties().getProperty('PBL_SHEET_ID');
  if(!id) throw Error('Archivio non inizializzato. Eseguire setupApp dall’editor Apps Script.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name){
  const s = spreadsheet_().getSheetByName(name);
  if(!s) throw Error('Foglio mancante: ' + name);
  return s;
}
function records_(name){
  const rows=sheet_(name).getDataRange().getDisplayValues();
  const header=PBL_HEADERS[name];
  return rows.slice(1).filter(r=>r[0]).map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]||''])));
}
function append_(name, obj){
  const values=PBL_HEADERS[name].map(k=>obj[k] === null || obj[k] === undefined ? '' : String(obj[k]));
  // In Sheets un input esterno che inizia con =, +, - o @ potrebbe essere una formula.
  const safe=values.map(v=>/^[=+@\-]/.test(v)?'\''+v:v);
  sheet_(name).appendRow(safe);
}
function updateRow_(name, id, patch){
  const sheet=sheet_(name), values=sheet.getDataRange().getDisplayValues();
  const idx=values.findIndex((r,i)=>i>0 && r[0]===id);
  if(idx<0)throw Error('Elemento non trovato.');
  const row=Object.fromEntries(PBL_HEADERS[name].map((key,i)=>[key,values[idx][i]||'']));
  const updated={...row,...patch};
  sheet.getRange(idx+1,1,1,PBL_HEADERS[name].length).setValues([PBL_HEADERS[name].map(k=>String(updated[k]??''))]);
  return updated;
}
function now_(){return new Date().toISOString();}
function findClub_(id){const c=PBL_CLUBS.find(x=>x.id===id);if(!c)throw Error('Centro non valido.');return c;}
function integer_(value,min,max,name){
  const n=Number(value);
  if(!Number.isInteger(n) || n<min || n>max) throw Error(name+' non valido.');
  return n;
}
function dateCheck_(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Data non valida.');
  const d=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Data non valida.');
  return value;
}
function timeCheck_(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Ora non valida.');return value;}
function romeToday_(){return Utilities.formatDate(new Date(),PBL_TZ,'yyyy-MM-dd');}
/** Converte un istante locale di Roma in UTC. In ora ripetuta usa il primo istante. */
function romeToUtc_(day,hhmm){
  dateCheck_(day);timeCheck_(hhmm);
  const target=day+' '+hhmm, [h,m]=hhmm.split(':').map(Number);
  const nominal=Date.parse(day+'T00:00:00Z')+(h*60+m)*60000;
  const candidates=[1,2].map(offset=>new Date(nominal-offset*3600000))
    .filter(d=>Utilities.formatDate(d,PBL_TZ,'yyyy-MM-dd HH:mm')===target)
    .sort((a,b)=>a.getTime()-b.getTime());
  if(!candidates.length)throw Error('Orario inesistente per il cambio dell’ora legale: '+target);
  return candidates[0];
}
function openingFor_(club,matchDate,matchTime){
  if(club.rule_type==='unknown')return null;
  dateCheck_(matchDate);timeCheck_(matchTime);
  const amount=integer_(club.advance_value,1,1440,'Anticipo');
  if(club.rule_type==='calendar_days'){
    const ref=new Date(matchDate+'T00:00:00Z');
    ref.setUTCDate(ref.getUTCDate()-amount);
    return romeToUtc_(ref.toISOString().slice(0,10),timeCheck_(club.release_time)).toISOString();
  }
  if(club.rule_type==='rolling_hours')return new Date(romeToUtc_(matchDate,matchTime).getTime()-amount*3600000).toISOString();
  throw Error('Regola sconosciuta.');
}
function fullClubs_(){
  const rows=records_('Clubs');
  return PBL_CLUBS.map((c,i)=>{
    const r=rows.find(row=>row.id===c.id)||{};
    return {...c, priority:Number(r.priority)||i+1, enabled:r.enabled!=='false',
      rule_type:r.rule_type||'unknown',advance_value:r.advance_value?Number(r.advance_value):null,
      release_time:r.release_time||'00:01',
      connector:c.id==='gunners' ? gunnersConnectionStatus_() : (c.id==='pro'||c.id==='puntog') ? extraConnStatus_(c.id) : c.id==='hero' ? playtomicConnectionStatus_() : {ready:false,configured:false,booking_ready:false,reason:'Connettore non disponibile'}};
  }).sort((a,b)=>a.priority-b.priority);
}
function setupApp(){
  return withLock_(()=>{
    let ss, id=PropertiesService.getScriptProperties().getProperty('PBL_SHEET_ID');
    if(id)ss=SpreadsheetApp.openById(id);
    else {
      ss=SpreadsheetApp.create('Padel Booking Leon - dati privati');
      PropertiesService.getScriptProperties().setProperty('PBL_SHEET_ID',ss.getId());
    }
    for(const name of Object.keys(PBL_HEADERS)){
      const sheet=ss.getSheetByName(name)||ss.insertSheet(name);
      if(sheet.getLastRow()===0){
        sheet.appendRow(PBL_HEADERS[name]);
        sheet.setFrozenRows(1);
        sheet.getRange(1,1,sheet.getMaxRows(),PBL_HEADERS[name].length).setNumberFormat('@');
        sheet.getRange(1,1,1,PBL_HEADERS[name].length).setFontWeight('bold').setBackground('#234b38').setFontColor('#ffffff');
      }
    }
    const defaultSheet=ss.getSheetByName('Foglio1')||ss.getSheetByName('Sheet1');
    if(defaultSheet && ss.getSheets().length>4)ss.deleteSheet(defaultSheet);
    const existing=records_('Clubs');
    PBL_CLUBS.forEach((c,i)=>{if(!existing.some(r=>r.id===c.id))append_('Clubs',{...c,priority:i+1,enabled:'true',rule_type:'unknown',advance_value:'',release_time:'00:01'});});
    return {version:PBL_VERSION,spreadsheetUrl:ss.getUrl(),message:'Archivio pronto. Nessuna prenotazione reale abilitata.'};
  });
}
function getDashboard(){
  const clubs=fullClubs_(), atts=records_('Attempts');
  const jobs=records_('Requests').slice(-100).reverse().map(job=>serializeRequest_(job,clubs,atts));
  return {version:PBL_VERSION,clubs,jobs,schedulerActive:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='schedulerTick'),
    storage:'Google Sheets privato',liveReady:clubs.some(c=>c.connector.ready)};
}
function saveClubRule(payload){
  return withLock_(()=>{
    if(!payload||typeof payload!=='object')throw Error('Parametri assenti.');
    findClub_(payload.id);
    if(!['unknown','calendar_days','rolling_hours'].includes(payload.rule_type))throw Error('Tipo regola non valido.');
    const patch={priority:integer_(payload.priority,1,50,'Priorità'),enabled:payload.enabled===true?'true':'false',
      rule_type:payload.rule_type,advance_value:'',release_time:timeCheck_(payload.release_time||'00:01')};
    if(payload.rule_type!=='unknown')patch.advance_value=integer_(payload.advance_value,1,1440,'Anticipo');
    updateRow_('Clubs',payload.id,patch);
    recalculate_(payload.id);
    return {ok:true};
  });
}
function getOpeningPreview(matchDate,matchTime){
  dateCheck_(matchDate);timeCheck_(matchTime);
  return fullClubs_().map(c=>({club_id:c.id,opening_at:openingFor_(c,matchDate,matchTime)}));
}
function normalizeRequest_(payload){
  if(!payload||typeof payload!=='object')throw Error('Richiesta mancante.');
  const date=dateCheck_(payload.date), time=timeCheck_(payload.time);
  if(date<romeToday_())throw Error('Selezionare una data futura o odierna.');
  const duration=integer_(payload.duration,60,120,'Durata');
  if(![60,90,120].includes(duration))throw Error('Durata non prevista.');
  const tolerance=integer_(payload.tolerance,0,60,'Tolleranza');
  if(![0,15,30,60].includes(tolerance))throw Error('Tolleranza non prevista.');
  if(!Array.isArray(payload.clubs)||!payload.clubs.length||payload.clubs.length>4)throw Error('Selezionare almeno un centro.');
  const clubs=[...new Set(payload.clubs)];
  clubs.forEach(id=>findClub_(id));
  const mode=payload.mode||'notify';
  if(!['notify','auto'].includes(mode))throw Error('Modalità non valida.');
  return {date,time,duration,tolerance,clubs,mode};
}
function searchAvailability(payload){
  const r=normalizeRequest_(payload);
  // Solo lettura: nessuna richiesta crea o modifica prenotazioni, neppure col trigger.
  const results=r.clubs.map(id=>searchClubAvailability_(id,r));
  return {at:now_(),results};
}
function createRequest(payload){
  const r=normalizeRequest_(payload);
  if(r.clubs.includes('hero'))throw Error('Padel Hero richiede Chrome aperto: i controlli programmati dal cloud non sono disponibili.');
  return withLock_(()=>{
    const jobs=records_('Requests');
    if(jobs.filter(j=>j.status==='pending').length>=50)throw Error('Massimo 50 richieste attive.');
    const existing=jobs.find(j=>j.status==='pending'&&j.match_date===r.date&&j.match_time===r.time&&
      j.duration===String(r.duration)&&j.club_ids===JSON.stringify(r.clubs));
    if(existing)throw Error('Esiste già una richiesta equivalente per questa partita.');
    const id=Utilities.getUuid(), stamp=now_(), clubs=fullClubs_();
    append_('Requests',{id,match_date:r.date,match_time:r.time,duration:r.duration,tolerance:r.tolerance,
      mode:r.mode,club_ids:JSON.stringify(r.clubs),status:'pending',created_at:stamp,updated_at:stamp});
    r.clubs.forEach(clubId=>{
      const club=clubs.find(c=>c.id===clubId);
      const open=openingFor_(club,r.date,r.time);
      append_('Attempts',{id:Utilities.getUuid(),request_id:id,club_id:clubId,
        state:open?'scheduled':'waiting_rule',open_at:open||'',checked_at:'',
        detail:open?'In attesa del controllo di sola lettura all’apertura teorica.':'Regola di apertura non configurata.'});
    });
    append_('Events',{stamp,request_id:id,club_id:'',message:'Richiesta registrata: verrà effettuato un controllo di sola lettura all’apertura teorica, se il trigger è attivo.'});
    return {id,ok:true};
  });
}
function serializeRequest_(r,clubs,attemptRows){
  const atts=(attemptRows||records_('Attempts')).filter(a=>a.request_id===r.id);
  return {id:r.id,match_date:r.match_date,match_time:r.match_time,duration:Number(r.duration),
    tolerance:Number(r.tolerance),mode:r.mode,status:r.status,created_at:r.created_at,
    clubs:atts.map(a=>({club_id:a.club_id,name:clubs.find(c=>c.id===a.club_id)?.name||a.club_id,
      state:a.state,open_at:a.open_at||null,next_at:a.state==='scheduled'?(a.open_at||null):null,
      checked_at:a.checked_at||null,detail:a.detail||'',attempts:0}))};
}
function getRequestDetail(id){
  const clubs=fullClubs_(), r=records_('Requests').find(x=>x.id===id);
  if(!r)throw Error('Richiesta non trovata.');
  const j=serializeRequest_(r,clubs);
  j.events=records_('Events').filter(x=>x.request_id===id).reverse().slice(0,40);
  return j;
}
function cancelRequest(id){
  return withLock_(()=>{
    const job=records_('Requests').find(r=>r.id===id);
    if(!job)throw Error('Richiesta non trovata.');
    if(job.status!=='pending')throw Error('Questa richiesta non può essere annullata.');
    updateRow_('Requests',id,{status:'cancelled',updated_at:now_()});
    records_('Attempts').filter(a=>a.request_id===id).forEach(a=>updateRow_('Attempts',a.id,{state:'cancelled',detail:'Annullato dall’utente.'}));
    append_('Events',{stamp:now_(),request_id:id,club_id:'',message:'Richiesta annullata.'});
    return {ok:true};
  });
}
function recalculate_(clubId){
  const club=fullClubs_().find(c=>c.id===clubId);
  const jobs=records_('Requests').filter(r=>r.status==='pending');
  for(const a of records_('Attempts').filter(a=>a.club_id===clubId&&['scheduled','waiting_rule','needs_connector'].includes(a.state))){
    const job=jobs.find(j=>j.id===a.request_id);if(!job)continue;
    const open=openingFor_(club,job.match_date,job.match_time);
    updateRow_('Attempts',a.id,{state:open?'scheduled':'waiting_rule',open_at:open||'',checked_at:'',
      detail:open?'Apertura ricalcolata; controllo di sola lettura previsto.':'Regola da configurare.'});
  }
}
/** Unifica la ricerca di sola lettura senza mai eseguire operazioni di prenotazione. */
function searchClubAvailability_(id,request){
  if(id==='gunners')return searchGunners_(request);
  if(id==='pro'||id==='puntog')return searchExtraWansport_(id,request);
  if(id==='hero')return searchPlaytomic_(request);
  return {club_id:id,status:'not_configured',slots:[],
    reason:'Connettore non disponibile.'};
}
/**
 * v1.20: controllo una tantum ALL'APERTURA TEORICA, non monitoraggio continuo.
 * Trigger a minuto non preciso; nessun addebito o prenotazione.
 * Esegue al massimo 3 ricerche live per tick per rispettare limiti Apps Script.
 */
function schedulerTick(){
  return withLock_(()=>{
    const now=now_(), jobs=records_('Requests').filter(r=>r.status==='pending');
    let processed=0,found=0;
    const attempts=records_('Attempts').filter(a=>a.state==='scheduled'&&a.open_at&&a.open_at<=now&&
      jobs.some(j=>j.id===a.request_id)).slice(0,3);
    for(const a of attempts){
      const job=jobs.find(j=>j.id===a.request_id);
      if(!job)continue;
      let result;
      try{result=searchClubAvailability_(a.club_id,{date:job.match_date,time:job.match_time,
        duration:Number(job.duration),tolerance:Number(job.tolerance)});}
      catch(e){result={club_id:a.club_id,status:'error',slots:[],reason:'Errore tecnico del controllo calendario.'};}
      let state,detail;
      if(result.status==='available'){
        state='found';found++;
        detail=result.slots.slice(0,5).map(x=>x.court+' '+x.start+'–'+x.end).join(' | ');
      }else if(result.status==='no_slots'){
        state='checked_no_slots';detail='Nessun campo compatibile al controllo di apertura.';
      }else if(result.status==='outside_window'){
        state='checked_outside_window';detail='Data non ancora prenotabile secondo il calendario live.';
      }else{
        state='needs_connector';detail=(result.reason||'Connettore non disponibile').slice(0,220);
      }
      updateRow_('Attempts',a.id,{state,checked_at:now,detail});
      append_('Events',{stamp:now,request_id:job.id,club_id:a.club_id,
        message:state==='found'?'Trovati slot compatibili: '+detail:state==='checked_no_slots'?detail:
          'Controllo non conclusivo: '+detail});
      processed++;
    }
    return {processed,found,at:now};
  });
}
function installScheduler(){
  const already=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='schedulerTick');
  if(!already) ScriptApp.newTrigger('schedulerTick').timeBased().everyMinutes(1).create();
  return {installed:true,warning:'Controllo una tantum su calendario all’apertura teorica. Non prenota e non garantisce il minuto esatto.'};
}
function removeScheduler(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='schedulerTick').forEach(t=>ScriptApp.deleteTrigger(t));
  return {installed:false};
}
/** Semplice diagnosi pubblica: NON è una ricerca disponibilità, NON fa login. */
function checkPublicPortal(id){
  const club=findClub_(id);
  try {
    const response=UrlFetchApp.fetch(club.url,{method:'get',followRedirects:true,
      muteHttpExceptions:true,timeoutSeconds:15});
    const status=response.getResponseCode();
    return {club_id:id,http_status:status,reachable:status>=200&&status<400,
      note:'Solo pagina pubblica. Il calendario richiede integrazione autenticata.'};
  } catch (err){
    return {club_id:id,http_status:null,reachable:false,note:'Connessione alla pagina pubblica non riuscita: '+String(err.message).slice(0,160)};
  }
}
