import initSqlJs from "sql.js";
import { expect, it } from "vitest";
import { Ledger } from "./ledger";

async function legacyBytes() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    PRAGMA user_version=1;
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
    CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id));
    CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));
    INSERT INTO customers VALUES('legacy','Legacy','42');
  `);
  const bytes = db.export();
  db.close();
  return bytes;
}

it("defaults legacy metadata to empty without writing on open, then persists notes", async () => {
  const bytes = await legacyBytes();
  let saved = bytes;
  let writes = 0;
  const ledger = await Ledger.open(bytes, async (next) => {
    saved = new Uint8Array(next);
    writes++;
  });
  expect(writes).toBe(0);
  expect(ledger.snapshot().customers[0]).toMatchObject({
    id: "legacy", reference: "42", balance: 0, osakunta: "", note: "",
  });
  await ledger.saveCustomerNote("legacy", "First line\nSecond line 'quoted'");
  expect(writes).toBe(1);
  const reopened = await Ledger.open(saved);
  expect(reopened.snapshot().customers[0].note).toBe("First line\nSecond line 'quoted'");
  await reopened.addCustomer("New", "", "KyO");
  expect(reopened.snapshot().customers[0]).toMatchObject({
    id: "legacy", osakunta: "", note: "First line\nSecond line 'quoted'",
  });
  await reopened.saveCustomerNote("legacy", "Updated");
  await reopened.saveCustomerNote("legacy", "");
  expect((await Ledger.open(reopened.export())).snapshot().customers[0].note).toBe("");
});

it("accepts empty and five-character osakunta, rejects overlimit without a write", async () => {
  let writes = 0;
  const ledger = await Ledger.open(undefined, async () => { writes++; });
  await ledger.addCustomer("Empty", "");
  await ledger.addCustomer("Five", "", "ABCDE");
  await expect(ledger.addCustomer("Invalid", "", "ABCDEF")).rejects.toThrow("5");
  expect(writes).toBe(2);
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot().customers.map(({ osakunta, note }) => ({ osakunta, note }))).toEqual([
    { osakunta: "", note: "" }, { osakunta: "ABCDE", note: "" },
  ]);
  const customer = reopened.snapshot().customers[1];
  await reopened.saveCustomerNote(customer.id, "A note");
  expect((await Ledger.open(reopened.export())).snapshot().customers[1]).toMatchObject({
    osakunta: "ABCDE", note: "A note",
  });
});

it("rolls metadata back after a failed durable save and supports retry", async () => {
  let fails = true;
  let saved = await legacyBytes();
  const ledger = await Ledger.open(saved, async (bytes) => {
    if (fails) throw new Error("Disk unavailable");
    saved = new Uint8Array(bytes);
  });
  await expect(ledger.saveCustomerNote("legacy", "Draft")).rejects.toThrow("Disk unavailable");
  expect(ledger.snapshot().customers[0].note).toBe("");
  await expect(ledger.addCustomer("Failed", "", "KyO")).rejects.toThrow("Disk unavailable");
  expect(ledger.snapshot().customers).toHaveLength(1);
  fails = false;
  await ledger.saveCustomerNote("legacy", "Saved");
  expect((await Ledger.open(saved)).snapshot().customers[0].note).toBe("Saved");
  await expect(ledger.saveCustomerNote("missing", "No orphan")).rejects.toThrow("no longer exists");
});
