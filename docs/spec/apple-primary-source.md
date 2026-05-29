# Apple primary-source cross-reference

Apple's Carbon / classic Mac OS headers — `Appearance.h`, `IconsCore.h`,
`MacWindows.h`, `Controls.h` — define the **role pegs** Kaleidoscope schemes
were authored against. Apple's Finder source was never publicly released, but
the supporting Carbon APIs were, and several open-source classic Mac
re-implementations (`ctm/executor`, Tk's macosx port, `elliotnunn/
UniversalInterfaces`) ship copies that survive.

This file pins the **role-peg constants** so the next time someone asks "what
role does Kaleidoscope's `-14336` play?", the answer maps to an Apple-
documented `kThemeWidget*` / `kThemeBrush*` / `kThemeTextColor*` enum value
rather than a guess.

**Mantra:** Kaleidoscope resource ids (`-14336`, `-9551`, `-10239`, `-3790`,
…) are **Kaleidoscope-private** — they don't appear in Apple's headers. What
Apple documents is the **role each slot serves**. Two corner-sprite schemes
ship the SAME `-14336` cicn id but use it as the active vs. inactive doc-
window proxy depending on draw path (see `docs/spec/kdef231-reference.md`
§2.1 corner-sprite split); the constant Apple cares about is the conceptual
peg ("the document window's active chrome") not the storage id.

## ThemeBrush — body-fill role pegs (`Appearance.h:99-166`)

These are the canonical "what fills the body of each window class" answers.
Kaleidoscope's `bodyBackground.pattern` / `ppat-42` / `ppat--9568` hierarchy
all map to one of these brushes per window type.

| Value | Constant | Window class served | Kaleidoscope correlate |
|---:|---|---|---|
| 1 | `kThemeBrushDialogBackgroundActive` | `kModalWindowClass` | (no current mapping — dialog cinf -9776) |
| 2 | `kThemeBrushDialogBackgroundInactive` | inactive variant | (no current mapping — dialog cinf -9775) |
| 3 | `kThemeBrushAlertBackgroundActive` | `kAlertWindowClass`, `kMovableAlertWindowClass` | |
| 4 | `kThemeBrushAlertBackgroundInactive` | inactive | |
| 5 | `kThemeBrushModelessDialogBackgroundActive` | modeless dialog | |
| 6 | `kThemeBrushModelessDialogBackgroundInactive` | inactive | |
| **7** | `kThemeBrushUtilityWindowBackgroundActive` | `kFloatingWindowClass`, `kUtilityWindowClass` | **`ppat-42` / `ppat--9568`** (our T1 / T2 in `dialog-body-bg`) |
| 8 | `kThemeBrushUtilityWindowBackgroundInactive` | inactive | |
| **15** | `kThemeBrushDocumentWindowBackground` | `kDocumentWindowClass` | **`bodyBackground.pattern`** (decoded from cinf `-9551`) |
| 16 | `kThemeBrushFinderWindowBackground` | Finder body fill | |
| 48 | `kThemeBrushNotificationWindowBackground` | notification | |
| 49 | `kThemeBrushMovableModalBackground` | movable modal | |
| 50 | `kThemeBrushSheetBackgroundOpaque` | sheet | |
| 51 | `kThemeBrushDrawerBackground` | `kDrawerWindowClass` | |
| 52 | `kThemeBrushToolbarBackground` | `kToolbarWindowClass` | |

## ThemeTextColor — title-text + label role pegs (`Appearance.h:177-236`)

The canonical "what colour is the title bar text" answer. Per window type.

| Value | Constant | Used for | Kaleidoscope analogue |
|---:|---|---|---|
| 7 | `kThemeTextColorWindowHeaderActive` | window-header generic | |
| 8 | `kThemeTextColorWindowHeaderInactive` | inactive | |
| **23** | `kThemeTextColorDocumentWindowTitleActive` | doc window title | **our `composeWindowChrome` title path** (kDEF samples cicn marker; falls back to classic black/gray default) |
| 24 | `kThemeTextColorDocumentWindowTitleInactive` | inactive | |
| 25 | `kThemeTextColorMovableModalWindowTitleActive` | movable-modal | |
| 27 | `kThemeTextColorUtilityWindowTitleActive` | utility | |
| 29 | `kThemeTextColorPopupWindowTitleActive` | popup | |
| -1 | `kThemeTextColorBlack` | hard fallback | our `state==='active' → '#000000'` |
| -2 | `kThemeTextColorWhite` | hard fallback (dark bars) | our `state==='inactive' → '#bcbcbc'` |

The pre-Appearance (Sys 7) path is documented in `ctm/executor` `windDocdef.c:201-245`: title colour = `wctb[wTextColor]` (index 2). Default `wctb` 0 ships `wTextColor = BLACK_RGB` (`windColor.c:55`); inactive computes gray. **Our classic-Mac default is independently sourced from this primary source** — black active / gray inactive.

## ThemeWidget — title-bar widget role pegs (`Appearance.h:600-612`)

The canonical "what is close vs zoom vs collapse" enum.

| Value | Constant | Kaleidoscope correlate |
|---:|---|---|
| 0 | `kThemeWidgetCloseBox` | left widget; document family `-14336`, utility family `-14320` |
| 1 | `kThemeWidgetZoomBox` | right outer (doc only) |
| 2 | `kThemeWidgetCollapseBox` | right inner |
| 3 | `kThemeWidgetABox` / Apple-internal |  |
| 4 | `kThemeWidgetBBox` |  |
| 5 | `kThemeWidgetBOffBox` |  |
| 6 | `kThemeWidgetDirtyCloseBox` |  |

**The Kaleidoscope `-14336` / `-14335` / `-14334` ids store the widget BITMAPS keyed by the chrome model (corner-sprite ics4/8 family for the procedural-frame schemes; baked into the cicn for the native-recipe schemes).** Apple's enum tells you the role; the Kaleidoscope id tells you which bitmap slot.

## ThemeWindowType — window-class role pegs (`Appearance.h`)

```c
kThemeDocumentWindow       = 0
kThemeDialogWindow         = 1
kThemeMovableDialogWindow  = 2
kThemeAlertWindow          = 3
kThemeMovableAlertWindow   = 4
kThemePlainDialogWindow    = 5
kThemeShadowDialogWindow   = 6
kThemePopupWindow          = 7
kThemeUtilityWindow        = 8
kThemeUtilitySideWindow    = 9
kThemeSheetWindow          = 10
kThemeDrawerWindow         = 11
```

Each of these has a default WDEF `defProcID` (an int passed to `NewWindow`):

```c
documentProc      = 0
dBoxProc          = 1
plainDBox         = 2
altDBoxProc       = 3
noGrowDocProc     = 4
movableDBoxProc   = 5
zoomDocProc       = 8
zoomNoGrow        = 12
rDocProc          = 16
floatProc         = 1985    // + variant flags
```

**Kaleidoscope's `wnd#` resource type is private — it does NOT correspond to any Apple-documented resource.** Apple's window-def-code resource type is `'WDEF'` (`kWindowDefProcType` in `MacWindows.h:164`); WDEFs are PROCEDURAL (compiled code), not data tables. Kaleidoscope's `wnd#` data-driven recipe is its own contribution; the kDEF replays its decoded shape.

## Apple Finder system icons (`IconsCore.h` 3.4, range -3968..-4000)

The Mac OS Finder's icon-resolution fallback chain terminates at these system-icon ids registered under `kSystemIconsCreator = 'macs'`.

| id | constant | role |
|---:|---|---|
| -3968 | `kFontsFolderIconResource` | Fonts folder |
| -3969 | `kGenericMoverObjectIconResource` | Font/Sound Mover obj |
| -3970 | `kGenericSuitcaseIconResource` | Suitcase |
| -3971 | `kGenericPreferencesIconResource` | Generic prefs file |
| -3972 | `kGenericFileServerIconResource` | Generic server |
| -3973 | `kExtensionsFolderIconResource` | Extensions folder |
| -3974 | `kPreferencesFolderIconResource` | Preferences folder |
| -3975 | `kPrintMonitorFolderIconResource` | PrintMonitor folder |
| -3976 | `kControlPanelFolderIconResource` | Control Panels folder |
| -3977 | `kMountedFolderIconResource` | Mounted folder |
| -3978 | `kSharedFolderIconResource` | Shared folder |
| -3979 | `kDropFolderIconResource` | Drop folder |
| -3980 | `kOwnedFolderIconResource` | Owned folder |
| -3981 | `kStartupFolderIconResource` | Startup Items |
| -3982 | `kAppleMenuFolderIconResource` | Apple Menu Items folder |
| **-3983** | `kSystemFolderIconResource` | System Folder |
| -3984 | `kFullTrashIconResource` | Full trash |
| -3985 | `kGenericStationeryIconResource` | Stationery doc |
| -3987 | `kGenericCDROMIconResource` | CD-ROM |
| -3988 | `kGenericRAMDiskIconResource` | RAM disk |
| -3989 | `kGenericEditionFileIconResource` | Edition (publish/subscribe) |
| -3991 | `kGenericDeskAccessoryIconResource` | DA |
| -3992 | `kDesktopIconResource` | Desktop |
| **-3993** | `kTrashIconResource` | Empty trash |
| -3994 | `kPrivateFolderIconResource` | Private folder |
| **-3995** | `kGenericHardDiskIconResource` | HD volume (Apple's actual "volume info icon") |
| -3996 | `kGenericApplicationIconResource` | Generic app |
| -3997 | `kOpenFolderIconResource` | Open folder |
| -3998 | `kFloppyIconResource` | Floppy disk |
| **-3999** | `kGenericFolderIconResource` | Generic folder |
| -4000 | `kGenericDocumentIconResource` | Generic document |
| -16415 | `kGenericExtensionIconResource` | Generic extension (outlier) |
| -16506 | `kGenericQueryDocumentIconResource` | Query doc (outlier) |
| -20271 | `kHelpIconResource` | Help `?` icon (outlier) |

**Key insight:** Apple's volume-icon resolution is `GetIconRef(vRefNum, 'macs', 'hdsk') → -3995`, not `-3790`. The `-3790` slot we'd been calling "volume info icon" is in fact the **Finder window-header snap-to-grid badge** (`docs/spec/corpus-corroborated-ids.md` confirms: 3 corpus bundles label it `"Snap-To-Grid"` / `"Grid Arrangement"`).

## PlotIconID fallback rule (Inside Macintosh: More Mac Toolbox, Ch. 5)

When asked for an icon at a destination rectangle, PlotIconID picks **WITHIN family** by size + bit-depth (32 → 16 → 12 px). There is **NO documented cross-id fallback** (no "if -3999 missing, try -4000"). The only Apple-documented cross-resource fallback is `cicn` → `ICON` at the same id.

This means our codex tier hierarchies that fall back "from -3790 to -14336" have **no Apple precedent** — they were our invention to cover slots Apple's Finder source would have filled by other means we don't have access to. The reference-image pixel-probe (`scripts/probe-reference-slot.mjs`) is the way to verify what the Finder actually did.

## Local primary-source decompile work

Three companion docs in `docs/spec/` cover the Apple-side reverse-engineering already done locally:

- **`apple-appearancelib-spike.md`** — AppearanceLib container located in `85-System.bin` (offset 2428848). `DrawThemeButton` decompiled (TVector → code @ 0x2ee4): it's a THIN DISPATCHER on a theme-provider object's vtable +0xCC. Confirms Apple's data/drawer split — exactly the architecture our Phase-B procedural control generator mirrors.
- **`apple-cdef-geometry.md`** — Apple Mac OS 8.5 CDEF -63 (track family) decoded geometry.
- **`apple-cdef-button-geometry.md`** — Apple Mac OS 8.5 CDEF -1 (button family) decoded geometry.

These are the **on-disk Apple-side decompile artifacts** from prior reverse-engineering sessions (May 2026). The raw binaries live in `.scratch/iso-recon/` (gitignored): `code-out/CDEF-n1.asm`, `code-out/WDEF-125.asm`, `wdef125_decomp.c`, `pef-decompress.py` (the PEF data-section decompressor), `85-System.bin` extracted via `macbin-resfork.mjs`.

## Citation sources

The constants in this file are verifiable in primary-source code:

- **`Appearance.h`** — phracker MacOSX SDK 10.6 mirror, or `elliotnunn/UniversalInterfaces` 3.4 mirror
- **`IconsCore.h`** — phracker mirror
- **`MacWindows.h`** — same mirror
- **`Controls.h`** — same mirror
- **`ctm/executor` `windDocdef.c` / `windColor.c`** — open-source Mac OS Toolbox re-implementation; the pre-Appearance title-color path
- **Inside Macintosh: More Macintosh Toolbox — Chapter 5 "Icon Utilities"** — Apple PDF, archived at developer.apple.com/library/archive

## How to use this file

When wondering "what role does Kaleidoscope id X play?":

1. Look up id X in `docs/spec/corpus-corroborated-ids.md` (the author labels).
2. If the author label says e.g. "Push Button Active," map that role to Apple's documented peg here — there's no `kThemeBrushPushButton*` because buttons are CDEF-rendered, but the `kThemeButton*` enum + `Controls.h` are the structural answer.
3. If id X isn't in the corroborated table, run `node scripts/dump-author-hints.mjs` to refresh — adding a new corpus bundle automatically populates new labels.
4. The reference-image pixel-probe (`scripts/probe-reference-slot.mjs`) is the structural last word for Finder UI slots where Apple's source-of-truth doesn't reach.

The structural invariant: **the Kaleidoscope id is the storage key, Apple's enum is the role peg, the bundle's author label is the bridge between them.**
