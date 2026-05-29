// scripts/probe-reference-slot.mjs
//
// Reference-image pixel probe. For each Scene SLOT the demo composes, sample the
// corresponding region in the bundle's reference PNG and verify the runtime's
// tier choice against what the reference actually shows. Disagreements are bugs
// the runtime can SEE without guessing.
//
// Slots covered:
//   finder-header-badge   icon at the leading edge of the info-bar strip
//                         (the slot the original probe verified — 18/18 confirmed)
//   info-bar-bg-pattern   the info-bar strip's fill (cinf -9567 bgPattern,
//                         body-bg ppat fallback, headerColors.active.fill, flat)
//   dialog-body-bg        the Options utility-window body interior (ppat-42 → ppat--9568 → flat)
//   window-body-bg        the main "Hello!" window body interior (bodyBackground.pattern → flat-white)
//   desktop-bg            the desk pattern outside the main window (patterns[/desktop/i] → ppat-17 → checkerboard)
//   folder-scene-icons    the folder icons sitting in the main window body
//                         (FINDER_CONTENT_ICON_IDS — -3983 / -3999 / -3997 / -3994 / -3976)
//   info-bar-text-color   the volume-name text colour atop the info-bar strip
//                         (contrast pick — white when bg lum < 128 else black)
//
// Slot kinds:
//   - PATTERN-FILL slots (info-bar-bg / dialog-body-bg / window-body-bg /
//     desktop-bg): the reference shows a TEXTURE, not a glyph. Multi-scale
//     template-matching is the wrong shape — patterns repeat and there's no
//     single fixed origin. Instead, sample a small region in the reference at
//     a slot-relative bounding box and compare its MEAN RGB to each candidate
//     pattern's MEAN RGB (a dominant-colour proxy). Closest mean wins.
//   - ICON / GLYPH slots (finder-header-badge / folder-scene-icons): the
//     reference shows a specific small bitmap at a known leading position.
//     Multi-scale template-match (the original probe's strategy) is correct.
//   - DERIVED slots (info-bar-text-color): sample two regions (text + bg),
//     contrast-check, compare to runtime's pick.
//
// USAGE
//   node scripts/probe-reference-slot.mjs                    # all slots, all bundles
//   node scripts/probe-reference-slot.mjs --slot=<key>       # one slot only
//   node scripts/probe-reference-slot.mjs --slug=<slug>      # one bundle only
//   node scripts/probe-reference-slot.mjs --write            # write ground-truth JSON
//
// CONSTRAINTS (per the brief)
//   - Pure node. No browser/playwright.
//   - PNG decode is minimal (paletted + RGBA both supported here).
//   - Reference discovery: demo/assets/references/<slug>.png.
//   - Don't auto-commit — owner reviews the discrepancy table first.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── PNG DECODER ───────────────────────────────────────────────────────────
// Supports paletted (color type 3) + RGBA (6) + RGB (2) + gray (0) + gray+alpha (4).
//
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6;
  const idat = [];
  let plte = null;
  let trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = new Uint8Array(data);
    else if (type === 'tRNS') trns = new Uint8Array(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const channels = colorType === 6 ? 4
                 : colorType === 4 ? 2
                 : colorType === 2 ? 3
                 : (colorType === 0 || colorType === 3) ? 1
                 : 0;
  if (!channels) throw new Error(`unsupported color type ${colorType}`);
  const bpp = Math.max(1, Math.ceil((bitDepth * channels) / 8));
  const stride = Math.ceil((width * bitDepth * channels) / 8);

  const raw = inflateSync(Buffer.concat(idat));
  const cur = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const out = new Uint8ClampedArray(width * height * 4);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) cur[x] = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
    if (colorType === 3) {
      if (!plte) throw new Error('paletted PNG missing PLTE');
      for (let x = 0; x < width; x++) {
        let idx;
        if (bitDepth === 8) idx = cur[x];
        else {
          const bitPos = x * bitDepth;
          const byte = cur[bitPos >> 3];
          const shift = 8 - bitDepth - (bitPos & 7);
          const mask = (1 << bitDepth) - 1;
          idx = (byte >> shift) & mask;
        }
        const o = (y * width + x) * 4;
        const pi = idx * 3;
        out[o] = plte[pi];
        out[o + 1] = plte[pi + 1];
        out[o + 2] = plte[pi + 2];
        out[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    } else if (channels === 4) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * 4;
        out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3];
      }
    } else if (channels === 3) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * 3;
        out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255;
      }
    } else if (channels === 2) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * 2;
        out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1];
      }
    } else {
      for (let x = 0; x < width; x++) {
        let g;
        if (bitDepth === 8) g = cur[x];
        else {
          const bitPos = x * bitDepth;
          const byte = cur[bitPos >> 3];
          const shift = 8 - bitDepth - (bitPos & 7);
          const mask = (1 << bitDepth) - 1;
          g = ((byte >> shift) & mask) * (255 / mask);
        }
        const o = (y * width + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255;
      }
    }
    prev.set(cur);
  }
  return { width, height, rgba: out };
}

// ─── BUNDLE LOAD ───────────────────────────────────────────────────────────
// Use loadKaleidoscopeScheme (NOT the leaner convertScheme) so we get the full
// manifest — patterns + headerColors + bodyBackground + chromeElements — that
// the slot resolvers need. encodeAssets: false returns raw Uint8ClampedArray
// pixels on each asset, ready for mean-RGB sampling.
//
async function loadBundle(slug) {
  const dir = resolve(root, 'themes', slug);
  let bytes;
  for (const name of ['scheme.sit', 'scheme.rsrc']) {
    const p = resolve(dir, name);
    if (existsSync(p)) { bytes = new Uint8Array(readFileSync(p)); break; }
  }
  if (!bytes) throw new Error(`no scheme archive in themes/${slug}/`);
  return loadKaleidoscopeScheme(bytes, { meta: { name: slug }, source: slug, encodeAssets: false });
}

function findAssetByPath(scheme, path) {
  if (!path) return null;
  // `path` may already include the bundle root (loadKaleidoscopeScheme returns
  // strings like "ppats/ppat-42-…png"); assets are keyed by the same path.
  return scheme.assets.find((a) => a.path === path) || null;
}

// ─── FINDER_GRID_PNG (the T2 candidate for finder-header-badge) ────────────
const FINDER_GRID_DATA_URL = 'iVBORw0KGgoAAAANSUhEUgAAAA0AAAANAgAAAAAdMKMBAAAAAnRSTlMAA++anIIAAAABb3JOVAHPoneaAAAAFUlEQVQI12NYtWpVA8P+/fuRCVLEAGm6Ip4agi9NAAAAAElFTkSuQmCC';
function loadFinderGrid() {
  const buf = Buffer.from(FINDER_GRID_DATA_URL, 'base64');
  return decodePng(buf);
}

// ─── COLOUR HELPERS ────────────────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function meanRgbOfRegion(ref, x0, y0, x1, y1) {
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(ref.width, Math.ceil(x1));
  const yb = Math.min(ref.height, Math.ceil(y1));
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const o = (y * ref.width + x) * 4;
      const a = ref.rgba[o + 3];
      if (a < 128) continue; // skip transparent (some refs ship a transparent BG)
      sr += ref.rgba[o]; sg += ref.rgba[o + 1]; sb += ref.rgba[o + 2]; n++;
    }
  }
  if (n === 0) return null;
  return [sr / n, sg / n, sb / n, n];
}

function meanRgbOfAsset(asset) {
  // The ppat asset is small (typically 8×8 / 16×16 / 32×32). Average all
  // opaque pixels — that's the "dominant tile colour" we compare against the
  // reference's sampled region. Period: patterns tile, so any tile-sized
  // sample of the reference and any tile from the asset should agree on
  // dominant colour even if neither dominates structurally.
  if (!asset || !asset.rgba) return null;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < asset.rgba.length; i += 4) {
    const a = asset.rgba[i + 3];
    if (a < 128) continue;
    sr += asset.rgba[i]; sg += asset.rgba[i + 1]; sb += asset.rgba[i + 2]; n++;
  }
  if (n === 0) return null;
  return [sr / n, sg / n, sb / n, n];
}

function rgbDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function luminance(rgb) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

// ─── PIXEL DISTANCE + SCALE-AWARE TEMPLATE MATCH ───────────────────────────
// (Same machinery as the original probe — kept for the icon-shape slots.)
function nearestSample(srcW, srcH, srcRgba, sx, sy) {
  const ix = Math.min(srcW - 1, Math.max(0, sx | 0));
  const iy = Math.min(srcH - 1, Math.max(0, sy | 0));
  const o = (iy * srcW + ix) * 4;
  return [srcRgba[o], srcRgba[o + 1], srcRgba[o + 2], srcRgba[o + 3]];
}

function distanceAt(ref, cand, scale, ox, oy) {
  let totalWeight = 0;
  let totalDist = 0;
  for (let cy = 0; cy < cand.height; cy++) {
    for (let cx = 0; cx < cand.width; cx++) {
      const co = (cy * cand.width + cx) * 4;
      const ca = cand.rgba[co + 3];
      if (ca === 0) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      const rx0 = ox + cx * scale, ry0 = oy + cy * scale;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const [r, g, b] = nearestSample(ref.width, ref.height, ref.rgba, rx0 + dx, ry0 + dy);
          sr += r; sg += g; sb += b; n++;
        }
      }
      const ar = sr / n, ag = sg / n, ab = sb / n;
      const d = Math.abs(ar - cand.rgba[co]) + Math.abs(ag - cand.rgba[co + 1]) + Math.abs(ab - cand.rgba[co + 2]);
      const weight = ca / 255;
      totalDist += d * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return Infinity;
  return totalDist / totalWeight;
}

function searchBestMatch(ref, cand, opts = {}) {
  const { scales = [1, 2, 3, 4, 5, 6], region = { x0: 0, y0: 0.15, x1: 0.5, y1: 0.6 }, step = 1 } = opts;
  let best = { distance: Infinity, x: -1, y: -1, scale: -1 };
  const xMax = Math.floor(ref.width * region.x1);
  const yMax = Math.floor(ref.height * region.y1);
  const xMin = Math.floor(ref.width * region.x0);
  const yMin = Math.floor(ref.height * region.y0);
  for (const scale of scales) {
    const cw = cand.width * scale, ch = cand.height * scale;
    if (cw > xMax - xMin || ch > yMax - yMin) continue;
    for (let y = yMin; y + ch <= yMax; y += step) {
      for (let x = xMin; x + cw <= xMax; x += step) {
        const d = distanceAt(ref, cand, scale, x, y);
        if (d < best.distance) best = { distance: d, x, y, scale };
      }
    }
  }
  return best;
}

// ─── ICON PICKERS ──────────────────────────────────────────────────────────
function pickIconRgba(scheme, id, size = 16) {
  // Highest-depth wins (ics8 over ics4 / icl8 over icl4) — matches loadGlyphMap.
  const candidates = scheme.iconIndex
    .filter((e) => e.id === id && e.size === size)
    .sort((a, b) => b.depth - a.depth);
  for (const c of candidates) {
    const asset = scheme.assets.find((a) => a.path === `icons/${c.file}`);
    if (asset) return { ...c, rgba: new Uint8ClampedArray(asset.rgba), width: asset.width, height: asset.height };
  }
  return null;
}

// ─── PROBES PER SLOT ───────────────────────────────────────────────────────

// finder-header-badge — kept from the original probe.
const HEADER_BADGE_CANDIDATE_IDS = [-3790, -14336];

function runtimePicksHeaderBadge(scheme) {
  return scheme.iconIndex.find((e) => e.id === -3790 && e.size === 16) ? 'ics -3790' : 'FINDER_GRID';
}

function probeHeaderBadge(scheme, ref) {
  const candidates = [];
  for (const id of HEADER_BADGE_CANDIDATE_IDS) {
    const e = pickIconRgba(scheme, id);
    if (e) candidates.push({ ...e, name: `${e.type} ${id}` });
  }
  candidates.push({ ...loadFinderGrid(), name: 'FINDER_GRID' });
  const matches = candidates.map((c) => {
    const m = searchBestMatch(ref, c);
    return { name: c.name, ...m };
  }).sort((a, b) => a.distance - b.distance);
  const best = matches[0];
  const runtime = runtimePicksHeaderBadge(scheme);
  const re = (runtime === 'ics -3790') ? /^ics[48] -3790$/ : /^FINDER_GRID$/;
  const agree = re.test(best.name);
  const xPct = (best.x / ref.width) * 100;
  const ru = matches[1];
  const distMargin = ru ? ru.distance - best.distance : Infinity;
  const lowConfidence = xPct > 25 || best.distance > 100 || distMargin < 10;
  return {
    runtime_tier: runtime,
    verified_tier: best.name,
    agree,
    confidence: lowConfidence ? 'low' : 'ok',
    notes: `d=${best.distance.toFixed(1)} @${best.x},${best.y} ${best.scale}x; ru=${ru ? ru.name + '/d=' + ru.distance.toFixed(1) : '-'}`,
  };
}

// info-bar-bg-pattern — dominant-colour sampling of the strip below the title bar.
//
// Geometry: the info-bar strip sits IMMEDIATELY below the title bar, in the
// main "Hello!" window. Title bars are ~16-19px (native) tall; at high scales
// (1024-wide refs) the title bar is ~80-120px tall. To stay scale-agnostic,
// sample as fractions of REFERENCE HEIGHT. The strip's interior — between the
// grid badge (leading edge) and the volume-name text — gives the cleanest
// pattern read.
//
function probeInfoBarBg(scheme, ref) {
  // Region: inside the main window, below the title bar. The grid badge sits at
  // the leading edge, the volume name to the right of it. To avoid sampling the
  // BADGE itself (which is icon pixels, not the bar bg), skip the leftmost ~14%
  // (≈ 27px native, ≈ 140px on a 1024-wide). The text starts soon after, so
  // sample the BAR INTERIOR in a narrow vertical band that's mostly bg+text.
  // y: 11% → 16% of ref height puts us in the bar interior on every reference.
  // Cross-checked: at 200×134 (1138/apple-platinum-2), y=15..21 hits the strip;
  // at 1024×856 (dolphin-som), y=94..137 hits the strip.
  const xa = ref.width * 0.18, xb = ref.width * 0.34;
  const ya = ref.height * 0.11, yb = ref.height * 0.16;
  const sampled = meanRgbOfRegion(ref, xa, ya, xb, yb);
  if (!sampled) return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: 'no opaque pixels in sample region' };

  // Build candidates from the manifest, IN THE RUNTIME ORDER (cinf -9567
  // bgPattern → bodyBackground → headerColors.active.fill → flat #e6e6e6).
  const m = scheme.manifest;
  const candidates = [];
  const hdrCe = Object.values(m.chromeElements ?? {}).find((v) => v.sourceCicnId === -9567);
  if (hdrCe?.bgPattern) {
    const path = m.patterns?.[hdrCe.bgPattern]?.asset;
    const asset = findAssetByPath(scheme, path);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T1 cinf bgPattern ${hdrCe.bgPattern}`, mean, tier: 'T1' });
  }
  if (m.bodyBackground?.pattern) {
    const asset = findAssetByPath(scheme, m.bodyBackground.pattern);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T2 bodyBackground ${m.bodyBackground.pattern}`, mean, tier: 'T2' });
  }
  const fill = hexToRgb(m.headerColors?.active?.fill);
  if (fill) candidates.push({ name: `T3 headerFill ${m.headerColors.active.fill}`, mean: fill, tier: 'T3' });
  candidates.push({ name: 'T4 flat #e6e6e6', mean: [0xe6, 0xe6, 0xe6], tier: 'T4' });

  // Runtime's pick: the FIRST tier that has data (mirrors buildScene's `??`).
  // T1 fires only when the cinf has a bgPattern AND it resolves to an asset;
  // T2 only when bodyBackground.pattern is set; T3 (the SOLID fallback) only
  // when neither pattern is present AND headerColors.active.fill is set.
  // In the demo's actual code the fallback chain is "(T1 ?? T2)
  // texture-or-nothing, with T3 used as the underlying solid fill". For the
  // probe we collapse to "first matching tier in runtime order".
  const runtime = candidates[0];

  // Verified: closest mean-RGB to sampled.
  let best = candidates[0], bestD = Infinity;
  for (const c of candidates) {
    const d = rgbDist(c.mean, sampled);
    if (d < bestD) { bestD = d; best = c; }
  }

  // Confidence: low when (a) runner-up is within 10 RGB units (ambiguous), or
  // (b) the absolute distance is > 90 (sampled region likely caught something
  // else — title-bar fill, an icon, sampler art). Patterns vary in luminance,
  // so 60-90 is realistic for a textured ppat.
  const sortedByDist = [...candidates].map((c) => ({ ...c, d: rgbDist(c.mean, sampled) })).sort((a, b) => a.d - b.d);
  const margin = sortedByDist.length > 1 ? sortedByDist[1].d - sortedByDist[0].d : Infinity;
  const lowConf = bestD > 90 || margin < 10;

  return {
    runtime_tier: runtime.name,
    verified_tier: best.name,
    agree: runtime.name === best.name,
    confidence: lowConf ? 'low' : 'ok',
    notes: `sampled=rgb(${sampled[0].toFixed(0)},${sampled[1].toFixed(0)},${sampled[2].toFixed(0)}) bestD=${bestD.toFixed(0)} margin=${margin.toFixed(0)}`,
    sampled,
    candidates: sortedByDist,
  };
}

// dialog-body-bg — utility-window body interior.
//
// The dialog sits TOP-RIGHT in every reference, overlapping into the main
// window. Its interior shows the On/Off toggle at top, the progress bar in
// the middle, the OK button at bottom. To sample the body BG cleanly we hit
// the SLIVER between the progress bar and the OK button, and prefer the
// right-edge interior (less likely to overlap with the chrome left edge).
//
// Empirical region (verified against monkey-paradise 844×596, 1990 225×175,
// apple-platinum-2 195×127, slimes 780×508): y=33-44%, x=68-82%.
//
function probeDialogBodyBg(scheme, ref) {
  const xa = ref.width * 0.68, xb = ref.width * 0.82;
  const ya = ref.height * 0.33, yb = ref.height * 0.44;
  const sampled = meanRgbOfRegion(ref, xa, ya, xb, yb);
  if (!sampled) return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: 'no opaque pixels in sample region' };

  // Candidates in RUNTIME tier order — mirror renderWindow.ts bodyBackgroundStyle's
  // utility-slug branch (T1 ppat-42 → T2 ppat--9568 → T3 flat #ffffff).
  const m = scheme.manifest;
  const candidates = [];
  const ppat42 = Object.entries(m.patterns ?? {}).find(([_, v]) => Math.abs(v?.sourcePpatId ?? 0) === 42);
  if (ppat42) {
    const asset = findAssetByPath(scheme, ppat42[1].asset);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T1 ppat-42 (${ppat42[0]})`, mean, tier: 'T1' });
  }
  const ppat9568 = Object.entries(m.patterns ?? {}).find(([_, v]) => Math.abs(v?.sourcePpatId ?? 0) === 9568);
  if (ppat9568) {
    const asset = findAssetByPath(scheme, ppat9568[1].asset);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T2 ppat--9568 (${ppat9568[0]})`, mean, tier: 'T2' });
  }
  candidates.push({ name: 'T3 flat #ffffff', mean: [0xff, 0xff, 0xff], tier: 'T3' });

  // Also probe the REGRESSION candidate: bodyBackground (the Icon-View ppat).
  // This is the "army camo wrapping the Options dialog" bug per the spec —
  // the probe shows whether the reference's dialog matches the body texture
  // (regression match) or one of the canonical tiers.
  if (m.bodyBackground?.pattern) {
    const asset = findAssetByPath(scheme, m.bodyBackground.pattern);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `[regression] bodyBackground (${m.bodyBackground.pattern})`, mean, tier: 'X' });
  }

  const runtime = candidates[0];
  const sortedByDist = candidates.map((c) => ({ ...c, d: rgbDist(c.mean, sampled) })).sort((a, b) => a.d - b.d);
  const best = sortedByDist[0];
  const margin = sortedByDist.length > 1 ? sortedByDist[1].d - sortedByDist[0].d : Infinity;
  const lowConf = best.d > 90 || margin < 10;

  return {
    runtime_tier: runtime.name,
    verified_tier: best.name,
    agree: runtime.name === best.name,
    confidence: lowConf ? 'low' : 'ok',
    notes: `sampled=rgb(${sampled[0].toFixed(0)},${sampled[1].toFixed(0)},${sampled[2].toFixed(0)}) bestD=${best.d.toFixed(0)} margin=${margin.toFixed(0)}`,
    sampled,
    candidates: sortedByDist,
  };
}

// window-body-bg — main-window body interior.
//
// Geometry: y=22-30% (BELOW the info-bar strip, ABOVE the folder icons or in
// the gap between them), x=2-18% (left side of the main window body, before
// the folder icons start). For some scaled references the icons start very
// near the left edge (slimes), so the band is narrow.
//
function probeWindowBodyBg(scheme, ref) {
  // Use a narrow band right at the main-window body's LEFT margin, between the
  // info bar and any folder icons. y=21..25% safely above icons in every
  // reference (folder rows sit at y=29-44% across the corpus).
  const xa = ref.width * 0.02, xb = ref.width * 0.10;
  const ya = ref.height * 0.21, yb = ref.height * 0.27;
  const sampled = meanRgbOfRegion(ref, xa, ya, xb, yb);
  if (!sampled) return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: 'no opaque pixels in sample region' };

  const m = scheme.manifest;
  const candidates = [];
  if (m.bodyBackground?.pattern) {
    const asset = findAssetByPath(scheme, m.bodyBackground.pattern);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T1 bodyBackground (${m.bodyBackground.pattern})`, mean, tier: 'T1' });
  }
  candidates.push({ name: 'T2 flat #ffffff', mean: [0xff, 0xff, 0xff], tier: 'T2' });

  const runtime = candidates[0];
  const sortedByDist = candidates.map((c) => ({ ...c, d: rgbDist(c.mean, sampled) })).sort((a, b) => a.d - b.d);
  const best = sortedByDist[0];
  const margin = sortedByDist.length > 1 ? sortedByDist[1].d - sortedByDist[0].d : Infinity;
  const lowConf = best.d > 90 || margin < 10;

  return {
    runtime_tier: runtime.name,
    verified_tier: best.name,
    agree: runtime.name === best.name,
    confidence: lowConf ? 'low' : 'ok',
    notes: `sampled=rgb(${sampled[0].toFixed(0)},${sampled[1].toFixed(0)},${sampled[2].toFixed(0)}) bestD=${best.d.toFixed(0)} margin=${margin.toFixed(0)}`,
    sampled,
    candidates: sortedByDist,
  };
}

// desktop-bg — desktop pattern outside the windows.
//
// Tricky: not every reference HAS a desktop margin. Many are tightly cropped
// to the window footprint (the 195×127 corner-sprite refs have ~3px margin or
// none); the large refs (monkey-paradise, dolphin-som, slimes, animals) carry
// a substantial desktop pad on at least one side.
//
// Strategy: sample 4 corners — top-left, top-right, bottom-left, bottom-right
// — each in a 2-4% wide strip from each edge. The corner with the LOWEST
// variance (most uniform sampling) wins as the desktop sample. If no corner
// has a clean read (every corner overlaps a window or sampler art), confidence=low.
//
function sampleCorner(ref, corner) {
  // corner: 'tl' | 'tr' | 'bl' | 'br'
  const W = ref.width, H = ref.height;
  const margin = 0.04;
  const xa = corner.includes('l') ? 0 : Math.floor(W * (1 - margin));
  const xb = corner.includes('l') ? Math.floor(W * margin) : W;
  const ya = corner.includes('t') ? 0 : Math.floor(H * (1 - margin));
  const yb = corner.includes('t') ? Math.floor(H * margin) : H;
  // Variance proxy: max channel range across the sampled pixels.
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const o = (y * ref.width + x) * 4;
      if (ref.rgba[o + 3] < 128) continue;
      const r = ref.rgba[o], g = ref.rgba[o + 1], b = ref.rgba[o + 2];
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
      sr += r; sg += g; sb += b; n++;
    }
  }
  if (n === 0) return null;
  const range = (maxR - minR) + (maxG - minG) + (maxB - minB);
  return { mean: [sr / n, sg / n, sb / n], range, n };
}

function probeDesktopBg(scheme, ref) {
  // Pick the corner with the LOWEST range — that's likely the cleanest read of
  // the desktop pattern (uniform fill or a tightly-repeating ppat).
  const corners = ['tl', 'tr', 'bl', 'br']
    .map((c) => ({ c, ...sampleCorner(ref, c) }))
    .filter((s) => s.mean);
  if (corners.length === 0) return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: 'no opaque corner pixels' };
  corners.sort((a, b) => a.range - b.range);
  const sampled = corners[0].mean;
  const sampleCornerName = corners[0].c;

  const m = scheme.manifest;
  const candidates = [];
  const deskKey = Object.keys(m.patterns ?? {}).find((k) => /desktop/i.test(k));
  if (deskKey) {
    const asset = findAssetByPath(scheme, m.patterns[deskKey].asset);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T1 patterns['${deskKey}']`, mean, tier: 'T1' });
  }
  if (m.patterns?.['ppat-17']) {
    const asset = findAssetByPath(scheme, m.patterns['ppat-17'].asset);
    const mean = meanRgbOfAsset(asset);
    if (mean) candidates.push({ name: `T2 ppat-17 (canonical)`, mean, tier: 'T2' });
  }
  // The checkerboard fallback in demo/index.html is `repeating-conic-gradient`
  // of #9a9a9a / #a4a4a4 — mean ~0xa0/0xa0/0xa0.
  candidates.push({ name: 'T3 CSS checkerboard (~#a0a0a0)', mean: [0xa0, 0xa0, 0xa0], tier: 'T3' });

  const runtime = candidates[0];
  const sortedByDist = candidates.map((c) => ({ ...c, d: rgbDist(c.mean, sampled) })).sort((a, b) => a.d - b.d);
  const best = sortedByDist[0];
  const margin = sortedByDist.length > 1 ? sortedByDist[1].d - sortedByDist[0].d : Infinity;
  // Desktop is the highest-confidence sample only when the reference clearly
  // shows a margin. If the lowest-range corner still has range > 200, the
  // corner overlaps something (window chrome, sampler art) — flag low conf.
  const lowConf = best.d > 90 || margin < 10 || corners[0].range > 200;

  return {
    runtime_tier: runtime.name,
    verified_tier: best.name,
    agree: runtime.name === best.name,
    confidence: lowConf ? 'low' : 'ok',
    notes: `corner=${sampleCornerName} range=${corners[0].range} sampled=rgb(${sampled[0].toFixed(0)},${sampled[1].toFixed(0)},${sampled[2].toFixed(0)}) bestD=${best.d.toFixed(0)} margin=${margin.toFixed(0)}`,
    sampled,
    candidates: sortedByDist,
  };
}

// folder-scene-icons — folder icons in the main window body.
//
// The Scene draws up to 2 32px folder icons starting at left=8px, top=22px of
// the main window content area. In references this corresponds to roughly
// y=27-46%, x=4-30% of the image, but the icons VARY in art per scheme and the
// scaled refs (monkey-paradise, slimes) show painterly art that doesn't match
// the bundle's ics4/ics8 pixel-perfect.
//
// Strategy: for each FINDER_CONTENT_ICON candidate the BUNDLE actually ships,
// run a scale-aware template-match in the folder-icon region (the main window
// body's first row of icons). Verify the runtime's pick agrees. If NO
// candidate is shipped, the runtime falls to neutral SVG folders — verify
// that's the case by checking no candidate scores high.
//
const FINDER_CONTENT_ICON_IDS = [-3983, -3999, -3997, -3994, -3976];

function runtimePicksFolderIcons(scheme) {
  const hit = FINDER_CONTENT_ICON_IDS.find((id) => scheme.iconIndex.some((e) => e.id === id && e.size === 32));
  return hit ? `icl ${hit}` : 'neutral SVG';
}

function probeFolderIcons(scheme, ref) {
  const candidates = [];
  for (const id of FINDER_CONTENT_ICON_IDS) {
    const e = pickIconRgba(scheme, id, 32);
    if (e) candidates.push({ ...e, name: `icl ${id}` });
  }
  if (candidates.length === 0) {
    return {
      runtime_tier: 'neutral SVG',
      verified_tier: 'neutral SVG (no candidates shipped)',
      agree: true,
      confidence: 'ok',
      notes: 'bundle ships none of FINDER_CONTENT_ICON_IDS at size=32',
    };
  }
  // Search a region matching the folder row: y=22-50%, x=2-30%.
  // The icons sit closer to the top-left than the header badge does.
  const region = { x0: 0.02, y0: 0.22, x1: 0.30, y1: 0.50 };
  const matches = candidates.map((c) => {
    const m = searchBestMatch(ref, c, { region });
    return { name: c.name, ...m };
  }).sort((a, b) => a.distance - b.distance);
  const best = matches[0];
  const ru = matches[1];
  const runtime = runtimePicksFolderIcons(scheme);
  const agree = best.name === runtime;
  const distMargin = ru ? ru.distance - best.distance : Infinity;
  const lowConf = best.distance > 100 || distMargin < 10;
  return {
    runtime_tier: runtime,
    verified_tier: best.name,
    agree,
    confidence: lowConf ? 'low' : 'ok',
    notes: `d=${best.distance.toFixed(1)} @${best.x},${best.y} ${best.scale}x; ru=${ru ? ru.name + '/d=' + ru.distance.toFixed(1) : '-'}`,
  };
}

// info-bar-text-color — verify the contrast pick by sampling the info-bar
// strip's extreme luminance pixels (the text should be the extreme one).
function probeInfoBarTextColor(scheme, ref) {
  // Same vertical band as info-bar-bg, but wider horizontally so we catch the
  // volume-name text region (which sits to the right of the badge).
  const xa = ref.width * 0.16, xb = ref.width * 0.42;
  const ya = ref.height * 0.10, yb = ref.height * 0.17;
  const xa0 = Math.max(0, Math.floor(xa));
  const ya0 = Math.max(0, Math.floor(ya));
  const xb0 = Math.min(ref.width, Math.ceil(xb));
  const yb0 = Math.min(ref.height, Math.ceil(yb));

  // Histogram by luminance; find the dominant cluster (background) and the
  // extremes (likely text pixels).
  let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
  let darkLumSum = 0, darkN = 0, lightLumSum = 0, lightN = 0;
  for (let y = ya0; y < yb0; y++) {
    for (let x = xa0; x < xb0; x++) {
      const o = (y * ref.width + x) * 4;
      if (ref.rgba[o + 3] < 128) continue;
      const r = ref.rgba[o], g = ref.rgba[o + 1], b = ref.rgba[o + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      bgR += r; bgG += g; bgB += b; bgN++;
      if (lum < 40) { darkLumSum += lum; darkN++; }
      else if (lum > 215) { lightLumSum += lum; lightN++; }
    }
  }
  if (bgN === 0) return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: 'no opaque sample pixels' };
  const bgMeanLum = luminance([bgR / bgN, bgG / bgN, bgB / bgN]);

  // The text pixels are whichever cluster is FARTHER from bg luminance and has
  // a non-trivial count (≥0.5% of sampled).
  const minCluster = Math.max(8, bgN * 0.005);
  let textColor = '?';
  if (lightN >= minCluster && darkN < minCluster) textColor = 'white';
  else if (darkN >= minCluster && lightN < minCluster) textColor = 'black';
  else if (lightN >= minCluster && darkN >= minCluster) {
    // Both clusters present — pick whichever has more contrast vs bg.
    textColor = Math.abs(bgMeanLum - 255) > Math.abs(bgMeanLum - 0) ? 'white' : 'black';
  } else {
    return { runtime_tier: '?', verified_tier: '?', agree: false, confidence: 'low', notes: `no high-contrast text cluster found (bgLum=${bgMeanLum.toFixed(0)})` };
  }

  // Runtime: mirror demo's contrast pick — texture present → black, else
  // luminance-threshold against headerColors.active.fill.
  const m = scheme.manifest;
  const hdrCe = Object.values(m.chromeElements ?? {}).find((v) => v.sourceCicnId === -9567);
  const hasTexture = (hdrCe?.bgPattern && m.patterns?.[hdrCe.bgPattern]?.asset) || m.bodyBackground?.pattern;
  const fillRgb = hexToRgb(m.headerColors?.active?.fill);
  let runtime;
  if (hasTexture) runtime = 'black';
  else if (fillRgb) runtime = luminance(fillRgb) < 128 ? 'white' : 'black';
  else runtime = 'black';

  return {
    runtime_tier: runtime,
    verified_tier: textColor,
    agree: runtime === textColor,
    confidence: 'ok',
    notes: `bgLum=${bgMeanLum.toFixed(0)} darkN=${darkN} lightN=${lightN}`,
  };
}

// ─── SLOT REGISTRY ─────────────────────────────────────────────────────────
const SLOTS = {
  'finder-header-badge':  probeHeaderBadge,
  'info-bar-bg-pattern':  probeInfoBarBg,
  'dialog-body-bg':       probeDialogBodyBg,
  'window-body-bg':       probeWindowBodyBg,
  'desktop-bg':           probeDesktopBg,
  'folder-scene-icons':   probeFolderIcons,
  'info-bar-text-color':  probeInfoBarTextColor,
};

// ─── DRIVER ────────────────────────────────────────────────────────────────
const ALL_SLUGS = [
  '1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2',
  'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som', 'evolution',
  'floppies', 'monkey-paradise', 'platinum-8', 'slimes',
  'system7-nostalgia-silver', 'windows-31', 'windows-95',
];

async function probeOne(slug, slotKeys) {
  const refPath = resolve(root, 'demo/assets/references', `${slug}.png`);
  if (!existsSync(refPath)) return { slug, error: 'no reference image' };
  const ref = decodePng(readFileSync(refPath));
  let scheme;
  try { scheme = await loadBundle(slug); }
  catch (e) { return { slug, refPath, error: `decode failed: ${e.message}` }; }
  const slotResults = {};
  for (const k of slotKeys) {
    try { slotResults[k] = SLOTS[k](scheme, ref); }
    catch (e) { slotResults[k] = { error: e.message }; }
  }
  return {
    slug,
    refPath,
    refDims: `${ref.width}x${ref.height}`,
    slots: slotResults,
  };
}

function fmtSlotTable(slotKey, results) {
  const cols = ['bundle', 'ref_dims', 'runtime_tier', 'verified_tier', 'agree?', 'conf', 'notes'];
  const rows = results.map((r) => {
    if (r.error) return { bundle: r.slug, ref_dims: '-', runtime_tier: '-', verified_tier: 'ERROR: ' + r.error, 'agree?': '-', conf: '-', notes: '' };
    const s = r.slots[slotKey];
    if (!s) return { bundle: r.slug, ref_dims: r.refDims, runtime_tier: '-', verified_tier: '-', 'agree?': '-', conf: '-', notes: 'no slot result' };
    if (s.error) return { bundle: r.slug, ref_dims: r.refDims, runtime_tier: '-', verified_tier: 'ERROR: ' + s.error, 'agree?': '-', conf: '-', notes: '' };
    return {
      bundle: r.slug,
      ref_dims: r.refDims,
      runtime_tier: s.runtime_tier,
      verified_tier: s.verified_tier,
      'agree?': s.agree ? 'YES' : 'NO',
      conf: s.confidence,
      notes: s.notes ?? '',
    };
  });
  const widths = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]));
  const pad = (s, w) => String(s).padEnd(w);
  const header = cols.map((c) => pad(c, widths[c])).join('  ');
  const sep = cols.map((c) => '─'.repeat(widths[c])).join('  ');
  const body = rows.map((r) => cols.map((c) => pad(r[c], widths[c])).join('  ')).join('\n');
  return `${header}\n${sep}\n${body}`;
}

async function main() {
  const args = process.argv.slice(2);
  const writeJson = args.includes('--write');
  const onlySlug = args.find((a) => a.startsWith('--slug='))?.slice(7);
  const onlySlot = args.find((a) => a.startsWith('--slot='))?.slice(7);
  const slugs = onlySlug ? [onlySlug] : ALL_SLUGS;
  const slotKeys = onlySlot ? [onlySlot] : Object.keys(SLOTS);
  for (const k of slotKeys) {
    if (!SLOTS[k]) {
      console.error(`unknown slot: ${k}\nknown: ${Object.keys(SLOTS).join(', ')}`);
      process.exit(2);
    }
  }

  console.log(`Probing ${slugs.length} bundle(s) × ${slotKeys.length} slot(s)\n`);
  const results = [];
  for (const slug of slugs) {
    process.stderr.write(`  ${slug}…`);
    const r = await probeOne(slug, slotKeys);
    results.push(r);
    if (r.error) process.stderr.write(` ${r.error}\n`);
    else process.stderr.write(` ${slotKeys.map((k) => r.slots[k]?.agree === undefined ? '?' : r.slots[k].agree ? '✓' : '✗').join('')}\n`);
  }

  // Per-slot tables.
  for (const k of slotKeys) {
    console.log('\n' + '═'.repeat(80));
    console.log(`Slot: ${k}`);
    console.log('═'.repeat(80));
    console.log(fmtSlotTable(k, results));
  }

  // Discrepancy report — the headline.
  console.log('\n' + '═'.repeat(80));
  console.log('DISCREPANCY REPORT (runtime DISAGREES with reference ground truth)');
  console.log('═'.repeat(80));
  let total = 0;
  for (const k of slotKeys) {
    const disagreements = results.filter((r) => !r.error && r.slots[k] && !r.slots[k].error && r.slots[k].agree === false);
    if (disagreements.length === 0) {
      console.log(`  ${k.padEnd(24)} ✓ no disagreement across ${results.length - results.filter((r) => r.error).length} bundles`);
      continue;
    }
    console.log(`  ${k.padEnd(24)} ✗ ${disagreements.length} bundle(s) disagree:`);
    for (const d of disagreements) {
      const s = d.slots[k];
      const confTag = s.confidence === 'low' ? ' [LOW CONFIDENCE]' : '';
      console.log(`      ${d.slug.padEnd(28)} runtime="${s.runtime_tier}" verified="${s.verified_tier}"${confTag}`);
      if (s.notes) console.log(`      ${' '.repeat(28)} ${s.notes}`);
      total++;
    }
  }
  console.log('═'.repeat(80));
  console.log(`${total} disagreement(s) total. Low-confidence rows are sampling-uncertain;`);
  console.log(`high-confidence disagreements are the bugs worth fixing.`);

  if (writeJson) {
    const out = {};
    for (const r of results) {
      if (r.error) continue;
      out[r.slug] = {};
      for (const k of slotKeys) {
        const s = r.slots[k];
        if (!s || s.error) continue;
        out[r.slug][k] = {
          runtime: s.runtime_tier,
          verified: s.verified_tier,
          agree: s.agree,
          confidence: s.confidence,
        };
      }
    }
    const outPath = resolve(root, 'docs/spec/scene-slot-ground-truth.json');
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\nWrote ${outPath}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
