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
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';

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

// The browser loader (in-memory, drop-a-fork path) — with a mock encoder, since Node has
// no OffscreenCanvas. Proves it produces a render-ready LoadedTheme with EVERY asset ref
// + glyph resolved to a URL (no bundle-relative path survives).
for (const slug of ['platinum-8', '1138']) {
  test(`loadKaleidoscopeScheme yields a render-ready in-memory theme for ${slug}`, async () => {
    const dir = resolve(root, 'themes', slug);
    const meta = existsSync(resolve(dir, 'meta.json')) ? readJson(resolve(dir, 'meta.json')) : {};
    const fork = new Uint8Array(readFileSync(resolve(dir, 'scheme.rsrc')));
    const loaded = await loadKaleidoscopeScheme(fork, {
      meta, source: `${slug}/scheme.rsrc`, encodeAssets: true,
      assetUrlFactory: (rgba, w, h, path) => `mock://${path}`, // stand-in for the blob: URL
    });

    assert.equal(loaded.baseUrl, '', `${slug} in-memory baseUrl is empty`);
    assert.ok(loaded.manifest?.windowTypes, `${slug} has a manifest`);

    // No bundle-relative asset path may survive — chrome / sprites / frame / patterns /
    // bodyBackground must all be rewritten to mock:// URLs.
    const leftover = [];
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === 'object') for (const v of Object.values(n)) {
        if (typeof v === 'string') { if (/^(?:cicns|ppats|icons)\/.+\.png$/.test(v)) leftover.push(v); }
        else walk(v);
      }
    })(loaded.manifest);
    assert.deepEqual(leftover, [], `${slug} has unresolved asset paths`);

    // Glyph map present + every glyph resolved (both schemes ship pictograms).
    assert.ok(loaded.glyphs && Object.keys(loaded.glyphs).length > 0, `${slug} has glyphs`);
    for (const url of Object.values(loaded.glyphs)) assert.match(url, /^mock:\/\/icons\//, `${slug} glyph url`);
  });
}
