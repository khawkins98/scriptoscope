# Persistence — design proposal

> ✅ **SHIPPED 2026-05-28** as `src/declarative/persistence.ts` (closes #165). The minimal-viable surface (opt-in `mountDeclarative({ persistKey })` + `data-scriptoscope-window-id` for stable identity + `data-scriptoscope-persist="off"` opt-out + `localStorage` storage with the schema below + cross-tab sync via the `storage` event) matches what the §"Recommendation summary" section pinned. This doc is kept in place as the design reference (cited from `src/declarative/persistence.ts` + `src/declarative/scanner.ts`); the "Questions for owner" section at the end is historical context, not open work.

**Date:** 2026-05-28
**Status (original):** Proposal (no code) — open for owner review.
**Scope:** ADR-0001 phase map's outstanding "persistence" line (under PB / PC). Window position, size, collapsed state, theme, and per-window state across page reloads.

## What the problem actually is

Today, a `mountDeclarative()` consumer can't preserve a user's adjusted state across reloads. If a visitor drags windows into a layout they like, refreshes, the layout's gone — windows return to wherever their `data-scriptoscope-x` / `data-scriptoscope-y` attributes pinned them. For an "intranet productivity app" or "wiki sidebar" use case this is a significant ergonomic hole.

What we'd want to persist, by importance:
1. **Window positions** (left, top) — the primary need
2. **Window sizes** (width, height) — for declared-size windows the consumer resized via grow box
3. **Collapsed state** (windowshade)
4. **Z-order** — so the focused window stays on top after reload
5. **Active scheme** — already done via URL (`?theme=`) in the demo; could promote to localStorage too
6. **Focused window** — minor; could derive from z-order

## Storage option survey

| Option | Persistent | Shareable | Quota | Cross-tab sync | Privacy/scope |
|---|---|---|---|---|---|
| **`localStorage`** | Yes (until cleared) | No (origin-scoped) | ~5–10 MB | Yes via `storage` event | Origin |
| **`sessionStorage`** | Tab session only | No | ~5–10 MB | No | Origin + tab |
| **URL `?query`** | Per-link | Yes (paste a URL → same layout) | ~2 KB practical | No (manual) | Public |
| **URL `#hash`** | Per-link | Yes | ~2 KB | Via `hashchange` | Public |
| **`IndexedDB`** | Yes | No | ~50%+ of disk | Via Broadcast Channel | Origin |
| **Cookie** | Yes | No (origin) | 4 KB | No | Origin (sent to server!) |

Quick reads:
- **`localStorage`** is the obvious primary for "remember my layout across reloads." Synchronous, simple, fits in budget, has the `storage` event for multi-tab sync.
- **URL `#hash`** is the obvious primary for "share my layout as a link." Scriptoscope's index.html demo already uses this pattern (window playground state in the hash, see `demo/index.html:1252-1294`). Worth supporting as an additive case, not a replacement.
- **`sessionStorage`** has a narrow but real use case: "remember my layout WHILE the tab is open, but a fresh tab starts fresh." Probably not v1; could land later as `persistTo: 'session'`.
- **`IndexedDB`** is overkill for ~1 KB of layout state.
- **Cookie** would silently inflate every request to the host. No.

**Recommendation: `localStorage` primary; `#hash` as an optional emit-on-change for shareability; `sessionStorage` deferred.**

## Scope: per-page, per-mount, or per-window?

A `mountDeclarative()` call can produce N windows. Multiple `mountDeclarative()` calls on the same page (rare but possible — a CMS that embeds Aaron in two distinct widgets) would each have their own window set.

The scope question is **what key do we write under?**

- **Per-page:** single key like `aaron:layout` — every window's state serialized into one blob. Simple. Doesn't survive a `mountDeclarative` call from a different code path on the same page (they'd clobber each other). Acceptable for the common case where a page has one Aaron consumer.
- **Per-mount:** a key per `mountDeclarative` call, e.g. `aaron:layout:<consumer-id>`. Requires the consumer to pass an id. Solves the multi-consumer case explicitly.
- **Per-window:** key per window, e.g. `aaron:window:<window-id>`. Window id comes from a `data-scriptoscope-window-id` attribute the consumer adds. Most granular; survives windows moving between mounts; requires every persisted window to have an id.

**Recommendation: per-mount as the default, with the consumer's `mountDeclarative({ persistKey: 'my-app' })` opt-in.** Default `persistKey: undefined` means "don't persist." When set, all windows under that mount serialize to `aaron:layout:<persistKey>`. Per-window opt-out via `data-scriptoscope-persist="off"` (e.g. transient dialogs the consumer wouldn't want restored).

This:
- Keeps persistence **opt-in** (no surprise behavior).
- Identifies windows within a mount by their **`data-scriptoscope-window-id`** attribute when set, else by **DOM source ordinal** (the Nth promoted window in DOM order). Window-id is the consumer's choice; ordinal is the fallback for ad-hoc cases.
- Survives multiple mounts on a page (each has its own key namespace).

## What to persist (the snapshot shape)

```json
{
  "version": 1,
  "windows": {
    "welcome": { "x": 240, "y": 80, "w": 320, "h": 200, "collapsed": false, "z": 3 },
    "inspector": { "x": 620, "y": 120, "w": 280, "h": 360, "collapsed": false, "z": 2 },
    "<dom-ordinal-4>": { "x": 80, "y": 460, "w": 280, "h": 240, "collapsed": true, "z": 1 }
  },
  "activeTheme": "1138"
}
```

- **`version`** — schema marker. v1 covers the fields above. Future fields land as v2; the loader migrates v1→v2 (or drops unknown keys silently). Worth doing right from the start so we don't have a "what version is this?" mess in 6 months.
- **`windows`** — keyed by `data-scriptoscope-window-id` if set, else `<dom-ordinal-N>`. Each value carries the geometry the renderer needs to restore.
- **`activeTheme`** — last-selected scheme via the runtime switcher (`data-scriptoscope-theme-switcher` change). Optional; only written if a switcher fired during the session.

## API surface (minimal)

```ts
mountDeclarative({
  themeBaseUrl: '/themes',
  pageThemeDefault: '1138',
  // Persistence — opt-in. Setting persistKey enables localStorage layout restore.
  persistKey: 'my-app',  // → aaron:layout:my-app
})
```

That's the entire public surface. Everything else lives behind the scenes:

- **On boot, after windows are promoted:** scanner checks `localStorage.getItem('aaron:layout:my-app')`; if present, applies position / size / collapsed / z / theme. Then attaches a `storage` event listener for cross-tab sync.
- **On any change** (window drag, resize, shade toggle, zoom, theme switch): WindowManager bumps a debounced save (~250 ms) that serializes the current snapshot to localStorage.
- **`data-scriptoscope-window-id="welcome"`** on a window's source div = stable identity; persisted state keys to this. Without it, DOM-source-ordinal is used (`<dom-ordinal-0>`, `<dom-ordinal-1>`, …) — works for static pages, breaks if windows are reordered.
- **`data-scriptoscope-persist="off"`** on a window's source div = exclude from persistence. For e.g. an `aaronAlert()`-style transient dialog.

Imperative escape hatches (additive, not core):
```ts
const handle = await mountDeclarative({...});
handle.layout.snapshot();              // returns current state JSON
await handle.layout.restore(json);     // apply external state
handle.layout.clear();                 // wipe localStorage + reset to data-scriptoscope-* declarations
```

## What changes in `WindowManager` to support this

Static analysis (haven't coded; sketching what'd be touched):

1. **WindowManager** gains an optional `onChange?: (entry) => void` hook called when render-affecting state mutates (position via drag, size via resize / setContentSize, collapsed via toggleCollapse / zoom). The hook is invoked at the end of `render()` (i.e. after the new state is the actual state).

2. **The declarative scanner** (`src/declarative/scanner.ts`) attaches a debounced serializer-to-localStorage as the `onChange` hook when `persistKey` is set.

3. **ScriptoscopeWindow.promote** reads any persisted geometry for its window-id (or DOM ordinal) BEFORE constructing the WindowManager add() call, using it instead of the `data-scriptoscope-*` declarations.

4. **The host-element drag handler** (`wireMoveResize`, title-bar drag) needs to fire the `onChange` callback on mouseup. Currently it sets `host.style.left/top` directly without triggering a render — that's CSS-only, no render. The change: also call `onChange(entry)` on mouseup, with the new x/y. (The render-frequency contract is preserved — no per-mousemove fire.)

5. **`storage` event listener** for multi-tab sync: when another tab writes the same key, re-apply the layout in this tab. Debounced. Throttled.

Estimated diff: ~150–200 LOC across `src/interactive.ts` + `src/declarative/scanner.ts` + `src/declarative/ScriptoscopeWindow.ts`. Plus a couple test fixtures.

## Edge cases worth thinking about

- **Window doesn't exist in HTML anymore:** the persisted snapshot has `{"removed-window": {...}}` but the HTML doesn't have an element matching that id. Silently ignore — the entry stays in storage in case the consumer re-adds it later. (Garbage collection could be a maintenance method on the imperative handle.)
- **HTML adds a new window not in storage:** use the `data-scriptoscope-*` declarations. Storage doesn't override — declarations are the authoritative initial state for new windows.
- **Theme switched in another tab:** the `storage` listener picks it up. The scanner calls `manager.retheme(newTheme)`. UX-noticeable but defensible.
- **Storage quota exceeded:** wrap `setItem` in try/catch; on `QuotaExceededError`, drop the oldest window's state. Log a warning to console. Should be vanishingly rare for ~1 KB of layout state.
- **Private browsing / storage disabled:** `localStorage.setItem` may throw `SecurityError`. Wrap in try/catch; the feature degrades to "session-only" (in-memory snapshot, no persistence) without breaking the app.
- **DOM-ordinal stability:** if the consumer reorders or removes windows in their HTML, the ordinals shift, and the persisted state attaches to the wrong windows. Document this explicitly: **use `data-scriptoscope-window-id` for any window you actually want to persist.** Ordinal is the convenience fallback for "I don't care."
- **URL sharing:** the imperative `handle.layout.snapshot()` can emit a compact `#hash` value the consumer can route to a "Copy shareable link" UI. Scriptoscope itself wouldn't auto-write to URL by default; the consumer chooses.

## What I'd NOT do in v1

- **No focused-window persistence.** Z-order implies focus; the topmost window restores to focused. Adding an explicit `focused: true` field is bookkeeping for tiny marginal value.
- **No cross-origin sync.** `localStorage` is origin-scoped. Period.
- **No server-side persistence.** That's a consumer integration concern — the imperative `handle.layout.snapshot()` returns JSON the consumer can POST themselves.
- **No "session restore" prompt UX.** If `persistKey` is set, layout restores silently on load. The consumer can wrap with their own "remember this layout?" prompt if they want.
- **No IndexedDB.** Not needed for the data size.

## Recommendation summary

- **Storage:** `localStorage` primary. URL hash as an additive, manual mode via the imperative handle. `sessionStorage` later if a real use case appears.
- **Scope:** per-`mountDeclarative` call, opted in via `persistKey: '<consumer-id>'`. Default off.
- **Snapshot shape:** v1 schema as above; versioned for forward-compat.
- **Window identity:** `data-scriptoscope-window-id` (consumer-stable) → DOM ordinal (fallback). Document the trade-off.
- **Cross-tab sync:** native via `storage` event, debounced.
- **API surface:** one option (`persistKey`), one stamp attribute (`data-scriptoscope-window-id`), one opt-out attribute (`data-scriptoscope-persist="off"`), three optional imperative methods (`snapshot`/`restore`/`clear`).
- **Implementation cost:** ~150–200 LOC + a small test fixture for the snapshot round-trip.
- **Render contract preserved:** `onChange` fires at the end of `render()`; the title-bar-drag path adds an `onChange` call on mouseup (still no per-mousemove canvas re-paints).

## Questions for owner

1. **Default scope OK?** "Per-mount, opt-in via persistKey, ordinal fallback for unstamped windows" is my read; alternatives are "per-page, automatic" (simpler, more surprising) or "per-window, opt-in" (more granular, more bookkeeping).
2. **URL hash a v1 feature or v1.x?** The imperative-handle escape hatch is easy. Auto-emitting to URL on every change is more opinionated.
3. **Schema versioning:** worth shipping as v1 from the start (mainly for migration cleanliness), or skip until v2 actually changes the shape?
4. **Multi-tab sync:** ship in v1 or v1.x? It's small but adds one moving piece.

## Next concrete steps if approved

Order:
1. Add `onChange?` hook to `WindowManager` + invoke it from the change paths (~30 LOC).
2. Add `persistKey?` option to `mountDeclarative` + serialize/deserialize layer in `src/declarative/scanner.ts` (~80 LOC).
3. Wire `ScriptoscopeWindow.promote` to consult persisted geometry before declarations (~30 LOC).
4. Add `storage` event listener for cross-tab sync (~20 LOC).
5. Tests: snapshot round-trip + restoration test against a fixture (~50 LOC, lands as `src/declarative/persistence.test.mjs`).
6. Demo update: enable `persistKey: 'aaron-site-demo'` on `declarative-site.html` so visitors see persistence work without further config.
7. LEARNINGS entry on whatever surfaces during build.

Total: roughly half a day of focused work. Two commits — implementation + demo wire-up.
