// Implementation-owned cache regression; no independent pixel/fidelity oracle.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const base = process.env.SCRIPTOSCOPE_PERF_URL;
test('region reuse survives owned wrappers and activation, but invalidates on changed inputs', { skip: !base }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/region-cache-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.goto(`${base}/region-cache-test`);
    const checks = await page.evaluate(async source => {
      const { loadOwnedTheme, WindowManager } = await import(source);
      const theme = await loadOwnedTheme('/themes/dolphin-som');
      const other = await loadOwnedTheme('/themes/dolphin-som');
      const manager = new WindowManager();
      try {
        const host = await manager.add(theme, { width: 240, height: 160, title: 'Cache' });
        document.body.append(host);
        const entry = manager.windows[0];
        const active = entry.geometry;
        const firstTemplate = entry.regionCache.template;
        const frameTargets = entry.targets.get(entry.layers.hit).nodes;
        await manager.render(entry);
        const retainedTargets = frameTargets.length > 0 &&
          entry.targets.get(entry.layers.hit).nodes.length === frameTargets.length &&
          entry.targets.get(entry.layers.hit).nodes.every((node, i) => node === frameTargets[i] && node.isConnected);
        frameTargets[0].remove();
        await manager.render(entry);
        const repairedTargets = entry.targets.get(entry.layers.hit).nodes.length === frameTargets.length &&
          entry.targets.get(entry.layers.hit).nodes.every(node => node.isConnected && !frameTargets.includes(node));
        // Exercise internal awaited focus rather than measuring event dispatch.
        const second = await manager.add(theme, { width: 240, height: 160 });
        document.body.append(second);
        await manager.focus(manager.windows[1]);
        const inactive = entry.geometry;
        await manager.focus(entry);
        const reusedActive = entry.geometry === active;
        const freshWrapper = entry.regionCache.template !== firstTemplate ||
          (await manager.prepareChrome(entry, theme)).win._scriptoscopeComposed.structureTemplate !== firstTemplate;
        await manager.focus(manager.windows[1]);
        const reusedInactive = entry.geometry === inactive;
        // Keep source object identity but mutate a byte: cached pixels must not pass.
        const data = entry.regionCache.template.data;
        const original = data[0];
        data[0] ^= 1;
        try { await manager.render(entry); } finally { data[0] = original; }
        const invalidatedPixels = entry.geometry !== inactive;
        // Commit restored RGB first, so the next miss is attributable to alpha alone.
        await manager.render(entry);
        const beforeAlpha = entry.geometry, originalAlpha = data[3];
        data[3] = originalAlpha === 0 ? 255 : 0;
        let invalidatedAlpha;
        try { await manager.render(entry); invalidatedAlpha = entry.geometry !== beforeAlpha; }
        finally { data[3] = originalAlpha; }
        await manager.focus(entry);
        await manager.focus(manager.windows[1]);
        const beforeResize = entry.geometry;
        const beforeResizeTargets = entry.targets.get(entry.layers.hit).nodes;
        await manager.applyState(host, { width: 260 });
        const invalidatedSize = entry.geometry !== beforeResize;
        const replacedTargets = beforeResizeTargets.length > 0 && beforeResizeTargets.every(node => !node.isConnected) &&
          entry.targets.get(entry.layers.hit).nodes.length > 0 &&
          entry.targets.get(entry.layers.hit).nodes.every(node => node.isConnected);
        const beforeScale = entry.geometry;
        entry.opts = { ...entry.opts, scale: 2 };
        await manager.render(entry);
        const invalidatedScale = entry.geometry !== beforeScale;
        const prepare = manager.prepareChrome;
        manager.prepareChrome = async function (...args) {
          const result = await prepare.apply(this, args);
          result.win._scriptoscopeComposed.structure = () => { throw new Error('Synthetic region failure'); };
          return result;
        };
        // Change the title as well, so no successful cached input can bypass the failure.
        entry.opts = { ...entry.opts, title: 'Changed cache title' };
        try { await manager.render(entry); } finally { manager.prepareChrome = prepare; }
        const clearedFailure = entry.region === null && !entry.regionCache && !entry.previousRegionCache;
        await manager.render(entry);
        const retriedFailure = !!entry.geometry && !!entry.regionCache;
        const beforeTheme = entry.geometry;
        await manager.retheme(other);
        const invalidatedTheme = entry.geometry !== beforeTheme && entry.previousRegionCache === undefined;
        return { retainedTargets, repairedTargets, replacedTargets, reusedActive, reusedInactive, freshWrapper,
          invalidatedPixels, invalidatedAlpha, invalidatedSize, invalidatedScale,
          clearedFailure, retriedFailure, invalidatedTheme };
      } finally { manager.dispose(); theme.dispose(); other.dispose(); }
    }, `/@fs${fileURLToPath(new URL('./index.ts', import.meta.url))}`);
    assert.deepEqual(checks, { retainedTargets: true, repairedTargets: true, replacedTargets: true,
      reusedActive: true, reusedInactive: true, freshWrapper: true,
      invalidatedPixels: true, invalidatedAlpha: true, invalidatedSize: true, invalidatedScale: true, clearedFailure: true,
      retriedFailure: true, invalidatedTheme: true });
  } finally { await browser.close(); }
});
