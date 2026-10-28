// Implementation-owned probes derived solely from engine/checkables.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../tests/helpers/registerTs.mjs';
const { drawCheckable, checkableLabelLines } = await import('./checkables.ts');
const { ResourceChain, mapProvider } = await import('../resources/chain.ts');
const { createTrace } = await import('../trace.ts');
const D = { left: 0, top: 0, right: 40, bottom: 20 };
const input = { rect: D, variation: 1, hilite: 0, value: 0, acidAlternate: false, colorPort: true, lowDepth: false, colorIconMapAvailable: true };
const pm = (w = 16, h = 16, rgb = [21, 42, 63]) => ({ width: w, height: h, data: new Uint8ClampedArray(Array.from({ length: w * h }, () => [...rgb, 255]).flat()) });
const empty = () => new ResourceChain([]);
const chain = entries => new ResourceChain([mapProvider('System', 'archive', entries)]);
const mask = () => ({ planes: [...Array(32).fill(128), ...Array(32).fill(128)] });
const monoColors = { foreground: { r: 1, g: 2, b: 3, a: 255 }, background: { r: 4, g: 5, b: 6, a: 255 } };

test('mixed cicn NULL retries same tier and icon re-reads original mixed value', () => {
 const trace = createTrace('checkables'), system = chain([['ics#:-10234', mask()], ['ics8:-10234', pm()]]);
 const result = drawCheckable(pm(40, 30), empty(), { ...input, value: 2 }, { systemResources: system }, trace);
 assert.equal(result.drawn, true);
 assert.deepEqual(trace.resolved.map(r => [r.type, r.id]), [['cicn', -9497], ['cicn', -9500], ['ics#', -10234], ['ics#', -10234], ['ics8', -10234]]);
});

test('unknown cicn stops fallback and remains visible', () => {
 const trace = createTrace('checkables');
 const result = drawCheckable(pm(), chain([['cicn:-9497', { status: 'unknown', reason: 'broken decoder' }]]), { ...input, value: 2 }, { systemResources: empty() }, trace);
 assert.match(result.unsupported, /broken decoder/); assert.equal(trace.resolved.length, 1);
});

test('full nonzero cicn bounds, negative truncation, and label/erase order survive', () => {
 const art = { pixmap: pm(3, 3), pixelSize: 8, unmasked: null, origin: { left: 9, top: 7 } };
 const trace = createTrace('checkables'), events = [];
 drawCheckable(pm(40, 30), chain([['cicn:-9503', art]]), { ...input, rect: { ...D, top: -5, bottom: 3 }, eraseControl: true, label: 'Hi' }, {
 systemResources: empty(), fontMetrics: { ascent: 6, descent: 2, leading: 0 }, drawLabel: () => events.push('label'), erase: (_, m) => events.push(m ? 'mask' : 'control'),
 }, trace);
 assert.deepEqual(events, ['control', 'label', 'mask']);
 const op = trace.drawOps.find(o => o.operation === 'cornerFullBounds');
 assert.deepEqual(op.src, { left: 9, top: 7, right: 12, bottom: 10 });
 assert.equal(op.dst.left, 7); assert.equal(op.dst.top, -2);
});

test('System mask owner restricts colour lookup; missing colour does not retry value', () => {
 const trace = createTrace('checkables');
 const system = new ResourceChain([mapProvider('System', 'archive', [['ics#:-10234', mask()]]), mapProvider('Other', 'base', [['ics8:-10234', pm()]])]);
 drawCheckable(pm(40, 30), empty(), { ...input, value: 2 }, { systemResources: system, monoColors }, trace);
 assert.deepEqual(trace.resolved.filter(r => r.type === 'ics8').map(r => r.found), [false]);
 assert.equal(trace.resolved.filter(r => r.type === 'ics#').length, 2);
 assert.equal(trace.drawOps.find(o => o.transfer)?.row, 'CB21');
});

test('colour ignores custom bottlenecks while mono uses CopyBits', () => {
 for (const color of [true, false]) {
 const trace = createTrace('checkables'), entries = [['ics#:-10236', mask()]];
 if (color) entries.push(['ics8:-10236', pm()]);
 drawCheckable(pm(40, 30), empty(), { ...input, customBottlenecks: true }, { systemResources: chain(entries), monoColors }, trace);
 assert.equal(trace.drawOps.find(o => o.transfer)?.row, color ? 'CB23' : 'CB20');
 }
});

test('disabled precedence and alternate radio conversions differ by lane', () => {
 const trace = createTrace('checkables');
 drawCheckable(pm(), empty(), { ...input, variation: 4, value: 1, hilite: 254, acidAlternate: true }, { systemResources: empty() }, trace);
 assert.deepEqual(trace.resolved.map(r => r.id), [-9489, -10223, -10223]);
 assert.equal(trace.drawOps.find(o => o.row === 'CB3,CB4').cicnTier, 0);
});

test('low depth never requests colour; missing mono RGB remains unsupported', () => {
 const trace = createTrace('checkables');
 const result = drawCheckable(pm(), empty(), { ...input, lowDepth: true }, { systemResources: chain([['ics#:-10236', mask()]]) }, trace);
 assert.match(result.unsupported, /RGB mapping/);
 assert.equal(trace.resolved.some(r => r.type === 'ics8'), false);
});

test('icon erases 12 rows before drawing 16, using floor at negative coordinates', () => {
 const trace = createTrace('checkables');
 drawCheckable(pm(), empty(), { ...input, rect: { ...D, top: -2, bottom: 1 } }, { systemResources: chain([['ics#:-10236', mask()]]), monoColors }, trace);
 const erased = trace.drawOps.find(o => o.row === 'CB24').dst, drawn = trace.drawOps.find(o => o.transfer).dst;
 assert.equal(erased.top, -7); assert.equal(erased.bottom, 5); assert.equal(drawn.bottom, 9);
});

test('label has fixed x and no push short-line baseline correction', () => {
 assert.deepEqual(checkableLabelLines(D, 'one\rtwo', { ascent: 6, descent: 2, leading: 0 }), [
 { text: 'one', x: 18, baseline: 8 }, { text: 'two', x: 18, baseline: 16 }]);
});

test('invisible/recording guards never request resources and unknown values never index a table', () => {
 const trace = createTrace('checkables'), framed = [];
 drawCheckable(pm(), empty(), { ...input, visible: false, regionRecording: true }, { systemResources: empty() }, trace);
 drawCheckable(pm(), empty(), { ...input, regionRecording: true }, { systemResources: empty(), frameRect: r => framed.push(r) }, trace);
 assert.deepEqual(trace.resolved, []); assert.deepEqual(framed, [D]);
 assert.match(drawCheckable(pm(), empty(), { ...input, value: 4 }, { systemResources: empty() }).unsupported, /outside decoded/);
});

test('one clear mask bit defeats all-set transfer; picture recording forces opaque colour pixels', () => {
 const planes = Array(64).fill(255); planes[63] = 254;
 for (const recordingPicture of [false, true]) {
 const trace = createTrace('checkables'), out = pm(40, 30, [240, 240, 240]);
 drawCheckable(out, empty(), { ...input, recordingPicture }, { systemResources: chain([['ics#:-10236', { planes }], ['ics8:-10236', pm()]]) }, trace);
 assert.equal(trace.drawOps.find(o => o.transfer)?.row, recordingPicture ? 'CB22' : 'CB23');
 const offset = (19 * out.width + 15) * 4;
 assert.equal(out.data[offset], recordingPicture ? 21 : 240);
 }
});

test('missing mixed mask retries checked at same pressed tier, then repeats helper request', () => {
 const trace = createTrace('checkables');
 drawCheckable(pm(40, 30), empty(), { ...input, value: 2, hilite: 1 }, { systemResources: chain([['ics#:-10231', mask()]]), monoColors }, trace);
 assert.deepEqual(trace.resolved.map(r => r.id), [-9496, -9499, -10230, -10231, -10231]);
});

test('positive and negative logical origins translate image and mask holes together without cropping', () => {
 for (const origin of [{ left: 9, top: 7 }, { left: -9, top: -7 }]) {
 const art = pm(3, 3); art.data[19] = 0;
 const out = pm(40, 30, [240, 240, 240]), trace = createTrace('checkables');
 drawCheckable(out, chain([['cicn:-9503', { pixmap: art, origin, pixelSize: 8, unmasked: null }]]), input, {
 systemResources: empty(), erase: (r, mask) => {
 assert.deepEqual(mask.storageOrigin, { x: origin.left, y: origin.top });
 for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!mask.source.data[(y * 3 + x) * 4 + 3])
 out.data[((r.top + y) * out.width + r.left + x) * 4 + 3] = 0;
 },
 }, trace);
 const op = trace.drawOps.find(o => o.operation === 'cornerFullBounds');
 assert.deepEqual(op.storageRect, { left: 0, top: 0, right: 3, bottom: 3 });
 assert.equal(out.data[(9 * out.width + 8) * 4 + 3], 0);
 assert.equal(out.data[(8 * out.width + 7) * 4], 21);
 }
});
