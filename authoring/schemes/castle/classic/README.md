# Castle in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x` files are nearest-neighbour upscales of the native 640×480 frame. These are
illustrations that the scheme loads and draws in the real engine; they are
**not** admitted fidelity evidence. The general findings about tall frames
(click-through on transparent frame pixels, the menu bar covering art above the
title bar, narrow-window behaviour, 8 bpp colour shifts) are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | System Folder list view (active) over the inactive disk window: towers, flags, crenellations, the red title plate |
| `wide@2x.png` | the same window widened to 608 px |
| `desktop-before-repaint@2x.png` | the 2026-10-30 build, before the paint-over from the concept art |
| `desktop-before-redesign@2x.png` | the build before the visual design pass |

## 2026-10-31: after the paint-over

Taken in one clean boot that switched Halcyon → Castle → Brickworks → Bonn →
Midnight 2027 through **Select Scheme…**. `scheme.bin` sha256
`8478d29fdd697abf4f31f7b6e1cdf82eea6abd33556789866e5037133668b262`.

- **Loading:** no errors. The panel reads "Castle / 0.2 Castle (Scriptoscope
  authoring)"; About This Scheme is enabled; the picker shows the scheme icon.
- **Same as the web preview** (`../preview.png`): tower, flag and crenellation
  placement, the red title plate, the widget positions and the moat strip.
- **Narrow windows:** at 160 px outer width (the Finder's minimum here) the
  title is truncated to "System…" and still drawn; the towers overlap the
  title band but nothing drops.
- **Differences from the web preview:**
  - the title is bitmap Chicago 12, so the plate is narrower than the web one;
  - the Finder's info bar and column-header band are drawn tan
    (`#b38754`), a strip the web preview has no equivalent for;
  - the desktop stays the system grey: Castle ships no desktop pattern
    (`Desktop Pattern` is greyed in the panel);
  - colours sit on the 8 bpp palette levels (e.g. cream body, tan header);
    no banding was visible in the stone or the title plate.
- Art above the title bar: these windows were dragged clear of the menu bar,
  so nothing is hidden in the shots. Castle under the menu bar was not
  re-tested in this run.

## Earlier run (2026-10-30)

One clean boot; then redone after the visual design pass
(`docs/authoring-visual-design.md`). Files named `*-before-redesign*` show
that earlier build.
