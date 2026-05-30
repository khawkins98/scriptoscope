# Diagnostic tooling

Tools for inspecting how the TypeScript compositor turns a theme's `wnd#` recipe
+ cicn into a rendered window — so we can debug in absolute terms ("output spot
X came from slice Y via mode Z") instead of eyeballing screenshots.

Everything is built on **`ComposedChrome.placement`**: `composeWindowChrome`
records, for every slice it draws, the cicn SOURCE rect, the render MODE
(`fixed` / `stretch` / `tile` / `scale` / `collapse` / `stamp`), the
part code + role, and the OUTPUT rect(s) it produced (one per tile repeat).

## In the browser — the slice inspector

`npm run dev`, open a theme's **"slice inspector"** foldout (under the diagnostic
strip). It renders the document window at 2× with two-way lookup:

- **Forward** — the list shows every slice (source-crop thumbnail + edge + part
  code + role + src coords + usage). Hover/click a slice → it highlights EVERY
  output region that slice produced on the window. A tiled slice lights up N
  boxes; a stretched one shows a single wide box; a stamped widget, one box.
  Filter by edge (top/bottom/left/right/widget).
- **Inverse** — hover anywhere on the rendered window → a readout names the slice
  under the cursor: `@150,3 → top p8 side-fill · tile · src 46,0 1×20`.

Use it to say, e.g., "that top-right area is `p8` side-fill tiled, but it should
be the `p6` title region" — pointing at exact slices.

## Headless — Node CLIs (no browser)

Run `npm run build` first (the CLIs import the built compositor from `dist/`).

### `npm run diag:render -- <slug> [windowType] [flags]`
Renders one window with the REAL compositor and writes
`themes/<slug>/diag/<windowType>.png` + `.json` (the full placement map), and
prints a slice table. Flags: `--w N --h N` (content size), `--title T` /
`--plate N` (title-plate width; no DOM here to rasterize, so `--title` estimates
it). Default window type = `document-window`.

```
npm run diag:render -- 1138 --title Hello --w 178 --h 98
npm run diag:render -- evolution wnd--14328
```

The `.png` is readable directly (no browser); the `.json` is the placement map
for scripting. `themes/*/diag/` is git-ignored (regenerable).

### `npm run diag:audit -- [slug]`
Renders every theme's window types and checks placement invariants, printing
warnings in absolute terms (`theme · window · edge · slice`). Exits non-zero on
warnings, so it can gate CI. Checks:

- **coverage** — each edge's output rects tile it with no internal gaps (catches
  the "chrome doesn't reach the edge" class).
- **code→mode** — `p0` stays fixed (corner); `p18` is scale; widget refs
  (`1–4`) aren't stretched (stretching smears the baked widget).
- **widgets** — every top rectList widget is stamped or sits in a fixed segment.
- **mega-tile** — no slice tiled an implausible number of times.

## Files
- `src/composeChrome.ts` — `placement` model + `partRole`.
- `scripts/render-window.mjs`, `scripts/audit-placement.mjs`, `scripts/diag-lib.mjs`
  (shared minimal PNG codec + cicn loader + window resolver).
- `demo/diagnostic.html` — `sliceInspector()`.
