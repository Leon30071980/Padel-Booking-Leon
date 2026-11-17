/** Padel Booking Leon v1.28 — Playtomic: lettura diretta sospesa dopo HTTP 403. */
function playtomicConnectionStatus_(){
  return {configured:true,ready:false,booking_ready:false,last_verified:null,
    reason:'Accesso API sospeso. Calendario ufficiale e importazione assistita su GitHub Pages.'};
}
function searchPlaytomic_(request){
  return {club_id:'hero',status:'manual_required',slots:[],
    reason:'Playtomic richiede verifica sul sito ufficiale; importazione assistita da GitHub Pages.'};
}
function testPlaytomicConnection(){
  const result=searchPlaytomic_({});
  return {ok:false,status:result.status,note:result.reason,slots_count:0};
}
