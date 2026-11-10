/**
 * Padel Booking Leon v1.11 — Wansport multi-club (Pro Padel Club e Punto G).
 * Connettore sperimentale SOLO LETTURA. Non invia richieste di prenotazione.
 * Gunners.gs resta invariato e continua a gestire il club Gunners.
 * Non inserire credenziali o cookie nel codice o nei log.
 */
const PBL_EXTRA_WS_ = Object.freeze({
  pro:'https://propadelclub.wansport.com',
  puntog:'https://puntogpadel.wansport.com'
});
function extraConfig_(id){
  if(!Object.prototype.hasOwnProperty.call(PBL_EXTRA_WS_,id))throw Error('Centro Wansport non riconosciuto.');
  return {id,origin:PBL_EXTRA_WS_[id],prefix:'PBL_WANSPORT_'+id.toUpperCase()+'_'};
}
function extraProp_(id,suffix){return extraConfig_(id).prefix+suffix;}
function extraConnStatus_(id){
  const p=PropertiesService.getUserProperties();
  const configured=!!(p.getProperty(extraProp_(id,'USERNAME'))&&p.getProperty(extraProp_(id,'PASSWORD')));
  const verified=configured?p.getProperty(extraProp_(id,'LAST_VERIFIED'))||'':'';
  return {ready:!!verified,configured,booking_ready:false,last_verified:verified||null,
    reason:verified?'Ultimo calendario verificato: '+verified:configured?'Credenziali presenti, verificare accesso':'Credenziali da configurare'};
}
function saveWansportCredentials(input){
  if(!input||typeof input!=='object')throw Error('Dati accesso mancanti.');
  const id=String(input.clubId||'');
  if(id==='gunners')return saveGunnersCredentials(input);
  extraConfig_(id);
  const username=String(input.username||'').trim(),password=String(input.password||'');
  const sportId=Number(input.sportId||15);
  if(!username||username.length>200||!password||password.length>256)throw Error('Credenziali non valide.');
  if(!Number.isInteger(sportId)||sportId<1||sportId>99999)throw Error('ID sport non valido.');
  const p=PropertiesService.getUserProperties();
  p.setProperties({[extraProp_(id,'USERNAME')]:username,[extraProp_(id,'PASSWORD')]:password,
    [extraProp_(id,'SPORT_ID')]:String(sportId)},false);
  p.deleteProperty(extraProp_(id,'LAST_VERIFIED'));
  return {ok:true,configured:true};
}
function deleteWansportCredentials(id){
  if(id==='gunners')return deleteGunnersCredentials();
  extraConfig_(id);
  const p=PropertiesService.getUserProperties();
  ['USERNAME','PASSWORD','SPORT_ID','LAST_VERIFIED'].forEach(key=>p.deleteProperty(extraProp_(id,key)));
  return {ok:true};
}
function extraAbsolute_(id,relative){
  const origin=extraConfig_(id).origin;
  const str=String(relative||'').trim().replace(/&amp;/g,'&');
  let u;
  try{u=new URL(str||'/',origin+'/');}catch(e){
    // Apps Script V8 URL global may not be defined; use conservative string path below.
    const dest=/^https?:\/\//i.test(str)?str:origin+'/'+str.replace(/^\/+|^\.\//,'');
    const allow=new RegExp('^'+origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[/?#]|$)','i');
    if(!allow.test(dest))throw Error('Reindirizzamento fuori dal portale non consentito.');
    return dest;
  }
  if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('Reindirizzamento fuori dal portale non consentito.');
  return u.href;
}
function extraFetch_(id,relative,cookies,options){
  const cfg=extraConfig_(id), opts=options||{};
  const url=extraAbsolute_(id,relative);
  const headers={Accept:'text/html,application/json;q=0.9,*/*;q=0.8',...(opts.headers||{})};
  const keys=Object.keys(cookies);
  if(keys.length)headers.Cookie=keys.map(k=>k+'='+cookies[k]).join('; ');
  const res=UrlFetchApp.fetch(url,{method:opts.method||'get',payload:opts.payload,
    contentType:opts.contentType,headers,followRedirects:false,muteHttpExceptions:true,timeoutSeconds:20});
  gunnersReadCookies_(res,cookies);
  return res;
}
function extraFollow_(id,relative,cookies){
  let next=extraAbsolute_(id,relative);
  for(let i=0;i<6;i++){
    const response=extraFetch_(id,next,cookies);
    const code=response.getResponseCode();
    if([301,302,303,307,308].includes(code)){
      const location=gunnersHeader_(response,'location');
      if(!location)throw Error('Reindirizzamento senza destinazione.');
      next=extraAbsolute_(id,Array.isArray(location)?location[0]:location);
      continue;
    }
    return {response,url:next};
  }
  throw Error('Troppi reindirizzamenti durante il login.');
}
function extraSession_(id){
  const cfg=extraConfig_(id), p=PropertiesService.getUserProperties();
  const username=p.getProperty(extraProp_(id,'USERNAME')),password=p.getProperty(extraProp_(id,'PASSWORD'));
  if(!username||!password)throw Error('Credenziali non configurate.');
  const cookies={},login=extraFollow_(id,'/',cookies);
  if(login.response.getResponseCode()!==200)throw Error('Pagina di login non disponibile.');
  // Stessa struttura Joomla osservata su Gunners, da validare separatamente per ogni centro.
  const form=gunnersLoginForm_(login.response.getContentText());
  const fields={...form.fields,username,password,option:'com_users',task:'user.login'};
  const body=Object.keys(fields).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(fields[k])).join('&');
  const response=extraFetch_(id,form.action,cookies,{method:'post',contentType:'application/x-www-form-urlencoded',
    payload:body,headers:{Referer:login.url,Origin:cfg.origin}});
  const code=response.getResponseCode();
  if([301,302,303].includes(code)){
    const location=gunnersHeader_(response,'location');
    if(location)extraFollow_(id,Array.isArray(location)?location[0]:location,cookies);
  } else if(code!==200)throw Error('Login non accettato da Wansport (HTTP '+code+').');
  return cookies;
}
function extraCalendar_(id,day,sessionCookies){
  dateCheck_(day);
  const cfg=extraConfig_(id),p=PropertiesService.getUserProperties();
  const sportId=Number(p.getProperty(extraProp_(id,'SPORT_ID'))||15);
  const cookies=sessionCookies||extraSession_(id);
  const path='/index.php?option=com_wansport&task=prenotazioni.getPannelloPrenotazioni&format=raw'
    +'&filtroData='+encodeURIComponent(day)+'&filtroSport='+encodeURIComponent(sportId)+'&isWannaplay=0';
  const response=extraFetch_(id,path,cookies,{headers:{Accept:'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With':'XMLHttpRequest',Referer:cfg.origin+'/start'}});
  const code=response.getResponseCode();
  if(code===401||code===403||[301,302,303].includes(code))throw Error('Sessione rifiutata dal calendario (HTTP '+code+').');
  if(code!==200)throw Error('Calendario non accessibile (HTTP '+code+').');
  let data;
  try{data=JSON.parse(response.getContentText());}catch(e){throw Error('Nessuna risposta JSON valida dal calendario.');}
  if(!data||data.success!==true||!data.dati||!Array.isArray(data.dati.sedi))throw Error('Struttura calendario non riconosciuta.');
  if(data.dati.sportId!=null && Number(data.dati.sportId)!==sportId)throw Error('Identificativo sport differente da quello richiesto.');
  return data;
}
function searchExtraWansport_(id,request){
  extraConfig_(id);
  if(!extraConnStatus_(id).configured)return {club_id:id,status:'auth_required',slots:[],
    reason:'Configurare l’accesso '+id+' nella scheda del centro sportivo.'};
  try{
    const data=extraCalendar_(id,request.date),courts=data.dati.sedi.flatMap(s=>s.risorse||[]);
    if(!courts.length)throw Error('Nessun campo restituito: controllare l’ID sport nelle impostazioni.');
    const outside=courts.every(c=>c.isFuoriFinestraTemporale===true);
    const slots=outside?[]:gunnersSlots_(data,request.date,request.time,request.duration,request.tolerance)
      .map(s=>{
        // Sedi leggibili dal nome del campo o della sede Wansport.
        // PRO GREEN = impianto Vigatto, PRO PARMA = impianto Parma.
        const label=String(s.court||'')+' '+String(s.venue||'');
        const location=id!=='pro'?'Parma':
          /(?:pro[\s-]*green|vigatto)/i.test(label)?'Vigatto':
          /(?:pro[\s-]*parma|\bparma\b)/i.test(label)?'Parma':
          'Parma / Vigatto · sede da verificare';
        return {...s,club_id:id,location};
      });
    PropertiesService.getUserProperties().setProperty(extraProp_(id,'LAST_VERIFIED'),now_());
    return {club_id:id,status:outside?'outside_window':slots.length?'available':'no_slots',slots,
      reason:outside?'Data fuori finestra del portale.':slots.length?
        'Slot compatibili con il calendario Wansport; confermare la prenotabilità sul sito.':
        'Nessuno slot compatibile: verificare eventuali ulteriori regole del centro.'};
  }catch(e){
    PropertiesService.getUserProperties().deleteProperty(extraProp_(id,'LAST_VERIFIED'));
    return {club_id:id,status:'error',slots:[],reason:String(e.message||'Errore di lettura').slice(0,220)};
  }
}
function testWansportConnection(id){
  if(!['gunners','pro','puntog'].includes(id))throw Error('Il centro non utilizza il connettore Wansport.');
  const r=id==='gunners'?searchGunners_({date:romeToday_(),time:'20:00',duration:90,tolerance:60}):
    searchExtraWansport_(id,{date:romeToday_(),time:'20:00',duration:90,tolerance:60});
  return {ok:['available','no_slots','outside_window'].includes(r.status),status:r.status,note:r.reason,slots_count:r.slots.length};
}
