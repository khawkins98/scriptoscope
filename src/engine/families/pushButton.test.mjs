// Implementation-owned smoke checks, derived from push-button.md PB/DR rows.
// The independent acceptance oracle is maintained and run separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../tests/helpers/registerTs.mjs';
const { drawPushButton, pushLabelLines, pushButtonTextMode } = await import('./pushButton.ts');
const { PUSH_BUTTON: P } = await import('../tables/pushButton.ts');
const { ResourceChain, mapProvider } = await import('../resources/chain.ts');
const { createTrace } = await import('../trace.ts');
const pm = (w = 24, h = 24) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const D = { left: 5, top: 5, right: 19, bottom: 19 };
const cinf = { cornerSize: 1, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: -7,
  bgPixel: { x: 0, y: 0 }, textPixel: { x: 1, y: 0 }, embossPixel: { x: 2, y: 0 } };
const icon = () => { const pixmap = pm(4, 4); pixmap.data.fill(255); return { pixmap, pixelSize: 8, unmasked: pixmap,
  sampling: 'equivalent', sampleRgb16: p => p.x === 0 ? [65535, 65535, 65535] : p.x === 1 ? [0, 0, 0] : [123, 456, 789] }; };
const chain = entries => new ResourceChain([mapProvider('synthetic', 'archive', entries)]);
const input = extra => ({ rect: D, hilite: 0, depth: 32, lowDepth: false, ...extra });
const env = { realize: rgb => ({ r: rgb[0] >>> 8, g: rgb[1] >>> 8, b: rgb[2] >>> 8, a: 255 }) };

test('guard callbacks do not enter resource lookup', () => {
  const trace = createTrace('push-button');
  let recording;
  drawPushButton(pm(), chain([]), input({ visible: false, regionRecording: true }), { frameRoundRect: () => assert.fail() }, trace);
  drawPushButton(pm(), chain([]), input({ regionRecording: true }), { frameRoundRect: (...args) => { recording = args; } }, trace);
  assert.deepEqual(trace.resolved, []); assert.deepEqual(recording, [D, 8, 8]);
});
test('face NULL stops metadata; disabled does not borrow another state', () => {
  const trace = createTrace('push-button');
  const result = drawPushButton(pm(), chain([[`cicn:${P.PB7.resource}`, icon()]]), input({ hilite: 255 }), env, trace);
  assert.equal(result.faceFound, false);
  assert.deepEqual(trace.resolved.map(r => [r.type, r.id]), [['cicn', P.PB5.resource]]);
});
test('pressed ring retries missing art, and metadata-only miss succeeds without retry', () => {
  const trace = createTrace('push-button');
  const entries = [[`cicn:${P.PB6.resource}`, icon()], [`cinf:${P.PB6.resource}`, cinf], [`cicn:${P.DR3.resource}`, icon()]];
  const result = drawPushButton(pm(), chain(entries), input({ hilite: 1, defaultDataValid: true, defaultFlag: 9 }), env, trace);
  assert.equal(result.ringFound, true);
  assert.equal(trace.resolved.some(r => r.type === 'cicn' && r.id === P.DR4.resource), false);
  assert.deepEqual(trace.resolved.slice(-3).map(r => [r.type, r.id]), [['cicn', P.DR3.resource], ['cinf', P.DR3.resource], ['cinf', 1]]);
  const retryTrace = createTrace('push-button');
  drawPushButton(pm(), chain(entries.filter(([key]) => key !== `cicn:${P.DR3.resource}`)), input({ hilite: 1, defaultDataValid: true, defaultFlag: 1 }), env, retryTrace);
  assert.deepEqual(retryTrace.resolved.slice(-2).map(r => [r.type, r.id]), [['cicn', P.DR3.resource], ['cicn', P.DR4.resource]]);
});
test('body, emboss, text, ring order and face clip', () => {
  const out = pm(), trace = createTrace('push-button'), calls = [];
  const resources = chain([[`cicn:${P.PB7.resource}`, icon()], [`cinf:${P.PB7.resource}`, cinf],
    [`cicn:${P.DR4.resource}`, icon()], [`cinf:${P.DR4.resource}`, cinf]]);
  drawPushButton(out, resources, input({ label: 'X', defaultDataValid: true, defaultFlag: 1 }), { ...env,
    fontMetrics: { ascent: 7, descent: 2, leading: 1 }, textWidth: () => 4,
    drawLabel: pass => { calls.push(pass); assert.equal(out.data[(10 * out.width + 10) * 4 + 3], 255); }
  }, trace);
  assert.deepEqual(calls.map(p => p.offset), [{ x: 1, y: 1 }, { x: 0, y: 0 }]);
  assert.deepEqual(calls[0].clip, D);
  const lastLabel = trace.drawOps.findLastIndex(op => op.op === 'label');
  assert.ok(trace.drawOps.slice(lastLabel + 1).some(op => op.row === 'B0'));
  assert.equal(trace.resolved.filter(r => r.type === 'ppat').length, 1);
});
test('raw red sentinel suppresses emboss before display conversion', () => {
  const art = icon(); art.sampleRgb16 = p => p.x === 2 ? [0x1234, 65535, 0] : [65535, 65535, 65535];
  const calls = [];
  drawPushButton(pm(), chain([[`cicn:${P.PB7.resource}`, art], [`cinf:${P.PB7.resource}`, cinf]]), input({ label: 'X' }), {
    ...env, fontMetrics: { ascent: 7, descent: 2, leading: 0 }, textWidth: () => 3, drawLabel: p => calls.push(p),
  });
  assert.equal(calls.length, 1); assert.equal(calls[0].offset.x, 0);
});
test('plain label geometry uses truncation and short-line adjustment', () => {
  assert.deepEqual(pushLabelLines({ left: -10, top: 2, right: 5, bottom: 23 }, 'A\rB', { ascent: 7, descent: 2, leading: 1 }, () => 4),
    [{ text: 'A', x: -4, baseline: 8 }, { text: 'B', x: -4, baseline: 18 }]);
});

test('text-mode model remains independent from unsupported mono pixel execution', () => {
  assert.equal(pushButtonTextMode(255, 2), 49); assert.equal(pushButtonTextMode(255, 4), 1);
  assert.equal(pushButtonTextMode(1, 2), 1);
  const trace = createTrace('push-button'), out = pm();
  const result = drawPushButton(out, chain([[`cicn:${P.PB5.resource}`, icon()]]), input({ hilite: 255, depth: 2, lowDepth: true }), env, trace);
  assert.match(result.unsupported, /low-depth/); assert.deepEqual(trace.resolved, []);
  assert.equal(out.data.some(Boolean), false);
});

test('mode5 uses a scaled opaque body icon in the side inset', () => {
  const face = icon(); face.pixmap.data.fill(0);
  const masked = pm(2, 1), opaque = pm(2, 1);
  opaque.data.set([200, 0, 0, 255, 0, 0, 200, 255]);
  const body = { pixmap: masked, pixelSize: 8, unmasked: opaque };
  const resources = chain([[`cicn:${P.PB7.resource}`, face], [`cinf:${P.PB7.resource}`, { ...cinf, cornerSize: 2, patternAnchor: 5 }], ['cicn:-7', body]]);
  const out = pm(); drawPushButton(out, resources, input({}), env);
  const pixel = (x, y) => [...out.data.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 4)];
  assert.deepEqual(pixel(6, 6), [200, 0, 0, 255]);
  assert.deepEqual(pixel(17, 6), [0, 0, 200, 255]);
  assert.deepEqual(pixel(10, 5), [0, 0, 0, 0]);
});
test('tile-side strips repeat forward and keep the leading partial tile', () => {
  const art = icon(); art.pixmap = pm(5, 5); art.unmasked = art.pixmap;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) art.pixmap.data.set([x * 10 + y * 40, 0, 0, 255], (y * 5 + x) * 4);
  const out = pm();
  drawPushButton(out, chain([[`cicn:${P.PB7.resource}`, art], [`cinf:${P.PB7.resource}`, { ...cinf, tileSides: 1 }]]),
    input({ rect: { ...D, right: 18 } }), env);
  assert.deepEqual([6, 7, 8, 9, 16].map(x => out.data[(5 * out.width + x) * 4]), [10, 20, 30, 10, 20]);
});
test('metadata fallback and disabled ring keep their separate NULL rules', () => {
  const trace = createTrace('push-button');
  drawPushButton(pm(), chain([[`cicn:${P.PB5.resource}`, icon()], ['cinf:0', cinf], [`cicn:${P.DR4.resource}`, icon()]]),
    input({ hilite: 254, defaultDataValid: true, defaultFlag: 1 }), env, trace);
  assert.deepEqual(trace.resolved.map(r => [r.type, r.id]), [['cicn', P.PB5.resource], ['cinf', P.PB5.resource], ['cinf', 0], ['ppat', -7], ['cicn', P.DR2.resource]]);
});
test('raw unequal RGB16 values that display identically still retain emboss', () => {
  const art = icon(); art.sampleRgb16 = p => p.x === 2 ? [257, 257, 257] : [256, 256, 256];
  const calls = [];
  drawPushButton(pm(), chain([[`cicn:${P.PB7.resource}`, art], [`cinf:${P.PB7.resource}`, cinf]]), input({ label: 'X' }), {
    ...env, fontMetrics: { ascent: 7, descent: 2, leading: 0 }, textWidth: () => 3, drawLabel: p => calls.push(p),
  });
  assert.equal(calls.length, 2); assert.deepEqual(calls[0].color, calls[1].color);
});

test('final-CR labels leave the unknown text stage unpainted and retain the ring', () => {
  const trace = createTrace('push-button');
  const result = drawPushButton(pm(), chain([[`cicn:${P.PB7.resource}`, icon()], [`cinf:${P.PB7.resource}`, cinf],
    [`cicn:${P.DR4.resource}`, icon()], [`cinf:${P.DR4.resource}`, cinf]]), input({ label: 'X\r', defaultDataValid: true, defaultFlag: 1 }), {
    ...env, fontMetrics: { ascent: 7, descent: 2, leading: 0 }, textWidth: () => 3, drawLabel: () => assert.fail('unknown label drawn'),
  }, trace);
  assert.equal(result.ringFound, true);
  assert.ok(trace.drawOps.some(op => op.op === 'label' && /final carriage-return/.test(op.unspecified)));
});
