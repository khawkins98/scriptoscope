// Bonn — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: a window on the Rhine in blossom season. Every document window carries
// the Bonn skyline as one outlined silhouette standing on a sandstone title
// bar (the Minster with its spire and four flanking towers, the pink Old Town
// Hall with its outside stair, the glass Post Tower), drawn once whatever the
// window's width (a droppable code-10 cell). A cherry branch with five-pixel
// rosettes runs along the bar's top edge from the left corner. The title hangs
// on a red city pennant. Sandstone ashlar piers run down both sides, and the
// Rhine runs along the bottom: an embankment, two flat teal bands with foam
// dashes, a stone arch bridge in the middle and a mooring bollard on the
// bottom-right pier. Widgets are one family of 14px sandstone discs carrying a
// rosette (close), the city colours with a square (zoom) and a wave
// (collapse), clickable on the web through the pressed strip (cicn -14330;
// classic utility windows read -14298). Red is the title's colour: the
// pennant, the default ring, checked marks and arrowheads only. Light comes
// from the upper left. Everything is drawn on whole pixels with colours of the
// 8-bit system palette, so classic and web look alike.
// Original art; no photos, coat of arms or logos.
//
// Build:   npm run author -- authoring/schemes/bonn
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   frames.mjs      window types (frameLayout) and the frame painter
//   skyline.mjs     the skyline, the blossom branch, the dialog/alert ornaments
//   widgets.mjs     close / zoom / collapse art and the pressed strip
//   pixels.mjs      whole-pixel rounded shapes with outline and bevel rings
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, thumbs, ghosts, little arrows
//   patterns.mjs    white bodies, the Rhine desktop, Finder colours
//   families.mjs    sliders, tabs + panes, bevel buttons, popup pieces
//   progress.mjs    progress bar + barge, list headers, disclosure, grow boxes
//   menus.mjs       menu bar, pull-down and pop-up menus, the grabber
//   icon.mjs        the scheme's picker icon (a cherry blossom)
//   classic.mjs     control-panel extras (classic only): about box, arrow cursor, WindowShade sounds
//
// Not themed (falls back): popup / side-floating / no-title utility windows,
// text fields (CSS on the web).
import { encodeCicn, encodeWnd, encodeColr, encodeVers, stripLayout } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { pressedStrip } from './widgets.mjs';

const PARTS = ['controls', 'scrollbars', 'patterns', 'families', 'progress', 'menus', 'icon', 'classic'];

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

  add('vers', 1, encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Bonn (Scriptoscope authoring)' }));
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

  // Pressed widgets (R24): one strip, close | zoom | collapse, from the
  // document window's rects. The web reads it for every window; the utility
  // window has a close box only, at the same size, so its close piece is the
  // same x = 0 column.
  add('cicn', -14330, encodeCicn(pressedStrip(stripLayout(activeDoc.layout), activeDoc.frame)), 'Pressed Widgets');
  // Classic reads utility windows' pressed widgets from -14298 instead, at the
  // utility window's own offsets, so lay it out from the utility window and
  // cut it from the utility frame (its close box sits on that frame's pixels).
  add('cicn', -14298, encodeCicn(pressedStrip(stripLayout(activeUtil.layout), activeUtil.frame)), 'Pressed Utility Window Widgets');

  // BONN_PARTS=controls,scrollbars builds only some families while you work on one.
  const only = process.env.BONN_PARTS?.split(',');
  for (const part of PARTS) {
    if (only && !only.includes(part)) continue;
    const mod = await import(`./${part}.mjs`);
    mod.build(addFrom(`${part}.mjs`));
  }
  return { resources };
}
