#!/usr/bin/env node
// Read-only source evidence for cinf body dispatch. No renderer/role manifest or
// decodeCinf labels are used. Container/resource parsing remains shared code;
// these observations do not independently verify those decoders.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { enumerateForks, selectFork, sha256 } from '../tests/control-availability/source.mjs';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const registryPath = 'tests/control-availability/source-choices.json';
const registryBytes = readFileSync(resolve(root, registryPath));
const registry = JSON.parse(registryBytes);
const themes = [];
for (const choice of registry.sources) {
  const bytes = readFileSync(resolve(root, choice.path));
  const fork = selectFork(bytes, await enumerateForks(bytes, choice.format), choice);
  const entries = parseResourceFork(fork.bytes);
  const records = entries.flatMap((entry, resourceIndex) => {
    if (entry.type !== 'cinf') return [];
    const common = { resourceIndex, id: entry.id, byteLength: entry.data.length,
      payloadSha256: sha256(entry.data) };
    if (entry.data.length < 18) return [{ ...common, status: 'shorter-than-18-byte-header' }];
    const view = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
    const backgroundId = view.getInt16(4, false);
    return [{ ...common, status: 'raw-header', corner: entry.data[0], side: entry.data[1],
      tileByte: entry.data[2], modeByte: entry.data[3], backgroundId,
      // These are same-fork candidates, not proof of historical lookup scope.
      backgroundCandidates: entries.flatMap((candidate, candidateIndex) =>
        candidate.id === backgroundId && ['cicn', 'ppat'].includes(candidate.type)
          ? [{ resourceIndex: candidateIndex, type: candidate.type, id: candidate.id,
            byteLength: candidate.data.length, payloadSha256: sha256(candidate.data) }] : []),
    }];
  });
  themes.push({ slug: choice.slug, archiveSha256: choice.archiveSha256,
    entryIndex: choice.entryIndex, entryName: choice.entryName, forkSha256: choice.forkSha256,
    selectionReviewStatus: choice.selectionReviewStatus, records });
}
process.stdout.write(JSON.stringify({ schemaVersion: 1, kind: 'raw-cinf-body-observations',
  sourceRegistry: { path: registryPath, sha256: sha256(registryBytes), reviewStatus: registry.reviewStatus },
  limitations: ['Shared archive/resource parsing; no independent decoder certification.',
    'Raw fields and same-fork resource presence do not establish call-site use, base lookup, pixels or availability.'],
  toolchain: Object.fromEntries(['scripts/survey-cinf-body.mjs', 'tests/control-availability/source.mjs',
    'tools/sit-wasm/index.mjs', 'tools/sit-wasm/dist/munbox.wasm', 'tools/theme-loader/resource-fork.js']
    .map(path => [path, sha256(readFileSync(resolve(root, path)))])), themes,
}, null, 2) + '\n');
