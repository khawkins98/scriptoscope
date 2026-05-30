# Interactivity — research + implementation plan

Goal: wire real interaction onto the rendered chrome/controls — button press,
checkbox/radio toggle, disclosure expand, window active/inactive (focus), and
(phase 2) scrollbar/slider drag + title-bar widget clicks (close/zoom/collapse).

**Status: DONE.** Phase 1 (button/checkbox/radio/disclosure/window-focus) and
Phase 2 (slider+scrollbar drag, title-bar widget hit-testing) both shipped in
`src/interactive.ts` (exported) + the demo's "interactive playground" section.
The notes below are the original research; they describe the as-built design.

## Key finding: state is ALREADY first-class — interactivity = event → state → re-render
The compositor renders per-STATE cicns today; nothing new needs drawing:
- `ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive'` (controls.ts).
- `composeButton(theme, { pressed, disabled, default, … })` — buttons ship
  distinct cicns: face `-10239` active / `-10238` pressed / `-10240` disabled;
  default ring `-10231`/`-10232`.
- `composeCheckable(theme, kind, { checked, disabled })`.
- `composeScrollbar/Slider/Disclosure/GrowBox(theme, { state })` — each loads the
  pressed/inactive/disabled cicn by resource id.
- `renderWindow(theme, { state: 'active'|'inactive', … })` → `.aw-window`
  (`dataset.awState`). Active/inactive chrome already differ.

So the work is a thin **event layer** that flips the state option and re-renders
the affected canvas/window — NOT new pixel logic.

## Architecture
A new library module `src/interactive.ts` (exported), wrapping the compose fns.
Controls are non-semantic cicn canvases, so each interactive control is a
**focusable wrapper element** (real semantics + ARIA + keyboard) holding the
canvas; events mutate state and swap the canvas.

**Compose is async (cicn loading), so PRE-RENDER the discrete states once** and
swap instantly on events (snappy, no async mid-interaction):
- button → {normal, pressed, disabled}; checkable → {checked, unchecked}(×disabled);
  disclosure → {closed(right), open(down)}.
- continuous controls (slider/scrollbar) → compose the track once, then on drag
  reposition/re-compose just the thumb (avoid re-composing the whole control per
  pointermove).

### Per-control
- **Button** — wrapper `role=button`/`<button>`, tabindex. mousedown→pressed;
  mouseup/leave→normal; click + Space/Enter→`onClick`. Disabled = no events.
- **Checkbox / Radio** — click + Space→toggle `checked`, swap, `onChange`. Radio
  = group manager (one selected; selecting clears siblings).
- **Disclosure** — click→toggle direction, `onToggle(open)` to show/hide content.
- **Window focus** — a small **WindowManager** tracking the active window among
  several: clicking any window → that one `active`, others `inactive`, re-render
  each chrome. (renderWindow already supports the state.)
- **Scrollbar / Slider (phase 2)** — pointerdown on thumb → state `pressed`;
  pointermove → value = clamp(pos along axis, 0..1) → reposition thumb +
  `onChange`; pointerup → normal. Scrollbar arrow boxes → step. Drag math + a
  thumb-overlay-canvas approach for perf.
- **Title-bar widgets (phase 2)** — close/zoom/collapse are baked into the chrome
  cicn; their hit rects come from the rect-list / the compositor `placement` map
  (the slice inspector already hit-tests via placement — reuse it). Click a
  widget rect → `onClose/onZoom/onCollapse`; show the pressed widget cicn if one
  exists.

### Event model
Callbacks: `onClick`, `onChange(value)`, `onToggle(open)`, `onClose/Zoom/Collapse`
— the demo/consumer drives behaviour; the module only handles visual state.

## Phasing
- **Phase 1** (discrete-state swaps, low risk): button press, checkbox/radio,
  disclosure, window active/inactive on click. Highest value, cleanest.
- **Phase 2**: scrollbar/slider drag, title-bar widget hit-testing + actions.

## Existing plumbing to build on
The playground already re-renders on `<select>` change and the slice inspector
already wires `mousemove`/`click` on the window canvas + a placement-based
hit-test (`demo/diagnostic.html` ~L579–621). The WindowManager + widget hit-testing
extend that pattern.

## Conflict avoidance (sibling agent on Platinum-replica)
A sibling is editing `renderWindow.ts` / `controls.ts` / `demo/diagnostic.html` /
`scripts/generate-platinum*` for the Platinum-replica sub-project. To avoid
collisions:
- Put the logic in the NEW `src/interactive.ts` (no overlap).
- Showcase it in a NEW demo section ("interactive playground") rather than
  rewriting the existing scene/playground code.
- On resume: `git pull` / check `git log` first, rebase on the sibling's landed
  work, only then touch shared files (and minimally — e.g. exporting widget
  rects from the compositor if phase 2 needs it).

## Open decisions (resolve on resume)
1. Library module vs demo-only — recommend `src/interactive.ts` (reusable) +
   demo showcase.
2. Pre-render-all-states vs re-compose-on-event — recommend pre-render discrete,
   re-compose/ reposition for continuous.
3. Phase-1 scope to ship first (likely: button + checkable + window focus).
