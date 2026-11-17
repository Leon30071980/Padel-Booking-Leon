const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let calls=0;
const ctx=vm.createContext({UrlFetchApp:{fetch(){calls++;throw Error('Non deve interrogare la rete');}}});
new vm.Script(fs.readFileSync('apps-script/Playtomic.gs','utf8')).runInContext(ctx);
for(const cmd of ['playtomicConnectionStatus_()','searchPlaytomic_({})','testPlaytomicConnection()']){
 const r=vm.runInContext(cmd,ctx);assert.equal(r.ready??r.ok??false,false);
 if(r.status)assert.equal(r.status,'manual_required');
 if(r.slots)assert.equal(r.slots.length,0);
}
assert.equal(calls,0);console.log('Playtomic v1.27: cloud sospeso, nessuna richiesta diretta.');
