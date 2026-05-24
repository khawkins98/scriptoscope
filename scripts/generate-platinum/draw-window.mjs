// scripts/generate-platinum/draw-window.mjs
// Generic placeholder drawer for any Platinum window type. Parameterised by a
// WindowTypeConfig (window-types.mjs) + the shared PALETTE/METRICS. Pure:
// returns { active, inactive } RGBA buffers (the two min-size cicn sprites).
//
// The art is a ROUGH scaffold meant to be hand-painted over in the atlas — the
// load-bearing output is the dimensions + the slice recipe (manifest.mjs). It
// lifts the document-window's row-uniform pinstripe + black-outline + 7×7
// raised-bevel widget glyphs so the placeholder reads as Platinum chrome.
import { METRICS } from './metrics.mjs';
import { geometryFor } from './window-types.mjs';

function buf(w, h) { return { width: w, height: h, rgba: new Uint8Array(w * h * 4) }; }
function set(img, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4; img.rgba[i] = r; img.rgba[i + 1] = g; img.rgba[i + 2] = b; img.rgba[i + 3] = a;
}
function fill(img, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(img, x, y, c); }
function hline(img, x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(img, x, y, c); }
function vline(img, x, y0, y1, c) { for (let y = y0; y <= y1; y++) set(img, x, y, c); }

function drawWidget(img, x, y, p, glyph) {
  const s = METRICS.widget.size;
  fill(img, x, y, s, s, p.widgetFace);
  hline(img, x, x + s - 1, y, p.bevelHighlight);
  vline(img, x, y, y + s - 1, p.bevelHighlight);
  hline(img, x, x + s - 1, y + s - 1, p.bevelShadow);
  vline(img, x + s - 1, y, y + s - 1, p.bevelShadow);
  if (glyph === 'zoom') {
    hline(img, x + 1, x + s - 2, y + 1, p.frameOutline);
    hline(img, x + 1, x + s - 2, y + s - 2, p.frameOutline);
    vline(img, x + 1, y + 1, y + s - 2, p.frameOutline);
    vline(img, x + s - 2, y + 1, y + s - 2, p.frameOutline);
  } else if (glyph === 'collapse') {
    hline(img, x + 1, x + s - 2, y + (s >> 1), p.frameOutline);
  }
}

// Draw one frame state for an arbitrary window-type config.
function drawFrame(cfg, geo, titleFore, titleBack, p) {
  const { width, height, inset, barH, hasTitle, topFrame, widgetSlots } = geo;
  const img = buf(width, height);

  if (hasTitle) {
    // Title band: rows [inset, inset+barH) — row-uniform pinstripe
    // (tile-invariant; see draw-document-window). The title/body divider is the
    // body band itself: row `topFrame` (= inset + barH), drawn as the dark
    // separator line (content overlays it at composite time).
    const titleTop = inset, titleBot = inset + barH - 1;
    for (let y = titleTop; y <= titleBot; y++) {
      const rowByte = METRICS.stipple[(y - titleTop) % METRICS.stipple.length];
      const c = rowByte ? titleFore : titleBack;
      for (let x = inset; x < width - inset; x++) set(img, x, y, c);
    }
    hline(img, inset, width - 1 - inset, topFrame, p.frameOutline);
    for (const w of widgetSlots) drawWidget(img, w.x, w.y, p, w.glyph);
  } else {
    // Title-less frame: a flat mid-gray top frame band (dialog/alert/no-title),
    // plus the 1px body band below it.
    fill(img, inset, inset, width - 2 * inset, height - 2 * inset, p.widgetFace);
  }

  // 1px black outer window outline.
  hline(img, 0, width - 1, 0, p.frameOutline);
  vline(img, 0, 0, height - 1, p.frameOutline);
  hline(img, 0, width - 1, height - 1, p.frameOutline);
  vline(img, width - 1, 0, height - 1, p.frameOutline);

  // Title-text colour MARKER pixel at the cinf textPixel anchor (in bounds).
  set(img, inset, inset, p.titleText);
  return img;
}

/**
 * Draw both cicn states for a window-type config.
 * @returns {{active: {width,height,rgba}, inactive: {width,height,rgba}, geo: object}}
 */
export function drawWindow(cfg, palette) {
  const geo = geometryFor(cfg);
  return {
    geo,
    active:   drawFrame(cfg, geo, palette.titleFillFore, palette.titleFillBack, palette),
    inactive: drawFrame(cfg, geo, palette.titleFillBack, palette.titleFillBack, palette),
  };
}
