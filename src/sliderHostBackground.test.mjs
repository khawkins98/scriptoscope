// #596: the DOM host's slider background (slider §4.10 BG4/BG6). The CDEF
// erases R to the port background the Control Manager set up (BG5); for a
// control on a themed window that is the window's brush (BG4), which the host
// supplies (BG6). The DOM host realises it by leaving R transparent over the
// composited window body, so a patterned body shows through instead of the
// facade's white default. composeSlider's own default stays white (BG6).
import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const images = new Map();
let painted = null;
globalThis.Image = class { src = ''; get naturalWidth() { return images.get(this.src).width; } get naturalHeight() { return images.get(this.src).height; } async decode() {} };
globalThis.ImageData = class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
globalThis.cancelAnimationFrame = () => {};
const fakeElement = () => {
  let drawn;
  const el = {
    style: {}, children: [], attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, removeEventListener() {},
    replaceChildren(...c) { this.children = c; }, querySelector() { return this.children[0] ?? null; },
    getContext: () => ({
      drawImage(img) { drawn = images.get(img.src); },
      getImageData: () => ({ data: new Uint8ClampedArray(drawn.data) }),
      putImageData(img) { painted = img; },
    }),
  };
  return el;
};
globalThis.document = { createElement: fakeElement };

const { composeSlider } = await import('./controls.ts');
const { interactiveSlider } = await import('./interactive.ts');

/** Synthetic horizontal non-directional slider fork: track rows 0–4 and 11–15 mask-clear, thumb columns 0–2 mask-clear. */
function theme() {
  const cicns = {}, cinfs = {};
  const pm = (w, h, rgb, mask) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...rgb, mask(x, y) ? 255 : 0], (y * w + x) * 4);
    return { width: w, height: h, data };
  };
  for (let id = -10144; id <= -10127; id++) cinfs[id] = [3, 16, 1, 0, ...new Array(14).fill(0)];
  for (const t of [0, 1, 2]) cicns[-10132 + t] = pm(49, 16, [40, 80, 120], (_x, y) => y >= 5 && y <= 10);
  cicns[-10129] = pm(15, 64, [200, 30, 30], x => x >= 3);
  const baseUrl = `/slider596`, chromeElements = {};
  for (const [id, p] of Object.entries(cicns)) { images.set(`${baseUrl}/c${id}.png`, p); chromeElements[`c${id}`] = { asset: `c${id}.png`, sourceCicnId: Number(id), samplingEquivalence: { status: 'equivalent' } }; }
  return { baseUrl, manifest: { name: 'synthetic', chromeElements, patterns: {}, engineCinfs: cinfs, windowTypes: {} } };
}
const at = (d, w, x, y) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

test('#596 host slider: outside the track and thumb masks R is transparent and composites to the body pattern; art pixels are unchanged', async () => {
  const t = theme();
  painted = null;
  await interactiveSlider(t, { length: 120, value: 0.5 });
  assert.ok(painted, 'the host painted a frame');
  const white = await composeSlider(t, { length: 120, value: 0.5 });
  assert.equal(painted.width, white.width);
  assert.equal(painted.height, white.height);
  const W = white.width, H = white.height;
  // A stand-in body pattern (any 2-colour checker), composited under the slider's canvas.
  const body = (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [90, 60, 30, 255] : [150, 120, 90, 255];
  let clear = 0, art = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = at(painted.data, W, x, y), q = at(white.data, W, x, y);
    if (p[3] === 0) {
      clear++;
      assert.deepEqual(q, [255, 255, 255, 255], `(${x},${y}) is background in the default render`);
      const over = p[3] === 255 ? p : body(x, y);
      assert.deepEqual(over, body(x, y), `(${x},${y}) composites to the body`);
    } else {
      art++;
      assert.deepEqual(p, q, `(${x},${y}) art pixel matches the default render`);
      assert.equal(p[3], 255);
    }
  }
  assert.ok(clear > 0, 'mask-clear pixels are transparent (white box on main)');
  assert.ok(art > 0, 'track and thumb drew');
});

test('#596 composeSlider keeps the BG6 declared default: uncovered pixels are opaque white', async () => {
  const b = await composeSlider(theme(), { length: 120, value: 0.5 });
  assert.deepEqual(at(b.data, b.width, 0, 0), [255, 255, 255, 255]);
});
