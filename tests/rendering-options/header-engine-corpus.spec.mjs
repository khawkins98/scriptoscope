import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { loadCorpus } from './tab-header-corpus.mjs';
import { ALL_ARCHIVES, headerSurface, diff } from './tab-header-rules.mjs';

// Raw-fork census and independently source-addressed painter, never src tables.
// Shared decoding supplies prepared image inputs; decoder correctness is separate.
const corpus = await loadCorpus();
const matrix = ALL_ARCHIVES.flatMap(slug => [0, 1, 0xffffffff].flatMap(drawState => {
  const id = drawState === 0 ? -9568 : -9567;
  if (!corpus.get(slug).census.cicn.has(id)) return [{ slug, drawState, id, missing: true }];
  return ['window-header', 'list-view-header'].flatMap(kind => [[61, 17], [7, 5]].flatMap(([width, height]) =>
    [[0, 0], [5, 3]].map(origin => ({ slug, drawState, id, kind, width, height, origin }))));
}));

for (const mode of ['source', 'built']) test(`${mode}: header engine covers every archive with independent raw selection and paint rules`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const observed = await page.evaluate(async ({ mode, matrix, slugs }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const output = [];
    for (const slug of slugs) {
      const owner = await api.loadTheme(`/themes/${slug}`, { provenance: true });
      try {
        for (const entry of matrix.filter(e => e.slug === slug)) {
          const r = await api.composeHeaderSurface(owner, { kind: entry.kind ?? 'window-header', width: entry.width ?? 7,
            height: entry.height ?? 5, drawState: entry.drawState, compositionContext: {
              controlOrigin: entry.origin ?? [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'unbounded' } } });
          let rgba;
          if (r.buffer) {
            let binary = '';
            for (let i = 0; i < r.buffer.data.length; i += 8192) binary += String.fromCharCode(...r.buffer.data.subarray(i, i + 8192));
            rgba = btoa(binary);
          }
          output.push({ status: r.status, reason: r.reason, width: r.buffer?.width, height: r.buffer?.height, rgba });
        }
      } finally { owner.dispose(); }
    }
    return output;
  }, { mode, matrix, slugs: ALL_ARCHIVES });
  expect(matrix).toHaveLength(327); //13×3×2×2×2 +5×3, no missing-art geometry fillers.
  expect(matrix.filter(e => e.missing)).toHaveLength(15);
  expect(observed).toHaveLength(327);
  const evidence = [];
  for (const [i, entry] of matrix.entries()) {
    const actual = observed[i], input = corpus.get(entry.slug);
    if (entry.missing) {
      expect([actual.status, actual.reason], `${entry.slug}/${entry.drawState}`).toEqual(['unavailable', 'missing-face']);
      evidence.push({ ...entry, status: actual.status });
      continue;
    }
    expect(actual.status, JSON.stringify(entry)).toBe('rendered');
    const art = input.art(entry.id), pattern = input.census.ppat.has(art.cinf.bodyId) ? input.pattern(art.cinf.bodyId) : null;
    const expected = headerSurface(art.raster, art.cinf, { ...entry, bg: art.bg, pattern, sampling: art.sampling });
    const result = diff(expected, { width: actual.width, height: actual.height, rgba: new Uint8ClampedArray(Buffer.from(actual.rgba, 'base64')) });
    expect(result.equal, `${entry.slug}/${entry.kind}/${entry.drawState}: ${result.reason}`).toBe(true);
    evidence.push({ ...entry, unknownPixels: result.unknown, sourceFork: input.loaded.byteProvenance.fork.sha256 });
  }
  await attachObservations(info, 'header-engine', `${mode}-corpus`, { mode, evidence,
    limits: 'Independent source-addressed current-display corpus model; shared decoder input assumptions and explicitly unknown sampling pixels retained. Literal synthetic planes discriminate unsampled native rules separately.' });
});
