
/* Padel Booking Leon — v1.14 | Apps Script HTMLService, nessuna password nel frontend. */
(()=>{
  'use strict';
  const $ = id=>document.getElementById(id);
  const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={clubs:[],jobs:[],schedulerActive:false,online:false,playtomicLive:false,courtDetails:new Map(),lastResults:[],quoteLoading:false,quoteProgress:0,quoteTotal:0};
  let quoteGeneration=0;
  let bookingSelection=null;
  let bookingCheckSerial=0;
  let toastTimer;
  function api(functionName,...args){
    return window.PBL_BACKEND.call(functionName,...args);
  }
  function toast(message,bad=false){const el=$('toast');el.textContent=message;el.className='toast show'+(bad?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',4800);}
  function romeDate(offsetDays=0){
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=k=>Number(p.find(x=>x.type===k).value),d=new Date(Date.UTC(v('year'),v('month')-1,v('day')+offsetDays));
    return d.toISOString().slice(0,10);
  }
  function prettyDate(v){if(!v)return '—';try{return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));}catch{return v;}}
  function prettyStamp(v){if(!v)return 'Da verificare';try{return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'}).format(new Date(v));}catch{return v;}}
  function clock(){$('romeClock').textContent=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}
  function connection(on,msg){state.online=on;const el=$('connection');el.className='connection '+(on?'online':'offline');el.innerHTML='<i></i> '+esc(msg);}
  function ruleLabel(c){return c.rule_type==='calendar_days'?`${c.advance_value} giorni prima · ${c.release_time}`:c.rule_type==='rolling_hours'?`${c.advance_value} ore prima della partita`:'Da verificare';}
  function choices(id){
    const previous=new Set(selected(id));
    $(id).innerHTML=state.clubs.map(c=>`<label class="choice"><input type="checkbox" value="${esc(c.id)}" ${previous.size?previous.has(c.id)?'checked':'':c.enabled?'checked':''} ${c.enabled?'':'disabled'}><span>${esc(c.name)}</span></label>`).join('');
    if(id==='jobClubChoices'){
      const hero=$(id).querySelector('input[value="hero"]');
      if(hero){hero.checked=false;hero.disabled=true;hero.closest('label').title='Padel Hero richiede Chrome attivo e non è programmabile sul backend cloud.';}
    }
  }
  function selected(id){return Array.from($(id).querySelectorAll('input:checked:not(:disabled)')).map(e=>e.value);}
  function renderClubs(){
    $('metricClubs').textContent=state.clubs.length;
    const verified=state.clubs.filter(c=>c.id==='hero'?state.playtomicLive:c.connector.ready).length;
    $('metricReady').innerHTML=verified+'<span class="metric-suffix"> / '+state.clubs.length+'</span>';
    $('clubGrid').innerHTML=state.clubs.map(c=>{
      const connected=c.platform==='Playtomic'?state.playtomicLive:c.connector.ready, configured=c.connector.configured;
      const isWS=c.platform==='Wansport';
      const status=isWS?(connected?'Ultimo calendario verificato':configured?'Credenziali inserite: verifica necessaria':'Configurare l’accesso'):(connected?'Calendario Playtomic letto da Chrome':window.PBL_CHROME?.installed()?'Estensione Chrome rilevata: verificare il calendario':'Estensione Chrome necessaria su questo dispositivo');
      return `<article class="club-card"><div class="club-top"><span class="platform-tag">${esc(c.platform)}</span><span class="club-priority">PRIORITÀ ${c.priority}</span></div>
      <h3>${esc(c.name)}</h3><div class="club-status ${connected?'ready':''}"><i></i>${esc(status)}</div>
      <div class="rule-details"><span>REGOLA DI APERTURA</span><strong>${esc(ruleLabel(c))}</strong></div>
      <div class="club-actions"><button type="button" class="btn btn-outline" data-edit-club="${esc(c.id)}">⚙ Regole</button><a class="btn btn-outline" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">↗ Sito</a></div>
      ${isWS?'<button type="button" class="mini-button probe" data-connect-wansport="'+esc(c.id)+'">🔐 Configura / prova Wansport</button>':'<button type="button" class="mini-button probe" data-playtomic-test="'+esc(c.id)+'">🧩 Verifica estensione Chrome</button>'}</article>`;
    }).join('');
    choices('searchClubChoices');choices('jobClubChoices');
  }
  const labels={pending:'Registrata',cancelled:'Annullata'};
  function renderJobs(){
    $('metricJobs').textContent=state.jobs.filter(j=>j.status==='pending').length;
    if(!state.jobs.length){$('jobsPanel').innerHTML='<div class="empty-state"><strong>Nessuna richiesta</strong><p>Imposti una data e salvi una richiesta.</p></div>';return;}
    $('jobsPanel').innerHTML='<div class="job-row header-row"><div>Partita</div><div>Centri</div><div>Modalità</div><div>Stato</div><div>Azioni</div></div>'+
      state.jobs.map(j=>{
        const due=j.clubs.filter(c=>c.next_at).sort((a,b)=>a.next_at.localeCompare(b.next_at))[0];
        const msg=due?`Apertura teorica ${prettyStamp(due.next_at)}`:'Nessun controllo eseguibile';
        const blocked=j.clubs.some(c=>c.state==='needs_connector');
        const found=j.clubs.some(c=>c.state==='found');
        const checked=j.clubs.some(c=>c.state==='checked_no_slots');
        return `<div class="job-row"><div class="job-main"><strong>${esc(prettyDate(j.match_date))} · ${esc(j.match_time)}</strong><small>${j.duration} min · ${esc(msg)}</small></div>
          <div class="job-cell">${j.clubs.length} centri<small>${j.clubs.map(c=>esc(c.name)).join(', ')}</small></div>
          <div class="job-cell">${j.mode==='auto'?'Auto futura (non attiva)':'Controllo di sola lettura'}<small>±${j.tolerance}m</small></div>
          <div><span class="status-badge warn">${found?'Slot trovati':blocked?'Controllo non riuscito':checked?'Nessuno slot':esc(labels[j.status]||j.status)}</span></div>
          <div class="job-actions"><button type="button" class="mini-button" data-detail="${esc(j.id)}">Dettagli</button>${j.status==='pending'?`<button type="button" class="mini-button danger" data-cancel="${esc(j.id)}">Annulla</button>`:''}</div></div>`;
      }).join('');
  }
  async function loadAll(){
    try{
      const data=await api('getDashboard');state.clubs=data.clubs;state.jobs=data.jobs;state.schedulerActive=data.schedulerActive;
      connection(true,'Google Drive collegato');renderClubs();renderJobs();schedulerState();await previewOpening();
    }catch(e){connection(false,'Configurazione richiesta');toast(e.message,true);}
  }
  function schedulerState(){$('schedulerStatus').textContent=state.schedulerActive?'Trigger attivo: un controllo reale in sola lettura all’apertura teorica.':'Trigger disattivato: nessuna ricerca programmata.';}
  async function previewOpening(){
    if(!state.online)return;
    const date=$('jobDate').value,time=$('jobTime').value;
    if(!date||!time)return;
    try{
      const data=await api('getOpeningPreview',date,time);const ids=selected('jobClubChoices');
      $('openingPreview').innerHTML=data.filter(r=>ids.includes(r.club_id)).map(r=>`<div><strong>${esc(state.clubs.find(c=>c.id===r.club_id)?.name||r.club_id)}:</strong> ${r.opening_at?esc(prettyStamp(r.opening_at)):'Regola non configurata'}</div>`).join('')||'Selezioni almeno un centro.';
    }catch(e){$('openingPreview').textContent=e.message;}
  }
  function detailKey(clubId,courtId){return String(clubId)+':'+String(courtId);}
  function courtLocation(s,id,note){
    if(note?.location)return note.location;
    if(s.location)return s.location;
    if(id==='hero')return 'San Prospero';
    if(id==='pro')return /vigatto/i.test(s.venue||'')?'Vigatto':/parma/i.test(s.venue||'')?'Parma':'Parma / Vigatto · sede da verificare';
    return 'Parma';
  }
  function renderResults(){
    $('searchResults').innerHTML=state.lastResults.map(r=>{
      const club=state.clubs.find(c=>c.id===r.club_id);
      const found=r.status==='available';
      const status={available:'Slot compatibili',no_slots:'Nessuno slot',outside_window:'Fuori finestra',
        auth_required:'Accesso richiesto',error:'Da verificare',not_configured:'Non collegato'}[r.status]||'Da verificare';
      const slots=(r.slots||[]).map(s=>{
        const note=state.courtDetails.get(detailKey(r.club_id,s.court_id));
        const location=courtLocation(s,r.club_id,note);
        const cover=note?.cover&&note.cover!=='unknown'?note.cover:(s.cover||'unknown');
        const roof=cover==='indoor'?'Coperto':cover==='outdoor'?'Scoperto':'Copertura da verificare';
        const price=s.quotePrice?String(s.quotePrice):s.price?String(s.price):
          note?.price?String(note.price).replace(/\s?€$/,'')+' €':
          s.quoteState==='loading'?'Calcolo in corso…':
          s.quoteState==='queued'?'In attesa…':'Da verificare';
        const origin=s.quotePrice?'Preventivo Wansport · profilo corrente':s.price?'Prezzo portale':
          note?.price?'Prezzo indicativo · nota personale':
          s.quoteState==='unavailable'?'Preventivo non disponibile':
          s.quoteState==='pending'?'Verifica non avviata':
          s.quoteState==='loading'||s.quoteState==='queued'?'Lettura automatica e sicura':'Prezzo non disponibile';
        return `<div class="slot-line">
          <div class="slot-heading"><strong>${esc(s.court)}</strong><span class="slot-time">${esc(s.start)}–${esc(s.end)}</span></div>
          <div class="slot-metadata">
            <span class="slot-chip">📍 ${esc(location)}</span>
            <span class="slot-chip">${esc(roof)}</span>
            <span class="slot-chip"><strong class="slot-price">${esc(price)}</strong> <small>${esc(origin)}</small></span>
          </div>
          <div class="slot-controls">
            <button type="button" data-edit-court="${esc(s.court_id)}" data-court-club="${esc(r.club_id)}">⚙ Dettagli</button>
            <button type="button" data-booking-court="${esc(s.court_id)}" data-booking-club="${esc(r.club_id)}" data-booking-start="${esc(s.start)}">Prenota ↗</button>
          </div></div>`;
      }).join('');
      return `<div class="result-row ${found?'found':''}"><div class="result-body"><strong>${esc(club?.name||r.club_id)}</strong>
        <small>${esc(r.reason)}</small>${slots?'<div class="slot-list">'+slots+'</div>':''}
        ${!found?`<a target="_blank" rel="noopener noreferrer" href="${esc(club?.url||'#')}">Apri il portale ↗</a>`:''}
        </div><span class="result-tag">${esc(status)}</span></div>`;
    }).join('');
  }

  function getBookingSlot(clubId,courtId,start){
    const row=state.lastResults.find(r=>r.club_id===clubId&&r.status==='available');
    return row?.slots?.find(s=>String(s.court_id)===String(courtId)&&s.start===start)||null;
  }
  function bookingStatus(message,level='info'){
    const el=$('bookingStatus');
    el.textContent=message;
    el.dataset.level=level;
  }
  function bookingText(){
    if(!bookingSelection)return '';
    const {club,slot,location,cover}=bookingSelection;
    const price=slot.quotePrice||slot.price||'da verificare sul portale';
    return ['Padel Booking Leon — richiesta di prenotazione','Centro: '+club.name,
      'Campo: '+slot.court,'Località: '+location,'Copertura: '+cover,
      'Data: '+slot.date,'Orario: '+slot.start+'–'+slot.end,
      'Durata: '+slot.duration+' minuti','Prezzo: '+price,
      'Portale: '+club.url,'La prenotazione NON è stata effettuata.'].join('\n');
  }
  function openBooking(clubId,courtId,start){
    const slot=getBookingSlot(clubId,courtId,start);
    const club=state.clubs.find(c=>c.id===clubId);
    if(!slot||!club)return toast('Fascia non più presente nella ricerca. Ripetere il controllo.',true);
    const note=state.courtDetails.get(detailKey(clubId,courtId));
    const location=courtLocation(slot,clubId,note);
    const cover=note?.cover&&note.cover!=='unknown'?note.cover:(slot.cover||'unknown');
    const roof=cover==='indoor'?'Coperto':cover==='outdoor'?'Scoperto':'Da verificare';
    const price=slot.quotePrice||slot.price||
      (note?.price?note.price+' € (indicativo)':'Da verificare sul portale');
    bookingSelection={club,slot,location,cover:roof};
    bookingCheckSerial++;
    $('bookingTitle').textContent=club.name;
    $('bookingSummary').innerHTML=[
      ['Campo',slot.court],['Sede',location],['Copertura',roof],['Data',slot.date],
      ['Orario',slot.start+'–'+slot.end],['Durata',slot.duration+' minuti'],['Prezzo',price]
    ].map(([k,v])=>'<div class="booking-summary-line"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('');
    $('bookingOpen').href=club.url;
    $('bookingOpen').textContent=club.id==='hero'?'Apri Playtomic ↗':'Apri fascia su Wansport ↗';
    $('bookingRecheck').disabled=false;
    bookingStatus('Disponibilità rilevata durante la ricerca, ma non riservata. Ricontrolli prima di procedere.');
    $('bookingDialog').showModal();
  }
  async function bookingRecheck(){
    if(!bookingSelection)return;
    const {club,slot}=bookingSelection;
    const serial=++bookingCheckSerial;
    const button=$('bookingRecheck');
    button.disabled=true;
    bookingStatus('Verifica della disponibilità aggiornata…');
    try{
      let confirmed=false,reason='';
      if(club.id==='hero'){
        const result=await window.PBL_CHROME.query({
          date:slot.date,time:slot.start,duration:Number(slot.duration),tolerance:0});
        confirmed=result.status==='available'&&result.slots.some(x=>
          x.court_id===slot.court_id&&x.start===slot.start&&x.duration===slot.duration);
        reason=result.reason||'';
      }else{
        const result=await api('getBookingPreflight',{
          club_id:club.id,court_id:String(slot.court_id),date:slot.date,
          start:slot.start,duration:Number(slot.duration)});
        confirmed=result.status==='available';
        reason=result.reason||'';
      }
      if(serial!==bookingCheckSerial)return;
      bookingStatus(confirmed?
        'Disponibilità confermata dal calendario. Non è una prenotazione: confermi e paghi sul portale ufficiale.':
        'Disponibilità non confermata. '+reason,confirmed?'ok':'warning');
    }catch(e){
      if(serial===bookingCheckSerial)bookingStatus('Impossibile verificare ora: '+e.message,'warning');
    }finally{if(serial===bookingCheckSerial)button.disabled=false;}
  }
  async function bookingOpenPortal(event){
    if(!bookingSelection)return;
    const {club,slot}=bookingSelection;
    if(club.platform!=='Wansport'){
      // Playtomic: link ufficiale, come in v1.13.
      return;
    }
    // Chrome richiede un'azione esplicita dell'utente; non si procede in background.
    if(!window.PBL_CHROME?.handoff||!window.PBL_CHROME.installed())return;
    event.preventDefault();
    const button=$('bookingOpen');
    button.textContent='Apertura…';
    try{
      await window.PBL_CHROME.handoff({
        club_id:club.id,court_id:String(slot.court_id),tslot_id:String(slot.tslot_id||''),
        court:slot.court,date:slot.date,start:slot.start,end:slot.end,
        duration:Number(slot.duration),price:String(slot.quotePrice||slot.price||'')
      });
      toast('Wansport aperto: la guida del campo è visibile sulla nuova scheda.');
    }catch(err){
      toast('Guida non disponibile: utilizzi il link ufficiale del circolo e selezioni lo slot manualmente.',true);
    }finally{
      button.textContent='Apri fascia su Wansport ↗';
    }
  }
  async function bookingCopy(){
    const content=bookingText();
    if(!content)return;
    try{await navigator.clipboard.writeText(content);toast('Riepilogo copiato. Nessuna prenotazione effettuata.');}
    catch(e){toast('Copia non disponibile: selezioni i dettagli manualmente.',true);}
  }
  function openCourtDetails(clubId,courtId){
    const r=state.lastResults.find(x=>x.club_id===clubId);
    const slot=r?.slots?.find(x=>String(x.court_id)===String(courtId));
    if(!slot)return;
    const note=state.courtDetails.get(detailKey(clubId,courtId));
    $('courtClubId').value=clubId;$('courtResourceId').value=courtId;$('courtDuration').value=String(slot.duration);
    $('courtDialogTitle').textContent=slot.court;
    $('courtLocation').value=note?.location||courtLocation(slot,clubId,null);
    $('courtCover').value=note?.cover||'unknown';
    $('courtPrice').value=note?.price||'';
    $('courtDialog').showModal();
  }
  async function saveCourt(e){
    e.preventDefault();
    const data={club_id:$('courtClubId').value,court_id:$('courtResourceId').value,
      location:$('courtLocation').value,cover:$('courtCover').value,price:$('courtPrice').value,
      duration:Number($('courtDuration').value)};
    try{
      const response=await api('saveCourtDetails',data);
      state.courtDetails.set(detailKey(data.club_id,data.court_id),response);
      $('courtDialog').close();renderResults();toast('Dettagli campo salvati nelle impostazioni private.');
    }catch(err){toast(err.message,true);}
  }
  async function search(e){
    e.preventDefault();const clubs=selected('searchClubChoices');if(!clubs.length)return toast('Selezioni almeno un centro.',true);
    const generation=++quoteGeneration;
    const btn=$('searchBtn');btn.disabled=true;$('searchResults').textContent='Controllo dei calendari abilitati…';
    try{
      const req={date:$('searchDate').value,time:$('searchTime').value,
        duration:Number($('searchDuration').value),tolerance:Number($('searchTolerance').value)};
      const otherClubs=clubs.filter(id=>id!=='hero');
      // Wansport resta sul backend Google; Playtomic viene letto SOLO nel Chrome locale.
      const work=clubs.map(id=>id==='hero'
        ?window.PBL_CHROME.query(req).catch(err=>({club_id:'hero',status:'error',slots:[],
          reason:err.message||'Estensione Chrome non disponibile.'}))
        :Promise.resolve(null));
      const remote=otherClubs.length?await api('searchAvailability',{...req,clubs:otherClubs}):{results:[]};
      const heroResults=await Promise.all(work);
      if(clubs.includes('hero'))state.playtomicLive=heroResults.some(r=>r&&r.club_id==='hero'&&['available','no_slots'].includes(r.status));
      const remoteById=new Map(remote.results.map(r=>[r.club_id,r]));
      const hero=heroResults.find(r=>r&&r.club_id==='hero');
      const results=clubs.map(id=>id==='hero'?hero:remoteById.get(id)).filter(Boolean);
      if(clubs.includes('hero'))renderClubs();
      state.lastResults=results;
      const keys=results.flatMap(r=>(r.slots||[]).map(slot=>({club_id:r.club_id,court_id:String(slot.court_id),duration:Number(slot.duration)})));
      const uniqueKeys=[...new Map(keys.map(k=>[detailKey(k.club_id,k.court_id),k])).values()];
      try{
        const notes=uniqueKeys.length?await api('getCourtDetails',uniqueKeys):[];
        state.courtDetails=new Map(notes.map(n=>[detailKey(n.club_id,n.court_id),n]));
      }catch(err){state.courtDetails=new Map();toast('Annotazioni campi non caricate: '+err.message,true);}
      // Le prime 9 disponibilità di Pro vengono quotate in 3 batch max.
      for(const r of results.filter(r=>r.club_id==='pro'))
        for(const slot of r.slots||[])slot.quoteState='pending';
      renderResults();
      // I calendari sono già visibili: il calcolo prezzi prosegue a piccoli gruppi.
      if(results.some(r=>r.club_id==='pro'&&r.status==='available')){
        loadAutomaticQuotes(generation).catch(err=>{
          if(generation===quoteGeneration)toast('Prezzi Pro Padel non disponibili: '+err.message,true);
        });
      }
      // Aggiorna gli stati dei collegamenti Wansport senza duplicare le richieste HTTP.
      if(clubs.some(id=>['gunners','pro','puntog'].includes(id)))await loadAll();
    }catch(e){toast(e.message,true);$('searchResults').textContent=e.message;}finally{btn.disabled=false;btn.textContent='⌕ Verifica disponibilità';}
  }
  // Prezzi recuperati progressivamente, evitando richieste per ogni singola card
  // in parallelo e mantenendo indipendenti i calendari Wansport / Chrome.
  async function loadAutomaticQuotes(generation){
    const row=state.lastResults.find(r=>r.club_id==='pro'&&r.status==='available');
    if(!row?.slots?.length)return;
    // Al massimo 9 preventivi per ricerca: 3 chiamate batch, per non saturare Wansport.
    const targets=row.slots.slice(0,9).filter(s=>[60,90,120].includes(Number(s.duration)));
    if(!targets.length)return;
    state.quoteLoading=true;state.quoteProgress=0;state.quoteTotal=targets.length;
    const groupSize=3;
    for(let i=0;i<targets.length;i+=groupSize){
      if(generation!==quoteGeneration)return;
      const batch=targets.slice(i,i+groupSize);
      for(const slot of batch)slot.quoteState='loading';
      renderResults();
      try{
        const payload={club_id:'pro',date:batch[0].date,slots:batch.map(slot=>({
          court_id:String(slot.court_id),start:slot.start,duration:Number(slot.duration)
        }))};
        const reply=await api('getWansportQuotesBatch',payload);
        if(generation!==quoteGeneration)return;
        const matches=new Map((reply.quotes||[]).map(item=>[
          item.court_id+'|'+item.start+'|'+item.duration,item]));
        for(const slot of batch){
          const quote=matches.get(String(slot.court_id)+'|'+slot.start+'|'+slot.duration);
          if(quote?.ok===true&&typeof quote.price==='string'&&quote.date===slot.date){
            slot.quotePrice=quote.price;slot.quoteState='ready';
          }else{
            slot.quoteState='unavailable';
            slot.quoteReason=quote?.error||'Preventivo non restituito.';
          }
        }
        state.quoteProgress+=batch.length;
        renderResults();
        if(reply.rate_limited){
          for(const rest of targets.slice(i+groupSize)){rest.quoteState='unavailable';rest.quoteReason='Lettura limitata dal portale.';}
          break;
        }
      }catch(err){
        if(generation!==quoteGeneration)return;
        for(const slot of batch){slot.quoteState='unavailable';slot.quoteReason=String(err.message||err).slice(0,140);}
        state.quoteProgress+=batch.length;renderResults();
        // Errori globali (ad esempio account scaduto): non riprovare sullo stesso portale.
        if(/sessione|login|403|autorizz/i.test(String(err.message||err))){
          for(const rest of targets.slice(i+groupSize)){rest.quoteState='unavailable';rest.quoteReason='Accesso preventivi non disponibile.';}
          break;
        }
      }
    }
    if(generation===quoteGeneration){
      state.quoteLoading=false;
      renderResults();
    }
  }
  async function saveRequest(e){
    e.preventDefault();const clubs=selected('jobClubChoices');if(!clubs.length)return toast('Selezioni almeno un centro.',true);
    const mode=document.querySelector('input[name="jobMode"]:checked').value;
    if(mode==='auto'&&!confirm('La richiesta sarà soltanto salvata: in questa versione NON verrà effettuata alcuna prenotazione. Proseguire?'))return;
    const btn=$('scheduleBtn');btn.disabled=true;
    try{
      await api('createRequest',{date:$('jobDate').value,time:$('jobTime').value,duration:Number($('jobDuration').value),
        tolerance:Number($('jobTolerance').value),clubs,mode});
      toast('Richiesta salvata su Google Drive. La prenotazione reale non è attiva.');await loadAll();$('attivita').scrollIntoView({behavior:'smooth'});
    }catch(e){toast(e.message,true);}finally{btn.disabled=false;}
  }
  function editClub(id){
    const c=state.clubs.find(c=>c.id===id);if(!c)return;
    $('editClubId').value=id;$('clubDialogTitle').textContent=c.name;
    $('editRule').value=c.rule_type;$('editAdvance').value=c.advance_value??'';$('editRelease').value=c.release_time;
    $('editPriority').value=c.priority;$('editEnabled').checked=c.enabled;changeRule();$('clubDialog').showModal();
  }
  function changeRule(){const type=$('editRule').value;$('editAdvance').disabled=type==='unknown';$('releaseWrap').classList.toggle('hidden',type!=='calendar_days');}
  async function saveClub(e){
    e.preventDefault();
    try{await api('saveClubRule',{id:$('editClubId').value,enabled:$('editEnabled').checked,priority:Number($('editPriority').value),rule_type:$('editRule').value,
      advance_value:$('editRule').value==='unknown'?null:Number($('editAdvance').value),release_time:$('editRelease').value});
      $('clubDialog').close();toast('Regola salvata in Google Sheets');await loadAll();
    }catch(e){toast(e.message,true);}
  }
  async function detail(id){
    try{const j=await api('getRequestDetail',id);$('detailTitle').textContent=prettyDate(j.match_date)+' · '+j.match_time;
      $('detailBody').innerHTML='<div class="overline">CENTRI</div>'+j.clubs.map(c=>`<div class="detail-row"><strong>${esc(c.name)}</strong><small>${esc(c.state)} · Apertura: ${esc(prettyStamp(c.open_at))}</small><div><small>${esc(c.detail)}</small></div></div>`).join('')+
        '<div class="overline" style="margin-top:18px">CRONOLOGIA</div>'+j.events.map(x=>`<div class="detail-row"><small>${esc(prettyStamp(x.stamp))} · ${esc(x.message)}</small></div>`).join('');
      $('detailDialog').showModal();
    }catch(e){toast(e.message,true);}
  }
  async function cancel(id){if(!confirm('Annullare la richiesta?'))return;try{await api('cancelRequest',id);toast('Annullata');await loadAll();}catch(e){toast(e.message,true);}}
  async function probe(id){toast('Controllo della sola pagina pubblica…');try{const data=await api('checkPublicPortal',id);
      toast(data.reachable?`Portale raggiungibile (HTTP ${data.http_status}); calendario non verificato.`:data.note,!data.reachable);
    }catch(e){toast(e.message,true);}}
  async function probePlaytomic(){
    const installed=await window.PBL_CHROME.probe();
    if(!installed){
      toast('Estensione Chrome assente. Installarla seguendo le istruzioni del repository.',true);
      return;
    }
    toast('Estensione rilevata. Controllo Playtomic da Chrome…');
    try{
      const result=await window.PBL_CHROME.query({
        date:romeDate(1),time:'19:00',duration:90,tolerance:60
      });
      state.playtomicLive=['available','no_slots'].includes(result.status);
      toast(result.status==='available'?'Playtomic accessibile da Chrome: slot ottenuti.':
        'Estensione funzionante: nessuno slot compatibile per il test.');
      renderClubs();
    }catch(err){state.playtomicLive=false;toast(err.message,true);renderClubs();}
  }
  async function scheduler(enabled){
    try{const data=await api(enabled?'installScheduler':'removeScheduler');state.schedulerActive=data.installed;schedulerState();toast(enabled?'Trigger di controllo attivato':'Trigger disattivato');}
    catch(e){toast(e.message,true);}
  }
  function showWansport(id){
    const club=state.clubs.find(c=>c.id===id);
    if(!club||club.platform!=='Wansport')return;
    $('wansportClubId').value=id;
    $('wansportDialogTitle').textContent=club.name;
    $('wansportUsername').value='';$('wansportPassword').value='';
    $('wansportSportId').value='15';
    $('wansportSportWrap').classList.toggle('hidden',id==='gunners');
    $('wansportMessage').textContent='Le password già memorizzate non sono mostrate. Nuove credenziali sostituiscono le precedenti.';
    $('wansportDialog').showModal();
  }
  async function saveAndTestWansport(e){
    e.preventDefault();const btn=$('wansportSave');btn.disabled=true;
    const id=$('wansportClubId').value;
    $('wansportMessage').textContent='Verifica del calendario in corso. Nessuna prenotazione sarà inviata.';
    try{
      await api('saveWansportCredentials',{clubId:id,username:$('wansportUsername').value,
        password:$('wansportPassword').value,sportId:Number($('wansportSportId').value)});
      $('wansportPassword').value='';$('wansportUsername').value='';
      const result=await api('testWansportConnection',id);
      $('wansportMessage').textContent=result.ok?'Test riuscito: calendario JSON accessibile in sola lettura.':
        `Test non riuscito: ${result.note}`;
      toast(result.ok?'Connettore Wansport verificato':'Accesso Wansport non verificato',!result.ok);
      await loadAll();
    }catch(err){$('wansportMessage').textContent='Errore: '+err.message;toast(err.message,true);}
    finally{btn.disabled=false;}
  }
  async function removeWansport(){
    const id=$('wansportClubId').value;
    if(!confirm('Eliminare le credenziali del centro selezionato?'))return;
    try{await api('deleteWansportCredentials',id);$('wansportPassword').value='';$('wansportUsername').value='';
      $('wansportMessage').textContent='Credenziali eliminate.';toast('Credenziali rimosse');await loadAll();}
    catch(err){toast(err.message,true);}
  }
  function setup(){
    const date=romeDate(7);['searchDate','jobDate'].forEach(id=>{$(id).min=romeDate();$(id).value=date;});clock();setInterval(clock,1000);
    $('searchForm').addEventListener('submit',search);$('jobForm').addEventListener('submit',saveRequest);
    $('wansportForm').addEventListener('submit',saveAndTestWansport);$('wansportDelete').addEventListener('click',removeWansport);
    $('courtForm').addEventListener('submit',saveCourt);
    $('bookingCopy').addEventListener('click',bookingCopy);
    $('bookingOpen').addEventListener('click',bookingOpenPortal);
    $('bookingRecheck').addEventListener('click',bookingRecheck);
    $('clubForm').addEventListener('submit',saveClub);$('editRule').addEventListener('change',changeRule);
    ['jobDate','jobTime','jobClubChoices'].forEach(id=>$(id).addEventListener('change',previewOpening));
    $('schedulerBtn').addEventListener('click',()=>{$('schedulerDialog').showModal();schedulerState();});
    $('enableScheduler').addEventListener('click',()=>scheduler(true));$('disableScheduler').addEventListener('click',()=>scheduler(false));
    $('refreshBtn').addEventListener('click',loadAll);
    document.addEventListener('click',e=>{const t=e.target.closest('[data-edit-club],[data-edit-court],[data-booking-court],[data-detail],[data-cancel],[data-probe],[data-connect-wansport],[data-playtomic-test],[data-close]');if(!t)return;
      if(t.dataset.editClub)editClub(t.dataset.editClub);
      if(t.dataset.editCourt)openCourtDetails(t.dataset.courtClub,t.dataset.editCourt);
      if(t.dataset.bookingCourt)openBooking(t.dataset.bookingClub,t.dataset.bookingCourt,t.dataset.bookingStart);
      if(t.dataset.detail)detail(t.dataset.detail);
      if(t.dataset.cancel)cancel(t.dataset.cancel);
      if(t.dataset.probe)probe(t.dataset.probe);
      if(t.dataset.playtomicTest)probePlaytomic();
      if(t.dataset.connectWansport)showWansport(t.dataset.connectWansport);
      if(t.dataset.close)$(t.dataset.close).close();
    });
    document.querySelectorAll('input[name="jobMode"]').forEach(n=>n.addEventListener('change',()=>{
      $('autoWarning').classList.toggle('hidden',document.querySelector('input[name="jobMode"]:checked').value!=='auto');
    }));
    document.addEventListener('pbl-chrome-ready',()=>{if(state.clubs.length)renderClubs();});
    document.addEventListener('pbl-backend-connected',loadAll);
    loadAll();
  }
  document.addEventListener('DOMContentLoaded',setup);
})();
