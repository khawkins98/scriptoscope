// tools/theme-loader/convert.test.mjs
// Smoke + invariant gate for the in-memory decode pipeline (`loadKaleidoscopeScheme`).
//
// Pre-Option-A this file also held a "parity gate" that compared `convertScheme(fork)`
// against the on-disk `theme.json` + `icons/index.json` + PNG asset set. Option A retired
// those derivatives — the bundle ships only `scheme.sit` / `scheme.rsrc` now — so there is
// no on-disk reference to compare against. The decode IS now the source of truth, validated
// in-memory: a well-formed manifest, every asset ref + glyph rewritten to the mock URL,
// no bundle-relative path leaking past `rewriteAssetRefs`. Per prototype-mode cadence,
// the now-obsolete reproducibility test was deleted rather than rewritten against itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // tools/theme-loader → repo root
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Resolve the bundle's source bytes — `scheme.sit` if present, else `scheme.rsrc`.
 *  Mirrors `src/loadTheme.fetchFirst`'s try-order so the same surface is exercised. */
function readBundleBytes(dir) {
  for (const name of ['scheme.sit', 'scheme.rsrc']) {
    const p = resolve(dir, name);
    if (existsSync(p)) return { name, bytes: new Uint8Array(readFileSync(p)) };
  }
  throw new Error(`no scheme.sit or scheme.rsrc in ${dir}`);
}

// The browser loader (in-memory, drop-a-fork path) — with a mock encoder, since Node has
// no OffscreenCanvas. Proves it produces a render-ready LoadedTheme with EVERY asset ref
// + glyph resolved to a URL (no bundle-relative path survives), plus a populated inspector
// catalog (icons + cicns + ppats + resourceRoles) the demo's diagnostic panels read.
//
// Two slugs — platinum-8 (.sit only) + 1138 (.rsrc only) — cover both source paths.
for (const slug of ['platinum-8', '1138']) {
  test(`loadKaleidoscopeScheme yields a render-ready in-memory theme for ${slug}`, async () => {
    const dir = resolve(root, 'themes', slug);
    const meta = existsSync(resolve(dir, 'meta.json')) ? readJson(resolve(dir, 'meta.json')) : {};
    const { name, bytes } = readBundleBytes(dir);
    const loaded = await loadKaleidoscopeScheme(bytes, {
      meta, source: `${slug}/${name}`, encodeAssets: true,
      assetUrlFactory: (_rgba, _w, _h, path) => `mock://${path}`, // stand-in for the blob: URL
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

    // Inspector catalog — the data the demo's diagnostic panels read (Option A: no
    // pre-extracted resource-roles.json / rasters.json shipped). Cicns + ppats + icons
    // present; resource roles classified; every URL is the mock stand-in.
    const inspector = loaded.inspector;
    assert.ok(inspector, `${slug} has inspector`);
    assert.ok(inspector.iconIndex.length > 0, `${slug} iconIndex non-empty`);
    assert.ok(inspector.cicns.length > 0, `${slug} cicns non-empty`);
    assert.ok(inspector.resourceRoles.resources.length > 0, `${slug} resourceRoles populated`);
    for (const c of inspector.cicns) assert.match(c.url, /^mock:\/\/cicns\//, `${slug} cicn url`);
    for (const i of inspector.iconIndex) assert.match(i.url, /^mock:\/\/icons\//, `${slug} icon url`);
  });
}
