# Proxy icon + modified-document support (2.3.1 only — not modeled)

**Status: graceful no-op + documented.** The 2.3.1 kDEF imports the Mac OS 8.5 "document proxy icon" and "modified document" hooks (`GetWindowProxyIcon` + `IsWindowModified`), but **zero shipped corpus schemes exercise the feature**. We intentionally do not render proxy icons or modified-dot markers in the title bar. If a future imported scheme opts in via the kDEF's `wind` gate, file a parked issue and follow the API sketch at the bottom of this doc.

Date: 2026-05-29.

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/proxy-icon-modified-dot.evidence.md`](engine/proxy-icon-modified-dot.evidence.md) — spec writers and verifiers only.*

## Apple's documented enum (the answer to "what is the proxy / dirty widget?")

From Universal Interfaces 3.4 `CIncludes/Appearance.h:618-623` (cached locally at `/tmp/Appearance.h`):

```c
enum {
  kThemeWidgetCloseBox          = 0,
  kThemeWidgetZoomBox           = 1,
  kThemeWidgetCollapseBox       = 2,
  kThemeWidgetDirtyCloseBox     = 6
};
typedef UInt16 ThemeTitleBarWidget;
```

**Two findings:**

1. **`kThemeWidgetDirtyCloseBox = 6`** is real. It is the "close-box-with-dot" variant that signals an unsaved document. Values 3, 4, 5 do not exist. (`docs/spec/apple-primary-source.md`'s ThemeWidget table previously listed phantom entries for 3/4/5 — corrected in the same pass that produced this doc.)
2. **There is NO `kThemeWidgetProxyIcon`.** The document proxy icon is _not_ a `ThemeTitleBarWidget`. It is drawn by the WDEF itself, by reading the icon handle attached to the window via `WindowsLib::GetWindowProxyIcon` and plotting it with `IconServicesLib::PlotIconRef`. This matches what we see in the 2.3.1 binary (below): the kDEF calls those two imports directly, never `DrawThemeTitleBarWidget(…, kThemeWidget*)`.

## 2.3.1 kDEF call sites (kDEF id 1, PowerPC)

The PEF import table lists library 4 as WindowsLib (first symbol 213, count 2):
symbol 213 `GetWindowProxyIcon` and symbol 214 `IsWindowModified`, both of
class `0x82` (TVect). Replaying the loader relocations places the resolved TVect
pointers at:

| Data offset | Import |
|---|---|
| `0x354` | `GetWindowProxyIcon` |
| `0x358` | `IsWindowModified` |

…which the code reaches via the standard CFM glue stubs at `0x26b88` (loads the
`0x354` slot) and `0x26c30` (loads the `0x358` slot). The import/relocation
tooling is recorded in the evidence appendix.

### All call sites (calls to the `0x26b88` / `0x26c30` stubs)

```
GetWindowProxyIcon  callers:  0x14fc, 0x1b80, 0x5648, 0x188ac, 0x18bec,
                              0x1bed8, 0x21628, 0x22c08, 0x2312c, 0x23b64
IsWindowModified    callers:          0x386c, 0x3a10, 0x579c, 0x1a044,
                              0x1bf14,        0x22c18, 0x2313c
```

The two **paired** sites (proxy + modified back-to-back, feeding the same icon-draw call) are at `0x22c08`/`0x22c18` and `0x2312c`/`0x2313c`. Both follow the identical pattern below.

### Decoded paired site (`0x22be0..0x22c78`)

Behaviour of the paired site:

1. Rect math shrinks the frame to a 16x16 slot centred to the left of the title
   text.
2. `GetWindowProxyIcon` (call at `0x22c08`) is passed the window and returns
   the window's IconRef.
3. The transform starts at 0. If `IsWindowModified` (call at `0x22c18`) returns
   true, the transform becomes 1 (its IconServices name is not pinned: the
   listing note suggests a modified-document transform = 1, with
   kTransformOpenFolder=2 / kTransformDisabled also queried (?)).
4. If the kDEF's global "window inactive" flag is nonzero (test at `0x22c2c`),
   `0x4000` (kTransformDisabled, matching the IconServicesLib transform bits) is
   added to the transform — dim when inactive.
5. `PlotIconRef` (call at `0x22c78`; TOC `0x64` = PlotIconRef, IconServicesLib)
   draws the IconRef into the 16x16 rect with alignment value 1
   (kAlignAbsoluteCenter or kAlignNone (=1)), the transform, and usage flags 0
   (kIconServicesNormalUsageFlag).

The 16x16 slot is built by offsetting the slot corners by `0x10` in both
dimensions — i.e. a standard small-icon (`ics`-family) box flush against the
leading edge of the title text.

### Scheme-side gate (`0x23b20`)

The second paired site (`0x230f4`) is reached only if `0x23b20` returns true. That
routine begins (`0x23b28..0x23b40`) by forming the FourCC `'wind'` and calling the
helper at `0x25c70`, which GetResource's `'wind'` by id.

This is the **opt-in marker**: the kDEF queries the scheme's `wind` resource for the current window kind, and only paints a proxy icon when the scheme has declared support. **Our corpus ships no `wind` resources** (verified via `themes/<slug>/resource-roles.json` and `extraction-manifest.json` — only `wnd#`, `cinf`, `cicn`, `clut`, `actb`, `ics4/8`, `ppat`, `WDEF`, `pWin`). So the gate is closed for every corpus bundle by construction.

## 1.8.2 cross-check

Neither `GetWindowProxyIcon` nor `IsWindowModified` occurs in the 1.8.2 kDEF (kDEF id 1): **zero matches each.** 1.8.2 does not import either symbol. Proxy-icon support is a strict 2.3.1 addition, riding the AppearanceLib/WindowsLib delta documented in `docs/spec/kdef-binary-inventory.md §6`.

## Corpus reference-image survey

All 18 bundles' reference shots live in `demo/assets/references/`. I eyeballed each one looking for (a) a small 16x16 document icon at the leading edge of the title bar, immediately left of the title text, and (b) a filled bullet or dot in or next to the close box. Title bars only — the "grid icon next to a folder/file name" pattern that appears in many bundles is a Finder **list-view header**, drawn into the window's content area, not into the title bar.

| Bundle | Proxy icon in title bar? | Modified dot? | Notes |
|---|:-:|:-:|---|
| `1138` | no | no | title text only |
| `1984` | no | no | title text only |
| `1990` | no | no | title text only |
| `animals` | no | no | grid is in the list-view header below the title bar |
| `apple-lisa` | no | no | B&W close box + title only |
| `apple-platinum-2` | no | no | close + grow only, no proxy |
| `beos-r503` | no | no | title text only |
| `black-platinum` | no | no | title text only |
| `crayon-os` | no | no | grid is in the list-view header below the title bar |
| `dolphin-som` | no | no | grid is in the list-view header below the title bar |
| `evolution` | no | no | title text only |
| `floppies` | no | no | title text only |
| `monkey-paradise` | no | no | grid is in the list-view header below the title bar |
| `platinum-8` | no | no | controls-only bundle; window is the apple-platinum-2 inherit |
| `slimes` | no | no | title text only |
| `system7-nostalgia-silver` | no | no | controls-only bundle |
| `windows-31` | no | no | grid is in the list-view header below the title bar |
| `windows-95` | no | no | title text only |

**0 of 18 bundles render a proxy icon. 0 of 18 bundles render a modified-document marker.** No corpus author shipped a `wind` resource that opens the kDEF's gate.

## Recommendation: graceful no-op + document (the YAGNI call)

- **Do not add proxy-icon or modified-dot rendering to the runtime.** Period-faithful 2.3.1 schemes _could_ have requested it, but none in the corpus _did_. Adding the code path would be dead weight tested against no inputs.
- **Mark this as a 2.3.1 feature we intentionally don't model** in:
  - `docs/spec/kdef-faithfulness-ledger.md` — log it as a deliberate divergence ("2.3.1 imports `GetWindowProxyIcon` + `IsWindowModified`; we do not render proxy icons or modified-document markers because no corpus `wind` resource exercises the gate").
  - `docs/spec/apple-primary-source.md` — done in this pass (note added to the ThemeWidget table).
- **Trigger for revisiting.** If `npm run import -- <slug>` ever lands a scheme that ships a `wind` resource, the importer should log "proxy-icon opt-in detected" and route to the parked issue below. Cheap check inside `scripts/extract-scheme.mjs`: scan resource types for `wind` (note: NOT `wnd#` — different FourCC, 4 bytes vs 4-bytes-with-hash).

## Parked-issue sketch (if 1+ scheme ever opens the gate)

If a corpus addition triggers the marker, the runtime extension is small. Sketched API:

```ts
// In src/types.ts (LoadedTheme):
interface LoadedTheme {
  ...
  /** Per-window-kind proxy-icon opt-in, sourced from the scheme's 'wind' resource.
   *  Empty/undefined for every corpus scheme today. */
  proxyIconOptIn?: Partial<Record<WindowKind, boolean>>;
}

// In src/composeChrome.ts / src/composeCornerSprite.ts:
//   After the title text raster is centred, if proxyIconOptIn[kind] is true AND
//   the consumer passes a proxy icon URL + modified flag, allocate a 16x16 slot
//   flush against the leading edge of the title text, blit the icon, and (if
//   modified) compose a 50% alpha "dim" pass — the IconServices kTransform=1.

// In the declarative consumption layer (src/declarative/parse.ts):
//   New attrs:
//     data-scriptoscope-proxy-icon="url(...)"   // optional 16x16 PNG
//     data-scriptoscope-modified                 // boolean
//   Both are no-ops when proxyIconOptIn[kind] is falsy (faithful to the kDEF gate).
```

**Pre-requisites for actually doing this:**

1. A real corpus scheme that ships a `wind` resource AND a reference image showing the proxy icon rendered. (Hypotheticals don't count — `Reference image first.`)
2. Decode of the `wind` resource format (not yet documented in our specs; `0x23b20` → `0x25c70` is the load + 4-byte read).
3. Decision on the source of the consumer's icon. The kDEF gets it from `WindowsLib::GetWindowProxyIcon`, which the host app populates via `SetWindowProxyAlias` / `SetWindowProxyIcon`. In a web runtime, the consumer would pass it directly (URL on the data-attribute), since there is no Window Manager to query.
4. Decision on modified-dot positioning. `kThemeWidgetDirtyCloseBox = 6` says "modify the close box bitmap," but the corpus close-box bitmaps (cicn `-14336`) don't ship a separate "dirty" variant — so we'd either composite a filled circle into the close-box centre at runtime, or compositing pass that respects `IsWindowModified` regardless of the proxy gate.

Until those preconditions are met, **no code, just this doc**.

## Reproducing the analysis

The five reproduction steps (symbol-string check of both kDEFs, PEF import +
relocation replay, call-site enumeration, paired-site inspection, and the corpus
`wind` check) are recorded in the
[evidence appendix](engine/proxy-icon-modified-dot.evidence.md) — spec writers
and verifiers only. All five steps yield the results documented above.

## See also

- `docs/spec/kdef-binary-inventory.md §6` — the PEF import delta (17 new AppearanceLib calls + WindowsLib + ControlsLib + IconServicesLib in 2.3.1).
- `docs/spec/apple-primary-source.md` — the corrected ThemeWidget enum + a pointer back to this doc.
- `docs/spec/kdef-faithfulness-ledger.md` — running list of deliberate divergences (add a row for this feature in the next pass).
- `docs/spec/kdef231-reference.md` — the standing reference; the `0x23b20` 'wind' loader can be added to §3.4 once the `wind` format is decoded.
