# Halcyon in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` loaded in the original Kaleidoscope 2.3.1
control panel on System 7.5.5. They were taken in the maintainers' private
reference emulator (Basilisk II, 8 bpp, sound off; see
[`docs/maintainer-reference-environment.md`](../../../../docs/maintainer-reference-environment.md))
on 2026-10-30.

| File | What it shows |
|---|---|
| `desktop@2x.png` | Finder list view with Halcyon's frame, column headers, disclosure triangles, both scroll bars, grow box, the menu bar and the desktop pattern; an inactive window behind |
| `menu-open@2x.png` | an open pull-down menu with the teal title and item highlight |
| `control-panel@2x.png` | the Kaleidoscope control panel with Halcyon selected: tabs, tab pane, checkboxes, popup button; "Desktop Pattern" enabled |
| `dialog@2x.png` | a stock dialog with Halcyon's push buttons and default ring |
| `windowshade@2x.png` | a window-shaded (collapsed) window |

The `@2x` files are nearest-neighbour upscales of the native 640×480 frame.

How the runs went:

- **Loading:** the first run (frames, buttons and checkboxes only) loaded in
  one boot with no errors, and a Windows 95 control run behaved the same.
- **Complete scheme:** it also loaded in one boot. It exposed one bug: tab-pane
  labels were drawn white on white. A final boot confirmed the fix, and these
  screenshots come from that build.
- **Still on system defaults:**
  - Finder icons, cursors and sounds (not shipped);
  - the "Finder Colors" and "Accent Color" options;
  - controls a control panel draws itself, such as the Memory and Sound
    panels' sliders.
- **Open question:** a faint white band under the inactive window's bottom
  edge in the desktop shot is unexplained. It may be another window stacked
  behind.

These are illustrations that the generated file is a valid, complete scheme.
They are **not** admitted fidelity evidence (no reference-intake review, 8 bpp
palette condition), and no golden or ledger row depends on them.

**Updated 2026-10-30** after the visual design pass (`docs/authoring-visual-design.md`): these screenshots show the redesigned art, from one clean boot per scheme. Files named `*-before-redesign*` show the earlier build for comparison.
