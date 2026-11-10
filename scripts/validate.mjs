// Controlli statici indipendenti da Google: nessuna credenziale richiesta.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (path) => fs.readFileSync(path, 'utf8');
const files=['Code.gs','Gunners.gs','WansportExtra.gs','Index.html','Styles.html','Client.html','appsscript.json'];
for (const f of files) assert.ok(fs.statSync('apps-script/'+f).size>20, f+' assente o vuoto');
const code=read('apps-script/Code.gs');
assert.match(code,/PBL_VERSION\s*=\s*'v1\.4'/);
assert.match(read('github-pages/index.html'),/v1\.4/);
assert.match(read('apps-script/Client.html'),/v1\.4/);
assert.match(read('apps-script/Index.html'),/v1\.4/);
const manifest=JSON.parse(read('apps-script/appsscript.json'));
assert.equal(manifest.timeZone,'Europe/Rome');
assert.equal(manifest.runtimeVersion,'V8');
// Connettori solo lettura: nessuna API di conferma prenotazione nel progetto.
assert.ok(code.includes('getDashboard'));
assert.ok(read('apps-script/Gunners.gs').includes('getPannelloPrenotazioni'));
assert.ok(read('apps-script/WansportExtra.gs').includes('Wansport'));
for (const f of files) {
 const content=read('apps-script/'+f);
 assert.doesNotMatch(content,/-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----/);
 assert.doesNotMatch(content,/ghp_[A-Za-z0-9]{20,}/);
}
console.log('v1.4: 7 file Apps Script, manifest, versione e verifiche di base OK.');
