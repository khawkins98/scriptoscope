// Opaque comparison against this experiment's frozen executable, not original fidelity evidence.
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
  const result = await page.evaluate(async root => {
    const old = await import(`${root}/tools/runtime-spike/.artifacts/native-controls-baseline/compiled/scriptoscope.js`);
    const { promoteControl, restoreControl } = await import(`${root}/src/declarative/control.ts`);
    const slugs = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503',
      'black-platinum', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise',
      'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95', '__missing-art__', '__absent-art__'];
    const fingerprint = el => {
      const canvas = el.querySelector('canvas');
      if (canvas) return `${canvas.width}x${canvas.height}:` + canvas.toDataURL();
      // Missing art uses the same baseline layout, without the old nested label wrapper.
      const wrapper = el.querySelector('label') ?? el.querySelector('[aria-hidden=true]')?.firstElementChild ?? el.firstElementChild;
      return `baseline:${el.textContent}:${wrapper?.getAttribute('style')}:` +
        [...wrapper.querySelectorAll('span')].map(span => span.getAttribute('style')).join('|');
    };
    const failures = []; let cases = 0, themed = 0, fallback = 0, rejected = 0;
    for (const slug of slugs) {
      const loaded = await old.loadTheme(`/themes/${slug.startsWith('__') ? '1984' : slug}`);
      const theme = slug.startsWith('__') ? { ...loaded, manifest: { ...loaded.manifest, chromeElements: [] },
        inspector: slug === '__missing-art__' ? undefined : { cicnResources: [], iconMaskResources: [], iconColorResources: [] } } : loaded;
      try {
        for (const kind of ['checkbox', 'radio']) for (const disabled of [false, true]) for (const checked of [false, true]) {
          const label = document.createElement('label'), input = document.createElement('input');
          input.type = kind; input.checked = checked; input.disabled = disabled;
          label.append(input, document.createTextNode('Check')); document.body.append(label);
          const oldCall = () => kind === 'checkbox' ? old.interactiveCheckbox(theme, { label: 'Check', checked, disabled })
            : old.radioGroup(theme, { items: [{ label: 'Check', value: 'x' }], value: checked ? 'x' : '', disabled });
          if (slug === '__missing-art__') {
            const outcome = async call => { try { await call(); return 'resolved'; } catch (error) { return error.message; } };
            const before = await outcome(oldCall), after = await outcome(() => promoteControl(input, theme));
            if (before === 'resolved' || before !== after) failures.push({ slug, kind, disabled, checked, before, after });
            rejected++; restoreControl(input); label.remove(); continue;
          }
          const before = await oldCall();
          const after = await promoteControl(input, theme);
          const oldFace = kind === 'radio' ? before.firstElementChild : before;
          if (oldFace.querySelector('canvas')) themed++; else fallback++;
          if (fingerprint(oldFace) !== fingerprint(after)) failures.push({ slug, kind, disabled, checked });
          cases++; restoreControl(input); label.remove();
        }
      } finally { loaded.dispose?.(); }
    }
    return { cases, themed, fallback, rejected, failures };
  }, `/@fs${process.cwd()}`);
  console.log(JSON.stringify(result));
  if (result.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
