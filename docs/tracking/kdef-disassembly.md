# Tracking: kDEF disassembly

**Status:** First-pass investigation **complete** — see [`kdef-disassembly-findings.md`](./kdef-disassembly-findings.md) for what was learned. Some open questions closed (§13.2 reframed, §13.4 actionable), others still parked pending a deeper trace of the cinf-parser at `kDEF 0` `0x77b4`.

**Author:** spec-trilogy session 2026-05-19

---

## Context

After PR #130's per-segment composer landed, we hit a wall on chrome-rendering heuristics. Remaining questions about exact rendering behavior (corner overlap precedence, tile-vs-stretch threshold, divider sandwich semantics) cannot be answered from publicly documented Kaleidoscope material. The actual algorithm lives in 60-100KB of 68k assembly inside the `kDEF` resources of the Kaleidoscope installer.

The three-layer architecture reset (specs A/B/C) deliberately parks these uncertainties as **empirical defaults + tunables**, allowing the rebuild to proceed against the documented portion. This tracking ticket exists so the disassembly work can resume when the rebuild reaches the point that the parked questions actually block progress.

## When this matters

Levels 1-2 of the rebuild (window chrome + basic controls) **do not block** on disassembly. The current heuristics produce visually acceptable results across all 7 bundled schemes.

Disassembly starts mattering at **Level 3+** (full HIG controls):
- Per-control resize behavior (cinf upper bits, 15-value matrix) — needed for scrollbars, sliders, tabs to honor scheme-specific resize rules
- Divider sandwich semantics — needed for menu dividers to render correctly across scheme conventions
- Color extraction pixel selection — needed for dialog/alert/Finder color extraction to match what period schemes intended

## Open questions disassembly would settle

From [`docs/aaron-ui-raster-mapping-spec.md`](../aaron-ui-raster-mapping-spec.md) §13:

1. **§13.1 Divider sandwich (parts 5/6)** — K2 mentions divider sandwich pair semantics but doesn't specify whether the segment between two part-5/6 markers tiles, stretches the middle pixel, or skips for pattern showthrough. Current Aaron UI treats them as universal-stretch (part-8).

2. **§13.2 Tile-vs-stretch threshold** — Current hybrid policy uses `TINY_STRETCH_THRESHOLD = 2 px`. K2 doesn't specify a threshold; kDEF would have the exact logic.

3. **§13.3 cinf upper bits (15-value resize behavior)** — Scheme Factory's MENU 139 enumerates 15 resize behaviors but doesn't publish the bit layout in cinf. Aaron UI honors only the lower bit (tileSides 0/1).

4. **§13.4 Color-extraction pixel** — Which exact pixel of a color-only cicn is the canonical bg/fg color. Aaron UI samples `(1, height-1)` empirically.

5. **§13.5 Pattern-anchor semantics** for non-rectangular containers (free menus, popup menus).

6. **§13.6 Indeterminate progress bar timing + ppat IDs** — K2 says ~125ms per frame; detection of "cycle multiple ppats vs shift one" needs verification.

## Source material

- **Kaleidoscope 1.8.2 Installer.app** — contains the kDEF resources for the v1 era. User has this in their Downloads.
- **D' Studio 1.6 68k Complete** — possible source of related 68k assembly. User has this in Downloads.
- **Scheme Factory v1.0PR2** — already mined for STR# 128, MENU 139, TMPL 129. No kDEF resources in the editor itself.

## Recommended tooling

- **Ghidra** (NSA, free) — has 68k disassembly support, can decompile to C-like pseudocode. Best path for a multi-hour exploration.
- **MAME debugger** in 68k mode — alternative for tracing live execution.
- **ResEdit** (period-authentic) — useful for hex-level inspection of the kDEF before disassembly, NOT useful for the actual reading-the-assembly part.

## Estimated effort

Best-case: 1-2 days to settle questions §13.1, §13.2, §13.4 (these are likely concentrated in identifiable code paths).

Worst-case: 1-2 weeks if the 15-value resize matrix (§13.3) requires reverse-engineering the dispatch table from scratch.

## Trigger to revisit

When EITHER:
- The rebuild reaches Level 3 (scrollbars/sliders/tabs) and the parked questions produce user-visible rendering bugs that empirical tuning can't resolve, OR
- A user reports a specific scheme that the heuristics get wrong in a way that maps onto one of the open questions.

Until then: parked. The rebuild can proceed against the documented spec surface.

## Related

- [`docs/aaron-ui-html-skeleton-spec.md`](../aaron-ui-html-skeleton-spec.md) §19 — animation hooks (some require disassembly to lock timing)
- [`docs/aaron-ui-raster-mapping-spec.md`](../aaron-ui-raster-mapping-spec.md) §13 — full enumeration of open questions
- [`docs/aaron-ui-composer-spec.md`](../aaron-ui-composer-spec.md) §11 — rebuild order
