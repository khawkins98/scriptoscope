// docs/spec/engine/scrollbar.md — the scroll-bar CDEF (`scrollbar.draw`, plus
// the state, region and hit-test facts it depends on). Data only: one exported
// row per spec decision-table row, carrying the spec row id and the spec's
// `source` citation. The driver (src/engine/families/scrollbar.ts) selects rows
// by data and holds no literals of its own.
//
// AC5 follows the 2026-10-22 wording of PR #392 (icon blit, opaque above 1 bit).

/** §2 "Derived state": hilite values and ranges read by the state rows. */
export const SCROLLBAR_HILITE = {
  /** ST1 / TR1: hilite 254 is inactive (and disabled). */
  inactive: 254,
  /** ST2 / ST3: hilite 255. */
  disabled: 255,
  /** ST1–ST3: hilite ≥ 254 is disabled. */
  disabledFrom: 254,
  /** ST5: hilite in 1..253 is pressed. */
  pressedFrom: 1,
  pressedTo: 253,
  source: '0x9f7a..0x9fd6, 0xada2..0xadfc, 0xa01c..0xa030',
} as const;

export interface ScrollbarStateRow {
  readonly id: 'ST1' | 'ST2' | 'ST3' | 'ST4' | 'ST5' | 'ST6';
  readonly inactive: boolean;
  readonly disabled: boolean;
  readonly pressed: boolean;
  readonly source: string;
}
/** §4.1 State. Selection logic is in the driver (`scrollbarState`); each row's outputs are here. */
export const SCROLLBAR_STATE: readonly ScrollbarStateRow[] = [
  { id: 'ST1', inactive: true, disabled: true, pressed: false, source: '0x9f82, 0xadb2' },
  { id: 'ST2', inactive: true, disabled: true, pressed: false, source: '0x9f94..0x9fd6, 0xadb2' },
  { id: 'ST3', inactive: false, disabled: true, pressed: false, source: '0xadb2' },
  { id: 'ST4', inactive: false, disabled: true, pressed: false, source: '0xadbe..0xadf0' },
  { id: 'ST5', inactive: false, disabled: false, pressed: true, source: '0xa01c..0xa030' },
  { id: 'ST6', inactive: false, disabled: false, pressed: false, source: '0xa01c..0xa030' },
];

/** §2 derived state: option bytes of the Gestalt('Acid') block and the rows reading them. */
export const SCROLLBAR_OPTION_BYTES = {
  thumbSlice: 27, wholeTrack: 31, pressedHalves: 32, double: 33, proportional: 34, pressedSideOnly: 36,
  source: '0x9db8..0x9e1e',
} as const;
/** `double`: along length of R at least this many thicknesses (§2, `0x9e7e..0x9eb8`). */
export const SCROLLBAR_DOUBLE_MIN_THICKNESSES = { factor: 8, source: '0x9dfa, 0x9e7e..0x9eb8' } as const;

/** Declared defaults (§2 "Scriptoscope mapping and declared defaults"; modern policy). */
export const SCROLLBAR_DECLARED_DEFAULTS = {
  appearancePresent: true,
  finderWindow: false,
  smartScroll: false,
  atiPresent: false,
  lowDepth: false,
  colorPort: true,
  recordingPicture: false,
  customBottlenecks: false,
  source: 'scrollbar §2 declared defaults (modern policy, not original observations); qd-primitives §2',
} as const;

/** §4.2 track cicn base id by orientation. */
export const SCROLLBAR_TRACK_BASE = { horizontal: -8288, vertical: -8280, source: '0xa032..0xa03e' } as const;

export interface ScrollbarTierRow {
  readonly id: 'TR1' | 'TR2' | 'TR3' | 'TR4';
  readonly when: 'inactive' | 'disabled' | 'pressed' | 'otherwise';
  readonly tier: number;
  readonly source: string;
}
/** §4.2 TR1–TR4, first matching row wins. */
export const SCROLLBAR_TIER: readonly ScrollbarTierRow[] = [
  { id: 'TR1', when: 'inactive', tier: 0, source: '0xa042..0xa048' },
  { id: 'TR2', when: 'disabled', tier: 1, source: '0xa04c..0xa052' },
  { id: 'TR3', when: 'pressed', tier: 3, source: '0xa056..0xa05a' },
  { id: 'TR4', when: 'otherwise', tier: 2, source: '0xa05e' },
];

/** §4.2 TR5–TR10: the track probe ladder. */
export const SCROLLBAR_TRACK_PROBE = {
  TR5: { source: '0xa06c..0xa070' },
  /** `t ≤ small` selects the small-art probes. */
  small: { maxThickness: 11, source: '0xa074, 0xa0ae' },
  TR6: { offset: 22, source: '0xa074..0xa0a8' },
  TR7: { offset: 18, source: '0xa0ae..0xa0c2' },
  TR8: { offset: 4, source: '0xa0cc..0xa0f8' },
  TR9: { offset: 0, source: '0xa0fe..0xa10e' },
  TR10: { source: '0xa0cc..0xa112' },
} as const;

/** §4.3 TP1–TP4: the track pattern ladder. */
export const SCROLLBAR_PATTERN_PROBE = {
  TP1: { source: '0xa112..0xa11a' },
  TP2: { offset: -4, source: '0xa11e..0xa136' },
  TP3: { source: '0xa13a..0xa14a' },
  TP4: { source: '0xa13a..0xa14a' },
} as const;

/** §4.4 CF1/CF2: composite when the track cicn's width or height exceeds this. */
export const SCROLLBAR_COMPOSITE = {
  CF1: { boundsAbove: 16, source: '0xa14e..0xa184' },
  CF2: { source: '0xa14e..0xa158' },
} as const;

/** §4.5 arrow index meaning: low arrows are left/up, high arrows right/down. */
export interface ScrollbarArrowRow {
  readonly index: 0 | 1 | 2 | 3;
  readonly end: 'low' | 'high';
  readonly arrow: 'low' | 'high';
}
export const SCROLLBAR_ARROWS: readonly ScrollbarArrowRow[] = [
  { index: 0, end: 'low', arrow: 'low' },
  { index: 1, end: 'low', arrow: 'high' },
  { index: 2, end: 'high', arrow: 'low' },
  { index: 3, end: 'high', arrow: 'high' },
];

export interface ScrollbarDrawStepRow {
  readonly id: 'AD1' | 'AD2' | 'AD3' | 'TH' | 'TF';
  readonly arrow?: 0 | 1 | 2 | 3;
  readonly onlyDouble: boolean;
  readonly source: string;
}
/** §3 draw order (AD1–AD3, then thumb and track). */
export const SCROLLBAR_DRAW_ORDER: readonly ScrollbarDrawStepRow[] = [
  { id: 'AD1', arrow: 0, onlyDouble: false, source: '0xa47c..0xa496' },
  { id: 'AD2', arrow: 2, onlyDouble: true, source: '0xa49a..0xa4b4' },
  { id: 'AD3', arrow: 3, onlyDouble: false, source: '0xa4b8..0xa4c0' },
  { id: 'AD2', arrow: 1, onlyDouble: true, source: '0xa4c6..0xa4de' },
  { id: 'TH', onlyDouble: false, source: '0xaed6..0xafbe' },
  { id: 'TF', onlyDouble: false, source: '0xafc2..0xb004' },
];
export const SCROLLBAR_AD4 = { id: 'AD4', source: '0xc34a' } as const;

export interface ScrollbarHitArrowRow {
  readonly id: 'AH1' | 'AH2';
  readonly hilite: number;
  readonly arrows: readonly number[];
  readonly source: string;
}
/** §4.5 AH1–AH3. */
export const SCROLLBAR_HIT_ARROWS: readonly ScrollbarHitArrowRow[] = [
  { id: 'AH1', hilite: 20, arrows: [0, 2], source: '0xc3a0..0xc3ae, 0xc764..0xc77e' },
  { id: 'AH2', hilite: 21, arrows: [1, 3], source: '0xc3b0..0xc3c0, 0xc782..0xc790' },
];
export const SCROLLBAR_AH3 = { id: 'AH3', source: '0xc3c2' } as const;

/** §4.5 AC1–AC5: composite arrow cells. */
export const SCROLLBAR_COMPOSITE_ARROW = {
  AC1: { source: '0xc37e..0xc402' },
  AC2: { offset: -1, source: '0xc3cc..0xc3fe' },
  AC3: { source: '0xc37e..0xc382' },
  AC4: { source: '0xc6e4..0xc730, 0xf68c, 0xf87e' },
  AC5: { source: '0xc736..0xc746, 0xfdf8' },
} as const;

export interface ScrollbarIconRow {
  readonly id: 'AI1' | 'AI2' | 'AI3';
  readonly when: 'raised' | 'hit' | 'disabled';
  /** Icon id by arrow (low/high) and orientation. */
  readonly ids: { readonly low: { readonly horizontal: number; readonly vertical: number }; readonly high: { readonly horizontal: number; readonly vertical: number } };
  readonly source: string;
}
/** §4.5 AI1–AI3, first matching row: disabled, then hit, then raised. */
export const SCROLLBAR_ICONS: readonly ScrollbarIconRow[] = [
  { id: 'AI3', when: 'disabled', ids: { low: { horizontal: -10206, vertical: -10208 }, high: { horizontal: -10205, vertical: -10207 } }, source: '0xc7ba..0xc7fa' },
  { id: 'AI2', when: 'hit', ids: { low: { horizontal: -10198, vertical: -10200 }, high: { horizontal: -10197, vertical: -10199 } }, source: '0x9f0e..0x9f38, 0xc792..0xc7b6' },
  { id: 'AI1', when: 'raised', ids: { low: { horizontal: -10202, vertical: -10204 }, high: { horizontal: -10201, vertical: -10203 } }, source: '0x9f0e..0x9f38, 0xc792..0xc7b6' },
];
/** §4.5 AI4: `ics#` then `ics8` from the same file. */
export const SCROLLBAR_ICON_DRAW = {
  id: 'AI4', maskType: 'ics#', colorType: 'ics8',
  /** A 16 × 16 `ics#` holds a 32-byte image and a 32-byte mask (Inside Macintosh: More Macintosh Toolbox, "Icon Families"). */
  maskRecordBytes: 64,
  source: '0xc7fe..0xc81e, 0xf4ba..0xf684',
} as const;

export interface ScrollbarThumbIdRow {
  readonly id: 'TH3' | 'TH4';
  /** Hilite this row needs; `'*'` = any other. */
  readonly hilite: number | '*';
  readonly horizontal: number;
  readonly vertical: number;
  readonly source: string;
}
/** §4.6 TH3/TH4 thumb ids. */
export const SCROLLBAR_THUMB_ID: readonly ScrollbarThumbIdRow[] = [
  { id: 'TH3', hilite: 129, horizontal: -10205, vertical: -10207, source: '0xaf24..0xaf42' },
  { id: 'TH4', hilite: '*', horizontal: -10206, vertical: -10208, source: '0xaf44..0xaf54' },
];
/** §4.6 TH1, TH2, TH5–TH7 and §5.6 thumb-length constants. */
export const SCROLLBAR_THUMB = {
  TH1: { source: '0xaee2..0xaf04' },
  TH2: { source: '0xa988..0xa99e, 0xaf08..0xaf20' },
  TH5: { maxThickness: 11, smallOffset: 1956, source: '0xaf56..0xaf82' },
  TH6: { source: '0xaf84..0xaf86' },
  TH7: { source: '0xaf88..0xafbe, 0xb44c' },
  /** §5.6: `minLen` = thumb along size, or `t + 1` without a thumb; minus 5 at `t ≤ 11` without the small thumb. */
  length: { noThumbExtra: 1, smallMissingTrim: 5, source: '0xab68..0xad60, 0xab74..0xac16' },
} as const;

/** §4.7 TF1–TF9: track fill. */
export const SCROLLBAR_TRACK_FILL = {
  TF1: { source: '0xafc2..0xafda, 0xb078..0xb10e' },
  TF2: { lowPageHilite: 22, highPageHilite: 23, source: '0xafdc..0xaffa, 0xb18c..0xb306' },
  TF3: { offset: -1, source: '0xba3e..0xba6c' },
  TF4: { source: '0xba36..0xba3a' },
  TF5: { source: '0xba1e..0xba30' },
  TF6: { source: '0xbb16..0xbb26' },
  TF7: { source: '0xbb28..0xbb44, 0xf930, 0xf7cc' },
  TF8: { sliceMode: 1, source: '0xbb48..0xbb74, 0xc2d2' },
  TF9: { source: '0xb080..0xb0fe, 0xc822..0xc848' },
  offscreen: { source: '0xba74..0xbbea' },
} as const;

export interface ScrollbarHitRow {
  readonly id: 'HT1' | 'HT2' | 'HT3' | 'HT4' | 'HT5' | 'HT6' | 'HT7' | 'HT8';
  /** What the row tests, in order. */
  readonly test: 'outside' | 'box' | 'thumb' | 'lowSide' | 'otherwise';
  readonly box?: 0 | 1 | 2 | 3;
  readonly onlyDouble?: boolean;
  readonly part: number;
  readonly source: string;
}
/** §4.8 HT1–HT8, tested in order. */
export const SCROLLBAR_HIT_TEST: readonly ScrollbarHitRow[] = [
  { id: 'HT1', test: 'outside', part: 0, source: '0xa512..0xa540' },
  { id: 'HT2', test: 'box', box: 0, part: 20, source: '0xa544..0xa576' },
  { id: 'HT3', test: 'box', box: 1, onlyDouble: true, part: 21, source: '0xa57a..0xa5a8' },
  { id: 'HT4', test: 'box', box: 2, onlyDouble: true, part: 20, source: '0xa5ac..0xa5e0' },
  { id: 'HT5', test: 'box', box: 3, part: 21, source: '0xa5e4..0xa60c' },
  { id: 'HT6', test: 'thumb', part: 129, source: '0xa60e..0xa62c' },
  { id: 'HT7', test: 'lowSide', part: 22, source: '0xa62e..0xa66c' },
  { id: 'HT8', test: 'otherwise', part: 23, source: '0xa62e..0xa66c' },
];

/** §5 geometry sources. */
export const SCROLLBAR_GEOMETRY = {
  track: { source: '0xbbf4..0xbc90' },
  boxes: { source: '0xa8c6..0xa97a' },
  cells: { source: '0xc402..0xc6e0' },
  trackSource: { source: '0xc2d2..0xc336' },
  thumbLength: { source: '0xab68..0xad60' },
  thumbRect: { source: '0xa97c..0xab66' },
  segments: { source: '0xb18c..0xb306' },
  slice: { source: '0xb44c..0xba0c', lineSource: '0xb362..0xb432', thumbRegion: '0xb332..0xb360' },
  /** §5.9 caps: cap `k = 3` for mode 0. */
  caps: { modeZeroCap: 3 },
} as const;

/**
 * Public value mapping for the `composeScrollbar` facade (modern policy, not a
 * decoded rule): the public 0..1 `value` becomes the native 16-bit value field
 * with `min = 0` and `max = 32767` (scrollbar §2 value domain, the 16-bit range).
 */
export const SCROLLBAR_FACADE_RANGE = { min: 0, max: 32767, source: 'modern policy; scrollbar §2 inputs (16-bit value fields)' } as const;

/**
 * Facade bar thickness (modern policy): Apple's standard scroll bar is 16 pixels
 * wide (Inside Macintosh: Macintosh Toolbox Essentials, "Scroll Bars"). The
 * public API has no thickness option; the native control rect sets `t`.
 */
export const SCROLLBAR_FACADE_THICKNESS = { thickness: 16, source: 'Inside Macintosh: Macintosh Toolbox Essentials, scroll bars 16 px (modern policy for the facade)' } as const;
