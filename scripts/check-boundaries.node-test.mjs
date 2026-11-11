import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkBoundaries } from './check-boundaries.mjs';

function check(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'piikki-boundaries-'));
  try {
    writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'Bundler', baseUrl: '.', paths: { '@ledger/*': ['src/ledger/*'] } } }));
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(root, 'src', name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    return checkBoundaries(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('allows composition, ledger public API, own tests, and database theme', () => {
  assert.deepEqual(check({
    'main.tsx': 'import "./app/App";',
    'app/App.tsx': 'import "../features/database/Welcome"; import "../ledger";',
    'app/App.test.tsx': 'import "../test-support/example";',
    'test-support/example.ts': 'import "../ledger";',
    'features/database/Welcome.ts': 'import "../branding/theme";',
    'features/branding/theme.ts': 'import "./colors";',
    'features/branding/colors.ts': 'export {};',
    'ledger/index.ts': 'export * from "./ledger";',
    'ledger/ledger.ts': 'export {};',
    'ledger/ledger.test.ts': 'import "./ledger";',
  }), []);
});

test('rejects private ledger imports through aliases, reexports and dynamic imports', () => {
  const errors = check({
    'features/cashier/Account.ts': 'export * from "@ledger/model"; import("../../ledger/model.ts");',
    'ledger/model.ts': 'export {};',
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.every((error) => error.includes('Ledger internals are private')));
});

test('rejects SQL outside ledger, reverse dependencies, production fixtures, and unknown dynamic imports', () => {
  const errors = check({
    'features/cashier/Account.ts': 'import "sql.js/dist/sql-wasm.wasm?url"; import "../../app/App"; import("../../test-support/example"); import(variable);',
    'app/App.tsx': 'export {};',
    'test-support/example.ts': 'export {};',
  });
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /SQL.js belongs/);
  assert.match(errors.join('\n'), /cannot import app/);
  assert.match(errors.join('\n'), /Production modules cannot/);
  assert.match(errors.join('\n'), /literal module path/);
});

test('rejects sibling features except database theme and blocks branding internals', () => {
  const errors = check({
    'features/database/Welcome.ts': 'import "../branding/colors"; import "../cashier/Account";',
    'features/branding/colors.ts': 'export {};',
    'features/cashier/Account.ts': 'export {};',
  });
  assert.equal(errors.length, 2);
});

test("ledger rejects UI frameworks", () => {
  assert.match(check({ "ledger/ledger.ts": 'import "react";' }).join("\n"), /Ledger cannot depend on react/);
});
