// Dialog and alert content colour (procedural-frame §3.6): scheme `dctb`/`actb`
// -14336 entry 0, else Kaleidoscope's own grey; other window kinds have none.
import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadOwnedKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';
const { dialogContentColour } = await import('./dialogContent.ts');
const { themeView } = await import('./ownedTheme.ts');

const theme = (colorTables, base) => themeView({ manifest: {}, inspector: { colorTables }, ...(base ? { base } : {}) });
const table = (rgb16) => ({ entries: [{ value: 0, rgb16, rgb: rgb16.map(v => v >> 8) }, { value: 1, rgb16: [0, 0, 0], rgb: [0, 0, 0] }] });

test('document and utility kinds have no dialog content colour', () => {
  for (const slug of ['document-window', 'no-title-utility-window', 'titled-utility-window', 'popup-window'])
    assert.equal(dialogContentColour(theme({}), slug), null, slug);
});

test('dialog kinds read dctb -14336, alert kinds actb -14336, entry 0 by value', () => {
  const t = theme({ 'dctb:-14336': table([0x3333, 0x6666, 0x6666]), 'actb:-14336': table([0xffff, 0xffff, 0xdede]) });
  for (const slug of ['dialog', 'movable-modal']) {
    const c = dialogContentColour(t, slug);
    assert.deepEqual([c.table, c.from, c.rgb16], ['dctb', 'scheme', [0x3333, 0x6666, 0x6666]], slug);
  }
  for (const slug of ['alert', 'movable-alert']) assert.deepEqual(dialogContentColour(t, slug).rgb16, [0xffff, 0xffff, 0xdede], slug);
  assert.deepEqual(dialogContentColour(t, 'dialog').text, [0, 0, 0], 'no entry 2: Kaleidoscope black');
});

test('the text colour is entry 2 of the same table (1984: white on dark blue)', () => {
  const dark = { entries: [
    { value: 0, rgb16: [0x3333, 0x6666, 0x6666], rgb: [0x33, 0x66, 0x66] },
    { value: 1, rgb16: [1, 1, 1], rgb: [0, 0, 0] },
    { value: 2, rgb16: [0xffff, 0xffff, 0xffff], rgb: [255, 255, 255] },
  ] };
  assert.deepEqual(dialogContentColour(theme({ 'dctb:-14336': dark }), 'movable-modal').text, [255, 255, 255]);
});

test('a scheme without the table falls back to a base, then to Kaleidoscope\'s own grey', () => {
  const base = { manifest: {}, inspector: { colorTables: { 'dctb:-14336': table([0xbdef, 0xbdef, 0xbdef]) } } };
  assert.equal(dialogContentColour(theme({}, base), 'dialog').from, 'scheme');
  const dialog = dialogContentColour(theme({}), 'dialog');
  assert.deepEqual([dialog.from, dialog.rgb16], ['kaleidoscope', [0xdddd, 0xdddd, 0xdddd]]);
  assert.deepEqual(dialog.rgb, [0xe3, 0xe3, 0xe3], 'Mac 1.8 to sRGB 2.2 display policy');
  assert.deepEqual(dialogContentColour(theme({}), 'alert').rgb16, [0xddde, 0xddde, 0xddde]);
});

test('corpus: the loader exposes dctb -14336 (apple-platinum-2 ships #DDDD, 1984 dark blue; windows-95 none)', async () => {
  const load = async (slug) => themeView(await loadOwnedKaleidoscopeScheme(readFileSync(new URL(`../themes/${slug}/scheme.sit`, import.meta.url))));
  const platinum = dialogContentColour(await load('apple-platinum-2'), 'dialog');
  assert.deepEqual([platinum.from, platinum.rgb16, platinum.text], ['scheme', [0xdddd, 0xdddd, 0xdddd], [0, 0, 0]]);
  const n1984 = dialogContentColour(await load('1984'), 'alert');
  assert.deepEqual([n1984.rgb16, n1984.text], [[0x3333, 0x6666, 0x6666], [255, 255, 255]]);
  assert.equal(dialogContentColour(await load('windows-95'), 'alert').from, 'kaleidoscope');
});
