import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCinf } from './decoders/cinf.js';

test('cinf preserves independent mode/repeat bytes and signed ID/y-x sample words', () => {
  // Hand-authored 18-byte header: c4/s1, repeat7, mode5, ID-2,
  // background(y=-3,x=4), text(y=5,x=-6), emboss(y=-7,x=8).
  // No encoder, generated theme or renderer supplies the expected values.
  const bytes = Uint8Array.of(4, 1, 7, 5, 0xff, 0xfe,
    0xff, 0xfd, 0, 4, 0, 5, 0xff, 0xfa, 0xff, 0xf9, 0, 8);
  const { resizeBehavior, ...fields } = decodeCinf(bytes);
  assert.deepEqual(fields, {
    cornerSize: 4, sideThickness: 1, tileSides: 7, patternAnchor: 5,
    bgPatternId: -2, bgPixel: { x: 4, y: -3 }, textPixel: { x: -6, y: 5 },
    embossPixel: { x: 8, y: -7 },
  });
  // A non-5 mode retains the background ID too. Label strings are a separate
  // compatibility API; this fixture does not certify original body rendering.
  bytes[3] = 2;
  const other = decodeCinf(bytes);
  assert.equal(other.patternAnchor, 2);
  assert.equal(other.bgPatternId, -2);
  assert.equal(other.tileSides, 7);
});
