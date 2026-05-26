// scripts/generate-platinum/control-metrics.mjs
// THE CONTROL SPECS — pure DATA. Each entry describes a Platinum control as
// geometry + color-slot references + a draw `kind`; the generic drawer
// (draw-control.mjs) renders any of them. This is the data/drawer split decoded
// from AppearanceLib (DrawThemeButton is a thin dispatcher over theme DATA), made
// explicit: change a number here, regenerate, done — no new drawing code.
//
// Geometry sources:
//   - track family (scrollbar/slider): docs/spec/platinum-controls-decode.md
//     (CDEF -63 — thumb clamp, arrow caps, recessed channel). CDEF -1 corroborates.
//   - button family (push/checkbox/radio): standard Appearance metrics + the sizes
//     the renderer fixes (controls.ts: button-face 16×16 corner 5, checkable 12×12).
//     The genuine button CDEF is not in the extracted corpus (both -1 and -63 are
//     track procs); per the FALLBACK gate these use standard metrics + the bevel
//     model, which is faithful to Platinum's restrained gray controls.
//
// Color slots are NAMES resolved against the palette by the drawer:
//   frame · face · light · dark · channel · ring · ringInactive · accent · glyph
// (grays from the verified WDEF model; ring/accent from the extracted
//  platinum-palette.json cctb highlight pair — lavender/indigo.)

// Resource-ID families the renderer looks controls up by (controls.ts).
export const CONTROL_IDS = {
  pushButton: { active: -10239, pressed: -10238, inactive: -10240 },
  defaultRing: { active: -10231, inactive: -10232 },
  checkbox: { onActive: -9500, onInactive: -9501, offActive: -9503, offInactive: -9504 },
  radio: { onActive: -9488, onInactive: -9489, offActive: -9491, offInactive: -9492 },
  scrollTrackV: { active: -8277, inactive: -8278, disabled: -8279, pressed: -8280 },
  scrollTrackH: { active: -8285, inactive: -8286, disabled: -8287, pressed: -8288 },
  scrollThumbH: { normal: -10206, pressed: -10205 },
  scrollThumbV: { normal: -10208, pressed: -10207 },
};

// Per-control geometry + draw kind. `slice` is the 9-slice chromeElement metadata
// (null = stamped 1:1). `name` is the chromeElement key in theme.json.
export const CONTROL_SPECS = {
  pushButton: {
    kind: 'beveledFace', name: 'button-face', w: 16, h: 16, round: 1, raised: true,
    slice: { corner: 5, side: 1, tile: false, resizeBehavior: 'stretch-whole' },
    states: { active: {}, pressed: { raised: false, sink: true }, inactive: { dim: 0.55 } },
  },
  defaultRing: {
    kind: 'ring', name: 'default-ring', w: 16, h: 16, round: 2, thickness: 2,
    slice: { corner: 5, side: 1, tile: false, resizeBehavior: 'stretch-whole' },
    states: { active: { color: 'ring' }, inactive: { color: 'ringInactive' } },
  },
  checkbox: {
    kind: 'checkable', shape: 'box', name: 'checkbox', w: 12, h: 12, round: 1, raised: true,
    slice: null,
    states: {
      onActive: { glyph: 'check' }, onInactive: { glyph: 'check', dim: 0.5 },
      offActive: {}, offInactive: { dim: 0.5 },
    },
  },
  radio: {
    kind: 'checkable', shape: 'circle', name: 'radio', w: 12, h: 12, raised: true,
    slice: null,
    states: {
      onActive: { glyph: 'dot' }, onInactive: { glyph: 'dot', dim: 0.5 },
      offActive: {}, offInactive: { dim: 0.5 },
    },
  },
  // Track family — recessed channel; thumb is a raised capsule with a grip.
  // CDEF -63: thumb clamped to track, arrow/cap reserve, proportional thumb.
  scrollTrackV: {
    kind: 'track', name: 'scrollbar-track-v', orient: 'v', w: 15, h: 48,
    slice: { corner: 0, side: 6, tile: false, resizeBehavior: 'stretch-whole' },
    states: { active: {}, inactive: { dim: 0.5 }, disabled: { dim: 0.65 }, pressed: { sink: true } },
  },
  scrollTrackH: {
    kind: 'track', name: 'scrollbar-track-h', orient: 'h', w: 48, h: 15,
    slice: { corner: 0, side: 6, tile: false, resizeBehavior: 'stretch-whole' },
    states: { active: {}, inactive: { dim: 0.5 }, disabled: { dim: 0.65 }, pressed: { sink: true } },
  },
  scrollThumbV: {
    kind: 'thumb', name: 'scrollbar-thumb-v', orient: 'v', w: 15, h: 32, grip: true,
    slice: { corner: 6, side: 1, tile: false, resizeBehavior: 'stretch-whole' },
    states: { normal: {}, pressed: { sink: true } },
  },
  scrollThumbH: {
    kind: 'thumb', name: 'scrollbar-thumb-h', orient: 'h', w: 32, h: 15, grip: true,
    slice: { corner: 6, side: 1, tile: false, resizeBehavior: 'stretch-whole' },
    states: { normal: {}, pressed: { sink: true } },
  },
};
