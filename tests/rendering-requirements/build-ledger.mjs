// Deterministic generator for ledger.json from per-family sources.
//
// tests/rendering-requirements/families/<family>.json are the only hand-edited
// ledger sources. families/_base.json is the frozen 1.22.0 interleave (row order
// and per-row byte format of the single-file ledger at the split). It is never
// edited; the base reconstruction below is pinned to the 1.22.0 file sha256.
//
//   node tests/rendering-requirements/build-ledger.mjs --write   regenerate ledger.json
//   node tests/rendering-requirements/build-ledger.mjs --check   exit 1 if ledger.json is stale
//   node tests/rendering-requirements/build-ledger.mjs --transition <family> --version <v> \
//        --summary <text> --review <text> --scope <text> [--from <git-ref>]   record a family transition
//   node tests/rendering-requirements/build-ledger.mjs --port <next-ledger.json> [--prior <prior-ledger.json>]
//        distribute a single-file ledger change (a main-branch bump) into the family files
//
// See README.md "Per-family sources" for the versioning and merge rules.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const ARRAYS = ['inputs', 'evidence', 'requirements', 'assertions', 'cases', 'assessments'];
export const FAMILIES_DIR = fileURLToPath(new URL('./families/', import.meta.url));
export const LEDGER_PATH = fileURLToPath(new URL('./ledger.json', import.meta.url));
const FAMILY_KEYS = ['family', 'version', 'caseFamilies', 'scope', 'inventorySha256', 'transitions', ...ARRAYS];
const POST_SPLIT_FORMAT = '4c';
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
/** Strict x.y.z comparison; throws on anything that is not plain semver. */
export function compareVersions(a, b) {
  const pa = SEMVER.exec(a), pb = SEMVER.exec(b);
  if (!pa || !pb) throw new Error(`family versions must be x.y.z (got ${a}, ${b})`);
  for (let i = 1; i <= 3; i++) if (Number(pa[i]) !== Number(pb[i])) return Number(pa[i]) - Number(pb[i]);
  return 0;
}
const sameDigests = (a, b) => ARRAYS.every(k => a?.[k] === b?.[k]);

const digest = value => createHash('sha256').update(value).digest('hex');
export const rowKey = row => row.id ?? `${row.caseId}/${row.requirementId}`;
/**
 * Family digest over every field but itself: identity, version, scope, the full
 * transition history (including summary/review text) and all six row arrays. Any
 * row or review edit therefore changes it, and only --transition may recompute it.
 */
export const familyDigest = f => digest(JSON.stringify(Object.fromEntries(FAMILY_KEYS.filter(k => k !== 'inventorySha256').map(k => [k, f[k]]))));
export const prefixDigests = f => Object.fromEntries(ARRAYS.map(a => [a, digest(JSON.stringify(f[a]))]));

const escapeNonAscii = s => s.replace(/[\u007f-\uffff]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const pretty = (value, indent) => JSON.stringify(value, null, 2).split('\n').join('\n' + ' '.repeat(indent));
/** Row byte formats observed in the single-file ledger: indent, pretty|compact, optional \u escaping. */
function formatRow(row, format) {
  const match = /^(\d+)([pc])(E?)$/.exec(format);
  if (!match) throw new Error(`unknown row format ${format}`);
  const [, indent, style, escaped] = match;
  const body = style === 'p' ? pretty(row, 4) : JSON.stringify(row);
  return ' '.repeat(Number(indent)) + (escaped ? escapeNonAscii(body) : body);
}

function serializeLedger(header, arrays) {
  const parts = [];
  const scalar = (key, value) => parts.push(`  ${JSON.stringify(key)}: ${pretty(value, 2)}`);
  scalar('schemaVersion', header.schemaVersion); scalar('inventoryVersion', header.inventoryVersion); scalar('scope', header.scope);
  for (const name of ARRAYS) {
    const rows = arrays[name].map(({ row, format }) => formatRow(row, format));
    parts.push(`  ${JSON.stringify(name)}: ` + (rows.length ? `[\n${rows.join(',\n')}\n  ]` : '[]'));
  }
  scalar('inventorySha256', header.inventorySha256);
  return `{\n${parts.join(',\n')}\n}\n`;
}

/** Canonical family file text: one compact row per line so edits stay line-local. */
export function formatFamily(f) {
  const lines = FAMILY_KEYS.map(key => {
    const value = f[key];
    if (!Array.isArray(value) || key === 'caseFamilies') return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
    return `  ${JSON.stringify(key)}: ` + (value.length ? `[\n${value.map(row => '    ' + JSON.stringify(row)).join(',\n')}\n  ]` : '[]');
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

export function readFamilies(dir = FAMILIES_DIR) {
  const base = JSON.parse(readFileSync(join(dir, '_base.json'), 'utf8'));
  const families = readdirSync(dir).filter(name => name.endsWith('.json') && !name.startsWith('_')).sort().map(name => {
    const text = readFileSync(join(dir, name), 'utf8'), f = JSON.parse(text);
    if (`${f.family}.json` !== name) throw new Error(`${name}: family field must match the file name`);
    return { ...f, text };
  });
  return { base, families };
}

/** Undo the most recent transition: truncate to the prior counts and restore rows edited in place. */
export function priorFamily(f) {
  const t = f.transitions.at(-1);
  if (!t) throw new Error(`${f.family}: no transition to undo`);
  const prior = structuredClone(f);
  prior.transitions = f.transitions.slice(0, -1);
  for (const a of ARRAYS) {
    if (!(t.counts[a] <= f[a].length)) throw new Error(`${f.family}@${t.version}: ${a} lost rows (prior ${t.counts[a]}, now ${f[a].length})`);
    prior[a] = f[a].slice(0, t.counts[a]);
    for (const { index, row } of t.replaced?.[a] ?? []) {
      if (rowKey(prior[a][index] ?? {}) !== rowKey(row)) throw new Error(`${f.family}@${t.version}: ${a}[${index}] replaced row identity differs`);
      prior[a][index] = row;
    }
    if (digest(JSON.stringify(prior[a])) !== t.prefixSha256[a]) throw new Error(`${f.family}@${t.version}: ${a} prior prefix digest mismatch`);
  }
  if (!sameDigests(prefixDigests(f), t.resultSha256)) throw new Error(`${f.family}@${t.version}: rows differ from the state recorded by its latest transition; record a new transition (--transition)`);
  const earlier = prior.transitions.at(-1);
  if (earlier && !sameDigests(t.prefixSha256, earlier.resultSha256)) throw new Error(`${f.family}@${t.version}: prior prefix does not match ${earlier.version}'s recorded result`);
  Object.assign(prior, { version: t.priorVersion, scope: t.priorScope, inventorySha256: t.priorInventorySha256 });
  if (familyDigest(prior) !== t.priorInventorySha256) throw new Error(`${f.family}@${t.version}: prior family inventory digest mismatch`);
  return prior;
}
export function baseFamily(f) { let x = f; while (x.transitions.length) x = priorFamily(x); return x; }

function checkFamily(f) {
  const errors = [];
  for (const key of FAMILY_KEYS) if (!(key in f)) errors.push(`${f.family}: missing ${key}`);
  if (errors.length) return errors;
  if (f.inventorySha256 !== familyDigest(f)) errors.push(`${f.family}: family inventory digest changed; review and record a family transition (--transition)`);
  const caseIds = new Set(f.cases.map(c => c.id));
  for (const c of f.cases) if (!f.caseFamilies.includes(c.family)) errors.push(`${f.family}: case ${c.id} has family ${c.family}, not one of ${f.caseFamilies.join(',')}`);
  for (const a of f.assessments) if (!caseIds.has(a.caseId)) errors.push(`${f.family}: assessment ${rowKey(a)} must live in the file that owns its case`);
  if (f.transitions.length && f.transitions.at(-1).version !== f.version) errors.push(`${f.family}: version ${f.version} differs from its latest transition ${f.transitions.at(-1).version}`);
  if (!f.transitions.length && f.version !== '1.0.0') errors.push(`${f.family}: a family without transitions is at its 1.0.0 split state`);
  if (f.transitions.length && !sameDigests(prefixDigests(f), f.transitions.at(-1).resultSha256)) errors.push(`${f.family}: rows differ from the state recorded by transition ${f.transitions.at(-1).version}; record a new transition (--transition)`);
  f.transitions.forEach((t, i) => {
    try { if (compareVersions(t.version, t.priorVersion) <= 0) errors.push(`${f.family}: transition ${i} version ${t.version} does not increase from ${t.priorVersion}`); }
    catch (error) { errors.push(`${f.family}: transition ${i}: ${error.message}`); }
    if (i && t.priorVersion !== f.transitions[i - 1].version) errors.push(`${f.family}: transition ${i} prior version ${t.priorVersion} is not ${f.transitions[i - 1].version}`);
  });
  if (f.family !== 'shared') for (const a of f.assertions) {
    const foreign = a.caseIds.filter(id => !caseIds.has(id));
    if (foreign.length) errors.push(`${f.family}: assertion ${a.id} must live with its cases (${foreign.join(', ')} are not in this file; multi-family assertions go in shared)`);
  }
  return errors;
}

/**
 * Assemble the single ledger. Rows present at the split keep their 1.22.0 order and
 * bytes (from _base.json runs); rows appended after the split follow, grouped by
 * family file name, one compact row per line.
 */
export function assemble(base, families, { mode = 'live' } = {}) {
  const errors = families.flatMap(checkFamily);
  if (errors.length) throw new Error(errors.join('\n'));
  const bases = families.map(baseFamily); // validates every family transition chain
  // Undoing every transition must land exactly on the split-time row counts.
  for (const f of bases) for (const a of ARRAYS) {
    const atSplit = base.order[a].filter(([family]) => family === f.family).reduce((n, [, , count]) => n + count, 0);
    if (f[a].length < atSplit) throw new Error(`${f.family}: ${a} is missing rows present at the split`);
    if (f[a].length > atSplit) throw new Error(`${f.family}: ${a} rows appended after the split without a family transition (${f[a].slice(atSplit).map(rowKey).join(', ')})`);
  }
  const states = mode === 'base' ? bases : families;
  const byName = new Map(states.map(f => [f.family, f]));
  const arrays = {};
  for (const a of ARRAYS) {
    const cursor = new Map(states.map(f => [f.family, 0]));
    arrays[a] = [];
    for (const [family, format, count] of base.order[a]) {
      const f = byName.get(family), at = cursor.get(family);
      if (!f || at + count > f[a].length) throw new Error(`${family}: ${a} is missing rows present at the split`);
      for (const row of f[a].slice(at, at + count)) arrays[a].push({ row, format });
      cursor.set(family, at + count);
    }
    for (const f of states) {
      for (const row of f[a].slice(cursor.get(f.family))) arrays[a].push({ row, format: POST_SPLIT_FORMAT });
    }
  }
  const caseOwner = new Map(states.flatMap(f => f.cases.map(c => [c.id, f.family])));
  for (const a of byName.get('shared')?.assertions ?? []) {
    if (new Set(a.caseIds.map(id => caseOwner.get(id))).size < 2) throw new Error(`shared: assertion ${a.id} covers cases of one family only; it must live with its cases`);
  }
  const changed = states.filter(f => f.transitions.length);
  const header = { schemaVersion: base.schemaVersion, inventoryVersion: base.inventoryVersion, scope: base.scope };
  if (changed.length) {
    // The 1.22.0 description and review describe the split-time inventory only, so after any
    // family transition they are relabelled as such and the live totals are derived here.
    const count = a => arrays[a].length, statuses = {};
    for (const { row } of arrays.assessments) statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    header.inventoryVersion = `${base.inventoryVersion}+${changed.map(f => `${f.family}@${f.version}`).join(',')}`;
    header.scope = {
      ...base.scope,
      description: `${count('cases')} exact direct composition cases and ${count('assessments')} assessments (${Object.entries(statuses).sort().map(([k, n]) => `${n} ${k}`).join(', ')}) after post-split family transitions ${changed.map(f => `${f.family}@${f.version}`).join(', ')}; each changed family's reviewed scope is in scope.families. At the ${base.inventoryVersion} split: ${base.scope.description}`,
      review: `At the ${base.inventoryVersion} split: ${base.scope.review} Post-split changes carry their own summary and review per family transition in scope.families.`,
      families: Object.fromEntries(changed.map(f => [f.family, { version: f.version, scope: f.scope, transitions: f.transitions.map(({ version, summary, review }) => ({ version, summary, review })) }])),
    };
  }
  const ledger = { ...header, ...Object.fromEntries(ARRAYS.map(a => [a, arrays[a].map(x => x.row)])) };
  // Same definition as ledger.mjs inventoryDigest; computed, never hand-bumped.
  ledger.inventorySha256 = header.inventorySha256 = digest(JSON.stringify({ scope: ledger.scope, requirements: ledger.requirements, cases: ledger.cases }));
  const ids = new Map();
  for (const a of ARRAYS) for (const { row } of arrays[a]) {
    const key = `${a}:${rowKey(row)}`;
    if (ids.has(key)) throw new Error(`duplicate ${a} row ${rowKey(row)}: claimed by more than one family file`);
    ids.set(key, true);
  }
  return { ledger, text: serializeLedger(header, arrays) };
}

export function buildLedger({ dir = FAMILIES_DIR, mode = 'live' } = {}) {
  const { base, families } = readFamilies(dir);
  return assemble(base, families, { mode });
}

/** Record a transition for one family against its file at a git ref (default HEAD). */
export function recordTransition(current, prior, { version, summary, review, scope = current.scope }) {
  if (!summary || !review) throw new Error('--summary and --review are required');
  if (compareVersions(version, prior.version) <= 0) throw new Error(`${current.family}: bump the family version (prior ${prior.version})`);
  if (!scope || scope === prior.scope) throw new Error(`${current.family}: describe the new family scope (--scope); the prior scope describes ${prior.version}`);
  const replaced = {};
  for (const a of ARRAYS) {
    if (current[a].length < prior[a].length) throw new Error(`${current.family}: ${a} rows cannot disappear`);
    prior[a].forEach((row, index) => {
      if (rowKey(current[a][index]) !== rowKey(row)) throw new Error(`${current.family}: ${a}[${index}] changed identity; only append or edit in place`);
      if (JSON.stringify(current[a][index]) !== JSON.stringify(row)) (replaced[a] ??= []).push({ index, row });
    });
  }
  const transition = {
    version, priorVersion: prior.version, priorScope: prior.scope, priorInventorySha256: prior.inventorySha256,
    counts: Object.fromEntries(ARRAYS.map(a => [a, prior[a].length])), prefixSha256: prefixDigests(prior),
    resultSha256: prefixDigests(current),
    ...(Object.keys(replaced).length ? { replaced } : {}), summary, review,
  };
  const next = { ...current, version, scope, transitions: [...prior.transitions, transition] };
  next.inventorySha256 = familyDigest(next);
  return next;
}

/** An empty family, the implicit prior of a family file that does not exist yet. */
export function emptyFamily(family, caseFamilies = []) {
  const f = { family, version: '1.0.0', caseFamilies, scope: '', inventorySha256: '', transitions: [], ...Object.fromEntries(ARRAYS.map(a => [a, []])) };
  f.inventorySha256 = familyDigest(f);
  return f;
}

/**
 * Port a single-file ledger change (e.g. a main-branch ledger bump) into the family
 * sources. `prior` and `next` are single-file ledgers (prior defaults to the 1.22.0
 * base reconstruction). Rows next adds are appended to their owning family; rows it
 * edits are edited in place where they live. Nothing is deleted. Returns the touched
 * families, which then each need --transition. Ownership follows the split rule:
 * cases by caseFamilies, assessments with their case, assertions with their cases,
 * other rows with the single family that references them, else `shared`.
 */
export function portLedger(families, prior, next) {
  const byName = new Map(families.map(f => [f.family, f])), touched = new Set();
  const caseOwner = new Map(families.flatMap(f => f.cases.map(c => [c.id, f.family])));
  const fileOf = c => families.find(f => f.caseFamilies.includes(c.family))?.family;
  for (const c of next.cases) if (!caseOwner.has(c.id)) {
    const owner = fileOf(c); if (!owner) throw new Error(`case ${c.id}: no family file lists case family ${c.family} in caseFamilies`);
    caseOwner.set(c.id, owner);
  }
  const users = new Map(), use = (a, id, f) => users.set(`${a}:${id}`, (users.get(`${a}:${id}`) ?? new Set()).add(f));
  for (const c of next.cases) {
    for (const id of [...c.inputs, ...(c.baseInputs ?? [])]) use('inputs', id, caseOwner.get(c.id));
    for (const ids of Object.values(c.dimensions)) if (Array.isArray(ids)) for (const id of ids) use('requirements', id, caseOwner.get(c.id));
  }
  for (const r of next.assessments) for (const id of r.evidence ?? []) use('evidence', id, caseOwner.get(r.caseId));
  const ownerOf = (a, row) => {
    if (a === 'cases') return caseOwner.get(row.id);
    if (a === 'assessments') return caseOwner.get(row.caseId);
    const set = a === 'assertions' ? new Set(row.caseIds.map(id => caseOwner.get(id))) : a === 'inputs' && row.kind !== 'synthetic' ? new Set(['shared']) : users.get(`${a}:${row.id}`) ?? new Set(['shared']);
    return set.size === 1 ? [...set][0] : 'shared';
  };
  for (const a of ARRAYS) {
    const before = new Map(prior[a].map(row => [rowKey(row), JSON.stringify(row)]));
    const nextKeys = new Set(next[a].map(rowKey));
    for (const key of before.keys()) if (!nextKeys.has(key)) throw new Error(`${a} ${key}: the ported ledger deletes a row; deletions are not portable`);
    for (const row of next[a]) {
      const key = rowKey(row), was = before.get(key);
      if (was === JSON.stringify(row)) continue;
      if (was !== undefined) {
        const f = families.find(x => x[a].some(r => rowKey(r) === key));
        const i = f[a].findIndex(r => rowKey(r) === key);
        if (JSON.stringify(f[a][i]) !== was) throw new Error(`${a} ${key}: edited on both sides; resolve by hand`);
        f[a][i] = row; touched.add(f.family);
      } else {
        const owner = ownerOf(a, row);
        if (!byName.has(owner)) throw new Error(`${a} ${key}: owner family ${owner} has no file`);
        if (byName.get(owner)[a].some(r => rowKey(r) === key)) throw new Error(`${a} ${key}: already present in ${owner}`);
        byName.get(owner)[a].push(row); touched.add(owner);
      }
    }
  }
  return [...touched].sort().map(name => byName.get(name));
}

function main(argv) {
  const flag = name => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
  if (argv.includes('--transition')) {
    const family = flag('--transition'), ref = flag('--from') ?? 'HEAD', path = join(FAMILIES_DIR, `${family}.json`);
    const repoPath = `tests/rendering-requirements/families/${family}.json`;
    const current = JSON.parse(readFileSync(path, 'utf8'));
    let prior;
    try { prior = JSON.parse(execFileSync('git', ['show', `${ref}:${repoPath}`], { cwd: FAMILIES_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
    catch { prior = emptyFamily(family, current.caseFamilies); console.log(`${family}: new family file (not present at ${ref})`); }
    const next = recordTransition(current, prior, { version: flag('--version'), summary: flag('--summary'), review: flag('--review'), scope: flag('--scope') ?? current.scope });
    writeFileSync(path, formatFamily(next));
    console.log(`${family}: ${prior.version} -> ${next.version}`);
    try { buildLedger(); } catch (error) {
      console.log(`ledger.json not regenerated yet (other families still pending?):\n${error.message}`); return;
    }
  }
  if (argv.includes('--port')) {
    const { families } = readFamilies();
    const next = JSON.parse(readFileSync(flag('--port'), 'utf8'));
    const prior = flag('--prior') ? JSON.parse(readFileSync(flag('--prior'), 'utf8')) : buildLedger({ mode: 'base' }).ledger;
    // Write the edited rows back but keep the old digest, so the generator demands a --transition per family.
    for (const f of portLedger(families, prior, next)) {
      const { text: _, ...data } = f;
      writeFileSync(join(FAMILIES_DIR, `${f.family}.json`), formatFamily(data));
      console.log(`${f.family}: rows ported; now run --transition ${f.family} --version <next> --summary ... --review ...`);
    }
    return;
  }
  const { text } = buildLedger();
  if (argv.includes('--check')) {
    let committed = '';
    try { committed = readFileSync(LEDGER_PATH, 'utf8'); } catch {}
    if (committed !== text) { console.error('ledger.json is stale or hand-edited: run node tests/rendering-requirements/build-ledger.mjs --write'); process.exit(1); }
    console.log(`ledger.json matches generator output (sha256 ${digest(text)})`);
  } else if (argv.includes('--write') || argv.includes('--transition')) {
    writeFileSync(LEDGER_PATH, text); console.log(`wrote ledger.json (sha256 ${digest(text)})`);
  } else {
    process.stdout.write(text);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
