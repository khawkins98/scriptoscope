#!/usr/bin/env node
// Build an authored Kaleidoscope scheme from code.
//
// Usage: npm run author -- <scheme dir>        e.g. authoring/schemes/halcyon
//
// The scheme dir holds a `scheme.mjs` that exports `buildScheme()`, returning
// `{ resources }` (see tools/theme-author/ and docs/authoring-a-scheme.md).
// This script:
//   1. calls buildScheme() and serializes the resources into a resource fork;
//   2. reads those bytes back through the SAME conversion the browser runtime
//      uses (convertChrome), so anything the runtime would reject fails here first;
//   3. checks the authoring rules in tools/theme-author/check-scheme.js and
//      prints a short report;
//   4. only if there are no errors, writes <dir>/scheme.rsrc.
// Exit code 1 on any error (scheme.rsrc is left untouched). Warnings do not fail the build.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeResourceFork } from '../tools/theme-author/resource-fork-writer.js';
import { checkScheme } from '../tools/theme-author/check-scheme.js';
import { convertChrome } from '../tools/theme-loader/convert.js';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npm run author -- <scheme dir containing scheme.mjs>');
  process.exit(2);
}
const schemeDir = resolve(dir);
const entry = resolve(schemeDir, 'scheme.mjs');
if (!existsSync(entry)) {
  console.error(`No scheme.mjs in ${schemeDir}`);
  process.exit(2);
}

// Mistakes in scheme.mjs (a bad windowLayout spec, a fractional pixel, too
// many colours) throw with a message that says what to change; show that
// message rather than a stack trace. DEBUG=1 prints the stack too.
let resources, fork;
try {
  const { buildScheme } = await import(pathToFileURL(entry).href);
  ({ resources } = await buildScheme());
  fork = writeResourceFork(resources);
} catch (err) {
  console.error(`✗ Building ${entry} failed: ${err instanceof Error ? err.message : err}`);
  if (process.env.DEBUG && err instanceof Error) console.error(err.stack);
  process.exit(1);
}
const out = resolve(schemeDir, 'scheme.rsrc');

const metaPath = resolve(schemeDir, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};

let converted;
try {
  converted = convertChrome(fork, { meta, source: 'scheme.rsrc' });
} catch (err) {
  console.error(`✗ The runtime's loader rejected the scheme: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const { errors, warnings, summary } = checkScheme(resources, converted.theme);
for (const line of summary) console.log(`  ${line}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (errors.length) { console.error(`✗ ${errors.length} error(s); ${out} was not written.`); process.exit(1); }
writeFileSync(out, fork);
console.log(`Wrote ${out} (${fork.length.toLocaleString()} bytes, ${resources.length} resources)`);
console.log('✓ Loads through the runtime converter. Preview: npm run dev, then open /authoring-preview.html (or drop scheme.rsrc on the showcase).');
