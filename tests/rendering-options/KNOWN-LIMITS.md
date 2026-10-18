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
  tracks remaining pattern-backed, list-header and legacy face approximations.
  Solid push/default and bevel faces with explicit slice metadata and an opaque
  background sample now share the source-backed square-corner/independent-band
  painter; hand-derived geometry assertions supply separate evidence. That narrow
  correction does not establish text policies or complete face fidelity. See
  [control-face geometry](../../docs/spec/control-face-geometry.md).
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
  interleaved-panel fixture error was corrected by #224 before seed approval.
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
- Windows95's scrollbar track appears transparent between its arrows and thumb.
  The original track painter/resource availability is unverified; this screenshot
  observation alone establishes neither a defect nor the correct fix.
- [Slider accessible naming #229](https://github.com/khawkins98/scriptoscope/issues/229)
  and [promoted-control teardown #232](https://github.com/khawkins98/scriptoscope/issues/232)
  were delivered by #235/#238 with separate behavioral checks; range native
  semantics and composed pointer geometry followed in #243/#246. Static image
  approval still does not establish those contracts. Button/tab/text-field
  decoration restoration and global overlapping theme ordering (#237) remain
  outside that bounded lifecycle delivery.
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
