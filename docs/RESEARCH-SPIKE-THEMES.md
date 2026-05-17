# Research spike — period theme deconstruction

**Status: closed 2026-05-17.** Spike successful. The two original Tier 1/2 schemes (`mass:werk 7 Le`, `mass:werk Dark ErgoBox 2`) were deconstructed and the findings codified as [`docs/kaleidoscope-geometry-spec.md`](./kaleidoscope-geometry-spec.md) — the canonical architecture artifact. The [scheme-extractor tool](../tools/scheme-extractor/) now decodes `cicn`, `ppat`, `cinf`, and `wnd#` from any Kaleidoscope `.ksc` and emits a draft `theme.json` per the spec's §7 schema. Phase 4 (theme engine) will consume this format directly. Document retained as the methodology record.
**Date opened:** 2026-05-16
**Why we're doing this:** the PRD assumes we'll deconstruct at least one period theme to inform Aaron UI's web bundle format design. The PRD doesn't say *which* theme, *where to get it*, or *how to extract it*. This document closes those gaps.

---

## What this spike answers

1. **Which period theme format do we deconstruct first?** (Apple `.afm` vs. Kaleidoscope `.ksc`.)
2. **Can we actually get our hands on representative bundles?** (Acquisition risk.)
3. **Do we have the tooling to extract resource forks on modern macOS?**
4. **What does a real period theme bundle actually contain?** (Resource type inventory, asset categories.)
5. **What's the smallest static HTML/CSS implementation that proves we can render a Platinum window faithfully?** (Tracer-bullet for Phase 2 chrome.)

It does *not* answer: the final shape of Aaron UI's web bundle format (that's a Phase 4 design decision informed by this spike), or any Phase 1 WM-core questions.

> **2026-05-16 update:** when this spike was originally written, Aaron UI's positioning still claimed Appearance Manager re-implementation, and the spike's "Kaleidoscope first, Apple later" framing was an order-of-operations choice. The project has since dropped Apple themes from scope entirely (LEARNINGS entry "Apple themes dropped; Kaleidoscope is the corpus"). The spike's methodology is unchanged; the "format spine from Appearance Manager docs" framing below is superseded — the spine now comes from the Kaleidoscope SDK docs plus our own deconstruction findings, full stop.

---

## Decision: Kaleidoscope `.ksc` as the deconstruction corpus

The artifact we dissect — and the only artifact Aaron UI ports — is a Kaleidoscope scheme. Apple `.afm` files are out of scope per the LEARNINGS entry referenced above.

Why Kaleidoscope is the right corpus:

- **Corpus + visual reference** comes from Kaleidoscope because (a) ~4,010 schemes exist on Macintosh Garden vs. a handful of `.afm` files; (b) many Kaleidoscope authors faithfully reproduced Platinum (mass:werk's "7 Le" is described as "Apple's System 7 with a touch of platinum"); (c) community provenance is cleaner — many schemes ship freeware-with-redistribution readmes.
- **Format documentation** comes from the Kaleidoscope SDK / scheme-authoring guides (mirrored on Wayback from the defunct kaleidoscope.net). Combined with empirical deconstruction of representative schemes, that's enough to draft Aaron UI's bundle format.
- **The clean-room boundary** is from Kaleidoscope's *source code* (which we never touch), not from the freeware-licensed scheme assets (which we do extract, with attribution).

---

## Candidate schemes

**Tier 1 — first deconstruction target (Platinum-faithful, single-author provenance):**

- **mass:werk 7 Le** — N. Landsteiner / mass:werk — "Apple's System 7 with a touch of platinum."
  - Source: <https://www.masswerk.at/schemes.php>
  - Why it's a good first target: single-author origin, explicitly Platinum-styled, hosted by the author themselves (provenance verifiable in 30 seconds, not 30 minutes).

**Tier 2 — second deconstruction target (stylistically distant, to inform extension points):**

- TBD from `kaleidoscope_schemes.zip` (650 MB bulk pack on Macintosh Garden). Candidates to look for: a maximalist late-'90s scheme (lots of texture, custom widgets), or one of the BeOS/Copland tribute schemes. Picked once we have the bulk pack downloaded and indexed.
  - Source: <https://macintoshgarden.org/apps/kaleidoscope> → `kaleidoscope_schemes.zip`

**Tier 3 — reference-only, do not deconstruct:**

- **`kaleidoscope_banned.zip`** (32 schemes Apple issued takedowns against for replicating OS X's Aqua interface). Don't touch these. Their existence is *evidence* — Apple's enforcement targeted Aqua reproductions, not Platinum — which informs PRD open question #3. But the files themselves are radioactive.

**Browseable index for further candidate selection:**

- **Mac Themes Garden** — <https://macthemes.garden/> — 2025 archive by Damien Erambert. Searchable, thumbnails, ~4,000 schemes. Useful for visually surveying the corpus before downloading. Notably, the site itself implements Platinum chrome in CSS — worth a look as a third-party reference for "how someone else solved the Platinum-in-CSS problem" (study only; not copied).

---

## Tooling status (verified 2026-05-16)

Available on this machine:

- `derez`, `DeRez`, `Rez` — Xcode Command Line Tools. Can decompile classic Mac resource forks to text. **This is the critical tool.**
- `xattr`, `file`, `lsbom` — standard macOS.
- `hfsutils` — installed via Homebrew. Useful for reading HFS disk images if a scheme ships as one.

Missing but installable:

- `unar` — `brew install unar`. Needed to unpack `.sit`, `.bin`, `.hqx` archives that preserve resource forks. **Install before the first download.**
- `rsrcfork` Python library — `pip3 install rsrcfork`. Modern Python parser for Mac resource forks; better for scripted analysis than `derez`. Install if we want to automate the inventory step.

No emulator required for the spike itself — we can extract resource structure without running classic Mac OS. SheepShaver + Mac OS 8.5 would only be needed if we wanted to *run* a scheme to capture its behavior, and screenshots from the web are plentiful enough that we can defer that.

---

## Deconstruction method

> **Tooling note (2026-05-16):** the raster extraction half of this pipeline is now mechanized — see [`tools/scheme-extractor/`](../tools/scheme-extractor/README.md). One CLI command takes a DeRez `.r` file and produces PNGs for every `cicn` and `ppat` resource plus a JSON manifest. The lib/ is browser-portable; the longer-term path is a web-based extractor.

For each candidate `.ksc`:

1. **Acquire.** Download from confirmed source. Note URL, mirror, and date of download in the inventory.
2. **Unpack** the archive format (`.sit` / `.bin` / `.hqx`) with `unar` into a working dir. Preserve resource forks (HFS+/APFS target).
3. **Inventory the resource fork** with `derez file.ksc > file.r`. Catalog every resource type present (`PICT`, `cicn`, `snd `, `STR#`, plus Kaleidoscope-specific types). Record counts per type.
4. **Cross-reference** the resource types against (a) Apple's Appearance Manager docs (Wayback) and (b) Kaleidoscope SDK / scheme-author docs (search Wayback for `kaleidoscope.net/developer`).
5. **Diff Tier 1 vs. Tier 2.** What resource types does the maximalist Tier 2 scheme contain that the conservative Tier 1 scheme doesn't? Those are the extension points our format should leave room for.
6. **Document** in a per-scheme markdown file under `docs/scheme-deconstruction/<scheme-name>.md`: resource inventory, provenance, license posture, what we learned. Each file is short — a table of resources + a paragraph of observations.

---

## Clean-room boundary

The discipline from PRD §North Star and LEARNINGS still binds. To make the seam unambiguous:

| Activity | OK / not OK |
|---|---|
| Extract and list resource type inventory from a scheme | OK — format learning |
| Read Apple's published Appearance Manager API docs | OK — public spec |
| Open scheme PICTs in a viewer to understand the visual vocabulary | OK — reference |
| Take notes on what categories of asset exist | OK — informs our format |
| Convert a scheme's `PICT` directly into a PNG we ship as Aaron UI artwork | **Not OK** — that's extraction-as-source. Re-author from observation. |
| Copy Kaleidoscope's resource type IDs into Aaron UI's bundle format verbatim | Soft no — match the *categories*, name them ours. Don't accidentally claim our format *is* the `.ksc` format. |
| Look at decompiled Mac OS Toolbox source | **Not OK** — same rule as PRD. |
| Look at Mac Themes Garden's Platinum CSS | OK to study as a third-party reference; do not copy. Cite if it informs a decision. |

When in doubt: **read for understanding, ship from screenshots and observation.**

---

## Success criteria for the spike

The spike is done when:

1. We have at least one Tier 1 scheme acquired locally, with resource fork inventory documented.
2. We have at least one Tier 2 scheme similarly documented.
3. `docs/THEME-FORMAT-REFERENCE.md` exists with a draft "Aaron UI web bundle format v0" derived from the Kaleidoscope scheme inventories + the published Kaleidoscope SDK documentation (Wayback).
4. `demo/platinum-static.html` exists and renders a recognizable Platinum window in a modern browser, sourced from HIG + public screenshots (independent of the scheme deconstruction — proves we can render Platinum from public references alone, which is the floor of what's possible).
5. A LEARNINGS entry captures any surprises from the deconstruction.

The spike does *not* need to ship working theme loading, runtime switching, or a JS WM. Those are Phase 1 and Phase 4 proper.

---

## Risks and open questions

- **Format docs availability.** Kaleidoscope's SDK and scheme-authoring docs lived on the now-defunct kaleidoscope.net; Wayback coverage is the fallback. Need to snapshot whatever we find locally because links rot. Action: when we find good docs, mirror them under `docs/external-references/` (with attribution + retrieval date).
- **Resource fork survival.** If `kaleidoscope_schemes.zip` was repackaged through a non-Mac filesystem at some point, individual `.ksc` files inside may have lost their resource forks. The `.sit` originals are safer. Test this on a single scheme before downloading the 650 MB bulk pack. *Confirmed working on `masswerk7le.sit` and `masswerk_dark_ergobox2.sit` — both preserved resource forks through unar extraction.*
- **License posture per scheme.** Many Kaleidoscope schemes shipped with a readme; many didn't. Tier 1 (mass:werk) has a known author still reachable; Tier 2 may not. Action: only port (extract assets + ship) from schemes whose authors had explicit "freeware, redistribute freely" terms. For schemes with vaguer or absent licenses, study privately but do not ship until rights are confirmed.

---

## Out of scope for this spike — and for the project

- Phase 1 WM core (drag, resize, z-order). Tracked separately in `README.md`.
- Toolchain bootstrap (Vite, TypeScript, tests). Tracked separately.
- **Apple `.afm` deconstruction. Out of scope entirely** — not deferred, dropped. The 2026-05-16 LEARNINGS entry "Apple themes dropped; Kaleidoscope is the corpus" records the decision; PRD updated to match. Apple's HIG remains valid public reference for re-authoring the default Platinum theme, but the `.afm` binaries themselves and the Hi-Tech / Drawing Board / Gizmo themes they contained are not part of Aaron UI's roadmap.
- Legal pass on theme reproductions. **Resolved** by dropping Apple themes: Kaleidoscope-corpus schemes with explicit freeware-with-redistribution readmes are the only material we port, with author attribution preserved.
