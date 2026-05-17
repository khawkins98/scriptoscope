// Aaron UI library entry point.
//
// Exports the public API surface downstream consumers import from. As
// Phase 1 fills in (drag, resize, z-order, declarative scanner), additional
// classes appear here. See GitHub Phase 1 milestone for the breakdown.

export const VERSION = '0.0.0';

export { AaronWindow } from './window-manager/AaronWindow.js';
export type { AaronWindowOptions } from './window-manager/AaronWindow.js';
