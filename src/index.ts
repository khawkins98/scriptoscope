// Aaron UI v2 — clean-break rebuild.
//
// A web-native runtime for classic-Mac Kaleidoscope schemes. We start
// from zero and scale up a working implementation, learning the right
// HTML/CSS structure empirically against the reference images and the
// extracted theme bundles, rather than locking structure in early.
//
// Preserved from v1 (do not re-derive — see docs/):
//   themes/<slug>/                            extracted bundles
//                                             (theme.json + cicns/*.png)
//   tools/theme-loader/                       .rsrc → theme.json decoder
//   docs/kaleidoscope-to-html-mapping.md      mapping reference
//   docs/tracking/kdef-disassembly-findings.md   binary archaeology
//   docs/aaron-ui-*-spec.md                   the v1 specs (reference)
//
// v2 starts here.

export const VERSION = '2.0.0-dev';
