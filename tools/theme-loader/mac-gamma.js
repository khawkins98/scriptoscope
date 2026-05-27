// Mac→sRGB gamma correction — a DISPLAY transform applied at bake time.
//
// Classic Mac OS targeted a display gamma of 1.8; modern (sRGB) screens are
// ~2.2. The clut/cicn/ppat/icon RGB values stored in a scheme are device
// values authored for the 1.8 world, so on a modern screen the SAME byte value
// renders darker in the midtones (e.g. mid-gray 128 → 0.5^1.8=0.29 luminance on
// a period Mac vs 0.5^2.2=0.22 on sRGB). To reproduce what a 1998 user actually
// saw, we lift the midtones by re-encoding for the brighter target gamma:
//
//   out = 255 · (in/255)^(MAC_GAMMA / TARGET_GAMMA)
//
// The exponent (1.8/2.2 ≈ 0.818) is < 1, so it brightens midtones and leaves the
// endpoints fixed (0→0, 255→255). Saturated primaries (channels at 0/255) are
// nearly untouched; grayscale shading moves the most — which is exactly where
// classic Mac art looks too dark on a modern display.
//
// IMPORTANT: this is a display correction, NOT part of the decode. The raw
// decoders in tools/theme-loader stay byte-faithful (lint + role detection rely
// on the raw values). Gamma is applied ONLY when baking display artifacts
// (cicn/ppat PNGs, icon PNGs, header colors in theme.json).

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
