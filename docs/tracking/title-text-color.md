# Title-text colour — sourcing (investigation + fix plan)

## Symptom
Rendered window-title text colour doesn't match the period references:

| scheme | reference title text | ours (`headerColors.text`) |
|---|---|---|
| 1984 (active) | **black** | `#99ccff` sky-blue |
| 1984 (inactive) | dark grey `#303030` | `#ffffff` |
| 1990 | white | `#878700` olive |
| evolution | white | `#878700` olive |
| platinum | black | `#555555` grey |
| beos | black (on gold bar) | `#888888` grey |
| 1138 | black | `#000000` (coincidentally right) |

## Where the colour comes from now (and why it's wrong)
`scripts/add-header-colors.mjs` pre-bakes `headerColors.{active,inactive}.text`
into `theme.json` from the `-14335`/`-14336` cluts, **index 2** (`headerColorsFromClut`
in `tools/theme-loader/decoders/clut.js`). `renderWindow.ts` then uses that as the
title colour (priority 1).

But those cluts are the **frame/bevel appearance** palette — only 7 entries
(values 0–6), and the real title colours are in **none** of them (verified per
scheme). So index 2 is a frame tint we mis-labelled "Text".

## Where it ACTUALLY comes from (traced from the 2.3.1 kDEF asm)
The title is drawn by the kDEF routine at **`0x5530`** (see kdef231-reference.md §1.4):
1. `GetWTitle` (`$A919`) — the title string.
2. `0x6582(idx)` — look up a marker rect from the rect-list (`a4@1938`).
3. `0xfc5c` ×2 — a **GetPixel** (bit/byte offset for 1/2/4/8-bit depth → index →
   RGB via `0x10702`). Samples **two adjacent pixels** of the chrome pixmap
   (`a4@1934`): one → text colour (`fp@-28`), the neighbour → shadow (`fp@-22`).
4. `0x56b2`: if the two are equal → one `RGBForeColor`+`DrawString`; else text in
   colour1 + a ~1px-offset shadow in colour2 (emboss).

So **a scheme encodes its title colour as a small marker swatch baked into the
window cicn**. There is no per-scheme title-colour clut / `wctb` (the schemes
ship no `wctb`; the `Colr` resource is just metadata — "Scheme Resource Info":
format version + scroll-bar flags).

## Runtime-fix plan (Aaron UI is runtime-compute-from-resources)
Compute the title colour at **render time by sampling the loaded cicn** — do NOT
pre-bake it. In `renderWindow.ts`:
- Drop the `headerColors.text` priority (it's a frame tint).
- Sample the cicn marker swatch (text + adjacent shadow) like the kDEF; draw the
  shadow emboss when text ≠ shadow.
- `headerColors.fill/frame/bevels` stay (they ARE the frame appearance, used for
  the CSS title bar) — only `.text` is bogus.

## Open detail (do empirically, not via more asm)
The exact marker **pixel** per scheme. The obvious 1984 candidate (the thin
part-4 rect, x≈40) reads grey in our cicn while the reference is black — so
either `0x6582(0)` resolves to a different rect than assumed, or the coordinate
lands elsewhere (possibly out-of-bounds → black). The decompile is truncated
through `0x6582`/`0xfc5c`/`0x4a64` (`halt_baddata`), so pin the coordinate
**empirically**: instrument the renderer to sample candidate marker locations
and match the reference colours across all schemes, rather than fighting the
truncated asm.
