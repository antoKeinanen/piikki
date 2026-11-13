import { expect, it } from "vitest";
import { Ledger } from "./ledger";

async function withPerson() {
  let saved = new Uint8Array();
  let fails = false;
  const ledger = await Ledger.open(undefined, async (bytes) => {
    if (fails) throw new Error("Disk unavailable");
    saved = new Uint8Array(bytes);
  });
  await ledger.addCustomer("Aino", "", "KyO");
  const id = ledger.snapshot().customers[0].id;
  return { ledger, id, saved: () => saved, fail: (value: boolean) => { fails = value; } };
}

it("renames and changes osakunta, and the previous values can be saved back", async () => {
  const { ledger, id, saved } = await withPerson();
  await ledger.saveCustomerNote(id, "Keep me");
  await ledger.updateCustomer(id, { name: "  Aino K ", osakunta: "PO" });
  expect((await Ledger.open(saved())).snapshot().customers[0]).toMatchObject({
    id, name: "Aino K", osakunta: "PO", note: "Keep me",
  });
  await ledger.updateCustomer(id, { name: "Aino", osakunta: "KyO" });
  expect(ledger.snapshot().customers[0]).toMatchObject({ name: "Aino", osakunta: "KyO" });
  await expect(ledger.updateCustomer(id, { name: " ", osakunta: "" })).rejects.toThrow("name");
  await expect(ledger.updateCustomer(id, { name: "A", osakunta: "ABCDEF" })).rejects.toThrow("5");
  await expect(ledger.updateCustomer("missing", { name: "A", osakunta: "" })).rejects.toThrow("no longer exists");
});

it("deletes a person without losing history and restores the same balance", async () => {
  const { ledger, id, saved } = await withPerson();
  await ledger.post({ customerId: id, cents: 500, kind: "deposit", label: "" });
  await ledger.post({ customerId: id, cents: 120, kind: "charge", label: "Kahvi" });
  await ledger.removeCustomer(id);
  const removed = (await Ledger.open(saved())).snapshot();
  expect(removed.customers).toEqual([]);
  expect(removed.removedCustomers[0]).toMatchObject({ id, name: "Aino", balance: 380 });
  expect(removed.entries).toHaveLength(2);
  await expect(ledger.post({ customerId: id, cents: 100, kind: "charge", label: "" })).rejects.toThrow("no longer exists");
  await expect(ledger.removeCustomer(id)).rejects.toThrow("no longer exists");
  await ledger.restoreCustomer(id);
  const restored = (await Ledger.open(saved())).snapshot();
  expect(restored.customers[0]).toMatchObject({ id, balance: 380, osakunta: "KyO" });
  expect(restored.removedCustomers).toEqual([]);
  await expect(ledger.restoreCustomer(id)).rejects.toThrow("not deleted");
});

it("keeps deleted people out of new events but carries their balance on restore", async () => {
  const { ledger, id } = await withPerson();
  await ledger.post({ customerId: id, cents: 300, kind: "deposit", label: "" });
  await ledger.removeCustomer(id);
  await ledger.startEvent("Toinen");
  expect(ledger.snapshot().customers).toEqual([]);
  await ledger.restoreCustomer(id);
  expect(ledger.snapshot().customers[0].balance).toBe(300);
});

it("rolls back a delete whose save fails", async () => {
  const { ledger, id, fail } = await withPerson();
  fail(true);
  await expect(ledger.removeCustomer(id)).rejects.toThrow("Disk unavailable");
  await expect(ledger.updateCustomer(id, { name: "X", osakunta: "" })).rejects.toThrow("Disk unavailable");
  expect(ledger.snapshot().customers[0]).toMatchObject({ id, name: "Aino" });
});
