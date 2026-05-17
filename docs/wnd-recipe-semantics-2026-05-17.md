# wnd# recipe semantics — empirical findings (2026-05-17)

**Status:** Output of issue [#64.0](https://github.com/khawkins98/aaron-ui/issues/64). Research-only document; no code change accompanies this. Findings inform the V2 implementation plan for [#64.1](https://github.com/khawkins98/aaron-ui/issues/64) (top-side composer).

**Context:** PR #65 documented that V1 of the wnd# composer produced visibly worse rendering than uniform stretch because the recipe references "part" integers (5, 6, 8, 10, 11, 15, 17) that aren't in the rectangleList — their semantics weren't in the geometry spec. This document closes that gap empirically by analyzing 13 windowType entries across both canonical bundles.

**Disclaimer:** kaleidoscope.net is gone; Wayback isn't reachable from my fetch tools; the Kaleidoscope SDK reference is unavailable. The findings here come from observed regularities in the wnd# data, not from source-of-truth documentation. I'm confident in the part-8 finding (it's universal across all 13 windowTypes); the others are best-guesses informed by position patterns.

---

## Methodology

Dumped all wnd# data from both canonical bundles' extraction manifests:

- **mass:werk 7 Le** — 6 windowTypes: Document Window, Collapsed Document Window, Movable Modal Dialog, Modal Dialog, Alert, Movable Alert
- **mass:werk Dark ErgoBox 2** — 7 windowTypes: Document Window, Collapsed Document Window, Dialog, Alert, Movable Dialog, Movable Alert, Utility Window, Collapsed Utility Window, Side Floating Utility Window, Collapsed Side Floating Utility Window

For each side recipe (top, bottom, left, right of each windowType), recorded:
- The complete `(at, part)` entries
- Which entries reference parts in the rectangleList vs. not
- The position contexts (cicn x-coordinate where each "fill" part appears)

---

## Finding 1: Part 8 is the universal stretchable-fill code

**Evidence:** part 8 appears in **every single bottom/left/right side recipe across all 13 windowTypes** of both schemes. The pattern is consistent:

```
bottomSide for 7 Le Document Window:
  at=0  part=0   ← 1-pixel left corner
  at=1  part=1   ← 1-pixel inner corner detail
  at=2  part=8   ← STRETCH from x=2 to x=73 (71 pixels)
  at=73 part=0   ← 1-pixel right corner
  at=74 part=1   ← (end marker / right edge)
```

```
leftSide for ErgoBox Document Window:
  at=26 part=0   ← top corner of left edge
  at=27 part=8   ← STRETCH from y=27 to y=42 (15 pixels)
  at=42 part=0   ← bottom corner detail
  at=64 part=1   ← edge end marker
```

**Interpretation:** Part 8 means "stretchable fill — extend the cicn pixels at this position to fill the remaining segment." This is the classic 3-slice border pattern: corner + stretchable middle + corner. Kaleidoscope schemes universally use part 8 as the "this segment can be any width, just fill it" code.

**Confidence:** High. Pattern is universal across all 13 windowTypes; no exceptions found.

## Finding 2: Parts 5 and 6 cluster around divider positions

**Evidence:** Parts 5 and 6 only appear in **top-side recipes** and **always near the divider position**:

```
7 Le Document Window topSide (divider in rectList: part-4 at x=28-29):
  at=24 part=1   (close box right edge area)
  at=25 part=8   (small fill)
  at=28 part=6   ← at the divider's left edge
  at=29 part=5   ← inside the divider
  at=32 part=6   ← at the divider's right edge
  at=33 part=8   (small fill resuming)
```

```
ErgoBox Document Window topSide (divider in rectList: part-4 at x=46-48):
  at=42 part=1
  at=47 part=6   ← at divider left edge
  at=48 part=5   ← inside divider
  at=53 part=6   ← at divider right edge
  at=74 part=1
```

In Movable Modal Dialogs (which have only the divider, no close/zoom), parts 5/6 still appear near the divider position:

```
7 Le Movable Modal Dialog topSide (divider at x=15-21):
  at=15 part=6   ← divider left edge
  at=21 part=5   ← inside divider
  at=26 part=6   ← divider right edge
```

**Interpretation:** Parts 5 and 6 are **divider decoration codes**. Likely:
- Part 6 = "divider edge pixel" (1-2px wide lead-in/lead-out around the divider)
- Part 5 = "divider middle fill" (the inner pixels of the divider region itself)

These complement the rectangleList's part-4 (the divider rect) with finer-grained "draw 1px of edge here, then the divider middle, then 1px of edge."

**Confidence:** Medium-high. The position pattern is too consistent across windowTypes and schemes to be coincidence, but the exact rendering rule (do they tile? stretch? blend?) isn't determinable from positional analysis alone.

## Finding 3: Parts 10, 11, 15, 17 are scheme-specific decoration codes

**Evidence:** These appear in only one scheme each:

- **Part 10**: 7 Le Document Window topSide only, at x=68 (right of windowshade at x=53-64, before the end at x=74). Likely a "right edge decoration" specific to 7 Le's chrome.
- **Part 11**: ErgoBox Utility Window only, in top + leftSide + rightSide near the small title area.
- **Parts 15, 17**: ErgoBox Side Floating Utility Window only, in leftSide. This window has VERTICAL title text — likely fill codes for the vertical-orientation decoration.

**Interpretation:** These are window-type-specific decoration variants. Kaleidoscope's renderer probably has dozens of these baked-in codes, each producing a specific small visual element (a particular shadow, a particular highlight, an arrow direction, etc.) at the position the recipe specifies.

**Confidence:** Low (we only see ~4 of these out of an unknown total). Safe operating assumption: treat any unknown high-numbered part as a "fill — render cicn pixels at the segment's x-range." This won't be visually correct for these specific decoration codes but won't be catastrophically wrong either.

## Finding 4: Named parts (0-4) appear in recipes at "absolute" cicn positions

**Evidence:** When a recipe references a named-part integer that IS in the rectangleList:

```
7 Le Document Window topSide:
  at=5  part=1   ← part-1 is close box at rect [5, 9, 16, 20]
                   recipe places it at cicn x=5, matching rect.left=9
                   ... hmm, recipe says 5, rect says 9, off by 4
```

There's a mismatch I can't fully explain: the recipe's `at` value sometimes matches the rect's `left` coordinate, sometimes doesn't. For 7 Le Document Window, the close box's recipe entry says `at=5` but the rect's left edge is `9`. The 4-pixel offset might represent the corner / frame width that precedes the close box.

Looking at ErgoBox Document Window:
```
topSide: at=4  part=1   (close at rect [4, 6, 17, 19] — left=4, matches!)
         at=19 part=2   (zoom at rect [75, 6, 88, 19] — left=75, does NOT match recipe's 19)
```

The first entry's `at` matches `rect.left`; the second doesn't.

**Interpretation:** Unclear. Possible theories:
- The recipe's `at` is the LEFT EDGE of the area where the part should be RENDERED in cicn coordinates, not the part's rectList position
- The recipe defines a SEQUENCE of "render this part starting here, until the next entry" — so the part's actual draw position is determined by `at`, not by the rect's coordinates
- The named parts in the recipe are SELECTORS for which cicn region to render at the recipe position (NOT positional references)

Best operating assumption: the recipe's `at` is the position in cicn x-coordinates where the segment starts. The part referenced determines WHAT to render at that segment:
- Named part (in rectList): render that part's rect AT THE RECIPE POSITION (use the rect's pixels as the SOURCE, but render at the recipe's x-position, with the part's native width OR stretched to fit the segment)
- Fill part (8, etc.): render cicn pixels at the SEGMENT'S X-RANGE, tiled

**Confidence:** Low. Without source docs, the named-part semantics are ambiguous. This might require empirical testing (try one interpretation, render, compare to mass:werk's preview thumbnails, iterate).

---

## Proposed V2 algorithm

Based on the findings above:

```
function composeTopEdge(titlebar, theme, windowType, cicnUrl, cicnW, cicnH):
    titlebarWidth = titlebar.clientWidth
    titlebarHeight = titlebar.clientHeight

    // 1. Identify named parts vs. fill parts
    rectList = windowType.parts  // by partSlug
    namedPartIds = set of part integers in rectList
    
    // 2. Walk recipe, classify each entry
    for i, entry in enumerate(windowType.edges.top):
        nextAt = next entry's at, or cicnW if last
        segCicnStart = entry.at
        segCicnEnd = nextAt
        segCicnWidth = segCicnEnd - segCicnStart
        
        if entry.part in namedPartIds:
            // Named part — render the rect at the segment's start
            rect = rectList[entry.part]
            rectW = rect.right - rect.left
            rectH = rect.bottom - rect.top
            createOverlayDiv(
                left = pct(segCicnStart, cicnW),
                top = pct(rect.top, cicnH),
                width = `${rectW}px`,           // NATIVE px, no stretch
                height = `${rectH}px`,          // NATIVE px
                backgroundImage = cicnUrl,
                backgroundPosition = `-${rect.left}px -${rect.top}px`,
                backgroundSize = `${cicnW}px ${cicnH}px`,
                backgroundRepeat = 'no-repeat',
            )
        elif entry.part == 8:
            // Universal stretchable fill — tile cicn pixels at segment x-range
            createOverlayDiv(
                left = pct(segCicnStart, cicnW),
                top = '0',
                width = pct(segCicnWidth, cicnW),   // stretches with titlebar
                height = '100%',
                backgroundImage = cicnUrl,
                backgroundPosition = `-${segCicnStart}px 0px`,
                backgroundSize = `${cicnW}px ${cicnH}px`,
                backgroundRepeat = 'repeat-x',
            )
        else:
            // Other unknown fill code (5, 6, 10, 11, etc.) — render same as part 8
            // Won't be visually correct for decoration codes but won't break
            // (same code path as part 8)
            createOverlayDiv(...)
```

**Visual prediction:** the titlebar would show:
- Named parts (close, zoom, windowshade, divider) at their **native pixel sizes** positioned where the recipe says
- Fill regions between them as the cicn's pinstripe **tiled at native scale**

This should look much closer to Kaleidoscope's actual rendering than uniform stretch.

**Open questions for V2 implementation:**

1. **The named-part position offset** (Finding 4): does the named part render at `recipe.at` or at `rect.left`? Need to try both and visually compare against mass:werk's reference thumbnails.
2. **Title-pill region detection**: with named parts placed at recipe positions, the gaps between consecutive named-part recipe entries define the "fill regions." The largest such gap on the top edge is likely the title-pill region. Detect heuristically and position title text there.
3. **Fill code decoration variants** (5, 6, 10, etc.): rendered as plain fills initially. If visible differences from references are noticed, treat as future polish.

---

## What this changes for #64

[Issue #64](https://github.com/khawkins98/aaron-ui/issues/64)'s sub-tickets stay the same scope but with better-defined inputs:

- **#64.0 (this doc)** — research done; we have a hypothesis-grade algorithm to implement.
- **#64.1** — top-side composer using the V2 algorithm above. Implementation should compare against mass:werk reference thumbnails after each significant change.
- **#64.2** — title-pill detection from largest empty gap.
- **#64.3** — bottom/left/right composer using the same algorithm (part-8 dominates those sides, so they're simpler).

---

## References

- [`docs/rendering-gap-analysis-2026-05-17.md`](./rendering-gap-analysis-2026-05-17.md) — the analysis this research feeds.
- [`docs/kaleidoscope-geometry-spec.md`](./kaleidoscope-geometry-spec.md) — the geometry spec to be extended with these findings.
- PR #65 — the V1 attempt + investigation findings.
- Issue #64 — the tracking issue.

## Raw data appendix

For reproducibility, the script that produced the per-scheme dump:

```python
import json
for slug in ['masswerk-7-le', 'masswerk-dark-ergobox2']:
    m = json.load(open(f'demo/assets/themes/{slug}/extraction-manifest.json'))
    wnds = [a for a in m['assets'] if a['type'] == 'wnd#' and a.get('status') == 'ok']
    for w in wnds:
        d = w['data']
        # rectList
        named_parts = {r['part'] for r in d['rectangles']}
        # Per-side recipes: which parts are named vs unnamed
        for side_name in ('topSide', 'bottomSide', 'leftSide', 'rightSide'):
            for e in d[side_name]:
                is_named = e['part'] in named_parts
                # ... emit row
```

Full dump artifact preserved in the PR thread.
