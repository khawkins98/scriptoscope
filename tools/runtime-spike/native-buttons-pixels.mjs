// Opaque current-production comparison. Does not certify original-engine fidelity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
const baseline = 'tools/runtime-spike/.artifacts/native-controls-baseline';
const receipt = JSON.parse(readFileSync(`${baseline}/receipt.json`));
assert.equal(receipt.sourceSha256, 'bce6af5d1981a2f27bbb61ead6ffb1c9fc8a3e02ea8da19ab830369b03fe8264');
for (const file of receipt.files) assert.equal(createHash('sha256').update(readFileSync(`${baseline}/compiled/${file.name}`)).digest('hex'), file.sha256);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`${process.env.SCRIPTOSCOPE_PROBE_ORIGIN ?? 'http://127.0.0.1:5193'}/@fs${process.cwd()}/package.json`);
  const result = await page.evaluate(async ({ root, built }) => {
    const old = await import(`${root}/tools/runtime-spike/.artifacts/native-controls-baseline/compiled/scriptoscope.js`);
    const current = await import(`${root}/${built ? 'dist/scriptoscope.js' : 'src/index.ts'}`);
    const slugs = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os',
      'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];
    const pixels = el => { const canvas = el.querySelector('canvas'); return canvas ? `${canvas.width}x${canvas.height}:${canvas.toDataURL()}` : `fallback:${el.textContent}:${el.style.cssText}`; };
    const dimensions = el => {
      const box = el.getBoundingClientRect(), child = el.querySelector('canvas')?.getBoundingClientRect();
      return [box.width, box.height, child ? child.x - box.x : null, child ? child.y - box.y : null];
    };
    const mountSelect = async (api, theme, disabled, text) => {
      const section = document.createElement('section'); document.body.append(section);
      const handle = await api.mountDeclarative({ root: section, pageThemeDefault: 'loaded', bootAffordance: 'none' });
      handle.registerTheme('loaded', theme);
      const select = document.createElement('select'); select.disabled = disabled; select.add(new Option(text, 'one'));
      section.append(select);
      const end = performance.now() + 10000;
      while (handle.stats.controls !== 1) { if (performance.now() > end) throw new Error('select promotion timed out'); await new Promise(requestAnimationFrame); }
      return { section, handle, face: section.querySelector('.scriptoscope-select') };
    };
    let buttonCases = 0, buttonGeometryCases = 0, selectCases = 0, geometryCases = 0;
    const failures = [];
    for (const slug of slugs) {
      const theme = await old.loadTheme(`/themes/${slug}`);
      try {
        for (const isDefault of [false, true]) for (const disabled of [false, true]) {
          const options = { label: 'Action', default: isDefault, disabled };
          const before = await old.interactiveButton(theme, options), after = await current.interactiveButton(theme, options);
          document.body.append(before, after);
          for (const pressed of [false, true]) {
            if (pressed) for (const el of [before, after]) el.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
            if (pixels(before) !== pixels(after)) failures.push({ slug, kind: 'button-pixels', isDefault, disabled, pressed });
            if (JSON.stringify(dimensions(before)) !== JSON.stringify(dimensions(after))) failures.push({ slug, kind: 'button-geometry', isDefault, disabled, pressed,
              before: dimensions(before), after: dimensions(after) });
            buttonCases++; buttonGeometryCases++;
          }
          before.remove(); after.remove();
        }
        for (const disabled of [false, true]) for (const text of ['First', 'Second']) {
          const before = await mountSelect(old, theme, disabled, text), after = await mountSelect(current, theme, disabled, text);
          if (pixels(before.face) !== pixels(after.face)) failures.push({ slug, kind: 'select-pixels', disabled, text });
          if (JSON.stringify(dimensions(before.face)) !== JSON.stringify(dimensions(after.face))) failures.push({ slug, kind: 'select-geometry', disabled, text,
            before: dimensions(before.face), after: dimensions(after.face) });
          selectCases++; geometryCases++;
          before.handle.disconnect(); after.handle.disconnect(); before.section.remove(); after.section.remove();
        }
      } finally { theme.dispose?.(); }
    }
    return { buttonCases, buttonGeometryCases, selectCases, geometryCases, failures };
  }, { root: `/@fs${process.cwd()}`, built: process.env.SCRIPTOSCOPE_PROBE_BUILT === '1' });
  console.log(JSON.stringify(result));
  if (result.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
