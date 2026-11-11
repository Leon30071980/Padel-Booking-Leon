/* Padel Booking Leon v1.20 — il calendario SPA può restare su /start.
 * Test DOM simulato: garantisce che la ricerca non venga fermata dal percorso URL.
 */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('chrome-extension/wansport-handoff.js','utf8');
assert.match(source,/const \{target,stats\}=scan\(\)/);
assert.doesNotMatch(source,/if\(!inPanel\(\)\)\s*\{\s*const result=scan\(\)/);
assert.match(source,/if\(!info\|\|found\)return/);
assert.match(source,/Elementi con nomi di calendario/);
assert.match(source,/Iframe nella pagina/);
assert.match(source,/Copia diagnosi/);
const fakeBody={append(){}};
const fakeElement=function(){};
fakeElement.prototype.closest=()=>null;
fakeElement.prototype.scrollIntoView=function(){this.scrolled=true;};
const slot=new fakeElement();slot.getAttribute=()=> '17911';slot.style={};slot.textContent='20:00';
slot.classList={contains:name=>name==='tslotAttivo'};
const row={classList:{contains:name=>name==='resRow'},querySelectorAll:sel=>sel==='div.tslot'?[slot]:[]};
let listener;
const document={
  readyState:'complete',body:fakeBody,documentElement:{},
  addEventListener(){},getElementById(id){return id==='griglia-row-resource-id-1'?row:{}},
  querySelectorAll(q){
    if(q==='[data-tslot-id]')return [slot];
    if(q.includes('[class*="slot"]'))return [slot];
    return [];
  },
  createElement(tag){
    if(tag==='div')return {id:'',style:{cssText:''},attachShadow(){return shadow},append(){}};
    return {style:{},dataset:{},children:[],append(){},setAttribute(){},textContent:'',
      set onclick(fn){this._onclick=fn;},get onclick(){return this._onclick;}};
  }
};
const shadow={append(){}};
const chrome={runtime:{lastError:null,sendMessage(payload,cb){cb({
  ok:true,data:{court_id:'1',tslot_id:'17911',date:'2026-11-18',start:'20:00',end:'21:30',
    duration:90,court:'Campo di prova',price:'64 €'}
});}}};
let observeCount=0;
const ctx=vm.createContext({
  chrome,document,location:{protocol:'https:',hostname:'propadelclub.wansport.com',
    pathname:'/start',href:'https://propadelclub.wansport.com/start'},
  Element:fakeElement,Set,Map,Date,String,Number,Array,Object,Math,JSON,Error,RegExp,URL,
  navigator:{clipboard:{writeText:async()=>{}}},
  MutationObserver:class{constructor(fn){listener=fn}observe(){observeCount++}disconnect(){}},
  window:{confirm:()=>true},setTimeout:()=>1
});
new vm.Script(source,{filename:'wansport-handoff.js'}).runInContext(ctx);
assert.equal(slot.scrolled,true,'Il timeslot valido su /start deve essere evidenziato.');
assert.ok(observeCount>=1,'Deve monitorare il calendario dinamico.');
assert.match(source,/target\.click\(\)/);
console.log('Wansport v1.20: SPA /start riconosciuta e slot univoco evidenziato.');
