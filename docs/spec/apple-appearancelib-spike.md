# AppearanceLib spike findings (Task 4 — the gate)

*Clean-room. All offsets are into the Mac OS 8.5 System file (its local path is in the evidence appendix).
Recorded for understanding; no Apple listing reproduced.*

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/apple-appearancelib-spike.evidence.md`](engine/apple-appearancelib-spike.evidence.md) — spec writers and verifiers only.*

## Tooling (solved)
- A raw-PPC disassembler was set up for this spike; the toolchain and reproduce
  command are recorded in the evidence appendix (spec writers and verifiers only).
- PEF container/section/loader/export parsing written + working (`pef-locate.py`).
  Note: PEF loader-string names are **not null-terminated**; lengths come from the
  export key table (`key >> 16`). Naive null-scan reads names run together.

## What was located (high confidence)
- The System file is many concatenated PPC PEF (`Joy!peff`/`pwpc`) containers.
  Relevant ones found by parsing each container's loader/export tables:
  - **ControlsLib** @ container 1903232 — exports the Control Manager
    (`__NewControl`, `__DrawControls`, `__TrackControl`, …). It **imports**
    `DrawThemeButton` (that's why the string sits in its loader table) — i.e. the
    CDEFs/Control Manager **call into** AppearanceLib. Confirms the delegation.
  - **AppearanceLib** @ container **2428848**. Sections:
    - sec 0 **code**, 261812 B, **uncompressed**, fileOff 2443792.
    - sec 1 **patternData**, packed 39053 → unpacked 50092 (**COMPRESSED**), fileOff 2705616.
    - sec 2 loader, fileOff 2428976.
    Exports 32 `DrawTheme*` here (`DrawThemeTrack`, `DrawThemeTitleBarWidget`,
    `DrawThemeTrackTickMarks`, `DrawThemePrimaryGroup`, `DrawThemeGenericWell`, …);
    the full ~57 are split across this + adjacent containers.

## The remaining layer (the cost)
- `DrawThemeButton`'s export is a **TVector** at data-section offset 3276
  (secIdx=1 = the **compressed** patternData section). Reaching the actual code:
  1. Implement PEF **pattern-init decompression** (opcodes: zero / blockCopy /
     repeatedBlock / interleave×2) to materialize the data section.
  2. Read the 8-byte TVector → `codeAddr` (offset into the 261812 B code section).
  3. Trace the push-button path from there through
     its helper chain to pin bevel insets / gray slots / gradient.
- So: feasible and fully mapped, but each routine = decompress + TVector deref +
  PPC RE across a 256 KB lib with helper chains, **per control kind**.

## Cross-finding (from T2) that changes scope
- `CDEF-n63` is **only** the track/thumb family (scrollbar/slider/indicator).
  Buttons/checkbox/radio/popup/tab geometry is in a **separate** CDEF
  (`CDEF-n1`, 3172 B), not yet decoded. So full geometry needs a second CDEF pass
  regardless of the drawing-model decision.

## GATE VERDICT: **FALLBACK** (recommended; owner to confirm — they chose purist)
Rationale, evidence-based:
- The AppearanceLib PPC decode is **proven feasible** (container + exports + code
  section located; tooling works; only the pattern-decompression layer remains),
  but its cost is now clearly **high and open-ended** (decompress + per-routine PPC
  RE × each kind), and the API is split across containers.
- The **data + model path is independently sufficient** for Platinum's restrained
  gray controls: `themes/apple-platinum-replica/sources/platinum-palette.json`
  (verified: 15 cctb slots incl. the genuine lavender/indigo highlight, 21 accents,
  256-colour palette) + the already-implemented **WDEF-125 raised-bevel model**
  (same theme) + **CDEF geometry** (n63 done; n1 to decode).
- Marginal fidelity of the PPC decode over that path = exact gradient/bevel nuance,
  largely covered by the bevel model + extracted grays.

## Calibration (decoded DrawThemeButton once, per "calibrate then fallback")
PEF pattern-data decompressor implemented (`pef-decompress.py`, 5 opcodes) →
decompressed AppearanceLib sec 1 (50092 B exact) → DrawThemeButton TVector @ data
offset 3276 → codeAddr 0x2ee4 (code fileOff 2455796). Disassembled clean PPC:
- Signature confirmed: `DrawThemeButton(rect, kind, drawInfo, prevInfo, eraseProc, labelProc, userData)` (seven arguments, all retained for the call).
- Validates: null rect → ret -50 (paramErr); null drawInfo → -50. Reads the drawInfo state halfword at `+6` and tests it against mask 5.
- **It is a THIN DISPATCHER, not the drawer:** fetches the current theme object
  (through imported glue at `0x18618`), loads that object's vtable and calls the
  method at offset 0xCC —
  i.e. dispatches to a **vtable method at offset 0xCC** on the theme-provider object.
- **Architectural validation of FALLBACK:** Apple separates theme DATA from a
  generic DRAWER (OO theme-provider). The concrete Platinum button pixels are one
  more vtable-indirection deep (+0xCC method + its helpers). Our fallback (extracted
  cctb/accent DATA + a generic bevel DRAWER reimplementing the model) mirrors Apple's
  own structure — so it is faithful in architecture, not just appearance.
- Stopped here (bounded calibration); following the +0xCC method is the open-ended
  path the gate decision declined. Documented for optional surgical decode later.

**Recommendation:** Phase-B = procedural control generator from CDEF geometry
(n63 + n1) + `platinum-palette.json` + WDEF bevel model. Keep AppearanceLib decode
as an **optional, surgical** fidelity-tightening step for any control that looks
wrong — the method + container + the one remaining layer are documented here, so a
single routine can be decoded on demand later without re-discovery.
