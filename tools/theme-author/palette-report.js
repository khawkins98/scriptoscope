// Palette report: where each named colour lands at 8 bpp, which colours
// collapse onto one system-palette entry, and WCAG contrast for declared pairs.
//
// The colours are the ones you type (display sRGB, as in palette.mjs). The
// 8-bit mapping goes through the stored values exactly like simulate8bit
// (sim8.js). Contrast is measured on the display colours, because that is what
// the web shows; at 8 bpp the snapped colours can differ, so each pair also
// reports the ratio after the snap.
//
// This is an opt-in report (`npm run author -- <dir> --palette`), not a check:
// as rules these would fire on originals (the toolkit's test for noise): 11 of
// the 18 corpus schemes have images that lose colours at 8 bpp, 5 have an
// active title below 4.5:1 and 6 an inactive title below 3:1. The contrast
// rules that do run on every build (near-invisible title text and push
// labels, firing on no corpus scheme) are in check-scheme.js.
//
// Pure and portable: no fs, no DOM.

import { parseColor } from './color.js';
import { systemEntryFor } from './sim8.js';

/** Floors from docs/authoring-visual-design.md §2.3, by pair kind. */
export const CONTRAST_FLOORS = Object.freeze({
  title: 4.5, // active title on its plate
  inactiveTitle: 3,
  label: 4.5, // button label on its face
  outline: 3, // frame outline against white / the body
  glyph: 3, // widget glyph on its widget
  text: 4.5,
});

/** WCAG 2 relative luminance of a display colour. */
export function relativeLuminance(color) {
  const [r, g, b] = parseColor(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio (1–21) between two display colours. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Flatten a palette module into [name, '#rrggbb'] pairs. Accepts an object
 * whose values are colours, arrays of colours (ramps) or nested objects
 * (`{ red: { base, hi } }` → 'red.base'), or a list of [name, colour].
 * Values that aren't colours are skipped.
 */
export function flattenPalette(palette, prefix = '') {
  if (Array.isArray(palette) && palette.every((e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string')) {
    return palette.map(([n, c]) => [n, toHex(c)]).filter(([, c]) => c);
  }
  const out = [];
  const visit = (value, name) => {
    const hex = toHex(value);
    if (hex) { out.push([name, hex]); return; }
    if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${name}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, name ? `${name}.${k}` : k);
  };
  visit(palette, prefix);
  return out;
}

/**
 * @param {object|Array} palette see flattenPalette
 * @param {{ pairs?: Array<[string|number[], string|number[], string, (string|number)?]>, itabRes?: number }} [opts]
 *   pairs: [foreground, background, label, floor]. `floor` is a number or a
 *   CONTRAST_FLOORS key; without it the label is matched against the keys
 *   ('inactive title' → inactiveTitle), defaulting to 4.5.
 */
export function paletteReport(palette, { pairs = [], itabRes } = {}) {
  const colors = flattenPalette(palette).map(([name, hex]) => {
    const e = systemEntryFor(hex, { itabRes });
    return { name, hex, entry: e.display, index: e.index, distance: Math.round(e.distance) };
  });
  const byEntry = new Map();
  for (const c of colors) {
    if (!byEntry.has(c.entry)) byEntry.set(c.entry, []);
    byEntry.get(c.entry).push(c);
  }
  // Two names on one entry are a collapse only if they were different colours.
  const collapses = [...byEntry].filter(([, cs]) => new Set(cs.map((c) => c.hex)).size > 1)
    .map(([entry, cs]) => ({ entry, names: cs.map((c) => c.name) }));
  const contrast = pairs.map(([fg, bg, label = '', floor]) => {
    const f = toHex(fg), b = toHex(bg);
    const min = typeof floor === 'number' ? floor : CONTRAST_FLOORS[floor ?? floorKey(label)] ?? 4.5;
    const ratio = contrastRatio(f, b);
    const at8 = contrastRatio(systemEntryFor(f, { itabRes }).display, systemEntryFor(b, { itabRes }).display);
    return { label, fg: f, bg: b, ratio: round2(ratio), at8bpp: round2(at8), floor: min, pass: ratio >= min };
  });
  return { colors, collapses, contrast };
}

/** The report as plain text lines. */
export function formatPaletteReport(report) {
  const lines = [];
  const pad = Math.max(4, ...report.colors.map((c) => c.name.length));
  const collapsed = new Set(report.collapses.flatMap((c) => c.names));
  lines.push(`${'name'.padEnd(pad)}  colour   → 8 bpp    distance`);
  for (const c of report.colors) {
    lines.push(`${c.name.padEnd(pad)}  ${c.hex}  → ${c.entry}  ${String(c.distance).padStart(4)}${collapsed.has(c.name) ? '  COLLAPSE' : ''}`);
  }
  if (report.collapses.length) {
    lines.push('', 'collapses (different colours, one 8-bit entry):');
    for (const c of report.collapses) lines.push(`  ${c.entry}: ${c.names.join(', ')}`);
  } else lines.push('', 'no collapses: every distinct colour has its own 8-bit entry');
  if (report.contrast.length) {
    lines.push('', 'contrast (WCAG, on-screen colours; 8 bpp in brackets):');
    for (const p of report.contrast) {
      lines.push(`  ${p.pass ? '✓' : '✗'} ${p.label || `${p.fg} on ${p.bg}`}: ${p.ratio}:1 (${p.at8bpp}:1), floor ${p.floor}:1`);
    }
  }
  return lines;
}

function floorKey(label) {
  const l = String(label).toLowerCase();
  if (/inactive/.test(l) && /title/.test(l)) return 'inactiveTitle';
  if (/title/.test(l)) return 'title';
  if (/label|button/.test(l)) return 'label';
  if (/outline|border/.test(l)) return 'outline';
  if (/glyph/.test(l)) return 'glyph';
  return 'text';
}

function toHex(c) {
  if (!(typeof c === 'string' || (Array.isArray(c) && c.length === 3 && c.every((v) => typeof v === 'number')))) return null;
  try {
    return '#' + parseColor(c).map((v) => v.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

const round2 = (x) => Math.round(x * 100) / 100;
