// Narrow browser path for picker previews: decode requested icon families only,
// then encode one chosen icon. Full chrome/inspector conversion waits for selection.
import { convertIcons } from './convert.js';
import { detectContainer, unwrapToResourceFork } from './containers.js';

export async function loadKaleidoscopeIcon(bytes, ids, assetUrlFactory = iconDataUrl) {
  let fork;
  if (detectContainer(bytes) === 'stuffit') {
    const { stuffItResourceFork } = await import('../sit-wasm/index.mjs');
    fork = await stuffItResourceFork(bytes);
  } else {
    fork = unwrapToResourceFork(bytes);
  }
  const { assets, index } = convertIcons(fork, { ids });
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
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('loadKaleidoscopeIcon: no 2d context');
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  const blob = typeof canvas.convertToBlob === 'function'
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('canvas.toBlob returned null')),
      'image/png',
    ));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  return `data:image/png;base64,${encoded}`;
}
