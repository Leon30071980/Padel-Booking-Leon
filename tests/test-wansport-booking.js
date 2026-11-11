/* Padel Booking Leon v1.20 — regression test: booking is deliberate and guarded. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('chrome-extension/wansport-booking.js','utf8');
new vm.Script(source,{filename:'wansport-booking.js'});
const manifest=JSON.parse(fs.readFileSync('chrome-extension/manifest.json','utf8'));
assert.equal(manifest.version,'1.20.0');
const wansport=manifest.content_scripts.find(s=>s.js.includes('wansport-booking.js'));
assert.ok(wansport&&wansport.js.includes('wansport-handoff.js'));
assert.deepEqual(wansport.matches.sort(),[
 'https://gunnerspadel.wansport.com/*','https://propadelclub.wansport.com/*',
 'https://puntogpadel.wansport.com/*'].sort());
assert.match(source,/location\.hostname!=='propadelclub\.wansport\.com'/);
assert.match(source,/const allowedDurations=new Set\(\[60,90,120\]\)/);
assert.match(source,/s\.durAction\.click\(\)/);
assert.match(source,/prepared&&s\.dateOk&&s\.courtOk&&s\.startOk&&s\.endOk/);
assert.match(source,/!!s\.price&&privateOk&&!!s\.action/);
assert.match(source,/window\.confirm\(message\)/);
assert.match(source,/latest\.action\.click\(\)/);
assert.match(source,/submitted=true/);
assert.match(source,/if\(submitted\|\|!modal\)return/);
assert.match(source,/Pagamento AL CENTRO|pagamento AL CENTRO|pagamento al centro/i);
assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|\.submit\(|\.requestSubmit\(/);
assert.doesNotMatch(source,/setInterval\(/);
console.log('Wansport v1.20: durata, privacy, costo, conferma esplicita e blocco doppio invio presenti.');
