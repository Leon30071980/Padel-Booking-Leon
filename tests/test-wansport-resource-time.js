/* Padel Booking Leon v1.19 — real Pro Padel row/time DOM fixture and safe click. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('chrome-extension/wansport-handoff.js','utf8');
function scenario({court='1',time='20:00',cells=['20:00'],dateConfirmed=false,wrongRow=false}={}){
 const buttons=[],clicked=[],questions=[];
 class Elem {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={outline:'',outlineOffset:''};
   this.attrs={};this.dataset={};this.textContent='';this.classList={contains:name=>name==='tslotAttivo'};}
  getAttribute(name){return this.attrs[name]||null;}
  closest(){return null;}
  contains(){return false;}
  append(){}
  setAttribute(name,value){this.attrs[name]=value;}
  scrollIntoView(){this.scrolled=true;}
  click(){clicked.push(this);}
 }
 const slotEls=cells.map(t=>{const el=new Elem();el.textContent=t;return el;});
 const row={classList:{contains:n=>n==='resRow'},querySelectorAll:sel=>sel==='div.tslot'?slotEls:[]};
 const document={
  readyState:'complete',body:{append(){}},documentElement:{},
  getElementById:id=>id==='griglia-row-resource-id-'+court?(wrongRow?null:row):{},
  querySelectorAll:()=>[],
  createElement:tag=>{
   const el=new Elem(tag);
   if(tag==='div')el.attachShadow=()=>({append(){}});
   if(tag==='button')buttons.push(el);
   return el;
  },
  addEventListener(){}
 };
 const ctx=vm.createContext({document,Elem,Element:Elem,Set,Map,Array,Object,Math,JSON,Date,String,
   Number,RegExp,Error,URL,
   location:{protocol:'https:',hostname:'propadelclub.wansport.com',pathname:'/start',
      href:'https://propadelclub.wansport.com/start'},
   chrome:{runtime:{lastError:null,sendMessage(_msg,cb){cb({ok:true,data:{
     court_id:court,date:'2026-11-18',start:time,end:'21:30',duration:90,
     court:'Campo Centrale',tslot_id:'17911',price:'64 €'}})}}},
   window:{confirm:question=>{questions.push(question);return dateConfirmed;}},
   navigator:{clipboard:{writeText:async()=>{}}},
   MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>1});
 vm.runInContext(code,ctx);
 return {buttons,slotEls,clicked,questions};
}
const button=(run,text)=>run.buttons.find(b=>b.textContent===text);
{
 const t=scenario();
 assert.equal(t.slotEls[0].scrolled,true,'La riga campo 1, ora 20:00 deve essere evidenziata.');
 assert.match(t.slotEls[0].style.outline,/3px solid/);
 assert.equal(button(t,'Apri dettaglio fascia').disabled,false);
 button(t,'Apri dettaglio fascia').onclick();
 assert.equal(t.questions.length,1);
 assert.match(t.questions[0],/2026-11-18/);
 assert.equal(t.clicked.length,0,'Se la data non è confermata, nessun click.');
}
{
 const t=scenario({dateConfirmed:true});
 button(t,'Apri dettaglio fascia').onclick();
 assert.equal(t.clicked.length,1,'Dopo conferma esplicita, solo il dettaglio della cella esatta.');
 assert.equal(t.clicked[0],t.slotEls[0]);
}
for(const variant of [{cells:['19:30']},{cells:['20:00','20:00']},
  {cells:['20:00','21:00'] ,time:'18:30'},{wrongRow:true}]){
 const t=scenario(variant);
 assert.equal(button(t,'Apri dettaglio fascia').disabled,true);
 assert.equal(t.clicked.length,0);
}
assert.match(code,/scanResourceClock/);
assert.match(code,/resourceClockMatches/);
assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|\.submit\(/);
console.log('Wansport v1.19: riga campo + ora esatta, unicità e conferma data superati.');
