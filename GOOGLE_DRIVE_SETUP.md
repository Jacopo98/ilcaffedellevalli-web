# Configurazione Archivio Google Drive

L'area `/admin/archivio` usa l'account Google del singolo amministratore e limita tutte le operazioni alla cartella radice configurata.

## 1. Cartella condivisa

Condividere la cartella Google Drive con gli indirizzi Google autorizzati, assegnando il ruolo **Editor**. Copiare il link della cartella: l'app accetta sia il link completo sia il solo ID.

## 2. Google Cloud

1. Creare o selezionare un progetto in Google Cloud Console.
2. Abilitare **Google Drive API**.
3. Configurare la schermata consenso OAuth e aggiungere gli amministratori tra gli utenti di test durante lo sviluppo.
4. Creare credenziali **OAuth client ID > Web application**.
5. Registrare gli URI di reindirizzamento:
   - `http://localhost:3000/api/google-drive/callback`
   - `https://DOMINIO-PRODUZIONE/api/google-drive/callback`

## 3. Variabili d'ambiente

Configurare in locale e su Vercel:

```text
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=
```

`GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` deve essere un segreto casuale lungo almeno 32 caratteri e non deve essere cambiato dopo aver collegato gli account. Facoltativamente si può impostare `GOOGLE_DRIVE_REDIRECT_URI` se l'URL di callback deve essere forzato.

## 4. Database e collegamento

1. Eseguire `supabase/google-drive-archive-migration.sql` nel SQL Editor di Supabase.
2. Distribuire l'app con le variabili configurate.
3. Aprire **Dashboard > Archivio generale**.
4. Selezionare **Collega account Google** e autorizzare l'indirizzo invitato sulla cartella.

I token OAuth vengono cifrati prima del salvataggio. La tabella non è accessibile direttamente ai ruoli `anon` e `authenticated`; viene usata soltanto dal backend dell'applicazione.
