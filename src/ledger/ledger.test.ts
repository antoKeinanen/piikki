import { describe, it, expect } from "vitest";
import { Ledger } from "./ledger";

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
  it("rejects overdrafts and reversal of spent deposits without changing the database", async () => {
    const ledger = await Ledger.open();
    await ledger.addCustomer("Aino", "");
    const id = ledger.snapshot().customers[0].id;
    await ledger.post({
      customerId: id,
      cents: 500,
      kind: "deposit",
      label: "Cash",
    });
    const deposit = ledger.snapshot().entries[0];
    await ledger.post({
      customerId: id,
      cents: 400,
      kind: "charge",
      label: "Tea",
    });
    await expect(
      ledger.post({
        customerId: id,
        cents: 101,
        kind: "charge",
        label: "Snack",
      }),
    ).rejects.toThrow();
    await expect(ledger.reverse(deposit.id)).rejects.toThrow();
    expect(ledger.snapshot().customers[0].balance).toBe(100);
    expect(ledger.snapshot().entries).toHaveLength(2);
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
      cents: 850,
      kind: "charge",
      label: "Charge",
    } as const;
    await expect(ledger.post(charge)).rejects.toThrow("Disk unavailable");
    expect(ledger.snapshot().customers[0].balance).toBe(2000);
    expect(ledger.snapshot().entries).toHaveLength(1);
    fails = false;
    await ledger.post(charge);
    const reopened = await Ledger.open(saved);
    expect(reopened.snapshot().customers[0].balance).toBe(1150);
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

it("requires names and keeps previous event transactions separate after export", async () => {
  await expect(Ledger.create({ name: "   " })).rejects.toThrow();
  const ledger = await Ledger.create({ name: "  Syysjuhla  " });
  await ledger.addCustomer("Aino", "1");
  await ledger.savePreset({ id: "tea", name: "Tea", cents: 200 });
  const previous = ledger.snapshot();
  const customerId = previous.customers[0].id;
  await ledger.post({ customerId, cents: 1000, kind: "deposit", label: "Cash" });
  const deposit = ledger.snapshot().entries[0];
  await expect(ledger.startEvent("  ")).rejects.toThrow();
  expect(ledger.latestEvent().name).toBe("Syysjuhla");
  await ledger.startEvent("Talvijuhla");
  expect(ledger.snapshot().customers[0].balance).toBe(0);
  expect(ledger.snapshot().entries).toEqual([]);
  expect(ledger.snapshot().presets).toEqual(previous.presets);
  await expect(ledger.reverse(deposit.id)).rejects.toThrow();
  await expect(ledger.post({ customerId, cents: 100, kind: "charge", label: "Tea" })).rejects.toThrow();
  await ledger.post({ customerId, cents: 500, kind: "deposit", label: "Cash" });
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.latestEvent().name).toBe("Talvijuhla");
  expect(reopened.snapshot().customers[0].balance).toBe(500);
  expect(reopened.snapshot(previous.event.id).customers[0].balance).toBe(1000);
  expect(reopened.snapshot(previous.event.id).entries).toEqual([deposit]);
});

it("rolls back event creation when the database file cannot be saved", async () => {
  const original = await Ledger.create({ name: "Syysjuhla" });
  const ledger = await Ledger.open(original.export(), async () => { throw new Error("Disk full"); });
  await expect(ledger.startEvent("Talvijuhla")).rejects.toThrow("Disk full");
  expect(ledger.latestEvent()).toEqual(original.latestEvent());
  expect((await Ledger.open(ledger.export())).latestEvent()).toEqual(original.latestEvent());
});
