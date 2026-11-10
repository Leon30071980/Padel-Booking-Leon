/**
 * Padel Booking Leon v1.16 — verifica preliminare di prenotabilità.
 *
 * SOLO LETTURA: nessun POST, addebito, creazione, pre-autorizzazione o blocco campo.
 * Il risultato descrive uno slot osservato nel calendario e NON garantisce
 * che rimanga disponibile al momento della conferma sul portale ufficiale.
 */
function getBookingPreflight(input){
  if(!input||typeof input!=='object')throw Error('Campo da prenotare mancante.');
  const clubId=String(input.club_id||'');
  if(!['gunners','pro','puntog'].includes(clubId))
    throw Error('Per questo centro utilizzare la verifica Playtomic sul browser.');
  const date=dateCheck_(input.date);
  if(date<romeToday_())throw Error('La data di prenotazione è nel passato.');
  const start=timeCheck_(input.start);
  const duration=integer_(input.duration,60,120,'Durata');
  if(![60,90,120].includes(duration))throw Error('Durata non supportata.');
  const courtId=String(input.court_id||'');
  if(!/^[1-9]\d{0,11}$/.test(courtId))throw Error('Identificativo campo non valido.');
  const endMinutes=gunnersMinutes_(start)+duration;
  if(endMinutes>1440)throw Error('Orario di fine non valido.');
  const result=searchClubAvailability_(clubId,{date,time:start,duration,tolerance:0});
  const at=now_();
  if(result.status!=='available'){
    return {club_id:clubId,date,start,duration,court_id:courtId,at,
      status:result.status==='error'||result.status==='auth_required'?'unverified':'unavailable',
      reason:String(result.reason||'Impossibile verificare la disponibilità.').slice(0,200)};
  }
  const matches=(result.slots||[]).filter(slot=>
    String(slot.court_id)===courtId&&slot.start===start&&Number(slot.duration)===duration&&slot.date===date);
  if(matches.length!==1){
    return {club_id:clubId,date,start,duration,court_id:courtId,at,status:'unavailable',
      reason:'La disponibilità non è più presente nel calendario: aggiornare la ricerca.'};
  }
  const slot=matches[0];
  const club=findClub_(clubId);
  return {status:'available',club_id:clubId,date,start,duration,court_id:courtId,
    court:slot.court,location:slot.location||'',end:slot.end,at,portal_url:club.url,
    reason:'Disponibilità letta nuovamente dal calendario. La prenotazione non è stata creata.'};
}
