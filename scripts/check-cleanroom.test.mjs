import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkCleanroom, scanText, commentsOf } from './check-cleanroom.mjs';

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
const rules = (text, kind = 'code') => scanText(text, { kind }).map(h => h.rule);
const doc = text => rules(text, 'docs');

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
  assert.deepEqual(rules('push %D3'), ['register']);
  assert.deepEqual(rules('read sp@(4)'), ['frame']);
  assert.deepEqual(rules('the rect at a4@(1938)'), ['frame']);
  for (const m of ['jsr', 'bsr', 'moveq', 'movel', 'movew', 'unlk', 'bne', 'beq', 'dbf', 'rts', 'bnes', 'JSR', 'MOVEQ', 'move.l', 'MOVE.W',
    'cmpib', 'cmpiw', 'tstw', 'tstb', 'addql', 'subqw', 'clrb', 'extl', 'andiw', 'lsrw', 'asrl', 'divsw', 'mulsw', 'negl', 'CMPIB', 'tst.b', 'cmp.w', 'jmp', 'movem']) {
    assert.deepEqual(rules(`// then ${m} #1`), ['mnemonic'], m);
  }
  for (const m of ['lea a4@(2788)', 'pea %fp@(-136)', 'link a6,#-4', 'bra 0x264', 'add #1,d0', 'cmp d0,d1']) assert(rules(`// ${m}`).includes('mnemonic'), m);
  assert.deepEqual(rules('function tile0xfeae() {}'), ['hex-ident']);
  assert.deepEqual(rules('const scale_0x10320 = 1;'), ['hex-ident']);
  for (const g of ['FUN_00004a64', 'sVar5', 'uVar2', 'param_5', 'local_1c', 'auStack_24']) assert.deepEqual(rules(`const x = 1; // ${g}`), ['ghidra'], g);
  for (const l of ['.scratch/k231-kdef/kDEF/k231-kdef0.asm', '/tmp/kaleido-trace/x.c', 'run objdump -D']) assert(rules(`// see ${l}`).includes('listing-path'), l);
  assert.deepEqual(doc('  4f18:\ta888           \t.short 0xa888'), ['listing-line']);
});

test('register narrative is caught in docs and in code comments, not in code proper', () => {
  for (const s of ['the handle in a2', 'held in D3 and A2', 'read -(sp) then (a2)+']) {
    assert(doc(s).length > 0, s);
    assert(rules(`// ${s}`).length > 0, `comment: ${s}`);
    assert(rules(`/* ${s} */`).length > 0, `block comment: ${s}`);
  }
  assert.deepEqual(rules('const [s0, s1, d0] = span(p); if (a0) f(a1);'), []);
  assert.deepEqual(rules("const s = '// the handle in a2';"), [], 'strings are not comments');
  assert.deepEqual(rules('const r = /\\/\\/ a2/; const d0 = 1;'), [], 'regex literals are not comments');
  assert.equal(commentsOf('x = 1; // c\ny').split('\n').length, 2);
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
    '// see the link below; or #ffffff; roll the window up; add more and swap',
    '// magic 0x00051600 or 0x00051607 at offset 0',
    'const empty80x20 = 1; const full160x80 = 2;',
    'const big = 0x10n;',
    "const FIXTURE = resolve(root, '.scratch', 'system7nostalgiasilver.sit');",
  ]) assert.deepEqual(rules(ok), [], ok);
  for (const ok of ['`decode:` (cite the `0xADDR`)', 'the palette lookup chooses gray0x2121', 'see the link below', 'local-D0 RGB(235,228,207)'])
    assert.deepEqual(doc(ok), [], ok);
});

test('the brief may only allow paths the linter scans', () => {
  const briefOf = list => `# Brief\n\n## Allowed paths\n\n${list}\n\n## What your code must pass\n`;
  const root = tree({
    'src/index.ts': 'export {};\n',
    'LEARNINGS.md': 'jsr somewhere\n',
    'docs/spec/engine/IMPLEMENTER-BRIEF.md': briefOf('- `docs/spec/engine/*.md`, `src/`'),
  });
  try {
    assert.equal(run(root), 0);
    writeFileSync(join(root, 'docs/spec/engine/IMPLEMENTER-BRIEF.md'), briefOf('- `docs/spec/engine/*.md`, `src/`, `LEARNINGS.md`'));
    assert.deepEqual(checkCleanroom(root).hits.map(h => [h.rule, h.text]), [['brief-scope', 'LEARNINGS.md']]);
  } finally { rmSync(root, { recursive: true, force: true }); }
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
