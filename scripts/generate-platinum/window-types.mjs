// scripts/generate-platinum/window-types.mjs
// The 13 canonical Platinum window types as data: one config per type drives
// BOTH the placeholder drawing (draw-window.mjs) and the wnd# slice recipe
// (manifest.mjs). Geometry is our own clean-room Platinum approximation; the
// reference DIMENSIONS/structure come from beos-r503 (a different scheme — art
// is NOT copied, only the canonical wnd# ids + frame proportions).
//
// Each config yields a single minimum-size cicn "base sprite" that the
// compositor (src/composeChrome.ts) slices+tiles to any window size. The HARD
// requirement is that the recipe tiles correctly: per classifyPart, part 1 is
// fixed (drawn 1:1), part 8 grows (fills slack), part 0 COLLAPSES to width 0.
//
// Cell model (top edge, left→right):
//   [0, leftFixed)             fixed left corner (+ left widget if any)
//   [leftFixed, leftFixed+fill) grow title fill   (part 8)  — stretches
//   [..end-rightFixed, end)    fixed right corner (+ right widgets if any)
// Side/bottom edges: a single fixed band that tiles (1px-tall/wide uniform).
//
// titleBarHeight 0 ⇒ a title-less frame (dialog/alert/no-title utility): the
// top edge is just the frame band, same recipe shape as the bottom.

import { WINDOW_RECIPES } from '../../tools/theme-loader/window-recipes.mjs';

export const FRAME_INSET = 1; // L/R/B frame thickness (1px); top = titleBarHeight + inset (or inset when title-less)

// Part codes (see classifyPart in src/composeChrome.ts):
export const FIXED = 1;   // drawn 1:1 (corners, widget cells, frame bands)
export const STRETCH = 8; // grows to absorb slack (title fill / side fill)
export const PLATE = 5;   // title-plate bezel: grows to the measured title width, centred

// Widget geometry (7×7 boxes), shared with draw-window.mjs.
//   edgeMargin = gap from the frame inset to the first widget (and after the
//                last widget before the grow cell / corner).
export const WIDGET = { size: 7, gap: 2, edgeMargin: 4 };

/**
 * @typedef {object} WindowTypeConfig
 * @property {string} slug         canonical slug (matches CANONICAL_WNDTYPE_SLUGS)
 * @property {string} name         human name (also slugifies to `slug`)
 * @property {number} wndId        canonical wnd# id; inactive cicn = wndId, active = wndId+1
 * @property {number} titleBarHeight  title band height (0 = title-less frame)
 * @property {('close'|'collapse'|'zoom')[]} widgets  widget glyphs, left→right within the bar
 * @property {boolean} collapsed   title-only window: no body, empty bottom/left/right recipes
 * @property {('top'|'side')} titleEdge  which edge carries the title bar (side = left edge)
 */

// Generator-LOCAL drawing params (procedural-replica specifics): canonical wnd# id,
// human name, title edge, plate/bottom-frame knobs, reference dims. The title-bar
// HEIGHT, widget set, and collapsed flag are NO LONGER hardcoded here — they come
// from the shared WINDOW_RECIPES (the decode-grounded source the theme-builder +
// runtime also use), so the replica matches the real schemes instead of a screenshot
// measurement. WHY the switch: the WDEF 125 decode shows the title height is
// FONT-DERIVED (ascent+descent+2, +1 for the bar) — NOT a measured constant; for the
// Platinum system font that lands on ~19, which is the shared value. The old
// hardcoded 20 was a screenshot artifact; utility's 11 falls out of the small system
// font. (Truest future form: derive titleH from the font metrics directly.)
// `titlePlate` is local because it's a DRAWING choice (a centred title-plate gap):
// no-title-utility now has a bar+widgets but still NO plate (its title text is
// suppressed — it's a drag bar, not a titled window).
const DRAW_PARAMS = [
  { slug: 'document-window',              name: 'Document Window',              wndId: -14336, titleEdge: 'top', titlePlate: true, bottomFrame: 2, ref: '92×30' },
  { slug: 'collapsed-document-window',    name: 'Collapsed Document Window',    wndId: -14332, titleEdge: 'top', titlePlate: true, ref: '92×25' },
  { slug: 'dialog',                       name: 'Dialog',                       wndId: -14328, titleEdge: 'top', ref: '39×11' },
  { slug: 'alert',                        name: 'Alert',                        wndId: -14326, titleEdge: 'top', ref: '39×11' },
  { slug: 'movable-modal',                name: 'Movable Modal',                wndId: -14324, titleEdge: 'top', titlePlate: true, bottomFrame: 2, ref: '39×30' },
  { slug: 'movable-alert',                name: 'Movable Alert',                wndId: -14322, titleEdge: 'top', titlePlate: true, ref: '39×30' },
  { slug: 'titled-utility-window',        name: 'Titled Utility Window',        wndId: -14304, titleEdge: 'top', titlePlate: true, ref: '44×27' },
  { slug: 'collapsed-titled-utility',     name: 'Collapsed Titled Utility',     wndId: -14300, titleEdge: 'top', titlePlate: true, ref: '44×27' },
  { slug: 'side-floating-utility-window', name: 'Side Floating Utility Window',  wndId: -14296, titleEdge: 'top', titlePlate: true, ref: '27×38' },
  { slug: 'collapsed-side-utility',       name: 'Collapsed Side Utility',       wndId: -14292, titleEdge: 'top', titlePlate: true, ref: '27×38' },
  { slug: 'no-title-utility-window',      name: 'No Title Utility Window',       wndId: -14288, titleEdge: 'top', ref: '38×27' },
  { slug: 'collapsed-no-title-utility',   name: 'Collapsed No Title Utility',   wndId: -14284, titleEdge: 'top', ref: '38×27' },
  { slug: 'popup-window',                 name: 'Popup Window',                 wndId: -12320, titleEdge: 'top', titlePlate: true, ref: '75×75' },
];

// SCREENSHOT-SLICE bar-height exception. The replica DRAWS most types procedurally
// from the decode-grounded shared recipe, but the document window is SLICED from a
// real Platinum screenshot (slice-doc-window.mjs) whose bar is barH 20 — and the
// recipe MUST match that art (else the frame ends 4px short of the sliced sprite).
// So these screenshot-sliced types keep barH 20, overriding the shared decode value
// (19) that governs the REAL schemes — which draw the document PROCEDURALLY from the
// corner-sprite/WDEF geometry, where the font-derived height is ~19. Collapsed-document
// follows so its bar matches its parent's. (movable-modal is also sliced but its slice
// barH 16 already equals the recipe, so it needs no override.) To make the replica's
// document decode-19 too, it would have to be drawn procedurally instead of sliced —
// a separate fidelity call (the slice was chosen for its screenshot accuracy).
const SLICED_BARH = { 'document-window': 20, 'collapsed-document-window': 20 };

/** @type {WindowTypeConfig[]} */
export const WINDOW_TYPES = DRAW_PARAMS.map((p) => {
  const rec = WINDOW_RECIPES[p.slug];
  if (!rec) throw new Error(`window-types: no WINDOW_RECIPES entry for "${p.slug}"`);
  return { ...p, titleBarHeight: SLICED_BARH[p.slug] ?? rec.titleH, widgets: rec.widgets, collapsed: rec.collapsed };
});

/**
 * Derive the minimum-cicn geometry + recipe cell boundaries for a type.
 * Pure function of the config; the SINGLE source of truth shared by
 * draw-window.mjs, manifest.mjs and the slicer.
 *
 * Returns:
 *   width, height        — the base-sprite cicn dimensions
 *   barH                 — title band height (0 if title-less)
 *   leftFixed, fill, rightFixed — top-edge cell widths (sum == width)
 *   bodyH                — body band height inside the frame (≥1; 1 for collapsed)
 *   widgetSlots          — [{glyph, x, y}] placeholder widget boxes (cicn coords)
 */
export function geometryFor(cfg) {
  const inset = FRAME_INSET;
  const { gap, edgeMargin } = WIDGET;
  const barH = cfg.titleBarHeight;
  const hasTitle = barH > 0;
  const bodyH = 1;

  // Per-type widget box size: chunky (~⅔ of the bar) but always fits the bar.
  // clamp(barH - 7, 5, 13): a 20px bar → 13px boxes; an 11px utility bar → 5px
  // (fixes the old fixed-7 that overran the 11px bar). Title-less ⇒ no widgets.
  const size = hasTitle ? Math.max(5, Math.min(13, barH - 7)) : WIDGET.size;

  // ── Title-plate geometry: a 5-cell top (fixed corner · grow fill · PLATE ·
  // grow fill · fixed corner). The plate is a solid un-pinstriped gap the centred
  // title sits on; pinstripes only FLANK it. This is the faithful Platinum bar
  // for EVERY titled type — the document-window's reference dims (barH 20, three
  // 13px widgets → 21,27,57,63,98) fall out of the general formula below, and
  // utility / modal bars scale down to their own barH + widget set.
  //
  // Layout knobs (px), tuned so barH 20 + [close,collapse,zoom] reproduces the
  // reference: a widget sits `lead` from the inset; the left corner ends `trail`
  // past it; the plate is flanked by a `fill` pinstripe strip each side; the
  // right group is packed `lead` from the corner start with `trail` to the edge.
  if (cfg.titlePlate) {
    const widgetSize = Math.max(5, Math.min(13, barH - 7));
    const leftWidgets = cfg.widgets.filter((w) => w === 'close');
    const rightWidgets = cfg.widgets.filter((w) => w !== 'close');
    const lead = 4, trail = 3, gap = 2; // close x=5 needs lead=4 (inset+4); 5+13+3=21
    const fill = 6;                     // pinstripe flank each side of the plate

    // Left fixed corner: inset + lead + (widget) + trail, or a bare margin when
    // there's no left widget.
    const leftBoxes = leftWidgets.length * widgetSize + Math.max(0, leftWidgets.length - 1) * gap;
    const leftFixed = leftWidgets.length
      ? inset + lead + leftBoxes + trail
      : inset + lead;
    // Right fixed corner: lead + (widgets) + trail past the inset, or a bare
    // margin when there's no right widget.
    const rightBoxes = rightWidgets.length * widgetSize + Math.max(0, rightWidgets.length - 1) * gap;
    const rightTrail = 4; // zoom ends at 94, +4 = 98 (reference)
    const rightFixed = rightWidgets.length
      ? lead - 1 + rightBoxes + rightTrail
      : inset + lead;

    // Plate width scales with the bar: the larger the bar, the chunkier the
    // resting plate. barH 20 → 30 (reference); clamp so tiny bars still read.
    const plate = Math.max(12, Math.round(barH * 1.5));
    const leftFill = fill, rightFill = fill;
    const width = leftFixed + leftFill + plate + rightFill + rightFixed;
    const topFrame = barH + inset;
    // Bottom frame: usually `inset` (1px), but a window with a real sliced bottom
    // band (cfg.bottomFrame, e.g. the document window's 2px #999-shadow + outline
    // bevel) reserves that many rows so the slicer can paste the real bottom.
    const bottomFrame = cfg.bottomFrame ?? inset;
    const height = topFrame + bodyH + bottomFrame;

    const wy = inset + Math.max(0, Math.floor((barH - widgetSize) / 2));
    const widgetSlots = [];
    let lx = inset + lead;
    for (const glyph of leftWidgets) { widgetSlots.push({ glyph, x: lx, y: wy, size: widgetSize }); lx += widgetSize + gap; }
    // Right group starts `lead-1` into the right corner (collapse x=66 = 63+3).
    let rx = leftFixed + leftFill + plate + rightFill + (lead - 1);
    for (const glyph of rightWidgets) { widgetSlots.push({ glyph, x: rx, y: wy, size: widgetSize }); rx += widgetSize + gap; }

    return {
      width, height, barH, hasTitle: true, leftFixed,
      fill: leftFill, rightFixed, bodyH, topFrame, widgetSlots, inset, bottomFrame,
      hasPlate: true, leftFill, plate, rightFill,
    };
  }

  // Split widgets into a left group (close) and a right group (collapse/zoom),
  // matching the document-window layout: close on the left, collapse+zoom right.
  const leftWidgets = cfg.widgets.filter((w) => w === 'close');
  const rightWidgets = cfg.widgets.filter((w) => w !== 'close');

  // The grow (title-fill) strip. 8px gives a paintable, horizontally-seamless
  // tile band; the compositor stretches it to any title width.
  const fill = 8;

  // Left/right fixed corner widths. A widget group occupies a lead margin +
  // the boxes (gap-separated) + a trail margin; an empty group is just a small
  // corner so the grow cell never abuts the frame outline. Box width is the
  // per-barH `size` (so a widget never exceeds the bar it sits in).
  //   leftFixed  = inset + lead + boxes + trail
  const groupW = (n) => (n ? inset + edgeMargin + n * size + (n - 1) * gap + edgeMargin : inset + edgeMargin);
  const leftFixed = groupW(leftWidgets.length);
  const rightFixed = groupW(rightWidgets.length);
  const width = leftFixed + fill + rightFixed;

  // Height = top frame (barH or inset) + body band + bottom inset.
  const topFrame = hasTitle ? barH + inset : inset;
  const height = topFrame + bodyH + inset;

  // Vertically centre the widgets in the bar.
  const wy = inset + Math.max(0, Math.floor((barH - size) / 2));
  const widgetSlots = [];
  // Left group: lead margin from the inset.
  let lx = inset + edgeMargin;
  for (const glyph of leftWidgets) { widgetSlots.push({ glyph, x: lx, y: wy, size }); lx += size + gap; }
  // Right group: packed inside the right corner, leaving an edge margin to the
  // frame outline.
  const rightBlockW = rightWidgets.length
    ? rightWidgets.length * size + (rightWidgets.length - 1) * gap
    : 0;
  let rx = width - inset - edgeMargin - rightBlockW;
  for (const glyph of rightWidgets) { widgetSlots.push({ glyph, x: rx, y: wy, size }); rx += size + gap; }

  return { width, height, barH, hasTitle, leftFixed, fill, rightFixed, bodyH, topFrame, widgetSlots, inset };
}
