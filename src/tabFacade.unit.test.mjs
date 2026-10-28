// Implementation-owned CS4/AD5 checks from engine/tab.md §6.1 and display-profile.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../tests/helpers/registerTs.mjs';
const { tabBodyColors, composeEngineTab } = await import('./tabFacade.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { prepareDisplayProfile } = await import('../tools/theme-loader/display-profile.js');
const profile = await prepareDisplayProfile({ version: 1, conditions: { synthetic: true },
  evidence: [{ sha256: '0'.repeat(64), description: 'Implementation-owned synthetic finite profile' }],
  devicePalette: [{ index: 0, rgb16: [0, 0, 0] }],
  mappings: [{ rgb16: [0, 0, 0], deviceIndex: 0, deviceRgb16: [0, 0, 0] }],
  producer: { model: 'rgb16-high-byte-table', channels: Array.from({ length: 3 }, () => Array.from({ length: 256 }, (_, i) => i)) } });
const owner = { manifest: { displayProfile: profile } };
const source = PixelBuffer.alloc(1, 1);
const sample = rgb16 => ({ rgb16, displayRgb: [0, 0, 0] });
const element = background => ({ asset: 'synthetic.png', width: 1, height: 1, bgAnchor: [0, 0], textAnchor: [0, 0], embossAnchor: [0, 0],
  colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: profile.id, background,
    text: sample([257, 257, 257]), emboss: sample([514, 514, 514]), embossDecision: 'present' } });
test('unused native samples need no finite mapping for empty/pattern centre', () => {
  const result = tabBodyColors(element(sample([257, 257, 257])), owner, source, false, false, false);
  assert.equal(result.backgroundRGB, null); assert.equal(result.textRGB, null); assert.equal(result.embossRGB, null);
  assert.equal(result.failure, undefined);
});
test('required missing exact background mapping stays unavailable with concrete reason', () => {
  const result = tabBodyColors(element(sample([257, 257, 257])), owner, source, false, false, true);
  assert.equal(result.backgroundRGB, null);
  assert.equal(result.failure, 'background-display-mapping:MISSING_MAPPING');
});
test('needed mapped background is realized once without querying unused native outputs', () => {
  const result = tabBodyColors(element(sample([0, 0, 0])), owner, source, false, false, true);
  assert.deepEqual(result.backgroundRGB, { r: 0, g: 0, b: 0, a: 255 });
  assert.equal(result.textRGB, null); assert.equal(result.embossRGB, null);
});

test('whole-chain profile mismatch rejects before root art decode and completes diagnostics once', async () => {
  const theme = { baseUrl: 'root/', manifest: { chromeElements: { own: { sourceCicnId: -9975, asset: 'never-decode.png' } } },
    base: { baseUrl: 'base/', manifest: { displayProfile: profile, chromeElements: {} } } };
  let completions = 0;
  await assert.rejects(composeEngineTab(theme, { diagnostics: { onComplete(trace) {
    completions++; assert.equal(trace.outcome.status, 'error'); assert.equal(trace.steps.length, 0);
    throw new Error('callback must not replace renderer failure');
  } } }), error => error.code === 'PROFILE_MISMATCH');
  assert.equal(completions, 1);
});
