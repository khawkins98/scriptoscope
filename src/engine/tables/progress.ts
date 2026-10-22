// docs/spec/engine/progress.md — Kaleidoscope 2.3.1 progress bar CDEF 5
// (`progress.draw`, plus the message, state, data-access and idle facts it
// depends on). Data only: one exported row per spec decision-table row, carrying
// the spec row id and the spec's `source` citation (every address is a CDEF 5
// file offset, not a kDEF one). The driver (src/engine/families/progress.ts)
// selects rows by data and holds no literals of its own.
import type { IdGrid } from './loaderNeeds.js';

/** A cited spec row. */
export interface ProgressRow {
  readonly id: string;
  readonly source: string;
}

/** §4.1 rect and messages. RECT1: every message forces the control rect to 14 rows. */
export const PROGRESS_RECT = {
  RECT1: { id: 'RECT1', height: 14, source: 'CDEF 5 0x15a..0x188' },
  RECT2: { id: 'RECT2', source: 'CDEF 5 0x176..0x188' },
} as const;

/** §1.2 message numbers the driver answers. */
export const PROGRESS_MESSAGE = {
  draw: 0, test: 1, calcCRgns: 2, init: 3, dispose: 4, calcCntlRgn: 10, calcThumbRgn: 11,
  idle: 18, getFeatures: 19, setData: 20, getData: 21, newMessages: 27,
  source: 'CDEF 5 0x13c..0x30e',
} as const;
export const PROGRESS_MSG = {
  MSG1: { id: 'MSG1', source: 'CDEF 5 0x18e..0x194, 0x2fc' },
  MSG2: { id: 'MSG2', source: 'CDEF 5 0x13c..0x30a' },
  /** Message 27: `' ok '` (new-message support). */
  ok: { id: 'msg-27', result: ' ok ', source: 'CDEF 5 0x292' },
  /** Message 4: frees the private record when there is one. */
  dispose: { id: 'msg-4', source: 'CDEF 5 0x280..0x290' },
} as const;

/** §1.2 message 19: Apple kControlWantsIdle (8) + kControlSupportsDataAccess (64). */
export const PROGRESS_FEATURES = { wantsIdle: 8, supportsDataAccess: 64, source: 'CDEF 5 0x29a' } as const;

/** §2 hilite values the state rows read. */
export const PROGRESS_HILITE = { inactive: 254, disabled: 255, source: 'CDEF 5 0x376..0x3a6' } as const;

export interface ProgressStateRow {
  readonly id: string;
  readonly state: 'normal' | 'pressed' | 'inactive' | 'disabled';
  readonly hilite: number;
  readonly source: string;
}
/** §2 "Scriptoscope mapping": a progress bar has no pressed art (pressed = hilite 0). */
export const PROGRESS_STATE: readonly ProgressStateRow[] = [
  { id: 'state-normal', state: 'normal', hilite: 0, source: 'progress §2 mapping' },
  { id: 'state-pressed', state: 'pressed', hilite: 0, source: 'progress §2 mapping (no pressed art; 1..253 draw as 0)' },
  { id: 'state-inactive', state: 'inactive', hilite: PROGRESS_HILITE.inactive, source: 'progress §2 mapping' },
  { id: 'state-disabled', state: 'disabled', hilite: PROGRESS_HILITE.disabled, source: 'progress §2 mapping (same pixels as inactive)' },
];

/** §4.2 visibility and device passes. */
export const PROGRESS_DRAW = {
  DRAW1: { id: 'DRAW1', source: 'CDEF 5 0x226..0x240' },
  DRAW2: { id: 'DRAW2', source: 'CDEF 5 0x7fc..0x882' },
  DRAW3: { id: 'DRAW3', source: 'CDEF 5 0x96c..0x97c' },
  DRAW4: { id: 'DRAW4', source: 'CDEF 5 0x83a..0x86a, 0x93a..0x96a, 0xa3c..0xaa0' },
  DRAW5: { id: 'DRAW5', source: 'CDEF 5 0x824..0x938, 0x97e..0x9b4, 0xa04..0xa24' },
} as const;

/**
 * Declared defaults (progress §2, modern policy): one device at depth ≥ 8
 * (`lowDepth` clear), Colour QuickDraw, a colour port, not recording, no custom
 * bottlenecks, pen visible, `visible` true, a wide-open clip, the port offscreen
 * (DRAW4, one direct pass), phase 0, chain = the archive's fork then its bases.
 */
export const PROGRESS_DECLARED_DEFAULTS = {
  lowDepth: false,
  colorPort: true,
  recording: false,
  customBottlenecks: false,
  penVisible: true,
  screenPort: false,
  source: 'progress §2 declared defaults; §6 items 4, 5',
} as const;

export interface ProgressDrawStepRow {
  readonly id: 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6';
  readonly source: string;
}
/** §3.3 draw order, one run per device pass. */
export const PROGRESS_DRAW_ORDER: readonly ProgressDrawStepRow[] = [
  { id: 'O1', source: 'CDEF 5 0x5f8..0x614, 0xcfc..0xd20, 0xb02..0xbbc' },
  { id: 'O2', source: 'CDEF 5 0x61a..0x61e, 0xc6a..0xcfa' },
  { id: 'O3', source: 'CDEF 5 0x624..0x626, 0xd60..0xd94' },
  { id: 'O4', source: 'CDEF 5 0x62c..0x638, 0x35a..0x5d0' },
  { id: 'O5', source: 'CDEF 5 0x64e..0x7d8' },
  { id: 'O6', source: 'CDEF 5 0x63a..0x648, 0x7da..0x7e8, 0xd22..0xd5e, 0xbbe..0xc68' },
];

/** §4.3 gate and state: `F` = −10077 when inactive, else −10080. */
export const PROGRESS_GATE = {
  activeFrame: -10080,
  inactiveFrame: -10077,
  GATE1: { id: 'GATE1', source: 'CDEF 5 0x376..0x3a2' },
  GATE1a: { id: 'GATE1a', source: 'CDEF 5 0x3a4..0x3a6, 0x3aa..0x3ba' },
  GATE2: { id: 'GATE2', source: 'CDEF 5 0x3bc..0x3c4' },
  GATE3: { id: 'GATE3', source: 'CDEF 5 0x3c6..0x3ec, 0x1f72..0x1fca, 0x2032..0x2046' },
  GATE4: { id: 'GATE4', source: 'CDEF 5 0x3ee..0x5c8' },
} as const;

/** §4.4 frame (cinf border, no body). `bytes`: Corner Size `k`/`c`, Side Thickness `s`, `tile`. */
export const PROGRESS_FRAME = {
  bytes: { corner: 0, side: 1, tile: 2 },
  pieces: ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right'] as const,
  FRAME1: { id: 'FRAME1', source: 'CDEF 5 0x1fd2..0x2078' },
  FRAME2: { id: 'FRAME2', source: 'CDEF 5 0x20a6..0x20ac, 0x273c..0x2740' },
  FRAME3: { id: 'FRAME3', source: 'CDEF 5 0x219c..0x251a' },
  FRAME4: { id: 'FRAME4', source: 'CDEF 5 0x21a8..0x2256, 0x22e8..0x23ae' },
  FRAME5: { id: 'FRAME5', source: 'CDEF 5 0x2296..0x229c, 0x23f0..0x23f6, 0x2466..0x246c, 0x24dc..0x24e2' },
  FRAME6: { id: 'FRAME6', source: 'CDEF 5 0x2264..0x22d2, 0x23be..0x242c, 0x2434..0x24a2, 0x24a6..0x2518' },
  FRAME7: { id: 'FRAME7', source: 'CDEF 5 0x219c..0x21a4, 0x225a..0x2262, 0x22da..0x22e4, 0x23b2..0x23bc' },
  FRAME8: { id: 'FRAME8', source: 'CDEF 5 0x2530..0x2534' },
} as const;

/** §4.5 inner rect: inset by `k` when `k > minInset`, else by `minInset`, horizontally; `s` vertically. */
export const PROGRESS_INSET = {
  minInset: 2,
  INSET1: { id: 'INSET1', source: 'CDEF 5 0x3fc..0x41c' },
  INSET2: { id: 'INSET2', source: 'CDEF 5 0x41e..0x430' },
} as const;

/** §4.6 determinate: fill art `F + 1`, track art `F + 2`. */
export const PROGRESS_DET = {
  fillOffset: 1,
  trackOffset: 2,
  DET1: { id: 'DET1', source: 'CDEF 5 0x532..0x5c4' },
  DET2: { id: 'DET2', source: 'CDEF 5 0x55e..0x562' },
  DET3: { id: 'DET3', source: 'CDEF 5 0x570..0x580, 0x5a0..0x5b0' },
  DET4: { id: 'DET4', source: 'CDEF 5 0x1e12..0x1e20' },
} as const;

/** §5.3: values are sign-extended 16-bit; results are stored as 16-bit coordinates. */
export const PROGRESS_WORD = { bits: 16, source: 'progress §5.3; header: results stored as 16-bit coordinates' } as const;

/** §4.7 indeterminate: `F_p` by state, probe `F_p + 1`, frames `F_p .. F_p + 7`, shift 4 px per phase. */
export const PROGRESS_IND = {
  activePattern: -10080,
  inactivePattern: -10072,
  probeOffset: 1,
  frames: 8,
  shiftStep: 4,
  IND1: { id: 'IND1', source: 'CDEF 5 0x43c..0x45e' },
  IND2: { id: 'IND2', source: 'CDEF 5 0x460..0x4be' },
  IND3: { id: 'IND3', source: 'CDEF 5 0x464..0x46a, 0x490..0x4be' },
  IND4: { id: 'IND4', source: 'CDEF 5 0x4c0..0x4e2' },
  IND5: { id: 'IND5', source: 'CDEF 5 0x4e6..0x52e' },
  IND6: { id: 'IND6', source: 'CDEF 5 0x4c2, 0x500' },
  IND7: { id: 'IND7', source: 'CDEF 5 0x432..0x438' },
} as const;

/** §4.8 fill and track slicing. `bytes`: cap `a`, middle (0 = one column), anchor (0 = start). */
export const PROGRESS_SLICE = {
  bytes: { cap: 0, middle: 2, anchor: 3 },
  SLICE1: { id: 'SLICE1', source: 'CDEF 5 0x1d7e..0x1dbe' },
  SLICE2: { id: 'SLICE2', source: 'CDEF 5 0x1dd2..0x1e0e' },
  SLICE3: { id: 'SLICE3', source: 'CDEF 5 0x1e12..0x1ea6' },
  SLICE4: { id: 'SLICE4', source: 'CDEF 5 0x1eaa..0x1efa' },
  SLICE5: { id: 'SLICE5', source: 'CDEF 5 0x1f12..0x1f24' },
  SLICE6: { id: 'SLICE6', source: 'CDEF 5 0x1efe..0x1f0e' },
  SLICE7: { id: 'SLICE7', source: 'CDEF 5 0x1f28..0x1f52, 0x1516..0x1548' },
} as const;

/** A 16-bit QuickDraw RGB triple. */
export type Rgb16 = readonly [number, number, number];

/** §4.13 COL3 fixed colours (16-bit QuickDraw RGB). */
export const PROGRESS_COLOURS = {
  darkGrey: [0x4445, 0x4444, 0x4444] as Rgb16,
  lavender: [0xCCCC, 0xCCCC, 0xFFFF] as Rgb16,
  black: [0, 0, 0] as Rgb16,
  white: [0xFFFF, 0xFFFF, 0xFFFF] as Rgb16,
  source: 'CDEF 5 0x7b0..0x7d2, 0x722..0x726, 0xe04..0xe34, 0xc6a..0xcf4',
} as const;

/** §4.9 procedural bar: `cicn −10224` colour samples, `ppat −10064` pattern. */
export const PROGRESS_FALLBACK = {
  cicn: -10224,
  ppat: -10064,
  /** FB1 bottom/right lines, FB2 left/top lines, FB3 frame-rect colour. */
  samples: { bottomRight: { x: 11, y: 13 }, topLeft: { x: 0, y: 0 }, frame: { x: 1, y: 1 } },
  /** FB5 FrameRect inset; FB6 `I_f` inset. */
  frameInset: 1,
  innerInset: 2,
  FB1: { id: 'FB1', source: 'CDEF 5 0x64e..0x692' },
  FB2: { id: 'FB2', source: 'CDEF 5 0x6a6..0x6d4' },
  FB3: { id: 'FB3', source: 'CDEF 5 0x6d6..0x6e6' },
  FB4: { id: 'FB4', source: 'CDEF 5 0x65e' },
  FB5: { id: 'FB5', source: 'CDEF 5 0x6ec..0x6fc' },
  FB6: { id: 'FB6', source: 'CDEF 5 0x6fe..0x708' },
  FB7: { id: 'FB7', source: 'CDEF 5 0x75e..0x7d8' },
  FB8: { id: 'FB8', source: 'CDEF 5 0x712..0x75c' },
  FB9: { id: 'FB9', source: 'CDEF 5 0x71e..0x72e' },
  FB10: { id: 'FB10', source: 'CDEF 5 0x64e..0x7d8' },
} as const;

/** §4.10 idle and phase: advance when TickCount ≥ idle time + 3 (unsigned); the phase is a byte. */
export const PROGRESS_IDLE = {
  ticks: 3,
  phaseModulo: 256,
  IDLE1: { id: 'IDLE1', source: 'CDEF 5 0x25e..0x27e' },
  IDLE2: { id: 'IDLE2', source: 'CDEF 5 0x1d8..0x224' },
  IDLE3: { id: 'IDLE3', source: 'CDEF 5 0x1e2, 0x1fa, 0x226..0x240' },
  IDLE4: { id: 'IDLE4', source: 'CDEF 5 0x2d4..0x2f4' },
} as const;

/** §4.11 blits (transfer modes). */
export const PROGRESS_BLIT = {
  BLIT1: { id: 'BLIT1', source: 'CDEF 5 0x1a1e..0x1a2e, 0x18f6..0x194a' },
  BLIT2: { id: 'BLIT2', source: 'CDEF 5 0x19ba..0x19d0, 0x16ea..0x170a' },
  BLIT3: { id: 'BLIT3', source: 'CDEF 5 0x15de..0x1654' },
  BLIT4: { id: 'BLIT4', source: 'CDEF 5 0x1658..0x16b8' },
  BLIT5: { id: 'BLIT5', source: 'CDEF 5 0x16bc..0x18c4' },
  BLIT6: { id: 'BLIT6', source: 'CDEF 5 0x1714..0x1800, 0x1800..0x18c2' },
  BLIT7: { id: 'BLIT7', source: 'CDEF 5 0x19da..0x1a1c, 0x1790..0x17ac, 0x185c..0x1878' },
  BLIT8: { id: 'BLIT8', source: 'CDEF 5 0x1562..0x15ca, 0x198e..0x19a0' },
} as const;

/** §4.12 erase and background. */
export const PROGRESS_ERASE = {
  ERASE1: { id: 'ERASE1', source: 'CDEF 5 0x5d2..0x7f0, 0x2530..0x2534' },
  ERASE2: { id: 'ERASE2', source: 'CDEF 5 0x35a..0x5d0, 0x64e..0x7d8' },
  ERASE3: { id: 'ERASE3', source: 'CDEF 5 0x5d2..0x7f0' },
  ERASE4: { id: 'ERASE4', source: 'CDEF 5 0xf56..0x1048, 0xea6..0xf54, 0x7b0..0x7d8' },
} as const;

/** §4.13 colour lookups. */
export const PROGRESS_COL = {
  COL1: { id: 'COL1', source: 'CDEF 5 0x129c..0x1460, 0x10c4..0x129a, 0x1d08..0x1d7c' },
  COL1a: { id: 'COL1a', source: 'CDEF 5 0x12f2..0x137a, 0x112c..0x11b4' },
  COL1b: { id: 'COL1b', source: 'CDEF 5 0x12b4..0x12f0, 0x137e..0x1392' },
  /** COL1c: a 16- or 32-bit pixel map is not handled (colour undefined). */
  COL1c: { id: 'COL1c', directDepths: [16, 32] as readonly number[], source: 'CDEF 5 0x1394..0x13ac, 0x11ce..0x11e6' },
  COL2: { id: 'COL2', source: 'CDEF 5 0x108a..0x10c2' },
  COL3: { id: 'COL3', source: PROGRESS_COLOURS.source },
  COL4: { id: 'COL4', source: 'CDEF 5 0x7b0..0x7d2' },
} as const;

/** §4.14 resource chain and payloads. */
export const PROGRESS_CHAIN = {
  CHAIN1: { id: 'CHAIN1', source: 'CDEF 5 0x1aa8..0x1ae8, 0x1cdc..0x1cde, 0x1fec..0x200a, 0x203c..0x203e' },
  CHAIN2: { id: 'CHAIN2', source: 'CDEF 5 0x2e84..0x2ff0, 0x43c..0x4fa, 0x712..0x718' },
  CHAIN3: { id: 'CHAIN3', source: 'CDEF 5 0x1aa8..0x1ae8' },
} as const;
export const PROGRESS_CINF = {
  CINF1: { id: 'CINF1', source: 'CDEF 5 0x2e84..0x2ec8' },
  CINF2: { id: 'CINF2', source: 'CDEF 5 0x3fc..0x42e, 0x207c..0x2086, 0x2290, 0x1dc2..0x1dc6, 0x1f14, 0x1f3e' },
  CINF3: { id: 'CINF3', source: 'CDEF 5 0x2e84..0x2ec8' },
} as const;

/** §4.15 hit test, regions and data access. */
export const PROGRESS_HIT = {
  HIT1: { id: 'HIT1', part: 0, source: 'CDEF 5 0x244..0x246' },
  HIT2: { id: 'HIT2', source: 'CDEF 5 0x24a..0x25a' },
} as const;
export const PROGRESS_DATA = {
  /** Apple kControlProgressBarIndeterminateTag. */
  tag: 'inde',
  /** Apple errDataNotSupported. */
  errDataNotSupported: -30581,
  DATA1: { id: 'DATA1', source: 'CDEF 5 0x2d4..0x2f4' },
  DATA2: { id: 'DATA2', source: 'CDEF 5 0x29e..0x2ca' },
  DATA3: { id: 'DATA3', source: 'CDEF 5 0x2cc..0x2d2, 0x2f6' },
  DATA4: { id: 'DATA4', source: 'CDEF 5 0x25e..0x27e' },
} as const;

/** §5.5 pattern phase rows. */
export const PROGRESS_PAT = {
  PAT1: { id: 'PAT1', source: 'CDEF 5 0xf32..0xf36' },
  PAT2: { id: 'PAT2', source: 'CDEF 5 0xefc..0xf30' },
  PAT3: { id: 'PAT3', source: 'CDEF 5 0xed4..0xefa, 0xf38..0xf42' },
} as const;

/**
 * Every progress id the tables can request: frame `F`, fill `F + 1` and track
 * `F + 2` for both frames (cicn and cinf), the pattern frames `F_p .. F_p + 7`
 * for both pattern bases (ppat), and the procedural bar's `cicn −10224` and
 * `ppat −10064`. Used to preload the chain and, via tables/loaderNeeds.ts, as
 * the cinf ids the loader keeps raw bytes for.
 */
export const PROGRESS_IDS: { readonly art: IdGrid; readonly patterns: IdGrid; readonly source: string } = {
  art: { bases: [PROGRESS_GATE.activeFrame, PROGRESS_GATE.inactiveFrame], terms: [[0, PROGRESS_DET.fillOffset, PROGRESS_DET.trackOffset]] },
  patterns: { bases: [PROGRESS_IND.activePattern, PROGRESS_IND.inactivePattern], terms: [Array.from({ length: PROGRESS_IND.frames }, (_, i) => i)] },
  source: 'GATE1–GATE4, DET1, SLICE1, IND1–IND5, FB1, FB8',
};

/**
 * Public value mapping for the `composeProgress` facade (DECISIONS #10, modern
 * policy, not a decoded rule): the normalized 0..1 `value` is clamped and becomes
 * the native value with `min = 0`, `max = 10000`, `value = trunc(v × 10000)`.
 */
export const PROGRESS_FACADE_RANGE = { min: 0, max: 10000, source: 'DECISIONS #10; progress §2 mapping' } as const;

/** Facade length (modern policy; CDEF 5 has no minimum): at least 16, default 160 (progress §8). */
export const PROGRESS_FACADE_LENGTH = { min: 16, default: 160, source: 'progress §8 (declared facade default)' } as const;

/** Facade default value (compatibility, the previous normalized default). */
export const PROGRESS_FACADE_VALUE = { default: 0.5, source: 'compatibility default of the normalized facade' } as const;

/** 16-bit signed range of control values (progress §2 inputs). */
export const PROGRESS_VALUE_DOMAIN = { min: -32768, max: 32767, source: 'progress §2 inputs (16-bit control values)' } as const;

/** Interactive idle helper's TickCount (modern policy): 60 ticks per second (Inside Macintosh: TickCount). */
export const PROGRESS_FACADE_TICKS = { perSecond: 60, source: 'DECISIONS #11; Inside Macintosh TickCount (about 60 per second)' } as const;
