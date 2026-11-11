/* Padel Booking Leon v1.20 — assistente prenotazione Pro Padel su Wansport.
 * Opera soltanto nella scheda Wansport scelta dall'utente. Nessuna chiamata
 * di rete, nessuna prenotazione senza clic e conferma espliciti dell'utente.
 * NON tenta pagamenti online; fallisce in modo sicuro se il DOM è ambiguo.
 */
(()=>{
  'use strict';
  const CHANNEL='pbl-playtomic-chrome-v1';
  if(location.protocol!=='https:'||location.hostname!=='propadelclub.wansport.com')return;
  const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno',
    'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const allowedDurations=new Set([60,90,120]);
  let info=null,modal=null,host=null,shadow=null,status=null,summary=null;
  let prepButton=null,bookButton=null,manualBox=null,manualLabel=null;
  let submitted=false,prepared=false,privacyManual=false,dismissed=false,scheduled=false;
  let oldGuide=null,oldDisplay='';
  const text=el=>String(el?.textContent||'');
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9:]+/g,' ').replace(/\s+/g,' ').trim();
  const visible=el=>!!el&&!el.closest?.('[hidden],[aria-hidden="true"]')&&
    (!el.getClientRects||el.getClientRects().length>0);
  const exactDuration=(s,min)=>{
    const t=clean(s).replace(/\s+/g,' ');
    const patterns={
      60:/^(?:1(?::00)?|60\s*min(?:uti)?)(?:\s*ora)?$/,
      90:/^(?:1:30|1h30|90\s*min(?:uti)?)(?:\s*ora)?$/,
      120:/^(?:2(?::00)?|120\s*min(?:uti)?)(?:\s*ore?)?$/
    };
    return patterns[min]?.test(t)||false;
  };
  function locateModal(){
    const options=[...document.querySelectorAll('.modal,[role="dialog"],.ui-dialog')].filter(el=>{
      if(!visible(el))return false;
      const t=clean(text(el).slice(0,900));
      return t.includes('nuova prenotazione')&&t.includes('scegli la durata')&&
        t.includes('riepilogo costi');
    });
    if(options.length)return options.sort((a,b)=>text(a).length-text(b).length)[0];
    const headers=[...document.querySelectorAll('h1,h2,h3,h4,h5,.modal-title,.modal-header')];
    for(const header of headers){
      if(!visible(header)||!clean(text(header).slice(0,120)).includes('nuova prenotazione'))continue;
      for(let ancestor=header.parentElement,depth=0;ancestor&&depth<7;ancestor=ancestor.parentElement,depth++){
        const t=clean(text(ancestor).slice(0,1800));
        if(t.includes('scegli la durata')&&t.includes('riepilogo costi')&&
          ancestor!==document.body&&ancestor!==document.documentElement)return ancestor;
      }
    }
    return null;
  }
  function closestAction(el,root){
    for(let n=el;n&&n!==root;n=n.parentElement){
      if(n.matches?.('button,a,[role="button"],label,[onclick],input[type="radio"]'))return n;
      // Alcuni widget Wansport utilizzano tile DIV cliccabili.
      if(n.matches?.('div,span')&&/\b(?:durata|duration|durat|btn|option|opzione|time)\b/i
          .test(String(n.className||'').replace(/[-_]/g,' '))&&text(n).length<70)return n;
    }
    return el;
  }
  function uniqueAction(root,predicate){
    const hits=new Set();
    for(const el of root.querySelectorAll('button,a,label,[role="button"],[onclick],div,span')){
      if(!visible(el)||text(el).length>100||!predicate(clean(text(el)),el))continue;
      const action=closestAction(el,root);
      if(visible(action)&&root.contains(action))hits.add(action);
    }
    // Elimina figli duplicati della medesima azione.
    const values=[...hits];
    const parents=values.filter(e=>!values.some(other=>other!==e&&e.contains?.(other)));
    return parents.length===1?parents[0]:null;
  }
  function durationAction(root){
    return uniqueAction(root,(label)=>exactDuration(label,info.duration));
  }
  function privacyAction(root){
    return uniqueAction(root,label=>label==='attivita privata');
  }
  function selected(el){
    if(!el)return null;
    for(const node of [el,el.parentElement]){
      if(!node||node===modal)break;
      const aria=node.getAttribute?.('aria-pressed')||node.getAttribute?.('aria-checked')||
        node.getAttribute?.('aria-selected');
      if(aria==='true')return true;
      if(aria==='false')return false;
      if(node.matches?.('input[type="radio"],input[type="checkbox"]'))return !!node.checked;
      const classes=String(node.className||'');
      if(/(?:^|\s)(?:active|selected|checked|on|btn-success|btn-primary)(?:\s|$)/i.test(classes))return true;
    }
    return null;
  }
  function officialButton(root){
    const nodes=[...root.querySelectorAll('button,a,[role="button"],[onclick],div,span')];
    const hits=new Set();
    for(const el of nodes){
      if(!visible(el))continue;
      const label=clean(text(el));
      if(label.length>150||!label.includes('prenota')||
         !/(?:paga al centro|contanti o carta)/.test(label)||label.includes('online'))continue;
      const action=closestAction(el,root);
      if(visible(action)&&root.contains(action))hits.add(action);
    }
    const choices=[...hits].filter(n=>![...hits].some(x=>x!==n&&n.contains?.(x)));
    return choices.length===1?choices[0]:null;
  }
  function readCost(root){
    const match=text(root).match(/totale\s+costo\s+prenotazione\s*€\s*([0-9][0-9.,]*)/i);
    return match?'€ '+match[1]:'';
  }
  function identity(root){
    const raw=clean(text(root).slice(0,1000));
    const requested=new Date(info.date+'T12:00:00');
    const dateOk=Number.isFinite(requested.getTime())&&
      new RegExp('(?:^|\\s)'+requested.getDate()+'(?:\\s|$)').test(raw)&&
      raw.includes(MONTHS[requested.getMonth()]);
    const court=clean(info.court);
    const courtOk=court.length>=6&&raw.includes(court);
    const startOk=raw.includes('dalle '+info.start);
    const endOk=raw.includes('alle '+info.end);
    const price=readCost(root);
    const privacy=selected(privacyAction(root));
    return {dateOk,courtOk,startOk,endOk,price,privacy,
      action:officialButton(root),durAction:durationAction(root)};
  }
  function label(msg,kind='info'){
    if(status){status.textContent=msg;status.dataset.kind=kind;}
  }
  function render(){
    if(!host||!modal||submitted)return;
    const s=identity(modal);
    const privateOk=s.privacy===true||privacyManual===true;
    const ready=prepared&&s.dateOk&&s.courtOk&&s.startOk&&s.endOk&&
      !!s.price&&privateOk&&!!s.action&&!s.action.disabled;
    summary.textContent='Campo: '+info.court+'\n'+info.date+' · '+info.start+'–'+info.end+
      ' · '+info.duration+' min\nCosto Wansport: '+(s.price||'da verificare');
    manualLabel.hidden=s.privacy===true;
    bookButton.disabled=!ready;
    if(prepared){
      if(ready)label('Durata, data, campo, orario finale e costo verificati. Può confermare la prenotazione.','ok');
      else{
        const missing=[];
        if(!s.dateOk)missing.push('data');
        if(!s.courtOk)missing.push('campo');
        if(!s.startOk)missing.push('ora iniziale');
        if(!s.endOk)missing.push('durata/ora finale');
        if(!s.price)missing.push('costo');
        if(!privateOk)missing.push('attività privata (spuntare verifica manuale)');
        if(!s.action)missing.push('pulsante Prenota al centro');
        label('Impossibile confermare: '+missing.join(', ')+'. Controlli il portale.','warning');
      }
    }
  }
  function prepare(){
    if(submitted||!modal)return;
    const s=identity(modal);
    // Bloccare ogni azione se data, campo e ora iniziale differiscono.
    if(!s.dateOk||!s.courtOk||!s.startOk){
      prepared=true;render();return;
    }
    if(!s.endOk){
      if(!s.durAction){
        prepared=true;render();return;
      }
      s.durAction.click();
    }
    const p=privacyAction(modal);
    if(p&&selected(p)!==true)p.click();
    prepared=true;
    label('Verifica aggiornamento durata e modalità privata nel riepilogo Wansport…');
    setTimeout(render,450);
  }
  function finalBooking(){
    if(submitted||!modal)return;
    const s=identity(modal);
    if(!prepared||!s.dateOk||!s.courtOk||!s.startOk||!s.endOk||!s.price||
       !(s.privacy===true||privacyManual)||!s.action||s.action.disabled){
      render();return;
    }
    const message='Confermare la prenotazione reale su Wansport?\n\n'+
      info.court+'\n'+info.date+' · '+info.start+'–'+info.end+'\n'+
      'Durata: '+info.duration+' minuti\nTotale visualizzato: '+s.price+'\n'+
      'Attività privata; pagamento AL CENTRO (non online).\n\n'+
      'Questa operazione può comportare un impegno economico. Non verrà ripetuta automaticamente.';
    if(!window.confirm(message)){label('Prenotazione non inviata: conferma annullata.','warning');return;}
    // Ricontrollo dopo la finestra di conferma, perché la pagina può cambiare.
    if(locateModal()!==modal)return void label('La finestra Wansport è cambiata. Nessun invio.','warning');
    const latest=identity(modal);
    if(!latest.dateOk||!latest.courtOk||!latest.startOk||!latest.endOk||
      latest.price!==s.price||latest.action!==s.action||
      !(latest.privacy===true||privacyManual)||latest.action.disabled)
      return void label('I dati sono cambiati. Nessun invio: ripeta la verifica.','warning');
    submitted=true;
    prepButton.disabled=true;bookButton.disabled=true;manualBox.disabled=true;
    latest.action.click();
    label('Clic inviato UNA SOLA VOLTA. Verifico se Wansport mostra una conferma; non ritentare prima di controllare le prenotazioni.','warning');
    setTimeout(checkResult,900);
  }
  function checkResult(){
    if(!submitted)return;
    // Non dedurre l'esito dalla sola chiusura della finestra: potrebbe esserci un errore.
    const shown=clean(text(document.body).slice(-6000));
    if(/prenotazione (?:effettuata|confermata|completata|inserita)|prenotazione (?:avvenuta|eseguita) con successo/.test(shown)){
      label('Wansport mostra una conferma di prenotazione. Controlli il riepilogo sul portale.','ok');
    }else if(/prenotazione (?:non riuscita|fallita)|errore (?:durante|nella) prenotazione/.test(shown)){
      label('Wansport segnala un errore. Verifichi le prenotazioni prima di qualsiasi nuovo tentativo.','warning');
    }
  }
  function createUI(){
    host=document.createElement('div');host.id='pbl-booking-assistant';
    host.style.cssText='position:fixed;z-index:2147483647;top:12px;right:12px;width:min(340px,calc(100vw - 24px))';
    shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');
    style.textContent='*{box-sizing:border-box}section{font:13px/1.45 system-ui,sans-serif;'+
      'background:#103025;color:#ebfff1;border:1px solid #88b98a;border-radius:12px;'+
      'padding:12px;box-shadow:0 8px 28px #0008;max-height:80vh;overflow:auto}'+
      'h3{font-size:15px;color:#baff9f;margin:0 0 8px}pre{white-space:pre-wrap;font:inherit;'+
      'margin:6px 0 10px}p{margin:8px 0}p[data-kind=warning]{color:#ffcfaa}'+
      'p[data-kind=ok]{color:#c7ffbd}button{padding:8px 9px;margin:4px 4px 4px 0;'+
      'background:#226143;color:white;border:1px solid #a6c6aa;border-radius:7px;'+
      'font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}'+
      'button:focus-visible,input:focus-visible{outline:2px solid #baff9f}'+
      '.close{float:right;padding:0 7px}.check{display:block;margin-top:7px}small{color:#d8e5da}';
    const section=document.createElement('section');
    const close=document.createElement('button');close.className='close';close.textContent='×';
    close.title='Chiudi assistente prenotazione';close.onclick=()=>{
      dismissed=true;host.remove();host=null;restoreGuide();
    };
    const h=document.createElement('h3');h.textContent='🎾 Padel Booking Leon · v1.20';
    const intro=document.createElement('small');
    intro.textContent='Prenotazione assistita su Pro Padel. Prima la durata, poi conferma esplicita.';
    summary=document.createElement('pre');
    status=document.createElement('p');status.setAttribute('role','status');
    prepButton=document.createElement('button');prepButton.textContent='Imposta durata e privacy';
    prepButton.onclick=prepare;
    bookButton=document.createElement('button');bookButton.textContent='Prenota · paga al centro';
    bookButton.disabled=true;bookButton.onclick=finalBooking;
    manualLabel=document.createElement('label');manualLabel.className='check';
    manualBox=document.createElement('input');manualBox.type='checkbox';
    manualBox.onchange=()=>{privacyManual=manualBox.checked;render();};
    manualLabel.append(manualBox,document.createTextNode(' Ho verificato sul portale che è Attività privata'));
    section.append(close,h,intro,summary,status,prepButton,bookButton,manualLabel);
    shadow.append(style,section);document.body.append(host);
    label('Verifichi i dati e prema «Imposta durata e privacy».');
  }
  function restoreGuide(){
    if(oldGuide&&document.contains(oldGuide))oldGuide.style.display=oldDisplay;
    oldGuide=null;
  }
  function refresh(){
    const next=locateModal();
    if(!next){
      if(submitted){checkResult();return;}
      if(host){host.remove();host=null;}
      restoreGuide();modal=null;prepared=false;privacyManual=false;dismissed=false;
      return;
    }
    if(next!==modal){modal=next;prepared=false;privacyManual=false;dismissed=false;}
    if(dismissed||submitted)return;
    if(!host){
      oldGuide=document.getElementById('pbl-handoff-host');
      if(oldGuide){oldDisplay=oldGuide.style.display;oldGuide.style.display='none';}
      createUI();
    }
    render();
  }
  function watch(){
    const obs=new MutationObserver(records=>{
      if(records.every(m=>host?.contains(m.target)||oldGuide?.contains(m.target)))return;
      if(scheduled)return;
      scheduled=true;
      setTimeout(()=>{scheduled=false;refresh();},200);
    });
    obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,
      attributeFilter:['class','style','aria-pressed','aria-selected','aria-checked']});
    refresh();
  }
  function request(attempt=0){
    chrome.runtime.sendMessage({channel:CHANNEL,kind:'getHandoff'},reply=>{
      if(chrome.runtime.lastError||!reply?.ok){
        if(attempt<6)setTimeout(()=>request(attempt+1),400);
        return;
      }
      const i=reply.data;
      if(!i||i.club_id!=='pro'||!allowedDurations.has(i.duration)||!i.court||!i.date||
         !/^\d{2}:\d{2}$/.test(i.start)||!/^\d{2}:\d{2}$/.test(i.end))return;
      info=i;watch();
    });
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>request(),{once:true});
  else request();
})();
