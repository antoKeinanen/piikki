# Piikki

A frontend-only cashier app for customer credit. Open a compatible SQLite file, select a customer, and apply a charge or deposit. The database never leaves the device.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Select **Try example** for sample accounts, or **Create database** for an empty database. Drop an existing Piikki database anywhere in the app to open it.

Settings holds the two branding colors, quick-charge amounts, and database controls. Quick-charge buttons apply immediately. Undo is attached to the original transaction and asks for confirmation. Customer IDs and the active filename stay hidden. Branding colors are saved inside the SQLite file.

## Save your work

In browsers with File System Access support, select **Open database** and grant write permission. Changes save automatically to that file. You do not need to download it again. The app waits for the write to finish before accepting the operation.

New, recovered, sample, and dropped databases request a writable destination before opening. **Download backup** creates a separate copy.

The app requires HTTPS or localhost, native file pickers, writable file handles, and writable file streams. Missing capabilities block the app before a database is opened. No browser-name detection is used. Every opened database passes a write-and-read-back check before cashier controls become available. Reopen the attached file on the next visit.

Use one app instance per file. The app rejects a save if the file changed externally since opening it. This detects intervening edits but is not a cross-application SQLite locking protocol.

## Verify

```sh
npm test
npm run build
```

The tests run real SQLite imports, transactions, reversals, and exports. No backend is required. The production build includes the SQLite WASM asset.

See [architecture](docs/architecture.md) for module ownership and [the schema](src/ledger.ts) for the version 1 database contract. Amounts are whole-number credits in the smallest denomination. The UI shows two decimal places without currency symbols, units, or product names.

## Deploy to Vercel

Import the repository into Vercel with the **Vite** preset and **Node.js 24.x**. The checked-in configuration uses `npm ci`, `npm run build`, and the `dist` output directory. No environment variables or backend are required.

See [the deployment guide](docs/deployment.md) for Git and CLI deployment steps and verification.
