import { persist } from "./recovery";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  BrandingSchema,
  EventNameSchema,
  LedgerEventSchema,
  defaultBranding,
  type Branding,
  CustomerSchema,
  EntrySchema,
  ProductSchema,
  type Product,
  type Snapshot,
} from "./model";
const engine = () =>
  initSqlJs({
    locateFile: () =>
      typeof window === "undefined"
        ? `${process.cwd()}/node_modules/sql.js/dist/sql-wasm.wasm`
        : wasmUrl,
  });
const schema = `
PRAGMA foreign_keys=ON;
PRAGMA user_version=2;
CREATE TABLE events(id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100));
INSERT INTO events VALUES('initial','Ensimmäinen tapahtuma');
CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id), event_id TEXT NOT NULL REFERENCES events(id));
CREATE TABLE presets(id TEXT PRIMARY KEY, name TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0));`;
export class Ledger {
  private constructor(
    private db: Database,
    private makeDatabase: (bytes: Uint8Array) => Database,
    private writer?: (bytes: Uint8Array) => Promise<void>,
  ) {}
  static async open(
    bytes?: Uint8Array,
    writer?: (bytes: Uint8Array) => Promise<void>,
  ): Promise<Ledger> {
    const SQL = await engine();
    const db = new SQL.Database(bytes);
    try {
      if (!bytes) db.run(schema);
      db.run("PRAGMA foreign_keys=ON");
      const ledger = new Ledger(db, (data) => new SQL.Database(data), writer);
      if (ledger.rows("PRAGMA user_version")[0]?.user_version === 1) {
        db.run(`BEGIN;
          CREATE TABLE events(id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100));
          INSERT INTO events VALUES('initial','Aiempi tapahtuma');
          ALTER TABLE entries ADD COLUMN event_id TEXT REFERENCES events(id);
          UPDATE entries SET event_id='initial';
          PRAGMA user_version=2;
          COMMIT;`);
      }
      ledger.validate();
      return ledger;
    } catch (error) {
      db.close();
      throw new Error(
        `Could not open this database. ${error instanceof Error ? error.message : "Invalid SQLite file."}`,
      );
    }
  }
  static async create({ name }: { name: string }): Promise<Ledger> {
    const eventName = EventNameSchema.parse(name);
    const ledger = await Ledger.open();
    ledger.db.run("UPDATE events SET name=? WHERE id='initial'", [eventName]);
    return ledger;
  }
  events() {
    return this.rows("SELECT * FROM events ORDER BY rowid").map((row) =>
      LedgerEventSchema.parse(row),
    );
  }
  latestEvent() {
    return LedgerEventSchema.parse(this.rows("SELECT * FROM events ORDER BY rowid DESC LIMIT 1")[0]);
  }
  async startEvent(name: string) {
    const eventName = EventNameSchema.parse(name);
    return this.change(() => {
      this.db.run("INSERT INTO events VALUES(?,?)", [crypto.randomUUID(), eventName]);
    });
  }
  private rows(sql: string, params: SqlValue[] = []) {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(params);
      const rows: Record<string, SqlValue>[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }
  snapshot(eventId = this.latestEvent().id): Snapshot {
    const hasBranding =
      this.rows(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='branding'",
      ).length > 0;
    const branding = hasBranding
      ? this.rows(
          "SELECT primary_color AS [primary], secondary_color AS [secondary] FROM branding WHERE id=1",
        )[0]
      : undefined;
    const hasIdentity = this.rows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='organization'",
    ).length > 0;
    const identity = hasIdentity
      ? this.rows("SELECT name AS organization FROM organization WHERE id=1")[0]
      : undefined;
    const hasLogo = this.rows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='organization_logo'",
    ).length > 0;
    const logo = hasLogo
      ? this.rows("SELECT data AS logo FROM organization_logo WHERE id=1")[0]
      : undefined;
    const event = LedgerEventSchema.parse(this.rows("SELECT * FROM events WHERE id=?", [eventId])[0]);
    const hasMetadata = this.rows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='customer_metadata'",
    ).length > 0;
    const hasProducts = this.rows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='product_details'",
    ).length > 0;
    return {
      event,
      branding: BrandingSchema.parse({ ...defaultBranding, ...branding, ...identity, ...logo }),
      customers: this.rows(
        `SELECT c.*, ${hasMetadata ? "COALESCE(m.osakunta,'') osakunta, COALESCE(m.note,'') note," : ""} COALESCE(SUM(e.cents),0) balance
         FROM customers c ${hasMetadata ? "LEFT JOIN customer_metadata m ON m.customer_id=c.id" : ""}
         LEFT JOIN entries e ON e.customer_id=c.id AND e.event_id=? GROUP BY c.id ORDER BY c.name COLLATE NOCASE`, [event.id],
      ).map((row) => CustomerSchema.parse(row)),
      products: this.rows(hasProducts
        ? "SELECT p.*, COALESCE(d.description,'') description, COALESCE(d.image,'') image FROM presets p LEFT JOIN product_details d ON d.id=p.id ORDER BY p.rowid"
        : "SELECT *, '' description, '' image FROM presets ORDER BY rowid"
      ).map((row) => ProductSchema.parse(row)),
      entries: this.rows(
        "SELECT e.*, EXISTS(SELECT 1 FROM entries r WHERE r.reversal_of=e.id) reversed FROM entries e WHERE e.event_id=? ORDER BY e.rowid DESC", [event.id],
      ).map((row) => EntrySchema.parse(row)),
    };
  }
  private validate() {
    if (this.rows("PRAGMA user_version")[0]?.user_version !== 2)
      throw new Error("This file is not a supported Piikki database.");
    if (
      this.rows("PRAGMA integrity_check")[0]?.integrity_check !== "ok" ||
      this.rows("PRAGMA foreign_key_check").length
    )
      throw new Error("This database contains invalid data.");
    if (this.rows("SELECT id FROM entries WHERE event_id IS NULL").length)
      throw new Error("A transaction is missing its event.");
    const events = this.rows("SELECT * FROM events").map((row) => LedgerEventSchema.parse(row));
    if (!events.length) throw new Error("The database has no event.");
    for (const event of events) {
      const data = this.snapshot(event.id);
      const entries = new Map(data.entries.map((entry) => [entry.id, entry]));
      const reversed = new Set<string>();
      for (const entry of data.entries) {
        if (
          !Number.isSafeInteger(entry.cents) ||
          !entry.cents ||
          !data.customers.some((c) => c.id === entry.customer_id)
        )
          throw new Error("The database contains an invalid transaction.");
        if (entry.reversal_of !== null) {
          const original = entries.get(entry.reversal_of);
          if (
            !original ||
            original.reversal_of !== null ||
            original.customer_id !== entry.customer_id ||
            original.cents !== -entry.cents ||
            reversed.has(original.id)
          )
            throw new Error("The database contains an invalid reversal.");
          reversed.add(original.id);
        }
      }
      if (data.customers.some((c) => !Number.isSafeInteger(c.balance)))
        throw new Error("The database contains an invalid balance.");
    }
  }
  private saving = false;
  private async change(operation: () => void) {
    if (this.saving) throw new Error("Wait for the previous change to save.");
    this.saving = true;
    const previous = this.db.export();
    this.db.run("PRAGMA foreign_keys=ON; BEGIN");
    try {
      operation();
      this.validate();
      this.db.run("COMMIT");
      if (this.writer) await this.writer(this.db.export());
      else if (typeof localStorage !== "undefined") persist(this.db.export());
    } catch (error) {
      this.db.close();
      // Restoring bytes also handles a browser recovery write failing after COMMIT.
      this.db = this.makeDatabase(previous);
      this.db.run("PRAGMA foreign_keys=ON");
      throw error;
    } finally {
      this.saving = false;
    }
  }
  async post(input: {
    customerId: string;
    cents: number;
    label: string;
    kind: "charge" | "deposit";
  }) {
    if (
      !Number.isSafeInteger(input.cents) ||
      input.cents <= 0 ||
      input.cents > 999999999
    )
      throw new Error("Enter an amount greater than zero.");
    return this.change(() => {
      const customer = this.snapshot().customers.find(
        (c) => c.id === input.customerId,
      );
      if (!customer) throw new Error("Customer no longer exists.");
      this.db.run("INSERT INTO entries(id,customer_id,cents,label,created_at,reversal_of,event_id) VALUES(?,?,?,?,?,NULL,?)", [
        crypto.randomUUID(),
        input.customerId,
        input.kind === "charge" ? -input.cents : input.cents,
        input.label.trim() ||
          (input.kind === "charge" ? "Purchase" : "Deposit"),
        new Date().toISOString(),
        this.latestEvent().id,
      ]);
    });
  }
  async reverse(id: string) {
    return this.change(() => {
      const entry = this.snapshot().entries.find((e) => e.id === id);
      if (!entry || entry.reversed || entry.reversal_of)
        throw new Error("This transaction cannot be reversed.");
      this.db.run("INSERT INTO entries(id,customer_id,cents,label,created_at,reversal_of,event_id) VALUES(?,?,?,?,?,?,?)", [
        crypto.randomUUID(),
        entry.customer_id,
        -entry.cents,
        `Undo ${entry.label}`,
        new Date().toISOString(),
        entry.id,
        this.latestEvent().id,
      ]);
    });
  }
  private ensureCustomerMetadata() {
    this.db.run(
      "CREATE TABLE IF NOT EXISTS customer_metadata(customer_id TEXT PRIMARY KEY REFERENCES customers(id), osakunta TEXT NOT NULL DEFAULT '' CHECK(length(osakunta)<=5), note TEXT NOT NULL DEFAULT '')",
    );
  }
  async addCustomer(name: string, reference: string, osakunta = "") {
    if (!name.trim()) throw new Error("Enter a customer name.");
    if (!CustomerSchema.shape.osakunta.safeParse(osakunta).success)
      throw new Error("Osakunta saa olla enintään 5 merkkiä.");
    return this.change(() => {
      const id = crypto.randomUUID();
      this.db.run("INSERT INTO customers VALUES(?,?,?)", [
        id,
        name.trim(),
        reference.trim(),
      ]);
      this.ensureCustomerMetadata();
      this.db.run(
        "INSERT INTO customer_metadata(customer_id,osakunta) VALUES(?,?)",
        [id, osakunta],
      );
    });
  }
  async saveCustomerNote(customerId: string, note: string) {
    CustomerSchema.shape.note.parse(note);
    return this.change(() => {
      if (
        !this.snapshot().customers.some((customer) => customer.id === customerId)
      )
        throw new Error("Customer no longer exists.");
      this.ensureCustomerMetadata();
      this.db.run(
        "INSERT INTO customer_metadata(customer_id,note) VALUES(?,?) ON CONFLICT(customer_id) DO UPDATE SET note=excluded.note",
        [customerId, note],
      );
    });
  }
  async saveProduct(input: Product) {
    const product = ProductSchema.parse(input);
    product.name = product.name.trim();
    if (!product.name || product.name.length > 120)
      throw new Error("Enter a product name of 1–120 characters.");
    if (product.cents > 999999999)
      throw new Error("Product price is too large.");
    return this.change(() => {
      this.db.run(
        "INSERT INTO presets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cents=excluded.cents",
        [product.id, product.name, product.cents],
      );
      this.db.run(
        "CREATE TABLE IF NOT EXISTS product_details(id TEXT PRIMARY KEY, description TEXT NOT NULL, image TEXT NOT NULL)",
      );
      this.db.run(
        "INSERT INTO product_details VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,image=excluded.image",
        [product.id, product.description, product.image],
      );
    });
  }
  async saveBranding(input: Branding) {
    const branding = BrandingSchema.parse(input);
    return this.change(() => {
      this.db.run(
        "CREATE TABLE IF NOT EXISTS organization_logo(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
      );
      if (branding.logo) {
        this.db.run(
          "INSERT INTO organization_logo VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
          [branding.logo],
        );
      } else {
        this.db.run("DELETE FROM organization_logo WHERE id=1");
      }
      this.db.run(
        "CREATE TABLE IF NOT EXISTS branding(id INTEGER PRIMARY KEY CHECK(id=1), primary_color TEXT NOT NULL, secondary_color TEXT NOT NULL)",
      );
      this.db.run(
        "CREATE TABLE IF NOT EXISTS organization(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL)",
      );
      this.db.run(
        "INSERT INTO organization VALUES(1,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        [branding.organization],
      );
      this.db.run(
        "INSERT INTO branding VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET primary_color=excluded.primary_color,secondary_color=excluded.secondary_color",
        [branding.primary, branding.secondary],
      );
    });
  }
  async removeProduct(id: string) {
    return this.change(() => {
      this.db.run("DELETE FROM presets WHERE id=?", [id]);
      if (this.rows("SELECT name FROM sqlite_master WHERE type='table' AND name='product_details'").length)
        this.db.run("DELETE FROM product_details WHERE id=?", [id]);
    });
  }
  export() {
    return this.db.export();
  }
}
