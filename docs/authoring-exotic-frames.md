# Exotic frames: authoring rules

Use this reference when a plain rounded frame is insufficient. Start with the
[workflow](./authoring-a-scheme.md#4-the-workflow), then build explicit cells with
`frameLayout()`. Rules below distinguish decoded behavior, web limitations and
native observations. The detailed sources are the [compositor spec](./spec/compositor-spec.md)
and [window-widget reference](./spec/engine/window-widgets.md).

## A. The geometry model in one paragraph (the thing everything else follows from)

A frame is one `cicn` plus a `wnd#` recipe. For source size W×H and content rect A,
the top band is rows `0..A.top`, bottom `A.bottom..H`, left `0..A.left`, and right
`A.right..W`. The content is a transparent hole. Each edge recipe partitions its
source band into cells, then allocates those cells across the expanded window.
The enclosing frame remains rectangular even when its mask has an irregular
silhouette. Store compact source periods, not a screenshot of the expanded frame.

## 1. Cell codes (rules R1–R12)

**R1. Borders describe spans.** A cell runs from one border position to the next;
the first border's code is ignored. Only `[first border, last border)` is painted.
Top/bottom span source columns. `frameLayout` side lists span body rows,
excluding corners; raw recipes can include them.
Start at zero and close the list explicitly when the whole band should draw.

**R2. Growers tile.** Every drawn cell tiles its source pixels except code 18.
Codes 8/11 can hold multi-pixel material periods; they are not restricted to 1 px.

**R3. Tiling has an anchor.** Codes 11/14 anchor at the far end; other tiled codes
anchor at the near end. A left 11 and right 8 can phase-lock material around a
plate. `11 | fixed ornament | 8` centers an ornament in an untitled allocation.

**R4. Whole tiles need remainder recipients.** Code 12 rounds its allocated
primary share down to whole source periods. The remainder goes to 8/11/13/14/18
cells in the same allocation (the same half on a titled edge).

**R5. Keep code-12 periods equal within an allocation.** Unequal periods receive
equal primary shares before rounding, so a larger tile can vanish even at the
source width. `frameLayout` enforces one code-12 width per allocation.

**R6. Fixed art spends title room.** Code 12 repeats whenever space permits.
Use 1 or 10 for once-only art, or 6 for title caps. Code 10 is droppable, but the
title can disappear before that ornament does. Inspect `fixedTop`,
`minWidthForTitle(px)` and the actual narrow render instead of assuming a removal
order. Transparent pixels within fixed cells still cost width.

**R7. Code 18 scales.** It uses one scaled blit rather than repeating; the web
uses nearest-neighbor scaling. This suits some gradients, but distorts landmarks
and other recognizable illustration.

**R8. Codes 13/14 only receive leftovers.** Without a primary grower they receive
zero. Their filler source repeats; keep it quiet and compatible with adjoining
tiles. Declare uniform filler groups for lint to catch accidental highlights.

**R9. Code 0 skips.** It advances over source pixels without drawing them. Skip
widths need not match the material period, but the remaining pieces must join.

**R10. Title plate and caps.** The last code-5 cell is the horizontal title
anchor. Its expanded width includes text and T4 margins; code-6 caps vanish with
the title. The two halves allocate independently. The plate centers on content,
so asymmetric side insets move it. A half without a grower pins the plate.
Reserve room for truncation: classic can condense the title, while the web
truncates sooner.

**R11. Widget-dependent cells.** Codes 2/3/4 are fixed when close/zoom/collapse
is present; 15/16/17 are the inverse branches. The web currently uses one widget
presence flag, so its present branches always win. Keep widget art in fixed cells.

**R12. Code 10 drops under pressure.** When the side's available width is below
its fixed sum, code-10 cells and widgets within them can drop. Extremely tiny
web windows have unclamped negative budgets and may overlap cells. Several
growers share primary space equally, distributing fixed ornaments between them;
rounding extras go to later cells.

## 2. Art outside the body / irregular silhouettes (R13–R19)

**R13. Above-bar art needs a taller top band.** `A.top` includes the whole
ornament, not just the title bar. Leave sky between ornaments transparent.

**R14. Side ornaments need side-band width.** A tower wider than a wall still
requires an enclosing side band. Transparent gutter pixels consume content
inset too. Left and right insets may differ.

**R15. Web hit shape remains rectangular.** Transparent frame pixels expose
the backdrop visually but remain within the window's drag area. Widget hits
use their masks.

**R16. Native observations are separate evidence.** Kaleidoscope 2.3.1 has been
observed to pass clicks through transparent frame pixels, clip above-bar art
under the menu bar and fit titles differently. The decoded mask-derived structure
regions and `wNoHit` behavior are documented in [hit regions](./spec/engine/hit-regions.md).
Check current [scheme capture records](../authoring/schemes/)
for exact builds and tested states; a compatible load is not a fidelity proof.

**R17. The scheme mask is binary.** `cicn` transparency cannot preserve a soft
outer edge. Blend curves only against a known matte and use intentional pixel
stairs elsewhere. This is a scheme-format constraint, not a claim that all
classic Mac graphics lack partial transparency.

**R18. Preserve drawable extent.** Keep at least one opaque pixel in the last
source row and column. Otherwise the web's drawable extent can disagree with
classic bounds. The layout lint checks this.

**R19. Shadows stay inside the source.** `wnd#` does not add an automatic shadow.
Bake one inside the bounds if needed. A rectangular CSS shadow fills silhouette
holes and usually defeats an irregular frame.

## 3. Different art per edge, per corner, per side (R20)

**R20. Each edge has its own recipe.** Painting order is top, bottom, left, right.
`frameLayout` side recipes cover body rows only, avoiding corner repainting. Raw
side recipes may include corners: later opaque side pixels win, so match
overlapping art or start at `A.top`. The bottom need
not mirror the top; code 0 can skip source areas. Use independent bands for
water, plinths, tower bases or a distinct lower silhouette.

## 4. Window body textures (R21–R23)

**R21. Pattern lookup depends on window type.** Document body patterns come from
`cinf -9551`, falling back to `-9550`, through `bgPatternId` to a `ppat`. Utility
patterns use 42, then `-9568`, then white. Dialog/alert colour tables are another
path; the web layers patterns over those body colours.

**R22. Classic applications own ordinary body drawing.** A browser body pattern
does not prove that pattern will appear in a classic application. Finder
background records are not ordinary window-body records. Dialog patches use
`dctb`/`actb -14336`, otherwise Kaleidoscope's light grey. Classic utility use of
`ppat 42` remains unestablished. Per-window `cinf` is ignored by the web compositor.

**R23. Keep body patterns quiet.** `ppat` dimensions must be powers of two up to
1024 and its pixels opaque. Prefer low-contrast patterns behind live text. Pixels
outside slider/track masks should remain transparent to expose the actual body.

## 5. Pressed widgets (R24)

**R24. Pressed strips are geometry, not just alternate pictures.** The web needs
`cicn -14330` for clickable window widgets. Close, zoom and collapse pieces use
cumulative rectangle widths; a second row can contain collapsed states when the
strip is at least twice the widget height. Mask coordinates must match 1:1.
The resting picture is already in the frame; there is no rollover state.

Widget sizes are scheme-defined, not fixed at 14 px. Bonn's 26 px medallions and
Midnight's 23 px discs are working examples. Place rectangles inside fixed cells
and regenerate the strip when changing sizes or positions.

The web uses `-14330` for all windows. Native titled utilities use `-14298`, and
side-floating windows use `-14290`. Offsets are calculated from each window's
own rectangle list: omitting zoom can make collapse read the strip's zoom piece.
Use matching corresponding pieces, or a simpler compatible widget set. Generate
strips with `stripLayout()` / `pressedStripFrom()` and test normal/pressed masks
for document and utility layouts separately.

## 6. Popup and side-floating windows (R25–R26)

**R25. Popups are a special case.** `wnd# -12320` uses family 63 and one plate
anchor; rects 0/4/5/6 describe its shoulders, with a 15×15 lower-right area.
Its title-colour sample is on `A.bottom−1`, not the normal top row. The web plate
width comes from creation data, rather than current title measurement. Treat
popup authoring as limited support and test it explicitly.

**R26. Side-floating forms have separate resources.** Side-floating uses
`-14296`, collapsed `-14292`; no-title utility uses `-14288` / `-14284`.
The web hides their titles, does not set the side-title flag and can compute the
wrong collapsed height. It also uses the document pressed strip. Do not assume
ordinary document behavior applies to these forms.

## 7. Other features and known gaps (R27–R30)

**R27. Hidden title samples.** Normal title RGB comes from `(A.left,A.top)` and
shadow RGB one pixel right, ignoring mask bits. Equal colours disable shadow;
otherwise it draws at +1,+1. Set samples after painting each state. See R25 for
popups.

**R28. Title rows matter.** The web clamps font size to `A.top−6` within 8–13 px;
baseline comes from `T4.bottom−4`. Put T4 on the actual bar rows with at least
17 px height (`frameLayout` enforces this). Visible plate art must also fit the
letters; a tall rectangle cannot rescue a short painted plate.

**R29. Window identities are canonical.** Use
[`window-type-identities.js`](../tools/theme-loader/window-type-identities.js)
for resource IDs. A `wnd#` N pairs with inactive `cicn` N and active N+1, with
equal dimensions. Collapsed forms have title-band-only recipes. Web titles are
hidden on dialog, alert, no-title utility and side-floating forms; document,
titled utility, movable modal/alert and popup can show titles.

**R30. Remaining web gaps.** `wnd#` grow-box art is not drawn although the
bottom-right resize overlay is live. Widget-presence branches, condensed titles,
below-template budgets, per-window `cinf`, popups and side-floating forms have
the limitations above. Native clicks through transparent chrome also differ.
Use exact-build native captures rather than treating browser output as a golden
reference for those behaviors.

## 8. frameLayout and windowLayout

`frameLayout()` builds explicit named cell lists and derives template bounds,
content rect, widget rectangles and `wnd#` data:

```js
const layout = frameLayout({
  topH: 36, sideL: 8, sideR: 8, bottomH: 10,
  top: [
    { code: 1, w: 24, name: 'towerL' },
    { code: 12, w: 8 }, { code: 13, w: 1, uniform: 'gap' },
    { code: 6, w: 6 }, { code: 5, w: 12, name: 'plate' }, { code: 6, w: 6 },
    { code: 13, w: 1, uniform: 'gap' }, { code: 12, w: 8 },
    { code: 1, w: 24, name: 'towerR' },
  ],
  bottom: [{ code: 1, w: 8 }, { code: 8, w: 74 }, { code: 1, w: 8 }],
  left: [{ code: 8, w: 4 }], right: [{ code: 8, w: 4 }],
  title: { cell: 'plate', top: 16, bottom: 34 },
  widgets: { close: { x: 6, y: 18, w: 13, h: 13 } },
});
layout.named('plate');
layout.minWidthForTitle(90);
layout.lint(raster); // after painting
```

It checks equal edge totals, widgets within fixed top cells, code-12 recipient
and period rules, required growers and title bounds. It does not decide whether
your illustration, palette or title budget looks good.

`windowLayout()` is a shorter helper for a plain rounded rectangle. Use
`frameLayout()` for multi-pixel repeats, several growers, asymmetric sides,
separate ornament/bar heights, title caps or distinct bottom art. Read the
[implementation](../tools/theme-author/frame-layout.js) and existing scheme
painters for the supported options instead of maintaining another API catalogue.
