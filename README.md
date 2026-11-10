# Padel Booking Leon — v1.16

## Ricerca fascia Wansport: diagnostica migliorata

Il pulsante «Trova fascia» nella guida Chrome ora mostra sempre un esito. Se la pagina è /start, segnala che non si tratta del pannello prenotazioni e offre «Apri pannello». Sul calendario, esegue una ricerca univoca di tslotId negli attributi data-*, onclick e ID HTML riferiti alle fasce. Nessuna selezione automatica in caso di ID assente o più corrispondenze.

Il nuovo pulsante «Copia diagnosi» copia soltanto dominio, pagina, data/orario e conteggi di possibili corrispondenze; non include credenziali, cookie o token. Il percorso del pannello prenotazioni è da verificare per ciascuna installazione Wansport; se non funziona, tornare a /start e navigare manualmente al calendario.

Nessun pagamento, prenotazione o conferma automatica. «Apri dettaglio fascia» richiede un click esplicito e una corrispondenza esatta.

Aggiornamento: GitHub Desktop Pull origin, chrome://extensions Ricarica (versione 1.16.0), poi Ctrl+F5 sull'app.

---
# Padel Booking Leon — v1.16

## Correzione apertura fascia Wansport

Risolti due problemi distinti nel passaggio GitHub Pages → estensione Chrome:
1. **Versioni non allineate:** il bridge ora controlla che l'estensione dichiari esplicitamente la funzione `wansport-handoff`. Se è obsoleta mostra un messaggio dettagliato con la versione installata e come aggiornarla, anziché aspettare 15 secondi e mostrare un avviso generico.
2. **Caricamento anticipato della scheda:** l'estensione crea prima una scheda vuota, registra in `chrome.storage.session` i dati temporanei dello slot, quindi apre Wansport. Il riquadro di guida può quindi leggere i dati già pronti alla prima apertura della pagina.

Se l'apertura non riesce, l'app mostra l'errore preciso e lascia un link diretto al sito ufficiale. Nessuna password o cookie viene trasferito. Nessuna prenotazione o pagamento viene effettuato dall'estensione.

### Aggiornamento richiesto sul PC
In **GitHub Desktop**, `Fetch origin → Pull origin`; poi in Chrome aprire `chrome://extensions`, premere **Ricarica** sull'estensione Padel Booking Leon e infine effettuare **Ctrl+F5** sulla pagina della nostra app. Verificare che l'estensione mostri **1.15.0**. Chrome potrebbe richiedere di confermare le autorizzazioni Wansport.

---
# Padel Booking Leon — v1.16

## Apertura guidata della fascia Wansport
Da una disponibilità, **Prenota → Apri fascia su Wansport** apre il portale ufficiale in un'altra scheda di Chrome con l'estensione v1.16. Un pannello mantiene campo, data, orario, durata e prezzo selezionati. Se l'estensione riconosce una cella del calendario con lo stesso `tslot_id`, la evidenzia. **Apri dettaglio fascia** richiede un click esplicito e agisce soltanto su un elemento univoco; se la cella non è riconoscibile non viene selezionata automaticamente. La sessione Wansport e l'eventuale pagamento rimangono sul suo sito. L'estensione non effettua POST né conferme di prenotazione.

L'apertura avviene su `/start`: non è stato verificato un URL Wansport che pre-selezioni direttamente giorno, campo e ora. La guida è disponibile per 10 minuti ed è isolata nella singola scheda usando Chrome Session Storage. **Per usare la funzione occorre aggiornare l'estensione:** GitHub Desktop → Pull origin, poi `chrome://extensions` → Ricarica Padel Booking Leon. Chrome può chiedere i permessi aggiuntivi di accesso ai siti Wansport e apertura schede.

---
# Padel Booking Leon — v1.16

## Prenotazione assistita
Dalla disponibilità selezionata si apre un riepilogo con centro, campo, località, copertura, data, fascia, durata e preventivo disponibile. I comandi **Copia riepilogo**, **Ricontrolla disponibilità** e **Apri portale per prenotare** non producono prenotazioni. Il controllo aggiorna la disponibilità in sola lettura: Wansport tramite Apps Script privato e Padel Hero tramite l'estensione Chrome locale.

**Limite importante:** il portale ufficiale viene aperto senza selezionare automaticamente lo slot. L'effettiva prenotazione e l'eventuale pagamento devono essere confermati sul portale. La v1.16 non esegue POST di prenotazione o addebiti e non considera una disponibilità come campo riservato.

---
# Padel Booking Leon — v1.16

## Prezzi automatici in ricerca (Pro Padel)
Dopo il caricamento delle disponibilità, la pagina richiede **automaticamente i preventivi per i primi 9 slot compatibili Pro Padel** (in piccoli gruppi da 3). Non occorre più premere il pulsante manuale. I risultati appaiono immediatamente; mentre arrivano le tariffe, le card mostrano «Calcolo in corso…» e poi il prezzo di preventivo, oppure «Preventivo non disponibile».

Le durate **60, 90 e 120 minuti** sono supportate nel motore di prova. Per 60 minuti l'URL Wansport osservato usa `duration=` (vuoto); per 90/120 il motore prova rispettivamente `duration=90` e `duration=120`. **Questi due parametri non sono stati confermati dal portale:** il prezzo viene mostrato soltanto se la risposta autenticata restituisce il giorno, l'ora iniziale, l'ora finale e la valuta attesi. Un preventivo da 60 minuti non viene mai riutilizzato per 90/120. Se il portale rifiuta la lettura o non conferma la durata, non è mostrato alcun prezzo inventato.

La ricerca utilizza un massimo di 3 batch (9 slot) per limitare le richieste al portale, e una cache temporanea di 45 secondi. Per gli altri risultati la tariffa resta «Da verificare» oppure la nota personale precedentemente salvata. In caso di HTTP 429 ulteriori letture vengono interrotte. La quotazione non prenota, non blocca il campo e non avvia pagamenti. Il prezzo può cambiare a seconda della durata e delle condizioni dell'account.

L'integrazione riguarda soltanto Pro Padel: sugli altri centri Wansport resta la lettura del calendario, e Padel Hero continua a usare Chrome senza modifiche.

---
# Padel Booking Leon — v1.16

## Preventivi Pro Padel (sperimentale, sola lettura)
Endpoint GET osservato il 10/11/2026 su Pro Padel: `prenotazioni.getPrenotazioneNuovaModal` restituisce un riepilogo costi, come `costoTotalePrenotazioneNF: 52` per uno slot di **60 minuti**, senza confermare una prenotazione.

La nuova azione **€ Verifica prezzo** appare unicamente sugli slot Pro Padel di 60 minuti: esegue una verifica aggiornata della disponibilità attraverso la sessione privata Google Apps Script e apre esclusivamente l'anteprima GET, se il calendario espone un identificativo numerico della fascia iniziale (`tslotId`). Se mancano ID, prezzo o corrispondenza esatta di giorno/orari/durata, restituisce un errore anziché inventare prezzi o spostare prenotazioni. L'importo si riferisce al profilo corrente (socio/non socio) e può cambiare. Nessuna prenotazione o pagamento.

**Limiti:** l'ID `tslotId` deve essere presente nel calendario. Il collegamento tra ID e risultato è verificato mediante disponibilità aggiornata; se Wansport usa un campo diverso, sarà necessario un esempio non sensibile della struttura `tslots[]`. L'anteprima da 90 e 120 minuti non è ancora autorizzata poiché il comportamento del parametro `duration` non è stato osservato. I pulsanti "Prenota sul sito" continuano ad aprire soltanto il portale ufficiale.

---
# Padel Booking Leon — v1.16

**Correzione Wansport e leggibilità:** i nomi dei campi contenenti PRO GREEN / Vigatto vengono assegnati a Vigatto, quelli con PRO PARMA a Parma. I nomi che contengono «Coperto» o «Open» sono interpretati come indizio rispettivamente indoor/outdoor; le note manuali per singolo campo mantengono priorità. I campi privi di indicazioni restano da verificare. Nuovo layout verticale leggibile anche in pannelli stretti. Nessun prezzo viene inventato: è possibile che la tariffa compaia soltanto nel passaggio successivo alla selezione dello slot sul sito Wansport. Il pulsante «Prenota sul sito» apre il portale ufficiale e non prenota in automatico.

---
# Padel Booking Leon — v1.16

## Prezzi, sedi, copertura e prenotazione sul portale (nuovo)
Le righe delle disponibilità ora mostrano:
- **Località:** Parma per Gunners e Punto G, San Prospero per Padel Hero; Pro Padel è a Parma/Vigatto e viene distinta per singola sede soltanto quando il calendario Wansport restituisce un nome che lo indica chiaramente. Altrimenti compare «Parma / Vigatto · sede da verificare».
- **Coperto/scoperto:** solo quando il calendario contiene un campo esplicito booleano sulla copertura oppure viene salvata una **nota personale** sul singolo campo. In tutti gli altri casi mostra «Copertura da verificare».
- **Prezzi:** quelli dell'API Playtomic sono riportati come «Prezzo portale»; dove mancano, è possibile memorizzare un prezzo **indicativo personale** cliccando «Dettagli» accanto al campo. Non vengono inventati prezzi Wansport.
- **«Prenota sul sito»** apre soltanto il portale ufficiale del centro, senza precompilare il campo né completare una transazione. Prenotazione e pagamento restano esclusivamente sui portali ufficiali.

Le note personali sono salvate nelle User Properties di Apps Script, nel progetto privato, non nel repository né nell'archivio condiviso. Sono associate a coppia club+ID campo; il prezzo indicativo è una nota per campo, non un listino dinamico per ogni durata. Se cambia la durata, verificare sempre il prezzo sul portale. I tre connettori Wansport e quello Playtomic Chrome continuano a cercare le disponibilità come nella v1.8.

---
# Padel Booking Leon — v1.16

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
# Padel Booking Leon — v1.16

**Novità v1.16:** aggiunto connettore Playtomic per Padel Hero Parma, in sola lettura. Endpoint web osservato dal proprietario: `GET /api/clubs/availability?tenant_id=15bfd441-153f-40ed-9da0-e3a12dd1b0d5&date=YYYY-MM-DD&sport_id=PADEL`. Verifica del calendario da Google Apps Script tramite pulsante **Verifica Playtomic**. L'endpoint non è garantito come API pubblica stabile. Se Google riceve 403/429 o JSON diverso, mostra errore senza inventare disponibilità. Prezzo visibile sui risultati quando restituito.

**Nessun login Playtomic, nessuna prenotazione, nessun pagamento.** Le offerte sono considerate compatibili soltanto quando la durata corrisponde esattamente a quella richiesta. Finestra di ricerca basata sull'orario di partenza ±tolleranza. Il nome del campo è derivato dal JSON soltanto se presente; altrimenti viene mostrata una parte di `resource_id` per distinguerli. Le disponibilità vanno sempre riconfermate su Playtomic.

**Da verificare in produzione:** l'accesso diretto da Google Apps Script all'endpoint potrebbe essere bloccato o soggetto a restrizioni; lo screenshot Chrome non prova da solo l'accessibilità cloud.

# Padel Booking Leon — v1.16

**Frontend completo su GitHub Pages; backend privato su Google Apps Script e archivio su Google Sheets.**

## Stato del rilascio

Il frontend su GitHub include l'interfaccia completa della v1.4 (con la grafica e i moduli originali). **Il collegamento live richiede una Web App Google Apps Script**: il deployment precedentemente configurato era di tipo *libreria*, perciò il suo URL non può funzionare con `/exec`. La v1.16 non afferma di avere un collegamento live finché il browser non lo conferma. GitHub Pages è pubblico; il backend resta privato e non si trasferiscono password, cookie o token nel repository.

Nessuna prenotazione o pagamento automatico viene effettuato. Gunners è stato verificato dall'utente nelle versioni precedenti; Pro Padel e Punto G restano sperimentali. Padel Hero (Playtomic) non è integrato.

## Avvio dell'interfaccia su GitHub

URL: https://leon30071980.github.io/Padel-Booking-Leon/

La pagina GitHub è una web app completa: HTML, CSS, JS in `github-pages/`; il file `index.html` alla radice facilita le configurazioni Pages basate su `main` e cartella `/`.

## Creare il backend Web App corretto (una volta)

1. Aprire **il progetto esistente** su https://script.google.com/home (non creare un nuovo progetto e non rieseguire `setupApp`).
2. Il codice della v1.16 deve essere presente nel progetto, incluso `Bridge.html`. Configurare `APPS_SCRIPT_WEBAPP_VERIFIED=true` su GitHub **soltanto dopo** aver creato e verificato il deployment Web App, oppure eseguire un `clasp push` controllato da Codespaces prima della prima creazione dell'App web.
3. In **Esegui deployment → Nuovo deployment → Seleziona tipo → App web** (non Libreria), usare **Esegui come me** e **Chi ha accesso: Solo io**. Concludere il deployment e copiare il link `/exec` fornito da Google.
4. Aprire l'URL `/exec` in una scheda del browser per completare l'accesso Google e verificare che funzioni. Se il browser blocca i cookie di terze parti o l'iframe, il collegamento dentro GitHub Pages potrebbe non riuscire. In tal caso utilizzare direttamente l'App web privata Google; non impostare l'accesso pubblico come scorciatoia.
5. Aprire il sito GitHub Pages, incollare l'URL `/exec` nel riquadro **Backend Google privato**, premere **Collega**. L'indirizzo viene conservato in `localStorage` sul proprio dispositivo, mai nel repository.
6. Sostituire nel repository secret `APPS_SCRIPT_DEPLOYMENT_ID` con il **nuovo ID di distribuzione della App web** e impostare la variabile `APPS_SCRIPT_WEBAPP_VERIFIED=true` in Settings → Secrets and variables → Actions → Variables. Tenere `AUTO_DEPLOY_ENABLED` disattivato fino al collaudo.
7. In Actions → Publish Google Apps Script → Run workflow, pubblicare la v1.16 sul deployment Web App corretto. Quindi riprovare il collegamento dal sito GitHub.

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

v1.4: repository e CI; v1.16: frontend GitHub Pages completo, ponte Apps Script privato e protezione del deployment. La versione è operativa solo quando entrambi i deployment risultano configurati e il collegamento è testato.


## v1.16 — Interfaccia compatta Google

Dopo il messaggio «Google collegato», il pannello di configurazione viene nascosto automaticamente. Il pulsante 🔐 Google nell'intestazione consente di riaprire le impostazioni, senza rimuovere il collegamento. Se la connessione non riesce, la configurazione resta visibile. La funzionalità esistente Wansport e le richieste non cambiano.
