/* Padel Booking Leon v1.9 — test annotazioni private per campo */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const props=new Map();
const ctx=vm.createContext({JSON,Number,String,Object,Array,Error,RegExp,Map,Set,
  findClub_:id=>{if(!['gunners','pro','puntog','hero'].includes(id))throw Error('Centro non valido.');},
  PropertiesService:{getUserProperties:()=>({
    getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)
  })}
});
new vm.Script(fs.readFileSync('apps-script/CourtDetails.gs','utf8'),{filename:'CourtDetails.gs'}).runInContext(ctx);
const run=x=>vm.runInContext(x,ctx);
let n=0;function test(name,fn){fn();n++;console.log('✓ '+name);}
test('Dettagli inizialmente assenti',()=>{
 const r=run("getCourtDetails([{club_id:'pro',court_id:'12',duration:90}])");
 assert.equal(r.length,0);
});
test('Sede, copertura e prezzo manuali salvati in User Properties',()=>{
 const r=run("saveCourtDetails({club_id:'pro',court_id:'12',location:'Vigatto',cover:'indoor',price:'64',duration:90})");
 assert.equal(r.ok,true);
 const saved=run("getCourtDetails([{club_id:'pro',court_id:'12',duration:90}])");
 assert.equal(saved.length,1);assert.equal(saved[0].location,'Vigatto');
 assert.equal(saved[0].cover,'indoor');assert.equal(saved[0].price,'64');
 assert.ok([...props.keys()][0].startsWith('PBL_COURT_INFO_pro_'));
});
test('Prezzo 90 minuti non visualizzato per 60 minuti',()=>{
 const result=run("getCourtDetails([{club_id:'pro',court_id:'12',duration:60}])");
 assert.equal(result[0].price,'');assert.equal(result[0].location,'Vigatto');
});
test('Prezzi manuali separati per 60 e 90 minuti',()=>{
 run("saveCourtDetails({club_id:'pro',court_id:'12',location:'Vigatto',cover:'indoor',price:'48',duration:60})");
 const p60=run("getCourtDetails([{club_id:'pro',court_id:'12',duration:60}])")[0];
 const p90=run("getCourtDetails([{club_id:'pro',court_id:'12',duration:90}])")[0];
 assert.equal(p60.price,'48');assert.equal(p90.price,'64');
});
test('Nessuna confusione di identificativi fra centri',()=>{
 const r=run("getCourtDetails([{club_id:'puntog',court_id:'12',duration:90}])");
 assert.equal(r.length,0);
});
test('Prezzi sospetti, identificativi e durata non validi rifiutati',()=>{
 assert.throws(()=>run("saveCourtDetails({club_id:'pro',court_id:'12',price:'=IMPORTXML()',duration:90})"),/Prezzo/);
 assert.throws(()=>run("saveCourtDetails({club_id:'evil',court_id:'12',duration:90})"),/Centro/);
 assert.throws(()=>run("getCourtDetails([{club_id:'pro',court_id:'12',duration:45}])"),/Durata/);
});
test('Eliminazione note vuote non tocca altri centri',()=>{
 run("saveCourtDetails({club_id:'pro',court_id:'12',location:'',cover:'unknown',price:'',duration:90})");
 run("saveCourtDetails({club_id:'pro',court_id:'12',location:'',cover:'unknown',price:'',duration:60})");
 assert.equal(run("getCourtDetails([{club_id:'pro',court_id:'12',duration:90}])").length,0);
});
console.log('Court Details: '+n+' test superati.');
