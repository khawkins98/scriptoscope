# Declarative window management via `data-aaron-*` — design (litmus-test build)

**Date:** 2026-05-27 · **Branch:** `feat/declarative-windows` (isolated; abandonable) · **Status:** BUILT overnight

---

## ☀️ MORNING HANDOFF — read this first

**It's built and it's green.** Implemented overnight, isolated on `feat/declarative-windows`. `main`
is untouched — `git checkout main` walks away from the entire experiment if you don't like it.

**Try it:**
```
npm run dev    # then open:
#   http://localhost:5173/declarative.html        — mechanics litmus (4 window cases)
#   http://localhost:5173/declarative-site.html   — the data-attribute hooks applied to a REALISTIC
#                                                    vanilla page (article + native form + links + gallery)
```
You should see four Mac windows, each just a `<div data-aaron-window>` with live HTML inside:
1. **"Read Me"** — declared size; scrollable content; drag the title to move, the gripper to resize, click to focus. Selectable text. Should start ACTIVE.
2. **"Notes"** — *content-fit* (no declared size): fits its content, and clicking **"Add a line"** grows the chrome (a ResizeObserver re-render). The litmus of the canvas-vs-live-DOM tension.
3. **"Save changes?"** — a `1138`-themed modal (per-window `data-aaron-theme`) with a **default OK button** (the ring); buttons fire their `alert()`.
4. **"Background"** — starts inactive (`data-aaron-state="inactive"`); click to focus.

**Verification done overnight:** `npm run typecheck` clean · `npm test` 46/46 (7 new pure-logic
tests) · `npm run build` + `npm run build:demo` green (both pages emit). Two subagents reviewed the
runtime DOM logic I can't run in Node — they confirmed the slot-survival, content-fit loop guards,
MutationObserver settling, button-forwarding, and positioning are correct, and flagged 3 P1 bugs
which are FIXED (active-state determinism, per-window button theme, safe unmount).

**The verdict is yours:** does "drop a data-attribute, get a real Mac window wrapping live content"
feel practical? If yes → the ADR-0001 PA/PB/PC work (Shadow DOM, border-image/CSS, persistence)
becomes the path to production. If it fights you → abandon the branch; nothing on `main` changed.

**Known P2s (not blockers, deliberately deferred):**
- A *content-fit* window manually resized via the gripper snaps back to content size on the next
  content reflow (fit vs. manual-size is a semantic conflict — declared windows resize fine).
- `#desktop` clips windows dragged past its bounds (it's a bounded "screen").
- Auto-cascade position order is nondeterministic for windows without declared x/y (the demo
  declares all positions, so unaffected).

**Open questions for the next pass:** Shadow-DOM encapsulation (ADR Decision 2 — light DOM for now,
host-page CSS can reach the slotted content); the border-image/CSS chrome (ADR Decision 1, still
spike-gated — this build is canvas-only); whether content-fit should be the default or declared-size
should; and whether a manually-resized fit window should auto-switch to declared mode.

**Commits:** design `52bea78` · parse+tests `cb3e816` · WM hook `8da43a5` · AaronWindow `e443d98` ·
theme/scanner/button/entry `1323600` · demo page+vite `bd5d248` · review P1 fixes `10cbc47` ·
morning handoff `5f95dc0` · disconnect teardown (P2) `ec7ce86`. Two subagent reviews; final = GO.

---

**One line:** put `data-aaron-window` on a plain `<div>` and the library promotes it into a faithful
classic-Mac window — no JS required for the common case — over the EXISTING canvas runtime.

This is the North Star front door (`PRD.md`, `docs/adr/0001-consumption-architecture.md`), built as
an isolated litmus test: does "drop a data attribute, get a Mac window wrapping live DOM content"
actually feel practical? It deliberately ships over the current **canvas** chrome (it does NOT wait
on ADR-0001's border-image/CSS spike) so we can judge the UX now; the canvas→CSS swap can happen
underneath later without changing the public attribute contract.

## Hard isolation rules (don't break what exists)

1. **New code only under `src/declarative/`.** A NEW entry (`src/declarative/index.ts`) — do NOT add
   the consumption API to the existing `src/index.ts` runtime contract (additive re-export at most).
2. **New page `demo/declarative.html`** — a sample webpage driven by `data-aaron-*` + one tiny
   bootstrap. The existing `demo/index.html` is untouched.
3. **Reuse, don't fork, the runtime:** `loadTheme`/`loadKaleidoscopeScheme`, `renderWindow`,
   `WindowManager`, `interactiveButton` (from `src/`). The declarative layer is a THIN scanner over them.
4. **The existing test suite stays green (39/39)** and the existing demo renders unchanged. New tests
   are added for the new code.

## The attribute contract (v1)

- **`data-aaron-window`** on an element → promote to a window. Reads:
  - `data-aaron-title` — title text (also feeds the window's `aria-label`).
  - `data-aaron-window-type` — slug (default `document-window`).
  - `data-aaron-x` / `data-aaron-y` — initial position (px). Default: leave in flow / a sensible offset.
  - `data-aaron-width` / `data-aaron-height` — CONTENT size (px). **If omitted → content-fit** (the
    element's natural size drives the window; a `ResizeObserver` re-renders chrome on reflow).
  - `data-aaron-state` — `active` | `inactive` (default active; the WindowManager owns focus after).
- **`data-aaron-button`** on a `<button>`/element → promote to a themed button. Reads
  `data-aaron-default` (the OK ring), `data-aaron-disabled`. Click behavior preserved (it stays a
  real focusable button; we skin it).
- **`data-aaron-theme="<url-or-slug>"`** on `<html>`/`<body>`/any ancestor → which theme bundle to
  load. Resolved nearest-ancestor-wins. A page-level default is configurable in the bootstrap.
- **CSS-class fallback** (`.aaron-window`, `.aaron-button`) — recognised too, for CSP/markup-restricted
  hosts. Data attributes are the primary path.

## Mechanic ("promote in place")

The promoted element's **own children become the window's content**, slotted into the frame's content
hole (light DOM — the content stays selectable/accessible/reflowing). The chrome is the canvas behind
it (already how `renderWindow` works). Two size modes:
- **Declared** (`data-aaron-width/height`): fixed content rect.
- **Content-fit** (omitted): measure the content, render chrome to fit, and `ResizeObserver` →
  re-render chrome (debounced) when the content reflows. This is the realistic "drop on a div" case
  and the real stress test of the canvas-vs-live-DOM tension.

## Scanner

- On `DOMContentLoaded`: `querySelectorAll('[data-aaron-window], .aaron-window')` → promote each.
- A single root **`MutationObserver`** promotes elements added later (dynamic content). Promoted
  elements get `data-aaron-promoted` so re-scans skip them.
- An imperative foundation underneath: an **`AaronWindow`** class (wraps one element) + a
  `mountDeclarative(root?, opts?)` entry the scanner and consumers both use.

## Plan-agent corrections (red-team, 2026-05-27)

- **`WindowManager` re-render destroys slotted content (the load-bearing finding).** `render()` does
  `host.replaceChildren(win)` on every focus/resize, rebuilding `.aw-content`. Fix: an ADDITIVE
  `contentEl` hook on `add(theme, opts, handlers, { contentEl })` — `render()` re-attaches the SAME
  persistent content node into the fresh `.aw-content` each time (preserves listeners/selection).
  Existing callers pass 3 args → unaffected.
- **Content-fit is highest-risk → LAST task.** Build it on the declared-size re-render path. Observe
  an inner `max-content` wrapper (NOT `.aw-content`, which we resize), with rAF debounce + epsilon +
  re-entrancy flag + disconnect-during-render to kill the feedback loop.
- **Base chain needs a configurable base URL** in the bootstrap (standalone consumers must point at a
  reachable `apple-platinum-replica` bundle). Port `loadWithBase` from `demo/index.html` into
  `src/declarative/theme.ts`.
- **Drop `data-aaron-scale` from v1** (scale 1 only) — avoids the scale×content-measurement interaction.
- **Tests: pure logic in Node, NO DOM devDep** (jsdom/etc. can't do the canvas the runtime needs).
  `demo/declarative.html` is the integration litmus.

## What we reuse / must touch

- `WindowManager` (focus/z-index/drag-move/grow-resize/widget-press) — already built; the scanner
  feeds windows into it.
- **Base-theme chain gap:** today it's wired only in `demo/index.html`. The declarative bootstrap must
  wire the base chain itself (so a standalone consumer gets control/window-type fallbacks) — fix it in
  the declarative layer, not by changing `loadTheme`'s default (keep the runtime contract stable).

## Non-goals (v1 / this branch)

- Shadow-DOM encapsulation (ADR Decision 2) — light DOM for now; note the CSS-leak risk.
- border-image/CSS chrome emission (ADR Decision 1, spike-gated) — canvas only.
- Reskinning native form controls (`<input>`/`<select>`/scrollbars) — out (ADR scope guard); only
  explicitly-marked `data-aaron-button` etc.
- Persistence of window positions across reloads.

## Testing

- **Node-testable pure logic:** attribute→options parsing, theme-URL/`data-aaron-theme` resolution
  (nearest-ancestor), the promote/skip bookkeeping — extracted into pure functions, tested without a DOM.
- **DOM/integration:** the `demo/declarative.html` page IS the litmus test (browser, owner-verified in
  the morning). If a lightweight DOM (jsdom/linkedom) is cheap to add as a devDependency, add scanner
  tests too; otherwise keep the DOM surface thin and rely on the page + a review agent.

## Success / litmus criteria

A static `demo/declarative.html` with NO per-window JS — just `data-aaron-*` on divs and one
`<script type="module">` bootstrap — renders several real Mac windows wrapping live, selectable,
reflowing HTML content (paragraphs, a list, a button), draggable/resizable/focusable, with at least
one **content-fit** window that re-renders its chrome when its content changes. If that feels right,
the idea is practical; if it fights us badly, we learn that cheaply and abandon the branch.
