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
  expandIndexedPixels, expandMask, indexToRgb,
} from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw cicn resource bytes
 * @returns {{width: number, height: number, rgba: Uint8Array, debug: object}}
 */
export function decodeCicn(bytes) {
  const r = new Reader(bytes);

  const pmap = readPixMap(r);
  const mask = readBitMap(r);
  const bmap = readBitMap(r);
  const iconDataHandle = r.readUInt32(); // ignored (0 in resource)

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
  // for cicn resources; if they differ (rare), we resize via nearest-neighbor.
  const maskAlpha = expandMask(maskBytes, mask.width, mask.height, mask.rowBytes);

  const rgba = composeRgba(indices, maskAlpha, pmap, mask, colorTable);

  return {
    width: pmap.width,
    height: pmap.height,
    rgba,
    debug: {
      pixelSize: pmap.pixelSize,
      colorCount: colorTable.count,
      rowBytes: pmap.rowBytes,
      maskRowBytes: mask.rowBytes,
      bmapRowBytes: bmap.rowBytes,
    },
  };
}

function composeRgba(indices, maskAlpha, pmap, mask, colorTable) {
  const w = pmap.width, h = pmap.height;
  const rgba = new Uint8Array(w * h * 4);
  const sameDims = (mask.width === w && mask.height === h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = indices[i];
      const [r, g, b] = indexToRgb(idx, colorTable);

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
