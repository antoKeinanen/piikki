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
  OPERATOR_MAX,
  type Product,
  type Snapshot,
} from "./model";
/** A product as saved; older callers may leave the category out. */
type ProductInput = Omit<Product, "category"> & { category?: string };
const OSAKUNTA_ERROR = `Osakunta saa olla enintään ${CustomerSchema.shape.osakunta.unwrap().maxLength} merkkiä.`;
function cleanOperator(operator = "") {
  const name = operator.trim();
  if (name.length > OPERATOR_MAX) throw new Error("Vuorossa olevan nimi on liian pitkä.");
  return name;
}
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
/** Current database format. Older files are upgraded on open. */
const SCHEMA_VERSION = 3;
const CUSTOMER_METADATA_COLUMNS =
  "customer_id TEXT PRIMARY KEY REFERENCES customers(id), osakunta TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''";
const PRODUCT_DETAILS_COLUMNS =
  "id TEXT PRIMARY KEY, description TEXT NOT NULL, image TEXT NOT NULL, category TEXT NOT NULL DEFAULT ''";
const ENTRY_DETAILS_COLUMNS =
  "entry_id TEXT PRIMARY KEY REFERENCES entries(id), operator TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', opening INTEGER NOT NULL DEFAULT 0 CHECK(opening IN (0,1))";
/** Each step upgrades a database from the given version to the next one. */
const migrations: [number, (ledger: Ledger) => void][] = [
  [1, (ledger) => ledger["migrateToV2"]()],
  [2, (ledger) => ledger["migrateToV3"]()],
];
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
      ledger.migrate(!bytes);
      ledger.validate();
      return ledger;
    } catch (error) {
      db.close();
      throw new Error(
        `Could not open this database. ${error instanceof Error ? error.message : "Invalid SQLite file."}`,
      );
    }
  }
  /** True when opening upgraded the file; the caller should save it right away. */
  migrated = false;
  private version() {
    return Number(this.rows("PRAGMA user_version")[0]?.user_version);
  }
  /**
   * Upgrades older files one version at a time, each step in its own
   * transaction, so a failure leaves the opened bytes untouched. Files from a
   * newer app are refused instead of being guessed at.
   */
  private migrate(fresh: boolean) {
    const start = this.version();
    if (start > SCHEMA_VERSION)
      throw new Error("This database was saved by a newer version of Piikki. Update the app to open it.");
    for (const [from, step] of migrations) {
      if (this.version() !== from) continue;
      this.db.run("BEGIN");
      try {
        step(this);
        this.db.run(`PRAGMA user_version=${from + 1}`);
        if (this.rows("PRAGMA foreign_key_check").length)
          throw new Error("Upgrading the database broke a reference.");
        this.db.run("COMMIT");
      } catch (error) {
        this.db.run("ROLLBACK");
        throw error;
      }
    }
    this.migrated = !fresh && this.version() !== start;
  }
  /** Version 2 adds named events; earlier entries go to one past event. */
  private migrateToV2() {
    this.db.run(`CREATE TABLE events(id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100));
      INSERT INTO events VALUES('initial','Aiempi tapahtuma');
      ALTER TABLE entries ADD COLUMN event_id TEXT REFERENCES events(id);
      UPDATE entries SET event_id='initial';`);
  }
  /** Version 3 lifts the osakunta length limit and adds entry and product details. */
  private migrateToV3() {
    const metadata = this.rows(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='customer_metadata'",
    )[0];
    if (metadata && /length\(osakunta\)/.test(String(metadata.sql))) {
      // SQLite cannot drop a CHECK constraint, so the table is rebuilt.
      this.db.run(`CREATE TABLE customer_metadata_v3(${CUSTOMER_METADATA_COLUMNS});
        INSERT INTO customer_metadata_v3(customer_id, osakunta, note)
          SELECT customer_id, osakunta, note FROM customer_metadata;
        DROP TABLE customer_metadata;
        ALTER TABLE customer_metadata_v3 RENAME TO customer_metadata;`);
    }
    this.db.run(`CREATE TABLE IF NOT EXISTS customer_metadata(${CUSTOMER_METADATA_COLUMNS})`);
    this.db.run(`CREATE TABLE IF NOT EXISTS product_details(${PRODUCT_DETAILS_COLUMNS})`);
    if (!this.hasColumn("product_details", "category"))
      this.db.run("ALTER TABLE product_details ADD COLUMN category TEXT NOT NULL DEFAULT ''");
    this.db.run(`CREATE TABLE IF NOT EXISTS entry_details(${ENTRY_DETAILS_COLUMNS})`);
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
  private hasTable(name: string) {
    return this.rows("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]).length > 0;
  }
  private hasColumn(table: string, column: string) {
    return this.rows(`PRAGMA table_info(${table})`).some((row) => row.name === column);
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
    const hasRemovals = this.hasTable("customer_removals");
    const hasEntryDetails = this.hasTable("entry_details");
    const hasCategories = hasProducts && this.hasColumn("product_details", "category");
    const people = this.rows(
      `SELECT c.*, ${hasMetadata ? "COALESCE(m.osakunta,'') osakunta, COALESCE(m.note,'') note," : ""}
         ${hasRemovals ? "r.customer_id IS NOT NULL" : "0"} removed, COALESCE(SUM(e.cents),0) balance,
         MAX(e.created_at) last_activity
       FROM customers c ${hasMetadata ? "LEFT JOIN customer_metadata m ON m.customer_id=c.id" : ""}
       ${hasRemovals ? "LEFT JOIN customer_removals r ON r.customer_id=c.id" : ""}
       LEFT JOIN entries e ON e.customer_id=c.id
         AND e.event_id IN (SELECT id FROM events WHERE rowid <= (SELECT rowid FROM events WHERE id=?))
       GROUP BY c.id ORDER BY c.name COLLATE NOCASE`, [event.id],
    );
    const parse = (removed: boolean) => people
      .filter((row) => !!row.removed === removed)
      .map(({ removed: _, ...row }) => CustomerSchema.parse(row));
    return {
      event,
      branding: BrandingSchema.parse({ ...defaultBranding, ...branding, ...identity, ...logo }),
      customers: parse(false),
      removedCustomers: parse(true),
      products: this.rows(hasProducts
        ? `SELECT p.*, COALESCE(d.description,'') description, COALESCE(d.image,'') image, ${hasCategories ? "COALESCE(d.category,'')" : "''"} category FROM presets p LEFT JOIN product_details d ON d.id=p.id ORDER BY p.rowid`
        : "SELECT *, '' description, '' image, '' category FROM presets ORDER BY rowid"
      ).map((row) => ProductSchema.parse(row)),
      entries: this.rows(
        `SELECT e.*, EXISTS(SELECT 1 FROM entries r WHERE r.reversal_of=e.id) reversed
           ${hasEntryDetails ? ", COALESCE(d.operator,'') operator, COALESCE(d.note,'') note, COALESCE(d.opening,0) opening" : ""}
         FROM entries e ${hasEntryDetails ? "LEFT JOIN entry_details d ON d.entry_id=e.id" : ""}
         WHERE e.event_id=? ORDER BY e.rowid DESC`, [event.id],
      ).map((row) => EntrySchema.parse(row)),
    };
  }
  private validate() {
    if (this.version() !== SCHEMA_VERSION)
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
          ![...data.customers, ...data.removedCustomers].some((c) => c.id === entry.customer_id)
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
      if ([...data.customers, ...data.removedCustomers].some((c) => !Number.isSafeInteger(c.balance)))
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
  /**
   * Stores who made an entry and its optional description. The table is
   * created on first use, so older databases stay readable without it.
   */
  private saveEntryDetails(entryId: string, details: { operator?: string; note?: string; opening?: boolean }) {
    const operator = cleanOperator(details.operator);
    const note = (details.note ?? "").trim();
    if (note.length > 200) throw new Error("Kuvaus saa olla enintään 200 merkkiä.");
    if (!operator && !note && !details.opening) return;
    this.db.run("INSERT INTO entry_details VALUES(?,?,?,?)", [entryId, operator, note, details.opening ? 1 : 0]);
  }
  private insertEntry(input: {
    customerId: string;
    cents: number;
    label: string;
    reversalOf?: string;
    operator?: string;
    note?: string;
    opening?: boolean;
  }) {
    const id = crypto.randomUUID();
    this.db.run("INSERT INTO entries(id,customer_id,cents,label,created_at,reversal_of,event_id) VALUES(?,?,?,?,?,?,?)", [
      id,
      input.customerId,
      input.cents,
      input.label,
      new Date().toISOString(),
      input.reversalOf ?? null,
      this.latestEvent().id,
    ]);
    this.saveEntryDetails(id, input);
  }
  async post(input: {
    customerId: string;
    cents: number;
    label: string;
    kind: "charge" | "deposit";
    /** Optional description shown in the person's history. */
    note?: string;
    /** Name of the person at the till, recorded for later questions. */
    operator?: string;
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
      this.insertEntry({
        customerId: input.customerId,
        cents: input.kind === "charge" ? -input.cents : input.cents,
        label: input.label.trim() || (input.kind === "charge" ? "Charge" : "Deposit"),
        operator: input.operator,
        note: input.note,
      });
    });
  }
  async reverse(id: string, operator?: string) {
    return this.change(() => {
      const entry = this.snapshot().entries.find((e) => e.id === id);
      if (!entry || entry.reversed || entry.reversal_of)
        throw new Error("This transaction cannot be reversed.");
      this.insertEntry({
        customerId: entry.customer_id,
        cents: -entry.cents,
        label: `Undo ${entry.label}`,
        reversalOf: entry.id,
        operator,
      });
    });
  }
  /** Names that have made entries, most recent first, for a quick operator choice. */
  operators(): string[] {
    if (!this.hasTable("entry_details")) return [];
    return this.rows(
      `SELECT d.operator FROM entry_details d JOIN entries e ON e.id=d.entry_id
       WHERE d.operator != '' GROUP BY d.operator ORDER BY MAX(e.rowid) DESC LIMIT 12`,
    ).map((row) => String(row.operator));
  }
  private ensureCustomerMetadata() {
    // Created by the version 3 migration; kept for databases mid-transaction.
    this.db.run(`CREATE TABLE IF NOT EXISTS customer_metadata(${CUSTOMER_METADATA_COLUMNS})`);
  }
  /**
   * Adds a person and returns their id. A non-zero opening balance is stored
   * as an entry marked as opening, so statistics do not count it as a sale.
   */
  async addCustomer(
    name: string,
    reference: string,
    osakunta = "",
    options: { openingCents?: number; operator?: string } = {},
  ) {
    if (!name.trim()) throw new Error("Enter a customer name.");
    osakunta = osakunta.trim();
    if (!CustomerSchema.shape.osakunta.safeParse(osakunta).success)
      throw new Error(OSAKUNTA_ERROR);
    const opening = options.openingCents ?? 0;
    if (!Number.isSafeInteger(opening) || Math.abs(opening) > 999999999)
      throw new Error("Alkusaldo on virheellinen.");
    const id = crypto.randomUUID();
    await this.change(() => {
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
      if (opening)
        this.insertEntry({ customerId: id, cents: opening, label: "Alkusaldo", operator: options.operator, opening: true });
    });
    return id;
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
  /** Renames a person or changes their osakunta. Notes are saved separately. */
  async updateCustomer(customerId: string, input: { name: string; osakunta: string }) {
    const name = input.name.trim();
    const osakunta = input.osakunta.trim();
    if (!name) throw new Error("Enter a customer name.");
    if (!CustomerSchema.shape.osakunta.safeParse(osakunta).success)
      throw new Error(OSAKUNTA_ERROR);
    return this.change(() => {
      if (!this.snapshot().customers.some((customer) => customer.id === customerId))
        throw new Error("Customer no longer exists.");
      this.db.run("UPDATE customers SET name=? WHERE id=?", [name, customerId]);
      this.ensureCustomerMetadata();
      this.db.run(
        "INSERT INTO customer_metadata(customer_id,osakunta) VALUES(?,?) ON CONFLICT(customer_id) DO UPDATE SET osakunta=excluded.osakunta",
        [customerId, osakunta],
      );
    });
  }
  /**
   * Hides a person from the cashier. Their entries and balance stay in the
   * database, so restoreCustomer brings them back unchanged.
   */
  async removeCustomer(customerId: string) {
    return this.change(() => {
      if (!this.snapshot().customers.some((customer) => customer.id === customerId))
        throw new Error("Customer no longer exists.");
      this.db.run(
        "CREATE TABLE IF NOT EXISTS customer_removals(customer_id TEXT PRIMARY KEY REFERENCES customers(id), removed_at TEXT NOT NULL)",
      );
      this.db.run("INSERT INTO customer_removals VALUES(?,?)", [
        customerId,
        new Date().toISOString(),
      ]);
    });
  }
  async restoreCustomer(customerId: string) {
    return this.change(() => {
      if (!this.snapshot().removedCustomers.some((customer) => customer.id === customerId))
        throw new Error("This person is not deleted.");
      this.db.run("DELETE FROM customer_removals WHERE customer_id=?", [customerId]);
    });
  }
  async saveProduct(input: ProductInput) {
    const product = ProductSchema.parse(input);
    product.name = product.name.trim();
    if (!product.name || product.name.length > 120)
      throw new Error("Enter a product name of 1–120 characters.");
    if (product.cents > 999999999)
      throw new Error("Item amount is too large.");
    return this.change(() => {
      this.db.run(
        "INSERT INTO presets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cents=excluded.cents",
        [product.id, product.name, product.cents],
      );
      this.db.run(
        "INSERT INTO product_details(id,description,image,category) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,image=excluded.image,category=excluded.category",
        [product.id, product.description, product.image, product.category],
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
  /** Frees the in-memory database. The ledger cannot be used afterwards. */
  close() {
    this.db.close();
  }
}
