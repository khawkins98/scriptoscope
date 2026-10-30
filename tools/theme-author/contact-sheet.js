// Contact sheet: every cicn and ppat of a scheme at 4× on a checkerboard,
// grouped by family, with its id and size underneath. Optionally a second
// panel shows the same images through the 8-bit simulation (sim8.js).
//
// It answers "do the widgets belong to one family?" in a glance (design guide
// docs/authoring-visual-design.md §3, step 6). `npm run author -- <dir> --sheet`
// writes it to <dir>/sheet.png; don't commit it.
//
// Pure and portable: takes resource entries ({ type, id, data }), returns
// { width, height, rgba }. No fs, no zlib, no DOM.

import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodePpat } from '../theme-loader/decoders/ppat.js';
import { gammaCorrectRgba } from '../theme-loader/mac-gamma.js';
import { simulate8bit } from './sim8.js';

// Families by id, in display order (docs/authoring-a-scheme.md §6).
const FAMILIES = [
  ['windows', (t, id) => t === 'cicn' && ((id >= -14336 && id <= -14284 && ![-14334, -14333, -14330, -14329, -14298, -14297].includes(id)) || id === -12320 || id === -12319)],
  ['window widgets', (t, id) => t === 'cicn' && [-14334, -14333, -14330, -14329, -14298, -14297].includes(id)],
  ['push buttons', (t, id) => t === 'cicn' && id >= -10240 && id <= -10230],
  ['check and radio', (t, id) => t === 'cicn' && id >= -9504 && id <= -9481],
  ['scroll bars', (t, id) => t === 'cicn' && ((id >= -8288 && id <= -8249) || (id >= -10208 && id <= -10205))],
  ['tabs', (t, id) => t === 'cicn' && id >= -9984 && id <= -9969],
  ['bevel buttons', (t, id) => t === 'cicn' && id >= -10176 && id <= -10153],
  ['sliders', (t, id) => t === 'cicn' && id >= -10144 && id <= -10113],
  ['triangles', (t, id) => t === 'cicn' && id >= -10112 && id <= -10097],
  ['progress', (t, id) => t === 'cicn' && id >= -10080 && id <= -10065],
  ['little arrows', (t, id) => t === 'cicn' && id >= -10048 && id <= -10045],
  ['popup buttons', (t, id) => t === 'cicn' && id >= -8208 && id <= -8194],
  ['menus', (t, id) => t === 'cicn' && id >= -12240 && id <= -12230],
  ['finder', (t, id) => t === 'cicn' && id >= -9568 && id <= -9548],
  ['patterns', (t) => t === 'ppat'],
  ['other', (t) => t === 'cicn'],
];

const PAD = 6, GAP = 10, FONT = 2; // label font: 3×5 glyphs drawn at 2×
const LABEL_H = 5 * FONT + 4;
const BG = [42, 42, 46], INK = [220, 220, 214], DIM = [150, 150, 150];
const CHECK = [[255, 255, 255], [214, 214, 214]];

/**
 * @param {Array<{ type: string, id: number, data: Uint8Array }>} resources
 * @param {{ scale?: number, sim8?: boolean, maxWidth?: number }} [opts]
 *   sim8: add a second panel, to the right, through the 8-bit simulation.
 * @returns {{ width: number, height: number, rgba: Uint8Array, count: number }}
 */
export function contactSheet(resources, { scale = 4, sim8 = false, maxWidth = 1200 } = {}) {
  const items = collect(resources);
  const web = items.map((it) => ({ ...it, rgba: gammaCorrectRgba(new Uint8Array(it.stored)) }));
  const panels = [renderPanel('web', web, scale, maxWidth)];
  if (sim8) {
    const at8 = items.map((it) => ({ ...it, rgba: simulate8bit({ width: it.width, height: it.height, rgba: it.stored }, { gamma: false, output: 'web' }).rgba }));
    panels.push(renderPanel('8 bpp simulation', at8, scale, maxWidth));
  }
  const width = panels.reduce((w, p) => w + p.width, 0) + GAP * (panels.length - 1);
  const height = Math.max(...panels.map((p) => p.height));
  const out = new Surface(width, height);
  let x = 0;
  for (const p of panels) { out.blit(p, x, 0); x += p.width + GAP; }
  return { width, height, rgba: out.rgba, count: items.length };
}

/** Decode every cicn and ppat (stored values), tagged with its family. */
function collect(resources) {
  const items = [];
  for (const r of resources) {
    if (r.type !== 'cicn' && r.type !== 'ppat') continue;
    let img;
    try { img = r.type === 'cicn' ? decodeCicn(r.data) : decodePpat(r.data); } catch { img = null; }
    if (!img) continue;
    let { width, height, rgba } = img;
    if (r.type === 'ppat') ({ width, height, rgba } = tile(img, 2, 2));
    const family = FAMILIES.findIndex(([, test]) => test(r.type, r.id));
    items.push({ type: r.type, id: r.id, family, width, height, stored: rgba, label: `${r.id} ${img.width}x${img.height}` });
  }
  return items.sort((a, b) => a.family - b.family || a.id - b.id);
}

function renderPanel(title, items, scale, maxWidth) {
  // Lay out first, then paint.
  const placed = [];
  let x = PAD, y = PAD + LABEL_H + 4, rowH = 0, family = -1, right = 0;
  const widest = Math.max(0, ...items.map((it) => it.width * scale));
  const limit = Math.max(maxWidth, widest + 2 * PAD);
  for (const it of items) {
    const w = it.width * scale, h = it.height * scale;
    const cellW = Math.max(w, textWidth(it.label));
    if (it.family !== family) {
      if (family !== -1) { y += rowH + GAP; }
      placed.push({ heading: FAMILIES[it.family][0], x: PAD, y });
      y += LABEL_H + 2; x = PAD; rowH = 0; family = it.family;
    } else if (x + cellW > limit - PAD) { x = PAD; y += rowH + GAP; rowH = 0; }
    placed.push({ it, x, y, w, h });
    x += cellW + GAP; right = Math.max(right, x);
    rowH = Math.max(rowH, h + LABEL_H + 2);
  }
  const width = Math.max(right, textWidth(title) + 2 * PAD, 200), height = y + rowH + PAD;
  const s = new Surface(width, height, BG);
  s.text(title, PAD, PAD, INK);
  for (const p of placed) {
    if (p.heading) { s.text(p.heading, p.x, p.y, DIM); continue; }
    const { it } = p;
    s.checker(p.x, p.y, p.w, p.h);
    for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) {
      const i = (((yy / scale) | 0) * it.width + ((xx / scale) | 0)) * 4;
      if (it.rgba[i + 3]) s.set(p.x + xx, p.y + yy, it.rgba[i], it.rgba[i + 1], it.rgba[i + 2]);
    }
    s.text(it.label, p.x, p.y + p.h + 3, INK);
  }
  return s;
}

function tile({ width, height, rgba }, nx, ny) {
  const w = width * nx, h = height * ny, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y % height) * width + (x % width)) * 4;
    out.set(rgba.subarray(i, i + 4), (y * w + x) * 4);
  }
  return { width: w, height: h, rgba: out };
}

class Surface {
  constructor(width, height, bg = BG) {
    this.width = width; this.height = height;
    this.rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < this.rgba.length; i += 4) { this.rgba.set(bg, i); this.rgba[i + 3] = 255; }
  }
  set(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.rgba[i] = r; this.rgba[i + 1] = g; this.rgba[i + 2] = b; this.rgba[i + 3] = 255;
  }
  checker(x0, y0, w, h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.set(x0 + x, y0 + y, ...CHECK[((x >> 3) + (y >> 3)) & 1]);
  }
  blit(src, x0, y0) {
    for (let y = 0; y < src.height; y++) {
      this.rgba.set(src.rgba.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((y0 + y) * this.width + x0) * 4);
    }
  }
  text(str, x0, y0, colour) {
    let x = x0;
    for (const ch of String(str).toUpperCase()) {
      const g = GLYPHS[ch];
      if (g) for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
        if (g[row * 3 + col] !== '#') continue;
        for (let dy = 0; dy < FONT; dy++) for (let dx = 0; dx < FONT; dx++) this.set(x + col * FONT + dx, y0 + row * FONT + dy, ...colour);
      }
      x += 4 * FONT;
    }
  }
}

const textWidth = (s) => String(s).length * 4 * FONT;

// A 3×5 pixel font: digits, letters, '-', '.' and space; rows separated by '/'.
const GLYPHS = Object.fromEntries(Object.entries({
  '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '###/..#/###/#../###', '3': '###/..#/.##/..#/###', '4': '#.#/#.#/###/..#/..#',
  '5': '###/#../###/..#/###', '6': '###/#../###/#.#/###', '7': '###/..#/..#/.#./.#.', '8': '###/#.#/###/#.#/###', '9': '###/#.#/###/..#/###',
  A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
  F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
  K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.',
  P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/#.#/.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
  Z: '###/..#/.#./#../###', '-': '.../.../###/.../...', ' ': '.../.../.../.../...', '.': '.../.../.../.../.#.',
}).map(([k, v]) => [k, v.replaceAll('/', '')]));
