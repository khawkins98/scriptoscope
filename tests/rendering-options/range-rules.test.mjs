import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { parseResourceMap } from './checkable-rules.mjs';
import { PUBLIC_ROWS, SLUGS, checkRow, expectedSet, inCicnRange, inIconRange, nativeFor, scrollBytes, scrollCensus, selectScrollbar, trackTier } from './range-rules.mjs';

// Archive bytes -> raw fork (input identity shared with the loader); the census
// itself comes from checkable-rules.mjs's own resource-map parse.
const corpus = new Map();
for (const slug of SLUGS) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork);
  corpus.set(slug, { map, census: scrollCensus(map), loaded: await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true }) });
}
const predict = (slug, row, opts) => nativeFor(row).map(native => ({ native, prediction: selectScrollbar(native, corpus.get(slug).census, opts) }));
const rows = SLUGS.flatMap(slug => PUBLIC_ROWS.map(row => ({ slug, row, predictions: predict(slug, row) })));
const key = r => `${r.slug}/${r.row.orientation[0]}/${r.row.state}`;
// controls.ts composeScrollbar: along-axis source length >= 2 x cross thickness.
const runtimeComposite = ([w, h], orientation) => (orientation === 'horizontal' ? w >= 2 * h : h >= 2 * w);
const sig = ps => JSON.stringify(ps.map(p => (p.prediction.tracks ? expectedSet(p.prediction) : p.prediction.unknown)));

test('own resource-map census agrees with the loader over all 18 archives (input identity)', () => {
  const sha = b => createHash('sha256').update(b).digest('hex');
  for (const [slug, { map, census, loaded }] of corpus) {
    const prov = loaded.byteProvenance.resources.filter(r => r.type === 'cicn' && inCicnRange(r.signedId));
    assert.deepEqual([...census.cicn.keys()].sort((a, b) => a - b), prov.filter(r => r.status === 'decoded').map(r => r.signedId).sort((a, b) => a - b), `${slug} cicn`);
    // Each candidate id's bytes, from this parse, equal the loader's record for that id.
    const own = map.filter(r => r.type === 'cicn' && inCicnRange(r.id)).map(r => [r.id, r.data.length, sha(r.data)]).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(own, prov.map(r => [r.signedId, r.byteLength, r.sha256]).sort((a, b) => a[0] - b[0]), `${slug} cicn id->bytes`);
    // Bounds from this parse equal the decoded element size (the composite discriminator input).
    const elements = Object.values(loaded.manifest.chromeElements).filter(e => inCicnRange(e.sourceCicnId ?? 0));
    for (const e of elements) assert.deepEqual(census.cicn.get(e.sourceCicnId), [e.width, e.height], `${slug} ${e.sourceCicnId} bounds`);
    assert.deepEqual([...new Set(elements.map(e => e.sourceCicnId))].sort((a, b) => a - b), [...census.cicn.keys()].sort((a, b) => a - b), `${slug}: every candidate cicn is a chromeElement`);
    assert.deepEqual([...census.mask].sort(), loaded.iconMaskResources.map(m => m.id).filter(inIconRange).sort(), `${slug} ics#`);
    // Colour art is ics8 only (0xf4ba, engine/scrollbar.md AI4); ics4 is censused apart.
    for (const type of ['ics8', 'ics4']) assert.deepEqual([...census[type === 'ics8' ? 'color' : 'ics4']].sort(), [...new Set(loaded.iconIndex.filter(e => inIconRange(e.id) && e.type === type).map(e => e.id))].sort(), `${slug} ${type}`);
    // The runtime's element lookup matches |id|; no positive alias exists in these ranges.
    assert.equal(map.filter(r => r.type === 'cicn' && inCicnRange(-r.id)).length, 0, `${slug}: positive cicn ids alias the ranges`);
  }
});

test('decoded state bytes and tiers (0x9f7a–0x9fd6, 0xada2, 0xa01c–0xa05e)', () => {
  const tier = n => trackTier(scrollBytes(n));
  assert.deepEqual([0, 1, 20, 21, 129, 253, 254, 255].map(hilite => tier({ hilite })), [2, 3, 3, 3, 3, 3, 0, 1]);
  assert.equal(tier({ hilite: 255, parentInactive: true }), 0);
  assert.equal(tier({ hilite: 0, min: 5, max: 5 }), 1);     // nothing to scroll
  assert.equal(tier({ hilite: 129, min: 5, max: 5 }), 1);   // disabled wins over pressed
  const c = { cicn: new Map([[-8288 + 18, [25, 11]], [-8286, [33, 16]], [-8286 + 18, [25, 11]], [-10206 + 1956, [12, 11]], [-10206, [17, 16]]]), ppat: new Set(), mask: new Set(), color: new Set() };
  // Small path (thickness <= 11) probes +18 / +1956 first, then the standard id.
  assert.deepEqual(selectScrollbar({ hilite: 0, orientation: 'horizontal', thickness: 11 }, c).tracks, [-8268]);
  assert.equal(selectScrollbar({ hilite: 0, orientation: 'horizontal', thickness: 11 }, c).thumb, -8250);
  assert.deepEqual(selectScrollbar({ hilite: 0, orientation: 'horizontal', thickness: 16 }, c).tracks, [-8286]);
  // No cross-tier retry: a missing pressed track leaves the decoded rows.
  assert.ok(!selectScrollbar({ hilite: 129, orientation: 'horizontal' }, c).tracks);
  assert.ok(!selectScrollbar({ hilite: 0, orientation: 'horizontal' }, c, { doubleArrows: true }).tracks);
  // AI4 (0xf4ba): colour art is the ics8 only; an id with ics# + ics4 and no ics8
  // draws the 1-bit ics# (no corpus archive ships that case, so it is synthetic).
  const fork = [{ type: 'cicn', id: -8286, data: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 16]) }, // iconPMap bounds 0,0,16,16
    { type: 'ics#', id: -10202 }, { type: 'ics4', id: -10202 }, { type: 'ics#', id: -10201 }, { type: 'ics8', id: -10201 }];
  const synthetic = scrollCensus(fork);
  assert.deepEqual(synthetic.cicn.get(-8286), [16, 16]);
  assert.deepEqual([[...synthetic.color], [...synthetic.ics4]], [[-10201], [-10202]]);
  assert.deepEqual(selectScrollbar({ hilite: 0, orientation: 'horizontal' }, synthetic).iconArt, { '-10202': 'ics#', '-10201': 'ics8' });
});

test('corpus partition: composite vs icon-lane tracks per tier, ppat-backed tracks, unreachable small path', () => {
  const lane = (slug, id) => (corpus.get(slug).census.cicn.get(id).some(v => v > 16) ? 'C' : 'I');
  const table = Object.fromEntries(SLUGS.map(slug => [slug, [-8288, -8287, -8286, -8285, -8280, -8279, -8278, -8277].map(id => lane(slug, id)).join('')]));
  assert.deepEqual(table, {
    1138: 'ICCCICCC', 1984: 'CCCCCCCC', 1990: 'CCCCCCCC', animals: 'CCCCCCCC', 'apple-lisa': 'CCCCCCCC', 'apple-platinum-2': 'IIIIIIII',
    'beos-r503': 'CCCCCCCC', 'black-platinum': 'IIIIIIII', 'crayon-os': 'CCCCCCCC', 'dolphin-som': 'CCCCCCCC', evolution: 'CCCCCCCC', floppies: 'CCCCCCCC',
    'monkey-paradise': 'CCCCCCCC', 'platinum-8': 'IIIIIIII', slimes: 'IIIIIIII', 'system7-nostalgia-silver': 'IIIIIIII', 'windows-31': 'CCCCCCCC', 'windows-95': 'CCCCCCCC',
  });
  // The runtime's discriminator (long side >= 2 x thickness) disagrees for these tracks.
  const disagree = SLUGS.flatMap(slug => [...corpus.get(slug).census.cicn].filter(([id, d]) => id <= -8277 && id >= -8288 && (id < -8284 || id > -8281)
    && d.some(v => v > 16) !== runtimeComposite(d, id <= -8285 ? 'horizontal' : 'vertical')).map(([id]) => `${slug} ${id}`)).sort();
  assert.deepEqual(disagree, ['1990 -8280', '1990 -8288', 'crayon-os -8277', 'crayon-os -8278', 'crayon-os -8279', 'crayon-os -8280', 'crayon-os -8285', 'crayon-os -8286', 'crayon-os -8287', 'crayon-os -8288',
    'dolphin-som -8280', 'dolphin-som -8288', 'evolution -8280', 'evolution -8288', 'windows-95 -8277', 'windows-95 -8278', 'windows-95 -8279', 'windows-95 -8280', 'windows-95 -8285', 'windows-95 -8286', 'windows-95 -8287', 'windows-95 -8288'].sort());
  // Every archive ships all eight standard track tiers, so the no-retry rule is never reached.
  for (const slug of SLUGS) for (let id = -8288; id <= -8277; id++) if (id < -8284 || id > -8281) assert.ok(corpus.get(slug).census.cicn.has(id), `${slug} ${id}`);
  // Standard tracks are 16px thick in every archive: the public thickness never takes the <= 11 small path.
  for (const slug of SLUGS) for (const id of [-8286, -8278]) assert.equal(Math.min(...corpus.get(slug).census.cicn.get(id)), 16, slug);
  const ppat = SLUGS.filter(slug => rows.some(r => r.slug === slug && r.predictions.some(p => p.prediction.unknown?.some(u => u.startsWith('ppat')))));
  assert.deepEqual(ppat, ['apple-lisa', 'crayon-os', 'slimes', 'system7-nostalgia-silver', 'windows-95']);
});

test('decode predictions over the 144 sampled public rows', () => {
  assert.equal(rows.length, 18 * 8);
  for (const r of rows) for (const p of r.predictions) assert.ok(p.prediction.tracks, key(r));
  const iconLane = rows.filter(r => r.predictions.some(p => p.prediction.icons.length)).map(key);
  assert.equal(iconLane.length, 5 * 6); // 5 icon-lane archives x {normal, pressed, disabled} x 2 orientations
  // Inactive rows draw only the tier-0 track; disabled rows draw no thumb.
  for (const r of rows.filter(r => r.row.state === 'inactive')) assert.deepEqual(expectedSet(r.predictions[0].prediction), [`cicn ${r.row.orientation === 'horizontal' ? -8288 : -8280}`], key(r));
  for (const r of rows.filter(r => r.row.state === 'disabled')) assert.equal(r.predictions[0].prediction.thumb, null, key(r));
  // Pressed rows: every reading shares the tier-3 track; part-dependent ids differ.
  for (const r of rows.filter(r => r.row.state === 'pressed')) {
    assert.equal(r.predictions.length, 5);
    for (const p of r.predictions) assert.ok(p.prediction.tracks.includes(r.row.orientation === 'horizontal' ? -8285 : -8277), key(r));
  }
});

// Plausible wrong readings. Each changes predictions in the named archives;
// an archive absent from a list cannot discriminate that reading.
const variants = {
  'normal = -8285/-8277 (the runtime comment\'s "active" label)': { tier: b => (b.inactive ? 0 : b.disabled ? 1 : 3) },
  'tier map of the prior runtime (pressed -8288/-8280, inactive = normal)': { tier: b => (b.pressed && !b.disabled ? 0 : b.disabled && !b.inactive ? 1 : 2) },
  'orientation from height > width': { horizontal: ([w, h]) => h > w },
  'thumb drawn for disabled/inactive': { thumbWhenDisabled: true },
  'composite iff along-axis length >= 2 x thickness': { composite: runtimeComposite },
  'arrow icons whatever the track size': { composite: () => false },
  'always composite': { composite: () => true },
  'hit arrow icons at rest': { hitIconsAtRest: true },
  'pressed thumb at rest': { pressedThumbAtRest: true },
  'disabled arrows use the raised ids': { disabledArrowIds: false },
  'inactive control draws arrows': { arrowsWhenInactive: true },
  'pressed presses every arrow and the thumb': { hitArrowOnly: false },
  'non-hit arrow boxes from the pressed tier': { nonHitBoxFromNormalTier: false },
  'normal-tier retry on a missing track': { crossTierRetry: true },
};
const ALL = [...SLUGS];
const ICON = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
const COMPOSITE = SLUGS.filter(s => !ICON.includes(s));
test('each wrong reading changes predictions per archive (mutation table), or is recorded as not corpus-discriminated', () => {
  const table = Object.fromEntries(Object.entries(variants).map(([name, reading]) => [name,
    SLUGS.filter(slug => rows.some(r => r.slug === slug && sig(predict(slug, r.row, { reading })) !== sig(r.predictions)))]));
  assert.deepEqual(table, {
    'normal = -8285/-8277 (the runtime comment\'s "active" label)': ALL,
    'tier map of the prior runtime (pressed -8288/-8280, inactive = normal)': ALL,
    'orientation from height > width': ALL,
    'thumb drawn for disabled/inactive': ALL,
    'composite iff along-axis length >= 2 x thickness': ['crayon-os', 'windows-95'],
    'arrow icons whatever the track size': COMPOSITE,
    'always composite': ICON,
    'hit arrow icons at rest': ICON,
    'pressed thumb at rest': ALL,
    'disabled arrows use the raised ids': ICON,
    'inactive control draws arrows': ICON,
    'pressed presses every arrow and the thumb': ALL,
    'non-hit arrow boxes from the pressed tier': COMPOSITE,
    'normal-tier retry on a missing track': [],
  });
  // The normal rows (the only rows the runtime agrees on) discriminate fewer readings.
  const normal = Object.fromEntries(Object.entries(variants).map(([name, reading]) => [name,
    SLUGS.filter(slug => rows.some(r => r.slug === slug && r.row.state === 'normal' && sig(predict(slug, r.row, { reading })) !== sig(r.predictions)))]).filter(([, v]) => v.length));
  assert.deepEqual(normal, {
    'normal = -8285/-8277 (the runtime comment\'s "active" label)': ALL, 'orientation from height > width': ALL,
    'arrow icons whatever the track size': ['floppies'], 'always composite': ICON, 'hit arrow icons at rest': ICON, 'pressed thumb at rest': ALL,
  });
  // The along-axis discriminator changes only pressed predictions (crayon-os and
  // windows-95 ship no arrow icons); their normal-row disagreement is observed as
  // procedural pixels (R4), which no prediction set encodes.
  // The retry is never reached by a shipped archive; a minimal fork shows it.
  const minimal = { cicn: new Map([[-8286, [33, 16]]]), ppat: new Set(), mask: new Set(), color: new Set() };
  assert.ok(!selectScrollbar({ hilite: 254, orientation: 'horizontal' }, minimal).tracks);
  assert.deepEqual(selectScrollbar({ hilite: 254, orientation: 'horizontal' }, minimal, { reading: variants['normal-tier retry on a missing track'] }).tracks, [-8286]);
});

test('checkRow fails wrong sets, nulls and procedural pixels; any one pressed reading suffices', () => {
  const r = rows.find(x => x.slug === 'platinum-8' && x.row.orientation === 'horizontal' && x.row.state === 'pressed');
  const thumbPress = expectedSet(r.predictions.find(p => p.native.hilite === 129).prediction);
  assert.deepEqual(checkRow(r.predictions, { isNull: false, present: thumbPress, procedural: 0 }), { failure: null, matched: [129] });
  assert.deepEqual(checkRow(r.predictions, { isNull: false, present: expectedSet(r.predictions[2].prediction), procedural: 0 }).matched, [22, 23]);
  assert.match(checkRow(r.predictions, { isNull: false, present: thumbPress, procedural: 3 }).failure, /procedural/);
  assert.match(checkRow(r.predictions, { isNull: true, present: [] }).failure, /null/);
  // The prior runtime's pressed output (pressed tier -8288, both arrows hit, pressed thumb) matches no reading.
  assert.ok(checkRow(r.predictions, { isNull: false, present: ['cicn -10205', 'cicn -8288', 'icon -10197', 'icon -10198'], procedural: 0 }).failure);
  // Each wrong reading's prediction, presented as the observation, fails a corpus row.
  for (const [name, reading] of Object.entries(variants)) {
    const bad = rows.find(x => sig(predict(x.slug, x.row, { reading })) !== sig(x.predictions));
    if (!bad) continue; // not corpus-discriminated (above)
    const wrong = predict(bad.slug, bad.row, { reading }).find(p => p.prediction.tracks && !bad.predictions.some(q => JSON.stringify(expectedSet(q.prediction)) === JSON.stringify(expectedSet(p.prediction))));
    if (!wrong) continue;
    assert.ok(checkRow(bad.predictions, { isNull: false, present: expectedSet(wrong.prediction), procedural: 0 }).failure, name);
  }
});
