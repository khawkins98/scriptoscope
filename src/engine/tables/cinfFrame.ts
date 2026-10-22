// docs/spec/engine/qd-primitives.md §3 "cinf body + border" and §4 tables
// B, P and "Border bands"; docs/spec/cinf-lookup-contract.md (request order).

/** The cinf request and its single retry (§3 "Resource requests", item 1). */
export const CINF_REQUEST = { id: 'cinf-request', type: 'cinf', source: '0x10860..0x10878' } as const;

export interface CinfRetryRow {
  readonly id: string;
  readonly bodyFill: boolean;
  /** The one retry id after a NULL. A second NULL skips the stage. */
  readonly retryId: number;
  readonly source: string;
}
export const CINF_RETRY: readonly CinfRetryRow[] = [
  { id: 'cinf-retry-face', bodyFill: true, retryId: 0, source: '0x10880..0x10898' },
  { id: 'cinf-retry-ring', bodyFill: false, retryId: 1, source: '0x10880..0x10898' },
];
export const CINF_SKIP = { id: 'cinf-skip', source: '0x1089a → 0x10fa8' } as const;

export interface CinfBodyRow {
  readonly id: 'B1' | 'B4';
  /** Body mode this row covers; `'*'` = every other mode. */
  readonly mode: number | '*';
  readonly type: 'cicn' | 'ppat';
  /** Row taken when the body resource is found / absent. */
  readonly found: 'B2' | 'B5';
  readonly absent: 'B3' | 'B6';
  readonly source: string;
}
export const CINF_BODY_SKIP = { id: 'B0', source: '0x109aa..0x109ae → 0x10bc0' } as const;
export const CINF_BODY: readonly CinfBodyRow[] = [
  { id: 'B1', mode: 5, type: 'cicn', found: 'B2', absent: 'B3', source: '0x109be, 0x109c8..0x109d0' },
  { id: 'B4', mode: '*', type: 'ppat', found: 'B5', absent: 'B6', source: '0x109c4 → 0x10a6c' },
];
export const CINF_BODY_SOURCES = {
  B2: '0x109da..0x10a1a', B3: '0x109d8 → 0x10a1e..0x10a66',
  B5: '0x10a96..0x10b5a', B6: '0x10a9a → 0x10b72..0x10bb8',
} as const;

export interface CinfPhaseRow {
  readonly id: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  readonly mode: number | '*';
  /** Which edge of `D` supplies the phase x / y; `'zero'` = 0. */
  readonly x: 'left' | 'right' | 'zero';
  readonly y: 'top' | 'bottom' | 'zero';
  readonly source: string;
}
export const CINF_PHASE: readonly CinfPhaseRow[] = [
  { id: 'P1', mode: 1, x: 'left', y: 'top', source: '0x10ac8' },
  { id: 'P2', mode: 2, x: 'right', y: 'top', source: '0x10ad2' },
  { id: 'P3', mode: 3, x: 'left', y: 'bottom', source: '0x10adc' },
  { id: 'P4', mode: 4, x: 'right', y: 'bottom', source: '0x10ae8' },
  { id: 'P5', mode: '*', x: 'zero', y: 'zero', source: '0x10af4' },
];

/** An emboss sample coordinate of (0,0) means absent (§3 "Sampled colours"). */
export const CINF_EMBOSS_ABSENT = { x: 0, y: 0, source: '0x1093e..0x10954' } as const;

/** Border draw order (§3): body first, then these eight pieces. */
export const CINF_BORDER_ORDER = {
  pieces: ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right'] as const,
  source: '0x10c18..0x10f82',
} as const;

export interface CinfEdgeRow {
  readonly id: 'E3' | 'E4';
  /** `tile` byte zero (E3) or nonzero (E4). */
  readonly tile: 'zero' | 'nonzero';
  readonly sampling: 'first-middle' | 'repeat-middle';
  readonly source: string;
}
export const CINF_EDGE: readonly CinfEdgeRow[] = [
  { id: 'E3', tile: 'zero', sampling: 'first-middle', source: '0x10cf0/0x10cf6, 0x10e4e/0x10e54, 0x10ec6/0x10ecc, 0x10f3e/0x10f44' },
  { id: 'E4', tile: 'nonzero', sampling: 'repeat-middle', source: '0x10cf0/0x10cf6, 0x10e4e/0x10e54, 0x10ec6/0x10ecc, 0x10f3e/0x10f44 → 0xfeae' },
];
