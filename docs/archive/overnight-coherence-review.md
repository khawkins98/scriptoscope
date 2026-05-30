# Overnight pass coherence review — 2026-05-30

A citation-coherence pass across the 30+ commits + 8 new spec docs that landed
during the 2026-05-29/30 overnight window. **Not** a re-decode — the goal is to
catch internal inconsistencies, broken cross-references, unmarked supersessions,
and stale slug/address citations.

**Scope.** Every doc under `docs/spec/`, plus `CLAUDE.md`, `LEARNINGS.md`, and
the runtime files touched by the overnight commits (`src/wndCascade.ts`,
`src/renderWindow.ts`).

**Method.**
1. Cross-grep the four "high-risk" identifiers the user flagged: `0x118b8`/
   `0x116f8` (cinf consumer address), `collapsed-side-utility` vs
   `collapsed-side-floating-utility-window` (slug naming), `kThemeWidget*`
   enum values (3/4/5 ghosts), `-3790` role label.
2. Cross-reference every `docs/spec/<name>.md` mention against `ls docs/spec/`.
3. Spot-check `kdef-faithfulness-ledger.md` rows for asm address + file:line +
   "why we diverge" all present.
4. Spot-check the 6+ new docs for asm-address citations on every "the kDEF does
   X" claim.

---

## Findings

### Clean: cinf consumer address (`0x116f8` vs `0x118b8`)

The two-address correction has been **fully reconciled across all three docs**:

- `kdef-binary-inventory.md` § 2 now ends with: *"The cinf consumer is `0x116f8`
  (see §3), **NOT** slot 3 `0x118b8` — slot 3 loads `'wnd#'`, not `'cinf'`."*
- `kdef-binary-inventory.md` § 3 cites `0x1171a` (the call site) and `0x116f8`
  (the routine).
- `kdef-service-handlers.md` slot 3 row says: *"This is **NOT the cinf consumer**
  (that's `0x116f8`, see `kdef231-reference.md §1.6`)."* — plus an explicit
  "corrects `kdef-binary-inventory.md §2`" note.
- `cinf-extended-decode.md` opens by calling out the `0x118b8` shorthand
  confusion and lists six caller sites of `0x116f8`.
- `kdef231-reference.md` § 1.6 + § 3.5 use `0x116f8` correctly.

**No action.**

### Clean: ThemeWidget enum (0/1/2/6, no phantom 3/4/5)

The earlier-pass correction (commit 6f53e2b) holds across the corpus.
`apple-primary-source.md`, `proxy-icon-modified-dot.md`, and
`apple-drawtheme-decode.md` all enumerate `{0: CloseBox, 1: ZoomBox,
2: CollapseBox, 6: DirtyCloseBox}` consistently. `proxy-icon-modified-dot.md`
explicitly calls out *"Values 3, 4, 5 do not exist."*

**No action.**

### Clean: `-3790` role label (Snap-To-Grid, not volume-icon)

Volume-icon mentions are gone from the runtime + scene-codex + spec tree.
Every `-3790` reference in `docs/scene-codex.md`, `docs/scene-slot-spec.md`,
`docs/spec/apple-primary-source.md`, `docs/spec/kdef231-reference.md`,
`docs/spec/kaleidoscope-author-docs.md`, `docs/spec/corpus-corroborated-ids.md`
labels it Snap-To-Grid / Finder header badge. The historical mis-label is
preserved as retraction-aware prose where it appears (e.g.
`scene-slot-spec.md` line 65 *"The historical mis-label as 'volume-icon' was
a two-month assumption…"*) — which matches the LEARNINGS rule.

**No action.**

### Fix (landed): collapsed-utility slug short forms

Commit `64063fa` harmonized the runtime slug names to the **long** form
(`collapsed-side-floating-utility-window`, `collapsed-titled-utility-window`,
`collapsed-no-title-utility-window`) — but five sites still cited the **short**
form in comments / docstrings / table cells:

| Site | Stale form | Fixed in this review |
|---|---|---|
| `docs/spec/kdef231-reference.md` table § 3.4.1 (rows -14300, -14292, -14284) | short | long |
| `src/wndCascade.ts` comment lines 47–51 (cascade ladder) | short | long |
| `src/wndCascade.ts` line 143 `@example` docstring | short | long |
| `src/renderWindow.ts` lines 776–778 comment | short | long |
| `src/wndCascade.test.mjs` lines 34, 39 test descriptions | short | long |

None of these were behaviour-affecting — the actual `CANONICAL_ID_TO_SLUG`
map + the test assertions use the long form — but they made the slug naming
read inconsistently across the tree. Fixed in this commit.

### Fix (landed): README index missed 3 new docs

`docs/spec/README.md` (the index that landed in `604d958`) did not list
three docs that landed AFTER it:

- `kdef-service-handlers.md` (commit `52c2c3c`) — added under "Kaleidoscope
  binary primary sources" with a one-line summary.
- `scheme-factory-vs-corpus.md` (part of `a4d316d`) — added under "Per-concern
  decodes".
- `codebase-vs-primary-sources-audit.md` (older, but never indexed) — added
  under "Per-concern decodes".

### Fix (landed): CLAUDE.md missed the README index pointer

`CLAUDE.md`'s "Pointers into `docs/`" enumerates individual spec docs but
didn't reference the `docs/spec/README.md` index itself. Added at the top of
the list, with a one-line description of the citation chain.

### Clean: faithfulness ledger

Every row in `kdef-faithfulness-ledger.md` carries (a) a kDEF asm address
(`0x49d6` / `0x4a0c` / `0x4f58` / `0x5178` / etc.), (b) a runtime location
(`src/composeChrome.ts` distributor / `src/controls.ts:1034-1057`), and
(c) "why we diverge" reasoning. The three new 2026-05-29 entries (scroll-arrow
mapping, segmented On/Off, proxy-icon + modified-dot) all cite both asm
addresses + ownership decisions.

**No action.**

### Clean: cross-references (zero broken links)

Mechanical check: grep for `docs/spec/<name>.md` across `docs/`, `src/`,
`CLAUDE.md`, and `LEARNINGS.md`; diff against `ls docs/spec/`. **Zero
references point at a non-existent file.** Some docs are referenced only via
relative path (`./platinum-theme-provider-decode.md` from `apple-drawtheme-
decode.md` and `README.md`) — those resolve correctly.

The docs that are NOT referenced anywhere besides the README index are:
`apple-cdef-geometry.md`, `glitch-punchlist.md`, `scene-slot-ground-truth.json`.
That's fine — they're end-of-chain artefacts (audit outputs / TODO lists), not
links in a chain.

### Clean: scheme-factory docs have zero asm citations (expected)

`scheme-factory-vocabulary.md` and `scheme-factory-vs-corpus.md` have no asm
citations — confirmed by grep. **Expected**: their primary source is the
**Scheme Factory 1.0pr2 resource fork** (STR# 128/129/130/135/136), parsed via
`parseResourceFork.js`, not the kDEF asm. The citation chain is documented in
the headers + cross-refs to `corpus-corroborated-ids.md` and Scheme Factory
sources.

### Clean: unmarked supersession check

Searched `docs/spec/` for sections that newer docs have contradicted but the
original hasn't been annotated. None found — the corrected entries (cinf
consumer address, ThemeWidget enum, `-3790` role) all carry explicit
"corrects X" / "historical mis-label" / retraction notes per the LEARNINGS
"mark superseded entries" rule.

`platinum-theme-provider-decode.md` SUPERSEDES the assumption in
`apple-appearancelib-spike.md` that DrawThemeButton lives in a separate
`Platinum Engine` PEF — but the spike doc already presented its finding as
in-progress ("the May 2026 spike that opened the AppearanceLib decode"), so
no retraction needed; the README index correctly points to the newer doc as
the primary.

---

## Summary

| Class | Findings | Landed in this commit |
|---|---:|---:|
| Clean (no action) | 6 | — |
| Fixed (stale slug citations) | 5 sites | 5 |
| Fixed (README index gaps) | 3 docs | 3 |
| Fixed (CLAUDE.md pointer) | 1 line | 1 |
| **Total** | **15** | **9 fixes + 0 deferred** |

No substantive parked issues. The overnight pass landed coherent — every
"the kDEF does X" claim has an asm address, every newly-corrected fact
(cinf consumer, ThemeWidget, `-3790`) is reflected in every doc that mentions
it, and every cross-reference resolves to a real file. The drift was
exclusively in human-readable comment + table-cell text that hadn't been
swept after the `64063fa` slug rename + the `604d958` index addition.

Verified by `npm run gates` (typecheck + test + audit:scenes --check) after
the fix commit.
