// Source-addressed checkbox/radio selection rules (Kaleidoscope 2.3.1 kDEF 0).
// Pure ESM, no Node or DOM dependencies, nothing from src/. The Node test and
// the source/built spec share this table; the runtime is the thing under test.
//
// Every literal is transcribed from docs/spec/checkable-icons.md (section
// "Lane order, state bytes, resource files and placement") or the pinned
// 0x18b88 icon table, not from runtime output.

// 0x724c / 0x7278: `addiw #-9504`.
export const CICN_BASE = -9504;
// 0x18b88 table copied at 0x710e–0x712c, indexed kind*24 + tier*8 + value*2.
// Rows are icon tiers 0 normal, 1 pressed, 2 disabled; columns are value 0..3.
export const ICON_TABLE = {
  checkbox: [[-10236, -10235, -10234, -10233], [-10232, -10231, -10230, -10229], [-10240, -10239, -10238, -10237]],
  radio: [[-10220, -10219, -10218, -10219], [-10216, -10215, -10214, -10215], [-10224, -10223, -10222, -10223]],
};
export const ICON_TABLE_SHA256 = 'a04ff620dd05d109fbe0fc76247940f15657e9c603381bc30ed92c1264399095';
/** The 48 big-endian bytes the pinned table hash covers. */
export function iconTableBytes() {
  const out = new Uint8Array(48);
  ['checkbox', 'radio'].forEach((kind, k) => ICON_TABLE[kind].forEach((row, t) => row.forEach((id, v) => {
    const at = k * 24 + t * 8 + v * 2; out[at] = (id >> 8) & 0xff; out[at + 1] = id & 0xff;
  })));
  return out;
}

/** 0x66e8–0x6770: blob bytes from ControlRecord hilite and varCode. */
export function stateBytes({ hilite, varCode }) {
  const disabled = hilite === 254 || hilite === 255;
  const v = varCode & 7;
  if (![1, 2, 3, 4].includes(v)) return null; // not a checkable variant
  return { disabled, pressed: !disabled && hilite !== 0, kind: v === 2 || v === 4 ? 1 : 0 };
}
/** 0x71f6–0x7208 (CICN tier) and 0x731c–0x732c (icon tier); disabled wins. */
export const cicnTier = b => (b.disabled ? 0 : b.pressed ? 2 : 1);
export const iconTier = b => (b.disabled ? 2 : b.pressed ? 1 : 0);
export const cicnId = (kind, value, tier) => CICN_BASE + 12 * kind + 3 * value + tier;

/**
 * Predict the art the kDEF draws for one checkable, given what each lane can
 * find. `census` = { cicn: Set<id>, mask: Set<id>, color: Set<id> } for the
 * resource chain the caller declares (the corpus table declares the archive's
 * own fork only; see the doc section for why that is an assumption).
 * `acid` is the undecoded Gestalt('Acid') byte +20.
 * Returns { lane: 'cicn'|'icon'|'none'|'unknown', id, probes }.
 */
export function selectCheckable({ hilite, varCode, value }, census, { acid = false } = {}) {
  const b = stateBytes({ hilite, varCode });
  if (!b || ![0, 1, 2, 3].includes(value)) return { lane: 'unknown', id: null, probes: [] };
  const probes = [];
  // CICN lane, 0x71ec–0x728a.
  let v = value;
  if (v === 1 && acid && b.kind === 0) v = 3;                         // 0x720a–0x7232
  const t = cicnTier(b);
  if (v === 2 || v === 3) {                                          // 0x7234–0x7264
    probes.push({ lane: 'cicn', id: cicnId(b.kind, v, t) });
    if (!census.cicn.has(cicnId(b.kind, v, t))) v = 1;
    else return { lane: 'cicn', id: cicnId(b.kind, v, t), probes };
  }
  probes.push({ lane: 'cicn', id: cicnId(b.kind, v, t) });           // 0x7266–0x728a
  if (census.cicn.has(cicnId(b.kind, v, t))) return { lane: 'cicn', id: cicnId(b.kind, v, t), probes };
  // Icon lane, 0x7314–0x73fa: value re-read from the control.
  let w = value;
  if (w === 1 && acid) w = 3;                                        // 0x7380–0x73a2
  const row = ICON_TABLE[b.kind ? 'radio' : 'checkbox'][iconTier(b)];
  if (w === 2 || w === 3) {                                          // 0x73ae–0x73d8
    probes.push({ lane: 'icon-mask', id: row[w] });
    if (!census.mask.has(row[w])) w = 1;
  }
  const id = row[w];
  probes.push({ lane: 'icon', id });
  // 0xf50c–0xf51e requires the selected mask. A mask without colour art is a
  // decoder/provider question this table does not answer.
  if (!census.mask.has(id)) return { lane: 'none', id: null, probes };
  if (!census.color.has(id)) return { lane: 'unknown', id, probes };
  return { lane: 'icon', id, probes };
}

/**
 * Public options -> declared native inputs. MODERN POLICY, not a decode:
 * mixed before checked, `disabled` as hilite 255, no pressed, varCode 1/2.
 */
export function nativeFor(kind, { checked = false, mixed = false, disabled = false }) {
  return { varCode: kind === 'radio' ? 2 : 1, value: mixed ? 2 : checked ? 1 : 0, hilite: disabled ? 255 : 0 };
}
/** The sampled public rows: kind x {off, on, mixed} x {normal, disabled}, empty label. */
export const PUBLIC_ROWS = ['checkbox', 'radio'].flatMap(kind => [false, true].flatMap(disabled =>
  [{ checked: false, mixed: false }, { checked: true, mixed: false }, { checked: false, mixed: true }]
    .map(v => ({ kind, options: { label: '', ...v, disabled } }))));

/**
 * Inside Macintosh: More Macintosh Toolbox 1-121..1-123 resource fork layout:
 * header (data offset, map offset); map +24 type-list offset, +26 name-list
 * offset; type list = count-1, then {type, count-1, ref-list offset}; each ref
 * = {id, name offset, attrs+data offset (4), handle (4)}. Returns [{type, id}].
 */
export function parseResourceMap(fork) {
  const u16 = at => (fork[at] << 8) | fork[at + 1], s16 = at => (u16(at) << 16) >> 16;
  const u32 = at => ((fork[at] << 24) >>> 0) + (fork[at + 1] << 16) + (fork[at + 2] << 8) + fork[at + 3];
  const map = u32(4), types = map + u16(map + 24), out = [];
  const typeCount = s16(types) + 1;
  for (let i = 0; i < typeCount; i++) {
    const at = types + 2 + i * 8;
    const type = String.fromCharCode(fork[at], fork[at + 1], fork[at + 2], fork[at + 3]);
    const count = s16(at + 4) + 1, refs = types + u16(at + 6);
    for (let j = 0; j < count; j++) out.push({ type, id: s16(refs + j * 12) });
  }
  return out;
}
/** Census for selectCheckable from a raw fork: own cicn, ics# and colour icons. */
export function censusFromFork(fork) {
  const res = parseResourceMap(fork), ids = type => new Set(res.filter(r => r.type === type).map(r => r.id));
  return { cicn: ids('cicn'), mask: ids('ics#'), color: new Set([...ids('ics4'), ...ids('ics8')]) };
}

/**
 * Compare one public observation with the decode prediction. `observed` is
 * { isNull, matches: [{lane, id, type}] }: every candidate raster (archive
 * cicn -9504..-9481 and ics4/ics8 -10240..-10214) whose alpha and opaque RGB
 * equal the public output. Returns { failure, discriminating }.
 */
export function checkRow(expected, observed) {
  if (expected.lane === 'unknown') return { failure: null, discriminating: false, skipped: true };
  if (expected.lane === 'none') {
    return { failure: observed.isNull ? null : `expected no archive art (decode probes ${JSON.stringify(expected.probes)}), runtime drew ${JSON.stringify(observed.matches)}`, discriminating: observed.isNull };
  }
  if (observed.isNull) return { failure: `expected ${expected.lane} ${expected.id}, runtime returned null`, discriminating: false };
  const lane = m => (m.lane === 'icon' ? 'icon' : 'cicn');
  const hit = observed.matches.some(m => lane(m) === expected.lane && m.id === expected.id);
  if (!hit) return { failure: `expected ${expected.lane} ${expected.id}, output matches ${JSON.stringify(observed.matches)}`, discriminating: false };
  // A row discriminates only if no other resource id has the same pixels.
  return { failure: null, discriminating: observed.matches.every(m => lane(m) === expected.lane && m.id === expected.id) };
}

export const CICN_LANE = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'windows-31', 'windows-95'];
export const ICON_ONLY = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
