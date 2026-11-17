
/* Padel Booking Leon — v1.27 | Apps Script HTMLService, nessuna password nel frontend. */
(()=>{
  'use strict';
  const $ = id=>document.getElementById(id);
  const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={clubs:[],jobs:[],schedulerActive:false,online:false,playtomicLive:false,courtDetails:new Map(),lastResults:[],quoteLoading:false,quoteProgress:0,quoteTotal:0};
  state.openGroups=new Set();state.backendVersion='';
  let quoteGeneration=0;
  let bookingSelection=null;
  let bookingCheckSerial=0;
  let toastTimer;
  let heroProbe=null,heroSnapshot=null,lastSearchRequest=null,heroPending=null,heroPullBusy=false;
  state.heroPhase='waiting';
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
    const previous=new Set(selected(id));const initialized=$(id).querySelectorAll('input').length>0;
    $(id).innerHTML=state.clubs.map(c=>`<label class="choice"><input type="checkbox" value="${esc(c.id)}" ${initialized?previous.has(c.id)?'checked':'':c.enabled?'checked':''} ${c.enabled?'':'disabled'}><span>${esc(c.name)}</span></label>`).join('');
    if(id==='jobClubChoices'){
      const hero=$(id).querySelector('input[value="hero"]');
      if(hero){hero.checked=false;hero.disabled=true;hero.closest('label').title='Padel Hero richiede verifica assistita e non è programmabile sul backend cloud.';}
    }
  }
  function selected(id){return Array.from($(id).querySelectorAll('input:checked:not(:disabled)')).map(e=>e.value);}
  function heroMinutes(value){
    const m=String(value||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return m?Number(m[1])*60+Number(m[2]):NaN;
  }
  function heroClock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
  function parseHeroRanges(raw,date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||
       new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Data del calendario non valida.');
    const lines=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length||lines.length>100)throw Error('Inserisca da 1 a 100 intervalli effettivamente bianchi sul calendario.');
    return lines.map((line,i)=>{
      const p=line.split(';').map(x=>x.trim());
      const court=p[0],start=heroMinutes(p[1]),end=heroMinutes(p[2]),roof=String(p[3]||'').toLowerCase();
      const exact=p[4]==='slot';
      if(p.length<3||p.length>5||(p.length===5&&!exact)||!court||court.length>90||!Number.isFinite(start)||!Number.isFinite(end)||
         end<=start||(exact?![60,90,120].includes(end-start):(start%30||end%30))||!['','coperto','scoperto','indoor','outdoor'].includes(roof))
        throw Error('Riga '+(i+1)+': formato Campo;19:00;22:00;coperto (orari a mezz’ora).');
      return {court,start,end,exact,cover:['coperto','indoor'].includes(roof)?'indoor':['scoperto','outdoor'].includes(roof)?'outdoor':'unknown'};
    });
  }
  function heroCandidates(snapshot,req,now=Date.now()){
    const base={club_id:'hero',status:'manual_required',slots:[],reason:'Aprire Playtomic, selezionare il giorno richiesto e premere Importa disponibilità in Leon.'};
    if(!snapshot||snapshot.date!==req.date||!Number.isFinite(snapshot.at)||now-snapshot.at>10*60000||now<snapshot.at)return base;
    const target=heroMinutes(req.time),duration=Number(req.duration),tolerance=Number(req.tolerance);
    if(!Number.isFinite(target)||![60,90,120].includes(duration)||![0,15,30,60].includes(tolerance))return base;
    const out=new Map();
    for(const r of snapshot.ranges){
      if(r.exact&&r.end-r.start!==duration)continue;
      for(let t=r.start;t+duration<=r.end;t+=30){
        if(r.exact&&t!==r.start)break;
        if(Math.abs(t-target)>tolerance)continue;
        const key=r.court.toLowerCase()+'|'+t;
        out.set(key,{club_id:'hero',court_id:'manual:'+r.court.toLowerCase(),court:r.court,location:'San Prospero',date:snapshot.date,
          start:heroClock(t),end:heroClock(t+duration),duration,cover:r.cover,price:'',manual:true});
      }
    }
    const slots=[...out.values()].sort((a,b)=>Math.abs(heroMinutes(a.start)-target)-Math.abs(heroMinutes(b.start)-target)||
      a.start.localeCompare(b.start)||a.court.localeCompare(b.court,'it')).slice(0,30);
    return {...base,status:slots.length?'available':'manual_required',slots,manual:true,
      reason:slots.length?(snapshot.visible?'Fasce lette dal calendario visibile Playtomic; prezzi e disponibilità da riconfermare sul portale.'+(snapshot.unrecognized?' Alcune offerte non riconosciute: '+snapshot.unrecognized+'.':''):'Fasce candidate inserite manualmente; da confermare sul portale.'):
      (snapshot.visible?'Nessuna fascia compatibile riconosciuta ('+Number(snapshot.seen||0)+' offerte visibili esaminate); il calendario intero non è verificato.':'Nessuna corrispondenza nelle fasce acquisite: il calendario completo non è stato verificato.')};
  }
  function heroStatus(){
    if(heroProbe)return 'Verifica estensione Chrome in corso…';
    if(state.heroPhase==='missing')return 'Lettura assistita · estensione non rilevata';
    if(heroSnapshot?.visible&&Date.now()-heroSnapshot.at<600000)return 'Calendario del '+prettyDate(heroSnapshot.date)+' importato · da riconfermare';
    return window.PBL_CHROME?.heroCapable?.()?'Importazione dal calendario visibile · un clic':'Aggiornare l’estensione Chrome v1.27';
  }
  function currentHeroRequest(){
    return {date:$('searchDate').value,time:$('searchTime').value,duration:Number($('searchDuration').value),tolerance:Number($('searchTolerance').value)};
  }
  function heroFresh(req){
    return heroSnapshot&&heroSnapshot.date===req.date&&Date.now()-heroSnapshot.at<=600000&&(!heroSnapshot.visible||
      heroSnapshot.request?.time===req.time&&heroSnapshot.request?.duration===req.duration&&heroSnapshot.request?.tolerance===req.tolerance);
  }
  async function openHeroCalendar(req=currentHeroRequest()){
    if(!req.date||!req.time){toast('Imposti data, orario e durata.',true);return;}
    if(!window.PBL_CHROME?.heroOpen){openHeroImport();return;}
    if(heroPending&&heroPending.opening&&heroPending.req.date===req.date&&heroPending.req.time===req.time&&heroPending.req.duration===req.duration&&heroPending.req.tolerance===req.tolerance)return;
    const key=crypto.randomUUID();
    heroPending={key,req,opening:true,completed:false};heroSnapshot=null;
    try{
      await window.PBL_CHROME.heroOpen({...req,key});
      if(heroPending?.key===key)toast('Playtomic aperto: selezioni '+prettyDate(req.date)+' e prema Importa disponibilità in Leon.');
    }catch(e){
      if(heroPending?.key===key){heroPending=null;toast(e.message,true);openHeroImport();}
    }finally{if(heroPending?.key===key)heroPending.opening=false;}
  }
  function receiveHero(data){
    if(!heroPending||!data||data.key!==heroPending.key||data.date!==heroPending.req.date||!Array.isArray(data.lines)||
      !Number.isFinite(data.at)||Date.now()-data.at>600000||data.at>Date.now()+2000)return;
    if(heroPending.completed&&heroSnapshot?.at===data.at)return;
    try{
      const ranges=data.lines.length?parseHeroRanges(data.lines.join('\n'),data.date):[];
      if(ranges.some(r=>!r.exact))throw Error('Formato fascia non valido.');
      heroSnapshot={date:data.date,at:data.at,ranges,visible:true,request:heroPending.req,seen:data.seen,unrecognized:data.unrecognized};
      heroPending.completed=true;
      if(state.lastResults.some(r=>r.club_id==='hero')&&lastSearchRequest&&heroFresh(lastSearchRequest)){
        state.lastResults=state.lastResults.map(r=>r.club_id==='hero'?heroCandidates(heroSnapshot,lastSearchRequest):r);
        renderResults();
      }else if(!$('searchBtn').disabled){
        lastSearchRequest=heroPending.req;state.lastResults=state.lastResults.filter(r=>r.club_id!=='hero').concat(heroCandidates(heroSnapshot,lastSearchRequest));renderResults();
      }
      if($('heroImportDialog').open)$('heroImportDialog').close();
      renderClubs();toast(ranges.length?ranges.length+' fasce Playtomic importate automaticamente.':'Nessuna fascia compatibile riconosciuta; verifichi il calendario.');
    }catch(e){toast('Importazione Playtomic non riuscita: '+e.message,true);}
  }
  async function pullHero(){
    if(heroPullBusy||!heroPending||!window.PBL_CHROME?.heroPull)return;
    heroPullBusy=true;
    try{receiveHero(await window.PBL_CHROME.heroPull());}catch{}finally{heroPullBusy=false;}
  }
  function openHeroImport(){
    const req=lastSearchRequest||{date:$('searchDate').value,time:$('searchTime').value,duration:$('searchDuration').value,tolerance:$('searchTolerance').value};
    $('heroDate').value=req.date;$('heroRanges').value='';$('heroConfirm').checked=false;
    $('heroImportNote').textContent='Modalità manuale di riserva. Per il trasferimento automatico aggiorni Chrome v1.27 e apra la ricerca Playtomic da Leon.';
    $('heroImportDialog').showModal();
  }
  function saveHeroImport(e){
    e.preventDefault();
    try{
      if(!$('heroConfirm').checked)throw Error('Confermi data e intervalli visualizzati sul sito.');
      const date=$('heroDate').value;
      if(date<romeDate())throw Error('La data è passata.');
      const ranges=parseHeroRanges($('heroRanges').value,date);
      heroSnapshot={date,at:Date.now(),ranges};
      $('heroImportDialog').close();
      if(lastSearchRequest&&lastSearchRequest.date===date&&state.lastResults.some(r=>r.club_id==='hero')){
        state.lastResults=state.lastResults.map(r=>r.club_id==='hero'?heroCandidates(heroSnapshot,lastSearchRequest):r);
        renderResults();toast('Fasce candidate importate. Confermare sul portale.');
      }else toast('Intervalli memorizzati in questa scheda per 10 minuti. Avvii la ricerca con la stessa data.');
    }catch(err){$('heroImportNote').textContent=err.message;}
  }
  function renderClubs(){
    $('metricClubs').textContent=state.clubs.length;
    const verified=state.clubs.filter(c=>c.id==='hero'?state.playtomicLive:c.connector.ready).length;
    $('metricReady').innerHTML=verified+'<span class="metric-suffix"> / '+state.clubs.length+'</span>';
    $('clubGrid').innerHTML=state.clubs.map(c=>{
      const connected=c.platform==='Playtomic'?state.playtomicLive:c.connector.ready, configured=c.connector.configured;
      const isWS=c.platform==='Wansport';
      const status=isWS?(connected?'Ultimo calendario verificato':configured?'Credenziali inserite: verifica necessaria':'Configurare l’accesso'):heroStatus();
      return `<article class="club-card"><div class="club-top"><span class="platform-tag">${esc(c.platform)}</span><span class="club-priority">PRIORITÀ ${c.priority}</span></div>
      <h3>${esc(c.name)}</h3><div class="club-status ${connected?'ready':''}"><i></i>${esc(status)}</div>
      <div class="rule-details"><span>REGOLA DI APERTURA</span><strong>${esc(ruleLabel(c))}</strong></div>
      <div class="club-actions"><button type="button" class="btn btn-outline" data-edit-club="${esc(c.id)}">⚙ Regole</button><a class="btn btn-outline" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">↗ Sito</a></div>
      ${isWS?'<button type="button" class="mini-button probe" data-connect-wansport="'+esc(c.id)+'">🔐 Configura / prova Wansport</button>':'<button type="button" class="mini-button probe" data-playtomic-test="'+esc(c.id)+'">Cerca su Playtomic ↗</button>'}</article>`;
    }).join('');
    choices('searchClubChoices');choices('jobClubChoices');
  }
  const labels={pending:'In attesa',completed_found:'Slot trovati',completed_no_slots:'Nessuna fascia',completed_partial:'Completata con anomalie',completed_error:'Controllo non riuscito',completed_outside:'Fuori finestra',expired:'Scaduta',cancelled:'Annullata'};
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
          <div><span class="status-badge warn">${esc(j.status==='pending'?(due?'In attesa': 'Regola da configurare'):(labels[j.status]||j.status))}</span></div>
          <div class="job-actions"><button type="button" class="mini-button" data-detail="${esc(j.id)}">Dettagli</button>${j.status==='pending'?`<button type="button" class="mini-button danger" data-cancel="${esc(j.id)}">Annulla</button>`:''}</div></div>`;
      }).join('');
  }
  async function loadAll(){
    try{
      const data=await api('getDashboard');state.clubs=data.clubs;state.jobs=data.jobs;state.schedulerActive=data.schedulerActive;state.backendVersion=data.version||'';renderComponentStatus();
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
  function resultEntry(r,s){
        const note=state.courtDetails.get(detailKey(r.club_id,s.court_id));
        const location=courtLocation(s,r.club_id,note);
        const cover=note?.cover&&note.cover!=='unknown'?note.cover:(s.cover||'unknown');
        const roof=cover==='indoor'?'Coperto':cover==='outdoor'?'Scoperto':'Copertura da verificare';
        const price=s.quotePrice?String(s.quotePrice):s.price?String(s.price):
          note?.price?String(note.price).replace(/\s?€$/,'')+' €':
          s.quoteState==='loading'?'Calcolo in corso…':
          s.quoteState==='queued'?'In attesa…':'Da verificare';
        const origin=s.manual?'Da confermare sul portale':s.quotePrice?'Preventivo Wansport · profilo corrente':s.price?'Prezzo portale':
          note?.price?'Prezzo indicativo · nota personale':
          s.quoteState==='unavailable'?'Preventivo non disponibile':
          s.quoteState==='pending'?'Verifica non avviata':
          s.quoteState==='loading'||s.quoteState==='queued'?'Lettura automatica e sicura':'Prezzo non disponibile';
        const html=`<div class="slot-line">
          <div class="slot-heading"><strong>${esc(s.court)}</strong><span class="slot-time">${esc(s.start)}–${esc(s.end)}</span></div>
          <div class="slot-metadata">
            <span class="slot-chip">📍 ${esc(location)}</span>
            <span class="slot-chip">${esc(roof)}</span>
            <span class="slot-chip"><strong class="slot-price">${esc(price)}</strong> <small>${esc(origin)}</small></span>
          </div>
          <div class="slot-controls">
            ${s.manual?'<span class="slot-chip">Candidata · verifica manuale</span>':`<button type="button" data-edit-court="${esc(s.court_id)}" data-court-club="${esc(r.club_id)}">⚙ Dettagli</button>`}
            <button type="button" data-booking-court="${esc(s.court_id)}" data-booking-club="${esc(r.club_id)}" data-booking-start="${esc(s.start)}">Prenota ↗</button>
          </div></div>`;
        return {slot:s,location,cover,knownPrice:s.quotePrice||s.price||"",html};
  }
  function numericPrice(value){
    const raw=String(value||'').trim().replace(/\s/g,'');
    const match=raw.match(/^(?:€|EUR)?(\d{1,5}(?:[.,]\d{1,2})?)(?:€|EUR)?$/i);
    return match?Number(match[1].replace(',','.')):Infinity;
  }
  function compactOrder(a,b,mode){
    if(mode==='price'){
      const left=numericPrice(a.knownPrice),right=numericPrice(b.knownPrice);
      if(left!==right)return left-right;
    }
    if(mode==='time'||mode==='price')return String(a.slot.start).localeCompare(String(b.slot.start))||String(a.slot.court).localeCompare(String(b.slot.court),'it');
    return 0;
  }
  function displayMinimum(entries){
    const min=Math.min(...entries.map(x=>numericPrice(x.knownPrice)));
    return Number.isFinite(min)?'da '+min.toLocaleString('it-IT',{maximumFractionDigits:2})+' €':'';
  }
  function renderResultGroups(){
    const container=$('searchResults'),filter=$('resultCover').value,sort=$('resultSort').value;
    // Conserva lo stato dei gruppi già visibili durante preventivi e filtri.
    for(const d of container.querySelectorAll('details[data-result-group]')){
      if(d.open)state.openGroups.add(d.dataset.resultGroup);else state.openGroups.delete(d.dataset.resultGroup);
    }
    const prepared=state.lastResults.map(r=>{
      const club=state.clubs.find(c=>c.id===r.club_id);
      const all=r.status==='available'?(r.slots||[]).map(s=>resultEntry(r,s)):[];
      const entries=all.filter(x=>filter==='all'||x.cover===filter).sort((a,b)=>compactOrder(a,b,sort));
      return {r,club,all,entries};
    });
    const total=prepared.reduce((s,x)=>s+x.all.length,0),shown=prepared.reduce((s,x)=>s+x.entries.length,0),manual=prepared.filter(x=>x.r.manual).reduce((s,x)=>s+x.entries.length,0);
    const n=prepared.filter(x=>x.entries.length).length;
    $('resultsFilters').hidden=false;
    $('resultsSummary').textContent=shown+' fasce'+(shown!==total?' su '+total:'')+' · '+n+' / '+prepared.length+' centri con fasce'+(manual?' · '+manual+' candidate Playtomic da confermare':'')+(prepared.some(x=>x.all.length>=30)?' · fino a 30 fasce per centro':'');
    prepared.sort((a,b)=>Number(!!b.entries.length)-Number(!!a.entries.length)||(
      sort==='price'?(Math.min(...a.entries.map(x=>numericPrice(x.knownPrice)))-Math.min(...b.entries.map(x=>numericPrice(x.knownPrice))))||0:
      sort==='time'?String(a.entries[0]?.slot.start||'99:99').localeCompare(String(b.entries[0]?.slot.start||'99:99')):0
    )||(Number(a.club?.priority)||99)-(Number(b.club?.priority)||99));
    container.innerHTML=prepared.map(({r,club,all,entries})=>{
      const name=esc(club?.name||r.club_id)+(r.manual?' · candidate':'');
      const status={available:'Slot compatibili',manual_required:'Verifica assistita',no_slots:'Nessuna fascia',outside_window:'Fuori finestra',auth_required:'Accesso richiesto',error:'Errore di lettura',not_configured:'Non collegato'}[r.status]||'Da verificare';
      if(!entries.length){
        const message=all.length?'Nessuna fascia con il filtro scelto':status;
        return '<div class="result-empty"><div class="group-name"><strong>'+name+'</strong><small>'+esc(all.length?all.length+' fasce nascoste dal filtro':r.reason)+'</small></div><span>'+esc(message)+'</span>'+(r.club_id==='hero'?'<button type="button" class="mini-button" data-playtomic-test="hero">Apri ricerca Playtomic ↗</button>':'')+'<a target="_blank" rel="noopener noreferrer" href="'+esc(club?.url||'#')+'">Portale ↗</a></div>';
      }
      const venues=new Map();
      for(const item of entries){
        if(!venues.has(item.location))venues.set(item.location,[]);
        venues.get(item.location).push(item);
      }
      const minimum=displayMinimum(entries);
      const sites=[...venues.keys()].join(' · ');
      let detail='';
      for(const [venue,items] of venues){
        if(venues.size>1)detail+='<div class="slot-venue">'+esc(venue)+' · '+items.length+' fasce</div>';
        detail+='<div class="slot-list">'+items.map(x=>x.html).join('')+'</div>';
      }
      return '<details class="result-group has-slots" data-result-group="'+esc(r.club_id)+'"'+(state.openGroups.has(r.club_id)?' open':'')+'><summary><div class="group-name"><strong>'+name+'</strong><small>'+esc(sites)+'</small></div><span class="group-count">'+entries.length+' '+(entries.length===1?'fascia':'fasce')+(minimum?'<small>'+esc(minimum)+'*</small>':'')+'</span></summary><div class="group-detail"><small>'+esc(r.reason)+'</small>'+detail+(minimum?'<small>* Minimo tra i prezzi noti mostrati, da riconfermare sul portale.</small>':'')+'</div></details>';
    }).join('');
  }
  function setupResultControls(render){
    $('resultCover').addEventListener('change',render);
    $('resultSort').addEventListener('change',render);
    for(const [id,open] of [['expandResults',true],['collapseResults',false]]){
      $(id).addEventListener('click',()=>{
        for(const d of $('searchResults').querySelectorAll('details[data-result-group]')){
          d.open=open;
          if(open)state.openGroups.add(d.dataset.resultGroup);else state.openGroups.delete(d.dataset.resultGroup);
        }
        if(!open)state.openGroups.clear();
      });
    }
  }
  function renderResults(){renderResultGroups();}
  function renderComponentStatus(){
    const el=$('componentStatus');if(!el)return;
    const backend=state.backendVersion||'non verificato';
    const extension=window.PBL_CHROME?.version?.()||'non rilevata';
    el.textContent='Frontend v1.27 · Google '+backend+' · Chrome '+extension+
      (backend!=='v1.27'?' · verificare il deployment Google':'')+
      (!['v1.24','v1.25','v1.26','v1.27'].includes(extension)?' · aggiornare/ricaricare l’estensione per la guida':'');
    el.dataset.warning=String(backend!=='v1.27'||!['v1.24','v1.27'].includes(extension));
  }

  function getBookingSlot(clubId,courtId,start){
    if(clubId==='hero'&&(!heroSnapshot||Date.now()-heroSnapshot.at>10*60000))return null;
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
    $('bookingOpen').dataset.handoffFailed='';
    $('bookingOpen').textContent=club.id==='hero'?'Apri Playtomic ↗':'Apri fascia su Wansport ↗';
    $('bookingRecheck').disabled=false;
    bookingStatus(slot.manual?'Fascia candidata da intervallo inserito manualmente: verificare durata e prezzo sul sito ufficiale.':'Disponibilità rilevata durante la ricerca, ma non riservata. Ricontrolli prima di procedere.');
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
        bookingStatus('Controlli direttamente la fascia sul calendario ufficiale. Nessuna verifica API disponibile.','warning');return;
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
  function buttonHandoffFailed(){return $('bookingOpen').dataset.handoffFailed==='1';}
  async function bookingOpenPortal(event){
    if(!bookingSelection)return;
    const selection=bookingSelection;
    const {club,slot}=selection;
    if(club.platform!=='Wansport'){
      // Playtomic: link ufficiale, come in v1.13.
      return;
    }
    // Chrome richiede un'azione esplicita dell'utente; non si procede in background.
    if(buttonHandoffFailed())return;
    if(!window.PBL_CHROME?.handoff||!window.PBL_CHROME.installed())return;
    event.preventDefault();
    const button=$('bookingOpen');
    if(button.dataset.busy==='1')return;
    button.dataset.busy='1';button.textContent='Verifica e apertura…';
    try{
      const fresh=await api('getBookingPreflight',{club_id:club.id,court_id:String(slot.court_id),date:slot.date,start:slot.start,duration:Number(slot.duration)});
      if(bookingSelection!==selection||!$('bookingDialog').open)return;
      if(fresh.status!=='available'){bookingStatus('Fascia non confermata: '+(fresh.reason||'ripetere la ricerca'),'warning');return;}
      await window.PBL_CHROME.handoff({
        club_id:club.id,court_id:String(slot.court_id),tslot_id:String(slot.tslot_id||''),
        court:slot.court,date:slot.date,start:slot.start,end:slot.end,
        duration:Number(slot.duration),price:String(slot.quotePrice||slot.price||'')
      });
      toast('Wansport aperto: la guida del campo è visibile sulla nuova scheda.');
    }catch(err){
      const reason=String(err?.message||'Errore sconosciuto').slice(0,240);
      toast('Guida Wansport: '+reason,true);
      bookingStatus('Impossibile aprire la guida: '+reason+'. In alternativa utilizzi il sito ufficiale.', 'warning');
      button.href=club.url;
      button.dataset.handoffFailed='1';
      button.textContent='Apri portale ufficiale ↗';
    }finally{
      button.dataset.busy='';
      if(button.textContent==='Verifica e apertura…')button.textContent='Apri fascia su Wansport ↗';
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
    state.openGroups.clear();state.lastResults=[];state.quoteLoading=false;$('resultsFilters').hidden=true;$('resultsSummary').textContent='';
    const btn=$('searchBtn');btn.disabled=true;$('searchResults').textContent='Controllo dei calendari abilitati…';
    try{
      const req={date:$('searchDate').value,time:$('searchTime').value,
        duration:Number($('searchDuration').value),tolerance:Number($('searchTolerance').value)};
      const otherClubs=clubs.filter(id=>id!=='hero');
      // Chrome apre il calendario ufficiale soltanto per una ricerca richiesta dall’utente.
      lastSearchRequest=req;
      if(clubs.includes('hero')&&!heroFresh(req)){
        heroSnapshot=null;
        openHeroCalendar(req);
      }else if(!clubs.includes('hero'))heroPending=null;
      const remote=otherClubs.length?await api('searchAvailability',{...req,clubs:otherClubs}):{results:[]};
      const remoteById=new Map(remote.results.map(r=>[r.club_id,r]));
      const hero=clubs.includes('hero')?heroCandidates(heroFresh(req)?heroSnapshot:null,req):null;
      const results=clubs.map(id=>id==='hero'?hero:remoteById.get(id)).filter(Boolean);
      if(clubs.includes('hero'))renderClubs();
      state.lastResults=results;
      const keys=results.flatMap(r=>(r.slots||[]).filter(slot=>!slot.manual).map(slot=>({club_id:r.club_id,court_id:String(slot.court_id),duration:Number(slot.duration)})));
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
      if(otherClubs.length)await loadAll();
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
  function probePlaytomic(){
    if(heroProbe)return heroProbe;
    heroProbe=(async()=>{
      try{state.heroPhase=await window.PBL_CHROME.probe()?'assisted':'missing';}
      catch(e){state.heroPhase='missing';}
      finally{heroProbe=null;renderComponentStatus();if(state.clubs.length)renderClubs();}
    })();
    return heroProbe;
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
    $('wansportSportId').value=(id==='donbosco'||id==='inzani')?'':String(club.connector?.sport_id||15);
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
    setupResultControls(renderResults);renderComponentStatus();
    $('heroImportForm').addEventListener('submit',saveHeroImport);
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
      if(t.dataset.playtomicTest)openHeroCalendar(lastSearchRequest||currentHeroRequest());
      if(t.dataset.connectWansport)showWansport(t.dataset.connectWansport);
      if(t.dataset.close)$(t.dataset.close).close();
    });
    document.querySelectorAll('input[name="jobMode"]').forEach(n=>n.addEventListener('change',()=>{
      $('autoWarning').classList.toggle('hidden',document.querySelector('input[name="jobMode"]:checked').value!=='auto');
    }));
    document.addEventListener('pbl-chrome-ready',()=>{state.heroPhase='assisted';renderComponentStatus();if(state.clubs.length)renderClubs();});
    document.addEventListener('pbl-hero-imported',e=>receiveHero(e.detail));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullHero();});
    window.addEventListener('focus',pullHero);
    document.addEventListener('pbl-backend-connected',loadAll);
    loadAll();
    probePlaytomic();
  }
  document.addEventListener('DOMContentLoaded',setup);
})();
