import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { CICN_LANE, ICON_ONLY, ICON_TABLE, ICON_TABLE_SHA256, PUBLIC_ROWS, checkRow, cicnId, censusFromFork, iconTableBytes, parseResourceMap, nativeFor, selectCheckable } from './checkable-rules.mjs';

// Archive bytes -> raw fork (input identity shared with the loader); the
// census itself comes from this module's own resource-map parse.
const corpus = new Map();
for (const slug of [...CICN_LANE, ...ICON_ONLY]) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  corpus.set(slug, { census: censusFromFork(fork), map: parseResourceMap(fork), loaded: await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true }) });
}
const inLane = id => id >= -9504 && id <= -9481, inIcons = id => id >= -10240 && id <= -10214;
const predict = (slug, row, select = selectCheckable) => select(nativeFor(row.kind, row.options), corpus.get(slug).census);
const rows = [...corpus.keys()].flatMap(slug => PUBLIC_ROWS.map(row => ({ slug, row, expected: predict(slug, row) })));

test('icon table literal matches the pinned 0x18b88 table hash and the doc', () => {
  assert.equal(createHash('sha256').update(iconTableBytes()).digest('hex'), ICON_TABLE_SHA256);
  const doc = readFileSync(new URL('../../docs/spec/checkable-icons.md', import.meta.url), 'utf8');
  assert.ok(doc.includes(ICON_TABLE_SHA256));
  for (const [kind, rows] of Object.entries(ICON_TABLE)) for (const row of rows) assert.ok(doc.includes(row.map(String).join(' | ')), `${kind} ${row}`);
});

test('own resource-map census agrees with the loader over all 18 archives (input identity, both directions)', () => {
  for (const [slug, { census, map, loaded }] of corpus) {
    const cicns = new Set(loaded.byteProvenance.resources.filter(r => r.type === 'cicn' && r.status === 'decoded' && inLane(r.signedId)).map(r => r.signedId));
    assert.deepEqual([...census.cicn].filter(inLane).sort(), [...cicns].sort(), `${slug} cicn`);
    assert.deepEqual([...census.mask].filter(inIcons).sort(), loaded.iconMaskResources.map(m => m.id).filter(inIcons).sort(), `${slug} ics#`);
    assert.deepEqual([...census.color].filter(inIcons).sort(), [...new Set(loaded.iconIndex.filter(e => inIcons(e.id) && /^ics[48]$/.test(e.type)).map(e => e.id))].sort(), `${slug} colour icons`);
    // Each lane id's bytes, from this parse, equal the loader's provenance record for that id.
    const sha = b => createHash('sha256').update(b).digest('hex');
    const own = map.filter(r => r.type === 'cicn' && inLane(r.id)).map(r => [r.id, r.data.length, sha(r.data)]).sort((a, b) => a[0] - b[0]);
    const prov = loaded.byteProvenance.resources.filter(r => r.type === 'cicn' && inLane(r.signedId)).map(r => [r.signedId, r.byteLength, r.sha256]).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(own, prov, `${slug} cicn id->bytes binding`);
    // abs-id aliasing in the runtime's element lookup has nothing to alias here.
    assert.equal([...census.cicn].filter(id => inLane(-id)).length, 0, `${slug}: positive cicn ids in the lane`);
  }
});

test('corpus partition: 13 archives ship CICN-lane art, 5 ship only icon-lane art', () => {
  for (const slug of CICN_LANE) assert.ok([...corpus.get(slug).census.cicn].some(inLane), slug);
  for (const slug of ICON_ONLY) {
    const { census } = corpus.get(slug);
    assert.equal([...census.cicn].filter(inLane).length, 0, slug);
    assert.ok([...census.mask].filter(inIcons).length >= 20, slug);
  }
  assert.ok([...corpus.get('floppies').census.mask].some(inIcons), 'floppies ships both lanes');
});

test('decode predictions over the 216 sampled public rows', () => {
  assert.equal(rows.length, 18 * 12);
  const lanes = rows.reduce((s, r) => ({ ...s, [r.expected.lane]: (s[r.expected.lane] ?? 0) + 1 }), {});
  assert.deepEqual(lanes, { cicn: 13 * 12, icon: 5 * 12 });
  for (const r of rows) {
    if (CICN_LANE.includes(r.slug)) assert.equal(r.expected.lane, 'cicn', r.slug);
    else assert.equal(r.expected.lane, 'icon', r.slug);
  }
  // The value-2 -> value-1 same-tier retry is reached only by Animals radio mixed.
  const retried = rows.filter(r => r.row.options.mixed && r.expected.lane === 'cicn' && r.expected.id !== cicnId(r.row.kind === 'radio' ? 1 : 0, 2, r.row.options.disabled ? 0 : 1));
  assert.deepEqual(retried.map(r => `${r.slug}/${r.row.kind}/${r.row.options.disabled}/${r.expected.id}`), ['animals/radio/false/-9488', 'animals/radio/true/-9489']);
  // Icon-lane mixed rows never miss their ics# in the corpus.
  assert.ok(rows.filter(r => r.expected.lane === 'icon' && r.row.options.mixed).every(r => ICON_TABLE[r.row.kind][r.row.options.disabled ? 2 : 0][2] === r.expected.id));
});

// Plausible wrong readings. Each must change at least one corpus prediction,
// or it is listed as not discriminated by the corpus.
const variants = {
  'tiers swapped (normal/disabled)': (n, c) => selectCheckable({ ...n, hilite: n.hilite ? 0 : 255 }, c),
  'no value-2 retry': (n, c) => (n.value === 2 && !c.cicn.has(cicnId(n.varCode === 2 ? 1 : 0, 2, n.hilite ? 0 : 1)) ? selectCheckable(n, { ...c, cicn: new Set() }) : selectCheckable(n, c)),
  'value-2 retry to unchecked': (n, c) => { const r = selectCheckable(n, c); return n.value === 2 && r.probes.length > 1 && r.lane === 'cicn' ? selectCheckable({ ...n, value: 0 }, c) : r; },
  'icon lane before CICN lane': (n, c) => { const r = selectCheckable(n, { ...c, cicn: new Set() }); return r.lane === 'icon' ? r : selectCheckable(n, c); },
  'kind ignored (radio uses checkbox ids)': (n, c) => selectCheckable({ ...n, varCode: 1 }, c),
  // Runtime compatibility policy (composeCheckable activeId): normal-tier retry.
  'normal-tier CICN retry before the icon lane': (n, c) => { const r = selectCheckable(n, c); const k = n.varCode === 2 ? 1 : 0, v = n.value === 2 && !c.cicn.has(cicnId(k, 2, n.hilite ? 0 : 1)) ? 1 : n.value; return r.lane !== 'cicn' && n.hilite && c.cicn.has(cicnId(k, v, 1)) ? { lane: 'cicn', id: cicnId(k, v, 1) } : r; },
};
test('each wrong reading changes corpus predictions, or is recorded as not corpus-discriminated', () => {
  const changed = Object.fromEntries(Object.entries(variants).map(([name, f]) => [name,
    rows.filter(r => { const v = predict(r.slug, r.row, f); return v.lane !== r.expected.lane || v.id !== r.expected.id; }).length]));
  assert.deepEqual(changed, {
    'tiers swapped (normal/disabled)': 216, 'no value-2 retry': 2, 'value-2 retry to unchecked': 2,
    'icon lane before CICN lane': 12, 'kind ignored (radio uses checkbox ids)': 108,
    'normal-tier CICN retry before the icon lane': 0,
  });
  // The runtime's normal-tier retry is never reached by a shipped archive. A
  // minimal fork with only -9503 shows the disagreement: the decode enters the
  // icon lane (and finds nothing), the policy draws normal art for disabled.
  const minimal = { cicn: new Set([-9503]), mask: new Set(), color: new Set() }, n = nativeFor('checkbox', { disabled: true });
  assert.equal(selectCheckable(n, minimal).lane, 'none');
  assert.deepEqual(variants['normal-tier CICN retry before the icon lane'](n, minimal), { lane: 'cicn', id: -9503 });
});

test('checkRow fails wrong id, wrong lane, unexpected null or art, and flags shared pixels', () => {
  const exp = { lane: 'cicn', id: -9503, probes: [] };
  assert.equal(checkRow(exp, { isNull: false, matches: [{ lane: 'cicn', id: -9503 }] }).failure, null);
  assert.equal(checkRow(exp, { isNull: false, matches: [{ lane: 'cicn', id: -9503 }] }).discriminating, true);
  assert.match(checkRow(exp, { isNull: false, matches: [{ lane: 'cicn', id: -9504 }] }).failure, /expected cicn -9503/);
  assert.match(checkRow(exp, { isNull: false, matches: [{ lane: 'icon', id: -9503, type: 'ics4' }] }).failure, /expected cicn/);
  assert.match(checkRow(exp, { isNull: true, matches: [] }).failure, /returned null/);
  assert.match(checkRow({ lane: 'none', id: null, probes: [] }, { isNull: false, matches: [] }).failure, /no archive art/);
  const shared = checkRow(exp, { isNull: false, matches: [{ lane: 'cicn', id: -9503 }, { lane: 'cicn', id: -9504 }] });
  assert.deepEqual([shared.failure, shared.discriminating], [null, false]);
  // Each wrong reading's prediction, presented as the observation, fails a corpus row.
  for (const [name, f] of Object.entries(variants)) {
    if (name.startsWith('normal-tier')) continue; // not corpus-discriminated (above)
    const bad = rows.find(r => { const v = predict(r.slug, r.row, f); return v.lane !== r.expected.lane || v.id !== r.expected.id; });
    const v = predict(bad.slug, bad.row, f);
    assert.ok(checkRow(bad.expected, { isNull: v.lane === 'none', matches: v.lane === 'none' ? [] : [{ lane: v.lane, id: v.id }] }).failure, name);
  }
});

test('decoded branches outside the public rows: pressed tiers, value 3, missing masks and state bytes', () => {
  const full = { cicn: new Set(Array.from({ length: 24 }, (_, i) => -9504 + i)), mask: new Set(), color: new Set() };
  assert.equal(selectCheckable({ hilite: 1, varCode: 1, value: 0 }, full).id, -9502);   // pressed CICN tier 2
  assert.equal(selectCheckable({ hilite: 254, varCode: 1, value: 0 }, full).id, -9504); // 254 = disabled
  assert.equal(selectCheckable({ hilite: 0, varCode: 3, value: 1 }, full).id, -9500);   // varCode 3 = checkbox
  assert.equal(selectCheckable({ hilite: 0, varCode: 4, value: 1 }, full).id, -9488);   // varCode 4 = radio
  assert.equal(selectCheckable({ hilite: 0, varCode: 0, value: 1 }, full).lane, 'unknown');
  assert.equal(selectCheckable({ hilite: 0, varCode: 1, value: 1 }, full, { acid: true }).id, -9494); // value 3 checkbox
  assert.equal(selectCheckable({ hilite: 0, varCode: 2, value: 1 }, full, { acid: true }).id, -9488); // radio CICN keeps 1
  const icons = id => ({ cicn: new Set(), mask: new Set([id, -10219, -10223]), color: new Set([id, -10219, -10223]) });
  assert.equal(selectCheckable({ hilite: 1, varCode: 2, value: 0 }, icons(-10216)).id, -10216); // pressed icon tier 1
  assert.equal(selectCheckable({ hilite: 0, varCode: 2, value: 2 }, icons(-10219)).id, -10219); // missing mixed mask
  assert.equal(selectCheckable({ hilite: 0, varCode: 2, value: 1 }, icons(-10219), { acid: true }).id, -10219);
  assert.equal(selectCheckable({ hilite: 0, varCode: 2, value: 0 }, { cicn: new Set(), mask: new Set([-10220]), color: new Set() }).lane, 'unknown');
});
