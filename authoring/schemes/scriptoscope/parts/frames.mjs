// Compact enamel frame: fixed maker mark and widgets, uniform title plate,
// One 8px lower-edge calibration period repeats between fixed corners.
import {
  Raster,
  frameLayout,
  stripLayout,
  pressedStripFrom,
  encodeCicn,
  encodeWnd,
} from '../../../../tools/theme-author/index.js';
import { C } from '../palette.mjs';
import { schemeIcon } from './menus.mjs';
const TOP = 36,
  SIDE = 5,
  BOTTOM = 10,
  WIDGET = 18;
export function windowTypes() {
  const make = (id, name, titled = true, collapsed = false, widgets = false) => {
    const top = titled
      ? [
          { name: 'maker', code: 1, w: 32 },
          { name: 'close', code: 1, w: 25 },
          { name: 'growL', code: 11, w: 8, uniform: 'bar' },
          { name: 'capL', code: 6, w: 5 },
          { name: 'plate', code: 5, w: 1 },
          { name: 'capR', code: 6, w: 5 },
          { name: 'growR', code: 8, w: 8, uniform: 'bar' },
          { name: 'right', code: 1, w: 48 },
        ]
      : [
          { name: 'maker', code: 1, w: 5 },
          { name: 'plainGrow', code: 8, w: 117, uniform: true },
          { name: 'right', code: 1, w: 10 },
        ];
    const width = top.reduce((s, c) => s + c.w, 0);
    const bottom = [
      { name: 'bottomL', code: 1, w: 5 },
      { name: 'ticks', code: 8, w: 8 },
      { name: 'unused', code: 0, w: width - 27 },
      { name: 'bottomR', code: 1, w: 14 },
    ];
    const layout = frameLayout({
      topH: titled ? TOP : 5,
      sideL: SIDE,
      sideR: SIDE,
      bottomH: BOTTOM,
      collapsed,
      top,
      bottom,
      left: [{ name: 'sideL', code: 8, w: 1, uniform: true }],
      right: [{ name: 'sideR', code: 8, w: 1, uniform: true }],
      ...(titled ? { title: { cell: 'plate', top: 8, bottom: 29 } } : {}),
      widgets: widgets
        ? {
            close: { x: 35, y: 10, w: WIDGET, h: WIDGET },
            zoom: { x: width - 44, y: 10, w: WIDGET, h: WIDGET },
            collapse: { x: width - 23, y: 10, w: WIDGET, h: WIDGET },
          }
        : {},
    });
    return { id, name, layout };
  };
  return [
    make(-14336, 'Document Window', true, false, true),
    make(-14332, 'Collapsed Document Window', true, true, true),
    make(-14328, 'Dialog', false),
    make(-14326, 'Alert', false),
    make(-14324, 'Movable Modal'),
    make(-14322, 'Movable Alert'),
    make(-14304, 'Titled Utility Window', true, false, true),
    make(-14300, 'Collapsed Titled Utility Window', true, true, true),
  ];
}
export function drawWidget(r, box, state, role, pressed = false) {
  const p = C[state],
    { x, y, w, h } = box;
  r.fillRect(x, y, w, h, pressed ? C.enamel : p.plate).strokeRect(x, y, w, h, C.mutedBrass);
  const ink = pressed ? C.paper : state === 'active' ? C.ink : '#7b7567';
  const glyph = {
    close: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
    zoom: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
    collapse: ['.......', '.......', '.......', '#######', '.......', '.......', '.......'],
  }[role];
  r.sprite(x + 5, y + 5, glyph, { '#': ink });
}
export function paintFrame(t, state) {
  const l = t.layout,
    p = C[state],
    r = new Raster(l.width, l.height),
    A = l.content;
  r.fillRect(0, 0, l.width, l.collapsed ? l.top : l.height, p.frame);
  r.hline(1, 1, l.width - 2, C.enamelHi).hline(2, 2, l.width - 4, p.rule);
  r.vline(1, 2, l.height - 3, C.enamelHi).vline(l.width - 2, 2, l.height - 3, C.enamelHi);
  if (l.titled) {
    const x = l.named('growL').x0,
      w = l.named('growR').x1 - x;
    r.fillRect(x, 8, w, 21, p.plate).hline(x, 7, w, p.rule).hline(x, 29, w, p.rule);
    r.vline(x - 1, 7, 23, p.rule).vline(x + w, 7, 23, p.rule);
    r.blit(schemeIcon(32), 0, 2);
  }
  if (!l.collapsed) {
    r.strokeRect(A.left - 1, A.top - 1, A.right - A.left + 2, A.bottom - A.top + 2, C.mutedBrass);
    r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
    const tick = l.named('ticks');
    r.vline(tick.x0 + 1, A.bottom + 3, 3, state === 'active' ? C.accentLight : p.rule);
    r.hline(2, l.height - 2, l.width - 4, p.rule);
    // Fixed footer hatch stays inside the 10px band; native also has a 16px grow resource.
    const hatchInk = state === 'active' ? C.accentLight : p.rule;
    for (const span of [3, 6, 9]) {
      for (let i = 0; i < span; i++) {
        const y = l.height - 3 - Math.floor((span - i) / 2);
        r.set(l.width - 3 - i, y, hatchInk);
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
    for (const state of ['inactive', 'active'])
      add(
        'cicn',
        t.id + (state === 'active' ? 1 : 0),
        encodeCicn(paintFrame(t, state)),
        `${state} ${t.name}`,
      );
  }
  for (const [id, base] of [
    [-14330, -14336],
    [-14298, -14304],
  ]) {
    const t = types.find((t) => t.id === base);
    add(
      'cicn',
      id,
      encodeCicn(
        pressedStripFrom({
          strip: stripLayout(t.layout),
          activeFrame: paintFrame(t, 'active'),
          draw: (role, r, box) => drawWidget(r, box, 'active', role, true),
          rows: 2,
        }),
      ),
      'Pressed Window Widgets',
    );
  }
}
