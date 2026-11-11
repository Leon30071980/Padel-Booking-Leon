/* Padel Booking Leon v1.19 — mouse+F8 inspection: zero clicks and bounded metadata. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('chrome-extension/wansport-handoff.js','utf8');
let listeners={},buttons=[],clip='',clicks=0;
class FakeElement {
 constructor(tag='div',attrs={}){
  this.tagName=tag.toUpperCase();this.style={outline:'',outlineOffset:''};
  this.dataset={};this.attrs=attrs;this.attributes=Object.entries(attrs).map(([name,value])=>({name,value}));
  this.parentElement=null;this.textContent='';this.children=[];this.id='';
 }
 getAttribute(name){return this.attrs[name]??null;}
 closest(){return null;}
 contains(){return false;}
 append(...els){this.children.push(...els);}
 scrollIntoView(){this.scrolled=true;}
 click(){clicks++;}
 setAttribute(name,value){this.attrs[name]=value;}
 set onclick(fn){this._onclick=fn;}
 get onclick(){return this._onclick;}
}
const hovered=new FakeElement('div',{
  class:'slot-cell available resource', 'data-start-time':'20:00',
  'data-tslot-id':'17911','data-csrf-token':'secret1234','title':'Private account details'});
hovered.textContent='20:00 John secret password abc';
const parent=new FakeElement('td',{class:'grid-slot'});hovered.parentElement=parent;
const body=new FakeElement('body'),root=new FakeElement('html');
const document={
 body,documentElement:root,readyState:'complete',
 querySelectorAll(){return [];},
 createElement(tag){
  const el=new FakeElement(tag);
  if(tag==='div'){el.attachShadow=()=>new FakeElement('shadow');}
  if(tag==='button')buttons.push(el);
  return el;
 },
 getElementById(){return body;},
 addEventListener(name,cb){listeners[name]=cb;}
};
const ctx=vm.createContext({
 document,Element:FakeElement,chrome:{runtime:{lastError:null,sendMessage(_msg,cb){
  cb({ok:true,data:{tslot_id:'17911',date:'2026-11-18',start:'20:00',end:'21:30',court:'Campo Centrale N.1',
   price:'64,00 €',duration:90}});
 }}},
 location:{protocol:'https:',hostname:'propadelclub.wansport.com',pathname:'/start',
 href:'https://propadelclub.wansport.com/start'},URL,Set,Map,Array,Object,Math,JSON,Date,String,Number,RegExp,Error,
 MutationObserver:class{observe(){}disconnect(){}},
 setTimeout:()=>1,
 navigator:{clipboard:{writeText:async s=>{clip=s;}}}
});
new vm.Script(source).runInContext(ctx);
const byText=text=>buttons.find(x=>x.textContent===text);
assert.ok(byText('Analizza una cella'));
assert.ok(byText('Copia struttura'));
assert.equal(byText('Copia struttura').disabled,true);
byText('Analizza una cella').onclick();
listeners.pointerover({target:hovered});
assert.match(hovered.style.outline,/dashed/);
let prevented=false;
listeners.keydown({key:'F8',preventDefault(){prevented=true;},stopPropagation(){}});
assert.equal(prevented,true);
assert.equal(clicks,0,'Nessun click deve avvenire durante l’analisi.');
assert.equal(byText('Copia struttura').disabled,false);
byText('Copia struttura').onclick();
setImmediate(()=>{
 assert.match(clip,/data-start-time=20:00/);
 assert.match(clip,/data-tslot-id=17911/);
 assert.doesNotMatch(clip,/secret1234|John secret|Private account details|password abc/);
 assert.match(clip,/Catena HTML/);
 assert.equal(clicks,0,'La sola copia non deve selezionare né prenotare.');
 assert.doesNotMatch(source,/XMLHttpRequest|fetch\(/);
 console.log('Wansport v1.19: F8 cattura metadati limitati, senza clic o segreti.');
});
