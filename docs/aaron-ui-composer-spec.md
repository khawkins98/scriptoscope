# Aaron UI — Composer Runtime Specification

**Status:** v1.0 — written 2026-05-19. Defines the JS runtime architecture that takes a loaded Kaleidoscope scheme and produces the DOM defined in spec A, applying the rules from spec B.

**Spec C of three:**
- [`docs/aaron-ui-html-skeleton-spec.md`](./aaron-ui-html-skeleton-spec.md) — DOM contract (spec A)
- [`docs/aaron-ui-raster-mapping-spec.md`](./aaron-ui-raster-mapping-spec.md) — mapping rules (spec B)
- **This document** — runtime architecture (spec C)

**Audience:**
- Internal maintainers building or rewriting Aaron UI's runtime
- External developers extending Aaron UI with custom controls or asset resolvers

**Scope guarantees:**
- This spec defines the runtime's **architecture** — module boundaries, data flow, public API, lifecycle. It does **not** prescribe specific code (file names, function signatures, library choices beyond what's pinned).
- The current `src/themes/runtime/` implementation predates this spec. Section §11 calls out where the current code aligns with the spec and where the planned rebuild diverges.

---

## 1. Responsibilities

The runtime owns five concerns:

1. **Loading** — convert a Kaleidoscope rsrc (or pre-extracted JSON+PNG bundle) into a normalized `Theme` data object.
2. **Registration** — hold the active `Theme` in a single source of truth; notify subscribers on change.
3. **Composition** — given a DOM element + a `Theme`, produce the spec-A DOM by applying spec-B mapping rules.
4. **State machines** — wire pointer/keyboard events on themed elements to flip `data-state` attributes (per spec A §1.4).
5. **Scanning** — walk the document for `data-aaron-{family}` sentinels + promote them per spec A §21.

Each is a discrete layer with a well-defined input/output contract. Higher layers depend only on the contracts of lower layers, never on their internals.

---

## 2. Layer diagram

```
┌──────────────────────────────────────────────────────────────┐
│                  Consumer (app code or HTML)                 │
│  - calls `loadTheme(url)` or includes <script src="aaron">   │
│  - writes `data-aaron-button` markup OR `new AaronButton()`  │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 5 — Scanner + programmatic API                         │
│  - DOM scanner with MutationObserver                         │
│  - new AaronXxx() factories                                  │
└─────────────────────────┬────────────────────────────────────┘
                          │ produces spec-A DOM stubs
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 4 — State machines (per family)                        │
│  - wires pointer/keyboard events → data-state                │
│  - keyboard focus management                                 │
└─────────────────────────┬────────────────────────────────────┘
                          │ provides themed elements
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 3 — Composer (per family, per element type)            │
│  - reads Theme + applies spec-B rules                        │
│  - produces final DOM with CSS custom props + cicns wired up │
└─────────────────────────┬────────────────────────────────────┘
                          │ subscribes to Theme changes
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 2 — ThemeRegistry                                      │
│  - single source of truth: current Theme | null              │
│  - event-emitter pattern                                     │
└─────────────────────────┬────────────────────────────────────┘
                          │ exposes Theme | null
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Layer 1 — Loader                                             │
│  - rsrc → Theme   OR   JSON+PNG bundle → Theme               │
│  - asset URL resolver                                        │
└──────────────────────────────────────────────────────────────┘
```

Cross-cutting concern: **error handling + diagnostics** (§8) — every layer logs to a runtime conformance report.

---

## 3. The `Theme` data object

The Theme object is the runtime's central data type — Layer 1 produces it, Layers 2-5 consume it. Its schema is the de-facto contract between the loader and everything downstream.

### 3.1 Required fields

```typescript
interface Theme {
  version: 1;                          // Schema version (THEME_SCHEMA_VERSION)
  slug: string;                        // 'masswerk-7-le' etc.
  name: string;                        // Human-readable display name

  // Window types: each entry has chrome cicns + rectList + recipe.
  windowTypes: Record<WindowType, {
    chrome: { active: string; inactive?: string; collapsed?: string };
    parts: Record<string, { rect: [number, number, number, number] }>;
    edges: {
      top:    RecipeEntry[];
      bottom: RecipeEntry[];
      left:   RecipeEntry[];
      right:  RecipeEntry[];
    };
    cinf: CinfFields;
  }>;

  // All chrome cicns + their dimensions + cinf (flat lookup table).
  chromeElements: Record<string, {
    asset: string;                     // Resolved URL
    width: number;
    height: number;
    cinf?: CinfFields;
  }>;

  // Patterns (ppat).
  patterns?: Record<string, { asset: string; width: number; height: number }>;

  // Scheme global settings (Colr).
  colr?: ColrFlags;

  // Extracted colors (per spec B §4.16-§4.18).
  colors?: Record<string, string>;

  // Cursors.
  cursors?: Record<string, { asset: string; hotspot: [number, number] }>;
}

interface RecipeEntry { at: number; part: string; }   // part is "part-0"..."part-18"
interface CinfFields {
  cornerSize: number; sideThickness: number;
  tileSides: boolean;
  patternAnchor: 0 | 1 | 2 | 3;
  bgPatternId?: number;
  textAnchor: 0 | 1 | 2;
  embossAnchor: 0 | 1 | 2;
  alpha?: number;          // 0x0000-0xFFFF, menus only
  extendedBorder?: boolean;
}
interface ColrFlags {
  unifiedScrollbarTrack: boolean;
  windowsStyleScrollbars: boolean;
  stretchScrollbarThumbFromCenter: boolean;
  menuHighlightOverlay: boolean;
  extendedScrollbarArrows: boolean;
  // ...all other documented Colr flags
}
```

`WindowType` enumerates the 9 spec-A §2.1 window types.

### 3.2 Invariants enforced by the loader

Before the loader emits a `Theme`:

- All asset URLs are resolved (no relative paths leak to downstream layers).
- All recipe entries reference parts present in `parts` (or `part-0`).
- `chromeElements` keys are semantic names (`active-document-window`, `pressed-push-button`); ID lookups happen inside the loader.
- Missing-resource fallbacks are applied per spec B §9 + logged.

Downstream layers can assume a well-formed Theme. They never re-validate.

---

## 4. Layer 1 — Loader

### 4.1 Inputs

Two source formats, both produce a `Theme`:

| Input | Function | Notes |
|---|---|---|
| Pre-extracted JSON+PNG bundle | `loadTheme(slug)` | Currently the only path. Slug → `themes/{slug}/theme.json` + asset directory. |
| Raw Kaleidoscope rsrc | `loadThemeFromRsrc(arrayBuffer)` | Parses the rsrc fork in-browser. Currently exists but not wired into the demo. |

### 4.2 Output

A `Theme` object per §3.

### 4.3 Internal pipeline (rsrc path)

```
rsrc bytes
  → ResourceFork parser (typed slices by resource type)
  → Per-resource decoders:
      • cicn → ImageBitmap (in-memory PNG-ish)
      • cinf → CinfFields parser (TMPL 129)
      • wnd# → RecipeEntry[] parser
      • ppat → ImageBitmap (tiled)
      • Colr → ColrFlags parser
      • STR# → string table → name, description, URL
  → Normalizer (apply spec-B §9 fallbacks; emit Theme)
```

### 4.4 Asset URL resolver

The loader exposes a single hook: given a semantic name, return a URL. Default implementation resolves to `${slug}/cicns/${semantic-name}.png`. Consumers can override (e.g., to serve from a CDN, or to use data URIs).

### 4.5 Conformance reporting

Loader returns `{ theme: Theme, report: ConformanceReport }` per spec B §12. The report enumerates missing resources, fallbacks applied, malformed recipes.

---

## 5. Layer 2 — ThemeRegistry

### 5.1 Contract

```typescript
interface ThemeRegistry {
  current(): Theme | null;
  replace(theme: Theme | null): void;
  subscribe(listener: (theme: Theme | null) => void): () => void;   // returns unsubscribe
  reset(): void;
}
```

Singleton. Aaron UI ships one instance.

### 5.2 Notification semantics

- `replace()` synchronously notifies all subscribers.
- A subscriber unsubscribing during notification doesn't see notifications fired after it unsubscribed.
- Subscribers throwing exceptions don't break the chain (caught + logged).

### 5.3 Where the Theme comes from

Layer 1 + the consumer wire this together:

```javascript
const theme = await loadTheme('masswerk-7-le');
themeRegistry.replace(theme);
```

---

## 6. Layer 3 — Composer

### 6.1 Contract (per family)

Each spec-A family has a composer:

```typescript
interface Composer<TFamily> {
  // Given a DOM element + the current Theme, apply spec-B mapping rules.
  apply(element: HTMLElement, theme: Theme, options?: ApplyOptions): void;
  // Tear down: remove all theme-applied DOM + CSS custom properties.
  clear(element: HTMLElement): void;
}
```

### 6.2 The window composer (the heaviest)

The window composer is the most complex. Per spec B §4.1:

1. Look up the window type (from `data-window-type`).
2. Read the chrome cicn pair + cinf + wnd# from `theme.windowTypes[type]`.
3. Walk the recipe per spec B §2.4 — produce a segment list per edge.
4. For each segment per spec B §2.5 + §3, paint via `border-image-source` + `border-image-slice` + `border-image-repeat` on a per-segment `<div>`.
5. Stamp `[data-aaron-chrome-edge]` strips + `[data-aaron-chrome-segment]` children into the spec-A DOM.
6. Mount widget overlays (`.aaron-widget--{name}`) per `rectList[1..4]`.
7. Stamp Colr flags as data attributes on the window root.
8. Mount background pattern (if `cinf.bgPatternId`) on `.aaron-content`.

### 6.3 The non-window composers (the lighter ones)

Per-family composers (button, checkbox, radio, etc.) follow the same shape but vastly simpler — they only need to stamp 1-4 cicns as CSS custom properties on the element + ensure the spec-A DOM exists.

```javascript
// Sketch: button composer
function applyButton(el, theme) {
  el.style.setProperty('--cicn-normal',   theme.chromeElements['normal-push-button'].asset);
  el.style.setProperty('--cicn-pressed',  theme.chromeElements['pressed-push-button'].asset);
  el.style.setProperty('--cicn-disabled', theme.chromeElements['disabled-push-button'].asset);
  // ... border-image-slice from cinf, etc.
}
```

### 6.4 Subscription pattern

Each composer subscribes to ThemeRegistry. When Theme changes, every attached element re-applies. When Theme becomes `null`, every attached element clears.

This is wired via `attachThemeToWindow` (existing) and per-family `attachThemeToControl` helpers.

### 6.5 Performance

State-state cicn swaps are driven by CSS attribute selectors (`[data-state="pressed"]`), not by composer re-runs. The composer runs **once per attach** + **once per Theme change**, not per state flip. This is per spec B §10.

---

## 7. Layer 4 — State machines

### 7.1 Per-family wiring

Each interactive family has a state machine that listens for events on a themed element + flips `data-state`. Wiring follows spec A §1.4 (universal contract).

```typescript
interface StateMachine {
  wire(element: HTMLElement, options?: WireOptions): () => void;  // returns unwire
}
```

### 7.2 Universal events

| Event | Resulting `data-state` |
|---|---|
| `pointerdown` (left button) | `pressed` |
| `pointerup` (over element) | `normal` + fire `activate` event |
| `pointerleave` while pressed | `normal` (no activate) |
| `focus` | `focused` (if focusable) |
| `blur` | `normal` |
| `Space` / `Enter` keydown (when focused) | `pressed` |
| `Space` / `Enter` keyup (when focused) | `normal` + fire `activate` |

`disabled` overrides all — pointer + keyboard events are ignored.

### 7.3 Per-family extensions

| Family | Additional |
|---|---|
| Checkboxes/radios | Activate toggles `aria-checked` + `data-value` |
| Disclosure | Activate toggles `aria-expanded` + plays animation (cicn cycle) |
| Tabs | Arrow keys move focus; Enter activates |
| Sliders | Arrow keys + Page Up/Down change `aria-valuenow` |
| Scrollbars | Pointer drag on thumb sets `aria-valuenow`; arrow buttons step |
| Menus | Open on click; close on Escape/click-outside |
| Window widget overlays | Activate fires window-event (close/zoom/collapse per spec A §2.4) |

### 7.4 Composability

State machines wire on top of Layer 3's composition. Element creation order: composer apply → state machine wire. Teardown reverses: unwire → clear.

---

## 8. Layer 5 — Scanner + programmatic API

### 8.1 Scanner

The scanner walks the document on init + uses MutationObserver for dynamic content. Per spec A §21:

1. Query `[data-aaron-{family}]:not([data-aaron-promoted])` for each family.
2. Wrap/transform the element per spec A's family-specific rules (e.g., wrap `<input type="checkbox">` in a `<label class="aaron-checkbox">`).
3. Apply Layer 3 composer + Layer 4 state machine.
4. Mark `data-aaron-promoted` to prevent re-scan.

### 8.2 Programmatic API

For each family, expose `new AaronXxx(opts)`:

```typescript
class AaronButton {
  constructor(opts: { label?: string; default?: boolean; disabled?: boolean });
  element: HTMLElement;                   // The themed DOM
  on(event: 'activate', handler: () => void): () => void;
  setState(state: ControlState): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;                        // Removes from DOM, unwires
}
```

The constructor:
1. Creates the spec-A DOM shape.
2. Sets `data-aaron-promoted` (so scanner skips it).
3. Applies Layer 3 composer + Layer 4 state machine.
4. Exposes a thin event API.

Both promotion paths produce identical DOM — see spec A §21.3.

### 8.3 AaronWindow (the heaviest)

`new AaronWindow(opts)` constructs a themed window. Owns:
- The window root (`.aaron-window`) + titlebar + content area + resize handles
- Lifecycle: `show()`, `hide()`, `close()`, `zoom()`, `collapse()`
- Events: `activate`, `deactivate`, `close-request`, `zoom-request`, etc.
- Drag + resize state (own controllers, not part of theme runtime)

Currently exists. The rebuild simplifies its internals but keeps the public API stable.

---

## 9. Lifecycle

### 9.1 First-render path

```
1. Consumer page loads → Aaron UI script init
2. Scanner walks DOM → finds data-aaron-{family} elements
3. Theme is loaded (consumer-triggered: loadTheme(slug))
4. ThemeRegistry.replace(theme) fires
5. All attached composers re-apply with the new theme
6. State machines were already wired (theme-independent)
7. DOM is now fully themed
```

### 9.2 Theme swap path

```
1. Consumer calls loadTheme(otherSlug) → ThemeRegistry.replace(otherTheme)
2. All composers fire their subscription handlers
3. Each composer clears its CSS custom props + re-applies with the new Theme
4. CSS attribute selectors instantly update visuals (no JS repaint)
```

### 9.3 Element teardown path

```
1. Consumer removes a themed element from the DOM (or calls .destroy())
2. The composer's MutationObserver detects removal (OR explicit .destroy() call)
3. State machine unwire → composer clear → element released
```

### 9.4 Theme unload path

```
1. Consumer calls themeRegistry.replace(null)
2. All composers clear (no-Theme = no chrome)
3. Visual state reverts to engine-baseline (DOM still themed structurally, just no cicn assets)
```

---

## 10. Extension points

### 10.1 Custom controls

Consumers can register a custom family:

```javascript
registerFamily('progress-ring', {
  composer: { apply, clear },
  stateMachine: { wire },
  scannerSelector: '[data-aaron-progress-ring]'
});
```

The custom family's composer can read from `theme.chromeElements` like any built-in family.

### 10.2 Custom asset resolvers

The loader's URL resolver is overridable per §4.4. Use cases:
- Serve assets from a CDN
- Use data URIs (zero-network)
- Lazy-load only the cicns the page actually needs

### 10.3 Custom Theme sources

Implement a new loader: rsrc-bytes → Theme. Use cases:
- Browser-native rsrc parsing (currently partial — see `loadThemeFromRsrc.ts`)
- ResEdit-style live editing (Phase X — "live authoring tools" per the runtime pivot)
- Procedurally generated themes

---

## 11. Current implementation vs. spec C

The runtime in `src/themes/runtime/` predates spec C. Alignment status:

| Spec C concept | Current location | Status |
|---|---|---|
| Theme schema (§3) | `src/themes/schema/types.ts` | ✓ Aligned, minor field gaps (Colr flags incomplete) |
| Loader (§4) | `loadTheme.ts` + `loadThemeFromRsrc.ts` | ✓ Aligned; rsrc path not wired to demo |
| ThemeRegistry (§5) | `ThemeRegistry.ts` | ✓ Aligned |
| Window composer (§6.2) | `composeKaleidoscopeChrome.ts` + `applyChromeFromTheme.ts` | ⚠ Per-segment composer exists but uses hybrid stretch threshold (spec B §3.2) — clean rebuild can simplify against fully-locked spec B |
| Per-family composers (§6.3) | `applyControlChrome.ts` | ⚠ Phase 3 controls use CSS-drawn fallback, not cicn-driven. Rebuild moves to cicn-driven per spec B §4.2-§4.15 |
| State machines (§7) | `applyControlChrome.ts:wireControlStateMachine` | ✓ Aligned for buttons; needs extension for tabs/sliders/scrollbars |
| Scanner (§8.1) | Not yet implemented | ✗ Spec C introduces this — Phase 5 work |
| Programmatic API (§8.2) | `AaronWindow` exists; others TBD | ⚠ AaronWindow ✓; per-family classes don't exist yet |
| Conformance report (§4.5) | Partial | ⚠ Some missing-resource logging exists; full report TBD |

### 11.1 Suggested rebuild order

After spec C lands:
1. **Lock the Theme schema** to match §3 (close Colr flag gaps).
2. **Rebuild the window composer** against the now-stable spec B + spec A. Drop the hybrid threshold guesswork in favor of the locked rules.
3. **Wire Phase 3 controls** to cicn-driven composition (per spec B §4.2-§4.15).
4. **Add the scanner** (§8.1).
5. **Add programmatic API classes** (§8.2) for non-window families.
6. **Emit conformance reports** (§4.5).

---

## 12. What this spec does NOT define

- **CSS rules** — per-family stylesheet code keys off spec A DOM + spec B mapping rules. Not architectural.
- **File names / module structure** — implementation detail. The current `src/themes/runtime/*.ts` layout is one valid encoding; others are fine.
- **Library / framework choices** — spec C is framework-agnostic. The current implementation uses TypeScript + zero runtime deps; that's a project decision, not a spec one.
- **Build / packaging** — out of scope.
- **rsrc fork parsing details** — see existing `loadThemeFromRsrc.ts`. Spec C only says "Layer 1 produces a Theme"; how it does so is implementation.

---

## 13. References

- [`docs/aaron-ui-html-skeleton-spec.md`](./aaron-ui-html-skeleton-spec.md) — DOM contract (spec A)
- [`docs/aaron-ui-raster-mapping-spec.md`](./aaron-ui-raster-mapping-spec.md) — mapping rules (spec B)
- [`docs/aaron-ui-architecture-spec.md`](./aaron-ui-architecture-spec.md) — Kaleidoscope format + WDEF protocol
- `src/themes/schema/types.ts` — current Theme schema (target for §3 alignment)
- `src/themes/runtime/` — current runtime implementation (per §11)
