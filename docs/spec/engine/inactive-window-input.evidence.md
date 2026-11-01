# Evidence appendix: `inactive-window-input.md` (spec writers and verifiers only)

Implementers must not read this file. Listing: the local 2.3.1 `kDEF 0`
disassembly (objdump, m68k, file offsets), same binary as the spec header
(SHA-256 `2c027276…c342`). Lane 614, 2026-11-01. Marks are the spec writer's
own re-reads (C = confirmed in the listing on that date). They are not an
independent verification.

## E1. Drawn-active flag (recipe)

| address | listing | reading | mark |
|---|---|---|---|
| `0x2e52` | `moveb %a0@(111),%a4@(508)` | flag 508 ← `WindowRecord+111` (`hilited`; +110 `visible`, +112 `goAwayFlag`) | C |
| `0x3156..0x315e` | `btst #0,%a4@(459)`; `bnes`; `moveb #1,%a4@(508)` | families 66/67 (tested at `0x311e..0x3128`): bit 0 of the variation byte clear → flag 508 forced to 1 | C |
| `0x31cc..0x31d4` | same pattern | family 124 (`0x31b4`) | C |

## E2. Recipe hit gate

| address | listing | reading | mark |
|---|---|---|---|
| `0x411c..0x4120` | `tstb %a4@(505)`; `beqw 0x41e4` | `widgetFrame` clear → 1 | C |
| `0x4124..0x4128` | `tstb %a4@(508)`; `beqw 0x41e0` | `drawActive` clear → `0x41e0` (returns 2) | C |
| `0x412c` | `tstb %a3@(112)` | first widget test (`goAwayFlag`) — after the gate | C |
| `0x3f6a` | `tstb %a4@(509)` | grow branch entry (window-widgets HG2; result 3 vs 1 at `0x3fa6` reads flag 508) | C (entry only; result per window-widgets evidence) |

## E3. Built-in document hit (`0x1295e`)

| address | listing | reading | mark |
|---|---|---|---|
| `0x1296a` | `tstb %a0@(110)` | `visible` | C |
| `0x12990` | `moveb %a0@(111),%d3` | `hilited` kept in d3 for the whole call | C |
| `0x12a10..0x12a14` | `tstb %a4@(118)`; `beqw 0x12b7e` | untitled → 1 (HT4) | C |
| `0x12a18..0x12a1a` | `tstb %d3`; `beqw 0x12af8` | not hilited → skip HT5–HT7, go to drag test HT8 | C |
| `0x12a1e..0x12a36` | `pea`/`bsrl 0x1469a`/`_PtInRect` | title-bar rect test, only when hilited | C |

## E4. Built-in document title draw

| address | listing | reading | mark |
|---|---|---|---|
| `0x13ca2` | `bsrl 0x13ee8` | title text, unconditional | C |
| `0x13ca8..0x13caa` | `tstb %d6`; `beqs 0x13cf4` | d6 false → skip stripes and widgets | C |
| `0x13cac` | `bsrl 0x13d98` | stripes | C |
| `0x13cb2..0x13cc0` | `goAwayFlag` test, `bsrl 0x1414a` | close glyph, normal state | C |

d6 is loaded at the routine's entry: `0x1381a` `moveb %a0@(111),%d6`
(`hilited`), routine `0x1380e`. C.

## E5. Built-in utility

| address | listing | reading | mark |
|---|---|---|---|
| `0x1740e..0x17428` | `tstb %a0@(111)`; `bnes`; `tstb %a4@(1145)`; `bnes`; 0 / 1 | *active* = `hilited` or *alwaysActive* | C |
| `0x15b26..0x15b2c` | `bsrl 0x1740e`; `moveb %d0,%d3` | *active* kept in d3 | C |
| `0x15baa` | `tstb %d3` | after the title-rect test: inactive skips UH4–UH6 | C |
| `0x16736`, `0x16756..0x16758` | `tstb %d3`; `beqw 0x16838` | stripes, then widgets, only when *active* | C |

## E6. Apple sources consulted

- *Inside Macintosh: Macintosh Toolbox Essentials*, Apple PDF
  `developer.apple.com/library/archive/documentation/mac/pdf/MacintoshToolboxEssentials.pdf`,
  SHA-256 `d621ee7d98f982fd7c9891c3dc433ff7dd438beb2fccc7dfcfb1773b4c7da1c3`,
  text extracted with `pdftotext -layout`. Pages quoted: 2-36 (Event Manager,
  FindWindow constants "active window only"), 4-43 to 4-45 (handling
  mouse-down events, Listing 4-9), 4-56 (Listing 4-12, `ZoomWindow(thisWindow,
  zoomInOrOut, (thisWindow = FrontWindow))`), 4-93 (FindWindow description:
  "an active window's close box", "an active window's zoom box"), 4-94 to 4-95
  (DragWindow), 4-102 (ZoomWindow `front`), 4-103 to 4-104 (TrackGoAway),
  4-122 ("Return the constants wInGrow, wInGoAway, wInZoomIn, and wInZoomOut
  only if the window is active … is reported as wInDrag").
- Universal Interfaces 3.2 `MacWindows.h` (elliotnunn/UniversalInterfaces,
  `3.2/Universal/Interfaces/CIncludes/MacWindows.h`, SHA-256
  `c1fc80dc93e90c7b4036bc8bfefbf2c6d0d941a5ca1c216fdd7cc5e200d1d184`, the
  same file hit-regions E10 cites): `floatProc` … `floatSideZoomGrowProc`
  1985–1999 (lines 198–205), `kWindowUtilityDefProcResID` 66 and 67 (213–214),
  `kWindowFloatProc` … 1057–1087 (250–271), `inGoAway` 6 … `inCollapseBox` 11
  (407–410), `wInDrag` 2 … `wInCollapseBox` 9 (422–427).

## E7. Runtime code read (read-only, `main` at `e283d382`)

- `src/interactive.ts` `overlayWidgets`: widget `pointerdown` calls
  `stopPropagation` (no activation); `click` runs the handler without an
  activation check; hit rects come from `titleWidgetHits(…, state)` whether or
  not the state draws widgets (built-in frame).
- `toggleZoom`: `entry.z = ++this.zClock` without changing `active`.
- `WindowManager.add`: `active: this.windows.length === 0 && opts.state !== 'inactive'`.
- `src/declarative/parse.ts`: `state: d.scriptoscopeState === 'inactive' ? 'inactive' : 'active'` (no "not declared").
- Wheel listener: `const delta = vertical || e.shiftKey ? e.deltaY : e.deltaX`.
- Built-in utility records in `src/engine/tables/proceduralFrame.ts` use
  variations 1, 3 and 9 (bit 0 set), so *alwaysActive* is never on.
