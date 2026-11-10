// Controlli statici indipendenti da Google: nessuna credenziale richiesta.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (path) => fs.readFileSync(path, 'utf8');
const files=['Code.gs','Gunners.gs','WansportExtra.gs','Playtomic.gs','CourtDetails.gs','Index.html','Styles.html','Client.html','Bridge.html','appsscript.json'];
for (const f of files) assert.ok(fs.statSync('apps-script/'+f).size>20, f+' assente o vuoto');
const code=read('apps-script/Code.gs');
assert.match(code,/PBL_VERSION\s*=\s*'v1\.10'/);
assert.match(read('github-pages/index.html'),/v1\.10/);
assert.match(read('apps-script/Client.html'),/v1\.10/);
assert.match(read('apps-script/Index.html'),/v1\.10/);
const manifest=JSON.parse(read('apps-script/appsscript.json'));
assert.equal(manifest.timeZone,'Europe/Rome');
assert.equal(manifest.runtimeVersion,'V8');
assert.equal(manifest.webapp.access,'MYSELF');
assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
assert.match(read('github-pages/index.html'),/id="bridgeForm"/);
assert.match(read('github-pages/app.js'),/PBL_BACKEND\.call/);
assert.doesNotMatch(read('github-pages/app.js'),/google\.script\.run/);
assert.match(read('github-pages/bridge.js'),/crypto\.getRandomValues/);
assert.match(read('apps-script/Bridge.html'),/event\.origin!==ORIGIN/);
// Connettori solo lettura: nessuna API di conferma prenotazione nel progetto.
assert.ok(code.includes('getDashboard'));
assert.ok(read('apps-script/Gunners.gs').includes('getPannelloPrenotazioni'));
assert.ok(read('apps-script/WansportExtra.gs').includes('Wansport'));
assert.ok(read('apps-script/Playtomic.gs').includes('playtomic.com/api/clubs/availability'));
assert.match(code,/searchPlaytomic_\(request\)/);
assert.equal(JSON.parse(read('chrome-extension/manifest.json')).manifest_version,3);
assert.match(read('github-pages/index.html'),/chrome-bridge\.js/);
assert.match(read('github-pages/app.js'),/PBL_CHROME\.query/);
assert.match(read('github-pages/app.js'),/saveCourtDetails/);
assert.match(read('github-pages/index.html'),/id="courtDialog"/);
assert.match(read('apps-script/Bridge.html'),/getCourtDetails/);
assert.match(read('chrome-extension/background.js'),/credentials:'omit'/);
for (const f of files) {
 const content=read('apps-script/'+f);
 assert.doesNotMatch(content,/-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----/);
 assert.doesNotMatch(content,/ghp_[A-Za-z0-9]{20,}/);
}
console.log('v1.10: 10 file Apps Script, manifest, versione e verifiche di base OK.');
