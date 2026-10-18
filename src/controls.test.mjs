import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { loadPushButtonFace } = await import('./controls.ts');

test('button face inheritance is self-first across named and canonical resources', async (t) => {
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  const loaded = [];
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    async decode() { loaded.push(this.src); }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
  }) }) };
  const base = { baseUrl: '/base', manifest: { chromeElements: {
    'push-button-active': { asset: 'base.png', sourceCicnId: -10239 },
  } } };
  const child = { baseUrl: '/child', base, manifest: { chromeElements: {
    'cicn--10239': { asset: 'child.png', sourceCicnId: -10239 },
  } } };
  await loadPushButtonFace(child, 'active');
  assert.deepEqual(loaded, ['/child/child.png']);

  child.manifest.chromeElements['push-button-active'] = { asset: 'named-child.png' };
  await loadPushButtonFace(child, 'active');
  assert.equal(loaded.at(-1), '/child/named-child.png');
  delete child.manifest.chromeElements['push-button-active'];
  child.manifest.chromeElements['cicn--10239'].authorLabel = 'Solo Menu Background';
  await loadPushButtonFace(child, 'active');
  assert.equal(loaded.at(-1), '/base/base.png');

  delete child.manifest.chromeElements['cicn--10239'].authorLabel;
  child.manifest.chromeElements['menu-background'] = child.manifest.chromeElements['cicn--10239'];
  delete child.manifest.chromeElements['cicn--10239'];
  base.manifest.chromeElements = {};
  base.base = child; // Missing face in a cycle still terminates.
  assert.equal(await loadPushButtonFace(child, 'active'), null);
});
