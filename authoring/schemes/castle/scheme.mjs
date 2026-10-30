// Castle — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: a medieval curtain wall. Window frames are not rectangles: whole
// merlons tile along the top, corner towers rise above the title bar, a
// gatehouse carries the title on a hanging red banner with swallowtail ends,
// the side walls have arrow loops, and a plinth with a little gate runs along
// the bottom. Widgets are a heraldic shield (close) and two dressed-stone
// plates with whole-pixel glyphs (zoom: window-in-window; collapse: a bar
// under a chevron), all clickable on the web through the pressed strip (cicn
// -14330; -14298 for classic utility windows). Push buttons are oak planks
// with iron studs; bodies are parchment.
//
// Light: one source, upper left, on everything: blocks get a lit top row and
// a shaded right end (selectively), towers a 1px highlight column and a 3px
// shade band, plates and buttons a lit top/left bevel.
// Original art; no game or film artwork.
//
// Build:   npm run author -- authoring/schemes/castle
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   (frame geometry: frameLayout / stripLayout / pressedStripFrom from the toolkit)
//   frames.mjs      window types and the frame painter
//   widgets.mjs     close / zoom / collapse art and the pressed strip
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, thumbs, ghosts, little arrows
//   patterns.mjs    parchment body (every window type), Finder colours
import { encodeCicn, encodeWnd, encodeColr, encodeVers } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { stripLayout } from '../../../tools/theme-author/index.js';
import { pressedStrip } from './widgets.mjs';
import * as controls from './controls.mjs';
import * as scrollbars from './scrollbars.mjs';
import * as patterns from './patterns.mjs';

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

  add('vers', 1, encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Castle (Scriptoscope authoring)' }));
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
  // window has a close box only, at the same 13px, so its close piece is the
  // same x = 0 column.
  const strip = stripLayout(activeDoc.layout);
  add('cicn', -14330, encodeCicn(pressedStrip(strip, activeDoc.frame)), 'Pressed Widgets');
  // Classic reads -14298 for utility windows (altWidgets), at offsets summed
  // from the utility's own rects, so lay it out from the utility window and
  // build it from that frame's pixels (its close box sits on a narrower tower).
  add('cicn', -14298, encodeCicn(pressedStrip(stripLayout(activeUtil.layout), activeUtil.frame)), 'Pressed Utility Window Widgets');

  controls.build(addFrom('controls.mjs'));
  scrollbars.build(addFrom('scrollbars.mjs'));
  patterns.build(addFrom('patterns.mjs'));
  return { resources };
}
