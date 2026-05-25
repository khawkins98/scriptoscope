// scripts/generate-platinum/slice-icons.mjs
// Finder folder icons for the demo SCENE, sliced from a real Mac OS 8 screenshot
// (sources/folder-icons-system-webpages.png, #21). The scene's schemeIcons()
// reads icons/index.json and picks Finder-content folder IDs (-3983 System Folder,
// -3999 Generic Folder); without them the replica fell back to neutral SVG folders.
// White background → transparent so the icons composite on the window body.
import { decodePng, encodePng } from '../diag-lib.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = 'sources/folder-icons-system-webpages.png';
const ICONS = [
  { id: -3983, name: 'system-folder', rect: [37, 14, 32, 32] }, // badged System Folder
  { id: -3999, name: 'folder', rect: [37, 78, 32, 32] },        // plain folder (Web Pages)
];

/** Slice the folder icons into destDir/icons + write index.json. */
export function sliceIcons(destDir) {
  const src = resolve(destDir, SRC);
  if (!existsSync(src)) return { count: 0 };
  const im = decodePng(readFileSync(src));
  mkdirSync(resolve(destDir, 'icons'), { recursive: true });
  const index = [];
  for (const ic of ICONS) {
    const [x, y, w, h] = ic.rect;
    const out = new Uint8Array(w * h * 4);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const si = ((y + yy) * im.width + (x + xx)) * 4, di = (yy * w + xx) * 4;
      const r = im.rgba[si], g = im.rgba[si + 1], b = im.rgba[si + 2];
      out[di] = r; out[di + 1] = g; out[di + 2] = b;
      out[di + 3] = (r > 235 && g > 235 && b > 235) ? 0 : 255; // near-white bg → transparent
    }
    const file = `icl4-n${-ic.id}-${ic.name}.png`;
    writeFileSync(resolve(destDir, 'icons', file), encodePng(w, h, out));
    index.push({ id: ic.id, type: 'icl4', file, width: w, height: h, coverage: 0.5 });
  }
  writeFileSync(resolve(destDir, 'icons/index.json'), JSON.stringify(index, null, 2));
  return { count: ICONS.length };
}
