import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkCleanroom, scanText, commentsOf, RULE_TABLES, targets } from './check-cleanroom.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(repo, 'scripts/check-cleanroom.mjs');

function tree(files, { parent = tmpdir(), prefix = 'cleanroom-' } = {}) {
  const root = mkdtempSync(join(parent, prefix));
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

test('brief-scope catches bare directories, unbackticked paths and link targets', () => {
  const briefOf = list => `# Brief\n\n## Allowed paths\n\n${list}\n\n## What your code must pass\n`;
  const root = tree({
    'src/index.ts': 'export {};\n',
    'package.json': '{}\n',
    'LEARNINGS.md': 'notes\n',
    'tests/a.test.mjs': 'export {};\n',
    'docs/spec/engine/tile.md': 'ok\n',
    'docs/spec/engine/tile.evidence.md': 'evidence\n',
    'docs/spec/notes.md': 'notes\n',
    'docs/spec/engine/IMPLEMENTER-BRIEF.md': '',
  });
  const hits = list => {
    writeFileSync(join(root, 'docs/spec/engine/IMPLEMENTER-BRIEF.md'), briefOf(list));
    return checkCleanroom(root).hits.filter(h => h.rule === 'brief-scope').map(h => h.text);
  };
  try {
    const ok = '- `docs/spec/engine/*.md` except `*.evidence.md`; start with [tile.md](tile.md).\n- Code: `src/` and `package.json`.\n- Apple headers (`Traps.h`, `Quickdraw.h`), Inside Macintosh, and/or prose.\n- Enforced by `scripts/check-cleanroom.mjs`.';
    assert.deepEqual(hits(ok), []);
    assert.deepEqual(hits(ok + '\n- `tests`'), ['tests'], 'bare top-level directory, backticked');
    assert.deepEqual(hits(ok + '\n- the harness under `tests/`'), ['tests'], 'directory with a trailing slash');
    assert.deepEqual(hits(ok + '\n- also tests/a.test.mjs when asked'), ['tests/a.test.mjs'], 'unbackticked path');
    assert.deepEqual(hits(ok + '\n- read LEARNINGS.md first'), ['LEARNINGS.md'], 'unbackticked top-level file');
    assert.deepEqual(hits(ok + '\n- see [the notes](../notes.md)'), ['docs/spec/notes.md'], 'link target relative to the brief');
    assert.deepEqual(hits(ok + '\n- see [the notes](notes.md)'), ['docs/spec/notes.md'], 'link target resolved via docs/spec');
    assert.deepEqual(hits(ok + '\n- `docs/spec/engine/*.md`, including `docs/spec/engine/`'), ['docs/spec/engine'], 'a directory holding evidence is not in scope');
    assert.deepEqual(hits(ok + '\n- `docs/spec/*.md`'), ['docs/spec/*.md'], 'a glob matching an unscanned file');
    assert.deepEqual(hits(ok + '\n- anything under tests/ or scripts/'), ['tests'], 'unbackticked directory with a trailing slash (scripts/ does not exist yet, so it opens nothing)');
    mkdirSync(join(root, 'scripts'), { recursive: true }); writeFileSync(join(root, 'scripts/x.mjs'), 'export {};\n');
    assert.deepEqual(hits(ok + '\n- anything under tests/ or scripts/'), ['tests', 'scripts']);
    assert.deepEqual(hits(ok + '\n- the [repo](../../../) itself'), ['. (the whole repository)'], 'a link to the repo root');
    assert.deepEqual(hits(ok + '\n- [up](../../../../elsewhere.md)'), ['../../../../elsewhere.md'], 'a path outside the repo');
    for (const forbidden of ['`.scratch/k231-kdef/kDEF/k231-kdef0.asm`', '.scratch/k231-kdef/', '`/Users/me/Documents/Scriptoscope-maintainer-assets/`', '~/Documents/Scriptoscope-maintainer-assets/x', '`docs/spec/*.evidence.md`', '`docs/spec/engine/missing.evidence.md`', '`*.asm`', '`campaign/v2-lanes/L2/`', '`/Users/me/notes/x.md`', '~/notes/y', '/opt/thing/z', '[listing](https://git-home.allaboutken.com/khawkins98/scriptoscope-assets)', '`ssh://git@example.org/store.git`', 'https://example.org/apple-docs']) {
      const found = hits(`${ok}\n- also ${forbidden}`);
      assert.equal(found.length, 1, `${forbidden}: ${JSON.stringify(found)}`);
    }
    writeFileSync(join(root, 'docs/spec/engine/IMPLEMENTER-BRIEF.md'), briefOf(`${ok}\n- the listing .scratch/notes`) + '\nOutside the section, naming .scratch and *.asm as forbidden is fine.\n');
    assert.deepEqual(checkCleanroom(root).hits.map(h => [h.rule, h.line]).filter(([r]) => r === 'listing-path'), [['listing-path', 9]], 'listing-path applies inside Allowed paths only');
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

test('checkout names and parents do not change spec scanning or constant anchors', () => {
  const files = {
    'src/engine/family.ts': 'export const step = 37;\nexport const mask = 43;\nexport const limit = 41;\n',
    'src/engine/tables/cited.json': '{ "limit": 41 }\n',
    'docs/spec/engine/family.md': 'The step is 37.\n',
    'docs/spec/engine/contaminated.md': 'jsr elsewhere\n',
    'docs/spec/engine/family.review.md': 'The mask is 43.\n',
  };
  const parent = tree({}, { prefix: 'review-' });
  const roots = [tree(files), tree(files, { prefix: 'verifier-' }), tree(files, { parent })];
  try {
    const expected = checkCleanroom(roots[0]);
    assert.deepEqual(expected.hits.map(h => [h.rule, h.text]), [['mnemonic', 'jsr'], ['census', '43']]);
    const paths = root => targets(root).map(f => relative(root, f)).sort();
    const expectedPaths = paths(roots[0]);
    for (const root of roots) {
      assert.deepEqual(checkCleanroom(root), expected, root);
      assert.deepEqual(paths(root), expectedPaths, root);
      assert.equal(run(root), 1, root);
      rmSync(join(root, 'docs/spec/engine/contaminated.md'));
      writeFileSync(join(root, 'src/engine/family.ts'), 'export const step = 37;\n');
      assert.equal(run(root), 0, 'legitimate specs still anchor constants: ' + root);
    }
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    rmSync(parent, { recursive: true, force: true });
  }
});

test('recognized review artifacts cannot anchor constants in specs or tables', () => {
  const artifacts = [
    'docs/spec/engine/family.review.md',
    'docs/spec/engine/family-verifier.md',
    'docs/spec/engine/reviews/family.md',
    'docs/spec/engine/verifier/family.md',
    'src/engine/tables/family.review.json',
    'src/engine/tables/family-verifier.json',
    'src/engine/tables/reviews/family.json',
    'src/engine/tables/verifier/family.json',
    'src/engine/tables/nested/family.REVIEW.ts',
  ];
  for (const artifact of artifacts) {
    const root = tree({
      'src/engine/family.ts': 'export const step = 37;\n',
      [artifact]: artifact.endsWith('.json') ? '{ "step": 37 }\n' : '37\n',
    });
    try {
      assert.deepEqual(checkCleanroom(root).hits, [
        { file: 'src/engine/family.ts', rule: 'census', line: 1, text: '37' },
      ], artifact);
      if (artifact.startsWith('src/')) {
        assert(targets(root).includes(join(root, artifact)), 'code-tree review data remains scanned');
        writeFileSync(join(root, artifact), 'jsr elsewhere\n37\n');
        assert(checkCleanroom(root).hits.some(h => h.file === artifact && h.rule === 'mnemonic'), 'review exclusion does not bypass contamination scanning');
      }
      mkdirSync(join(root, 'src/engine/tables'), { recursive: true });
      writeFileSync(join(root, 'src/engine/tables/cited.json'), '{ "step": 37, "source": "behaviour spec" }\n');
      assert(!checkCleanroom(root).hits.some(h => h.rule === 'census'), 'legitimate tables still anchor constants');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('linted independent rules and tests are never an allowed read scope', () => {
  const brief = 'docs/spec/engine/IMPLEMENTER-BRIEF.md';
  const root = tree(Object.fromEntries(RULE_TABLES.map(f => [f, 'export {};\n'])));
  mkdirSync(dirname(join(root, brief)), { recursive: true });
  const hits = path => {
    writeFileSync(join(root, brief), `## Allowed paths\n- ${path}\n`);
    return checkCleanroom(root).hits.filter(h => h.rule === 'brief-scope');
  };
  try {
    for (const path of RULE_TABLES) {
      assert(targets(root).includes(join(root, path)), 'oracle remains linted');
      assert.equal(hits('`' + path + '`').length, 1, path);
    }
    for (const path of ['tests/rendering-options/*-rules.mjs', 'tests/rendering-options/*.mjs',
      'tests/rendering-options/', 'tests/rendering-options/range-rules.spec.mjs',
      'src/engine/family-rules.test.mjs', 'tests/new-family.spec.mjs']) {
      assert.equal(hits('`' + path + '`').length, 1, path);
    }
    writeFileSync(join(root, RULE_TABLES[0]), '// jsr elsewhere\n');
    assert(checkCleanroom(root).hits.some(h => h.rule === 'mnemonic'), 'independent rules still linted');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('review files are forbidden under spec and code trees and never anchor constants', () => {
  const brief = 'docs/spec/engine/IMPLEMENTER-BRIEF.md';
  const root = tree({
    [brief]: '## Allowed paths\n- `docs/spec/engine/*.md` except `*.evidence.md`, `*.review.md` and `*-review.md`.\n- `src/`\n',
    'src/engine/family.ts': 'export const step = 37;\n',
    'src/engine/family.test.mjs': 'export {};\n',
    'docs/spec/engine/family.md': 'Behaviour only.\n',
    'docs/spec/engine/family.review.md': 'step 37; jsr private\n',
    'docs/spec/engine/family-review.md': 'step 37; jsr private\n',
  });
  try {
    const result = checkCleanroom(root);
    assert.deepEqual(result.hits.map(h => h.rule), ['census']);
    assert(!targets(root).some(f => /[.-]review\.md$/.test(f)));
    for (const path of ['docs/spec/engine/family.review.md', 'docs/spec/engine/family-review.json',
      'docs/spec/engine/reviews/family.md', 'src/engine/verifier/family.json',
      'src/engine/family.verifier.json']) {
      writeFileSync(join(root, brief), `## Allowed paths\n- \`${path}\`\n`);
      assert.equal(checkCleanroom(root).hits.filter(h => h.rule === 'brief-scope').length, 1, path);
    }
    writeFileSync(join(root, brief), '## Allowed paths\n- `src/engine/family.test.mjs`\n');
    assert(!checkCleanroom(root).hits.some(h => h.rule === 'brief-scope'), 'implementation unit test remains allowed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
