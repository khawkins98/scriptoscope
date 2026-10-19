// Actual converter inputs, NOT independent expected geometry or color decoding.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { enumerateForks, selectFork } from '../control-availability/source.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { convertScheme } from '../../tools/theme-loader/convert.js';
const root = new URL('../../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const choicesBytes = readFileSync(new URL('tests/control-availability/source-choices.json', root));
export const choicesSha256 = hash(choicesBytes);
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
    return [key, { cicnResourceIndex: ref.cicnResourceIndex, cinfResourceIndex: ref.cinfResourceIndex,
      signedId: e.sourceCicnId, width: a.width, height: a.height, rgbaSha256: hash(rgba),
      cinf: cinf && cinf.length >= 18 ? { corner: cinf[0], side: cinf[1], tile: cinf[2] !== 0 } : null,
      status: cinf === null ? 'missing-cinf' : cinf.length < 18 ? 'unsafe-short-cinf' : 'candidate' }];
  }));
  return { choice, choicesSha256, elements, resources: Object.fromEntries(raw.flatMap((r, i) => ['cicn', 'cinf'].includes(r.type)
    ? [[i, { resourceIndex: i, type: r.type, signedId: r.id, byteLength: r.data.length, sha256: hash(r.data) }]] : [])) };
}
