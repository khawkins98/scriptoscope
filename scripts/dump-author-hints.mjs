#!/usr/bin/env node
// scripts/dump-author-hints.mjs
//
// Walk every bundle in themes/ and dump the author-supplied NAMED labels +
// STR# / TEXT resources from the resource fork. Each cicn / cinf / ppat the
// bundle ships under a `parseResourceFork` entry has a `name` field — when
// non-empty, that's the bundle author's own label for the role (e.g. 1138
// labels `-10239` as "push-button-active"). This is the AUTHORITATIVE primary
// source for what each id is for, as documented by the scheme authors
// themselves — far more reliable than guessing or web search (the angle that
// repeatedly bit us through the dialog-body-bg + volume-icon false hypotheses).
//
// Output:
//   - Per-bundle table on stdout
//   - `docs/spec/corpus-author-labels.json` — structured per-bundle author labels
//   - `docs/spec/corpus-corroborated-ids.md` — cross-theme consensus table
//     (id → role → n bundles agreeing)
//
// Usage:
//   node scripts/dump-author-hints.mjs            # console + write artifacts
//   node scripts/dump-author-hints.mjs --check    # exit 1 if no NAMED labels found

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeArchive } from '../tools/sit-wasm/index.mjs';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = resolve(repoRoot, 'themes');
const isCheck = process.argv.includes('--check');

/** Find the largest resource fork in an archive (the .sit → application path). */
async function forkFromSit(bytes) {
  const entries = await decodeArchive(bytes);
  const rsrcs = entries.filter((e) => e.forkType === 1 && e.bytes.length > 1024);
  rsrcs.sort((a, b) => b.bytes.length - a.bytes.length);
  return rsrcs[0]?.bytes;
}

async function dumpBundle(slug) {
  const dir = resolve(themesDir, slug);
  const sitPath = resolve(dir, 'scheme.sit');
  const rsrcPath = resolve(dir, 'scheme.rsrc');
  let fork;
  if (existsSync(sitPath)) {
    fork = await forkFromSit(await readFile(sitPath));
  } else if (existsSync(rsrcPath)) {
    fork = await readFile(rsrcPath);
  } else {
    return null;
  }
  if (!fork) return null;
  const rsrcs = parseResourceFork(fork);

  // Aggregate per-id labels per resource type. Named resources are the gold;
  // STR# resources sometimes contain author docs but more often UI strings.
  const namedByType = {};
  for (const r of rsrcs) {
    if (!r.name) continue;
    if (!namedByType[r.type]) namedByType[r.type] = {};
    namedByType[r.type][r.id] = r.name;
  }
  // Collect STR / STR# content separately (sometimes contain bundled docs).
  const strContent = [];
  for (const r of rsrcs) {
    if (r.type === 'STR ' || r.type === 'STR#' || r.type === 'TEXT') {
      try {
        const decoded = decodeMacString(r.data, r.type);
        if (decoded && decoded.length > 4) strContent.push({ type: r.type, id: r.id, name: r.name, text: decoded });
      } catch { /* skip */ }
    }
  }
  return { slug, namedByType, strContent, totalResources: rsrcs.length };
}

/** Decode a MacRoman-ish string from a STR / STR# / TEXT resource. */
function decodeMacString(bytes, type) {
  if (type === 'STR ') {
    const len = bytes[0];
    return macRoman(bytes.subarray(1, 1 + len));
  }
  if (type === 'STR#') {
    const count = (bytes[0] << 8) | bytes[1];
    const parts = [];
    let i = 2;
    for (let n = 0; n < count && i < bytes.length; n++) {
      const len = bytes[i++];
      parts.push(macRoman(bytes.subarray(i, i + len)));
      i += len;
    }
    return parts.join(' / ');
  }
  if (type === 'TEXT') return macRoman(bytes);
  return null;
}

function macRoman(bytes) {
  return Array.from(bytes).map((b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : b === 0x0d ? '\n' : '·').join('');
}

const slugs = (await readdir(themesDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const allDumps = [];
let totalNamed = 0;
for (const slug of slugs) {
  process.stdout.write(`  ${slug.padEnd(28)} `);
  try {
    const dump = await dumpBundle(slug);
    if (!dump) { console.log('no resource fork'); continue; }
    const namedCount = Object.values(dump.namedByType).reduce((s, m) => s + Object.keys(m).length, 0);
    totalNamed += namedCount;
    console.log(`${namedCount.toString().padStart(4)} NAMED labels · ${dump.totalResources} total resources · ${dump.strContent.length} STR/TEXT`);
    allDumps.push(dump);
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
}

if (isCheck) {
  if (totalNamed < 100) {
    console.error(`\n✗ check failed: only ${totalNamed} NAMED labels across ${slugs.length} bundles (expected ≥100 — agent 4 found 220+ in 1138 alone)`);
    process.exit(1);
  }
  console.log(`\n✓ check ok: ${totalNamed} NAMED labels total`);
  process.exit(0);
}

// ── Write the structured artifact ─────────────────────────────────────────
const flat = {};
for (const d of allDumps) {
  flat[d.slug] = {
    totalResources: d.totalResources,
    namedByType: d.namedByType,
    strSamples: d.strContent.slice(0, 5).map((s) => ({ type: s.type, id: s.id, name: s.name, text: s.text.slice(0, 200) })),
  };
}
const jsonOut = resolve(repoRoot, 'docs/spec/corpus-author-labels.json');
await writeFile(jsonOut, JSON.stringify(flat, null, 2));
console.log(`\nwrote ${jsonOut}`);

// ── Write the cross-corroborated table ────────────────────────────────────
// Per resource type + id, list (slug, label) pairs and compute a canonical
// consensus role string when ≥3 bundles agree on a paraphrase.
const cross = {}; // type → id → [(slug, label)]
for (const d of allDumps) {
  for (const [type, idMap] of Object.entries(d.namedByType)) {
    for (const [id, label] of Object.entries(idMap)) {
      (((cross[type] ??= {})[id]) ??= []).push({ slug: d.slug, label });
    }
  }
}

const lines = [
  `# Corpus-corroborated id → role table`,
  ``,
  `Auto-generated by \`scripts/dump-author-hints.mjs\`. Each row is an id whose`,
  `role is documented by **author-supplied NAMED labels** in the bundle's resource`,
  `fork — the most authoritative single source for what each cicn / cinf / ppat`,
  `id means. n bundles agreeing on a paraphrase is the corroboration score.`,
  ``,
  `Re-generate: \`node scripts/dump-author-hints.mjs\``,
  ``,
];

// Focus on the most important types
const focusTypes = ['cicn', 'cinf', 'ppat', 'ICN#', 'icl4', 'icl8', 'ics4', 'ics8', 'icm#', 'icm4', 'icm8', 'clut', 'wnd#', 'Colr'];
for (const type of focusTypes) {
  const ids = cross[type];
  if (!ids) continue;
  lines.push(`\n## \`${type}\``);
  lines.push(``);
  lines.push(`| id | author labels (n bundles) | sample bundles |`);
  lines.push(`|---|---|---|`);
  const rows = Object.entries(ids)
    .map(([id, items]) => {
      // Pick canonical role: the most-frequent label (case-insensitive, normalized)
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
      const counts = {};
      for (const it of items) {
        const k = norm(it.label);
        if (!counts[k]) counts[k] = { label: it.label, count: 0, slugs: [] };
        counts[k].count++;
        counts[k].slugs.push(it.slug);
      }
      const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
      const top = sorted[0];
      return { id: parseInt(id, 10), label: top.label, n: top.count, slugs: top.slugs };
    })
    .sort((a, b) => b.n - a.n || a.id - b.id);
  for (const r of rows.slice(0, 60)) {
    lines.push(`| ${r.id} | "${r.label}" (n=${r.n}) | ${r.slugs.slice(0, 4).join(', ')}${r.slugs.length > 4 ? '…' : ''} |`);
  }
}

const mdOut = resolve(repoRoot, 'docs/spec/corpus-corroborated-ids.md');
await writeFile(mdOut, lines.join('\n') + '\n');
console.log(`wrote ${mdOut}`);

console.log(`\n-- ${allDumps.length} bundles processed, ${totalNamed} NAMED labels aggregated --`);
