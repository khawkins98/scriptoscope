// Castle — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: the window IS a stone keep. Two round corner towers with conical red
// roofs and pennants rise above a crenellated curtain wall; the wall is the
// title bar, and the title is a red banner with a gold fringe hung from it,
// between pole finials. Arrow slits spread evenly down the side walls, a
// plinth runs over a narrow moat along the bottom, and a portcullis in a
// stone arch sits in the lower-right corner. Widgets are three dressed-stone
// plates (shield, window, raised drawbridge), clickable on the web through
// the pressed strip (cicn -14330; -14298 for classic utility windows). Push
// buttons are oak planks bound with iron straps; the default ring is brass;
// the scroll thumb is a bound barrel; slider thumbs are shields; tabs are
// merlons; bodies are parchment.
//
// Light: one source, upper left, on everything: towers have a lit left column
// and a shaded right band, roofs a lit left half and a dark right third,
// blocks, merlons and plates a lit top/left and a shaded bottom/right.
// Palette: system-palette steps only (palette.mjs), so 8 bpp keeps it.
// Original art; no game or film artwork.
//
// Build:   npm run author -- authoring/schemes/castle --sheet --palette
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   frames.mjs      window types and the frame painter (frameLayout recipes at its top)
//   stone.mjs       wall / merlon / side / drum masonry tables
//   widgets.mjs     close / zoom / collapse art and the pressed strip
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, barrel thumbs, ghosts, little arrows
//   families.mjs    sliders (shield thumbs) and merlon tabs + panes
//   progress.mjs    progress bar + fringe barber pole, list headers, disclosure, portcullis grow box
//   menus.mjs       menu bar and menus (classic only), the scheme icon
//   patterns.mjs    parchment body (every window type), Finder colours
import { encodeCicn, encodeWnd, encodeColr, encodeVers } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { stripLayout } from '../../../tools/theme-author/index.js';
import { pressedStrip } from './widgets.mjs';

const PARTS = ['controls', 'scrollbars', 'families', 'progress', 'menus', 'patterns'];

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

  add('vers', 1, encodeVers({ major: 0, minor: 2, short: '0.2', long: '0.2 Castle (Scriptoscope authoring)' }));
  add('Colr', 129, encodeColr());

  const types = windowTypes();
  let activeDoc = null, activeUtil = null;
  for (const t of types) {
    const active = paintFrame(t, 'active');
    if (t.id === -14336) activeDoc = { frame: active, layout: t.layout };
    if (t.id === -14304) activeUtil = { frame: active, layout: t.layout };
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t, 'inactive')), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(active), `Active ${t.name}`);
  }

  // Pressed widgets (R24): one strip laid out close | zoom | collapse from the
  // document window's rects. The web reads it for every window; the utility
  // window has a close box only, at the same 14px, so its close piece is the
  // same x = 0 column.
  const strip = stripLayout(activeDoc.layout);
  add('cicn', -14330, encodeCicn(pressedStrip(strip, activeDoc.frame)), 'Pressed Widgets');
  // Classic reads -14298 for utility windows (altWidgets), at offsets summed
  // from the utility's own rects, so lay it out from the utility window and
  // build it from that frame's pixels (its close box sits on a narrower tower).
  add('cicn', -14298, encodeCicn(pressedStrip(stripLayout(activeUtil.layout), activeUtil.frame)), 'Pressed Utility Window Widgets');

  // CASTLE_PARTS=controls,scrollbars builds only some families while you work on one.
  const only = process.env.CASTLE_PARTS?.split(',');
  for (const part of PARTS) {
    if (only && !only.includes(part)) continue;
    const mod = await import(`./${part}.mjs`);
    mod.build(addFrom(`${part}.mjs`));
  }
  return { resources };
}
