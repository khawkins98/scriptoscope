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
import {
  parseDerezText,
  decodeAll,
  buildThemeJson,
  validateTheme,
  ThemeValidationError,
} from '../../../src/themes/loader/index.js';

function parseArgs(argv) {
  const args = {
    input: null, output: null, types: null, verbose: false,
    meta: null, validate: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') args.input = argv[++i];
    else if (a === '--output' || a === '-o') args.output = argv[++i];
    else if (a === '--types' || a === '-t') args.types = argv[++i].split(',');
    else if (a === '--meta' || a === '-m') args.meta = argv[++i];
    else if (a === '--validate') args.validate = true;
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

Extract cicn/ppat raster assets + cinf/wnd# geometry from a DeRez .r file
(Kaleidoscope scheme resource fork decompilation) and emit a theme.json
bundle for Aaron UI.

Options:
  -i, --input <file>     DeRez .r text file (required)
  -o, --output <dir>     Output directory (will be created) (required)
  -t, --types <list>     Comma-separated types to extract
                         (default: cicn,ppat,cinf,wnd#)
  -m, --meta <file>      Optional sidecar JSON with bundle metadata —
                         { name, author, origin, options } — merged
                         into theme.json. The binary scheme doesn't
                         carry author/license info; this is where it lives.
      --validate         Run schema validation on the emitted theme.json
                         (per docs/kaleidoscope-geometry-spec.md §7).
                         Exit non-zero on schema violation.
  -v, --verbose          Print per-resource extraction progress
  -h, --help             Show this help

Output:
  <dir>/cicn-<id>-<slug>.png      One PNG per decoded cicn
  <dir>/ppat-<id>-<slug>.png      One PNG per decoded ppat
  <dir>/extraction-manifest.json  Per-resource extraction record
  <dir>/theme.json                Schema-conformant Aaron UI bundle
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

  // Optional sidecar metadata (author, license, options) the binary scheme
  // doesn't carry. Merged on top of the extracted chrome/patterns sections.
  let meta = {};
  if (args.meta) {
    const metaPath = resolve(args.meta);
    if (!existsSync(metaPath)) {
      console.error(`Meta file not found: ${metaPath}`);
      process.exit(1);
    }
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  }

  // Build theme.json per docs/kaleidoscope-geometry-spec.md §7.
  // Validated by parseTheme in src/themes/schema/parseTheme.ts (TS source of
  // truth) and by validateTheme.js (JS mirror used by --validate).
  const themeJson = buildThemeJson(manifest, { meta });
  writeFileSync(
    join(outputDir, 'theme.json'),
    JSON.stringify(themeJson, null, 2),
  );

  console.log(
    `\nDone. ok=${manifest.counts.ok} (raster=${manifest.counts.raster}, geometry=${manifest.counts.geometry}) skipped=${manifest.counts.skipped} errored=${manifest.counts.errored}`,
  );
  console.log(`Output: ${outputDir}`);
  console.log(`Wrote: extraction-manifest.json, theme.json`);

  if (args.validate) {
    try {
      validateTheme(themeJson);
      console.log('Schema validation: PASS (theme.json conforms to spec §7)');
    } catch (e) {
      if (e instanceof ThemeValidationError) {
        console.error(`Schema validation: FAIL — ${e.message}`);
      } else {
        console.error(`Schema validation: FAIL — ${e}`);
      }
      process.exit(1);
    }
  }
}

main();
