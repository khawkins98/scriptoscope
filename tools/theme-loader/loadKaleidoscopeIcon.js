import { encodeRasterPng } from './encodeRasterPng.js';
import { displayRealizer } from './display-profile.js';
// Narrow browser path for picker previews: decode requested icon families only,
// then encode one chosen icon. Full chrome/inspector conversion waits for selection.
import { convertIcons } from './convert.js';
import { detectContainer, unwrapToResourceFork } from './containers.js';

export async function loadKaleidoscopeIcon(bytes, ids, assetUrlFactory = iconDataUrl, displayProfile) {
  displayRealizer(displayProfile);
  let fork;
  if (detectContainer(bytes) === 'stuffit') {
    const { stuffItResourceFork } = await import('../sit-wasm/index.mjs');
    fork = await stuffItResourceFork(bytes);
  } else {
    fork = unwrapToResourceFork(bytes);
  }
  const { assets, index } = convertIcons(fork, { ids, displayProfile });
  for (const id of ids) {
    const hit = index.find((entry) => entry.id === id && entry.size === 32)
      ?? index.find((entry) => entry.id === id);
    if (!hit) continue;
    const asset = assets.find((entry) => entry.path === `icons/${hit.file}`);
    if (asset) return await assetUrlFactory(asset.rgba, asset.width, asset.height, asset.path);
  }
  return null;
}

// A tiny self-contained PNG avoids global blob URL ownership. Picker tiles stay
// in the DOM in OFF mode, and dropping their DOM references releases the data.
async function iconDataUrl(rgba, width, height) {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  const blob = await encodeRasterPng(canvas, rgba, width, height);
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  return `data:image/png;base64,${encoded}`;
}
