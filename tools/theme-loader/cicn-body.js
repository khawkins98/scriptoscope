// Bounded mode5 color-port inputs. This is not a Resource Manager resolver or
// arbitrary QuickDraw scaling/device model. No pixels/functions escape here.
export const CICN_BODY_MODEL = 'kaleidoscope-2.3.1-cicn-body-v1';
export const CICN_BODY_POLICY = 'unique-same-face-owner';

export function inspectCicnBody(pmap, mask, bitmap, table, indices) {
  const unsupported = reason => Object.freeze({ status: 'unsupported', reason });
  if (![1, 2, 4, 8].includes(pmap.pixelSize) || pmap.pixelType !== 0 || pmap.cmpCount !== 1 || pmap.cmpSize !== pmap.pixelSize
      || pmap.packType !== 0 || pmap.planeBytes !== 0
      || [pmap, mask, bitmap].some(map => map.bounds.left !== 0 || map.bounds.top !== 0
        || map.width !== pmap.width || map.height !== pmap.height || map.rowBytes < Math.ceil(map.width * (map === pmap ? pmap.pixelSize : 1) / 8))) {
    return unsupported('unsupported-source-layout');
  }
  const palette = new Map();
  for (const [position, entry] of table.entries.entries()) {
    const index = table.flags & 0x8000 ? position : entry.value;
    if (palette.has(index)) return unsupported('ambiguous-palette-index');
    palette.set(index, [entry.r, entry.g, entry.b]);
  }
  for (const index of new Set(indices)) if (!palette.has(index)) return unsupported('missing-palette-index');
  // FE5C uses iconPMap, not iconBMap pixels. Restrict the 1-bit source to the
  // conventional white background/black foreground palette, without requiring
  // its unused mono fallback bitplane to equal the color plane.
  if (pmap.pixelSize === 1 && (palette.size !== 2 || !palette.get(0)?.every(x => x === 65535)
      || !palette.get(1)?.every(x => x === 0))) return unsupported('unsupported-one-bit-palette');
  return Object.freeze({ status: 'ready', reason: 'aligned-color-source', pixelSize: pmap.pixelSize,
    sourceRect: Object.freeze({ x: 0, y: 0, w: pmap.width, h: pmap.height }) });
}

/** Selection at the actual builder occurrence seam. Errors/skips count as
 * present; duplicate signed IDs are conservatively ambiguous, not last-wins. */
export function bindCicnBodies(elements, records, keyByRecord, pathCounts, displayPolicy = 'mac-1.8-to-2.2-high-byte') {
  for (const face of Object.values(elements)) {
    if (face.bodyRequest?.mode !== 5) continue;
    const requestedId = face.bodyRequest.resourceId;
    const common = { model: CICN_BODY_MODEL, selectionPolicy: CICN_BODY_POLICY, requestedId };
    const matches = records.filter(record => record.type === 'cicn' && record.id === requestedId);
    let binding;
    if (matches.length === 0) binding = { ...common, status: 'missing', reason: 'same-owner-resource-absent' };
    else if (matches.length !== 1) binding = { ...common, status: 'ambiguous', reason: 'duplicate-resource-id' };
    else {
      const record = matches[0], source = record.bodyCicnSource;
      if (record.status !== 'ok' || !keyByRecord.has(record)) binding = { ...common, status: 'unsupported', reason: 'resource-decoding-unavailable' };
      else if (pathCounts.get(record.file) !== 1) binding = { ...common, status: 'ambiguous', reason: 'ambiguous-asset-path' };
      else if (source?.status !== 'ready') binding = { ...common, status: 'unsupported', reason: source?.reason ?? 'missing-source-layout' };
      else {
        const unmasked = source.pixelSize > 1, derivedPath = `cicn-body/${record.file.slice(record.file.lastIndexOf('/') + 1)}`;
        binding = { ...common, status: 'ready', reason: 'unique-source-occurrence', manifestKey: keyByRecord.get(record),
          displayPolicy, pixelSize: source.pixelSize, sourceRect: source.sourceRect,
          copy: unmasked ? 'unmasked' : 'masked', asset: unmasked ? derivedPath : record.file,
          ...(unmasked ? { derivedPath } : {}) };
      }
    }
    face.cicnBody = Object.freeze(binding);
  }
}
