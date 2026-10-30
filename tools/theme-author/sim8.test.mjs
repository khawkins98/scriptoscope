// 8-bit simulation, palette report, title/label contrast checks and the contact sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { simulate8bit, systemEntryFor, nearestSystemIndex } from './sim8.js';
import { SYSTEM_PALETTE_256 } from './encode-icons.js';
import { paletteReport, contrastRatio, flattenPalette, formatPaletteReport } from './palette-report.js';
import { checkScheme, titleContrast } from './check-scheme.js';
import { contactSheet } from './contact-sheet.js';
import { encodeCicn } from './encode-cicn.js';
import { encodeWnd, encodeCinf } from './encode-records.js';
import { encodePpat } from './encode-ppat.js';
import { Raster } from './raster.js';
import { windowLayout } from './window-layout.js';
import { macRgbToSrgb } from '../theme-loader/mac-gamma.js';
import { parseResourceFork } from '../theme-loader/resource-fork.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ── sim8 ──

test('sim8: every system-palette entry maps to itself (stored and on-screen)', () => {
  const n = SYSTEM_PALETTE_256.length;
  const stored = new Uint8Array(n * 4), shown = new Uint8Array(n * 4);
  SYSTEM_PALETTE_256.forEach((c, i) => {
    stored.set([...c, 255], i * 4);
    shown.set([...macRgbToSrgb(c), 255], i * 4);
  });
  assert.deepEqual(simulate8bit({ width: n, height: 1, rgba: stored }, { gamma: false }).rgba, stored);
  // On-screen input goes through srgbToStored (±1) and back; still a fixed point.
  assert.deepEqual(simulate8bit({ width: n, height: 1, rgba: shown }).rgba, shown);
  SYSTEM_PALETTE_256.forEach((c, i) => assert.equal(SYSTEM_PALETTE_256[nearestSystemIndex(c)].join(), c.join(), `entry ${i}`));
});

test('sim8: deterministic, keeps alpha, accepts a Raster, counts colours', () => {
  const r = new Raster(4, 2).fillRect(0, 0, 2, 2, '#a59e91').fillRect(2, 0, 1, 2, '#9b2630');
  const a = simulate8bit(r), b = simulate8bit(r);
  assert.deepEqual(a.rgba, b.rgba);
  assert.equal(a.rgba[3 * 4 + 3], 0, 'transparent pixel stays transparent');
  assert.equal(a.colorsBefore, 2);
  assert.ok(a.colorsAfter <= 2);
  assert.throws(() => simulate8bit({ width: 2, height: 2, rgba: new Uint8Array(4) }), /width × height × 4/);
});

test('sim8: known off-palette colours land on their documented entries', () => {
  // Halcyon's first accent (design review §1.1). In stored values the 4-bit
  // inverse-table cell is (0x11, 0x77, 0x99), whose nearest entry is #006699;
  // the web shows that entry as #0078a8 (Halcyon's palette now uses it).
  const accent = systemEntryFor('#1689a8');
  assert.deepEqual(accent.stored, [13, 119, 153]);
  assert.deepEqual(accent.entry, [0, 102, 153]);
  assert.equal(accent.display, '#0078a8');
  // The same bytes read as stored values snap to #009999 (what the prototype,
  // which skipped the gamma step, reported).
  assert.deepEqual(systemEntryFor([0x16, 0x89, 0xa8], { gamma: false }).entry, [0, 153, 153]);
  // Castle's first warm stone: a warm grey goes to a plain grey.
  assert.equal(systemEntryFor('#a59e91', { output: 'stored' }).display, '#888888');
  // The capture output uses the committed Basilisk II levels (51 → 84, 153 → 179).
  assert.equal(systemEntryFor([51, 153, 255], { gamma: false, output: 'capture' }).display, '#54b3ff');
});

test('sim8: the inverse-table model differs from exact nearest near cell edges', () => {
  // Stored grey 0x2f: its 4-bit cell is 0x22 (a grey-ramp entry), while the
  // exact nearest entry is the cube's 0x33.
  assert.equal(SYSTEM_PALETTE_256[nearestSystemIndex([0x2f, 0x2f, 0x2f])].join(), '34,34,34');
  assert.equal(SYSTEM_PALETTE_256[nearestSystemIndex([0x2f, 0x2f, 0x2f], { itabRes: 0 })].join(), '51,51,51');
});

// ── palette report ──

test('palette report: contrast, flattening, collapses and floors', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  assert.deepEqual(flattenPalette({ a: '#fff', ramp: ['#000', '#111111'], nest: { b: [1, 2, 3] }, n: 7 }),
    [['a', '#ffffff'], ['ramp[0]', '#000000'], ['ramp[1]', '#111111'], ['nest.b', '#010203']]);
  const rep = paletteReport({ stone: ['#a59e91', '#9d968a'], ink: '#000000', ink2: '#000000' }, {
    pairs: [['#f7e7b6', '#8a1d26', 'active title'], ['#9aa1ab', '#f6f7f9', 'inactive title'], ['#000', '#fff', 'x', 30]],
  });
  assert.deepEqual(rep.collapses.map((c) => c.names), [['stone[0]', 'stone[1]']], 'identical colours are not a collapse');
  assert.deepEqual(rep.contrast.map((p) => [p.floor, p.pass]), [[4.5, true], [3, false], [30, false]]);
  const text = formatPaletteReport(rep).join('\n');
  assert.match(text, /stone\[0\].*COLLAPSE/);
  assert.match(text, /✗ inactive title: 2\.\d+:1/);
});

// ── title and label contrast checks ──

// A titled window whose bar is `bar` and whose title swatch is `title`.
function titledScheme(bar, title) {
  const l = windowLayout({ titleBar: 20, leftFixed: 20, rightFixed: 20, bottom: 4 });
  const content = l.wnd.rectangles.find((x) => x.part === 0).rect;
  const img = () => encodeCicn(new Raster(l.width, l.height).fillRect(0, 0, l.width, l.height, bar)
    .fillRect(1, content.top, l.width - 2, 1, null).swatch(content.left, content.top, title));
  return [
    { type: 'wnd#', id: -14336, data: encodeWnd(l.wnd) },
    { type: 'cicn', id: -14336, data: img() },
    { type: 'cicn', id: -14335, data: img() },
  ];
}

test('check: title text that nearly matches its bar warns; readable titles do not', () => {
  const faint = checkScheme(titledScheme('#888888', '#909090'));
  assert.ok(faint.warnings.some((w) => /active title text .* below 2:1/.test(w)), faint.warnings.join('\n'));
  assert.ok(faint.warnings.some((w) => /inactive title text .* below 1\.4:1/.test(w)));
  const good = checkScheme(titledScheme('#dddddd', '#000000'));
  assert.ok(!good.warnings.some((w) => /title text/.test(w)), good.warnings.join('\n'));
  assert.ok(good.summary.some((s) => /document-window: title text #000000 active .*:1 on the bar/.test(s)));
  const [t] = titleContrast(titledScheme('#dddddd', '#000000'));
  assert.equal(t.bar, '#dddddd');
  assert.ok(t.ratio > 14);
});

test('check: a push label that nearly matches its face warns', () => {
  const push = (label) => {
    const face = new Raster(12, 12).fillRect(0, 0, 12, 12, '#cccccc').fillRect(5, 5, 1, 1, label);
    const cinf = encodeCinf({ cornerSize: 3, bgPixel: { x: 2, y: 2 }, textPixel: { x: 5, y: 5 }, embossPixel: { x: 2, y: 2 } });
    return [-10239, -10238].flatMap((id) => [{ type: 'cicn', id, data: encodeCicn(face) }, { type: 'cinf', id, data: cinf }]);
  };
  assert.ok(checkScheme(push('#c4c4c4')).warnings.some((w) => /label .* below 2:1/.test(w)));
  assert.ok(!checkScheme(push('#000000')).warnings.some((w) => /label/.test(w)));
});

// ── contact sheet ──

function tinyScheme() {
  return [
    ...titledScheme('#dddddd', '#000000'),
    { type: 'cicn', id: -10239, data: encodeCicn(new Raster(10, 8).fillRect(0, 0, 10, 8, '#a59e91')) },
    { type: 'ppat', id: 17, data: encodePpat(new Raster(8, 8).fillRect(0, 0, 8, 8, '#336699')) },
  ];
}

test('contact sheet: lays out every cicn and ppat, optional 8 bpp panel', () => {
  const one = contactSheet(tinyScheme());
  assert.equal(one.count, 4);
  assert.equal(one.rgba.length, one.width * one.height * 4);
  // The 43-px frame at 4× (172) is the widest item, plus padding.
  assert.ok(one.width >= 172 && one.height >= 2 * 25 * 4);
  const two = contactSheet(tinyScheme(), { sim8: true });
  assert.equal(two.width, 2 * one.width + 10);
  assert.equal(two.height, one.height);
});

test('npm run author -- <dir> --sheet writes sheet.png of the expected size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
  try {
    // A one-window scheme, built with absolute imports so it can live in a temp dir.
    const url = (f) => JSON.stringify(pathToFileURL(resolve(ROOT, 'tools/theme-author', f)).href);
    writeFileSync(join(dir, 'scheme.mjs'), [
      `import { Raster } from ${url('raster.js')};`,
      `import { encodeCicn } from ${url('encode-cicn.js')};`,
      `import { encodeWnd } from ${url('encode-records.js')};`,
      `import { encodePpat } from ${url('encode-ppat.js')};`,
      `import { windowLayout } from ${url('window-layout.js')};`,
      'export function buildScheme() {',
      '  const l = windowLayout({ titleBar: 20, leftFixed: 20, rightFixed: 20, bottom: 4 });',
      "  const img = () => encodeCicn(new Raster(l.width, l.height).fillRect(0, 0, l.width, l.height, '#dddddd').fillRect(1, 20, l.width - 2, 1, null).swatch(1, 20, '#000000'));",
      '  return { resources: [',
      "    { type: 'wnd#', id: -14336, data: encodeWnd(l.wnd) }, { type: 'cicn', id: -14336, data: img() }, { type: 'cicn', id: -14335, data: img() },",
      "    { type: 'ppat', id: 17, data: encodePpat(new Raster(8, 8).fillRect(0, 0, 8, 8, '#336699')) },",
      '  ] };',
      '}',
    ].join('\n'));
    const run = spawnSync(process.execPath, [resolve(ROOT, 'scripts/author-scheme.mjs'), dir, '--sheet'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const png = readFileSync(join(dir, 'sheet.png'));
    // Same layout as contactSheet on the fixture's resources (3 images, two panels).
    const resources = parseResourceFork(new Uint8Array(readFileSync(join(dir, 'scheme.rsrc'))));
    const expected = contactSheet(resources, { sim8: true });
    assert.equal(expected.count, 3);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [expected.width, expected.height]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
