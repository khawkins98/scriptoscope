# Scriptoscope — the kDEF runtime architecture (the tour)

*This is the "how does the whole thing work?" tour — read it before you need to
look anything up. For a routine address /
resource id / struct offset, go to the [reference](./kdef231-reference.md)
instead; for the implemented chrome model, the [compositor
spec](./compositor-spec.md). This doc names mechanisms and links *down* to those
by their `0xADDR` routine address.*

---

## 1. The big picture

Scriptoscope renders a classic Kaleidoscope theme **1:1 from the theme's own binary
resources** — it never hand-authors chrome. It does this by clean-room
reimplementing the decompiled Kaleidoscope **2.3.1** `kDEF` (a 68k `WDEF`): get
that one engine right and every freeware scheme renders for free.

The whole runtime is one short pipeline from three resource inputs to pixels:

```
  THEME BUNDLE (themes/<slug>/)                       PUBLIC API (src/index.ts)
  ┌─────────────────────────────┐                     loadTheme(dir)  ──┐
  │ cicn   minimum-window art    │                                      │
  │ wnd#   rect-list + 4 side    │── loadTheme.ts ──▶ Theme ────────────┤
  │        recipes (partCode,    │   (resolve by                        │
  │        border)               │    RESOURCE ID)                      ▼
  │ cinf / Colr  geometry+colour │                              renderWindow(theme, opts)
  └─────────────────────────────┘                                      │
                                                                        ▼
        composeChrome.ts ── composeWindowChrome ──▶ PixelBuffer ──▶ <canvas>
        (clean-room replay of the 2.3.1 kDEF)        (QuickDraw       │
                                                      replay)          ▼
        textRaster.ts ── title text into the buffer        CSS: position +
        controls.ts / platinum.ts ── in-window widgets     integer upscale
                                                            (image-rendering: pixelated)
```

The litmus, inherited from the binary: this was a small, deterministic 68k
routine. The model is **general — no per-theme special cases.** If an
implementation needs per-theme branches, it has the model wrong.

## 2. The subsystems ("the sets" and what each does)

**Window-chrome compositor** — `src/composeChrome.ts`, drawing into
`src/pixelBuffer.ts`. The heart of the project: turns a window type's `cicn` +
`wnd#` recipe into a drawn frame at any size. It owns no pixels of its own — it
replays QuickDraw `CopyBits` sample-and-hold blits into an offscreen buffer.
This is the part validated against the binary (see §3).

**Title text** — `src/textRaster.ts`. The window title rasterizes *into the same
pixel buffer* (single source of truth, period bitmap-font look), centred on the
title region by `renderWindow.ts` — independent of how the frame grew.

**Controls** — `src/controls.ts` (themed, cicn-rendered widgets: buttons,
scrollbars, sliders, progress) and `src/platinum.ts` (a procedural gray-Platinum
fallback for the controls a scheme *omits* and defers to the OS). The
discriminator is empirical, not assumed: **themed chrome is cicn-rendered;
plain form widgets are CSS/procedurally drawn** — grep the bundle's
`chromeElements` to know which path a given widget takes. Controls resolve **by
resource id, never by bundle slug** (slugs are author decoration; the id is what
the kDEF switches on).

**Theme / resource loader** — `src/loadTheme.ts` (runtime) plus the
extraction toolchain (`tools/theme-loader/` via `scripts/extract-scheme.mjs`,
offline). A bundle is a directory of decoded PNGs + a `theme.json`; the loader
fetches it and indexes every element by resource id. See
[`theme-bundle-layout.md`](../theme-bundle-layout.md) for the on-disk schema and
[`kaleidoscope-asset-catalog.md`](../kaleidoscope-asset-catalog.md) for the
control vocabulary.

**Detection layer** — how we stay faithful without eyeballing renders:
`npm run lint:themes` (static data-shape checks, pre-render) +
`npm run diag:audit` (render-time model invariants) + the
[faithfulness ledger](./kdef-faithfulness-ledger.md) (routine→impl intent and
every deliberate divergence) + the diagnostic CLIs / Playground
([`diagnostic-tooling.md`](../diagnostic-tooling.md)) for manual inspection. The
one missing net is golden-vs-reference diffing — deferred, blocked on
trustworthy ground truth (tracked in [#190](https://github.com/khawkins98/aaron-ui/issues/190)).

## 3. How it maps to window management

A `wnd#` recipe becomes a drawn frame in six steps (the clean-room replay in
`composeWindowChrome`). Each names the binary routine it mirrors — look those up
in the [reference §1.4](./kdef231-reference.md):

1. **Drawable extent** — size the structure to the cicn's last opaque col/row,
   not its raw bounds (`drawableExtent`; trims transparent tails).
2. **Frame insets** — derive frame thickness from the body rect vs that extent
   (`frameFromBody`).
3. **Classify** — each recipe cell is fixed / stretch / tile / scale / collapse,
   decided **purely by its part code**, never by pixel content or cell width
   (`classifyPart`, the `0x49d6` jump table).
4. **Walk** — partition each side into cells, **end-based**: the part code
   travels with the border that *closes* its cell, so `[0, border[0])` is the
   intrinsic fixed leading corner (`recipeCells`, `0x5356`/`0x4a64`).
5. **Distribute** — hand the slack out evenly across the stretch cells,
   **symmetric about the title** (each side splits into halves at the title
   cell) (`distributeSide`, `0x5178`).
6. **Blit** — tile by default (`0xfeae`); a single scaled `CopyBits` only for
   part code 18 (`0x10320`); the title plate (code 5) grows to the *measured*
   title width (`0x4a64`).

Widgets (close/zoom/shade boxes) are **baked into the cicn** and ride the fixed
cells they sit in — we don't replicate the kDEF's separate widget-draw pass (a
documented divergence in the ledger, safe while no widget lands in a growing
cell). The four window types (document / utility / modal / popup) all run this
*same* algorithm — adding a window type is data, not code.

## 4. The clean-room discipline

Scriptoscope **mimics, never executes.** The decompiled binary is for
*understanding* — we never ship or run the original 68k (no emulator-as-oracle).
Every behaviour is a clean-room reimplementation in our own TypeScript. Two
consequences shape day-to-day work:

- **Fix the interpretation, not the compositor.** When a render is wrong, the
  cause is almost always a misread of the kDEF (verify against the asm via the
  reference), not a missing heuristic. Heuristics that "fix" a render by
  diverging from the binary are how the long dead-ends happened — see
  [history.md → "Dead ends — don't relitigate these"](../history.md).
- **Detect divergence with the nets, not the eye** (§2 detection layer).

## 5. Where to go next

| You want… | Read |
|---|---|
| **how it works** (this tour) | you're here |
| a routine address / id / offset / coordinate (**where is X**) | [`kdef231-reference.md`](./kdef231-reference.md) |
| the implemented chrome model / spec | [`compositor-spec.md`](./compositor-spec.md) |
| the deep decode derivation (why the model is what it is) | [`kdef231-recipe-walk.md`](./kdef231-recipe-walk.md) |
| routine → our code, with divergences | [`kdef-faithfulness-ledger.md`](./kdef-faithfulness-ledger.md) |
| the full project history & dead ends | [`../history.md`](../history.md) |
| per-scheme render-quality status | [`glitch-punchlist.md`](./glitch-punchlist.md) |
| how to add a scheme | [`../porting-a-kaleidoscope-scheme.md`](../porting-a-kaleidoscope-scheme.md) |
