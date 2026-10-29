export { PF_ART, PF_UTILITY_ART, PF_UTILITY_GROW, PF_UTILITY_STRIPES } from './proceduralFrameArt.js';
// docs/spec/engine/procedural-frame.md — Kaleidoscope's built-in window frame
// for schemes that ship neither a `wnd#` recipe nor a replacement `WDEF`
// (document family §2–§6, utility family §9). Data
// only: one exported row (or row group) per spec row, carrying the spec section
// it mirrors (`id`) and the spec's `source` citation. The driver
// (src/engine/families/proceduralFrame.ts) selects rows by data and holds no
// literals of its own.
//
// Row ids are the spec's lettered rule ids where it has them (TG1, WP1, UFH7, …)
// and section references (`§4.3` = §4 table, order 3) where its tables are
// numbered by draw order.
import { SCROLLBAR_ICS_PLANES } from './scrollbar.js';

// ── §2 Messages ──────────────────────────────────────────────────────────────

/** §2 WDEF messages this unit answers. */
export const PF_MESSAGES = {
  draw: 0, hit: 1, calcRegions: 2, new: 3, dispose: 4, growOutline: 5, drawGrowIcon: 6, getFeatures: 7, getRegion: 8,
  source: '0x12b88, 0x1295e, 0x12486, 0x122c6, 0x123f0, 0x1280a, 0x14286, 0x11cfa, 0x11d7e',
} as const;

export type PfDrawAction = 'frame' | 'close' | 'zoom' | 'collapse' | 'none';
export interface PfDrawPartRow {
  readonly id: string;
  readonly parts: readonly number[];
  readonly action: PfDrawAction;
  /** The per-window toggle bit flips after this part (§2). */
  readonly toggles: boolean;
  readonly source: string;
}
/** §2 message 0 draw part (low word of the parameter); any other part draws nothing. */
export const PF_DRAW_PARTS: readonly PfDrawPartRow[] = [
  { id: '§2.part0', parts: [0], action: 'frame', toggles: false, source: '0x12c3c..0x12d08' },
  { id: '§2.part4', parts: [4], action: 'close', toggles: true, source: '0x12d0a, 0x12d36..0x12d4e' },
  { id: '§2.part5-6', parts: [5, 6], action: 'zoom', toggles: true, source: '0x12d18, 0x12d36..0x12d4e' },
  { id: '§2.part9', parts: [9], action: 'collapse', toggles: true, source: '0x12d28, 0x12d36..0x12d4e' },
  /** TG3: part 258 draws nothing in the document family but flips the toggle. */
  { id: 'TG3', parts: [258], action: 'none', toggles: true, source: '0x12d36..0x12d4e, 0x12d5e' },
];
export const PF_DRAW_PART_NONE = { id: '§2.part-other', source: '0x12c28' } as const;

/**
 * §2 TG1–TG4, the toggle bit shared by both families (§9.8): a draw with a part
 * below `clearBelow` (signed) clears it first; TG2 widget parts draw pressed when
 * clear; TG3 listed parts flip it afterwards; TG4 its power-on value is not decoded.
 */
export const PF_TOGGLE = {
  clear: { id: 'TG1', clearBelow: 4, source: '0x12bea..0x12c02' },
  pressed: { id: 'TG2', source: '0x12c04..0x12c12, 0x12d0a..0x12d34' },
  flip: { id: 'TG3', source: '0x12d36..0x12d4e, 0x12d5e' },
  powerOn: { id: 'TG4', source: 'TG1..TG3' },
} as const;

// ── §3.1 Window kind and flags ───────────────────────────────────────────────

/** §3.1 variation-code fields. */
export const PF_VARIATION = {
  kindMask: 7,
  zoomBit: 3,
  thinBit: 4,
  alertBit: 5,
  growBit: 6,
  source: '0x11ee2..0x11fa4 (kind 0x11f2c, zoom 0x11f38, thin 0x11f02, alertBit 0x11ef2, grow 0x11f12, 0x11f48)',
} as const;

export interface PfKindRow {
  readonly id: string;
  readonly kind: number;
  readonly name: string;
  readonly titled: boolean;
  readonly movable: boolean;
  readonly modal: boolean;
  /** "grow: variation bit 6, or kind 0". */
  readonly impliesGrow: boolean;
  readonly source: string;
}
/** §3.1 kind rows (titled `0x11f62..0x11f78`, movable `0x11f54`, modal `0x11f90..0x11fa4`). */
export const PF_KINDS: readonly PfKindRow[] = [
  { id: '§3.1.kind0', kind: 0, name: 'documentProc', titled: true, movable: false, modal: false, impliesGrow: true, source: '0x11f2c, 0x11f48, 0x11f62..0x11f78' },
  { id: '§3.1.kind1', kind: 1, name: 'dBoxProc', titled: false, movable: false, modal: true, impliesGrow: false, source: '0x11f2c, 0x11f90..0x11fa4' },
  { id: '§3.1.kind2', kind: 2, name: 'plainDBox', titled: false, movable: false, modal: false, impliesGrow: false, source: '0x11f2c' },
  { id: '§3.1.kind3', kind: 3, name: 'altDBoxProc', titled: false, movable: false, modal: false, impliesGrow: false, source: '0x11f2c' },
  { id: '§3.1.kind4', kind: 4, name: 'noGrowDocProc', titled: true, movable: false, modal: false, impliesGrow: false, source: '0x11f2c, 0x11f62..0x11f78' },
  { id: '§3.1.kind5', kind: 5, name: 'movableDBoxProc', titled: true, movable: true, modal: true, impliesGrow: false, source: '0x11f2c, 0x11f54, 0x11f62..0x11f78, 0x11f90..0x11fa4' },
];

/** §3.1 kind numbers the driver branches on (document frame kinds 0/4, dBoxProc 1, movableDBoxProc 5). */
export const PF_KIND = { document: 0, dBox: 1, noGrowDocument: 4, movable: 5, source: '0x11f2c' } as const;

/** §3.1 message 7 (get features): bit per flag; `always` bits are set unconditionally. */
export const PF_FEATURES = {
  grow: 1, zoom: 2, canCollapse: 4, modal: 8, titled: 64, always: [16, 0x0f80],
  source: '0x11cfa..0x11d60',
} as const;

// ── §3.2 Title-bar height ────────────────────────────────────────────────────

/** §3.2: H = ascent + descent + 6; even → H − 1; below 22 → ascent += trunc((22 − H)/2), H = 22. */
export const PF_TITLE_HEIGHT = {
  extra: 6,
  floor: 22,
  source: 'font 0x120c8..0x120d2, base 0x120da..0x120e4, parity 0x120e8..0x120f6, floor 0x120fa..0x12116',
} as const;

// ── §3.3 Geometry ────────────────────────────────────────────────────────────

/** §3.3 structure region: shadow = bounding box shifted (+2, +2), shortened by 1 right and bottom. */
export const PF_SHADOW = { shift: 2, shorten: 1, source: '0x127b6' } as const;

export type PfShadowKind = 'line' | 'none' | 'shifted';
export interface PfStructureRow {
  readonly id: string;
  readonly kinds: readonly number[];
  /** Sides and bottom outset from C (the top too unless `top` says otherwise). */
  readonly outset: number;
  /** Outset when `thin` (absent = same as `outset`). */
  readonly thinOutset?: number;
  /** Top edge: `title` = C.t − H; `raise` = outset top raised by H − `raiseLess`. */
  readonly top?: 'title' | 'raise';
  readonly raiseLess?: number;
  readonly shadow: PfShadowKind;
  readonly source: string;
}
/** §3.3 structure (before the shadow), by kind. */
export const PF_STRUCTURE: readonly PfStructureRow[] = [
  { id: '§3.3.S04', kinds: [0, 4], outset: 6, top: 'title', shadow: 'line', source: '0x12624' },
  { id: '§3.3.S1', kinds: [1], outset: 6, thinOutset: 3, shadow: 'line', source: '0x126c0' },
  { id: '§3.3.S2', kinds: [2], outset: 1, shadow: 'none', source: '0x1268c' },
  { id: '§3.3.S3', kinds: [3], outset: 1, shadow: 'shifted', source: '0x12696' },
  { id: '§3.3.S5', kinds: [5], outset: 6, thinOutset: 3, top: 'raise', raiseLess: 1, shadow: 'line', source: '0x12650' },
];
/** §3.3 collapsed (any titled kind): the title bar, content empty, 1-px shadow. `WdrB` adds 5 rows (declared absent, §10.2). */
export const PF_STRUCTURE_COLLAPSED = { id: '§3.3.collapsed', side: 6, wdrbExtra: 5, shadow: 'line' as PfShadowKind, source: '0x126fc' } as const;

export interface PfTitleBarRow {
  readonly id: string;
  readonly kinds: readonly number[];
  /** T = (C.l − side, C.t − above − H, C.r + side, C.t − above). */
  readonly side: number;
  readonly above: number;
  readonly thin?: { readonly side: number; readonly above: number };
  readonly source: string;
}
/** §3.3 title bar T. */
export const PF_TITLE_BAR: readonly PfTitleBarRow[] = [
  { id: '§3.3.T04', kinds: [0, 4], side: 6, above: 0, source: '0x146f8..0x1470e' },
  { id: '§3.3.T5', kinds: [5], side: 6, above: 5, thin: { side: 3, above: 2 }, source: '0x146d4..0x146f6' },
];

/** §3.3 widget rects: 16 × 16; wy = T.t + trunc((H + 1 − 13) / 2) − 1. */
export const PF_WIDGET_RECTS = {
  size: 16,
  topIcon: 13,
  topLess: 1,
  closeFromLeft: 4,
  collapseFromRight: 17,
  zoomFromRight: 17,
  zoomFromRightWithCollapse: 33,
  source: 'wy 0x148a2..0x148ce, close 0x148a2, collapse 0x14904, zoom 0x1496c',
} as const;

/** §3.3 grow rect (C.r − 15, C.b − 15, C.r + 2, C.b + 2); kind 5 without thin offset (+3, +3). */
export const PF_GROW_RECT = { inside: 15, outside: 2, kind5Offset: 3, source: '0x1499a' } as const;

/** §3.3 title limits and title-text rect. */
export const PF_TITLE_LIMITS = {
  closeAdvance: 17,
  leftInset: 5,
  widgetGap: 4,
  rightInset: 5,
  proxyWidth: 20,
  textInsetV: 3,
  source: 'L 0x1480c, R 0x14848, title text 0x14784, proxy 0x1473a',
} as const;

export interface PfWidgetPresenceRow {
  readonly id: string;
  readonly widget: 'close' | 'zoom' | 'collapse';
  readonly source: string;
}
/** §3.3 widget presence: shown-when rows (the drops are PF_WIDGET_DROPS). */
export const PF_WIDGET_PRESENCE: readonly PfWidgetPresenceRow[] = [
  { id: '§3.3.W-close', widget: 'close', source: '0x13cb6' },
  { id: '§3.3.W-zoom', widget: 'zoom', source: '0x121dc' },
  { id: '§3.3.W-collapse', widget: 'collapse', source: '0x14b40' },
];
/** §3.3 WP1–WP4 narrow-window drops (plain 16 × 16 rects, tested against the computed close rect). */
export const PF_WIDGET_DROPS = {
  goAwayZoom: { id: 'WP1', source: '0x121dc..0x12222' },
  goAwayOnly: { id: 'WP2', source: '0x12224..0x12242' },
  zoomShade: { id: 'WP3', source: '0x12244..0x12264' },
  none: { id: 'WP4', source: '0x12244..0x12248' },
} as const;

// ── §3.4 Message-8 regions ───────────────────────────────────────────────────

export type PfRegionName = 'titleBar' | 'titleText' | 'close' | 'zoom' | 'grow' | 'collapse' | 'structure' | 'content';
export interface PfRegionRow { readonly id: string; readonly code: number; readonly region: PfRegionName; readonly source: string }
/** §3.4 region per code; any other code has no region. */
export const PF_REGIONS: readonly PfRegionRow[] = [
  { id: '§3.4.0', code: 0, region: 'titleBar', source: '0x11db4' },
  { id: '§3.4.1', code: 1, region: 'titleText', source: '0x11dcc' },
  { id: '§3.4.2', code: 2, region: 'close', source: '0x11df0' },
  { id: '§3.4.3', code: 3, region: 'zoom', source: '0x11e08' },
  { id: '§3.4.6', code: 6, region: 'grow', source: '0x11eae' },
  { id: '§3.4.7', code: 7, region: 'collapse', source: '0x11e20' },
  { id: '§3.4.32', code: 32, region: 'structure', source: '0x11e38' },
  { id: '§3.4.33', code: 33, region: 'content', source: '0x11e8e' },
];

// ── §3.5 Art selection ───────────────────────────────────────────────────────

export type PfAlertCondition = 'thin' | 'auxFlag' | 'kindGate' | 'actbAbsent' | 'colorTable';
export interface PfAlertRow { readonly id: string; readonly when: PfAlertCondition; readonly source: string }
/** §3.5 alert colouring, first matching row. */
export const PF_ALERT: readonly PfAlertRow[] = [
  { id: '§3.5.AL1', when: 'thin', source: '0x14c6c' },
  { id: '§3.5.AL2', when: 'auxFlag', source: '0x14c7a, 0xf048' },
  { id: '§3.5.AL3', when: 'kindGate', source: '0x14c90..0x14ca2' },
  { id: '§3.5.AL4', when: 'actbAbsent', source: '0x14cc0..0x14cd4' },
  { id: '§3.5.AL5', when: 'colorTable', source: '0x14cd6..0x14d18' },
];
/** §3.5 the alert colour table and the aux-window flag bit. */
export const PF_ALERT_TABLE = { type: 'actb', id: -14336, entry: 0, auxFlagBit: 4, source: '0x14cc0..0x14d18, 0x14c7a' } as const;

/** One colour-table entry as the adapter supplies it: its value field, stored 16-bit channels and baked 8-bit colour. */
export interface PfColorTableEntry { readonly value: number; readonly rgb16: readonly [number, number, number]; readonly rgb: readonly [number, number, number] }

/** §3.5 CT1–CT4: "entry n" of a colour table is found by value (`0x10702`). */
export const PF_COLOR_LOOKUP = {
  byPosition: { id: 'CT1', source: '0x1070e..0x1071c' },
  lastZero: { id: 'CT2', source: '0x1071e..0x10728' },
  search: { id: 'CT3', source: '0x1072c..0x10748' },
  stored: { id: 'CT4', source: '0x1074a..0x1075c, 0x14cf2..0x14d12' },
} as const;


export interface PfWidgetIdRow {
  readonly id: string;
  readonly widget: 'close' | 'zoom' | 'collapse';
  readonly normal: number;
  readonly pressed: number;
  readonly source: string;
}
/** §3.5 widget `ics#`/`ics8` ids (issue #387: zoom −14334/−14331, collapse −14335/−14332). */
export const PF_WIDGET_IDS: readonly PfWidgetIdRow[] = [
  { id: '§3.5.close', widget: 'close', normal: -14336, pressed: -14333, source: '0x14168..0x14182' },
  { id: '§3.5.zoom', widget: 'zoom', normal: -14334, pressed: -14331, source: '0x14186..0x141a0' },
  { id: '§3.5.collapse', widget: 'collapse', normal: -14335, pressed: -14332, source: '0x141a4..0x141be' },
];

// ── §4 Document frame ────────────────────────────────────────────────────────

/** §4 document frame rows; *L* = C.l − 6, *R* = C.r + 6, *B* = C.b + 6 (`0x12dc0..0x12df8`). */
export const PF_DOC_FRAME = {
  band: 6,
  bottomLeft: { id: '§4.1', src: { top: 10, left: 0, bottom: 16, right: 6 }, source: '0x12e5c..0x12e9e' },
  bottomRight: { id: '§4.2', src: { top: 10, left: 10, bottom: 16, right: 16 }, source: '0x12ea4..0x12ed2' },
  /** Row C.b + 5 − i, colour P(6, 15 − i). */
  bottomBand: { id: '§4.3', sampleX: 6, sampleYFrom: 15, source: '0x12ef0..0x12f3c' },
  /** Column L + i, colour P(i, 6). */
  leftBand: { id: '§4.4', sampleY: 6, source: '0x12f48..0x12f7e' },
  /** Column C.r + 5 − i, colour P(15 − i, 6). */
  rightBand: { id: '§4.5', sampleY: 6, sampleXFrom: 15, source: '0x12f80..0x12fb4' },
  /** Row B from L + 2 to R; column R from C.t − H + 2 to B; colour P(0, 0). */
  shadow: { id: '§4.6', inset: 2, sample: { x: 0, y: 0 }, source: '0x12fb6..0x12fe6' },
  growBox: { id: '§4.7', source: '0x13002..0x1301a' },
  absent: { id: '§4.absent', source: '0x12e24' },
  collapsedSkip: { id: '§4.collapsed', source: '0x12e28..0x12e64' },
  /** The port text font holds this sentinel while row 3 draws; its effect is outside this binary (§10.1). */
  fontSentinel: { id: '§4.sentinel', value: -12345, source: '0x12ee8' },
  source: '0x12dc0..0x12df8',
} as const;

// ── §5 Title bar ─────────────────────────────────────────────────────────────

/** §5 title bar drawing rows (F = the frame cicn, T = the title bar). */
export const PF_TITLE_DRAW = {
  mode: { id: '§5.mode', source: '0x138e0..0x1394e' },
  samples: { id: '§5.1', fill: { x: 6, y: 3 }, text: { x: 7, y: 3 }, shadow: { x: 9, y: 3 }, source: '0x1399a..0x139ca' },
  corner: 4,
  topLeft: { id: '§5.2', src: { top: 0, left: 0, bottom: 4, right: 4 }, source: '0x139d0..0x139f2' },
  topRight: { id: '§5.3', src: { top: 0, left: 12, bottom: 4, right: 16 }, source: '0x139f8..0x13a20' },
  boxBottomLeft: { id: '§5.4b', src: { top: 12, left: 0, bottom: 16, right: 4 }, source: '0x13a2e..0x13a8a' },
  boxBottomRight: { id: '§5.4b', src: { top: 12, left: 12, bottom: 16, right: 16 }, source: '0x13a2e..0x13a8a' },
  /** 2 × 3 at (T.l + 4, T.b − 3) and (T.r − 6, T.b − 3). */
  joinLeft: { id: '§5.4j', src: { top: 3, left: 4, bottom: 6, right: 6 }, dx: 4, source: '0x13a96..0x13af8' },
  joinRight: { id: '§5.4j', src: { top: 3, left: 10, bottom: 6, right: 12 }, dxFromRight: 6, source: '0x13a96..0x13af8' },
  joinHeight: 3,
  /** Columns T.l + i / T.r − 1 − i, i = 0..3, rows T.t + 4 .. T.b − 1 (joined) / T.b − 5 (box); P(i, 6) / P(15 − i, 6). */
  sides: { id: '§5.5', count: 4, fromTop: 4, joinedEnd: 1, boxEnd: 5, sampleY: 6, sampleXFrom: 15, source: '0x13b02..0x13b8c' },
  /** Row T.t + i, i = 0..2, columns T.l + 4 .. T.r − 5; P(6, i). */
  topRows: { id: '§5.6', count: 3, inset: 4, sampleX: 6, source: '0x13b98..0x13bca' },
  /** Row T.b − 1 − i, columns T.l + 4 .. T.r − 5; P(6, 15 − i). */
  boxBottomRows: { id: '§5.7b', count: 3, inset: 4, sampleX: 6, sampleYFrom: 15, source: '0x13bd4..0x13c0e' },
  /** Row T.b − 1 − i, columns T.l + 6 .. T.r − 7; P(6, 5 − i). */
  joinedBottomRows: { id: '§5.7j', count: 3, inset: 6, sampleX: 6, sampleYFrom: 5, source: '0x13c16..0x13c50' },
  /** (T.l + 4, T.t + 3, T.r − 4, T.b − 3), fill colour. */
  interior: { id: '§5.8', insetH: 4, insetV: 3, source: '0x13c6a..0x13c80' },
  proxy: { id: '§5.9', source: '0x13c8e..0x13c9a' },
  text: { id: '§5.10', source: '0x13ca2' },
  stripes: { id: '§5.11', source: '0x13cac' },
  widgets: { id: '§5.12', source: '0x13cb2..0x13cf2' },
  absent: { id: '§5.absent', source: '0x13996' },
} as const;

/** §5.1 title text. */
export const PF_TITLE_TEXT = {
  clip: { id: '§5.1.clip', source: '0x13f1c..0x13f4c' },
  pen: { id: '§5.1.pen', source: '0x13f4e..0x13f8c' },
  baseline: { id: '§5.1.baseline', source: '0x13f8e..0x13fb6' },
  shadowPass: { id: '§5.1.shadow', dx: 1, dy: 1, source: '0x13fb8..0x13ff4' },
  mainPass: { id: '§5.1.main', source: '0x13ff6..0x14006' },
} as const;

/** §5.2 stripes. */
export const PF_STRIPES = {
  /** Band rows close.t .. close.t + 12 (13 rows). */
  bandRows: { id: '§5.2.band', rows: 13, source: '0x13d98..0x13dbc' },
  /** Segments (L, title.l − 3) and (title.r + 3, R), or (L, R) without a title. */
  segments: { id: '§5.2.segments', gap: 3, source: '0x13dc0..0x13e18' },
  /** A segment 7 px wide or less is skipped. */
  minimum: { id: '§5.2.minimum', maxSkipped: 7, source: '0x13e2c..0x13e38' },
  pattern: { id: '§5.2.ppat', type: 'ppat', source: '0x13e5c..0x13e84' },
  /** Three-slice stretch, cap mode 1, mask on (the slicer's halves mode). */
  cicn: { id: '§5.2.cicn', type: 'cicn', sliceMode: 1, source: '0x13e88..0x13ed6, 0xb44c' },
} as const;

// ── §5A Dialog frames ────────────────────────────────────────────────────────

export type PfDialogElement = 'shadow' | 'ring' | 'gap' | 'grow' | 'frameRect' | 'frameRectShadow';
export interface PfDialogRow { readonly id: string; readonly kind: number; readonly elements: readonly PfDialogElement[]; readonly source: string }
/** §5A drawer per kind. */
export const PF_DIALOG: readonly PfDialogRow[] = [
  { id: '§5A.5', kind: 5, elements: ['shadow', 'ring', 'gap', 'grow'], source: '0x1302a' },
  { id: '§5A.1', kind: 1, elements: ['shadow', 'ring', 'gap'], source: '0x133ac' },
  { id: '§5A.2', kind: 2, elements: ['frameRect'], source: '0x134a2' },
  { id: '§5A.3', kind: 3, elements: ['frameRect', 'frameRectShadow'], source: '0x134a2..0x13534' },
];
export const PF_DIALOG_SETUP = {
  foreground: { id: '§5A.fg', sample: { x: 0, y: 0 }, source: '0x13596' },
  absent: { id: '§5A.absent', source: '0x13594' },
  /** Kind 3: rows C.b + 1, C.b + 2 and columns C.r + 1, C.r + 2, each starting 2 px in. */
  frameRectShadow: { id: '§5A.3.shadow', width: 2, inset: 2, source: '0x134a2..0x13534' },
  frameOutset: 1,
} as const;

/** §5A ring: 3 px thick, outer edge C outset 6 (3 when thin). */
export const PF_RING = {
  thickness: 3,
  outset: 6,
  thinOutset: 3,
  corners: {
    id: '§5A.ring.corners',
    topLeft: { top: 5, left: 5, bottom: 8, right: 8 },
    topRight: { top: 5, left: 8, bottom: 8, right: 11 },
    bottomLeft: { top: 8, left: 5, bottom: 11, right: 8 },
    bottomRight: { top: 8, left: 8, bottom: 11, right: 11 },
    source: '0x1361a..0x136e4',
  },
  /** Column outer.l + i, rows outer.t + 3 .. outer.b − 4; P(5 + i, 7). */
  left: { id: '§5A.ring.left', sampleXFrom: 5, sampleY: 7, source: '0x1370c..0x13748' },
  /** Column outer.r − 1 − i; P(10 − i, 8). */
  right: { id: '§5A.ring.right', sampleXFrom: 10, sampleY: 8, source: '0x1374a..0x13782' },
  /** Row outer.t + i, columns outer.l + 3 .. outer.r − 4; P(7, 5 + i). */
  top: { id: '§5A.ring.top', sampleX: 7, sampleYFrom: 5, source: '0x13784..0x137ba' },
  /** Row outer.b − 1 − i; P(8, 10 − i). */
  bottom: { id: '§5A.ring.bottom', sampleX: 8, sampleYFrom: 10, source: '0x137bc..0x137ee' },
  endInset: 4,
  source: '0x135e2',
} as const;

/** §5A gap (kinds 1 and 5, not thin): C outset 3 minus C, window colour table entry 0. */
export const PF_GAP = { id: '§5A.gap', outset: 3, entry: 0, source: '0x13092..0x13108, 0x13420..0x13498' } as const;

// ── §6 Widgets, grow box, hit test ──────────────────────────────────────────

/** §6.1 widget glyph: `ics#` required, `ics8` from the same file, masked by the `ics#` mask. */
export const PF_WIDGET_GLYPH = {
  maskType: 'ics#',
  colorType: 'ics8',
  planes: SCROLLBAR_ICS_PLANES,
  required: { id: '§6.1.required', source: '0xf50c..0xf51e' },
  color: { id: '§6.1.color', source: '0xf57c..0xf59c' },
  copy1: { id: '§6.1.copy1', source: '0xf5dc..0xf61a' },
  copy8: { id: '§6.1.copy8', source: '0xf630..0xf66a' },
  source: '0x1414a, 0xf4ba',
} as const;

export type PfHitTest = 'outside' | 'grow' | 'content' | 'untitled' | 'close' | 'zoom' | 'collapse' | 'drag' | 'otherwise';
export interface PfHitRow { readonly id: string; readonly test: PfHitTest; readonly part: number; readonly source: string }
/**
 * §6.3 hit results, first match wins. `grow` answers 3 hilited / 1 not; `zoom`
 * answers 5 at the stored zoom rect, else 6 (both in PF_HIT_CONSTANTS).
 */
export const PF_HIT: readonly PfHitRow[] = [
  { id: 'HT1', test: 'outside', part: 0, source: '0x1296a..0x129a4' },
  { id: 'HT2', test: 'grow', part: 3, source: '0x129a8..0x129f2' },
  { id: 'HT3', test: 'content', part: 1, source: '0x129f6..0x12a0c' },
  { id: 'HT4', test: 'untitled', part: 1, source: '0x12a10' },
  { id: 'HT5', test: 'close', part: 4, source: '0x12a1e..0x12a76' },
  { id: 'HT6', test: 'zoom', part: 6, source: '0x12a7a..0x12ad0, 0x14568' },
  { id: 'HT7', test: 'collapse', part: 9, source: '0x12ad4..0x12af2' },
  { id: 'HT8', test: 'drag', part: 2, source: '0x12af8..0x12b66' },
  { id: 'HT9', test: 'otherwise', part: 1, source: '0x12b6a, 0x12b7e' },
];
export const PF_HIT_CONSTANTS = {
  growInactive: 1,
  zoomAtStored: 5,
  /** Exact points: close (T.l + 16, T.t + 12); zoom (T.r − 16, T.t + 12). */
  exactX: 16,
  exactY: 12,
  frameBand: 6,
  titleExtraRows: 1,
  /** Widget hit: IconDispatch PtInIconID selector (§6.2). */
  ptInIconSelector: 0x060d,
  source: '0x1295e, 0x141fc',
} as const;

/** §6.4 grow box. */
export const PF_GROW = {
  belongs: { id: '§6.4.belongs', source: '0x14b5e, 0x122f6..0x123e2, 0x14400..0x1440a' },
  document: { id: 'GB1', source: '0x144f2..0x14556' },
  movable: { id: 'GB2', source: '0x13124..0x13188' },
  /** GB4–GB6, GL1–GL4: the procedural kind-5 box (not implemented; reached only with thin and grow). */
  procedural: { id: 'GB4', clutHilited: -14336, clutNormal: -14335, eraseEntry: 1, source: '0x1318c..0x1339a' },
} as const;

/** §6.4 copy modes: GB3 masked (CopyMask), GB3a opaque above 1 bit (the icon blit, qd-primitives I1–I3). */
export const PF_COPY = {
  masked: { id: 'GB3', source: '0x10320..0x10418' },
  opaque: { id: 'GB3a', source: '0xfdf8..0xfe90' },
} as const;

/** §6.4 message 6 (document family) M6L1–M6L6. Lines at portRect.b − 15 and portRect.r − 15. */
export const PF_MESSAGE6 = {
  guard: { id: '§6.4.msg6', source: '0x14298..0x142f2' },
  movable: { id: '§6.4.msg6-kind5', source: '0x142f6..0x14310' },
  pen: { id: 'M6L1', source: '0x14314..0x1432e, 0xe978..0xe9ec' },
  colour: { id: 'M6L2', sample: { x: 0, y: 0 }, source: '0x14334..0x14378' },
  horizontal: { id: 'M6L3', inset: 15, source: '0x1437c..0x14394' },
  vertical: { id: 'M6L4', inset: 15, source: '0x14396..0x143a8' },
  recordFlag: { id: 'M6L5', source: '0x143aa..0x14442' },
  growBox: { id: 'M6L6', source: '0x14444, 0x14474..0x144ee, 0xe752' },
} as const;

/** §6.5 proxy icon: Finder-only; Scriptoscope has no Finder windows (absent). */
export const PF_PROXY = { id: '§6.5', source: '0x149f4, 0x14020..0x14140' } as const;

// ── §9 Utility family ────────────────────────────────────────────────────────

/** §9.1 inputs UI1–UI11. Bits are variation-code bit numbers. */
export const PF_UTILITY_INPUTS = {
  alwaysActive: { id: 'UI1', bit: 0, source: '0x154cc..0x154d8' },
  grow: { id: 'UI2', bit: 1, source: '0x1549c..0x154a8' },
  zoom: { id: 'UI3', bit: 2, source: '0x154ac..0x154b8' },
  side: { id: 'UI4', bit: 3, source: '0x154bc..0x154c8' },
  smallGrow: { id: 'UI5', bit: 4, source: '0x15486..0x15492' },
  active: { id: 'UI6', source: '0x1740e..0x17428' },
  goAway: { id: 'UI7', source: '0x156d6, 0x17180' },
  shadeOn: { id: 'UI8', source: '0x1565a..0x15674, 0x15690' },
  /** Font 1 (the application font), size 10, bold. Its metrics are the caller's (spec question F2R2-Q1). */
  font: { id: 'UI9', fontId: 1, size: 10, source: '0x155e8..0x155fe' },
  /** H: 13 when side; otherwise 15 with a non-empty title, else 13. */
  barHeight: { id: 'UI10', side: 13, titled: 15, untitled: 13, source: '0x15600..0x15634' },
  collapsed: { id: 'UI11', source: '0xf078' },
} as const;

/** §9.2 geometry UG1–UG10 (rects are (left, top, right, bottom) in the spec). */
export const PF_UTILITY_GEOMETRY = {
  /** T = (C.l − 4, C.t − H − 1, C.r + 4, C.t); side (C.l − H − 1, C.t − 4, C.l, C.b + 4). Thickness t = H + 1. */
  bar: { id: 'UG1', outset: 4, extra: 1, source: '0x17048..0x1709e' },
  /** C outset 4, top (side: left) moved out by a further H − 3; then the shadow (PF_SHADOW). */
  structure: { id: 'UG2', outset: 4, raiseLess: 3, source: '0x1596c..0x159ba, 0x15a2a..0x15a7c' },
  collapsed: { id: 'UG3', source: '0x159bc..0x15a28' },
  content: { id: 'UG4', source: '0x15912..0x15968' },
  /** 10 × 10 at T.l + 2 along the bar; across: T.t + trunc((t + 1 − 10) / 2). */
  close: { id: 'UG5', box: 10, fromStart: 2, centreExtra: 1, source: '0x17258..0x172e0' },
  /** Along: T.r − 12 (side: T.b − 12). */
  collapse: { id: 'UG6', fromEnd: 12, source: '0x172e2..0x17376' },
  /** The collapse box moved 11 toward the bar's start while shadeOn is set. */
  zoom: { id: 'UG7', shift: 11, source: '0x17378..0x173b2' },
  /** Lu: close.r + 2 (side close.b + 2) with goAway, else T.l + 5 (side T.t + 5). */
  leftLimit: { id: 'UG8', gap: 2, inset: 5, source: '0x17176..0x171d0' },
  /** Ru: zoom.l − 2, else collapse.l − 2, else T.r − 5 (side: tops and T.b). */
  rightLimit: { id: 'UG9', gap: 2, inset: 5, source: '0x171d2..0x17256' },
  /** (C.r − 14, C.b − 14, C.r + 2, C.b + 2); smallGrow (C.r − 10, C.b − 10, C.r + 2, C.b + 2). */
  grow: { id: 'UG10', inside: 14, smallInside: 10, outside: 2, source: '0x173b4..0x1740c' },
} as const;

/** §9.3 widget presence: shown-when rows, then the narrow-window drops UP1–UP4 (rects outset 7). */
export const PF_UTILITY_PRESENCE = {
  close: { id: '§9.3.close', source: '0x156d6, 0x16768' },
  zoom: { id: '§9.3.zoom', source: '0x167ac' },
  collapse: { id: '§9.3.collapse', source: '0x167ee, 0x1742a' },
  outset: 7,
  goAwayZoom: { id: 'UP1', source: '0x156e4..0x1572a' },
  goAwayOnly: { id: 'UP2', source: '0x1572c..0x1574a' },
  zoomShadeOnly: { id: 'UP3', source: '0x1574c..0x1576c' },
  none: { id: 'UP4', source: '0x1574c..0x15750' },
} as const;


/** Frame-relative coordinate: anchor plus offset. Fl/Ft/Fr/Fb = structure bounding box (l, t, r − 1, b − 1); C = content. */
export type PfAnchor = 'Fl' | 'Ft' | 'Fr' | 'Fb' | 'Cl' | 'Ct' | 'Cr' | 'Cb';
export type PfAt = readonly [PfAnchor, number];
/** A cicn sub-rect copied 1:1 with the masked copy (GB3), its top-left at (x, y). */
export interface PfPiece { readonly id: string; readonly src: { readonly top: number; readonly left: number; readonly bottom: number; readonly right: number }; readonly x: PfAt; readonly y: PfAt; readonly source: string }
/**
 * A family of 1-px lines i = 0..count − 1, endpoints inclusive. `row`: a row
 * line at y = at + step·i from x = from to x = to; else a column line at
 * x = at + step·i. `from` may list one start per i. Colour P(sample[0] +
 * sample[1]·i, sample[2] + sample[3]·i).
 */
export interface PfLine {
  readonly id: string;
  readonly row: boolean;
  readonly at: PfAt;
  readonly step: number;
  readonly from: PfAt | readonly PfAt[];
  readonly to: PfAt;
  readonly sample: readonly [number, number, number, number];
  readonly source: string;
}
/** Lines drawn together: for each i, every line of the group in order. */
export interface PfLineGroup { readonly count: number; readonly lines: readonly PfLine[] }
export interface PfInterior { readonly id: string; readonly l: PfAt; readonly t: PfAt; readonly r: PfAt; readonly b: PfAt; readonly source: string }
export interface PfUtilityFrameShape { readonly pieces: readonly PfPiece[]; readonly groups: readonly PfLineGroup[]; readonly interior: PfInterior }

/** §9.4 collapsed: a 2-px box (UFC1–UFC6). */
export const PF_UTILITY_FRAME_COLLAPSED: PfUtilityFrameShape = {
  pieces: [
    { id: 'UFC1', src: { top: 0, left: 0, bottom: 2, right: 2 }, x: ['Fl', 0], y: ['Ft', 0], source: '0x15eb2..0x15f6e' },
    { id: 'UFC1', src: { top: 0, left: 10, bottom: 2, right: 12 }, x: ['Fr', -2], y: ['Ft', 0], source: '0x15eb2..0x15f6e' },
    { id: 'UFC1', src: { top: 10, left: 0, bottom: 12, right: 2 }, x: ['Fl', 0], y: ['Fb', -2], source: '0x15eb2..0x15f6e' },
    { id: 'UFC1', src: { top: 10, left: 10, bottom: 12, right: 12 }, x: ['Fr', -2], y: ['Fb', -2], source: '0x15eb2..0x15f6e' },
  ],
  groups: [{
    count: 2,
    lines: [
      { id: 'UFC2', row: false, at: ['Fl', 0], step: 1, from: ['Ft', 2], to: ['Fb', -3], sample: [0, 1, 6, 0], source: '0x15fc2..0x15fda' },
      { id: 'UFC3', row: false, at: ['Fr', -1], step: -1, from: ['Ft', 2], to: ['Fb', -3], sample: [11, -1, 6, 0], source: '0x15fdc..0x16008' },
      { id: 'UFC4', row: true, at: ['Ft', 0], step: 1, from: ['Fl', 2], to: ['Fr', -3], sample: [6, 0, 0, 1], source: '0x1600a..0x16026' },
      { id: 'UFC5', row: true, at: ['Fb', -1], step: -1, from: ['Fl', 2], to: ['Fr', -3], sample: [6, 0, 11, -1], source: '0x16028..0x16052' },
    ],
  }],
  interior: { id: 'UFC6', l: ['Fl', 2], t: ['Ft', 2], r: ['Fr', -2], b: ['Fb', -2], source: '0x16066..0x16084' },
};

/** §9.4 horizontal, not collapsed (UFH1–UFH12). */
export const PF_UTILITY_FRAME_HORIZONTAL: PfUtilityFrameShape = {
  pieces: [
    { id: 'UFH1', src: { top: 0, left: 0, bottom: 3, right: 3 }, x: ['Fl', 0], y: ['Ft', 0], source: '0x16356..0x1637e' },
    { id: 'UFH2', src: { top: 0, left: 9, bottom: 3, right: 12 }, x: ['Fr', -3], y: ['Ft', 0], source: '0x16384..0x163b2' },
    { id: 'UFH3', src: { top: 8, left: 0, bottom: 12, right: 4 }, x: ['Fl', 0], y: ['Fb', -4], source: '0x163b8..0x163e8' },
    { id: 'UFH4', src: { top: 8, left: 8, bottom: 12, right: 12 }, x: ['Fr', -4], y: ['Fb', -4], source: '0x163ee..0x16418' },
    { id: 'UFH5', src: { top: 3, left: 2, bottom: 6, right: 4 }, x: ['Cl', -2], y: ['Ct', -3], source: '0x1641e..0x1644c' },
    { id: 'UFH6', src: { top: 3, left: 8, bottom: 6, right: 10 }, x: ['Cr', 0], y: ['Ct', -3], source: '0x16452..0x1647c' },
  ],
  groups: [
    { count: 3, lines: [{ id: 'UFH7', row: true, at: ['Ft', 0], step: 1, from: ['Fl', 2], to: ['Fr', -4], sample: [4, 0, 0, 1], source: '0x16482..0x164c0' }] },
    { count: 4, lines: [{ id: 'UFH8', row: true, at: ['Fb', -1], step: -1, from: ['Fl', 4], to: ['Fr', -5], sample: [4, 0, 11, -1], source: '0x164c2..0x16508' }] },
    {
      count: 4,
      lines: [
        { id: 'UFH9', row: false, at: ['Fl', 0], step: 1, from: [['Ft', 2], ['Ft', 2], ['Ct', 0], ['Ct', 0]], to: ['Fb', -5], sample: [0, 1, 6, 0], source: '0x1650a..0x16556' },
        { id: 'UFH10', row: false, at: ['Fr', -1], step: -1, from: [['Ft', 2], ['Ft', 2], ['Ct', 0], ['Ct', 0]], to: ['Fb', -5], sample: [11, -1, 6, 0], source: '0x16558..0x16592' },
      ],
    },
    { count: 3, lines: [{ id: 'UFH11', row: true, at: ['Ct', -1], step: -1, from: ['Cl', 0], to: ['Cr', -1], sample: [4, 0, 5, -1], source: '0x1659e..0x165e4' }] },
  ],
  interior: { id: 'UFH12', l: ['Fl', 2], t: ['Ft', 3], r: ['Fr', -2], b: ['Ct', -3], source: '0x165e6..0x16614' },
};

/** §9.4 side, not collapsed: the horizontal frame transposed (UFS1–UFS12). */
export const PF_UTILITY_FRAME_SIDE: PfUtilityFrameShape = {
  pieces: [
    { id: 'UFS1', src: { top: 0, left: 0, bottom: 3, right: 3 }, x: ['Fl', 0], y: ['Ft', 0], source: '0x16092..0x160ba' },
    { id: 'UFS2', src: { top: 9, left: 0, bottom: 12, right: 3 }, x: ['Fl', 0], y: ['Fb', -3], source: '0x160c0..0x160ee' },
    { id: 'UFS3', src: { top: 0, left: 8, bottom: 4, right: 12 }, x: ['Fr', -4], y: ['Ft', 0], source: '0x160f4..0x16124' },
    { id: 'UFS4', src: { top: 8, left: 8, bottom: 12, right: 12 }, x: ['Fr', -4], y: ['Fb', -4], source: '0x1612a..0x16154' },
    { id: 'UFS5', src: { top: 2, left: 3, bottom: 4, right: 6 }, x: ['Cl', -3], y: ['Ct', -2], source: '0x1615a..0x16188' },
    { id: 'UFS6', src: { top: 8, left: 3, bottom: 10, right: 6 }, x: ['Cl', -3], y: ['Cb', 0], source: '0x1618e..0x161b8' },
  ],
  groups: [
    { count: 3, lines: [{ id: 'UFS7', row: false, at: ['Fl', 0], step: 1, from: ['Ft', 2], to: ['Fb', -4], sample: [0, 1, 4, 0], source: '0x161be..0x161fc' }] },
    { count: 4, lines: [{ id: 'UFS8', row: false, at: ['Fr', -1], step: -1, from: ['Ft', 4], to: ['Fb', -5], sample: [11, -1, 4, 0], source: '0x161fe..0x16244' }] },
    {
      count: 4,
      lines: [
        { id: 'UFS9', row: true, at: ['Ft', 0], step: 1, from: [['Fl', 2], ['Fl', 2], ['Cl', 0], ['Cl', 0]], to: ['Fr', -5], sample: [6, 0, 0, 1], source: '0x16246..0x16292' },
        { id: 'UFS10', row: true, at: ['Fb', -1], step: -1, from: [['Fl', 2], ['Fl', 2], ['Cl', 0], ['Cl', 0]], to: ['Fr', -5], sample: [6, 0, 11, -1], source: '0x16294..0x162ce' },
      ],
    },
    { count: 3, lines: [{ id: 'UFS11', row: false, at: ['Cl', -1], step: -1, from: ['Ct', 0], to: ['Cb', -1], sample: [5, -1, 4, 0], source: '0x162da..0x16320' }] },
  ],
  interior: { id: 'UFS12', l: ['Fl', 3], t: ['Ft', 2], r: ['Cl', -3], b: ['Fb', -2], source: '0x16322..0x16350' },
};

/** §9.4 tail (every orientation): UFT1 samples, UFT2 small grow box, UFT3 drop shadow. */
export const PF_UTILITY_FRAME_TAIL = {
  samples: {
    id: 'UFT1',
    horizontal: { fill: { x: 4, y: 3 }, text: { x: 5, y: 3 }, shadow: { x: 7, y: 3 } },
    side: { fill: { x: 3, y: 4 }, text: { x: 3, y: 5 }, shadow: { x: 3, y: 7 } },
    source: '0x16616..0x1668e',
  },
  smallGrow: { id: 'UFT2', source: '0x16692..0x166b2' },
  /** Row Fb from Fl + 2 to Fr, then column Fr from Fb up to Ft + 2; colour P(0, 0). */
  shadow: { id: 'UFT3', inset: 2, sample: { x: 0, y: 0 }, source: '0x166b4..0x166e2' },
} as const;


/** §9.6 interior paint order UW1–UW5. */
export const PF_UTILITY_PAINT = {
  interior: { id: 'UW1', source: '0x16066..0x16084, 0x16322..0x16350, 0x165e6..0x16614' },
  stripes: { id: 'UW2', source: '0x16736..0x16744' },
  title: { id: 'UW3', source: '0x16746..0x16754' },
  widgets: { id: 'UW4', source: '0x16756..0x16836' },
  fill: { id: 'UW5', source: '0x166f8..0x1670a' },
} as const;

/** §9.6.1 title text UT1–UT8. */
export const PF_UTILITY_TITLE_TEXT = {
  /** Centred in T; condensed re-measure (face 33) when it crosses Lu or Ru; T inset 3 top and bottom. */
  rect: { id: 'UT1', insetV: 3, condensedFace: 33, source: '0x170a0..0x17174' },
  /** r = the title text rect with its bottom moved down by this many rows. */
  bottomExtra: 1,
  skip: { id: 'UT2', minLeft: 2, source: '0x16aec..0x16b00' },
  fit: { id: 'UT3', source: '0x16b04..0x16b40' },
  clip: { id: 'UT4', source: '0x16b42..0x16b64' },
  erase: { id: 'UT5', widen: 2, source: '0x16b66..0x16ba4' },
  pen: { id: 'UT6', source: '0x16ba6..0x16bd8' },
  shadowPass: { id: 'UT7', dx: 1, dy: 1, source: '0x16bda..0x16c10' },
  mainPass: { id: 'UT8', source: '0x16c12..0x16c22' },
} as const;


/** §9.8 message 0 parts (UM1, UM2: only parts 4, 5, 6 and 9 flip the toggle; 258 does not). */
export const PF_UTILITY_DRAW_PARTS: readonly PfDrawPartRow[] = [
  { id: 'UM1', parts: [0], action: 'frame', toggles: false, source: '0x15cde..0x15da4' },
  { id: 'UM1', parts: [4], action: 'close', toggles: true, source: '0x15cde..0x15da4, 0x15da6..0x15dbe' },
  { id: 'UM1', parts: [5, 6], action: 'zoom', toggles: true, source: '0x15cde..0x15da4, 0x15da6..0x15dbe' },
  { id: 'UM1', parts: [9], action: 'collapse', toggles: true, source: '0x15cde..0x15da4, 0x15da6..0x15dbe' },
];
export const PF_UTILITY_TOGGLE = { id: 'UM2', source: '0x15da6..0x15dbe, 0x15dce' } as const;
/** §9.8 UM3 widget glyphs, plotted 16 × 16 at the box's top-left. */
export const PF_UTILITY_WIDGET_IDS: readonly PfWidgetIdRow[] = [
  { id: 'UM3', widget: 'close', normal: -14320, pressed: -14317, source: '0x16c9a..0x16d58' },
  { id: 'UM3', widget: 'zoom', normal: -14318, pressed: -14315, source: '0x16c9a..0x16d58' },
  { id: 'UM3', widget: 'collapse', normal: -14319, pressed: -14316, source: '0x16c9a..0x16d58' },
];
export const PF_UTILITY_GLYPH = { plot: 16, source: '0x16c9a..0x16d58' } as const;
/** §9.8 UM4 message 6: the grow box only, when visible, grow and not collapsed. */
export const PF_UTILITY_MESSAGE6 = { id: 'UM4', source: '0x16d60..0x16e1c' } as const;

export type PfUtilityHitTest = 'outside' | 'grow' | 'content' | 'close' | 'zoom' | 'collapse' | 'drag' | 'otherwise';
export interface PfUtilityHitRow { readonly id: string; readonly test: PfUtilityHitTest; readonly part: number; readonly source: string }
/** §9.9 hit results UH1–UH8, first match wins. Zoom answers 5 at the stored zoom state, else 6. */
export const PF_UTILITY_HIT: readonly PfUtilityHitRow[] = [
  { id: 'UH1', test: 'outside', part: 0, source: '0x15aec..0x15b22' },
  { id: 'UH2', test: 'grow', part: 3, source: '0x15b26..0x15b72' },
  { id: 'UH3', test: 'content', part: 1, source: '0x15b76..0x15b8c' },
  { id: 'UH4', test: 'close', part: 4, source: '0x15b90..0x15bcc, 0x16c38..0x16c96' },
  { id: 'UH5', test: 'zoom', part: 6, source: '0x15bd0..0x15bfa' },
  { id: 'UH6', test: 'collapse', part: 9, source: '0x15bfe..0x15c1e' },
  { id: 'UH7', test: 'drag', part: 2, source: '0x15c20..0x15c86' },
  { id: 'UH8', test: 'otherwise', part: 1, source: '0x15c88' },
];
/** §9.9 widget boxes inset 1; drag band 6 px; T extended by one row. */
export const PF_UTILITY_HIT_CONSTANTS = { boxInset: 1, zoomAtStored: 5, frameBand: 6, titleExtraRows: 1, source: '0x15ae4' } as const;

// ── Declared inputs (modern policy, not decoded) ─────────────────────────────

/**
 * Declared defaults for inputs the original reads from its environment.
 * Each is a recorded modern policy (spec question log v2-lanes/family2), not
 * an observation of the original.
 */
export const PF_DECLARED = {
  /** §3.2 system font metrics: "With Chicago 12 (ascent 12, descent 3), H = 22". */
  systemFont: { ascent: 12, descent: 3 },
  /** §10.2 Gestalt `WdrB` does not answer. */
  wdrb: false,
  /** §6.5 no proxy icon (no Finder windows). */
  proxy: false,
  /** §6.3 the window is not at its stored zoom rect (zoom hit answers 6). */
  atZoomRect: false,
  /** §3.5 aux-window flags bit 4 clear. */
  auxAlertFlag: false,
  /** §5A gap and the §3.5 colour-table row: the default window colour table's entry 0 (content colour) is white. */
  defaultContent: { rgb16: [0xffff, 0xffff, 0xffff], rgb: { r: 255, g: 255, b: 255, a: 255 } },
  /** §2 the per-window toggle bit starts clear, so the first widget-part draw shows the pressed state. */
  toggleStartsClear: true,
  /** §6.4 the application has called DrawGrowIcon once (message 6), so the record flag is set for grow windows. */
  growFlagAfterDrawGrowIcon: true,
  /** §9.6 UW4 (RectInRgn): the port's clip region is the whole port. */
  utilityClipIsPort: true,
  /**
   * §9.4 UFT2 on a collapsed window: not drawn. The grow rect lies outside the
   * collapsed structure, so the Window Manager clip would hide it; the engine has
   * no structure clip, so it skips the draw instead (modern policy, not decoded).
   */
  utilityCollapsedSkipsSmallGrow: true,
  /** §9.9 UH5: the utility window is not at its stored zoom state (zoom hit answers 6). */
  utilityAtZoomState: false,
  source: 'procedural-frame §3.2, §3.5, §5A, §6.3, §6.4, §6.5, §10.2, §10.3 (declared, modern policy)',
} as const;

export type PfFamily = 'document' | 'utility';
export interface PfWindowSlugRow {
  readonly slug: string;
  readonly family: PfFamily;
  /** Variation code (document: kind | flag bits; utility: §9 bits). */
  readonly variation: number;
  readonly goAway: boolean;
  /** Kaleidoscope's collapse-box option (Gestalt `Aarn` bit 0). */
  readonly shadeOn: boolean;
  readonly collapsed: boolean;
  /** The window's colour table is the alert colour table (`actb`), or the default. */
  readonly colorTable: 'actb' | 'default';
}
/**
 * Public window-type slug → WDEF variation and window record (§10.3: the
 * mapping of procIDs onto these bits is not traced; this table is declared
 * modern policy). Widget sets follow the public window types the runtime
 * already exposes (tools/theme-loader/window-recipes.mjs).
 *   document-window   documentProc + zoom (8); goAway; collapse box on
 *   dialog / alert    dBoxProc (1); alert uses the actb colour table
 *   movable-*         movableDBoxProc (5); goAway as the public close box
 *   utility types     §9 bits: 1 = drawn by hilite, 2 = grow, 8 = side. Widget
 *                     presence and the bar height are derived (§9.1 UI10, §9.3)
 */
export const PF_WINDOW_SLUGS: readonly PfWindowSlugRow[] = [
  { slug: 'document-window', family: 'document', variation: 8, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'collapsed-document-window', family: 'document', variation: 8, goAway: true, shadeOn: true, collapsed: true, colorTable: 'default' },
  { slug: 'dialog', family: 'document', variation: 1, goAway: false, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'alert', family: 'document', variation: 1, goAway: false, shadeOn: true, collapsed: false, colorTable: 'actb' },
  { slug: 'movable-modal', family: 'document', variation: 5, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'movable-alert', family: 'document', variation: 5, goAway: true, shadeOn: true, collapsed: false, colorTable: 'actb' },
  { slug: 'titled-utility-window', family: 'utility', variation: 3, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'collapsed-titled-utility', family: 'utility', variation: 1, goAway: true, shadeOn: true, collapsed: true, colorTable: 'default' },
  { slug: 'side-floating-utility-window', family: 'utility', variation: 9, goAway: false, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'collapsed-side-utility', family: 'utility', variation: 9, goAway: false, shadeOn: true, collapsed: true, colorTable: 'default' },
  { slug: 'no-title-utility-window', family: 'utility', variation: 1, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'collapsed-no-title-utility', family: 'utility', variation: 1, goAway: true, shadeOn: true, collapsed: true, colorTable: 'default' },
];
