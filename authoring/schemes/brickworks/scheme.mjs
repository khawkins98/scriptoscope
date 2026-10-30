// Brickworks — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: chunky toy construction bricks in bright primary plastic. Window
// frames are not rectangles: a row of round studs stands up along the top
// (only ever whole studs), document windows have raised corner bricks in a
// contrasting colour, the title sits on a smooth white tile, the walls are
// offset brick courses and the bottom is a studded green baseplate. Widgets
// are round 1×1 tiles. A generic building-toy motif: plain round studs, no
// brand names, logos or lettering.
//
// Build:   npm run author -- authoring/schemes/brickworks
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   palette.mjs     brick colours per state and per window type
//   frames.mjs      window types (frameLayout) and the frame painter
//   widgets.mjs     close / zoom / collapse tiles and the pressed strip
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, thumbs, ghosts, little arrows
//   extras.mjs      progress bar, sliders, tabs, list headers, disclosure triangles, grow box
//   patterns.mjs    baseplate document body, utility body, Finder colours
import { encodeCicn, encodeWnd, encodeColr, encodeVers, stripLayout } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { pressedStrip } from './widgets.mjs';
import * as controls from './controls.mjs';
import * as scrollbars from './scrollbars.mjs';
import * as extras from './extras.mjs';
import * as patterns from './patterns.mjs';

const PARTS = { 'controls.mjs': controls, 'scrollbars.mjs': scrollbars, 'extras.mjs': extras, 'patterns.mjs': patterns };

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

  add('vers', 1, encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Brickworks (Scriptoscope authoring)' }));
  add('Colr', 129, encodeColr());

  let activeDoc = null;
  for (const t of windowTypes()) {
    const active = paintFrame(t, 'active');
    if (t.id === -14336) activeDoc = { frame: active, layout: t.layout };
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t, 'inactive')), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(active), `Active ${t.name}`);
  }
  // Pressed widgets (R24): one strip, close | zoom | collapse, from the
  // document's rects. The utility window has a close box only (same 14px), so
  // its close piece is the same x = 0 column. -14298 is the classic-only
  // utility strip; the same art serves.
  const strip = pressedStrip(stripLayout(activeDoc.layout), activeDoc.frame);
  add('cicn', -14330, encodeCicn(strip), 'Pressed Widgets');
  add('cicn', -14298, encodeCicn(strip), 'Pressed Utility Window Widgets');

  for (const [file, part] of Object.entries(PARTS)) part.build(addFrom(file));
  return { resources };
}
