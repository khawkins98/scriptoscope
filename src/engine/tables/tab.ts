// docs/spec/engine/tab.md. Original CDEF 8 citations and modern facade policy
// are deliberately separate; neither claims native typography/device parity.
export const TAB_STATE = [
  { id: 'ST1', hilites: [254, 255], state: 0, source: 'CDEF 8 0xcc2..0xce0' },
  { id: 'ST2', state: 1, source: 'CDEF 8 0xcc2..0xce0' },
  { id: 'ST3', enabled: false, state: 0, source: 'CDEF 8 0xdb4..0xdc4' },
  { id: 'ST4', inside: 2, outside: 1, source: 'CDEF 8 0x117a..0x11a8' },
  { id: 'ST5', selectedOffset: 3, source: 'CDEF 8 0x8d2..0x8dc' },
] as const;
export const TAB_VARIANTS = [
  { id: 'V1', variant: 'small', first: -9976, retry: -9960, source: 'CDEF 8 0x8de..0x924' },
  { id: 'V2', variant: 'large', first: -9984, retry: -9968, source: 'CDEF 8 0x926..0x95a' },
] as const;
export const TAB_FACADE = [
  { id: 'F1', selected: false, ids: [-9975, -9983], source: 'tab.md §3.2 modern composeTab policy' },
  { id: 'F2', selected: true, ids: [-9972, -9980], source: 'tab.md §3.2 modern composeTab policy' },
] as const;
export const TAB_RESOLUTION = [
  { id: 'F3', policy: 'candidate-before-owner', source: 'tab.md §3.2 existing face resolver / base inheritance policy' },
  { id: 'F4', policy: 'first-absolute-id-match', source: 'tab.md §3.2 positive-ID-alias compatibility policy' },
  { id: 'F5', policy: 'missing-art-null', source: 'tab.md §3.2 control-panel art excluded' },
  { id: 'F6', policy: 'freeze-found-occurrence-no-retry', source: 'tab.md §3.2 modern facade boundary; CDEF 8 0x37e..0x38e, 0x622..0x62a' },
  { id: 'V3', policy: 'missing-same-id-cinf-no-paint', source: 'CDEF 8 0x37e..0x38e, 0x622..0x62a' },
] as const;
export const TAB_BODY = [
  { id: 'B1', piece: 'left', source: 'CDEF 8 0x430..0x450' },
  { id: 'B2', piece: 'right', source: 'CDEF 8 0x456..0x47e' },
  { id: 'B3', piece: 'top', source: 'CDEF 8 0x484..0x4e2' },
  { id: 'B4', piece: 'bottom', source: 'CDEF 8 0x4e8..0x552' },
  { id: 'B5', piece: 'centre', source: 'CDEF 8 0x558..0x600' },
  { id: 'B6', piece: 'returned-bottom', source: 'CDEF 8 0x614..0x61e' },
  { id: 'B7', piece: 'empty-skip', source: 'CDEF 8 0x1e94..0x1eb8' },
  { id: 'B8', piece: 'leading-partial-repeat', source: 'CDEF 8 0x2046..0x20aa, 0x20e0..0x20f8' },
] as const;
export const TAB_SAMPLING = [
  { id: 'C1', source: 'CDEF 8 0x1f10..0x1f86, 0x197c..0x19ba, 0x19f6..0x1bc4' },
  { id: 'C2', source: 'CDEF 8 0x2046..0x20f8, 0x2228..0x2360' },
  { id: 'C3', source: 'CDEF 8 0x1bce..0x1d92' },
  { id: 'C4', source: 'CDEF 8 0x1cb0..0x1d80' },
  { id: 'C5', source: 'CDEF 8 0x2678..0x26ec' },
] as const;
export const TAB_PATTERN = [
  { id: 'P1', source: 'CDEF 8 0x402..0x418, 0x596..0x600' },
  { id: 'P2', source: 'CDEF 8 0x40a..0x418, 0x596..0x600, 0x23a0..0x23d8' },
  { id: 'P3', source: 'CDEF 8 0x59e..0x5f4, 0x17d8..0x1886' },
] as const;
export const TAB_PHASE = [
  { id: 'P4', mode: 1, x: 'left', y: 'top', source: 'CDEF 8 0x59e..0x5e0, 0x1888..0x197a' },
  { id: 'P4', mode: 2, x: 'right', y: 'top', source: 'CDEF 8 0x59e..0x5e0, 0x1888..0x197a' },
  { id: 'P4', mode: 3, x: 'left', y: 'bottom', source: 'CDEF 8 0x59e..0x5e0, 0x1888..0x197a' },
  { id: 'P4', mode: 4, x: 'right', y: 'bottom', source: 'CDEF 8 0x59e..0x5e0, 0x1888..0x197a' },
  { id: 'P4', mode: '*', x: 'zero', y: 'zero', source: 'CDEF 8 0x59e..0x5e0, 0x1888..0x197a' },
] as const;
export const TAB_ADMISSION = ['missing-art', 'empty-art', 'no-cinf-no-paint', 'unsupported-metadata',
  'unsupported-sampling', 'unsupported-pattern', 'admitted'] as const;
/** tab.md §2 domain and §5 facade label policy. */
export const TAB_DOMAIN = { min: -32768, max: 32767, opaque: 255, channels: 4, rgb16Max: 65535,
  source: 'tab.md §2 signed QuickDraw domain; §4.1 raw RGB16/binary mask' } as const;
export const TAB_LABEL = { minimumSize: 8, heightFactor: 0.42, padding: 6,
  luminance: [0.299, 0.587, 0.114], threshold: 128, light: '#ffffff', dark: '#000000',
  source: 'tab.md §5 modern label and dimensions' } as const;
