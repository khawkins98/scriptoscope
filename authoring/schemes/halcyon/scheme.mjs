// Halcyon — an original first-party Kaleidoscope scheme, authored in code.
//
// Look: a light, frosted 2020s desktop. Soft vertical gradient title bars,
// large rounded corners, a hairline border, slate glyph buttons and one
// kingfisher-teal accent. It deliberately avoids copying any shipping OS
// (no traffic-light buttons, no Apple artwork or names).
//
// Build:   npm run author -- authoring/schemes/halcyon
// Guide:   docs/authoring-a-scheme.md walks through this file section by section.
//
// Everything here is ordinary code. Change a colour or a size, rebuild, and
// drop the new scheme.rsrc onto the showcase page to see it.

import {
  Raster, verticalGradient, windowLayout,
  encodeCicn, encodeWnd, encodeCinf, encodeColr, encodeVers,
} from '../../../tools/theme-author/index.js';

// ── 1. Palette ────────────────────────────────────────────────────────────
// Colours are what you want to see on screen (sRGB). The encoder handles the
// classic-Mac gamma difference for you.
const C = {
  accent: '#1689a8',
  accentPressed: '#0f6a83',
  body: '#ffffff',
  active: {
    barTop: '#fbfcfe', barBottom: '#e6ebf2', highlight: '#ffffff',
    separator: '#d2d8e1', border: '#97a2b2', title: '#1d2430',
    glyph: '#4a5566', buttonTop: '#ffffff', buttonBottom: '#e2e7ee', buttonEdge: '#8d98a8',
  },
  inactive: {
    barTop: '#f6f7f9', barBottom: '#f6f7f9', highlight: '#fbfbfc',
    separator: '#e3e6ea', border: '#c4c9d0', title: '#9aa1ab',
    glyph: null, buttonTop: '#eef0f3', buttonBottom: '#eef0f3', buttonEdge: '#d0d4da',
  },
};

// ── 2. Window frames ──────────────────────────────────────────────────────
// Each window type is described once with windowLayout(); the same numbers
// drive both the art (paintFrame) and the wnd# recipe.

/** A round glyph button, `size` px across. */
function glyphButton(size, state, glyph, accent = false) {
  const p = C[state];
  const r = new Raster(size, size);
  const top = accent && state === 'active' ? C.accent : p.buttonTop;
  const bottom = accent && state === 'active' ? C.accent : p.buttonBottom;
  r.fillRect(0, 0, size, size, verticalGradient(0, size, [[0, top], [1, bottom]]));
  r.clipRounded(0, 0, size, size, size / 2);
  r.outlineEdges(0, 0, size, size, accent && state === 'active' ? C.accentPressed : p.buttonEdge);
  if (!p.glyph) return r; // inactive windows show plain buttons, like most desktops do
  const ink = accent ? '#ffffff' : p.glyph;
  const m = Math.floor(size / 2), a = Math.round(size * 0.3), b = size - 1 - a;
  if (glyph === 'close') for (let i = a; i <= b; i++) { r.set(i, i, ink); r.set(size - 1 - i, i, ink); }
  if (glyph === 'collapse' || glyph === 'zoom') r.hline(a, m, b - a + 1, ink);
  if (glyph === 'zoom') r.vline(m, a, b - a + 1, ink);
  return r;
}

/**
 * Paint one frame image for `layout` in `state` ('active' | 'inactive').
 * Order matters: fill, round the corners, outline, then punch the content hole.
 */
function paintFrame(layout, state, { radiusTop, radiusBottom, widgets = {} }) {
  const p = C[state];
  const { width: W, height: H, top: T, content } = layout;
  const r = new Raster(W, H);
  const shapeH = layout.bottom === 0 ? T : H; // collapsed: only the bar is visible

  r.fillRect(0, 0, W, shapeH, C.body);
  if (layout.titled) {
    r.fillRect(0, 0, W, T, verticalGradient(0, T, [[0, p.barTop], [1, p.barBottom]]));
    r.hline(1, 1, W - 2, p.highlight);                 // a 1px sheen under the top edge
    if (layout.bottom > 0) r.hline(0, T - 1, W, p.separator); // bar / content divider
  }
  r.clipRounded(0, 0, W, shapeH, radiusTop, ['tl', 'tr']);
  r.clipRounded(0, 0, W, shapeH, layout.bottom === 0 ? radiusTop : radiusBottom, ['bl', 'br']);
  r.outlineEdges(0, 0, W, shapeH, p.border);

  // The content area is a hole: the page's own DOM shows through it.
  r.fillRect(content.left, content.top, content.right - content.left, content.bottom - content.top, null);

  // Hidden swatches: the engine reads the title colour from the content
  // rectangle's top-left pixel, and a drop shadow colour from the pixel to its
  // right. Same colour on both = no shadow.
  r.swatch(content.left, content.top, p.title);
  r.swatch(content.left + 1, content.top, p.title);

  for (const [kind, box] of Object.entries(widgets)) {
    r.blit(glyphButton(box.w, state, kind, kind === 'close'), box.x, box.y);
  }
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
function windowTypes() {
  const doc = (collapsed) => {
    const T = 22, L = 30, R = 48, s = 12, y = 5;
    const zoomX = L + 3 + 8;
    return {
      layout: windowLayout({
        titleBar: T, leftFixed: L, rightFixed: R, bottom: 6, collapsed,
        widgets: { close: { x: 10, y, w: s, h: s }, zoom: { x: zoomX, y, w: s, h: s }, collapse: { x: zoomX + 18, y, w: s, h: s } },
      }),
      art: { radiusTop: 9, radiusBottom: 7 },
    };
  };
  const utility = (collapsed) => {
    const T = 16, L = 20, R = 22, s = 10, y = 3;
    return {
      layout: windowLayout({
        titleBar: T, leftFixed: L, rightFixed: R, bottom: 4, collapsed,
        widgets: { close: { x: 6, y, w: s, h: s }, collapse: { x: L + 3 + 5, y, w: s, h: s } },
      }),
      art: { radiusTop: 6, radiusBottom: 5 },
    };
  };
  const modal = () => ({
    layout: windowLayout({ titleBar: 22, leftFixed: 12, rightFixed: 12, bottom: 8 }),
    art: { radiusTop: 9, radiusBottom: 9 },
  });
  const plain = () => ({
    layout: windowLayout({ titleBar: 0, leftFixed: 12, rightFixed: 12, top: 10, bottom: 10 }),
    art: { radiusTop: 10, radiusBottom: 10 },
  });
  return [
    { id: -14336, name: 'Document Window', ...doc(false) },
    { id: -14332, name: 'Collapsed Document Window', ...doc(true) },
    { id: -14328, name: 'Dialog', ...plain() },
    { id: -14326, name: 'Alert', ...plain() },
    { id: -14324, name: 'Movable Modal', ...modal() },
    { id: -14322, name: 'Movable Alert', ...modal() },
    { id: -14304, name: 'Titled Utility Window', ...utility(false) },
    { id: -14300, name: 'Collapsed Titled Utility Window', ...utility(true) },
  ];
}

function widgetBoxes(wnd) {
  const box = (part) => {
    const r = wnd.rectangles.find((x) => x.part === part)?.rect;
    return r && r.right > r.left ? { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top } : null;
  };
  return Object.fromEntries([['close', box(1)], ['zoom', box(2)], ['collapse', box(3)]].filter(([, b]) => b));
}

// ── 3. Push buttons ───────────────────────────────────────────────────────
// Three faces (inactive -10240, normal -10239, pressed -10238), each with a
// same-id cinf. Without that cinf the runtime ignores the face entirely.
//
// The engine copies the four c×c corners 1:1, stretches the s-thick edges,
// and fills the middle with ONE colour read at the cinf's bgPixel. So a face
// is a rounded outline around a flat colour; gradients would be lost.
const BUTTON = { size: 20, corner: 6, side: 1, radius: 5 };

function pushFace({ face, edge, text }) {
  const { size } = BUTTON;
  const r = new Raster(size, size).fillRect(0, 0, size, size, face);
  r.clipRounded(0, 0, size, size, BUTTON.radius).outlineEdges(0, 0, size, size, edge);
  r.swatch(0, 1, text); // hidden: a transparent corner pixel carries the label colour
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BUTTON.corner, sideThickness: BUTTON.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: 0, y: 1 }, embossPixel: { x: 0, y: 0 }, // (0,0) = no emboss
});

// Default-button ring: drawn 4px outside the face, AFTER it, with its corners
// copied 1:1. So everything inside the accent line must be transparent, or the
// ring's corners paint over the face's corners. The 2px gap and the face
// share one centre (9, 9), so the curves stay parallel.
function ringFace(color) {
  const size = 24;
  return new Raster(size, size)
    .fillRoundRect(0, 0, size, size, 9, color)
    .fillRoundRect(2, 2, size - 4, size - 4, 7, null);
}

const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 12, y: 12 }, textPixel: { x: 12, y: 12 }, embossPixel: { x: 0, y: 0 },
});

// ── 4. Checkboxes and radio buttons ───────────────────────────────────────
// id = -9504 + 12·kind + 3·value + tier
//   kind  0 checkbox, 1 radio      value 0 off, 1 on, 2 mixed
//   tier  0 disabled, 1 normal, 2 pressed
const CHECK = 14;

function checkable(kind, value, tier) {
  const on = value > 0;
  const disabled = tier === 0, pressed = tier === 2;
  const fill = !on ? (pressed ? '#e3e8ef' : '#ffffff') : disabled ? '#b9c7cf' : pressed ? C.accentPressed : C.accent;
  const edge = disabled ? '#d0d4da' : on ? (pressed ? '#0b5568' : C.accentPressed) : pressed ? '#6f7b8c' : '#8d98a8';
  const r = new Raster(CHECK, CHECK).fillRect(0, 0, CHECK, CHECK, fill);
  r.clipRounded(0, 0, CHECK, CHECK, kind === 0 ? 4 : CHECK / 2).outlineEdges(0, 0, CHECK, CHECK, edge);
  if (!on) return r;
  const ink = disabled ? '#f4f6f8' : '#ffffff';
  if (value === 2) return r.fillRect(4, 6, 6, 2, ink); // mixed: a dash
  if (kind === 1) return r.fillRect(5, 5, 4, 4, ink).set(5, 5, fill).set(8, 5, fill).set(5, 8, fill).set(8, 8, fill);
  return r.sprite(3, 3, [
    '.......#',
    '......##',
    '#....##.',
    '##..##..',
    '.####...',
    '..##....',
  ], { '#': ink });
}

// ── 5. Assemble ───────────────────────────────────────────────────────────
export function buildScheme() {
  const resources = [];
  const add = (type, id, data, name) => resources.push({ type, id, data, ...(name ? { name } : {}) });

  add('vers', 1, encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Halcyon (Scriptoscope authoring proof of concept)' }));
  add('Colr', 129, encodeColr());

  for (const t of windowTypes()) {
    const art = { ...t.art, widgets: widgetBoxes(t.layout.wnd) };
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t.layout, 'inactive', art)), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(paintFrame(t.layout, 'active', art)), `Active ${t.name}`);
  }

  const faces = [
    [-10240, 'Inactive Push Button', { face: '#f5f6f8', edge: '#d0d5dc', text: '#a3aab4' }],
    [-10239, 'Push Button', { face: '#ffffff', edge: '#97a2b2', text: '#1d2430' }],
    [-10238, 'Pressed Push Button', { face: '#dde4ec', edge: '#7d8899', text: '#1d2430' }],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace('#c4ced6')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(C.accent)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)),
      `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
  return { resources };
}
