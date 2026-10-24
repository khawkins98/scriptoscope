// Regression trace matrix for tab.md F1/F2, B/C/P; independently selected
// public ids, decoded archive raster inputs. Not historical native pixel proof.
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const asset = (decoded, path) => {
  const a = decoded.assets.find(a => a.path === path);
  return a ? { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) } : null;
};
export async function* tabCells({ decoded, mutate = x => x }) {
  const E = await import('../../src/engine/index.ts');
  for (const selected of [false, true]) {
    const probes = selected ? [-9972, -9980] : [-9975, -9983];
    const entries = Object.entries(decoded.manifest.chromeElements ?? {});
    const chosen = probes.map(id => entries.find(([, e]) => e.sourceCicnId === id)).find(Boolean);
    if (!chosen) { yield { key: `selected${+selected}/missing`, trace: { family: 'tab', selected, probes, outcome: 'missing-art' } }; continue; }
    const [key, el] = chosen, source = asset(decoded, el.asset);
    if (!source || !el.slice || !el.bodyRequest) throw Error(`unprepared tab fixture ${key}`);
    const background = el.colorSamples?.background?.displayRgb;
    const rgb = background && { r: background[0], g: background[1], b: background[2], a: 255 };
    const patterns = Object.values(decoded.manifest.patterns ?? {}).filter(p => p.sourcePpatId === el.bodyRequest.resourceId);
    if (patterns.length > 1) throw Error('ambiguous tab pattern fixture');
    const pattern = patterns[0] ? asset(decoded, patterns[0].asset) : null;
    const sampled = el.sampledBandAsset ? asset(decoded, el.sampledBandAsset.asset) : null;
    const startWidth = Math.max(source.width, 2 * el.slice.corner + 6);
    for (const width of [startWidth, startWidth + 17]) {
      const original = { source, destination: { left: 0, top: 0, right: width, bottom: source.height }, metadata: { corner: el.slice.corner, side: el.slice.side, tile: el.slice.tile, mode: el.bodyRequest.mode, patternId: el.bodyRequest.resourceId },
        samplingEquivalent: el.samplingEquivalence?.status === 'equivalent', sampled, backgroundRGB: rgb, pattern };
      const input = mutate(original, { family: 'tab', selected });
      const trace = E.createTrace('tab', { selected, sourceId: el.sourceCicnId, sourceKey: key, width, sourceHeight: source.height, metadata: input.metadata });
      const port = { width, height: source.height, data: new Uint8ClampedArray(width * source.height * 4) };
      const result = E.drawTab(port, input, trace);
      yield { key: `selected${+selected}/${width}x${source.height}`, trace: { ...trace, result, pixels: sha(port.data) } };
    }
  }
}
