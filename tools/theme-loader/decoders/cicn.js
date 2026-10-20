import { DisplayProfileError } from '../display-profile.js';
// Decode a 'cicn' (color icon) resource into an RGBA pixel buffer.
//
// Serialized layout (per Inside Macintosh: Imaging With QuickDraw, ch. 4):
//
//   0    PixMap iconPMap (50 bytes; baseAddr=0, pmTable=0)
//   50   BitMap iconMask (14 bytes; baseAddr=0)
//   64   BitMap iconBMap (14 bytes; baseAddr=0)
//   78   Handle iconData (4 bytes; 0 in resource)
//   82   mask pixel data        (iconMask.rowBytes * mask height bytes)
//   ...  bitmap pixel data      (iconBMap.rowBytes * bmap height bytes)
//   ...  ColorTable             (8 + 8*(ctSize+1) bytes)
//   ...  PixMap pixel data      (iconPMap.rowBytes * pixmap height bytes)
//
// The mask is a 1-bit alpha layer; the bitmap is a 1-bit B/W fallback
// for B/W displays (we ignore it for RGBA output); the pixmap pixel data
// is indexed into the ColorTable.

import {
  Reader, readPixMap, readBitMap, readColorTable,
  expandIndexedPixels, expandMask,
} from './shared.js';
import { compareOpaqueSampling, sampledBandPixels } from '../sampling-equivalence.js';
import { inspectCicnBody } from '../cicn-body.js';
import { makeKdefColorSampler } from '../kdef-color-samples.js';

/**
 * @param {Uint8Array} bytes  Raw cicn resource bytes
 * @returns {{width: number, height: number, rgba: Uint8Array, debug: object}|null} null for a structurally valid unsupported destination-palette variant
 */
export function readCicnIndexed(bytes) {
  requireBytes(bytes, 0, 82, 'headers');
  const r = new Reader(bytes);

  const pmap = readPixMap(r);
  const mask = readBitMap(r);
  const bmap = readBitMap(r);
  const iconDataHandle = r.readUInt32(); // ignored (0 in resource)

  // Validate required ranges before any expanded-pixel allocation. The shared
  // Reader intentionally has no policy/bounds checks for other resource types.
  if (![1, 2, 4, 8].includes(pmap.pixelSize)) throw new Error(`Unsupported pixelSize: ${pmap.pixelSize}`);
  validateBitmap(pmap, pmap.pixelSize, 'pixel map');
  validateBitmap(mask, 1, 'mask');
  validateBitmap(bmap, 1, 'monochrome bitmap', true);
  const maskLength = mask.rowBytes * mask.height;
  const bitmapLength = bmap.rowBytes * bmap.height;
  const tableOffset = 82 + maskLength + bitmapLength;
  requireBytes(bytes, 82, maskLength + bitmapLength, 'mask and monochrome bitmap');
  requireBytes(bytes, tableOffset, 8, 'color table header');
  const tableHeader = new Reader(bytes, tableOffset);
  tableHeader.readUInt32();
  const tableFlags = tableHeader.readUInt16();
  const tableCount = tableHeader.readInt16() + 1;
  if (tableCount < 0) throw new Error('Invalid cicn color table size');
  const tableLength = 8 + tableCount * 8;
  requireBytes(bytes, tableOffset, tableLength, 'color table records');
  requireBytes(bytes, tableOffset + tableLength, pmap.rowBytes * pmap.height, 'pixel data');
  // Known unsupported variant, not malformed input; conversion records skipped.
  if (tableFlags & 0x4000) return null;

  // Pixel data sections in order.
  const maskBytes = r.readBytes(mask.rowBytes * mask.height);
  const bmapBytes = r.readBytes(bmap.rowBytes * bmap.height);
  const colorTable = readColorTable(r);
  const pixelBytes = r.readBytes(pmap.rowBytes * pmap.height);

  // Decode pixel indices -> RGB.
  const indices = expandIndexedPixels(
    pixelBytes, pmap.width, pmap.height, pmap.pixelSize, pmap.rowBytes,
  );
  // Decode mask -> alpha. Mask dimensions match pixmap dimensions in practice
  // for the pinned corpus. Different dimensions retain the legacy top-left
  // overlap/opaque-outside policy; its historical semantics remain unverified.
  const maskAlpha = expandMask(maskBytes, mask.width, mask.height, mask.rowBytes);

  return { pmap, mask, bmap, colorTable, indices, maskAlpha };
}

export function decodeCicn(bytes, { retainKdefColorSampler = false, realizeRgb16, displayPolicy, finiteTransfer } = {}) {
  const parsed = readCicnIndexed(bytes);
  if (!parsed) return null;
  const { pmap, mask, bmap, colorTable, indices, maskAlpha } = parsed;
  const transfer = finiteTransfer?.(parsed);
  const rgba = transfer ? applySourceMask(transfer.rgb, maskAlpha, pmap, mask)
    : composeRgba(indices, maskAlpha, pmap, mask, colorTable, realizeRgb16);
  const sampler = makeKdefColorSampler(indices, pmap.width, pmap.height, colorTable.entries);
  const samplingEquivalence = compareOpaqueSampling(indices, rgba, pmap, mask, sampler, realizeRgb16, displayPolicy, !!transfer);

  return {
    width: pmap.width,
    height: pmap.height,
    rgba,
    samplingEquivalence,
    ...(transfer ? { cicnTransfer: transfer.provenance } : {}),
    bodyCicnSource: inspectCicnBody(pmap, mask, bmap, colorTable, indices),
    sampledBandRgba: sampledBandPixels(indices, rgba, pmap, sampler, samplingEquivalence, realizeRgb16),
    ...(retainKdefColorSampler ? { sampleKdefRgb16: sampler } : {}),
    debug: {
      pixelSize: pmap.pixelSize,
      colorCount: colorTable.count,
      rowBytes: pmap.rowBytes,
      maskRowBytes: mask.rowBytes,
      bmapRowBytes: bmap.rowBytes,
    },
  };
}

function composeRgba(indices, maskAlpha, pmap, mask, colorTable, realizeRgb16) {
  // Apple TN QD13: bit15 clear uses ColorSpec.value; set uses position.
  // Resolve once per decode. Duplicate values use an explicit first-entry compatibility policy;
  // missing values retain black. Neither policy claims historical semantics.
  const palette = new Map();
  colorTable.entries.forEach((entry, position) => {
    const index = colorTable.flags & 0x8000 ? position : entry.value;
    if (!palette.has(index)) palette.set(index, [entry.r, entry.g, entry.b]);
  });
  const realized = new Map();
  const w = pmap.width, h = pmap.height;
  const rgba = new Uint8Array(w * h * 4);
  const sameDims = (mask.width === w && mask.height === h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = indices[i];
      let rgb = realized.get(idx);
      if (!rgb) {
        if (realizeRgb16 && !palette.has(idx)) throw new DisplayProfileError('Missing ordinary palette index', 'UNSUPPORTED_SOURCE_COLOR');
        const raw = palette.get(idx) ?? [0, 0, 0];
        rgb = realizeRgb16 ? realizeRgb16(raw) : raw.map(v => v >> 8);
        realized.set(idx, rgb);
      }
      const [r, g, b] = rgb;

      let alpha = 255;
      if (sameDims) {
        alpha = maskAlpha[i];
      } else if (x < mask.width && y < mask.height) {
        alpha = maskAlpha[y * mask.width + x];
      }

      const o = i * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = alpha;
    }
  }
  return rgba;
}

function requireBytes(bytes, offset, length, section) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0
      || offset > bytes.length || length > bytes.length - offset) {
    throw new Error(`Truncated cicn ${section}`);
  }
}

function validateBitmap(map, depth, label, allowEmpty = false) {
  if (map.width < 0 || map.height < 0 || (!allowEmpty && (!map.width || !map.height))) {
    throw new Error(`Invalid cicn ${label} dimensions`);
  }
  // A NIL monochrome fallback is valid; it has no rows to decode.
  if (allowEmpty && (!map.width || !map.height || !map.rowBytes)) return;
  if (map.rowBytes < Math.ceil(map.width * depth / 8)) {
    throw new Error(`Invalid cicn ${label} rowBytes`);
  }
}

function applySourceMask(rgb, maskAlpha, pmap, mask) {
  const rgba = new Uint8Array(pmap.width * pmap.height * 4);
  for (let y = 0; y < pmap.height; y++) for (let x = 0; x < pmap.width; x++) {
    const i = y * pmap.width + x;
    rgba.set(rgb.subarray(i * 3, i * 3 + 3), i * 4);
    rgba[i * 4 + 3] = x < mask.width && y < mask.height ? maskAlpha[y * mask.width + x] : 255;
  }
  return rgba;
}
