# Balance ledger

The app runs entirely in the browser. SQL.js opens and exports actual SQLite bytes. React and Chakra own the controls. TanStack Query owns refreshed snapshots and TanStack Table owns person filtering.

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

src/persistence/database-file.ts owns browser file handles. It opens the native picker, requests write permission, and connects a writer to Ledger. The writer compares the current file against the bytes last read or written, writes the full database with createWritable, and waits for close before returning. SQL.js still operates in memory. This is automatic full-file replacement rather than direct SQLite page writes to the filesystem.

The UI keeps file selection separate from database commands. Supported file-picker sessions autosave. Dropped and new databases must attach a verified destination before activation. Recovery and sample startup controls are not exposed. Unsupported browsers are blocked. File handles are session-local and are not remembered across reloads.

Amounts are integer credits in the smallest denomination. Balances and charge controls display two decimal places without currency units or item names; the existing reversal confirmation still includes a euro symbol. Existing database label fields remain compatible but are hidden. Reversals append the exact opposite entry and cannot themselves be reversed. Balances are signed integers derived from entries. Charges and deposit reversals can take a balance below zero. Amount inputs remain positive. Negative balances need no schema migration because balances are not stored separately. The database must have schema version 1 and the tables defined in src/ledger/ledger.ts. Import checks SQLite integrity, foreign keys, row shapes, balances, and reversal consistency.

## Module map

- `src/main.tsx` mounts providers and imports the global stylesheet once.
- `src/app/App.tsx` composes screens, dialogs and file workflows. `useLedgerSession.ts` owns the active ledger/name/revision union, Query snapshots, mutation pending state and errors. Activating a database changes the query key and resets the account draft.
- `src/app/Settings.tsx` composes branding, preset and file tabs using specific command callbacks.
- `src/features/analytics/` owns the per-event statistics view. It draws charts with Chakra UI Charts (Recharts) and loads lazily, so the main view's first load stays small. `summary.ts` is a pure function from a snapshot to totals, balances, debt, charge-size bands, item and person rankings, and a cumulative timeline. The timeline is hourly, or daily for events longer than 48 hours. `compareEvents` adds cross-event totals and returning people. The summary excludes undone charges and their reversals. Entries do not reference items, so the summary groups charges by entry label and shows charges without an item button as "Muu summa". Charts take their colors from the branding CSS variables. `src/app/EventStats.tsx` owns the query and the event choice. `Ledger.events()` lists events, and `Ledger.snapshot(eventId)` returns any past event.
- `src/features/cashier/` owns person filtering, account drafts/history, add-person input and reversal confirmation.
- `src/features/branding/` owns the shared onboarding/settings form, contrast calculations and React CSS variables.
- `src/features/presets/` owns preset editing and last-deletion restore state.
- `src/features/database/` owns welcome, file controls and compatibility UI.
- `src/ledger/index.ts` exposes Ledger, validated data types and money helpers. SQLite, schemas and browser recovery persistence remain internal. One Ledger owns all durable mutations.
- `src/persistence/database-file.ts` owns native handles, writable verification, conflict checks and completed writes.
- `src/test-support/example-ledger.ts` supplies sample data for tests and guide capture only.

Tests live beside their owner. `src/app/styles.css` stays global to preserve the cascade; portalled dialogs receive branding variables explicitly.

A posting travels from AccountPanel through the app mutation callback to Ledger.post, which awaits its injected file writer before the query refreshes. Editors keep drafts; they do not duplicate balances or snapshots. Failed saves preserve drafts for retry.

`npm run check:boundaries` resolves imports with TypeScript and enforces dependency direction. App composes features, persistence and ledger; features consume the public ledger API; persistence consumes ledger; ledger cannot import UI or file adapters. Database compatibility UI may use branding/theme. Production cannot import test fixtures. Ledger internals and branding color internals are private to their modules. The checker runs before every production build; `npm run test:boundaries` verifies forbidden and allowed imports with temporary fixtures.

## Refactoring decision

Feature folders were chosen over a move-only app/ui/domain/platform layout because account, branding and preset changes now have distinct owners. The ledger and file adapter remain cohesive rather than gaining per-feature repositories. The public Ledger API and SQLite schema are unchanged. Bootstrap providers remain inline and CSS remains one global asset.

The refactor preserves legacy unattached recovery writes and existing file-busy behavior. File conflict detection is not an atomic cross-process lock; failed persistence restores in-memory bytes, not necessarily partially written disk bytes. Those constraints are separate from module organization.

## Throughput checkpoint

Blocking first steps were the two design candidates and the shared model/API contract.
Independent workstreams were UI implementation and ledger implementation.
Shared mutable state has one owner, the Ledger instance. UI reads snapshots.
The smallest safe decomposition was one UI owner and one ledger owner. Financial rules remain together.

## Limits

Recovery is a browser-local copy for unattached sessions. Attached sessions use the selected disk file as their authority. Download a backup for transfer. Copies edited on different devices cannot merge. Amounts have no displayed currency. Preset deletion affects future shortcuts only and never changes charge history.

## Account UI revision

The workspace uses a person table and account area on one flat background, separated by a line. There are no content cards. The person's name and balance are the account identity. Reference IDs and filenames are not displayed.

Settings owns three tabs for branding, quick charges, and database actions. src/app/Settings.tsx owns their controls. The optional branding table holds one row with two hex colors. Old databases without this table use defaults until colors are saved. Readable foreground colors are derived automatically.

Quick charges apply immediately. Custom charges and deposits submit directly through the asynchronous ledger mutation. Financial guards and save rollback remain in Ledger. Undo still requires a deliberate per-transaction reversal.

## Required file capability gate

App checks the secure context and concrete picker, file-handle, and stream methods before mounting CashierApp. Missing capabilities show a blocking explanation. There is no user-agent allowlist and no download-only fallback. Opening requires permission plus an actual write, close, and read-back of unchanged SQLite bytes. New and dropped databases attach a verified writable file before activation.

Before this refactor, browser verification used an actual FileSystemFileHandle in a temporary origin-private test file with the production connectFile writer. After depositing 20.00 and charging 8.50, reopening the file returned 11.50. After reversing the charge, reopening returned 20.00 with three entries. The temporary test file was removed. Native external-file picker dialogs could not be automated by the shared browser tools, so that UI portion remains unverified. Origin-private storage is used only by this test, not as application persistence.
