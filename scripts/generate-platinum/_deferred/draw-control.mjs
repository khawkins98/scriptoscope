// scripts/generate-platinum/draw-control.mjs
// THE GENERIC CONTROL DRAWER — pure code. Renders any control SPEC
// (control-metrics.mjs) into an { width, height, rgba } buffer using the shared
// Platinum bevel primitives (raster.mjs). One composer per draw `kind`; the spec
// supplies all geometry + color slots. This mirrors AppearanceLib's DrawTheme*:
// a generic drawer applied to theme data — so adding a control is (usually) a new
// spec, not new drawing code.
import { buf, set, fill, hline, vline, beveledBox, roundCorners, desaturateToward } from './raster.mjs';

const GRAY = [136, 136, 136]; // neutral dim target for inactive states

// Resolve a state's effective render options merged onto the spec defaults.
function opts(spec, st) { return { raised: spec.raised, ...st }; }

function drawBeveledFace(spec, st, pal) {
  const { w, h } = spec;
  const img = buf(w, h);
  const o = opts(spec, st);
  const raised = o.sink ? !o.raised : o.raised; // pressed inverts the bevel
  beveledBox(img, 0, 0, w, h, {
    raised, face: pal.face, frame: pal.frame, light: pal.light, dark: pal.dark,
  });
  if (o.sink) fill(img, 2, 2, w - 4, h - 4, pal.facePressed ?? pal.dark); // pressed: darker inset
  if (spec.round) roundCorners(img, 0, 0, w, h, spec.round);
  if (o.dim) desaturateToward(img, GRAY, o.dim);
  return img;
}

function drawRing(spec, st, pal) {
  const { w, h, thickness = 2 } = spec;
  const img = buf(w, h);
  const c = pal[st.color] ?? pal.ring;
  // hollow rounded-rect ring: `thickness` px stroke, transparent interior.
  for (let t = 0; t < thickness; t++) {
    const x = t, y = t, x1 = w - 1 - t, y1 = h - 1 - t;
    hline(img, x, x1, y, c); hline(img, x, x1, y1, c);
    vline(img, x, y, y1, c); vline(img, x1, y, y1, c);
  }
  if (spec.round) roundCorners(img, 0, 0, w, h, spec.round);
  return img;
}

// Checkbox (square) / radio (circle): a RECESSED white well + frame, with an
// optional glyph (check / center dot) when "on".
function drawCheckable(spec, st, pal) {
  const { w, h, shape } = spec;
  const img = buf(w, h);
  const circle = shape === 'circle';
  // recessed well: white interior, dark top-left, light bottom-right.
  beveledBox(img, 0, 0, w, h, {
    raised: false, face: pal.well, frame: pal.frame, light: pal.light, dark: pal.dark,
  });
  if (circle) roundCorners(img, 0, 0, w, h, 3);
  if (st.glyph === 'check') {
    // a compact Platinum check: down-stroke from upper-right to lower-mid, up-tick.
    const ink = pal.glyph;
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    set(img, cx - 3, cy, ink); set(img, cx - 2, cy + 1, ink); set(img, cx - 1, cy + 2, ink);
    set(img, cx, cy + 1, ink); set(img, cx + 1, cy, ink); set(img, cx + 2, cy - 1, ink);
    set(img, cx + 3, cy - 2, ink);
    // thicken one row for weight
    set(img, cx - 1, cy + 1, ink); set(img, cx, cy, ink); set(img, cx + 1, cy - 1, ink);
  } else if (st.glyph === 'dot') {
    const ink = pal.glyph;
    const cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.max(1.5, w / 5);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(img, x, y, ink);
  }
  if (st.dim) desaturateToward(img, GRAY, st.dim);
  return img;
}

// Recessed scroll/slider track channel. The long axis is a stretchable groove;
// the cross axis carries the recessed bevel.
function drawTrack(spec, st, pal) {
  const { w, h, orient } = spec;
  const img = buf(w, h);
  fill(img, 0, 0, w, h, pal.channel);
  // recessed bevel on the cross axis (dark leading edge, light trailing edge).
  if (orient === 'v') {
    vline(img, 0, 0, h - 1, pal.dark); vline(img, w - 1, 0, h - 1, pal.light);
  } else {
    hline(img, 0, w - 1, 0, pal.dark); hline(img, 0, w - 1, h - 1, pal.light);
  }
  // 1px frame around the whole channel.
  hline(img, 0, w - 1, 0, pal.frame); hline(img, 0, w - 1, h - 1, pal.frame);
  vline(img, 0, 0, h - 1, pal.frame); vline(img, w - 1, 0, h - 1, pal.frame);
  if (st.sink) desaturateToward(img, pal.channelPressed ?? [180, 180, 200], 0.35);
  if (st.dim) desaturateToward(img, GRAY, st.dim);
  return img;
}

// Raised scroll thumb (capsule) with optional grip ridges across the middle.
function drawThumb(spec, st, pal) {
  const { w, h, orient, grip } = spec;
  const img = buf(w, h);
  const raised = st.sink ? false : true;
  beveledBox(img, 0, 0, w, h, { raised, face: pal.face, frame: pal.frame, light: pal.light, dark: pal.dark });
  roundCorners(img, 0, 0, w, h, 1);
  if (grip) {
    const ridges = 3, gap = 2;
    if (orient === 'v') {
      const cy = Math.floor(h / 2) - (ridges * gap) / 2;
      for (let i = 0; i < ridges; i++) {
        hline(img, 3, w - 4, cy + i * gap, pal.dark);
        hline(img, 3, w - 4, cy + i * gap + 1, pal.light);
      }
    } else {
      const cx = Math.floor(w / 2) - (ridges * gap) / 2;
      for (let i = 0; i < ridges; i++) {
        vline(img, cx + i * gap, 3, h - 4, pal.dark);
        vline(img, cx + i * gap + 1, 3, h - 4, pal.light);
      }
    }
  }
  if (st.sink) desaturateToward(img, [170, 170, 190], 0.3);
  return img;
}

const COMPOSERS = {
  beveledFace: drawBeveledFace,
  ring: drawRing,
  checkable: drawCheckable,
  track: drawTrack,
  thumb: drawThumb,
};

/** Render one control state. @returns {{width,height,rgba}} */
export function drawControl(spec, stateName, pal) {
  const composer = COMPOSERS[spec.kind];
  if (!composer) throw new Error(`no composer for control kind '${spec.kind}'`);
  return composer(spec, spec.states[stateName] ?? {}, pal);
}
