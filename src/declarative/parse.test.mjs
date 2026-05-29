// Node test for the pure declarative parsing (DOM-free). Run under --experimental-strip-types so
// the `.ts` import resolves; this file is plain .mjs so it isn't in the tsc include.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
} from './parse.ts';

test('parseWindowAttrs: defaults (no attrs) → document-window, active, fit', () => {
  const p = parseWindowAttrs({});
  assert.equal(p.windowType, 'document-window');
  assert.equal(p.state, 'active');
  assert.equal(p.sizeMode, 'fit');
  assert.equal(p.title, undefined);
  assert.equal(p.x, undefined);
});

test('parseWindowAttrs: sizeMode = declared when EITHER dimension is present', () => {
  assert.equal(parseWindowAttrs({ scriptoscopeWidth: '200', scriptoscopeHeight: '120' }).sizeMode, 'declared');
  assert.equal(parseWindowAttrs({ scriptoscopeWidth: '200' }).sizeMode, 'declared');
  assert.equal(parseWindowAttrs({ scriptoscopeHeight: '120' }).sizeMode, 'declared');
  assert.equal(parseWindowAttrs({}).sizeMode, 'fit');
});

test('parseWindowAttrs: numbers + inactive + title + window-type', () => {
  const p = parseWindowAttrs({
    scriptoscopeX: '10', scriptoscopeY: '20', scriptoscopeWidth: '300', scriptoscopeHeight: '150',
    scriptoscopeState: 'inactive', scriptoscopeTitle: 'Hi', scriptoscopeWindowType: 'dialog',
  });
  assert.deepEqual([p.x, p.y, p.width, p.height], [10, 20, 300, 150]);
  assert.equal(p.state, 'inactive');
  assert.equal(p.title, 'Hi');
  assert.equal(p.windowType, 'dialog');
  assert.equal(p.sizeMode, 'declared');
});

test('parseWindowAttrs: empty / NaN numbers → undefined', () => {
  const p = parseWindowAttrs({ scriptoscopeX: '', scriptoscopeY: 'abc', scriptoscopeWidth: '  ' });
  assert.equal(p.x, undefined);
  assert.equal(p.y, undefined);
  assert.equal(p.width, undefined);
  assert.equal(p.sizeMode, 'fit'); // both dims unparseable ⇒ fit
});

test('parseButtonAttrs: presence flags + label trim', () => {
  assert.deepEqual(parseButtonAttrs({ scriptoscopeDefault: '' }, '  OK  '), { isDefault: true, disabled: false, label: 'OK' });
  assert.deepEqual(parseButtonAttrs({ scriptoscopeDisabled: '' }, ''), { isDefault: false, disabled: true });
  assert.equal(parseButtonAttrs({ scriptoscopeDefault: 'false' }, 'x').isDefault, false); // explicit false
});

test('resolveThemeRef: nearest-ancestor (innermost) wins, else pageDefault', () => {
  assert.equal(resolveThemeRef(['1138', null, 'beos-r503']), 'beos-r503');
  assert.equal(resolveThemeRef([null, undefined, '']), undefined);
  assert.equal(resolveThemeRef([null], 'apple-platinum-2'), 'apple-platinum-2');
  assert.equal(resolveThemeRef(['a'], 'def'), 'a');
  assert.equal(resolveThemeRef(['  outer  ', '  inner  ']), 'inner'); // trims
});

test('isThemeUrl + themeRefToUrl: slug vs url', () => {
  assert.equal(isThemeUrl('https://x/y'), true);
  assert.equal(isThemeUrl('/themes/1138'), true);
  assert.equal(isThemeUrl('./t/1138'), true);
  assert.equal(isThemeUrl('1138'), false);
  assert.equal(themeRefToUrl('1138', '/themes'), '/themes/1138');
  assert.equal(themeRefToUrl('1138', '/themes/'), '/themes/1138'); // strips trailing slash
  assert.equal(themeRefToUrl('https://x/y', '/themes'), 'https://x/y'); // url passthrough
});
