// v2 engine core (v2 PLAN §3 "minimum engine core"). Internal: not re-exported
// from the public package entry. Family drivers build on these layers:
//   qd/         QuickDraw-level primitives (qd-primitives.md)
//   resources/  ResourceChain: archive → base chain → procedural, data-driven
//   state/      public control/window state → native inputs
//   tables/     every decision literal, one row per spec row
//   trace.ts    the per-call trace the diff gate compares
//   families/   per message × family drivers (scrollbar.ts: messages 0 and 1;
//               proceduralFrame.ts: the built-in window frame, messages 0, 1, 6, 7, 8;
//               slider.ts: CDEF 3; progress.ts: CDEF 5)
export * from './qd/index.js';
export * from './resources/chain.js';
export * from './resources/ids.js';
export * from './state/control.js';
export * from './state/window.js';
export * from './tables/index.js';
export * from './trace.js';
export * from './families/scrollbar.js';
export * from './families/proceduralFrame.js';
export * from './families/slider.js';
export * from './families/progress.js';
