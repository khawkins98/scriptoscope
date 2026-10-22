# Engine unit: built-in window frame (schemes with no `wnd#`)

Lane L7, 2026-10-21. Spec writer: L7. Verified in #383 (revision 2).
Revision 3, 2026-10-22: answers to the family-2 spec questions. It adds the utility family (§9) and rule ids TG, WP, CT, SH, TX, HT, GB, GL, M6L and U*. The revision 3 rows are not yet independently verified.
Evidence appendix: [`procedural-frame.evidence.md`](./procedural-frame.evidence.md). Implementers must not read it.

## 1. Unit id and scope

| field | value |
|---|---|
| family | window frame, built-in path (`proceduralFrame`) |
| binary | Kaleidoscope 2.3.1 kDEF 0, `kDEF/id-0-680x0_DefProcs.bin`, sha256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| document family | `0x11c58`–`0x1525a` (entered from the slot-3 gate `0x118b8`) |
| utility family | `0x152be`–`0x17452` (entered from the slot-4 gate `0x1525a`); drawing, geometry and hit test decoded, §9 |
| replaces | `src/composeCornerSprite.ts`, `src/cornerSpriteGeometry.ts`, the `CORNER_SPRITE_WINDOWS` synthesis in `tools/theme-loader/buildThemeJson.js` |

### 1.1 Verdict on the hypothesis

**Confirmed.** The region is Kaleidoscope's own window definition. It runs only when a scheme ships neither the `wnd#` recipe nor a replacement `WDEF` code resource for the family. Its art is the scheme's own cicns, `ics#`/`ics8` icons, `ppat`s, `clut`s and `actb` in the -14336..-14285 band. Its line colours are pixels sampled from those cicns. It is not Apple's WDEF 125. It does not use `headerColors` or `Colr`, and it computes no colours.

| gate step (document family) | outcome | source |
|---|---|---|
| `wnd#` -14336 present | the recipe compositor runs (slot 6); this unit is not used | `0x118e4`–`0x11912` |
| `wnd#` absent, `WDEF` -14330 present with a non-empty handle | that code resource is called with the original arguments; this unit is not used | `0x11916`–`0x11c54` |
| both absent | this unit: per-call setup (§3), then dispatch on the WDEF message (§2) | `0x11c58`–`0x11ec2` |

The utility gate is shorter. It checks only `wnd#` -14304: if present, the compositor runs with message base 1984. If absent, it goes straight to its own nine-message table (`0x152be`–`0x152fc`). There is no `WDEF` step (`0x1525a`–`0x152a0`).

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

The widget parts draw pressed or released according to a toggle bit. The bit is not per-window: it is bit 0 of one byte shared by every window of both families (the utility family uses the same byte, §9.8). Its address comes from the module's initial data, and nothing in kDEF 0 sets it to another byte.

| id | rule | source |
|---|---|---|
| TG1 | a draw call with part 0, 1, 2 or 3 clears the bit before it draws. Every full-frame draw therefore leaves it clear | `0x12bea`–`0x12c02` |
| TG2 | parts 4, 5/6 and 9 draw the pressed glyph when the bit is clear and the normal glyph when it is set. They are not gated on *hilited* | `0x12c04`–`0x12c12`, `0x12d0a`–`0x12d34` |
| TG3 | after a part-4, 5, 6, 9 or 258 call the bit flips. Other parts leave it as they found it (so after TG1 it stays clear) | `0x12d36`–`0x12d4e`, `0x12d5e` |
| TG4 | the bit's value before the first call of a session is the byte's power-on content, which is not decoded. After any full-frame draw the first widget call draws pressed, the next one normal, and so on | TG1–TG3 |

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
| title bar *T*, when the structure region is non-empty and Gestalt `WdrB` answers | structure bounding box, height *H*, right − 1. For an uncollapsed window this equals the rows above | `0x146ae`–`0x146c4`, `0x14712`–`0x14730` |
| widget top *wy* | *T*.t + trunc((*H* + 1 − 13) / 2) − 1, which is *T*.t + 4 when *H* = 22 | `0x148a2`–`0x148ce` |
| close | 16 × 16 at (*T*.l + 4, *wy*) | `0x148a2` |
| collapse | 16 × 16 at (*T*.r − 17, *wy*) | `0x14904` |
| zoom | 16 × 16 at (*T*.r − 17, *wy*), or (*T*.r − 33, *wy*) when a collapse box is shown | `0x1496c` |
| grow | (*C*.r − 15, *C*.b − 15, *C*.r + 2, *C*.b + 2), 17 × 17. For kind 5 without *thin*, offset (+3, +3) | `0x1499a` |
| title left limit *L* | close.l + 17 if *goAway*, else *T*.l + 5 | `0x1480c` |
| title right limit *R* | zoom.l − 4 if variation bit 3, else collapse.l − 4 if a collapse box is shown, else *T*.r − 5 | `0x14848` |
| title text | width *w* = StringWidth(title), plus 20 when a proxy icon is shown. Left = max(*L*, *T*.l + trunc((*T*.w − *w*) / 2)). Right = left + *w*. Vertical extent = *T* inset 3 top and bottom. Empty when the title is empty | `0x14784` |
| proxy icon | 16 × 16 at the title-text left, vertically centred in it | `0x1473a` |

**Widget presence** (`0x121ce`–`0x12264`). A widget starts as shown under its "shown when" column. Narrow windows then drop widgets that would overlap the close rect. The tests always use the computed close rect from the table above, whether or not the window has a close box. "∩" is SectRect `$A8AA` (non-empty intersection). Each rect is the plain 16 × 16 rect, with no outset.

| widget | shown when | source |
|---|---|---|
| close | *goAway* | `0x13cb6` |
| zoom | *zoom* | `0x121dc` |
| collapse | *shadeOn*, *titled*, not *movable* | `0x14b40` |

| id | case | test | effect | source |
|---|---|---|---|---|
| WP1 | *goAway* and *zoom* | zoom ∩ close, with the zoom rect as placed while the collapse box is still shown | if empty: nothing changes. Otherwise the collapse box is dropped, the zoom rect is recomputed at *T*.r − 17, and if the new zoom rect still meets close the zoom box is dropped as well | `0x121dc`–`0x12222` |
| WP2 | *goAway*, no *zoom* | collapse ∩ close (only when *shadeOn*) | non-empty: the collapse box is dropped | `0x12224`–`0x12242` |
| WP3 | no *goAway*, *zoom* and *shadeOn* | collapse ∩ close | non-empty: the collapse box is dropped. The zoom box is never dropped in this case | `0x12244`–`0x12264` |
| WP4 | no *goAway*, no *zoom* | none | nothing is dropped | `0x12244`–`0x12248` |

The drops change only the widget flags: the zoom flag used by the hit test (§6.3) and the collapse flag. The title right limit *R* still tests variation bit 3 itself (`0x14852`), so a dropped zoom box still moves *R* to zoom.l − 4.

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

"The window colour table" is the colour table attached to the window's auxiliary record (GetAuxWin `$AA42`). When an application sets none, that is the Window Manager's default table. kDEF 0 does not contain it, so its content colour is an environment input. "Entry *n*" of a colour table is found by value, not by position (`0x10702`):

| id | rule | source |
|---|---|---|
| CT1 | if *n* ≤ the table's last index and the entry at position *n* has value *n*, that entry is used | `0x1070e`–`0x1071c` |
| CT2 | otherwise, if the last entry's value is 0, the entry at position *n* is used | `0x1071e`–`0x10728` |
| CT3 | otherwise the table is searched from the last entry down to position 0 for value *n*; the first match is used, else position 0 | `0x1072c`–`0x10748` |
| CT4 | the colour is the entry's stored 16-bit red, green and blue. The alert comparison is exact equality of all three stored channels. No gamma or display transform comes first | `0x1074a`–`0x1075c`, `0x14cf2`–`0x14d12` |

The same lookup serves the gap paint (§5A, entry 0) and the `clut` entries of the kind-5 grow box (§6.4). In the `actb` -14336 of each of the five bundles (§8) the entry at position 0 has value 0. CT1 therefore reads position 0 there, and the index-0 reading gives the same colour.

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
| 6 | drop shadow (SH1) | row *B* from column *L*+2 to *R*; column *R* from row *C*.t−*H*+2 to *B* | P(0, 0) | `0x12fb6`–`0x12fe6` |
| 7 | grow box, if it belongs to the frame (§6.4) | grow rect | §6.4 | `0x13002`–`0x1301a` |

*L*, *R* and *B* come from the bounding box of the structure region as calculated (§3.3), not from *C*: *L* = box.l, *R* = box.r − 1, *B* = box.b − 1, and the shadow's top end is box.t + 2 (`0x12dc8`–`0x12df8`). For an uncollapsed window these equal *C*.l − 6, *C*.r + 6, *C*.b + 6 and *C*.t − *H* + 2.

| id | window | shadow | source |
|---|---|---|---|
| SH1 | not collapsed | as row 6 | `0x12fb6`–`0x12fe6` |
| SH2 | collapsed | the same rule applied to the collapsed structure (the title bar plus its shadow, §3.3): row *T*.b from *T*.l + 2 to *T*.r, and column *T*.r from *T*.t + 2 down to *T*.b. It is never drawn at *C*.b + 6. When the collapsed structure is 5 px taller (`WdrB`, §3.3), the row moves down with it | `0x12dc8`–`0x12df8`, `0x12fb6`–`0x12fe6` |

When collapsed, rows 1–5 are skipped and only the shadow is drawn, with one exception: Gestalt `WdrB` answers and content.top − structure.top ≠ *H*. In that case the rows are drawn, starting at structure.top + *H* (`0x12e28`–`0x12e64`). While row 3 is drawn, the port's text font holds the sentinel −12345 (`0x12ee8`). Its effect is outside this binary (§10).

The corner copy is opaque (CopyBits srcCopy) for cicns deeper than 1 bit, so the mask is ignored. A 1-bit cicn is copied with its mask (`0xfdf8`–`0xfe90`).

## 5. Title bar (titled kinds): drawing

Let F be the frame cicn from §3.5. In a dialog-kind title, F is the dialog cicn. *T* is the title bar from §3.3. The mode is chosen as follows (`0x138e0`–`0x1394e`):

| window | mode |
|---|---|
| kind 5 | box |
| kinds 0/4, not collapsed | joined |
| kinds 0/4, collapsed, Gestalt `WdrB` does not answer | box |
| kinds 0/4, collapsed, `WdrB` answers, content.top − structure.top = *H* | box |
| kinds 0/4, collapsed, `WdrB` answers, content.top − structure.top ≠ *H* | joined |

This is the same test that §4 uses for skipping the frame edges: box mode coincides with the frame edges being skipped.

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
| TX1 transfer mode | neither pass sets a text mode. With the off-screen GWorld, the GWorld copies the screen port's text mode (`0x138be`–`0x138c6`). Without it, the drawing port is the colour Window Manager port, whose text state setup copies from the Window Manager port (`0x11fda`–`0x120be`). The mode is therefore the Window Manager port's text mode, which kDEF 0 never chooses. **Declared default:** srcOr, the Toolbox's initial text mode for a port. Under srcOr the background colour has no effect and the shadow pass stays visible under the main pass | `0x1382c`–`0x138dc`, `0x13ff6` |

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

**Gap** (kinds 1 and 5, not *thin*). The region *C* outset 3 minus *C* is painted with entry 0 of the window colour table (the content colour, looked up by CT1–CT3), or white in a non-colour port (`0x13092`–`0x13108`, `0x13420`–`0x13498`).

For kind 5, the title bar (§5, box mode) is drawn before the frame. Its last row is then overwritten by the ring's top row.

## 6. Widgets, grow box, proxy icon

### 6.1 Widget glyphs (`0x1414a`, `0xf4ba`)

The widget's 16 × 16 rect is drawn in black foreground on white background.

| step | rule | source |
|---|---|---|
| required | `ics#` *id*. If it is absent, nothing is drawn | `0xf50c`–`0xf51e` |
| colour image | `ics8` *id* from the same file as the `ics#`. If it is absent, the `ics#` 1-bit image is used | `0xf57c`–`0xf59c` |
| copy, 1-bit image | masked by the `ics#` mask. Opaque instead when the mask is all ones, the port is recording a picture, or the port has custom bottlenecks | `0xf5dc`–`0xf61a` |
| copy, `ics8` image | masked by the `ics#` mask. Opaque instead when the mask is all ones or the port is recording a picture. Custom bottlenecks are not tested on this path | `0xf630`–`0xf66a` |

### 6.2 Widget hit (`0x141fc`)

A point-in-icon test against the normal-state id, using IconDispatch selector `0x060D`.

### 6.3 Hit results (message 1, `0x1295e`)

Rows are tested in order; the first match wins.

| id | condition | result | source |
|---|---|---|---|
| HT1 | not visible, or outside the structure region | 0 | `0x1296a`–`0x129a4` |
| HT2 | *grow*, not collapsed, and the point is in (grow.l, grow.t, box.r, box.b), where box is the structure region's bounding box, shadow included | 3 if hilited, else 1 | `0x129a8`–`0x129f2` |
| HT3 | in content | 1 | `0x129f6`–`0x12a0c` |
| HT4 | untitled | 1 | `0x12a10` |
| HT5 | hilited, in the title bar *T*, the window has a close box (*goAway*), and the point is on the close icon or exactly at (*T*.l + 16, *T*.t + 12) | 4 | `0x12a1e`–`0x12a76` |
| HT6 | hilited, in *T*, the zoom flag is still set after the drops of §3.3 (WP1), and the point is on the zoom icon or exactly at (*T*.r − 16, *T*.t + 12) | 5 if the window is at its stored zoom rect within 7 px, else 6 | `0x12a7a`–`0x12ad0`, `0x14568` |
| HT7 | hilited, in *T*, a collapse box is shown (§3.3 after the drops), and the point is on the collapse icon | 9 | `0x12ad4`–`0x12af2` |
| HT8 | in the drag area: the 6-px frame band, plus *T* extended by one row at the bottom (*T*.b + 1). The band is the box (*structure bounding box* with right − 1 and bottom − 1, so without the shadow) minus that box inset 6 | 2 | `0x12af8`–`0x12b66` |
| HT9 | otherwise | 1 | `0x12b6a`, `0x12b7e` |

HT5–HT7 are tested in this order only while the point is in *T* and the window is hilited. A miss on all three goes to HT8. Each icon test (§6.2) runs only when its widget is present; an absent widget never answers.

### 6.4 Grow box

The grow box belongs to the frame when any of these holds: *thin* and *grow* are both set; or the window is titled and not movable, and its record's flag is set. The flag is set at message 3 for Finder windows with zoom and grow. It is also set on the first message-6 call (`0x14b5e`, `0x122f6`–`0x123e2`, `0x14400`–`0x1440a`).

Once the grow box belongs to the frame, it is also cut out of the content region.

| id | kind | art | source |
|---|---|---|---|
| GB1 | 0, 4 | cicn -14330 (hilited) or -14334, its whole image at natural size with its top-left at the grow rect's top-left, **through its mask** (GB3) | `0x144f2`–`0x14556` |
| GB2 | 5 | cicn -14309 / -14310 the same way (GB3). If absent: the procedural box (GB4, GL1–GL6) | `0x13124`–`0x13188` |

**Copy modes for cicn art.** This unit uses two cicn copies, and they treat the mask differently.

| id | copy | used by | rule | source |
|---|---|---|---|---|
| GB3 | masked copy | GB1, GB2, the utility frame corners (§9.4), the utility grow box (§9.7) | in a colour port above the 4-bit rule, the cicn's pixel image is copied through its mask with CopyMask `$A817` (source, mask and destination rects the same size, so no scaling). The masked-off pixels keep what is underneath. When the port records a picture or has custom bottlenecks, the mask is turned into a region (BitMapToRegion `$A8D7`, mapped onto the destination) and the image is copied with CopyBits `$A8EC` in srcCopy through that region, with the same result. In a non-colour port, or under the 4-bit rule, the cicn's 1-bit image is used instead | `0x10320`–`0x10418` |
| GB3a | opaque copy | the document-frame corners (§4 rows 1–2), the title corners and join pieces (§5), the ring corners (§5A), the utility stripes (§9.5) | as stated in §4: CopyBits srcCopy with no mask for cicns deeper than 1 bit; a 1-bit cicn goes through CopyMask | `0xfdf8`–`0xfe90` |

The masked copy also skips the call when the destination lies wholly above or below the port's clip region's bounding box (`0x10362`–`0x10374`). That changes no pixels.

**Procedural kind-5 grow box** (`0x1318c`–`0x1339a`). Let g be the grow rect (§3.3), with r = g.r, b = g.b, l = g.l, t = g.t.

| id | step | rule | source |
|---|---|---|---|
| GB4 | region | the closed path (r − 2, t) → (r − 4, t) → (l, b − 4) → (l, b − 2) → (r − 2, b − 2) → (r − 2, t), recorded as a region (OpenRgn `$A8DA` … CloseRgn `$A8DB`) | `0x13192`–`0x131ee` |
| GB5 | colour table | `clut` -14336 when hilited, else -14335 (GetResource, any open file). If absent, nothing more is drawn | `0x131f0`–`0x13212` |
| GB6 | erase | the background colour is set to entry 1 (CT1–CT3), then the region is erased (EraseRgn `$A8D4`) | `0x13216`–`0x13224` |
| GL1 | not hilited | no grip lines | `0x13226`–`0x13230` |
| GL2 | hilited: light lines | foreground = entry 6; three lines, each drawn MoveTo then two LineTo calls: (r − 4, t + 3) → (l + 3, b − 4) → (l + 2, b − 4); (r − 4, t + 7) → (l + 7, b − 4) → (l + 6, b − 4); (r − 4, t + 11) → (l + 11, b − 4) → (l + 10, b − 4) | `0x13234`–`0x132e0` |
| GL3 | hilited: dark lines | foreground and background = entry 5; (r − 4, t + 2) → (r − 5, t + 2) → (l + 2, b − 5); (r − 4, t + 6) → (r − 5, t + 6) → (l + 6, b − 5); (r − 4, t + 10) → (r − 5, t + 10) → (l + 10, b − 5) | `0x132e2`–`0x1339a` |
| GL4 | pen | the port's pen as left by the per-call setup (PenNormal: 1 × 1, pattern black, patCopy) | `0x11fda`–`0x120be` |

With the 17 × 17 grow rect every diagonal is exactly 45°, so each line's pixels are unambiguous. The pixels that GB4's region covers along its diagonal edge come from QuickDraw's region-from-lines rasterisation. That is Toolbox behaviour, not something kDEF 0 encodes; implement it as QuickDraw does. **Not decoded** in this unit beyond the vertex list. Kind 5 has its own grow box only when *thin* and *grow* are both set (§6.4 first paragraph).

**Message 6** ("draw grow icon") applies only to a window that is visible, titled and not collapsed (`0x14298`–`0x142f2`). Kind 5 draws only its grow box (GB2), with no lines (`0x142f6`–`0x14310`). Otherwise:

| id | step | rule | source |
|---|---|---|---|
| M6L1 | port and pen | drawn in the window's own port, in local coordinates, after a pen reset (PenNormal, the standard pen and background patterns). The port's clip and visible region are left as they are | `0x14314`–`0x1432e`, `0xe978`–`0xe9ec` |
| M6L2 | colour | foreground = P(0, 0) of the document frame cicn, -14332 when hilited, else -14336. If that cicn is absent, the foreground left by the pen reset is used | `0x14334`–`0x14378` |
| M6L3 | horizontal line | MoveTo (portRect.l, portRect.b − 15), LineTo (portRect.r, portRect.b − 15): the full width of the port rectangle. The end pixel at column portRect.r lies outside the port rectangle and is clipped by the port | `0x1437c`–`0x14394` |
| M6L4 | vertical line | MoveTo (portRect.r − 15, portRect.t), LineTo (portRect.r − 15, portRect.b − 15) | `0x14396`–`0x143a8` |
| M6L5 | record flag | for a titled, non-movable window whose grow box does not yet belong to the frame: the record flag is set, and the grow rect is cut out of the content region when *grow* | `0x143aa`–`0x14442` |
| M6L6 | grow box | GB1, in the Window Manager port, clipped to the structure region minus the windows above (ClipAbove `$A90B`). Skipped when an application is current and the window's port pixels are not the Window Manager port's (an off-screen port) | `0x14444`, `0x14474`–`0x144ee`, `0xe752` |

### 6.5 Proxy icon

This feature is Finder-only. It needs: windowKind 20, the Kaleidoscope option (`Aarp`), the current process being the Finder (`MACS`/`FNDR`), and an `HFS ` reference held by the window.

When all hold, the folder icon suite is plotted 16 × 16 in the title (IconDispatch `0x0603`; selected when hilited, disabled otherwise; label from the Finder info). Titles beginning "Now " are excluded (`0x149f4`, `0x14020`–`0x14140`, `0x140d8`–`0x140fc`).

Scriptoscope has no Finder windows. Treat the proxy icon as absent.

## 7. Outputs for the engine

The engine produces the structure, content and named rectangles (§3.3), plus a draw list in the orders of §4, §5, §5A and §6. Each draw op is one of:

- a cicn sub-rectangle copied 1:1, either opaque above 1 bit (GB3a) or through the cicn's mask (GB3), as each row states;
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

The sampled points agree with this reading in all five bundles. In baked sRGB, the frame cicns' row 6, columns 0–5, usually read outline / highlight / face / face / shadow / outline. There are exceptions: platinum-8 -14336 is flat #c6c6c6; black-platinum -14336 has face in column 4; slimes -14332 has a column-5 outline (#787878) different from column 0 (#004400). The decode does not depend on the pattern. It only says these pixels are sampled. P(6, 3) is the bar fill. P(7, 3) is a contrasting text colour, white on #424242 for black-platinum's active frame. P(9, 3) differs from P(7, 3) in platinum-8 inactive (an embossed white shadow) and in slimes active. This is a consistency check on baked PNGs, not native evidence.

## 9. Utility family (`0x152be`–`0x17452`)

The utility family has the same nine-message shape: draw `0x15ca2`, hit `0x15ae4`, regions `0x15826`, new `0x157b0`, dispose `0x1580a`, grow `0x15a7e`, grow icon `0x16d60`, features `0x1535c`, get region `0x1538a`. Its flags come only from the variation code and the window record. It has no window kinds, no alert colouring and no proxy icon.

### 9.1 Inputs

| id | name | rule | source |
|---|---|---|---|
| UI1 | *alwaysActive* | variation bit 0 clear | `0x154cc`–`0x154d8` |
| UI2 | *grow* | variation bit 1 | `0x1549c`–`0x154a8` |
| UI3 | *zoom* | variation bit 2 | `0x154ac`–`0x154b8` |
| UI4 | *side* | variation bit 3: the title bar is vertical, on the left | `0x154bc`–`0x154c8` |
| UI5 | *smallGrow* | variation bit 4: the 12 × 12 grow box | `0x15486`–`0x15492` |
| UI6 | *active* ("drawn active") | WindowRecord `hilited`, or *alwaysActive* | `0x1740e`–`0x17428` |
| UI7 | *goAway* | WindowRecord `goAwayFlag` | `0x156d6`, `0x17180` |
| UI8 | *shadeOn* | bit 0 of the Gestalt `Aarn` response. When `Aarn` does not answer, the flag is not rewritten and keeps its value from the previous call; it is 0 in the module's initial data | `0x1565a`–`0x15674`, `0x15690` |
| UI9 | font | font 1 (the application font), size 10, bold, set for every call. The ascent and descent below are that font's | `0x155e8`–`0x155fe` |
| UI10 | *H* | 13 when *side*. Otherwise 15 when the window title is non-empty, else 13 | `0x15600`–`0x15634` |
| UI11 | *collapsed* | as §3.1 *collapsed* | `0xf078` |

"Titled" has no other meaning in this family. The flag that `0x15622` records is never read. It affects nothing beyond *H*. In particular it does not gate widgets, stripes or the frame.

### 9.2 Geometry

*C* is the content rectangle in global coordinates (`0x16fd2`, the same rule as `0x14620`). trunc/2 rounds toward zero. Rectangles are (left, top, right, bottom), right and bottom exclusive.

| id | rect | rule | source |
|---|---|---|---|
| UG1 | title bar *T* | (*C*.l − 4, *C*.t − *H* − 1, *C*.r + 4, *C*.t). *side*: (*C*.l − *H* − 1, *C*.t − 4, *C*.l, *C*.b + 4). The bar's thickness *t* is *H* + 1 | `0x17048`–`0x1709e` |
| UG2 | structure | *C* outset 4, then the top (*side*: the left) moved out by a further *H* − 3, so it shares *T*'s outer edge. Then the shadow: the union with its bounding box with right and bottom − 1, shifted (+2, +2) | `0x1596c`–`0x159ba`, `0x15a2a`–`0x15a7c` |
| UG3 | structure, collapsed | *T* plus the same shadow. The content becomes empty, a degenerate rect at *C*'s top edge (*side*: its left edge) | `0x159bc`–`0x15a28` |
| UG4 | content | *C*, minus the grow rect when *smallGrow* and *grow* | `0x15912`–`0x15968` |
| UG5 | close box | horizontal: left *T*.l + 2, top *T*.t + trunc((*t* + 1 − 10) / 2), 10 × 10. *side*: top *T*.t + 2, left *T*.l + trunc((*t* + 1 − 10) / 2) | `0x17258`–`0x172e0` |
| UG6 | collapse box | horizontal: left *T*.r − 12, same top, 10 × 10. *side*: top *T*.b − 12, same left | `0x172e2`–`0x17376` |
| UG7 | zoom box | the collapse box, moved 11 px toward the bar's start (left, or up for *side*) when *shadeOn* is still set after UP1–UP4 | `0x17378`–`0x173b2` |
| UG8 | title left limit *Lu* | horizontal: close.r + 2 when *goAway*, else *T*.l + 5. *side*: close.b + 2, else *T*.t + 5 | `0x17176`–`0x171d0` |
| UG9 | title right limit *Ru* | horizontal: zoom.l − 2 when *zoom* (after UP1–UP4), else collapse.l − 2 when *shadeOn*, else *T*.r − 5. *side*: the same with top / *T*.b | `0x171d2`–`0x17256` |
| UG10 | grow rect | (*C*.r − 14, *C*.b − 14, *C*.r + 2, *C*.b + 2), 16 × 16. *smallGrow*: (*C*.r − 10, *C*.b − 10, *C*.r + 2, *C*.b + 2), 12 × 12 | `0x173b4`–`0x1740c` |

For the two bar heights that occur, the UG5 centring gives a top of *T*.t + 3 when *H* = 15 and *T*.t + 2 when *H* = 13. The formula uses the bar thickness plus one, (*H* + 2 − 10) / 2. For odd *H* that equals trunc((*H* + 1 − 10) / 2).

### 9.3 Widget presence

Each widget is a 10 × 10 box (UG5–UG7) drawn as a 16 × 16 icon from the box's top-left (§9.6).

| widget | shown when | source |
|---|---|---|
| close | *goAway* | `0x156d6`, `0x16768` |
| zoom | *zoom* | `0x167ac` |
| collapse | *shadeOn* | `0x167ee`, `0x1742a` |

Narrow windows then drop widgets (per-call setup, `0x15694`–`0x15776`). Unlike the document family, the close, zoom and collapse rects are first outset by 7 on every side (written c⁺, z⁺, k⁺). The test is SectRect `$A8AA`.

| id | case | rule | source |
|---|---|---|---|
| UP1 | *goAway* and *zoom* | if z⁺ ∩ c⁺ is non-empty: *shadeOn* is cleared, the zoom box is recomputed (UG7, now with no shift and **no outset**), and if that zoom box still meets c⁺, *zoom* is cleared | `0x156e4`–`0x1572a` |
| UP2 | *goAway*, no *zoom* | if *shadeOn* and k⁺ ∩ c⁺ is non-empty: *shadeOn* is cleared | `0x1572c`–`0x1574a` |
| UP3 | no *goAway*, *zoom* and *shadeOn* | if k⁺ ∩ c⁺ is non-empty: *shadeOn* is cleared. *zoom* is never cleared here | `0x1574c`–`0x1576c` |
| UP4 | no *goAway*, no *zoom* | nothing is dropped | `0x1574c`–`0x15750` |

The cleared flags hold for the whole call: they move the zoom box (UG7) and the right limit (UG9), and they gate drawing (§9.6) and hits (§9.9).

### 9.4 Frame (`0x15dec`)

**Art.** Let Q be the utility frame cicn and P(x, y) its pixel colour, sampled as in §3.5.

| id | rule | source |
|---|---|---|
| UFA1 | *side*: Q = cicn -14315 when *active*, else -14319. Otherwise: Q = cicn -14316 when *active*, else -14320 | `0x15e20`–`0x15e6c` |
| UFA2 | if the inactive cicn is absent, the active one of the same orientation is used | `0x15e6e`–`0x15e98` |
| UFA3 | if Q is still absent, nothing in §9.4 is drawn and no colours are sampled. The later steps (§9.5–§9.7) still run, with colours left over from an earlier call, and the fill (UW5) then covers the whole structure. That behaviour is a quirk with no defined colour | `0x15e9a`–`0x15e9c` |

Every frame cicn in the corpus is 12 × 12, which is the size the rows below assume. Corner and join pieces use the masked copy (GB3). Lines are 1-px MoveTo/LineTo `$A893`/`$A891` lines in the sampled colour, endpoints inclusive.

Let box be the structure region's bounding box (shadow included): *Fl* = box.l, *Ft* = box.t, *Fr* = box.r − 1 and *Fb* = box.b − 1 (`0x15df4`–`0x15e1c`). For an uncollapsed horizontal window these are (*C*.l − 4, *C*.t − *H* − 1, *C*.r + 4, *C*.b + 4). For *side* they are (*C*.l − *H* − 1, *C*.t − 4, *C*.r + 4, *C*.b + 4). Collapsed, they are *T*'s edges.

**Collapsed** (any orientation, `0x15eb2`–`0x16086`): a 2-px box.

| id | order | element | pixels | source pixels / colour | source |
|---|---:|---|---|---|---|
| UFC1 | 1 | four corners | 2 × 2 at (*Fl*, *Ft*), (*Fr* − 2, *Ft*), (*Fl*, *Fb* − 2), (*Fr* − 2, *Fb* − 2) | Q rows 0–1 / 10–11 × columns 0–1 / 10–11, matching each corner | `0x15eb2`–`0x15f6e` |
| UFC2 | 2 | left column i (i = 0, 1) | column *Fl* + i, rows *Ft* + 2 .. *Fb* − 3 | P(i, 6) | `0x15fc2`–`0x15fda` |
| UFC3 | 2 | right column i | column *Fr* − 1 − i, same rows | P(11 − i, 6) | `0x15fdc`–`0x16008` |
| UFC4 | 2 | top row i | row *Ft* + i, columns *Fl* + 2 .. *Fr* − 3 | P(6, i) | `0x1600a`–`0x16026` |
| UFC5 | 2 | bottom row i | row *Fb* − 1 − i, same columns | P(6, 11 − i) | `0x16028`–`0x16052` |
| UFC6 | — | interior | (*Fl* + 2, *Ft* + 2, *Fr* − 2, *Fb* − 2) | becomes the interior region (UW1) | `0x16066`–`0x16084` |

Row 2 is drawn for i = 0 and then i = 1, each i drawing the four lines in the order listed.

**Horizontal, not collapsed** (`0x16356`–`0x16614`).

| id | order | element | pixels | source pixels / colour | source |
|---|---:|---|---|---|---|
| UFH1 | 1 | top-left corner | 3 × 3 at (*Fl*, *Ft*) | Q rows 0–2, columns 0–2 | `0x16356`–`0x1637e` |
| UFH2 | 2 | top-right corner | 3 × 3 at (*Fr* − 3, *Ft*) | Q rows 0–2, columns 9–11 | `0x16384`–`0x163b2` |
| UFH3 | 3 | bottom-left corner | 4 × 4 at (*Fl*, *Fb* − 4) | Q rows 8–11, columns 0–3 | `0x163b8`–`0x163e8` |
| UFH4 | 4 | bottom-right corner | 4 × 4 at (*Fr* − 4, *Fb* − 4) | Q rows 8–11, columns 8–11 | `0x163ee`–`0x16418` |
| UFH5 | 5 | left join | 2 × 3 at (*C*.l − 2, *C*.t − 3) | Q rows 3–5, columns 2–3 | `0x1641e`–`0x1644c` |
| UFH6 | 6 | right join | 2 × 3 at (*C*.r, *C*.t − 3) | Q rows 3–5, columns 8–9 | `0x16452`–`0x1647c` |
| UFH7 | 7 | top rows, i = 0..2 | row *Ft* + i, columns *Fl* + 2 .. *Fr* − 4 | P(4, i) | `0x16482`–`0x164c0` |
| UFH8 | 8 | bottom rows, i = 0..3 | row *Fb* − 1 − i, columns *Fl* + 4 .. *Fr* − 5 | P(4, 11 − i) | `0x164c2`–`0x16508` |
| UFH9 | 9 | left column i, i = 0..3 | column *Fl* + i, from row *Ft* + 2 (i = 0, 1) or *C*.t (i = 2, 3) down to *Fb* − 5 | P(i, 6) | `0x1650a`–`0x16556` |
| UFH10 | 9 | right column i | column *Fr* − 1 − i, same rows as UFH9 | P(11 − i, 6) | `0x16558`–`0x16592` |
| UFH11 | 10 | separator rows, i = 0..2 | row *C*.t − 1 − i, columns *C*.l .. *C*.r − 1 | P(4, 5 − i) | `0x1659e`–`0x165e4` |
| UFH12 | — | interior | (*Fl* + 2, *Ft* + 3, *Fr* − 2, *C*.t − 3) | becomes the interior region (UW1) | `0x165e6`–`0x16614` |

Rows 9 draw, for each i in turn, the left column and then the right column. The frame is thus 4 px wide beside the content and 2 px wide beside the bar. It has 3 rows on top and 4 at the bottom, and a 3-row separator between bar and content.

***side*, not collapsed** (`0x1608a`–`0x16352`). This is the horizontal frame transposed.

| id | order | element | pixels | source pixels / colour | source |
|---|---:|---|---|---|---|
| UFS1 | 1 | top-left corner | 3 × 3 at (*Fl*, *Ft*) | Q rows 0–2, columns 0–2 | `0x16092`–`0x160ba` |
| UFS2 | 2 | bottom-left corner | 3 × 3 at (*Fl*, *Fb* − 3) | Q rows 9–11, columns 0–2 | `0x160c0`–`0x160ee` |
| UFS3 | 3 | top-right corner | 4 × 4 at (*Fr* − 4, *Ft*) | Q rows 0–3, columns 8–11 | `0x160f4`–`0x16124` |
| UFS4 | 4 | bottom-right corner | 4 × 4 at (*Fr* − 4, *Fb* − 4) | Q rows 8–11, columns 8–11 | `0x1612a`–`0x16154` |
| UFS5 | 5 | top join | 3 × 2 at (*C*.l − 3, *C*.t − 2) | Q rows 2–3, columns 3–5 | `0x1615a`–`0x16188` |
| UFS6 | 6 | bottom join | 3 × 2 at (*C*.l − 3, *C*.b) | Q rows 8–9, columns 3–5 | `0x1618e`–`0x161b8` |
| UFS7 | 7 | left columns, i = 0..2 | column *Fl* + i, rows *Ft* + 2 .. *Fb* − 4 | P(i, 4) | `0x161be`–`0x161fc` |
| UFS8 | 8 | right columns, i = 0..3 | column *Fr* − 1 − i, rows *Ft* + 4 .. *Fb* − 5 | P(11 − i, 4) | `0x161fe`–`0x16244` |
| UFS9 | 9 | top row i, i = 0..3 | row *Ft* + i, from column *Fl* + 2 (i = 0, 1) or *C*.l (i = 2, 3) to *Fr* − 5 | P(6, i) | `0x16246`–`0x16292` |
| UFS10 | 9 | bottom row i | row *Fb* − 1 − i, same columns as UFS9 | P(6, 11 − i) | `0x16294`–`0x162ce` |
| UFS11 | 10 | separator columns, i = 0..2 | column *C*.l − 1 − i, rows *C*.t .. *C*.b − 1 | P(5 − i, 4) | `0x162da`–`0x16320` |
| UFS12 | — | interior | (*Fl* + 3, *Ft* + 2, *C*.l − 3, *Fb* − 2) | becomes the interior region (UW1) | `0x16322`–`0x16350` |

**Tail** (every orientation, after the rows above, `0x16616`–`0x166ec`).

| id | order | element | rule | source |
|---|---:|---|---|---|
| UFT1 | 1 | sample colours | horizontal: fill = P(4, 3), text = P(5, 3), shadow = P(7, 3). *side*: fill = P(3, 4), text = P(3, 5), shadow = P(3, 7). Collapsed windows use the rule of their orientation | `0x16616`–`0x1668e` |
| UFT2 | 2 | small grow box | when *smallGrow* and *grow*: §9.7 at the grow rect | `0x16692`–`0x166b2` |
| UFT3 | 3 | drop shadow | P(0, 0): row *Fb* from column *Fl* + 2 to *Fr*, then column *Fr* from *Fb* up to row *Ft* + 2 | `0x166b4`–`0x166e2` |

The normal-size grow box is not part of the frame. Only message 6 draws it (§9.8).

### 9.5 Stripes (`0x16840`, `0x16920`)

Drawn only when *active* (`0x16736`).

| id | rule | source |
|---|---|---|
| US1 | band: horizontal, rows *T*.t + trunc((*t* − 8) / 2) .. + 9 (9 rows), columns *Lu* .. *Ru*. *side*: columns *T*.l + trunc((*t* − 8) / 2) .. + 9, rows *Lu* .. *Ru* | `0x16872`–`0x168ec` |
| US2 | clip: the current clip ∩ the interior region (UW1), then ∩ the band | `0x16862`–`0x16870`, `0x16988`–`0x1699e` |
| US3 | art: horizontal: cicn -14314. *side*: cicn -14318, else -14314. Both come from the normal cicn lookup, base chain included. Absent → nothing is drawn, but the band is still removed from the interior region (US6) | `0x1694c`–`0x16984` |
| US4 | band narrower than 4 px across its length (horizontal: width; *side*: height) → the band is painted with the fill colour instead | `0x16a1c`–`0x16a2a`, `0x16a82`–`0x16a8c`, `0x169a6`–`0x169b2`, `0x16a0e`–`0x16a18` |
| US5 | otherwise the cicn is tiled 1:1 with the opaque copy (GB3a). Horizontal: the source is the cicn's top 9 rows at full width w. Copies go at (band.l + k·w, band.t) for k = 0, 1, … while the copy's left edge is left of band.r. *side*: the source is the cicn's left 9 columns at full height h, tiled downward from (band.l, band.t + k·h). The clip (US2) trims the last tile | `0x16a2c`–`0x16a7e`, `0x169b4`–`0x16a08` |
| US6 | the band rect is removed from the interior region | `0x168fe`–`0x1690c` |

There is no gap around the title: the title erase (UT4) covers the stripes under the title. The source rect's 9-row (or 9-column) extent comes from a constant rect in the module's initial data (0, 0, 9, 9), whose other dimension is replaced by the cicn's size (`0x16934`–`0x16946`). Every stripes cicn in the corpus is 9 × 9.

### 9.6 Title text, widgets and interior paint (`0x1670c`, `0x16aac`, `0x166f8`)

The interior region starts as the rect from UFC6, UFH12 or UFS12. Each step below removes its own area from it. The last step paints what is left.

| id | order | step | rule | source |
|---|---:|---|---|---|
| UW1 | 0 | interior region | as above | `0x16066`–`0x16084`, `0x16322`–`0x16350`, `0x165e6`–`0x16614` |
| UW2 | 1 | stripes | §9.5, only when *active* | `0x16736`–`0x16744` |
| UW3 | 2 | title text | §9.6.1, only when not *side* | `0x16746`–`0x16754` |
| UW4 | 3 | widgets | only when *active*, in the order close, zoom, collapse, each when shown (§9.3) and when its 10 × 10 box meets the port's clip region (RectInRgn `$A8E9`). Each is drawn in its normal state (§9.8 glyphs), then its 10 × 10 box is removed from the interior region | `0x16756`–`0x16836` |
| UW5 | 4 | fill | foreground = the fill colour; the interior region that is left is painted (PaintRgn `$A8D3`) | `0x166f8`–`0x1670a` |

So the fill runs last and does not cover the stripes band, the title's erase rect or the three widget boxes. Glyph pixels that fall inside the interior but outside their 10 × 10 box are painted over. An inactive window gets no stripes and no widgets, so its whole interior is fill except the title.

#### 9.6.1 Title text (`0x16aac`, `0x170a0`)

The title text rect (`0x170a0`). It is empty when *side* or when the title's width ≤ 0.

| id | rule | source |
|---|---|---|
| UT1 | width *w* = StringWidth `$A88C` of the title in the UI9 font (bold). Left = *T*.l + trunc((*T*.w − *w*) / 2). If left < *Lu* or left + *w* > *Ru*: *w* is re-measured in bold + condensed (TextFace 33, then back to bold), left = *T*.l + trunc((*T*.w − *w*) / 2), and left = max(left, *Lu*). Right = left + *w*. Vertical: *T* inset 3 top and bottom | `0x170a0`–`0x17174` |

Drawing (`0x16aac`). Let r be the title text rect with its bottom moved down by 1.

| id | order | rule | source |
|---|---:|---|---|
| UT2 | 1 | skip: nothing is drawn when the title is empty or r.l + 2 > *Ru* | `0x16aec`–`0x16b00` |
| UT3 | 2 | fit: if StringWidth(title) in bold > r.w, the face becomes bold + condensed (33) for the rest of the call and the title is truncated at its end to *Ru* − r.l with TruncString (ScriptUtil `$A8B5`, selector `0x8208FFE0`, truncEnd) | `0x16b04`–`0x16b40` |
| UT4 | 3 | clip: the current clip ∩ (*Lu*, r.t, *Ru*, r.b) | `0x16b42`–`0x16b64` |
| UT5 | 4 | erase: e = r widened by 2 on the left and right. The background colour becomes the fill colour and e is erased (EraseRect `$A8A3`, under the UT4 clip). e ∩ (*Lu*, r.t, *Ru*, r.b) is removed from the interior region | `0x16b66`–`0x16ba4` |
| UT6 | 5 | pen | x = r.l. y = r.t + trunc((r.h − 1 − (ascent + descent)) / 2) + ascent, with the UI9 font's metrics | `0x16ba6`–`0x16bd8` |
| UT7 | 6 | shadow pass | only if shadow ≠ **fill** (all three stored channels compared): the title at (x + 1, y + 1) in the shadow colour | `0x16bda`–`0x16c10` |
| UT8 | 7 | main pass | the title at (x, y) in the text colour; the background colour is the fill colour. The text mode follows TX1 | `0x16c12`–`0x16c22` |

Three differences from the document title (§5.1) matter here. The shadow test compares shadow with fill, not with text. The pen x has no +3. Too-long titles are condensed and truncated instead of clipped.

### 9.7 Grow box art (`0x16e1e`)

| id | rule | source |
|---|---|---|
| UGB1 | *smallGrow*: cicn -14285 when *active*, else -14286, copied whole at the grow rect's top-left with the masked copy (GB3) | `0x16e2a`–`0x16e82` |
| UGB2 | otherwise, or when UGB1's cicn is absent: cicn -14313 when *active*, else -14317. With *smallGrow* only the top-left part of the cicn is copied, trunc(width · 11 / 15) × trunc(height · 11 / 15), unscaled: a 16 × 16 cicn gives 11 × 11, a 17 × 17 one 12 × 12. Without *smallGrow* the whole cicn is copied. Both use the masked copy at the grow rect's top-left | `0x16e86`–`0x16f12` |

No bundle in the corpus ships -14285 or -14286, so small grow boxes there are the cropped -14313 / -14317.

### 9.8 Messages 0 (widget parts) and 6

| id | rule | source |
|---|---|---|
| UM1 | message 0 parts: 0 → frame (§9.4), then §9.6. 4 → close, 5 and 6 → zoom, 9 → collapse, each drawn alone in the toggled state (TG1–TG4 rules, same shared bit), whether or not the window is *active*. Other parts draw nothing | `0x15cde`–`0x15da4` |
| UM2 | the toggle flips after parts 4, 5, 6 and 9 only. Part 258 does not flip it in this family | `0x15da6`–`0x15dbe`, `0x15dce` |
| UM3 | widget glyphs: close -14320, pressed -14317. Zoom -14318 / -14315. Collapse -14319 / -14316. Plotted at the box's top-left as a 16 × 16 icon with §6.1's rules, black foreground on white | `0x16c9a`–`0x16d58` |
| UM4 | message 6 draws only when the window is visible, *grow* and not collapsed: the grow box (§9.7, either size) in the Window Manager port, clipped to the structure region minus the windows above, with the M6L6 off-screen skip. It draws no lines | `0x16d60`–`0x16e1c` |

### 9.9 Hit results (message 1, `0x15ae4`)

| id | condition | result | source |
|---|---|---|---|
| UH1 | not visible, or outside the structure region | 0 | `0x15aec`–`0x15b22` |
| UH2 | *active*, *grow*, not collapsed, and the point is in (grow.l, grow.t, box.r, box.b), box being the structure region's bounding box | 3 | `0x15b26`–`0x15b72` |
| UH3 | in the content region | 1 | `0x15b76`–`0x15b8c` |
| UH4 | in *T* and *active*: *goAway* and the point is in the close box inset 1 | 4 | `0x15b90`–`0x15bcc`, `0x16c38`–`0x16c96` |
| UH5 | in *T* and *active*: *zoom* (after UP1–UP4) and the point is in the zoom box inset 1 | 5 if the window is at its stored zoom state (`0x16f1a`), else 6 | `0x15bd0`–`0x15bfa` |
| UH6 | in *T* and *active*: *shadeOn* (after UP1–UP4) and the point is in the collapse box inset 1 | 9 | `0x15bfe`–`0x15c1e` |
| UH7 | in the drag area: the band between the structure box (right − 1, bottom − 1) and that box inset 6, plus *T* with its bottom + 1 | 2 | `0x15c20`–`0x15c86` |
| UH8 | otherwise | 1 | `0x15c88` |

Widget hits are a rectangle test on the box inset by 1 (8 × 8). Unlike the document family, they do not test the icon's mask.

### 9.10 Not covered

Message 2's zoom bookkeeping for windowKind 64 (`0x15870`–`0x15908`), messages 3–5, 7 and 8 (`0x157b0`, `0x1580a`, `0x15a7e`, `0x1535c`, `0x1538a`) and the zoom-state test `0x16f1a` are not described beyond the citations above.

## 10. Unknowns

1. **Text-font sentinel −12345.** It is set on the port during the document bottom band and the dialog ring lines (`0x12ee8`, `0x13706`). It probably signals one of Kaleidoscope's trap patches (PACH 130), which is outside this unit.
2. **Gestalt `WdrB`.** It changes collapsed-window geometry and drawing (§3.3, §4, §5). Its owner and meaning are unknown.
3. **Variation bits 4–6, and the public window types.** Bits 4–6 reach this unit in the variation word from Kaleidoscope's caller. kDEF 0 only publishes the two entry points, as service slots 3 and 4 (`0x1cd8`–`0x1ce8`). The code that receives a Toolbox or Appearance procID (1024+) and builds the variation lives outside kDEF 0, and it is not traced. The document gate passes bits 4–6 through to this unit (`0x118cc` masks them only on the recipe path). **Not decoded.** Any mapping from a public window type to a variation code, for both families, is a declared default.
4. **Kind-5 grow box.** The vertices and grip lines are decoded (§6.4 GB4–GL4). The pixel coverage of the erased polygon is QuickDraw's region rasterisation, which this binary does not encode.
5. **Zoom-state bookkeeping.** The record update in `0x14568` (document) and the zoom-state test `0x16f1a` (utility) are only summarised.
6. **The shared toggle byte** (§2 TG4, §9.8). It is one byte for both families, named by the module's initial data. Its owner and power-on value are not identified.
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
| glyph source: the loader keeps the deepest of `ics4`/`ics8` per id (`tools/theme-loader/loadKaleidoscopeScheme.js:233`–`243`), so `ics8` already wins; `inkBounds` trimming | `ics#` (required) + `ics8`, plotted at a fixed 16 × 16 slot, masked by `ics#`; `ics4` never read | source **confirmed** (black-platinum loses nothing); the missing-`ics#` rule, the `ics#` mask and the fixed slot are **replaced** (no ink trimming) |
| grow box -14330 at the inner frame corner | -14330 hilited / -14334 not, 17 × 17 at (*C*.r − 15, *C*.b − 15), overlapping the frame by 2 | position **replaced**, id **confirmed** for active |
| `cicnOrPpatRecord` (cicn preferred, `ppat` fallback) | `ppat` first, then cicn over it; both when both exist | **replaced** |
| the scheme list in the `renderWindow.ts:276`–`278` comment (three schemes) | the unit serves 5 schemes. v2 CLAUDE.md already lists five, but its statement that "no original drawing path is decoded" goes stale once this unit lands (the PM owns that edit) | doc correction |

## 12. Test hooks

These are for a test author. Each row must be able to fail.

- For each of the five bundles and both states: the sampled fill, text and shadow equal P(6, 3), P(7, 3) and P(9, 3) of -14332 or -14336. Mutation: sample row 4 → fails.
- Structure width = content width + 12 + 1 (shadow). Height = content height + *H* + 6 + 1. Mutation: side 5 → fails.
- *H* = 22 for the system font, and *H* is odd before the floor. Mutation: drop the parity step with a 16-px font → fails.
- Zoom normal glyph id = -14334, collapse = -14335. Mutation: swap them → fails.
- No widget or stripe op is emitted when not hilited.
- A `slimes` document title emits a pattern-fill op for `ppat` -14331 and no cicn op.
- Grow rect = 17 × 17 at (*C*.r − 15, *C*.b − 15).
- TG1–TG3: a part-0 draw followed by two part-4 calls emits the pressed close glyph (-14333) and then the normal one (-14336), whatever the bit held before. Mutation: skip the clear for part 0 → fails for a bit that starts set.
- WP3: a window with no close box but with zoom and a collapse box keeps its zoom box however narrow it is. Mutation: apply WP1 without *goAway* → fails.
- SH2: a collapsed document window's shadow row is *T*.b, not *C*.b + 6.
- CT1–CT4: a window colour table whose value-0 entry is at position 1 is read at position 1. A difference of one in any stored 16-bit channel makes the alert test false.
- HT2 / UH2: a point in the grow rect's extension to the shadow column hits grow.
- GB1 / GB3: a grow cicn with a transparent mask pixel leaves the frame pixel underneath unchanged. Mutation: an opaque copy → fails.
- M6L3 / M6L4: the scroll-bar lines span portRect.l..portRect.r on row portRect.b − 15 and portRect.t..portRect.b − 15 on column portRect.r − 15.
- UG5: a 15-px utility bar puts the close box at (*T*.l + 2, *T*.t + 3); a 13-px bar at (*T*.l + 2, *T*.t + 2).
- UFH1–UFH12: for each of the five bundles and both states, the horizontal utility frame's rows sample P(4, i), P(4, 11 − i), P(i, 6), P(11 − i, 6) and P(4, 5 − i) of -14316 / -14320. Mutation: transpose to P(i, 4) → fails. The interior is (*Fl* + 2, *Ft* + 3, *Fr* − 2, *C*.t − 3).
- UFS1–UFS12: the same for *side*, with -14315 / -14319 and the transposed sample points.
- UFC1–UFC6: a collapsed utility window has 2 × 2 corners and a 2-px box.
- UFT1: the utility fill is P(4, 3), text P(5, 3), shadow P(7, 3). Mutation: the document points (6, 3) / (7, 3) / (9, 3) → fails.
- US5: utility stripes are the cicn tiled 1:1 (9 rows), never three-slice stretched.
- UW4 / UW5: the fill does not cover the three 10 × 10 widget boxes; with *active* false the interior is fill except the title erase rect.
- UT7: the utility shadow pass is skipped when shadow = fill (not when shadow = text).
- UP1: utility widgets are tested for overlap with a 7-px outset. Mutation: no outset → a window 7 px wider than the threshold changes result.
- UGB2: a 16 × 16 -14313 with *smallGrow* copies its top-left 11 × 11. Mutation: scale 11/15 → fails.
- UH4: a utility close hit is the box inset 1. The corner pixel of the 10 × 10 box answers 2 or 1, not 4.
