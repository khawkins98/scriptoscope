# Reference preview images

Per-scheme reference images used inside the diagnostic page (`demo/diagnostic.html`)
for side-by-side comparison against our live rendering. One PNG per corpus scheme,
keyed by slug.

| File | Scheme |
|---|---|
| `1138.png` | 1138 |
| `1984.png` | 1984 |
| `1990.png` | 1990 |
| `apple-platinum-2.png` | Apple Platinum 2 |
| `beos-r503.png` | BeOS R5.0.3 |
| `evolution.png` | Evolution |
| `platinum-8.png` | Platinum 8 (Russell Silver Jr., 1998) — **provenance KNOWN**: the scheme author's own rendering, from the Kaleidoscope archive (kaleidoscope.hryjksn.com). Unlike the others below, this is a trustworthy reference for the theme's true appearance. |
| `system7-nostalgia-silver.png` | System 7 Nostalgia Silver (mollusc, 1997) — **provenance KNOWN**: author's own rendering from the Kaleidoscope archive. Platinum-adjacent silver scheme. |

## Provenance is undocumented — not a trustworthy pixel-diff oracle

The version, capture size, window state (active/inactive), title text, scale/DPI,
and capture method for these PNGs are **not recorded**. They are useful as a rough
visual sanity check while iterating, but they are **not** a reliable ground truth
for an automated pixel diff:

- the preview may be from a different revision of the scheme than the `.rsrc` we
  extract from, so pixels can disagree even when our render is correct;
- capture conditions (size/state/title/scale/palette) are unknown and inconsistent
  across the set;
- some include title text, content, and drop shadows that the frame-only
  compositor does not (and should not) reproduce.

For the full analysis of this oracle-trust problem and what a properly
version-matched ground truth would require, see
[`../../../docs/spec/golden-reference-todo.md`](../../../docs/spec/golden-reference-todo.md).
