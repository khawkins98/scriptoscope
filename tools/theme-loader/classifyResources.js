// Resource classification — id + channel (cicn body vs ics4/ics8 pictogram) → role.
//
// Pure / portable: zero fs / canvas / WASM dependencies, so the SAME code runs in
// the browser (`loadKaleidoscopeScheme` builds a runtime `inspector` for demo
// panels) and at build time (`scripts/gen-resource-roles.mjs` materialises
// `themes/<slug>/resource-roles.json`). The two-paths-one-rubric guarantee is
// the point — closes the dual-channel trap where the same id has different roles
// per scheme and per cicn/ics4 channel (see [[reference_cicn_ics4_dual_channel]]).
//
// Ranges sourced from docs/spec/kdef231-reference.md §2.4 + the progress/scroll-arrow
// decodes + docs/kaleidoscope-asset-catalog.md §3.5–§3.8.

/**
 * Classify a resource by id + channel (cicn body vs ics4/ics8 pictogram) + slug.
 * Returns `{ family, role }`. Same id can yield different roles per channel.
 * @param {number} id
 * @param {'cicn'|'ics4'|'ics8'|'icl4'|'icl8'|string} type
 * @param {string|null} slug
 * @returns {{ family: string, role: string }}
 */
export function classify(id, type, slug) {
  const a = Math.abs(id);
  const s = slug || '';
  const isIcon = type === 'ics4' || type === 'ics8' || type === 'icl4' || type === 'icl8';

  if (isIcon) {
    if (a >= 10197 && a <= 10204) {
      const dir = { 10197: 'right', 10198: 'left', 10199: 'down', 10200: 'up', 10201: 'right', 10202: 'left', 10203: 'down', 10204: 'up' }[a];
      return { family: 'scroll-arrow', role: `scroll arrow ${dir} (${a <= 10200 ? 'PRESSED' : 'RAISED'})` };
    }
    if (a >= 10205 && a <= 10208) return { family: 'slider', role: 'slider thumb pictogram (h/v × normal/pressed)' };
    if (a >= 10229 && a <= 10240) return { family: 'checkbox', role: 'checkbox glyph (empty/check/dash/x × states)' };
    if (a >= 10214 && a <= 10228) return { family: 'radio', role: 'radio glyph (off/on/mixed × states)' };
    if ((a >= 14331 && a <= 14336) || (a >= 14315 && a <= 14320)) return { family: 'window-widget', role: 'title-bar widget pictogram (close/zoom/collapse × active/pressed)' };
    if (a >= 10102 && a <= 10112) return { family: 'disclosure', role: 'disclosure triangle (right/down × states)' };
    if (a >= 3800 && a <= 20800) return { family: 'finder-icon', role: s ? `Finder/system icon (${s})` : 'Apple Icon Services Finder/system icon' };
    return { family: 'pictogram', role: s ? `pictogram (${s})` : 'pictogram (unclassified)' };
  }

  // BODY (cicn) channel
  if ((a >= 10071 && a <= 10080) || (a >= 10220 && a <= 10224)) {
    if (a === 10224) return { family: 'progress', role: 'progress TRACK (empty trough)' };
    if (a === 10223) return { family: 'progress', role: 'progress FILL — lavender (canonical default)' };
    if (/frame/.test(s)) return { family: 'progress', role: `progress FRAME${/inactive/.test(s) ? ' (inactive)' : ''}` };
    if (/track/.test(s)) return { family: 'progress', role: `progress TRACK${/inactive/.test(s) ? ' (inactive)' : ''}` };
    if (/full|fill|section/.test(s)) return { family: 'progress', role: `progress FILL${/inactive/.test(s) ? ' (inactive)' : ''}` };
    return { family: 'progress', role: `progress FILL hue (${s || 'alt'})` };
  }
  if (a >= 8277 && a <= 8288) return { family: 'scrollbar', role: 'scrollbar track cicn (h/v × active/inactive/disabled/pressed)' };
  if (a >= 10197 && a <= 10208) {
    if (/thumb/.test(s)) return { family: 'slider', role: `slider thumb cicn (${s})` };
    return { family: 'scroll-arrow', role: 'scroll/slider arrow button FACE (cicn body; dual-channel with the same-id ics4 arrow pictogram)' };
  }
  if (a === 10230 || a === 10231 || a === 10232) return { family: 'button', role: 'default-button ring (active/inactive/mixed)' };
  if (a >= 10238 && a <= 10240) return { family: 'button', role: 'push-button face (normal/pressed/disabled)' };
  if (a >= 10162 && a <= 10176) return { family: 'bevel-button', role: 'bevel-button face' };
  if (a >= 10113 && a <= 10132) return { family: 'slider', role: 'slider track/thumb cicn' };
  if (a === 9567 || a === 9568) return { family: 'list-header', role: 'Finder list-column header' };
  if (a >= 14301 && a <= 14336) return { family: 'window', role: s ? `window chrome (${s})` : 'window frame proxy / grow box / racing-stripe / widget cicn' };
  if (a >= 9548 && a <= 9984) return { family: 'window-info', role: s ? `cinf / window metadata (${s})` : 'cinf / window metadata' };
  if (a >= 8194 && a <= 8205) return { family: 'popup-menu', role: 'popup-menu arrow cicn' };
  if (a >= 8249 && a <= 8252) return { family: 'slider', role: 'slider thumb cicn (-8249..-8252)' };
  if (a === 8271 || a === 8272) return { family: 'slider', role: 'slider thumb cicn (-8271/-8272)' };
  if (a >= 10045 && a <= 10048) return { family: 'little-arrow', role: 'little-arrow cicn (date/number stepper)' };
  if (a >= 9485 && a <= 9504) return { family: 'checkbox', role: s ? `checkbox/radio cicn (${s})` : 'checkbox/radio cicn' };
  if (a === 9969 || a === 9972 || a === 9975 || a === 9977 || a === 9980 || a === 9983) {
    return { family: 'tab', role: 'segmented tab cicn (SSF/LSF front/rear/pane)' };
  }
  if (a >= 12303 && a <= 12320) {
    if (a === 12317 || a === 12318) return { family: 'popup-menu', role: 'popup-menu disabled frame/tab' };
    if (a === 12319) return { family: 'popup-menu', role: 'popup-menu tab face' };
    return { family: 'popup-menu', role: 'popup-menu / tab frame' };
  }
  if (a === 12272 || a === 12287 || a === 12288) return { family: 'menubar', role: 'menubar background/highlight cicn' };
  if (a >= 12256 && a <= 12271) return { family: 'accent-menu', role: 'accent menu-highlight cicn' };
  return { family: 'other', role: s ? `cicn body (${s})` : 'unclassified cicn body' };
}

/** Resolve the per-scheme PROGRESS model from the cicn ids + slug map. */
export function progressSummary(cicnIds, cicnSlug) {
  const has = (id) => cicnIds.has(id);
  if (has(-10223)) {
    const hues = [...cicnIds].filter((id) =>
      ((Math.abs(id) >= 10071 && Math.abs(id) <= 10080) || (Math.abs(id) >= 10220 && Math.abs(id) <= 10222))
      && /french-blue|copper|aquamarine|teal|rose|plum|olive|nutmeg|lime|ivy|turquoise|emerald|gold/.test(cicnSlug.get(id) || '')
    ).sort((x, y) => x - y);
    return { model: 'lavender-2-part', fill: -10223, track: has(-10224) ? -10224 : null, frame: null, alternateHues: hues };
  }
  if (has(-10080) || has(-10079) || has(-10078)) {
    return {
      model: 'role-3-part',
      frame: has(-10080) ? -10080 : null,
      fill: has(-10079) ? -10079 : null,
      track: has(-10078) ? -10078 : null,
      inactive: { frame: has(-10077) ? -10077 : null, fill: has(-10076) ? -10076 : null, track: has(-10075) ? -10075 : null },
    };
  }
  return { model: 'none' };
}

/** Resolve the SCROLL-ARROW model (universal kDEF mapping) for arrows the scheme ships. */
export function scrollArrowSummary(iconIds) {
  const present = [...iconIds].filter((id) => Math.abs(id) >= 10197 && Math.abs(id) <= 10204);
  if (!present.length) return null;
  const pick = (id) => (iconIds.has(id) ? id : null);
  return {
    note: 'UNIVERSAL kDEF231 CDEF mapping (asm 9f0e-9f38) — RAISED is the resting/default state',
    raised: { right: pick(-10201), left: pick(-10202), down: pick(-10203), up: pick(-10204) },
    pressed: { right: pick(-10197), left: pick(-10198), down: pick(-10199), up: pick(-10200) },
  };
}

/** Parse a cicn PNG filename — `cicn-n10231-unnamed.png` → `{ file, id:-10231, name:'unnamed' }`.
 *  Sign prefix is optional (positive ids written without prefix). Returns nulls when unparseable. */
export function parseCicnFilename(file) {
  const m = /^cicn-([np]?)(\d+)(?:-(.*))?\.png$/.exec(file);
  if (!m) return { file, id: null, name: null };
  return { file, id: (m[1] === 'n' ? -1 : 1) * Number(m[2]), name: m[3] || null };
}

/** Parse a ppat PNG filename — `ppat-3.png` / `ppat-<name>.png` → `{ file, label }`. */
export function parsePpatFilename(file) {
  const m = /^ppat-(.+)\.png$/.exec(file);
  return { file, label: m ? m[1] : file.replace(/\.png$/, '') };
}

/**
 * Build the resource-roles summary from a bundle's enumerated resources.
 * The cicn list comes from `assets[]` paths (browser) or filesystem listing (Node);
 * the icon list from convertScheme's `iconIndex` (browser) or `icons/index.json` (Node).
 *
 * @param {string} themeSlug
 * @param {{ file: string; id: number|null; name: string|null }[]} cicns
 * @param {{ file: string; label: string }[]} ppats
 * @param {{ id: number; type: string; size?: number; depth?: number; file: string; name?: string }[]} iconIndex
 * @returns {{ theme: string; progress: object; scrollArrows: object|null; resources: object[] }}
 */
export function buildResourceRoles(themeSlug, cicns, ppats, iconIndex) {
  const resources = [];
  const cicnIds = new Set();
  const cicnSlug = new Map();
  const iconIds = new Set();

  for (const c of cicns) {
    if (c.id == null) continue;
    cicnIds.add(c.id);
    if (c.name) cicnSlug.set(c.id, c.name);
    const { family, role } = classify(c.id, 'cicn', c.name);
    resources.push({ id: c.id, type: 'cicn', slug: c.name, family, role });
  }
  for (const e of iconIndex) {
    if (typeof e.id !== 'number') continue;
    iconIds.add(e.id);
    const nm = e.name ? String(e.name).trim() : null;
    const { family, role } = classify(e.id, e.type || 'ics4', nm);
    resources.push({ id: e.id, type: e.type || 'ics4', size: e.size, slug: nm, family, role });
  }
  for (const p of ppats) {
    resources.push({
      id: null, type: 'ppat', slug: p.label, family: 'pattern',
      role: /1006[0-9]|spinner|barber/.test(p.label) ? 'pattern (possible spinner/indeterminate-progress)' : 'fill pattern (ppat)',
    });
  }
  resources.sort((x, y) => (x.type < y.type ? -1 : x.type > y.type ? 1 : (x.id ?? 0) - (y.id ?? 0)));

  return {
    theme: themeSlug,
    progress: progressSummary(cicnIds, cicnSlug),
    scrollArrows: scrollArrowSummary(iconIds),
    resources,
  };
}
