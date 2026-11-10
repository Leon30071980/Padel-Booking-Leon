# Padel Booking Leon — v1.9

## Prezzi, sedi, copertura e prenotazione sul portale (nuovo)
Le righe delle disponibilità ora mostrano:
- **Località:** Parma per Gunners e Punto G, San Prospero per Padel Hero; Pro Padel è a Parma/Vigatto e viene distinta per singola sede soltanto quando il calendario Wansport restituisce un nome che lo indica chiaramente. Altrimenti compare «Parma / Vigatto · sede da verificare».
- **Coperto/scoperto:** solo quando il calendario contiene un campo esplicito booleano sulla copertura oppure viene salvata una **nota personale** sul singolo campo. In tutti gli altri casi mostra «Copertura da verificare».
- **Prezzi:** quelli dell'API Playtomic sono riportati come «Prezzo portale»; dove mancano, è possibile memorizzare un prezzo **indicativo personale** cliccando «Dettagli» accanto al campo. Non vengono inventati prezzi Wansport.
- **«Prenota sul sito»** apre soltanto il portale ufficiale del centro, senza precompilare il campo né completare una transazione. Prenotazione e pagamento restano esclusivamente sui portali ufficiali.

Le note personali sono salvate nelle User Properties di Apps Script, nel progetto privato, non nel repository né nell'archivio condiviso. Sono associate a coppia club+ID campo; il prezzo indicativo è una nota per campo, non un listino dinamico per ogni durata. Se cambia la durata, verificare sempre il prezzo sul portale. I tre connettori Wansport e quello Playtomic Chrome continuano a cercare le disponibilità come nella v1.8.

---
# Padel Booking Leon — v1.9

## Estensione Chrome per Padel Hero (nuova)
In questa versione **Padel Hero viene letto dal Chrome locale**, non da Google Apps Script.
L'estensione `chrome-extension/` utilizza Manifest V3, consente richieste GET soltanto verso Playtomic,
e accetta messaggi solo dalla pagina `https://leon30071980.github.io/Padel-Booking-Leon/`.
Non richiede email, password, cookie o token e non invia prenotazioni.

### Installazione
1. In GitHub Desktop eseguire **Fetch origin / Pull origin**.
2. Aprire Chrome su `chrome://extensions` e attivare **Modalità sviluppatore**.
3. Premere **Carica estensione non pacchettizzata** e scegliere la sottocartella locale
   `Padel-Booking-Leon/chrome-extension` che contiene `manifest.json`.
4. Aggiornare la pagina GitHub Pages con Ctrl+F5 e usare **Verifica estensione Chrome**
   nella scheda Padel Hero. La richiesta di test è di sola lettura.
5. Usare **Cerca disponibilità** per includere anche Padel Hero insieme ai centri Wansport.

Se Playtomic risponde 403 anche all'estensione, è un limite del server da rispettare.
L'estensione non consente controlli automatici quando Chrome è chiuso e **non funziona su
Chrome iOS**. Le ricerche programmate sul backend sono disponibili solo per Wansport;
la programmazione di nuove richieste con Padel Hero viene rifiutata esplicitamente.

**Importante:** le estensioni caricate come non pacchettizzate non si aggiornano tramite
GitHub Pages. Quando cambiano i file `chrome-extension/`, effettuare Pull in GitHub Desktop
e premere **Ricarica** sull'estensione in `chrome://extensions`.

---
# Padel Booking Leon — v1.9

**Novità v1.9:** aggiunto connettore Playtomic per Padel Hero Parma, in sola lettura. Endpoint web osservato dal proprietario: `GET /api/clubs/availability?tenant_id=15bfd441-153f-40ed-9da0-e3a12dd1b0d5&date=YYYY-MM-DD&sport_id=PADEL`. Verifica del calendario da Google Apps Script tramite pulsante **Verifica Playtomic**. L'endpoint non è garantito come API pubblica stabile. Se Google riceve 403/429 o JSON diverso, mostra errore senza inventare disponibilità. Prezzo visibile sui risultati quando restituito.

**Nessun login Playtomic, nessuna prenotazione, nessun pagamento.** Le offerte sono considerate compatibili soltanto quando la durata corrisponde esattamente a quella richiesta. Finestra di ricerca basata sull'orario di partenza ±tolleranza. Il nome del campo è derivato dal JSON soltanto se presente; altrimenti viene mostrata una parte di `resource_id` per distinguerli. Le disponibilità vanno sempre riconfermate su Playtomic.

**Da verificare in produzione:** l'accesso diretto da Google Apps Script all'endpoint potrebbe essere bloccato o soggetto a restrizioni; lo screenshot Chrome non prova da solo l'accessibilità cloud.

# Padel Booking Leon — v1.9

**Frontend completo su GitHub Pages; backend privato su Google Apps Script e archivio su Google Sheets.**

## Stato del rilascio

Il frontend su GitHub include l'interfaccia completa della v1.4 (con la grafica e i moduli originali). **Il collegamento live richiede una Web App Google Apps Script**: il deployment precedentemente configurato era di tipo *libreria*, perciò il suo URL non può funzionare con `/exec`. La v1.9 non afferma di avere un collegamento live finché il browser non lo conferma. GitHub Pages è pubblico; il backend resta privato e non si trasferiscono password, cookie o token nel repository.

Nessuna prenotazione o pagamento automatico viene effettuato. Gunners è stato verificato dall'utente nelle versioni precedenti; Pro Padel e Punto G restano sperimentali. Padel Hero (Playtomic) non è integrato.

## Avvio dell'interfaccia su GitHub

URL: https://leon30071980.github.io/Padel-Booking-Leon/

La pagina GitHub è una web app completa: HTML, CSS, JS in `github-pages/`; il file `index.html` alla radice facilita le configurazioni Pages basate su `main` e cartella `/`.

## Creare il backend Web App corretto (una volta)

1. Aprire **il progetto esistente** su https://script.google.com/home (non creare un nuovo progetto e non rieseguire `setupApp`).
2. Il codice della v1.9 deve essere presente nel progetto, incluso `Bridge.html`. Configurare `APPS_SCRIPT_WEBAPP_VERIFIED=true` su GitHub **soltanto dopo** aver creato e verificato il deployment Web App, oppure eseguire un `clasp push` controllato da Codespaces prima della prima creazione dell'App web.
3. In **Esegui deployment → Nuovo deployment → Seleziona tipo → App web** (non Libreria), usare **Esegui come me** e **Chi ha accesso: Solo io**. Concludere il deployment e copiare il link `/exec` fornito da Google.
4. Aprire l'URL `/exec` in una scheda del browser per completare l'accesso Google e verificare che funzioni. Se il browser blocca i cookie di terze parti o l'iframe, il collegamento dentro GitHub Pages potrebbe non riuscire. In tal caso utilizzare direttamente l'App web privata Google; non impostare l'accesso pubblico come scorciatoia.
5. Aprire il sito GitHub Pages, incollare l'URL `/exec` nel riquadro **Backend Google privato**, premere **Collega**. L'indirizzo viene conservato in `localStorage` sul proprio dispositivo, mai nel repository.
6. Sostituire nel repository secret `APPS_SCRIPT_DEPLOYMENT_ID` con il **nuovo ID di distribuzione della App web** e impostare la variabile `APPS_SCRIPT_WEBAPP_VERIFIED=true` in Settings → Secrets and variables → Actions → Variables. Tenere `AUTO_DEPLOY_ENABLED` disattivato fino al collaudo.
7. In Actions → Publish Google Apps Script → Run workflow, pubblicare la v1.9 sul deployment Web App corretto. Quindi riprovare il collegamento dal sito GitHub.

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

v1.4: repository e CI; v1.9: frontend GitHub Pages completo, ponte Apps Script privato e protezione del deployment. La versione è operativa solo quando entrambi i deployment risultano configurati e il collegamento è testato.


## v1.9 — Interfaccia compatta Google

Dopo il messaggio «Google collegato», il pannello di configurazione viene nascosto automaticamente. Il pulsante 🔐 Google nell'intestazione consente di riaprire le impostazioni, senza rimuovere il collegamento. Se la connessione non riesce, la configurazione resta visibile. La funzionalità esistente Wansport e le richieste non cambiano.
