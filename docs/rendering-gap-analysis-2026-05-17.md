# Rendering gap analysis — 2026-05-17

**Status:** Living analysis, written after Phase 4 close revealed visible chrome-rendering artifacts on the deployed demo. Replaces the reactive PR-by-PR fix loop with a deliberate gap assessment + plan.

**Why this document exists:** The runtime tier of Phase 4 shipped working primitives (loadTheme, cinf 9-slice, ppat overlay, wnd# part rects, theme switching, bundled default) and a visible landing demo. But the rendered output has consistent visual artifacts (titlebar pinstripes don't match scheme references, controls double-render, title text overlaps glyphs). The pattern across three polish PRs (#59, #60, and what would have been more): each fix solves one symptom and creates another. That's a sign that I've been reacting to symptoms instead of understanding the mapping from Kaleidoscope's rendering model to HTML/CSS. This document corrects that.

---

## 1. What we're trying to render — the visual target

A Kaleidoscope scheme renders a window's chrome from these resource sources:

- **`cicn` (Color Icon)** — a bitmap. For a window-type entry, it's the **full window-frame appearance at a reference size** (74×25 for 7 Le's Document Window, 132×64 for ErgoBox's). Includes pinstripe pattern, control glyphs (close box, zoom box, windowshade), title-pill region, and any visible border decoration — all baked in as pixels.
- **`wnd#` (Window Type Definition)** — geometry metadata for the chrome cicn:
  - **Rectangle List**: named hit-target regions inside the cicn (close box rect, zoom box rect, windowshade rect, dividers, title-pill region implied by gaps).
  - **Side Recipes**: per-edge (top/bottom/left/right) sequences of `(part, position)` pairs describing how to **compose** that edge when the rendered window is larger than the cicn's native size. Each entry says "from pixel X, draw cicn region for part Y."
- **`cinf` (Color Info)** — 9-slice + body-pattern metadata, **for control cicns** (buttons, scrollbars). Window-type cicns do **not** typically pair with cinf — that's a wnd# concern.
- **`ppat` (Pixel Pattern)** — tile bitmaps used as fills (titlebar pinstripe overlays, scrollbar tracks, body backgrounds).
- **`Colr`** — palette + scheme-level option flags.

The *correct* Kaleidoscope rendering of a window of arbitrary size from a fixed-size chrome cicn:

1. Walk the `wnd#` side recipes for each edge.
2. For each `(part, position)` pair in a side recipe, the runtime knows: at pixel `position` along this edge, draw the cicn pixels from the named part region.
3. Where a region needs to stretch (because the window is wider than the source segments), the recipe declares a "fill" or "tile" part.
4. The body region (inside the chrome) is filled with the scheme's body pattern (a ppat) or a solid color.
5. The result: at any window size, the chrome's *features* (close box, title pill, controls) stay at native pixel size, and only the *fill regions* between them stretch or tile.

This is fundamentally different from CSS 9-slice (`border-image`), which slices the source into 9 fixed regions and stretches/tiles each. CSS 9-slice can approximate Kaleidoscope rendering for *simple* cases (rectangular chrome with corners) but breaks down for non-rectangular chrome like ErgoBox's projecting tab, asymmetric layouts, or chrome where controls aren't in the corners.

**Reference quality bar:** the rendered window should be visually indistinguishable from Kaleidoscope's own preview thumbnail of the scheme at a comparable window size.

---

## 2. What our current implementation does

Tracing the code path on a freshly-loaded mass:werk 7 Le document window (verified via `browse` against `localhost:5173/`):

**Step 1:** `loadTheme()` fetches `themes/masswerk-7-le/theme.json`, resolves asset URLs to absolute paths, applies `Colr` palette to `:root` as `--aaron-colr-*` custom properties, dispatches `aaron:themechange`.

**Step 2:** `attachThemeToWindow()` subscribes the window's DOM to `themeRegistry`. On `themechange`, calls `applyChromeFromTheme(windowEl, theme)`.

**Step 3:** `applyChromeFromTheme()`:

- Finds `theme.windowTypes['document-window']`, picks `chrome.inactive` (because `data-state="inactive"`), gets URL `cicns/cicn-n14336-inactive-document-window.png`.
- Looks up the matching `chromeElements` entry → has `width: 74, height: 25, slice: null`.
- Strips dimensions (since no slice), calls `applyChromeElement(titlebar, entry)`:
  - Sets `background-image: url(cicn)`, `background-repeat: no-repeat`, `image-rendering: pixelated`.
- After: forces `titlebar.style.backgroundSize = '100% 100%'` so the 74×25 cicn stretches to fill the 378×25 titlebar (5.1× horizontal stretch).
- Applies border-image to the window root: `borderImageSource: cicn`, `slice: 1`, `width: 1`, gives every window a 1px scheme-derived edge.
- Calls `applyWindowParts(titlebar, wndType, {glyphCicnUrl: cicn})`:
  - For each wnd# part (5 parts in 7 Le's document-window):
    - Computes `left, top` as percentages of the chrome cicn's native dimensions.
    - Sizes the overlay in *native pixels* (e.g., 11×11 for close box).
    - Sets `background-image: url(cicn)` + `background-position: -<rect.left>px -<rect.top>px` + `background-size: 74px 25px` → renders a crisp slice of the cicn at the part's native pixel region.

**Step 4:** The demo's CSS independently styles the titlebar (`background: var(--aaron-colr-titlebar-active-bg)`, etc.) and the body (`background: white`), plus puts title text in the titlebar (`position: absolute; inset: 0; display: flex; align-items: center; justify-content: center`).

**End state of the DOM:**

```html
<div class="aaron-window"
     style="border: 1px transparent solid;
            border-image: url(cicn-inactive.png) 1 / 1 stretch;
            box-sizing: border-box;">
  <div class="aaron-titlebar"
       style="background-image: url(cicn-inactive.png);
              background-size: 100% 100%;
              background-repeat: no-repeat;
              image-rendering: pixelated;">
    <div class="aaron-titlebar__title">About Aaron UI</div>
    <div data-part="part-0"
         style="left: 1.35%; top: 88%; width: 71px; height: 1px;
                background-image: url(cicn-inactive.png);
                background-position: -1px -22px;
                background-size: 74px 25px;"></div>
    <div data-part="part-1"
         style="left: 12.16%; top: 20%; width: 11px; height: 11px;
                background-image: url(cicn-inactive.png);
                background-position: -9px -5px;
                background-size: 74px 25px;"></div>
    <!-- part-2, part-3, part-4 same shape, different rects -->
  </div>
  <div class="aaron-content">…</div>
  <!-- 8 resize handles -->
</div>
```

---

## 3. The gap — symptoms, traced to causes

### Symptom A: Controls visually double-render

Every close box / zoom box / windowshade glyph appears **twice** in the titlebar:

1. Once as a horizontally-stretched smear inside the titlebar background (the 74×25 cicn stretched to 378×25 means the original 11×11 close box becomes a ~56×11 elongated band).
2. Once as a crisp 11×11 slice rendered by the part overlay at the same percentage location.

These overlap and conflict — the crisp glyph sits on top of the stretched smear of itself.

**Cause:** the stretched titlebar background already contains the controls (because they're baked into the cicn pixels). Adding crisp glyph overlays adds a second copy of the same information. The two rendering paths weren't coordinated.

### Symptom B: Title text overlaps control glyphs

The title text is centered in the titlebar (CSS: `display: flex; justify-content: center`). The zoom box at 50% horizontal in the cicn → 50% horizontal in the stretched titlebar → exactly where centered text goes. Result: title text obscures the zoom glyph (or vice versa, depending on z-order).

**Cause:** the demo treats the titlebar as a flexbox with title text centered, *unaware of where the scheme places controls*. Kaleidoscope schemes have a "title pill" region (the area between controls where title text belongs), but we don't extract or honor that.

### Symptom C: Window borders are 1px and almost invisible

The scheme-derived border-image at `slice: 1, width: 1` shows only the outermost pixel of the cicn around the window. For 7 Le's `#888` outer pixels, this is a barely-visible 1px gray ring. For ErgoBox's near-black outer pixels on a dark page background, the ring disappears entirely.

**Cause:** 1px slice is too thin to convey the scheme's actual frame design. Kaleidoscope schemes typically have multi-pixel frame decorations on each side (Drop shadows, beveled edges, BeOS tabs) that need richer composition than a single-pixel border-image.

### Symptom D: Body region has no scheme-derived background

The window body shows plain white regardless of scheme. ErgoBox's reference renders the body region with a `ppat` overlay (gray tile pattern). 7 Le's body is closer to white but still has subtle palette tinting.

**Cause:** the `ppat` overlay mechanism (`bgPattern` in chromeElements + `applyChromeElement` ppat path) exists in code but neither canonical bundle's window-type chrome entries carry a `bgPattern` value, because the extractor doesn't yet decode the `Colr` resource or the wnd#-implied body-pattern reference.

### Symptom E: Chrome at native size for the cicn dimensions stays uniformly stretched

The chrome cicn for 7 Le's Document Window is 74×25 — designed for a small alert-sized window. When stretched to a 378×25 titlebar (5.1× horizontal), all the cicn's discrete features (pinstripe rhythm, control positions, divider lines) get pulled apart. The visual rhythm of the original is destroyed.

**Cause:** uniform stretching is the wrong tool. Kaleidoscope uses `wnd#` side recipes to compose each edge from fixed-size pieces of the cicn separated by stretchable fill regions. We're not honoring side recipes — we just stretch the whole cicn.

### Root cause across all symptoms

We have **three uncoordinated rendering layers** painting overlapping content onto the same titlebar element:

1. Stretched cicn background-image (full chrome).
2. 1px border-image on window root (scheme-derived edge).
3. Crisp per-part background-position overlays (controls).

Each was added to fix a symptom of the prior layer without considering interaction. The result is a *layered approximation*, not a *correct composition*.

The correct rendering model is: **one** compositor walks the scheme's wnd# data + cicn pixels and produces **one** canonical layout per window. CSS approximations of this (border-image, multi-layer backgrounds) work for *some* schemes but not as a general approach.

---

## 4. The data gap — what we extract vs what we'd need

What the extractor currently produces in `theme.json` for window-type entries:

```json
"windowTypes": {
  "document-window": {
    "chrome": { "active": "...", "inactive": "...", "collapsed-active": "...", "collapsed-inactive": "..." },
    "parts": {
      "part-0": { "rect": [1, 22, 72, 23] },
      "part-1": { "rect": [9, 5, 20, 16] },
      ...
    },
    "edges": {
      "top":    [ {"at": 0, "part": "part-0"}, {"at": 5, "part": "part-1"}, ... ],
      "bottom": [...],
      "left":   [...],
      "right":  [...]
    },
    "bodyPattern": null
  }
}
```

**The `edges` data is decoded but the runtime ignores it.** We have side-recipe information already extracted from wnd#, but no renderer consumes it.

What's missing:

- **Title-pill region identification.** Schemes implicitly carry this as "the gap between the dividers in the rectangle list" but no part is explicitly labeled as the title region. Possible: heuristic (find the largest empty rectangle between part rects on the titlebar), or extractor extension to detect title-pill via cicn pixel inspection.
- **Body-pattern reference.** `bodyPattern` is always `null` because neither cinf nor wnd# directly encodes which ppat fills the body. Kaleidoscope likely uses `Colr` resource for this — we don't decode Colr yet.
- **Per-state semantic part naming.** Part IDs are scheme-relative integers (per the 2026-05-17 LEARNINGS entry); no extractor pass yet derives "part-N is the close box" via cicn-pixel analysis.

---

## 5. Options to close the gap

### Option A: Retreat to "stretched cicn only," accept low fidelity

- Remove the crisp glyph overlays (#60).
- Remove the 1px border-image (#60).
- Render chrome as: `background-image: url(cicn); background-size: 100% 100%; image-rendering: pixelated`.
- Use CSS placeholder border for window frame.
- **Pros:** simple, one rendering layer, no double-render artifacts. Restores the better visual state from PR #59.
- **Cons:** controls stretch (blurry), no scheme-derived border, title text still overlaps stretched controls. Visually mediocre but consistent. Doesn't differentiate Aaron UI from any other window library — the cicn might as well be a `linear-gradient`.
- **Effort:** ~1 hour (revert).

### Option B: Implement proper wnd# side-recipe composition

- Build a real wnd# renderer: walk each side's `(part, position)` recipe, emit one absolute-positioned div per region, with `background-position` negative-offset cropping the cicn region for that part. Same idea as the current per-part glyph rendering, but applied to each edge segment.
- Title-pill: detect empty horizontal gap in the top-edge recipe between consecutive parts; position title text inside that gap.
- Body-pattern: extend extractor to decode `Colr`; emit `bodyPattern` slug; apply as ppat tile on body region.
- **Pros:** correct mapping from Kaleidoscope's rendering model. Scheme-faithful at any window size. ErgoBox's projecting tab would actually project. The "cicn-slice trick" (LEARNINGS 2026-05-17) generalizes from controls to all chrome regions.
- **Cons:** significant work. Estimated breakdown:
  - Renderer: ~4 hours (one div per side-recipe segment, careful positioning + width/height computation).
  - Title-pill heuristic: ~2 hours.
  - Colr decoder + body-pattern extractor pass: ~3 hours.
  - Tests + canonical-bundle re-extraction + visual verification: ~3 hours.
  - **Total: ~1-2 days.**
- **Effort:** real but bounded. No new architectural risk because the wnd# data is already extracted.

### Option C: Hybrid — fixed-size chrome at integer scale only

- Don't try to render the chrome at arbitrary window sizes. Instead: render every window at the chrome cicn's native size × integer scale factor (1×, 2×, 3×).
- For a 74×25 cicn, supported window sizes would be 74×25, 148×50, 222×75 (etc.).
- Controls stay crisp (pixelated rendering at integer scale).
- **Pros:** trivially correct visually. No composition complexity.
- **Cons:** windows can't be arbitrary user-resizable. Breaks the resize feature. Not what users expect from a window library.
- **Effort:** medium (need to lock resize to integer cicn-multiples).

### Option D: Concede and use CSS-authored chrome per default theme

- Ship a hand-authored CSS Platinum chrome (the original Phase 2 we dropped) as the bundled default. Use the runtime only for *additional* loaded schemes.
- **Pros:** Platinum looks right out of the box. Phase 3 controls can rely on a known-good chrome.
- **Cons:** Reverses the 2026-05-17 Kaleidoscope-runtime-pivot. Re-introduces the dual maintenance cost the pivot was meant to avoid.
- **Effort:** medium.

---

## 6. Recommendation

**Option A first (revert to single-layer rendering), then Option B in a properly-scoped ticket.**

Reasoning:

- **Option A in this branch immediately reverts the visible artifacts to a less-broken state** (matching PR #59's appearance). Better to ship "uniformly stretched cicn" than "double-rendered crisp + stretched conflict." This is honest about the current limitation.
- **Option B is the right architectural target** but it's 1-2 days of work. Bundling it into a "fix the visuals" branch repeats the reactive pattern. It needs to be its own ticket with the spec in hand: this gap analysis is the spec.
- **Option C is impractical** — locking windows to integer cicn multiples breaks the WM core's user-resizable contract.
- **Option D would be a strategic reversal** — the pivot is recent and we have the runtime working; better to invest in proper rendering than re-undo the pivot.

### What this means for next PRs

1. **PR: revert #60's overlay glyphs and 1px border-image** (Option A). The runtime renders chrome as a single stretched cicn. Document the known limitations on the deployed demo + in CONTRIBUTING. ~1 hour.
2. **PR: legacy demo cleanup.** `themes-raster.html`, `themes.html`, `platinum-static.html` are pre-runtime artifacts that confuse the dev experience (the dev server's `open: '/themes-raster.html'` is currently the *default opened page* — a dead end). Move under `demo/legacy/` or delete + remove from build inputs. ~30 min.
3. **New tracker issue: "Implement wnd# side-recipe composition for scheme-faithful chrome rendering"** with this gap analysis as the spec. Owned, scheduled, not rushed. The Colr decoder extension is a sub-ticket.
4. **Phase 3 (controls) can proceed in parallel** with Option B because controls render off `chromeElements[<slug>]` which DOES have cinf data — they're not affected by the windowType chrome gap.

---

## 7. Methodology change — for future visible-tier work

The pattern that led here: ship a visible tier → user spots artifact → reactive CSS fix → new artifact → another fix. Three iterations and the visuals are still wrong.

Going forward:

- **Visible-tier PRs include a "what this renders correctly vs. doesn't" section.** Honest about gaps before shipping.
- **Cut-throughs against the deployed demo are mandatory after every visible-tier PR.** Not optional cleanup; part of the close-out.
- **When the user reports a visual issue, the first response is to read existing code + reference artifact, not to write CSS.** This document is what should have happened after the first artifact report, not after the third.
- **The `browse` tool exists and should be used for visual debugging.** Headless screenshots into the conversation close the feedback loop without waiting for gh-pages deploy + user re-screenshot.

This document is the methodology applied to the current state. The next PR follows the recommendation.

---

## 8. References

- [`docs/runtime-rendering-architecture.md`](./runtime-rendering-architecture.md) — output contract; this gap analysis identifies where it's silent on side-recipe composition + title pill.
- [`docs/kaleidoscope-geometry-spec.md`](./kaleidoscope-geometry-spec.md) — input contract; the wnd# side recipe data described in §3 is what we need to start consuming.
- LEARNINGS 2026-05-16 entries on chrome rendering, ppat composition, fixed-aspect constraints.
- LEARNINGS 2026-05-17 entries on cicn-slice trick, 1px border-image approximation, gh-pages visual cut-throughs.
- PRs #58, #59, #60 — the reactive sequence this document corrects.
