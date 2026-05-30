# CSS emitter spike — ADR-0001 §Gating: retrospective

**Date:** 2026-05-28 (three iterations across one session)
**Outcome:** Decision 1 (CSS-first hybrid) **retired**. The architecture that already ships — DOM structure + canvas decoration — was the right answer; the spike was repeatedly trying to push chrome rendering into CSS at a cost the project's faithful-to-the-decode posture wouldn't accept.
**Artifacts:** spike file `demo/_spike-css-emitter.html` deleted; ADR-0001 §Decision 1 rewritten; this writeup kept as the record so the next agent doesn't relitigate.

## What we set out to do

Per ADR-0001 §Gating spike: build a throwaway `border-image` emitter for ONE window frame straight from the slice recipe, compare against the canvas render across ≥3 schemes spanning both compositor paths (corner-sprite + recipe), and confirm or deny Decision 1. The acceptance bar was "the body frame (corners + L/R/bottom) is faithful at integer scale."

## Three rounds, three premature verdicts

### Round 1 — "Trivially expressible in plain CSS"

Built the corner-sprite path (apple-platinum-2) with plain CSS: a `border` for the outer ring, a tiled `background-image` for the pinstripe title, positioned absolutes for widgets and grow-box. Wrote up the verdict as PASSED — "no `border-image` needed for the corner-sprite case." Committed it.

**Caught by:** owner side-by-side review the same hour. The canvas reference renders a **3px beveled panel** (`lightBevel` highlight + `darkBevel` shadow per `composeCornerSprite §0x434`), and the widgets have their own bevels. My CSS rendered a flat 1px border + unbeveled 7×7 squares. I'd matched topology — same parts in the same positions — but missed pixel fidelity entirely.

**Lesson recorded:** topology ≠ fidelity. Don't approve your own work on a fidelity-driven project. (LEARNINGS 2026-05-28: "Topology vs fidelity")

### Round 2 — "Path 2 passes via synthesized source images"

Pivoted to Path 2: generate a small per-scheme PNG source at theme-load time (synthesized from `headerColors` for corner-sprite, cropped from the chrome cicn for recipe) and use it via `border-image`. Verified pixel-faithful for apple-platinum-2 (1× + 2×) and 1138 (1×). Updated the ADR to "PASSED via Path 2." Committed.

**Caught by:** owner asking "what about evolution, 1138, BeOS — the visually distinctive schemes?" Round 2 had only verified the simplest case (apple-platinum-2, where the chrome is just a 3-color procedural bevel) plus a moderate case (1138). Hadn't run the exotic schemes.

### Round 3 — "Path 2 + DOM measurement passes everywhere"

Restructured the spike as a scheme switcher. Two bugs surfaced when I tested the exotic schemes:
- **Title bar in CSS was a placeholder, not faithful** — production keeps the title bar canvas per Decision 1, so the comparison was unfair. Fixed by overlaying the canvas-rendered title region (clipped via `clip-path`) and putting the CSS body frame below.
- **Frame thickness was hardcoded at 3px** — evolution's chunky chrome is ~50px thick at 320×200 render; 1138 is ~16px; BeOS is ~5px. Fixed by measuring from the rendered DOM (`.aw-content` rect vs `canvas.aw-chrome` rect gives the actual frame extent).

After fixing:
- **1138 (recipe path):** faithful. Body-frame corner serifs render via border-image sampling the cropped cicn.
- **evolution (recipe path, chunky):** body frame faithful — the pipe-textured chrome renders correctly because the source IS the cicn pixels.
- **BeOS (recipe path, asymmetric):** body works; **title clip-path can't preserve the asymmetric yellow tab + gray right-strip layout**. The canvas runtime handles this correctly via the widget rect-list; my clip simplification doesn't.
- **apple-platinum-2 (corner-sprite):** measured frame is 5px; my synthesizer paints a 3px bevel into a 9×9 source. Slice-vs-source mismatch → body frame renders thinner than canvas.

Two distinct fidelity failures, both fixable with more per-scheme tuning. **The pattern of "another iteration produces another gap" was the signal to stop.**

## What the three rounds actually revealed (and why we retired)

Each round added another piece of *cleverness in the spike* — a synthesizer recipe, a title height heuristic, a DOM measurement, a clip-path simplification — that the existing runtime already knows correctly because it's already drawing the chrome. The right architecture for any "production emitter" would be **not to be ad-hoc**, but to source from the runtime directly.

When the owner reframed the question — "could we have a hybrid where the basic frames are HTML and the decoration is canvas?" — the answer was: **that's what already ships.** Look at `renderWindow`'s output:

```
<div class="aw-window">                    ← DOM container — CSS-positioned, draggable, resizable
  <canvas class="aw-chrome" />             ← Canvas — chrome pixels, transparent body hole
  <div class="aw-content"> <slot> </div>   ← Real DOM body — selectable, scrollable, host-CSS-reachable
  <button class="aw-titlewidget close"/>   ← Focusable DOM twin for close/zoom/collapse (a11y)
  ...
  <div class="aw-growbox" />               ← DOM grow box for resize
</div>
```

The DOM owns: positioning, drag, resize, z-order, focus, body content, widget hit targets, scrollbars, theme switching. The canvas owns: chrome pixels (always faithful, sourced from the runtime compositor).

Decision 1's original CSS-first pitch was to replace the chrome canvas with `border-image` to get SSR, native CSS scaling, and "cheap at scale." Those wins are real but small for Scriptoscope's actual consumer profile (SPA-driven pages with a handful of windows per page). The costs the spike surfaced — CSS emitter complexity, per-scheme tuning, classifier rules, two rendering paths to maintain, fidelity loss on exotic schemes — are not justified.

## What changes (vs the original plan)

- **Decision 1 retired in CSS-first-hybrid form.** Revised to "DOM structure + canvas decoration" — explicit framing of the existing architecture. See ADR-0001 §Decision 1.
- **PC phase scope shrunk.** No CSS emitter, no representability classifier, no `border-image` source generators. Instead: DOM-twin coverage audit + Shadow DOM (Decision 2) + canvas-repaint efficiency pass + a small shipped `scriptoscope.css` for outer-shell affordances.
- **`demo/_spike-css-emitter.html` deleted.** This writeup replaces it as the record.

## What doesn't change

- **Decision 2** (Shadow DOM around the chrome) still ships. Still valuable for hostile-host-CSS environments.
- **Decision 3** (data-attribute scanner + WindowManager) — already shipped 2026-05-27/28. Unaffected.
- **Decision 4** (in-browser ingestion) — already shipped 2026-05-27. Unaffected.
- The runtime compositor (`composeChrome.ts` + `composeCornerSprite.ts`) — unchanged. It was already faithful; the spike never needed it to change.

## The pattern worth remembering

Three rounds of "let me try harder" producing three verdicts the next iteration disproved is its own signal. **The existing architecture was talking, but I kept building new things on top instead of looking at what was already there.** When you find yourself adding clever-bit-#N to make verdict-N+1 work, ask: is there something the existing code already knows that I'm trying to recompute?

LEARNINGS 2026-05-28 captures this pattern.

## The owner's reframing — the actual answer

> "If we use canvas everywhere, is there a way to do more of a hybrid — have the basic window frames managed by HTML, but use canvas for the decoration? That way this can still slot into websites, but isn't fully rendered by canvas."

That is the architecture. It's what `renderWindow` already returns. It was never CSS-first; it was always DOM-first with canvas where canvas is required for fidelity. The spike's role in the project's history is now to be the receipt — three rounds of iteration that established beyond doubt that pushing harder into CSS doesn't survive the corpus.

## References

- ADR-0001 (this spike's parent): `docs/adr/0001-consumption-architecture.md`
- Runtime compositor: `src/composeChrome.ts`, `src/composeCornerSprite.ts`
- Render pipeline: `src/renderWindow.ts`, `src/interactive.ts`
- Declarative front door (already shipped): `src/declarative/`
- LEARNINGS 2026-05-28 entries: topology vs fidelity (Round 1 lesson), three rounds of premature verdicts (conclusion lesson)
