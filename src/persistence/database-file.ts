import { Ledger } from "../ledger";

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
export async function connectFile(handle: DatabaseFile) {
  const file = await handle.getFile();
  let expected = new Uint8Array(await file.arrayBuffer());
  const ledger = await Ledger.open(expected, async (bytes) => {
    const current = new Uint8Array(
      await (await handle.getFile()).arrayBuffer(),
    );
    if (
      current.length !== expected.length ||
      current.some((byte, i) => byte !== expected[i])
    ) {
      throw new Error(
        "The database changed outside this app. Reopen it to continue.",
      );
    }
    const stream = await handle.createWritable();
    try {
      await stream.write(new Uint8Array(bytes));
      await stream.close();
      expected = new Uint8Array(bytes);
    } catch (error) {
      await stream.abort().catch(() => {});
      throw error;
    }
  });
  const probe = await handle.createWritable();
  try {
    const latest = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (
      latest.length !== expected.length ||
      latest.some((byte, i) => byte !== expected[i])
    )
      throw new Error(
        "The database changed while it was opening. Open it again.",
      );
    await probe.write(new Uint8Array(expected));
    await probe.close();
  } catch (error) {
    await probe.abort().catch(() => {});
    throw error;
  }
  const verified = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (
    verified.length !== expected.length ||
    verified.some((byte, i) => byte !== expected[i])
  )
    throw new Error(
      "The saved file does not match the database. Open it again.",
    );
  return { ledger, name: file.name };
}
export async function pickDatabase() {
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
export async function saveDatabase(ledger: Ledger, name: string) {
  requireFileAccess();
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: pickerTypes,
  });
  const stream = await handle.createWritable();
  try {
    await stream.write(new Uint8Array(ledger.export()));
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
  return connectFile(handle);
}
