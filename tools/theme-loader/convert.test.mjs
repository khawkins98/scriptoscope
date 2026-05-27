// tools/theme-loader/convert.test.mjs
// Parity gate for the portable conversion core: convertScheme(fork) must reproduce the
// committed on-disk bundle — the same theme.json, the same icons/index.json, and exactly
// the asset set the bundle ships — for both a native-recipe scheme (1138) and a
// corner-sprite one (platinum-8). This is what guarantees the browser drop path (which
// calls convertScheme over a Blob) yields the same theme the Node pipeline writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertScheme } from './convert.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // tools/theme-loader → repo root
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pngs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : []);

for (const slug of ['1138', 'platinum-8']) {
  test(`convertScheme reproduces the ${slug} bundle (theme + icon index + asset set)`, () => {
    const dir = resolve(root, 'themes', slug);
    const meta = existsSync(resolve(dir, 'meta.json')) ? readJson(resolve(dir, 'meta.json')) : {};
    const fork = new Uint8Array(readFileSync(resolve(dir, 'scheme.rsrc')));

    const { theme, assets, iconIndex } = convertScheme(fork, { meta, source: `${slug}/scheme.rsrc` });

    // theme.json + icons/index.json reproduced exactly.
    assert.deepEqual(theme, readJson(resolve(dir, 'theme.json')), `${slug} theme.json`);
    assert.deepEqual(iconIndex, readJson(resolve(dir, 'icons', 'index.json')), `${slug} icons/index.json`);

    // The decoded asset set matches every PNG the bundle ships (cicns + ppats + icons).
    const onDisk = [
      ...pngs(resolve(dir, 'cicns')).map((f) => `cicns/${f}`),
      ...pngs(resolve(dir, 'ppats')).map((f) => `ppats/${f}`),
      ...pngs(resolve(dir, 'icons')).map((f) => `icons/${f}`),
    ].sort();
    assert.deepEqual(assets.map((a) => a.path).sort(), onDisk, `${slug} asset paths`);

    // Every asset is a well-formed RGBA buffer of width*height*4.
    for (const a of assets) assert.equal(a.rgba.length, a.width * a.height * 4, `${a.path} rgba size`);
  });
}
