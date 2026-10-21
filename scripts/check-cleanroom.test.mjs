import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkCleanroom, scanText } from './check-cleanroom.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(repo, 'scripts/check-cleanroom.mjs');

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'cleanroom-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}
const run = root => { try { execFileSync('node', [script, '--root', root], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
const rules = text => scanText(text).map(h => h.rule);

test('the repository passes: src/, engine specs, split docs and scrubbed rule tables', () => {
  const { hits, censusSkipped } = checkCleanroom(repo);
  assert.deepEqual(hits, [], hits.map(h => `${h.file}:${h.line} [${h.rule}] ${h.text}`).join('\n'));
  assert.equal(typeof censusSkipped, 'boolean');
});

test('a planted asm comment in src/ fails the CLI; removing it passes', () => {
  const planted = '// 0x59c6: movel %d6,%sp@-; moveb fp@(-2),d0; jsr 0xfeae\nexport const x = 1;\n';
  const root = tree({ 'src/tile.ts': planted });
  try {
    assert.equal(run(root), 1);
    const found = new Set(checkCleanroom(root).hits.map(h => h.rule));
    for (const r of ['register', 'frame', 'mnemonic']) assert(found.has(r), r);
    writeFileSync(join(root, 'src/tile.ts'), '// Tile the source cell from the far end for codes 11 and 14 (`0x59c8`).\nexport const x = 1;\n');
    assert.equal(run(root), 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('each forbidden form is detected', () => {
  assert.deepEqual(rules('push %a4'), ['register']);
  assert.deepEqual(rules('read sp@(4)'), ['frame']);
  assert.deepEqual(rules('the rect at a4@(1938)'), ['frame']);
  for (const m of ['jsr', 'bsr', 'moveq', 'movel', 'movew', 'lea', 'pea', 'link', 'unlk', 'bne', 'beq', 'bra', 'dbf', 'rts', 'bnes', 'JSR', 'MOVEQ', 'move.l', 'MOVE.W']) {
    assert.deepEqual(rules(`// then ${m} #1`), ['mnemonic'], m);
  }
  assert.deepEqual(rules('function tile0xfeae() {}'), ['hex-ident']);
  assert.deepEqual(rules('const scale_0x10320 = 1;'), ['hex-ident']);
});

test('ordinary code and prose are not hits', () => {
  for (const ok of [
    '/** See {@link loadTheme}. */',
    '<link rel="stylesheet" href="x.css">',
    'a deep-link boots the scheme',
    "const row = { source: '0xa032-0xa10e', mask: 0xfffe };",
    'const [s0, s1, d0] = span(p);',
    'color: #a0a0a0;',
    'Branch, lead and leapfrog are words; so are Link and Bra in titles.',
  ]) assert.deepEqual(rules(ok), [], ok);
  assert.deepEqual(scanText('the handle in a2').length, 0, 'bare registers are docs-only');
  assert.deepEqual(scanText('the handle in a2', { docs: true }).map(h => h.rule), ['register-bare']);
});

test('engine specs are linted, evidence appendices are not', () => {
  const root = tree({
    'src/index.ts': 'export {};\n',
    'docs/spec/engine/tile.md': 'The direction byte is 0 for codes 11/14.\n',
    'docs/spec/engine/tile.evidence.md': 'tstb fp@(20) at 0x10074; d5 = src width\n',
  });
  try {
    assert.equal(run(root), 0);
    writeFileSync(join(root, 'docs/spec/engine/tile.md'), 'The byte lives at fp@(20); width in d5.\n');
    assert.deepEqual(checkCleanroom(root).hits.map(h => h.rule), ['frame', 'register-bare']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('constant census: vacuous without src/engine, anchored by spec or tables otherwise', () => {
  const root = tree({ 'src/index.ts': 'export const n = 37;\n' });
  try {
    assert.equal(checkCleanroom(root).censusSkipped, true);
    assert.equal(run(root), 0, 'constants outside src/engine are not censused');
    writeFileSync(join(root, 'src/index.ts'), 'export {};\n');
    mkdirSync(join(root, 'src/engine/qd'), { recursive: true });
    writeFileSync(join(root, 'src/engine/qd/tile.ts'), '// 99 in a comment is ignored\nexport const step = (w: number) => w * 37 + 1;\nexport const label = "x 41";\n');
    let r = checkCleanroom(root);
    assert.equal(r.censusSkipped, false);
    assert.deepEqual(r.hits.map(h => [h.rule, h.text]), [['census', '37']]);
    assert.equal(run(root), 1);
    mkdirSync(join(root, 'docs/spec/engine'), { recursive: true });
    writeFileSync(join(root, 'docs/spec/engine/tile.evidence.md'), 'step 37\n');
    assert.equal(checkCleanroom(root).hits.length, 1, 'evidence never anchors a constant');
    writeFileSync(join(root, 'docs/spec/engine/tile.md'), 'Each tile advances by `0x25` pixels.\n');
    assert.equal(run(root), 0, 'spec anchors by value (0x25 === 37)');
    rmSync(join(root, 'docs/spec/engine/tile.md'));
    mkdirSync(join(root, 'src/engine/tables'), { recursive: true });
    writeFileSync(join(root, 'src/engine/tables/tile.ts'), "export const rows = [{ step: 37, source: '0x10146' }];\n");
    assert.equal(run(root), 0, 'tables anchor a constant');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
