import test from 'node:test';
import assert from 'node:assert/strict';
import { controlTextColors } from './controlTextColors.ts';

test('known foreground does not certify unknown emboss; overrides and legacy fallbacks remain explicit', () => {
  const face = { colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: 'mac-1.8-to-2.2-high-byte',
    background: null, text: { rgb16: [0x2121, 0x2121, 0x2121], displayRgb: [48, 48, 48] },
    emboss: { rgb16: [65535, 65535, 65535], displayRgb: [255, 255, 255] }, embossDecision: 'unknown' } };
  assert.deepEqual(controlTextColors(face, undefined, '#fff'), { foreground: 'rgb(48,48,48)', emboss: null, policy: 'source-samples', embossDecision: 'unknown', sampleFallbackReason: null });
  assert.deepEqual(controlTextColors(face, '#ff0000', '#fff'), { foreground: '#ff0000', emboss: null, policy: 'caller-override', embossDecision: 'caller-override', sampleFallbackReason: null });
  for (const colorSamples of [null, undefined, { ...face.colorSamples, text: null }]) {
    assert.deepEqual(controlTextColors({ colorSamples }, undefined, '#707070'), { foreground: '#707070', emboss: null, policy: 'contrast-fallback', embossDecision: 'unavailable', sampleFallbackReason: 'missing-text-sample' });
  }
});
