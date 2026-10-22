// docs/spec/engine/procedural-frame.md — Kaleidoscope's built-in window frame
// for schemes that ship neither a `wnd#` recipe nor a replacement `WDEF`
// (document family, plus the decoded part of the utility family, §9). Data
// only: one exported row (or row group) per spec row, carrying the spec section
// it mirrors (`id`) and the spec's `source` citation. The driver
// (src/engine/families/proceduralFrame.ts) selects rows by data and holds no
// literals of its own.
//
// Row ids are spec section references (`§4.3` = §4 table, order 3), because
// the spec's tables are numbered by draw order rather than lettered row ids.
import { SCROLLBAR_ICS_PLANES } from './scrollbar.js';

// ── §2 Messages ──────────────────────────────────────────────────────────────

/** §2 WDEF messages this unit answers. */
export const PF_MESSAGES = {
  draw: 0, hit: 1, calcRegions: 2, new: 3, dispose: 4, growOutline: 5, drawGrowIcon: 6, getFeatures: 7, getRegion: 8,
  source: '0x12b88, 0x1295e, 0x12486, 0x122c6, 0x123f0, 0x1280a, 0x14286, 0x11cfa, 0x11d7e',
} as const;

export type PfDrawAction = 'frame' | 'close' | 'zoom' | 'collapse';
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
];
export const PF_DRAW_PART_NONE = { id: '§2.part-other', source: '0x12c28' } as const;

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
/** §3.3 widget presence (rules in the driver, one branch per row). */
export const PF_WIDGET_PRESENCE: readonly PfWidgetPresenceRow[] = [
  { id: '§3.3.W-close', widget: 'close', source: '0x13cb6' },
  { id: '§3.3.W-zoom', widget: 'zoom', source: '0x121dc..0x1221e' },
  { id: '§3.3.W-collapse', widget: 'collapse', source: '0x14b40, 0x121f6, 0x12224, 0x12244' },
];

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

/** §3.5 frame cicn ids by role and hilite. */
export const PF_ART = {
  document: { hilited: -14332, normal: -14336, id: '§3.5.doc', source: '0x12dfc..0x12e18, 0x13938' },
  dialogAlert: { hilited: -14322, normal: -14324, id: '§3.5.dlg-alert', source: '0x1353a..0x13588, 0x13950' },
  dialog: { hilited: -14326, normal: -14328, id: '§3.5.dlg', source: '0x1353a..0x13588, 0x13950' },
  stripesDocument: { id: '§3.5.stripes04', stripes: -14331, source: '0x13e58' },
  stripesMovable: { id: '§3.5.stripes5', alert: -14321, normal: -14325, source: '0x13e42..0x13e52' },
  growDocument: { hilited: -14330, normal: -14334, id: '§3.5.grow04', source: '0x1450a..0x14526, 0x144f2..0x14556' },
  growMovable: { hilited: -14309, normal: -14310, id: '§3.5.grow5', source: '0x13136..0x13204' },
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
  { id: '§6.3.H1', test: 'outside', part: 0, source: '0x1296a..0x129a4' },
  { id: '§6.3.H2', test: 'grow', part: 3, source: '0x129a8..0x129f2' },
  { id: '§6.3.H3', test: 'content', part: 1, source: '0x129f6..0x12a0c' },
  { id: '§6.3.H4', test: 'untitled', part: 1, source: '0x12a10' },
  { id: '§6.3.H5', test: 'close', part: 4, source: '0x12a3a..0x12a76' },
  { id: '§6.3.H6', test: 'zoom', part: 6, source: '0x12a7a..0x12ad0, 0x14568' },
  { id: '§6.3.H7', test: 'collapse', part: 9, source: '0x12ad4..0x12af2' },
  { id: '§6.3.H8', test: 'drag', part: 2, source: '0x12af8..0x12b66' },
  { id: '§6.3.H9', test: 'otherwise', part: 1, source: '0x12b6a' },
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
  document: { id: '§6.4.kind04', source: '0x144f2..0x14556' },
  movable: { id: '§6.4.kind5', clutHilited: -14336, clutNormal: -14335, eraseEntry: 1, source: '0x13124..0x1339a' },
  message6: { id: '§6.4.msg6', lineInset: 15, sample: { x: 0, y: 0 }, source: '0x14314..0x14444, 0x14474' },
} as const;

/** §6.5 proxy icon: Finder-only; Scriptoscope has no Finder windows (absent). */
export const PF_PROXY = { id: '§6.5', source: '0x149f4, 0x14020..0x14140' } as const;

// ── §9 Utility family (decoded part only) ────────────────────────────────────

/** §9 utility variation bits. */
export const PF_UTILITY_VARIATION = {
  activeBit: 0, growBit: 1, zoomBit: 2, sideBit: 3, smallGrowBit: 4,
  source: '0x1547e..0x154d8',
} as const;
/** §9 title height: 15 titled, 13 untitled or side. */
export const PF_UTILITY_TITLE = { titled: 15, untitled: 13, source: '0x15600..0x15634' } as const;
/** §9 title bar: (C.l − 4, C.t − H − 1, C.r + 4, C.t); side (C.l − H − 1, C.t − 4, C.l, C.b + 4). Structure C outset 4 + bar + 1-px shadow. */
export const PF_UTILITY_GEOMETRY = { outset: 4, barExtra: 1, source: 'bar 0x17048, structure 0x1596c, 0x15a2a' } as const;
/** §9 widgets: 10 × 10 boxes centred across the bar; close 2 from start, collapse 12 from end, zoom 11 further in; plotted 16 × 16 from the box top-left. */
export const PF_UTILITY_WIDGETS = {
  box: 10, closeFromStart: 2, collapseFromEnd: 12, zoomFurther: 11, plot: 16,
  source: '0x17258, 0x172e2, 0x17378, 0x16d14',
} as const;
export const PF_UTILITY_WIDGET_IDS: readonly PfWidgetIdRow[] = [
  { id: '§9.close', widget: 'close', normal: -14320, pressed: -14317, source: '0x16cb8..0x16d0a' },
  { id: '§9.zoom', widget: 'zoom', normal: -14318, pressed: -14315, source: '0x16cb8..0x16d0a' },
  { id: '§9.collapse', widget: 'collapse', normal: -14319, pressed: -14316, source: '0x16cb8..0x16d0a' },
];
/** §9 frame and stripes cicn ids (drawing undecoded, §9 "Not decoded"). */
export const PF_UTILITY_ART = {
  frameSide: { active: -14315, inactive: -14319 },
  frame: { active: -14316, inactive: -14320 },
  stripesSide: [-14318, -14314],
  stripes: [-14314],
  source: '0x15e20..0x15e64, 0x1694c..0x16978',
} as const;
/** §9 grow: 16 × 16 at (C.r − 14, C.b − 14), or 12 × 12 with bit 4. */
export const PF_UTILITY_GROW = {
  size: 16, smallSize: 12, inside: 14,
  normal: { active: -14313, inactive: -14317 },
  small: { active: -14285, inactive: -14286, fallbackActive: -14313, fallbackInactive: -14317, scale: [11, 15] },
  source: '0x173b4, 0x16e1e',
} as const;
export const PF_UTILITY_UNDECODED = {
  id: '§9.undecoded',
  what: 'utility frame and stripe drawing order, colour sample points and title text are not decoded (spec §9)',
  source: '0x15dec, 0x16920, 0x1670c, 0x16aac',
} as const;

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
  /** Utility only: widgets shown (§9 gives positions, not presence). */
  readonly utilityWidgets?: readonly ('close' | 'zoom' | 'collapse')[];
  /** Utility only: the window counts as titled for §9's title height (15 titled, 13 otherwise). */
  readonly utilityTitled?: boolean;
}
/**
 * Public window-type slug → WDEF variation and window record (§10.3: the
 * mapping of procIDs onto these bits is not traced; this table is declared
 * modern policy). Widget sets follow the public window types the runtime
 * already exposes (tools/theme-loader/window-recipes.mjs).
 *   document-window   documentProc + zoom (8); goAway; collapse box on
 *   dialog / alert    dBoxProc (1); alert uses the actb colour table
 *   movable-*         movableDBoxProc (5); goAway as the public close box
 *   utility types     §9 bits: 1 = drawn by hilite, 2 = grow, 8 = side
 */
export const PF_WINDOW_SLUGS: readonly PfWindowSlugRow[] = [
  { slug: 'document-window', family: 'document', variation: 8, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'collapsed-document-window', family: 'document', variation: 8, goAway: true, shadeOn: true, collapsed: true, colorTable: 'default' },
  { slug: 'dialog', family: 'document', variation: 1, goAway: false, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'alert', family: 'document', variation: 1, goAway: false, shadeOn: true, collapsed: false, colorTable: 'actb' },
  { slug: 'movable-modal', family: 'document', variation: 5, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default' },
  { slug: 'movable-alert', family: 'document', variation: 5, goAway: true, shadeOn: true, collapsed: false, colorTable: 'actb' },
  { slug: 'titled-utility-window', family: 'utility', variation: 3, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default', utilityWidgets: ['close', 'collapse'], utilityTitled: true },
  { slug: 'collapsed-titled-utility', family: 'utility', variation: 1, goAway: true, shadeOn: true, collapsed: true, colorTable: 'default', utilityWidgets: ['close', 'collapse'], utilityTitled: true },
  { slug: 'side-floating-utility-window', family: 'utility', variation: 9, goAway: false, shadeOn: true, collapsed: false, colorTable: 'default', utilityWidgets: [] },
  { slug: 'collapsed-side-utility', family: 'utility', variation: 9, goAway: false, shadeOn: true, collapsed: true, colorTable: 'default', utilityWidgets: [] },
  { slug: 'no-title-utility-window', family: 'utility', variation: 1, goAway: true, shadeOn: true, collapsed: false, colorTable: 'default', utilityWidgets: ['close', 'collapse'] },
];
