# Platinum Theme Generator (Sub-project ①) — Implementation Plan

> ⚠️ **SUPERSEDED — 2026-05-28.** All 7 tasks below were executed and committed task-by-task (2026-05-24 → 2026-05-28), delivering `scripts/generate-platinum.mjs` + the `apple-platinum-replica` theme bundle. The maintainer then pivoted to deferring to the real 1998 freeware Kaleidoscope scheme [`platinum-8`](../../../themes/platinum-8/) as the Platinum authority (commit `c7ab49d`), and both the generator and replica bundle were retired in commit `c935e4c`. This plan is kept as a historical record; **the work is not active** and the bundle it produced no longer exists. The design spec is at [`../specs/2026-05-24-platinum-theme-generator-design.md`](../specs/2026-05-24-platinum-theme-generator-design.md) (carrying a matching superseded notice).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the Apple Platinum document window as a normal Scriptoscope theme bundle (`themes/apple-platinum-replica/`), drawn clean-room from the WDEF decode, validated and rendered through the unmodified pipeline.

**Architecture:** An offline `.mjs` generator synthesizes the same manifest the extractor produces (`{source,extractedAt,counts,assets:[…]}`), draws the min-size window cicn + stipple ppat into RGBA buffers, then calls the real `buildThemeJson` + `validateTheme` and writes a standard bundle. Decode constants and the gray palette live in dedicated modules so the drawing/manifest code references named values, never magic numbers.

**Tech Stack:** Node 22 (`.mjs`, built-in `node --test` + `node:assert`), the existing `tools/theme-loader/` (`buildThemeJson`, `validateTheme`), the project nets (`lint:themes`, `diag:render`). Spec: `docs/superpowers/specs/2026-05-24-platinum-theme-generator-design.md`. Decode source of truth: `docs/spec/platinum-wdef125-decode.md`.

**Deviations from spec (intentional):** (a) the generator uses a small JS RGBA helper rather than importing the TS `src/pixelBuffer.ts` (the `.mjs` script can't import TS without a runner; the primitives needed are trivial); (b) verification uses `node --test` + the project nets rather than a full TDD framework (no framework exists; prototype cadence). Neither changes the architecture.

**Clean-room note:** every constant in `metrics.mjs`/`palette.mjs` must be sourced from the decode doc or sampled from the in-repo `apple-platinum-2` scheme — never invented. Downstream tasks reference these by name.

---

## File Structure

- **Create** `scripts/lib/png-encode.mjs` — shared RGBA→PNG encoder (factored from the inline copy in `scripts/extract-scheme.mjs`). One responsibility: `encodePng(width,height,rgba)→Buffer`.
- **Create** `scripts/generate-platinum/metrics.mjs` — the decoded Platinum geometry as exported constants (title-bar height, frame inset, widget size/anchors, the `AA00` stipple bytes, min-cicn cell widths). The decode's Constants table, executable.
- **Create** `scripts/generate-platinum/palette.mjs` — the named Platinum gray ramp (one slot per color the decode identifies). Values filled by Task 3.
- **Create** `scripts/generate-platinum/sample-palette.mjs` — the color-source investigation tool (samples `apple-platinum-2` + cross-checks System-file `clut`/`wctb`); prints the per-slot values + source. Run once to author `palette.mjs`.
- **Create** `scripts/generate-platinum/draw-document-window.mjs` — draws the min-cicn (active + inactive) and the stipple ppat into RGBA buffers from `metrics` + `palette`. Exports `drawDocumentWindow(palette) → { active, inactive, stipple }` where each is `{ width, height, rgba }`.
- **Create** `scripts/generate-platinum/manifest.mjs` — synthesizes the document-window manifest assets (cicn/ppat/wnd#/cinf, canonical IDs). Exports `buildDocumentWindowAssets(drawn) → ManifestAsset[]`.
- **Create** `scripts/generate-platinum.mjs` — entry script: draw → write PNGs → assemble manifest+meta → `buildThemeJson` → `validateTheme` → write bundle.
- **Create** `themes/apple-platinum-replica/meta.json`, `themes/apple-platinum-replica/PROVENANCE.md` — provenance inputs.
- **Create (generated)** `themes/apple-platinum-replica/{cicns,ppats}/*.png`, `theme.json`, `extraction-manifest.json`.
- **Create** `scripts/generate-platinum/*.test.mjs` — `node --test` checks for `metrics`, `palette`, `draw-document-window`, `manifest`.

---

### Task 1: Shared PNG encoder module

**Files:**
- Create: `scripts/lib/png-encode.mjs`
- Create: `scripts/generate-platinum/png-encode.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/generate-platinum/png-encode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePng } from '../lib/png-encode.mjs';

test('encodePng emits a valid PNG signature + IHDR dimensions', () => {
  const rgba = new Uint8Array(2 * 2 * 4).fill(255); // 2x2 opaque white
  const png = encodePng(2, 2, rgba);
  // PNG signature
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR width/height at bytes 16..24 (8 sig + 4 len + 4 'IHDR')
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
});
```

- [ ] **Step 2: Run it — expect failure (module missing)**

Run: `node --test scripts/generate-platinum/png-encode.test.mjs`
Expected: FAIL — `Cannot find module '../lib/png-encode.mjs'`.

- [ ] **Step 3: Create the module (lift the encoder verbatim from `scripts/extract-scheme.mjs` lines 47–82)**

```js
// scripts/lib/png-encode.mjs
// Minimal RGBA PNG encoder over node:zlib — the single source of truth
// (was duplicated inline in extract-scheme.mjs / extract-icons.mjs).
import { deflateSync } from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}
export function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `node --test scripts/generate-platinum/png-encode.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/png-encode.mjs scripts/generate-platinum/png-encode.test.mjs
git commit -m "feat(platinum-gen): shared RGBA PNG encoder module"
```

---

### Task 2: Platinum metrics module (decode constants, executable)

**Files:**
- Create: `scripts/generate-platinum/metrics.mjs`
- Create: `scripts/generate-platinum/metrics.test.mjs`

Source every value from `docs/spec/platinum-wdef125-decode.md` (the "Constants" section). Do NOT invent — if a value isn't in the decode doc, stop and flag.

- [ ] **Step 1: Write the failing test (asserts decode-sourced invariants)**

```js
// scripts/generate-platinum/metrics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRICS } from './metrics.mjs';

test('stipple is the decoded AA00 2-row pattern (8 bytes)', () => {
  assert.deepEqual([...METRICS.stipple], [0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00]);
});
test('frame inset is 1px on sides/bottom; widgets are 7x7', () => {
  assert.equal(METRICS.frameInset, 1);
  assert.equal(METRICS.widget.size, 7);
  assert.equal(METRICS.widget.closeLeftOffset, 4);   // title.left + 4
  assert.equal(METRICS.widget.zoomRightOffset, 4);   // title.right − 4 .. −11
});
test('title bar height is a positive integer ≥ 10 (decode clamp)', () => {
  assert.ok(Number.isInteger(METRICS.titleBarHeight) && METRICS.titleBarHeight >= 10);
});
```

- [ ] **Step 2: Run it — expect failure (module missing)**

Run: `node --test scripts/generate-platinum/metrics.test.mjs`
Expected: FAIL — cannot find `./metrics.mjs`.

- [ ] **Step 3: Create the module from the decode doc**

```js
// scripts/generate-platinum/metrics.mjs
// Platinum geometry, sourced from docs/spec/platinum-wdef125-decode.md (Constants).
// titleBarHeight is the decode's font-derived value (ascent+descent+2, clamp ≥10)
// at the standard classic system font; it is the one metric Task 7 tunes visually.
export const METRICS = {
  titleBarHeight: 19,            // standard classic Platinum document title bar; tuned in Task 7
  frameInset: 1,                 // L/R/B frame thickness (1px), top = titleBarHeight + 1
  bevel: { lightEdges: ['top', 'left'], darkEdges: ['bottom', 'right'] }, // raised
  stipple: Uint8Array.from([0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00]), // title fill, 2-row period
  widget: {
    size: 7,                     // 7×7 boxes
    closeLeftOffset: 4,          // close box: title.left + 4 .. +11
    zoomRightOffset: 4,          // zoom box:  title.right − 11 .. −4
    collapseGap: 2,              // collapse box sits inboard of zoom by this gap
  },
  // Min-cicn cell widths (px) for the recipe: fixed left (corner+close),
  // 1px stretch title cell, fixed right (zoom+collapse+corner).
  cells: {
    leftFixed: 4 + 7 + 4,        // inset + close box + margin = 15
    titleStretch: 1,             // 1px band the compositor stretches/tiles
    rightFixed: 4 + 7 + 2 + 7 + 4, // margin + zoom + gap + collapse + inset = 24
  },
};
```

- [ ] **Step 4: Run it — expect pass**

Run: `node --test scripts/generate-platinum/metrics.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-platinum/metrics.mjs scripts/generate-platinum/metrics.test.mjs
git commit -m "feat(platinum-gen): executable Platinum metrics from the WDEF decode"
```

---

### Task 3: Color-source step → palette module

**Files:**
- Create: `scripts/generate-platinum/sample-palette.mjs`
- Create: `scripts/generate-platinum/palette.mjs`
- Create: `scripts/generate-platinum/palette.test.mjs`

This is the "decode the authentic color source first" step. `sample-palette.mjs` samples the in-repo `apple-platinum-2` control cicns at the decode-pinned face/bevel pixels and cross-checks the System-file `clut`/`wctb`; it prints each slot's value + source. You then transcribe the agreed values into `palette.mjs`. **If a slot can't be sourced, leave it out and flag it — do not invent a gray.**

- [ ] **Step 1: Write the failing test (palette shape + gray-ramp invariant)**

```js
// scripts/generate-platinum/palette.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SLOTS } from './palette.mjs';

test('palette defines every required slot as an [r,g,b] triple', () => {
  for (const slot of SLOTS) {
    const c = PALETTE[slot];
    assert.ok(Array.isArray(c) && c.length === 3, `missing/!triple: ${slot}`);
    c.forEach((v) => assert.ok(Number.isInteger(v) && v >= 0 && v <= 255));
  }
});
test('each Platinum slot is a near-neutral gray (R≈G≈B within 8)', () => {
  for (const slot of SLOTS) {
    const [r, g, b] = PALETTE[slot];
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 8, `not gray: ${slot} = ${r},${g},${b}`);
  }
});
test('the bevel ramp is ordered light→dark', () => {
  const lum = ([r, g, b]) => r + g + b;
  assert.ok(lum(PALETTE.bevelHighlight) > lum(PALETTE.titleFillBack));
  assert.ok(lum(PALETTE.titleFillBack) > lum(PALETTE.bevelShadow));
});
```

- [ ] **Step 2: Run it — expect failure (module missing)**

Run: `node --test scripts/generate-platinum/palette.test.mjs`
Expected: FAIL — cannot find `./palette.mjs`.

- [ ] **Step 3: Write the sampler and run the investigation**

```js
// scripts/generate-platinum/sample-palette.mjs
// Color-source step: sample the in-repo apple-platinum-2 control cicns at the
// face/bevel pixels the WDEF decode pins, and (optional) cross-check the System
// file's clut/wctb. Prints per-slot RGB + source for review; transcribe into palette.mjs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'node:zlib'; // NOTE: replace with the project's PNG decode path

// Pragmatic approach: read a known apple-platinum-2 control PNG (e.g. a scrollbar
// or button face) and sample representative pixels. The repo PNGs are RGBA written
// by encodePng; decode via a minimal inflate or by loading through an existing
// decoder. Print a table of {slot, rgb, sourceFile, x, y}.
// (Implementer: pick concrete sample points from apple-platinum-2's button/scrollbar
//  faces + bevels; the decode names the slots — titleFillFore/Back, bevelHighlight/
//  Shadow, frameOutline, widgetFace, titleText.)
console.log('Sampling apple-platinum-2 for the Platinum gray ramp…');
// …implementer fills the concrete sampling per the slots in SLOTS below…
```

Run: `node scripts/generate-platinum/sample-palette.mjs` and record the per-slot values + their source for the PROVENANCE note. If `apple-platinum-2` and the System `clut`/`wctb` diverge materially, STOP and surface both for the user to adjudicate (do not pick silently).

- [ ] **Step 4: Author `palette.mjs` from the sampled values**

```js
// scripts/generate-platinum/palette.mjs
// Platinum gray ramp. Values sampled from the in-repo apple-platinum-2 scheme
// (a licensed real Platinum Kaleidoscope scheme) at the slot pixels the WDEF
// decode pins, cross-checked vs the 8.5 System file clut/wctb. Source per slot
// recorded in themes/apple-platinum-replica/PROVENANCE.md.
// REPLACE the placeholder triples below with the Task-3 sampled values.
export const SLOTS = [
  'frameOutline', 'titleFillFore', 'titleFillBack',
  'bevelHighlight', 'bevelShadow', 'widgetFace', 'titleText',
];
export const PALETTE = {
  frameOutline:   [0, 0, 0],        // from sample-palette.mjs
  titleFillFore:  [0, 0, 0],        // from sample-palette.mjs
  titleFillBack:  [0, 0, 0],        // from sample-palette.mjs
  bevelHighlight: [0, 0, 0],        // from sample-palette.mjs
  bevelShadow:    [0, 0, 0],        // from sample-palette.mjs
  widgetFace:     [0, 0, 0],        // from sample-palette.mjs
  titleText:      [0, 0, 0],        // from sample-palette.mjs
};
```

> The `[0,0,0]` triples are the ONLY values written before sampling; Step 4 replaces each with the recorded sample. The gray-ramp test (Step 1) fails until they are real, which is the gate that they were filled.

- [ ] **Step 5: Run the test — expect pass once values are filled**

Run: `node --test scripts/generate-platinum/palette.test.mjs`
Expected: PASS (3 tests). If the gray-ramp test fails, a slot is wrong or unsourced — revisit Step 3, do not loosen the test.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-platinum/sample-palette.mjs scripts/generate-platinum/palette.mjs scripts/generate-platinum/palette.test.mjs
git commit -m "feat(platinum-gen): Platinum gray ramp sampled from apple-platinum-2 (color-source step)"
```

---

### Task 4: Drawing core — the min-cicn frame + stipple

**Files:**
- Create: `scripts/generate-platinum/draw-document-window.mjs`
- Create: `scripts/generate-platinum/draw-document-window.test.mjs`

- [ ] **Step 1: Write the failing test (structural pixel assertions)**

```js
// scripts/generate-platinum/draw-document-window.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawDocumentWindow } from './draw-document-window.mjs';
import { PALETTE } from './palette.mjs';
import { METRICS } from './metrics.mjs';

const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
};

test('active min-cicn: top-left is the bevel highlight, stipple alternates per row', () => {
  const { active } = drawDocumentWindow(PALETTE);
  assert.deepEqual(px(active, 0, 0), PALETTE.bevelHighlight);     // raised: top/left light
  // title fill stipple: row 0 has fore at an even column, row 1 is back
  const titleY0 = METRICS.frameInset;          // first title row
  assert.deepEqual(px(active, METRICS.cells.leftFixed, titleY0), PALETTE.titleFillFore);
  assert.deepEqual(px(active, METRICS.cells.leftFixed, titleY0 + 1), PALETTE.titleFillBack);
});

test('active min-cicn: bottom-right edge is the bevel shadow', () => {
  const { active } = drawDocumentWindow(PALETTE);
  assert.deepEqual(px(active, active.width - 1, active.height - 1), PALETTE.bevelShadow);
});

test('returns active + inactive + stipple buffers with sane dimensions', () => {
  const out = drawDocumentWindow(PALETTE);
  for (const k of ['active', 'inactive', 'stipple']) {
    assert.ok(out[k].width > 0 && out[k].height > 0 && out[k].rgba.length === out[k].width * out[k].height * 4);
  }
  assert.equal(out.active.height, METRICS.titleBarHeight + 2 * METRICS.frameInset + 1);
});
```

- [ ] **Step 2: Run it — expect failure (module missing)**

Run: `node --test scripts/generate-platinum/draw-document-window.test.mjs`
Expected: FAIL — cannot find `./draw-document-window.mjs`.

- [ ] **Step 3: Implement the drawing core**

```js
// scripts/generate-platinum/draw-document-window.mjs
// Draws the minimum-size Platinum document-window cicn (active + inactive) and
// the title stipple ppat, from METRICS + PALETTE. Pure: returns RGBA buffers.
// Uses a tiny inline RGBA helper (the .mjs generator can't import the TS PixelBuffer).
import { METRICS } from './metrics.mjs';

function buf(w, h) { return { width: w, height: h, rgba: new Uint8Array(w * h * 4) }; }
function set(img, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4; img.rgba[i] = r; img.rgba[i + 1] = g; img.rgba[i + 2] = b; img.rgba[i + 3] = a;
}
function fill(img, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(img, x, y, c); }
function hline(img, x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(img, x, y, c); }
function vline(img, x, y0, y1, c) { for (let y = y0; y <= y1; y++) set(img, x, y, c); }

// Draw one frame state given its title fore/back colors.
function drawFrame(titleFore, titleBack, p) {
  const inset = METRICS.frameInset;
  const width = METRICS.cells.leftFixed + METRICS.cells.titleStretch + METRICS.cells.rightFixed;
  const height = METRICS.titleBarHeight + 2 * inset + 1; // title + top/bottom frame + 1px body band
  const img = buf(width, height);

  // Title bar fill: AA00 stipple in fore/back (row parity → fore at even cols on even rows).
  const titleTop = inset, titleBot = inset + METRICS.titleBarHeight - 1;
  for (let y = titleTop; y <= titleBot; y++) {
    const rowByte = METRICS.stipple[(y - titleTop) % METRICS.stipple.length];
    for (let x = inset; x < width - inset; x++) {
      const bit = (rowByte >> (7 - (x % 8))) & 1;
      set(img, x, y, bit ? titleFore : titleBack);
    }
  }

  // 1px raised bevel: top + left = highlight, bottom + right = shadow; outer outline frame.
  hline(img, 0, width - 1, 0, p.bevelHighlight);
  vline(img, 0, 0, height - 1, p.bevelHighlight);
  hline(img, 0, width - 1, height - 1, p.bevelShadow);
  vline(img, width - 1, 0, height - 1, p.bevelShadow);
  // Frame outline under the title bar (separates title from body).
  hline(img, inset, width - 1 - inset, titleBot + 1, p.frameOutline);

  // Widget boxes (close at left, zoom + collapse at right), beveled faces.
  const wy = titleTop + Math.max(0, Math.floor((METRICS.titleBarHeight - METRICS.widget.size) / 2));
  drawWidget(img, inset + METRICS.widget.closeLeftOffset - inset + inset, wy, p); // close: title.left+4
  const rightZoomX = width - inset - METRICS.widget.zoomRightOffset - METRICS.widget.size;
  drawWidget(img, rightZoomX, wy, p);
  drawWidget(img, rightZoomX - METRICS.widget.collapseGap - METRICS.widget.size, wy, p);

  // Title-text colour MARKER pixel at the cinf textPixel anchor (the kDEF samples
  // title text colour from this cicn pixel — see reference_title_text_color).
  set(img, TEXT_MARKER.x, TEXT_MARKER.y, p.titleText);

  return img;
}

function drawWidget(img, x, y, p) {
  const s = METRICS.widget.size;
  fill(img, x, y, s, s, p.widgetFace);
  hline(img, x, x + s - 1, y, p.bevelHighlight);
  vline(img, x, y, y + s - 1, p.bevelHighlight);
  hline(img, x, x + s - 1, y + s - 1, p.bevelShadow);
  vline(img, x + s - 1, y, y + s - 1, p.bevelShadow);
  // 1px outline
  // (outline drawn last so it frames the box)
}

// The textPixel anchor used by the cinf (Task 5 must use the SAME coords).
export const TEXT_MARKER = { x: 0, y: 0 }; // top-left transparent-safe marker; Task 5 references this

function drawStipple(titleFore, titleBack) {
  const img = buf(8, METRICS.stipple.length);
  for (let y = 0; y < img.height; y++) {
    const rowByte = METRICS.stipple[y % METRICS.stipple.length];
    for (let x = 0; x < 8; x++) set(img, x, y, ((rowByte >> (7 - x)) & 1) ? titleFore : titleBack);
  }
  return img;
}

export function drawDocumentWindow(palette) {
  return {
    active:   drawFrame(palette.titleFillFore, palette.titleFillBack, palette),
    inactive: drawFrame(palette.titleFillBack, palette.titleFillBack, palette), // inactive: flat, no fore stripe
    stipple:  drawStipple(palette.titleFillFore, palette.titleFillBack),
  };
}
```

> Implementer note: the widget-x arithmetic and `TEXT_MARKER` are first-cut; Task 7's render pass tunes exact widget placement and the marker location against the reference. The structural tests (Step 1) must keep passing.

- [ ] **Step 4: Run it — expect pass**

Run: `node --test scripts/generate-platinum/draw-document-window.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-platinum/draw-document-window.mjs scripts/generate-platinum/draw-document-window.test.mjs
git commit -m "feat(platinum-gen): draw the min-size Platinum document-window cicn + stipple"
```

---

### Task 5: Manifest synthesizer (cicn/ppat/wnd#/cinf)

**Files:**
- Create: `scripts/generate-platinum/manifest.mjs`
- Create: `scripts/generate-platinum/manifest.test.mjs`

The wnd# recipe uses canonical document-window IDs and the END-based part-code model. Use an existing corpus scheme's document-window `wnd#` as the structural template — read `themes/1138/extraction-manifest.json` (a `wnd#` asset's `data`) to confirm the part-code/border shape, then build ours with `METRICS.cells` borders.

- [ ] **Step 1: Write the failing test (manifest → buildThemeJson → validateTheme)**

```js
// scripts/generate-platinum/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentWindowAssets } from './manifest.mjs';
import { buildThemeJson } from '../../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../../tools/theme-loader/validateTheme.js';

const drawn = {
  active:   { width: 40, height: 22 },
  inactive: { width: 40, height: 22 },
  stipple:  { width: 8, height: 8 },
};

test('assets carry canonical document-window IDs (inactive -14336, active -14335)', () => {
  const assets = buildDocumentWindowAssets(drawn);
  const ids = assets.filter(a => a.type === 'cicn').map(a => a.id).sort((x, y) => x - y);
  assert.deepEqual(ids, [-14336, -14335]);
  assert.ok(assets.some(a => a.type === 'wnd#' && a.id === -14336));
});

test('buildThemeJson yields a document-window type with active+inactive chrome, and validates', () => {
  const assets = buildDocumentWindowAssets(drawn);
  const theme = buildThemeJson({ source: 'generated', extractedAt: 'x', counts: {}, assets });
  assert.ok(theme.windowTypes['document-window'], 'document-window window type present');
  assert.ok(theme.windowTypes['document-window'].chrome.active);
  assert.ok(theme.windowTypes['document-window'].chrome.inactive);
  assert.doesNotThrow(() => validateTheme(theme));
});
```

- [ ] **Step 2: Run it — expect failure (module missing)**

Run: `node --test scripts/generate-platinum/manifest.test.mjs`
Expected: FAIL — cannot find `./manifest.mjs`.

- [ ] **Step 3: Implement the synthesizer**

```js
// scripts/generate-platinum/manifest.mjs
// Synthesize the document-window manifest assets in the extractor's shape, so
// the real buildThemeJson pairs them (inactive = wndId, active = wndId+1) and
// emits a 'document-window' windowType.
import { METRICS } from './metrics.mjs';

const WND_ID = -14336;            // canonical Mac OS document-window wnd# (→ slug 'document-window')
const CICN_INACTIVE = -14336;     // pairChromeStates: inactive = wndId
const CICN_ACTIVE = -14335;       // active = wndId + 1
const PPAT_STIPPLE = 128;

// Title-stretch grower part code (kDEF growers: 8/11/12/13/14/18). Corners/widget
// cells are FIXED (any non-grower code). See docs/spec/kdef231-recipe-walk.md.
const STRETCH = 8, FIXED = 0;

export function buildDocumentWindowAssets(drawn) {
  const inset = METRICS.frameInset;
  const W = drawn.active.width, H = drawn.active.height;
  const leftEnd = METRICS.cells.leftFixed;
  const stretchEnd = leftEnd + METRICS.cells.titleStretch;

  // wnd# data shape per decoders/wnd.js: { rectangles, topSide, bottomSide, leftSide, rightSide }
  const wndData = {
    rectangles: [
      // part 0 = content/body rect inside the frame (left, top, right, bottom in Mac order top,left,bottom,right)
      { part: 0, rect: { top: METRICS.titleBarHeight + inset + 1, left: inset, bottom: H - inset, right: W - inset } },
    ],
    // END-based: each {part, border} closes a cell at pixel `border`.
    topSide: [
      { part: FIXED, border: leftEnd },         // [0, leftEnd) fixed leading corner + close cell
      { part: STRETCH, border: stretchEnd },     // [leftEnd, stretchEnd) stretch title cell
      { part: FIXED, border: W },                // [stretchEnd, W) fixed right widget cell + corner
    ],
    bottomSide: [{ part: FIXED, border: W }],    // 1px band, tiles
    leftSide:   [{ part: FIXED, border: H }],
    rightSide:  [{ part: FIXED, border: H }],
  };

  // cinf data shape per decoders/cinf.js — stretch (tileSides=0), title text anchor.
  const cinfData = {
    cornerSize: inset, sideThickness: inset, tileSides: 0, patternAnchor: 0,
    resizeBehavior: 'stretch-whole', bgPatternId: 0,
    bgPixel: { x: 0, y: 0 },
    textPixel: { x: 0, y: 0 },     // MUST equal draw-document-window TEXT_MARKER
    embossPixel: { x: 0, y: 0 },
  };

  return [
    { type: 'cicn', id: CICN_INACTIVE, name: 'Document Window', status: 'ok',
      file: 'cicns/cicn-n14336-document-window-inactive.png', width: drawn.inactive.width, height: drawn.inactive.height },
    { type: 'cicn', id: CICN_ACTIVE, name: 'Active Document Window', status: 'ok',
      file: 'cicns/cicn-n14335-active-document-window.png', width: drawn.active.width, height: drawn.active.height },
    { type: 'ppat', id: PPAT_STIPPLE, name: 'Title Pinstripe', status: 'ok',
      file: 'ppats/ppat-128-title-pinstripe.png', width: drawn.stipple.width, height: drawn.stipple.height },
    { type: 'wnd#', id: WND_ID, name: 'Document Window', status: 'ok', data: wndData },
    { type: 'cinf', id: WND_ID, name: 'Document Window', status: 'ok', data: cinfData },
  ];
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `node --test scripts/generate-platinum/manifest.test.mjs`
Expected: PASS (2 tests). If `validateTheme` throws, the error names the offending field — fix the corresponding asset shape; do not weaken the validator.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-platinum/manifest.mjs scripts/generate-platinum/manifest.test.mjs
git commit -m "feat(platinum-gen): synthesize document-window cicn/ppat/wnd#/cinf manifest"
```

---

### Task 6: Generator entry script + bundle output

**Files:**
- Create: `scripts/generate-platinum.mjs`
- Create: `themes/apple-platinum-replica/meta.json`
- Create: `themes/apple-platinum-replica/PROVENANCE.md`

- [ ] **Step 1: Author the provenance inputs**

```json
// themes/apple-platinum-replica/meta.json
{
  "name": "Apple Platinum (replica)",
  "author": { "name": "Scriptoscope (generated)", "year": 2026 },
  "origin": {
    "kind": "first-party-generated",
    "originalFormat": "generated",
    "originalLicense": "First-party clean-room reproduction. Drawn from the decoded Mac OS 8.5 WDEF 125 algorithm (docs/spec/platinum-wdef125-decode.md); no Apple bitmaps shipped.",
    "sourceUrl": "docs/superpowers/specs/2026-05-24-platinum-theme-generator-design.md"
  }
}
```

```markdown
<!-- themes/apple-platinum-replica/PROVENANCE.md -->
# Apple Platinum (replica) — provenance

Clean-room reproduction of the Mac OS 8.5 Platinum **document window**, generated by
`scripts/generate-platinum.mjs` from the decoded `WDEF 125` algorithm
(`docs/spec/platinum-wdef125-decode.md`). No Apple bitmaps are shipped — every
pixel is drawn from the decoded geometry + a gray ramp sampled from the in-repo
`apple-platinum-2` scheme (per-slot sources below).

- Geometry: `scripts/generate-platinum/metrics.mjs` (from the WDEF decode Constants).
- Palette: `scripts/generate-platinum/palette.mjs` (Task 3 sources, per slot).
- This bundle is regenerated with `node scripts/generate-platinum.mjs` (not from a `.ksc`).
```

- [ ] **Step 2: Write the entry script**

```js
// scripts/generate-platinum.mjs
// Generate the Apple Platinum (replica) theme bundle: draw → write PNGs →
// assemble manifest + meta → buildThemeJson → validateTheme → write bundle.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { drawDocumentWindow } from './generate-platinum/draw-document-window.mjs';
import { buildDocumentWindowAssets } from './generate-platinum/manifest.mjs';
import { PALETTE } from './generate-platinum/palette.mjs';
import { buildThemeJson } from '../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../tools/theme-loader/validateTheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
mkdirSync(resolve(dest, 'cicns'), { recursive: true });
mkdirSync(resolve(dest, 'ppats'), { recursive: true });

const drawn = drawDocumentWindow(PALETTE);
const assets = buildDocumentWindowAssets(drawn);

// Write each raster asset's PNG to the path recorded in its manifest entry.
const imgByFile = {
  'cicns/cicn-n14336-document-window-inactive.png': drawn.inactive,
  'cicns/cicn-n14335-active-document-window.png': drawn.active,
  'ppats/ppat-128-title-pinstripe.png': drawn.stipple,
};
for (const a of assets) {
  if (!a.file) continue;
  const img = imgByFile[a.file];
  writeFileSync(resolve(dest, a.file), encodePng(img.width, img.height, img.rgba));
}

const extractedAt = new Date().toISOString();
const counts = { total: assets.length, ok: assets.length, skipped: 0, errored: 0 };
writeFileSync(resolve(dest, 'extraction-manifest.json'),
  JSON.stringify({ source: 'generated', extractedAt, counts, assets }, null, 2));

const metaPath = resolve(dest, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
const theme = buildThemeJson({ source: 'apple-platinum-replica (generated)', extractedAt, counts, assets }, { meta });

try { validateTheme(theme); }
catch (err) { console.error('schema validation FAILED:', err.message); process.exit(1); }

writeFileSync(resolve(dest, 'theme.json'), JSON.stringify(theme, null, 2));
console.log(`[apple-platinum-replica] window types: ${Object.keys(theme.windowTypes || {}).join(', ')}; ` +
  `chrome elements: ${Object.keys(theme.chromeElements || {}).length}`);
```

- [ ] **Step 3: Run the generator**

Run: `node scripts/generate-platinum.mjs`
Expected: exit 0; logs `window types: document-window; …`; `themes/apple-platinum-replica/theme.json` + PNGs written.

- [ ] **Step 4: Verify the bundle with the project nets**

Run: `npm run lint:themes`
Expected: the new bundle appears and passes (no missing-recipe / out-of-bounds errors for `apple-platinum-replica`). If `lint:themes` only scans `scheme.rsrc` bundles, note that and confirm the generated bundle's `theme.json` is well-formed via the validator (already enforced in Step 3).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-platinum.mjs themes/apple-platinum-replica/
git commit -m "feat(platinum-gen): generate the Apple Platinum (replica) document-window bundle"
```

---

### Task 7: Render + visual validation (calibrate)

**Files:**
- Modify (tune, if the render reveals issues): `scripts/generate-platinum/metrics.mjs`, `scripts/generate-platinum/draw-document-window.mjs`

- [ ] **Step 1: Render the document window**

Run: `npm run diag:render` (renders each window type to PNG; see `scripts/render-window.mjs` for the output dir, typically `themes/<slug>/diag/`). Confirm `apple-platinum-replica` renders a document window at several sizes.

- [ ] **Step 2: Inspect against the reference**

Open the rendered PNGs and compare to a Platinum reference (the `apple-platinum-2` scheme's own controls, or a reference screenshot). Check: title-bar stipple reads as fine pinstripe with no smear/seam at width; the 1px raised bevel is correct (top/left light, bottom/right dark); the three widget boxes sit at the correct ends and don't overlap the title region; the body frame is 1px.

- [ ] **Step 3: Tune the open metrics and regenerate**

If the render is off, adjust ONLY the flagged-as-tunable values: `METRICS.titleBarHeight`, the `TEXT_MARKER`/`cinf.textPixel` anchor, and the widget x-arithmetic in `draw-document-window.mjs`. Re-run `node scripts/generate-platinum.mjs` and `npm run diag:render` until the document window matches. Keep all unit tests passing (`node --test scripts/generate-platinum/`). Do NOT change decode-sourced constants (insets, stipple, widget size, palette) — if those look wrong, the decode or the sample is wrong, and that's a flag to revisit Task 2/3, not to fudge here.

- [ ] **Step 4: Commit the calibration**

```bash
git add scripts/generate-platinum/
git commit -m "fix(platinum-gen): calibrate document-window metrics against the reference render"
```

---

## Out of scope (separate sub-projects / plans)

- **L2** — all other window types (utility, dialog, alert, popup, collapsed): same generator, more recipes.
- **L3** — controls (scrollbars, buttons, etc.): needs a controls-CDEF decode first.
- **L4** — menus / popups / misc.
- **④** — base-layer inheritance in the loader (partial scheme → Platinum fallback).

## Self-Review

**Spec coverage:** generator framework (Tasks 1,6) ✓; color-source step (Task 3) ✓; min-cicn drawing core (Task 4) ✓; manifest synthesizer with canonical IDs (Task 5) ✓; document-window L1 bundle (Task 6) ✓; validation via validateTheme + lint:themes + diag:render (Tasks 6,7) ✓; provenance `first-party-generated` (Task 6, and validator accepts any string kind — no schema change) ✓. Frozen-parameter handling (titleBarHeight tuned in Task 7) ✓.

**Placeholder note:** the `[0,0,0]` palette triples (Task 3) and the `sample-palette.mjs` body are deliberately filled by the Task-3 investigation (the values are *sourced*, not inventable in advance); the gray-ramp test is the gate that they were filled with real data. This is intentional, not a placeholder gap — sourcing colors before drawing is a spec requirement ("decode the authentic color source first").

**Type/name consistency:** `drawDocumentWindow(PALETTE) → {active,inactive,stipple}` (Task 4) consumed unchanged in Tasks 5/6; `buildDocumentWindowAssets(drawn) → ManifestAsset[]` (Task 5) consumed in Task 6; `encodePng(w,h,rgba)` (Task 1) used in Task 6; `METRICS`/`PALETTE`/`SLOTS` names consistent across tasks; the `cinf.textPixel` ↔ `draw-document-window TEXT_MARKER` coupling is called out in both Task 4 and Task 5.
