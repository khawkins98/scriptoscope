// Independent acceptance literals frozen from engine/tab.md at author426d05c3.
// CDEF8 sha2564c9fecff…: B1–B8 (430..61e), C1 (1f10..1f86),
// P1–P4 (402..418,596..600,59e..5ea,1888..197a). No src imports.
// These finite synthetic pixels prove the declared modern raster subset only.
export const TAB_ENGINE_PALETTE = Object.fromEntries(
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((key, i) => [key, [7 + i * 8, 233 - i * 7, 31 + i * 5, 255]]));
// Independently pinned RGB16 [8481,34952,8481] realizes to [48,152,48].
TAB_ENGINE_PALETTE.Z = [48, 152, 48, 255];
export const TAB_ENGINE_INPUT = ['LABCDER', 'LMMMMMR', 'LMMZMMR', 'LMMMMMR', 'LFGHIJR'];
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

// Added P1–P4 center model independent of runtime. Reuse already independent
// B1–B8 oracle without changing any shared tab/header expectations.
export function paintTabPatternCenter(out, { c, s, mode }, pattern) {
  if (!pattern || out.width <= 2 * c || out.height <= 2 * s) return out;
  const [px, py] = ({ 1: [0, 0], 2: [out.width, 0], 3: [0, out.height], 4: [out.width, out.height] })[mode] ?? [0, 0];
  const mod = (v, n) => ((v % n) + n) % n;
  for (let y = s; y < out.height - s; y++) for (let x = c; x < out.width - c; x++) {
    const from = (mod(y - py, pattern.height) * pattern.width + mod(x - px, pattern.width)) * 4;
    const to = y * out.width + x;
    out.rgba.set(pattern.rgba.subarray(from, from + 4), to * 4); out.known[to] = 1;
  }
  return out;
}
// Rule-level nonzero outer D=(left2,top3,right10,incomingBottom11), sourceH5.
// Returned bottom8 differs in pattern parity from incoming11. P4 must use11.
const offsetZero = [top, 'LABCABCR', 'LDEFDEFR', 'LABCABCR', bottom];
export const TAB_ENGINE_OFFSET_PATTERN_ROWS = {
  0: offsetZero, 1: TAB_ENGINE_PATTERN_ROWS[0], 2: TAB_ENGINE_PATTERN_ROWS[2],
  3: TAB_ENGINE_PATTERN_ROWS[0], 4: TAB_ENGINE_PATTERN_ROWS[2], 5: offsetZero,
};
