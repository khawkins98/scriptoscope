# Black Platinum — provenance

A real, third-party **Kaleidoscope** scheme: *Black Platinum v1.01* by **Daisuke
Yamashita** (1999), a black-palette recreation of the Mac OS 8 Platinum appearance.
Extracted straight from its binary resource fork (`scheme.rsrc`) by
`scripts/extract-scheme.mjs`.

**Source:** the original `blackplatinum.sit` from the Kaleidoscope archive
(`http://www.kaleidoscope.net/schemes/schemes/blackplatinum.sit`, via the Internet
Archive, snapshot 2005-11-02), expanded with `unar`. Author's own rendering preserved
as a reference at `demo/assets/references/black-platinum.png` (kaleidoscope.hryjksn.com).
Freeware, redistributed with attribution.

**Why it's here (the investigative value):** Black Platinum recreates the *same*
Platinum window geometry in a *black* palette, which made it the decisive test for how
these schemes encode their frame:

- It ships **NO `wnd#` and NO `cinf`** resources (only the inert TMPL definitions),
  exactly like the other corner-sprite schemes. So the window frame is **procedural**
  (WDEF-drawn), not raster art — confirming the procedural approach is correct.
- The "black" is **colour, not geometry**: the black title bar comes from its
  `-14331` racing-stripes cicn (white stripes on black), and the black frame/header
  from its colour table (`clut -14336` "Active Header"). Same structure as gray
  Platinum, different palette.

NOTE on rendering / known gaps this scheme exposed (to fix in the corner-sprite path):
the `headerColors` extraction reads the frame as gray for every corner-sprite scheme
(so Black Platinum's frame draws gray, should be black); the active/inactive header
cluts are swapped at `extract-scheme.mjs` (`-14336` is *Active*, `-14335` *Inactive*);
the title text needs to flip to white on a dark header; and this scheme ships **8-bit
`ics8`** icons (no `ics4`), which `extract-icons.mjs` does not decode, so its
control/widget glyphs are absent (widgets fall back to procedural squares).
