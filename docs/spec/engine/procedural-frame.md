# Engine unit: built-in window frame (schemes with no `wnd#`)

Lane L7, 2026-10-21. Spec writer: L7. Verifier: not yet assigned.
Evidence appendix: [`procedural-frame.evidence.md`](./procedural-frame.evidence.md). Implementers must not read it.

## 1. Unit id and scope

| field | value |
|---|---|
| family | window frame, built-in path (`proceduralFrame`) |
| binary | Kaleidoscope 2.3.1 kDEF 0, `kDEF/id-0-680x0_DefProcs.bin`, sha256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| document family | `0x11c58`–`0x1525a` (entered from the slot-3 gate `0x118b8`) |
| utility family | `0x152be`–`0x17452` (entered from the slot-4 gate `0x1525a`); partly decoded, §9 |
| replaces | `src/composeCornerSprite.ts`, `src/cornerSpriteGeometry.ts`, the `CORNER_SPRITE_WINDOWS` synthesis in `tools/theme-loader/buildThemeJson.js` |

### 1.1 Verdict on the hypothesis

**Confirmed.** The region is Kaleidoscope's own window definition. It runs only when a scheme ships neither the `wnd#` recipe nor a replacement `WDEF` code resource for the family. Its art is the scheme's own cicns, `ics#`/`ics8` icons, `ppat`s, `clut`s and `actb` in the -14336..-14285 band. Its line colours are pixels sampled from those cicns. It is not Apple's WDEF 125. It does not use `headerColors` or `Colr`, and it computes no colours.

| gate step (document family) | outcome | source |
|---|---|---|
| `wnd#` -14336 present | the recipe compositor runs (slot 6); this unit is not used | `0x118e4`–`0x11912` |
| `wnd#` absent, `WDEF` -14330 present with a non-empty handle | that code resource is called with the original arguments; this unit is not used | `0x11916`–`0x11c54` |
| both absent | this unit: per-call setup (§3), then dispatch on the WDEF message (§2) | `0x11c58`–`0x11ec2` |

The utility family uses the same gate with `wnd#` -14304 and falls into its own nine-message table (`0x152be`–`0x152fc`).

**Corpus.** Exactly five bundles ship no `wnd#` and no `WDEF`: `apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes` and `system7-nostalgia-silver`. All 18 bundles were checked. Each of the five ships every resource family this unit reads (§8). No other bundle reaches this unit.

## 2. Messages

| message | behaviour | source |
|---|---|---|
| 0 draw | §4–§6 for the whole frame (part 0), or toggles one widget (parts 4, 5/6, 9) | `0x12b88`, `0x12bc4` |
| 1 hit | §7 | `0x1295e` |
| 2 calc regions | structure and content regions, §3.3 | `0x12486` |
| 3 new | allocates the 36-byte per-window record. It records the Finder-zoom flag (§6.4) | `0x122c6` |
| 4 dispose | releases the record and its proxy-icon suite | `0x123f0` |
| 5 grow outline | frames the grow-outline region (pen 2×2, pattern from globals, mode 2), then waits one tick | `0x1280a` |
| 6 draw grow icon | §6.4 | `0x14286` |
| 7 get features | returns the feature bits in §3.2 | `0x11cfa` |
| 8 get region | rectangle per region code, §3.4 | `0x11d7e` |
| other | no effect | `0x11c8a` |

For message 0, the draw part comes from the low word of the parameter (`0x12c28` table):

| part | action | source |
|---|---|---|
| 0 | title bar (titled windows only), then the frame (§4/§5). For a titled, non-movable window, the first draw also does the one-time proxy-icon setup (§6.5) | `0x12c3c`–`0x12d08` |
| 4 | close widget in the toggled pressed state | `0x12d0a` |
| 5, 6 | zoom widget in the toggled pressed state | `0x12d18` |
| 9 | collapse widget in the toggled pressed state | `0x12d28` |
| 1–3, 7, 8, > 9 | nothing | `0x12c28` |

After parts 4, 5, 6, 9 and 258 a per-window toggle bit flips (`0x12d36`–`0x12d4e`, `0x12d5e`), so alternate calls draw pressed and released.

The frame is drawn once for each device that DeviceLoop visits (`0x12bb6`). On devices of 4 bits or less, under the rule at `0xf488`, every sampled colour becomes black or white from the cicn's 1-bit image (`0xfaee`–`0xfb76`). That path is out of scope for a 32-bit target.

## 3. Inputs

### 3.1 Window kind and flags

The variation code is read into five window kinds and four flags (`0x11ee2`–`0x11fa4`). Bits 4–6 come from the caller, which is Kaleidoscope's own service table. A Toolbox WDEF receives only bits 0–3.

| name | definition | meaning | source |
|---|---|---|---|
| kind | variation & 7 | 0 documentProc, 1 dBoxProc, 2 plainDBox, 3 altDBoxProc, 4 noGrowDocProc, 5 movableDBoxProc | `0x11f2c` |
| zoom | variation bit 3 | has a zoom box | `0x11f38` |
| thin | variation bit 4 | thin-frame variant (frame insets 2–3 px smaller) | `0x11f02` |
| alertBit | variation bit 5 | when *thin* is set, this bit alone decides alert colouring (§3.5) | `0x11ef2` |
| grow | variation bit 6, or kind 0 | has a grow box | `0x11f12`, `0x11f48` |
| titled | kind ∈ {0, 4, 5} | has a title bar | `0x11f62`–`0x11f78` |
| movable | kind = 5 | movable modal | `0x11f54` |
| modal | kind ∈ {1, 5} | reported as modal | `0x11f90`–`0x11fa4` |
| canCollapse | titled and not movable | eligible for a collapse box | `0x11f7c` |
| hilited | WindowRecord `hilited` | active state. It selects the active art and gates stripes and widgets | `0x12dfc`, `0x13cac` |
| goAway | WindowRecord `goAwayFlag` | has a close box | `0x121ce`, `0x13cb6` |
| collapsed | Appearance collapsed state when Gestalt `appr` answers, else bit 2 of the aux-window flags byte | window is shaded | `0xf078` |
| shadeOn | bit 0 of the Gestalt `Aarn` response | Kaleidoscope's collapse-box option | `0x12150`–`0x1216a` |

Get-features (message 7) returns grow → 1, zoom → 2, canCollapse → 4, modal → 8, always 16, titled → 64, always 0x0F80 (`0x11cfa`–`0x11d60`).

### 3.2 Title-bar height *H*

| step | rule | source |
|---|---|---|
| font | system font, size 0, plain | `0x120c8`–`0x120d2` |
| base | *H* = ascent + descent + 6 | `0x120da`–`0x120e4` |
| parity | if *H* is even, *H* −= 1 | `0x120e8`–`0x120f6` |
| floor | if *H* < 22: ascent += trunc((22 − *H*) / 2), then *H* = 22 | `0x120fa`–`0x12116` |

With Chicago 12 (ascent 12, descent 3), *H* = 22. The runtime currently uses about 19.

### 3.3 Geometry

All rectangles are QuickDraw rectangles (left, top, right, bottom), with right and bottom exclusive. *C* is the content rectangle in global coordinates (`0x14620`). "Outset *n*" grows a rectangle by *n* on every side. trunc/2 is division by 2 rounding toward zero.

**Structure region** (`0x125e0`). Every kind starts from *C* outset 1. The shadow is the union with the bounding box shifted by (+2, +2) and shortened by 1 on the right and bottom (`0x127b6`). That leaves a 1-px shadow along the right and bottom, starting 2 px in.

| kind | structure (before the shadow) | shadow | source |
|---|---|---|---|
| 0, 4 | (*C*.l − 6, *C*.t − *H*, *C*.r + 6, *C*.b + 6) | 1 px | `0x12624` |
| 1 | *C* outset 6 (outset 3 if *thin*) | 1 px | `0x126c0` |
| 2 | *C* outset 1 | none | `0x1268c` |
| 3 | *C* outset 1 | the same rectangle shifted (+2, +2), unioned | `0x12696` |
| 5 | *C* outset 6 (outset 3 if *thin*), top raised by *H* − 1 | 1 px | `0x12650` |
| collapsed (any titled) | the title bar (*C*.l − 6, *C*.t − *H*, *C*.r + 6, *C*.t); 5 px taller if Gestalt `WdrB` answers and the content top is *H* + 22 below the structure top. Content becomes empty | 1 px | `0x126fc` |

**Content region** (`0x124d0`): *C*, minus the grow box when the grow box belongs to the frame (§6.4) and *grow* is set. Movable-modal windows subtract a mask region instead: cicn -14309 (hilited) or -14310 (not). Without that cicn they subtract a five-point polygon (§6.4).

**Named rectangles** (each one is also a message-8 region, §3.4):

| rect | formula | source |
|---|---|---|
| title bar *T*, kinds 0/4 | (*C*.l − 6, *C*.t − *H*, *C*.r + 6, *C*.t) | `0x146f8`–`0x1470e` |
| title bar *T*, kind 5 | (*C*.l − 6, *C*.t − 5 − *H*, *C*.r + 6, *C*.t − 5); with *thin*: (*C*.l − 3, *C*.t − 2 − *H*, *C*.r + 3, *C*.t − 2) | `0x146d4`–`0x146f6` |
| title bar *T*, collapsed with `WdrB` | structure bounding box, height *H*, right − 1 | `0x14712`–`0x14730` |
| widget top *wy* | *T*.t + trunc((*H* + 1 − 13) / 2) − 1, which is *T*.t + 4 when *H* = 22 | `0x148a2`–`0x148ce` |
| close | 16 × 16 at (*T*.l + 4, *wy*) | `0x148a2` |
| collapse | 16 × 16 at (*T*.r − 17, *wy*) | `0x14904` |
| zoom | 16 × 16 at (*T*.r − 17, *wy*), or (*T*.r − 33, *wy*) when a collapse box is shown | `0x1496c` |
| grow | (*C*.r − 15, *C*.b − 15, *C*.r + 2, *C*.b + 2), 17 × 17. For kind 5 without *thin*, offset (+3, +3) | `0x1499a` |
| title left limit *L* | close.l + 17 if *goAway*, else *T*.l + 5 | `0x1480c` |
| title right limit *R* | zoom.l − 4 if variation bit 3, else collapse.l − 4 if a collapse box is shown, else *T*.r − 5 | `0x14848` |
| title text | width *w* = StringWidth(title), plus 20 when a proxy icon is shown. Left = max(*L*, *T*.l + trunc((*T*.w − *w*) / 2)). Right = left + *w*. Vertical extent = *T* inset 3 top and bottom. Empty when the title is empty | `0x14784` |
| proxy icon | 16 × 16 at the title-text left, vertically centred in it | `0x1473a` |

**Widget presence** (`0x121ce`–`0x12264`):

| widget | shown when | dropped when | source |
|---|---|---|---|
| close | *goAway* | never | `0x13cb6` |
| zoom | *zoom* | zoom still intersects close after the collapse box has been dropped | `0x121dc`–`0x1221e` |
| collapse | *shadeOn*, *titled*, not *movable* | zoom ∩ close ≠ ∅ (with zoom), or collapse ∩ close ≠ ∅ (without zoom) | `0x14b40`, `0x121f6`, `0x12224`, `0x12244` |

### 3.4 Message-8 regions

| code | region | source |
|---|---|---|
| 0 | title bar | `0x11db4` |
| 1 | title text, outset 1 vertically | `0x11dcc` |
| 2 | close | `0x11df0` |
| 3 | zoom | `0x11e08` |
| 6 | grow | `0x11eae` |
| 7 | collapse | `0x11e20` |
| 32 | structure. When collapsed: *C* widened by 6 px on each side, from *C*.t − *H* down to *C*.t, plus the shadow | `0x11e38` |
| 33 | content. Empty when collapsed | `0x11e8e` |

### 3.5 Art selection

"Alert colouring" (`0x14c64`) is decided by the first matching row:

| condition | alert | source |
|---|---|---|
| *thin* set | *alertBit* | `0x14c6c` |
| aux-window flags bit 4 set | yes | `0x14c7a`, `0xf048` |
| kind not 1 and not *movable* | no | `0x14c90`–`0x14ca2` |
| `actb` -14336 absent | no | `0x14cc0`–`0x14cd4` |
| the window colour table's entry-0 colour equals `actb` -14336's entry-0 colour | yes, otherwise no | `0x14cd6`–`0x14d18` |

| role | hilited | not hilited | source |
|---|---|---|---|
| document frame and title cicn (kinds 0/4) | cicn -14332 | cicn -14336 | `0x12dfc`–`0x12e18`, `0x13938` |
| dialog frame and title cicn, alert colouring | cicn -14322 | cicn -14324 | `0x1353a`–`0x13588`, `0x13950` |
| dialog frame and title cicn, otherwise | cicn -14326 | cicn -14328 | same |
| title stripes, kinds 0/4 | -14331 | not drawn | `0x13e58` |
| title stripes, kind 5 | -14321 (alert) / -14325 | not drawn | `0x13e42`–`0x13e52` |
| close widget, normal / pressed | `ics#`/`ics8` -14336 / -14333 | not drawn | `0x14168`–`0x14182` |
| zoom widget, normal / pressed | -14334 / -14331 | not drawn | `0x14186`–`0x141a0` |
| collapse widget, normal / pressed | -14335 / -14332 | not drawn | `0x141a4`–`0x141be` |
| grow box, kinds 0/4 | cicn -14330 | cicn -14334 | `0x1450a`–`0x14526` |
| grow box, kind 5 | cicn -14309, else procedural with `clut` -14336 | cicn -14310, else procedural with `clut` -14335 | `0x13136`–`0x13204` |

Within this unit, a "stripes" id is both a `ppat` id and a `cicn` id. A widget id is an `ics#` id. `ics4` is never read: the type code does not occur anywhere in kDEF 0 (`0xf4ba`). The same number names different resources in different types. For example -14334 is the zoom icon (`ics#`) and the inactive grow box (`cicn`).

The table conflicts with two published labels. `kdef231-reference.md` §2.1 calls -14326 "Alert Inactive" and -14322 "Movable Alert Inactive". For this unit, -14326 is the active non-alert dialog frame and -14322 is the active alert frame.

**Sampling.** P(x, y) is the colour of the frame cicn's pixel at column x, row y. It comes from the cicn's own colour table. For line drawing the cicn's mask is not consulted (`0xf9f6`, `0xfa8a`).

## 4. Document frame (kinds 0, 4): drawing

Let F be the document cicn (16 × 16). Let *L* = *C*.l − 6, *R* = *C*.r + 6 and *B* = *C*.b + 6, all exclusive (`0x12dc0`–`0x12df8`). Nothing is drawn if F is absent (`0x12e24`).

| order | element | pixels | colour / source pixels | source |
|---:|---|---|---|---|
| 1 | bottom-left corner | columns *L*..*L*+5, rows *C*.b..*C*.b+5 | F rows 10–15, columns 0–5, copied 1:1 | `0x12e5c`–`0x12e9e` |
| 2 | bottom-right corner | columns *C*.r..*C*.r+5, rows *C*.b..*C*.b+5 | F rows 10–15, columns 10–15 | `0x12ea4`–`0x12ed2` |
| 3 | bottom band, row *C*.b+5−i (i = 0..5) | columns *C*.l .. *C*.r−1 | P(6, 15−i) | `0x12ef0`–`0x12f3c` |
| 4 | left band, column *L*+i (i = 0..5) | rows *C*.t .. *C*.b−1 | P(i, 6) | `0x12f48`–`0x12f7e` |
| 5 | right band, column *C*.r+5−i (i = 0..5) | rows *C*.t .. *C*.b−1 | P(15−i, 6) | `0x12f80`–`0x12fb4` |
| 6 | drop shadow | row *B* from column *L*+2 to *R*; column *R* from row *C*.t−*H*+2 to *B* | P(0, 0) | `0x12fb6`–`0x12fe6` |
| 7 | grow box, if it belongs to the frame (§6.4) | grow rect | §6.4 | `0x13002`–`0x1301a` |

When collapsed, rows 1–5 are skipped and only the shadow is drawn, unless Gestalt `WdrB` answers and the structure is not title-only (`0x12e28`–`0x12e58`). While row 3 is drawn, the port's text font holds the sentinel −12345 (`0x12ee8`). Its effect is outside this binary (§10).

The corner copy is opaque (CopyBits srcCopy) for cicns deeper than 1 bit, so the mask is ignored. A 1-bit cicn is copied with its mask (`0xfdf8`–`0xfe90`).

## 5. Title bar (titled kinds): drawing

Let F be the frame cicn from §3.5. In a dialog-kind title, F is the dialog cicn. *T* is the title bar from §3.3. "Box" mode is used for collapsed document windows and for kind 5. A document window that is not collapsed uses "joined" mode. Collapsed windows with Gestalt `WdrB` use box mode unless the structure is title-only (`0x138e0`–`0x1394e`).

The title is drawn off-screen into a GWorld, then copied to the screen (`0x1382c`–`0x138dc`, `0x13cf4`–`0x13d8e`). This changes no pixels.

| order | element | pixels | colour / source | source |
|---:|---|---|---|---|
| 1 | sample text colours | — | fill = P(6, 3), text = P(7, 3), shadow = P(9, 3) | `0x1399a`–`0x139ca` |
| 2 | top-left corner | 4 × 4 at (*T*.l, *T*.t) | F rows 0–3, columns 0–3 | `0x139d0`–`0x139f2` |
| 3 | top-right corner | 4 × 4 at (*T*.r − 4, *T*.t) | F rows 0–3, columns 12–15 | `0x139f8`–`0x13a20` |
| 4b | box mode: bottom corners | 4 × 4 at (*T*.l, *T*.b − 4) and (*T*.r − 4, *T*.b − 4) | F rows 12–15, columns 0–3 and 12–15 | `0x13a2e`–`0x13a8a` |
| 4j | joined mode: join pieces | 2 × 3 at (*T*.l + 4, *T*.b − 3) and (*T*.r − 6, *T*.b − 3) | F rows 3–5, columns 4–5 and 10–11 | `0x13a96`–`0x13af8` |
| 5 | side columns, i = 0..3 | column *T*.l + i and column *T*.r − 1 − i, from row *T*.t + 4 to row *T*.b − 1 (joined) or *T*.b − 5 (box), inclusive | P(i, 6) and P(15 − i, 6) | `0x13b02`–`0x13b8c` |
| 6 | top rows, i = 0..2 | row *T*.t + i, columns *T*.l + 4 .. *T*.r − 5 | P(6, i) | `0x13b98`–`0x13bca` |
| 7b | box mode: bottom rows, i = 0..2 | row *T*.b − 1 − i, columns *T*.l + 4 .. *T*.r − 5 | P(6, 15 − i) | `0x13bd4`–`0x13c0e` |
| 7j | joined mode: bottom rows, i = 0..2 | row *T*.b − 1 − i, columns *T*.l + 6 .. *T*.r − 7 | P(6, 5 − i) | `0x13c16`–`0x13c50` |
| 8 | interior | (*T*.l + 4, *T*.t + 3, *T*.r − 4, *T*.b − 3) | painted with the fill colour | `0x13c6a`–`0x13c80` |
| 9 | proxy icon, if shown | §6.5 | — | `0x13c8e`–`0x13c9a` |
| 10 | title text | §5.1 | — | `0x13ca2` |
| 11 | hilited only: stripes | §5.2 | — | `0x13cac` |
| 12 | hilited only: close, zoom, collapse widgets in the normal state, each if shown | §6.1 | — | `0x13cb2`–`0x13cf2` |

If F is absent, rows 1–7 are skipped. The interior paint still runs, using whatever fill colour was sampled last (`0x13996`). That behaviour is a quirk with no defined colour.

### 5.1 Title text (`0x13ee8`)

| item | rule | source |
|---|---|---|
| resource file | the system file during the call | `0x13ef0`–`0x13ef8` |
| clip | (*L*, *T*.t, *R*, *T*.b) ∩ the current clip | `0x13f1c`–`0x13f4c` |
| pen x | title-text left, + 20 when a proxy icon is shown | `0x13f4e`–`0x13f8c` |
| baseline y | title-text top + trunc((title-text height − (ascent + descent)) / 2) + ascent, using the ascent after §3.2 | `0x13f8e`–`0x13fb6` |
| shadow pass | only if shadow ≠ text: the title at (x + 1, y + 1) in the shadow colour | `0x13fb8`–`0x13ff4` |
| main pass | the title at (x, y), foreground = text colour, background = fill colour | `0x13ff6`–`0x14006` |

### 5.2 Stripes (`0x13d98`, `0x13e22`)

| item | rule | source |
|---|---|---|
| band rows | close.t .. close.t + 12 (13 rows). The close rect is computed even when there is no close box | `0x13d98`–`0x13dbc` |
| segments | with a title: (*L*, title.l − 3) and (title.r + 3, *R*). Without a title: (*L*, *R*) | `0x13dc0`–`0x13e18` |
| minimum | a segment 7 px wide or less is skipped | `0x13e2c`–`0x13e38` |
| pattern layer | if `ppat` *id* loads: the segment is pattern-filled, pattern origin at the segment's top-left | `0x13e5c`–`0x13e84` |
| cicn layer | if `cicn` *id* is in the scheme file itself (no base-chain lookup): three-slice stretch onto the segment, drawn over the pattern | `0x13e88`–`0x13ed6` |

Three-slice stretch (`0xb44c`, cap mode 1, mask on). Let *n* = min(source width, segment width) and *h* = trunc(*n* / 2).

1. The source's left *h* columns go to the segment's first *h* columns.
2. If the source is narrower than the segment, source column *h* is stretched across the middle. When the source and segment heights match, the middle is drawn one row at a time from that column's opaque pixels. Otherwise it is scaled (`0xb31e`, `0x10320`).
3. The source's rightmost *n* − *h* columns go to the segment's last *n* − *h* columns.

Mismatched heights are scaled by the general blit (`0x10320`).

## 5A. Dialog frames (kinds 1, 2, 3, 5)

Let D be the dialog cicn (§3.5). The foreground colour is set to P_D(0, 0) first (`0x13596`). Nothing is drawn if D is absent (`0x13594`). The kind then picks a drawer:

| kind | elements, in order | source |
|---|---|---|
| 5 (movable) | shadow (as §4 row 6, coloured P_D(0, 0)); ring; gap; grow box when it belongs to the frame | `0x1302a` |
| 1 | shadow; ring; gap | `0x133ac` |
| 2 | one-pixel FrameRect of *C* outset 1 | `0x134a2` |
| 3 | FrameRect of *C* outset 1, plus a 2-px shadow: rows *C*.b + 1 and *C*.b + 2, and columns *C*.r + 1 and *C*.r + 2, each starting 2 px in | `0x134a2`–`0x13534` |

**Ring** (`0x135e2`). The ring is 3 px thick. Its outer edge is *C* outset 6, or *C* outset 3 when *thin*.

| part | pixels | colour / source | source |
|---|---|---|---|
| corners | 3 × 3 at the four corners | D rows 5–7 / 8–10 × columns 5–7 / 8–10, copied 1:1 | `0x1361a`–`0x136e4` |
| left column i (i = 0..2, outer first) | rows outer top + 3 .. outer bottom − 4, inclusive | P_D(5 + i, 7) | `0x1370c`–`0x13748` |
| right column i (outer first) | same rows | P_D(10 − i, 8) | `0x1374a`–`0x13782` |
| top row i (outer first) | columns outer left + 3 .. outer right − 4, inclusive | P_D(7, 5 + i) | `0x13784`–`0x137ba` |
| bottom row i (outer first) | same columns | P_D(8, 10 − i) | `0x137bc`–`0x137ee` |

**Gap** (kinds 1 and 5, not *thin*). The region *C* outset 3 minus *C* is painted with entry 0 of the window colour table (the content colour), or white in a non-colour port (`0x13092`–`0x13108`, `0x13420`–`0x13498`).

For kind 5, the title bar (§5, box mode) is drawn before the frame. Its last row is then overwritten by the ring's top row.

## 6. Widgets, grow box, proxy icon

### 6.1 Widget glyphs (`0x1414a`, `0xf4ba`)

The widget's 16 × 16 rect is drawn in black foreground on white background.

| step | rule | source |
|---|---|---|
| required | `ics#` *id*. If it is absent, nothing is drawn | `0xf50c`–`0xf51e` |
| colour image | `ics8` *id* from the same file as the `ics#`. If it is absent, the `ics#` 1-bit image is used | `0xf57c`–`0xf59c` |
| copy | masked by the `ics#` mask. The copy is opaque when the mask is all ones, or the port is recording a picture, or the port has custom bottlenecks | `0xf52c`–`0xf66a` |

### 6.2 Widget hit (`0x141fc`)

A point-in-icon test against the normal-state id, using IconDispatch selector `0x060D`.

### 6.3 Hit results (message 1, `0x1295e`)

Rows are tested in order; the first match wins.

| condition | result | source |
|---|---|---|
| not visible, or outside the structure | 0 | `0x1296a`–`0x129a4` |
| *grow*, not collapsed, and the point is in (grow.l, grow.t, structure.r, structure.b) | 3 if hilited, else 1 | `0x129a8`–`0x129f2` |
| in content | 1 | `0x129f6`–`0x12a0c` |
| untitled | 1 | `0x12a10` |
| hilited, in the title bar, on the close icon (or exactly at close.l + 16, close.t + 12) | 4 | `0x12a3a`–`0x12a76` |
| hilited, on the zoom icon (or exactly at zoom.l, zoom.t + 12) | 5 if the window is at its stored zoom rect within 7 px, else 6 | `0x12a7a`–`0x12ad0`, `0x14568` |
| hilited, on the collapse icon | 9 | `0x12ad4`–`0x12af2` |
| in the 6-px frame band (structure without the shadow, minus its 6-px inset) or in the title bar (+1 row) | 2 | `0x12af8`–`0x12b66` |
| otherwise | 1 | `0x12b6a` |

### 6.4 Grow box

The grow box belongs to the frame when any of these holds: *thin* and *grow* are both set; or the window is titled and not movable, and its record's flag is set. The flag is set at message 3 for Finder windows with zoom and grow. It is also set on the first message-6 call (`0x14b5e`, `0x122f6`–`0x123e2`, `0x14400`–`0x1440a`).

Once the grow box belongs to the frame, it is also cut out of the content region.

| kind | art | source |
|---|---|---|
| 0, 4 | cicn -14330 (hilited) or -14334, copied 1:1 at the grow rect's top-left | `0x144f2`–`0x14556` |
| 5 | cicn -14309 / -14310 copied 1:1 at the grow rect. If absent: the polygon through (r−2, t), (r−4, t), (l, b−4), (l, b−2), (r−2, b−2) is erased with entry 1 of `clut` -14336 (hilited) or -14335. When hilited, grip lines are drawn in entries 6 and 5 | `0x13124`–`0x1339a` |

Message 6 ("draw grow icon") applies only to a window that is visible, titled and not collapsed. Kind 5 draws only its grow box. Otherwise it draws:

- a horizontal line on row portRect.b − 15 and a vertical line on column portRect.r − 15, in P(0, 0) of the document cicn;
- the grow box, clipped to the structure and to the windows above (`0x14314`–`0x14444`, `0x14474`).

### 6.5 Proxy icon

This feature is Finder-only. It needs: windowKind 20, the Kaleidoscope option (`Aarp`), the current process being the Finder (`MACS`/`FNDR`), and an `HFS ` reference held by the window.

When all hold, the folder icon suite is plotted 16 × 16 in the title (IconDispatch `0x0603`; selected when hilited, disabled otherwise; label from the Finder info). Titles beginning "Now " are excluded (`0x149f4`, `0x14020`–`0x14140`, `0x140d8`–`0x140fc`).

Scriptoscope has no Finder windows. Treat the proxy icon as absent.

## 7. Outputs for the engine

The engine produces the structure, content and named rectangles (§3.3), plus a draw list in the orders of §4, §5, §5A and §6. Each draw op is one of:

- a cicn sub-rectangle copied 1:1 (opaque above 1 bit);
- a 1-px line in a sampled colour;
- a rectangle painted in a sampled colour;
- a pattern fill or three-slice cicn stretch (stripes);
- an icon plot (`ics#` + `ics8`);
- text in the system font.

No colour is synthesised.

## 8. Corpus impact

Resources each bundle ships that this unit reads. Counts are from `extraction-manifest.json`, baked 2026-10-18.

| bundle | frame cicns -14336/-14332 | dialog cicns -14328/-14326/-14324/-14322 | stripes -14331/-14325/-14321 | widgets `ics#`+`ics8` -14336..-14331 | grow -14330/-14334 | `clut` -14336/-14335, `actb` -14336 | -14309/-14310 |
|---|---|---|---|---|---|---|---|
| apple-platinum-2 | 16×16 both | all four, 16×16 | cicn, all three | yes (`ics4` too, unused) | 17×17 both | yes | absent → procedural kind-5 grow |
| black-platinum | 16×16 both | all four | cicn | yes; **no `ics4`** | 17×17 | yes | absent |
| platinum-8 | 16×16 both | all four | cicn | yes | 17×17 | yes | absent |
| slimes | 16×16 both | all four | **`ppat`** -14331/-14325/-14321; cicn -14325/-14321 at 32×16; no cicn -14331 | yes | 17×17 | yes | absent |
| system7-nostalgia-silver | 16×16 both | all four | cicn | yes | 17×17 | yes | absent |

The sampled points agree with this reading in all five bundles. In baked sRGB, the frame cicns' row 6, columns 0–5, read outline / highlight / face / face / shadow / outline. P(6, 3) is the bar fill. P(7, 3) is a contrasting text colour, white on #424242 for black-platinum's active frame. P(9, 3) differs from P(7, 3) in platinum-8 inactive (an embossed white shadow) and in slimes active. This is a consistency check on baked PNGs, not native evidence.

## 9. Utility family (`0x152be`–`0x17452`): what is decoded

The utility family has the same nine-message shape: draw `0x15ca2`, hit `0x15ae4`, regions `0x15826`, new `0x157b0`, dispose `0x1580a`, grow `0x15a7e`, grow icon `0x16d60`, features `0x1535c`, get region `0x1538a`.

| item | rule | source |
|---|---|---|
| flags | variation bit 0 clear → always drawn active; bit 1 → grow; bit 2 → zoom; bit 3 → side (vertical title bar on the left); bit 4 → small grow box | `0x1547e`–`0x154d8` |
| font | font 1, size 10, bold. Retried in bold + condensed when the title does not fit | `0x155e8`–`0x155f8`, `0x17128` |
| title height *H* | 15 when titled, 13 when untitled or side | `0x15600`–`0x15634` |
| title bar | (*C*.l − 4, *C*.t − *H* − 1, *C*.r + 4, *C*.t). Side: (*C*.l − *H* − 1, *C*.t − 4, *C*.l, *C*.b + 4) | `0x17048` |
| structure | *C* outset 4 with the title extension, plus the 1-px shadow | `0x1596c`, `0x15a2a` |
| widgets | 10 × 10 boxes, centred across the bar. Close 2 px from the bar's start; collapse 12 px from its end; zoom 11 px further in when collapse is shown. Each plotted as a 16 × 16 icon from the box's top-left | `0x17258`, `0x172e2`, `0x17378`, `0x16d14` |
| widget ids | close -14320 / pressed -14317; zoom -14318 / -14315; collapse -14319 / -14316 | `0x16cb8`–`0x16d0a` |
| frame cicn | side: active -14315, inactive -14319. Otherwise: active -14316, inactive -14320 | `0x15e20`–`0x15e64` |
| stripes cicn | side: -14318, falling back to -14314; otherwise -14314 | `0x1694c`–`0x16978` |
| grow | 16 × 16 at (*C*.r − 14, *C*.b − 14), or 12 × 12 with bit 4. Bit 4: cicn -14285 / -14286, else cicn -14313 / -14317 scaled 11/15. Otherwise cicn -14313 (active) / -14317 | `0x173b4`, `0x16e1e` |

Not decoded: the utility frame and stripe drawing order and its colour sample points (`0x15dec`, 2,316 bytes; `0x16920`; `0x1670c`), and the title text (`0x16aac`).

## 10. Unknowns

1. **Text-font sentinel −12345.** It is set on the port during the document bottom band and the dialog ring lines (`0x12ee8`, `0x13706`). It probably signals one of Kaleidoscope's trap patches (PACH 130), which is outside this unit.
2. **Gestalt `WdrB`.** It changes collapsed-window geometry and drawing (§3.3, §4, §5). Its owner and meaning are unknown.
3. **Variation bits 4–6.** These come from Kaleidoscope's caller. How Toolbox procIDs, Appearance procIDs (1024+) and the caller's bits map onto them is not traced.
4. **Kind-5 grow grip lines.** Their exact coordinates are partly read (`0x13234`–`0x1339a`).
5. **Zoom-state bookkeeping.** The record update in `0x14568` is only summarised.
6. **Utility frame drawing.** See §9.
7. **The 4-bit device rule** (`0xf488`). Irrelevant at 32 bpp.
8. **Gamma.** The sampled colours are cicn clut entries. The Mac → sRGB step stays a bake-time policy.
9. **Native confirmation.** No capture of these five schemes has been compared against this spec.

## 11. Effect on the current runtime

Each item is a decode finding; none has been fixed. Line numbers are against v2 `1183816e`.

| `composeCornerSprite` / table item | decode | verdict |
|---|---|---|
| `dominantColor` (bar background from the stripe sprite) and the `spriteLum < 96` dark-bar branch (`composeCornerSprite.ts:129`, `:367`) | bar fill = P(6, 3) of the frame cicn | **replaced** |
| `lighten`/`darken` bevels for the title bar and widgets (`:113`, `:122`, `:525`, `:559`); `GEOM.bevel`, `GEOM.widget.bevel` | the bevel is the sampled frame cicn rows/columns (§4, §5); no derived tones | **replaced** |
| `headerColors.frame/fill/lightBevel/darkBevel` used as ring and panel colours (`renderWindow.ts:290`) | not read; every colour is sampled from the frame/dialog cicn | **replaced** |
| title text colour from declared header colours (`titleFillSrcX: -1`) | text P(7, 3), shadow P(9, 3) at +1/+1 when different, background P(6, 3) | **replaced** |
| 1-px ring, beveled 3-px panel and `frameExtract` with `csrc` 5, `scale` 1 | 6-px frame: 6 × 6 bottom corners copied, 1-px lines from row/column 6 of the cicn, shadow P(0, 0) | **replaced** (proxy-cicn idea **confirmed**: -14332 active / -14336 inactive) |
| title height `titleH` ≈ 19 and part-0 `[1, top, 1, 1]` | *H* ≥ 22 (font-derived); sides and bottom 6; 1-px drop shadow; dialogs at outset 6 | **replaced** |
| `topBorder` 3, `insetTop`/`insetBottom`, `platePad` 6, `stripePad` 5 | stripes span the close-box rows (13); 3-px gap to the title; limits *L*/*R* | **replaced** |
| `isHorizontalLineStripe` stretch-or-tile heuristic | always a three-slice stretch for a cicn; a `ppat` is pattern-filled | **replaced** (the "stretch one interior column" idea is close to the decoded middle slice) |
| widget box 7 × 7, close at left + 4, right inset 4, gap 2 | 16 × 16 icon slots: close *T*.l + 4, collapse *T*.r − 17, zoom *T*.r − 33 / − 17, top *T*.t + 4 | close x **confirmed**; the rest **replaced** |
| widget id map close = base, zoom = base + 1, collapse = base + 2, pressed + 3 (`renderWindow.ts:300`–`302`) | zoom -14334 / -14331, collapse -14335 / -14332; utility zoom -14318 / -14315, collapse -14319 / -14316 | **wrong for zoom and collapse** (close is right) |
| widgets drawn on inactive windows | widgets and stripes are drawn only when hilited | **replaced** |
| `ics4` glyph source; `inkBounds` trimming | `ics#` (required) + `ics8`, plotted at a fixed 16 × 16 slot; `ics4` unused (black-platinum ships none) | **replaced** |
| grow box -14330 at the inner frame corner | -14330 hilited / -14334 not, 17 × 17 at (*C*.r − 15, *C*.b − 15), overlapping the frame by 2 | position **replaced**, id **confirmed** for active |
| `cicnOrPpatRecord` (cicn preferred, `ppat` fallback) | `ppat` first, then cicn over it; both when both exist | **replaced** |
| the CLAUDE.md "4 corner-sprite schemes" | the unit serves 5 schemes (adds `slimes`) | doc correction |

## 12. Test hooks

These are for a test author. Each row must be able to fail.

- For each of the five bundles and both states: the sampled fill, text and shadow equal P(6, 3), P(7, 3) and P(9, 3) of -14332 or -14336. Mutation: sample row 4 → fails.
- Structure width = content width + 12 + 1 (shadow). Height = content height + *H* + 6 + 1. Mutation: side 5 → fails.
- *H* = 22 for the system font, and *H* is odd before the floor. Mutation: drop the parity step with a 16-px font → fails.
- Zoom normal glyph id = -14334, collapse = -14335. Mutation: swap them → fails.
- No widget or stripe op is emitted when not hilited.
- A `slimes` document title emits a pattern-fill op for `ppat` -14331 and no cicn op.
- Grow rect = 17 × 17 at (*C*.r − 15, *C*.b − 15).
