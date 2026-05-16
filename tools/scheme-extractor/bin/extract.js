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
  const wantedTypes = new Set(args.types || ['cicn', 'ppat']);

  const inputPath = resolve(args.input);
  const outputDir = resolve(args.output);
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }
  mkdirSync(outputDir, { recursive: true });

  // Read as 'binary' / latin1 so high-bit MacRoman bytes in DeRez comments
  // survive 1:1 through string operations.
  const text = readFileSync(inputPath, { encoding: 'latin1' });
  const records = parseDerezText(text);
  console.log(`Parsed ${records.length} resources from ${basename(inputPath)}`);

  const targets = records.filter(r => wantedTypes.has(r.type));
  console.log(`Decoding ${targets.length} resources of types: ${[...wantedTypes].join(', ')}`);

  const decoded = decodeAll(targets);

  const manifest = {
    source: basename(inputPath),
    extractedAt: new Date().toISOString(),
    counts: { total: targets.length, ok: 0, skipped: 0, errored: 0 },
    assets: [],
  };

  for (const { record, decoded: img, error } of decoded) {
    if (error) {
      manifest.counts.errored++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'error', error,
      });
      if (args.verbose) console.warn(`  ✗ ${record.type} ${record.id} ${record.name || ''}: ${error}`);
      continue;
    }
    if (!img) {
      manifest.counts.skipped++;
      manifest.assets.push({
        type: record.type, id: record.id, name: record.name,
        status: 'skipped', reason: 'unsupported variant',
      });
      if (args.verbose) console.log(`  - ${record.type} ${record.id} ${record.name || ''} (skipped)`);
      continue;
    }

    const filename = `${record.type}-${String(record.id).replace('-', 'n')}-${slugify(record.name)}.png`;
    const filepath = join(outputDir, filename);
    writePng(filepath, img.width, img.height, img.rgba);

    manifest.counts.ok++;
    manifest.assets.push({
      type: record.type, id: record.id, name: record.name,
      status: 'ok',
      file: filename,
      width: img.width, height: img.height,
      debug: img.debug,
    });
    if (args.verbose) {
      console.log(`  ✓ ${record.type} ${record.id} "${record.name || ''}" → ${filename} (${img.width}×${img.height})`);
    }
  }

  writeFileSync(
    join(outputDir, 'extraction-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(
    `\nDone. ok=${manifest.counts.ok} skipped=${manifest.counts.skipped} errored=${manifest.counts.errored}`,
  );
  console.log(`Output: ${outputDir}`);
}

main();
