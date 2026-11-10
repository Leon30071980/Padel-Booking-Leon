/**
 * Padel Booking Leon v1.11 — preventivo Wansport PRO, su richiesta esplicita.
 * Unica chiamata GET al modale di scelta prenotazione: nessun POST di prenotazione/pagamento.
 * Supporto 60 minuti iniziale: "duration=" lasciato vuoto, come osservato dall'utente.
 * Il prezzo è legato a sessione, profilo/listino, campo, data e orario.
 */
function pblQuoteNumber_(v){
  if(typeof v==='number')return Number.isFinite(v)&&v>=0&&v<=5000?v:NaN;
  const raw=String(v??'').replace(/[€\s]/g,'').trim();
  if(!raw)return NaN;
  let normalized;
  if(/^\d{1,4}(?:\.\d{3})*,\d{1,2}$/.test(raw))normalized=raw.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,4}(?:\.\d{1,2})?$/.test(raw))normalized=raw;
  else if(/^\d{1,4},\d{1,2}$/.test(raw))normalized=raw.replace(',','.');
  else return NaN;
  const num=Number(normalized);
  return Number.isFinite(num)&&num>=0&&num<=5000?num:NaN;
}
function pblQuoteClock_(value){
  const match=String(value||'').match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match?match[1]+':'+match[2]:'';
}
function getWansportQuote(input){
  if(!input||typeof input!=='object')throw Error('Dati preventivo mancanti.');
  // L'endpoint è stato osservato solo su Pro Padel. Nessuna ipotesi per gli altri club.
  if(input.club_id!=='pro')throw Error('Preventivo al momento sperimentale solo su Pro Padel.');
  const day=dateCheck_(input.date);
  const start=timeCheck_(input.start);
  const duration=integer_(input.duration,60,60,'Durata');
  const courtId=String(input.court_id||'');
  if(!/^[1-9]\d{0,11}$/.test(courtId))throw Error('Campo non valido.');
  if(!extraConnStatus_('pro').configured)throw Error('Credenziali Pro Padel non configurate.');
  const cookies=extraSession_('pro');
  const calendar=extraCalendar_('pro',day,cookies);
  const matches=gunnersSlots_(calendar,day,start,duration,0).filter(s=>
    s.court_id===courtId&&s.start===start);
  if(matches.length!==1)throw Error('Lo slot non risulta più disponibile nel calendario. Rifare la ricerca.');
  const slot=matches[0];
  const tslotId=pblTslotId_({tslotId:slot.tslot_id});
  if(!tslotId)throw Error('Il calendario Wansport non espone l’ID della fascia oraria (tslotId): occorre verificarne la struttura prima di ottenere il preventivo.');
  const cfg=extraConfig_('pro');
  const sportId=Number(PropertiesService.getUserProperties().getProperty(extraProp_('pro','SPORT_ID'))||15);
  const request='/index.php?option=com_wansport&task=prenotazioni.getPrenotazioneNuovaModal'
    +'&tslotId='+encodeURIComponent(tslotId)
    +'&sportId='+encodeURIComponent(sportId)
    +'&dataSelezionata='+encodeURIComponent(day)
    +'&duration=&eventOrganizationUUID=&format=raw'
    +'&rand='+encodeURIComponent(Math.random().toFixed(9))
    +'&isPrenotazioneStart=1';
  const response=extraFetch_('pro',request,cookies,{method:'get',headers:{
    Accept:'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With':'XMLHttpRequest',Referer:cfg.origin+'/start'}});
  const status=response.getResponseCode();
  if(status!==200)throw Error('Wansport ha rifiutato il preventivo (HTTP '+status+').');
  let parsed;
  try{parsed=JSON.parse(response.getContentText());}
  catch{throw Error('Il preventivo Wansport non ha restituito JSON.');}
  if(!parsed||parsed.success!==true||!parsed.dati||typeof parsed.dati!=='object')
    throw Error('La struttura del preventivo Wansport è cambiata.');
  const data=parsed.dati;
  const expectedEnd=gunnersMinutes_(start)+duration;
  const hh=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  if(pblQuoteClock_(data.startTime)!==start||pblQuoteClock_(data.endTime)!==hh(expectedEnd))
    throw Error('Il preventivo riguarda un orario o una durata diversa dalla ricerca; nessun prezzo mostrato.');
  if(data.currencyCode&&data.currencyCode!=='EUR')throw Error('Valuta del preventivo inattesa.');
  const total=pblQuoteNumber_(data.costoTotalePrenotazioneNF??data.costoTotalePrenotazione);
  if(!Number.isFinite(total))throw Error('Prezzo totale assente o non riconoscibile nel preventivo.');
  return {club_id:'pro',court_id:courtId,date:day,start,end:hh(expectedEnd),duration,
    total,currency:'EUR',price:total.toFixed(2).replace('.',',')+' €',
    price_source:'wansport_quote',note:'Preventivo per profilo corrente e durata di 60 minuti; confermare sul portale prima di prenotare.'};
}
