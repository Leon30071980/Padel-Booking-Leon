/* Padel Booking Leon v1.25: diagnosi manuale del calendario visibile.
 * Nessuna chiamata di rete, nessun click sul portale, nessun dato di sessione. */
(()=>{
 'use strict';
 if(location.origin!=='https://playtomic.com'||location.pathname.replace(/\/$/,'')!=='/clubs/padel-hero-parma')return;
 let armed=false,target=null,report='',slotLine='';
 const host=document.createElement('div');
 host.style.cssText='position:fixed;bottom:14px;right:14px;z-index:2147483646;max-width:320px';
 const root=host.attachShadow({mode:'closed'});
 const style=document.createElement('style');
 style.textContent='section{font:13px/1.4 system-ui,sans-serif;background:#10271e;color:#e9f6ec;border:1px solid #91d48f;border-radius:10px;padding:10px;box-shadow:0 4px 18px #0005}button{font:inherit;color:#e9f6ec;background:#214a35;border:1px solid #84aa88;border-radius:6px;padding:6px;margin:3px;cursor:pointer}button:disabled{opacity:.5}p{margin:6px 0}';
 const box=document.createElement('section'),heading=document.createElement('strong'),msg=document.createElement('p');
 heading.textContent='Padel Booking Leon · v1.25';msg.textContent='Diagnosi del calendario: nessuna prenotazione o lettura API.';
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
 function courtLabel(cell){
  // Solo il titolo del campo dentro la riga selezionata; nessuna lettura della pagina intera.
  let row=cell;
  for(let i=0;row&&i<6;i++,row=row.parentElement){
   if(!row.classList.contains('flex')||!row.classList.contains('border-b'))continue;
   const first=row.firstElementChild;
   if(!first||first.contains(cell))return '';
   const v=String(first.textContent||'').trim().replace(/\s+/g,' ');
   return /^CAMPO\s+\d{1,2}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9()._-]+)*$/i.test(v)&&v.length<=65?v:'';
  }
  return '';
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
 function describe(el){
  const lines=['Padel Booking Leon v1.25 — Playtomic: struttura della cella visibile','Solo metadati della cella selezionata, ora/durata/sport con formati ammessi e titolo del campo. Nessun ID privato o dato di sessione.'];
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
  report=describe(cell);slotLine=makeSlotLine(slotFields(cell),courtLabel(cell));copy.disabled=false;copySlot.disabled=!slotLine;target=null;
  msg.textContent=slotLine?'Diagnosi pronta. Fascia copiabile: '+slotLine+' · verificare la data sul calendario.':'Diagnosi pronta; formato orario/durata/campo da verificare. Copi la diagnosi.';
 }
 arm.onclick=()=>{armed=true;target=null;report='';slotLine='';copy.disabled=true;copySlot.disabled=true;msg.textContent='Sposta il mouse sopra una cella bianca libera del calendario e premi F8, senza cliccare il portale.';};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(report);msg.textContent='Diagnosi copiata.';}catch(e){msg.textContent='Copia non riuscita: riprova.';}};
 copySlot.onclick=async()=>{if(!slotLine)return;try{await navigator.clipboard.writeText(slotLine);msg.textContent='Fascia copiata. Incollala in Importa fasce Playtomic, confermando la data.';}catch(e){msg.textContent='Copia non riuscita: riprova.';}};
 close.onclick=()=>{armed=false;document.removeEventListener('pointerover',move,true);document.removeEventListener('keydown',key,true);host.remove();};
 box.append(heading,msg,arm,copy,copySlot,close);root.append(style,box);document.body.append(host);
 document.addEventListener('pointerover',move,true);document.addEventListener('keydown',key,true);
})();
