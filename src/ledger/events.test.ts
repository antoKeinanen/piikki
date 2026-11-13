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
    CREATE TABLE customer_metadata(customer_id TEXT PRIMARY KEY REFERENCES customers(id), osakunta TEXT NOT NULL, note TEXT NOT NULL);
    INSERT INTO customer_metadata VALUES('aino','ESO','Remember tea');
    CREATE TABLE product_details(id TEXT PRIMARY KEY, description TEXT NOT NULL, image TEXT NOT NULL);
    INSERT INTO product_details VALUES('tea','Hot tea','data:image/png;base64,YQ==');
  `);
  const original = db.export();
  db.close();
  const ledger = await Ledger.open(original);
  const previous = ledger.snapshot();
  expect(previous.event.name).toBe("Aiempi tapahtuma");
  expect(previous.customers[0].balance).toBe(1000);
  expect(previous.entries).toHaveLength(3);
  expect(previous.branding.organization).toBe("Testiosakunta");
  expect(previous.customers[0]).toMatchObject({ osakunta: "ESO", note: "Remember tea" });
  expect(previous.products[0]).toMatchObject({ description: "Hot tea", image: "data:image/png;base64,YQ==" });
  await ledger.startEvent("Uusi juhla");
  expect(ledger.snapshot().customers[0]).toMatchObject({ balance: 1000, osakunta: "ESO", note: "Remember tea" });
  expect(ledger.snapshot().products).toEqual(previous.products);
  await ledger.post({ customerId: "aino", cents: 300, kind: "charge", label: "Tea" });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot(previous.event.id)).toEqual(previous);
  expect(reopened.snapshot().customers[0].balance).toBe(700);
  expect(reopened.snapshot().entries).toHaveLength(1);
  expect((await Ledger.open(original)).snapshot()).toEqual(previous);
});

it("lists events from oldest to newest", async () => {
  const ledger = await Ledger.create({ name: "Alkujuhla" });
  await ledger.startEvent("Toinen juhla");
  expect(ledger.events().map((event) => event.name)).toEqual(["Alkujuhla", "Toinen juhla"]);
  expect(ledger.events().at(-1)).toEqual(ledger.latestEvent());
});

it("carries balances over from earlier events but not from later ones", async () => {
  const ledger = await Ledger.create({ name: "Alkujuhla" });
  await ledger.addCustomer("Aino", "1001");
  const customerId = ledger.snapshot().customers[0].id;
  const first = ledger.latestEvent().id;
  await ledger.post({ customerId, cents: 1000, kind: "deposit", label: "" });
  await ledger.startEvent("Toinen juhla");
  await ledger.post({ customerId, cents: 250, kind: "charge", label: "Tea" });
  expect(ledger.snapshot().customers[0].balance).toBe(750);
  expect(ledger.snapshot(first).customers[0].balance).toBe(1000);
});
