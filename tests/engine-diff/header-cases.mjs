// Regression observations for a raw-census-enumerated finite header grid.
// Baseline digests are recorded execution, never the independent pixel oracle.
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const image = (decoded, path) => {
  const a = decoded.assets.find(a => a.path === path);
  return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) };
};

export function headerMatrix(decoded) {
  const entries = Object.values(decoded.manifest.chromeElements ?? {}), rows = [];
  for (const drawState of [0, 1, 0xffffffff]) {
    const expectedId = drawState === 0 ? -9568 : -9567;
    if (!entries.some(e => e.sourceCicnId === expectedId)) { rows.push({ drawState, expectedId, missing: true }); continue; }
    for (const kind of ['window-header', 'list-view-header']) for (const [width, height] of [[61, 17], [7, 5]]) for (const origin of [[0, 0], [5, 3]]) {
      rows.push({ drawState, expectedId, kind, width, height, origin });
    }
  }
  return rows;
}

export async function* headerCells({ decoded, mutate = x => x }) {
  const E = await import('../../src/engine/index.ts');
  for (const row of headerMatrix(decoded)) {
    const requestedId = E.headerResourceId(row.drawState);
    const chosen = Object.entries(decoded.manifest.chromeElements ?? {}).find(([, e]) => Math.abs(e.sourceCicnId) === Math.abs(requestedId));
    if (row.missing) {
      yield { key: `state${row.drawState}/missing`, trace: { family: 'header', drawState: row.drawState, requestedId, outcome: chosen ? 'unexpected-art' : 'missing-art' } };
      continue;
    }
    if (!chosen) throw Error(`header engine requested missing ${requestedId}`);
    const [manifestKey, el] = chosen, source = image(decoded, el.asset);
    if (!source || !el.slice || !el.bodyRequest) throw Error(`unprepared header fixture ${manifestKey}`);
    const raw = el.colorSamples?.background?.displayRgb;
    const patterns = Object.values(decoded.manifest.patterns ?? {}).filter(p => p.sourcePpatId === el.bodyRequest.resourceId);
    if (patterns.length > 1) throw Error('ambiguous header corpus pattern');
    const pattern = patterns[0] ? image(decoded, patterns[0].asset) : null;
    const sampled = el.sampledBandAsset ? image(decoded, el.sampledBandAsset.asset) : null;
    const context = { basis: 'caller-declared', controlOrigin: row.origin, portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'unbounded' } };
    const plan = E.planHeaderSurface({ ...row, context });
    const input = mutate({ source, plan, slice: { ...el.slice }, mode: el.bodyRequest.mode,
      background: raw && { r: raw[0], g: raw[1], b: raw[2], a: 255 }, pattern, sampled,
      samplingEquivalent: el.samplingEquivalence?.status === 'equivalent' }, { family: 'header', ...row });
    const geometry = E.planHeaderGeometry(input.source, input.slice, input.plan);
    const port = { width: row.width, height: row.height, data: new Uint8ClampedArray(row.width * row.height * 4) };
    const result = E.drawHeaderSurface(port, input);
    yield { key: `state${row.drawState}/${row.kind}/${row.width}x${row.height}@${row.origin}`, trace: {
      family: 'header', inputs: { ...row, requestedId, sourceId: el.sourceCicnId, manifestKey, sourceSize: [source.width, source.height],
        slice: input.slice, mode: input.mode, patternId: el.bodyRequest.resourceId }, plan: input.plan, geometry, result, pixels: sha(port.data),
    } };
  }
}
