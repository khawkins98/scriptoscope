# Platinum Controls Decode — Design (Sub-project ③: controls, decode half)

**Status:** Design (brainstormed 2026-05-26). Next step: implementation plan via writing-plans.

## Goal

Recover, clean-room, the information needed to render the Mac OS 8.5/8.6 **Platinum standard controls** faithfully — geometry, the drawing model, and the color data — into concrete spec docs that a later **Phase-B reimplement/generate** sub-project can build against. This mirrors the proven window path: `WDEF 125` decode (`docs/spec/platinum-wdef125-decode.md`) → generator. This spec covers the **decode** only; the procedural control generator, bundle integration, and `controls.ts` cleanup are a separate follow-on spec gated on this one landing.

The control set in scope (one source, full set — retiring the `apple-platinum-2` graft): push button + default ring, bevel button, checkbox, radio, popup button, scrollbar (track / thumb / arrows), slider (+ tick marks), tab + tab pane, disclosure triangle, progress bar (determinate + indeterminate "chasing arrows"), group box (primary/secondary), little-arrows, list/window header, placard, separator, edit-text frame, focus ring.

## Why (the bigger picture)

`controls.ts` (≈1060 lines) is the largest tangled file in the renderer: ~80 special-case branches, scheme-name string checks, and three art-sourcing strategies competing (graft from `apple-platinum-2`, screenshot slice, procedural fallback). Buttons/checkboxes/radio/progress currently have ~0% faithful art (procedural fallback or ID-mismatched graft). The graft source itself — `apple-platinum-2` — is a 1999 third-party *recreation*, not Apple's pixels.

Expressing controls the same way windows are expressed — decode → bake resources → play through the single compositor — collapses that mess: one ground-truth source, the graft and saturation-heuristic branches retire, and parameterizing the bake by the 20 named accent `clut`s yields every accent variant for free. It also honors the project's standing values: faithful-to-the-decode (verify against the binary), clean-room (mimic, never execute), and resource-driven rendering (no bespoke runtime engine).

**Critical reframe (the thing that unblocks this):** Platinum controls are **drawn, not bitmaps**. Prior screenshot attempts failed because they tried to *slice* clean control sprites out of captures. The Appearance Manager draws controls procedurally (gray bevels + accent); the faithful approach is to *redraw* them — exactly as `WDEF 125` was redrawn for windows — not to slice them.

## What the binary actually yields (verified 2026-05-26)

Trap-fingerprinting and symbol/resource enumeration of the extracted 8.5 ISO material (all in `.scratch/iso-recon/`, git-ignored) established:

- **`CDEF-n63.bin` (5426 B, 68k)** is the plausible main controls proc. Fingerprint: `jsr ×50`, `bsr ×0`, sparse QuickDraw (`LineTo ×5`, `FrameRect ×1`, `RGBForeColor ×2`, `EraseRect ×4`). Verdict: it **computes geometry and delegates pixel drawing** — it does *not* draw control faces itself (contrast `WDEF 125`: `LineTo ×22`, `FrameRect ×12`, `RGBForeColor ×15`, self-contained). So the CDEF gives **geometry, not pixels** (the verdict this whole section records).
- **`AppearanceLib`** is where the pixels live: a **PowerPC PEF** shared library inside `85-System.bin` (many `Joy!` PEF containers; `AppearanceLib`@~1506228, `DrawThemeButton`@~1906490, `DrawThemeTrack`@~1963439, `DrawThemeEditTextFrame`@~1963062). The full theme API is exported — **57 `DrawTheme*` functions**. Decode is **tractable** (exported, findable) but a real step up from 68k: PPC, and `DrawThemeButton` dispatches across button kinds × states sharing deep helpers.
- **Color data is cleanly extractable (data, not engine):**
  - `apple-platinum-theme.rsrc` `clut` 200–220 → the **20 named system accents** (Azul, Bondi, Copper, Crimson, Emerald, French Blue, Gold, Ivy, Lavender, Pistachio, Magenta, Nutmeg, Poppy, Plum, Rose, Sapphire, Silver, Teal, Turquoise, Sunny, Black & White), 72 B each.
  - System file `cctb` id=0 (control color table, 128 B) + `wctb` id=0 (112 B) + `clut` id=9 (256-colour system palette, 2056 B) → default control grays.

## Approach (chosen)

**Decode geometry (CDEF, 68k) + decode the drawing model (AppearanceLib, PPC) under a spike gate + extract color data — feeding a procedural reimplementation.** The owner chose the purist AppearanceLib-decode path over data+measure, so the drawing model is decoded, not merely sampled — but bounded by a spike so an unbounded PPC effort can't sink the sub-project.

**The spike gate:** decode `DrawThemeButton` for the **push-button kind only**, end-to-end, *first*. Pin its bevel insets, gray slots, and fill/gradient model; cross-check against `cctb` id=0. That one result decides the rest:
- **Scale** — if the routine's parameters are instruction-pinnable within bounded effort and agree with `cctb`, continue PPC-decoding the other kinds (`DrawThemeTrack`, `DrawThemeTab`, `DrawThemePopupArrow`, `DrawThemeChasingArrows`, …).
- **Fallback** — if the PPC is too entangled to pin, or `cctb`+`clut` already specifies the grays such that decode adds little, let the extracted color data + the proven `WDEF 125`/`platinum.ts` raised-bevel model carry the remaining kinds, decoding AppearanceLib only where the data leaves genuine ambiguity.

Either way the output is a faithful, instruction-or-data-backed parameter set — never a guess.

**Rejected alternatives:**
- *Screenshot slicing* — already tried; failed on parsing controls cleanly. Wrong model for procedural chrome.
- *Pure capture (showcase app), no decode* — fast but geometry/params inferred, not pinned; contradicts faithful-to-the-decode and the owner's choice.
- *Decode-only (geometry + theme-primitive call map), pixels stay grafted* — produces a doc but doesn't move fidelity; keeps the 1999 recreation as the art source.
- *Continue grafting from `apple-platinum-2`* — third-party recreation, ID mismatches, mixed-source; the thing we're retiring.

## Architecture (decode data flow)

```
.scratch/iso-recon/ (git-ignored Apple material)
  ├─ code-out/CDEF-n63.bin (68k) ──▶ [A] geometry decode ──┐
  ├─ 85-System.bin (PPC PEF) ─────▶ [B] AppearanceLib spike ┤
  │                                    (DrawThemeButton → gate)│
  ├─ apple-platinum-theme.rsrc ──▶ [C] accent clut extract ───┤
  └─ 85-System.rsrc (cctb/wctb/clut) ▶ [C] gray extract ──────┤
                                                               ▼
   docs/spec/platinum-controls-decode.md   (geometry + drawing model,
     + docs/spec/platinum-controls-faithfulness-ledger.md   cites offsets)
   + extracted color data (committed as plain JSON/PNG palette, NOT Apple code)
                                                               ▼
                          Phase-B (separate spec): procedural control generator
                          → bake control cicns × state × accent → bundle
                          → retire graft, simplify controls.ts
```

Nothing Apple-derived enters git: binaries and `.asm` stay in `.scratch/`; the decode docs cite `0xADDR`/offsets and describe the algorithm in prose/tables; only *our* extracted color *values* (grays, accent RGBs — facts, like a clut readout) and *our* spec prose are committed.

## Components (the decode work)

### [A] CDEF-n63 geometry decode — `docs/spec/platinum-controls-decode.md`
Same playbook and house style as `platinum-wdef125-decode.md`. Disassemble (`m68k-elf-objdump -D -b binary -m m68k:68030 CDEF-n63.bin`), find the message dispatch (standard CDEF messages: `drawCntl`/`testCntl`/`calcCRgns`/`initCntl`/…), and for each control kind pin: part layout, insets, min/best sizes, hit/track regions, and *which* `DrawTheme*` primitive it calls (the call map). Cross-reference `docs/spec/kdef231-reference.md` §2.6 (Kaleidoscope's control families) for comparison. The CDEF's `varCode`/control-kind encoding tells us which kinds route here vs. elsewhere.

### [B] AppearanceLib drawing-model decode (spike-gated)
PPC PEF reverse-engineering. Locate `DrawThemeButton` via the PEF export hash → code section; decode the push-button path end-to-end into the spec: bevel inset deltas, edge/light-dark order, gray slots used, any gradient/fill. Record the spike-gate outcome explicitly. If scaling, repeat per kind; if falling back, document which kinds are decode-backed vs. data+WDEF-model-backed (each tagged in the ledger).

### [C] Color-data extraction
Extract the 20 accent `clut`s and the `cctb`/`wctb`/`clut`-9 grays into a committed palette artifact (JSON + preview PNGs), using the existing resource-fork parser (`tools/theme-loader/resource-fork.js`) and the recon helpers (`enumerate.mjs`, `decode-patterns.mjs`). Map accent names → RGB ramps. This is the Phase-B palette input.

### Faithfulness ledger — `docs/spec/platinum-controls-faithfulness-ledger.md`
Seeded sibling to `kdef-faithfulness-ledger.md`: one row per control kind × feature → source (CDEF offset / AppearanceLib offset / `cctb` slot / WDEF-model reuse) → status (`confirmed` / `could-NOT-pin` / `data` / `model-reuse`) → planned Phase-B impl. This is the contract Phase-B builds against and what `lint:themes` checks divergence against — divergence is detected by lint + ledger, not by eyeballing renders.

## Clean-room guardrails (every task)

Inherited verbatim from the WDEF decode plan (`docs/archive/2026-05-24-platinum-wdef125-decode.md`):
1. **Mimic, never execute.** Disassembly/decompilation is for understanding only.
2. **Record facts, not Apple's code text.** Committed docs cite `0xADDR`/offsets and describe the algorithm; no runs of Apple's listing in git.
3. **All binaries + raw disassembly stay in `.scratch/iso-recon/`** (already git-ignored).
4. **Never guess a constant.** Instruction-pinned or data-extracted, or it goes to "could-NOT-pin" — which gates Phase-B.

## Control-ID mapping

Phase-B will need control resource IDs. Do **not** infer roles from filename slugs or an ID subset — read the generated `themes/<slug>/resource-roles.json`, since the same ID differs per scheme and per cicn/ics4 channel. The decode records the *kind → geometry/draw-model* mapping; the *kind → canonical-ID* mapping is resolved against the role data, not assumed.

## Verification / testing

- Every Constants/geometry row cites an offset that exists in the disassembly (spot-check, as the WDEF decode did).
- Extracted grays verified as a coherent neutral ramp (R≈G≈B, monotonic); accent cluts verified against their names (e.g. "Bondi" ≈ Bondi blue).
- The spike's `DrawThemeButton` parameters cross-checked against `cctb` id=0 within tolerance; disagreement is flagged, not reconciled silently.
- No product code ships in this phase, so no runtime tests; the deliverables are the two spec docs + the palette artifact. Phase-B carries the render/`lint:themes`/ledger verification.

## Scope boundaries

**In:** decode docs (geometry + drawing model), the spike-gate decision, the color-data palette artifact, the seeded faithfulness ledger.

**Out (→ Phase-B reimplement/generate spec):** the procedural control generator, baking control cicns × state × accent, bundle integration, retiring the `apple-platinum-2` graft, simplifying `controls.ts`, and the runtime render verification. Also out: menus (`MDEF`), and the window-runtime consolidation (sub-project ①), which remain separate.

## Risks

- **PPC RE depth (primary).** `DrawThemeButton` may be deeply entangled with shared helpers and theme-state structs; the spike gate is the mitigation — it bounds the bet to one routine before committing to all kinds.
- **`CDEF-n63` may not be the only/main controls proc.** Other extracted CDEFs (`CDEF-n1` 3172 B, etc.) may carry some kinds; the dispatch/varCode decode in [A] resolves which.
- **Accent application model.** How the accent `clut` maps onto each control (progress fill, default ring, slider, selection) may itself live in AppearanceLib; capture it in [B]/the ledger rather than assuming.
