// Actual converter inputs, NOT independent expected geometry or color decoding.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { enumerateForks, selectFork } from '../control-availability/source.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { decodeCicn } from '../../tools/theme-loader/decoders/cicn.js';
import { realizeRgb16 } from '../../tools/theme-loader/display-profile.js';
import { forkOf } from '../resource-provenance/fixtures.mjs';
import { convertScheme } from '../../tools/theme-loader/convert.js';
const root = new URL('../../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const choicesBytes = readFileSync(new URL('tests/control-availability/source-choices.json', root));
export const choicesSha256 = hash(choicesBytes);
// Owned input, not recovered engine-default metadata: c3/s1, first-line expansion,
// mode0/ppat0; bg/text(6,6), no emboss. Expected coordinates are literal here.
const providerCinf = Uint8Array.of(3, 1, 0, 0, 0, 0, 0, 6, 0, 6, 0, 6, 0, 6, 0, 0, 0, 0);
const providerFork = forkOf([{ type: 'cinf', id: 0, data: providerCinf }]);
const declaredProvider = { bytes: [...providerFork], forkSha256: hash(providerFork),
  occurrence: 0, signedId: 0, byteLength: 18, sha256: hash(providerCinf) };
// Frozen default-load tuple counts, not a historical availability assertion.
const missingTuples = { '1138': 12, '1984': 12, 'apple-platinum-2': 15,
  'black-platinum': 15, 'platinum-8': 15, slimes: 3, 'system7-nostalgia-silver': 15 };
export const boundarySources = JSON.parse(choicesBytes).sources;
export async function boundaryInput(choice) {
  const bytes = readFileSync(new URL(choice.path, root));
  const fork = selectFork(bytes, await enumerateForks(bytes, choice.format), choice);
  const raw = parseResourceFork(fork.bytes);
  const observer = { begin: (_entry, resourceIndex) => ({ loadId: 'input', resourceIndex }), end() {}, bindAsset() {} };
  const { theme, assets } = convertScheme(fork.bytes, { resourceObserver: observer });
  const byPath = new Map(assets.map(a => [a.path, a]));
  const elements = Object.fromEntries(Object.entries(theme.chromeElements ?? {}).map(([key, e]) => {
    const a = byPath.get(e.asset), ref = e.byteProvenance;
    if (!a || !ref) throw new Error(`${choice.slug}/${key}: missing actual conversion input`);
    const rgba = new Uint8Array(a.rgba);
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] === 0) rgba.fill(0, i, i + 3);
    const cinf = ref.cinfResourceIndex === null ? null : raw[ref.cinfResourceIndex].data;
    const view = cinf && cinf.length >= 18 ? new DataView(cinf.buffer, cinf.byteOffset, cinf.byteLength) : null;
    const request = view ? { mode: cinf[3], resourceId: view.getInt16(4) } : null;
    const body = view ? { request, anchor: [view.getInt16(8), view.getInt16(6)], sample: e.colorSamples?.background ?? null,
      sampleModel: e.colorSamples?.model ?? null, displayPolicy: e.colorSamples?.displayPolicy ?? null,
      unavailableReason: e.colorSamplesUnavailableReason ?? null,
      rawPatternOccurrences: raw.flatMap((r, i) => r.type === 'ppat' && r.id === request.resourceId ? [i] : []) } : null;
    // Independent of the prepared role view/trace: sample raw input at the
    // explicitly declared anchor. Decoder and display policy remain assumptions.
    const rgb16 = cinf === null ? decodeCicn(raw[ref.cicnResourceIndex].data,
      { retainKdefColorSampler: true }).sampleKdefRgb16?.(6, 6) ?? null : null;
    const declaredBody = cinf === null ? { request: { mode: 0, resourceId: 0 }, anchor: [6, 6],
      sample: rgb16 ? { rgb16, displayRgb: realizeRgb16(rgb16) } : null,
      sampleModel: 'kdef-2.3.1-color', displayPolicy: 'mac-1.8-to-2.2-high-byte', unavailableReason: null,
      rawPatternOccurrences: raw.flatMap((r, i) => r.type === 'ppat' && r.id === 0 ? [i] : []) } : null;
    return [key, { body, declaredBody, cicnResourceIndex: ref.cicnResourceIndex, cinfResourceIndex: ref.cinfResourceIndex,
      signedId: e.sourceCicnId, width: a.width, height: a.height, rgbaSha256: hash(rgba),
      cinf: cinf && cinf.length >= 18 ? { corner: cinf[0], side: cinf[1], tile: cinf[2] !== 0 } : null,
      status: cinf === null ? 'missing-cinf' : cinf.length < 18 ? 'unsafe-short-cinf' : 'candidate' }];
  }));
  const patterns = Object.fromEntries(Object.entries(theme.patterns ?? {}).map(([key, p]) => {
    const a = byPath.get(p.asset), ref = p.byteProvenance;
    return [key, { signedId: p.sourcePpatId, resourceIndex: ref?.ppatResourceIndex ?? null,
      width: a?.width ?? null, height: a?.height ?? null, rgbaSha256: a ? hash(a.rgba) : null,
      opaque: !!a && a.rgba.every((v, i) => i % 4 !== 3 || v === 255), displayPolicy: 'mac-1.8-to-2.2-high-byte' }];
  }));
  return { choice, choicesSha256, expectedMissingTuples: missingTuples[choice.slug] ?? 0, declaredProvider, elements, patterns, resources: Object.fromEntries(raw.flatMap((r, i) => ['cicn', 'cinf', 'ppat'].includes(r.type)
    ? [[i, { resourceIndex: i, type: r.type, signedId: r.id, byteLength: r.data.length, sha256: hash(r.data) }]] : [])) };
}
