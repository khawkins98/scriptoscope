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
`golden-reference-todo.md`.

## Catalog

| Source | Format | License | Apple-derived? | Verdict |
|---|---|---|---|---|
| [`JohnDDuncanIII/platinum`](https://github.com/JohnDDuncanIII/platinum) | bitmap PNG (window controls) | **none** (no LICENSE; GitHub API 404 → all rights reserved) | **Yes** — README installs by replacing macOS's own `Graphite.car` system-appearance bundle; the images are Apple OS 9 artwork | ❌ Do not ingest (unlicensed **and** Apple-derived). Reference only. |
| [`JohnDDuncanIII/macfonts`](https://github.com/JohnDDuncanIII/macfonts) (`Charcoal_10.11`) | TTF | **none** (no LICENSE) | **Yes** — the "Charcoal" ttfs are renamed Apple **San Francisco** (`SFNSDisplay`) | ❌ Do not ship. See [`mac-fonts-todo.md`](./mac-fonts-todo.md) for the clean font path. |
| **Mac9KvantumClassic** — [opendesktop.org/p/1766812](https://www.opendesktop.org/p/1766812/) | **Kvantum (Qt) — SVG** vector theme | **UNVERIFIED** — the page is JS-rendered; couldn't auto-read the license. Kvantum themes are commonly **GPL** or **CC-BY-SA** (copyleft / share-alike) | Reimplements OS 9 Platinum → appearance is Apple-derived | ⏳ Evaluate: (a) confirm the actual license on the page; (b) GPL/CC-BY-SA would impose copyleft/share-alike on us; (c) still Apple-appearance-derived. **SVG is appealing** (scalable, could rasterize) but the IP + copyleft questions gate it. Reference-only until cleared. |

## What WOULD be cleanly usable

- **Our own clean-room procedural/bitmap reproduction** (current path) — IP-safe,
  no license entanglement. Tune it against the above as visual references.
- **A freeware-with-redistribution Kaleidoscope Platinum *scheme*** (the corpus
  model) — author-licensed `.ksc` resources flowing through the normal pipeline.
- **OFL / explicitly-free lookalike fonts** for the typography (see `mac-fonts-todo.md`).

## Related
- `golden-reference-todo.md` — the same "reference, don't ingest" logic for ground truth.
- `mac-fonts-todo.md` — the Chicago/Charcoal/Geneva typography ticket.
- `src/platinum.ts` — the procedural Platinum (and the `platinum-fidelity` branch's `platinumWindow`).
