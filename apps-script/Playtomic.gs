/**
 * Padel Booking Leon v1.15 — Playtomic / Padel Hero Parma — SOLA LETTURA.
 * Endpoint e campi osservati dal proprietario in Chrome il 10/11/2026.
 * API web non ufficialmente garantita: mai usare credenziali, token o POST.
 */
const PBL_PLAYTOMIC_TENANT_='15bfd441-153f-40ed-9da0-e3a12dd1b0d5';
const PBL_PLAYTOMIC_ENDPOINT_='https://playtomic.com/api/clubs/availability';
const PBL_PLAYTOMIC_VERIFIED_KEY_='PBL_PLAYTOMIC_LAST_VERIFIED';

function playtomicConnectionStatus_(){
  const last=PropertiesService.getUserProperties().getProperty(PBL_PLAYTOMIC_VERIFIED_KEY_);
  return {configured:true,ready:!!last,booking_ready:false,last_verified:last||null,
    reason:last?'Ultima risposta Playtomic verificata':'Endpoint pubblico individuato; verifica cloud necessaria'};
}
function playtomicTime_(value){
  const match=String(value||'').match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match?Number(match[1])*60+Number(match[2]):NaN;
}
function playtomicClock_(mins){
  return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
}
function playtomicCalendar_(day){
  dateCheck_(day);
  const url=PBL_PLAYTOMIC_ENDPOINT_+'?tenant_id='+encodeURIComponent(PBL_PLAYTOMIC_TENANT_)+
    '&date='+encodeURIComponent(day)+'&sport_id=PADEL';
  const response=UrlFetchApp.fetch(url,{
    method:'get',followRedirects:false,muteHttpExceptions:true,timeoutSeconds:20,
    headers:{Accept:'application/json', 'User-Agent':'Mozilla/5.0 (compatible; PadelBookingLeon/1.7)'}
  });
  const status=response.getResponseCode();
  if(status===401||status===403)throw Error('Playtomic ha rifiutato la lettura dal cloud (HTTP '+status+').');
  if(status===429)throw Error('Playtomic limita le richieste (HTTP 429): riprovare più tardi.');
  if(status!==200)throw Error('Calendario Playtomic non disponibile (HTTP '+status+').');
  let data;
  try{data=JSON.parse(response.getContentText());}
  catch(e){throw Error('Playtomic non ha restituito JSON valido.');}
  if(!Array.isArray(data))throw Error('Formato Playtomic inatteso: era previsto un elenco di risorse.');
  for(const resource of data){
    if(!resource || typeof resource!=='object' || typeof resource.resource_id!=='string' ||
       !Array.isArray(resource.slots) || typeof resource.start_date!=='string'){
      throw Error('Risorse Playtomic incomplete o cambiate.');
    }
    if(resource.start_date!==day)throw Error('La data restituita da Playtomic non coincide con la ricerca.');
  }
  return data;
}
function playtomicSlots_(data,day,preferred,duration,tolerance){
  const target=playtomicTime_(preferred);
  const result=[];
  for(const resource of data){
    for(const slot of resource.slots){
      if(!slot || typeof slot!=='object')continue;
      const start=playtomicTime_(slot.start_time),availableDuration=Number(slot.duration);
      // Non supponiamo che una durata inferiore/superiore sia prenotabile:
      // Playtomic espone la durata specifica di ogni singola offerta.
      if(!Number.isFinite(start)||availableDuration!==duration||Math.abs(start-target)>tolerance||
          start+duration>1440)continue;
      const name=resource.resource_name||resource.name||'Campo '+resource.resource_id.slice(0,8);
      result.push({club_id:'hero',court_id:resource.resource_id,court:String(name).slice(0,90),
        start:playtomicClock_(start),end:playtomicClock_(start+duration),
        duration,date:day,location:'San Prospero',cover:'unknown',price:slot.price==null?'':String(slot.price).slice(0,60)});
    }
  }
  return result.sort((a,b)=>Math.abs(playtomicTime_(a.start)-target)-Math.abs(playtomicTime_(b.start)-target)||
    a.start.localeCompare(b.start)||a.court_id.localeCompare(b.court_id)).slice(0,30);
}
function searchPlaytomic_(request){
  try{
    const data=playtomicCalendar_(request.date);
    const slots=playtomicSlots_(data,request.date,request.time,request.duration,request.tolerance);
    PropertiesService.getUserProperties().setProperty(PBL_PLAYTOMIC_VERIFIED_KEY_,now_());
    return {club_id:'hero',status:slots.length?'available':'no_slots',slots,
      reason:slots.length?'Slot restituiti dal calendario Playtomic; verificare sul sito prima di prenotare.':
        'Nessuno slot compatibile restituito da Playtomic: potrebbe dipendere dalla finestra di apertura, durata o orario.'};
  }catch(err){
    PropertiesService.getUserProperties().deleteProperty(PBL_PLAYTOMIC_VERIFIED_KEY_);
    return {club_id:'hero',status:'error',slots:[],
      reason:String(err&&err.message||'Errore lettura Playtomic').slice(0,220)};
  }
}
function testPlaytomicConnection(){
  // Nessun account Playtomic richiesto: verifica da Apps Script, non dal browser.
  const result=searchPlaytomic_({date:romeToday_(),time:'20:00',duration:90,tolerance:60});
  return {ok:['available','no_slots'].includes(result.status),status:result.status,
    note:result.reason,slots_count:result.slots.length};
}
