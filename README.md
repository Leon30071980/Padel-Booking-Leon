# Padel Booking Leon — v1.6

**Frontend completo su GitHub Pages; backend privato su Google Apps Script e archivio su Google Sheets.**

## Stato del rilascio

Il frontend su GitHub include l'interfaccia completa della v1.4 (con la grafica e i moduli originali). **Il collegamento live richiede una Web App Google Apps Script**: il deployment precedentemente configurato era di tipo *libreria*, perciò il suo URL non può funzionare con `/exec`. La v1.6 non afferma di avere un collegamento live finché il browser non lo conferma. GitHub Pages è pubblico; il backend resta privato e non si trasferiscono password, cookie o token nel repository.

Nessuna prenotazione o pagamento automatico viene effettuato. Gunners è stato verificato dall'utente nelle versioni precedenti; Pro Padel e Punto G restano sperimentali. Padel Hero (Playtomic) non è integrato.

## Avvio dell'interfaccia su GitHub

URL: https://leon30071980.github.io/Padel-Booking-Leon/

La pagina GitHub è una web app completa: HTML, CSS, JS in `github-pages/`; il file `index.html` alla radice facilita le configurazioni Pages basate su `main` e cartella `/`.

## Creare il backend Web App corretto (una volta)

1. Aprire **il progetto esistente** su https://script.google.com/home (non creare un nuovo progetto e non rieseguire `setupApp`).
2. Il codice della v1.6 deve essere presente nel progetto, incluso `Bridge.html`. Configurare `APPS_SCRIPT_WEBAPP_VERIFIED=true` su GitHub **soltanto dopo** aver creato e verificato il deployment Web App, oppure eseguire un `clasp push` controllato da Codespaces prima della prima creazione dell'App web.
3. In **Esegui deployment → Nuovo deployment → Seleziona tipo → App web** (non Libreria), usare **Esegui come me** e **Chi ha accesso: Solo io**. Concludere il deployment e copiare il link `/exec` fornito da Google.
4. Aprire l'URL `/exec` in una scheda del browser per completare l'accesso Google e verificare che funzioni. Se il browser blocca i cookie di terze parti o l'iframe, il collegamento dentro GitHub Pages potrebbe non riuscire. In tal caso utilizzare direttamente l'App web privata Google; non impostare l'accesso pubblico come scorciatoia.
5. Aprire il sito GitHub Pages, incollare l'URL `/exec` nel riquadro **Backend Google privato**, premere **Collega**. L'indirizzo viene conservato in `localStorage` sul proprio dispositivo, mai nel repository.
6. Sostituire nel repository secret `APPS_SCRIPT_DEPLOYMENT_ID` con il **nuovo ID di distribuzione della App web** e impostare la variabile `APPS_SCRIPT_WEBAPP_VERIFIED=true` in Settings → Secrets and variables → Actions → Variables. Tenere `AUTO_DEPLOY_ENABLED` disattivato fino al collaudo.
7. In Actions → Publish Google Apps Script → Run workflow, pubblicare la v1.6 sul deployment Web App corretto. Quindi riprovare il collegamento dal sito GitHub.

**Ordine consigliato**: aggiornare in via manuale il codice Apps Script prima della creazione dell'App web e usare il workflow automatizzato soltanto dopo avere un deployment Web App verificato. Il workflow ora rifiuta di pubblicare finché `APPS_SCRIPT_WEBAPP_VERIFIED` non sia impostata a `true` per evitare che venga aggiornata nuovamente una libreria.

## Sicurezza del ponte

`Bridge.html` viene servito esclusivamente dalla Web App Google con `?bridge=1&nonce=...`. Accetta messaggi solo da `https://leon30071980.github.io`, con nonce casuale e lista esplicita delle funzioni consentite. Il browser richiede lo stesso account Google per l'accesso alla Web App. Il codice frontend non contiene password e non espone un `doPost` pubblico. Il ponte effettua comunque chiamate privilegiate: non rendere pubblica la distribuzione Apps Script e non esporre il contenuto di `CLASPRC_JSON`.

L'uso di HTMLService in iframe con autenticazione privata non è universalmente affidabile, a causa delle restrizioni dei browser su cookie di terze parti. Un collegamento da GitHub Pages non può essere garantito finché non viene collaudato nello specifico browser dell'utente. Se fallisce, occorre una soluzione backend OAuth dedicata oppure usare direttamente l'interfaccia Google privata.

## File e test

- `github-pages/index.html`, `styles.css`, `app.js`, `bridge.js`: interfaccia GitHub completa.
- `index.html`: entrata per GitHub Pages via branch `/`.
- `apps-script/Bridge.html`: gestisce il canale privato con `google.script.run`.
- `apps-script/Code.gs`: routing su `doGet(e)` per pagina privata e bridge.
- `apps-script/appsscript.json`: impostazioni Web App `MYSELF` / `USER_DEPLOYING`.
- `.github/workflows/google-apps-script.yml`: deploy manuale, vincolato all'esistenza di una Web App verificata.
- `npm test`: 29 test precedenti, verifiche statiche e test del bridge.

## Versionamento

v1.4: repository e CI; v1.6: frontend GitHub Pages completo, ponte Apps Script privato e protezione del deployment. La versione è operativa solo quando entrambi i deployment risultano configurati e il collegamento è testato.


## v1.6 — Interfaccia compatta Google

Dopo il messaggio «Google collegato», il pannello di configurazione viene nascosto automaticamente. Il pulsante 🔐 Google nell'intestazione consente di riaprire le impostazioni, senza rimuovere il collegamento. Se la connessione non riesce, la configurazione resta visibile. La funzionalità esistente Wansport e le richieste non cambiano.
