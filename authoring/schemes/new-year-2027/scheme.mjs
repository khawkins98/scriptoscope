// Midnight 2027 — an original first-party Kaleidoscope scheme, authored in
// code, celebrating Happy New Year 2027.
//
// Look: the window is the night sky at the stroke of midnight. A midnight-navy
// bar with sparse stars carries a champagne-gold title plate; a big gold and
// pink firework bursts through the bar's top edge left of the plate, and
// "2027" in bold gold numerals stands on the bar right of it under a cyan
// burst. Bevelled navy sides and bottom with a gold rule round a plain white body;
// the clock at midnight sits in the bottom-right corner, and again as the
// scroll thumb (a pocket watch), the alert crest and the grow box. Widgets
// are gold-rimmed navy discs with whole-pixel glyphs; push buttons are navy in
// gold and invert to gold when pressed.
//
// Concept first (docs/authoring-a-scheme.md §4): concept/brief.md,
// concept/brief-concept.txt → concept/concept.jpg, then paint-over
// (npm run paint-over) at the concept's 3.7 px scale for the ornaments
// (art.mjs says what was measured and how it was cleaned up).
//
// Light: one source, upper left, on everything. Palette: exact system-palette
// entries only (palette.mjs), so 8 bpp keeps each step. Original art: no
// trademarks, bottles or logos; the numerals are original letterforms.
//
// Build:   npm run author -- authoring/schemes/new-year-2027 --sheet --palette
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   frames.mjs      window types and the frame painter (frameLayout recipes at its top)
//   art.mjs         bursts, the year, the clock, the title-bar discs, the icon
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, pocket-watch thumbs, ghosts, little arrows
//   families.mjs    sliders (gold star markers) and tabs + panes
//   progress.mjs    progress bar + confetti barber pole, list headers, disclosure, clock grow box
//   menus.mjs       menu bar and menus (classic only), the scheme icon
//   patterns.mjs    white bodies, the night-sky desktop, Finder colours, header cluts
//   classic.mjs     control-panel extras (classic only): about box, arrow cursor, WindowShade sounds
import { encodeCicn, encodeWnd, encodeColr, encodeVers, stripLayout, pressedStripFrom } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { disc } from './art.mjs';

const PARTS = ['controls', 'scrollbars', 'families', 'progress', 'menus', 'patterns', 'classic'];

/** The pressed strip: each piece is the widget's frame pixels with the pressed (inverted) disc on top. */
const pressed = (strip, frame) => pressedStripFrom({ strip, activeFrame: frame, draw: (role, raster, box) => disc(raster, box, role, 'active', true) });

export async function buildScheme() {
  const resources = [];
  const owner = new Map();
  const addFrom = (file) => (type, id, data, name) => {
    const key = `${type}:${id}`;
    if (owner.has(key)) throw new Error(`${type} ${id} is added by both ${owner.get(key)} and ${file}`);
    owner.set(key, file);
    resources.push({ type, id, data, ...(name ? { name } : {}) });
  };
  const add = addFrom('scheme.mjs');

  add('vers', 1, encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Midnight 2027 (Scriptoscope authoring)' }));
  add('Colr', 129, encodeColr());

  let activeDoc = null, activeUtil = null;
  for (const t of windowTypes()) {
    const active = paintFrame(t, 'active');
    if (t.id === -14336) activeDoc = { frame: active, layout: t.layout };
    if (t.id === -14304) activeUtil = { frame: active, layout: t.layout };
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t, 'inactive')), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(active), `Active ${t.name}`);
  }

  // Pressed widgets (R24): close | zoom | collapse laid out from the document
  // window's rects. The web reads it for every window; the utility window has
  // a close box only, at the same 23px, so its close piece is the same x = 0
  // column. Classic reads -14298 for utility windows, at offsets summed from
  // the utility's own rects, so that one is built from the utility frame.
  add('cicn', -14330, encodeCicn(pressed(stripLayout(activeDoc.layout), activeDoc.frame)), 'Pressed Widgets');
  add('cicn', -14298, encodeCicn(pressed(stripLayout(activeUtil.layout), activeUtil.frame)), 'Pressed Utility Window Widgets');

  // MIDNIGHT_PARTS=controls,scrollbars builds only some families while you work on one.
  const only = process.env.MIDNIGHT_PARTS?.split(',');
  for (const part of PARTS) {
    if (only && !only.includes(part)) continue;
    const mod = await import(`./${part}.mjs`);
    mod.build(addFrom(`${part}.mjs`));
  }
  return { resources };
}
