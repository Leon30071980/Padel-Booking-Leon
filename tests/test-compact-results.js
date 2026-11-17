const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync('github-pages/app.js','utf8');
const helper=source.slice(source.indexOf('  function numericPrice('),source.indexOf('  function renderResults(){'));
const context=vm.createContext({Map,Set,Math,Number,String,Infinity,Intl});
vm.runInContext(helper,context);
assert.equal(vm.runInContext("numericPrice('68,00 €')",context),68);
assert.equal(vm.runInContext("numericPrice('Da verificare')",context),Infinity);
assert.equal(vm.runInContext("displayMinimum([{knownPrice:'68 €'},{knownPrice:'64 €'},{knownPrice:''}])",context),'da 64 €');
assert.ok(vm.runInContext("compactOrder({knownPrice:'64 €',slot:{start:'20:00'}},{knownPrice:'',slot:{start:'19:00'}},'price')<0",context));
assert.match(source,/state\.openGroups\.clear\(\)/);
assert.match(source,/data-result-group/);
assert.match(source,/state\.openGroups\.has/);
assert.match(source,/fresh\.status!=='available'/);
for(const file of ['index.html','github-pages/index.html','apps-script/Index.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const id of ['resultCover','resultSort','expandResults','collapseResults','resultsSummary','componentStatus'])assert.ok(html.includes('id="'+id+'"'),file+' '+id);
}
console.log('v1.27: gruppi, prezzi noti, filtri e ordinamento verificati.');
