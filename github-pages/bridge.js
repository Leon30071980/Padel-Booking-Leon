/* Padel Booking Leon v1.9 — browser bridge: no public credentials or API tokens. */
(function(){
  'use strict';
  const CHANNEL='pbl-google-bridge-v1';
  const STORE='pbl.webAppUrl';
  const CONNECT_TIMEOUT=24000;
  const REQUEST_TIMEOUT=90000;
  const allowedActions=new Set([
    'getDashboard','getOpeningPreview','searchAvailability','createRequest',
    'saveClubRule','getRequestDetail','cancelRequest','checkPublicPortal',
    'installScheduler','removeScheduler','saveWansportCredentials',
    'testWansportConnection','deleteWansportCredentials','testPlaytomicConnection','getCourtDetails','saveCourtDetails'
  ]);
  let url=localStorage.getItem(STORE)||'';
  let iframe=null, nonce='', remoteWindow=null, remoteOrigin='', connecting=null;
  let nextId=0;
  const pending=new Map();
  const $=id=>document.getElementById(id);
  function validUrl(candidate){
    try{
      const u=new URL(candidate);
      return u.protocol==='https:'&&u.hostname==='script.google.com'&&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&
        !u.search&&!u.hash;
    }catch{return false;}
  }
  function validGoogleOrigin(origin){
    try{
      const u=new URL(origin);
      return u.protocol==='https:'&&
        (u.hostname==='script.google.com'||u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'));
    }catch{return false;}
  }
  // Il modulo è visibile soltanto quando serve o quando l'utente lo riapre.
  function panelVisible(open){
    const panel=$('backendPanel'),button=$('backendSettingsBtn');
    panel.hidden=!open;
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('title',open?'Nascondi impostazioni Google':'Mostra impostazioni Google');
  }
  function setStatus(message,ready){
    $('bridgeStatus').textContent=message;
    $('bridgeStatus').className=ready?'ready':'';
    $('bridgeNote').textContent=ready?
      'Collegamento privato attivo. La ricerca resta di sola lettura; non vengono effettuate prenotazioni.':
      message==='Non collegato'?
        'Inserisca l’URL /exec di un deployment di tipo App web, non un URL /library/.':
        'Se non si collega, apra la Web App Google in una scheda, acceda con il Suo account e riprovi. Alcuni browser bloccano i cookie di terze parti.';
    panelVisible(!ready);
  }
  function reset(message){
    for(const [id,p] of pending){clearTimeout(p.timer);p.reject(Error('Collegamento Google interrotto.'));pending.delete(id);}
    remoteWindow=null;remoteOrigin='';
    if(iframe){iframe.remove();iframe=null;}
    connecting=null;
    if(message)setStatus(message,false);
  }
  function newNonce(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
  function connect(candidate){
    if(!validUrl(candidate))return Promise.reject(Error('URL non valido: utilizzi il collegamento App web /exec copiato da Google.'));
    if(connecting&&url===candidate)return connecting;
    if(remoteWindow&&url===candidate)return Promise.resolve();
    reset();
    url=candidate;
    localStorage.setItem(STORE,url);
    $('bridgeUrl').value=url;
    $('bridgeOpenGoogle').href=url;
    nonce=newNonce();
    setStatus('Collegamento…',false);
    const frame=document.createElement('iframe');
    frame.title='Collegamento privato Google Apps Script';
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:absolute;top:-5000px;left:-5000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    // Il nonce rende univoca la stretta di mano anche con HTMLService annidato.
    frame.src=url+'?bridge=1&nonce='+nonce;
    iframe=frame;
    document.body.appendChild(frame);
    connecting=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        if(!remoteWindow){setStatus('Google non raggiungibile',false);
          connecting=null;
          reject(Error('Il ponte Google non risponde: verificare che /exec sia una App web privata, effettuare accesso Google e controllare i cookie di terze parti.'));
        }
      },CONNECT_TIMEOUT);
      // La callback viene attivata solo dal messaggio autenticato del documento ponte.
      connectDone=()=>{clearTimeout(timer);connecting=null;resolve();};
    });
    return connecting;
  }
  let connectDone=null;
  window.addEventListener('message',event=>{
    const msg=event.data;
    if(!msg||typeof msg!=='object'||msg.channel!==CHANNEL||msg.nonce!==nonce)return;
    // HTMLService esegue gli script in iframe di googleusercontent.com annidati.
    // Il nonce casuale impedisce a un iframe Google estraneo di spacciarsi per il ponte.
    if(!validGoogleOrigin(event.origin))return;
    if(msg.kind==='ready'&&iframe){
      remoteWindow=event.source;
      remoteOrigin=event.origin;
      setStatus('Google collegato',true);
      if(connectDone){const cb=connectDone;connectDone=null;cb();}
      return;
    }
    if(msg.kind!=='result'||!remoteWindow||event.source!==remoteWindow||event.origin!==remoteOrigin)return;
    const p=pending.get(msg.id);
    if(!p)return;
    clearTimeout(p.timer);pending.delete(msg.id);
    if(msg.ok===true)p.resolve(msg.data);
    else p.reject(Error(typeof msg.error==='string'?msg.error:'Operazione non riuscita.'));
  });
  async function call(action,...args){
    if(!allowedActions.has(action))throw Error('Operazione non autorizzata dal frontend.');
    if(!validUrl(url))throw Error('Prima colleghi la Web App Google nel riquadro in alto.');
    if(!remoteWindow)await (connecting||connect(url));
    if(!remoteWindow)throw Error('Collegamento Google non disponibile.');
    const id=++nextId;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Google non ha risposto entro il tempo previsto.'));},REQUEST_TIMEOUT);
      pending.set(id,{resolve,reject,timer});
      try{remoteWindow.postMessage({channel:CHANNEL,nonce,kind:'call',id,action,args},remoteOrigin);}
      catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
    });
  }
  function init(){
    const form=$('bridgeForm');
    $('backendSettingsBtn').addEventListener('click',()=>{
      const open=$('backendPanel').hidden;
      // Non nascondere le impostazioni se manca ancora il collegamento.
      panelVisible(open||!remoteWindow);
      if(open)$('bridgeUrl').focus();
    });
    $('bridgeUrl').value=url;
    if(validUrl(url)){
      $('bridgeOpenGoogle').href=url;
      connect(url).catch(()=>{});
    }else{url='';setStatus('Non collegato',false);}
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const candidate=$('bridgeUrl').value.trim();
      $('bridgeConnectBtn').disabled=true;
      connect(candidate).catch(err=>{setStatus('Connessione non riuscita',false);$('bridgeNote').textContent=err.message;})
        .finally(()=>{$('bridgeConnectBtn').disabled=false;if(remoteWindow)document.dispatchEvent(new CustomEvent('pbl-backend-connected'));});
    });
  }
  window.PBL_BACKEND={call,connect,validUrl};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
