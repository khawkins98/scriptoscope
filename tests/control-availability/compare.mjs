import { isDeepStrictEqual } from 'node:util';
/** Compare one execution with a reviewed expectation. No resource resolution. */
export function compareAvailability(expected, observed) {
  if (expected.reviewStatus !== 'reviewed' || !expected.proposed || expected.effectiveAvailability === 'unknown') {
    return { status: 'unknown', errors: [], reason: 'No active independently reviewed expectation; observed pixels or parity cannot promote UNKNOWN.' };
  }
  if (!observed) return { status: 'not-run', errors: ['Missing execution'] };
  const errors = [], require = (ok, error) => { if (!ok) errors.push(error); };
  const target = expected.proposed;
  require(observed.caseId === expected.id, 'Wrong executed case identity');
  require(isDeepStrictEqual(observed.options, expected.options), 'Wrong executed input options');
  require(observed.result?.kind === target.outcome, `Expected ${target.outcome}; observed ${observed.result?.kind ?? 'missing result'}`);
  if (expected.mode === 'direct') {
    require(observed.traces?.length === 1, 'Expected one completed invocation trace');
    const trace = observed.traces?.[0];
    if (trace) {
      require(trace.version === 1 && trace.family === expected.family, 'Wrong trace version/family');
      require(trace.correlationId === expected.id, 'Wrong trace correlation');
      const state = expected.options.disabled ? 'inactive' : expected.options.pressed ? 'pressed' : 'active';
      require(trace.requested?.state === state, 'Wrong requested trace state');
      for (const flag of ['pressed', 'disabled', ...(expected.family === 'push-button' ? ['default'] : ['on', 'small'])]) {
        require(trace.requested?.[flag] === Boolean(expected.options[flag]), `Wrong requested trace flag: ${flag}`);
      }
      require(trace.outcome?.status === target.outcome, 'Trace outcome disagrees with expected availability');
      if (target.outcome === 'themed') {
        require(observed.result.width > 0 && observed.result.height > 0, 'Themed realization has no positive pixel extent');
        require(trace.outcome.width === observed.result.width && trace.outcome.height === observed.result.height, 'Trace extent disagrees with returned pixel extent');
      }
      const paint = (trace.steps ?? []).filter(step => step.action === 'selected' && step.usage === 'paint');
      require(paint.length === (target.paint?.length ?? 0), 'Unexpected count of painted selections');
      for (const identity of target.paint ?? []) {
        const matches = paint.filter(step => step.role === identity.role);
        require(matches.length === 1, `Expected one painted ${identity.role}; reservation is not paint`);
        if (matches.length !== 1) continue;
        const step = matches[0], ownerUrl = observed.owners?.[identity.ownerId];
        require(typeof ownerUrl === 'string' && step.owner?.baseUrl === ownerUrl && step.owner?.chainDepth === identity.chainDepth, `${identity.role}: wrong owner/depth`);
        for (const key of ['type', 'signedId', 'sourceCinfId', 'manifestKey']) require(step.resource?.[key] === identity[key], `${identity.role}: wrong ${key}`);
      }
      for (const role of target.noPaintRoles ?? []) require(!paint.some(step => step.role === role), `Forbidden painted ${role}`);
      for (const decision of target.requiredDecisions ?? []) {
        require((trace.steps ?? []).some(step => Object.entries(decision).every(([key, value]) => isDeepStrictEqual(key === 'signedId' ? step.resource?.signedId : step[key], value))), `Missing required decision ${JSON.stringify(decision)}`);
      }
    }
  } else {
    const native = observed.native;
    // The finite interactive inventory contains exactly the two empty-chain
    // fixtures. This is not a universal trace-count contract for interactive APIs.
    require(expected.input === 'fixture.empty-chain', 'Unreviewed native fallback fixture');
    require(observed.traces?.length === 1, 'Empty-art fallback requires one completed initial compose trace');
    const trace = observed.traces?.[0];
    require(trace?.version === 1 && trace.family === expected.family && trace.correlationId === expected.id, 'Wrong native fallback trace identity');
    require(trace?.outcome?.status === 'unavailable', 'Native fallback trace must have no themed realization');
    require(!(trace?.steps ?? []).some(step => step.action === 'selected' && step.usage === 'paint'), 'Native fallback cannot paint themed art');
    require(trace?.requested?.state === (expected.options.disabled ? 'inactive' : 'active')
      && trace?.requested?.pressed === false && trace?.requested?.disabled === Boolean(expected.options.disabled)
      && trace?.requested?.default === false, 'Wrong actual native fallback request');
    require(native?.canvasCount === 0, 'Native fallback cannot conceal a themed canvas');
    require(native?.element === target.element && native?.accessibleName === target.accessibleName, 'Wrong native element or accessible name');
    require(native?.disabled === Boolean(expected.options.disabled), 'Wrong native disabled state');
    for (const action of target.keyboard ?? []) require(native?.keyboard?.[action] === true, `Native keyboard contract failed: ${action}`);
    if (target.activation === false) require(native?.activationCount === 0, 'Disabled native control activated');
  }
  return { status: errors.length ? 'failed' : 'passed', errors };
}
