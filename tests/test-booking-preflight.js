/* Padel Booking Leon v1.18 — preflight only, no booking or payment. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const day='2026-11-17';
let searches=0,mode='available';
const slot={club_id:'pro',court_id:'25',court:'Campo Coperto Pro Green',date:day,start:'20:00',
  end:'21:30',duration:90,location:'Vigatto'};
const origins={gunners:'https://gunnerspadel.wansport.com/start',
  pro:'https://propadelclub.wansport.com/start',puntog:'https://puntogpadel.wansport.com/start'};
const context=vm.createContext({Date,Math,Number,JSON,String,Object,Array,Error,Set,Map,
  dateCheck_:value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Data');return value;},
  timeCheck_:value=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Ora');return value;},
  integer_:(n,min,max)=>{if(!Number.isInteger(Number(n))||Number(n)<min||Number(n)>max)throw Error('Durata');return Number(n);},
  romeToday_:()=> '2026-11-10',
  now_:()=> '2026-11-10T20:00:00.000Z',
  gunnersMinutes_:v=>{const [h,m]=v.split(':').map(Number);return h*60+m;},
  findClub_:id=>({id,url:origins[id]}),
  searchClubAvailability_:(id,request)=>{
    searches++;
    assert.equal(request.time,'20:00');assert.equal(request.duration,90);
    return mode==='available'?{status:'available',slots:[{...slot,club_id:id}]}:
      mode==='error'?{status:'error',reason:'Servizio non accessibile'}:{status:'no_slots',reason:'Nessuna fascia'};
  }
});
vm.runInContext(fs.readFileSync('apps-script/BookingPreflight.gs','utf8'),context,{filename:'BookingPreflight.gs'});
const run=src=>vm.runInContext(src,context);
const q={club_id:'pro',court_id:'25',date:day,start:'20:00',duration:90};
let count=0;function test(name,fn){fn();count++;console.log('✓ '+name);}
test('Slot disponibile: restituisce anteprima senza prenotare',()=>{
 const v=run('getBookingPreflight('+JSON.stringify(q)+')');
 assert.equal(v.status,'available');assert.equal(v.court,slot.court);
 assert.equal(v.portal_url,origins.pro);assert.equal(v.end,slot.end);
 assert.ok(!('booking_id' in v));assert.ok(!('payment' in v));
});
test('Slot differente non riservabile',()=>{
 const v=run('getBookingPreflight('+JSON.stringify({...q,court_id:'26'})+')');
 assert.equal(v.status,'unavailable');
});
test('Calendario indisponibile non è confuso con campo libero',()=>{
 mode='error';const v=run('getBookingPreflight('+JSON.stringify(q)+')');
 assert.equal(v.status,'unverified');mode='available';
});
test('Club, data, durata e campo non validi rifiutati senza chiamata',()=>{
 const initial=searches;
 for(const data of [
  {...q,club_id:'hero'},{...q,club_id:'evil'},
  {...q,date:'2026-11-09'},{...q,duration:75},
  {...q,court_id:'!'}, {...q,start:'25:00'}
 ])assert.throws(()=>run('getBookingPreflight('+JSON.stringify(data)+')'));
 assert.equal(searches,initial);
});
test('Nessuna richiesta di prenotazione nel sorgente',()=>{
 const script=fs.readFileSync('apps-script/BookingPreflight.gs','utf8');
 assert.doesNotMatch(script,/UrlFetchApp\.fetch|\.method\s*=\s*['"]post['"]/);
 assert.match(script,/searchClubAvailability_/);
 const ui=fs.readFileSync('github-pages/app.js','utf8');
 assert.match(ui,/bookingRecheck/);assert.match(ui,/bookingCopy/);
 assert.match(ui,/bookingDialog/);
 assert.doesNotMatch(ui,/data-quote-court/);
});
console.log('Preflight v1.18: '+count+' test superati.');
