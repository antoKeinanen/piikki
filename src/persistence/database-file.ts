import { Ledger } from "../ledger";
import {
  WrongPasswordError,
  createKey,
  decrypt,
  decryptWithKey,
  encrypt,
  isEncrypted,
  type FileKey,
} from "./encryption";

export function fileAccessProblem(): string | undefined {
  if (!window.isSecureContext) return "Open this app over HTTPS or localhost.";
  if (
    typeof window.showOpenFilePicker !== "function" ||
    typeof window.showSaveFilePicker !== "function"
  )
    return "This browser cannot open and save local files.";
  if (
    typeof FileSystemFileHandle === "undefined" ||
    ["getFile", "createWritable", "requestPermission"].some(
      (method) =>
        typeof Reflect.get(FileSystemFileHandle.prototype, method) !==
        "function",
    )
  )
    return "This browser cannot write to local files.";
  if (
    typeof FileSystemWritableFileStream === "undefined" ||
    ["write", "close", "abort"].some(
      (method) =>
        typeof Reflect.get(FileSystemWritableFileStream.prototype, method) !==
        "function",
    )
  )
    return "This browser cannot finish saving files.";
  return undefined;
}
export const supportsDirectFiles = () => fileAccessProblem() === undefined;
function requireFileAccess() {
  const problem = fileAccessProblem();
  if (problem) throw new Error(problem);
}
const pickerTypes: FilePickerAcceptType[] = [
  {
    description: "SQLite database",
    accept: { "application/vnd.sqlite3": [".sqlite", ".sqlite3", ".db"] },
  },
];

type DatabaseFile = {
  getFile(): Promise<Blob & { name: string }>;
  createWritable(): Promise<
    Pick<FileSystemWritableFileStream, "write" | "close" | "abort">
  >;
};
/**
 * The encryption password is configured at build time, never typed in the app.
 * With it set, every save is encrypted; without it, files stay plain SQLite.
 */
export const configuredPassword = (): string | undefined =>
  import.meta.env.VITE_DATABASE_PASSWORD || undefined;
export type Protection = {
  encrypted(): boolean;
  /** Backup bytes, encrypted with the same password when the file is. */
  backup(): Promise<Uint8Array>;
};
export type OpenedDatabase = { ledger: Ledger; name: string; protection?: Protection };
export { isEncrypted };

const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Returns readable SQLite bytes and, when a password is configured, the key
 * for saving. A plain file gets a fresh key so it is encrypted on its next save.
 */
export async function unlockBytes(
  bytes: Uint8Array,
  password = configuredPassword(),
): Promise<{ plain: Uint8Array; fileKey?: FileKey }> {
  if (!isEncrypted(bytes))
    return { plain: bytes, fileKey: password ? await createKey(password) : undefined };
  if (!password)
    throw new Error(
      "Tietokanta on salattu, mutta sovellukselle ei ole asetettu salasanaa (VITE_DATABASE_PASSWORD).",
    );
  try {
    return await decrypt(bytes, password);
  } catch (error) {
    if (error instanceof WrongPasswordError)
      throw new Error(
        "Tietokannan salasana ei täsmää sovelluksen salasanaan (VITE_DATABASE_PASSWORD).",
      );
    throw error;
  }
}

export async function connectFile(
  handle: DatabaseFile,
  options: { password?: string; fileKey?: FileKey } = {},
): Promise<Required<OpenedDatabase>> {
  const file = await handle.getFile();
  let expected = new Uint8Array(await file.arrayBuffer());
  let fileKey = options.fileKey;
  let plain: Uint8Array = expected;
  if (fileKey && isEncrypted(expected)) plain = await decryptWithKey(expected, fileKey);
  else ({ plain, fileKey } = await unlockBytes(expected, "password" in options ? options.password : configuredPassword()));
  const encode = async (bytes: Uint8Array) =>
    fileKey ? encrypt(bytes, fileKey) : new Uint8Array(bytes);
  async function write(bytes: Uint8Array) {
    const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (!same(current, expected)) {
      throw new Error(
        "The database changed outside this app. Reopen it to continue.",
      );
    }
    const encoded = await encode(bytes);
    const stream = await handle.createWritable();
    try {
      await stream.write(encoded);
      await stream.close();
      expected = encoded;
    } catch (error) {
      await stream.abort().catch(() => {});
      throw error;
    }
  }
  const ledger = await Ledger.open(plain, write);
  // The write check also saves an upgraded schema, and encrypts a plain file
  // when a password is set, so the file on disk is current from the start.
  const upgrade = ledger.migrated || (!!fileKey && !isEncrypted(expected));
  const probed = upgrade ? await encode(ledger.export()) : expected;
  const probe = await handle.createWritable();
  try {
    const latest = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (!same(latest, expected))
      throw new Error(
        "The database changed while it was opening. Open it again.",
      );
    await probe.write(new Uint8Array(probed));
    await probe.close();
    expected = probed;
  } catch (error) {
    await probe.abort().catch(() => {});
    throw error;
  }
  const verified = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (!same(verified, expected))
    throw new Error(
      "The saved file does not match the database. Open it again.",
    );
  const protection: Protection = {
    encrypted: () => !!fileKey,
    backup: async () => encode(ledger.export()),
  };
  return { ledger, name: file.name, protection };
}
export async function pickDatabase(): Promise<OpenedDatabase> {
  requireFileAccess();
  const [handle] = await window.showOpenFilePicker({
    types: pickerTypes,
    multiple: false,
  });
  if (!handle) throw new Error("No database selected.");
  if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted")
    throw new Error("Allow write access to save changes to this file.");
  return connectFile(handle);
}
/** Saves a copy to a new file, encrypted when a password is configured. */
export async function saveDatabase(
  ledger: Ledger,
  name: string,
  fileKey?: FileKey,
): Promise<OpenedDatabase> {
  requireFileAccess();
  const password = configuredPassword();
  const key = fileKey ?? (password ? await createKey(password) : undefined);
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: pickerTypes,
  });
  const stream = await handle.createWritable();
  try {
    const plain = new Uint8Array(ledger.export());
    await stream.write(key ? await encrypt(plain, key) : plain);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
  return connectFile(handle, { fileKey: key });
}
