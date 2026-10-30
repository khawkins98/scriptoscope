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
  Raster, verticalGradient, ditheredGradient, windowLayout,
  encodeCicn, encodeWnd, encodeCinf, encodeColr, encodeVers,
} from '../../../tools/theme-author/index.js';

// ── 1. Palette ────────────────────────────────────────────────────────────
// Every colour lives in palette.mjs, shared with the control families in parts/.
import { C } from './palette.mjs';

// ── 2. Window frames ──────────────────────────────────────────────────────
// Each window type is described once with windowLayout(); the same numbers
// drive both the art (paintFrame) and the wnd# recipe.

/**
 * Draw a round title-bar button straight onto the frame, so its smooth edge
 * blends with the real title-bar pixels underneath (a separate raster blitted
 * on top would have nothing to blend with).
 */
function drawGlyphButton(r, { x, y, w: size }, state, glyph, accent = false) {
  const p = C[state];
  const lit = accent && state === 'active';
  const cx = x + size / 2, cy = y + size / 2;
  r.fillCircleSmooth(cx, cy, size / 2, lit ? C.accentPressed : p.buttonEdge);
  r.fillCircleSmooth(cx, cy, size / 2 - 1,
    verticalGradient(y, size, [[0, lit ? C.accent : p.buttonTop], [1, lit ? C.accent : p.buttonBottom]]));
  if (!p.glyph) return; // inactive windows show plain buttons, like most desktops do
  const ink = lit ? '#ffffff' : p.glyph;
  const a = size * 0.32, b = size - size * 0.32; // glyph box inside the button
  const stroke = (x0, y0, x1, y1) => r.strokeLineSmooth(x + x0, y + y0, x + x1, y + y1, 1.25, ink);
  if (glyph === 'close') { stroke(a, a, b, b); stroke(b, a, a, b); }
  if (glyph === 'collapse' || glyph === 'zoom') stroke(a, size / 2, b, size / 2);
  if (glyph === 'zoom') stroke(size / 2, a, size / 2, b);
}

/**
 * Paint one frame image for `layout` in `state` ('active' | 'inactive').
 * Order matters: fill, round the corners, outline, smooth the inside of the
 * outline, add the bar details, punch the content hole, then the widgets.
 */
function paintFrame(layout, state, { radiusTop, radiusBottom, widgets = {} }) {
  const p = C[state];
  const { width: W, height: H, top: T, content } = layout;
  const r = new Raster(W, H);
  const shapeH = layout.bottom === 0 ? T : H; // collapsed: only the bar is visible
  const bar = verticalGradient(0, T, [[0, p.barTop], [1, p.barBottom]]);
  const surface = (x, y) => (layout.titled && y < T ? bar(x, y) : C.body);
  const bottomRadius = layout.bottom === 0 ? radiusTop : radiusBottom;

  // The outer edge stays hard: the window can sit on any background, so there
  // is no colour to blend it with.
  r.fillRect(0, 0, W, shapeH, surface);
  r.clipRounded(0, 0, W, shapeH, radiusTop, ['tl', 'tr']);
  r.clipRounded(0, 0, W, shapeH, bottomRadius, ['bl', 'br']);
  r.outlineEdges(0, 0, W, shapeH, p.border);
  // The inner edge of the outline can be smooth: repaint the surface 1px in,
  // blended over the outline. Each half is drawn with its own corner radius.
  const inner = (y, h, rad, corners) => r.paintCoverage(1, y, W - 2, h, (px, py) => {
    const top = corners === 'top';
    const cy = top ? 1 + (rad - 1) : shapeH - 1 - (rad - 1);
    const dx = Math.max(Math.abs(px - W / 2) - (W / 2 - 1 - (rad - 1)), 0);
    const dy = top ? Math.max(cy - py, 0) : Math.max(py - cy, 0);
    return dx * dx + dy * dy <= (rad - 1) ** 2;
  }, surface);
  inner(1, Math.ceil(shapeH / 2) - 1, radiusTop, 'top');
  inner(Math.ceil(shapeH / 2), shapeH - 1 - Math.ceil(shapeH / 2), bottomRadius, 'bottom');

  if (layout.titled) {
    r.hline(radiusTop, 1, W - 2 * radiusTop, p.highlight);               // a 1px sheen under the top edge
    if (layout.bottom > 0) r.hline(1, T - 1, W - 2, p.separator);      // bar / content divider
  }

  // The content area is a hole: the page's own DOM shows through it.
  r.fillRect(content.left, content.top, content.right - content.left, content.bottom - content.top, null);

  // Hidden swatches: the engine reads the title colour from the content
  // rectangle's top-left pixel, and a drop shadow colour from the pixel to its
  // right. Same colour on both = no shadow.
  r.swatch(content.left, content.top, p.title);
  r.swatch(content.left + 1, content.top, p.title);

  for (const [kind, box] of Object.entries(widgets)) drawGlyphButton(r, box, state, kind, kind === 'close');
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
  const { size, radius } = BUTTON;
  // Smooth corners: the outer edge blends with the window body (the colour a
  // button normally sits on), the inner edge with the outline.
  const r = new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, radius, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, radius - 1, face);
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
    .fillRoundRectSmooth(0, 0, size, size, 9, color, { matte: C.body }) // smooth outside
    .fillRoundRect(2, 2, size - 4, size - 4, 7, null);                  // hard, fully transparent inside
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
  const radius = kind === 0 ? 4 : CHECK / 2;
  // Outer edge blends with the window body; inner edges blend with what's under them.
  const r = new Raster(CHECK, CHECK)
    .fillRoundRectSmooth(0, 0, CHECK, CHECK, radius, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, CHECK - 2, CHECK - 2, radius - 1, fill);
  if (!on) return r;
  const ink = disabled ? '#f4f6f8' : '#ffffff';
  if (value === 2) return r.strokeLineSmooth(4.25, 7, 9.75, 7, 2, ink);   // mixed: a dash
  if (kind === 1) return r.fillCircleSmooth(7, 7, 2.4, ink);               // radio: a dot
  return r.strokeLineSmooth(3.6, 7.2, 6, 9.6, 1.7, ink)                   // checkmark
    .strokeLineSmooth(6, 9.6, 10.6, 4.4, 1.7, ink);
}

// ── 5. Assemble ───────────────────────────────────────────────────────────
export async function buildScheme() {
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
  // ── 6. Control families (parts/*.mjs) ──
  // Each file exports `build(add, { C })` and adds its own resources. They are
  // loaded in name order. HALCYON_PARTS=scrollbars,menus builds only those
  // (handy while working on one family); unset builds all of them.
  for (const part of await loadParts()) part.build(add, { C });
  return { resources };
}

async function loadParts() {
  const { readdirSync } = await import('node:fs');
  const only = process.env.HALCYON_PARTS?.split(',').map((x) => x.trim()).filter(Boolean);
  const files = readdirSync(new URL('./parts/', import.meta.url))
    .filter((f) => f.endsWith('.mjs') && (!only || only.includes(f.replace(/\.mjs$/, ''))))
    .sort();
  return Promise.all(files.map((f) => import(new URL(`./parts/${f}`, import.meta.url).href)));
}
