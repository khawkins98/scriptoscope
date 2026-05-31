# Platinum reimplementation sources — evaluation catalog

A running catalog of external "Mac Platinum / OS 8–9 appearance" reimplementations
surfaced as possible asset sources for a higher-fidelity Platinum, each with its
**license + IP** status. Capture here so we evaluate once and don't re-litigate.

## The standing position (read first)

Our Platinum is the **clean-room procedural engine fallback** (`src/platinum.ts`
— `platinumWindow` + the controls), which the PRD explicitly sanctions as the
"un-themed engine fallback." Two hard rules govern adopting any external asset:

1. **Credit ≠ a license.** Attribution does not grant redistribution rights. An
   asset is only usable if its license actually permits redistribution + (for
   fonts) web embedding.
2. **Clean-room includes the *appearance*, not just Apple's code.** The PRD keeps
   Apple's own themes out of scope. A reimplementation that ships Apple's OS 8/9
   Platinum bitmaps (ripped or renamed) is Apple-derived and stays out — even if
   the wrapping project were licensed.

So most "Platinum theme" projects fail on (1), (2), or both. They remain useful
as **visual references** to tune our own procedural/bitmap rendering against (look,
don't ingest) — the same posture as the emulator-capture idea in
[#190](https://github.com/khawkins98/scriptoscope/issues/190) (design context: `../archive/golden-reference-todo.md`).

## Catalog

| Source | Format | License | Apple-derived? | Verdict |
|---|---|---|---|---|
| [`JohnDDuncanIII/platinum`](https://github.com/JohnDDuncanIII/platinum) | bitmap PNG (window controls) | **none** (no LICENSE; GitHub API 404 → all rights reserved) | **Yes** — README installs by replacing macOS's own `Graphite.car` system-appearance bundle; the images are Apple OS 9 artwork | ❌ Do not ingest (unlicensed **and** Apple-derived). Reference only. |
| [`JohnDDuncanIII/macfonts`](https://github.com/JohnDDuncanIII/macfonts) (`Charcoal_10.11`) | TTF | **none** (no LICENSE) | **Yes** — the "Charcoal" ttfs are renamed Apple **San Francisco** (`SFNSDisplay`) | ❌ Do not ship. See [`mac-fonts-todo.md`](./mac-fonts-todo.md) for the clean font path. |
| **Mac9KvantumClassic** — [opendesktop.org/p/1766812](https://www.opendesktop.org/p/1766812/) | **Kvantum (Qt) — SVG** vector theme | **UNVERIFIED** — the page is JS-rendered; couldn't auto-read the license. Kvantum themes are commonly **GPL** or **CC-BY-SA** (copyleft / share-alike) | Reimplements OS 9 Platinum → appearance is Apple-derived | ⏳ Evaluate: (a) confirm the actual license on the page; (b) GPL/CC-BY-SA would impose copyleft/share-alike on us; (c) still Apple-appearance-derived. **SVG is appealing** (scalable, could rasterize) but the IP + copyleft questions gate it. Reference-only until cleared. |

## The most FAITHFUL source: the original OS, not a third-party redraw

Every project above is a *reinterpretation* (someone's idea of Platinum, fidelity
unknown) — and unlicensed/Apple-derived. The authentic source is the original Mac
OS itself. But note **there are no vectors/sprites to extract**: classic Platinum
is **procedural QuickDraw code** (the Appearance Manager + system WDEF/CDEF) — we
confirmed this against the 8.5/8.6 ISOs (see the `src/platinum.ts` header:
"windows/controls are WDEF/CDEF code, not bitmaps"). So "use the original" means
one of:

1. **Decompile the Appearance WDEF/CDEF** from the ISO's System file → the exact
   drawing algorithm (gradients, bevels, radii) → reimplement it. The SAME
   playbook as the Kaleidoscope kDEF (`kdef231-reference.md`); yields the real
   algorithm AND the full control/window breadth. Heaviest; decompiling Apple
   *system* code is more legally fraught than the freeware kDEF was.
2. **Emulator capture as ground truth** — boot the ISO, screenshot the real
   controls/windows in every state, and tune our clean-room procedural redraw
   (`platinum.ts`) to match pixel-for-pixel (or trace into sprites). Lighter,
   verifiable, "look-don't-ingest" posture. **Recommended first step** — we
   already have a procedural `platinumWindow` + controls to calibrate.

Either way the output is OUR reimplementation (clean-room), more faithful than a
GTK/Kvantum reinterpretation.

**ISO recon (2026-05-23, `Mac OS 8.6 Internal Edition.iso`, mounted via `hfsutils`
`hmount`/`hls`).** The disc is in `~/Downloads/`. Findings:
- `System Folder/Appearance/` holds only an empty `Sound Sets` — **no theme-file
  artwork** (the default "Apple platinum" appearance is not a data theme).
- **No separate Appearance extension** in `Extensions/` — so in 8.6 the Appearance
  Manager / Platinum drawing is built into the **`System` file (6.4 MB, `zsys`)**
  (plus `System Resources` 885 KB and the `Mac OS ROM`). That is the decompile
  target for #1.
- Implication: #1 means reverse-engineering the WDEF/CDEF out of a 6.4 MB mixed
  PPC system file — far bigger than the self-contained 107 KB freeware Kaleidoscope
  kDEF, and the most IP-fraught (Apple core OS). **#2 (emulator-capture) is the
  better ROI** — boot this ISO (SheepShaver/Basilisk II), screenshot the real
  controls/windows per state, calibrate `platinum.ts`. Needs an emulator (not
  present in this env) or user-provided screenshots.
- Not blocked meanwhile: the clean-room `platinumWindow` (branch) + apple-platinum-2's
  raster control cicns already give a solid Platinum; the ISO is the ultimate-
  fidelity stretch.

## What WOULD be cleanly usable

- **Our own clean-room procedural/bitmap reproduction** (current path) — IP-safe,
  no license entanglement. Tune it against the above as visual references.
- **A freeware-with-redistribution Kaleidoscope Platinum *scheme*** (the corpus
  model) — author-licensed `.ksc` resources flowing through the normal pipeline.
- **OFL / explicitly-free lookalike fonts** for the typography (see `mac-fonts-todo.md`).

## Related
- [#190](https://github.com/khawkins98/scriptoscope/issues/190) — the same "reference, don't ingest" logic for ground truth (design context: `../archive/golden-reference-todo.md`).
- `mac-fonts-todo.md` — the Chicago/Charcoal/Geneva typography ticket.
- `src/platinum.ts` — the procedural Platinum (and the `platinum-fidelity` branch's `platinumWindow`).
