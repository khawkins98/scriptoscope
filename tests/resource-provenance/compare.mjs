// Bounded join verifier. Expected pins come from the separately reviewed source
// inventory; this never extracts, decodes, selects a resource, or inspects pixels.
const code = value => value === null ? null : String.fromCharCode(value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255);
export function compareByteProvenance(step, loaded, pin, expected) {
  const errors = [], check = (condition, message) => { if (!condition) errors.push(message); };
  const evidence = loaded?.byteProvenance, ref = step?.resource?.byteProvenance;
  if (!evidence || !ref) return { status: 'unknown', errors: ['Actual load or entry byte provenance was not collected'] };
  check(evidence.version === 1, 'Unsupported evidence version');
  check(ref.loadId === evidence.loadId, 'Entry/load invocation mismatch');
  check(step.owner?.baseUrl === loaded.baseUrl && step.owner?.baseUrl === expected.baseUrl, 'Selected owner mismatch');
  check(step.owner?.chainDepth === expected.chainDepth, 'Selected base depth mismatch');
  check(step.action === 'selected' && step.usage === expected.usage && step.role === expected.role, 'Selected role/usage mismatch');
  check(step.resource.type === 'cicn' && step.resource.signedId === expected.signedId, 'Selected signed cicn mismatch');
  check(step.resource.sourceCinfId === expected.sourceCinfId, 'Selected signed cinf mismatch');
  check(step.resource.manifestKey === expected.manifestKey && ref.manifestKey === expected.manifestKey, 'Generated manifest key mismatch');
  check(evidence.input.sha256 === pin.archive.sha256 && evidence.input.byteLength === pin.archive.byteLength, 'Actual input archive bytes mismatch');
  check(evidence.fork.sha256 === pin.selectedFork.forkSha256 && evidence.fork.byteLength === pin.selectedFork.byteLength, 'Actual selected fork bytes mismatch');
  const actual = evidence.fork.selection, wanted = pin.selectedFork;
  check(actual.policy === (pin.archive.format === 'rsrc' ? 'raw-resource-fork' : 'largest-non-icon-resource-fork'), 'Observed selection policy mismatch');
  for (const name of ['entryIndex', 'entryName', 'forkType']) check(actual[name] === wanted[name], `Selected fork ${name} mismatch`);
  for (const name of ['fileType', 'creator']) check(code(actual[name]) === wanted[name], `Selected fork ${name} mismatch`);
  for (const [type, id, index] of [['cicn', expected.signedId, ref.cicnResourceIndex], ['cinf', expected.sourceCinfId, ref.cinfResourceIndex]]) {
    const sourceId = id ?? expected.signedId;
    const candidates = pin.candidates.filter(r => r.type === type && r.signedId === sourceId);
    if (candidates.length !== 1) { errors.push(`Missing unambiguous independent ${type} pin`); continue; }
    const source = candidates[0];
    if (id === null) {
      check(index === null && source.presence === 'absent-from-selected-fork', 'Absent cinf claim lacks independent absence evidence');
      continue;
    }
    const occurrences = evidence.resources.filter(r => r.resourceIndex === index);
    if (occurrences.length !== 1) { errors.push(`Missing unambiguous actual ${type} occurrence`); continue; }
    const r = occurrences[0];
    check(r.type === type && r.signedId === id, `Actual ${type} occurrence type/ID mismatch`);
    check(r.status === 'decoded', `Actual ${type} conversion not decoded`);
    check(source.presence === 'present' && r.sha256 === source.payloadSha256 && r.byteLength === source.byteLength, `Actual ${type} payload bytes mismatch`);
  }
  return { status: errors.length ? 'failed' : 'passed', errors };
}
