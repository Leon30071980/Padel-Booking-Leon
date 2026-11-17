/* Padel Booking Leon v1.27: diagnosi manuale del calendario visibile.
 * Nessuna chiamata di rete, nessun click sul portale, nessun dato di sessione. */
(()=>{
 'use strict';
 if(location.origin!=='https://playtomic.com'||location.pathname.replace(/\/$/,'')!=='/clubs/padel-hero-parma')return;
 let armed=false,target=null,report='',slotLine='',selectedFields=null;
 const host=document.createElement('div');
 host.style.cssText='position:fixed;bottom:14px;right:14px;z-index:2147483646;max-width:320px';
 const root=host.attachShadow({mode:'closed'});
 const style=document.createElement('style');
 style.textContent='section{font:13px/1.4 system-ui,sans-serif;background:#10271e;color:#e9f6ec;border:1px solid #91d48f;border-radius:10px;padding:10px;box-shadow:0 4px 18px #0005}button{font:inherit;color:#e9f6ec;background:#214a35;border:1px solid #84aa88;border-radius:6px;padding:6px;margin:3px;cursor:pointer}button:disabled{opacity:.5}p{margin:6px 0}select{max-width:100%;margin:3px;color:#e9f6ec;background:#214a35;border:1px solid #84aa88;border-radius:5px;padding:5px}';
 const box=document.createElement('section'),heading=document.createElement('strong'),msg=document.createElement('p');
 heading.textContent='Padel Booking Leon · v1.27';msg.textContent='Diagnosi del calendario: nessuna prenotazione o lettura API.';
 const arm=document.createElement('button'),copy=document.createElement('button'),copySlot=document.createElement('button'),close=document.createElement('button');
 arm.textContent='Analizza una cella';copy.textContent='Copia diagnosi';copy.disabled=true;copySlot.disabled=true;copySlot.textContent='Copia fascia per l’app';close.textContent='×';close.title='Chiudi assistente';
 function safeName(s){return /^[a-z][a-z0-9_:-]{0,59}$/i.test(s)&&!/secret|auth|token|cookie|session|password|email|user|account|phone/i.test(s)?s:'[omesso]';}
 function safeSlotValue(value,kind){
  const v=String(value||'').trim();
  if(kind==='time')return /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v)?v:'';
  if(kind==='duration')return /^(?:\d{1,5}(?:\.\d{1,3})?(?: ?(?:min|minutes|s|sec|seconds|h|hours))?|PT\d{1,3}(?:H|M|S)(?:\d{1,2}M)?)$/i.test(v)?v:'';
  if(kind==='sport')return /^(?:padel|tennis|pickleball|squash|badminton)$/i.test(v)?v:'';
  return '';
 }
 function slotFields(cell){
  return {
   time:safeSlotValue(cell.getAttribute('data-tracking-property-time'),'time'),
   duration:safeSlotValue(cell.getAttribute('data-tracking-property-duration'),'duration'),
   sport:safeSlotValue(cell.getAttribute('data-tracking-property-sport'),'sport')
  };
 }
 function normalizedCourt(raw){
  const v=String(raw||'').trim().replace(/\s+/g,' ');
  const m=v.match(/^CAMPO\s+0?([1-9]|1[0-2])(?=$|\s|[.,:()_-])/i);
  if(!m)return null;
  const tail=v.slice(m[0].length);
  const indoor=/\b(?:INDOOR|COPERTO)\b/i.test(tail),outdoor=/\b(?:OUTDOOR|OUT|SCOPERTO)\b/i.test(tail);
  return {number:Number(m[1]),cover:indoor===outdoor?'':indoor?'coperto':'scoperto'};
 }
 function courtInfo(cell){
  let row=cell;
  for(let i=0;row&&i<7;i++,row=row.parentElement){
   if(!row.classList.contains('flex')||!row.classList.contains('border-b'))continue;
   // Solo fratelli della colonna che contiene la fascia: evita testo del calendario o tooltip estranei.
   const column=Array.from(row.children).find(n=>n.contains(cell));
   if(!column)return null;
   const left=[];
   for(let n=column.previousElementSibling;n;n=n.previousElementSibling)left.push(n);
   const found=[];
   for(const label of left){
    if(!label.getClientRects().length)continue;
    const sources=[label,...Array.from(label.querySelectorAll('[title],[aria-label],span,p')).slice(0,20)];
    for(const n of sources){
     if(!n.getClientRects().length)continue;
     for(const raw of [n.getAttribute('title'),n.getAttribute('aria-label'),n.innerText]){
      const value=normalizedCourt(raw);
      if(value)found.push(value);
     }
    }
   }
   const numbers=[...new Set(found.map(x=>x.number))];
   if(numbers.length!==1)return null;
   const covers=[...new Set(found.map(x=>x.cover).filter(Boolean))];
   return {number:numbers[0],cover:covers.length===1?covers[0]:''};
  }
  return null;
 }
 function courtLabel(cell){
  const value=courtInfo(cell);
  return value?'CAMPO '+value.number+(value.cover==='coperto'?' INDOOR':value.cover==='scoperto'?' OUT':''):'';
 }
 function makeSlotLine(fields,court){
  // Non interpretare unità ignote o durate diverse da quelle effettivamente offerte.
  const m=fields.time.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::00)?$/);
  const d=fields.duration.match(/^(60|90|120)(?: ?(?:min|minutes))?$/i);
  if(!m||!d||fields.sport.toLowerCase()!=='padel'||!court)return '';
  const start=Number(m[1])*60+Number(m[2]),end=start+Number(d[1]);
  if(end>=1440)return '';
  const hm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const cover=/\b(?:indoor|coperto)\b/i.test(court)?'coperto':/\b(?:outdoor|out|scoperto)\b/i.test(court)?'scoperto':'';
  return [court,hm(start),hm(end),cover,'slot'].join(';');
 }
 function visibleHeroLines(root,req){
  const out=new Set();
  let seen=0,unrecognized=0;
  const target=String(req.time).match(/^(\d{2}):(\d{2})$/);
  if(!target)return {lines:[],seen,unrecognized};
  const targetMin=Number(target[1])*60+Number(target[2]);
  // Solo le offerte bianche del calendario già reso. Non fa richieste e non naviga.
  for(const el of root.querySelectorAll('[data-slot-id][data-tracking-property-time][data-tracking-property-duration][data-tracking-property-sport]')){
   if(!el.classList.contains('bg-white')||!el.classList.contains('cursor-pointer')||!el.getClientRects().length)continue;
   const cs=getComputedStyle(el);if(cs.visibility!=='visible'||cs.display==='none'||Number(cs.opacity)===0)continue;
   const column=el.closest('.overflow-x-hidden');if(!column)continue;
   const a=el.getBoundingClientRect(),b=column.getBoundingClientRect();
   if(a.width<=0||a.height<=0||a.left<b.left-1||a.right>b.right+1||a.top<b.top-1||a.bottom>b.bottom+1)continue;
   const f=slotFields(el),court=courtLabel(el);
   seen++;
   if(!f.time||!f.duration||!f.sport||!court){unrecognized++;continue;}
   const d=f.duration.match(/^(60|90|120)(?: ?(?:min|minutes))?$/i);
   const t=f.time.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::00)?$/);
   if(!d||!t||f.sport.toLowerCase()!=='padel'){unrecognized++;continue;}
   if(Number(d[1])!==req.duration||Math.abs(Number(t[1])*60+Number(t[2])-targetMin)>req.tolerance)continue;
   const line=makeSlotLine(f,court);if(line)out.add(line);
  }
  return {lines:[...out].slice(0,100),seen,unrecognized};
 }
 const controls=document.createElement('div');controls.hidden=true;
 const choose=document.createElement('select'),coverSelect=document.createElement('select'),verified=document.createElement('input');
 choose.setAttribute('aria-label','Campo della fascia selezionata');
 coverSelect.setAttribute('aria-label','Copertura del campo');
 verified.type='checkbox';
 function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
 option(choose,'','Seleziona campo');
 for(let n=1;n<=12;n++)option(choose,String(n),'Campo '+n);
 option(coverSelect,'','Copertura da verificare');option(coverSelect,'coperto','Coperto');option(coverSelect,'scoperto','Scoperto');
 const verifyLabel=document.createElement('label');verifyLabel.style.display='block';verifyLabel.append(verified,document.createTextNode(' Ho verificato il campo e la fascia visibile'));
 controls.append(choose,coverSelect,verifyLabel);
 function refreshSlot(){
  const court=choose.value?'CAMPO '+choose.value+(coverSelect.value==='coperto'?' INDOOR':coverSelect.value==='scoperto'?' OUT':''):'';
  slotLine=selectedFields&&verified.checked?makeSlotLine(selectedFields,court):'';
  copySlot.disabled=!slotLine;
 }
 for(const field of [choose,coverSelect])field.onchange=()=>{verified.checked=false;refreshSlot();};
 verified.onchange=refreshSlot;
 function describe(el){
  const lines=['Padel Booking Leon v1.27 — Playtomic: struttura della cella visibile','Solo metadati della cella selezionata, ora/durata/sport con formati ammessi e titolo del campo. Nessun ID privato o dato di sessione.'];
  const fields=slotFields(el),court=courtLabel(el);
  lines.push('Orario (valore consentito): '+(fields.time||'formato non riconosciuto'),'Durata (valore consentito): '+(fields.duration||'formato non riconosciuto'),'Sport: '+(fields.sport||'non riconosciuto'),'Campo: '+(court||'non riconosciuto'),'ID fascia: '+(el.hasAttribute('data-slot-id')?'presente (valore omesso)':'assente'));
  for(let n=el,depth=0;n instanceof Element&&n!==document.body&&depth<7;n=n.parentElement,depth++){
   const r=n.getBoundingClientRect(),cs=getComputedStyle(n);
   const classes=Array.from(n.classList).slice(0,12).map(safeName).join(' ');
   const attrs=Array.from(n.attributes).filter(a=>/^(data-|aria-|role$)/.test(a.name)).map(a=>safeName(a.name)).slice(0,15).join(', ');
   const bg=/^rgba?\([\d.,\s]+\)$/.test(cs.backgroundColor)?cs.backgroundColor:'non rilevato';
   lines.push(depth+': '+safeName(n.tagName.toLowerCase())+' class=['+classes+'] attributi=['+attrs+'] '+Math.round(r.width)+'x'+Math.round(r.height)+' bg='+bg);
  }
  return lines.join('\n');
 }
 function move(e){if(armed&&e.target instanceof Element&&e.target!==host&&!host.contains(e.target))target=e.target;}
 function key(e){
  if(!armed||e.key!=='F8')return;
  e.preventDefault();e.stopPropagation();armed=false;
  if(!target||!target.isConnected||target===host||!target.getClientRects().length){msg.textContent='Nessuna cella visibile selezionata. Riprovare.';return;}
  const cell=target.closest('[data-slot-id][data-tracking-property-time][data-tracking-property-duration][data-tracking-property-sport]');
  if(!cell||!cell.classList.contains('bg-white')||!cell.classList.contains('cursor-pointer')||!cell.getClientRects().length){msg.textContent='Cella libera non riconosciuta. Selezioni una fascia bianca.';return;}
  report=describe(cell);selectedFields=slotFields(cell);const info=courtInfo(cell);
  choose.value=info?String(info.number):'';coverSelect.value=info?.cover||'';verified.checked=false;
  controls.hidden=false;copy.disabled=false;target=null;refreshSlot();
  msg.textContent=(info?'Campo '+info.number+' individuato: verifichi la selezione.':'Campo non riconosciuto automaticamente: selezioni il numero leggendo la riga del calendario.')+' · Ora '+(selectedFields.time||'non riconosciuta')+' · Durata '+(selectedFields.duration||'non riconosciuta');
 }
 arm.onclick=()=>{armed=true;target=null;report='';slotLine='';selectedFields=null;controls.hidden=true;verified.checked=false;copy.disabled=true;copySlot.disabled=true;msg.textContent='Sposta il mouse sopra una cella bianca libera del calendario e premi F8, senza cliccare il portale.';};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(report);msg.textContent='Diagnosi copiata.';}catch(e){msg.textContent='Copia non riuscita: riprova.';}};
 copySlot.onclick=async()=>{if(!slotLine)return;try{await navigator.clipboard.writeText(slotLine);msg.textContent='Fascia copiata. Incollala in Importa fasce Playtomic, confermando la data.';}catch(e){msg.textContent='Copia non riuscita: riprova.';}};
 close.onclick=()=>{armed=false;document.removeEventListener('pointerover',move,true);document.removeEventListener('keydown',key,true);host.remove();};
 const auto=document.createElement('button'),reqText=document.createElement('p');
 auto.textContent='Importa disponibilità in Leon';auto.disabled=true;
 reqText.textContent='Apra questo calendario dalla ricerca di Padel Booking Leon per trasferire le fasce senza copiare.';
 const CHANNEL='pbl-playtomic-chrome-v1';
 let request=null;
 function send(kind,payload){return new Promise(resolve=>{
  try{chrome.runtime.sendMessage({channel:CHANNEL,kind,payload},r=>resolve(chrome.runtime.lastError?{ok:false,error:chrome.runtime.lastError.message}:r||{ok:false,error:'Estensione non disponibile'}));}catch(e){resolve({ok:false,error:e.message});}
 });}
 function dateText(d){return d.split('-').reverse().join('/');}
 send('hero-context').then(r=>{
  if(!r.ok||!r.data)return;
  request=r.data;reqText.textContent='Ricerca Leon: '+dateText(request.date)+' · '+request.time+' · '+request.duration+' min ± '+request.tolerance+' min. Selezioni questo giorno nel calendario.';
  auto.disabled=false;
 });
 auto.onclick=async()=>{
  if(!request||!window.confirm('Il calendario Playtomic mostra il '+dateText(request.date)+'? Confermi solo se la data è esatta e il caricamento è terminato.'))return;
  auto.disabled=true;
  try{
   const result=visibleHeroLines(document,request);
   const response=await send('hero-import',{key:request.key,date:request.date,lines:result.lines,seen:result.seen,unrecognized:result.unrecognized});
   msg.textContent=response.ok?(response.count?response.count+' fasce trasferite in Leon. Prezzi da confermare sul portale.':'Nessuna fascia compatibile riconosciuta. Controlli il calendario.'):response.error;
  }catch(e){msg.textContent='Importazione non riuscita: '+e.message;}
  finally{auto.disabled=false;}
 };
 box.append(heading,reqText,auto,msg,arm,controls,copy,copySlot,close);root.append(style,box);document.body.append(host);
 document.addEventListener('pointerover',move,true);document.addEventListener('keydown',key,true);
})();
