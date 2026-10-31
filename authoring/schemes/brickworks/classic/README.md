# Brickworks in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@4x`/`@6x` files are nearest-neighbour upscales. These are illustrations
that the scheme loads and draws in the real engine; they are **not** admitted
fidelity evidence. The general findings about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | System Folder list view (active, 522 px wide) over the inactive disk window: corner bricks, stud row, crane, scroll bars |
| `wide@2x.png` | the same window widened to 618 px |
| `control-panel@2x.png` | the Kaleidoscope control panel with Brickworks selected |
| `title-plate-tiling@4x.png` | the stud row over the title plate in `wide@2x.png`, showing the seams at both plate edges |
| `corner-zoom@6x.png` | the zoom and collapse widgets at the right end of the title bar |
| `desktop-before-repaint@2x.png` | the 2026-10-30 build, before the paint-over from the concept art |
| `corner-zoom-before-redesign@6x.png` | the build before the visual design pass |

## 2026-10-31: classic extras added, not yet verified in Kaleidoscope

Added after the run below: the scheme picker icon (`ICN#`/`icl8`/`icl4`/
`ics#`/`ics8`/`ics4` -16455, a red 2×2 brick with four studs in three-quarter
view, drawn separately at 32×32 and 16×16) and a desktop pattern (`ppat 17`,
16×16: a muted green baseplate `#669966` with one stud per tile, rims
`#99cc99` / `#336633`, exact system-palette entries stored raw). Menus are
still not themed. Built with `npm run author` (no errors) and checked in the
8-bit simulation, but these have **not been verified in real Kaleidoscope
yet**: the screenshots and notes below predate them.

## 2026-10-31: after the paint-over

One clean boot that switched Halcyon → Castle → Brickworks → Bonn → Midnight
2027 through **Select Scheme…**. `scheme.bin` sha256
`6f4e7d0c69dbb6785a8d0b7e2fd73f8f8570ed99d49eefbf933d7ff3c884caa9`.

- **Loading:** no errors. The panel reads "Brickworks / 0.1 Brickworks
  (Scriptoscope authoring)". The scheme picker shows a **blank icon** for
  Brickworks (no scheme icon was shipped), and the menu bar and desktop stay on
  the system defaults (no menus module, no desktop pattern). The icon and the
  desktop pattern have since been added; see above.
- **The tiled stud row over the title plate: the original engine tiles it the
  same way as the web runtime.** Both were measured at the same outer widths
  (618 and 522 px) against `demo/authoring-preview.html`, by the window-relative
  x of the dark brick outlines in the stud row:
  - the row is cut into three runs at the plate edges, with a double seam at
    each edge;
  - the run left of the plate is phased so that its last whole 18 px tile ends
    at the plate's left edge, with a partial tile against the left corner
    (classic 2 px at 618, web 15 px);
  - the run over the plate starts with a 2 px piece, then whole tiles, then a
    truncated tile and a 3 px end piece before the right edge;
  - the run right of the plate starts with a whole tile at the plate's right
    edge and is cut short at the right corner.
  
  The seams land at the same offsets from the plate edges in both. The only
  difference is the plate width, which follows the title font: Chicago 12
  "System Folder" gives a 97 px plate, the web font 108 px, so the counts
  inside the plate differ. One geometry (two widths, one title); not admitted
  evidence.
- **Narrow windows:** at 153 px outer width the title is truncated to "S…" and
  still drawn; the crane overhangs the next window.
- **Other differences from the web preview** (`../preview.png`): the title is
  bitmap Chicago 12; colours sit on the 8 bpp palette levels (the reds, yellows
  and blues stay clean, no banding seen); the crane and corner brick over the
  desktop show the desktop pattern through their transparent pixels as
  expected.

## Earlier run (2026-10-30)

One clean boot; then redone after the visual design pass
(`docs/authoring-visual-design.md`). Files named `*-before-redesign*` show
that earlier build.
