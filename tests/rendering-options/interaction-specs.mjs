// The interaction contract suite (#598, release tier): the specs where browser
// engines genuinely differ on pointer capture, sub-pixel pointer coordinates and
// focus. Chromium already runs them in the bounded shards on every PR. The release
// gate (release-gate.yml) runs this list again under Firefox and WebKit at DPR 1
// as required jobs (`npm run test:rendering:interaction`,
// SCRIPTOSCOPE_RENDERING_SUITE=interaction). The PR tier is Chromium-only; the
// extended matrix covers every spec in every engine.
//
// This is the single list. The config, the npm script and the release gate's
// per-spec execution check all read it.
export const INTERACTION_SPECS = Object.freeze([
  // Title-bar drag: pointer capture, pointercancel, sub-half-pixel jitter (#561, #563).
  'window-pointer-drag.spec.mjs',
  // Grow box: zero-delta and sub-pixel presses are no resize (#552).
  'growbox-zero-delta.spec.mjs',
  // Grow-box hit zone vs the scrollbar's drawn end arrow, from element rects (#524).
  'growbox-zone.spec.mjs',
  // In-flow hosts, real-pointer drag handoff to absolute, placeholder (#536).
  'posture-b.spec.mjs',
  // Promote measurement and pointer tracking under transformed ancestors (#519).
  'transformed-ancestors.spec.mjs',
]);

// Not in this list: scrollbar-parts.spec.mjs (#567) is green in Firefox and
// WebKit but its hold-to-repeat cases cost about 4.7 min per engine, more than
// the five specs above together save by staying narrow. It runs in every engine
// in the extended matrix (release tier).
