#!/usr/bin/env node
// Check all authored Kaleidoscope schemes under authoring/schemes/.
// Verifies that:
// 1. Each scheme builds cleanly with buildScheme()
// 2. The serialized fork passes convertChrome()
// 3. checkScheme() finds no authoring errors
// 4. The committed scheme.rsrc matches the fresh build byte-for-byte

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeResourceFork } from '../tools/theme-author/resource-fork-writer.js';
import { checkScheme } from '../tools/theme-author/check-scheme.js';
import { convertChrome } from '../tools/theme-loader/convert.js';

const root = resolve(import.meta.dirname, '..');
const authoredDir = resolve(root, 'authoring/schemes');

const slugs = readdirSync(authoredDir).filter((name) => {
  return existsSync(resolve(authoredDir, name, 'scheme.mjs'));
}).sort();

let hadErrors = false;

for (const slug of slugs) {
  const schemeDir = resolve(authoredDir, slug);
  const entry = resolve(schemeDir, 'scheme.mjs');
  const rsrcPath = resolve(schemeDir, 'scheme.rsrc');
  const metaPath = resolve(schemeDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};

  try {
    const { buildScheme } = await import(pathToFileURL(entry).href);
    const { resources } = await buildScheme();
    const fork = writeResourceFork(resources);

    const converted = convertChrome(fork, { meta, source: 'scheme.rsrc' });
    const { errors, warnings } = checkScheme(resources, converted.theme);

    if (errors.length) {
      console.error(`✗ ${slug}: ${errors.length} authoring error(s):`);
      for (const e of errors) console.error(`    ${e}`);
      hadErrors = true;
      continue;
    }

    if (!existsSync(rsrcPath)) {
      console.error(`✗ ${slug}: missing committed scheme.rsrc at ${rsrcPath}`);
      hadErrors = true;
      continue;
    }

    const committed = readFileSync(rsrcPath);
    if (!Buffer.from(fork).equals(committed)) {
      console.error(`✗ ${slug}: committed scheme.rsrc is stale. Run 'npm run author -- authoring/schemes/${slug}'`);
      hadErrors = true;
      continue;
    }

    const warnInfo = warnings.length ? ` (${warnings.length} warning(s))` : '';
    console.log(`✓ ${slug}: ${resources.length} resources, ${fork.length.toLocaleString()} bytes${warnInfo}`);
  } catch (err) {
    console.error(`✗ ${slug}: failed with exception: ${err instanceof Error ? err.message : err}`);
    if (process.env.DEBUG && err instanceof Error) console.error(err.stack);
    hadErrors = true;
  }
}

if (hadErrors) {
  process.exit(1);
} else {
  console.log(`✓ All ${slugs.length} authored schemes passed validation.`);
}
