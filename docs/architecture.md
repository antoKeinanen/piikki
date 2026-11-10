# Cashier ledger

The app runs entirely in the browser. SQL.js opens and exports actual SQLite bytes. React and Chakra own the controls. TanStack Query owns refreshed snapshots and TanStack Table owns customer filtering.

## Usage contract

```ts
const ledger = await Ledger.open(bytes);
await ledger.post({ customerId, cents: 850, kind: "charge", label: "Charge" });
const snapshot = ledger.snapshot();
await ledger.reverse(snapshot.entries[0].id);
const download = ledger.export();
```

## Synthesis decision

Candidate A is the base. Derived balances remove duplicated money state. The independent judge preferred A for that reason. Candidate B contributes the explicit recovery prompt and database replacement confirmation. Stored balances were rejected because they require reconciliation without a useful benefit at this scale.

The ledger owns SQLite, import validation, transactions, and reversal rules. Components cannot issue SQL. Every mutation validates the result and waits for persistence. Ledger.open accepts an optional asynchronous writer. Attached sessions write exported SQLite bytes through that writer. Unattached sessions persist a browser recovery copy. Failure restores the previous in-memory SQLite bytes. The ledger rejects overlapping mutations while a save is pending.

src/database-file.ts owns browser file handles. It opens the native picker, requests write permission, and connects a writer to Ledger. The writer compares the current file against the bytes last read or written, writes the full database with createWritable, and waits for close before returning. SQL.js still operates in memory. This is automatic full-file replacement rather than direct SQLite page writes to the filesystem.

The UI keeps file selection separate from database commands. Supported file-picker sessions autosave. Dropped, recovered, sample, and new databases must attach a verified destination before opening. Unsupported browsers are blocked. File handles are session-local and are not remembered across reloads.

Amounts are integer credits in the smallest denomination. The UI displays two decimal places without currency units or product names. Existing database label fields remain compatible but are hidden. Reversals append the exact opposite entry and cannot themselves be reversed. Spent deposits cannot be reversed. The database must have schema version 1 and the tables defined in src/ledger.ts. Import checks SQLite integrity, foreign keys, row shapes, balances, and reversal consistency.

## Module map

- src/model.ts owns parsed data shapes and money parsing.
- src/ledger.ts owns all durable state and financial rules.
- src/App.tsx owns file selection and cashier interactions.
- src/CustomerTable.tsx owns customer table behavior.
- src/main.tsx owns providers.

## Throughput checkpoint

Blocking first steps were the two design candidates and the shared model/API contract.
Independent workstreams were UI implementation and ledger implementation.
Shared mutable state has one owner, the Ledger instance. UI reads snapshots.
The smallest safe decomposition was one UI owner and one ledger owner. Financial rules remain together.

## Limits

Recovery is a browser-local copy for unattached sessions. Attached sessions use the selected disk file as their authority. Download a backup for transfer. Copies edited on different devices cannot merge. Amounts have no displayed currency. Preset deletion affects future shortcuts only and never changes purchase history.

## Cashier UI revision

The workspace uses a customer table and account area on one flat background, separated by a line. There are no content cards. The customer name and balance are the account identity. Reference IDs and filenames are not displayed.

Settings owns three tabs for branding, quick charges, and database actions. src/Settings.tsx owns their controls. The optional branding table holds one row with two hex colors. Old databases without this table use defaults until colors are saved. Readable foreground colors are derived automatically.

Quick charges apply immediately. Custom charges and deposits submit directly through the asynchronous ledger mutation. Financial guards and save rollback remain in Ledger. Undo still requires a deliberate per-transaction reversal.

## Required file capability gate

App checks the secure context and concrete picker, file-handle, and stream methods before mounting CashierApp. Missing capabilities show a blocking explanation. There is no user-agent allowlist and no download-only fallback. Opening requires permission plus an actual write, close, and read-back of unchanged SQLite bytes. New, sample, dropped, and recovered databases attach a verified writable file before activation.

The browser verification used an actual FileSystemFileHandle in a temporary origin-private test file with the production connectFile writer. After depositing 20.00 and charging 8.50, reopening the file returned 11.50. After reversing the charge, reopening returned 20.00 with three entries. The temporary test file was removed. Native external-file picker dialogs could not be automated by the shared browser tools, so that UI portion remains unverified. Origin-private storage is used only by this test, not as application persistence.
