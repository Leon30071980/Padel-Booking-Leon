/**
 * Padel Booking Leon v1.9 — note personali sui campi.
 * Persistenza nelle User Properties del proprietario (mai su GitHub).
 * I valori sono esplicitamente indicativi/manuali, non prezzi contrattuali.
 */
const PBL_COURT_KEY_='PBL_COURT_INFO_';
function courtKey_(clubId,courtId){
  findClub_(clubId);
  const id=String(courtId||'');
  if(!/^[a-zA-Z0-9_:-]{1,95}$/.test(id))throw Error('Identificativo campo non valido.');
  return PBL_COURT_KEY_+clubId+'_'+id;
}
function validateCourtDetail_(obj){
  const location=String(obj.location||'').trim().slice(0,90);
  const cover=String(obj.cover||'unknown');
  const price=String(obj.price||'').trim().slice(0,35);
  if(!['unknown','indoor','outdoor'].includes(cover))throw Error('Copertura non valida.');
  if(price&&!/^[\d., ]{1,15}(?:\s?€)?$/.test(price))throw Error('Prezzo indicativo non valido.');
  return {location,cover,price};
}
function getCourtDetails(keys){
  if(!Array.isArray(keys)||keys.length>120)throw Error('Selezione campi non valida.');
  const props=PropertiesService.getUserProperties();
  const rows=[];
  for(const item of keys){
    if(!item||typeof item!=='object')throw Error('Campo non valido.');
    const club=String(item.club_id||''),id=String(item.court_id||'');
    const raw=props.getProperty(courtKey_(club,id));
    if(!raw)continue;
    try{rows.push({club_id:club,court_id:id,...validateCourtDetail_(JSON.parse(raw)),kind:'manuale'});}
    catch(e){ /* note legacy non valide ignorate */ }
  }
  return rows;
}
function saveCourtDetails(input){
  if(!input||typeof input!=='object')throw Error('Dettagli mancanti.');
  const key=courtKey_(String(input.club_id||''),String(input.court_id||''));
  const obj=validateCourtDetail_(input);
  const props=PropertiesService.getUserProperties();
  if(!obj.location&&obj.cover==='unknown'&&!obj.price)props.deleteProperty(key);
  else props.setProperty(key,JSON.stringify(obj));
  return {ok:true,club_id:input.club_id,court_id:input.court_id,...obj,kind:'manuale'};
}
