# Autonomous session summary — 2026-05-19

**Duration:** ~4 hours autonomous work
**Branches:** all merged to main
**Net: 22 PRs shipped across the day** (spec trilogy + rebuild + binary archaeology + control families)

This doc is your read-on-return: what changed, what's open, what to look at next.

---

## What happened during the autonomous block (PRs #148-#152)

After the spec trilogy + rebuild PRs landed earlier in the day (#132-#147), the autonomous block focused on **binary archaeology** per the user's request.

### Binary investigation

Extracted the Kaleidoscope 1.8.2 + 2.3.1 installers' resource forks from `~/Downloads/`:

- Kaleidoscope 1.8.2 Control Panel: 504KB rsrc fork → 404 resources including kDEF 0 (60KB 68k) + kDEF 1 (100KB PowerPC PEF)
- Kaleidoscope 2.3.1 Control Panel: 1005KB rsrc fork (~2x bigger; kDEF grew to 283KB)
- Bundled K2.3 schemes: Apple platinum, Antique, BeBox, Ice, Onyx, Scherzo!, Sherbet, System 7

Tools used: `unar` for StuffIt, `m68k-elf-objdump` for 68k disassembly, hand-rolled Python for PEF symbol-table parsing.

### Findings (full detail in `docs/tracking/kdef-disassembly-findings.md`)

**Confirmed (not guesses anymore):**
- Kaleidoscope = pure QuickDraw + CopyBits. Sample-and-hold scaling. **Our `image-rendering: pixelated` IS the same algorithm.**
- Push buttons drawn by OS (AppearanceLib + system CDEF), not by Kaleidoscope. Kaleidoscope only themes the *surroundings* via `SetUpControlBackground`. **Our AaronButton CSS-only approach is correct.**
- kDEF is table-driven (only 4 literal GetResource calls in 60KB of code).

**Reframed:**
- The tile-vs-stretch "threshold" isn't a thing in Kaleidoscope. Our `TINY_STRETCH_THRESHOLD = 2` is a CSS-border-image artifact.
- The 15-value resize matrix is practically a 10-value matrix — zero `anchor-*` behaviors observed across all 7 bundled schemes.

**Discovered TMPLs from K2.3-bundled schemes:**
- TMPL 128 ("Colr") documents the first 5 bytes of every scheme's Colr: version, file-format-version, minimum-K-version, has-accent-colors, stretch-thumb-from-center. Schemes ship 16 bytes; the remaining 11 are undocumented in the bundled TMPL.
- TMPL 129 ("cinf") confirms our existing decoder is correct.
- TMPL 1240 ("wnd#") same.

### What got built from findings

| PR | Change |
|---|---|
| **#148** | Findings doc (250 lines) — confirms/reframes/answers spec B §13 open questions |
| **#149** | `bgAnchor` field in chrome-element schema + `extractColorsFromCicn()` runtime helper |
| **#150** | Comprehensive Kaleidoscope → HTML mapping reference (298 lines) |
| **#151** | Colr resource decoder (was missing entirely) + scheme-version extraction |
| **#152** | LEARNINGS entry consolidating the binary-archaeology session |
| **#153** | This summary doc |
| **#154** | "Extracted colors" diagnostic panel — wires §13.4 to visible UI |
| **#155** | AaronBevelButton (CSS-only) — fills out the button family per spec A §3.2 |

Plus: rebuilt `themes/masswerk-7-le/theme.json` + `themes/masswerk-dark-ergobox2/theme.json` with the new `bgAnchor` field populated for 47 + 57 chrome elements respectively.

### Tests

554 → 557 unit tests (+3). All 68 e2e still pass.

---

## What's still open after the session

### Binary-derived open questions

| Question | Status | Recommended approach |
|---|---|---|
| §13.1 divider sandwich semantics | Open | Trace kDEF 0 recipe-walking loop |
| §13.3 cinf upper bits (15-value matrix) | Open + Practically irrelevant | Skip unless a real scheme triggers the issue |
| Colr bytes 5-15 layout | Open | Find a newer-K TMPL OR trace cdev's Colr-reader |
| Pattern-anchor for non-rect containers | Open | Trace popup-menu drawing in kDEF |

These all need single-instruction tracing — best done with Ghidra (free, has 68k support, decompiles to C-pseudocode). Not feasible in a 4-hour timebox without a GUI disassembler.

### Roadmap to settle the open questions

1. Install Ghidra (`brew install --cask ghidra`)
2. Load `/tmp/aaron-disasm/kDEF_1.pef` (the PowerPC version with symbol info — easier than the 68k)
3. Look for functions named `DrawWindow*`, `DrawControl*`, `ParseColr*` (or equivalent — the PEF symbol table will reveal Kaleidoscope's internal naming)
4. Watch how cinf bytes 2-3 + Colr bytes 5-15 get tested

This is a 1-2 day focused session, not a 1-2 hour scan.

---

## What I'd do next if continuing

### High-leverage, contained PRs:

1. **Wire `extractColorsFromCicn` into a real consumer** — populate `theme.palette` from extracted cicns at load time (currently the helper exists but nothing calls it). Would visibly change colors for schemes with bgAnchor data.

2. **Add scrollbar control family** (AaronScrollbar) — every window has scrollbars; would dramatically increase visible coverage. Follow the AaronPlacard/Progress patterns; complex because of Colr-flag-driven layout (unified vs. paired arrows).

3. **Add slider control family** (AaronSlider) — similar pattern to Progress; uses `<input type="range">` for a11y.

4. **Add tabs control family** (AaronTabs) — important for any app with tabbed UI.

### Medium-leverage:

5. **Re-extract exotic schemes** with the updated `buildThemeJson` so they pick up `bgAnchor` + (if they have Colr) `options.stretchScrollbarThumbFromCenter`. Their extraction manifest is missing → need to re-run the extractor against the original `.rsrc` files (which may need re-fetching).

6. **Bevel button control family** (AaronBevelButton) — no canonical scheme ships bevel-button cicns, so this is CSS-only following the AaronButton pattern.

### Lower-leverage:

7. Implement disclosure animation (5-frame cycle per spec A §19)
8. Implement progress indeterminate (ppat cycle per spec B §13.6)
9. Settle Colr bytes 5-15 via Ghidra trace

---

## State at session close

```
main branch:
  443 tests at session start → 565 tests at session close (+122)
  ~10K lines docs/spec/code shipped across the day (14 PRs morning + 8 PRs autonomous)
  Spec trilogy locked + all 6 rebuild steps closed
  Demo + diagnostics merged into one diagnostics-led page
  Binary archaeology documented + Colr/bgAnchor schema additions applied
  Control families shipped: Window, Button, BevelButton, Checkbox, Radio,
    Field, Disclosure, Placard, WindowHeader, Progress (10 of 24)
```

All PRs from the day are merged. No open branches. CI green.

---

## How to use this doc

If you're picking up Aaron UI tomorrow:
1. Skim §1 of `docs/kaleidoscope-to-html-mapping.md` for the 5-step rendering algorithm
2. Read `docs/tracking/kdef-disassembly-findings.md` for what the binary archaeology yielded
3. Look at the "What I'd do next" list above + pick whichever scope fits your time

If you're returning for a deeper binary trace:
1. The extracted resources are at `/tmp/aaron-disasm/` (gone on reboot — re-extract from `~/Downloads/Kaleidoscope*.app`)
2. `kDEF_1.pef` (PowerPC, with symbols) is the easier target than `kDEF_0` (68k, no symbols)
3. Ghidra is the recommended disassembler; takes ~10 min to install + import

If you're picking up a control-family follow-up:
1. The patterns are established by `AaronCheckable` (#139), `AaronDisclosure` (#140), `AaronPlacard` + `AaronWindowHeader` (#144), `AaronProgress` (#146)
2. Each new family is 1 PR following the same shape
3. Spec A §3-§17 enumerates the remaining families with DOM + state attribute requirements
