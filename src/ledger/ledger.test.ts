import { describe, it, expect } from "vitest";
import { Ledger } from "./ledger";
import initSqlJs from "sql.js";

describe("cashier ledger", () => {
  it("persists deposits, charges and exactly one reversal through SQLite export", async () => {
    const ledger = await Ledger.open();
    await ledger.addCustomer("Aino", "1001");
    const id = ledger.snapshot().customers[0].id;
    await ledger.post({
      customerId: id,
      cents: 2000,
      kind: "deposit",
      label: "Cash",
    });
    await ledger.post({
      customerId: id,
      cents: 850,
      kind: "charge",
      label: "Lunch",
    });
    expect(ledger.snapshot().customers[0].balance).toBe(1150);
    const purchase = ledger.snapshot().entries[0];
    await ledger.reverse(purchase.id);
    await expect(ledger.reverse(purchase.id)).rejects.toThrow();
    const reopened = await Ledger.open(ledger.export());
    expect(reopened.snapshot().customers[0].balance).toBe(2000);
    expect(reopened.snapshot().entries).toHaveLength(3);
  });
  it("charges from zero and below zero and reverses spent deposits after reopening", async () => {
    let ledger = await Ledger.open();
    await ledger.addCustomer("Aino", "");
    const id = ledger.snapshot().customers[0].id;
    const post = (cents: number, kind: "charge" | "deposit") =>
      ledger.post({ customerId: id, cents, kind, label: kind });
    await post(500, "charge");
    expect(ledger.snapshot().customers[0].balance).toBe(-500);
    await post(400, "charge");
    expect(ledger.snapshot().customers[0].balance).toBe(-900);
    await post(300, "deposit");
    const deposit = ledger.snapshot().entries[0];
    expect(ledger.snapshot().customers[0].balance).toBe(-600);
    ledger = await Ledger.open(ledger.export());
    expect(ledger.snapshot().customers[0].balance).toBe(-600);
    await ledger.reverse(deposit.id);
    expect(ledger.snapshot().customers[0].balance).toBe(-900);
    await expect(ledger.reverse(deposit.id)).rejects.toThrow("cannot be reversed");
    await expect(ledger.reverse(ledger.snapshot().entries[0].id)).rejects.toThrow("cannot be reversed");
    const charge = ledger.snapshot().entries.find((entry) => entry.cents === -400);
    if (!charge) throw new Error("Charge missing");
    await ledger.reverse(charge.id);
    const reopened = await Ledger.open(ledger.export());
    expect(reopened.snapshot().customers[0].balance).toBe(-500);
    expect(reopened.snapshot().entries).toHaveLength(5);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1000000000, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid amount %s without changing a negative account",
    async (cents) => {
      const ledger = await Ledger.open();
      await ledger.addCustomer("Aino", "");
      const customerId = ledger.snapshot().customers[0].id;
      await ledger.post({ customerId, cents: 100, kind: "charge", label: "Tea" });
      const before = ledger.snapshot();
      for (const kind of ["charge", "deposit"] as const) {
        await expect(ledger.post({ customerId, cents, kind, label: "Invalid" })).rejects.toThrow();
      }
      await expect(ledger.post({ customerId: "missing", cents: 100, kind: "charge", label: "Invalid" })).rejects.toThrow("Customer no longer exists");
      await expect(ledger.reverse("missing")).rejects.toThrow("cannot be reversed");
      expect(ledger.snapshot()).toEqual(before);
    },
  );
  it("allows reversal of a spent deposit to take a positive balance below zero", async () => {
    const ledger = await Ledger.open();
    await ledger.addCustomer("Aino", "");
    const customerId = ledger.snapshot().customers[0].id;
    await ledger.post({ customerId, cents: 500, kind: "deposit", label: "Cash" });
    const deposit = ledger.snapshot().entries[0];
    await ledger.post({ customerId, cents: 400, kind: "charge", label: "Tea" });
    await ledger.reverse(deposit.id);
    const reopened = await Ledger.open(ledger.export());
    expect(reopened.snapshot().customers[0].balance).toBe(-400);
    expect(reopened.snapshot().entries).toHaveLength(3);
  });
  it.each([
    "UPDATE entries SET cents=-1.5 WHERE reversal_of IS NULL",
    "UPDATE entries SET cents=-9007199254740992 WHERE reversal_of IS NULL",
    "UPDATE entries SET cents=-101 WHERE reversal_of IS NOT NULL",
    "UPDATE entries SET customer_id='missing' WHERE reversal_of IS NULL",
  ])("rejects corrupt imported account data after %s", async (sql) => {
    const ledger = await Ledger.open();
    await ledger.addCustomer("Aino", "");
    const customerId = ledger.snapshot().customers[0].id;
    await ledger.post({ customerId, cents: 100, kind: "charge", label: "Tea" });
    await ledger.reverse(ledger.snapshot().entries[0].id);
    const SQL = await initSqlJs();
    const db = new SQL.Database(ledger.export());
    try {
      db.run(sql);
      await expect(Ledger.open(db.export())).rejects.toThrow("Could not open this database");
    } finally {
      db.close();
    }
  });
  it("rejects incompatible files", async () => {
    await expect(Ledger.open(new Uint8Array([1, 2, 3]))).rejects.toThrow();

  });
});

describe("direct persistence", () => {
  it("waits for the writer and reopens saved SQLite bytes", async () => {
    let saved: Uint8Array | undefined;
    let finish: (() => void) | undefined;
    const ledger = await Ledger.open(undefined, async (bytes) => {
      saved = new Uint8Array(bytes);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const adding = ledger.addCustomer("Aino", "1");
    await expect(ledger.addCustomer("Other", "2")).rejects.toThrow("Wait");
    expect(finish).toBeDefined();
    finish?.();
    await adding;
    expect(saved).toBeDefined();
    const reopened = await Ledger.open(saved);
    expect(reopened.snapshot().customers.map((c) => c.name)).toEqual(["Aino"]);
  });
  it("rolls back a failed file write so retry does not double charge", async () => {
    const original = await Ledger.open();
    await original.addCustomer("Aino", "1");
    const id = original.snapshot().customers[0].id;
    await original.post({
      customerId: id,
      cents: 2000,
      kind: "deposit",
      label: "Deposit",
    });
    let fails = true;
    let saved: Uint8Array | undefined;
    const ledger = await Ledger.open(original.export(), async (bytes) => {
      if (fails) throw new Error("Disk unavailable");
      saved = new Uint8Array(bytes);
    });
    const charge = {
      customerId: id,
      cents: 2850,
      kind: "charge",
      label: "Charge",
    } as const;
    await expect(ledger.post(charge)).rejects.toThrow("Disk unavailable");
    expect(ledger.snapshot().customers[0].balance).toBe(2000);
    expect(ledger.snapshot().entries).toHaveLength(1);
    fails = false;
    await ledger.post(charge);
    const reopened = await Ledger.open(saved);
    expect(reopened.snapshot().customers[0].balance).toBe(-850);
    expect(reopened.snapshot().entries).toHaveLength(2);
  });
});

it("stores the two branding colors in SQLite without changing balances", async () => {
  const ledger = await Ledger.open();
  await ledger.addCustomer("Aino", "");
  await ledger.saveBranding({ organization: "Testiosakunta", primary: "#102030", secondary: "#eeddcc" });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot().branding).toEqual({
    organization: "Testiosakunta",
    primary: "#102030",
    secondary: "#eeddcc",
  });
  expect(reopened.snapshot().customers[0].balance).toBe(0);
  await expect(
    ledger.saveBranding({ organization: "Testiosakunta", primary: "invalid", secondary: "#ffffff" }),
  ).rejects.toThrow();
});

it("keeps logos with their database, supports replacement and removal, and rejects remote URLs", async () => {
  const ledger = await Ledger.open();
  const initial = ledger.snapshot().branding;
  expect(initial.logo).toBeUndefined();
  const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  await ledger.saveBranding({ ...initial, logo });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot().branding.logo).toBe(logo);
  expect((await Ledger.open()).snapshot().branding.logo).toBeUndefined();
  const replacement = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await reopened.saveBranding({ ...initial, logo: replacement });
  expect((await Ledger.open(reopened.export())).snapshot().branding.logo).toBe(replacement);
  await expect(reopened.saveBranding({ ...initial, logo: "https://example.com/logo.png" })).rejects.toThrow();
  expect(reopened.snapshot().branding.logo).toBe(replacement);
  await reopened.saveBranding(initial);
  expect((await Ledger.open(reopened.export())).snapshot().branding.logo).toBeUndefined();
});
