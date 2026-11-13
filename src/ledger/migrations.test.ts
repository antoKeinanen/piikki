import initSqlJs from "sql.js";
import { expect, it } from "vitest";
import { Ledger } from "./ledger";

/** A database exactly as the previous release (schema version 2) wrote it. */
async function versionTwoBytes() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    PRAGMA foreign_keys=ON;
    PRAGMA user_version=2;
    CREATE TABLE events(id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100));
    INSERT INTO events VALUES('initial','Syysjuhla');
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
    CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id), event_id TEXT NOT NULL REFERENCES events(id));
    CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));
    CREATE TABLE customer_metadata(customer_id TEXT PRIMARY KEY REFERENCES customers(id), osakunta TEXT NOT NULL DEFAULT '' CHECK(length(osakunta)<=5), note TEXT NOT NULL DEFAULT '');
    CREATE TABLE product_details(id TEXT PRIMARY KEY, description TEXT NOT NULL, image TEXT NOT NULL);
    CREATE TABLE customer_removals(customer_id TEXT PRIMARY KEY REFERENCES customers(id), removed_at TEXT NOT NULL);
    CREATE TABLE branding(id INTEGER PRIMARY KEY CHECK(id=1), primary_color TEXT NOT NULL, secondary_color TEXT NOT NULL);
    CREATE TABLE organization(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL);
    INSERT INTO branding VALUES(1,'#102030','#fafafa');
    INSERT INTO organization VALUES(1,'KyO');
    INSERT INTO customers VALUES('aino','Aino',''),('eino','Eino','');
    INSERT INTO customer_metadata VALUES('aino','KyO','Muista tee'),('eino','','');
    INSERT INTO customer_removals VALUES('eino','2026-10-01T10:00:00Z');
    INSERT INTO presets VALUES('olut','Olut',300);
    INSERT INTO product_details VALUES('olut','Tölkki','');
    INSERT INTO entries VALUES('d1','aino',2000,'Lisää saldoa','2026-10-01T10:00:00Z',NULL,'initial');
    INSERT INTO entries VALUES('c1','aino',-300,'Olut','2026-10-01T11:00:00Z',NULL,'initial');
    INSERT INTO entries VALUES('u1','aino',300,'Undo Olut','2026-10-01T11:05:00Z','c1','initial');
    INSERT INTO entries VALUES('c2','eino',-500,'Veloita','2026-10-01T12:00:00Z',NULL,'initial');
  `);
  const bytes = db.export();
  db.close();
  return bytes;
}

it("upgrades a version 2 database without losing data and without writing on open", async () => {
  const original = await versionTwoBytes();
  let writes = 0;
  const ledger = await Ledger.open(original, async () => { writes++; });
  expect(ledger.migrated).toBe(true);
  expect(writes).toBe(0);
  const snapshot = ledger.snapshot();
  expect(snapshot.event.name).toBe("Syysjuhla");
  expect(snapshot.branding).toMatchObject({ organization: "KyO", primary: "#102030" });
  expect(snapshot.customers).toEqual([
    expect.objectContaining({ id: "aino", osakunta: "KyO", note: "Muista tee", balance: 2000 }),
  ]);
  expect(snapshot.removedCustomers).toEqual([expect.objectContaining({ id: "eino", balance: -500 })]);
  expect(snapshot.products).toEqual([
    { id: "olut", name: "Olut", cents: 300, description: "Tölkki", image: "", category: "" },
  ]);
  expect(snapshot.entries.map((e) => [e.id, e.reversed, e.operator, e.note, e.opening])).toEqual([
    ["c2", 0, "", "", 0], ["u1", 0, "", "", 0], ["c1", 1, "", "", 0], ["d1", 0, "", "", 0],
  ]);
  // The things version 2 could not store now work.
  await ledger.updateCustomer("aino", { name: "Aino", osakunta: "Sen-KyO" });
  await ledger.saveProduct({ ...snapshot.products[0], category: "Tölkki" });
  await ledger.post({ customerId: "aino", cents: 300, kind: "charge", label: "Olut", operator: "Eetu", note: "Tiskiltä" });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.migrated).toBe(false);
  expect(reopened.snapshot().customers[0]).toMatchObject({ osakunta: "Sen-KyO", note: "Muista tee", balance: 1700 });
  expect(reopened.snapshot().products[0].category).toBe("Tölkki");
  expect(reopened.snapshot().entries[0]).toMatchObject({ operator: "Eetu", note: "Tiskiltä" });

  const SQL = await initSqlJs();
  const upgraded = new SQL.Database(reopened.export());
  expect(upgraded.exec("PRAGMA user_version")[0].values).toEqual([[3]]);
  expect(String(upgraded.exec("SELECT sql FROM sqlite_master WHERE name='customer_metadata'")[0].values[0][0])).not.toContain("length(osakunta)");
  expect(upgraded.exec("PRAGMA integrity_check")[0].values).toEqual([["ok"]]);
  expect(upgraded.exec("PRAGMA foreign_key_check")).toEqual([]);
  upgraded.close();
});

it("upgrades a version 1 database through every step", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    PRAGMA user_version=1;
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
    CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id));
    CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));
    INSERT INTO customers VALUES('aino','Aino','');
    INSERT INTO entries VALUES('d','aino',1000,'Deposit','2026-01-01',NULL);
  `);
  const ledger = await Ledger.open(db.export());
  db.close();
  expect(ledger.migrated).toBe(true);
  expect(ledger.snapshot()).toMatchObject({ event: { name: "Aiempi tapahtuma" } });
  expect(ledger.snapshot().customers[0]).toMatchObject({ balance: 1000, osakunta: "" });
  await ledger.addCustomer("Eino", "", "Pohjois-Pohjalainen Osakunta", { openingCents: 500, operator: "Eetu" });
  const upgraded = new SQL.Database(ledger.export());
  expect(upgraded.exec("PRAGMA user_version")[0].values).toEqual([[3]]);
  upgraded.close();
});

it("creates new databases at the current version without reporting a migration", async () => {
  const ledger = await Ledger.open();
  expect(ledger.migrated).toBe(false);
  const SQL = await initSqlJs();
  const db = new SQL.Database(ledger.export());
  expect(db.exec("PRAGMA user_version")[0].values).toEqual([[3]]);
  db.close();
});

it("refuses databases from a newer version instead of guessing", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(await versionTwoBytes());
  db.run("PRAGMA user_version=4");
  await expect(Ledger.open(db.export())).rejects.toThrow("newer version");
  db.close();
});

it("leaves a database that cannot be upgraded unopened and unchanged", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(await versionTwoBytes());
  // A dangling reference makes the upgrade's integrity check fail.
  db.run("PRAGMA foreign_keys=OFF; INSERT INTO customer_metadata VALUES('ghost','KyO','')");
  const broken = db.export();
  db.close();
  await expect(Ledger.open(broken)).rejects.toThrow();
  const check = new SQL.Database(broken);
  expect(check.exec("PRAGMA user_version")[0].values).toEqual([[2]]);
  check.close();
});
