/* Padel Booking Leon v1.15 — assistenza locale Wansport, senza credenziali e senza conferme.
 * L'estensione mostra la scelta del giocatore sul portale ufficiale.
 * Cerca soltanto un riferimento DOM esatto a tslotId, senza inventare un link profondo.
 */
(()=>{
 'use strict';
 const CH='pbl-playtomic-chrome-v1';
 const ALLOWED=new Set(['gunnerspadel.wansport.com','propadelclub.wansport.com','puntogpadel.wansport.com']);
 if(location.protocol!=='https:'||!ALLOWED.has(location.hostname))return;
 let info=null,root=null,notice=null,found=null;
 const panelPath='/index.php?option=com_wsinit&task=prenotazioni.pannello&view=prenotazioni';
 const display=v=>String(v??'').slice(0,120);
 function exactTimeslot(){
   if(!info?.tslot_id||!document.body)return null;
   const id=String(info.tslot_id);
   const names=['data-tslot-id','data-tslotid','data-tslot','data-tslot_id','data-id-tslot','data-time-slot-id'];
   const hits=new Set();
   for(const name of names){
     for(const el of document.querySelectorAll('['+name+']')){
       if(el.getAttribute(name)===id)hits.add(el);
     }
   }
   // In alcune versioni Wansport l'identificativo è nell'handler del calendario.
   // Richiedere sia la corrispondenza numerica esatta sia il contesto timeslot.
   if(!hits.size){
     const pattern=new RegExp('(?:^|[^0-9])'+id+'(?:[^0-9]|$)');
     for(const el of document.querySelectorAll('[onclick]')){
       const js=el.getAttribute('onclick')||'';
       if(pattern.test(js)&&/tslot|prenotazioneNuovaModal|openPrenotazione/i.test(js))hits.add(el);
     }
   }
   if(hits.size!==1)return null; // mai indovinare fra più celle
   const target=[...hits][0];
   if(target.closest('form[action*="save"],form[action*="confirm"],[type="submit"]'))return null;
   if(target.closest('[data-action*="payment"],[data-action*="confirm"]'))return null;
   return target;
 }
 function setNotice(value){if(notice)notice.textContent=value;}
 function locate(){
   found=exactTimeslot();
   if(found){
     found.style.outline='3px solid #aaff7a';
     found.style.outlineOffset='2px';
     found.scrollIntoView({block:'center',behavior:'smooth'});
     setNotice('Fascia esatta individuata nel calendario: evidenziata in verde. Utilizzi «Apri dettaglio fascia» per selezionarla.');
   }else{
     setNotice(info?.tslot_id?
       'Il calendario non espone ancora una cella univoca con questo ID. Selezioni il giorno e il campo indicati nel riepilogo.':
       'Identificativo fascia non disponibile: selezioni manualmente il giorno, il campo e l’orario indicati.');
   }
 }
 function init(){
   if(!info||root||!document.body)return;
   const host=document.createElement('div');host.id='pbl-handoff-host';host.style.cssText='position:fixed;z-index:2147483646;top:14px;right:14px;max-width:min(380px,calc(100vw - 28px));width:380px';
   root=host.attachShadow({mode:'closed'});
   const css=document.createElement('style');
   css.textContent='*{box-sizing:border-box}section{font:13px/1.45 system-ui,sans-serif;background:#103025;color:#e8ffed;border:1px solid #80b77a;box-shadow:0 8px 35px #0009;border-radius:14px;padding:14px;max-height:80vh;overflow:auto}h3{font-size:15px;margin:0 0 8px;color:#baff8e}dl{margin:8px 0}div.pair{display:flex;gap:10px;justify-content:space-between;border-bottom:1px solid #356145;padding:5px 0}dt{color:#bfd8c7}dd{margin:0;text-align:right;font-weight:650;max-width:63%;overflow-wrap:anywhere}p{margin:9px 0;color:#d9e9dd}small{color:#ffdfb3}nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}button,a{border:1px solid #5a8667;color:#eaffea;background:#1b5239;border-radius:8px;padding:7px 9px;cursor:pointer;font:inherit;text-decoration:none}button:focus-visible,a:focus-visible{outline:2px solid #bdff90}a{display:inline-flex}button.close{float:right;padding:1px 8px}';
   const box=document.createElement('section');
   const close=document.createElement('button');close.className='close';close.textContent='×';close.title='Chiudi guida';close.onclick=()=>host.remove();
   const head=document.createElement('h3');head.textContent='🎾 Padel Booking Leon · fascia selezionata';
   box.append(close,head);
   const data=[
     ['Campo',info.court],['Data',info.date],['Orario',info.start+'–'+info.end],
     ['Durata',info.duration+' minuti'],['Prezzo',info.price||'Da confermare nel portale']
   ];
   const dl=document.createElement('dl');
   for(const [name,val] of data){
     const div=document.createElement('div');div.className='pair';
     const dt=document.createElement('dt');dt.textContent=name;
     const dd=document.createElement('dd');dd.textContent=display(val);
     div.append(dt,dd);dl.append(div);
   }
   notice=document.createElement('p');notice.setAttribute('role','status');
   const nav=document.createElement('nav');
   const find=document.createElement('button');find.textContent='Trova fascia';find.onclick=locate;
   const open=document.createElement('button');open.textContent='Apri dettaglio fascia';
   open.onclick=()=>{
     found=exactTimeslot();
     if(!found){locate();return;}
     // Solo dalla pressione esplicita dell'utente, solo sulla cella esatta.
     found.click();
     setNotice('Se Wansport apre il riepilogo, selezioni la durata e confermi soltanto dopo aver verificato il prezzo.');
   };
   const calendar=document.createElement('a');calendar.textContent='Pannello prenotazioni';
   calendar.href=panelPath;calendar.target='_self';
   nav.append(find,open,calendar);
   const caution=document.createElement('small');
   caution.textContent='L’estensione non salva prenotazioni, non conferma pagamenti e non invia password.';
   box.append(dl,notice,nav,caution);root.append(css,box);document.body.append(host);
   locate();
 }
 function request(attempt=0){
   chrome.runtime.sendMessage({channel:CH,kind:'getHandoff'},result=>{
     if(chrome.runtime.lastError||!result?.ok){
       if(attempt<8)setTimeout(()=>request(attempt+1),350);
       return;
     }
     info=result.data;
     if(!info)return;
     init();
     // Wansport aggiorna spesso il pannello senza ricaricare la pagina.
     let scheduled=false;
     const observer=new MutationObserver(()=>{
       if(scheduled||!document.body||!hostExists())return;
       scheduled=true;
       setTimeout(()=>{scheduled=false;if(info && !found){const el=exactTimeslot();if(el){found=el;setNotice('Fascia individuata: prema «Trova fascia» per evidenziarla.');}}},500);
     });
     observer.observe(document.documentElement,{childList:true,subtree:true});
     setTimeout(()=>observer.disconnect(),120000);
   });
 }
 function hostExists(){return !!document.getElementById('pbl-handoff-host');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>request(),{once:true});
 else request();
})();
