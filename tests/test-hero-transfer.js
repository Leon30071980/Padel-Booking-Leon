const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('chrome-extension/background.js','utf8');
const listeners=[],session=new Map(),tabs=[],messages=[],updates=[];
const chrome={runtime:{id:'test',lastError:null,onMessage:{addListener(fn){listeners.push(fn);}}},tabs:{
 create(options,cb){const tab={...options,id:101};tabs.push(tab);cb(tab);},
 async update(id,data){updates.push({id,...data});if(data.url)assert.ok(session.has('pbl_hero_request_'+id));},
 async sendMessage(id,data){messages.push({id,data});return undefined;}
},storage:{session:{async set(o){for(const [k,v] of Object.entries(o))session.set(k,v);},async get(k){return {[k]:session.get(k)};},async remove(k){session.delete(k);}}}};
const context=vm.createContext({chrome,URL,Date,fetch(){throw Error('Rete non consentita');}});
vm.runInContext(source,context);
function message(kind,payload,sender){
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>{if(!done)reject(Error('Nessuna risposta '+kind));},200);
  for(const fn of listeners){
   const async=fn({channel:'pbl-playtomic-chrome-v1',kind,payload},sender,r=>{done=true;clearTimeout(timer);resolve(r);});
   if(async===true||done)break;
  }
 });
}
(async()=>{
const app={id:'test',url:'https://leon30071980.github.io/Padel-Booking-Leon/',tab:{id:88}};
const portal={id:'test',url:'https://playtomic.com/clubs/padel-hero-parma',tab:{id:101}};
const req={key:'12345678-1234-1234-1234-123456789abc',date:'2099-11-18',time:'21:30',duration:90,tolerance:30};
const line='CAMPO 11 INDOOR;21:30;23:00;coperto;slot';
assert.equal((await message('hero-open',req,app)).ok,true);
assert.equal(tabs.length,1);assert.equal(updates[0].url,portal.url);
const ctx=await message('hero-context',null,portal);
assert.equal(ctx.ok,true);assert.equal(ctx.data.date,req.date);assert.equal(ctx.data.appTab,undefined);
assert.equal((await message('hero-context',null,{...portal,tab:{id:102}})).ok,false);
assert.equal((await message('hero-import',{key:req.key,date:'2099-11-19',lines:[line],seen:1,unrecognized:0},portal)).ok,false);
assert.equal((await message('hero-import',{key:req.key,date:req.date,lines:[line],seen:1,unrecognized:0},{...portal,url:'https://example.com/'})).ok,false);
const res=await message('hero-import',{key:req.key,date:req.date,lines:[line,line],seen:2,unrecognized:0},portal);
assert.equal(res.ok,true);assert.equal(res.count,1);assert.equal(messages.length,1);assert.equal(messages[0].id,88);assert.equal(messages[0].data.data.lines[0],line);assert.ok(updates.some(x=>x.id===88&&x.active));
const pulled=await message('hero-pull',null,app);assert.equal(pulled.data.key,req.key);
assert.equal((await message('hero-pull',null,{...app,tab:{id:99}})).data,null);
const empty=await message('hero-import',{key:req.key,date:req.date,lines:[],seen:4,unrecognized:0},portal);assert.equal(empty.ok,true);assert.equal(empty.count,0);
console.log('v1.28: apertura calendario, isolamento schede, data, deduplicazione, ritorno all’app e zero fasce verificati.');
})().catch(e=>{console.error(e);process.exitCode=1;});
