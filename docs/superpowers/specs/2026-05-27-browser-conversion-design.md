# Browser conversion: a single portable conversion core

> ✅ **SHIPPED 2026-05-27.** The drop-zone path, the conversion core (`tools/theme-loader/loadKaleidoscopeScheme.js`), and the StuffIt WASM decoder (`tools/sit-wasm/`) all ship. The 2026-05-29 "Option A" migration generalised the conversion core into the runtime path — `loadTheme()` now decodes archives in-browser on every bundle load, not just for the drop-zone. This doc is kept in place as the design reference behind that code (and is cited from `tools/theme-loader/loadKaleidoscopeScheme.js` + the ADR-0001 + the sit-decoder spike retrospective); the design rationale here informed the shipped architecture.

**Goal:** make "drop a Kaleidoscope resource fork → fully converted, render-ready theme"
work **client-side in the browser**, producing a theme **byte-equivalent** to what the
Node build pipeline produces — by collapsing today's two conversion implementations into
one portable core that both the Node CLIs and the browser loader call.

This is piece **#1** of the drag-and-drop vision (see the 2026-05-27 chat). #2 (render
consumes in-memory blob-URL assets), #3 (input → fork bytes; StuffIt question), and #4
(drop-zone UI) follow.

---

## The problem

The conversion is split:

- **Portable core (works in-browser today):** `resource-fork.js`, `decoders/*.js`,
  `buildThemeJson.js`. The browser loader `loadKaleidoscopeScheme.js` uses these.
- **Node-only orchestration (the browser path is MISSING):** everything in
  `scripts/extract-scheme.mjs` and `scripts/extract-icons.mjs` —
  - gamma (`gammaCorrectRgba` on cicn/ppat; `macRgbToSrgb` on the icon palettes),
  - `headerColors` (decoded from the `-14335/-14336` cluts + `gammaCorrectHex`),
  - `bodyBackground` (the `-9551/-9550` view cinf's `bgPatternId`),
  - the **entire icon decode** (`decodeIcon4/8`, the canonical `clut 8` palette,
    `cornerFloodTransparency` masks, the depth dedup + `icons/index.json` glyph map).

`loadKaleidoscopeScheme.js` has **zero** references to any of these and isn't wired
into the demo/runtime. So a dropped theme today renders un-gamma'd, with no title-bar
colours, no body pattern, and no glyphs. Two implementations that have drifted — the
same smell we just fixed for the window recipe, at pipeline scale.

---

## The design: `tools/theme-loader/convert.js`

A new **pure** module (no `fs`, no `zlib`, no canvas) that owns the WHOLE conversion.
It returns decoded **RGBA** assets (not encoded PNGs) + the theme object; each I/O shell
handles bytes-in and image-out its own way.

```
// All take the raw resource-fork bytes (Uint8Array) + return RGBA assets tagged with
// their canonical bundle path, so theme.json's asset refs match in every shell.

convertChrome(fork, { meta }) → {
  theme,                                   // theme.json incl. headerColors + bodyBackground
  assets: [{ path: 'cicns/cicn-…png', rgba, width, height }, …],  // gamma-applied
  manifest,                                // extraction-manifest (diagnostic)
}

convertIcons(fork) → {
  assets:  [{ path: 'icons/icl8-n3984.png', rgba, width, height }, …],  // gamma + corner-flood
  index,   // icons/index.json array
}

convertScheme(fork, { meta }) → { theme, assets: [...chrome, ...icons], iconIndex }
  // everything in one call — what the browser drop path uses.
```

**What moves into it (behaviour-preserving):**
- From `extract-scheme.mjs`: the gamma-on-`payload.rgba`, the `buildThemeJson` call, the
  `headerColors` block (`cl()` + `gammaCorrectHex`), the `bodyBackground` (`viewBg`) block.
- From `extract-icons.mjs`: `PALETTE16`/`PALETTE256` (gamma'd at load), `decodeIcon4/8`,
  `cornerFloodTransparency`, `maskOf`/`decodeMaskBits`, the `TYPES` table + the
  depth-dedup loop + the `index` build.
- `buildThemeJson.js` is unchanged (the core calls it).

**File moves (so the browser can import them):** `scripts/lib/mac-gamma.mjs` →
`tools/theme-loader/mac-gamma.js` (done, 2c60544). The 256-colour palette is now
**reconstructed in-code** inside `convert.js` (the canonical clut-8 cube+ramps algorithm,
byte-identical to the old `mac-system-palette.json`, which is deleted) — so the portable
core needs no file read at all. `PALETTE16` is an in-code literal as before.

---

## The two shells

**Node** (`extract-scheme.mjs` / `extract-icons.mjs` stay as separate CLIs to keep the
no-cross-churn build:themes workflow): each reads the fork via `fs`, calls its core
function (`convertChrome` / `convertIcons`), `encodePng`s each asset's RGBA (`png-encode.mjs`,
zlib), and writes its slice + `theme.json`/`index.json`. **Output must be byte-identical.**

**Browser** (`loadKaleidoscopeScheme.js`): fork from the dropped `Blob`, call
`convertScheme`, turn each asset's RGBA into a `blob:` URL via `OffscreenCanvas`
(`convertToBlob` → `createObjectURL`, already present), and return the theme with its
asset paths rewritten to those blob-URLs. (Consuming that in-memory theme at render time
is piece **#2**.)

---

## Acceptance / how we don't regress

`npm run build:themes` after the refactor must produce **byte-identical** `theme.json`,
every cicn/ppat/icon PNG, and `icons/index.json` for all 10 corpus schemes (verified by
`git diff` = empty, modulo the `extractedAt` timestamp). Plus a Node test that
`convertScheme(fork)` for a corpus scheme yields the same theme + asset set the on-disk
bundle has. The decoders' existing tests stay green.

## Risks / open questions

1. **Byte-identity is the whole game.** The core must replicate the exact current order
   of operations (gamma timing, palette pre-gamma, corner-flood, slugified filenames,
   icon depth-dedup). Mitigated by the diff-must-be-empty acceptance + moving code
   verbatim, not rewriting it.
2. **Keep the two Node CLIs, or collapse them?** Recommendation: keep both (the
   no-churn build:themes + the existing `import` flow), each a thin shell over the core.
3. **`mac-gamma`/`palette` move** touches a handful of imports (extract-scheme, extract-icons,
   any diag scripts) — mechanical.
4. **StuffIt input scope (#3, deferred):** a background agent is researching whether a
   JS/WASM StuffIt/.hqx/.bin decoder exists. The core takes fork BYTES regardless, so this
   is orthogonal to #1 — but it decides whether the demo accepts `.sit`, `.hqx`, `.bin`,
   or just raw `.rsrc`. **→ RESOLVED (see Status): all of `.sit`/`.hqx`/`.bin`/`.rsrc`.**

## Status — 2026-05-27: shipped end to end

The full drag-and-drop path is built and verified. Drop a Kaleidoscope theme into the demo and
it converts + renders entirely client-side — no build, no upload, no server:

- **Conversion core** (`tools/theme-loader/convert.js`) — pure, portable; both Node CLIs and the
  browser shell call it; parity-gated byte-identical to the committed bundles. (1c45d0d)
- **Browser shell** (`loadKaleidoscopeScheme`) → in-memory `LoadedTheme` with OffscreenCanvas
  blob-URL assets + glyphs; `assetUrl` passes absolute URLs through. (5afd70b)
- **Input decoders:** raw `.rsrc`; `.hqx` / MacBinary / AppleSingle·Double (pure JS,
  `tools/theme-loader/containers.js`, ba7514e); StuffIt `.sit` (munbox→WASM, `tools/sit-wasm/`,
  8cb79ef + abcb0e8 — see `../archive/2026-05-27-sit-decoder-spike.md`).
- **Drop-zone UI** in the demo (b7d9cac).

Validated on real archives: classic `SIT!` method 13 byte-identical to corpus; SIT5 method 15
(multi-file) decodes to a structurally valid theme.

## Known limitations (mirrored in the drop-zone UI)

- **`.sitx` (StuffIt X) is not supported** — only classic StuffIt + SIT5 (munbox scope). Classic
  methods 3/5/8/14 are also out (absent from the era's archives).
- **Multi-file `.sit`** (scheme + folder `Icon` + ReadMe) surfaces the **largest** resource fork
  as the scheme — a heuristic, not a guarantee.
- **Nested wrappers** (`.sit.hqx`, `.sit.bin`) are untested in the wild (munbox auto-chains).
- **Preview only — no save yet.** A converted theme lives in memory for the session; there is no
  export. See Next steps.

## Next steps

1. **Export / save the translated output.** Today a dropped theme renders but evaporates on
   reload. The natural deliverable is the same on-disk bundle the Node pipeline writes
   (`theme.json` + `cicns/` + `ppats/` + `icons/`), downloadable as a `.zip` — the conversion
   core already yields exactly those in memory (`convertScheme` → `{ theme, assets }`), so this is
   mechanical (PNG-encode the RGBA assets + zip them with the manifest).
2. **Grafting onto real web pages.** *Where* a translated theme actually gets applied is the
   consumption layer — the still-unbuilt scanner / window-manager / CSS-emission work in
   **[ADR-0001](../../adr/0001-consumption-architecture.md)** (spike-gated). The export FORMAT
   should be decided *with* that plan: a downloadable `.zip` bundle vs. an in-page handoff (pass
   the in-memory `LoadedTheme` straight to the consumer, no disk round-trip) are different shapes.
   Sequence export **after** ADR-0001's gating spike, so we don't build a save format the consumer
   can't use.
