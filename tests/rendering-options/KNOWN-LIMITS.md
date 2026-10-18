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
- [Rendering fidelity epic #221](https://github.com/khawkins98/scriptoscope/issues/221)
  tracks broader independent evidence and coverage. The 70-case bounded profile is
  a deliberate sample; even the 660-case extended profile is not every possible
  API value or Cartesian combination.
- Closed selects show the themed closed face; the browser owns the open native
  popup. Keyboard focus and selection have separate behavioral assertions.
- Explicit tiny face heights can clip labels by caller request. Automatic sizing
  and independently established 20px-face label ink are checked separately.
- The corpus cases use standalone schemes. Base-chain resource resolution,
  interactive retheming and every window/chrome permutation need their own tests.
- Goldens pin Linux/amd64 Chromium, fonts, DPR1 and the case inventory. Extended
  Firefox/WebKit and DPR2 contracts broaden execution coverage without claiming
  cross-platform screenshot identity.

Review unexplained changes against source evidence before updating images. An
existing limitation may be recorded as such; recording must not silently turn it
into a fidelity claim. Candidate workflow output is unapproved until reviewed.
