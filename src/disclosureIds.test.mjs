import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { composeDisclosure } = await import('./controls.ts');

// #595: the disclosure family resolves by its canonical signed state ids,
// right/down × normal/pressed/inactive. Evidence: author labels in
// docs/spec/corpus-author-labels.json (1138, animals, beos-r503: "Right Pointing
// Disclosure Triangle" = -10111, "Pressed Right ..." = -10110, "Inactive Right
// ... Tringle" = -10112, "Down Pointing ..." = -10103, "Pressed Down ..." =
// -10102, "Inactive Down ..." = -10104; 1990/dolphin-som/evolution "Normal /
// Pressed / Disabled Right|Down Point Arrow" on the same ids; 1984/floppies/
// crayon-os "Disclosure Triangle Closed|Open Active|Inactive|Pressed").
const CANONICAL = {
  right: { normal: -10111, pressed: -10110, disabled: -10112, inactive: -10112 },
  down: { normal: -10103, pressed: -10102, disabled: -10104, inactive: -10104 },
};

// chromeElements keys + signed ids exactly as the theme loader bakes them
// (`npm run build:themes`, themes/<slug>/theme.json).
const SCHEMES = {
  'windows-95': [
    ['cicn--10112', -10112], ['cicn--10111', -10111], ['cicn--10110', -10110],
    ['cicn--10103', -10103], ['cicn--10104', -10104], ['cicn--10102', -10102],
  ],
  1138: [
    ['inactive-right-pointing-disclosure-tringle', -10112], ['right-pointing-disclosure-triangle', -10111],
    ['pressed-right-pointing-disclosure-triangle', -10110], ['inactive-down-pointing-disclosure-triangle', -10104],
    ['down-pointing-disclosure-triangle', -10103], ['pressed-down-pointing-disclosure-triangle', -10102],
  ],
  1984: [
    ['cicn--10110', -10110], ['cicn--10102', -10102],
    ['disclosure-triangle-closed-inactive', -10112], ['disclosure-triangle-closed-active', -10111],
    ['disclosure-triangle-open-inactive', -10104], ['disclosure-triangle-open-active', -10103],
  ],
  1990: [
    ['disabled-right-point-arrow', -10112], ['normal-right-point-arrow', -10111], ['pressed-right-point-arrow', -10110],
    ['disabled-down-point-arrow', -10104], ['normal-down-point-arrow', -10103], ['pressed-down-point-arrow', -10102],
  ],
  // Ships only the two normal triangles (plus animation frames -10109..-10107,
  // -10101..-10099): pressed/inactive fall back to the same direction's normal.
  'crayon-os': [
    ['disclosure-triangle-closed-active', -10111], ['disclosure-triangle-open-active', -10103],
    ['disclosure-triangle-opening-frame-one', -10109], ['disclosure-triangle-closing-frame-one', -10101],
  ],
  // No disclosure cicns at all: procedural Platinum (null).
  'platinum-8': [],
};

function stubImages(t) {
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  const loaded = [];
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; async decode() { loaded.push(this.src); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
  }) }) };
  return loaded;
}

// A fresh base URL per call so the image cache cannot mask which asset was chosen.
const themeFor = (slug, entries, run) => ({ baseUrl: `/${slug}/${run}`, manifest: { chromeElements: Object.fromEntries(
  entries.map(([key, id]) => [key, { asset: `${id}.png`, sourceCicnId: id }])) } });

test('disclosure triangles resolve by canonical signed state id per direction and state', async (t) => {
  const loaded = stubImages(t);
  for (const [slug, entries] of Object.entries(SCHEMES)) {
    const shipped = new Set(entries.map(([, id]) => id));
    for (const direction of ['right', 'down']) for (const state of ['normal', 'pressed', 'disabled', 'inactive']) {
      loaded.length = 0;
      const out = await composeDisclosure(themeFor(slug, entries, `${direction}-${state}`), { direction, state });
      const exact = CANONICAL[direction][state], normal = CANONICAL[direction].normal;
      const expected = shipped.has(exact) ? exact : shipped.has(normal) ? normal : null;
      const label = `${slug} ${direction}/${state}`;
      if (expected === null) { assert.equal(out, null, label); continue; }
      assert.notEqual(out, null, label);
      assert.equal(loaded.at(-1), `/${slug}/${direction}-${state}/${expected}.png`, label);
    }
  }
});
