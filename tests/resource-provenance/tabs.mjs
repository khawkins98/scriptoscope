import { compareByteProvenance } from './compare.mjs';

// Compare observed paint, never look up a manifest entry on the renderer's behalf.
// Expected byte pins and expected branch are independent test inputs.
export function compareTabPaint(trace, owner, pin, expected) {
  if (!trace) return { status: 'unknown', errors: ['Tab paint trace was not collected'] };
  const faces = trace.steps.filter(s => s.action === 'selected' && s.role === 'face' && s.usage === 'paint');
  if (faces.length !== 1) return { status: 'failed', errors: ['Expected exactly one actual selected tab face'] };
  const joined = compareByteProvenance(faces[0], owner, pin, expected);
  if (joined.status !== 'passed') return joined;
  const errors = [];
  if (trace.family !== 'tab' || trace.outcome.status !== 'themed') errors.push('Completed themed tab paint required');
  for (const [key, value] of Object.entries(expected.requested ?? {})) if (trace.requested?.[key] !== value) errors.push(`Actual tab request ${key} mismatch`);
  for (const [key, value] of Object.entries(expected.body)) if (trace.tabBody?.[key] !== value) errors.push(`Actual tab body ${key} mismatch`);
  return { status: errors.length ? 'failed' : 'passed', errors };
}
