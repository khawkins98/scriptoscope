// Bonn — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: the city of Bonn on the Rhine. Every titled window carries a small,
// original skyline silhouette standing on a sandstone title bar (the Minster,
// the Old Town Hall, the Beethoven monument, the Post Tower and cherry trees
// in blossom), drawn once whatever the window's width. The title sits on a
// pennant in the city colours, red with yellow trim. Along the bottom runs the
// Rhine: a promenade, rolling water with a wavy lower edge that repeats as the
// window widens, embankment piers at the corners and the Kennedy Bridge in the
// middle. Widgets are a cherry blossom (close), a red-over-yellow badge (zoom)
// and a Rhine wave (collapse), all clickable on the web through the pressed
// strip (cicn -14330). Document bodies are cream with faint blossom petals;
// dialogs and palettes have a faint Altstadt cobblestone.
// Original art; no photos, coat of arms or logos.
//
// Build:   npm run author -- authoring/schemes/bonn
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   frames.mjs      window types (frameLayout) and the frame painter
//   skyline.mjs     the skyline, the utility motif, the dialog/alert ornaments
//   widgets.mjs     close / zoom / collapse art and the pressed strip
//   controls.mjs    push buttons, default ring, checkboxes, radios
//   scrollbars.mjs  scroll bars, thumbs, ghosts, little arrows
//   patterns.mjs    blossom document body, cobblestone utility body, Rhine desktop, Finder colours
//   families.mjs    sliders, tabs + panes, bevel buttons, popup pieces (recoloured Halcyon)
//   progress.mjs    progress bar + barber pole, list headers, disclosure, grow boxes (recoloured Halcyon)
//   quantize.mjs    fitPalette: keeps big smooth frames under the 256-colour cicn limit
//
// Not themed (falls back): menus and the menu bar, the scheme's picker icon,
// popup / side-floating / no-title utility windows, text fields (CSS on the web).
import { encodeCicn, encodeWnd, encodeColr, encodeVers, stripLayout } from '../../../tools/theme-author/index.js';
import { windowTypes, paintFrame } from './frames.mjs';
import { pressedStrip } from './widgets.mjs';

const PARTS = ['controls', 'scrollbars', 'patterns', 'families', 'progress'];

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

  let activeDoc = null;
  for (const t of windowTypes()) {
    const active = paintFrame(t, 'active');
    if (t.id === -14336) activeDoc = { frame: active, layout: t.layout };
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t, 'inactive')), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(active), `Active ${t.name}`);
  }

  // Pressed widgets (R24): one strip, close | zoom | collapse, from the
  // document window's rects. The utility window has a close box only, at the
  // same size, so its close piece is the same x = 0 column.
  add('cicn', -14330, encodeCicn(pressedStrip(stripLayout(activeDoc.layout), activeDoc.frame)), 'Pressed Widgets');

  // BONN_PARTS=controls,scrollbars builds only some families while you work on one.
  const only = process.env.BONN_PARTS?.split(',');
  for (const part of PARTS) {
    if (only && !only.includes(part)) continue;
    const mod = await import(`./${part}.mjs`);
    mod.build(addFrom(`${part}.mjs`));
  }
  return { resources };
}
