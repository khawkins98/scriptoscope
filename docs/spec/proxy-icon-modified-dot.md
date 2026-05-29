# Proxy icon + modified-document support (2.3.1 only — not modeled)

**Status: graceful no-op + documented.** The 2.3.1 kDEF imports the Mac OS 8.5 "document proxy icon" and "modified document" hooks (`GetWindowProxyIcon` + `IsWindowModified`), but **zero shipped corpus schemes exercise the feature**. We intentionally do not render proxy icons or modified-dot markers in the title bar. If a future imported scheme opts in via the kDEF's `wind` gate, file a parked issue and follow the API sketch at the bottom of this doc.

Date: 2026-05-29.

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

## 2.3.1 kDEF call sites (`.scratch/k231-kdef/kDEF/id-1.bin`, PowerPC)

PEF imports verified via `/tmp/pef-imports.py`:

```
Lib 4: WindowsLib  firstSym=213 count=2
  Sym 213: GetWindowProxyIcon  (class=0x82 TVect)
  Sym 214: IsWindowModified    (class=0x82 TVect)
```

Loader-reloc replay (`/tmp/pef-relocs.py`) places the resolved TVect pointers at:

| Data offset | Import |
|---|---|
| `0x354` | `GetWindowProxyIcon` |
| `0x358` | `IsWindowModified` |

…which the code reaches via the standard CFM glue stubs at `0x26b88` (`lwz r12, 0x354(r2)`) and `0x26c30` (`lwz r12, 0x358(r2)`).

### All call sites (from `bl 0x26b88` / `bl 0x26c30`)

```
GetWindowProxyIcon  callers:  0x14fc, 0x1b80, 0x5648, 0x188ac, 0x18bec,
                              0x1bed8, 0x21628, 0x22c08, 0x2312c, 0x23b64
IsWindowModified    callers:          0x386c, 0x3a10, 0x579c, 0x1a044,
                              0x1bf14,        0x22c18, 0x2313c
```

The two **paired** sites (proxy + modified back-to-back, feeding the same icon-draw call) are at `0x22c08`/`0x22c18` and `0x2312c`/`0x2313c`. Both follow the identical pattern below.

### Decoded paired site (`0x22be0..0x22c78`)

```asm
                                          ; (rect math: shrink frame to 16x16 slot
                                          ;  centred to the left of the title text)
0x22c00:  addi   r3, r31, 0               ; r3 = window ptr
0x22c04:  addi   r4, r1, 0x44             ; r4 = &IconRef out-handle
0x22c08:  bl     GetWindowProxyIcon       ;   → r1+0x44 receives IconRef
0x22c10:  li     r28, 0                   ; r28 = transform flags (0 = normal)
0x22c14:  addi   r3, r31, 0
0x22c18:  bl     IsWindowModified         ;   → r3 = bool
0x22c20:  clrlwi. r0, r3, 0x18
0x22c24:  beq    0x22c2c
0x22c28:  li     r28, 1                   ; modified → transform = kTransformDisabled?
                                          ;            (likely kTransformOpenFolder=2 or
                                          ;             a modified-document transform = 1)
0x22c2c:  lbz    r0, 0x590(r2)            ; global "window inactive" flag
0x22c30:  cmplwi r0, 0
0x22c34:  beq    0x22c3c
0x22c38:  addi   r28, r28, 0x4000         ; inactive → OR kTransformDisabled (0x4000)
                                          ; (matches IconServicesLib transform bits)
0x22c3c:  …(build rect at +0x10..+0x10 → 16x16 icon slot)…
0x22c48:  mr     r5, r28                  ; r5 = transform
0x22c4c:  addi   r3, r1, 0x38             ; r3 = &iconRect
0x22c50:  li     r4, 1                    ; r4 = kAlignAbsoluteCenter or kAlignNone (=1)
0x22c54:  …                                ; r6 = 0 (services)
0x22c70:  lwz    r7, 0x44(r1)             ; r7 = the IconRef returned earlier
0x22c78:  bl     PlotIconRef              ; (TOC 0x64 = PlotIconRef, IconServicesLib)
```

**Effective C-equivalent:**

```c
IconRef ref;
GetWindowProxyIcon(theWindow, &ref);
short transform = IsWindowModified(theWindow) ? 1 : 0;
if (g_windowInactive) transform |= 0x4000;   /* dim when inactive */
Rect r = /* 16x16 slot, left of title text */;
PlotIconRef(&r, kAlignAbsoluteCenter, transform, kIconServicesNormalUsageFlag, ref);
```

The 16x16 slot is built by extending `(r3, r0)` by `0x10` in both dimensions (`addi r7, r7, 0x10`, `addi r0, r8, -0x10`) — i.e. a standard small-icon (`ics`-family) box flush against the leading edge of the title text.

### Scheme-side gate (`bl 0x23b20`)

The second paired site (`0x230f4`) is reached only if `0x23b20` returns true. That routine at the top:

```asm
0x23b28:  lis  r4, 0x7769          ; 'wi'
0x23b34:  addi r3, r4, 0x6e64      ; 'wind'  →  FourCC 'wind'
0x23b40:  bl   0x25c70             ; (helper that GetResource's 'wind' by id)
```

This is the **opt-in marker**: the kDEF queries the scheme's `wind` resource for the current window kind, and only paints a proxy icon when the scheme has declared support. **Our corpus ships no `wind` resources** (verified via `themes/<slug>/resource-roles.json` and `extraction-manifest.json` — only `wnd#`, `cinf`, `cicn`, `clut`, `actb`, `ics4/8`, `ppat`, `WDEF`, `pWin`). So the gate is closed for every corpus bundle by construction.

## 1.8.2 cross-check

`grep -c GetWindowProxyIcon` and `grep -c IsWindowModified` against `.scratch/k182-kdef/kDEF/id-1.bin`: **zero matches each.** 1.8.2 does not import either symbol. Proxy-icon support is a strict 2.3.1 addition, riding the AppearanceLib/WindowsLib delta documented in `docs/spec/kdef-binary-inventory.md §6`.

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

```sh
# (1) Confirm 2.3.1 imports the symbols, 1.8.2 doesn't.
strings .scratch/k231-kdef/kDEF/id-1.bin | grep -E 'GetWindowProxyIcon|IsWindowModified'
strings .scratch/k182-kdef/kDEF/id-1.bin | grep -E 'GetWindowProxyIcon|IsWindowModified'  # empty

# (2) Locate TOC slots + glue stubs.
python3 /tmp/pef-imports.py .scratch/k231-kdef/kDEF/id-1.bin
python3 /tmp/pef-relocs.py  .scratch/k231-kdef/kDEF/id-1.bin

# (3) Enumerate call sites.
grep -nE 'bl[[:space:]]+0x26b88|bl[[:space:]]+0x26c30' .scratch/k231-kdef/kDEF/k231-kdef1.asm

# (4) Inspect the paired-site flow.
sed -n '35570,35630p' .scratch/k231-kdef/kDEF/k231-kdef1.asm

# (5) Confirm no corpus 'wind' resources.
find themes -name resource-roles.json -exec grep -l '"wind"' {} \;   # empty
```

All five steps yield the results documented above.

## See also

- `docs/spec/kdef-binary-inventory.md §6` — the PEF import delta (17 new AppearanceLib calls + WindowsLib + ControlsLib + IconServicesLib in 2.3.1).
- `docs/spec/apple-primary-source.md` — the corrected ThemeWidget enum + a pointer back to this doc.
- `docs/spec/kdef-faithfulness-ledger.md` — running list of deliberate divergences (add a row for this feature in the next pass).
- `docs/spec/kdef231-reference.md` — the standing reference; the `0x23b20` 'wind' loader can be added to §3.4 once the `wind` format is decoded.
