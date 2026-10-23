// src/engine/tables/ — the only place engine resource ids, part codes and
// other decision literals live (v2 PLAN §1 engine invariants; DECISIONS #2).
//
// One exported row per spec decision-table row, carrying the spec row id
// (`id`) and the same `source` citation string the spec gives. Engine code
// outside this directory selects rows by data; it holds no resource-id
// literals, no per-theme branches and no fallback ladders of its own. Binary
// addresses appear only in `source` strings.
//
// Files:
//   windowBlit.ts    qd-primitives "Window caller: which blit" (W1–W3)
//   cinfFrame.ts     qd-primitives cinf body + border (requests, B0–B6, P1–P5, E1–E4)
//   controlState.ts  DECISIONS #4 / scrollbar §2 public state → native hilite
//   scrollbar.ts     scrollbar.md §2–§5 (state, track/pattern ladders, arrows, thumb, fill, hit test)
//   proceduralFrame.ts procedural-frame.md §2–§9 (built-in window frame, no wnd#)
//   slider.ts        slider.md §2–§5 (gate, record, track ladder, slicing, thumb, ticks, hit test, tracking)
//   progress.ts      progress.md §1–§5 (CDEF 5: gate, frame, inset, split, slicing, indeterminate, procedural bar, idle, data)
//   window.ts        window-widgets.md §4 (wnd# layout, too-short step, titled side, cell rects, widget remap/draw/hit)
//   loaderNeeds.ts   per-family loader inputs (icon-blit cicns), read by src/loadTheme.ts
export * from './windowBlit.js';
export * from './cinfFrame.js';
export * from './controlState.js';
export * from './scrollbar.js';
export * from './proceduralFrame.js';
export * from './slider.js';
export * from './progress.js';
export * from './window.js';
export * from './loaderNeeds.js';
