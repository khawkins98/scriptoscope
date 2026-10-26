// Measures compatibility loss. A completed measurement is NOT an equivalence pass.
import * as reference from '/runtime-reference.js';
import { loadOwnedKaleidoscopeScheme } from '../../src/loadKaleidoscopeScheme.ts';
import { engineCinfIds, engineIconBlitCicnIds } from '../../src/engine/resources/ids.ts';
import { composeCandidate, bevelIds } from './bevel-candidate.mjs';

const slugs = Object.keys(import.meta.glob('../../themes/*/meta.json')).map(p => p.split('/')[3]).sort();
const clip = { controlOrigin: [23, 41], portOrigin: [5, -7], patternOrigin: { status: 'known', offset: [3, 5] },
  clip: { kind: 'rect', rect: { x: 25, y: 43, w: 20, h: 10 } } };
const cases = [];
for (const small of [false, true]) for (const on of [false, true]) for (const state of ['normal', 'pressed', 'disabled'])
  for (const minWidth of [undefined, 32, 80]) for (const label of ['', 'AgjpQy']) for (const clipped of [false, true])
    cases.push({ small, on, pressed: state === 'pressed', disabled: state === 'disabled', label,
      ...(minWidth === undefined ? {} : { minWidth, height: 20 }), ...(clipped ? { compositionContext: clip } : {}) });

async function bytes(slug) {
  for (const extension of ['sit', 'rsrc']) {
    const response = await fetch(`/themes/${slug}/scheme.${extension}`);
    if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Missing source: ${slug}`);
}
async function capture(render, theme, options) {
  const observations = [];
  try { return { output: await render(theme, options, observation => observations.push(observation)), observations }; }
  catch (error) { return { error: `${error.name}: ${error.message}` }; }
}
function compare(a, b) {
  if (a.error || b.error) return { kind: a.error === b.error ? 'same-error' : 'error-change', reference: a.error, candidate: b.error };
  if (!a.output || !b.output) return { kind: a.output === b.output ? 'same-missing' : 'availability-change',
    reference: a.output ? 'painted' : 'missing', candidate: b.output ? 'painted' : 'missing',
    ...(b.observations?.length ? { observations: b.observations } : {}) };
  const A = a.output, B = b.output;
  if (A.width !== B.width || A.height !== B.height) return { kind: 'dimensions-change', reference: [A.width, A.height], candidate: [B.width, B.height] };
  let changedPixels = 0;
  for (let i = 0; i < A.data.length; i += 4)
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) changedPixels++;
  return { kind: changedPixels ? 'pixels-change' : 'same-pixels', ...(changedPixels ? { changedPixels } : {}) };
}

async function run() {
  const report = { status: 'running', purpose: 'Compatibility-change feasibility measurement; not acceptance or native-fidelity evidence',
    runAt: new Date().toISOString(), userAgent: navigator.userAgent, casesPerTheme: cases.length, compared: 0,
    limitations: ['owned loader only', 'no declared cinf environments', 'no diagnostic transcript comparison',
      'no base inheritance or caller mutation cases', 'no performance claim'], outcomes: {}, rows: [], differences: [] };
  const pixel = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) };
  for (const [candidate, expected] of [
    [{ output: { ...pixel, data: new Uint8ClampedArray([2, 2, 3, 255]) } }, 'pixels-change'],
    [{ output: { ...pixel, width: 2 } }, 'dimensions-change'], [{ output: null }, 'availability-change'],
    [{ error: 'probe' }, 'error-change'],
  ]) if (compare({ output: pixel }, candidate).kind !== expected) throw new Error(`Comparator missed ${expected}`);
  report.comparatorProbes = 4;
  for (const slug of slugs) {
    const raw = await bytes(slug);
    const original = await reference.loadOwnedKaleidoscopeScheme(raw);
    let candidate;
    const row = { slug, outcomes: {} };
    report.rows.push(row);
    try {
      candidate = await loadOwnedKaleidoscopeScheme(raw, {
        engineCinfIds: [...new Set([...engineCinfIds(), ...bevelIds, 0])],
        iconBlitCicnIds: [...new Set([...engineIconBlitCicnIds(), ...bevelIds])],
      });
      for (const options of cases) {
        const a = await capture(reference.composeBevelButton, original, options);
        const b = await capture(composeCandidate, candidate, options);
        const difference = compare(a, b), kind = difference.kind;
        row.outcomes[kind] = (row.outcomes[kind] ?? 0) + 1;
        report.outcomes[kind] = (report.outcomes[kind] ?? 0) + 1;
        if (kind.endsWith('-change')) report.differences.push({ slug, options, ...difference });
        report.compared++;
      }
    } finally { original.dispose(); candidate?.dispose(); }
  }
  report.status = 'measured';
  return report;
}
run().then(report => { window.spikeReport = report; document.querySelector('#result').textContent = JSON.stringify(report, null, 2); })
  .catch(error => { window.spikeReport = { status: 'error', error: `${error.stack ?? error}` }; });
