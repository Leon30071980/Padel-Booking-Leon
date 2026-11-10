/**
 * GUNNERS PADEL — connettore v1.2 SOLO LETTURA
 * Endpoint e struttura JSON osservati dall'utente il 09/11/2026.
 * Nessuna API di creazione prenotazioni, pagamento o ricarica.
 * Nessuna credenziale in file GitHub, Drive o logger.
 * Dati accesso: PropertiesService.getUserProperties(), account proprietario.
 */
const GUNNERS_ORIGIN_='https://gunnerspadel.wansport.com';
const GUNNERS_CALENDAR_='/index.php?option=com_wansport&task=prenotazioni.getPannelloPrenotazioni&format=raw';
const GUNNERS_USER_KEY_='PBL_GUNNERS_USERNAME';
const GUNNERS_PASS_KEY_='PBL_GUNNERS_PASSWORD';
const GUNNERS_VERIFIED_KEY_='PBL_GUNNERS_LAST_VERIFIED';

function gunnersProps_(){return PropertiesService.getUserProperties();}
function gunnersConnectionStatus_(){
  const p=gunnersProps_();
  const configured=!!(p.getProperty(GUNNERS_USER_KEY_)&&p.getProperty(GUNNERS_PASS_KEY_));
  const verified=configured ? p.getProperty(GUNNERS_VERIFIED_KEY_)||'' : '';
  return {ready:!!verified,configured,booking_ready:false,last_verified:verified||null,
    reason:verified?'Ultimo accesso verificato: '+verified : configured?'Credenziali presenti, verificare accesso':'Credenziali da configurare'};
}
/** Invocabile solo dalla Web App personale. Non restituisce mai username/password. */
function saveGunnersCredentials(input){
  if(!input||typeof input!=='object')throw Error('Dati accesso mancanti.');
  const username=String(input.username||'').trim(),password=String(input.password||'');
  if(!username||username.length>200||!password||password.length>256)throw Error('Inserire credenziali valide.');
  const p=gunnersProps_();
  p.setProperties({[GUNNERS_USER_KEY_]:username,[GUNNERS_PASS_KEY_]:password},false);
  p.deleteProperty(GUNNERS_VERIFIED_KEY_);
  return {ok:true,configured:true,message:'Credenziali salvate nelle Proprietà utente dello script. Verificare il login.'};
}
function deleteGunnersCredentials(){
  const p=gunnersProps_();
  [GUNNERS_USER_KEY_,GUNNERS_PASS_KEY_,GUNNERS_VERIFIED_KEY_].forEach(k=>p.deleteProperty(k));
  return {ok:true};
}
function gunnersHeader_(response,key){
  const h=response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  const name=Object.keys(h).find(k=>k.toLowerCase()===key.toLowerCase());
  return name?h[name]:null;
}
function gunnersReadCookies_(res,cookies){
  const values=gunnersHeader_(res,'set-cookie');
  if(!values)return;
  const lines=(Array.isArray(values)?values:[String(values)]).flatMap(v=>String(v).split(/,(?=\s*[^;,=\s]+\s*=)/));
  lines.forEach(line=>{
    const first=line.trim().split(';',1)[0],sep=first.indexOf('=');
    if(sep<=0)return;
    const name=first.slice(0,sep).trim(),value=first.slice(sep+1).trim();
    if(/^[A-Za-z0-9_\-]+$/.test(name)){
      if(value==='')delete cookies[name];else cookies[name]=value;
    }
  });
}
function gunnersAbsoluteUrl_(relative){
  const v=String(relative||'').trim().replace(/&amp;/g,'&');
  const url=/^https?:\/\//i.test(v)?v:v.startsWith('/')?GUNNERS_ORIGIN_+v:GUNNERS_ORIGIN_+'/'+v.replace(/^\.\//,'');
  // Strict host allow-list: never forward credentials or cookies to other hosts.
  if(!/^https:\/\/gunnerspadel\.wansport\.com(?::443)?(?:[/?#]|$)/i.test(url))throw Error('Reindirizzamento fuori dal portale Gunners non consentito.');
  return url;
}
function gunnersFetch_(relative,cookies,options){
  const url=gunnersAbsoluteUrl_(relative);
  const headers={Accept:'text/html,application/json;q=0.9,*/*;q=0.8',...((options||{}).headers||{})};
  const keys=Object.keys(cookies);
  if(keys.length)headers.Cookie=keys.map(k=>k+'='+cookies[k]).join('; ');
  const res=UrlFetchApp.fetch(url,{method:(options||{}).method||'get',payload:(options||{}).payload,
    contentType:(options||{}).contentType,headers,followRedirects:false,muteHttpExceptions:true,timeoutSeconds:20});
  gunnersReadCookies_(res,cookies);
  return res;
}
function gunnersFollowGet_(relative,cookies){
  let next=gunnersAbsoluteUrl_(relative);
  for(let i=0;i<6;i++){
    const res=gunnersFetch_(next,cookies);
    const status=res.getResponseCode();
    if([301,302,303,307,308].includes(status)){
      const target=gunnersHeader_(res,'location');
      if(!target)throw Error('Reindirizzamento senza destinazione.');
      next=gunnersAbsoluteUrl_(Array.isArray(target)?target[0]:target);
      continue;
    }
    return {response:res,url:next};
  }
  throw Error('Troppi reindirizzamenti nel portale.');
}
function gunnersAttr_(tag,name){
  const quoted=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i');
  const found=tag.match(quoted);
  if(found)return found[2].replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&amp;/g,'&');
  const bare=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*([^\\s>]+)','i'));
  return bare?bare[1]:null;
}
function gunnersLoginForm_(html){
  const forms=String(html).match(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi)||[];
  for(const form of forms){
    const fields={};
    for(const tag of (form.match(/<input\b[^>]*>/gi)||[])){
      const name=gunnersAttr_(tag,'name');
      if(name){fields[name]=gunnersAttr_(tag,'value')??'';}
    }
    if(!Object.prototype.hasOwnProperty.call(fields,'password')||!Object.prototype.hasOwnProperty.call(fields,'username'))continue;
    const token=Object.keys(fields).find(k=>/^[a-f0-9]{32,64}$/i.test(k)&&fields[k]==='1');
    if(!token)throw Error('Token CSRF del modulo login non identificabile: accesso non tentato.');
    const opening=form.match(/^<form\b[^>]*>/i)[0];
    const action=gunnersAttr_(opening,'action')||'/index.php';
    // La richiesta POST osservata era /index.php, anche quando la pagina è /start.
    return {action,fields};
  }
  throw Error('Modulo di accesso Wansport non individuato nella pagina pubblica.');
}
function gunnersSession_(){
  const p=gunnersProps_(),username=p.getProperty(GUNNERS_USER_KEY_),password=p.getProperty(GUNNERS_PASS_KEY_);
  if(!username||!password)throw Error('Credenziali Gunners non configurate.');
  const cookies={};
  const loginPage=gunnersFollowGet_('/',cookies);
  if(loginPage.response.getResponseCode()!==200)throw Error('Pagina di login non disponibile.');
  const form=gunnersLoginForm_(loginPage.response.getContentText());
  const fields={...form.fields,username,password,option:'com_users',task:'user.login'};
  const body=Object.keys(fields).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(fields[k])).join('&');
  // In caso di POST con redirect preserviamo i cookie senza seguire redirect esterni.
  const response=gunnersFetch_(form.action,cookies,{method:'post',contentType:'application/x-www-form-urlencoded',
    payload:body,headers:{Referer:loginPage.url,Origin:GUNNERS_ORIGIN_}});
  const code=response.getResponseCode();
  if([301,302,303].includes(code)){
    const dest=gunnersHeader_(response,'location');
    if(dest)gunnersFollowGet_(Array.isArray(dest)?dest[0]:dest,cookies);
  } else if(code!==200)throw Error('Login non accettato da Wansport (HTTP '+code+').');
  return cookies;
}
function gunnersCalendar_(date){
  dateCheck_(date);
  const cookies=gunnersSession_();
  const url=GUNNERS_CALENDAR_+'&filtroData='+encodeURIComponent(date)+'&filtroSport=15&isWannaplay=0';
  const response=gunnersFetch_(url,cookies,{headers:{Accept:'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With':'XMLHttpRequest',Referer:GUNNERS_ORIGIN_+'/start'}});
  const code=response.getResponseCode();
  if(code===401||code===403||[301,302,303].includes(code))throw Error('La sessione è stata rifiutata dal calendario (HTTP '+code+').');
  if(code!==200)throw Error('Calendario Gunners non disponibile (HTTP '+code+').');
  let data;
  try{data=JSON.parse(response.getContentText());}catch(e){throw Error('Il calendario non ha restituito JSON: sessione non valida o sito modificato.');}
  if(!data||data.success!==true||!data.dati||!Array.isArray(data.dati.sedi))throw Error('Risposta del calendario inattesa o accesso non autorizzato.');
  return data;
}
function gunnersMinutes_(text){
  const m=String(text||'').match(/^(\d{1,2}):(\d{2})/);
  if(!m)return NaN;
  const h=Number(m[1]),n=Number(m[2]);
  return h>=0&&h<=24&&n<60&&(h<24||n===0)?h*60+n:NaN;
}
function gunnersSlots_(data,day,preferred,duration,tolerance){
  const target=gunnersMinutes_(preferred);
  const result=[];
  for(const sede of data.dati.sedi){
    for(const resource of sede.risorse||[]){
      if(resource.isFuoriFinestraTemporale===true)continue;
      const intervals=(resource.listaPrenotazioni||[]).filter(b=>b.startdate===day).map(b=>[gunnersMinutes_(b.starttime),gunnersMinutes_(b.endtime)]);
      const parts=(resource.tslots||[]).filter(t=>t.published===true&&String(t.ts_start||'').slice(0,10)===day);
      const byStart=new Map(parts.map(t=>[gunnersMinutes_(t.starttime),t]));
      for(const start of byStart.keys()){
        if(!Number.isFinite(start)||Math.abs(start-target)>tolerance||start+duration>1440)continue;
        let valid=true;
        for(let at=start;at<start+duration;at+=30){
          const part=byStart.get(at);
          if(!part||part.full_tslot===true||part.hide_tslot===true||part.fe_disabled===true||
            (Array.isArray(part.lista_organizzazioni)&&part.lista_organizzazioni.length>0)||
            (at===start&&(part.is_inizio_prenotazioni_disabilitato===true||part.crea_prenotazioni_in_ts_inizio_disabilitato===true))){valid=false;break;}
        }
        if(!valid||intervals.some(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&start<b&&start+duration>a))continue;
        const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        // Preferire i metadati espliciti. Il nome campo può fornire un'indicazione
        // di copertura ("Coperto", "Open") ma potrebbe variare stagionalmente.
        const courtName=String(resource.nome||('Campo '+resource.id));
        const explicitCover=typeof resource.coperto==='boolean'?(resource.coperto?'indoor':'outdoor'):
          typeof resource.indoor==='boolean'?(resource.indoor?'indoor':'outdoor'):'unknown';
        const namedCover=/\b(?:coperto|indoor)\b/i.test(courtName)?'indoor':
          /\b(?:scoperto|open|outdoor)\b/i.test(courtName)?'outdoor':'unknown';
        const cover=explicitCover!=='unknown'?explicitCover:namedCover;
        result.push({court_id:String(resource.id),court:courtName,start:hm(start),end:hm(start+duration),
          duration,club_id:'gunners',date:day,venue:String(sede.nome||'').slice(0,90),
          cover,cover_source:explicitCover!=='unknown'?'calendario':namedCover!=='unknown'?'nome campo':'unknown',price:''});
      }
    }
  }
  return result.sort((a,b)=>Math.abs(gunnersMinutes_(a.start)-target)-Math.abs(gunnersMinutes_(b.start)-target)||
    a.start.localeCompare(b.start)||Number(a.court_id)-Number(b.court_id)).slice(0,30);
}
function searchGunners_(request){
  if(!gunnersConnectionStatus_().configured)return {club_id:'gunners',status:'auth_required',slots:[],
    reason:'Configurare le credenziali Gunners dalla scheda del centro sportivo.'};
  try{
    const data=gunnersCalendar_(request.date);
    const courts=data.dati.sedi.flatMap(s=>s.risorse||[]);
    const outWindow=!courts.length||courts.every(r=>r.isFuoriFinestraTemporale===true);
    const slots=outWindow?[]:gunnersSlots_(data,request.date,request.time,request.duration,request.tolerance);
    gunnersProps_().setProperty(GUNNERS_VERIFIED_KEY_,now_());
    return {club_id:'gunners',status:outWindow?'outside_window':slots.length?'available':'no_slots',slots,
      reason:outWindow?'Data fuori dalla finestra restituita dal portale.':slots.length?'Disponibilità calcolate sul calendario Wansport; verificare sul portale prima di prenotare.':'Nessuna fascia compatibile; alcuni slot possono essere non prenotabili per altre regole.'};
  }catch(e){
    gunnersProps_().deleteProperty(GUNNERS_VERIFIED_KEY_);
    return {club_id:'gunners',status:'error',slots:[],reason:String(e.message||'Errore di collegamento').slice(0,220)};
  }
}
/** Controllo esplicito: una sola richiesta di calendario, senza prenotare. */
function testGunnersConnection(){
  const r=searchGunners_({date:romeToday_(),time:'20:00',duration:90,tolerance:60});
  return {ok:['available','no_slots','outside_window'].includes(r.status),status:r.status,note:r.reason,
    slots_count:r.slots.length};
}
