import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { Ledger } from "../ledger";
import { connectFile } from "./database-file";

it("writes a real SQLite file and rejects external edits without losing the current balance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "piikki-"));
  const path = join(dir, "accounts.sqlite");
  try {
    const initial = await Ledger.open();
    await initial.addCustomer("Aino", "1");
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
      kind: "deposit",
      label: "Deposit",
    });
    const reopened = await Ledger.open(new Uint8Array(await readFile(path)));
    expect(reopened.snapshot().customers[0].balance).toBe(2000);
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
    expect(ledger.snapshot().customers[0].balance).toBe(2000);
    const external = await Ledger.open(new Uint8Array(await readFile(path)));
    expect(external.snapshot().customers[0].balance).toBe(1900);
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
