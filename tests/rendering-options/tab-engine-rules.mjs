// Independent acceptance literals frozen from engine/tab.md at author426d05c3.
// CDEF8 sha2564c9fecff…: B1–B8 (430..61e), C1 (1f10..1f86),
// P1–P4 (402..418,596..600,59e..5ea,1888..197a). No src imports.
// These finite synthetic pixels prove the declared modern raster subset only.
export const TAB_ENGINE_PALETTE = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((key, i) => [key, [7 + i * 8, 233 - i * 7, 31 + i * 5, 255]]));
export const TAB_ENGINE_INPUT = ['LABCDER', 'LMMMMMR', 'LMMMMMR', 'LMMMMMR', 'LFGHIJR'];
export const TAB_ENGINE_PATTERN = ['ABC', 'DEF'];
const top = 'LABCDEAR', bottom = 'LFGHIJFR';
export const TAB_ENGINE_PATTERN_ROWS = {
  0: [top, 'LEFDEFDR', 'LBCABCAR', 'LEFDEFDR', bottom],
  1: [top, 'LEFDEFDR', 'LBCABCAR', 'LEFDEFDR', bottom],
  2: [top, 'LFDEFDER', 'LCABCABR', 'LFDEFDER', bottom],
  3: [top, 'LBCABCAR', 'LEFDEFDR', 'LBCABCAR', bottom],
  4: [top, 'LCABCABR', 'LFDEFDER', 'LCABCABR', bottom],
  5: [top, 'LEFDEFDR', 'LBCABCAR', 'LEFDEFDR', bottom],
  255: [top, 'LEFDEFDR', 'LBCABCAR', 'LEFDEFDR', bottom],
};
export const TAB_ENGINE_SOLID_ROWS = [top, 'LZZZZZZR', 'LZZZZZZR', 'LZZZZZZR', bottom];
export const TAB_ENGINE_SAMPLED_ROWS = ['LUUUUUUR', 'LZZZZZZR', 'LZZZZZZR', 'LZZZZZZR', 'LVVVVVVR'];
// AD3–AD5 expected *null* is intentional modern admission, never original
// malformed-resource behavior. Original no-cinf stops ladder (V3), not F5.
export const TAB_ENGINE_NULLS = ['no-cinf', 'missing-slice', 'missing-body-request', 'invalid-body-request',
  'invalid-slice', 'unknown-lines', 'different-without-companion', 'wrong-sample-display',
  'masked-background-no-raw', 'ambiguous-pattern', 'undecoded-pattern'];
export const TAB_ENGINE_PUBLIC_SELECTION = [
  { selected: false, ids: [-9975, -9983] },
  { selected: true, ids: [-9972, -9980] },
];
