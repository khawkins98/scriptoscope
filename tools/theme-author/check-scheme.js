// Authoring checks: mistakes that still LOAD but render wrong.
//
// The runtime loader is forgiving on purpose (it has to accept 1990s files),
// so a malformed recipe usually shows up as a glitchy window or a silent
// fallback, not an error. These checks catch common authoring mistakes up
// front. Each rule was run against all 18 corpus schemes: a rule that fires on
// original schemes is a warning at most, because the originals are what the
// runtime must accept.
//
// Rule sources: docs/spec/compositor-spec.md (side recipes, widget cells),
// docs/spec/engine/window-widgets.md TC1–TC5 (title colour swatch),
// docs/spec/engine/push-button.md (same-id cinf), docs/spec/checkable-icons.md.

import { readCicnIndexed } from '../theme-loader/decoders/cicn.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';
import { decodeCinf } from '../theme-loader/decoders/cinf.js';
import { WINDOW_TYPE_IDENTITIES } from '../theme-loader/window-type-identities.js';
import { macChannelToSrgb } from '../theme-loader/mac-gamma.js';

// Part codes that absorb extra width/height when the window grows.
const GROW_CODES = new Set([8, 11, 12, 18]);
// Part codes a widget must NOT sit in: growers, remainder cells (13/14), collapse (0),
// and 15/16/17, which collapse to zero exactly when their widget is present.
// Every other code (1–7, 9, 10, and unknown codes, which default to fixed) is drawn 1:1.
const NOT_FOR_WIDGETS = new Set([0, 8, 11, 12, 13, 14, 15, 16, 17, 18]);
const WIDGET_NAMES = { 1: 'close box', 2: 'zoom box', 3: 'collapse box' };
// Families whose images are only used together with a same-id cinf (corner,
// side and sample points). Sources: docs/spec/engine/{tab,progress,header}.md,
// the menu dumps recorded in authoring/schemes/halcyon/parts/menus.mjs.
const SAME_ID_CINF = [
  { from: -12240, to: -12232, label: 'menu image', why: 'Kaleidoscope needs it to stretch the image and read the text colour', skip: [] },
  { from: -9984, to: -9971, label: 'tab', why: 'the tab engine paints nothing without it (tab V3)' },
  { from: -9568, to: -9567, label: 'Finder header', why: 'the header body colour is read at its bgPixel' },
  { from: -10080, to: -10075, label: 'progress bar piece', why: 'the progress engine reads its corner and side sizes from it' },
];
const PUSH_FACES = { [-10240]: 'inactive push button', [-10239]: 'push button', [-10238]: 'pressed push button' };

/**
 * @param {import('./resource-fork-writer.js').ResourceInput[]} resources
 * @param {object} [theme] the converted theme from convertChrome, for the summary
 * @returns {{ errors: string[], warnings: string[], summary: string[] }}
 */
export function checkScheme(resources, theme) {
  const errors = [], warnings = [], summary = [];
  const find = (type, id) => resources.find((r) => r.type === type && r.id === id);
  const cicnCache = new Map();
  const cicn = (id) => {
    if (!cicnCache.has(id)) {
      const r = find('cicn', id);
      cicnCache.set(id, r ? readCicnIndexed(r.data) : null);
    }
    return cicnCache.get(id);
  };

  // ── Every cicn should have some visible pixels ──
  for (const r of resources.filter((r) => r.type === 'cicn')) {
    const c = cicn(r.id);
    if (c && !c.maskAlpha.some((a) => a > 0)) warnings.push(`cicn ${r.id}: every pixel is transparent`);
  }

  // ── Window types ──
  const known = new Map(WINDOW_TYPE_IDENTITIES.map((w) => [w.id, w.canonicalSlug]));
  for (const r of resources.filter((r) => r.type === 'wnd#')) {
    const slug = known.get(r.id);
    const label = `wnd# ${r.id} (${slug ?? r.name ?? 'custom'})`;
    const wnd = decodeWnd(r.data);
    // A wnd# pairs with cicn id (inactive) and id + 1 (active). With no id + 1
    // the loader reuses id for both states (buildThemeJson.js pairChromeStates).
    const inactive = cicn(r.id);
    if (!inactive) { errors.push(`${label}: missing frame cicn ${r.id} (the inactive frame; a wnd# pairs with cicn id and id + 1)`); continue; }
    const active = cicn(r.id + 1) ?? inactive;
    if (active === inactive) warnings.push(`${label}: no active frame cicn ${r.id + 1}; the inactive frame is used for both states`);
    const { width, height } = active.pmap;
    if (inactive.pmap.width !== width || inactive.pmap.height !== height) {
      errors.push(`${label}: active (${width}x${height}) and inactive (${inactive.pmap.width}x${inactive.pmap.height}) frames must be the same size`);
    }
    const collapsed = /collapsed/.test(slug ?? '') || (wnd.leftSide.length === 0 && wnd.rightSide.length === 0);

    const sides = { top: [wnd.topSide, width], bottom: [wnd.bottomSide, width], left: [wnd.leftSide, height], right: [wnd.rightSide, height] };
    for (const [name, [side, extent]] of Object.entries(sides)) {
      if (!side.length) continue;
      const last = side[side.length - 1].border;
      // Several corpus schemes do this and the runtime clips it, so it is only a warning.
      if (last > extent) warnings.push(`${label}: ${name} side ends at ${last}, past the ${extent}px frame image`);
      if (!collapsed && !side.slice(1).some((s) => GROW_CODES.has(s.part))) {
        warnings.push(`${label}: ${name} side has no growing cell (codes 8/11/12/18), so the window cannot get ${name === 'top' || name === 'bottom' ? 'wider' : 'taller'} without clipping`);
      }
    }

    // A side only paints [first border, last border): flag visible art outside it.
    const body = lastRect(wnd, 0);
    if (body) {
      const bands = {
        top: { side: wnd.topSide, along: 'x', rows: [0, body.top] },
        bottom: { side: wnd.bottomSide, along: 'x', rows: [body.bottom, height] },
        // The top and bottom edges already paint the corners, so the vertical
        // edges are only checked between them.
        left: { side: wnd.leftSide, along: 'y', cols: [0, body.left], span: [body.top, body.bottom] },
        right: { side: wnd.rightSide, along: 'y', cols: [body.right, width], span: [body.top, body.bottom] },
      };
      for (const [name, band] of Object.entries(bands)) {
        if (!band.side.length) continue;
        const first = band.side[0].border, last = band.side[band.side.length - 1].border;
        const lost = countOpaque(active, band, first, last);
        if (lost) warnings.push(`${label}: ${lost} visible pixel(s) of the ${name} edge lie outside its recipe [${first}, ${last}) and will never be drawn; start the side at 0 and end it at the image ${band.along === 'x' ? 'width' : 'height'}`);
      }
    }

    // Widgets must ride FIXED top-side cells, or they get tiled or collapsed.
    for (const { part, rect } of wnd.rectangles) {
      const inside = rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= height;
      if (!inside) (collapsed ? warnings : errors).push(`${label}: rect-list part ${part} ${JSON.stringify(rect)} lies outside the ${width}x${height} frame`);
      if (!WIDGET_NAMES[part] || rect.right <= rect.left) continue;
      const moving = cellsOf(wnd.topSide)
        .filter((c) => c.start < rect.right && c.end > rect.left && c.part !== null && NOT_FOR_WIDGETS.has(c.part));
      if (moving.length) {
        (collapsed ? warnings : errors).push(`${label}: ${WIDGET_NAMES[part]} x=${rect.left}..${rect.right} overlaps a code-${moving[0].part} top cell, which stretches or collapses; keep widgets inside fixed (code 1) cells`);
      }
    }

    // Content rectangle (part 0): required, and it carries the title colour swatch.
    // The engine uses the LAST rect of a part (rectOfType), so we do too.
    const content = lastRect(wnd, 0);
    if (!content) { errors.push(`${label}: no content rectangle (rect-list part 0); the runtime cannot place the window body`); continue; }
    if (content.right <= content.left || content.bottom <= content.top) {
      errors.push(`${label}: content rectangle ${JSON.stringify(content)} is empty or inside out; it needs right > left and bottom > top`);
      continue;
    }
    const titled = wnd.rectangles.some((x) => x.part === 4 && x.rect.right > x.rect.left);
    if (titled && content.top <= 6 && !collapsed) warnings.push(`${label}: content top is ${content.top}; titled windows need more than 6px of title bar (title size = clamp(top − 6, 8, 13))`);
    if (titled) {
      // Title text colour = pixel (content.left, content.top) of each frame
      // (popup family: row content.bottom − 1), read from the palette even
      // though that pixel is usually transparent (window-widgets TC1–TC5).
      const row = /popup/.test(slug ?? '') ? content.bottom - 1 : content.top;
      const sample = (c) => hexAt(c, content.left, row);
      summary.push(`${slug ?? r.id}: title text ${sample(active)} active / ${sample(inactive)} inactive`);
    }
  }

  // (Not checked, on purpose: a title-rect height rule and a per-window
  // pressed-strip offset rule both fired on 12 of 18 corpus schemes. The
  // guidance for both is in docs/authoring-exotic-frames.md R24 and R28.)

  // ── Pressed-widget strip: without it the web makes no widget clickable ──
  // (docs/authoring-exotic-frames.md R24: widgetHittable requires the strip.)
  const hasWidgets = resources.some((r) => r.type === 'wnd#' && decodeWnd(r.data).rectangles
    .some((x) => x.part >= 1 && x.part <= 3 && x.rect.right > x.rect.left));
  if (hasWidgets && !find('cicn', -14330)) {
    warnings.push('no pressed-widget strip (cicn -14330): the web runtime makes close/zoom/collapse clickable only when it exists');
  }

  // ── Push buttons: a face without a same-id cinf silently becomes Platinum ──
  const faces = Object.keys(PUSH_FACES).map(Number).filter((id) => find('cicn', id));
  for (const id of faces) {
    if (!find('cinf', id)) warnings.push(`cicn ${id} (${PUSH_FACES[id]}) has no cinf ${id}; the runtime ignores the face and draws a Platinum button`);
  }
  if (faces.length && !find('cicn', -10238)) warnings.push('push buttons: no pressed face (cicn -10238); enabled buttons fall back to Platinum');
  for (const id of faces) {
    const cinfRes = find('cinf', id);
    if (!cinfRes) continue;
    const d = decodeCinf(cinfRes.data), c = cicn(id);
    checkFaceCinf(`${PUSH_FACES[id]} (cinf ${id})`, d, c, warnings);
    summary.push(`${PUSH_FACES[id]}: face ${hexAt(c, d.bgPixel.x, d.bgPixel.y)}, text ${hexAt(c, d.textPixel.x, d.textPixel.y)}`);
  }

  // Default-button rings use the same corner/sample layout as the faces.
  for (const id of [-10232, -10231]) {
    const cinfRes = find('cinf', id), c = cicn(id);
    if (cinfRes && c) checkFaceCinf(`default ring (cinf ${id})`, decodeCinf(cinfRes.data), c, warnings);
  }

  // ── Families the engine skips (or hands to Platinum) without a same-id cinf ──
  for (const { from, to, label, why, skip = [] } of SAME_ID_CINF) {
    for (const r of resources) {
      if (r.type !== 'cicn' || r.id < from || r.id > to || skip.includes(r.id) || find('cinf', r.id)) continue;
      warnings.push(`cicn ${r.id} (${label}) has no cinf ${r.id}; ${why}, so check how it renders (several Platinum-based corpus schemes rely on a base scheme here)`);
    }
  }

  // (Scrollbar transparency is a guide gotcha, not a rule: 12 of 18 corpus
  // schemes ship scroll pieces with transparent pixels and still render.)

  // ── Text that samples the same colour as its background is invisible ──
  for (const r of resources.filter((x) => x.type === 'cinf')) {
    const c = cicn(r.id);
    if (!c) continue;
    const d = decodeCinf(r.data);
    // Default-button rings (-10232…-10230) never draw text.
    if ((!d.textPixel.x && !d.textPixel.y) || (r.id >= -10232 && r.id <= -10230)) continue;
    const text = hexAt(c, d.textPixel.x, d.textPixel.y), bg = hexAt(c, d.bgPixel.x, d.bgPixel.y);
    if (text === bg && text.startsWith('#')) warnings.push(`cinf ${r.id}: textPixel and bgPixel both sample ${text}, so any text drawn on this piece is invisible`);
  }

  // ── Progress frame: corner > side leaves columns unpainted (docs/spec/engine/progress.md) ──
  for (const id of [-10080, -10077]) {
    const res = find('cinf', id);
    if (!res || !find('cicn', id)) continue;
    const d = decodeCinf(res.data);
    if (d.cornerSize > d.sideThickness) warnings.push(`cinf ${id} (progress frame): cornerSize ${d.cornerSize} > sideThickness ${d.sideThickness} leaves columns between the side band and the fill unpainted`);
  }

  // ── Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier ──
  const checkables = [];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    checkables.push(-9504 + 12 * kind + 3 * value + tier);
  }
  const shipped = checkables.filter((id) => find('cicn', id));
  if (shipped.length && shipped.length < checkables.length) {
    warnings.push(`checkables: ${checkables.length - shipped.length} of ${checkables.length} checkbox/radio cicns are missing (${checkables.filter((id) => !find('cicn', id)).join(', ')})`);
  }

  // What classic Kaleidoscope will show beyond the windows (not warnings:
  // plenty of corpus schemes skip these). Castle and Brickworks shipped none
  // of them and their builders didn't notice until the emulator run.
  const has = (type, id) => !!find(type, id);
  const yes = (b) => (b ? 'yes' : 'no (system default)');
  // Classic reads utility windows' pressed widgets from -14298, not -14330 (R24,
  // WD11 altWidgets); the web never does. Castle and Bonn shipped none.
  const utilityWidgets = resources.some((r) => r.type === 'wnd#' && /utility/.test(known.get(r.id) ?? '')
    && decodeWnd(r.data).rectangles.some((x) => x.part >= 1 && x.part <= 3 && x.rect.right > x.rect.left));
  const utilityStrip = utilityWidgets ? `; pressed utility widgets (cicn -14298) ${has('cicn', -14298) ? 'yes' : 'no (classic reads utility windows\' pressed art from it)'}` : '';
  summary.push(`classic extras: desktop pattern (ppat 17) ${yes(has('ppat', 17))}; picker icon (ICN# -16455) ${yes(has('ICN#', -16455))}; menus (cicn -12240) ${yes(has('cicn', -12240))}${utilityStrip}`);

  if (theme) {
    const types = Object.keys(theme.windowTypes ?? {});
    summary.unshift(`chrome elements: ${Object.keys(theme.chromeElements ?? {}).length}`);
    summary.unshift(`window types: ${types.length ? types.join(', ') : 'none'}`);
  }
  return { errors, warnings, summary };
}

/**
 * A button face's cinf points at pixels of its cicn and says how big the
 * fixed corners are. Points outside the image read garbage; corners bigger
 * than half the face overlap each other. (No corpus face does either.)
 */
function checkFaceCinf(label, d, c, warnings) {
  const { width: W, height: H } = c.pmap;
  for (const key of ['bgPixel', 'textPixel', 'embossPixel']) {
    const { x, y } = d[key];
    if (x < 0 || y < 0 || x >= W || y >= H) warnings.push(`${label}: ${key} (${x}, ${y}) is outside the ${W}x${H} image`);
  }
  if (2 * d.cornerSize > Math.min(W, H)) warnings.push(`${label}: cornerSize ${d.cornerSize} is more than half the ${W}x${H} image, so the corners overlap`);
}

function lastRect(wnd, part) {
  const all = wnd.rectangles.filter((x) => x.part === part);
  return all.length ? all[all.length - 1].rect : undefined;
}

/** On-screen colour at a pixel, ignoring the mask (as the engine does). */
function hexAt(c, x, y) {
  if (!c || x < 0 || y < 0 || x >= c.pmap.width || y >= c.pmap.height) return 'out of bounds';
  const index = c.indices[y * c.pmap.width + x];
  const e = c.colorTable.entries.find((en) => en.value === index) ?? c.colorTable.entries[index];
  if (!e) return 'missing palette entry';
  return '#' + [e.r, e.g, e.b].map((v) => macChannelToSrgb(v >> 8).toString(16).padStart(2, '0')).join('');
}

/** Opaque pixels in an edge band that fall outside [first, last) along the edge. */
function countOpaque(c, band, first, last) {
  let n = 0;
  const W = c.mask.width, H = c.mask.height;
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && c.maskAlpha[y * W + x] > 0;
  if (band.along === 'x') {
    for (let y = band.rows[0]; y < band.rows[1]; y++) for (let x = 0; x < W; x++) if ((x < first || x >= last) && on(x, y)) n++;
  } else {
    for (let x = band.cols[0]; x < band.cols[1]; x++) for (let y = band.span[0]; y < band.span[1]; y++) if ((y < first || y >= last) && on(x, y)) n++;
  }
  return n;
}

/** Turn a side recipe into cells. The leading/trailing corners have part null. */
export function cellsOf(side) {
  if (!side.length) return [];
  const cells = [{ start: 0, end: side[0].border, part: null }];
  for (let i = 1; i < side.length; i++) cells.push({ start: side[i - 1].border, end: side[i].border, part: side[i].part });
  cells.push({ start: side[side.length - 1].border, end: Infinity, part: null });
  return cells;
}
