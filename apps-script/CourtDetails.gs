/**
 * Padel Booking Leon v1.13 — note personali sui campi.
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
function courtDuration_(value){
  const n=Number(value);
  if(![60,90,120].includes(n))throw Error('Durata campo non valida.');
  return n;
}
function courtRead_(props,key){
  let val={};
  try{val=JSON.parse(props.getProperty(key)||'{}');}catch(e){val={};}
  const location=String(val.location||'').slice(0,90);
  const cover=['unknown','indoor','outdoor'].includes(val.cover)?val.cover:'unknown';
  const prices=val.prices&&typeof val.prices==='object'&&!Array.isArray(val.prices)?val.prices:{};
  return {location,cover,prices};
}
function getCourtDetails(keys){
  if(!Array.isArray(keys)||keys.length>120)throw Error('Selezione campi non valida.');
  const props=PropertiesService.getUserProperties();
  const rows=[];
  for(const item of keys){
    if(!item||typeof item!=='object')throw Error('Campo non valido.');
    const club=String(item.club_id||''),id=String(item.court_id||'');
    const key=courtKey_(club,id),duration=courtDuration_(item.duration);
    if(!props.getProperty(key))continue;
    const note=courtRead_(props,key);
    rows.push({club_id:club,court_id:id,location:note.location,cover:note.cover,
      price:String(note.prices[duration]||''),duration,kind:'manuale'});
  }
  return rows;
}
function saveCourtDetails(input){
  if(!input||typeof input!=='object')throw Error('Dettagli mancanti.');
  const club=String(input.club_id||''),id=String(input.court_id||'');
  const key=courtKey_(club,id),duration=courtDuration_(input.duration);
  const clean=validateCourtDetail_(input);
  const props=PropertiesService.getUserProperties();
  const existing=courtRead_(props,key);
  if(clean.price)existing.prices[duration]=clean.price;
  else delete existing.prices[duration];
  const next={location:clean.location,cover:clean.cover,prices:existing.prices};
  if(!next.location&&next.cover==='unknown'&&!Object.keys(next.prices).length)props.deleteProperty(key);
  else props.setProperty(key,JSON.stringify(next));
  return {ok:true,club_id:club,court_id:id,location:clean.location,cover:clean.cover,
    price:clean.price,duration,kind:'manuale'};
}
