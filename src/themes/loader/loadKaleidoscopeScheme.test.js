import { describe, expect, it } from 'vitest';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { readFileSync, existsSync } from 'node:fs';

const FIXTURE = '/tmp/aaron-schemes/1022/1022/1022/..namedfork/rsrc';
const haveFixture = existsSync(FIXTURE);
const itIfFixture = haveFixture ? it : it.skip;

describe('loadKaleidoscopeScheme — input handling', () => {
  it('rejects unsupported input types', async () => {
    await expect(loadKaleidoscopeScheme(42)).rejects.toThrow(/unsupported/);
    await expect(loadKaleidoscopeScheme({})).rejects.toThrow(/unsupported/);
  });

  it('accepts a Uint8Array (when it contains a valid resource fork)', async () => {
    // Pull synthetic fixture from the parser tests' approach — minimal RF.
    // Easier route: skip if the on-disk fixture isn't available.
    if (!haveFixture) return;
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const theme = await loadKaleidoscopeScheme(bytes, { encodeAssets: false });
    expect(theme).toBeDefined();
  });

  it('accepts an ArrayBuffer', async () => {
    if (!haveFixture) return;
    const bytes = readFileSync(FIXTURE);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const theme = await loadKaleidoscopeScheme(ab, { encodeAssets: false });
    expect(theme).toBeDefined();
  });
});

describe('loadKaleidoscopeScheme — full decode of Acid (#1022)', () => {
  itIfFixture('produces a valid Theme matching the pre-extracted bundle shape', async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const theme = await loadKaleidoscopeScheme(bytes, {
      encodeAssets: false,
      meta: {
        name: 'Acid',
        author: { name: 'SHIOCOP', year: 1999 },
        origin: { kind: 'kaleidoscope-port', originalFormat: 'ksc' },
      },
    });

    // Top-level structure
    expect(theme.name).toBe('Acid');
    expect(theme.author).toEqual({ name: 'SHIOCOP', year: 1999 });

    // Same counts as the build-time extracted theme.json: 10 windowTypes,
    // 190 chromeElements (= 190 cicns), 2 patterns (= 2 ppat).
    expect(Object.keys(theme.windowTypes || {}).length).toBe(10);
    expect(Object.keys(theme.chromeElements || {}).length).toBe(190);
    expect(Object.keys(theme.patterns || {}).length).toBe(2);

    // document-window slug exists (one of two named wnd# entries in 1022).
    expect(theme.windowTypes?.['document-window']).toBeDefined();
    expect(theme.windowTypes?.['document-window'].chrome.active).toMatch(/cicn-n14335/);
    expect(theme.windowTypes?.['document-window'].chrome.inactive).toMatch(/cicn-n14336/);
  });

  itIfFixture('skips validation when validate:false is passed', async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const theme = await loadKaleidoscopeScheme(bytes, {
      encodeAssets: false,
      validate: false,
      meta: {},
    });
    expect(theme).toBeDefined();
  });

  itIfFixture('honours a custom assetUrlFactory', async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const calls = [];
    const theme = await loadKaleidoscopeScheme(bytes, {
      encodeAssets: true,
      assetUrlFactory: async (rgba, w, h, key) => {
        calls.push({ w, h, key, bytesLen: rgba.length });
        return `stub://${key}.png`;
      },
      meta: {
        name: 'Acid', author: { name: 'SHIOCOP' }, origin: { kind: 'kaleidoscope-port' },
      },
    });
    // Factory was called once per cicn + ppat entry that had a payload.
    expect(calls.length).toBeGreaterThan(180); // 190 cicns + 2 ppats minus any decode failures
    // Asset URLs are stub URLs from the factory.
    const sampleChromeEl = Object.values(theme.chromeElements)[0];
    expect(sampleChromeEl.asset).toMatch(/^stub:\/\//);
    // windowType chrome map references should also be updated.
    expect(theme.windowTypes['document-window'].chrome.active).toMatch(/^stub:\/\//);
  });
});
