// Built-in window frame rules (Kaleidoscope 2.3.1 kDEF 0, document family
// 0x11c58–0x1525a): the frame the original engine draws for a scheme that
// ships neither a wnd# recipe nor a WDEF -14330. Pure ESM; imports nothing from
// src/ (or anything else). Every rule is transcribed from
// docs/spec/engine/procedural-frame.md and cites the spec section it mirrors;
// nothing is fitted to runtime output. The five corpus schemes reaching this
// unit are SCHEMES (spec §1.1 "Corpus").
//
// Conventions. Rectangles are QuickDraw [left, top, right, bottom], right and
// bottom exclusive. Lines are [x0, y0, x1, y1] with both ends inclusive (the
// spec's "from … to …"). P(x, y) is the frame or dialog cicn pixel at column x,
// row y, sampled from the cicn's own colour table (§3.5 "Sampling"); this module
// only names the sample point, the caller resolves it against the archive.
//
// Declared defaults (spec §6.5, §10): no proxy icon (Scriptoscope has no Finder
// windows), Gestalt('WdrB') not answering unless a row says so, ≥ 8-bit device
// (the 4-bit rule 0xf488 is out of scope), the system font metrics passed in.

export const SCHEMES = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The decode as named rules. A wrong reading overrides one of them (mutation tests only). */
export const DECODE = {
  // §3.1 (0x11f2c–0x11fa4): kinds that imply grow / are titled / are modal.
  growKinds: [0], titledKinds: [0, 4, 5], modalKinds: [1, 5],
  titleBase: (ascent, descent) => ascent + descent + 6,          // §3.2 0x120da–0x120e4
  titleParity: true,                                             // §3.2 0x120e8–0x120f6: even H −= 1
  titleFloor: 22,                                                // §3.2 0x120fa–0x12116
  side: 6,                                                       // §3.3 0x12624: sides and bottom
  shadowShift: 2,                                                // §3.3 0x127b6: (+2, +2), shortened by 1
  dialogOutset: 6, thinOutset: 3,                                // §3.3 0x126c0, 0x12650
  widget: 16,                                                    // §3.3 16 × 16 slots
  closeDx: 4, collapseDx: 17, zoomDx: 33,                        // §3.3 0x148a2, 0x14904, 0x1496c
  widgetTop: (T, H) => T[1] + Math.trunc((H + 1 - 13) / 2) - 1,  // §3.3 0x148a2–0x148ce
  grow: { inset: 15, outset: 2, kind5Offset: 3 },                // §3.3 0x1499a: 17 × 17 at (C.r − 15, C.b − 15)
  limits: { afterClose: 17, edge: 5, beforeWidget: 4 },          // §3.3 0x1480c, 0x14848
  // §3.5 art selection, keyed by hilited.
  frameCicn: { true: -14332, false: -14336 },                    // 0x12dfc–0x12e18
  dialogCicn: { alert: { true: -14322, false: -14324 }, plain: { true: -14326, false: -14328 } }, // 0x1353a–0x13588
  stripeIds: { document: -14331, alert: -14321, plain: -14325 }, // 0x13e58, 0x13e42–0x13e52
  widgetIds: { close: [-14336, -14333], zoom: [-14334, -14331], collapse: [-14335, -14332] }, // 0x14168–0x141be
  growCicn: { true: -14330, false: -14334 },                     // 0x1450a–0x14526
  kind5Grow: { cicn: { true: -14309, false: -14310 }, clut: { true: -14336, false: -14335 } }, // 0x13136–0x13204
  // §5 row 1 (0x1399a–0x139ca) and §4 row 6 (0x12fb6–0x12fe6).
  samples: { fill: [6, 3], text: [7, 3], shadow: [9, 3], drop: [0, 0] },
  shadowPass: (shadow, text) => !same(shadow, text),             // §5.1 0x13fb8–0x13ff4
  shadowOffset: [1, 1],
  // §4 rows 3–5: band i samples.
  bands: { bottom: i => [6, 15 - i], left: i => [i, 6], right: i => [15 - i, 6] },
  // §5A ring line i (outer first) samples of the dialog cicn D (0x1370c–0x137ee).
  ring: { left: i => [5 + i, 7], right: i => [10 - i, 8], top: i => [7, 5 + i], bottom: i => [8, 10 - i] },
  dropsIgnoreGoAway: false, wp1Recheck: true,                    // §3.3 WP1–WP4: the goAway case split; WP1 re-tests zoom at T.r − 17 (rev 3)
  collapseBox: true,                                             // §3.3 0x14b40: shown with shadeOn, titled, not movable
  widgetsWhenInactive: false,                                    // §5 row 12 0x13cb2
  stripesWhenInactive: false,                                    // §5 row 11 0x13cac
  // §5.2: ppat layer first, then the scheme's own cicn over it; both when both exist.
  stripeLayers: (has, id) => [...(has('ppat', id) ? [['ppat', id]] : []), ...(has('cicn', id) ? [['cicn', id]] : [])],
  stripeRows: 13, stripeGap: 3, stripeMinSkip: 7,                // 0x13d98, 0x13dc0–0x13e18, 0x13e2c
  iconColour: ['ics8'],                                          // §6.1 0xf57c: ics8, else the ics# 1-bit image; never ics4
  hitProbe: { close: 16, zoom: 16, dy: 12 },                     // §6.3 0x12a3a–0x12ad0
  hitIconByMask: true,
  zoomCodes: { atZoomRect: 5, otherwise: 6 },                    // §6.3 0x12a7a–0x12ad0
  baselineAscent: 'adjusted',                                    // §5.1: the ascent after §3.2                                           // §6.2 IconDispatch 0x060D (PtInIconID: the ics# mask)
  titleRowPlusOne: 1,                                            // §6.3 0x12af8–0x12b66: title bar (+1 row)
  // §5 mode table (0x138e0–0x1394e).
  titleMode: ({ kind, collapsed, wdrb, gap, H }) => (kind === 5 ? 'box' : !collapsed ? 'joined' : !wdrb ? 'box' : gap === H ? 'box' : 'joined'),
};

const rd = reading => ({ ...DECODE, ...reading });
const outset = ([l, t, r, b], n) => [l - n, t - n, r + n, b + n];
const intersects = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const inRect = ([x, y], r) => !!r && x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
const bbox = rects => [Math.min(...rects.map(r => r[0])), Math.min(...rects.map(r => r[1])), Math.max(...rects.map(r => r[2])), Math.max(...rects.map(r => r[3]))];

/** §3.1 (0x11ee2–0x11fa4) variation code → kind and flags; §3.1 get-features (0x11cfa–0x11d60). */
export function decodeVariation(variation, { reading = {} } = {}) {
  const g = rd(reading);
  const kind = variation & 7, zoom = !!(variation & 8), thin = !!(variation & 16), alertBit = !!(variation & 32);
  const grow = !!(variation & 64) || g.growKinds.includes(kind), titled = g.titledKinds.includes(kind), movable = kind === 5;
  const modal = g.modalKinds.includes(kind), canCollapse = titled && !movable;
  const features = (grow ? 1 : 0) | (zoom ? 2 : 0) | (canCollapse ? 4 : 0) | (modal ? 8 : 0) | 16 | (titled ? 64 : 0) | 0x0f80;
  return { kind, zoom, thin, alertBit, grow, titled, movable, modal, canCollapse, features };
}

/** §3.2 title-bar height and the adjusted ascent. */
export function titleHeight({ ascent, descent }, { reading = {} } = {}) {
  const g = rd(reading);
  let H = g.titleBase(ascent, descent), a = ascent;
  if (g.titleParity && H % 2 === 0) H -= 1;
  if (H < g.titleFloor) { a += Math.trunc((g.titleFloor - H) / 2); H = g.titleFloor; }
  return { H, ascent: a };
}

/** §3.5 "alert colouring" (0x14c64), first matching row. */
export function alertColouring({ thin, alertBit, auxBit4 = false, kind, actb = null, windowEntry0 = null }) {
  if (thin) return alertBit;
  if (auxBit4) return true;
  if (kind !== 1 && kind !== 5) return false;
  if (actb === null) return false;
  return same(windowEntry0, actb);
}

/** §6.4 (0x14b5e, 0x122f6–0x123e2): does the grow box belong to the frame? */
export const growOwned = (v, recordFlag) => (v.thin && v.grow) || (v.titled && !v.movable && !!recordFlag);

/**
 * §3.3 geometry for window `w` = { variation, C, H, goAway, shadeOn, collapsed,
 * titleWidth, growFlag }. Returns the structure region (rect list), content,
 * named rects, widget presence, title text and stripe segments.
 */
export function geometry(w, { reading = {} } = {}) {
  const g = rd(reading), v = decodeVariation(w.variation, { reading }), H = w.H, C = w.C, [l, t, r, b] = C, s = g.side;
  const o = v.thin ? g.thinOutset : g.dialogOutset;
  let base, shadow = 'shift';
  if (w.collapsed && v.titled) base = [l - s, t - H, r + s, t];                     // 0x126fc
  else if (v.kind === 0 || v.kind === 4) base = [l - s, t - H, r + s, b + s];      // 0x12624
  else if (v.kind === 1) base = outset(C, o);                                       // 0x126c0
  else if (v.kind === 2) { base = outset(C, 1); shadow = null; }                    // 0x1268c
  else if (v.kind === 3) { base = outset(C, 1); shadow = 'same'; }                  // 0x12696
  else { base = outset(C, o); base[1] -= H - 1; }                                   // kind 5, 0x12650
  const k = g.shadowShift;
  const shifted = shadow === 'shift' ? [base[0] + k, base[1] + k, base[2] + k - 1, base[3] + k - 1]
    : shadow === 'same' ? [base[0] + 2, base[1] + 2, base[2] + 2, base[3] + 2] : null;
  const structure = shifted ? [base, shifted] : [base];
  // Named rects (0x146d4–0x1499a).
  const T = !v.titled ? null : v.movable ? (v.thin ? [l - 3, t - 2 - H, r + 3, t - 2] : [l - 6, t - 5 - H, r + 6, t - 5]) : [l - s, t - H, r + s, t];
  const owned = growOwned(v, w.growFlag);
  const grow = [r - g.grow.inset, b - g.grow.inset, r + g.grow.outset, b + g.grow.outset];
  if (v.kind === 5 && !v.thin) for (let i = 0; i < 4; i++) grow[i] += g.grow.kind5Offset;
  const content = w.collapsed ? null : C;
  const out = { variation: v, H, structure, base, content, contentMinusGrow: !w.collapsed && owned && v.grow ? grow : null, T, grow, growOwned: owned };
  if (!T) return out;
  const wy = g.widgetTop(T, H), slot = x => [x, wy, x + g.widget, wy + g.widget];
  const close = slot(T[0] + g.closeDx), collapse = slot(T[2] - g.collapseDx);
  const zoomAt = withCollapse => slot(T[2] - (withCollapse ? g.zoomDx : g.collapseDx));
  // Widget presence (0x121ce–0x12264).
  let showCollapse = g.collapseBox && !!w.shadeOn && v.titled && !v.movable, showZoom = v.zoom;
  // WP1–WP4 (rev 3, 0x121dc–0x12264): the drops depend on goAway; the close rect is the computed one either way.
  if (w.goAway || g.dropsIgnoreGoAway) {
    if (showZoom) { if (intersects(zoomAt(showCollapse), close)) { showCollapse = false; if (!g.wp1Recheck || intersects(zoomAt(false), close)) showZoom = false; } } // WP1
    else if (showCollapse && intersects(collapse, close)) showCollapse = false;                                                                      // WP2
  } else if (showZoom && showCollapse && intersects(collapse, close)) showCollapse = false;                                                            // WP3: zoom kept
  const zoom = zoomAt(showCollapse);
  const L = w.goAway ? close[0] + g.limits.afterClose : T[0] + g.limits.edge;
  const R = v.zoom ? zoom[0] - g.limits.beforeWidget : showCollapse ? collapse[0] - g.limits.beforeWidget : T[2] - g.limits.edge;
  const tw = w.titleWidth ?? 0;
  const titleText = tw > 0 ? (() => { const left = Math.max(L, T[0] + Math.trunc((T[2] - T[0] - tw) / 2)); return [left, T[1] + 3, left + tw, T[3] - 3]; })() : null;
  // Stripes (§5.2).
  const band = [close[1], close[1] + g.stripeRows];
  const segments = (titleText ? [[L, titleText[0] - g.stripeGap], [titleText[2] + g.stripeGap, R]] : [[L, R]]).filter(([a, z]) => z - a > g.stripeMinSkip);
  Object.assign(out, { wy, close, collapse, zoom, shown: { close: !!w.goAway, zoom: showZoom, collapse: showCollapse }, L, R, titleText,
    stripes: { rows: band, segments } });
  return out;
}

/** §3.4 message-8 regions (bounding rects; 32/33 as rect lists). */
export function regions(geo) {
  const tt = geo.titleText && [geo.titleText[0], geo.titleText[1] - 1, geo.titleText[2], geo.titleText[3] + 1];
  return { 0: geo.T, 1: tt, 2: geo.close ?? null, 3: geo.zoom ?? null, 6: geo.grow, 7: geo.collapse ?? null, 32: geo.structure, 33: geo.content };
}

/** §3.5 art for a window: which ids are requested and which layers draw, given `has(type, id)`. */
export function selectArt(w, has, { reading = {}, alert = false } = {}) {
  const g = rd(reading), v = decodeVariation(w.variation, { reading }), hl = !!w.hilited;
  const doc = v.kind === 0 || v.kind === 4;
  const frame = doc ? g.frameCicn[hl] : g.dialogCicn[alert ? 'alert' : 'plain'][hl];
  const stripeId = !v.titled ? null : doc ? g.stripeIds.document : g.stripeIds[alert ? 'alert' : 'plain'];
  const stripes = stripeId !== null && (hl || g.stripesWhenInactive) ? g.stripeLayers(has, stripeId) : [];
  const geo = geometry(w, { reading });
  const widgets = !v.titled || !(hl || g.widgetsWhenInactive) ? [] : ['close', 'zoom', 'collapse'].filter(n => geo.shown[n]).map(n => {
    const id = g.widgetIds[n][0];
    if (!has('ics#', id)) return [n, null];                                         // 0xf50c–0xf51e
    const colour = g.iconColour.find(type => has(type, id));
    return [n, id, colour ?? 'ics#'];
  });
  let grow = null;
  if (geo.growOwned) {
    if (v.kind === 5) { const c = g.kind5Grow.cicn[hl]; grow = has('cicn', c) ? ['cicn', c] : ['clut', g.kind5Grow.clut[hl]]; }
    else if (doc) grow = ['cicn', g.growCicn[hl]];
  }
  return { frame: has('cicn', frame) ? frame : null, stripes, widgets, grow };
}

/** §5 title mode for kinds 0/4/5 (0x138e0–0x1394e). */
export const titleMode = (input, { reading = {} } = {}) => rd(reading).titleMode(input);

/**
 * §4 document frame draw list (kinds 0/4, not collapsed, F present), in order.
 * Ops: ['copy', dst, src] (cicn sub-rect 1:1), ['line', [x0, y0, x1, y1], P].
 */
export function documentFrameOps(geo, { reading = {} } = {}) {
  const g = rd(reading), [l, t, r, b] = geo.content, s = g.side, L = l - s, R = r + s, B = b + s, ops = [];
  ops.push(['copy', [L, b, L + 6, b + 6], [0, 10, 6, 16]]);                       // 0x12e5c
  ops.push(['copy', [r, b, r + 6, b + 6], [10, 10, 16, 16]]);                     // 0x12ea4
  for (let i = 0; i < s; i++) ops.push(['line', [l, b + 5 - i, r - 1, b + 5 - i], g.bands.bottom(i)]);   // 0x12ef0
  for (let i = 0; i < s; i++) ops.push(['line', [L + i, t, L + i, b - 1], g.bands.left(i)]);             // 0x12f48
  for (let i = 0; i < s; i++) ops.push(['line', [r + 5 - i, t, r + 5 - i, b - 1], g.bands.right(i)]);   // 0x12f80
  ops.push(['line', [L + 2, B, R, B], g.samples.drop], ['line', [R, t - geo.H + 2, R, B], g.samples.drop]); // 0x12fb6
  if (geo.growOwned && geo.variation.grow) ops.push(['grow', geo.grow]);          // 0x13002
  return ops;
}

/** §5 title bar draw list, rows 2–8 (corners, sides, rows, interior), for `mode`. */
export function titleOps(geo, mode, { reading = {} } = {}) {
  const g = rd(reading), [l, t, r, b] = geo.T, ops = [];
  ops.push(['copy', [l, t, l + 4, t + 4], [0, 0, 4, 4]], ['copy', [r - 4, t, r, t + 4], [12, 0, 16, 4]]);
  if (mode === 'box') ops.push(['copy', [l, b - 4, l + 4, b], [0, 12, 4, 16]], ['copy', [r - 4, b - 4, r, b], [12, 12, 16, 16]]);
  else ops.push(['copy', [l + 4, b - 3, l + 6, b], [4, 3, 6, 6]], ['copy', [r - 6, b - 3, r - 4, b], [10, 3, 12, 6]]);
  const last = mode === 'box' ? b - 5 : b - 1;
  for (let i = 0; i < 4; i++) ops.push(['line', [l + i, t + 4, l + i, last], [i, 6]], ['line', [r - 1 - i, t + 4, r - 1 - i, last], [15 - i, 6]]);
  for (let i = 0; i < 3; i++) ops.push(['line', [l + 4, t + i, r - 5, t + i], [6, i]]);
  for (let i = 0; i < 3; i++) ops.push(mode === 'box' ? ['line', [l + 4, b - 1 - i, r - 5, b - 1 - i], [6, 15 - i]] : ['line', [l + 6, b - 1 - i, r - 7, b - 1 - i], [6, 5 - i]]);
  ops.push(['paint', [l + 4, t + 3, r - 4, b - 3], g.samples.fill]);
  return ops;
}

/** §5A ring and shadow for kinds 1/5 (outer edge = C outset 6, or 3 when thin). Shadow first, then the ring. */
export function dialogRingOps(geo, { reading = {} } = {}) {
  const g = rd(reading), o = outset(geo.content, geo.variation.thin ? g.thinOutset : g.dialogOutset), [l, t, r, b] = o, ops = [];
  const top = geo.base[1];
  ops.push(['line', [l + 2, b, r, b], [0, 0]], ['line', [r, top + 2, r, b], [0, 0]]);
  ops.push(['copy', [l, t, l + 3, t + 3], [5, 5, 8, 8]], ['copy', [r - 3, t, r, t + 3], [8, 5, 11, 8]],
    ['copy', [l, b - 3, l + 3, b], [5, 8, 8, 11]], ['copy', [r - 3, b - 3, r, b], [8, 8, 11, 11]]);
  for (let i = 0; i < 3; i++) ops.push(['line', [l + i, t + 3, l + i, b - 4], g.ring.left(i)]);
  for (let i = 0; i < 3; i++) ops.push(['line', [r - 1 - i, t + 3, r - 1 - i, b - 4], g.ring.right(i)]);
  for (let i = 0; i < 3; i++) ops.push(['line', [l + 3, t + i, r - 4, t + i], g.ring.top(i)]);
  for (let i = 0; i < 3; i++) ops.push(['line', [l + 3, b - 1 - i, r - 4, b - 1 - i], g.ring.bottom(i)]);
  if (!geo.variation.thin) ops.push(['gap', outset(geo.content, 3), geo.content]);
  return ops;
}

/** §5.1: title text passes for sampled text and shadow colours (resolved by the caller). */
export function textPasses(colours, [x, y], { reading = {} } = {}) {
  const g = rd(reading);
  return [...(g.shadowPass(colours.shadow, colours.text, colours.fill) ? [{ at: [x + g.shadowOffset[0], y + g.shadowOffset[1]], colour: colours.shadow }] : []),
    { at: [x, y], colour: colours.text, background: colours.fill }];
}

/**
 * §5.1 baseline (0x13f8e–0x13fb6): title-text top + trunc((height − (ascent + descent)) / 2) + ascent,
 * with the ascent after §3.2. `metrics` are the system font's own ascent and descent.
 */
export function titleBaseline(titleText, metrics, { reading = {} } = {}) {
  const g = rd(reading), ascent = g.baselineAscent === 'adjusted' ? titleHeight(metrics, { reading }).ascent : metrics.ascent;
  return titleText[1] + Math.trunc((titleText[3] - titleText[1] - (ascent + metrics.descent)) / 2) + ascent;
}

/**
 * §6.3 hit test (0x1295e), first match wins. `mask(id, x, y)` says whether the
 * ics# mask bit is set (icon-relative). `atZoomRect` is the 0x14568 stored-zoom
 * comparison (inputs, not modelled).
 */
export function hitTest(geo, w, [x, y], mask, { reading = {}, atZoomRect = false } = {}) {
  const g = rd(reading), v = geo.variation, p = [x, y];
  if (w.visible === false || !geo.structure.some(rc => inRect(p, rc))) return 0;
  const sb = bbox(geo.structure);
  if (v.grow && !w.collapsed && inRect(p, [geo.grow[0], geo.grow[1], sb[2], sb[3]])) return w.hilited ? 3 : 1;
  if (inRect(p, geo.content) && !inRect(p, geo.contentMinusGrow)) return 1;
  if (!v.titled) return 1;
  const onIcon = (name, rect) => geo.shown[name] && inRect(p, rect) && (g.hitIconByMask ? mask(g.widgetIds[name][0], x - rect[0], y - rect[1]) : true);
  const T = geo.T, dy = T[1] + g.hitProbe.dy;
  if (w.hilited && inRect(p, T) && (onIcon('close', geo.close) || (x === T[0] + g.hitProbe.close && y === dy))) return 4;
  if (w.hilited && (onIcon('zoom', geo.zoom) || (x === T[2] - g.hitProbe.zoom && y === dy))) return atZoomRect ? g.zoomCodes.atZoomRect : g.zoomCodes.otherwise;
  if (w.hilited && onIcon('collapse', geo.collapse)) return 9;
  const inner = outset(geo.base, -g.side);
  if ((inRect(p, geo.base) && !inRect(p, inner)) || inRect(p, [T[0], T[1], T[2], T[3] + g.titleRowPlusOne])) return 2;
  return 1;
}

// Rows that need the not-yet-merged engine driver ("awaits procedural-frame
// driver"). Each expected value is the spec model's value, pinned against the
// model by procedural-frame-rules.test.mjs; a binding test compares the driver
// with them once it lands. The standard window: content C = (100, 60, 300, 200),
// system font ascent 12 / descent 3 (H = 22), goAway, zoom, shadeOn, record
// grow flag set, empty title, kind 0 (variation 8) unless stated. Colours are
// raw RGB16 clut entries (hex, 12 digits) before the bake-time Mac → sRGB policy
// (spec §10.8); a pixel binding compares them through the loader's display policy.
export const STANDARD = { variation: 8, C: [100, 60, 300, 200], H: 22, goAway: true, shadeOn: true, growFlag: true, titleWidth: 0 };
/** Port pixels sampled by DRIVER_ROWS.P1, with the frame-cicn sample (or 'untouched') each must show. */
export const PIXEL_PROBES = {
  'left band outer (94, 130)': [[94, 130], [0, 6]], 'left band inner (99, 130)': [[99, 130], [5, 6]],
  'right band outer (305, 130)': [[305, 130], [15, 6]], 'right band inner (300, 130)': [[300, 130], [10, 6]],
  'bottom band outer (200, 205)': [[200, 205], [6, 15]], 'bottom band inner (200, 200)': [[200, 200], [6, 10]],
  'bottom-left corner (94, 205)': [[94, 205], [0, 15]], 'bottom-right corner (305, 200)': [[305, 200], [15, 10]],
  'drop shadow row (200, 206)': [[200, 206], [0, 0]], 'drop shadow column (306, 130)': [[306, 130], [0, 0]],
  'drop shadow column top (306, 40)': [[306, 40], [0, 0]], 'outside: shadow starts 2 px in (95, 206)': [[95, 206], 'untouched'],
  'outside: above the shadow column (306, 39)': [[306, 39], 'untouched'],
  'title top row (200, 38)': [[200, 38], [6, 0]], 'title joined bottom row (200, 59)': [[200, 59], [6, 5]],
  'title side column (94, 50)': [[94, 50], [0, 6]], 'title interior below the stripes (200, 56)': [[200, 56], [6, 3]],
  'title top-left corner (95, 39)': [[95, 39], [1, 1]],
};

// D1–D11: spec rows that need the engine driver (its trace, regions, hit
// message or composed port). All "awaits procedural-frame driver". Expected
// values are spec values; procedural-frame-rules.test.mjs pins each against the
// model above. Op lists named 'G12' / 'G13 joined' / 'G14' are that rule row's
// expected list (documentFrameOps / titleOps / dialogRingOps of the standard window).
const W3 = [['close', -14336, 'ics8'], ['zoom', -14334, 'ics8'], ['collapse', -14335, 'ics8']];
const art = (stripes, slug) => ({ active: { frame: -14332, stripes, widgets: W3, grow: ['cicn', -14330] }, inactive: { frame: -14336, stripes: [], widgets: [], grow: ['cicn', -14334] }, slug });
const ACTIVE_HITS = mask00 => [0, 0, 1, 1, 3, 3, 2, 2, 2, 4, 4, 2, mask00, 6, 6, 9, 2];
export const DRIVER_ROWS = {
  D1: { title: 'resources requested and layers drawn, standard window (all five, both states)', needs: 'engine trace (requests, layers)',
    expected: Object.fromEntries(SCHEMES.map(s => { const { slug, ...v } = art(s === 'slimes' ? [['ppat', -14331]] : [['cicn', -14331]], s); void slug; return [s, v]; })) },
  D2: { title: 'structure and content regions (message 2), standard C by kind', needs: 'driver regions',
    expected: { 8: { structure: [[94, 38, 306, 206], [96, 40, 307, 207]], content: [100, 60, 300, 200] }, 1: { structure: [[94, 54, 306, 206], [96, 56, 307, 207]], content: [100, 60, 300, 200] },
      2: { structure: [[99, 59, 301, 201]], content: [100, 60, 300, 200] }, 3: { structure: [[99, 59, 301, 201], [101, 61, 303, 203]], content: [100, 60, 300, 200] },
      5: { structure: [[94, 33, 306, 206], [96, 35, 307, 207]], content: [100, 60, 300, 200] } } },
  D3: { title: 'part-0 draw order, standard active window', needs: 'engine trace order',
    expected: ['sample fill/text/shadow', 'G13 joined', 'title text', 'stripes', 'close', 'zoom', 'collapse', 'G12'] },
  D4: { title: 'composed port pixels (all five, both states)', needs: 'driver drawing into a port', expected: { frame: { active: -14332, inactive: -14336 }, probes: PIXEL_PROBES,
    inactiveOnly: { 'stripe band shows the fill when inactive (200, 48)': [[200, 48], [6, 3]], 'no close glyph when inactive (104, 48)': [[104, 48], [6, 3]] } } },
  D5: { title: 'slimes stripes: ppat pattern fill at the segment origin; cicn over it only where the scheme ships one', needs: 'engine trace (stripe ops)',
    expected: { document: [['ppat', -14331, [115, 42, 269, 55], [115, 42]]], movablePlain: [['ppat', -14325], ['cicn', -14325]] } },
  D6: { title: 'widget glyph plots (normal state) at the 16 × 16 slots', needs: 'engine trace (icon plots)',
    expected: { active: [['close', -14336, [98, 42, 114, 58]], ['zoom', -14334, [273, 42, 289, 58]], ['collapse', -14335, [289, 42, 305, 58]]], inactive: [] } },
  D7: { title: 'title height from the system font (Chicago 12)', needs: 'driver font metrics', expected: { H: 22, ascent: 12 } },
  D8: { title: 'hit codes through message 1 (standard window, the T1/T2 points)', needs: 'driver hit message',
    expected: { active: { 'apple-platinum-2': ACTIVE_HITS(4), 'black-platinum': ACTIVE_HITS(4), 'platinum-8': ACTIVE_HITS(2), slimes: ACTIVE_HITS(2), 'system7-nostalgia-silver': ACTIVE_HITS(4) },
      inactive: [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] } },
  D9: { title: 'title text passes: shadow at (+1, +1) then text, in every corpus cell', needs: 'engine trace (text ops)', expected: { passes: 2, shadowOffset: [1, 1] } },
  D10: { title: 'grow box op (record flag set): 17 × 17 at (C.r − 15, C.b − 15)', needs: 'engine trace (grow op)',
    expected: { active: ['cicn', -14330, [285, 185, 302, 202]], inactive: ['cicn', -14334, [285, 185, 302, 202]] } },
  D11: { title: 'dBoxProc ring and gap (kind 1, plain colouring)', needs: 'engine trace (ring ops)', expected: { dialog: { active: -14326, inactive: -14328 }, ops: 'G14', gap: [[97, 57, 303, 203], [100, 60, 300, 200]] } },
};
/** The T1/T2 probe points, in order (standard window). */
export const HIT_POINTS = [[93, 100], [306, 38], [306, 40], [200, 100], [290, 190], [301, 201], [97, 100], [200, 203], [200, 50], [110, 50], [104, 48], [113, 57], [98, 42], [290, 50], [279, 48], [295, 48], [304, 57]];

// ---------------------------------------------------------------------------
// Revision 3 (#415): the shared rows TG / CT / GB, and the utility family §9
// (0x152be–0x17452). Same conventions as above. P(x, y) is the utility frame
// cicn Q's pixel (12 × 12 in the corpus). Every value is the spec's.

/** §2 TG1–TG4 and §9.8 UM1–UM2: the shared toggle bit (one byte for both families). */
Object.assign(DECODE, {
  toggle: { clearBelow: 4, signed: true, pressedWhenClear: true, gatedOnHilite: false, flipParts: [4, 5, 6, 9, 258] }, // 0x12bea–0x12d5e
  // §3.5 CT1–CT4 (0x10702–0x1075c): colour-table entry n found by value; stored RGB16 compared exactly.
  ctLookup: (e, n) => {
    const last = e.length - 1;
    if (n <= last && e[n].value === n) return e[n];                        // CT1
    if (e[last].value === 0) return e[n];                                  // CT2
    for (let i = last; i >= 0; i--) if (e[i].value === n) return e[i];     // CT3
    return e[0];
  },
  ctEqual: (a, b) => a.length === b.length && a.every((c, i) => c === b[i]), // CT4
  // §6.4 GB1–GB3a: which cicn copies go through the mask.
  copyModes: { documentGrow: 'masked', kind5Grow: 'masked', utilityCorners: 'masked', utilityGrow: 'masked',
    documentCorners: 'opaque', titleCorners: 'opaque', ringCorners: 'opaque', utilityStripes: 'opaque' },
  oneBitMasked: true,                                             // GB3a: a 1-bit cicn goes through CopyMask (0xfdf8–0xfe90)
  kind5Clut: { true: -14336, false: -14335 },                     // GB5 0x131f0–0x13212
  kind5Erase: 1, gripLight: 6, gripDark: 5,                       // GB6, GL2, GL3
});

/** §2 TG1–TG3 (document) / §9.8 UM1–UM2 (utility): what each draw call draws, and the bit after the run. */
export function toggleRun(family, parts, bit0, { reading = {}, hilited = true } = {}) {
  const g = rd(reading), u = urd(reading), tg = g.toggle;
  const ids = family === 'document' ? g.widgetIds : u.widgetIds, flips = family === 'document' ? tg.flipParts : u.flipParts;
  let bit = bit0 ? 1 : 0; const drawn = [];
  for (const part of parts) {
    const p = tg.signed ? (part << 16) >> 16 : part & 0xffff;
    if (p < tg.clearBelow) bit = 0;                                                               // TG1
    const w = p === 4 ? 'close' : p === 5 || p === 6 ? 'zoom' : p === 9 ? 'collapse' : null;
    const pressed = tg.pressedWhenClear ? bit === 0 : bit === 1;
    drawn.push(p === 0 ? 'frame' : w && (hilited || !tg.gatedOnHilite) ? ids[w][pressed ? 1 : 0] : null); // TG2 / UM1
    if (flips.includes(p)) bit ^= 1;                                                              // TG3 / UM2
  }
  return { drawn, bit };
}

/** §3.5 CT1–CT3 entry n of a colour table given as [{ value, rgb }] in position order; CT4 equality. */
export const ctEntry = (entries, n, { reading = {} } = {}) => rd(reading).ctLookup(entries, n);
export const ctEqual = (a, b, { reading = {} } = {}) => rd(reading).ctEqual(a, b);

/** §6.4 GB3 / GB3a: one destination pixel after a cicn copy (`under` is what the port held). */
export function copyPixel(use, { depth, under, src, mask }, { reading = {} } = {}) {
  const mode = rd(reading).copyModes[use];
  if (mode === 'masked' || (depth === 1 && rd(reading).oneBitMasked)) return mask ? src : under;
  return src;
}

/** §6.4 GB4–GL4: the procedural kind-5 grow box for grow rect g, by state; `hasClut(id)`. */
export function kind5GrowOps([l, t, r, b], hilited, hasClut, { reading = {} } = {}) {
  const g = rd(reading), clut = g.kind5Clut[!!hilited];
  const ops = [['region', [[r - 2, t], [r - 4, t], [l, b - 4], [l, b - 2], [r - 2, b - 2], [r - 2, t]]]];   // GB4
  if (!hasClut(clut)) return ops;                                                                           // GB5
  ops.push(['clut', clut], ['erase', g.kind5Erase]);                                                        // GB6
  if (!hilited) return ops;                                                                                 // GL1
  for (const k of [3, 7, 11]) ops.push(['line', g.gripLight, [[r - 4, t + k], [l + k, b - 4], [l + k - 1, b - 4]]]); // GL2
  for (const k of [2, 6, 10]) ops.push(['line', g.gripDark, [[r - 4, t + k], [r - 5, t + k], [l + k, b - 5]]]);    // GL3
  return ops;
}

/** The utility decode as named rules (§9). A wrong reading overrides one of them (mutation tests only). */
export const UDECODE = {
  bits: { alwaysActiveClear: 1, grow: 2, zoom: 4, side: 8, smallGrow: 16 },     // UI1–UI5 0x15486–0x154d8
  activeRule: (hilited, alwaysActive) => hilited || alwaysActive,               // UI6 0x1740e–0x17428
  barHeight: ({ side, titled }) => (side ? 13 : titled ? 15 : 13),               // UI10 0x15600–0x15634
  outset: 4, raise: H => H - 3, shadowShift: 2,                                  // UG2 0x1596c–0x15a7c
  box: 10, closeInset: 2, collapseInset: 12, zoomShift: 11,                      // UG5–UG7 0x17258–0x173b2
  boxOffset: t => Math.trunc((t + 1 - 10) / 2),                                  // UG5
  limitGap: 2, limitEdge: 5,                                                     // UG8/UG9 0x17176–0x17256
  grow: { normal: 14, small: 10, outset: 2 },                                    // UG10 0x173b4–0x1740c
  dropOutset: 7, recomputedZoomOutset: 0, up3DropsZoom: false,                   // UP1–UP4 0x15694–0x15776
  frameCicn: { horizontal: { true: -14316, false: -14320 }, side: { true: -14315, false: -14319 } }, // UFA1 0x15e20–0x15e6c
  inactiveFallback: true,                                                        // UFA2 0x15e6e–0x15e98
  samples: { horizontal: { fill: [4, 3], text: [5, 3], shadow: [7, 3] }, side: { fill: [3, 4], text: [3, 5], shadow: [3, 7] } }, // UFT1
  drop: [0, 0],                                                                  // UFT3
  stripeIds: { horizontal: [-14314], side: [-14318, -14314] },                   // US3 0x1694c–0x16984
  bandOffset: t => Math.trunc((t - 8) / 2), stripeExtent: 9, stripeNarrow: 4,    // US1, US4 0x16872–0x168ec
  stripesWhenInactive: false, widgetsWhenInactive: false, titleOnSide: false,    // UW2–UW4 0x16736–0x16756
  titleInset: 3, titleBottom: 1, titleSkip: 2, eraseWiden: 2, penDx: 0,         // UT1–UT6 0x170a0, 0x16aac–0x16bd8
  baseline: (r, a, d) => r[1] + Math.trunc((r[3] - r[1] - 1 - (a + d)) / 2) + a, // UT6
  shadowPass: (shadow, text, fill) => !same(shadow, fill),                       // UT7 0x16bda–0x16c10
  growCicn: { small: { true: -14285, false: -14286 }, normal: { true: -14313, false: -14317 } }, // UGB1/UGB2 0x16e2a–0x16f12
  smallCrop: n => Math.trunc((n * 11) / 15), smallGrowCicn: true,               // UGB2; UGB1 tried first
  smallGrowInFrame: true, collapsedSkipsSmallGrow: false,                        // UFT2 0x16692–0x166b2: no collapsed condition
  widgetIds: { close: [-14320, -14317], zoom: [-14318, -14315], collapse: [-14319, -14316] }, // UM3 0x16c9a–0x16d58
  flipParts: [4, 5, 6, 9],                                                       // UM2 0x15da6–0x15dbe
  hitInset: 1, dragBand: 6, titleRowPlusOne: 1, hitGateActive: true,            // UH1–UH8 0x15ae4–0x15c88
};
/** Utility readings live under `reading.utility`, so a utility mutation never touches the document rules. */
const urd = (reading = {}) => ({ ...UDECODE, ...(reading.utility ?? {}) });
const inset = (rc, n) => outset(rc, -n);

/** §9.1 inputs for utility window `w` = { variation, hilited, goAway, shadeOn, collapsed, title }. */
export function utilityInputs(w, { reading = {} } = {}) {
  const g = urd(reading), v = w.variation, b = g.bits;
  const side = !!(v & b.side), alwaysActive = !(v & b.alwaysActiveClear);
  return { alwaysActive, grow: !!(v & b.grow), zoom: !!(v & b.zoom), side, smallGrow: !!(v & b.smallGrow),
    active: !!g.activeRule(!!w.hilited, alwaysActive), goAway: !!w.goAway, shadeOn: !!w.shadeOn, collapsed: !!w.collapsed,
    H: g.barHeight({ side, titled: !!w.title }) };
}

/** §9.2–§9.3 geometry: T, structure, content, the three boxes after UP1–UP4, Lu / Ru, grow rect, frame box F. */
export function utilityGeometry(w, { reading = {} } = {}) {
  const g = urd(reading), f = utilityInputs(w, { reading }), { H, side } = f, t = H + 1, C = w.C, [l, tp, r, b] = C;
  const T = side ? [l - H - 1, tp - g.outset, l, b + g.outset] : [l - g.outset, tp - H - 1, r + g.outset, tp];   // UG1
  let base;
  if (f.collapsed) base = [...T];                                                                                 // UG3
  else { base = outset(C, g.outset); base[side ? 0 : 1] -= g.raise(H); }                                         // UG2
  const k = g.shadowShift, structure = [base, [base[0] + k, base[1] + k, base[2] - 1 + k, base[3] - 1 + k]];
  const content = f.collapsed ? (side ? [l, tp, l, b] : [l, tp, r, tp]) : C;
  const gs = f.smallGrow ? g.grow.small : g.grow.normal, grow = [r - gs, b - gs, r + g.grow.outset, b + g.grow.outset]; // UG10
  const off = g.boxOffset(t), n = g.box;
  const box = along => (side ? [T[0] + off, along, T[0] + off + n, along + n] : [along, T[1] + off, along + n, T[1] + off + n]);
  const start = side ? T[1] : T[0], end = side ? T[3] : T[2], lo = rc => rc[side ? 1 : 0], hi = rc => rc[side ? 3 : 2];
  const close = box(start + g.closeInset), collapse = box(end - g.collapseInset);                                  // UG5, UG6
  const zoomAt = shift => box(end - g.collapseInset - (shift ? g.zoomShift : 0));                                  // UG7
  const plus = rc => outset(rc, g.dropOutset), cp = plus(close);
  let shadeOn = f.shadeOn, zoom = f.zoom;
  if (f.goAway && zoom) {                                                                                          // UP1
    if (intersects(plus(zoomAt(shadeOn)), cp)) { shadeOn = false; if (intersects(outset(zoomAt(false), g.recomputedZoomOutset), cp)) zoom = false; }
  } else if (f.goAway) { if (shadeOn && intersects(plus(collapse), cp)) shadeOn = false; }                         // UP2
  else if (zoom && shadeOn) { if (intersects(plus(collapse), cp)) { shadeOn = false; if (g.up3DropsZoom) zoom = false; } } // UP3 (UP4: nothing)
  const zoomBox = zoomAt(shadeOn);
  const Lu = f.goAway ? hi(close) + g.limitGap : start + g.limitEdge;                                              // UG8
  const Ru = zoom ? lo(zoomBox) - g.limitGap : shadeOn ? lo(collapse) - g.limitGap : end - g.limitEdge;           // UG9
  const bb = bbox(structure), F = [bb[0], bb[1], bb[2] - 1, bb[3] - 1];                                           // §9.4 box
  return { inputs: f, H, t, T, structure, content, contentMinusGrow: !f.collapsed && f.smallGrow && f.grow ? grow : null, grow,
    close, zoom: zoomBox, collapse, shown: { close: f.goAway, zoom, collapse: shadeOn }, Lu, Ru, F };
}

/** §9.4 frame draw list for geometry `geo` (Q present), then the tail. Ops as above; 'masked' copies (GB3). */
export function utilityFrameOps(geo, { reading = {} } = {}) {
  const g = urd(reading), f = geo.inputs, [Fl, Ft, Fr, Fb] = geo.F, [l, t, r, b] = geo.content, ops = [];
  const cp = (dst, src) => ops.push(['copy', dst, src]), line = (a, P) => ops.push(['line', a, P]);
  if (f.collapsed) {                                                                                               // UFC1–UFC6
    cp([Fl, Ft, Fl + 2, Ft + 2], [0, 0, 2, 2]); cp([Fr - 2, Ft, Fr, Ft + 2], [10, 0, 12, 2]);
    cp([Fl, Fb - 2, Fl + 2, Fb], [0, 10, 2, 12]); cp([Fr - 2, Fb - 2, Fr, Fb], [10, 10, 12, 12]);
    for (let i = 0; i < 2; i++) {
      line([Fl + i, Ft + 2, Fl + i, Fb - 3], [i, 6]); line([Fr - 1 - i, Ft + 2, Fr - 1 - i, Fb - 3], [11 - i, 6]);
      line([Fl + 2, Ft + i, Fr - 3, Ft + i], [6, i]); line([Fl + 2, Fb - 1 - i, Fr - 3, Fb - 1 - i], [6, 11 - i]);
    }
    ops.push(['interior', [Fl + 2, Ft + 2, Fr - 2, Fb - 2]]);
  } else if (!f.side) {                                                                                            // UFH1–UFH12
    cp([Fl, Ft, Fl + 3, Ft + 3], [0, 0, 3, 3]); cp([Fr - 3, Ft, Fr, Ft + 3], [9, 0, 12, 3]);
    cp([Fl, Fb - 4, Fl + 4, Fb], [0, 8, 4, 12]); cp([Fr - 4, Fb - 4, Fr, Fb], [8, 8, 12, 12]);
    cp([l - 2, t - 3, l, t], [2, 3, 4, 6]); cp([r, t - 3, r + 2, t], [8, 3, 10, 6]);
    for (let i = 0; i < 3; i++) line([Fl + 2, Ft + i, Fr - 4, Ft + i], [4, i]);
    for (let i = 0; i < 4; i++) line([Fl + 4, Fb - 1 - i, Fr - 5, Fb - 1 - i], [4, 11 - i]);
    for (let i = 0; i < 4; i++) { const y0 = i < 2 ? Ft + 2 : t; line([Fl + i, y0, Fl + i, Fb - 5], [i, 6]); line([Fr - 1 - i, y0, Fr - 1 - i, Fb - 5], [11 - i, 6]); }
    for (let i = 0; i < 3; i++) line([l, t - 1 - i, r - 1, t - 1 - i], [4, 5 - i]);
    ops.push(['interior', [Fl + 2, Ft + 3, Fr - 2, t - 3]]);
  } else {                                                                                                         // UFS1–UFS12
    cp([Fl, Ft, Fl + 3, Ft + 3], [0, 0, 3, 3]); cp([Fl, Fb - 3, Fl + 3, Fb], [0, 9, 3, 12]);
    cp([Fr - 4, Ft, Fr, Ft + 4], [8, 0, 12, 4]); cp([Fr - 4, Fb - 4, Fr, Fb], [8, 8, 12, 12]);
    cp([l - 3, t - 2, l, t], [3, 2, 6, 4]); cp([l - 3, b, l, b + 2], [3, 8, 6, 10]);
    for (let i = 0; i < 3; i++) line([Fl + i, Ft + 2, Fl + i, Fb - 4], [i, 4]);
    for (let i = 0; i < 4; i++) line([Fr - 1 - i, Ft + 4, Fr - 1 - i, Fb - 5], [11 - i, 4]);
    for (let i = 0; i < 4; i++) { const x0 = i < 2 ? Fl + 2 : l; line([x0, Ft + i, Fr - 5, Ft + i], [6, i]); line([x0, Fb - 1 - i, Fr - 5, Fb - 1 - i], [6, 11 - i]); }
    for (let i = 0; i < 3; i++) line([l - 1 - i, t, l - 1 - i, b - 1], [5 - i, 4]);
    ops.push(['interior', [Fl + 3, Ft + 2, l - 3, Fb - 2]]);
  }
  ops.push(['sample', g.samples[f.side ? 'side' : 'horizontal']]);                                                 // UFT1
  if (g.smallGrowInFrame && f.smallGrow && f.grow && !(g.collapsedSkipsSmallGrow && f.collapsed)) ops.push(['smallGrow', geo.grow]);                              // UFT2
  line([Fl + 2, Fb, Fr, Fb], g.drop); line([Fr, Fb, Fr, Ft + 2], g.drop);                                          // UFT3
  return ops;
}

/** §9.4 UFA1–UFA3: the frame cicn Q for `w`, given `has(type, id)`; null = nothing drawn. */
export function utilityFrameArt(w, has, { reading = {} } = {}) {
  const g = urd(reading), f = utilityInputs(w, { reading }), ids = g.frameCicn[f.side ? 'side' : 'horizontal'];
  if (has('cicn', ids[f.active])) return ids[f.active];
  if (!f.active && g.inactiveFallback && has('cicn', ids.true)) return ids.true;
  return null;
}

/** §9.5 stripes: band, art and ops (active only); `size(id)` is the stripes cicn's [w, h]. */
export function utilityStripes(geo, has, size, { reading = {} } = {}) {
  const g = urd(reading), f = geo.inputs;
  if (!f.active && !g.stripesWhenInactive) return null;
  const o = geo.T[f.side ? 0 : 1] + g.bandOffset(geo.t), e = g.stripeExtent;
  const band = f.side ? [o, geo.Lu, o + e, geo.Ru] : [geo.Lu, o, geo.Ru, o + e];                                   // US1
  const id = g.stripeIds[f.side ? 'side' : 'horizontal'].find(x => has('cicn', x)) ?? null;                      // US3
  const ops = [];
  if (id !== null) {
    const length = f.side ? band[3] - band[1] : band[2] - band[0];
    if (length < g.stripeNarrow) ops.push(['paint', band, 'fill']);                                                 // US4
    else {                                                                                                          // US5
      const [sw, sh] = size(id);
      if (f.side) for (let y = band[1]; y < band[3]; y += sh) ops.push(['tile', id, [band[0], y, band[0] + e, y + sh], [0, 0, e, sh]]);
      else for (let x = band[0]; x < band[2]; x += sw) ops.push(['tile', id, [x, band[1], x + sw, band[1] + e], [0, 0, sw, e]]);
    }
  }
  return { band, clip: ['interior', band], art: id, ops, removed: band };                                          // US2, US6
}

/** §9.6.1 UT1 title text rect (null when side or width ≤ 0). `text` = { width, condensedWidth }. */
export function utilityTitleRect(geo, text, { reading = {} } = {}) {
  const g = urd(reading), T = geo.T, Tw = T[2] - T[0];
  if ((geo.inputs.side && !g.titleOnSide) || !(text.width > 0)) return null;
  let w = text.width, left = T[0] + Math.trunc((Tw - w) / 2);
  if (left < geo.Lu || left + w > geo.Ru) { w = text.condensedWidth; left = Math.max(T[0] + Math.trunc((Tw - w) / 2), geo.Lu); }
  return [left, T[1] + g.titleInset, left + w, T[3] - g.titleInset];
}

/** §9.6.1 UT2–UT8 title draw list. `text` = { title, width, condensedWidth, ascent, descent, colours }. */
export function utilityTitleOps(geo, text, { reading = {} } = {}) {
  const g = urd(reading), rect = utilityTitleRect(geo, text, { reading });
  if (!text.title || !rect) return [];
  const r = [rect[0], rect[1], rect[2], rect[3] + g.titleBottom];
  if (r[0] + g.titleSkip > geo.Ru) return [];                                                                       // UT2
  const ops = [];
  if (text.width > r[2] - r[0]) ops.push(['condense', geo.Ru - r[0]]);                                              // UT3
  const clip = [geo.Lu, r[1], geo.Ru, r[3]], e = [r[0] - g.eraseWiden, r[1], r[2] + g.eraseWiden, r[3]];
  ops.push(['clip', clip], ['erase', e, 'fill'], ['remove', [Math.max(e[0], clip[0]), r[1], Math.min(e[2], clip[2]), r[3]]]); // UT4, UT5
  const x = r[0] + g.penDx, y = g.baseline(r, text.ascent, text.descent), c = text.colours;                        // UT6
  if (g.shadowPass(c.shadow, c.text, c.fill)) ops.push(['text', [x + 1, y + 1], 'shadow']);                          // UT7
  ops.push(['text', [x, y], 'text']);                                                                               // UT8
  return ops;
}

/** §9.6 UW1–UW5: step order and the region the fill paints (interior rect minus each step's area). */
export function utilityDrawOrder(geo, has, size, text, { reading = {} } = {}) {
  const g = urd(reading), f = geo.inputs, frame = utilityFrameOps(geo, { reading }), interior = frame.find(o => o[0] === 'interior')[1];
  const steps = ['frame'], minus = [];
  const st = utilityStripes(geo, has, size, { reading });
  if (st) { steps.push('stripes'); minus.push(st.removed); }                                                        // UW2
  if (!f.side || g.titleOnSide) { const t = utilityTitleOps(geo, text, { reading }); steps.push('title'); const rm = t.find(o => o[0] === 'remove'); if (rm) minus.push(rm[1]); } // UW3
  if (f.active || g.widgetsWhenInactive) for (const n of ['close', 'zoom', 'collapse']) if (geo.shown[n]) { steps.push(n); minus.push(geo[n]); } // UW4
  steps.push('fill');                                                                                               // UW5
  return { steps, fill: { interior, minus } };
}

/** §9.6 UW4 / §9.8 UM3: widget glyph plots of a full-frame draw (normal state, 16 × 16 at the box's top-left). */
export function utilityWidgets(geo, { reading = {} } = {}) {
  const g = urd(reading);
  if (!geo.inputs.active && !g.widgetsWhenInactive) return [];
  return ['close', 'zoom', 'collapse'].filter(n => geo.shown[n]).map(n => [n, g.widgetIds[n][0], [geo[n][0], geo[n][1], geo[n][0] + 16, geo[n][1] + 16]]);
}

/** §9.7 UGB1–UGB2 grow art: [id, copied w × h] at the grow rect's top-left (masked), or null. `size(id)`. */
export function utilityGrowArt(geo, has, size, { reading = {} } = {}) {
  const g = urd(reading), f = geo.inputs, a = !!f.active;
  if (f.smallGrow && g.smallGrowCicn && has('cicn', g.growCicn.small[a])) { const s = size(g.growCicn.small[a]); return [g.growCicn.small[a], s, [geo.grow[0], geo.grow[1]]]; }
  const id = g.growCicn.normal[a];
  if (!has('cicn', id)) return null;
  const [w, h] = size(id);
  return [id, f.smallGrow ? [g.smallCrop(w), g.smallCrop(h)] : [w, h], [geo.grow[0], geo.grow[1]]];
}

/** §9.8 UM4: message 6 draws the grow box only when visible, grow and not collapsed. */
export const utilityMessage6 = (geo, w) => w.visible !== false && geo.inputs.grow && !geo.inputs.collapsed;

/** §9.9 UH1–UH8 hit test, first match wins. */
export function utilityHit(geo, w, [x, y], { reading = {}, atZoom = false } = {}) {
  const g = urd(reading), f = geo.inputs, p = [x, y];
  if (w.visible === false || !geo.structure.some(rc => inRect(p, rc))) return 0;                                   // UH1
  const sb = bbox(geo.structure);
  if (f.active && f.grow && !f.collapsed && inRect(p, [geo.grow[0], geo.grow[1], sb[2], sb[3]])) return 3;        // UH2
  if (inRect(p, geo.content) && !inRect(p, geo.contentMinusGrow)) return 1;                                       // UH3
  if (inRect(p, geo.T) && (f.active || !g.hitGateActive)) {
    if (geo.shown.close && inRect(p, inset(geo.close, g.hitInset))) return 4;                                     // UH4
    if (geo.shown.zoom && inRect(p, inset(geo.zoom, g.hitInset))) return atZoom ? 5 : 6;                         // UH5
    if (geo.shown.collapse && inRect(p, inset(geo.collapse, g.hitInset))) return 9;                              // UH6
  }
  const box = [sb[0], sb[1], sb[2] - 1, sb[3] - 1];
  if ((inRect(p, box) && !inRect(p, inset(box, g.dragBand))) || inRect(p, [geo.T[0], geo.T[1], geo.T[2], geo.T[3] + g.titleRowPlusOne])) return 2; // UH7
  return 1;                                                                                                        // UH8
}

// ---- the public-path binding (tests/rendering-options/procedural-frame-utility.spec.mjs)
// Public window types of the utility family (WINDOW_TYPE_IDENTITIES -14304..-14288), canonical slug
// first, then the legacy alias that names the same type. Declared defaults (spec §10.3; the public
// type -> variation mapping is not decoded): side = the side-floating types; collapsed = the
// collapsed types; renderWindow forwards the title to the titled types only (runtime policy), so
// UI10 gives H 15 there and 13 elsewhere. collapsed-no-title-utility-window is excluded: the loader does not expose it for
// these five schemes, so the public path cannot reach its record (#423).
export const UTILITY_TYPES = [
  { slug: 'titled-utility-window', side: false, collapsed: false, titled: true },
  { slug: 'collapsed-titled-utility-window', legacy: 'collapsed-titled-utility', side: false, collapsed: true, titled: true },
  { slug: 'side-floating-utility-window', side: true, collapsed: false, titled: false },
  { slug: 'collapsed-side-floating-utility-window', legacy: 'collapsed-side-utility', side: true, collapsed: true, titled: false },
  { slug: 'no-title-utility-window', side: false, collapsed: false, titled: false },
  { slug: 'collapsed-no-title-utility-window', legacy: 'collapsed-no-title-utility', side: false, collapsed: true, titled: false },
];
/** The content size the binding renders (UG1 needs C only; 160 × 90 keeps every probe clear of the title). */
export const UTILITY_CONTENT = [160, 90];

/**
 * The binding's plan for one type: the spec geometry with the structure's top-left at (0, 0)
 * (canvas coordinates), the frame insets, the frame probes (each sourced from the last §9.4 op that
 * covers it), the three potential widget boxes and the stripes window. Nothing here depends on the
 * declared goAway / zoom / shadeOn flags: probes avoid every place a widget glyph could land
 * (`activeSafe` false = checked only when inactive), and the stripes window lies inside [Lu, Ru)
 * for every flag combination.
 */
export function utilityPlan(type, [cw, ch] = UTILITY_CONTENT, { reading = {} } = {}) {
  const u = urd(reading), H = u.barHeight({ side: type.side, titled: type.titled }), t = H + 1;
  const C = type.side ? [t, u.outset, t + cw, u.outset + ch] : [u.outset, t, u.outset + cw, t + ch];
  const w = { variation: type.side ? 9 : 1, C, hilited: true, collapsed: type.collapsed, title: type.titled ? 'x' : '' };
  const geo = utilityGeometry(w, { reading }), bb = bbox(geo.structure), c = geo.content, [Fl, Ft, Fr, Fb] = geo.F;
  const insets = [c[0] - bb[0], c[1] - bb[1], bb[2] - c[2], bb[3] - c[3]];
  const ops = utilityFrameOps(geo, { reading }).filter(o => o[0] === 'line'), interior = utilityFrameOps(geo, { reading }).find(o => o[0] === 'interior')[1];
  // Every place a glyph could land: 16 × 16 from the close, collapse and both zoom positions (UG5–UG7, §9.6).
  const T = geo.T, off = u.boxOffset(t), at = a => (type.side ? [T[0] + off, a, T[0] + off + 10, a + 10] : [a, T[1] + off, a + 10, T[1] + off + 10]);
  const s = type.side ? T[1] : T[0], e = type.side ? T[3] : T[2];
  const boxes = { close: at(s + u.closeInset), zoom: at(e - u.collapseInset - u.zoomShift), collapse: at(e - u.collapseInset) };
  const glyphs = Object.values(boxes).map(b => [b[0], b[1], b[0] + 16, b[1] + 16]);
  const mx = Math.trunc((Fl + Fr) / 2), my = Math.trunc((Ft + Fb) / 2), pts = [];
  const add = (name, x, y) => pts.push([name, [x, y]]);
  if (type.collapsed) {
    for (let i = 0; i < 2; i++) {
      add(`UFC2 left column ${i}`, Fl + i, type.side ? my : Ft + 2); add(`UFC3 right column ${i}`, Fr - 1 - i, type.side ? my : Ft + 2);
      add(`UFC4 top row ${i}`, mx, Ft + i); add(`UFC5 bottom row ${i}`, mx, Fb - 1 - i);
    }
  } else if (!type.side) {
    for (let i = 0; i < 3; i++) add(`UFH7 top row ${i}`, mx, Ft + i);
    for (let i = 0; i < 4; i++) add(`UFH8 bottom row ${i}`, mx, Fb - 1 - i);
    for (let i = 0; i < 4; i++) { add(`UFH9 left column ${i}`, Fl + i, my); add(`UFH10 right column ${i}`, Fr - 1 - i, my); }
    for (let i = 0; i < 2; i++) add(`UFH9 bar column ${i}`, Fl + i, Ft + 8);
    for (let i = 0; i < 3; i++) add(`UFH11 separator row ${i}`, 20, c[1] - 1 - i);
  } else {
    for (let i = 0; i < 3; i++) add(`UFS7 left column ${i}`, Fl + i, my);
    for (let i = 0; i < 4; i++) add(`UFS8 right column ${i}`, Fr - 1 - i, my);
    for (let i = 0; i < 4; i++) { add(`UFS9 top row ${i}`, mx, Ft + i); add(`UFS10 bottom row ${i}`, mx, Fb - 1 - i); }
    for (let i = 0; i < 2; i++) { add(`UFS9 bar row ${i}`, Fl + 8, Ft + i); add(`UFS10 bar row ${i}`, Fl + 8, Fb - 1 - i); }
    for (let i = 0; i < 3; i++) add(`UFS11 separator column ${i}`, c[0] - 1 - i, my);
  }
  add('UFT3 drop shadow row', mx, Fb); add('UFT3 drop shadow column', Fr, type.collapsed && !type.side ? Ft + 2 : my);
  const covers = ([x, y], [x0, y0, x1, y1]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1);
  const probes = pts.map(([name, p]) => {
    const op = ops.filter(o => covers(p, o[1])).at(-1);
    return { name, at: p, src: op ? op[2] : null, activeSafe: !glyphs.some(g => inRect(p, g)), inInterior: inRect(p, interior) };
  });
  // Outside the structure (UG2 shadow starts 2 px in): never drawn.
  const untouched = [[Fl, Fb], [Fl + 1, Fb], [Fr, Ft], [Fr, Ft + 1]];
  // Stripes window: one 9-px period along the band, rows (side: columns) clipped to the interior (US2).
  const bo = T[type.side ? 0 : 1] + u.bandOffset(t), across = [];
  for (let k = bo; k < bo + u.stripeExtent; k++) if (type.side ? k >= interior[0] && k < interior[2] : k >= interior[1] && k < interior[3]) across.push(k);
  const along = type.side ? 40 : 26;
  const stripes = { bandStart: bo, across, along: Array.from({ length: u.stripeExtent }, (_, i) => along + i) };
  return { H, C, size: [bb[2] - bb[0], bb[3] - bb[1]], insets, frameId: u.frameCicn[type.side ? 'side' : 'horizontal'], samples: u.samples[type.side ? 'side' : 'horizontal'],
    probes, untouched, boxes, widgetIds: u.widgetIds, stripes, stripeIds: u.stripeIds[type.side ? 'side' : 'horizontal'], interior, geo };
}
