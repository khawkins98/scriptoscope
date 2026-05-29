// scripts/probe-reference-slot.mjs
//
// Reference-image pixel probe. Given the period-faithful reference screenshot
// shipped with each bundle (in demo/assets/references/<slug>.png), find the
// volume-icon slot's pixels and pixel-match them against the candidate icons
// the runtime might pick (ics4/ics8 -3790, FINDER_GRID_PNG sliced from the
// reference, etc). The winner is GROUND TRUTH — what the original Finder
// actually rendered in that slot — and is the answer the runtime's tier walk
// SHOULD produce. Disagreements are bugs the runtime can now SEE without
// guessing.
//
// Motivation — see docs/scene-slot-spec.md (volume-icon entry) and
// LEARNINGS.md "Visual misreads at thumbnail resolution flip 'spec wrong vs
// runtime wrong'" (2026-05-29). The thumbnail-eyeball net is unreliable for
// 16×16 slots; this probe replaces eyeballing with pixel distance.
//
// USAGE
//   node scripts/probe-reference-slot.mjs               # print volume-icon table
//   node scripts/probe-reference-slot.mjs --slot=volume-icon
//   node scripts/probe-reference-slot.mjs --write       # write ground-truth JSON
//
// CONSTRAINTS (per the brief)
//   - Pure node. No browser/playwright.
//   - PNG decode is minimal (paletted + RGBA both supported here).
//   - Reference discovery: demo/assets/references/<slug>.png (the local copy
//     listed in each bundle's PROVENANCE.md as "Reference render").
//   - Don't auto-commit. The script stages its own file only when --write is
//     passed AND the user has reviewed the table.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

import { convertScheme } from '../tools/theme-loader/convert.js';
import { detectContainer, unwrapToResourceFork } from '../tools/theme-loader/containers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── PNG DECODER ───────────────────────────────────────────────────────────
// Extends scripts/diag-lib.mjs's decoder (color types 6/2/0) with paletted
// type 3 + tRNS, since 12 of 18 reference PNGs ship as 4-bit/8-bit palette.
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
  let plte = null;        // palette (color type 3): Uint8Array of [r,g,b, r,g,b, ...]
  let trns = null;        // tRNS chunk for paletted PNGs: Uint8Array of alpha per palette entry
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

  // Compute bits-per-pixel + channels-per-pixel.
  // colorType: 0=gray, 2=rgb, 3=palette-index, 4=gray+alpha, 6=rgba.
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
    // Reverse the per-row filter.
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

    // Unpack the row into RGBA.
    if (colorType === 3) {
      // Paletted: each pixel is a palette index, sub-byte packed for depths 1/2/4.
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
      // RGBA (only 8-bit supported here — every IDE-produced reference is 8-bit).
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
      // Gray + alpha.
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * 2;
        out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1];
      }
    } else {
      // Gray (channels === 1, colorType 0). Bit depths 1/2/4/8 supported.
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
// Re-uses the decode path from tools/theme-loader/convert.js — we don't go
// through loadKaleidoscopeScheme because it produces blob URLs (Node-hostile),
// and we don't go through `npm run build:themes` because that's a slow file-
// write side trip when all we need is the RGBA of -3790. convertScheme runs
// in-memory in <100ms per bundle.
//
async function loadBundle(slug) {
  const dir = resolve(root, 'themes', slug);
  let bytes;
  for (const name of ['scheme.sit', 'scheme.rsrc']) {
    const p = resolve(dir, name);
    if (existsSync(p)) { bytes = new Uint8Array(readFileSync(p)); break; }
  }
  if (!bytes) throw new Error(`no scheme archive in themes/${slug}/`);

  let fork;
  if (detectContainer(bytes) === 'stuffit') {
    const { stuffItResourceFork } = await import('../tools/sit-wasm/index.mjs');
    fork = await stuffItResourceFork(bytes);
  } else {
    fork = unwrapToResourceFork(bytes);
  }
  return convertScheme(fork, { source: `${slug}/scheme` });
}

// ─── FINDER_GRID_PNG (the T2 candidate) ────────────────────────────────────
// The 13×13 grid the runtime hands to schemes that don't ship ics4 -3790. It
// was sliced from system7-nostalgia-silver-reference.png and base64-inlined
// into demo/index.html.
//
const FINDER_GRID_DATA_URL = 'iVBORw0KGgoAAAANSUhEUgAAAA0AAAANAgAAAAAdMKMBAAAAAnRSTlMAA++anIIAAAABb3JOVAHPoneaAAAAFUlEQVQI12NYtWpVA8P+/fuRCVLEAGm6Ip4agi9NAAAAAElFTkSuQmCC';
function loadFinderGrid() {
  const buf = Buffer.from(FINDER_GRID_DATA_URL, 'base64');
  return decodePng(buf); // { width:13, height:13, rgba }
}

// ─── PIXEL DISTANCE + SCALE-AWARE TEMPLATE MATCH ───────────────────────────
//
// Template matching with multi-scale support. Reference screenshots ship at
// wildly different scales — 195×127 native through 1024×856 — so we slide each
// candidate across the upper-left quadrant at integer scales 1..6 and keep
// the (scale, x, y, distance) tuple that wins.
//
// Distance metric: mean RGB delta over the candidate's OPAQUE pixels. Fully
// transparent pixels in the candidate are skipped — they tell us nothing
// about what's behind the slot, and the info bar's coloured fill SHOULD show
// through them (the runtime relies on this). Edge pixels with partial alpha
// are weighted by their alpha; reduces "the grid's gray frame is exactly
// gray, but the surrounding fill is brown" from blowing the average.

function nearestSample(srcW, srcH, srcRgba, sx, sy) {
  const ix = Math.min(srcW - 1, Math.max(0, sx | 0));
  const iy = Math.min(srcH - 1, Math.max(0, sy | 0));
  const o = (iy * srcW + ix) * 4;
  return [srcRgba[o], srcRgba[o + 1], srcRgba[o + 2], srcRgba[o + 3]];
}

function distanceAt(ref, cand, scale, ox, oy) {
  // For each candidate pixel (cx,cy), look at the scale×scale ref region it
  // would have been upscaled INTO and average the ref pixels there (downsample
  // by box averaging — cheap, scale-aware, matches the "screenshot was N× then
  // saved" assumption). Compute weighted RGB distance vs the candidate pixel.
  let totalWeight = 0;
  let totalDist = 0;
  for (let cy = 0; cy < cand.height; cy++) {
    for (let cx = 0; cx < cand.width; cx++) {
      const co = (cy * cand.width + cx) * 4;
      const ca = cand.rgba[co + 3];
      if (ca === 0) continue; // fully transparent — no signal

      // Average the scale×scale region in the reference under this candidate pixel.
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
  return totalDist / totalWeight; // mean weighted RGB-channel delta per opaque pixel
}

function searchBestMatch(ref, cand, opts = {}) {
  // Search the upper-left INFO BAR region, NOT the title bar — the close-box
  // widget glyph (-14336) lives at the title bar's left edge, where a naive
  // upper-left search would match it as a false positive. Skipping the top
  // ~15% (≈y=19 native, ≈y=128 on a 856-tall ref) puts the search BELOW the
  // title bar in every corpus reference. apple-platinum-2 and slimes both
  // false-positively matched -14336 before this clamp was added.
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

// ─── CANDIDATES FOR THE VOLUME-ICON SLOT ───────────────────────────────────
// Per docs/scene-slot-spec.md volume-icon:
//   T1: ics4 / ics8 -3790  (Mac OS volume info icon)
//   T2: FINDER_GRID_PNG    (period system-default grid)
// We also probe -14336 because that's the slot the RETRACTED hierarchy used
// to wire as T2 for corner-sprite schemes. The retraction trigger says: "if
// the corner-sprite schemes' volume slot is the system grid (not -14336),
// the retraction stands." This probe MEASURES that.

const VOLUME_CANDIDATE_IDS = [-3790, -14336];

function pickIconRgba(scheme, id) {
  // Prefer ics8 (depth 8) over ics4 (depth 4) at size 16, matching the
  // demo's iconographic policy (loadGlyphMap → highest-depth wins).
  const candidates = scheme.iconIndex
    .filter((e) => e.id === id && e.size === 16)
    .sort((a, b) => b.depth - a.depth);
  for (const c of candidates) {
    // iconIndex's `file` is the bare filename ("ics8-n3790.png"); convert.js
    // tags assets with their bundle-relative path ("icons/<file>"). Match by
    // suffix to bridge the two without coupling to a literal prefix.
    const asset = scheme.assets.find((a) => a.path === `icons/${c.file}`);
    if (asset) return { ...c, rgba: new Uint8ClampedArray(asset.rgba), width: asset.width, height: asset.height };
  }
  return null;
}

// ─── RUNTIME TIER WALK (mirrored from gridProxyIcon) ───────────────────────
//
// The runtime answer for each bundle, so the table's last column can show
// agreement (✓) vs disagreement (✗) at a glance. Mirrors demo/index.html
// gridProxyIcon's lookup order EXACTLY:
//   1. ics4/ics8 -3790 at size 16  →  "ics -3790"
//   2. else                        →  "FINDER_GRID"

function runtimePicksVolumeIcon(scheme) {
  const hit = scheme.iconIndex.find((e) => e.id === -3790 && e.size === 16);
  return hit ? 'ics -3790' : 'FINDER_GRID';
}

// ─── DRIVER ────────────────────────────────────────────────────────────────

const ALL_SLUGS = [
  '1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2',
  'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som', 'evolution',
  'floppies', 'monkey-paradise', 'platinum-8', 'slimes',
  'system7-nostalgia-silver', 'windows-31', 'windows-95',
];

async function probeOne(slug) {
  const refPath = resolve(root, 'demo/assets/references', `${slug}.png`);
  if (!existsSync(refPath)) return { slug, error: 'no reference image' };
  const ref = decodePng(readFileSync(refPath));

  let scheme;
  try { scheme = await loadBundle(slug); }
  catch (e) { return { slug, refPath, error: `decode failed: ${e.message}` }; }

  // Build the candidate set: every ics4/ics8 at the volume-candidate ids the
  // bundle actually ships, plus FINDER_GRID.
  const candidates = [];
  for (const id of VOLUME_CANDIDATE_IDS) {
    const e = pickIconRgba(scheme, id);
    if (e) candidates.push({ ...e, name: `${e.type} ${id}` }); // name LAST so it isn't clobbered by spread
  }
  candidates.push({ ...loadFinderGrid(), name: 'FINDER_GRID' });

  // Search each candidate against the reference's upper-left region. The
  // info bar in every Kaleidoscope sampler reference sits in the top ~60%
  // and the volume icon is at the leading (left) edge — so probing the
  // upper-left quadrant covers it across every scale.
  const matches = candidates.map((c) => {
    const m = searchBestMatch(ref, c);
    return { name: c.name, ...m };
  }).sort((a, b) => a.distance - b.distance);

  return {
    slug,
    refPath,
    refDims: `${ref.width}x${ref.height}`,
    refDims_w: ref.width,
    refDims_h: ref.height,
    matches,
    best: matches[0],
    runtimePicks: runtimePicksVolumeIcon(scheme),
  };
}

function fmtTable(results) {
  const cols = ['bundle', 'ref_dims', 'best_match', 'dist', 'scale', 'pos', 'x%', 'runner_up', 'ru_dist', 'runtime', 'agree', 'conf'];
  const rows = results.map((r) => {
    if (r.error) return { bundle: r.slug, ref_dims: '-', best_match: 'ERROR', dist: r.error, scale: '-', pos: '-', 'x%': '-', runner_up: '-', ru_dist: '-', runtime: '-', agree: '?', conf: '-' };
    const best = r.best;
    const ru = r.matches[1] || null;
    const bestName = best.name;
    // Agreement: map runtime's "ics -3790" / "FINDER_GRID" to whichever match wins.
    const runtimeMaps = (r.runtimePicks === 'ics -3790') ? /^ics[48] -3790$/ : /^FINDER_GRID$/; // matches "ics4 -3790" / "ics8 -3790"
    const agree = runtimeMaps.test(bestName) ? 'YES' : 'NO';
    // Position-plausibility confidence: volume icon sits at the LEFT EDGE of
    // the inner folder window's info bar — well within the leftmost ~20% of
    // any reference. A match at x > 25%W is suspicious (probably matched the
    // candidate appearing elsewhere — e.g. embedded sampler art, dialog
    // widget). The reference images from macthemes.garden are sampler images
    // that may contain the bundle's icon set in places OTHER than the volume
    // slot, so a pixel-perfect match deep in the image isn't ground truth.
    const xPct = (best.x / r.refDims_w) * 100;
    const farFromLeft = xPct > 25;
    const distMargin = ru ? ru.distance - best.distance : Infinity;
    const lowConfidence = farFromLeft || best.distance > 100 || distMargin < 10;
    return {
      bundle: r.slug,
      ref_dims: r.refDims,
      best_match: bestName,
      dist: best.distance.toFixed(1),
      scale: `${best.scale}x`,
      pos: `${best.x},${best.y}`,
      'x%': xPct.toFixed(0) + '%',
      runner_up: ru ? ru.name : '-',
      ru_dist: ru ? ru.distance.toFixed(1) : '-',
      runtime: r.runtimePicks,
      agree,
      conf: lowConfidence ? 'low' : 'ok',
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
  const slugs = onlySlug ? [onlySlug] : ALL_SLUGS;

  console.log(`Probing ${slugs.length} bundle(s) for volume-icon ground truth\n`);
  const results = [];
  for (const slug of slugs) {
    process.stderr.write(`  ${slug}…`);
    const r = await probeOne(slug);
    results.push(r);
    process.stderr.write(r.error ? ` ${r.error}\n` : ` ${r.best.name} (d=${r.best.distance.toFixed(1)})\n`);
  }

  console.log('\n' + fmtTable(results));

  // Reference path log — for the report.
  console.log('\nReference images used:');
  for (const r of results) {
    console.log(`  ${r.slug.padEnd(25)} ${r.refPath ?? '(none)'} ${r.refDims ? '(' + r.refDims + ')' : ''}`);
  }

  // Disagreement summary — owner reads this first.
  const disagreements = results.filter((r) => !r.error && (() => {
    const re = (r.runtimePicks === 'ics -3790') ? /^ics[48] -3790$/ : /^FINDER_GRID$/;
    return !re.test(r.best.name);
  })()); // IIFE so the filter sees the per-row pick
  console.log('\n' + '='.repeat(60));
  if (disagreements.length === 0) {
    console.log('Probe agrees with runtime on all bundles — volume-icon is verified.');
  } else {
    console.log(`Probe DISAGREES with runtime on ${disagreements.length} bundle(s):`);
    for (const d of disagreements) {
      console.log(`  ${d.slug}: probe picks "${d.best.name}", runtime picks "${d.runtimePicks}"`);
    }
  }
  console.log('='.repeat(60));

  if (writeJson) {
    const out = {};
    for (const r of results) {
      if (r.error) continue;
      out[r.slug] = { 'volume-icon': r.best.name, distance: Number(r.best.distance.toFixed(2)) };
    }
    const outPath = resolve(root, 'themes/scene-slot-ground-truth.json');
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\nWrote ${outPath}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
