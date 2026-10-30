// frameLayout: describe a window frame as explicit cell lists per edge, and get
// the template size, the content rect, a matching wnd# recipe, and named cell
// positions to paint by. Use it for frames that windowLayout() can't express
// (docs/authoring-exotic-frames.md §8):
//   - multi-pixel tiles (a merlon, a stud, a stone course) as code 8/11/12 cells (R2);
//   - code 12 + code 13 filler pairs, so an ornament is only ever drawn whole (R4, R8);
//   - code-6 end caps around the code-5 title plate (R10);
//   - a top band taller than the bar (towers above it, R13), with the title rect on the bar rows (R28);
//   - left/right recipes with fixed cells part-way down (R14, R20);
//   - its own bottom cell list (a wave, a plinth, R20);
//   - code-0 skips (R9) and droppable code-10 ornaments (R12): any code is
//     accepted, these two are just the ones windowLayout() can't write.
// Promoted from the Castle scheme (authoring/schemes/castle/), where it was
// first written; windowLayout() stays as the simple path.
//
// A cell is { code, w, name?, uniform? }. Mark a cell `uniform: true` when every
// column of it (every row, on the left and right edges) should look the same:
// a plain bar grower, a one-colour-per-row plate. `layout.lint(raster)` then
// fails if stray art reaches into it, which would be tiled across the window.
// Code-5 plates are always checked. A 1px cell is trivially uniform, so give
// 1px growers that should match each other the same group name instead,
// `uniform: 'bar'`: every cell of one edge in a group must then show the same
// column as the others (Bonn's blossom tree reached 1px into a bar grower,
// and the grower stopped matching its neighbours). lint also fails a wholly
// transparent last column or (non-collapsed) last row, which the web trims
// off the template (R18).
//
// The returned layout also reports `fixedTop`, the width of every top cell that
// doesn't grow. On a titled edge all of it comes out of the title's room:
// `layout.minWidthForTitle(px)` is the narrowest window (whole width) that
// still shows a title `px` wide; it matches the runtime's plate width exactly
// (TT1, TT3). Bonn's first 91px skyline cost a 260px window its title. Codes
// 15/16/17 don't count: the web always has every widget, so they are zero (F7).
//
// For left and right cells, x0/x1 are rows (y), not columns. Top and bottom cells run across the full width
// (their widths must add up to the same W). Left and right cells run down the
// body rows [A.top, A.bottom) only, because the top and bottom bands already
// cover the corners (R1); their heights must add up to the same body height.
// Painting by cell name (layout.named('plate').x0) is what keeps art and recipe
// in step.

import { Raster } from './raster.js';

const NOT_FOR_WIDGETS = new Set([0, 8, 11, 12, 13, 14, 15, 16, 17, 18]);
const PRIMARY = new Set([8, 11, 12, 18]);
const REMAINDER_RECIPIENTS = new Set([8, 11, 13, 14, 18]);

/**
 * @param {{
 *   top: Cell[], bottom?: Cell[], left?: Cell[], right?: Cell[],
 *   topH: number,                         // A.top: the whole top band, towers included
 *   sideL?: number, sideR?: number,       // A.left, W − A.right
 *   bottomH?: number,                     // H − A.bottom
 *   collapsed?: boolean,                  // title band only, one content row
 *   title?: { cell: string, top: number, bottom: number },   // T4 = that cell's columns × these rows
 *   widgets?: { close?: Box, zoom?: Box, collapse?: Box },
 * }} spec
 * @typedef {{ code: number, w: number, name?: string, uniform?: boolean | string }} Cell
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
export function frameLayout(spec) {
  const fail = (m) => { throw new Error(`frameLayout: ${m}`); };
  const sum = (cells) => cells.reduce((s, c) => s + c.w, 0);
  for (const [edge, cells] of Object.entries({ top: spec.top, bottom: spec.bottom ?? [], left: spec.left ?? [], right: spec.right ?? [] })) {
    for (const c of cells) if (!Number.isInteger(c.w) || c.w < 0 || !Number.isInteger(c.code)) fail(`${edge} cell ${JSON.stringify(c)} needs a whole-number code and w ≥ 0`);
  }
  const W = sum(spec.top);
  const T = spec.topH;
  const collapsed = !!spec.collapsed;
  const L = collapsed ? (spec.sideL ?? 1) : spec.sideL;
  const R = collapsed ? (spec.sideR ?? 1) : spec.sideR;
  let bodyH = 1, B = 0;
  if (!collapsed) {
    if (sum(spec.bottom) !== W) fail(`bottom cells add up to ${sum(spec.bottom)}px but the top is ${W}px`);
    bodyH = sum(spec.left);
    if (sum(spec.right) !== bodyH) fail(`left cells are ${bodyH}px tall but right cells are ${sum(spec.right)}px`);
    B = spec.bottomH;
  }
  const H = T + bodyH + B;
  const content = { top: T, left: L, bottom: T + bodyH, right: W - R };

  // Positions of every cell, by edge, with names for the painter.
  const place = (cells, start) => {
    let p = start;
    return cells.map((c) => { const cell = { ...c, x0: p, x1: p + c.w }; p += c.w; return cell; });
  };
  const cells = {
    top: place(spec.top, 0),
    bottom: collapsed ? [] : place(spec.bottom, 0),
    left: collapsed ? [] : place(spec.left, T),
    right: collapsed ? [] : place(spec.right, T),
  };
  const recipe = (placed, start) => (placed.length
    ? [{ part: 0, border: start }, ...placed.map((c) => ({ part: c.code, border: c.x1 }))]
    : []);
  const named = (name) => {
    for (const edge of Object.values(cells)) for (const c of edge) if (c.name === name) return c;
    fail(`no cell named ${name}`);
  };

  // Rect list: 0 content, 1 close, 2 zoom, 3 collapse, 4 title.
  const empty = { top: 0, left: 0, bottom: 0, right: 0 };
  const toRect = (b) => (b ? { top: b.y, left: b.x, bottom: b.y + b.h, right: b.x + b.w } : empty);
  const w = spec.widgets ?? {};
  let titleRect = empty;
  if (spec.title) {
    const plate = named(spec.title.cell);
    if (plate.code !== 5) fail(`title cell ${spec.title.cell} must be the code-5 plate`);
    if (spec.title.bottom > T || spec.title.top < 0) fail(`title rows ${spec.title.top}..${spec.title.bottom} must be inside the ${T}px top band`);
    titleRect = { top: spec.title.top, left: plate.x0, bottom: spec.title.bottom, right: plate.x1 };
  }
  const rectangles = [
    { part: 0, rect: content },
    { part: 1, rect: toRect(w.close) },
    { part: 2, rect: toRect(w.zoom) },
    { part: 3, rect: toRect(w.collapse) },
    { part: 4, rect: titleRect },
  ];

  validate({ spec, cells, T, W, fail });

  // Every top cell that doesn't grow takes room the title can't use.
  // (TT1 skips growers; 15/16/17 are zero whenever their widget is present, which on the web is always.)
  const NO_ROOM = new Set([0, 5, 8, 11, 12, 13, 14, 15, 16, 17, 18]);
  const fixedTop = cells.top.filter((c) => !NO_ROOM.has(c.code)).reduce((n, c) => n + c.w, 0);
  const minWidthForTitle = (titlePx) => fixedTop + titlePx;
  // Each edge's band: top/bottom cells are columns over the band's rows, left/right cells rows over its columns.
  const bands = { top: [0, T, 'column'], bottom: [T + bodyH, H, 'column'], left: [0, L, 'row'], right: [W - R, W, 'row'] };
  const lint = (raster) => {
    if (raster.width !== W || raster.height !== H) fail(`lint: the raster is ${raster.width}x${raster.height}, but the layout is ${W}x${H}`);
    for (const [edge, list] of Object.entries(cells)) {
      const [a0, a1, kind] = bands[edge];
      const line = (p) => Array.from({ length: a1 - a0 }, (_, i) => JSON.stringify(kind === 'column' ? raster.get(p, a0 + i) : raster.get(a0 + i, p))).join();
      const groups = new Map();
      for (const c of list) {
        if (!(c.uniform || (edge === 'top' && c.code === 5)) || c.w < 1) continue;
        const label = `${edge === 'top' ? '' : `${edge} `}cell ${c.name ?? c.code}`;
        const ref = line(c.x0);
        for (let p = c.x0 + 1; p < c.x1; p++) {
          if (line(p) !== ref) fail(`${label} ${kind} ${p} differs from its first ${kind}; stray art there is tiled across the window`);
        }
        if (typeof c.uniform !== 'string') continue;
        const first = groups.get(c.uniform);
        if (!first) groups.set(c.uniform, { ref, name: c.name ?? c.code });
        else if (first.ref !== ref) fail(`${label} doesn't match ${first.name} (both uniform '${c.uniform}'); stray art in one of them is tiled across the window`);
      }
    }
    // R18: the web sizes the window to the last opaque column/row of the template.
    const opaqueCol = (x) => Array.from({ length: H }, (_, y) => raster.get(x, y)).some(Boolean);
    const opaqueRow = (y) => Array.from({ length: W }, (_, x) => raster.get(x, y)).some(Boolean);
    if (!opaqueCol(W - 1)) fail(`the last column (x ${W - 1}) is wholly transparent; the web trims it and the right edge falls short (R18)`);
    if (!collapsed && !opaqueRow(H - 1)) fail(`the last row (y ${H - 1}) is wholly transparent; the web trims it and the bottom edge falls short (R18)`);
  };

  return {
    width: W, height: H, top: T, bottom: B, sideL: L, sideR: R, content, collapsed, titled: !!spec.title, cells, named,
    fixedTop, minWidthForTitle, lint,
    widgets: Object.fromEntries(Object.entries(w).filter(([, b]) => b)),
    wnd: {
      rectangles,
      topSide: recipe(cells.top, 0),
      bottomSide: recipe(cells.bottom, 0),
      leftSide: recipe(cells.left, T),
      rightSide: recipe(cells.right, T),
    },
  };
}

function validate({ spec, cells, T, W, fail }) {
  // Widgets ride fixed top cells, inside the top band.
  for (const [name, b] of Object.entries(spec.widgets ?? {})) {
    if (!b) continue;
    if (b.y < 0 || b.y + b.h > T) fail(`widget ${name} rows ${b.y}..${b.y + b.h} leave the ${T}px top band`);
    const bad = cells.top.filter((c) => c.x0 < b.x + b.w && c.x1 > b.x && NOT_FOR_WIDGETS.has(c.code));
    if (bad.length) fail(`widget ${name} x ${b.x}..${b.x + b.w} overlaps a code-${bad[0].code} cell (${bad[0].name ?? 'unnamed'})`);
  }
  // R4/R5: per allocation (top halves split at the plate; every other edge is one
  // allocation), every code-12 cell needs a remainder recipient and one tile width.
  const allocations = [];
  for (const [edge, list] of Object.entries(cells)) {
    const a = list.findIndex((c) => c.code === 5);
    if (edge === 'top' && a >= 0) allocations.push([`top-left`, list.slice(0, a)], [`top-right`, list.slice(a + 1)]);
    else allocations.push([edge, list]);
  }
  for (const [label, list] of allocations) {
    const twelves = list.filter((c) => c.code === 12);
    if (!twelves.length) continue;
    if (!list.some((c) => REMAINDER_RECIPIENTS.has(c.code))) fail(`${label}: a code-12 cell needs a code 8/11/13/14/18 cell in the same allocation for its leftover pixels (R4)`);
    if (new Set(twelves.map((c) => c.w)).size > 1) fail(`${label}: code-12 cells of different widths share one allocation; the wider one can get 0 tiles (R5)`);
  }
  for (const [label, list] of allocations) {
    if (list.length && !list.some((c) => PRIMARY.has(c.code)) && !label.startsWith('top-')) fail(`${label}: no growing cell (8/11/12/18)`);
  }
  if (spec.title && spec.title.bottom - spec.title.top < 17) fail(`title rows ${spec.title.top}..${spec.title.bottom} are under 17px; descenders clip (R28)`);
  if (cells.top.length && cells.top[cells.top.length - 1].x1 !== W) fail('top cells must end at the full width');
}

/**
 * The pressed-widget strip (cicn -14330, R24): close at x 0, zoom after the
 * close rect's width, collapse after close + zoom, one row, each piece the size
 * of its rect. Returns where each widget's piece goes.
 */
export function stripLayout(layout) {
  const order = ['close', 'zoom', 'collapse'];
  let x = 0, h = 0;
  const pieces = {};
  for (const role of order) {
    const b = layout.widgets[role];
    if (!b) continue;
    pieces[role] = { x, w: b.w, h: b.h, box: b };
    x += b.w; h = Math.max(h, b.h);
  }
  return { width: x, height: h, pieces };
}


/**
 * Build the pressed strip's pixels (cicn -14330) from a stripLayout. Each piece
 * starts as the widget's own frame pixels, copied from the active template so
 * its smooth edges match, and then `draw(role, raster, box)` paints the pressed
 * art on top. Everything outside the widget's silhouette stays transparent:
 * that mask is the click area. The silhouette is what `draw` paints on a
 * blank raster at the widget's frame position.
 * @param {{ strip: ReturnType<typeof stripLayout>, activeFrame: import('./raster.js').Raster,
 *   draw: (role: string, raster: import('./raster.js').Raster, box: {x:number,y:number,w:number,h:number}) => void,
 *   rows?: number }} opts  rows = 2 repeats the strip for collapsed windows
 */
export function pressedStripFrom({ strip, activeFrame, draw, rows = 1 }) {
  const r = new Raster(strip.width, strip.height * rows);
  for (let row = 0; row < rows; row++) {
    const oy = row * strip.height;
    for (const [role, piece] of Object.entries(strip.pieces)) {
      const ghost = new Raster(activeFrame.width, activeFrame.height);
      draw(role, ghost, piece.box);
      for (let y = 0; y < piece.h; y++) for (let x = 0; x < piece.w; x++) {
        const sx = piece.box.x + x, sy = piece.box.y + y;
        if (!ghost.get(sx, sy)) continue;
        const c = activeFrame.get(sx, sy);
        if (c) r.set(piece.x + x, oy + y, c);
      }
      draw(role, r, { x: piece.x, y: oy, w: piece.w, h: piece.h });
    }
  }
  return r;
}
