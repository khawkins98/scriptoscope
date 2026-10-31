import { test, expect, openHarness, attachCase } from './fixtures.mjs';

// #596: a slider on a pattern-bodied window must not sit in a white box.
//
// Spec basis (docs/spec/engine/slider.md §4.10): CDEF 3 erases R to the port background (BG5) after the Control
// Manager has set it up; on a themed window that is the window's own brush (BG4). The engine takes the outcome as
// the host-supplied input `background` (BG6), opaque white when the host supplies none. Compatibility policy for
// the DOM slider paths (the promoted <input type="range"> and interactiveSlider): the window body is already drawn
// behind the control canvas, so the host supplies a fully transparent background and R composites to the body.
// The standalone composeSlider default stays opaque white.
//
// Art masks are established without the DOM path: the spec's own BG test (§8, "pass a sentinel background")
// composes the same slider over two different opaque sentinels. A pixel equal in both is masked art (BL1, art never
// mixes with the background); a pixel that equals each sentinel is erased background.
//
// Scheme: animals. Discriminator: it ships the slider cinf set (composeSlider is not handed off, G1) and a document
// body ppat (`bodyBackground.pattern`, the -9551 Icon-View pattern, a multi-colour tile), checked in the page below.
const SLUG = 'animals';
const LENGTH = 120, VALUE = 0.5;
const SENTINELS = [{ r: 255, g: 0, b: 255 }, { r: 0, g: 255, b: 0 }];

async function setup(page, servers, mode) {
  await openHarness(page, servers, mode);
  const discriminator = await page.evaluate(async ({ mode, SLUG, LENGTH, VALUE }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${SLUG}`);
    const root = document.createElement('section'); root.id = 'host-bg-root'; root.style.cssText = 'position:absolute;left:40px;top:40px'; document.body.append(root);
    const handle = await (await import('/tests/rendering-options/contract-host.mjs')).createContractHost(api, { root, pageThemeDefault: 'fixture', bootAffordance: 'none' });
    handle.registerTheme('fixture', theme);
    const win = document.createElement('article'); win.dataset.scriptoscopeWindow = ''; win.dataset.scriptoscopeTitle = 'Controls';
    win.style.width = '300px';
    win.innerHTML = '<p style="margin:0 0 12px">Volume</p><input id="host-bg-range" type="range" aria-label="Volume" min="0" max="100" step="1" value="50"><div id="host-bg-imperative" style="margin-top:12px"></div><p style="margin:12px 0 0">End</p>';
    root.append(win); void handle.attach(win);
    window.hostBg = { api, theme, root, handle };
    const imperative = await api.interactiveSlider(theme, { orientation: 'horizontal', length: LENGTH, value: VALUE });
    imperative.id = 'host-bg-imperative-slider';
    window.hostBg.imperative = imperative;
    return { sliderHandledByKaleidoscope: (await api.composeSlider(theme, { length: LENGTH, value: VALUE })) !== null,
      bodyPattern: !!theme.manifest.bodyBackground?.pattern };
  }, { mode, SLUG, LENGTH, VALUE });
  expect(discriminator, `${SLUG} must ship a themed slider and a body ppat`).toEqual({ sliderHandledByKaleidoscope: true, bodyPattern: true });
  await expect(page.locator('#host-bg-root [data-scriptoscope-window-host]')).toHaveCount(1);
  await expect(page.locator('#host-bg-range + .scriptoscope-slider canvas')).toHaveCount(1);
  // The imperative slider joins the same window body, next to the promoted range.
  await page.evaluate(() => document.getElementById('host-bg-imperative').append(window.hostBg.imperative));
  await expect(page.locator('#host-bg-imperative-slider canvas')).toHaveCount(1);
}
async function cleanup(page) {
  await page.evaluate(() => { const f = window.hostBg; f?.handle.disconnect(); f?.root.remove(); f?.theme.dispose?.(); }).catch(() => {});
}

/** Per backing pixel: 'art' or 'bg', from two sentinel compositions; plus the art's RGBA. */
async function artMasks(page) {
  return page.evaluate(async ({ LENGTH, VALUE, SENTINELS }) => {
    const { api, theme } = window.hostBg;
    const [a, b] = await Promise.all(SENTINELS.map(background => api.composeSlider(theme, { length: LENGTH, value: VALUE, background })));
    const width = a.width, height = a.height, art = [], rgba = [];
    let bgMismatch = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pa = [...a.getPixel(x, y)], pb = [...b.getPixel(x, y)];
      const isArt = pa.every((v, i) => v === pb[i]);
      art.push(isArt); rgba.push(pa);
      // §8 BG row: an uncovered pixel is exactly the sentinel, opaque.
      if (!isArt && !([SENTINELS[0].r, SENTINELS[0].g, SENTINELS[0].b, 255].every((v, i) => v === pa[i])
        && [SENTINELS[1].r, SENTINELS[1].g, SENTINELS[1].b, 255].every((v, i) => v === pb[i]))) bgMismatch++;
    }
    return { width, height, art, rgba, bgMismatch };
  }, { LENGTH, VALUE, SENTINELS });
}

for (const mode of ['source', 'built']) {
  test(`${mode}: DOM sliders on a pattern-bodied window leave the erase transparent so the body shows through (#596)`, async ({ page, servers }, info) => {
    const report = { mode, slug: SLUG };
    try {
      await setup(page, servers, mode);
      // 0. The erase step runs (BG5). A transparent host background is still an erase of R, never a skipped one:
      //    with no background, every pixel of R is opaque (white or art), and a sentinel background reaches every
      //    pixel no art covers. A driver that skips the erase leaves unpainted pixels transparent in both.
      const erase = await page.evaluate(async ({ LENGTH, VALUE, SENTINELS }) => {
        const { api, theme } = window.hostBg;
        const plain = await api.composeSlider(theme, { length: LENGTH, value: VALUE });
        const sentinel = await api.composeSlider(theme, { length: LENGTH, value: VALUE, background: SENTINELS[0] });
        let notOpaque = 0, sentinelPixels = 0;
        for (let y = 0; y < plain.height; y++) for (let x = 0; x < plain.width; x++) {
          if (plain.getPixel(x, y)[3] !== 255) notOpaque++;
          const p = sentinel.getPixel(x, y);
          if (p[0] === SENTINELS[0].r && p[1] === SENTINELS[0].g && p[2] === SENTINELS[0].b && p[3] === 255) sentinelPixels++;
        }
        return { notOpaque, erasedToSentinel: sentinelPixels > 0 };
      }, { LENGTH, VALUE, SENTINELS });
      expect(erase, 'R is erased before the art (BG5)').toEqual({ notOpaque: 0, erasedToSentinel: true });
      const mask = await artMasks(page);
      const artCount = mask.art.filter(Boolean).length, bgCount = mask.art.length - artCount;
      report.mask = { width: mask.width, height: mask.height, artCount, bgCount, bgMismatch: mask.bgMismatch };
      expect(mask.bgMismatch).toBe(0);
      expect(artCount).toBeGreaterThan(0); expect(bgCount).toBeGreaterThan(0);

      for (const selector of ['#host-bg-range + .scriptoscope-slider', '#host-bg-imperative-slider']) {
        // 1. The control canvas: background pixels transparent, art pixels unchanged.
        await expect.poll(() => page.locator(`${selector} canvas`).evaluate((canvas, mask) => {
          if (canvas.width !== mask.width || canvas.height !== mask.height) return { size: [canvas.width, canvas.height] };
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let opaqueBackground = 0, changedArt = 0;
          for (let i = 0; i < mask.art.length; i++) {
            const px = data.subarray(i * 4, i * 4 + 4);
            if (mask.art[i]) { if (mask.rgba[i].some((v, k) => v !== px[k])) changedArt++; }
            else if (px[3] !== 0) opaqueBackground++;
          }
          return { opaqueBackground, changedArt };
        }, mask), { message: `${selector} canvas` }).toEqual({ opaqueBackground: 0, changedArt: 0 });

        // 2. Composited: outside the art, the page pixels with the slider shown equal the body alone.
        const face = page.locator(selector);
        await face.scrollIntoViewIfNeeded();
        const box = await page.locator(`${selector} canvas`).evaluate(c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.x + box.width) - Math.floor(box.x), height: Math.ceil(box.y + box.height) - Math.floor(box.y) };
        const shown = (await page.screenshot({ clip, scale: 'device', animations: 'disabled', caret: 'hide' })).toString('base64');
        await face.evaluate(el => { el.style.visibility = 'hidden'; });
        const body = (await page.screenshot({ clip, scale: 'device', animations: 'disabled', caret: 'hide' })).toString('base64');
        await face.evaluate(el => { el.style.visibility = ''; });
        const composite = await page.evaluate(async ({ shown, body, box, clip, mask }) => {
          const decode = async b64 => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
            const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
            const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height); };
          const [s, b] = await Promise.all([decode(shown), decode(body)]);
          const dpr = s.width / clip.width, sx = mask.width / box.width, sy = mask.height / box.height;
          const isBg = (bx, by) => bx >= 0 && by >= 0 && bx < mask.width && by < mask.height && !mask.art[by * mask.width + bx];
          let compared = 0, differ = 0, nonWhite = 0; const colours = new Set();
          for (let dy = 0; dy < s.height; dy++) for (let dx = 0; dx < s.width; dx++) {
            const bx = Math.floor(((dx + 0.5) / dpr + clip.x - box.x) * sx), by = Math.floor(((dy + 0.5) / dpr + clip.y - box.y) * sy);
            // Only pixels whose whole backing neighbourhood is erased background: no resampling at art edges.
            let interior = true;
            for (let oy = -1; oy <= 1 && interior; oy++) for (let ox = -1; ox <= 1; ox++) if (!isBg(bx + ox, by + oy)) { interior = false; break; }
            if (!interior) continue;
            const i = (dy * s.width + dx) * 4; compared++;
            if (s.data[i] !== b.data[i] || s.data[i + 1] !== b.data[i + 1] || s.data[i + 2] !== b.data[i + 2]) differ++;
            if (!(b.data[i] === 255 && b.data[i + 1] === 255 && b.data[i + 2] === 255)) nonWhite++;
            colours.add(`${b.data[i]},${b.data[i + 1]},${b.data[i + 2]}`);
          }
          return { compared, differ, nonWhite, bodyColours: colours.size };
        }, { shown, body, box, clip, mask });
        report[selector] = composite;
        expect(composite.compared, `${selector} compared pixels`).toBeGreaterThan(0);
        // The region under the slider really is the patterned body (not a flat or white fill), so a white
        // erase could not pass by coincidence.
        expect(composite.nonWhite, `${selector} body under the slider is not white`).toBeGreaterThan(0);
        expect(composite.bodyColours, `${selector} body under the slider is a pattern`).toBeGreaterThan(1);
        expect(composite.differ, `${selector} body shows through`).toBe(0);
      }

      // 3. Standalone composeSlider with no background keeps BG6's opaque white, art unchanged.
      const standalone = await page.evaluate(async ({ LENGTH, VALUE, mask }) => {
        const { api, theme } = window.hostBg;
        const out = await api.composeSlider(theme, { length: LENGTH, value: VALUE });
        let notWhite = 0, changedArt = 0;
        for (let i = 0; i < mask.art.length; i++) {
          const px = [...out.getPixel(i % mask.width, Math.floor(i / mask.width))];
          if (mask.art[i]) { if (mask.rgba[i].some((v, k) => v !== px[k])) changedArt++; }
          else if (!px.every(v => v === 255)) notWhite++;
        }
        return { width: out.width, height: out.height, notWhite, changedArt };
      }, { LENGTH, VALUE, mask });
      expect(standalone).toEqual({ width: mask.width, height: mask.height, notWhite: 0, changedArt: 0 });
    } catch (error) { await attachCase(page, info, report, error); throw error; }
    finally { await cleanup(page); }
  });
}
