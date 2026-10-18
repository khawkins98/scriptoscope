# Rendering evidence and review limits

The contact sheets are reviewed regression snapshots of Scriptoscope. They are
not captures from the original Kaleidoscope engine, and image equality does not
establish complete historical fidelity. Independent source-coordinate, authored
color, glyph-ink and real DOM/keyboard assertions supply separate evidence.

The compact JSON artifacts are **observations of an execution**. A recorded
`unavailable` status means the public compositor returned null; it does not prove
the source lacks applicable art or that fallback selection is correct. Likewise,
recorded dimensions and source/built agreement do not make those dimensions an
independently justified expectation. Failed/partial runs carry `complete: false`.

Known boundaries requiring explicit consideration during image review:

- [Face compositing follow-up #218](https://github.com/khawkins98/scriptoscope/issues/218)
  tracks remaining rectangular/pattern face approximations. The source-backed
  default-ring correction does not establish the separate face painter's fidelity.
- [Tab geometry/font investigation #223](https://github.com/khawkins98/scriptoscope/issues/223)
  includes a demonstrated crop-band mismatch: horizontal slicing combines an
  opaque-bounds-cropped width with `cinf.corner` from the full source raster. For
  unselected 1138 art, width19/corner10 gives a negative middle band; for 1990,
  width28/corner14 gives zero. Skipping that band leaves detached ends and text
  over a transparent center in direct and themed declarative tabs. These images
  record a known defect while original tab assembly is researched.
  Separately, font sizing from opaque height is an unverified runtime policy.
  Windows95/Windows3.1's small 8px tab font is visible in the snapshots, but source
  analysis has not established actual glyph clipping there. The separate
  interleaved-panel fixture error must be corrected before accepting a seed.
- [Rendering fidelity epic #221](https://github.com/khawkins98/scriptoscope/issues/221)
  tracks broader independent evidence and coverage. The 70-case bounded profile is
  a deliberate sample; even the 660-case extended profile is not every possible
  API value or Cartesian combination.
- Slider retention assertions compare every opaque source-thumb pixel and test
  the explicit groove/thumb centering policy. They do not establish the original
  slider drawer's still-untraced alignment arithmetic or transparent-mask painter
  behavior. [Slider clipping #222](https://github.com/khawkins98/scriptoscope/issues/222)
  distinguishes the demonstrated source-cell loss from those remaining questions.
- Closed selects show the themed closed face; the browser owns the open native
  popup. Keyboard focus and selection have separate behavioral assertions.
- Slimes progress endpoint appearance and Evolution's disabled-button pattern/text
  treatment remain unverified against original source requirements. Snapshot
  stability does not resolve whether those visual treatments are faithful.
- Explicit tiny face heights can clip labels by caller request. Automatic sizing
  and independently established 20px-face label ink are checked separately.
- The corpus cases use standalone schemes. Base-chain resource resolution,
  interactive retheming and every window/chrome permutation need their own tests.
  The tiny 180px reference windows in control sheets are layout/shadow sentinels,
  not validated examples of complete window fidelity at that size.
- Goldens pin Linux/amd64 Chromium, fonts, DPR1 and the case inventory. Extended
  Firefox/WebKit and DPR2 contracts broaden execution coverage without claiming
  cross-platform screenshot identity.

Review unexplained changes against source evidence before updating images. An
existing limitation may be recorded as such; recording must not silently turn it
into a fidelity claim. Candidate workflow output is unapproved until reviewed.
