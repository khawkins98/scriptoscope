# `docs/spec/` index

The standing primary-source references for the Kaleidoscope kDEF model. The tree is dense; this index groups docs by **source layer** to make navigation cheap.

The **citation chain** (highest authority first):

```
corpus-corroborated-ids.md   (n author labels)         ← bundle authors
   ↓
scheme-factory-vocabulary.md (official editor)         ← canonical roles
   ↓
apple-primary-source.md      (Apple enums)             ← Apple role pegs
   ↓
apple-drawtheme-decode.md    (Apple System decode)     ← Apple implementation
   ↓
kaleidoscope-author-docs.md  (Wayback community)       ← period docs
   ↓
kdef231-reference.md         (2.3.1 binary)            ← runtime model
   ↓
kdef182-disassembly-findings.md (1.8.2 binary)         ← cross-engine
   ↓
kdef-binary-inventory.md     (1.8.2 + 2.3.1 extraction recipe)
```

---

## Bundle-side primary sources (what authors typed + what the editor exposes)

| Doc | What it is | Generator |
|---|---|---|
| **`corpus-corroborated-ids.md`** | Cross-theme consensus from 6,842 author-supplied NAMED labels across 17 of 18 bundles. **The primary source for "what role does id X play".** | `scripts/dump-author-hints.mjs` |
| **`scheme-factory-vocabulary.md`** | Master catalogue extracted from Scheme Factory 1.0pr2 (the OFFICIAL editor): STR# 128 (127 role names), STR# 130 (24 part-codes), STR# 129 (7 widget slots), STR# 135 (9 cinf properties), STR# 136 (5 Scheme Info flags), MENU 134/137. | Wayback Machine ← unar ← xattr ← parseResourceFork |
| `kaleidoscope-author-docs.md` | Surviving Wayback URLs for the Companion + FAQ + Calyxa tutorial — period community docs. | Manual + WebFetch |

## Apple primary sources (the role pegs Kaleidoscope was authored against)

| Doc | What it is | Source |
|---|---|---|
| **`apple-primary-source.md`** | Apple's `Appearance.h` / `IconsCore.h` / `MacWindows.h` / `Controls.h` enum tables: ThemeBrush (44 slots), ThemeTextColor (47 slots), ThemeWidget, ThemeWindowType, Apple Finder system icons (-3968..-4000). | phracker/MacOSX-SDKs + elliotnunn/UniversalInterfaces |
| **`apple-drawtheme-decode.md`** | Apple's AppearanceLib decompile. DrawTheme* API is a uniform vtable dispatch on a theme-provider object. Vtable offsets pinned (+0xCC button, +0xBC window-frame, +0xC0 title widget, +0x64 track, +0x30 text-color, +0x2C brush). | `.scratch/iso-recon/` PEF decompressor + capstone PPC disassembly |
| `apple-appearancelib-spike.md` | The May 2026 spike that opened the AppearanceLib decode (`DrawThemeButton` TVector @ 0x2EE4 → vtable +0xCC dispatcher). | `.scratch/iso-recon/` |
| `apple-cdef-geometry.md` | Apple CDEF -63 (track/scrollbar family) decode. | `.scratch/iso-recon/code-out/CDEF-n63.asm` |
| `apple-cdef-button-geometry.md` | Apple CDEF -1 (also track family — **NOT** the button CDEF). | `.scratch/iso-recon/code-out/CDEF-n1.asm` |
| `apple-cdef-button-vs-our-compose.md` | Audit: our `composeButton` against the (absent) Apple button CDEF. 5 audit rows Open Apple-side. | Cross-reference |

## Kaleidoscope binary primary sources

| Doc | What it is | Source binary |
|---|---|---|
| **`kdef231-reference.md`** | THE standing reference. Every routine address, every resource id, every struct offset, every coordinate mapping for the 2.3.1 binary. First stop for "where is X?". | `/tmp/kaleido-trace/kDEF231_0.bin` (re-extractable via `.scratch/dump-kaleido-cdev.mjs`) |
| `kdef-binary-inventory.md` | The extraction recipe + 2.3.1 architectural findings (35-entry message dispatch, wnd# fallback ladder at 0x356c..0x367e, FourCC vocabulary, 17 new AppearanceLib calls in 2.3.1). | `.scratch/k{182,231}-kdef/` |
| `kdef182-disassembly-findings.md` | May 2026 1.8.2 binary archaeology pass. Structural facts (QuickDraw + CopyBits, kDEF themes surroundings + Appearance Mgr draws controls, 4 hardcoded `_GetResource` calls). | Same |
| `kdef-architecture.md` | The "how does it work?" tour for new contributors. | Synthesis |
| `kdef231-recipe-walk.md` | The decoded recipe walk — the TRUTH source for part-code edges. | Same as kdef231-reference.md |
| `kdef-faithfulness-ledger.md` | Every deliberate divergence from the binary, with owner-approved intent. The accountability mechanism. | Manual |

## Per-concern decodes (deep dives)

| Doc | What it is |
|---|---|
| `cinf-resize-behavior.md` | The "15-value resizeBehavior" was a category error: byte[2] (Tile Sides, boolean) + byte[3] (Pattern Anchor, 5-way switch) are two independent fields. Decoded at `0x10bc6` / `0x109be` / `0x10ab2`. |
| `platinum-controls-decode.md` | Decode of Apple's WDEF 125 (Platinum) for the procedural baseline. |
| `platinum-wdef125-decode.md` | Same. WDEF 125 specifically. |
| `platinum-controls-faithfulness-ledger.md` | Companion ledger for the Platinum decode. |
| `compositor-spec.md` | The runtime model the kDEF replays. The consumer of `kdef231-reference.md` §4. |
| `glitch-punchlist.md` | A standing list of visual glitches per theme. |
| `golden-reference-todo.md` | TODO items against the reference images. |

---

## How to use this tree

When you ask "what does id X / field Y / address Z mean?":

1. **`corpus-corroborated-ids.md`** — start here. Grep for the id; if the corpus author-labeled it, you have the primary answer.
2. **`scheme-factory-vocabulary.md`** — the canonical role names the corpus paraphrases.
3. **`apple-primary-source.md`** — the role peg the Kaleidoscope id maps to.
4. **`kdef231-reference.md`** — for the runtime / binary side ("where is the dispatch at?").
5. **`kdef-faithfulness-ledger.md`** — if our runtime diverges from the answer; this records WHY.

When you find a gap, the order is:
- Refresh the corpus aggregate (`node scripts/dump-author-hints.mjs`).
- Re-extract a Kaleidoscope or Apple binary if needed (`.scratch/dump-kaleido-cdev.mjs`, `.scratch/iso-recon/pef-locate.py`).
- Add a per-concern doc under `docs/spec/` (deep dive).
- Link it from this index.

---

## Tooling

- `tools/sit-wasm/` — StuffIt decoder (in-tree WASM).
- `tools/theme-loader/` — `parseResourceFork.js` + `loadKaleidoscopeScheme.js` + the pure decoders.
- `scripts/dump-author-hints.mjs` — corpus aggregator → `corpus-corroborated-ids.md`.
- `scripts/probe-reference-slot.mjs` — per-slot pixel-match against bundle reference PNGs.
- `scripts/scene-coverage-audit.mjs` — codex audit → `scene-codex.md`.
- `.scratch/iso-recon/` — Apple System file decompile artifacts (gitignored, reproducible).
- `.scratch/dump-kaleido-cdev.mjs` — Kaleidoscope binary extractor.
- `.scratch/iso-recon/pef-locate.py`, `pef-decompress.py`, `decode-drawtheme.py`, `decode-dispatch.py` — PEF tooling.
