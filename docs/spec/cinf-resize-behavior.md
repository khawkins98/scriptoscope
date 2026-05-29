# cinf byte[2] + byte[3] — the "resize behavior" decode

**Status:** Decoded against the 2.3.1 kDEF (68k m68k disassembly at
`.scratch/k231-kdef/kDEF/k231-kdef0.asm`). The runtime label table in
`tools/theme-loader/decoders/cinf.js` is correct for what the kDEF actually
dispatches on; the "anchor-corner" labels (indices 10..14) are an editor-side
vocabulary that the kDEF does NOT decode.

This doc closes `kdef231-reference.md §7.2` gap #2's residual question
("the full 15 resize behaviors from Scheme Factory MENU 139") and supersedes
the speculative TBD encoding in `cinf.js`'s `RESIZE_BEHAVIOR_LABELS` array.

---

## TL;DR

The "15-value resize behavior" model is **Scheme Factory's authoring vocabulary**
(MENU 139). On-disk and in the kDEF, it collapses to **two independent fields**:

| field | byte | semantic | values the kDEF actually branches on |
|---|---|---|---|
| `tileSides` | `[2]` | boolean — tile vs stretch the 4 EDGE BANDS | `0` (stretch) / nonzero (tile) |
| `patternAnchor` | `[3]` | 5-way switch — which DST-RECT corner anchors the body pattern phase | `0` (origin) / `1..4` (TL/TR/BL/BR corner) / `5` (use bgPattern resource) |

That's **6 distinct byte[3] values × 2 distinct byte[2] values = 12 combos**.
Scheme Factory's MENU 139 was a CONVENIENCE that paired the two for the
author ("Stretch • Top" sets byte[2]=0, byte[3]=1, etc.). The kDEF reads each
byte independently, never as a combined 1..15 enum.

**Byte[3] is NOT a 1..15 enum.** Any disassembler reading would find exactly
one `cmpib` against byte[3] in the entire kDEF (`0x109be: cmpib #5,%a0@(3)`)
and exactly one `subq`-chain switch (`0x10ab2`), and the chain only counts
down through cases 1..4 with a default for everything else. There is no
`cmpib #6..#15` anywhere against byte[3] (verified by grep).

---

## kDEF dispatch in detail

### Byte[2] — Tile Sides (boolean)

The 9-slice routine reads byte[2] **once per edge band** as a plain boolean:

```
10bc4:  moveal %a3@,%a0          ; reload cinf addr
10bc6:  tstb %a0@(2)             ; TileSides flag
10bca:  beqs 0x10c00             ; if 0 → skip to next edge (use scaled blit)
                                 ; if nonzero → fall through to TILE path
10bcc..10bf8: build pattern-rect, call 0xea6c (the tile-fill primitive)
```

Repeated at `0x10cf0`, `0x10e4e`, `0x10ec6`, `0x10f3e` (the four edge bands)
and at `0x11262`, `0x112da`, `0x11358`, `0x113d8` (the inactive twin path).

The kDEF **only tests `!= 0`**, never compares against any specific value
above 1. So byte[2]=2 (or 7, or 15) would behave identically to byte[2]=1.

### Byte[3] — Pattern Anchor (5-way switch)

The dispatch at `0x109be..0x10af6` is two stacked decisions:

**First decision: is byte[3] == 5?**

```
109be:  cmpib #5,%a0@(3)         ; byte[3] vs literal 5
109c4:  bnew 0x10a6c             ; if NOT 5 → normal slice fill (corner anchor)
                                 ; if == 5 → "use bgPattern" path
```

The `bnew 0x10a6c` branch is the **bgPattern path**: it loads the cicn pointed
to by `cinf.bgPatternId` (byte[4..5]) via `0x10472`, sets the GWorld's
background pattern via `aa25` (`SetBackPixPat`), and FillRect-erases the body.
This is the "fill with a separate texture" mode — the body texture comes from
a per-cinf ppat resource, not from the chrome cicn's interior.

**Second decision: subq-chain on byte[3] (for values ≠ 5)**

```
10ab0:  moveq #0,%d0
10ab2:  moveb %a0@(3),%d0        ; d0 = byte[3]
10ab6:  subqw #1,%d0
10ab8:  beqs 0x10ac8             ; if was 1 → CASE 1
10aba:  subqw #1,%d0
10abc:  beqs 0x10ad2             ; if was 2 → CASE 2
10abe:  subqw #1,%d0
10ac0:  beqs 0x10adc             ; if was 3 → CASE 3
10ac2:  subqw #1,%d0
10ac4:  beqs 0x10ae8             ; if was 4 → CASE 4
10ac6:  bras 0x10af4             ; default → CASE 0 / 6+ (origin)
```

Each case loads two int16 from `%a2@` (the destination Rect at
`{top@0, left@2, bottom@4, right@6}` per §3.6) into the pair `(d6, fp@(-38))`
which is then passed to the slice-fill primitive at `0xf930` as the
**pattern phase / origin (x, y)**:

| byte[3] | case addr | `d6` (anchor X) | `fp@(-38)` (anchor Y) | semantic |
|---|---|---|---|---|
| 1 | `0x10ac8` | `a2@(2)` = dst.left | `a2@(0)` = dst.top | anchor TOP-LEFT corner of dst |
| 2 | `0x10ad2` | `a2@(6)` = dst.right | `a2@(0)` = dst.top | anchor TOP-RIGHT corner of dst |
| 3 | `0x10adc` | `a2@(2)` = dst.left | `a2@(4)` = dst.bottom | anchor BOTTOM-LEFT corner of dst |
| 4 | `0x10ae8` | `a2@(6)` = dst.right | `a2@(4)` = dst.bottom | anchor BOTTOM-RIGHT corner of dst |
| 0 (or ≥6) | `0x10af4` | `0` | `0` | anchor at window ORIGIN (no per-rect phase) |
| 5 | `0x10a6c` (separate path above) | — | — | use the per-cinf bgPattern (`byte[4..5]`) instead of the cicn body |

The "pattern phase" terminology is the QuickDraw convention: when you tile a
ppat across a region, the phase tells the blit where the pattern's (0,0)
sits relative to the dst's origin — shifting the phase translates the tile.
For byte[3] = 1..4, the phase tracks a corner of the dst rect, so the
pattern stays "stuck" to that corner as the window resizes.

---

## The Scheme Factory MENU 139 vs the kDEF

Scheme Factory (the period authoring tool — not in our corpus, only its
output formats are) shipped a 15-item dropdown in MENU 139 that mapped to
a labeled UI:

```
Stretch
Stretch • Top
Stretch • Left
Stretch • Bottom
Stretch • Right
Tile
Tile • Top
Tile • Left
Tile • Bottom
Tile • Right
Anchor (??)        ← suspected: 5 anchor-to-corner / center options
...
```

The first 10 (indices 0..9) correspond 1:1 to `(byte[2] ∈ {0,1}, byte[3] ∈ {0..4})`
via `index = tileSides * 5 + patternAnchor`. The remaining 5 (indices 10..14)
**would have to encode through some other byte the kDEF doesn't read** —
neither byte[2] (just a bool) nor byte[3] (capped at 5) supports them.

Two plausible explanations:

1. **Scheme Factory's MENU 139 was authoring-only.** The editor exposed
   "anchor center" / "anchor top-left" / etc. as conveniences that wrote out
   the same 5-corner byte[3] codes but adjusted the cicn's per-frame
   `bgPixel`/`textPixel`/`embossPixel` anchor points instead. The "anchor"
   semantics live in the **pixel-marker triples** (bytes [6..17]), not in
   byte[3].

2. **MENU 139 had fewer than 15 active items.** The 15-count is from
   prior-pass agent inspection of the MENU resource; if `MENU 139` had
   disabled/separator entries, the live item count could be 10 or 11.
   We can't confirm without Scheme Factory's resource fork (not extracted
   in our corpus; would need a copy of the v2.x Scheme Factory app).

Either way, **the kDEF runtime is the ground truth.** It dispatches on
exactly 6 byte[3] values and 1 byte[2] bit; the rest of the MENU 139
vocabulary is editor-side sugar that compiles down to those 6 codes plus
the pixel-marker coords.

---

## Corpus distribution (5 baked themes)

Surveyed `themes/<slug>/theme.json` `chromeElements.*.slice` for the 5
themes that bake from `scheme.rsrc` (the other 13 `.sit`-only bundles
decode in-browser at runtime and don't write a local theme.json). Each
themed element's slice carries the decoded `(tile, resizeBehavior)` —
unthemed elements (procedural controls) have `slice: null`.

| `(tile, byte[3])` pair | label | n | themes (of 5) | sample slots |
|---|---|---|---|---|
| `(0, 0)` | `stretch-whole` | 170 | 1138, 1990, evolution | most cicns, chrome bands, button faces, menu bars |
| `(0, 1)` | `stretch-top` | 5 | 1990, evolution | finder header, desktop icon bg, tabs bg |
| `(0, 2)` | `stretch-left` | 1 | 1990 | finder-header-inactive |
| `(0, 3)` | `stretch-bottom` | 5 | 1990, evolution | menubar items |
| `(0, 4)` | `stretch-right` | 0 | — | (not observed in corpus) |
| `(1, 0)` | `repeat-whole` | 64 | 1138, 1990, evolution | slider tracks, progress fills |
| `(1, 1)` | `repeat-top` | 0 | — | (not observed) |
| `(1, 2)` | `repeat-left` | 4 | 1990, evolution | progress-bar-track-active, inactive-progress-indicator-track |
| `(1, 3)` | `repeat-bottom` | 0 | — | (not observed) |
| `(1, 4)` | `repeat-right` | 2 | 1990, evolution | full-progress-indicator-section |
| `(*, 5)` | "use bgPattern" | 0 | — | (not observed at runtime — bgPattern paths go through the separate body fill) |

`black-platinum` and `system7-nostalgia-silver` ship NO chromeElements with
cinf slices (they are corner-sprite schemes that draw the frame procedurally
per `composeCornerSprite.ts`; cinfs exist only for cicn-template recipes).

### Findings

- **The corpus uses 7 of 10 low-range pairs.** The unobserved `(0,4)` /
  `(1,1)` / `(1,3)` pairs are valid codes the kDEF would dispatch correctly,
  just unused by these authors.
- **No `byte[3]` ≥ 5 in the corpus.** The "bgPattern" path is theoretically
  reachable (a cinf could set byte[3]=5 and point byte[4..5] at a ppat) but
  no observed cinf does so. The body texture is drawn from the cicn's
  interior in every observed case.
- **No `byte[2]` > 1 in the corpus.** The kDEF wouldn't distinguish it from
  `=1` anyway.

---

## Implication for the runtime

The current `tools/theme-loader/decoders/cinf.js` decoder:

1. Reads `byte[2]` and `byte[3]` as separate fields. **Correct.**
2. Combines them via `tileSides * 5 + patternAnchor` to a single
   `resizeBehavior` string. **Correct for 0..9; speculative for 10..14
   (those indices are unreachable from the kDEF's byte[3] dispatch).**
3. The `'anchor-center' | 'anchor-top-left' | ...` labels in
   `RESIZE_BEHAVIOR_LABELS[10..14]` will **never be returned** by the current
   `resizeBehavior(ts, pa)` function (the function caps at `tileSides ≤ 1`
   and `patternAnchor ≤ 4`).

The post-decode change (this pass): drop the speculative `10..14` slot and
document that the model is a `(boolean, 0..5)` pair, not a 15-value enum.
See the cinf.js edit alongside this doc.

**No live bug surfaces.** Because no corpus cinf hits byte[3] ≥ 5 or
byte[2] > 1, the existing runtime never reaches the speculative range —
the labels are dead code. The doc-side change makes the model match the
kDEF; the runtime stays bit-identical.

---

## Open / parked

1. **MENU 139's actual string list** — would need a copy of Scheme Factory
   v2.x to extract. Not in our installer corpus. Would settle whether the
   "anchor" entries existed and what they meant authoring-side.
2. **The bgPattern (byte[3]=5) path** — decoded but unexercised. If a future
   bundle ships byte[3]=5 + a per-cinf bgPattern ppat, the runtime would
   need to honor it. Currently we'd fall back to "stretch-whole" (the
   `tileSides ≤ 1 && patternAnchor ≤ 4` clamp). Worth a runtime test bundle.
3. **pixel-marker triples (bytes [6..17])** — likely where Scheme Factory's
   "anchor center" etc. authoring sugar actually wrote to. See §3.5 for
   the field map. Their semantics are decoded as "sample pixel for
   bg/text/emboss tinting" but the kDEF's reading of them as
   *layout anchors* (vs just color samples) is not fully traced — that's
   gap #6 in §7 of the reference.

---

## References

- `docs/spec/kdef231-reference.md` §3.5 (cinf byte layout), §4 (part-code
  dispatch tables) — the parent spec.
- `docs/spec/compositor-spec.md` — the consumer model (what the runtime
  needs the cinf to mean).
- `.scratch/k231-kdef/kDEF/k231-kdef0.asm` lines 22137 (0x109be cmpib #5)
  and 22205-22229 (0x10ab2 subq-chain) — the disassembled source of truth.
- `tools/theme-loader/decoders/cinf.js` — the decoder. Its
  `RESIZE_BEHAVIOR_LABELS[0..9]` are the kDEF-faithful 10-pair model;
  indices 10..14 are dropped per this decode.
