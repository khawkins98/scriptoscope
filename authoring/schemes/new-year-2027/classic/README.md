# Midnight 2027 in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off), taken
2026-10-31. `@2x`/`@3x` files are nearest-neighbour upscales of the native
640×480 frame. These are illustrations that the scheme loads and draws in the
real engine; they are **not** admitted fidelity evidence. The general findings
about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | System Folder list view (active, 414 px wide) over the inactive disk window: fireworks, gold title plate, "2027", clock grow box, navy menu bar and starry desktop |
| `wide@2x.png` | the same window widened to 599 px |
| `narrow-title-drop@3x.png` | left: 143 px wide, title, "2027" and both fireworks gone; right: 213 px wide, "Syste…", "2027" and the fireworks back |

## 2026-10-31: first run

One clean boot that switched Halcyon → Castle → Brickworks → Bonn → Midnight
2027 through **Select Scheme…**. `scheme.bin` sha256
`cec8c40473c811c321af14ac29a51def044c2edad9560661229b1c9661e18ee9`.

- **Loading:** no errors. The panel reads "Midnight 2027 / 0.1 Midnight 2027
  (Scriptoscope authoring)"; the picker shows the scheme icon; the menu bar,
  menus and desktop pattern are themed. The Select Scheme dialog gets the Midnight
  dialog frame.
- **Same as the web preview** (`../preview.png`): firework, plate, "2027" and
  widget positions match the web runtime at the same outer width (599 px).
- **Narrow windows:** at 143 px outer width the title plate, "2027" and both
  fireworks are dropped; at 213 px they are all drawn ("Syste…"). The web
  runtime does the same at the same two widths ("Syst…", its font is wider).
- **8 bpp colour shifts in the fireworks.** The bursts keep their shape but
  move to the 8-bit palette: the gold burst is `#ffda54` / `#ffffda` /
  `#dab354` with `#ff87da` sparks (web `#ffcc33` / `#ffffcc` / `#cc9933` with
  `#ff66cc`). The cyan burst shows as `#54daff` / `#00b3da` /
  `#87b3da`. On screen the gold reads paler and more lemon, the pink sparks
  brighter.
- **Navy:** the frame's navy is `#00003f` and the desktop `#000054`; the
  active frame sits on a desktop of nearly the same colour, so the window
  edge is carried by the gold content outline and the starfield break.
- **Other differences from the web preview:** the title is bitmap Chicago 12,
  so the plate is narrower.
- Art above the title bar: these windows were dragged clear of the menu bar,
  so no firework is hidden in the shots; under the menu bar was not tested.
