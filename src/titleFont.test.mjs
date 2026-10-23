import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { truncateTitle } = await import('./titleFont.ts');
// TX5 truncEnd with the declared substitute face: retain the end marker even
// when no prefix plus marker fits; fitting titles are never changed (TF1).
const measure = text => Array.from(text).reduce((n, c) => n + (c === '…' ? 3 : 5), 0);
test('TF1/TX5: exact fit, longest prefix, ellipsis-only and Unicode glyph boundaries', () => {
  for (const [text, room, expected] of [['AB', 10, 'AB'], ['AB', 9, 'A…'], ['AB', 7, '…'], ['AB', 3, '…'], ['AB', 0, '…'], ['😀BC', 8, '😀…'], ['', 0, '']]) {
    assert.equal(truncateTitle(text, room, measure), expected, `${text}/${room}`);
  }
});
