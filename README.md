# Padel Booking Leon — v1.4

**Versione con sorgenti su GitHub, esecuzione su Google Apps Script e archivio Google Sheets/Drive.**

La v1.4 è una migrazione di sviluppo/deployment: mantiene tutta la logica di sola lettura della v1.3 (Gunners, connettori sperimentali Pro e Punto G, scheduler e interfaccia). **Non effettua prenotazioni, ricariche o pagamenti.** Padel Hero Playtomic non è ancora integrato. Il connettore Gunners risultava funzionante nel precedente test riferito dall'utente; Pro e Punto G sono ancora da verificare.

## Architettura

- **GitHub**: fonte del codice `apps-script/`, test, workflow CI e GitHub Pages.
- **Google Apps Script**: esegue HTMLService, accessi Wansport e controlli automatici a PC spento; resta lo stesso progetto Google della v1.3.
- **Google Sheets/Drive**: configurazioni, richieste e cronologia già presenti. I dati non vengono migrati o cancellati.
- **GitHub Pages**: pagina pubblica di avvio che non espone password; l'URL dell'app Google viene salvato nel browser dell'utente, non nel repository.

## Stato della migrazione

**I file su GitHub non aggiornano automaticamente la web app Google finché non si configurano le credenziali e non si esegue il primo deployment.** La v1.3 in Google continua a funzionare. Il progetto Google è privato; non rendere pubblica la web app. La v1.4 è disponibile come sorgente; diventa versione operativa dopo la pubblicazione con successo.

## Prima attivazione (una sola volta)

1. Accedere a [Apps Script](https://script.google.com/home) e aprire il **progetto già esistente**. Non creare un nuovo script e non eseguire nuovamente `setupApp`.
2. In **Impostazioni progetto**, copiare l'**ID script** (non l'ID spreadsheet e non l'URL `/exec`).
3. In **Esegui deployment → Gestisci deployment**, aprire il deployment web già in uso e copiarne l'**ID deployment**. Deve essere quello esistente, per conservare lo stesso URL `/exec`.
4. In [Impostazioni Apps Script API](https://script.google.com/home/usersettings), abilitare **API di Google Apps Script**.
5. Eseguire una sola volta `clasp login` **in un terminale controllato dall'utente** e recuperare `~/.clasprc.json` (OAuth del Suo account). Si può usare un ambiente cloud nel browser (ad es. GitHub Codespaces, se disponibile) per evitare installazioni permanenti, ma è necessario completare l'autorizzazione Google; non incollare il file in chat. Guida ufficiale: https://developers.google.com/apps-script/guides/clasp
6. Nel repository GitHub: **Settings → Secrets and variables → Actions → Secrets**, creare:
   - `APPS_SCRIPT_ID`: ID script del punto 2;
   - `APPS_SCRIPT_DEPLOYMENT_ID`: ID deployment del punto 3;
   - `CLASPRC_JSON`: **intero contenuto** del file `~/.clasprc.json`, custodito in segreto.
7. In **Settings → Environments**, creare l'ambiente `google-production`. Se disponibile, abilitare l'approvazione dei deployment e limitare il branch a `main`. Senza queste opzioni il workflow funziona comunque, ma ha minori protezioni.
8. Aprire **Actions → Publish Google Apps Script → Run workflow** (branch `main`). Il workflow esegue test, trasferisce i file con clasp e **aggiorna il deployment esistente**. La prima esecuzione va lanciata solo dopo aver verificato che i file della v1.3 presenti nel progetto Google corrispondano a quelli ora in GitHub; `clasp push --force` sostituisce i file del progetto remoto e può eliminare file aggiuntivi non presenti nel repository.
9. Verificare sull'URL web esistente `/exec` che la versione sia **v1.4** e che Gunners, configurazioni e cronologia siano ancora presenti.
10. **Solo dopo aver verificato il primo rilascio**, abilitare gli aggiornamenti automatici creando in **Settings → Secrets and variables → Actions → Variables** `AUTO_DEPLOY_ENABLED` con valore `true`. A quel punto ogni push su `main` che modifica il codice o il workflow avvia il deployment Google (salvo l'approvazione eventualmente richiesta dall'ambiente).

**NOTA IMPORTANTE:** `CLASPRC_JSON` contiene un refresh token OAuth con permessi sul Suo account Apps Script. Non è una password Wansport; non deve essere incluso nei sorgenti o condiviso. In un repository pubblico, il workflow `main` dovrebbe essere modificabile soltanto da persone fidate. Si consiglia la protezione del branch e di non eseguire workflow di pull request non fidate con accesso ai secret.

## Prove locali e CI

```bash
npm test
```

I test non richiedono credenziali e non contattano Wansport. La CI `Check Padel Booking Leon` viene eseguita ad ogni push/PR; il workflow Google **non** opera sul progetto reale finché non viene abilitato manualmente. `npm test` include la verifica che la versione applicativa sia v1.4.

## Dove modificare il codice

- `apps-script/Code.gs`: API, regole, foglio dati, scheduler.
- `apps-script/Gunners.gs`: connettore Gunners; invariato rispetto alla v1.3.
- `apps-script/WansportExtra.gs`: connettori sperimentali Pro e Punto G.
- `apps-script/Index.html`, `Styles.html`, `Client.html`: interfaccia.
- `apps-script/appsscript.json`: manifest con timezone `Europe/Rome`.
- `.github/workflows/google-apps-script.yml`: pubblicazione Google con clasp 3.4.1.
- `.github/workflows/ci.yml`: test.
- `.github/workflows/pages.yml`: launcher GitHub Pages.

**Non modificare più manualmente l'editor di Apps Script dopo aver avviato il deployment da GitHub**: alla pubblicazione successiva, clasp sovrascriverebbe quelle modifiche. Non committare file `.clasp.json`, `.clasprc.json`, credenziali o esportazioni autenticate dei siti.

## Versioni

- v1.0: prototipo locale.
- v1.1: Google Apps Script e archivio Drive/Sheets.
- v1.2: lettura JSON Gunners (confermata successivamente dall'utente).
- v1.3: connettori sperimentali Pro e Punto G, controlli programmati in sola lettura.
- **v1.4: sorgenti su GitHub, CI automatica e deployment Google tramite clasp, con prima attivazione manuale protetta.**
