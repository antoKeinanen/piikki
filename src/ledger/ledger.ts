import { persist } from "./recovery";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  BrandingSchema,
  defaultBranding,
  type Branding,
  CustomerSchema,
  EntrySchema,
  PresetSchema,
  type Preset,
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
PRAGMA user_version=1;
CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL);
CREATE TABLE entries(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cents INTEGER NOT NULL CHECK(cents != 0), label TEXT NOT NULL, created_at TEXT NOT NULL, reversal_of TEXT UNIQUE REFERENCES entries(id));
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
      ledger.validate();
      return ledger;
    } catch (error) {
      db.close();
      throw new Error(
        `Could not open this database. ${error instanceof Error ? error.message : "Invalid SQLite file."}`,
      );
    }
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
  snapshot(): Snapshot {
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
    return {
      branding: BrandingSchema.parse({ ...defaultBranding, ...branding, ...identity, ...logo }),
      customers: this.rows(
        "SELECT c.*, COALESCE(SUM(e.cents),0) balance FROM customers c LEFT JOIN entries e ON e.customer_id=c.id GROUP BY c.id ORDER BY c.name COLLATE NOCASE",
      ).map((row) => CustomerSchema.parse(row)),
      presets: this.rows("SELECT * FROM presets ORDER BY rowid").map((row) =>
        PresetSchema.parse(row),
      ),
      entries: this.rows(
        "SELECT e.*, EXISTS(SELECT 1 FROM entries r WHERE r.reversal_of=e.id) reversed FROM entries e ORDER BY e.rowid DESC",
      ).map((row) => EntrySchema.parse(row)),
    };
  }
  private validate() {
    if (this.rows("PRAGMA user_version")[0]?.user_version !== 1)
      throw new Error("This file is not a supported Piikki database.");
    if (
      this.rows("PRAGMA integrity_check")[0]?.integrity_check !== "ok" ||
      this.rows("PRAGMA foreign_key_check").length
    )
      throw new Error("This database contains invalid data.");
    const data = this.snapshot();
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
      this.db.run("INSERT INTO entries VALUES(?,?,?,?,?,NULL)", [
        crypto.randomUUID(),
        input.customerId,
        input.kind === "charge" ? -input.cents : input.cents,
        input.label.trim() ||
          (input.kind === "charge" ? "Purchase" : "Deposit"),
        new Date().toISOString(),
      ]);
    });
  }
  async reverse(id: string) {
    return this.change(() => {
      const entry = this.snapshot().entries.find((e) => e.id === id);
      if (!entry || entry.reversed || entry.reversal_of)
        throw new Error("This transaction cannot be reversed.");
      this.db.run("INSERT INTO entries VALUES(?,?,?,?,?,?)", [
        crypto.randomUUID(),
        entry.customer_id,
        -entry.cents,
        `Undo ${entry.label}`,
        new Date().toISOString(),
        entry.id,
      ]);
    });
  }
  async addCustomer(name: string, reference: string) {
    if (!name.trim()) throw new Error("Enter a customer name.");
    return this.change(() =>
      this.db.run("INSERT INTO customers VALUES(?,?,?)", [
        crypto.randomUUID(),
        name.trim(),
        reference.trim(),
      ]),
    );
  }
  async savePreset(preset: Preset) {
    PresetSchema.parse(preset);
    if (!preset.name.trim() || !Number.isSafeInteger(preset.cents))
      throw new Error("Enter an amount greater than zero.");
    return this.change(() =>
      this.db.run(
        "INSERT INTO presets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cents=excluded.cents",
        [preset.id, preset.name.trim(), preset.cents],
      ),
    );
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
  async removePreset(id: string) {
    return this.change(() =>
      this.db.run("DELETE FROM presets WHERE id=?", [id]),
    );
  }
  export() {
    return this.db.export();
  }
}
