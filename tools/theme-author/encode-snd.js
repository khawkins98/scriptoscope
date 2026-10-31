// Encode a 'snd ' resource: one 8-bit mono sampled sound, and a tiny
// synthesizer to make original sounds from code (no recorded samples).
//
// Kaleidoscope plays the scheme's WindowShade sounds when a window collapses
// or expands: `snd -14336` on collapse, `snd -14335` on expand (corpus author
// labels: "Collapse Sound"/"Expand Sound", "closesnd"/"opensnd", "Window Shade
// Sound Up"/"Down"; 9 of 18 corpus schemes). The control panel's "WindowShade
// Sounds" box is "disabled if the scheme does not include these custom
// sounds" (its TEXT 1005 "Using the Control Panel").
//
// Format 1 'snd ' layout (Inside Macintosh: Sound, "Sound Resources"; the
// layout every format-1 corpus sound uses):
//
//   0   format          2   1
//   2   numModifiers    2   1
//   4   modNumber       2   5 = sampledSynth
//   6   modInit         4   0x80 = initMono
//   10  numCommands     2   1
//   12  command         8   bufferCmd | dataPointerFlag (0x8051), param1 0,
//                           param2 = offset of the sound header (20)
//   20  SoundHeader    22   samplePtr 0, length (samples), sampleRate (Fixed),
//                           loopStart, loopEnd, encode 0 (standard), baseFrequency
//   42  samples             8-bit offset binary: 0x80 is silence

import { ByteWriter } from './bytes.js';

/** The two classic rates as stored Fixed values: rate22khz and rate11khz. */
export const SND_RATE = { r22k: 0x56ee8ba3, r11k: 0x2b7745d1 };
/** The rate in Hz of a stored Fixed value. */
export const rateHz = (fixed) => fixed / 65536;

/**
 * @param {ArrayLike<number>} samples  8-bit offset-binary bytes (0–255), or
 *   floats in −1…1 when `float` is set
 * @param {{ sampleRate?: number, loopStart?: number, loopEnd?: number, baseFrequency?: number,
 *   modInit?: number, float?: boolean }} [options]  sampleRate is the stored Fixed value
 * @returns {Uint8Array}
 */
export function encodeSnd(samples, { sampleRate = SND_RATE.r11k, loopStart = 0, loopEnd = 0, baseFrequency = 60, modInit = 0x80, float = false } = {}) {
  const bytes = float ? toOffsetBinary(samples) : Uint8Array.from(samples);
  if (!bytes.length) throw new Error('encodeSnd: no samples');
  return new ByteWriter()
    .u16(1).u16(1).u16(5).u32(modInit)
    .u16(1).u16(0x8051).i16(0).u32(20)
    .u32(0).u32(bytes.length).u32(sampleRate >>> 0).u32(loopStart).u32(loopEnd).u8(0).u8(baseFrequency)
    .raw(bytes)
    .toUint8Array();
}

/** Floats in −1…1 → 8-bit offset binary (clipped, rounded). */
export function toOffsetBinary(values) {
  return Uint8Array.from(values, (v) => Math.max(0, Math.min(255, Math.round(128 + 127 * Math.max(-1, Math.min(1, v))))));
}

/**
 * A small additive synthesizer. Each voice is a sine, square or noise source
 * with a frequency glide and an attack/exponential-decay envelope; voices are
 * summed and normalised to `peak`. Deterministic: noise uses a fixed seed.
 *
 * @param {Array<{ wave?: 'sine'|'square'|'noise', from?: number, to?: number, amp?: number,
 *   start?: number, attack?: number, decay?: number, length?: number }>} voices
 *   from/to in Hz (an exponential glide); start, attack, length in seconds;
 *   decay is the time constant in seconds
 * @param {{ seconds: number, rate?: number, peak?: number, fade?: number, seed?: number }} options
 *   rate in Hz (default 11127.27, rate11khz); fade = closing fade-out in seconds
 * @returns {Float32Array}
 */
export function synthesize(voices, { seconds, rate = rateHz(SND_RATE.r11k), peak = 0.8, fade = 0.02, seed = 1 }) {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  let state = seed >>> 0 || 1;
  const noise = () => { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 0x80000000 - 1; };
  for (const v of voices) {
    const { wave = 'sine', from = 440, to = from, amp = 1, start = 0, attack = 0.005, decay = 0.1, length = seconds - start } = v;
    let phase = 0, low = 0;
    const first = Math.round(start * rate), count = Math.min(n - first, Math.round(length * rate));
    for (let i = 0; i < count; i++) {
      const t = i / rate, f = from * (to / from) ** (t / Math.max(length, 1e-6));
      phase += f / rate;
      let s;
      if (wave === 'sine') s = Math.sin(2 * Math.PI * phase);
      else if (wave === 'square') s = (phase % 1) < 0.5 ? 1 : -1;
      else { low += (noise() - low) * Math.min(1, (2 * Math.PI * f) / rate); s = low * 2; } // one-pole low-passed noise, cutoff f
      const env = (t < attack ? t / attack : 1) * Math.exp(-Math.max(0, t - attack) / decay);
      out[first + i] += amp * env * s;
    }
  }
  const fadeN = Math.round(fade * rate);
  for (let i = 0; i < fadeN && i < n; i++) out[n - 1 - i] *= i / fadeN;
  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0) for (let i = 0; i < n; i++) out[i] *= peak / max;
  return out;
}
