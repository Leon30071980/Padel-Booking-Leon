/* Padel Booking Leon v1.19 — handoff Wansport sul calendario ufficiale.
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
 let inspectorArmed=false,inspectedElement=null,lastCellStructure='',inspectCopyButton=null;
 let inspectHighlight=null,inspectStyle=null;
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

 /* Pro Padel espone le righe con id griglia-row-resource-id-N e le singole
  * mezz'ore con div.tslot. Individuiamo campo e ora insieme; nessun ID Wansport
  * viene dedotto dalla posizione delle celle, e non selezioniamo nulla se >1 match.
  * La data non è leggibile con certezza da questa struttura DOM: prima del
  * click l'utente deve confermarla esplicitamente sul calendario visibile.
  */
 function scanResourceClock(){
   const out={target:null,count:0,rowFound:false,activeCount:0};
   const court=String(info?.court_id||''),time=String(info?.start||'');
   if(!/^[1-9]\d{0,11}$/.test(court)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))return out;
   const row=document.getElementById('griglia-row-resource-id-'+court);
   if(!row||!row.classList?.contains('resRow'))return out;
   out.rowFound=true;
   const matches=[];
   for(const cell of row.querySelectorAll('div.tslot')){
     if(!cell.classList?.contains('tslotAttivo')||!safeCandidate(cell))continue;
     out.activeCount++;
     const text=String(cell.textContent||'').trim();
     const clocks=text.match(/(?:^|\s)(?:[01]\d|2[0-3]):[0-5]\d(?=\s|$)/g)||[];
     const exact=clocks.map(v=>v.trim());
     // La cella dev'essere chiaramente e unicamente etichettata con l'ora.
     if(exact.length===1&&exact[0]===time)matches.push(cell);
   }
   out.count=matches.length;
   out.target=matches.length===1?matches[0]:null;
   return out;
 }

 function scan(){
   const id=String(info?.tslot_id||'');
   const stats={page:location.pathname,id:!!id,attrs:0,handlers:0,domIds:0,count:0,
     calendarLike:document.querySelectorAll('[data-tslot-id],[data-tslotid],[id*="tslot"],[class*="slot"],[class*="calendar"],[class*="prenot"]').length,
     frames:document.querySelectorAll('iframe').length,
     rowFound:false,resourceClockMatches:0,resourceActiveCells:0};
   // Solo per Pro Padel usiamo la corrispondenza effettivamente osservata:
   // risorsa identificata dal row-id e ora scritta dentro un div.tslotAttivo.
   if(location.hostname==='propadelclub.wansport.com'){
     const result=scanResourceClock();
     stats.rowFound=result.rowFound;
     stats.resourceClockMatches=result.count;
     stats.resourceActiveCells=result.activeCount;
     stats.count=result.count;
     return {target:result.target,stats};
   }
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
   return 'Padel Booking Leon v1.19 — diagnosi Wansport\n'+
     'Dominio: '+location.hostname+'\nPagina: '+location.pathname+'\n'+
     'Modalità URL: '+(inPanel()?'pannello classico':'pagina web dinamica / altro percorso')+'\n'+
     'Data selezionata: '+short(info?.date)+'\nOrario: '+short(info?.start)+'\n'+
     'ID fascia presente: '+(stats.id?'sì':'no')+'\n'+
     'Elementi con nomi di calendario (indicativi): '+stats.calendarLike+'\n'+
     'Iframe nella pagina: '+stats.frames+'\n'+
     'Corrispondenze data-*: '+stats.attrs+'\n'+
     'Corrispondenze onclick: '+stats.handlers+'\n'+
     'Corrispondenze id HTML: '+stats.domIds+'\n'+
     'Riga del campo individuata: '+(stats.rowFound?'sì':'no')+'\n'+
     'Celle attive nella riga: '+stats.resourceActiveCells+'\n'+
     'Corrispondenze campo + ora: '+stats.resourceClockMatches+'\n'+
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
     setNotice('Tentativo '+attempts+': campo e ora '+short(info?.start)+' individuati in modo univoco. Fascia evidenziata in verde. Prima di aprire il dettaglio dovrà confermare che la data sul calendario sia '+short(info?.date)+'.', 'ok');
   }else if(!stats.id){
     setNotice('Tentativo '+attempts+': il risultato della nostra app non contiene l’ID della fascia (tslotId). Non posso selezionarla in sicurezza. Apra il calendario del giorno e scelga il campo manualmente.', 'warning');
   }else if(stats.count>1){
     setNotice('Tentativo '+attempts+': Wansport mostra '+stats.count+' elementi con lo stesso ID. Nessuna selezione automatica per evitare il campo sbagliato. Può copiare la diagnosi.', 'warning');
   }else{
     setNotice(location.hostname==='propadelclub.wansport.com'?
       'Tentativo '+attempts+': non trovo una sola cella attiva alle '+short(info?.start)+' nella riga del campo ID '+short(info?.court_id)+'. Verifichi che sul portale siano visibili la data '+short(info?.date)+' e il campo richiesto, poi utilizzi «Copia diagnosi».':
       'Tentativo '+attempts+': non trovo una cella HTML con questo ID nella pagina '+location.pathname+'. Se il calendario mostra la data '+short(info?.date)+', utilizzi «Copia diagnosi».', 'warning');
   }
 }
 async function copyDiagnosis(){
   const diagnosis=lastDiagnosis||describe(scan().stats);
   try{await navigator.clipboard.writeText(diagnosis);setNotice('Diagnosi tecnica copiata, senza password o cookie. Può incollarla nella chat per analizzare il calendario.','ok');}
   catch{setNotice('Il browser non consente la copia. Diagnosi: '+diagnosis.replace(/\n/g,' · '),'warning');}
 }

 /**
  * Campionamento manuale di UNA cella reale.
  * Non si clicca né si legge l'HTML completo: valori sensibili e testo libero
  * sono esclusi dal referto, che viene copiato solo per scelta dell'utente.
  */
 function safeName(value){
   const v=String(value||'').slice(0,70);
   if(!/^[a-z0-9_:-]+$/i.test(v)||/password|passw|token|csrf|auth|session|cookie|email|utente|account|secret|nonce/i.test(v))return '[omesso]';
   return v.replace(/\d{5,}/g,'#');
 }
 function safeAttributeValue(name,value){
   if(!/^(?:data-|aria-)/.test(name))return '[omesso]';
   if(!/(?:time|start|end|date|day|slot|tslot|resource|court|campo|id)$/i.test(name))return '[presente]';
   const v=String(value??'').trim();
   if(/^\d{1,12}$/.test(v)||/^\d{2}:\d{2}(?::\d{2})?$/.test(v)||
      /^\d{4}-\d{2}-\d{2}$/.test(v))return v;
   return '[presente]';
 }
 function describeNode(el,depth){
   const tag=String(el.tagName||'elemento').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,20);
   const rawClass=el.getAttribute?.('class')||'';
   const classes=String(rawClass).split(/\s+/).filter(Boolean).slice(0,9).map(safeName);
   const id=el.getAttribute?.('id')||'';
   const attrs=[];
   for(const attr of Array.from(el.attributes||[])){
     const name=String(attr.name||'').toLowerCase();
     if(!/^(data-[a-z0-9_-]{1,45}|aria-[a-z0-9_-]{1,45}|role|title)$/.test(name))continue;
     attrs.push(safeName(name)+'='+safeAttributeValue(name,attr.value));
     if(attrs.length>=10)break;
   }
   const times=Array.from(new Set((String(el.textContent||'').slice(0,240).match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g)||[]))).slice(0,3);
   return depth+': <'+tag+'> class=['+classes.join(' ')+'] id='+(id?safeName(id):'—')+
     ' attrs={'+attrs.join('; ')+'} orari=['+times.join(', ')+']';
 }
 function makeCellStructure(target){
   const lines=[
     'Padel Booking Leon v1.19 — struttura cella Wansport (solo metadati)',
     'Dominio: '+location.hostname,
     'Pagina: '+location.pathname,
     'Data richiesta: '+short(info?.date),
     'Orario richiesto: '+short(info?.start),
     'ID fascia ricercato: '+(info?.tslot_id?'presente':'assente'),
     'Individuazione: cella indicata dall’utente con il mouse e F8; NON selezionata',
     'Catena HTML (nodo sotto il mouse → contenitori):'
   ];
   let node=target;
   for(let level=0;node&&level<8;level++,node=node.parentElement){
     if(node===host||node===document.documentElement)break;
     lines.push(describeNode(node,level));
   }
   lines.push('Esclusi: HTML integrale, script, URL, contenuto moduli, credenziali, cookie e token.');
   return lines.join('\n');
 }
 function clearHover(){
   if(inspectHighlight){
     inspectHighlight.style.outline=inspectStyle?.outline||'';
     inspectHighlight.style.outlineOffset=inspectStyle?.outlineOffset||'';
   }
   inspectHighlight=null;inspectStyle=null;
 }
 function startCellInspect(){
   clearHover();
   inspectedElement=null;lastCellStructure='';
   if(inspectCopyButton)inspectCopyButton.disabled=true;
   inspectorArmed=true;
   setNotice('Analisi attiva: sposti il mouse sulla cella delle ore '+short(info?.start)+
     ' del campo '+short(info?.court)+', poi prema F8 sulla tastiera. NON faccia clic sul campo.','ok');
 }
 function handleCellHover(e){
   if(!inspectorArmed||!e.target||!(e.target instanceof Element))return;
   if(e.target===host||host?.contains(e.target))return;
   if(e.target.closest('input,textarea,select,[contenteditable="true"],form[action*="payment"]'))return;
   let target=e.target;
   // Il contenitore più vicino con indizi di cella è più informativo del testo figlio.
   for(let n=e.target,depth=0;n&&depth<4;n=n.parentElement,depth++){
     if(n===host)break;
     const cl=String(n.getAttribute?.('class')||'');
     const id=String(n.getAttribute?.('id')||'');
     const role=String(n.getAttribute?.('role')||'');
     if(/slot|tslot|cell|prenot|time|hour|free|liber|available|orari/i.test(cl+' '+id)||role==='gridcell'){
       target=n;break;
     }
   }
   if(target===inspectHighlight){inspectedElement=target;return;}
   clearHover();
   inspectedElement=target;
   inspectHighlight=target;
   inspectStyle={outline:target.style.outline,outlineOffset:target.style.outlineOffset};
   target.style.outline='3px dashed #ffdc70';
   target.style.outlineOffset='2px';
 }
 function handleInspectKey(e){
   if(!inspectorArmed||e.key!=='F8')return;
   e.preventDefault();
   e.stopPropagation();
   inspectorArmed=false;
   if(!inspectedElement){
     setNotice('Nessuna cella sotto il puntatore. Prema «Analizza una cella» e passi sopra lo slot senza cliccare.','warning');
     return;
   }
   lastCellStructure=makeCellStructure(inspectedElement);
   clearHover();
   inspectedElement=null;
   if(inspectCopyButton)inspectCopyButton.disabled=false;
   setNotice('Struttura della cella acquisita senza cliccare. Prema «Copia struttura» e incolli il testo nella chat.','ok');
 }
 async function copyCellStructure(){
   if(!lastCellStructure)return;
   try{
     await navigator.clipboard.writeText(lastCellStructure);
     setNotice('Struttura della cella copiata. Nessun cookie o HTML integrale incluso. Incolli il testo nella chat.','ok');
   }catch(e){
     setNotice('Impossibile copiare automaticamente: controlli i permessi del browser.','warning');
   }
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
     if(!target||!found||target!==found){locate();return;}
     const question='Sul calendario Wansport è selezionata la data '+short(info?.date)+'?\n'+
       'Il campo evidenziato è «'+short(info?.court)+'», ore '+short(info?.start)+'?\n\n'+
       'Confermando si apre SOLO il dettaglio della fascia, NON si prenota né si paga.';
     if(!window.confirm(question)){
       setNotice('Data/campo non confermati. Nessuna selezione effettuata.', 'warning');return;
     }
     // Riconvalidare dopo il dialogo, senza effettuare alcun click in automatico.
     if(exactTimeslot()!==target){locate();return;}
     target.click();
     setNotice('Dettaglio richiesto. Verifichi data, durata e prezzo nel portale prima di confermare.', 'ok');
   };
   const panel=document.createElement('a');panel.textContent='Pannello (link alternativo)';
   panel.href=PANEL_PATH;panel.target='_self';
   const diagnostic=document.createElement('button');diagnostic.textContent='Copia diagnosi';diagnostic.onclick=copyDiagnosis;
   const inspect=document.createElement('button');inspect.textContent='Analizza una cella';inspect.onclick=startCellInspect;
   inspectCopyButton=document.createElement('button');inspectCopyButton.textContent='Copia struttura';inspectCopyButton.disabled=true;inspectCopyButton.onclick=copyCellStructure;
   const home=document.createElement('a');home.textContent='Portale iniziale';home.href=START_PATH;home.target='_self';
   nav.append(find,openButton,inspect,inspectCopyButton,panel,diagnostic,home);
   const caution=document.createElement('small');caution.textContent='Nessun pagamento, prenotazione o addebito automatico.';
   box.append(dl,notice,nav,caution);shadow.append(style,box);document.body.append(host);
   document.addEventListener('pointerover',handleCellHover,true);
   document.addEventListener('keydown',handleInspectKey,true);
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
