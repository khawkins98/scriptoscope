// Independent #608 facade rules, derived from docs/spec/engine/push-button.md
// "Public facade availability (modern policy, #608)" rows PF1-PF6 and the
// facade test hooks PF-H1..PF-H3. No runtime imports: a row is the literal
// observation {state, size, opaque, trace} returned by the browser probe.
//
// These are modern API policy checks. They make no native pixel claim.

export const PF_SCHEMES = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
export const PF_POSITIVE = ['1138', 'windows-95'];
// Spec §1 canonical push states; "default" is the active face plus the ring flag.
export const PF_STATES = {
  normal: { options: {}, faceId: -10239 },
  pressed: { options: { pressed: true }, faceId: -10238 },
  disabled: { options: { disabled: true }, faceId: -10240 },
  default: { options: { default: true }, faceId: -10239 },
};
export const PB9_REASON = 'engine:PB9:cinf:NULL';

/** "Completed face paint" = a face bodyPaint, face bandPaints or face legacyFacePaint record. */
export function completedFacePaint(trace) {
  return (trace?.steps ?? []).some(s => s.role === 'face' && s.bodyPaint)
    || (trace?.bandPaints ?? []).some(b => b.role === 'face')
    || !!trace?.legacyFacePaint;
}

const isPb9 = s => s.role === 'face' && s.action === 'missing' && s.basis === 'source-dispatch'
  && s.usage === 'paint' && s.reason === PB9_REASON;

/** PF-H1 (PF3, PF6): known art, both cinfs proven NULL -> null + unavailable. */
export function checkPf3Unavailable(row) {
  const errors = [], check = (ok, message) => { if (!ok) errors.push(message); };
  const trace = row.trace, steps = trace?.steps ?? [];
  check(row.size === null, 'PF3: facade must return null, never a buffer');
  check(!(row.size !== null && row.opaque === 0), 'PF6: non-null buffer with 0 opaque pixels');
  check(trace?.outcome?.status === 'unavailable', `PF3: outcome must be unavailable, saw ${trace?.outcome?.status}`);
  check(trace?.outcome?.status !== 'themed', 'PF6: themed reported without a completed face paint');
  check(steps.some(isPb9), 'PF3: missing face step engine:PB9:cinf:NULL');
  check(steps.length > 0 && isPb9(steps.at(-1)), 'PF3: engine:PB9:cinf:NULL must be the terminal step');
  check(!completedFacePaint(trace), 'PF6: completed face paint record present');
  check(!steps.some(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint'), 'PF6: face selected for paint');
  // PF3: the earlier cicn admission keeps its owner/resource identity.
  const admitted = steps.filter(s => s.role === 'face' && s.action === 'selected' && s.usage === 'admission'
    && s.resource?.type === 'cicn' && s.resource?.signedId === row.faceId && s.owner?.chainDepth === 0);
  check(admitted.length > 0, 'PF3: face cicn admission identity lost');
  // PB9: exact cinf then cinf 0, both missing; no metadata hit stands in.
  const cinf = steps.filter(s => s.role === 'face' && s.usage === 'admission' && /:cinf:/.test(s.reason ?? ''));
  check(JSON.stringify(cinf.map(s => [s.requestedId, s.action])) === JSON.stringify([[row.faceId, 'missing'], [0, 'missing']]),
    'PB9: exact cinf and cinf0 NULL transcript required');
  return errors;
}

/** PF-H2 (PF2, PF6): completed face paint -> themed buffer with visible pixels. */
export function checkPf2Themed(row) {
  const errors = [], check = (ok, message) => { if (!ok) errors.push(message); };
  const trace = row.trace;
  check(row.size !== null, 'PF2: facade returned null');
  check(trace?.outcome?.status === 'themed', `PF2: outcome must be themed, saw ${trace?.outcome?.status}`);
  check(row.size !== null && trace?.outcome?.width === row.size[0] && trace?.outcome?.height === row.size[1],
    'PF2: outcome dimensions differ from the returned buffer');
  check(row.opaque > 0, 'PF2: themed buffer has 0 opaque pixels');
  check(completedFacePaint(trace), 'PF6: themed without a completed face paint record');
  return errors;
}

/** PF-H3 (PF2): the face cinf comes from the declared base at chainDepth 1. */
export function checkPf2FromBase(row) {
  const errors = checkPf2Themed(row);
  const steps = row.trace?.steps ?? [];
  if (!steps.some(s => s.role === 'face' && s.action === 'selected' && /:cinf:/.test(s.reason ?? '') && s.owner?.chainDepth === 1))
    errors.push('PF-H3: face cinf not selected at chainDepth 1');
  return errors;
}
