// What the bounded PR profile (`npm run test:rendering`, ci.yml) leaves to the
// release tier. The extended matrix (release-gate.yml, rendering-extended.yml)
// still runs every spec in every mode, so nothing here is dropped outright.
//
// 1. Built-mode twins. Most specs run each test twice, against the source
//    modules and the built bundle. Both paths share the same decoder, resolver
//    and compositor, so the built twin only catches packaging differences, and
//    it cost a third of PR browser time. On PRs the built twin runs only where:
//      - the spec registers fidelity assertions (`fidelity-assertion`
//        annotations): `test:requirements -- --require-execution` needs both
//        modes of each registered assertion;
//      - the spec is in BUILT_SMOKE_SPECS below: the production demo bundle and
//        the public explicit-host entry, the paths where bundling bugs have
//        surfaced before (the Pages demo failing only after deploy).
//    matrix.spec.mjs also keeps its in-test source/built pixel comparison for
//    all 18 themes, and the gates job runs the installed-package consumer test.
//
// 2. Specs that assert nothing in Chromium. frame-pass-through-perf.spec.mjs is
//    gated only in WebKit and reports in Chromium (5+ minutes per PR run).
//
// Set SCRIPTOSCOPE_RENDERING_BUILT=all to run the full bounded inventory locally.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BUILT_SMOKE_SPECS = Object.freeze([
  'showcase-ready-settled.spec.mjs',
  'explicit-host-contract.spec.mjs',
]);

export const RELEASE_ONLY_SPECS = Object.freeze([
  'frame-pass-through-perf.spec.mjs',
]);

const dir = fileURLToPath(new URL('.', import.meta.url));
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Spec files whose built twins still run on PRs. */
export function builtKeptSpecs() {
  const specs = readdirSync(dir).filter(name => name.endsWith('.spec.mjs'));
  return specs.filter(name => BUILT_SMOKE_SPECS.includes(name) || readFileSync(dir + name, 'utf8').includes('fidelity-assertion')).sort();
}

/**
 * Matches the Playwright grep title (`<project> <file> <title>`) of a top-level
 * test whose title starts with `built` in a spec not kept above. A built test
 * inside a describe block does not match, so it still runs (the safe side).
 */
export function builtTwinGrepInvert() {
  const kept = builtKeptSpecs().map(escape).join('|');
  return new RegExp(`\\s(?!(?:${kept})\\s)[^\\s]+\\.spec\\.mjs\\sbuilt\\b`);
}
