// The concept's stepped silhouette and nested brass rails live in fixed corners;
// title growers repeat only enamel and the recessed plaque's horizontal bands.
import {
  Raster, mix, frameLayout, stripLayout, pressedStripFrom, encodeCicn, encodeWnd,
} from '../../../../tools/theme-author/index.js';
import { C } from '../palette.mjs';
import { schemeIcon } from './menus.mjs';

const TOP = 36, SIDE = 8, BOTTOM = 14, WIDGET = 20;

export function windowTypes() {
  const make = (id, name, titled = true, collapsed = false, widgets = false, compact = false) => {
    // The finished concept needs room around its mark and controls. Utilities
    // keep a compact allocation so their short titles still fit small palettes.
    const maker = compact ? 32 : 46;
    const close = compact ? 26 : 32;
    const right = compact ? 48 : 66;
    const bar = (name, code) => ({ name, code, w: 8 });
    const top = titled ? [
      { name: 'maker', code: 1, w: maker }, { name: 'close', code: 1, w: close },
      bar('growL', 11), { name: 'capL', code: 6, w: 5 },
      { name: 'plate', code: 5, w: 1 }, { name: 'capR', code: 6, w: 5 },
      bar('growR', 8), { name: 'right', code: 1, w: right },
    ] : [
      { name: 'maker', code: 1, w: SIDE },
      { name: 'plainGrow', code: 8, w: 117, uniform: true },
      { name: 'right', code: 1, w: SIDE },
    ];
    const width = top.reduce((sum, cell) => sum + cell.w, 0);
    const layout = frameLayout({
      topH: titled ? TOP : SIDE, sideL: SIDE, sideR: SIDE, bottomH: BOTTOM,
      collapsed, top,
      bottom: [
        { name: 'bottomL', code: 1, w: SIDE }, { name: 'ticks', code: 8, w: 16 },
        { name: 'unused', code: 0, w: width - SIDE - 16 - 18 },
        { name: 'bottomR', code: 1, w: 18 },
      ],
      left: [{ name: 'sideL', code: 8, w: 1, uniform: true }],
      right: [{ name: 'sideR', code: 8, w: 1, uniform: true }],
      ...(titled ? { title: { cell: 'plate', top: 8, bottom: 29 } } : {}),
      widgets: widgets ? {
        close: { x: maker + 3, y: 8, w: WIDGET, h: WIDGET },
        zoom: { x: width - (compact ? 44 : 58), y: 8, w: WIDGET, h: WIDGET },
        collapse: { x: width - (compact ? 22 : 32), y: 8, w: WIDGET, h: WIDGET },
      } : {},
    });
    return { id, name, layout, compact };
  };
  return [
    make(-14336, 'Document Window', true, false, true),
    make(-14332, 'Collapsed Document Window', true, true, true),
    make(-14328, 'Dialog', false), make(-14326, 'Alert', false),
    make(-14324, 'Movable Modal'), make(-14322, 'Movable Alert'),
    make(-14304, 'Titled Utility Window', true, false, true, true),
    make(-14300, 'Collapsed Titled Utility Window', true, true, true, true),
  ];
}

// A binary chamfer, not a round-rect or an opaque rectangular background.
function chamfer(r, x, y, w, h, cut, color) {
  for (let row = 0; row < h; row++) {
    const inset = Math.max(0, cut - Math.min(row, h - 1 - row));
    r.hline(x + inset, y + row, w - 2 * inset, color);
  }
}

export function drawWidget(r, box, state, role, pressed = false) {
  const p = C[state], { x, y, w, h } = box;
  chamfer(r, x, y, w, h, 1, C.border);
  r.fillRect(x + 1, y + 1, w - 2, h - 2, p.inlay);
  r.fillRect(x + 2, y + 2, w - 4, h - 4, pressed ? C.enamel : p.plate);
  r.hline(x + 2, y + 2, w - 4, pressed ? C.border : C.white);
  r.vline(x + 2, y + 2, h - 4, pressed ? C.border : C.white);
  r.hline(x + 2, y + h - 3, w - 4, pressed ? p.inlay : C.deep);
  r.vline(x + w - 3, y + 2, h - 4, pressed ? p.inlay : C.deep);
  const ink = pressed ? C.paper : state === 'active' ? C.ink : C.textOff;
  const glyph = {
    close: ['##.....##', '.##...##.', '..##.##..', '...###...', '....#....', '...###...', '..##.##..', '.##...##.', '##.....##'],
    zoom: ['#########', '#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'],
    collapse: ['.........', '.........', '.........', '.........', '#########', '#########', '.........', '.........', '.........'],
  }[role];
  r.sprite(x + 5, y + 5, glyph, { '#': ink });
}

export function paintFrame(t, state) {
  const l = t.layout, p = C[state], A = l.content;
  const r = new Raster(l.width, l.height);
  const height = l.collapsed ? l.top : l.height;
  // Follow the same chamfer through every layer: dark outline, pale outer
  // bevel, enamel separator, brass inlay, then the broad charcoal rail.
  for (const [inset, cut, color] of [
    [0, 4, C.border], [1, 4, p.rim], [2, 3, p.frame],
    [3, 3, p.inlay], [4, 2, p.frame],
  ]) chamfer(r, inset, inset, l.width - 2 * inset, height - 2 * inset, cut, color);

  if (l.titled) {
    // Very low-contrast 8px enamel grain; the flat title rows remain uniform.
    for (let y = 4; y < TOP - 4; y++) {
      for (let x = 4; x < l.width - 4; x++) {
        if ((x + 3 * y) % 8 === 0) r.set(x, y, state === 'active' ? C.enamelGrain : '#353535');
      }
    }
    const x = l.named('growL').x0, w = l.named('growR').x1 - x;
    r.fillRect(x, 7, w, 23, p.inlay).fillRect(x, 8, w, 21, p.plate);
    r.hline(x, 8, w, C.shade).hline(x, 28, w, state === 'active' ? C.white : p.rule);
    // Vertical plaque edges sit in fixed neighbors, never in a repeating cell.
    r.vline(x - 1, 7, 23, p.rim).vline(x + w, 7, 23, p.rim);
    r.vline(x - 2, 6, 25, C.border).vline(x + w + 1, 6, 25, C.border);
    r.hline(x - 1, 6, w + 2, C.border).hline(x - 1, 30, w + 2, C.border);
    const mark = state === 'active' ? C.mark : C.mark.map(color => mix(color, p.rule, 0.6));
    r.blit(schemeIcon(32, mark), t.compact ? 0 : 7, 2);
  }
  if (!l.collapsed) {
    r.strokeRect(A.left - 2, A.top - 2, A.right - A.left + 4, A.bottom - A.top + 4, C.border);
    r.strokeRect(A.left - 1, A.top - 1, A.right - A.left + 2, A.bottom - A.top + 2, p.rim);
    r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
    const tick = l.named('ticks');
    r.vline(tick.x0 + 1, A.bottom + 4, 4, state === 'active' ? C.accentLight : p.rule);
    for (const span of [3, 6, 9]) {
      for (let i = 0; i < span; i++) {
        const x = l.width - 4 - i, y = l.height - 4 - (span - i);
        r.set(x + 1, y + 1, C.border).set(x, y, state === 'active' ? C.accentLight : p.rule);
      }
    }
  }
  for (const [role, box] of Object.entries(l.widgets)) drawWidget(r, box, state, role);
  l.lint(r);
  r.swatch(A.left, A.top, p.title).swatch(A.left + 1, A.top, p.title);
  return r;
}

export function build(add) {
  const types = windowTypes();
  for (const t of types) {
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    for (const state of ['inactive', 'active']) {
      add('cicn', t.id + (state === 'active' ? 1 : 0), encodeCicn(paintFrame(t, state)), `${state} ${t.name}`);
    }
  }
  for (const [id, base] of [[-14330, -14336], [-14298, -14304]]) {
    const t = types.find(t => t.id === base);
    add('cicn', id, encodeCicn(pressedStripFrom({
      strip: stripLayout(t.layout), activeFrame: paintFrame(t, 'active'),
      draw: (role, r, box) => drawWidget(r, box, 'active', role, true), rows: 2,
    })), 'Pressed Window Widgets');
  }
}
