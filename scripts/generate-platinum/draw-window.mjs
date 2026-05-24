// scripts/generate-platinum/draw-window.mjs
// Platinum window-type drawer. Parameterised by a WindowTypeConfig
// (window-types.mjs) + the shared PALETTE/METRICS. Pure: returns
// { active, inactive } RGBA buffers (the two min-size cicn sprites).
//
// The document-window (geo.hasPlate) path reimplements the REAL Mac OS 8
// Platinum title-bar drawing sequence decoded from WDEF 125
// (docs/spec/platinum-wdef125-decode.md), using reference-sampled grays:
//   1. 1px black outer frame around the whole min-cicn perimeter.
//   2. Window bevel inside the outline: title-bar TOP inner row = white
//      highlight, BOTTOM inner row = #999 shadow (raised bar).
//   3. Title fill: flank regions get a 2-row pinstripe (even rows white,
//      odd rows #777); the centered plate cell is solid #ccc (title sits here).
//   4. Widgets: #ccc face, top/left white + bottom/right #777 bevel, black
//      outline + black glyph.
//   Inactive: the bar drops the pinstripe — solid #ccc flank + plate, same
//   frame + beveled widgets, no white/#777 stripes.
//
// Other (non-plate) window types keep the simpler row-uniform pinstripe + body
// band scaffold — they are not the subject of the WDEF-125 decode here.
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

// Widget box per the decode (WDEF 125 @0x904) + reference: a crisp 1px BLACK
// outer frame, then (inset 1) a #ccc face with an inner raised bevel
// (top/left white highlight, bottom/right #777 shadow). Glyph (inset 2) in black.
function drawWidget(img, x, y, p, glyph, size) {
  const s = size ?? METRICS.widget.size;
  const frame = [34, 34, 34]; // #222 dark box frame (reference-sampled, not pure black)
  // Convex 2-D "pillow" interior, sampled from a real Platinum close box: it
  // brightens top→bottom (~150 top → ~226 bottom) AND dims toward the left/right
  // edges (center is the bright sheen, edges fall ~28 darker). The old flat
  // per-row vertical gradient missed the horizontal falloff — the box read flat.
  const topV = 150, botV = 226, edgeDim = 28, cx = (s - 1) / 2;
  for (let yy = 1; yy < s - 1; yy++) {
    const ty = (s <= 3) ? 0 : (yy - 1) / (s - 3);
    const vy = topV + (botV - topV) * ty;
    for (let xx = 1; xx < s - 1; xx++) {
      const ex = cx ? Math.abs(xx - cx) / cx : 0;       // 0 center .. 1 edge
      const v = Math.max(0, Math.round(vy - edgeDim * ex));
      set(img, x + xx, y + yy, [v, v, v]);
    }
  }
  // 1px dark box frame (the crisp box outline the reference shows).
  hline(img, x, x + s - 1, y, frame);
  hline(img, x, x + s - 1, y + s - 1, frame);
  vline(img, x, y, y + s - 1, frame);
  vline(img, x + s - 1, y, y + s - 1, frame);
  // Glyphs, inset 2 so they sit inside the bevel.
  if (glyph === 'zoom') {
    hline(img, x + 2, x + s - 3, y + 2, p.frameOutline);
    hline(img, x + 2, x + s - 3, y + s - 3, p.frameOutline);
    vline(img, x + 2, y + 2, y + s - 3, p.frameOutline);
    vline(img, x + s - 3, y + 2, y + s - 3, p.frameOutline);
  } else if (glyph === 'collapse') {
    hline(img, x + 2, x + s - 3, y + (s >> 1), p.frameOutline);
  }
}

// The decoded document-window (plate) drawing sequence.
// `content` is the body-fill color (white for documents, #ccc for dialog-family).
function drawPlateFrame(geo, isActive, p, content) {
  const { width, height, inset, barH, topFrame, widgetSlots } = geo;
  const img = buf(width, height);

  const titleTop = inset, titleBot = inset + barH - 1; // bar rows [1, 20]
  const px0 = geo.leftFixed + geo.leftFill; // plate cell start (27)
  const px1 = px0 + geo.plate;              // plate cell end   (57)

  // 3. Title-bar fill — banded vertical structure measured from a real Platinum
  // bar (a flank column reads, top→bottom, below the black outline):
  //   row 0:        white highlight        (raised top edge)
  //   rows 1..2:    light #ccc bevel
  //   middle band:  pinstripe white / #777  (the textured fill)
  //   last 4 rows:  solid #ccc bevel
  //   last row:     #999 shadow             (raised bottom edge)
  // The pinstripe is INSET inside the solid bevel margins — it does NOT run the
  // full bar height. (Edge-to-edge pinstripe was the visible "too busy / wrong
  // scale" error: the real bar shows solid gray margins above and below.)
  const stripeTop = titleTop + 3;  // after 1 highlight + 2 light rows
  const stripeBot = titleBot - 5;  // before 4 solid rows + the shadow row
  for (let y = titleTop; y <= titleBot; y++) {
    let line;
    if (!isActive) {
      line = p.plateBase;                       // inactive bar: flat #ccc
    } else if (y === titleTop) {
      line = p.windowHighlight;                 // top highlight
    } else if (y === titleBot) {
      line = p.windowShadow;                    // bottom #999 shadow
    } else if (y >= stripeTop && y <= stripeBot) {
      line = ((y - stripeTop) % 2 === 0) ? p.pinstripeLight : p.pinstripeDark;
    } else {
      line = p.plateBase;                       // solid #ccc bevel margins
    }
    for (let x = inset; x < width - inset; x++) set(img, x, y, line);
  }
  // Plate cell: solid #ccc, overwriting the stripe band. (Title sits here.)
  for (let y = titleTop; y <= titleBot; y++)
    for (let x = px0; x < px1; x++) set(img, x, y, p.plateBase);

  // Content body band: fill the body region with the `content` color (white for
  // documents, #ccc for dialog-family). The title bar's #999 bottom-shadow row
  // (titleBot) is the title/content separator, and the 1px black perimeter
  // outline supplies the frame edges — so no separate black divider is drawn.
  fill(img, inset, topFrame, width - 2 * inset, height - inset - topFrame, content);

  // 4. Widgets.
  for (const w of widgetSlots) drawWidget(img, w.x, w.y, p, w.glyph, w.size);

  // 1. 1px black outer window outline around the whole perimeter.
  hline(img, 0, width - 1, 0, p.frameOutline);
  vline(img, 0, 0, height - 1, p.frameOutline);
  hline(img, 0, width - 1, height - 1, p.frameOutline);
  vline(img, width - 1, 0, height - 1, p.frameOutline);

  // 5. Title text + proxy icon are app-drawn at composite time — leave the
  // plate clear. A single in-bounds title-text marker pixel at the cinf anchor.
  set(img, inset, inset, p.titleText);
  return img;
}

// Draw one frame state for a non-plate window-type config (scaffold).
function drawFrame(cfg, geo, titleFore, titleBack, p) {
  const { width, height, inset, barH, hasTitle, topFrame, widgetSlots } = geo;
  const img = buf(width, height);

  if (hasTitle) {
    const titleTop = inset, titleBot = inset + barH - 1;
    for (let y = titleTop; y <= titleBot; y++) {
      const rowByte = METRICS.stipple[(y - titleTop) % METRICS.stipple.length];
      const c = rowByte ? titleFore : titleBack;
      for (let x = inset; x < width - inset; x++) set(img, x, y, c);
    }
    hline(img, inset, width - 1 - inset, topFrame, p.frameOutline);
    for (const w of widgetSlots) drawWidget(img, w.x, w.y, p, w.glyph, w.size);
  } else {
    // Title-less frame (dialog / alert / no-title utility): a raised #ccc body
    // framed by the real Platinum bevel — white top/left inner highlight, #999
    // bottom/right inner shadow, inside the 1px black outline (same bevel grays
    // as the title bar, so the title-less types read consistently). The bottom
    // outline is drawn first so the shadow band sits just inside it.
    const x0 = inset, y0 = inset, x1 = width - 1 - inset, y1 = height - 1 - inset;
    fill(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1, p.plateBase);
    hline(img, x0, x1, y0, p.windowHighlight); // top inner highlight
    vline(img, x0, y0, y1, p.windowHighlight); // left inner highlight
    hline(img, x0, x1, y1, p.windowShadow);    // bottom inner shadow
    vline(img, x1, y0, y1, p.windowShadow);    // right inner shadow
  }

  // 1px black outer window outline.
  hline(img, 0, width - 1, 0, p.frameOutline);
  vline(img, 0, 0, height - 1, p.frameOutline);
  hline(img, 0, width - 1, height - 1, p.frameOutline);
  vline(img, width - 1, 0, height - 1, p.frameOutline);

  set(img, inset, inset, p.titleText);
  return img;
}

/**
 * Draw both cicn states for a window-type config.
 * @returns {{active: {width,height,rgba}, inactive: {width,height,rgba}, geo: object}}
 */
export function drawWindow(cfg, palette) {
  const geo = geometryFor(cfg);
  if (geo.hasPlate) {
    // Dialog-family plates (movable-modal / movable-alert) have gray (#ccc)
    // bodies; every other plated type (document, utility, popup, …) is white.
    const isDialogFamily = cfg.slug.includes('modal') || cfg.slug.includes('alert');
    const content = isDialogFamily ? palette.plateBase : palette.contentBg;
    return {
      geo,
      active:   drawPlateFrame(geo, true, palette, content),
      inactive: drawPlateFrame(geo, false, palette, content),
    };
  }
  return {
    geo,
    active:   drawFrame(cfg, geo, palette.pinstripeLight, palette.plateBase, palette),
    inactive: drawFrame(cfg, geo, palette.plateBase, palette.plateBase, palette),
  };
}
