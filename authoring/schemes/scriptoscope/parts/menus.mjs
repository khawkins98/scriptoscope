import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../../tools/theme-author/encode-icons.js';
import { encodeClut, encodeHeaderClut } from '../../../../tools/theme-author/encode-clut.js';
import { C } from '../palette.mjs';

const M = {
  bar: C.paper,
  barSheen: C.white,
  barLine: C.shade,
  barText: C.text,
  menuBody: C.white,
  menuEdge: C.outline,
  menuText: C.text,
  divider: C.shade,
  grip: C.deep,
  gripLight: C.white,
};
const MENU_BAR = 20; // the System 7 / Mac OS 8 menu bar height

/**
 * Split a face drawn at its smallest size (2c × 2c) open by two middle rows
 * and columns, so the cinf's corners are the art's c×c corners and the edge
 * bands repeat the art's last corner column/row. Returns the (2c+2)² source.
 */
function opened(art, c) {
  const W = art.width + 2,
    H = art.height + 2;
  const from = (v) => (v < c ? v : v < c + 2 ? c - 1 : v - 2);
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (from(y) * art.width + from(x)) * 4;
      r.rgba.set(art.rgba.subarray(i, i + 4), (y * W + x) * 4);
    }
  return r;
}

/** A same-id cinf for an `opened` face: fill and text sampled in the middle. */
function faceCinf(c, s, { fill = { x: c, y: c }, text = { x: c + 1, y: c } } = {}) {
  return encodeCinf({
    cornerSize: c,
    sideThickness: s,
    tileSides: 0,
    patternAnchor: 0,
    bgPatternId: 0,
    bgPixel: fill,
    textPixel: text,
    embossPixel: { x: 0, y: 0 },
  });
}

/** Write the middle samples (the middle is filled, never copied, so they never show). */
function samples(r, c, fill, text) {
  r.set(c, c, fill)
    .set(c + 1, c, text)
    .set(c, c + 1, fill)
    .set(c + 1, c + 1, fill);
  return r;
}

// ── Menu bar ──────────────────────────────────────────────────────────────
// c = s = 10 on a 20 px bar: the whole bar is corners and top/bottom bands, so
const BAR_C = MENU_BAR / 2;

function barArt(width) {
  const r = new Raster(width, MENU_BAR);
  r.fillRect(0, 0, width, MENU_BAR - 1, M.bar).hline(0, 0, width, M.barSheen);
  r.hline(0, MENU_BAR - 1, width, M.barLine);
  return r;
}

function menuBarFace() {
  return samples(opened(barArt(2 * BAR_C), BAR_C), BAR_C, M.bar, M.barText);
}

/** Selected menu title: an accent pill on the bar, white text. */
function menuBarSelected(fill, edge) {
  const r = barArt(2 * BAR_C);
  void edge;
  r.fillRect(0, 1, 2 * BAR_C, MENU_BAR - 2, fill);
  return samples(opened(r, BAR_C), BAR_C, fill, '#ffffff');
}

/** Application menu grabber (Mac OS 8 application switcher), 6×20. */
function grabber(pressed) {
  const r = barArt(6);
  if (pressed) r.fillRect(0, 1, 6, MENU_BAR - 2, C.accent);
  for (let y = 5; y <= 14; y += 3) {
    r.set(2, y, pressed ? C.white : M.grip).set(3, y, pressed ? C.white : M.grip);
    r.set(3, y + 1, pressed ? C.accentDeep : M.gripLight);
  }
  return r;
}

// ── Pull-down and solo menus ──────────────────────────────────────────────
// The background face carries the 1 px frame (it is drawn 1 px outside the
// items). Pull-downs hang square from the bar and round their bottom corners;
// solo (pop-up / contextual) menus round all four.
const MENU_C = 4,
  MENU_S = 1;

function menuBackground(corners) {
  const n = 2 * MENU_C;
  const art = new Raster(n, n);
  art.fillRect(0, 0, n, n, M.menuBody);
  const cut = { tl: [0, 0, 1, 1], tr: [n - 1, 0, -1, 1], bl: [0, n - 1, 1, -1], br: [n - 1, n - 1, -1, -1] };
  for (const k of corners) {
    const [x, y, dx, dy] = cut[k];
    art
      .set(x, y, null)
      .set(x + dx, y, null)
      .set(x, y + dy, null);
  }
  art.outlineEdges(0, 0, n, n, M.menuEdge);
  return samples(opened(art, MENU_C), MENU_C, M.menuBody, M.menuText);
}

// Selected item: an accent pill inside the item rectangle, on the menu body.
const ITEM_C = 6;
function menuSelected() {
  const n = 2 * ITEM_C;
  const art = new Raster(n, n).fillRect(0, 0, n, n, C.accent);
  return samples(opened(art, ITEM_C), ITEM_C, C.accent, '#ffffff');
}

// Divider: a hairline with 4 px margins, drawn at its own 2 px height.
const DIV_C = 6;
function divider() {
  const W = 2 * DIV_C + 2,
    r = new Raster(W, 2).fillRect(0, 0, W, 2, M.menuBody);
  r.hline(4, 0, W - 8, M.divider);
  return r;
}
const dividerCinf = () =>
  encodeCinf({
    cornerSize: DIV_C,
    sideThickness: 1,
    tileSides: 0,
    patternAnchor: 0,
    bgPatternId: 0,
    bgPixel: { x: 0, y: 0 },
    textPixel: { x: 0, y: 0 },
    embossPixel: { x: 0, y: 0 },
  });

// ── Desktop pattern ───────────────────────────────────────────────────────
// Solid neutral uses one exact stored system-palette entry.
function desktopPattern() {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, '#cccccc');
}

// ── Finder colours ────────────────────────────────────────────────────────
// 8×8 swatch cicns read by the cinf: fill at bgPixel (3,3), text at (1,1)
// (the Windows 95 scheme's layout). These alone do NOT enable the control
// panel's "Finder Colors" option on 7.5.5 (Apple Lisa ships all five and it
// stays greyed too); what does is not decoded yet.
function finderSwatch(fill, text) {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, fill).set(1, 1, text);
}
const finderCinf = () =>
  encodeCinf({
    cornerSize: 0,
    sideThickness: 0,
    tileSides: 0,
    patternAnchor: 0,
    bgPatternId: 42,
    bgPixel: { x: 3, y: 3 },
    textPixel: { x: 1, y: 1 },
    embossPixel: { x: 0, y: 0 },
  });

// Original picker icon: six site-mark tiles, rotated -8 degrees with binary masks.
export function schemeIcon(size) {
  const r = new Raster(size, size),
    scale = size / 32,
    angle = (8 * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  // site-shell.css: 21px square, three columns/two rows, 2px gaps.
  const width = (21 - 4) / 3, height = (21 - 2) / 2;
  const stepX = width + 2, stepY = height + 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / scale,
        dy = (y + 0.5 - size / 2) / scale;
      const u = dx * cos - dy * sin + 10.5,
        v = dx * sin + dy * cos + 10.5;
      const col = Math.floor(u / stepX),
        row = Math.floor(v / stepY);
      if (u >= 0 && u < 21 && v >= 0 && v < 21 && u % stepX < width && v % stepY < height)
        r.set(x, y, C.mark[row * 3 + col]);
    }
  return r;
}

export function build(add, { C }) {
  // Menu bar and its titles.
  const bar = menuBarFace();
  add('cicn', -12240, encodeCicn(bar), 'Menu Bar Background');
  add('cinf', -12240, faceCinf(BAR_C, BAR_C), 'Menu Bar Background');
  add('cicn', -12239, encodeCicn(bar), 'Menu Bar Item');
  add('cinf', -12239, faceCinf(BAR_C, BAR_C), 'Menu Bar Item');
  add('cicn', -12238, encodeCicn(menuBarSelected(C.accent, C.accentPressed)), 'Selected Menu Bar Item');
  add('cinf', -12238, faceCinf(BAR_C, BAR_C), 'Selected Menu Bar Item');

  // Pull-down menus.
  add('cicn', -12237, encodeCicn(menuBackground(['bl', 'br'])), 'Pull Down Menu Background');
  add('cinf', -12237, faceCinf(MENU_C, MENU_S), 'Pull Down Menu Background');
  const selected = encodeCicn(menuSelected());
  add('cicn', -12236, selected, 'Selected Menu Item');
  add('cinf', -12236, faceCinf(ITEM_C, ITEM_C), 'Selected Menu Item');
  const div = encodeCicn(divider());
  add('cicn', -12235, div, 'Divider Line');
  add('cinf', -12235, dividerCinf(), 'Divider Line');

  // Solo (pop-up / contextual) menus.
  add('cicn', -12234, encodeCicn(menuBackground(['tl', 'tr', 'bl', 'br'])), 'Solo Menu Background');
  add('cinf', -12234, faceCinf(MENU_C, MENU_S), 'Solo Menu Background');
  add('cicn', -12233, selected, 'Selected Solo Menu Item');
  add('cinf', -12233, faceCinf(ITEM_C, ITEM_C), 'Selected Solo Menu Item');
  add('cicn', -12232, div, 'Solo Menu Divider Line');
  add('cinf', -12232, dividerCinf(), 'Solo Menu Divider Line');

  add('cicn', -12231, encodeCicn(grabber(false)), 'Application Menu Grabber');
  add('cicn', -12230, encodeCicn(grabber(true)), 'Pressed Application Menu Grabber');

  // Patterns.
  add('ppat', 17, encodePpat(desktopPattern(), { gamma: false }), 'Desktop Pattern');
  add('ppat', 42, encodePpat(new Raster(8, 8).fillRect(0, 0, 8, 8, C.body)), 'Utility Pattern');

  // Finder colours.
  const finder = [
    [-9552, 'Desktop Text Color And Background', C.white, C.text],
    [-9551, 'Icon View Background', C.body, C.text],
    [-9550, 'List View Background', C.body, C.text],
    [-9549, 'List View Sort Color', C.paper, C.text],
    [-9548, 'List View Divider Line', C.shade, C.text],
  ];
  for (const [id, name, fill, text] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(), name);
  }

  // Header colour tables (part codes: frame, fill, text, tinges, bevels).
  const A = C.active,
    I = C.inactive;
  add(
    'clut',
    -14336,
    encodeHeaderClut({
      frame: C.ink,
      fill: C.paper,
      text: A.title,
      lightTinge: C.white,
      darkTinge: C.shade,
      lightBevel: C.white,
      darkBevel: C.shade,
    }),
    'Active Header',
  );
  add(
    'clut',
    -14335,
    encodeHeaderClut({
      frame: C.deep,
      fill: C.paper,
      text: I.title,
      lightTinge: C.white,
      darkTinge: C.shade,
      lightBevel: C.white,
      darkBevel: C.shade,
    }),
    'Inactive Header',
  );
  const ramp = [C.white, C.paper, C.shade, C.accentLight, C.deep, C.accent, C.accentDeep, C.ink];
  add('clut', 300, encodeClut(ramp.map((color, value) => ({ value, color }))), 'Slider & Focus Ring Colors');

  // The icon Kaleidoscope's scheme picker shows.
  for (const res of encodeIconFamily(-16455, {
    large: schemeIcon(32),
    small: schemeIcon(16),
    name: 'Kaleidoscope Scheme Icon',
    dither4: false,
  })) {
    add(res.type, res.id, res.data, res.name);
  }
}
