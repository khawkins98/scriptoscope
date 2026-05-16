#!/usr/bin/env node
// CLI wrapper for @aaron-ui/scheme-extractor.
//
//   scheme-extract --input scheme.r --output ./out/
//
// Reads a DeRez .r file, decodes every cicn and ppat resource into a PNG,
// and writes an extraction-manifest.json describing what was produced.
//
// Why this is a CLI today: the input pipeline starts with macOS `DeRez`
// decompiling a resource fork, so the workflow naturally runs locally on
// a Mac. The actual decoders in lib/ are pure JS with no Node imports —
// the same code runs in Node (via this CLI), as a Node module
// (import from '@aaron-ui/scheme-extractor'), or in a browser once a
// pure-JS resource-fork parser replaces the DeRez preprocessing step.
// See README.md "Three modes, one decoder."

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { PNG } from 'pngjs';
import { parseDerezText, decodeAll } from '../lib/index.js';

function parseArgs(argv) {
  const args = { input: null, output: null, types: null, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') args.input = argv[++i];
    else if (a === '--output' || a === '-o') args.output = argv[++i];
    else if (a === '--types' || a === '-t') args.types = argv[++i].split(',');
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${a}`); printHelp(); process.exit(2); }
  }
  if (!args.input || !args.output) { printHelp(); process.exit(2); }
  return args;
}

function printHelp() {
  console.log(`
Usage: scheme-extract --input <scheme.r> --output <dir> [options]

Extract cicn/ppat raster assets from a DeRez .r file (Kaleidoscope scheme
resource fork decompilation) and write them as PNGs.

Options:
  -i, --input <file>     DeRez .r text file (required)
  -o, --output <dir>     Output directory (will be created) (required)
  -t, --types <list>     Comma-separated types to extract (default: cicn,ppat)
  -v, --verbose          Print per-resource extraction progress
  -h, --help             Show this help

Output:
  <dir>/cicn-<id>-<slug>.png   One PNG per decoded cicn
  <dir>/ppat-<id>-<slug>.png   One PNG per decoded ppat
  <dir>/extraction-manifest.json  Listing of all extracted assets
`);
}

function slugify(name) {
  if (!name) return 'unnamed';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unnamed';
}

function writePng(path, width, height, rgba) {
  const png = new PNG({ width, height, colorType: 6 /* RGBA */ });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  writeFileSync(path, PNG.sync.write(png));
}

function main() {
  const args = parseArgs(process.argv);
  // Default types now include cinf + wnd# for geometry metadata (no PNG output;
  // they appear in the manifest only). See docs/kaleidoscope-geometry-spec.md.
  const wantedTypes = new Set(args.types || ['cicn', 'ppat', 'cinf', 'wnd#']);

  const inputPath = resolve(args.input);
  const outputDir = resolve(args.output);
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }
  mkdirSync(outputDir, { recursive: true });

  const text = readFileSync(inputPath, { encoding: 'latin1' });
  const records = parseDerezText(text);
  console.log(`Parsed ${records.length} resources from ${basename(inputPath)}`);

  const targets = records.filter(r => wantedTypes.has(r.type));
  console.log(`Decoding ${targets.length} resources of types: ${[...wantedTypes].join(', ')}`);

  const decoded = decodeAll(targets);

  const manifest = {
    source: basename(inputPath),
    extractedAt: new Date().toISOString(),
    counts: { total: targets.length, ok: 0, skipped: 0, errored: 0,
              raster: 0, geometry: 0 },
    assets: [],
  };

  for (const { record, decoded: data, error } of decoded) {
    if (error) {
      manifest.counts.errored++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'error', error,
      });
      if (args.verbose) console.warn(`  ✗ ${record.type} ${record.id} ${record.name || ''}: ${error}`);
      continue;
    }
    if (!data) {
      manifest.counts.skipped++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'skipped', reason: 'unsupported variant',
      });
      if (args.verbose) console.log(`  - ${record.type} ${record.id} ${record.name || ''} (skipped)`);
      continue;
    }

    // Raster types (cicn, ppat) emit a PNG plus manifest entry.
    // Geometry types (cinf, wnd#) emit manifest entry only.
    if (record.type === 'cicn' || record.type === 'ppat') {
      const filename = `${record.type}-${String(record.id).replace('-', 'n')}-${slugify(record.name)}.png`;
      const filepath = join(outputDir, filename);
      writePng(filepath, data.width, data.height, data.rgba);
      manifest.counts.ok++;
      manifest.counts.raster++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'ok',
        file: filename,
        width: data.width, height: data.height,
        debug: data.debug,
      });
      if (args.verbose) {
        console.log(`  ✓ ${record.type} ${record.id} "${record.name || ''}" → ${filename} (${data.width}×${data.height})`);
      }
    } else {
      // cinf, wnd#: structured geometry metadata, no PNG.
      manifest.counts.ok++;
      manifest.counts.geometry++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'ok',
        data,
      });
      if (args.verbose) {
        console.log(`  ✓ ${record.type} ${record.id} "${record.name || ''}" → geometry`);
      }
    }
  }

  writeFileSync(
    join(outputDir, 'extraction-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  // Emit theme.json prototype per the schema in docs/kaleidoscope-geometry-spec.md §7.
  // Pairs each cicn raster with its sibling cinf geometry (by matching resource ID),
  // and each wnd# with its associated chrome cicns (by ID convention: wnd# -14336
  // pairs with cicn -14336 "(In)active Document Window" etc.).
  const themeJson = buildThemeJson(manifest);
  writeFileSync(
    join(outputDir, 'theme.json'),
    JSON.stringify(themeJson, null, 2),
  );

  console.log(
    `\nDone. ok=${manifest.counts.ok} (raster=${manifest.counts.raster}, geometry=${manifest.counts.geometry}) skipped=${manifest.counts.skipped} errored=${manifest.counts.errored}`,
  );
  console.log(`Output: ${outputDir}`);
  console.log(`Wrote: extraction-manifest.json, theme.json`);
}

/**
 * Build a draft theme.json from the manifest. The shape matches the proposed
 * schema in docs/kaleidoscope-geometry-spec.md §7 — at this stage we emit the
 * chromeElements (raster + cinf paired) and windowTypes (wnd# parts + edges)
 * sections. Aaron UI's WM consumes this to render windows.
 */
function buildThemeJson(manifest) {
  const byTypeAndId = new Map(); // key: `${type}:${id}`
  for (const a of manifest.assets) {
    if (a.status === 'ok') byTypeAndId.set(`${a.type}:${a.id}`, a);
  }

  const cicns = manifest.assets.filter(a => a.type === 'cicn' && a.status === 'ok');
  const wnds  = manifest.assets.filter(a => a.type === 'wnd#' && a.status === 'ok');

  const chromeElements = {};
  for (const cicn of cicns) {
    const cinf = byTypeAndId.get(`cinf:${cicn.id}`);
    const slug = slugify(cicn.name);
    chromeElements[slug || `cicn-${cicn.id}`] = {
      asset: cicn.file,
      width: cicn.width,
      height: cicn.height,
      slice: cinf?.data ? {
        corner: cinf.data.cornerSize,
        side: cinf.data.sideThickness,
        tile: cinf.data.tileSides !== 0,
      } : null,
      bgPattern: cinf?.data && cinf.data.bgPatternId !== 0 ? {
        ppatId: cinf.data.bgPatternId,
        anchor: cinf.data.bgPixel,
      } : null,
      textAnchor: cinf?.data ? cinf.data.textPixel : null,
      embossAnchor: cinf?.data ? cinf.data.embossPixel : null,
      sourceCicnId: cicn.id,
      sourceCinfId: cinf?.id ?? null,
    };
  }

  const windowTypes = {};
  for (const wnd of wnds) {
    const slug = slugify(wnd.name) || `wnd-${wnd.id}`;
    // Convention: wnd# -N pairs with cicn -N for the active chrome.
    // Inactive cicn is typically at adjacent IDs; we don't try to auto-pair here.
    const chromeCicn = byTypeAndId.get(`cicn:${wnd.id}`);
    windowTypes[slug] = {
      wndId: wnd.id,
      chrome: chromeCicn ? { active: chromeCicn.file, cicnId: chromeCicn.id } : null,
      // wnd# Mac classic rects are (top, left, bottom, right); we re-emit in the same
      // shape since consumers will convert per their needs.
      parts: wnd.data.rectangles.map(r => ({ partId: r.part, rect: r.rect })),
      edges: {
        top:    wnd.data.topSide,
        bottom: wnd.data.bottomSide,
        left:   wnd.data.leftSide,
        right:  wnd.data.rightSide,
      },
    };
  }

  return {
    version: '0.1',
    source: manifest.source,
    generatedAt: manifest.extractedAt,
    note: 'Draft theme.json produced by @aaron-ui/scheme-extractor. ' +
          'Schema per docs/kaleidoscope-geometry-spec.md §7. ' +
          'Author/license metadata must be added manually per scheme.',
    chromeElements,
    windowTypes,
  };
}

main();
