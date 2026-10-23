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
