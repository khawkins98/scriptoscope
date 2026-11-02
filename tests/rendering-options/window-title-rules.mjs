// Title-text acceptance rows for wnd# windows (docs/spec/engine/window-widgets.md TX3, TX4,
// TX8; DECISIONS #13 and §7.2 F11). Pure ESM, imports nothing from src/: the browser spec
// injects the public runtime. The rows assert where the title's ink may land, measured as
// the pixels a public renderWindow changes over the same window's text-free chrome.
//
// The text-free chrome is recomposed through the public composeWindowChrome from the
// archive's own decoded cicn. The layout depends on the title only through its measured
// width SW, which the public API does not expose, so the recomposition sweeps SW and keeps
// the first value whose placement map and remapped title rect equal the rendered window's.
// Any such SW yields the same chrome pixels; the caller checks that the two buffers then
// differ only inside the decoded clip's row band (or the row fails).

/** TX4: the decoded clip, `t4p` widened by 2 on the right (rect `{x, y, w, h}`, half-open). */
export const decodedClip = t4p => ({ x: t4p.x, y: t4p.y, w: t4p.w + 2, h: t4p.h });

/** The text-free chrome of a rendered window: `{ buffer, SW }`, or null when no SW matches. */
export function textFreeChrome(composeWindowChrome, cicn, windowType, composed, { titleLength, popupFamily = false, maxSW = 800 }) {
  const contentW = composed.fullWidth - composed.frame.left - composed.frame.right;
  const contentH = composed.fullHeight - composed.frame.top - composed.frame.bottom;
  const want = JSON.stringify([composed.placement, composed.titleRect]);
  for (let SW = 1; SW <= maxSW; SW++) {
    const c = composeWindowChrome(cicn, windowType, contentW, contentH, { titleWidthPx: SW, titleLength, popupFamily });
    if (JSON.stringify([c.placement, c.titleRect]) === want) return { buffer: c.buffer, SW };
  }
  return null;
}

/** Pixels where `drawn` differs from `chrome` (the title's ink), as `[x, y]`. */
export function inkPixels(drawn, chrome) {
  const out = [];
  for (let y = 0; y < drawn.height; y++) for (let x = 0; x < drawn.width; x++) {
    const a = drawn.getPixel(x, y), b = chrome.getPixel(x, y);
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) out.push([x, y]);
  }
  return out;
}
export const bbox = pts => pts.length ? pts.reduce((r, [x, y]) => ({ l: Math.min(r.l, x), t: Math.min(r.t, y), r: Math.max(r.r, x + 1), b: Math.max(r.b, y + 1) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }) : null;
export const inside = (pts, rect) => pts.filter(([x, y]) => !(x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h));

// PM1 + TT2/TX5/TX9: these tests exercise resolved recipe types directly.
// Keep the face oracle independent of the runtime's flag resolver and font weight.
export const titleFace = key => {
  if (key === 'document-window') return 'normal';
  if (key === 'titled-utility-window') return 'bold';
  throw new Error(`No independent title-face rule for ${key}`);
};

// README's title-font policy declares Charcoal 12 with Virtue fallback; the
// shared harness loads Virtue as Charcoal. Keep that fallback: Charcoal 12 lacks
// U+2026, while Virtue supplies it. TF4 keeps the primary's native 16px preferred
// pin. None of these inputs comes from a runtime draw or font resolver.
const TITLE_FAMILY = 'Charcoal 12';
export const PREFERRED_TITLE_SIZE = 16;
const glyphCache = new Map();

/** Inspect a runtime draw only as an actual value, never as reference input.
 * Fallback-family lists are immaterial because the harness loads this face. */
export function titleFontStyle(font) {
  const match = font?.match(/^(?:(bold|normal)\s+)?(\d+(?:\.\d+)?)px\s+("[^"]+"|[^,]+)/);
  return match ? { face: match[1] === 'bold' ? 'bold' : 'normal', size: Number(match[2]), family: match[3].replaceAll('"', '').trim() } : null;
}

/** Finite top-title geometry proof, not a general raw-T4 shortcut. CR1 keeps
 * every top segment's vertical band [0,A.top); RM5/RM6 therefore preserve both
 * T4 y coordinates for every candidate width when both corners lie there.
 * Reject any new recipe outside that domain instead of guessing its clip. */
export function topTitleHeight(windowType) {
  const [left, top, right, bottom] = windowType.parts['part-4'].rect;
  const [, contentTop] = windowType.parts['part-0'].rect;
  const edge = windowType.edges.top;
  if (!(top >= 0 && bottom <= contentTop && left >= edge[0].at && right <= edge.at(-1).at && right > left && bottom > top)) {
    throw new Error('Title oracle requires independent candidate-layout remapping for this recipe');
  }
  return bottom - top;
}

/** Independent browser raster, vertically unbounded. TX4 clips negative left
 * bearings at the pen; retain that horizontal clip when comparing whole-title
 * widths, but never clip reference glyph rows. */
export function titleReference(text, { face, size }) {
  if (!['normal', 'bold'].includes(face) || size < 1) throw new Error('Invalid title reference style');
  const cacheKey = JSON.stringify([text, face, size]);
  if (glyphCache.has(cacheKey)) return glyphCache.get(cacheKey);
  const canvas = document.createElement('canvas');
  const font = `${face} ${size}px "${TITLE_FAMILY}", Charcoal`;
  const measure = canvas.getContext('2d');
  measure.font = font;
  const metrics = measure.measureText(text);
  const padding = 8;
  canvas.width = Math.ceil(Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft)) + padding * 2;
  canvas.height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + padding * 2;
  const ctx = canvas.getContext('2d'), ascent = Math.ceil(metrics.actualBoundingBoxAscent);
  ctx.font = font;
  const penX = padding + Math.ceil(Math.max(0, metrics.actualBoundingBoxLeft));
  ctx.fillText(text, penX, padding + ascent);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data, ink = [];
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (rgba[(y * canvas.width + x) * 4 + 3]) ink.push([x, y]);
  }
  const rawBox = bbox(ink);
  const relative = points => bbox(points.map(([x, y]) => [x - penX, y - padding - ascent]));
  const result = { font: ctx.font, fontStyle: { face, size, family: TITLE_FAMILY }, face, size, ascent, advance: Math.ceil(metrics.width),
    fullBox: relative(ink), box: relative(ink.filter(([x]) => x >= penX)),
    unclipped: !!rawBox && rawBox.l > 0 && rawBox.t > 0 && rawBox.r < canvas.width && rawBox.b < canvas.height };
  glyphCache.set(cacheKey, result);
  return result;
}

/** TF2–TF6 (verified window-widgets blob f204162d): choose from the full
 * requested title before horizontal fitting; F11's baseline and TX4 stay fixed. */
export function resolveTitleStyle(title, key, clipHeight, { face = titleFace(key), preferred = PREFERRED_TITLE_SIZE } = {}) {
  const candidates = [];
  for (let size = preferred; size >= 1; size--) {
    const ref = titleReference(title, { face, size });
    const baseline = Math.max(clipHeight - 4, ref.ascent);
    const fits = !ref.fullBox || (baseline + ref.fullBox.t >= 0 && baseline + ref.fullBox.b <= clipHeight);
    candidates.push({ size, fits });
    if (fits) return { face, size, baseline, omit: false, candidates, reference: ref };
  }
  return { face, size: preferred, omit: true, candidates, reference: titleReference(title, { face, size: preferred }) };
}

/** TF1: retain the longest prefix + ellipsis fitting the unchanged room. */
export function fittedTitle(title, style, room) {
  if (style.omit) return undefined;
  if (titleReference(title, style).advance <= room) return title;
  for (let length = title.length - 1; length > 0; length--) {
    const text = title.slice(0, length) + '…';
    if (titleReference(text, style).advance <= room) return text;
  }
  return '…';
}

/** The top side's code-5 anchor cell (the plate, TT5–TT9) from the placement map. */
export const plateOf = composed => composed.placement.find(p => p.edge === 'top' && p.code === 5)?.rects[0] ?? null;

// Geometry is measured with one contrasting foreground and equal raw shadow:
// TC4 suppresses the shadow, so natural swatch visibility and the +1 shadow
// cannot alter the glyph box. Raw samples and TC5 paint are tested separately.
export const isolateGlyphs = theme => {
  for (const wt of Object.values(theme.manifest.windowTypes)) {
    const fg = { rgb16: [65535, 0, 65535], displayRgb: [255, 0, 255] };
    wt.titleSamples = Object.fromEntries(Object.entries(wt.titleSamples ?? {}).map(([state, sample]) => [state, { ...sample, text: fg, shadow: fg }]));
  }
};
