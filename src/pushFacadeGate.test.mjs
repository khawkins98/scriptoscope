// #608 PF-H4 unit check (push-button.md PF5): internal button preparation
// returns null when a composition's face stage is recorded unavailable, even if
// the composer handed back a non-null buffer. This is the second guard behind
// the facade; while PF3 holds a black-box consumer check cannot see it.
//
// Only the composer seam (./controls.js as imported by buttonComposition.ts) is
// replaced. The face-stage record and the preparation gate are the real modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import '../tests/helpers/registerTs.mjs';

const stub = 'data:text/javascript,' + encodeURIComponent(`
export const composeButtonWithLayout = (...args) => globalThis.__pf608Compose(...args);
export const bufferToCanvas = (buffer, scale) => ({ width: buffer.width, height: buffer.height, scale, style: {} });
`);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './controls.js' && context.parentURL?.endsWith('/src/buttonComposition.ts')) return { url: stub, shortCircuit: true };
    return next(specifier, context);
  },
});
const { prepareButtonPainter } = await import('./buttonComposition.ts');
const { recordButtonFaceStage } = await import('./controlComposition.ts');

const composition = () => ({ buffer: { width: 64, height: 24, data: new Uint8ClampedArray(64 * 24 * 4) },
  layout: { faceRect: { x: 4, y: 4, w: 56, h: 16 } } });
// stage: undefined = not recorded, true = face paint completed, false = unavailable
function composer(stages) {
  const calls = [];
  globalThis.__pf608Compose = async (_theme, options) => {
    calls.push(options.pressed ? 'pressed' : 'normal');
    const c = composition(), stage = stages[options.pressed ? 'pressed' : 'normal'];
    if (stage !== undefined) recordButtonFaceStage(c, stage);
    return c;
  };
  return calls;
}
const theme = { baseUrl: 'fixture:pf608', manifest: { chromeElements: {} } };

test('PF-H4 control: recorded (or unrecorded) completed face stages prepare a painter', async () => {
  for (const stages of [{ normal: true, pressed: true }, {}]) {
    const calls = composer(stages);
    const painter = await prepareButtonPainter(theme, { label: 'OK' }, 1);
    assert.ok(painter, JSON.stringify(stages));
    assert.deepEqual(calls, ['normal', 'pressed']);
    painter.dispose();
  }
});

test('PF-H4: a normal face stage recorded unavailable makes preparation return null', async () => {
  composer({ normal: false, pressed: true });
  assert.equal(await prepareButtonPainter(theme, { label: 'OK' }, 1), null);
  composer({ normal: false });
  assert.equal(await prepareButtonPainter(theme, { label: 'OK', disabled: true }, 1), null);
});

test('PF-H4: a pressed face stage recorded unavailable makes preparation return null', async () => {
  composer({ normal: true, pressed: false });
  assert.equal(await prepareButtonPainter(theme, { label: 'OK' }, 1), null);
  composer({ normal: true, pressed: false });
  assert.equal(await prepareButtonPainter(theme, { label: 'OK', default: true }, 1), null);
});
