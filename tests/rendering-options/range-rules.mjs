// Source-addressed scroll-bar resource-selection rules (Kaleidoscope 2.3.1 kDEF 0,
// scroll-bar CDEF 0x997e, service slot 1; not slot 5 0x8d36). Pure ESM, nothing
// from src/. The Node test and the source/built spec share this table; the
// runtime is the thing under test.
//
// Every literal is transcribed from docs/spec/range-controls.md ("Scroll-bar
// selection (2.3.1 decode)") and docs/spec/engine/scrollbar.md, not from runtime
// output. Geometry rows live in scrollbar-geometry-rules.mjs. Sliders and
// progress bars have no selection decode in either kDEF listing; they are
// explicit unknowns.

// 0xa032–0xa040: horizontal (byte21, 0xadfe: width > height) -8288, else -8280.
export const TRACK_BASE = { horizontal: -8288, vertical: -8280 };
// 0xa074–0xa0c8: thickness (0xbc92) <= 11 probes base + 18 first.
export const SMALL_TRACK_OFFSET = 18;
// 0xaf24–0xaf54: thumb ids; 0xaf58–0xaf84: thickness <= 11 probes id + 1956 first.
export const THUMB = { horizontal: { normal: -10206, pressed: -10205 }, vertical: { normal: -10208, pressed: -10207 } };
export const SMALL_THUMB_OFFSET = 1956;
// 0x9f0e–0x9f38: arrow ids written to the blob at +24..+38, read at 0xc79e–0xc7b6
// as +24 + 8*high + 4*vertical + 2*hit.
export const ARROW = {
  horizontal: { low: { raised: -10202, hit: -10198 }, high: { raised: -10201, hit: -10197 } },
  vertical: { low: { raised: -10204, hit: -10200 }, high: { raised: -10203, hit: -10199 } },
};
// 0xc7ba–0xc7fa: a disabled (byte20) control draws these ids in the icon lane.
export const DISABLED_ARROW = { horizontal: { low: -10206, high: -10205 }, vertical: { low: -10208, high: -10207 } };
// Part codes (Inside Macintosh: inUpButton 20, inDownButton 21, inPageUp 22, inPageDown 23, inThumb 129).
export const PRESSED_HILITES = [20, 21, 22, 23, 129];

/**
 * Blob bytes from the control record. 0x9f7a–0x9f8a: byte47 (inactive) for
 * hilite 254; 0x9f90–0x9fd6: also for hilite 255 when Gestalt('appr') succeeds
 * and GetSuperControl's parent is inactive (`parentInactive`). 0xada2: byte20
 * for hilite >= 254, or min == max. 0xa01c–0xa030: pressed for hilite 1..253.
 */
export function scrollBytes({ hilite, min = 0, max = 1, parentInactive = false }) {
  const inactive = hilite === 254 || (hilite === 255 && parentInactive);
  return { inactive, disabled: hilite >= 254 || min === max, pressed: hilite !== 0 && hilite < 254 };
}
/** 0xa042–0xa05e: inactive 0, disabled 1, pressed 3, otherwise 2. */
export const trackTier = b => (b.inactive ? 0 : b.disabled ? 1 : b.pressed ? 3 : 2);
/** 0xa14e–0xa184: arrows come from the track cicn when its bounds exceed 16 in either axis. */
export const compositeTrack = ([w, h]) => w > 16 || h > 16;

/** The decode, as named rules. A wrong reading overrides one of them (mutation tests only). */
export const DECODE = {
  tier: trackTier,
  composite: compositeTrack,
  horizontal: ([w, h]) => w > h,                       // 0xadfe
  thumbWhenDisabled: false,                            // 0xaf08–0xaf20
  arrowsWhenInactive: false,                           // 0xc34a
  disabledArrowIds: true,                              // 0xc7ba–0xc7fa
  hitArrowOnly: true,                                  // 0xc764–0xc790 (20 low, 21 high)
  nonHitBoxFromNormalTier: true,                       // 0xc3cc–0xc3fe
  crossTierRetry: false,                               // 0xa06c–0xa10e
  hitIconsAtRest: false,                               // 0xc764–0xc790: hit only for hilite 20/21
  pressedThumbAtRest: false,                           // 0xaf24–0xaf54: pressed only for hilite 129
  keepSmallTrackId: true,                              // 0xa0c2: trackId keeps +18 after a small-art miss (engine/scrollbar.md TR7)
  iconColour: 'ics8',                                  // 0xf4ba: ics8 from the ics#'s file, else the 1-bit ics# (AI4); never ics4
};

/**
 * Predict the resources one scroll bar draw uses. `native` = { hilite, orientation,
 * thickness, min, max, parentInactive }. `census` = { cicn: Map<id, [w, h]>,
 * ppat: Set<id>, mask: Set<id> (ics#), color: Set<id> (ics8), ics4?: Set<id> }
 * for the resource chain the caller declares (the corpus table declares the
 * archive's own fork). `doubleArrows` stands for the undecoded Gestalt('Acid')
 * byte +33 (byte18), declared clear. Returns { tracks: [id], thumb: id|null,
 * icons: [id], iconArt: { id: 'ics8' | 'ics#' }, unknown: [reason], composite }
 * or { unknown } when the selection leaves the decoded rows.
 */
export function selectScrollbar(native, census, { doubleArrows = false, reading = {} } = {}) {
  const r = { ...DECODE, ...reading };
  const { hilite, thickness = 16 } = native;
  const orientation = r.horizontal(native.orientation === 'horizontal' ? [120, thickness] : [thickness, 120]) ? 'horizontal' : 'vertical';
  const unknown = [];
  if (doubleArrows) return { unknown: ['Acid +33 double-arrow layout (0xa47c–0xa4e2, +4 track ids) is not modelled'] };
  const b = scrollBytes(native), tier = r.tier(b), base = TRACK_BASE[orientation];
  // Track, 0xa06c–0xa10e: no retry at another tier.
  let trackId = null;
  if (thickness <= 11 && census.cicn.has(base + SMALL_TRACK_OFFSET + tier)) trackId = base + SMALL_TRACK_OFFSET + tier;
  else if (census.cicn.has(base + tier)) trackId = base + tier;
  else if (r.crossTierRetry && census.cicn.has(base + 2)) trackId = base + 2;
  if (trackId === null) return { unknown: [`no track cicn ${base + tier}: the draw path without a track handle is not decoded`] };
  // a2@(66) keeps base + 18 + tier on the small path even when only the standard
  // cicn was found (0xa0c2); 0xc3da and 0xa114 read it.
  const recordId = thickness <= 11 && r.keepSmallTrackId ? base + SMALL_TRACK_OFFSET + tier : base + tier;
  const tracks = [trackId];
  const composite = r.composite(census.cicn.get(trackId), orientation);
  // 0xa112–0xa14a fetch a ppat with the record id. Its draw path is decoded in
  // engine/scrollbar.md (TF7, AC4) but the sentinel method here cannot observe
  // it, so a present ppat stays an unknown of this selection table.
  if (census.ppat?.has(recordId) || census.ppat?.has(base + tier)) unknown.push(`ppat ${recordId} present: its draw path is undecoded`);
  // Arrows, 0xc338: none at all for an inactive (byte47) control (0xc34a).
  const icons = [], iconArt = {};
  const arrowHit = r.hitIconsAtRest && hilite === 0 ? { low: true, high: true } : r.hitArrowOnly ? { low: hilite === 20, high: hilite === 21 } : { low: b.pressed, high: b.pressed };
  if (!b.inactive || r.arrowsWhenInactive) {
    if (composite) {
      // 0xc3cc–0xc3fe: a pressed control draws non-hit arrow boxes from id - 1
      // (falling back to the pressed-tier cicn itself).
      for (const end of ['low', 'high']) {
        if (r.nonHitBoxFromNormalTier && b.pressed && !arrowHit[end] && census.cicn.has(recordId - 1)) tracks.push(recordId - 1);
      }
    } else {
      for (const end of ['low', 'high']) {
        const id = b.disabled && r.disabledArrowIds ? DISABLED_ARROW[orientation][end] : ARROW[orientation][end][arrowHit[end] ? 'hit' : 'raised'];
        // 0xf4ba requires the ics# (0xf50c–0xf51e); at >= 8-bit depth it draws the
        // ics8 Get1Resource'd from the ics#'s own file, otherwise the 1-bit ics#
        // image. ics4 is never requested (engine/scrollbar.md AI4).
        if (!census.mask.has(id)) continue;
        icons.push(id);
        iconArt[id] = census.color.has(id) ? 'ics8' : r.iconColour === 'ics4-or-ics8' && census.ics4?.has(id) ? 'ics4' : 'ics#';
      }
    }
  }
  // Thumb, 0xaed6: none when byte20 (0xaf08–0xaf20 fill the whole track rect T
  // instead). 0xbbf4 is the track rect T, not the thumb rect: an empty T draws
  // neither thumb nor track. The thumb rect is 0xab68 (length) + 0xa97c
  // (position), engine/scrollbar.md §5.6–§5.7; at the sampled length 120 it is
  // non-empty (scrollbar-geometry-rules.mjs).
  let thumb = null;
  if (!b.disabled || r.thumbWhenDisabled) {
    const id = THUMB[orientation][hilite === 129 || (r.pressedThumbAtRest && hilite === 0) || (!r.hitArrowOnly && b.pressed) ? 'pressed' : 'normal'];
    if (thickness <= 11 && census.cicn.has(id + SMALL_THUMB_OFFSET)) thumb = id + SMALL_THUMB_OFFSET;
    else if (census.cicn.has(id)) thumb = id;
  }
  return { tracks: [...new Set(tracks)].sort((a, c) => a - c), thumb, icons: icons.sort((a, c) => a - c), iconArt, unknown, composite };
}

/**
 * Public options -> declared native inputs. MODERN POLICY, not a decode:
 * disabled = hilite 255 without an inactive embedding parent, inactive = 254,
 * min < max, the track cicn's cross size as the control thickness. Public
 * `pressed` names no part, so it maps to every part code in PRESSED_HILITES.
 */
export function nativeFor({ orientation, state }) {
  const hilite = state === 'disabled' ? [255] : state === 'inactive' ? [254] : state === 'pressed' ? PRESSED_HILITES : [0];
  return hilite.map(h => ({ hilite: h, orientation, thickness: 16, min: 0, max: 1, parentInactive: false }));
}
export const STATES = ['normal', 'pressed', 'disabled', 'inactive'];
export const PUBLIC_ROWS = ['horizontal', 'vertical'].flatMap(orientation => STATES.map(state => ({ orientation, state })));
/** Options passed to the public composeScrollbar for every row. */
export const SAMPLE = { length: 120, value: 0.5 };

/** Candidate resources a scroll bar row can observe: every own cicn in the
 * scroll-bar/thumb ranges and every 16px colour icon in the arrow range. */
export const inCicnRange = id => (id >= -8288 && id <= -8249) || (id >= -10208 && id <= -10197);
export const inIconRange = id => id >= -10208 && id <= -10197;

/** Census for selectScrollbar from a parsed fork (checkable-rules.mjs parseResourceMap). */
export function scrollCensus(map) {
  const cicn = new Map();
  for (const r of map.filter(r => r.type === 'cicn' && inCicnRange(r.id))) {
    const d = r.data, s = at => (((d[at] << 8) | d[at + 1]) << 16) >> 16;
    // CIcon iconPMap bounds at +6: top, left, bottom, right (Inside Macintosh: Imaging 4-58).
    cicn.set(r.id, [s(12) - s(8), s(10) - s(6)]);
  }
  const ids = type => new Set(map.filter(r => r.type === type && inIconRange(r.id)).map(r => r.id));
  const ppat = new Set(map.filter(r => r.type === 'ppat' && inCicnRange(r.id)).map(r => r.id));
  // Colour art is ics8 only (0xf4ba); ics4 is kept apart so a mutation can use it.
  return { cicn, ppat, mask: ids('ics#'), color: ids('ics8'), ics4: ids('ics4') };
}

/** The resource set the page reports for a prediction. */
export const expectedSet = p => [...p.tracks.map(id => `cicn ${id}`), ...(p.thumb ? [`cicn ${p.thumb}`] : []), ...p.icons.map(id => `icon ${id}`)].sort();

/**
 * Compare one observation with the predictions for every native reading of the
 * row. `observed` = { isNull, present: ['cicn -8286', 'icon -10202', ...],
 * procedural }: sentinel-substituted resources whose colour reached the output,
 * and the count of opaque pixels drawn without any resource (procedural art).
 * The row passes if one native reading predicts exactly that set and no
 * procedural pixels. Returns { failure, matched: [hilite] }.
 */
export function checkRow(predictions, observed) {
  if (predictions.every(p => p.prediction.unknown && !p.prediction.tracks)) return { failure: null, skipped: true, matched: [] };
  if (observed.isNull) return { failure: 'runtime returned null', matched: [] };
  const got = [...observed.present].sort();
  const matched = predictions.filter(p => p.prediction.tracks && JSON.stringify(expectedSet(p.prediction)) === JSON.stringify(got)).map(p => p.native.hilite);
  const problems = [];
  if (!matched.length) problems.push(`drew ${JSON.stringify(got)}; decode predicts ${predictions.map(p => `${p.native.hilite}:${JSON.stringify(expectedSet(p.prediction))}`).join(' | ')}`);
  if (observed.procedural) problems.push(`${observed.procedural} procedural pixels`);
  return { failure: problems.length ? problems.join('; ') : null, matched };
}

export const SLUGS = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som',
  'evolution', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];

/**
 * Name the disagreement classes of one failing row (docs/spec/range-controls.md
 * "Demonstrated disagreements"): R1 track tier, R2 thumb drawn while byte20,
 * R3 arrow icons, R4 procedural pixels, R5 missing normal-tier arrow box.
 */
export function classify(predictions, observed) {
  const out = [], got = new Set(observed.present), p0 = predictions[0].prediction;
  const primary = TRACK_BASE[predictions[0].native.orientation] + trackTier(scrollBytes(predictions[0].native));
  if (!got.has(`cicn ${primary}`)) out.push('R1');
  if (p0.thumb === null && [...got].some(n => /^cicn -102(0[5-8])$/.test(n))) out.push('R2');
  const icons = [...got].filter(n => n.startsWith('icon ')).sort().join();
  if (!predictions.some(p => p.prediction.icons.map(id => `icon ${id}`).sort().join() === icons)) out.push('R3');
  if (observed.procedural) out.push('R4');
  if (predictions.every(p => p.prediction.tracks.some(id => id !== primary && !got.has(`cicn ${id}`)))) out.push('R5');
  return out;
}
