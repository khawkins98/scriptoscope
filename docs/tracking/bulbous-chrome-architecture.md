# Tracking: bulbous chrome + Mac window-model alignment

**Status:** Phase 1 + Phase 2 LANDED (#158 + #160 + this PR). The user's `width`/`height` now always describes the CONTENT rect; chrome (titlebar + side/bottom edges) lives OUTSIDE the content rect via absolute positioning, in both themed and unthemed modes. Drag/resize math reads `.aaron-window`'s box (which IS the content rect) and uses `getFrameThickness()` to keep the full footprint on-screen for clamp + maximize. Bulbous schemes have the DOM/CSS + runtime hooks they need.

**Followups (not blocking):**
- Resize-handle clamping: still operates on content rect only; for very small windows the chrome can technically extend past the viewport during a resize. Cosmetic.
- AaronWindow's public `boundsMode` opt-out for legacy structure-rect consumers: not implemented. No known consumers exist; revisit if a real one emerges.

---

## The observation

Kaleidoscope schemes were authored for the **Macintosh Window Manager** model, not the rectangular-DOM model we've defaulted to. Key differences:

| Concept | Mac Window Manager | Aaron UI (today) |
|---|---|---|
| The "window" the user resizes | The **content** rect | The **structure** rect (chrome + content together) |
| Chrome relative to user-set bounds | Chrome can extend **outside** the content rect | Chrome must fit **inside** the user-set bounds |
| Bulbous / non-rectangular chrome | Native — wnd# + cicn together describe any shape | Clipped — we set `overflow: hidden` on `.aaron-window` |
| Per-region semantics | wnd# parts can have rects that protrude past the body | Our composer assumes parts stay within the cicn's rect |

This matters for schemes like **Antique**, **Scherzo!**, the macthemes.garden corpus, and anything else with rounded titlebars, decorative ornaments hanging off the chrome, or tear-drop attachments. Even the mass:werk schemes are technically affected — their titlebars are rectangular, but the architectural assumption that "the user-set bounds CONTAIN the chrome" is still wrong.

## What needs to change

Three coupled shifts:

### 1. DOM split — structure vs. content

Today:
```
<.aaron-window>                  ← user-set width/height; overflow:hidden; chrome lives here
  <.aaron-titlebar>...</>        ← top chrome
  <.aaron-content>...</>         ← body
  <.aaron-window__edge--*>...</> ← side/bottom chrome
</>
```

Mac-model alignment:
```
<.aaron-window>                   ← positioning anchor; overflow:visible
  <.aaron-window__chrome>         ← chrome layer; can extend beyond .aaron-window's box
    <.aaron-titlebar>...</>
    <.aaron-window__edge--*>...</>
  </>
  <.aaron-window__content>        ← the user-set width/height applies HERE
    <.aaron-content>...</>
  </>
</>
```

The structure becomes: positioning anchor + chrome layer + content layer. The content is what resizes; the chrome surrounds (and can protrude).

### 2. Positioning semantics

When the consumer writes `new AaronWindow({ x: 40, y: 32, width: 380, height: 360 })`, do they mean:
- **(today)** the OUTER bounds — chrome is inset INTO that 380×360 box
- **(Mac model)** the CONTENT bounds — chrome adds margin OUTSIDE the 380×360 box

Mac-model alignment means the consumer's width/height is the CONTENT rect. The chrome margin (`--aaron-frame-*-px`) extends beyond. The window's total visible footprint = `width + left + right` × `height + top + bottom`.

This is a breaking API change for existing AaronWindow consumers. Mitigations:
- Default behavior: content-rect semantics (period-correct)
- Opt-out: `new AaronWindow({ boundsMode: 'structure' })` retains old behavior
- Migration path: document + leave the structure-rect default for one release before flipping

### 3. CSS overflow

`.aaron-window` needs `overflow: visible` so bulbous chrome can protrude. But content needs its own clip (so consumer HTML doesn't bleed into the chrome area). Use `.aaron-window__content { overflow: hidden }` instead.

## Why this didn't surface earlier

Because:
- Our 5 mass:werk-shipped schemes happen to have rectangular chrome
- The 5 exotic schemes (acid/1138/1990/big-blue/evolution) are less bulbous than the K2.3-bundled set (Antique, BeBox, Sherbet)
- Window dragging / resizing was tested with the current model; works fine for rectangular chrome
- We haven't yet visualized what the chrome cicn LOOKS like at native dimensions vs. inset into the window — the diagnostics page shows cicns at 4× scale separately, not in-place against the rendered window

## Estimated cost

Moderate refactor. Touches:
- `AaronWindow.createDom()` — emit the new container structure
- `AaronWindow` drag/resize/positioning logic — operate on `.aaron-window__content` instead of `.aaron-window`
- `composeKaleidoscopeChrome` — paint into `.aaron-window__chrome`, position relative to content rect
- `applyWindowParts` — re-anchor widget overlays
- Demo CSS — update selectors + drop the `overflow: hidden` from `.aaron-window`
- E2E tests — bounding-box assertions need to know which rect is reported

Likely 2-3 PRs over 1-2 days of focused work. Not a 4-hour autonomous task.

## What to do meanwhile

Until the Mac-model alignment lands:
- The composer (post-option-B) renders rectangular chrome correctly within the user-set bounds
- Bulbous-feature schemes will have their chrome clipped to the window's bounding rect
- The diagnostics page's "Chrome cicns" section shows the cicn at native size — bulbous features are visible THERE even if the rendered window clips them
- Documentation should flag this as a known limitation for any scheme that uses non-rectangular chrome

## Decision

**Keep the current model for now. Revisit after we've landed:**
1. The recipe / part / chromeElement → DOM mapping visualization (in flight)
2. Scrollbar / slider / tabs / popup-menu families (in flight)

Once those are in, do the Mac-model refactor in a focused multi-PR sprint.

## Related

- `docs/kaleidoscope-to-html-mapping.md` §4 — current divergences from period behavior
- `docs/aaron-ui-html-skeleton-spec.md` (spec A) §2 — current DOM contract (would change)
- `docs/aaron-ui-composer-spec.md` (spec C) §6.2 — current composer model (would change)
