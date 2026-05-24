// scripts/generate-platinum/draw-document-window.mjs
// Draws the minimum-size Platinum document-window cicn (active + inactive) and
// the title stipple ppat, from METRICS + PALETTE. Pure: returns RGBA buffers.
// Uses a tiny inline RGBA helper (the .mjs generator can't import the TS PixelBuffer).
//
// Polarity per docs/spec/platinum-wdef125-decode.md "Frame & bevel insets":
// the window reads RAISED — top/left = highlight, bottom/right = shadow. The
// title fill is the code-baked AA00 stipple tiled in titleFillFore/Back.
import { METRICS } from './metrics.mjs';

function buf(w, h) { return { width: w, height: h, rgba: new Uint8Array(w * h * 4) }; }
function set(img, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4; img.rgba[i] = r; img.rgba[i + 1] = g; img.rgba[i + 2] = b; img.rgba[i + 3] = a;
}
function fill(img, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(img, x, y, c); }
function hline(img, x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(img, x, y, c); }
function vline(img, x, y0, y1, c) { for (let y = y0; y <= y1; y++) set(img, x, y, c); }

// The textPixel anchor used by the cinf (Task 5 references the SAME coords).
// Top-left of the title fill band — a stable, in-bounds marker pixel.
export const TEXT_MARKER = { x: METRICS.frameInset, y: METRICS.frameInset };

// Draw one frame state given its title fore/back colors.
function drawFrame(titleFore, titleBack, p) {
  const inset = METRICS.frameInset;
  const width = METRICS.cells.leftFixed + METRICS.cells.titleStretch + METRICS.cells.rightFixed;
  const height = METRICS.titleBarHeight + 2 * inset + 1; // title + top/bottom frame + 1px body band
  const img = buf(width, height);

  // Title bar fill: AA00 stipple in fore/back. Row parity from the 8-byte tile,
  // column bit MSB-first so the lit stripe lands on even columns.
  const titleTop = inset, titleBot = inset + METRICS.titleBarHeight - 1;
  for (let y = titleTop; y <= titleBot; y++) {
    const rowByte = METRICS.stipple[(y - titleTop) % METRICS.stipple.length];
    for (let x = inset; x < width - inset; x++) {
      const bit = (rowByte >> (x % 8)) & 1;
      set(img, x, y, bit ? titleFore : titleBack);
    }
  }

  // Body band (the 1px stretch row below the title divider): mid-gray face.
  fill(img, inset, titleBot + 2, width - 2 * inset, height - inset - (titleBot + 2), p.widgetFace);

  // Frame outline under the title bar (separates title from body).
  hline(img, inset, width - 1 - inset, titleBot + 1, p.frameOutline);

  // Widget boxes (close at left, zoom + collapse at right), beveled faces.
  const wy = titleTop + Math.max(0, Math.floor((METRICS.titleBarHeight - METRICS.widget.size) / 2));
  drawWidget(img, inset + METRICS.widget.closeLeftOffset, wy, p); // close: title.left + 4
  const rightZoomX = width - inset - METRICS.widget.zoomRightOffset - METRICS.widget.size;
  drawWidget(img, rightZoomX, wy, p);
  drawWidget(img, rightZoomX - METRICS.widget.collapseGap - METRICS.widget.size, wy, p);

  // 1px raised bevel: top + left = highlight, bottom + right = shadow.
  // Drawn LAST so the window's outer raised edge frames everything.
  hline(img, 0, width - 1, 0, p.bevelHighlight);
  vline(img, 0, 0, height - 1, p.bevelHighlight);
  hline(img, 0, width - 1, height - 1, p.bevelShadow);
  vline(img, width - 1, 0, height - 1, p.bevelShadow);

  // Title-text colour MARKER pixel at the cinf textPixel anchor (the kDEF samples
  // title text colour from this cicn pixel). Kept in the title band, in bounds.
  set(img, TEXT_MARKER.x, TEXT_MARKER.y, p.titleText);

  return img;
}

function drawWidget(img, x, y, p) {
  const s = METRICS.widget.size;
  fill(img, x, y, s, s, p.widgetFace);
  // raised bevel: top/left highlight, bottom/right shadow
  hline(img, x, x + s - 1, y, p.bevelHighlight);
  vline(img, x, y, y + s - 1, p.bevelHighlight);
  hline(img, x, x + s - 1, y + s - 1, p.bevelShadow);
  vline(img, x + s - 1, y, y + s - 1, p.bevelShadow);
}

function drawStipple(titleFore, titleBack) {
  const img = buf(8, METRICS.stipple.length);
  for (let y = 0; y < img.height; y++) {
    const rowByte = METRICS.stipple[y % METRICS.stipple.length];
    for (let x = 0; x < 8; x++) set(img, x, y, ((rowByte >> x) & 1) ? titleFore : titleBack);
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
