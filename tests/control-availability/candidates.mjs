#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { enumerateForks, describeFork, sourceCandidate, sha256, QUERY_IDS } from './source.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2), inspect = args.includes('--inspect');
let output, slugs;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--inspect') continue;
  if (args[i] === '--output' && args[i+1]) output = args[++i];
  else if (args[i] === '--slugs' && args[i+1]) slugs = args[++i].split(',');
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
const catalog = JSON.parse(readFileSync(resolve(root, 'demo/themes-manifest.json')));
if (slugs) for (const slug of slugs) if (!catalog.some(row => row.slug === slug)) throw new Error(`Unknown archive slug: ${slug}`);
const chosen = catalog.filter(row => !slugs || slugs.includes(row.slug));
const choices = inspect ? null : JSON.parse(readFileSync(new URL('./source-choices.json', import.meta.url)));
const themes = [];
for (const row of chosen) {
  const path = `themes/${row.slug}/${row.source}`, format = row.source.endsWith('.rsrc') ? 'rsrc' : 'sit';
  const bytes = readFileSync(resolve(root, path));
  if (inspect) {
    themes.push({ slug: row.slug, path, format, archiveSha256: sha256(bytes),
      entries: (await enumerateForks(bytes, format)).map(describeFork) });
  } else {
    const matches = choices.sources.filter(choice => choice.slug === row.slug);
    if (matches.length !== 1 || matches[0].path !== path || matches[0].format !== format) throw new Error(`${row.slug}: missing or ambiguous explicit source choice`);
    themes.push(await sourceCandidate(bytes, matches[0]));
  }
}
const data = { schemaVersion: 1, reviewStatus: 'unreviewed', kind: inspect ? 'archive-entry-candidates' : 'resource-availability-candidates',
  scope: { queriedResourceTypes: inspect ? [] : ['cicn', 'cinf'], queriedSignedIds: inspect ? [] : QUERY_IDS,
    expectedAvailabilityForEveryUnreviewedOrUnlistedCase: 'unknown' },
  toolchain: Object.fromEntries(['tests/control-availability/candidates.mjs', 'tests/control-availability/source.mjs', 'tools/sit-wasm/index.mjs', 'tools/sit-wasm/dist/munbox.wasm', 'tools/theme-loader/resource-fork.js', 'tools/theme-loader/decoders/cicn.js'].map(path => [path, sha256(readFileSync(resolve(root, path)))])), themes };
const body = JSON.stringify(data, null, 2) + '\n';
if (output) writeFileSync(resolve(output), body); else process.stdout.write(body);
