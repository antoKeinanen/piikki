# Candidate B

## Problem

The cashier must open a compatible SQLite file and safely charge or deposit money with a small UI. The browser owns one active database session. SQLite is the interchange format and authoritative state, rather than a server or an account service.

## Usage

```ts
const book = await Cashbook.open(await file.arrayBuffer());
const view = book.read();
const receipt = book.execute({
  kind: "charge",
  customerId,
  cents: 450,
  label: "Lunch",
  operationId,
});
book.execute({
  kind: "reverse",
  transactionId: receipt.id,
  operationId: newId,
});
await saveFile(book.export());
```

The React layer uses TanStack Query for the active book's snapshot, invalidating after successful commands. TanStack Table handles filtering and customer rows. Selecting a customer opens their balance, fixed amount buttons, custom amount, deposit control, and recent transactions in an adjacent pane. A button names the amount and action. Only the recent transaction row exposes reversal, behind an explicit confirmation showing customer and amount. Reversed transactions retain their history and cannot be reversed twice.

## Shape

```ts
type Command =
  | {
      kind: "charge" | "deposit";
      customerId: string;
      cents: number;
      label: string;
      operationId: string;
    }
  | { kind: "reverse"; transactionId: string; operationId: string }
  | { kind: "addCustomer"; name: string; operationId: string }
  | {
      kind: "setPreset";
      id: string;
      label: string;
      cents: number;
      operationId: string;
    }
  | { kind: "removePreset"; id: string; operationId: string };
type Customer = { id: string; name: string; balanceCents: number };
type Transaction = {
  id: string;
  customerId: string;
  deltaCents: number;
  label: string;
  reversedBy: string | null;
  createdAt: string;
};
type Snapshot = {
  customers: Customer[];
  presets: { id: string; label: string; cents: number }[];
  transactions: Transaction[];
};
class Cashbook {
  static async open(bytes: ArrayBuffer): Promise<Cashbook> {
    throw Error("not implemented");
  }
  static async create(): Promise<Cashbook> {
    throw Error("not implemented");
  }
  read(): Snapshot {
    throw Error("not implemented");
  }
  execute(command: Command): Transaction {
    throw Error("not implemented");
  }
  export(): Uint8Array {
    throw Error("not implemented");
  }
}
```

`src/cashbook.ts` privately owns SQL, schema validation, atomic command execution, integer money validation, and exports. `src/money.ts` parses decimal input and formats money. `src/App.tsx` owns the opened/closed UI state and query boundary. `src/CustomerTable.tsx`, `src/CustomerAccount.tsx`, and `src/PresetEditor.tsx` own distinct interactions. No component runs SQL.

Schema has customers with stored integer balance, transactions with signed integer delta and unique operation ID, presets, and application metadata. BEGIN/COMMIT changes a customer's balance and inserts the journal row together. An existing operation ID returns the original receipt. Reverse commands atomically insert an inverse entry and mark the original with the reversal ID. Charges cannot overdraw. Reversing a deposit cannot overdraw either. File import verifies schema version, columns, foreign keys, balance arithmetic, and integrity before replacing the current book.

The public boundary hides SQL layout, transaction handling, and reversal checks. It exposes one read, one command, and one export operation. Disk writes remain explicit because dragging a file does not grant writable access. A browser recovery copy can be persisted after each command, but the UI must offer export and explain persistence at initial file opening.

## Synthesis decision

Pending parent synthesis.

## Tradeoffs accepted

- We accept maintaining balance and journal in one SQL transaction for constant-time balance reads and simple imported customer tables.
- We accept import validation that reconciles journal totals against stored balances to detect externally edited corruption.
- We accept explicit export for compatibility with all browsers. Optional file handles can later autosave through the same export API.

## Alternatives considered

An append-only ledger eliminates stored balance reconciliation and makes the journal authoritative. It loses here because opening arbitrary compatible customer tables needs a ledger opening entry and balance queries always aggregate history. It is still the safer default if ease of proving monetary invariants outweighs snapshot interchange simplicity.

A React reducer with periodic SQLite serialization exposes persistence ordering to UI callers. It creates two authoritative representations and risks losing the last mutation on export.

## Open questions and risks

Should a recovery copy reopen automatically or require the cashier to select it? Should opening a second database require export of current changes? The safe initial choices are an explicit recovery prompt and an export-or-discard switch confirmation.

## Next implementation step

Implement Cashbook against a real SQLite engine with tests for atomic charge, insufficient funds, duplicate command, duplicate reversal, and export/import parity.
