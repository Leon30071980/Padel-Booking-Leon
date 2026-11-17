/* Padel Booking Leon v1.24: diagnosi manuale del calendario visibile.
 * Nessuna chiamata di rete, nessun click sul portale, nessun dato di sessione. */
(()=>{
 'use strict';
 if(location.origin!=='https://playtomic.com'||location.pathname.replace(/\/$/,'')!=='/clubs/padel-hero-parma')return;
 let armed=false,target=null,report='';
 const host=document.createElement('div');
 host.style.cssText='position:fixed;bottom:14px;right:14px;z-index:2147483646;max-width:320px';
 const root=host.attachShadow({mode:'closed'});
 const style=document.createElement('style');
 style.textContent='section{font:13px/1.4 system-ui,sans-serif;background:#10271e;color:#e9f6ec;border:1px solid #91d48f;border-radius:10px;padding:10px;box-shadow:0 4px 18px #0005}button{font:inherit;color:#e9f6ec;background:#214a35;border:1px solid #84aa88;border-radius:6px;padding:6px;margin:3px;cursor:pointer}button:disabled{opacity:.5}p{margin:6px 0}';
 const box=document.createElement('section'),heading=document.createElement('strong'),msg=document.createElement('p');
 heading.textContent='Padel Booking Leon · v1.24';msg.textContent='Diagnosi del calendario: nessuna prenotazione o lettura API.';
 const arm=document.createElement('button'),copy=document.createElement('button'),close=document.createElement('button');
 arm.textContent='Analizza una cella';copy.textContent='Copia diagnosi';copy.disabled=true;close.textContent='×';close.title='Chiudi assistente';
 function safeName(s){return /^[a-z][a-z0-9_:-]{0,59}$/i.test(s)&&!/secret|auth|token|cookie|session|password|email|user|account|phone/i.test(s)?s:'[omesso]';}
 function describe(el){
  const lines=['Padel Booking Leon v1.24 — Playtomic: struttura della cella visibile','Solo tag, classi, nomi di attributi e geometria. Nessun testo o valore privato.'];
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
  report=describe(target);copy.disabled=false;target=null;msg.textContent='Diagnosi pronta. Copiala e condividila nella chat; non sono stati letti contenuti o dati di accesso.';
 }
 arm.onclick=()=>{armed=true;target=null;report='';copy.disabled=true;msg.textContent='Sposta il mouse sopra una cella bianca libera del calendario e premi F8, senza cliccare il portale.';};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(report);msg.textContent='Diagnosi copiata.';}catch(e){msg.textContent='Copia non riuscita: riprova.';}};
 close.onclick=()=>{armed=false;document.removeEventListener('pointerover',move,true);document.removeEventListener('keydown',key,true);host.remove();};
 box.append(heading,msg,arm,copy,close);root.append(style,box);document.body.append(host);
 document.addEventListener('pointerover',move,true);document.addEventListener('keydown',key,true);
})();
