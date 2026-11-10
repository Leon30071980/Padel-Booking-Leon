/* Offline bridge tests: no network or credentials. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('github-pages/bridge.js','utf8');
const document={elements:{},readyState:'loading',addEventListener(n,fn){this['on'+n]=fn},dispatchEvent(){},
 getElementById(n){return this.elements[n]??=(n==='bridgeForm'?{addEventListener(){}}:{value:'',textContent:'',className:'',href:'',disabled:false})},
 body:{appendChild(){}},createElement(){return {style:{},setAttribute(){},remove(){}}}};
const localStorage={getItem(){return null},setItem(){}};
const handlers={};
const window={addEventListener(n,fn){handlers[n]=fn},location:{origin:'https://leon30071980.github.io'}};
const ctx={window,document,localStorage,crypto:{getRandomValues(arr){for(let i=0;i<arr.length;i++)arr[i]=i+1;return arr}},
 URL,Promise,Error,Set,Map,Array,Number,setTimeout,clearTimeout,CustomEvent:function() {}};
vm.runInNewContext(script,ctx,{filename:'bridge.js'});
assert.equal(typeof window.PBL_BACKEND.call,'function');
assert.equal(window.PBL_BACKEND.validUrl('https://script.google.com/macros/s/AKfyexample-123/exec'),true);
for(const value of [
 'https://evil.example/macros/s/example/exec',
 'https://script.google.com/macros/library/d/example/3',
 'http://script.google.com/macros/s/abc/exec',
 'https://script.google.com/macros/s/abc/exec?password=test',
 'https://script.google.com.evil.tld/macros/s/abc/exec']){
  assert.equal(window.PBL_BACKEND.validUrl(value),false,value);
}
assert.ok(script.includes('event.origin') && script.includes('msg.nonce!==nonce'));
assert.ok(script.includes('allowedActions.has(action)'));
assert.ok(fs.readFileSync('apps-script/Bridge.html','utf8').includes('event.source!==window.top'));
// v1.12: il pannello rimane disponibile, ma si richiude automaticamente con connessione valida.
const html=fs.readFileSync('github-pages/index.html','utf8');
const css=fs.readFileSync('github-pages/styles.css','utf8');
assert.match(html,/id="backendSettingsBtn"/);
assert.match(html,/aria-controls="backendPanel"/);
assert.match(css,/\.github-connect\[hidden\]\s*\{display:none!important\}/);
assert.match(script,/function panelVisible\(open\)/);
assert.match(script,/panelVisible\(!ready\)/);
assert.match(script,/\$\('backendSettingsBtn'\)\.addEventListener\('click'/);
console.log('Ponte v1.12: sicurezza, pannello compatto e pulsante impostazioni OK.');
