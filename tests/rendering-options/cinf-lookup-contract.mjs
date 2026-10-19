// Conditional source model only; never imported by the production loader.
// kDEF0 1086e–1089a / 10fa8; docs/spec/cinf-lookup-contract.md.
const check = (value, message) => { if (!value) throw new TypeError(message); };
const signedId = id => Number.isInteger(id) && id >= -32768 && id <= 32767;
const identity = resource => resource && typeof resource.provider === 'string' && resource.provider.length > 0
  && Number.isInteger(resource.occurrence) && resource.occurrence >= 0 && /^[a-f0-9]{64}$/.test(resource.sha256);

/** An ordered environment is an EXPLICIT modern caller declaration. A provider
 * must declare its inventory complete before absence can mean NULL. Multiple
 * matching occurrences in one provider are ambiguous, never silently ordered. */
function environmentLookup(environment, id) {
  check(environment && Array.isArray(environment.providers) && typeof environment.complete === 'boolean', 'Declare environment completeness');
  const names = new Set();
  for (const provider of environment.providers) {
    check(typeof provider.id === 'string' && provider.id.length && !names.has(provider.id), 'Unique provider identities required');
    names.add(provider.id);
    check(typeof provider.complete === 'boolean' && Array.isArray(provider.resources), 'Declare provider completeness');
    for (const resource of provider.resources) check(signedId(resource.id) && identity({ ...resource, provider: provider.id }), 'Invalid declared resource identity');
  }
  for (const provider of environment.providers) {
    // Even an inventoried match cannot prove which occurrence an incomplete
    // provider would return. Do not continue into lower declared providers.
    if (!provider.complete) return { outcome: 'unknown', reason: 'incomplete-provider', provider: provider.id };
    const matches = provider.resources.filter(resource => resource.id === id);
    if (matches.length > 1) return { outcome: 'ambiguous', reason: 'duplicate-provider-occurrences', provider: provider.id };
    if (matches.length === 1) return { outcome: 'found', resource: { provider: provider.id,
      occurrence: matches[0].occurrence, sha256: matches[0].sha256 } };
  }
  return environment.complete ? { outcome: 'missing' } : { outcome: 'unknown', reason: 'incomplete-environment' };
}

/** Transcript results mean the cinf helper returned a valid handle, NULL, or
 * unavailable evidence; they do not simulate Resource Manager load side effects.
 * Nonnull grants metadata/painter admission, NEVER a completed-pixel claim. */
export function evaluateCinfLookup({ requestedId, body, environment, transcript }) {
  check(signedId(requestedId) && typeof body === 'boolean', 'Signed request ID and body flag required');
  check((environment !== undefined) !== (transcript !== undefined), 'Supply exactly one environment or transcript');
  if (transcript !== undefined) check(Array.isArray(transcript), 'Transcript must be an array');
  const attempts = [];
  const finish = result => {
    if (transcript) check(transcript.length === attempts.length, 'Transcript contains unreachable or missing attempts');
    return { basis: transcript ? 'caller-declared-lookup-transcript' : 'caller-declared-ordered-environment',
      type: 'cinf', requestedId, body, attempts, ...result };
  };
  // Deliberately retain TWO calls even when requestedId equals the default ID.
  for (const id of [requestedId, body ? 0 : 1]) {
    const result = transcript ? transcript[attempts.length] : environmentLookup(environment, id);
    check(result && (!transcript || result.id === id), 'Transcript call ID/order mismatch');
    check(['found', 'missing', 'unknown', 'ambiguous'].includes(result.outcome), 'Explicit lookup result required');
    check(result.outcome !== 'found' || identity(result.resource), 'Found result requires provider/occurrence/hash');
    check(result.outcome === 'found' || result.resource === undefined, 'Nonfound result cannot assert a selected resource');
    attempts.push({ id, ...result });
    if (result.outcome === 'found') return finish({ status: 'metadata-admitted', selected: result.resource, pixelResult: 'unknown' });
    if (result.outcome !== 'missing') return finish({ status: 'unknown', pixelResult: 'unknown' });
  }
  return finish({ status: 'no-body-or-border', pixelResult: 'body-border-stage-skipped' });
}
