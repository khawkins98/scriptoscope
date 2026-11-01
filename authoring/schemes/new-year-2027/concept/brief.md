# Midnight 2027 — concept and current implementation

## Art direction

The window is the night sky at midnight: a luminous gold-and-pink firework
left of a champagne title plate, large foil **2027** numerals under a cyan
burst to its right, and a pocket watch with both hands on twelve.

One light comes from the upper left. Midnight navy carries the celebration;
gold highlights stay clear, pink and cyan belong to the bursts, and the live
content stays white. Inactive windows retain the same silhouettes in slate
and silver. All source art uses whole pixels and system-palette entries.

The selected target is `concept.jpg`, generated from `brief-concept.txt`.
A full active-window crop is `245,205,895,632`. The image includes imagined
controls and painted text; it is a composition reference, not final pixels.

## Composition pass, 2026-10-31

The earlier implementation preserved the motifs but shrank the concept into
a 50px header, 16px numerals, 15px widgets and a tiny clock. The current pass
measures the target at the rendered window's outer width:

| Feature | Current source art / geometry | Behavior |
|---|---|---|
| Document header | 86px: 18px open ornament space above a 68px navy band | fixed height |
| Gold/pink burst | approximately 66×70px, in a 68px cell | code 10, drops whole |
| Year | 75×28px, in a 79px cell; four 16×26px digits and 3px gaps | code 10, drops whole |
| Cyan burst | approximately 44×35px, above the year | shares the year cell |
| Title plate | 27px pale champagne face, bronze edge, lit/shaded rows, lower shadow | code 5 between 8px code-6 caps |
| Widgets | 23px gold-rimmed navy discs, 10px glyphs | fixed cells; pressed inverts |
| Sides / bottom | 13px / 25px navy with gold rules | growing bands and fixed twinkles |
| Corner clock | 25px | one fixed bottom-right ornament |
| Normal scrollbars | 24px source cross-axis, 21px round watch face | native resource art |
| Determinate progress | 20px frame, 14px fill rows, 8px champagne segments | `cinf.tileSides=1`, SLICE6/7 |

The top edge's fixed title cost is 247px. A 90px title needs 337px outer
width; the representative Document Window title fits in the usual 406px
outer window (380px content plus 13px sides). Narrow windows deliberately
lose title room before the large code-10 ornaments drop. Utility windows
keep a compact 38px header and the same close-widget size, so pressed strips
remain aligned. The code-6 caps move and disappear with the title plate.

## Painting decisions

- Firework rays bow downward into warm gold/pink arcs. Selected two-pixel
  trails keep dark gaps between them; a small white core sits in a broader
  gold centre, then the ends break into sparse sparks. No fake glow or dither.
- Numerals keep thick faces and a two-pixel bronze drop shadow; a short foil
  reflection crosses the face. The year is not a thin outline font.
- A distinct `#ffcc66` champagne plate separates the title material from the
  stronger `#ffcc33` numeral and widget gold.
- The supported determinate-fill tiler repeats lit champagne segments instead
  of stretching one flat gold column. Indeterminate progress keeps confetti.
- A few stars remain in the night bands. They support the fireworks instead
  of turning every repeated edge into confetti.
- Detailed procedural masks stay in `art.mjs`; there is no giant illustration
  grid to migrate into a PNG. Geometry and materials remain editable in code.

## Review and deliberate departures

Review the actual live concept scene and the ordinary document, then inspect
narrow/wide windows and the 8-bit simulation. The browser's ordinary content
and title font differ from the generated concept; the matched-width report
preserves aspect ratios so those differences remain visible.

The web facade may fit the 21px watch art into a narrower native scrollbar
cross-axis, making it look oval. No runtime sizing override is added here;
check the original art in the classic VM. The low-level resource geometry,
pressed strip and title budget remain authoritative.

Keep the `.rsrc` and `.bin` frozen for the exact-build classic run. Its hashes,
conditions and observed states belong in `../classic/README.md`; older images
do not validate this larger revision.
