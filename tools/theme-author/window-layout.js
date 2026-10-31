// Window layout helper: describe a frame once, get matching geometry for the
// art AND the wnd# recipe.
//
// The most common authoring bug is art and recipe disagreeing (a border that
// points at the wrong column, a close box that lands in a stretching cell).
// This helper derives both from the same numbers, using the simplest recipe
// that follows docs/spec/compositor-spec.md:
//
//   Top edge, titled window              Top edge, untitled window
//   0                              W     0                      W
//   ┌──────┬─┬─┬─┬───────┐               ┌──────┬─┬───────┐
//   │ left │g│P│g│ right │               │ left │g│ right │
//   └──────┴─┴─┴─┴───────┘               └──────┴─┴───────┘
//    code 1 11 5 8 code 1                 code 1 8 code 1
//
//   left / right   fixed cells (code 1): corners and widgets, drawn 1:1
//   g              1px growing cells (codes 11 and 8) — they take extra width
//   P              1px title plate (code 5) — the engine widens it to the
//                  title's width and keeps it centred between the two g cells
//
// IMPORTANT: a recipe only paints [first border, last border). Pixels before
// the first border or after the last are never drawn (compositor LS9), so
// every list here starts at 0 and ends at the full image size, with the
// corners as explicit code-1 cells.
//
// The left and right sides are: fixed top (title bar), one growing row (code 8)
// just inside the content area, then a fixed bottom corner. The bottom side is:
// fixed left corner, one growing column, fixed right corner.
//
// Every growing cell is 1px, so its source column/row is TILED along the
// edge. Draw those columns/rows so that repeating them looks right (a uniform
// gradient column, a straight border).

/**
 * @param {{
 *   titleBar: number,        // title bar height in px (0 = no title bar)
 *   leftFixed: number,       // width of the fixed left region of the top edge
 *   rightFixed: number,      // width of the fixed right region of the top edge
 *   side?: number,           // left/right frame thickness (default 1)
 *   top?: number,            // frame thickness above the content when there is no title bar
 *   bottom: number,          // frame thickness below the content
 *   collapsed?: boolean,     // title bar only (no body, no side/bottom recipes)
 *   widgets?: { close?: Box, zoom?: Box, collapse?: Box },  // boxes in template coordinates
 * }} spec
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
export function windowLayout(spec) {
  const side = spec.side ?? 1;
  const titled = spec.titleBar > 0;
  const middle = titled ? 3 : 1;
  const width = spec.leftFixed + middle + spec.rightFixed;
  const top = titled ? spec.titleBar : (spec.top ?? spec.bottom);
  validate(spec, { side, top, titled, width });
  // One template row of content between the top region and the bottom corner.
  // A collapsed window keeps that row too: the content rectangle must exist
  // (the runtime needs it) and its first pixel stores the title colour.
  const height = spec.collapsed ? top + 1 : top + 1 + spec.bottom;

  const L = spec.leftFixed;
  // part[0] is ignored by the engine (cell i is tagged by part[i]); authors write 0.
  const topSide = titled
    ? [{ part: 0, border: 0 }, { part: 1, border: L }, { part: 11, border: L + 1 }, { part: 5, border: L + 2 }, { part: 8, border: L + 3 }, { part: 1, border: width }]
    : [{ part: 0, border: 0 }, { part: 1, border: L }, { part: 8, border: L + 1 }, { part: 1, border: width }];
  const bottomSide = [{ part: 0, border: 0 }, { part: 1, border: L }, { part: 8, border: L + 1 }, { part: 1, border: width }];
  const vertical = [{ part: 0, border: 0 }, { part: 1, border: top }, { part: 8, border: top + 1 }, { part: 1, border: height }];

  const content = { top, left: side, bottom: top + 1, right: width - side };
  const plateX = L + 1;
  const toRect = (b) => (b ? { top: b.y, left: b.x, bottom: b.y + b.h, right: b.x + b.w } : { top: 0, left: 0, bottom: 0, right: 0 });
  const w = spec.widgets ?? {};
  const rectangles = [
    { part: 0, rect: content },
    { part: 1, rect: toRect(w.close) },
    { part: 2, rect: toRect(w.zoom) },
    { part: 3, rect: toRect(w.collapse) },
    // Part 4 is the title rectangle. The engine samples the bar colour at
    // (left, bottom − 4), so keep it inside the bar's gradient.
    { part: 4, rect: titled ? { top: 2, left: plateX, bottom: top - 2, right: plateX + 1 } : { top: 0, left: 0, bottom: 0, right: 0 } },
  ];

  return {
    width, height, titled, side, top, bottom: spec.collapsed ? 0 : spec.bottom, plateX, content,
    wnd: {
      rectangles,
      topSide,
      bottomSide: spec.collapsed ? [] : bottomSide,
      leftSide: spec.collapsed ? [] : vertical,
      rightSide: spec.collapsed ? [] : vertical,
    },
  };
}

// Reject specs that would encode but draw wrong. Each message says what to change.
function validate(spec, { side, top, titled, width }) {
  const fail = (msg) => { throw new Error(`windowLayout: ${msg}`); };
  const sizes = { titleBar: spec.titleBar, leftFixed: spec.leftFixed, rightFixed: spec.rightFixed, side, top, bottom: spec.bottom };
  for (const [name, v] of Object.entries(sizes)) {
    if (!Number.isInteger(v) || v < 0) fail(`${name} must be a whole number of pixels ≥ 0 (got ${v})`);
  }
  // The title rectangle is rows 2..titleBar−2 and the engine samples its colour
  // 4px above that rectangle's bottom; the title size is clamp(titleBar − 6, 8, 13).
  if (titled && spec.titleBar < 7) fail(`titleBar ${spec.titleBar} is too short for a title; use 0 (no title bar) or at least 7`);
  // The bottom edge's growing column is column leftFixed (and the same cell on
  // the right). If the side border were thicker than the fixed corner, that
  // column would be part of the side border and the corner art would smear.
  if (side < 1 || side > spec.leftFixed || side > spec.rightFixed) {
    fail(`side (${side}) must be at least 1 and no wider than leftFixed (${spec.leftFixed}) and rightFixed (${spec.rightFixed})`);
  }
  for (const [name, b] of Object.entries(spec.widgets ?? {})) {
    if (!b) continue;
    if (![b.x, b.y, b.w, b.h].every(Number.isInteger) || b.w <= 0 || b.h <= 0) fail(`widget ${name} needs whole-number x, y, w, h with w, h > 0`);
    if (b.y < 0 || b.y + b.h > top) fail(`widget ${name} (y ${b.y}..${b.y + b.h}) must sit inside the ${top}px top frame (rows 0..${top})`);
    const inLeft = b.x >= 0 && b.x + b.w <= spec.leftFixed;
    const inRight = b.x >= width - spec.rightFixed && b.x + b.w <= width;
    if (!inLeft && !inRight) {
      fail(`widget ${name} (x ${b.x}..${b.x + b.w}) must sit wholly inside the fixed left region [0, ${spec.leftFixed}) or the fixed right region [${width - spec.rightFixed}, ${width}); otherwise it lands in a stretching cell`);
    }
  }
}
