# Piikki

A frontend-only app for keeping shared balances. Open a compatible SQLite file, select a person, and apply a charge or deposit. Balances can go below zero. Charges and deposit reversals do not require available credit. The database never leaves the device.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Select **Try example** for sample accounts, or **Create database** for an empty database. Drop an existing Piikki database anywhere in the app to open it.

Settings holds the two branding colors, quick-charge amounts, and database controls. Quick-charge buttons apply immediately. Undo is attached to the original transaction and asks for confirmation. Person IDs and the active filename stay hidden. Branding colors are saved inside the SQLite file.

## Save your work

In browsers with File System Access support, select **Open database** and grant write permission. Changes save automatically to that file. You do not need to download it again. The app waits for the write to finish before accepting the operation.

New, recovered, sample, and dropped databases request a writable destination before opening. **Download backup** creates a separate copy.

The app requires HTTPS or localhost, native file pickers, writable file handles, and writable file streams. Missing capabilities block the app before a database is opened. No browser-name detection is used. Every opened database passes a write-and-read-back check before balance controls become available. Reopen the attached file on the next visit.

Use one app instance per file. The app rejects a save if the file changed externally since opening it. This detects intervening edits but is not a cross-application SQLite locking protocol.

## Shifts, safety and logout

After a database opens, the app asks who is at the till (isäntä or apuisäntä). Their name is stored on every balance change, charges, deposits, undos and opening balances, and shown in each person's history. Switch the name from **Vuorossa** at the top right.

Nobody is selected after opening, and the selected person is cleared after two minutes without input, so nobody gets charged by accident. **Kirjaudu ulos** closes the database, frees it from memory and forgets the operator.

## File encryption

Set `VITE_DATABASE_PASSWORD` at build time (for example in `.env.local` or the Vercel project settings) to encrypt database files with AES-GCM using a PBKDF2-derived key. With it set, plain files are encrypted as soon as they are opened, every save is encrypted, and backups are encrypted with the same password. Without it, files stay plain SQLite, and an encrypted file cannot be opened.

The value is compiled into the JavaScript bundle. Anyone who can load the deployed app can read it, so this only protects a lost USB stick when the build that contains the password is not publicly reachable. Keeping the password and the files in separate hands is up to the deployment. Changing or removing the variable makes existing encrypted files unreadable to that build.

## Database upgrades

The database format has a version (`PRAGMA user_version`, currently 3). Opening an older file upgrades it one step at a time, each step in its own transaction with a foreign-key check, and the upgraded file is saved right away. A failed upgrade leaves the file untouched. Files from a newer version are refused rather than guessed at. Version 3 removes the five-character osakunta limit, which requires rebuilding the table, and adds product categories and per-entry operator, description and opening-balance details. Older app builds refuse version 3 files instead of breaking on longer osakunta names.

## Verify

```sh
npm test
npm run build
```

The tests run real SQLite imports, transactions, reversals, and exports. No backend is required. The production build includes the SQLite WASM asset.

See [architecture](docs/architecture.md) for module ownership and [the schema](src/ledger/ledger.ts) for the version 1 database contract. Amounts are whole-number credits in the smallest denomination. The UI shows two decimal places without currency symbols, units, or item names.

## Deploy to Vercel

Import the repository into Vercel with the **Vite** preset and **Node.js 24.x**. The checked-in configuration uses `npm ci`, `npm run build`, and the `dist` output directory. No backend is required. `VITE_DATABASE_PASSWORD` is optional; see [file encryption](#file-encryption).

See [the deployment guide](docs/deployment.md) for Git and CLI deployment steps and verification.
