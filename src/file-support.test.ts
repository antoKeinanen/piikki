// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fileAccessProblem } from "./database-file";
beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("showOpenFilePicker", () => {});
  vi.stubGlobal("showSaveFilePicker", () => {});
  vi.stubGlobal(
    "FileSystemFileHandle",
    class {
      getFile() {}
      createWritable() {}
      requestPermission() {}
    },
  );
  vi.stubGlobal(
    "FileSystemWritableFileStream",
    class {
      write() {}
      close() {}
      abort() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
it("accepts the required APIs without inspecting the browser name", () => {
  expect(fileAccessProblem()).toBeUndefined();
});
it.each([
  "showOpenFilePicker",
  "showSaveFilePicker",
  "FileSystemFileHandle",
  "FileSystemWritableFileStream",
])("blocks when %s is missing", (key) => {
  vi.stubGlobal(key, undefined);
  expect(fileAccessProblem()).toBeTypeOf("string");
});
it("blocks an insecure origin even with all APIs present", () => {
  vi.stubGlobal("isSecureContext", false);
  expect(fileAccessProblem()).toContain("HTTPS");
});
it("rejects a partial file-handle implementation", () => {
  vi.stubGlobal(
    "FileSystemFileHandle",
    class {
      getFile() {}
      requestPermission() {}
    },
  );
  expect(fileAccessProblem()).toContain("cannot write");
});
it("rejects streams without a close operation", () => {
  vi.stubGlobal(
    "FileSystemWritableFileStream",
    class {
      write() {}
      abort() {}
    },
  );
  expect(fileAccessProblem()).toContain("cannot finish saving");
});
