#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha256, sourceCandidate } from './source.mjs';
import { validateInventory } from './inventory.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const json = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
export const readInventory = () => ({ inventory: json('./expectations.json'), choices: json('./source-choices.json'),
  candidates: json('./source-candidates.json'), fixtures: json('./fixtures.json') });
const check = (condition, message) => { if (!condition) throw new Error(message); };
const unique = (items, predicate, description) => {
  const found = items.filter(predicate);
  check(found.length === 1, `${description}: expected one reference, found ${found.length}`);
  return found[0];
};
/** Validate evidence bytes and references, not renderer behavior or approval. */
export async function validateSourceEvidence({ inventory, choices, candidates, fixtures }, { repositoryRoot = root } = {}) {
  const read = path => readFileSync(resolve(repositoryRoot, path));
  validateInventory(inventory);
  for (const [path, hash] of Object.entries(candidates.toolchain)) check(sha256(read(path)) === hash, `${path}: extraction toolchain hash drift`);
  const actualSources = new Map();
  for (const choice of choices.sources) {
    check(!actualSources.has(choice.slug), `${choice.slug}: duplicate explicit source choice`);
    actualSources.set(choice.slug, await sourceCandidate(read(choice.path), choice));
  }
  for (const saved of candidates.themes) {
    const actual = actualSources.get(saved.slug);
    check(actual && isDeepStrictEqual(actual, saved), `${saved.slug}: source candidate bytes, presence or metadata drift`);
  }
  for (const fixture of fixtures.fixtures) {
    check(fixture.sha256 === sha256(JSON.stringify(fixture.themes)), `${fixture.id}: fixture hash drift`);
    const themeIds = fixture.themes.map(theme => theme.id);
    check(new Set(themeIds).size === themeIds.length, `${fixture.id}: duplicate fixture owner`);
    for (const theme of fixture.themes) {
      check(theme.base === null || themeIds.includes(theme.base), `${fixture.id}/${theme.id}: dangling base`);
      const keys = theme.resources.map(resource => resource.manifestKey);
      check(keys.every(key => typeof key === 'string' && key.length > 0) && new Set(keys).size === keys.length, `${fixture.id}/${theme.id}: ambiguous resource key`);
    }
  }
  for (const c of inventory.cases) {
    if (c.input.startsWith('fixture.')) {
      const ref = unique(c.sourceEvidence, ref => Boolean(ref.fixture), `${c.id}: declared fixture input`);
      check(c.input === `fixture.${ref.fixture}`, `${c.id}: input/fixture evidence mismatch`);
      const fixture = unique(fixtures.fixtures, fixture => fixture.id === ref.fixture, `${c.id}: declared fixture`);
      const rootTheme = unique(fixture.themes, theme => theme.id === 'child', `${c.id}: fixture root`);
      check(isDeepStrictEqual(c.baseInputs, rootTheme.base === null ? [] : ['fixture-defined-base']), `${c.id}: baseInputs disagree with fixture root graph`);
    } else {
      check(c.input.startsWith('theme.') && c.baseInputs.length === 0, `${c.id}: unsupported real input/base declaration`);
    }
    for (const ref of c.policyRefs) unique(inventory.policy.rules, rule => rule.id === ref, `${c.id}: policy ${ref}`);
    for (const ref of c.sourceEvidence) {
      if (ref.slug) {
        check(c.input === `theme.${ref.slug}`, `${c.id}: input/source evidence mismatch`);
        const theme = unique(candidates.themes, theme => theme.slug === ref.slug, `${c.id}: source ${ref.slug}`);
        const resource = unique(theme.candidates, resource => resource.type === ref.type && resource.signedId === ref.signedId, `${c.id}: resource ${ref.type}/${ref.signedId}`);
        check(ref.presence === resource.presence, `${c.id}: resource presence mismatch`);
        if (resource.presence === 'present') check(ref.payloadSha256 === resource.payloadSha256 && ref.byteLength === resource.byteLength, `${c.id}: resource payload hash/size mismatch`);
        else check(ref.payloadSha256 === undefined && ref.byteLength === undefined, `${c.id}: absent resource cannot have a payload`);
      } else if (ref.fixture) {
        const fixture = unique(fixtures.fixtures, fixture => fixture.id === ref.fixture, `${c.id}: fixture ${ref.fixture}`);
        check(ref.sha256 === fixture.sha256, `${c.id}: fixture evidence hash mismatch`);
      } else if (ref.engine) {
        check(ref.engine === inventory.engineEvidence.id && ref.engineSha256 === inventory.engineEvidence.sha256, `${c.id}: engine identity mismatch`);
        check(ref.document === inventory.engineEvidence.dispatchReference, `${c.id}: engine reference mismatch`);
        const bytes = read(ref.document);
        check(sha256(bytes) === ref.documentSha256, `${c.id}: engine document hash mismatch`);
        for (const address of ref.addresses) check(inventory.engineEvidence.addresses.includes(address) && bytes.toString().includes(address), `${c.id}: engine address missing`);
        check(ref.detailDocument === inventory.engineEvidence.detailReference, `${c.id}: detailed engine reference mismatch`);
        const detail = read(ref.detailDocument);
        check(sha256(detail) === ref.detailDocumentSha256, `${c.id}: detailed engine document hash mismatch`);
        if (ref.addressRange) {
          check(inventory.engineEvidence.addressRanges.some(range => isDeepStrictEqual(range, ref.addressRange)), `${c.id}: engine address range mismatch`);
          for (const address of ref.addressRange) check(detail.toString().includes(address), `${c.id}: detailed engine address missing`);
        }
        // The extracted original binary is deliberately absent from repo/CI.
        // This checks the cited documentation, not the binary's authenticity.
      } else throw new Error(`${c.id}: unsupported sourceEvidence reference`);
    }
    for (const paint of c.proposed?.paint ?? []) {
      check(typeof paint.manifestKey === 'string' && paint.manifestKey.length > 0, `${c.id}: missing exact manifest key`);
      if (c.input.startsWith('theme.')) {
        const slug = c.input.slice('theme.'.length);
        check(paint.ownerId === c.input && paint.chainDepth === 0, `${c.id}: real input has no base`);
        for (const [type, signedId, presence] of [['cicn', paint.signedId, 'present'], ['cinf', paint.sourceCinfId ?? paint.signedId, paint.sourceCinfId === null ? 'absent-from-selected-fork' : 'present']]) {
          const ref = unique(c.sourceEvidence, ref => ref.slug === slug && ref.type === type && ref.signedId === signedId, `${c.id}: painted ${type} evidence`);
          check(ref.presence === presence, `${c.id}: painted ${type} presence mismatch`);
        }
      } else {
        const fixtureRef = unique(c.sourceEvidence, ref => Boolean(ref.fixture), `${c.id}: fixture evidence`);
        const fixture = unique(fixtures.fixtures, fixture => fixture.id === fixtureRef.fixture, `${c.id}: fixture`);
        const owner = unique(fixture.themes, theme => theme.id === paint.ownerId, `${c.id}: painted owner`);
        const resource = unique(owner.resources, resource => resource.manifestKey === paint.manifestKey, `${c.id}: painted key`);
        check(resource.type === paint.type && resource.signedId === paint.signedId && resource.sourceCinfId === paint.sourceCinfId, `${c.id}: painted resource metadata mismatch`);
      }
    }
  }
  for (const remainder of inventory.themeRemainder) {
    const source = actualSources.get(remainder.slug);
    check(source && remainder.archiveSha256 === source.archive.sha256 && remainder.forkSha256 === source.selectedFork.forkSha256 && remainder.entryName === source.selectedFork.entryName && remainder.entryIndex === source.selectedFork.entryIndex, `${remainder.slug}: remainder source identity mismatch`);
  }
  return { sourceArchives: actualSources.size, candidateThemes: candidates.themes.length, cases: inventory.cases.length,
    result: 'Source evidence references and byte identities validated; availability approval and execution remain unchecked.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await validateSourceEvidence(readInventory()), null, 2));
