/**
 * Padel Booking Leon v1.14 — quotazioni Pro Padel, SOLA LETTURA.
 * L'app interroga il GET del modale soltanto per slot risultati disponibili.
 * Per 90/120 minuti il parametro duration=<minuti> è sperimentale:
 * prezzi restituiti solo se l'API conferma precisamente ora iniziale/finale.
 * Non esegue richieste di prenotazione, conferma, addebito o pagamento.
 */
const PBL_QUOTE_BATCH_MAX_=3;
const PBL_QUOTE_CACHE_SECONDS_=45;

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
function pblQuoteDuration_(value){
  const n=Number(value);
  if(!Number.isInteger(n)||![60,90,120].includes(n))throw Error('Durata non supportata: utilizzare 60, 90 o 120 minuti.');
  return n;
}
function pblQuoteValidate_(input,day){
  if(!input||typeof input!=='object')throw Error('Fascia oraria non valida.');
  const courtId=String(input.court_id||'');
  if(!/^[1-9]\d{0,11}$/.test(courtId))throw Error('ID del campo non valido.');
  const start=timeCheck_(input.start);
  const duration=pblQuoteDuration_(input.duration);
  const startMinutes=gunnersMinutes_(start);
  if(startMinutes+duration>1440)throw Error('Orario di fine oltre la mezzanotte.');
  return {club_id:'pro',court_id:courtId,date:day,start,duration};
}
function pblQuoteCache_(){
  try{return CacheService.getUserCache();}
  catch(e){return null;}
}
function pblQuoteCacheKey_(q){
  return 'PBLQUOTE12_'+q.date.replace(/-/g,'')+'_'+q.court_id+'_'+q.start.replace(':','')+'_'+q.duration;
}
function pblQuoteGet_(request,calendar,cookies,cache){
  const key=pblQuoteCacheKey_(request);
  if(cache){
    try{
      const old=cache.get(key);
      if(old){
        const cached=JSON.parse(old);
        if(cached&&cached.club_id==='pro'&&cached.date===request.date&&cached.start===request.start&&
          cached.court_id===request.court_id&&cached.duration===request.duration&&
          typeof cached.price==='string')return {...cached,cached:true};
      }
    }catch(e){/* Se la cache è corrotta, ricalcolare senza fidarsi del valore. */}
  }
  // La verifica deriva dall'ultimo calendario ottenuto nella stessa sessione:
  // non si accetta tslotId inviato dal browser.
  const matches=gunnersSlots_(calendar,request.date,request.start,request.duration,0)
    .filter(slot=>slot.court_id===request.court_id&&slot.start===request.start);
  if(matches.length!==1)throw Error('Fascia non più disponibile: aggiornare la ricerca.');
  const tslotId=pblTslotId_({tslotId:matches[0].tslot_id});
  if(!tslotId)throw Error('Wansport non espone l’ID tslotId della fascia iniziale.');
  const cfg=extraConfig_('pro');
  const sportId=Number(PropertiesService.getUserProperties().getProperty(extraProp_('pro','SPORT_ID'))||15);
  if(!Number.isInteger(sportId)||sportId<1||sportId>99999)throw Error('Configurazione sport non valida.');
  const path='/index.php?option=com_wansport&task=prenotazioni.getPrenotazioneNuovaModal'
    +'&tslotId='+encodeURIComponent(tslotId)
    +'&sportId='+encodeURIComponent(sportId)
    +'&dataSelezionata='+encodeURIComponent(request.date)
    // L'API osservata usa duration= per 60; i valori 90/120 sono da convalidare
    // attraverso gli orari restituiti, NON presunti corretti.
    +'&duration='+encodeURIComponent(request.duration===60?'':String(request.duration))
    +'&eventOrganizationUUID=&format=raw'
    +'&rand='+encodeURIComponent(Math.random().toFixed(9))
    +'&isPrenotazioneStart=1';
  const response=extraFetch_('pro',path,cookies,{method:'get',headers:{
    Accept:'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With':'XMLHttpRequest',Referer:cfg.origin+'/start'}});
  const status=response.getResponseCode();
  if(status===429)throw Error('Wansport limita le richieste (HTTP 429): riprovare più tardi.');
  if(status!==200)throw Error('Preventivo non disponibile (HTTP '+status+').');
  let parsed;
  try{parsed=JSON.parse(response.getContentText());}
  catch(e){throw Error('Wansport non ha restituito JSON per il preventivo.');}
  if(!parsed||parsed.success!==true||!parsed.dati||typeof parsed.dati!=='object')
    throw Error('Struttura preventivo Wansport non valida.');
  const data=parsed.dati;
  const endMin=gunnersMinutes_(request.start)+request.duration;
  const end=String(Math.floor(endMin/60)).padStart(2,'0')+':'+String(endMin%60).padStart(2,'0');
  if(pblQuoteClock_(data.startTime)!==request.start||pblQuoteClock_(data.endTime)!==end)
    throw Error('Wansport non ha confermato '+request.duration+' minuti per questa fascia: prezzo non mostrato.');
  if(data.currencyCode&&data.currencyCode!=='EUR')throw Error('Valuta del preventivo diversa da EUR.');
  const total=pblQuoteNumber_(data.costoTotalePrenotazioneNF??data.costoTotalePrenotazione);
  if(!Number.isFinite(total))throw Error('Prezzo totale non presente nel preventivo.');
  const output={...request,end,total,currency:'EUR',price:total.toFixed(2).replace('.',',')+' €',
    price_source:'wansport_quote',checked_at:now_(),
    note:'Prezzo associato al profilo attuale; confermare sul portale prima di prenotare.'};
  if(cache)try{cache.put(key,JSON.stringify(output),PBL_QUOTE_CACHE_SECONDS_);}catch(e){}
  return output;
}
/**
 * Calcola fino a 3 preventivi per richiesta, con UNA sessione e UN calendario
 * aggiornato. Ogni risultato ha uno stato autonomo; nessuna prenotazione.
 */
function getWansportQuotesBatch(payload){
  if(!payload||typeof payload!=='object'||payload.club_id!=='pro')
    throw Error('I preventivi automatici sono disponibili solo per Pro Padel.');
  const day=dateCheck_(payload.date);
  if(!Array.isArray(payload.slots)||!payload.slots.length||payload.slots.length>PBL_QUOTE_BATCH_MAX_)
    throw Error('Selezionare da 1 a 3 fasce per la richiesta dei preventivi.');
  const normalized=payload.slots.map(s=>pblQuoteValidate_(s,day));
  if(new Set(normalized.map(s=>s.court_id+'_'+s.start+'_'+s.duration)).size!==normalized.length)
    throw Error('Fasce duplicate non ammesse.');
  if(!extraConnStatus_('pro').configured)throw Error('Accesso Pro Padel non configurato.');
  const cache=pblQuoteCache_();
  const cookies=extraSession_('pro');
  const calendar=extraCalendar_('pro',day,cookies);
  let rateLimited=false;
  const quotes=normalized.map(q=>{
    if(rateLimited)return {...q,ok:false,error:'Lettura temporaneamente limitata da Wansport (HTTP 429).'};
    try{return {...pblQuoteGet_(q,calendar,cookies,cache),ok:true};}
    catch(e){
      const message=String(e&&e.message||'Preventivo non disponibile').slice(0,170);
      if(/429/.test(message))rateLimited=true;
      return {...q,ok:false,error:message};
    }
  });
  return {club_id:'pro',date:day,quotes,rate_limited:rateLimited};
}
/** Compatibilità con il vecchio pulsante manuale, ormai opzionale. */
function getWansportQuote(input){
  if(!input||typeof input!=='object')throw Error('Dati preventivo mancanti.');
  const reply=getWansportQuotesBatch({club_id:input.club_id,date:input.date,slots:[input]});
  const result=reply.quotes[0];
  if(!result.ok)throw Error(result.error);
  return result;
}
