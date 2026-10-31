// Independent #608 PF-H5 presentation hook (docs/spec/engine/push-button.md).
// Pages that show composeButton output directly must treat null as unavailable:
// the diagnostic Scene panel's On/Off/OK each have visible pixels or are
// baseline controls, and the controls row and capabilities page never show a
// themed tile with 0 opaque pixels. Source (vite) and the built demo bundle.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';
import { root } from './servers.mjs';
import { PF_SCHEMES } from './controls459/push-facade-rules.mjs';

const test = demoTest.extend({
  production: [async ({}, use) => {
    const base = resolve(root, 'dist/demo');
    const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png' };
    const s = createServer(async (req, res) => { try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/scriptoscope/')) throw Error('Outside production base');
      const file = resolve(base, '.' + decodeURIComponent(url.pathname.slice('/scriptoscope'.length)));
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) throw Error('Not a file');
      res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); } });
    await new Promise(r => s.listen(0, '127.0.0.1', r));
    try { await use(`http://127.0.0.1:${s.address().port}/scriptoscope`); } finally { await new Promise(r => s.close(r)); }
  }, { scope: 'worker' }],
});

// Literal description of a presented control: a canvas (with its opaque count)
// or a DOM baseline (tag + text). Nothing else is accepted as "shown".
const DESCRIBE = `(el => {
  if (!el) return null;
  if (el.tagName === 'CANVAS') {
    const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
    let opaque = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) opaque++;
    return { kind: 'canvas', opaque, width: el.width, height: el.height };
  }
  return { kind: el.tagName.toLowerCase(), text: el.textContent.trim() };
})`;
const visibleOrBaseline = (shown, label) => shown?.kind === 'canvas' ? shown.opaque > 0 : shown?.text === label;

async function scene(page) {
  await page.locator('#d-scene canvas').first().waitFor();
  return page.evaluate(describe => {
    const d = eval(describe);
    // The scene's dialog is the column-flex content pane (On/Off row, progress, footer).
    const dialog = [...document.querySelectorAll('#d-scene .scriptoscope-content')].find(e => e.style.flexDirection === 'column');
    if (!dialog) return { error: document.querySelector('#d-scene')?.textContent.slice(0, 200) ?? 'no scene' };
    const kids = [...dialog.children].filter(e => e.tagName !== 'SLOT');
    const onoff = kids[0], foot = kids.at(-1);
    const segments = onoff.querySelectorAll(':scope > canvas').length ? [...onoff.children] : [...(onoff.firstElementChild?.children ?? [])];
    return { on: d(segments[0]), off: d(segments[1]), ok: d(foot?.lastElementChild) };
  }, DESCRIBE);
}
async function controlsRow(page) {
  await page.locator('#d-controls .btn-stack').waitFor();
  return page.evaluate(describe => [...document.querySelector('#d-controls .btn-stack').firstElementChild.children].map(eval(describe)), DESCRIBE);
}
async function capabilities(page) {
  await expect(page.locator('#state-samples figure')).not.toHaveCount(0);
  return page.evaluate(describe => [...document.querySelectorAll('#state-samples figure')].map(f => {
    const status = f.querySelector('figcaption span')?.textContent ?? '';
    return { label: f.querySelector('figcaption').firstChild.textContent, status, shown: eval(describe)(f.querySelector('canvas')) };
  }), DESCRIBE);
}

for (const mode of ['source', 'production']) {
  for (const slug of [...PF_SCHEMES, '1138']) {
    test(`${mode}: PF-H5 ${slug} diagnostic Scene, controls row and capabilities never present a blank themed button`, async ({ page, demo, production }, info) => {
      const base = mode === 'source' ? demo : production;
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/diagnostic.html?theme=${slug}`);
      const s = await scene(page);
      const row = await controlsRow(page);
      await page.goto(`${base}/capabilities.html?theme=${slug}`);
      await expect(page.locator('#scheme')).toHaveValue(slug);
      await expect.poll(async () => (await capabilities(page)).filter(t => t.label.startsWith('Push')).length).toBe(4);
      const cap = await capabilities(page);
      const observed = { slug, mode, scene: s, controlsRow: row, capabilities: cap, errors };
      await info.attach('pf608-h5.json', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' });

      expect(s.error, 'scene must build').toBeUndefined();
      expect({ on: visibleOrBaseline(s.on, 'On'), off: visibleOrBaseline(s.off, 'Off'), ok: visibleOrBaseline(s.ok, 'OK') }, JSON.stringify(s))
        .toEqual({ on: true, off: true, ok: true });
      expect(row.map((shown, i) => visibleOrBaseline(shown, ['Cancel', 'OK', 'Help'][i])), JSON.stringify(row)).toEqual([true, true, true]);
      for (const tile of cap) {
        if (tile.status.startsWith('themed')) expect(tile.shown?.opaque, `${tile.label}: themed tile`).toBeGreaterThan(0);
        if (tile.shown?.kind === 'canvas') expect(tile.shown.opaque, `${tile.label}: shown canvas`).toBeGreaterThan(0);
      }
      const push = cap.filter(t => t.label.startsWith('Push'));
      if (slug === '1138') {
        // Positive control: the same pages keep real themed push canvases.
        expect(s.ok.kind).toBe('canvas'); expect(row.map(r => r.kind)).toEqual(['canvas', 'canvas', 'canvas']);
        for (const t of push) expect({ status: t.status.split(' ')[0], visible: t.shown?.opaque > 0 }, t.label).toEqual({ status: 'themed', visible: true });
      } else {
        // PF3 output is null: the tile states unavailable instead of claiming themed.
        for (const t of push) expect(t.status.startsWith('themed'), `${t.label}: ${t.status}`).toBe(false);
      }
      expect(errors).toEqual([]);
    });
  }
}
