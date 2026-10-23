// docs/spec/engine/window-widgets.md — Kaleidoscope 2.3.1 window recipe
// (`window.layout`: part-code verdicts, layout sums, too-short step, allocation
// path, per-cell width, titled side, cell rects; `window.widgets`: rect-list
// remap, widget draw and widget hit). Data only: one row per spec row, with the
// spec's `source` citation (kDEF 0 file offsets). The driver
// (src/engine/families/window.ts) selects rows by data.

/** §2.1 sides in layout order (0 top, 1 bottom, 2 left, 3 right) and their axis. */
export const WINDOW_SIDES = [
  { side: 0, edge: 'top', horizontal: true },
  { side: 1, edge: 'bottom', horizontal: true },
  { side: 2, edge: 'left', horizontal: false },
  { side: 3, edge: 'right', horizontal: false },
] as const;
export const WINDOW_SIDES_SOURCE = '0x3826..0x38c0, 0x3848..0x3888';

/** §2.1 rect-list entry types. */
export const WINDOW_RECT_TYPE = { body: 0, close: 1, zoom: 2, collapse: 3, title: 4, source: '0x6582..0x65b8, 0x4a74..0x4a82' } as const;

/** Window flags read by the PV rows (§2.2), plus the side's drop flag (TS1). */
export type VerdictFlag = 'hasClose' | 'hasZoom' | 'collapseBox' | 'drop';

export interface PartVerdictRow {
  readonly id: `PV${number}`;
  /** Part codes; `'*'` = any other code. */
  readonly codes: readonly number[] | '*';
  /** The flag the verdict reads; absent = constant. */
  readonly flag?: VerdictFlag;
  /** `V` is "zero" when `flag` has this value (or always, without a flag). */
  readonly zeroWhen: boolean;
  readonly source: string;
}
/** §4.1 part-code verdict `V(code, drop)`. */
export const PART_VERDICT: readonly PartVerdictRow[] = [
  { id: 'PV1', codes: [0], zeroWhen: true, source: '0x4a12' },
  { id: 'PV2', codes: [2], flag: 'hasClose', zeroWhen: false, source: '0x4a16..0x4a22' },
  { id: 'PV3', codes: [3], flag: 'hasZoom', zeroWhen: false, source: '0x4a24..0x4a2c' },
  { id: 'PV4', codes: [4], flag: 'collapseBox', zeroWhen: false, source: '0x4a2e..0x4a38' },
  { id: 'PV5', codes: [10], flag: 'drop', zeroWhen: true, source: '0x4a0c' },
  { id: 'PV6', codes: [15], flag: 'hasClose', zeroWhen: true, source: '0x4a3a..0x4a46' },
  { id: 'PV7', codes: [16], flag: 'hasZoom', zeroWhen: true, source: '0x4a48..0x4a50' },
  { id: 'PV8', codes: [17], flag: 'collapseBox', zeroWhen: true, source: '0x4a52..0x4a5c' },
  { id: 'PV9', codes: '*', zeroWhen: false, source: 'default 0x4a5e' },
];

/** §4.2 layout sums. */
export const LAYOUT_SUMS = {
  LS1: { id: 'LS1', excluded: [5, 6, 8, 11, 12, 13, 14, 18], source: '0x4b64..0x4ba4' },
  LS2: { id: 'LS2', droppable: 10, source: '0x4ba8..0x4bae' },
  LS3: { id: 'LS3', gap: 4, cell: 17, source: '0x4bb2..0x4bd2' },
  LS4: { id: 'LS4', anchor: 5, source: '0x4b1a..0x4b20' },
  LS5: { id: 'LS5', growers: [8, 11, 12, 18], source: '0x4b3e..0x4b60' },
  LS6: { id: 'LS6', source: '0x4b20..0x4b3a' },
  LS7: { id: 'LS7', source: '0x4be4..0x4c60' },
  LS8: { id: 'LS8', source: '0x4dfe..0x4e04' },
} as const;

/** §4.3 too-short step. */
export const TOO_SHORT = {
  TS1: { id: 'TS1', source: '0x4e08..0x4e20' },
  TS2: { id: 'TS2', source: '0x4e0c' },
  TS3: { id: 'TS3', source: '0x4e24..0x4e42' },
  TS4: { id: 'TS4', source: '0x4e2e..0x4e38' },
} as const;

/** §4.4 allocation path per side. */
export const ALLOCATION_PATH = {
  AP1: { id: 'AP1', titleGate: 1, source: '0x4c64..0x4dfa' },
  AP2: { id: 'AP2', source: '0x4e46..0x4e50' },
  AP3: { id: 'AP3', titleGate: 0, source: '0x5148..0x5166' },
} as const;

export type CellWidthKind = 'tiles' | 'primaryRemainder' | 'remainder' | 'verdictZero' | 'titleGate' | 'template';
export interface CellWidthRow {
  readonly id: `AW${number}`;
  readonly codes: readonly number[] | '*';
  readonly kind: CellWidthKind;
  readonly source: string;
}
/** §4.5 per-cell width in an allocation, first matching row. */
export const CELL_WIDTH: readonly CellWidthRow[] = [
  { id: 'AW1', codes: [12], kind: 'tiles', source: '0x5266..0x529a' },
  { id: 'AW2', codes: [8, 11, 18], kind: 'primaryRemainder', source: '0x529e..0x52d8' },
  { id: 'AW3', codes: [13, 14], kind: 'remainder', source: '0x52da..0x52fa' },
  { id: 'AW4', codes: '*', kind: 'verdictZero', source: '0x52fc..0x530a' },
  { id: 'AW5', codes: [5, 6], kind: 'titleGate', source: '0x530c..0x531c' },
  { id: 'AW6', codes: '*', kind: 'template', source: '0x531e..0x532a' },
];
export const ALLOCATION = {
  AW7: { id: 'AW7', source: '0x532e..0x534a' },
  AW8: { id: 'AW8', source: '0x5180..0x519c, 0x51b4..0x51c6' },
  AW9: { id: 'AW9', source: '0x51a4..0x51b0, 0x52b0..0x52b8, 0x52e6' },
  /** compositor-spec "Distribution": cells that take a share of the remainder pool. */
  remainderRecipients: [8, 11, 13, 14, 18],
} as const;

/** §4.6 titled side. */
export const TITLED_SIDE = {
  TT1: { id: 'TT1', excluded: [8, 11, 12, 13, 14, 18], source: '0x4e54..0x4eec' },
  /** TT2 TextFace values: condense (32) or bold + condense (33) under altWidgets, then plain (0) or bold (1). */
  TT2: { id: 'TT2', condense: 32, boldCondense: 33, plain: 0, bold: 1, source: '0x4eee..0x4f42' },
  /** TT2a declared default (modern policy): `SWc = SW − titleLen`, Apple's synthetic condense of 1 px per character. */
  TT2a: { id: 'TT2a', perCharacter: 1, source: 'Inside Macintosh: Text (Font Manager style extra)' },
  TT3: { id: 'TT3', minRoom: 2, source: '0x4f46..0x4f62' },
  TT4: { id: 'TT4', bezel: 6, source: '0x4f66..0x4fa4' },
  TT5: { id: 'TT5', source: '0x4fa8..0x4fcc' },
  TT6: { id: 'TT6', source: '0x4fd0..0x5046' },
  TT7: { id: 'TT7', source: '0x5048..0x50ba' },
  TT8: { id: 'TT8', source: '0x50be..0x50fa' },
  TT9: { id: 'TT9', source: '0x5100..0x513c' },
  TT10: { id: 'TT10', source: '0x4a94..0x4aa6, 0x4b20..0x4b3a, 0x4f66, 0x530c' },
  mid: { source: '0x4fe6..0x5002, 0x5054..0x5070' },
} as const;

/** §4.6a popup placement (AP1). */
export const POPUP_PLACEMENT = {
  PP1: { id: 'PP1', mode: -2, nudge: 4, source: '0x4c92..0x4cbc' },
  PP2: { id: 'PP2', source: '0x4cbe' },
  PP3: { id: 'PP3', excluded: [8, 11, 12, 13, 14, 18], source: '0x4cc6..0x4d5c' },
  /** PP4: the plate starts `inset` in from `X` and ends `inset` before `X + pdLen`. */
  PP4: { id: 'PP4', inset: 10, source: '0x4d5e..0x4db0' },
  PP5: { id: 'PP5', titleGate: 1, source: '0x4db4..0x4df6' },
  /** PP6 popup data at window creation; PP7 declares these as the runtime values. */
  PP6: { id: 'PP6', pdMode: 0, pdX: 0, pdLen: 33, pdCentre: 0, source: '0x390a..0x3954' },
  PP7: { id: 'PP7', source: 'window-widgets PP7 declared default (creation values)' },
} as const;

/** §4.12 title text (drawn by renderWindow in the remapped title rect `t4p`). */
export const TITLE_TEXT = {
  TX2: { id: 'TX2', source: '0x5538..0x5554' },
  TX3: { id: 'TX3', source: '0x556a..0x55ba' },
  /** TX4 / TX5: the clip and the truncation room are `t4p` widened by 2 on the right. */
  TX4: { id: 'TX4', widenRight: 2, source: '0x55be..0x55e4' },
  TX5: { id: 'TX5', source: '0x55ec..0x5636' },
  /** TX8: left-aligned, baseline 4 above `t4p.bottom`. */
  TX8: { id: 'TX8', baselineAbove: 4, source: '0x56ee..0x5706' },
} as const;

/** §4.7 layout cache (the runtime has no message stream: LC1 is never taken). */
export const LAYOUT_CACHE = {
  LC1: { id: 'LC1', source: '0x376c..0x3810' },
  LC2: { id: 'LC2', source: '0x3814..0x38a8' },
  LC3: { id: 'LC3', source: '0x2e26, 0x4e3a' },
} as const;

/**
 * §4.8 cell rects, across the side. The template band `t` is `[from, to)` over
 * A (template body) and B (template bounds); `null` is 0. The placed band `p` is
 * `t` moved by `C[shift] − A[shift]` (C = content rect), which is each CR row's
 * `p` written as an offset of its `t`.
 */
type BandEdge = readonly ['A' | 'B', 'top' | 'left' | 'bottom' | 'right'] | null;
export interface CellRectRow {
  readonly id: 'CR1' | 'CR2' | 'CR3' | 'CR4';
  readonly from: BandEdge;
  readonly to: BandEdge;
  readonly shift: 'top' | 'left' | 'bottom' | 'right';
  readonly source: string;
}
/** Indexed by side. */
export const CELL_RECT: readonly CellRectRow[] = [
  { id: 'CR1', from: null, to: ['A', 'top'], shift: 'top', source: '0x538e..0x53ec' },
  { id: 'CR2', from: ['A', 'bottom'], to: ['B', 'bottom'], shift: 'bottom', source: '0x53f0..0x5454' },
  { id: 'CR3', from: ['B', 'left'], to: ['A', 'left'], shift: 'left', source: '0x5458..0x54c0' },
  { id: 'CR4', from: ['A', 'right'], to: ['B', 'right'], shift: 'right', source: '0x54c2..0x5528' },
];

/** §4.9 widget rect remap. */
export const WIDGET_REMAP = {
  RM1: { id: 'RM1', source: '0x5cd0..0x5cd4' },
  RM2: { id: 'RM2', source: '0x5cc2..0x5cc6, 0x5d04..0x5d08' },
  RM3: { id: 'RM3', source: '0x5d0c..0x5dc2' },
  RM4: { id: 'RM4', source: '0x5d4a..0x5d5e, 0x5d78..0x5d8a' },
  RM5: { id: 'RM5', source: '0x5d60..0x5d76' },
  RM6: { id: 'RM6', source: '0x5d8c..0x5da4' },
  RM7: { id: 'RM7', source: '0x5da6..0x5dac' },
  RM8: { id: 'RM8', source: '0x5dc6..0x5dd0' },
} as const;

export interface WidgetPartRow {
  /** Draw parameter / part code. */
  readonly part: 4 | 5 | 6 | 9;
  /** Rect-list entry type it draws (WD7). */
  readonly type: 1 | 2 | 3;
  readonly role: 'close' | 'zoom' | 'collapse';
  /** WD9 / HT7: the widget's column in the pressed strip is the summed widths of these entry types. */
  readonly stripAfter: readonly (1 | 2)[];
  /** Window flag that gates its hit (HT3–HT5) and its `wHit` result. */
  readonly flag: 'hasClose' | 'hasZoom' | 'collapseBox';
  readonly hit: 4 | 5 | 9;
  readonly hitRow: 'HT3' | 'HT4' | 'HT5';
}
/** §4.10 WD7 part → entry type, WD9 strip layout, §4.11 HT3–HT5, in hit order. */
export const WIDGET_PARTS: readonly WidgetPartRow[] = [
  { part: 4, type: 1, role: 'close', stripAfter: [], flag: 'hasClose', hit: 4, hitRow: 'HT3' },
  { part: 5, type: 2, role: 'zoom', stripAfter: [1], flag: 'hasZoom', hit: 5, hitRow: 'HT4' },
  { part: 9, type: 3, role: 'collapse', stripAfter: [1, 2], flag: 'collapseBox', hit: 9, hitRow: 'HT5' },
];

/** §4.10 widget draw rows. */
export const WIDGET_DRAW = {
  WD4: { id: 'WD4', source: '0x58b8..0x58d8, 0x5990..0x59c4' },
  WD5: { id: 'WD5', source: '0x5a28..0x5a42' },
  /** WD6 popup raw blits: rect-list types 5 and 6, and the `corner` × `corner` rect ending at A's bottom-right. */
  WD6: { id: 'WD6', types: [5, 6], corner: 15, source: '0x5786, 0x5b7a..0x5c92' },
  WD7: { id: 'WD7', source: '0x632e..0x6386' },
  /** WD8: partial-zoom cicn `base + 1` (`base − 7` under sideTitle). */
  WD8: { id: 'WD8', offset: 1, sideTitleOffset: -7, source: '0x60aa..0x6154' },
  /** WD9: pressed strip cicn `base` (`base − 8` under sideTitle). */
  WD9: { id: 'WD9', sideTitleOffset: -8, source: '0x6158..0x62ee' },
  WD10: { id: 'WD10', source: '0x62f0..0x631e' },
  /** WD11: `base = −14330`, +32 under altWidgets, a further +8 under altWidgets ∧ sideTitle. */
  WD11: { id: 'WD11', base: -14330, altWidgets: 32, altSideTitle: 8, source: '0x607a..0x608e' },
  WD12: { id: 'WD12', source: '0x6090..0x60a8, 0x6322' },
} as const;

/** §4.11 widget hit results (`wHit`) and rows. */
export const WIDGET_HIT = {
  HT1: { id: 'HT1', result: 1, source: '0x411c..0x4120' },
  HT2: { id: 'HT2', result: 2, source: '0x4124..0x4128' },
  HT3: { id: 'HT3', source: '0x412c..0x4146' },
  HT4: { id: 'HT4', source: '0x4168..0x4192' },
  HT5: { id: 'HT5', source: '0x41be..0x41dc' },
  HT5a: { id: 'HT5a', result: 2, source: '0x41e0' },
  HT6: { id: 'HT6', source: '0x5ffc..0x6058' },
  HT7: { id: 'HT7', source: '0x5ddc..0x5ff2' },
} as const;

/**
 * §2.3 declared defaults (modern policy, not original observations). The
 * runtime has no procID: `popupFamily` comes from the `popup-window` request
 * and `drawActive` from the window's active state (both caller inputs).
 * `hasClose`, `hasZoom` and `collapseRequested` are separate flags (F7); the
 * runtime asks for all three.
 */
export const WINDOW_DECLARED_DEFAULTS = {
  hasClose: true,
  hasZoom: true,
  collapseRequested: true,
  widgetFrame: true,
  noWidgets: false,
  partialZoom: false,
  partialZoomColumn: false,
  altWidgets: false,
  sideTitle: false,
  collapsed: false,
  outlineDraw: false,
  source: 'window-widgets §2.3 declared defaults',
} as const;
