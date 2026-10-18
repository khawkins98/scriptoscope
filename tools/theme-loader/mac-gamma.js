// Declared display policy for prepared theme assets and sampled colors.
//
// The current compatibility transform uses these fixed exponents:
//
//   out = 255 · (in/255)^(MAC_GAMMA / TARGET_GAMMA)
//
// This 1.8/2.2 approximation brightens midtones and fixes the endpoints. It is
// not a measured original device gamma, palette conversion or complete sRGB
// color-management pipeline. Agreement on saturated primaries cannot establish
// gray-value fidelity. Original captures need their own recorded display and
// producer conditions; see docs/spec/fidelity-compatibility-contract.md and #190.
//
// Apply this policy when preparing display artifacts, both during extraction
// and encoded browser loading (cicn/ppat/icon PNGs and manifest/sample colors).
// Keep it separate from raw resource decoding so source samples, lint and role
// detection retain the stored values. These constants name the current policy;
// they do not certify what a particular historical user or emulator displayed.

export const MAC_GAMMA = 1.8;
export const TARGET_GAMMA = 2.2;

const EXP = MAC_GAMMA / TARGET_GAMMA;

// 256-entry lookup so per-pixel correction is a table read, not a pow().
const LUT = new Uint8Array(256);
for (let i = 0; i < 256; i++) LUT[i] = Math.round(255 * Math.pow(i / 255, EXP));

/** Correct a single 8-bit channel value. */
export function macChannelToSrgb(v) {
  return LUT[v & 0xff];
}

/** Correct an [r,g,b] triple (returns a new array; alpha is not passed here). */
export function macRgbToSrgb(rgb) {
  return [LUT[rgb[0]], LUT[rgb[1]], LUT[rgb[2]]];
}

/** Correct an RGBA buffer IN PLACE, skipping the alpha byte. Returns it. */
export function gammaCorrectRgba(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = LUT[rgba[i]];
    rgba[i + 1] = LUT[rgba[i + 1]];
    rgba[i + 2] = LUT[rgba[i + 2]];
  }
  return rgba;
}

/** Correct a `#rrggbb` hex string (case/`#` preserved as lowercase `#rrggbb`). */
export function gammaCorrectHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return hex; // leave non-#rrggbb values (named/short) untouched
  const c = [1, 2, 3].map((k) => LUT[parseInt(m[k], 16)].toString(16).padStart(2, '0'));
  return '#' + c.join('');
}
