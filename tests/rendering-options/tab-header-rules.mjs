// Source-addressed tab (CDEF 8) and whole-header (PACH 130) rules.
// Pure ESM, nothing from src/. The Node test and the source/built spec share
// this table; the runtime is the thing under test. Literals are transcribed
// from docs/spec/tab-cdef8-body.md ("Actual caller and selection", "Body helper
// 0x16e", "Corpus rule table") and docs/spec/header-surface.md ("Source
// bindings", "Direct full-color pattern body", "Corpus rule table"), and were
// re-read in the pinned listings (CDEF 8 sha256 4c9fecff…, PACH 130 bf113e70…).

// ---- Tabs: CDEF 8 selection -------------------------------------------------
// 0x8f6–0x91c small variant (data+32)&7 == 1, 0x930–0x956 large variant.
export const TAB_IDS = { small: [-9976, -9960], large: [-9984, -9968] };
/**
 * Per-tab state handed to 0x7de. Resting caller 0xcc2–0xce0: hilite 254/255 ->
 * 0, else 1; 0xdb4–0xdc4: a zero per-tab enabled byte forces 0; tracking
 * 0x117a–0x11a8 toggles 1 <-> 2; 0x8d2–0x8dc adds 3 when the tab index equals
 * the control value (the selected tab).
 */
export function tabState({ hilite = 0, tabEnabled = true, tracking = false, selected = false }) {
  let s = hilite === 254 || hilite === 255 || !tabEnabled ? 0 : 1;
  if (tracking && s === 1) s = 2;
  return s + (selected ? 3 : 0);
}
/**
 * 0x16e returns false only when its icon is NULL (0x18c–0x194); then the
 * caller probes the fallback id. A found icon without same-id cinf returns
 * true and draws nothing (0x38e -> 0x622). `census` = { cicn: Set, cinf: Set }
 * for the declared resource chain (here: the archive fork only).
 * Returns { id, drawn, probes }.
 */
export function selectTab({ variant = 'small', state }, census) {
  const probes = TAB_IDS[variant].map(base => base + state);
  for (const id of probes) if (census.cicn.has(id)) return { id, drawn: census.cinf.has(id), probes };
  return { id: null, drawn: false, probes };
}
/** Public composeTab options -> declared native inputs. MODERN POLICY, not a
 * decode: small variant, hilite 0, tab enabled, not tracking. */
export const nativeForTab = ({ selected = false }) => ({ variant: 'small', state: tabState({ selected }) });
export const TAB_PUBLIC_ROWS = [{ label: '', selected: false }, { label: '', selected: true }];

// ---- Headers: PACH 130 selection ---------------------------------------------
/** 0xc1e8–0xc1f8 tests the whole UInt32 state at +8: zero -> -9568, else -9567. */
export const headerId = drawState => (drawState === 0 ? -9568 : -9567);

// ---- Raw resources -----------------------------------------------------------
/** Raw cinf bytes (big-endian), read here rather than through the loader:
 * 0 corner c, 1 side s, 2 repeat flag, 3 body mode, 4 signed body id,
 * 6/8 background sample y/x (QuickDraw Point order, v then h). */
export function parseCinf(bytes) {
  const s16 = at => ((bytes[at] << 8 | bytes[at + 1]) << 16) >> 16;
  return { c: bytes[0], s: bytes[1], tile: bytes[2] !== 0, mode: bytes[3], bodyId: s16(4), sample: [s16(8), s16(6)] };
}

// ---- Pixel model helpers -----------------------------------------------------
// An expectation is { width, height, rgba, known }: `known[i]` is 1 where the
// rule fixes pixel i (alpha 0 means "transparent"), 0 where it is not asserted.
const blank = (width, height) => ({ width, height, rgba: new Uint8ClampedArray(width * height * 4), known: new Uint8Array(width * height).fill(1) });
const put = (out, x, y, p, known = 1) => {
  if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
  const i = y * out.width + x; out.rgba.set(p, i * 4); out.known[i] = known;
};
const px = (img, x, y) => { const i = (y * img.width + x) * 4; return img.rgba.subarray(i, i + 4); };
/** Masked copy of src rect (sx,sy,sw,sh) tiled forward over dst rect: opaque
 * source pixels write, transparent ones leave earlier paint (CopyMask). */
function blit(out, src, [sx, sy, sw, sh], [dx, dy, dw, dh], known = 1) {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const p = px(src, sx + (x % sw), sy + (y % sh));
    if (p[3]) put(out, dx + x, dy + y, p, known);
    else if (!known) put(out, dx + x, dy + y, [0, 0, 0, 0], 0);
  }
}
const fill = (out, [x0, y0, x1, y1], colorAt, known = 1) => {
  for (let y = Math.max(0, y0); y < Math.min(out.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(out.width, x1); x++) put(out, x, y, colorAt(x, y), known);
};

/**
 * CDEF 8 0x16e body at destination width W (the runtime's width: the original
 * caller's StringWidth+24 rule, 0x856–0x8a8, is not what composeTab exposes). `src` = full PixMap raster {width, height,
 * rgba}; `bg` = raw background-sample display RGB; `sampling` = the owner's
 * opaque sampled-line equivalence status. Order: full-height ends
 * (0x430–0x47e), top band, bottom band (0x484–0x552, source x [c, w-c], or one
 * column when cinf[2]==0), then the separate centre (0x56c–0x600).
 */
export function tabBody(src, cinf, W, { bg = null, sampling = 'equivalent', variant = {} } = {}) {
  const { c, s } = variant.swapCs ? { c: cinf.s, s: cinf.c } : cinf;
  const H = src.height, out = blank(W, H);
  blit(out, src, [0, 0, c, H], [0, 0, c, H]);
  blit(out, src, [src.width - c, 0, c, H], [W - c, 0, c, H]);
  const tile = variant.tile ?? cinf.tile;
  const bw = tile ? src.width - 2 * c : 1, col = c + (variant.bandColumn ?? 0);
  // Width-one sources take the sampled-line path (0x1f10–0x1f86); its colours
  // equal the raster only under the owner's 'equivalent' record.
  const lineKnown = bw === 1 && W - 2 * c > 1 && sampling !== 'equivalent' ? 0 : 1;
  for (const y of variant.bandsReversed ? [H - s, 0] : [0, H - s]) blit(out, src, [col, y, bw, s], [c, y, W - 2 * c, s], lineKnown);
  if (W > 2 * c && H > 2 * s && !variant.noCenter) {
    const solid = cinf.bodyId === 0 && bg;
    fill(out, [c, s, W - c, H - s], () => (solid ? [...bg, 255] : [0, 0, 0, 0]), solid ? 1 : 0);
  }
  return out;
}

/**
 * PACH 130 whole header surface at requested W x H. List-view paints H+1 and
 * is clipped to H (0xc53a–0xc546). Body = union of inset(c horizontal, s
 * vertical) and the transposed inset (0x71a2–0x7202 pattern, 0x721a–0x7260
 * solid), painted first; then masked corners/bands TL, TR, top, BL, BR,
 * bottom, left, right (0x72a8–0x7620). Pattern phase uses P from 0x7156–0x719e
 * (mode 1 TL, 2 TR, 3 BL, 4 BR of the paint Rect, else 0,0) and
 * sample(q) = floorMod(origin + q - P + R, size).
 */
export function headerSurface(src, cinf, { kind, width: W, height: H, origin = [0, 0], R = [0, 0], bg = null, pattern = null, sampling = 'equivalent', variant = {} }) {
  const { c, s } = variant.swapCs ? { c: cinf.s, s: cinf.c } : cinf;
  const HP = H + (kind === 'list-view-header' && !variant.noListExtension ? 1 : 0);
  const out = blank(W, H);
  const mode = variant.ignoreAnchor ? 0 : cinf.mode;
  const [ox, oy] = origin, P = { 1: [ox, oy], 2: [ox + W, oy], 3: [ox, oy + HP], 4: [ox + W, oy + HP] }[mode] ?? [0, 0];
  const mod = (a, n) => ((a % n) + n) % n;
  const bodyAt = pattern
    ? (x, y) => px(pattern, mod(ox + x - P[0] + R[0], pattern.width), mod(oy + y - P[1] + R[1], pattern.height))
    : () => [...bg, 255];
  const bodyKnown = pattern || bg ? 1 : 0;
  const insets = variant.singleInset ? [[c, s]] : [[c, s], [s, c]];
  if (!variant.bodyLast) for (const [h, v] of insets) fill(out, [h, v, W - h, HP - v], bodyAt, bodyKnown);
  const cw = Math.min(c, src.width), ch = Math.min(c, src.height), sw = Math.min(s, src.width), sh = Math.min(s, src.height);
  const tile = variant.tile ?? cinf.tile, bw = tile ? src.width - 2 * c : 1, bh = tile ? src.height - 2 * c : 1;
  const regions = [
    [[0, 0, cw, ch], [0, 0, cw, ch]],
    [[src.width - cw, 0, cw, ch], [W - cw, 0, cw, ch]],
    [[c, 0, bw, sh], [c, 0, W - 2 * c, sh]],
    [[0, src.height - ch, cw, ch], [0, HP - ch, cw, ch]],
    [[src.width - cw, src.height - ch, cw, ch], [W - cw, HP - ch, cw, ch]],
    [[c, src.height - sh, bw, sh], [c, HP - sh, W - 2 * c, sh]],
    [[0, c, sw, bh], [0, c, sw, HP - 2 * c]],
    [[src.width - sw, c, sw, bh], [W - sw, c, sw, HP - 2 * c]],
  ];
  for (const [[sx, sy, w, h], dst] of variant.reverseBorders ? regions.reverse() : regions) {
    if (w <= 0 || h <= 0 || dst[2] <= 0 || dst[3] <= 0) continue;
    // Out-of-raster source reads are not modelled; their pixels stay unknown.
    if (sx < 0 || sy < 0 || sx + w > src.width || sy + h > src.height) { fill(out, [dst[0], dst[1], dst[0] + dst[2], dst[1] + dst[3]], () => [0, 0, 0, 0], 0); continue; }
    const expands = (w === 1 && dst[2] > 1) || (h === 1 && dst[3] > 1);
    blit(out, src, [sx, sy, w, h], dst, expands && sampling !== 'equivalent' ? 0 : 1);
  }
  if (variant.bodyLast) for (const [h, v] of insets) fill(out, [h, v, W - h, HP - v], bodyAt, bodyKnown);
  return out;
}

/** Compare one observed RGBA buffer with an expectation. Alpha must match on
 * every known pixel; RGB on known opaque ones. */
export function diff(expected, observed) {
  if (!observed) return { equal: false, reason: 'null output', mismatched: null, unknown: null };
  if (expected.width !== observed.width || expected.height !== observed.height)
    return { equal: false, reason: `size ${observed.width}x${observed.height} != ${expected.width}x${expected.height}`, mismatched: null, unknown: null };
  let mismatched = 0, unknown = 0;
  for (let i = 0; i < expected.known.length; i++) {
    if (!expected.known[i]) { unknown++; continue; }
    const a = expected.rgba[i * 4 + 3], b = observed.rgba[i * 4 + 3];
    if (a !== b || (a && [0, 1, 2].some(k => expected.rgba[i * 4 + k] !== observed.rgba[i * 4 + k]))) mismatched++;
  }
  return { equal: mismatched === 0, reason: mismatched ? `${mismatched} pixels differ` : null, mismatched, unknown };
}

/** Plausible wrong readings. Each is run against every archive; tables of which
 * archives each one fails are pinned by the tests. */
export const TAB_VARIANTS = {
  'selected ignored (always rear)': { select: () => ({ variant: 'small', state: 1 }) },
  'selected adds 1 (pressed rear)': { select: ({ selected }) => ({ variant: 'small', state: selected ? 2 : 1 }) },
  'large variant': { select: ({ selected }) => ({ variant: 'large', state: tabState({ selected }) }) },
  'disabled state': { select: ({ selected }) => ({ variant: 'small', state: tabState({ hilite: 255, selected }) }) },
  'c and s swapped': { body: { swapCs: true } },
  'band repeats the whole middle': { body: { tile: true } },
  'band uses column c+1': { body: { bandColumn: 1 } },
  'centre not filled': { body: { noCenter: true } },
};
export const HEADER_VARIANTS = {
  'state polarity swapped': { id: drawState => (drawState === 0 ? -9567 : -9568) },
  'c and s swapped': { body: { swapCs: true } },
  'single inset body': { body: { singleInset: true } },
  'repeat flag ignored (always repeat)': { body: { tile: true } },
  'no list-view extension': { body: { noListExtension: true } },
  'pattern anchor ignored': { body: { ignoreAnchor: true } },
  'borders reversed': { body: { reverseBorders: true } },
  'body painted last': { body: { bodyLast: true } },
};

export const TAB_ARCHIVES = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'windows-31', 'windows-95'];
export const HEADER_ARCHIVES = TAB_ARCHIVES.filter(s => s !== 'apple-platinum-2');
export const ALL_ARCHIVES = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];
/** Sampled header rows: both kinds, UInt32 states 0/1/0xffffffff, two sizes, two origins. */
export const HEADER_ROWS = ['window-header', 'list-view-header'].flatMap(kind => [0, 1, 0xffffffff].flatMap(drawState =>
  [[61, 17], [7, 5]].flatMap(([width, height]) => [[0, 0], [5, 3]].map(origin => ({ kind, drawState, width, height, origin })))));
