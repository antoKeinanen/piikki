import initSqlJs from "sql.js";
import { expect, it } from "vitest";
import { Ledger } from "./ledger";

it("migrates a version one database without losing its ledger or settings", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    PRAGMA user_version=1;
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
    CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id));
    CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));
    CREATE TABLE organization(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    INSERT INTO organization VALUES(1,'Testiosakunta');
    INSERT INTO customers VALUES('aino','Aino','1001');
    INSERT INTO entries VALUES('deposit','aino',1000,'Cash','2026-11-11',NULL);
    INSERT INTO entries VALUES('charge','aino',-200,'Tea','2026-11-11',NULL);
    INSERT INTO entries VALUES('undo','aino',200,'Undo Tea','2026-11-11','charge');
    INSERT INTO presets VALUES('tea','Tea',200);
  `);
  const original = db.export();
  db.close();
  const ledger = await Ledger.open(original);
  const previous = ledger.snapshot();
  expect(previous.event.name).toBe("Aiempi tapahtuma");
  expect(previous.customers[0].balance).toBe(1000);
  expect(previous.entries).toHaveLength(3);
  expect(previous.branding.organization).toBe("Testiosakunta");
  await ledger.startEvent("Uusi juhla");
  await ledger.post({ customerId: "aino", cents: 300, kind: "deposit", label: "Cash" });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot(previous.event.id)).toEqual(previous);
  expect(reopened.snapshot().customers[0].balance).toBe(300);
  expect((await Ledger.open(original)).snapshot()).toEqual(previous);
});
