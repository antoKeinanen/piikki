# Append-only cashier ledger

## Problem

A cashier opens a compatible SQLite file locally and must safely deposit and spend customer credit. The file remains the transferable source of truth. Browser persistence protects work between exports but does not imply the original disk file changed.

## Usage

```ts
const ledger = await CashierLedger.open(bytes);
const customers = ledger.customers({ search: "Aino" });
ledger.post({
  kind: "purchase",
  customerId,
  cents: 450,
  label: "Lunch",
  requestId,
});
ledger.reverse({ entryId, requestId });
const bytesToDownload = ledger.export();
```

The UI reads one snapshot after each successful mutation. A TanStack Query mutation owns the pending state, prevents repeated submissions, then invalidates the snapshot query. TanStack Table owns filtering and sorting.

## Shape

```ts
type Entry = {
  id: string;
  customerId: string;
  cents: number;
  label: string;
  createdAt: string;
} & (
  { kind: "deposit" | "purchase" } | { kind: "reversal"; originalId: string }
);
type Customer = {
  id: string;
  name: string;
  reference: string;
  balanceCents: number;
};
type Preset = { id: string; label: string; cents: number; archived: boolean };
type Posting = {
  customerId: string;
  cents: number;
  label: string;
  requestId: string;
  kind: "deposit" | "purchase";
};
class CashierLedger {
  static async open(bytes?: Uint8Array): Promise<CashierLedger> {
    throw Error("not implemented");
  }
  snapshot(): { customers: Customer[]; presets: Preset[]; entries: Entry[] } {
    throw Error("not implemented");
  }
  post(command: Posting): void {
    throw Error("not implemented");
  }
  reverse(command: { entryId: string; requestId: string }): void {
    throw Error("not implemented");
  }
  savePreset(preset: Preset): void {
    throw Error("not implemented");
  }
  addCustomer(input: { name: string; reference: string }): void {
    throw Error("not implemented");
  }
  export(): Uint8Array {
    throw Error("not implemented");
  }
}
```

`src/ledger.ts` owns schema, import validation, integer money checks, transaction boundaries, derived balances, uniqueness and reversals. `src/money.ts` parses human decimals and formats money. `src/App.tsx` owns the file session and UI selection. `src/components/CustomerTable.tsx`, `AccountPanel.tsx`, and `PresetEditor.tsx` own their respective controls. `src/main.tsx` owns Chakra and Query providers.

SQLite tables are `customers`, `entries`, `presets`, and `metadata`. A purchase has negative stored cents, deposit positive cents. A reversal appends the exact inverse and references the original entry. A unique original-entry foreign key prevents double reversal. Balance is always SUM(entries.cents). Schema validation checks expected columns, metadata version, foreign keys, row types, safe integer cents and balance invariants before replacing the active session. SQL statements use bound values.

The ledger's small command interface hides SQL, validation and recovery. No UI module imports SQL types or computes customer balances. Mutations execute in a transaction, export the resulting bytes, then persist those bytes to IndexedDB before reporting success. Persistence failure rolls back the in-memory database by restoring the previous bytes. One browser session owns each opened file copy. All financial commands carry unique request IDs with a database uniqueness constraint.

The UI uses a customer table at left and selected account at right. Search stays above the table. Account name and balance appear as plain identity data, without headings or cards. Preset buttons populate the amount and label. A persistent explicit button says `Charge €4.50`; a quieter deposit action opens a separate form. Confirmation shows customer, amount and resulting balance. The transaction history has a per-entry `Undo` action behind a confirmation. A reversal cannot itself be undone. Preset deletion archives it and can be restored in the preset editor.

## Synthesis decision

Candidate A proposes this shape for comparison.

## Tradeoffs accepted

- Accept explicit export in exchange for portable browser support. Where a file handle is available, offer a separate save path later.
- Accept ledger growth in exchange for an audit trail and dependable reversal.
- Accept one extra confirmation click in exchange for customer and amount verification.

## Alternatives considered

A mutable balance column with deleted purchase rows has fewer SQL queries but pushes history consistency and undo bookkeeping into callers. It loses because the apparent simple write interface hides less of the financial policy.
A generic event-sourcing framework separates adapters, events, projectors and repositories. It exposes too many coordination rules for one local app and expands the distance between a button and its invariant.

## Open questions and risks

Should the first release use EUR as its single currency? Default to EUR and keep currency in metadata so imported files can specify another supported ISO currency.
Could two cashiers edit separate copies and later expect merging? This design intentionally has no merge command, so deployment should stay on the requested single cashier device.

## Next implementation step

Implement the ledger with a real SQLite engine and test import, purchase, insufficient funds, reversal and export/reopen before wiring UI.
