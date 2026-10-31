# Halcyon in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` loaded in the original Kaleidoscope 2.3.1
control panel on System 7.5.5. They were taken in the maintainers' private
reference emulator (Basilisk II, 8 bpp, sound off; see
[`docs/maintainer-reference-environment.md`](../../../../docs/maintainer-reference-environment.md)).
The `@2x` files are nearest-neighbour upscales of the native 640×480 frame.

| File | What it shows |
|---|---|
| `desktop@2x.png` | Finder list view (System Folder, Control Panels expanded) with Halcyon's frame, column headers, disclosure triangles, both scroll bars, grow box, the menu bar and the desktop pattern; the disk window inactive behind |
| `desktop-before-repaint@2x.png` | the same kind of shot from the 2026-10-30 build, before the paint-over from the concept art |
| `menu-open@2x.png` | the Finder's View menu held open: teal title and item highlight |
| `control-panel@2x.png` | the Kaleidoscope control panel with Halcyon selected: tabs, tab pane, checkboxes, popup button; "Desktop Pattern" enabled |
| `dialog@2x.png` | the stock "different Folder and Trash icons … restart" alert, with Halcyon's alert frame and default ring |
| `windowshade@2x.png` | the System Folder window shaded (collapsed): only the top band is left |
| `utility-collapse-pressed@6x.png` | **older art** (2026-10-30 build); not re-shot on 2026-10-31 |

## 2026-10-31: after the paint-over

One clean boot that loaded Halcyon, Castle, Brickworks, Bonn and Midnight 2027
in turn through **Select Scheme…** (fresh copies of the v16l seeds, sound off).
`scheme.bin` sha256 `3b8bf9c9d6cf866b57c5576d8e091a024042f8dfdb01299f8e65a3b304fa6526`.

- **Loading:** no errors. The panel reads "Halcyon / 0.2 Halcyon (Scriptoscope
  authoring)"; About This Scheme is greyed (no about box shipped). The scheme
  picker shows Halcyon's icon. Closing the panel after switching from Apple
  Lisa brought up the Folder/Trash icon restart alert (`dialog@2x.png`).
- **Art above the title bar goes under the menu bar.** The top band is 62 px,
  and the title strip (close box, title, zoom/collapse) is the top ~20 px of it.
  Windows that open at their saved Finder positions put that strip under the
  menu bar: the control panel and both Finder windows opened with only the
  kingfisher's lower half and the lavender/blue band showing, and no title or
  close box. Dragging the visible lower band moves the window, which is how
  these shots were set up.
- **Title bar colours:** the web art already stores the band as flat steps
  (`#d4ffff`/`#d4d4ff`/`#a8d4ff`, alternate rows), and the 8 bpp screen shows
  the same steps at its own levels (`#daffff`/`#dadaff`/`#b3daff`). No extra
  banding or dithering beyond that.
- **Still different from the web preview** (`../preview.png`):
  - a plain alert/dialog body is the system dialog grey `#E7E7E7` under the
    frame's white top band; the web runtime fills it white (runtime finding,
    seen again);
  - the title is bitmap Chicago 12, narrower than the web font, so the title
    pill is narrower;
  - Finder icons, cursors, sounds, Finder Colors and Accent Color stay on the
    system defaults (not shipped).

These are illustrations that the generated file is a valid, complete scheme.
They are **not** admitted fidelity evidence (no reference-intake review, 8 bpp
palette condition), and no golden or ledger row depends on them.

## Earlier runs (2026-10-30)

- **Loading:** the first run (frames, buttons and checkboxes only) loaded in
  one boot with no errors, and a Windows 95 control run behaved the same.
- **Complete scheme:** it also loaded in one boot. It exposed one bug: tab-pane
  labels were drawn white on white. A final boot confirmed the fix.
- **Open question then:** a faint white band under the inactive window's bottom
  edge in the desktop shot, unexplained (not seen in the 2026-10-31 shots).
- After the visual design pass (`docs/authoring-visual-design.md`) the shots
  were redone from one clean boot per scheme.
