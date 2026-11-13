import initSqlJs from "sql.js";
import { expect, it } from "vitest";
import { Ledger } from "./ledger";

const product = { id: "coffee", name: "Coffee", cents: 250, description: "Hot drink", image: "data:image/png;base64,YQ==" };

it("reads legacy presets without writing, then persists product details and preserves charge labels", async () => {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    PRAGMA user_version=1;
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
    CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id));
    CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));
    INSERT INTO presets VALUES('coffee','Coffee',250);
    INSERT INTO customers VALUES('aino','Aino','');
    INSERT INTO entries VALUES('deposit','aino',2000,'Old deposit','2026-01-01',NULL);
    INSERT INTO entries VALUES('charge','aino',-100,'Old charge','2026-01-02',NULL);
  `);
  let saved = legacy.export();
  legacy.close();
  let writes = 0;
  const ledger = await Ledger.open(saved, async (bytes) => { saved = bytes; writes++; });
  expect(writes).toBe(0);
  expect(ledger.snapshot().products).toEqual([{ ...product, image: "", description: "" }]);
  await ledger.saveProduct(product);
  await ledger.post({ customerId: "aino", cents: product.cents, label: product.name, kind: "charge" });
  await ledger.saveProduct({ ...product, name: "Tea", cents: 300 });
  let reopened = await Ledger.open(saved);
  expect(reopened.snapshot().products).toEqual([{ ...product, name: "Tea", cents: 300 }]);
  expect(reopened.snapshot().entries.map((entry) => entry.label)).toEqual(["Coffee", "Old charge", "Old deposit"]);
  expect(reopened.snapshot().customers[0].balance).toBe(1650);
  await ledger.removeProduct(product.id);
  reopened = await Ledger.open(saved);
  expect(reopened.snapshot().products).toEqual([]);
  expect(reopened.snapshot().entries).toHaveLength(3);
  const compatible = new SQL.Database(saved);
  expect(compatible.exec("PRAGMA user_version")[0].values).toEqual([[2]]);
  expect(compatible.exec("SELECT * FROM presets")).toEqual([]);
  compatible.close();
});

it("rolls back failed product creates, edits and deletes, including the first schema addition", async () => {
  let fail = true;
  let saved: Uint8Array | undefined;
  const ledger = await Ledger.open(undefined, async (bytes) => {
    if (fail) throw new Error("Disk unavailable");
    saved = bytes;
  });
  await expect(ledger.saveProduct(product)).rejects.toThrow("Disk unavailable");
  expect(ledger.snapshot().products).toEqual([]);
  fail = false;
  await ledger.saveProduct(product);
  fail = true;
  await expect(ledger.saveProduct({ ...product, cents: 400 })).rejects.toThrow("Disk unavailable");
  await expect(ledger.removeProduct(product.id)).rejects.toThrow("Disk unavailable");
  expect(ledger.snapshot().products).toEqual([product]);
  expect((await Ledger.open(saved)).snapshot().products).toEqual([product]);
  fail = false;
  await ledger.removeProduct(product.id);
  expect((await Ledger.open(saved)).snapshot().products).toEqual([]);
});

it("rejects invalid product inputs without changing saved products", async () => {
  const ledger = await Ledger.open();
  await ledger.saveProduct(product);
  for (const invalid of [
    { name: " " }, { name: "a".repeat(121) }, { cents: 0 }, { cents: 1.2 },
    { cents: 1000000000 }, { description: "a".repeat(2001) },
    { image: "https://example.com/photo.png" }, { image: "data:image/png;base64," + "a".repeat(1400000) },
  ]) {
    await expect(ledger.saveProduct({ ...product, ...invalid })).rejects.toThrow();
    expect(ledger.snapshot().products).toEqual([product]);
  }
});

it("preserves legacy names and amounts that predate product editing limits", async () => {
  const original = await Ledger.open();
  const SQL = await initSqlJs();
  const old = new SQL.Database(original.export());
  const name = "x".repeat(150);
  old.run("INSERT INTO presets VALUES(?,?,?)", ["legacy", name, 1000000000]);
  old.run("INSERT INTO presets VALUES(?,?,?)", ["blank", "", 100]);
  const ledger = await Ledger.open(old.export());
  old.close();
  expect(ledger.snapshot().products).toEqual([
    { id: "legacy", name, cents: 1000000000, description: "", image: "" },
    { id: "blank", name: "", cents: 100, description: "", image: "" },
  ]);
  await ledger.saveProduct(product);
  expect((await Ledger.open(ledger.export())).snapshot().products).toHaveLength(3);
});
