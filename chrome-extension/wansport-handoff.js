/* Padel Booking Leon v1.17 — handoff Wansport sul calendario ufficiale.
 * Scansione DOM e guida nella pagina; mai confermare una prenotazione o un pagamento.
 * Non trasferire cookie, token o dati di sessione fuori da Wansport.
 */
(()=>{
 'use strict';
 const CHANNEL='pbl-playtomic-chrome-v1';
 const HOSTS=new Set(['gunnerspadel.wansport.com','propadelclub.wansport.com','puntogpadel.wansport.com']);
 if(location.protocol!=='https:'||!HOSTS.has(location.hostname))return;
 const PANEL_PATH='/index.php?option=com_wsinit&task=prenotazioni.pannello&view=prenotazioni';
 const START_PATH='/start';
 const ID_ATTRS=['data-tslot-id','data-tslotid','data-tslot','data-tslot_id','data-id-tslot','data-time-slot-id'];
 let info=null,shadow=null,notice=null,found=null,openButton=null,host=null,attempts=0,lastDiagnosis='';
 const short=v=>String(v??'').slice(0,130);
 function inPanel(){
   const u=new URL(location.href);
   return u.pathname.toLowerCase().endsWith('/index.php')&&
     u.searchParams.get('option')==='com_wsinit'&&
     u.searchParams.get('task')==='prenotazioni.pannello';
 }
 function safeCandidate(el){
   if(!(el instanceof Element)||el.closest('form[action*="save"],form[action*="confirm"],[type="submit"]'))return false;
   if(el.closest('[data-action*="payment"],[data-action*="confirm"],[data-action*="delete"]'))return false;
   return true;
 }
 function scan(){
   const id=String(info?.tslot_id||'');
   const stats={page:location.pathname,id:!!id,attrs:0,handlers:0,domIds:0,count:0,
     calendarLike:document.querySelectorAll('[data-tslot-id],[data-tslotid],[id*="tslot"],[class*="slot"],[class*="calendar"],[class*="prenot"]').length,
     frames:document.querySelectorAll('iframe').length};
   const hits=new Set();
   if(!id||!document.body)return {target:null,stats};
   for(const attr of ID_ATTRS){
     for(const el of document.querySelectorAll('['+attr+']')){
       if(el.getAttribute(attr)===id){stats.attrs++;hits.add(el);}
     }
   }
   // È consentito soltanto un confronto numerico esatto nel contesto tslot.
   const exact=new RegExp('(?:^|[^0-9])'+id+'(?:[^0-9]|$)');
   for(const el of document.querySelectorAll('[onclick]')){
     const handler=el.getAttribute('onclick')||'';
     if(exact.test(handler)&&/tslot|prenotazioneNuovaModal|openPrenotazione/i.test(handler)){
       stats.handlers++;hits.add(el);
     }
   }
   for(const el of document.querySelectorAll('[id]')){
     const domId=el.id||'';
     if(/(?:^|[-_])(?:tslot|time-?slot)/i.test(domId)&&exact.test(domId)){
       stats.domIds++;hits.add(el);
     }
   }
   const candidates=[...hits].filter(safeCandidate);
   stats.count=candidates.length;
   return {target:candidates.length===1?candidates[0]:null,stats};
 }
 function setNotice(message,kind='info'){
   if(notice){notice.textContent=message;notice.dataset.kind=kind;}
 }
 function describe(stats){
   return 'Padel Booking Leon v1.17 — diagnosi Wansport\n'+
     'Dominio: '+location.hostname+'\nPagina: '+location.pathname+'\n'+
     'Modalità URL: '+(inPanel()?'pannello classico':'pagina web dinamica / altro percorso')+'\n'+
     'Data selezionata: '+short(info?.date)+'\nOrario: '+short(info?.start)+'\n'+
     'ID fascia presente: '+(stats.id?'sì':'no')+'\n'+
     'Elementi con nomi di calendario (indicativi): '+stats.calendarLike+'\n'+
     'Iframe nella pagina: '+stats.frames+'\n'+
     'Corrispondenze data-*: '+stats.attrs+'\n'+
     'Corrispondenze onclick: '+stats.handlers+'\n'+
     'Corrispondenze id HTML: '+stats.domIds+'\n'+
     'Elementi utilizzabili: '+stats.count+'\n'+
     'Il percorso /start NON esclude la presenza del calendario.\n'+
     'Nessun dato di login, cookie o intestazione incluso.';
 }
 function exactTimeslot(){return scan().target;}
 function locate(){
   attempts++;
   found=null;
   if(openButton)openButton.disabled=true;
   setNotice('Ricerca in corso nel calendario…');
   const {target,stats}=scan();
   lastDiagnosis=describe(stats);
   if(target){
     found=target;
     found.style.outline='3px solid #aaff7a';
     found.style.outlineOffset='2px';
     found.scrollIntoView({block:'center',behavior:'smooth'});
     if(openButton)openButton.disabled=false;
     setNotice('Tentativo '+attempts+': fascia identificata in modo univoco ed evidenziata in verde. «Apri dettaglio fascia» apre soltanto il riepilogo Wansport.', 'ok');
   }else if(!stats.id){
     setNotice('Tentativo '+attempts+': il risultato della nostra app non contiene l’ID della fascia (tslotId). Non posso selezionarla in sicurezza. Apra il calendario del giorno e scelga il campo manualmente.', 'warning');
   }else if(stats.count>1){
     setNotice('Tentativo '+attempts+': Wansport mostra '+stats.count+' elementi con lo stesso ID. Nessuna selezione automatica per evitare il campo sbagliato. Può copiare la diagnosi.', 'warning');
   }else{
     setNotice('Tentativo '+attempts+': non trovo una cella HTML con questo ID nella pagina '+location.pathname+'. Wansport può mostrare il calendario su /start usando JavaScript. Se vede già il giorno '+short(info?.date)+', prema «Copia diagnosi»; non selezionerò una fascia diversa.', 'warning');
   }
 }
 async function copyDiagnosis(){
   const diagnosis=lastDiagnosis||describe(scan().stats);
   try{await navigator.clipboard.writeText(diagnosis);setNotice('Diagnosi tecnica copiata, senza password o cookie. Può incollarla nella chat per analizzare il calendario.','ok');}
   catch{setNotice('Il browser non consente la copia. Diagnosi: '+diagnosis.replace(/\n/g,' · '),'warning');}
 }
 function init(){
   if(!info||shadow||!document.body)return;
   host=document.createElement('div');host.id='pbl-handoff-host';
   host.style.cssText='position:fixed;z-index:2147483646;top:14px;right:14px;max-width:min(380px,calc(100vw - 28px));width:380px';
   shadow=host.attachShadow({mode:'closed'});
   const style=document.createElement('style');
   style.textContent='*{box-sizing:border-box}section{font:13px/1.45 system-ui,sans-serif;background:#103025;color:#e8ffed;border:1px solid #80b77a;box-shadow:0 8px 35px #0009;border-radius:14px;padding:14px;max-height:80vh;overflow:auto}h3{font-size:15px;margin:0 0 8px;color:#baff8e}dl{margin:8px 0}.pair{display:flex;gap:10px;justify-content:space-between;border-bottom:1px solid #356145;padding:5px 0}dt{color:#bfd8c7}dd{margin:0;text-align:right;font-weight:650;max-width:63%;overflow-wrap:anywhere}p{margin:9px 0;color:#d9e9dd}p[data-kind=warning]{color:#ffddb7}p[data-kind=ok]{color:#caff9e}small{color:#ffdfb3}nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}button,a{border:1px solid #5a8667;color:#eaffea;background:#1b5239;border-radius:8px;padding:7px 9px;cursor:pointer;font:inherit;text-decoration:none}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,a:focus-visible{outline:2px solid #bdff90}.close{float:right;padding:1px 8px}';
   const box=document.createElement('section');
   const close=document.createElement('button');close.className='close';close.textContent='×';close.title='Chiudi guida';close.onclick=()=>host.remove();
   const head=document.createElement('h3');head.textContent='🎾 Padel Booking Leon · fascia selezionata';
   box.append(close,head);
   const dl=document.createElement('dl');
   for(const [name,value] of [['Campo',info.court],['Data',info.date],['Orario',info.start+'–'+info.end],
     ['Durata',info.duration+' minuti'],['Prezzo',info.price||'Da confermare sul sito']]){
     const div=document.createElement('div');div.className='pair';
     const dt=document.createElement('dt');dt.textContent=name;
     const dd=document.createElement('dd');dd.textContent=short(value);
     div.append(dt,dd);dl.append(div);
   }
   notice=document.createElement('p');notice.setAttribute('role','status');
   const nav=document.createElement('nav');
   const find=document.createElement('button');find.textContent='Trova fascia';find.onclick=locate;
   openButton=document.createElement('button');openButton.textContent='Apri dettaglio fascia';openButton.disabled=true;
   openButton.onclick=()=>{
     const target=exactTimeslot();
     if(!target){locate();return;}
     target.click(); // solo dopo azione esplicita, su ID univoco e confermato
     setNotice('Dettaglio richiesto. Controlli durata e prezzo nella finestra Wansport prima di confermare.','ok');
   };
   const panel=document.createElement('a');panel.textContent='Pannello (link alternativo)';
   panel.href=PANEL_PATH;panel.target='_self';
   const diagnostic=document.createElement('button');diagnostic.textContent='Copia diagnosi';diagnostic.onclick=copyDiagnosis;
   const home=document.createElement('a');home.textContent='Portale iniziale';home.href=START_PATH;home.target='_self';
   nav.append(find,openButton,panel,diagnostic,home);
   const caution=document.createElement('small');caution.textContent='Nessun pagamento, prenotazione o addebito automatico.';
   box.append(dl,notice,nav,caution);shadow.append(style,box);document.body.append(host);
   locate();
 }
 function request(attempt=0){
   chrome.runtime.sendMessage({channel:CHANNEL,kind:'getHandoff'},reply=>{
     if(chrome.runtime.lastError||!reply?.ok){
       if(attempt<8)setTimeout(()=>request(attempt+1),350);
       return;
     }
     info=reply.data;
     if(!info)return;
     init();
     let scheduled=false;
     const observer=new MutationObserver(()=>{
       if(scheduled||!document.body||!document.getElementById('pbl-handoff-host')||found)return;
       scheduled=true;
       setTimeout(()=>{
         scheduled=false;
         if(!info||found)return;
         const result=scan();
         if(result.target){
           found=result.target;
           setNotice('La fascia è apparsa nel calendario. Prema «Trova fascia» per evidenziarla.','ok');
         }
       },550);
     });
     observer.observe(document.documentElement,{childList:true,subtree:true});
     setTimeout(()=>observer.disconnect(),120000);
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>request(),{once:true});
 else request();
})();
