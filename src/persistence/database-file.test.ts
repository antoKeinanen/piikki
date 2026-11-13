import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { Ledger } from "../ledger";
import { connectFile, isEncrypted } from "./database-file";

it("writes a real SQLite file and rejects external edits without losing the current balance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "piikki-"));
  const path = join(dir, "accounts.sqlite");
  try {
    const initial = await Ledger.open();
    await initial.addCustomer("Aino", "1", "KyO");
    const id = initial.snapshot().customers[0].id;
    await writeFile(path, initial.export());
    const { ledger } = await connectFile({
      async getFile() {
        return new File(
          [new Uint8Array(await readFile(path))],
          "accounts.sqlite",
        );
      },
      async createWritable() {
        let bytes: Uint8Array | undefined;
        return {
          async write(data) {
            if (!(data instanceof Uint8Array))
              throw new Error("Expected SQLite bytes.");
            bytes = data;
          },
          async close() {
            if (!bytes) throw new Error("No data.");
            await writeFile(path, bytes);
          },
          async abort() {},
        };
      },
    });
    await ledger.post({
      customerId: id,
      cents: 2000,
      kind: "charge",
      label: "Charge",
    });
    await ledger.saveCustomerNote(id, "Persisted note\nSecond line");
    const reopened = await Ledger.open(new Uint8Array(await readFile(path)));
    expect(reopened.snapshot().customers[0]).toMatchObject({
      osakunta: "KyO", note: "Persisted note\nSecond line",
    });
    expect(reopened.snapshot().customers[0].balance).toBe(-2000);
    await reopened.post({
      customerId: id,
      cents: 100,
      kind: "charge",
      label: "Charge",
    });
    await writeFile(path, reopened.export());
    await expect(
      ledger.post({
        customerId: id,
        cents: 850,
        kind: "charge",
        label: "Charge",
      }),
    ).rejects.toThrow("changed outside this app");
    expect(ledger.snapshot().customers[0].balance).toBe(-2000);
    const external = await Ledger.open(new Uint8Array(await readFile(path)));
    expect(external.snapshot().customers[0].balance).toBe(-2100);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("does not open an account session when the initial write check fails", async () => {
  const initial = await Ledger.open();
  const bytes = initial.export();
  await expect(
    connectFile({
      async getFile() {
        return new File([new Uint8Array(bytes)], "accounts.sqlite");
      },
      async createWritable() {
        throw new Error("Write denied");
      },
    }),
  ).rejects.toThrow("Write denied");
});

function memoryFile(initial: Uint8Array) {
  let stored = new Uint8Array(initial);
  return {
    stored: () => stored,
    handle: {
      async getFile() {
        return new File([new Uint8Array(stored)], "accounts.sqlite");
      },
      async createWritable() {
        let next: Uint8Array | undefined;
        return {
          async write(data: unknown) {
            if (!(data instanceof Uint8Array)) throw new Error("Expected bytes.");
            next = data;
          },
          async close() {
            if (next) stored = new Uint8Array(next);
          },
          async abort() {},
        };
      },
    },
  };
}

it("encrypts with the configured password and reads the file back only with it", async () => {
  const initial = await Ledger.open();
  await initial.addCustomer("Aino", "", "KyO", { openingCents: 1200 });
  const file = memoryFile(initial.export());
  // A plain file is encrypted as soon as it is opened with a password set.
  const first = await connectFile(file.handle, { password: "salasana" });
  expect(first.protection.encrypted()).toBe(true);
  expect(isEncrypted(file.stored())).toBe(true);
  await expect(Ledger.open(file.stored())).rejects.toThrow();
  const id = first.ledger.snapshot().customers[0].id;
  await first.ledger.post({ customerId: id, cents: 200, kind: "charge", label: "Kahvi" });
  expect(isEncrypted(file.stored())).toBe(true);
  expect(isEncrypted(await first.protection.backup())).toBe(true);

  await expect(connectFile(file.handle, { password: undefined })).rejects.toThrow("VITE_DATABASE_PASSWORD");
  await expect(connectFile(file.handle, { password: "väärä" })).rejects.toThrow("ei täsmää");
  const second = await connectFile(file.handle, { password: "salasana" });
  expect(second.ledger.snapshot().customers[0].balance).toBe(1000);
});

it("keeps files as plain SQLite without a configured password", async () => {
  const initial = await Ledger.open();
  const file = memoryFile(initial.export());
  const opened = await connectFile(file.handle, { password: undefined });
  expect(opened.protection.encrypted()).toBe(false);
  await opened.ledger.addCustomer("Aino", "");
  expect(isEncrypted(file.stored())).toBe(false);
  expect((await Ledger.open(file.stored())).snapshot().customers).toHaveLength(1);
});

it("saves an upgraded schema to the file as soon as it is opened", async () => {
  // Written by the previous release: schema version 2 with the osakunta limit.
  const fixture = new Uint8Array(await readFile(new URL("./fixtures/version-2.sqlite", import.meta.url)));
  expect((await Ledger.open(fixture)).migrated).toBe(true);
  const file = memoryFile(fixture);
  const { ledger } = await connectFile(file.handle, { password: undefined });
  expect(file.stored()).not.toEqual(fixture);
  const onDisk = await Ledger.open(file.stored());
  expect(onDisk.migrated).toBe(false);
  expect(onDisk.snapshot().customers[0]).toMatchObject({ name: "Aino", osakunta: "KyO", balance: 2000 });
  await ledger.updateCustomer("aino", { name: "Aino", osakunta: "Sen-KyO" });
  expect((await Ledger.open(file.stored())).snapshot().customers[0].osakunta).toBe("Sen-KyO");
});
