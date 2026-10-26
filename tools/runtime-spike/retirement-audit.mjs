// Current production source only. This is a caller inventory, never a dead-code proof.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  return entry.isDirectory() ? walk(path)
    : /\.ts$/.test(path) && !/\.(?:test|spec|d)\.ts$/.test(path) ? [path] : [];
});
const paths = walk('src').sort();
const sources = paths.map(path => ts.createSourceFile(path, readFileSync(path, 'utf8'),
  ts.ScriptTarget.Latest, true));
const hash = createHash('sha256');
const groups = {};
for (const source of sources) {
  hash.update(source.fileName).update('\0').update(source.text).update('\0');
  const group = source.fileName.includes('/tables/') ? 'tables'
    : source.fileName.includes('/declarative/') ? 'declarative'
    : source.fileName.includes('/engine/') ? 'engineLogic' : 'otherLogic';
  groups[group] = (groups[group] ?? 0) + source.text.split('\n').length - Number(source.text.endsWith('\n'));
}
const names = ['buildToggle', 'interactiveCheckbox', 'interactiveRadio', 'radioGroup',
  'interactiveDisclosure', 'interactiveSlider', 'interactiveScrollbar', 'buildDraggable',
  'interactiveNativeSlider', 'syncRadioGroup', 'promoteThemePicker', 'createPickerIconLoader'];
const symbols = Object.fromEntries(names.map(name => [name, { declarations: [], references: [] }]));
for (const source of sources) {
  const visit = node => {
    if (ts.isIdentifier(node) && Object.hasOwn(symbols, node.text)) {
      const row = { file: source.fileName, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 };
      const parent = node.parent;
      if (ts.isFunctionDeclaration(parent) && parent.name === node) {
        const start = source.getLineAndCharacterOfPosition(parent.getStart(source)).line;
        const end = source.getLineAndCharacterOfPosition(parent.end).line;
        symbols[node.text].declarations.push({ ...row, lines: end - start + 1 });
      } else {
        const role = ts.isImportSpecifier(parent) ? 'import'
          : ts.isExportSpecifier(parent) ? 'export'
          : ts.isCallExpression(parent) && parent.expression === node ? 'call' : 'other';
        symbols[node.text].references.push({ ...row, role });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(JSON.stringify({ scope: 'current non-test src TypeScript; excludes tools and external consumers',
  limitation: 'Syntactic identifier inventory; no alias/dataflow/dynamic-call resolution. Public exports remain live roots.',
  sourceSha256: hash.digest('hex'), physicalLines: groups, symbols }, null, 2));
