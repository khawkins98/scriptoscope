# Platinum 8 — provenance

A real, third-party **Kaleidoscope** scheme: *Platinum 8 1.0* by **Russell Silver Jr.**
(Newgallus Software, April 1998), a freeware recreation of the Mac OS 8 Platinum
appearance. Extracted straight from its binary resource fork (`scheme.rsrc`) by
`scripts/extract-scheme.mjs`.

**Verified faithful (2026-05-25):** re-unpacked the original `Downloads/platinum8.sit`
with `unar` and confirmed the scheme file's resource fork is **byte-identical**
(md5 `8ae60c67…`) to our committed `scheme.rsrc`, and that a clean re-extraction
produces **pixel-identical** cicns + matching `theme.json`. So this bundle is the true
extraction — not cross-contaminated. The author's own rendering is preserved as a
reference at `demo/assets/references/platinum-8.png` (from the Kaleidoscope archive,
kaleidoscope.hryjksn.com) — note it is a deliberately **light/flat** scheme (the readme
asks for feedback if "too light"), which is why its chrome reads flatter than Apple's.

NOTE on rendering: this scheme ships **no `wnd#` window recipes** (`windowTypes: 0`), so
in the demo its windows are drawn by the base layer (`apple-platinum-replica`, Apple
pinstripe) while its own controls render — which can read as a "mixed" look. Its own
flat window chrome (the `*-racing-stripes` + frame cicns) is present but unassembled;
giving it standalone windows is a separate windowType-authoring task.

## Why it's here

It's a widely-used, real-world Platinum scheme — the kind of artifact Scriptoscope exists
to render 1:1. The owner has chosen to **defer to this scheme** as the practical
authority for the recognizable Platinum look (over the hand-built
`apple-platinum-replica`), on the reasoning that a scheme thousands of people actually
ran is battle-tested in a way our reconstruction is not.

Note this is Russell's *rendition* of Platinum, not an Apple system rip — it stylizes
(heavier bevels; exposes color variants stock Platinum never did: 9 progress-bar
colors, colored menu highlights). So it is authoritative for *recognizable Platinum*,
not for *pixel-exact Apple*. Where pixel-exact-Apple matters, the Mac OS 8 screenshots
in `apple-platinum-replica/sources/` remain ground truth.

## What it contains (and does NOT)

Resource types in `scheme.rsrc`: `cicn` (98), `ppat` (4), `clut`, `TMPL`, `actb`.

- **Controls** — a complete, state-ful set: checkbox/radio in three sizes
  (small/normal/large) × three states (pressed/normal/disabled), scrollbars
  (normal/pressed, H/V), a ghost (proportional) thumb, and progress bars in nine
  colors + a track. These resolve by resource id, so they're directly usable.
- **Window chrome** — racing-stripe *textures* as cicns (`alert-racing-stripes`,
  `utility-racing-stripes`, …).
- **Patterns** — 4 `ppat` desktop/fill patterns; a `clut` color table.
- **NO `wnd#`, NO `cinf`** — the scheme carries no window *recipes* or chrome-info.
  It customizes the look, not the geometry; in real Kaleidoscope the window shape
  comes from the base WDEF. So this scheme cannot define window layout on its own —
  windows render via the engine's base-layer (recipes from `apple-platinum-replica`)
  with platinum-8's textures grafted on. `windowTypes` is therefore 0 by nature, not
  by an incomplete extraction.

## License

Freeware, per the scheme's bundled `scheme.txt` readme. Redistributed here with
attribution to Russell Silver Jr. / Newgallus Software for a preservation project.
Source: `Downloads/platinum8.sit`.
