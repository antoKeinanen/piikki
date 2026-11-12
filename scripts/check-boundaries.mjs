import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const testFile = (name) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(name);
const group = (name) => name.startsWith('features/')
  ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
const dependencies = {
  'main.tsx': ['app'],
  app: ['ledger', 'persistence', 'features/analytics', 'features/cashier', 'features/branding', 'features/products', 'features/database'],
  persistence: ['ledger'],
  'features/analytics': ['ledger'],
  'features/cashier': ['ledger'],
  'features/branding': ['ledger'],
  'features/products': ['ledger'],
  'features/database': ['ledger', 'persistence'],
  'test-support': ['ledger'],
  ledger: [],
};

export function checkBoundaries(root = process.cwd()) {
  const sourceRoot = path.resolve(root, 'src');
  const configPath = ts.findConfigFile(root, ts.sys.fileExists);
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : { config: {} };
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  const files = ts.sys.readDirectory(sourceRoot, ['.ts', '.tsx']);
  const errors = [];
  const relative = (file) => path.relative(sourceRoot, file).split(path.sep).join('/');
  for (const file of files) {
    const from = relative(file);
    const owner = group(from);
    const testing = testFile(from);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function report(node, message) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      errors.push(`${from}:${line}: ${message}`);
    }
    function check(node, specifier) {
      const bare = specifier.split('?')[0];
      if (/^sql\.js(?:\/|$)/.test(bare) && owner !== 'ledger') {
        report(node, 'SQL.js belongs to ledger; use the public ledger API.');
        return;
      }
      const resolved = ts.resolveModuleName(bare, file, options, ts.sys).resolvedModule;
      if (resolved?.isExternalLibraryImport && owner === 'ledger' && !testing && !/^(sql\.js(?:\/|$)|zod$)/.test(bare)) {
        report(node, `Ledger cannot depend on ${specifier}; keep UI and file adapters outside ledger.`);
        return;
      }
      let target = resolved?.resolvedFileName;
      if (!target && bare.startsWith('.')) {
        const asset = path.resolve(path.dirname(file), bare);
        if (fs.existsSync(asset) && fs.statSync(asset).isFile()) target = asset;
        else report(node, `Cannot resolve local import ${specifier}.`);
      }
      if (!target) {
        if (owner === 'ledger' && !testing && !/^(sql\.js(?:\/|$)|zod$)/.test(bare))
          report(node, `Ledger cannot depend on ${specifier}; keep UI and file adapters outside ledger.`);
        return;
      }
      const to = relative(fs.realpathSync(target));
      if (to.startsWith('../')) {
        if (!resolved?.isExternalLibraryImport) report(node, 'Source modules cannot import outside src.');
        return;
      }
      const destination = group(to);
      if (!testing && owner !== 'test-support' && (testFile(to) || destination === 'test-support')) {
        report(node, 'Production modules cannot import tests or test-support.');
        return;
      }
      if (destination === 'ledger' && owner !== 'ledger' && to !== 'ledger/index.ts') {
        report(node, 'Ledger internals are private; import from the ledger directory.');
        return;
      }
      if (destination === 'features/branding' && owner !== destination && to === 'features/branding/colors.ts') {
        report(node, 'Branding color calculations are private; use branding/theme.');
        return;
      }
      if (destination === owner || dependencies[owner]?.includes(destination)) return;
      if (owner === 'features/database' && to === 'features/branding/theme.ts') return;
      if (testing && owner === 'app' && destination === 'test-support') return;
      report(node, `${owner} cannot import ${destination}; compose these modules in app.`);
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier))
        check(node, node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal))
        check(node, node.argument.literal.text);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression))
        check(node, node.moduleReference.expression.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) check(node, argument.text);
        else report(node, 'Use a literal module path so dependency boundaries can be checked.');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkBoundaries();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Source dependency boundaries pass.');
}
