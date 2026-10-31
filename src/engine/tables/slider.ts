// docs/spec/engine/slider.md — Kaleidoscope 2.3.1 slider CDEF 3 (`slider.draw`,
// plus the gate, state, region, hit-test and tracking facts it depends on).
// Data only: one exported row per spec decision-table row, carrying the spec row
// id and the spec's `source` citation (every address is a CDEF 3 file offset,
// not a kDEF one). The driver (src/engine/families/slider.ts) selects rows by
// data and holds no literals of its own.
import type { IdGrid } from './loaderNeeds.js';

/** §2 derived state: `base` by orientation (a square control is vertical). */
export const SLIDER_BASE = { horizontal: -10144, vertical: -10128, source: 'CDEF 3 0x34a..0x35c; horizontal 0x144..0x170, 0x2e4..0x312' } as const;

/** §1.1 variation bits (procID − 48; HISlider.h). */
export const SLIDER_VARIATION = {
  procBase: 48,
  liveFeedback: 1,
  tickMarks: 2,
  reverse: 4,
  nonDirectional: 8,
  source: 'slider §1.1 (Appearance kControlSliderProc 48 and its variation bits)',
} as const;

export interface SliderGroupRow {
  readonly id: 'group-2' | 'group-1' | 'group-0';
  /** Variation bit that selects the row; 0 = otherwise. */
  readonly bit: number;
  readonly group: 0 | 1 | 2;
  readonly source: string;
}
/** §2 `g`: 2 if variation bit 3; else 1 if bit 2; else 0 (fixed at record creation, ID1). */
export const SLIDER_GROUP: readonly SliderGroupRow[] = [
  { id: 'group-2', bit: SLIDER_VARIATION.nonDirectional, group: 2, source: 'CDEF 3 0x316..0x332' },
  { id: 'group-1', bit: SLIDER_VARIATION.reverse, group: 1, source: 'CDEF 3 0x316..0x332' },
  { id: 'group-0', bit: 0, group: 0, source: 'CDEF 3 0x316..0x332' },
];
/** §2 `gb = base + 6g`. */
export const SLIDER_GROUP_STRIDE = { stride: 6, source: 'CDEF 3 0x364..0x372' } as const;

export interface SliderGateProbeRow {
  /** Offset from `base`. */
  readonly offset: number;
  /** Variation bit required for this probe; 0 = always. */
  readonly bit: number;
}
/** §4.1 gate rows. G1 probes `cinf` only, in this order, while nothing is found. */
export const SLIDER_GATE = {
  G1: {
    id: 'G1',
    probes: [
      { offset: 0, bit: 0 },
      { offset: 2 * SLIDER_GROUP_STRIDE.stride, bit: SLIDER_VARIATION.nonDirectional },
      { offset: SLIDER_GROUP_STRIDE.stride, bit: SLIDER_VARIATION.reverse },
    ] as readonly SliderGateProbeRow[],
    type: 'cinf',
    source: 'CDEF 3 0x13c..0x1d2',
  },
  G2: { id: 'G2', source: 'CDEF 3 0x21c..0x286' },
  G3: { id: 'G3', source: 'CDEF 3 0x252..0x258' },
} as const;

/**
 * Declared defaults (slider §2 "Scriptoscope mapping (proposed) and declared
 * defaults"; modern policy, not original observations). `systemSlider`: the
 * System file's CDEF 3 is present, so G2 hands off; the procedural Platinum
 * slider is the declared substitute (§6 item 3).
 */
export const SLIDER_DECLARED_DEFAULTS = {
  systemSlider: true,
  devices: 1,
  lowDepth: false,
  colorPort: true,
  recordingPicture: false,
  penVisible: true,
  source: 'slider §2 declared defaults; §6 items 3, 4, 8',
} as const;

/** §2 hilite values the state rows read. */
export const SLIDER_HILITE = {
  normal: 0,
  inactive: 254,
  disabled: 255,
  /** `trackTier` 0 / `thumbCell` 0 from here up. */
  inactiveFrom: 254,
  pressedFrom: 1,
  pressedTo: 253,
  thumbPressed: 129,
  source: 'CDEF 3 0xed2..0xef6, 0x103a..0x1060',
} as const;

export interface SliderTierRow {
  readonly id: 'TR1-inactive' | 'TR1-pressed' | 'TR1-normal';
  readonly when: 'inactive' | 'pressed' | 'normal';
  readonly tier: number;
  readonly source: string;
}
/** §2 `trackTier` (TR1): 0 if hilite 254/255; 2 if 1..253; 1 if 0. */
export const SLIDER_TRACK_TIER: readonly SliderTierRow[] = [
  { id: 'TR1-inactive', when: 'inactive', tier: 0, source: 'CDEF 3 0xed2..0xef6' },
  { id: 'TR1-pressed', when: 'pressed', tier: 2, source: 'CDEF 3 0xed2..0xef6' },
  { id: 'TR1-normal', when: 'normal', tier: 1, source: 'CDEF 3 0xed2..0xef6' },
];

export interface SliderTrackCandidateRow {
  readonly from: 'gb' | 'base';
  /** `tier` = the row's trackTier, else a fixed tier. */
  readonly tier: 'tier' | number;
}
/** §4.3 TR3–TR6: candidate ids in order; each needs a cicn and a cinf at the same id. */
export const SLIDER_TRACK = {
  TR3: {
    id: 'TR3',
    candidates: [
      { from: 'gb', tier: 'tier' }, { from: 'gb', tier: 1 }, { from: 'base', tier: 'tier' }, { from: 'base', tier: 1 },
    ] as readonly SliderTrackCandidateRow[],
    source: 'CDEF 3 0xf0e..0xfa4 (h), 0xfa8..0x1038 (v)',
  },
  TR4: { id: 'TR4', source: 'CDEF 3 0x2970..0x29ae, 0x1486..0x14c8' },
  TR5: { id: 'TR5', source: 'CDEF 3 0xf7a..0xfa4, 0x1014..0x1038' },
  TR6: { id: 'TR6', source: 'CDEF 3 0x29b0..0x2b5a, 0x14ca..0x167c' },
} as const;

/** §4.4 track slicing: the cinf bytes read and the rows. */
export const SLIDER_SLICE = {
  /** Byte indices of the track cinf: cap `k`, middle (0 = one column), anchor (0 = start). */
  bytes: { cap: 0, middle: 2, anchor: 3 },
  SL1: { id: 'SL1', source: 'CDEF 3 0x29dc..0x2a04, 0x14f6..0x151e' },
  SL2: { id: 'SL2', source: 'CDEF 3 0x2a08..0x2aa8, 0x1522..0x15c6' },
  SL3: { id: 'SL3', source: 'CDEF 3 0x2aac..0x2b00, 0x15ca..0x1622' },
  SL4: { id: 'SL4', source: 'CDEF 3 0x2b14..0x2b26, 0x1636..0x1648' },
  SL5: { id: 'SL5', source: 'CDEF 3 0x2b00..0x2b10, 0x1622..0x1632' },
  SL6: { id: 'SL6', source: 'CDEF 3 0x2b2a..0x2b58, 0x164c..0x167c' },
} as const;

/** §4.2 ID6: the corner `c` is the first byte of `cinf gb`, else `cinf base`. */
export const SLIDER_CORNER = {
  ID6: { id: 'ID6', byte: 0, from: ['gb', 'base'] as const, source: 'CDEF 3 0x43e..0x480' },
  ID7: { id: 'ID7', source: 'CDEF 3 0x3a2..0x43a' },
  ID8: { id: 'ID8', source: 'CDEF 3 0x472..0x474' },
} as const;

/** §4.2 private record and per-message state rows. */
export const SLIDER_RECORD = {
  ID1: { id: 'ID1', source: 'CDEF 3 0x28a..0x340' },
  ID2: { id: 'ID2', source: 'CDEF 3 0x2b6..0x2da' },
  ID3: { id: 'ID3', source: 'CDEF 3 0x344..0x35c' },
  ID4: { id: 'ID4', source: 'CDEF 3 0x59c..0x5be' },
  ID5: { id: 'ID5', source: 'CDEF 3 0x5c2..0x5c6' },
  ID9: { id: 'ID9', source: 'CDEF 3 0x484..0x4a8' },
} as const;

/** §2: 16-bit value differences wrap, then sign-extend; coordinates are stored as 16-bit. */
export const SLIDER_WORD = { bits: 16, source: 'slider §2 range/offset; header: results stored as 16-bit coordinates' } as const;

export interface SliderThumbCellRow {
  readonly id: 'TH3-inactive' | 'TH3-pressed' | 'TH3-normal';
  readonly when: 'inactive' | 'thumbPressed' | 'otherwise';
  readonly cell: number;
  readonly source: string;
}
/** §2 `thumbCell` / §4.5 cell map: 0 inactive/disabled, 1 normal, 2 pressed (hilite 129 only), 3 ghost. */
export const SLIDER_THUMB_CELL: readonly SliderThumbCellRow[] = [
  { id: 'TH3-inactive', when: 'inactive', cell: 0, source: 'CDEF 3 0x103a..0x1060' },
  { id: 'TH3-pressed', when: 'thumbPressed', cell: 2, source: 'CDEF 3 0x103a..0x1060' },
  { id: 'TH3-normal', when: 'otherwise', cell: 1, source: 'CDEF 3 0x103a..0x1060' },
];

/** §4.5 thumb and ghost rows. */
export const SLIDER_THUMB = {
  /** TH1: thumb = cicn `gb + 3`, else `base + 3`. */
  TH1: { id: 'TH1', offset: 3, source: 'CDEF 3 0x362..0x3a0' },
  TH2: { id: 'TH2', source: 'CDEF 3 0xa9c..0xaaa, 0x1062..0x1068, 0x6f0, 0x982, 0xc38' },
  /** TH3: one cell is 16 rows (horizontal) or columns (vertical). */
  TH3: { id: 'TH3', cellSize: 16, source: 'CDEF 3 0x10c4..0x10f0' },
  TH4: { id: 'TH4', source: 'CDEF 3 0x10f2..0x112a' },
  TH5: { id: 'TH5', ghostCell: 3, source: 'CDEF 3 0x1080..0x10c0' },
} as const;

/** §4.6 tick marks. */
export const SLIDER_TICKS = {
  TK1: { id: 'TK1', minCount: 2, source: 'CDEF 3 0x112e..0x1134' },
  TK2: { id: 'TK2', source: 'CDEF 3 0x11ec..0x11f2, 0x12fc..0x1302' },
  /** TK3: cross size of R below 24 draws none. */
  TK3: { id: 'TK3', minCross: 24, source: 'CDEF 3 0x1194..0x11a4, 0x12a4..0x12b4' },
  /** TK4: tick cicn `gb + 4 + tickState`, else `base + 4 + tickState`. */
  TK4: { id: 'TK4', offset: 4, source: 'CDEF 3 0x113e..0x1176' },
  TK5: { id: 'TK5', source: 'CDEF 3 0x11f6..0x12a0, 0x1306..0x13b2' },
  /** §5.4: the tick band starts 16 px from the R edge on the band side. */
  rects: { bandOffset: 16, source: 'CDEF 3 0x11a8..0x12a0, 0x12b8..0x13b2' },
} as const;

/** §5.1 track band B: 16 px across; group 2 centred at `trunc(sum / 2) − 8`. */
export const SLIDER_BAND = { cross: 16, centreHalf: 8, source: 'CDEF 3 0x866..0x92c' } as const;

/** §5.2 thumb rect. */
export const SLIDER_THUMB_RECT = { source: 'CDEF 3 0xa82..0xb5a' } as const;

/** §4.7 blit rows. */
export const SLIDER_BLIT = {
  BL1: { id: 'BL1', source: 'CDEF 3 0x25cc..0x25dc' },
  BL4: { id: 'BL4', source: 'CDEF 3 0x20ee..0x2164' },
  BL5: { id: 'BL5', source: 'CDEF 3 0x2168..0x21c8' },
  BL6: { id: 'BL6', source: 'CDEF 3 0x21cc..0x2418' },
  BL7: { id: 'BL7', source: 'CDEF 3 0x22fc..0x2318, 0x23e8..0x2404' },
  BL8: { id: 'BL8', source: 'CDEF 3 0x1c1c..0x1de6, 0x28ea..0x2944' },
  BL9: { id: 'BL9', source: 'CDEF 3 0x253c..0x254e, 0x2072..0x20da' },
  BL10: { id: 'BL10', source: 'CDEF 3 0x1c3a..0x1c74, 0x1d0c..0x1d20' },
  /** BL11: the engine's origin-0 domain; a cicn whose bounds origin is not (0, 0) is traced. */
  BL11: { id: 'BL11', source: 'CDEF 3 0x1250..0x1260, 0x1c3a..0x1c74' },
  /** BL12: the decoded-colour shortcut for BL8, guarded by the loader's sampling-equivalence record. */
  BL12: { id: 'BL12', source: 'CDEF 3 0x1c1c..0x1de6, 0x28ea..0x2944' },
} as const;

/** §4.11 short cinf payloads. */
export const SLIDER_CINF_LENGTH = {
  CF1: { id: 'CF1', source: 'CDEF 3 0x17e..0x18c, 0x2b96..0x2bd2' },
  CF2: { id: 'CF2', source: 'CDEF 3 0x472..0x480, 0x29b0..0x29b4, 0x2b14..0x2b1e, 0x2b3e..0x2b44, 0x14ca..0x14ce, 0x1636..0x1640, 0x1660..0x1666' },
  CF3: { id: 'CF3', source: 'CDEF 3 0x472..0x480, 0x29b0..0x29b4, 0x2b14..0x2b1e, 0x2b3e..0x2b44, 0x14ca..0x14ce, 0x1636..0x1640, 0x1660..0x1666' },
} as const;

export interface SliderDrawStepRow {
  readonly id: 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7' | 'O8' | 'O9';
  readonly source: string;
}
/** §3.3 draw order, one run per device (one device by declaration). */
export const SLIDER_DRAW_ORDER: readonly SliderDrawStepRow[] = [
  { id: 'O1', source: 'CDEF 3 0xdea..0xe5c' },
  { id: 'O2', source: 'CDEF 3 0xe5e..0xeb4' },
  { id: 'O3', source: 'CDEF 3 0xeb6..0xec8' },
  { id: 'O4', source: 'CDEF 3 0xeca..0xed0' },
  { id: 'O5', source: 'CDEF 3 0xef8..0x1038' },
  { id: 'O6', source: 'CDEF 3 0x1080..0x10c0' },
  { id: 'O7', source: 'CDEF 3 0x10c4..0x112a' },
  { id: 'O8', source: 'CDEF 3 0x112e..0x13b8' },
  { id: 'O9', source: 'CDEF 3 0x13ba..0x146c' },
];
/** §3.3: nothing drawn when invisible, the visible area is empty, or the pen is hidden. */
export const SLIDER_DRAW_GUARD = { id: 'draw-guard', source: 'CDEF 3 0x16ba..0x1744' } as const;

/** §1.2 message numbers the driver answers. */
export const SLIDER_MESSAGE = {
  draw: 0, test: 1, calcCRgns: 2, init: 3, dispose: 4, posCntl: 5, thumbCntl: 6,
  calcCntlRgn: 10, calcThumbRgn: 11, drawGhost: 13, getFeatures: 19, calcValueFromPos: 26,
  source: 'CDEF 3 0x4ac..0x6a6',
} as const;

export interface SliderHitRow {
  readonly id: 'HT1' | 'HT2' | 'HT3' | 'HT4';
  readonly test: 'outsideBand' | 'thumb' | 'before' | 'otherwise';
  readonly part: number;
  readonly source: string;
}
/** §4.9 hit test (message 1). */
export const SLIDER_HIT_TEST: readonly SliderHitRow[] = [
  { id: 'HT1', test: 'outsideBand', part: 0, source: 'CDEF 3 0xba0..0xbbc, 0xbf2' },
  { id: 'HT2', test: 'thumb', part: 129, source: 'CDEF 3 0xbbe..0xbd4' },
  { id: 'HT3', test: 'before', part: 22, source: 'CDEF 3 0xbd6..0xbec' },
  { id: 'HT4', test: 'otherwise', part: 23, source: 'CDEF 3 0xbee' },
];

/** §5.6–§5.8 tracking. */
export const SLIDER_TRACKING = {
  valueFromPos: { id: '5.6', source: 'CDEF 3 0x6d6..0x7a6' },
  posCntl: { id: '5.7', source: 'CDEF 3 0xc22..0xd2e' },
  /** §5.8: axis 1 = h only, 2 = v only; the slop rect is B outset by 15. */
  thumbCntl: { id: '5.8', axisH: 1, axisV: 2, slop: 15, source: 'CDEF 3 0x95e..0xa34' },
} as const;

/** §1.2 message 19: 1 (ghosting) + bit 13 + 1024 (live feedback) when variation bit 0 is set. */
export const SLIDER_FEATURES = { ghosting: 1, bit13: 8192, liveFeedback: 1024, source: 'CDEF 3 0x632..0x646' } as const;

/**
 * Every slider id one orientation can request: `base + 6g + t` for every group
 * and every offset the tables use (track tiers 0..2, thumb 3, ticks 4..5).
 * Used to preload the chain and, via tables/loaderNeeds.ts, as the cinf ids the
 * loader keeps raw header bytes for.
 */
const SLIDER_TERMS: readonly (readonly number[])[] = [
  SLIDER_GROUP.map(r => r.group * SLIDER_GROUP_STRIDE.stride),
  [0, 1, 2, SLIDER_THUMB.TH1.offset, SLIDER_TICKS.TK4.offset, SLIDER_TICKS.TK4.offset + 1],
];
export const SLIDER_IDS: { readonly horizontal: IdGrid; readonly vertical: IdGrid; readonly source: string } = {
  horizontal: { bases: [SLIDER_BASE.horizontal], terms: SLIDER_TERMS },
  vertical: { bases: [SLIDER_BASE.vertical], terms: SLIDER_TERMS },
  source: 'G1, ID6, TR3, TH1, TK4',
};

/**
 * Public value mapping for the `composeSlider` facade (modern policy, not a
 * decoded rule): the public 0..1 `value` becomes the native value with
 * `min = 0`, `max = 100`, rounded to the nearest integer.
 */
export const SLIDER_FACADE_RANGE = { min: 0, max: 100, source: 'modern policy; slider §2 inputs' } as const;

/**
 * Facade control rect cross size (modern policy): 16 px (the band, §5.1); 32 px
 * when tick marks are requested on a directional slider, so the §5.4 tick band
 * fits (TK3 needs at least 24). Overridable with the public `thickness` option.
 */
export const SLIDER_FACADE_THICKNESS = { plain: 16, withTicks: 32, source: 'modern policy; slider §5.1, §5.4, TK3' } as const;

/**
 * Facade background (O3/O4, §6 item 1): the engine takes `background` as an
 * input and never synthesises it from art. The facade's default is QuickDraw's
 * default background colour, white (Inside Macintosh: Imaging With QuickDraw,
 * "the background colour is white by default"); hosts pass their own.
 */
export const SLIDER_FACADE_BACKGROUND = { r: 255, g: 255, b: 255, a: 255, source: 'modern policy; slider §4.10 BG6; IWQD default background white' } as const;

/**
 * DOM host background (slider §4.10 BG6a, compatibility policy, #596): a slider
 * on a themed window erases R to the window's brush (BG4). The DOM host already
 * composites the window body behind the control, so it passes a fully
 * transparent background and the body shows through every pixel no masked art
 * covers (BL1). This matches BG4 exactly for a solid brush; for a patterned
 * body it implies window-origin alignment, which BG6a leaves unresolved.
 */
export const SLIDER_HOST_BODY_BACKGROUND = { r: 0, g: 0, b: 0, a: 0, source: 'modern policy; slider §4.10 BG6a (#596)' } as const;
