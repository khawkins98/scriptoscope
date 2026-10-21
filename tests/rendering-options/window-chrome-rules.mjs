// Source-addressed window-chrome acceptance rules (Kaleidoscope 2.3.1 kDEF 0).
// Pure ESM, no Node or DOM dependencies: the Node test and the source/built
// browser spec import this same module and inject the runtime under test.
//
// Every literal below is transcribed from a cited decode, not from runtime
// output. Rows marked `unknown`/`divergence` are deliberately NOT asserted as
// original behaviour; see tests/rendering-options/README.md "Window-chrome
// source rules".

const int16 = v => ((v & 0xffff) << 16) >> 16;

// docs/spec/kdef231-reference.md §3.4.1: `GetResource('wnd#', d3 & MASK)` at
// 0x3574, 0x358c, 0x35a4, 0x35bc, 0x35d4, 0x35ec, 0x3604, 0x361c, 0x3634,
// 0x364c, 0x3664, 0x367c; the first non-null handle wins (`bnes` skips the rest).
export const WND_LADDER = [0xffff, 0xfffe, 0xfffd, 0xfffc, 0xfffb, 0xfffa, 0xfff1, 0xfff0, 0xffef, 0xffee, 0xffeb, 0xffea];
// The canonical id grid of the same section's landing table.
export const CANONICAL_WND = {
  'document-window': -14336, 'collapsed-document-window': -14332, dialog: -14328, alert: -14326,
  'movable-modal': -14324, 'movable-alert': -14322, 'titled-utility-window': -14304,
  'collapsed-titled-utility-window': -14300, 'side-floating-utility-window': -14296,
  'collapsed-side-floating-utility-window': -14292, 'no-title-utility-window': -14288,
  'collapsed-no-title-utility-window': -14284, 'popup-window': -12320,
};
/** First wnd# id the 0x356c ladder would load from `present`, or null (0x36a0 → 0x373e). */
export function ladderSelection(id, present) {
  for (const mask of WND_LADDER) { const candidate = int16(id & mask); if (present.has(candidate)) return candidate; }
  return null;
}

// Width class of a recipe cell under the caller flag = 1 (title fits, or a
// side without a title anchor: `#1` at 0x4db4/0x4dd4/0x515e).
//   fixed     0x49d6 default → 0x4a5e `moveq #0`; 0x531e..0x532a dst = src
//   zero      0x49d6 code 0 → 0x4a12 `moveq #1`; 0x5306 leaves width 0
//   primary   0x529e..0x52d6 (8/11/18) share + remainder
//   tile      0x5266..0x5292 (12) whole source widths
//   remainder 0x52da..0x52f8 (13/14) remainder only
//   unknown   not asserted: 5 (title plate DEST span from StringWidth,
//             0x5034), 10 (flag-gated 0x4a0c; ledger divergence),
//             2/3/4/15/16/17 (undecoded cinf widget flags, reference §7.6)
export function cellClass(code, leading) {
  // 0x4a64's segment loop starts at index 1: [0, border[0]) is the 1:1 corner.
  if (leading) return 'fixed';
  if (code === 0) return 'zero';
  if (code === 8 || code === 11 || code === 18) return 'primary';
  if (code === 12) return 'tile';
  if (code === 13 || code === 14) return 'remainder';
  if (code === 5 || code === 10 || [2, 3, 4, 15, 16, 17].includes(code)) return 'unknown';
  return 'fixed'; // 1, 6 (bezel, fixed while the title fits), 7, 9 and other defaults
}

const code = slug => Number(/^part-(-?\d+)$/.exec(slug)?.[1] ?? NaN);
/** END-based cells (0x5356): segment i = [border[i-1], border[i]) tagged part[i]. */
export function decodeCells(recipe) {
  const cells = []; let prev = 0;
  for (const [i, step] of recipe.entries()) {
    if (step.at > prev) cells.push({ x0: prev, x1: step.at, code: code(step.part), cls: cellClass(code(step.part), i === 0) });
    prev = Math.max(prev, step.at);
  }
  return cells;
}

/**
 * Two-pass 0x5178 allocation for one half of extent `extent`, transcribed from
 * kdef231-reference.md §4.2 / compositor-spec.md "Distribution": primary
 * divisor counts 8/11/12/18 (caller 0x4b3e); 0x51b4..0x523e collects the
 * division remainder plus every tile's unused fraction; 0x5260..0x532e hands
 * trunc(remaining / recipientsLeft) to 8/11/13/14/18 in walk order.
 * Returns null when a width is not source-determined or the budget is negative.
 */
export function allocateHalf(cells, extent) {
  if (cells.some(c => c.cls === 'unknown')) return null;
  const w = c => c.x1 - c.x0;
  const fixed = cells.filter(c => c.cls === 'fixed').reduce((s, c) => s + w(c), 0);
  const budget = extent - fixed;
  if (budget < 0) return null; // below-minimum negotiation is not decoded
  const primary = cells.filter(c => ['primary', 'tile'].includes(c.cls)).length;
  const share = primary ? Math.trunc(budget / primary) : 0;
  let pool = primary ? budget - share * primary : 0;
  for (const c of cells) if (c.cls === 'tile') pool += share % w(c);
  let left = cells.filter(c => c.cls === 'primary' || c.cls === 'remainder').length;
  return cells.map(c => {
    if (c.cls === 'fixed') return w(c);
    if (c.cls === 'zero') return 0;
    if (c.cls === 'tile') return share - share % w(c);
    const extra = Math.trunc(pool / left); pool -= extra; left--;
    return (c.cls === 'primary' ? share : 0) + extra;
  });
}

/**
 * Check one composed window against the decoded rules. Returns
 * `{ failures, checked }`; `checked` counts asserted cells/pixels so a vacuous
 * pass is visible. Only the top and bottom bars are pixel-checked across their
 * full length (they are composed last); side bars only between them.
 */
export function checkComposition({ cicn, windowType, composed }) {
  const failures = [], checked = { cells: 0, halves: 0, sides: 0, pixels: 0, unknownCells: 0 };
  const fail = (message) => { if (failures.length < 20) failures.push(message); };
  const { frame, fullWidth: W, fullHeight: H, buffer } = composed;
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    const recipe = windowType.edges?.[edge] ?? [];
    const placed = composed.placement.filter(p => p.edge === edge);
    const thickness = frame[edge];
    if (!recipe.length || thickness <= 0) {
      // A side without a side-list (or with zero inset) draws no segments.
      if (placed.length) fail(`${edge}: drew ${placed.length} cells without a side-list`);
      continue;
    }
    const horizontal = edge === 'top' || edge === 'bottom';
    const cells = decodeCells(recipe);
    // The recipe's segments come first, in walk order; a far-edge cap is runtime-only.
    const segs = placed.slice(0, cells.length);
    const span = p => horizontal ? [p.src.x, p.src.x + p.src.w, p.rects[0].x, p.rects[0].w] : [p.src.y, p.src.y + p.src.h, p.rects[0].y, p.rects[0].h];
    let cursor = 0;
    cells.forEach((c, i) => {
      const p = segs[i];
      if (!p) return fail(`${edge}[${i}]: missing placed cell`);
      const [s0, s1, d0] = span(p);
      if (s0 !== c.x0 || s1 !== c.x1 || p.code !== c.code) fail(`${edge}[${i}]: END-based cell [${c.x0},${c.x1}) p${c.code} placed as [${s0},${s1}) p${p.code}`);
      if (d0 !== cursor) fail(`${edge}[${i}]: dst starts ${d0}, expected contiguous ${cursor}`);
      cursor += span(p)[3];
    });
    // Halves: split at the title anchor run (codes 5/6) as 0x4a64 does; a
    // side without one is a single half of the full output extent.
    const titled = cells.map((c, i) => [5, 6].includes(c.code) && i > 0 ? i : -1).filter(i => i >= 0);
    const halves = titled.length ? [[0, titled[0]], [titled.at(-1) + 1, cells.length]] : [[0, cells.length]];
    for (const [lo, hi] of halves) {
      const half = cells.slice(lo, hi), widths = segs.slice(lo, hi).map(p => span(p)[3]);
      checked.unknownCells += half.filter(c => c.cls === 'unknown').length;
      const observed = widths.reduce((s, v) => s + v, 0);
      // Extent: the whole side when untitled (structure extent; srcStart is 0).
      // A titled half's extent is placed by the title anchor (0x4fa8..0x50fa),
      // whose split policy is not source-asserted here; take the observed sum,
      // which is exact only when the half has a non-tile remainder recipient.
      const recipient = half.some(c => c.cls === 'primary' || c.cls === 'remainder');
      const extent = !titled.length ? (horizontal ? W : H) : recipient ? observed : null;
      for (const [j, c] of half.entries()) {
        // Per-class invariants hold regardless of the half's extent.
        if (c.cls === 'fixed' && widths[j] !== c.x1 - c.x0) fail(`${edge}[${lo + j}] p${c.code}: fixed ${c.x1 - c.x0}px drawn ${widths[j]}px`);
        if (c.cls === 'zero' && widths[j] !== 0) fail(`${edge}[${lo + j}] p0: expected collapse, drawn ${widths[j]}px`);
        if (c.cls === 'tile' && widths[j] % (c.x1 - c.x0)) fail(`${edge}[${lo + j}] p12: ${widths[j]}px is not whole ${c.x1 - c.x0}px tiles`);
        if (c.cls !== 'unknown') checked.cells++;
      }
      if (extent == null) continue;
      const expected = allocateHalf(half, extent);
      if (!expected) continue;
      checked.halves++;
      if (JSON.stringify(expected) !== JSON.stringify(widths)) fail(`${edge} half [${lo},${hi}) extent ${extent}: 0x5178 expects ${expected}, drawn ${widths}`);
    }
    checked.sides++;
    // 0xfeae tiles every non-18 cell from its own source origin, clipping the
    // last tile. Only opaque source pixels are asserted: the masked CopyMask
    // vs replace interaction with previously drawn sides is not decoded.
    const [lo, hi] = horizontal ? [0, W] : [frame.top, H - frame.bottom];
    for (const p of segs) {
      if (p.code === 18) continue;
      const [s0, s1, d0, dw] = span(p), sw = s1 - s0;
      if (dw <= 0 || sw <= 0) continue;
      for (let k = 0; k < dw; k++) {
        const along = d0 + k;
        if (along < lo || along >= hi) continue;
        for (let t = 0; t < thickness; t++) {
          const srcX = horizontal ? s0 + k % sw : p.src.x + t, srcY = horizontal ? p.src.y + t : s0 + k % sw;
          const dstX = horizontal ? along : p.rects[0].x + t, dstY = horizontal ? p.rects[0].y + t : along;
          const src = cicn.getPixel(srcX, srcY);
          if (src[3] !== 255) continue;
          const out = buffer.getPixel(dstX, dstY);
          checked.pixels++;
          if (out[0] !== src[0] || out[1] !== src[1] || out[2] !== src[2] || out[3] !== 255) {
            fail(`${edge} p${p.code} dst(${dstX},${dstY}) = ${out} but 0xfeae tile src(${srcX},${srcY}) = ${src}`);
            break;
          }
        }
      }
    }
  }
  return { failures, checked };
}

/** Sampled content sizes: the template minimum plus odd/even and tile-remainder offsets. */
export const SIZE_OFFSETS = { width: [0, 1, 2, 7, 97], height: [0, 1, 33] };

// Archives that ship wnd# recipes vs none. The five without wnd# use the
// runtime's synthesized corner-sprite table; no kDEF path for drawing them is
// decoded, so every recipe rule above is NOT APPLICABLE and stays unknown.
export const SLICED = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'windows-31', 'windows-95'];
export const CORNER_SPRITE = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];

/**
 * Run the recipe rules over one decoded (encodeAssets:false) theme. The caller
 * injects the runtime under test so source and built bundles share this table.
 */
export function checkTheme(decoded, { PixelBuffer, composeWindowChrome }) {
  const totals = { compositions: 0, cells: 0, halves: 0, sides: 0, pixels: 0, unknownCells: 0 }, failures = [];
  for (const [key, windowType] of Object.entries(decoded.manifest.windowTypes)) {
    if (windowType.model) continue;
    const [l, t, r, b] = windowType.parts['part-0'].rect;
    for (const state of ['active', 'inactive']) {
      const asset = decoded.assets.find(a => a.path === windowType.chrome[state]);
      const cicn = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
      for (const dw of SIZE_OFFSETS.width) for (const dh of SIZE_OFFSETS.height) {
        const composed = composeWindowChrome(cicn, windowType, Math.max(0, r - l) + dw, Math.max(0, b - t) + dh);
        const result = checkComposition({ cicn, windowType, composed });
        totals.compositions++;
        for (const [k, v] of Object.entries(result.checked)) totals[k] += v;
        for (const f of result.failures) failures.push(`${key}/${state} +${dw}x+${dh}: ${f}`);
      }
    }
  }
  return { totals, failures };
}

/**
 * Author-supplied NAMED cicn labels (docs/spec/corpus-corroborated-ids.md) are
 * source art for the state role. A selected state's frame label must not name
 * the opposite state; unlabelled and state-neutral labels are not evidence.
 */
export function stateLabelContradiction(state, label) {
  if (!label) return null;
  const inactive = /\b(inactive|disabled)\b/i.test(label), active = /\bactive\b/i.test(label.replace(/\binactive\b/ig, ''));
  if (state === 'active' && inactive) return `active frame labelled "${label}"`;
  if (state === 'inactive' && active && !inactive) return `inactive frame labelled "${label}"`;
  return null;
}
