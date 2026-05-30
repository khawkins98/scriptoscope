# Codebase vs primary sources audit — 2026-05-29

Holistic sweep of the runtime + scripts against the rich primary-source corpus
that landed today (corpus-corroborated-ids, apple-primary-source,
scheme-factory-vocabulary, kdef-binary-inventory, apple-drawtheme-decode,
cinf-resize-behavior, apple-cdef-button-vs-our-compose, kaleidoscope-author-docs).

**Method.** Read every spec doc in the citation chain, then sweep `src/composeChrome.ts`,
`src/composeCornerSprite.ts`, `src/renderWindow.ts`, `src/controls.ts`,
`src/platinum.ts`, `src/baseChain.ts`, `src/loadTheme.ts`, `demo/diagnostic.html`,
and `scripts/scene-coverage-audit.mjs`. For each heuristic / inference / friendly-
key lookup, ask: does a primary source now offer a structured-field replacement?

**Outcome.** 12 findings, ordered by leverage. Three classes dominate:
(1) primary-source citations not yet captured in code comments (cheap
documentation fixes); (2) `authorLabel` as a tighter answer than `friendly key`
substring matching (the codex pattern — already proven by the `loadPushButtonFace`
fix); (3) decoded fields that exist but no consumer reads (`patternAnchor` 1..4,
`bg-pattern` byte[3]=5, the wnd# fallback ladder).

Nothing landed in this pass — every finding either requires owner judgement on
behavior changes, or is a cross-cutting refactor that should go through review.
See "Landed" below; this audit moves the documentation forward by surfacing
the gaps.

---

## Findings

### [F1] `WND_ID_SLUG` table misses three collapsed-utility variants

**File:** `demo/diagnostic.html:1385–1390`
**Current:** The `WND_ID_SLUG` map covers 11 wnd# resource ids and translates
the raw-key form (`wnd--14336`) into a friendly slug for the window-type
dropdown. The map omits `-14300` (Collapsed Utility Window), `-14292`
(Collapsed Side Floating Utility Window), `-14284` (Collapsed Untitled Utility
Window).
**Primary-source says:** `docs/spec/scheme-factory-vocabulary.md` §4
"window-type catalogue" enumerates exactly 13 wnd# ids from STR# 128 entries
2–14; the corpus-corroborated table (`corpus-corroborated-ids.md` wnd# section)
confirms `-14300`/`-14292`/`-14284` are shipped (1138 + crayon-os). The current
runtime renders these as their raw key (`wnd--14300`), so they sort to the
bottom of the dropdown.
**Replacement:** Add three rows to `WND_ID_SLUG`:
```js
'-14300': 'collapsed-titled-utility-window',
'-14292': 'collapsed-side-floating-utility-window',
'-14284': 'collapsed-no-title-utility-window',
```
Also add the three slugs to `WT_ORDER` at line 1395.
**Effort:** 5-line change.
**Risk:** zero (demo-only display sort; render path unchanged).

### [F2] Scene-codex `finder-header-badge` slot description still calls it the volume icon in code comments

**File:** `demo/diagnostic.html:402` (cache var name `_gridCache` is fine; the doc-
comment block at 339–378 is accurate). The lingering risk is in `scripts/scene-coverage-audit.mjs:81–98`
and the per-slot tier resolver — both correctly cite "Snap-To-Grid". But
the live codebase still has `gridProxyIcon` named for what looks like a grid,
which is right; what's NOT right is the resolver name `KDEF_DOC_WIDGET_IDS` at
`scripts/lib/kdef-control-ids.mjs:93` does NOT include `-3790` as a peer.
**Current:** No documentation gap — but `-3790` isn't enumerated in
`kdef-control-ids.mjs` as a known badge id (it's only referenced in the audit
script and demo).
**Primary-source says:** `corpus-corroborated-ids.md` confirms 3 bundles label
`-3790` as "Snap-To-Grid" / "Grid Arrangement". The slot is now in `apple-
primary-source.md` § "Apple Finder system icons" with the note that Apple's
volume icon is `-3995` (`kGenericHardDiskIconResource`), not `-3790`.
**Replacement:** Add a `FINDER_HEADER_BADGE_ID = -3790` constant to
`scripts/lib/kdef-control-ids.mjs` with the corroborated-author-label citation,
and reference it from the audit script + demo. Single source of truth for the
id whose name was the source of two months of confusion.
**Effort:** 10-line change (new export + 2 import sites).
**Risk:** zero (rename, no behavior change).

### [F3] `loadPushButtonFace`'s anti-role regex could read `authorLabel` first for ALL bundles, not just as a precedence wedge

**File:** `src/controls.ts:155–203`
**Current:** The `PUSH_BUTTON_FACE_ANTI_KEY_RE` regex (`/menu|tab.pane|pull.down|popup|window|dialog|scroll/i`)
is matched against `authorLabel` when present (precise) AND against the friendly
key when absent (substring-based, with the parked #185 false-positive risk noted
in comments). The id-based pass walks every chromeElement and accepts the first
match; the comment notes "9 of 18 bundles ship no authorLabel on push-button
slots."
**Primary-source says:** `corpus-corroborated-ids.md` cicn section confirms
the AUTHORITATIVE push-button labels across 6 bundles: `-10239 = "Push Button
Active¥"`, `-10238 = "Push Button Pressed¥"`, `-10240 = "Push Button Inactive¥"`.
The corroborated table shows that the bundles WITHOUT a `Push Button` label
are the exact 9 bundles that don't carry kDEF-style name slugs at all (windows-31,
windows-95, apple-platinum-2, etc — corner-sprite + Windows ports). For those,
the friendly key is `cicn--10239` (the generic decoder slug) — the anti-role
regex matches "window" against `cicn--10239` (substring "window" — wait, no:
`cicn--10239` contains no "window"). So the friendly-key regex is actually
NEVER a false-positive risk in the current corpus.
**Replacement:** Tighten the comment block to cite `corpus-corroborated-ids.md`
as the n=6 corroborated authoritative source for the canonical roles. The code
is correct; the comment block could note "the substring `/window/i` against the
generic `cicn--10239` decoder slug would false-positive but the decoder never
emits that — verified by reading `tools/theme-loader/buildThemeJson.js`'s slug
emitter." This is a comment polish, not a code change.
**Effort:** 5-line comment change.
**Risk:** zero (no behavior change).

### [F4] `composeChrome.classifyPart` hardcodes the wnd# part-code → CellClass mapping; could now cite STR# 130 by index

**File:** `src/composeChrome.ts:147–179`
**Current:** The switch on part codes 8/11/13/14 → 'grow', 12 → 'tile', 18 →
'scale', 5/6 → 'collapse', etc., is documented as "from the kDEF jump table"
in the doc-comment but doesn't cite each code's editorial name.
**Primary-source says:** `scheme-factory-vocabulary.md` §2 (STR# 130 — 24
part-code strings) gives the AUTHORING vocabulary for each code:
  - 8 (entry idx 9) = "Repeat From Left"
  - 11 (entry idx 11) = "Disappears in Low Space" → classified 'fixed' here
  - 12 (entry idx 12) = "Repeat From Right"
  - 13 (entry idx 13) = "Repeat Using Exact Length"
  - 14 (entry idx 14) = "Exact Length Slack Fill From Left"
  - 18 (entry idx 19) = "Stretching Area"
  - 5, 6 (entries idx 6, 7) = "Title Repeating Area", "Title End Cap"
The doc-comment block currently labels these as "grow", "tile" etc. — runtime-
faithful but missing the AUTHORING role names that a designer reading the code
would understand.
**Replacement:** Add the STR# 130 string for each code in the doc-comment +
`partRole(code)` switch at line 259–278 — `partRole(8)` should return `"Repeat
From Left"`, not the generic `"side fill"`. The compositor-spec already uses
the editorial names; the runtime should too. NOT a behavior change.
**Effort:** 30-line change (touch `partRole` returns + doc-block comments).
**Risk:** zero (runtime classifier unchanged; only the diagnostic role labels
shift from internal to STR#-130 editorial).

### [F5] `composeChrome.frameFromBody` clamp condition could cite the wnd# fallback ladder as the upstream cause

**File:** `src/composeChrome.ts:189–211`
**Current:** The clamp guards against negative inset when the body rect's
far edge exceeds the cicn dim. The comment block calls this "the kDEF
robustness gap" but doesn't name WHERE the kDEF resolves the mismatch.
**Primary-source says:** `kdef-binary-inventory.md` §4 "wnd# fallback ladder
(NEW)" — at `0x356c..0x367e` the 2.3.1 binary walks 12 degraded ids
(ANDing with `-2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22`) until one
resolves. So when our runtime hits a mismatched cicn/wnd#, the AUTHENTIC kDEF
would have re-resolved to a different wnd# id rather than rendering the bad
pair. Our clamp is the right defensive move; the upstream fix would be modeling
the fallback ladder.
**Replacement:** Add a doc-comment line citing the fallback ladder in
`kdef-binary-inventory.md` §4 as the upstream feature that obviates this
clamp. Also worth a `docs/spec/kdef-faithfulness-ledger.md` row: "wnd# fallback
ladder not modeled — runtime clamps frame insets defensively instead." 
**Effort:** 5-line change (doc-comment + ledger row).
**Risk:** zero.

### [F6] `renderWindow.UTILITY_SLUG_RE` regex and the duplicate `/utility|mini|floating|palette/` predicate at line 235 could cite Apple `ThemeWindowType` enum

**File:** `src/renderWindow.ts:235`, `:655`, `:775`
**Current:** Two predicates exist:
  - Line 655 — `UTILITY_SLUG_RE = /utility|mini|floating|palette|dialog|alert|modal|popup/`
    (the canonical, shared by `bodyBackgroundStyle` + `isUtility` showTitle gate).
  - Line 235 — `/utility|mini|floating|palette/` (narrower, used by
    `buildBaselineWindow`'s `utility` flag → ARIA role + widget count).
  - Line 775 — `/utility|mini|floating|palette/` (the same narrower set, used by
    `resolveWindowType` to score utility-style chrome candidates).
These two predicates already silently drifted once (LEARNINGS noted the
"Options dialog showed army-camo" regression was the dialog body using the wrong
predicate). Today they STILL disagree — the baseline-window path treats
modal-dialog as NOT utility (no `dialog` in the regex at line 235), while
bodyBackgroundStyle treats it AS utility.
**Primary-source says:** `apple-primary-source.md` `ThemeWindowType` enum:
```
kThemeDocumentWindow      = 0
kThemeDialogWindow        = 1
kThemeMovableDialogWindow = 2
kThemeAlertWindow         = 3
kThemeMovableAlertWindow  = 4
kThemePlainDialogWindow   = 5
kThemeShadowDialogWindow  = 6
kThemePopupWindow         = 7
kThemeUtilityWindow       = 8
kThemeUtilitySideWindow   = 9
kThemeSheetWindow         = 10
kThemeDrawerWindow        = 11
```
Apple groups utility/side-utility (8/9) separately from dialog/alert (1–6) and
popup (7). The CORRECT distinction is: utility = floating-palette body (Apple
ThemeBrush 7 `kThemeBrushUtilityWindowBackgroundActive`); dialog = modal body
(ThemeBrush 1 `kThemeBrushDialogBackgroundActive`). They're DIFFERENT brushes
in Apple's model.
**Replacement:** Promote a single `windowTypeClass(slug): 'document' | 'dialog' | 'utility' | 'popup'` helper into `renderWindow.ts`, cite the
`ThemeWindowType` enum + brush mapping in the JSDoc, and use it everywhere
(buildBaselineWindow ARIA, bodyBackgroundStyle, resolveWindowType, isUtility).
Behavior change: dialog-class windows would no longer reuse the utility-pattern
body fallback (Apple gives them ThemeBrush 1, not 7). The current `flat #ffffff`
T3 fallback in dialog-body-bg matches Apple's classic-Mac dialog default (white)
so this might be a no-op in practice — but it's owner judgment.
**Effort:** 30-line refactor + behavior implications.
**Risk:** medium (changes dialog-body-bg tier resolution for the 5 themes
shipping `utility-pattern` — they'd no longer apply it to modal-dialog windows;
visual baselines would need re-capture).

### [F7] `composeChrome` cinf `patternAnchor` (byte[3] = 1..4) is decoded but no runtime path reads it

**File:** `src/composeChrome.ts` (no consumer); decoded at
`tools/theme-loader/decoders/cinf.js:106–130`
**Current:** The cinf decoder writes `resizeBehavior` as a string (one of 10
labels: `stretch-{whole,top,left,bottom,right}` / `repeat-{whole,top,left,bottom,right}`).
The runtime's `composeFaceButton`, `composeButton` ring, `composeProgress`,
`composeTab`, `composeSlider` all read `slice.tile` (the boolean) but NONE read
the per-corner pattern phase (`patternAnchor` 1..4).
**Primary-source says:** `cinf-resize-behavior.md` decodes the 2.3.1 kDEF
at `0x10ab2`. Byte[3] = 1..4 maps to TL/TR/BL/BR corner phase anchoring — the
pattern's (0,0) origin tracks that corner as the window resizes. The corpus
survey (table at end of doc) shows 5 chromeElements in the 5 baked themes
ship `(0, 1)` "stretch-top" + 5 ship "stretch-bottom" + 1 ship "stretch-left"
+ 2 ship "repeat-left" + 2 ship "repeat-right" — non-trivial use.
**Replacement:** Either (a) wire `patternAnchor` 1..4 into the runtime — the
9-slice center cell would translate its source phase to land at the named
corner; (b) collapse to `stretch-whole`/`repeat-whole` and document the
divergence in `kdef-faithfulness-ledger.md`. Option (b) is what the runtime
currently does silently; option (a) is the period-faithful answer.
**Effort:** 30-line refactor (touch `nineSlice` to honor phase OR document
the divergence).
**Risk:** medium — would change pattern alignment on the schemes shipping
corner-anchored fills (finder header, desktop icon bg, tabs bg, menubar
items per the corpus survey).

### [F8] `composeChrome` cinf `bg-pattern` (byte[3] = 5) path is decoded but no consumer

**File:** `tools/theme-loader/decoders/cinf.js:83–90` returns `'bg-pattern'` for
byte[3]=5; `src/composeChrome.ts` has no branch.
**Current:** Per `cinf-resize-behavior.md` "Corpus distribution" no corpus
cinf hits byte[3]=5, so this is dormant. The decoder LABELS it correctly;
no runtime reaches the code path.
**Primary-source says:** `cinf-resize-behavior.md` §"kDEF dispatch in detail"
documents the dispatch at `0x109be: cmpib #5,%a0@(3)` → `bnew 0x10a6c` — the
runtime would SetBackPixPat + FillRect using `cinf.bgPatternId` (byte[4..5]).
A scheme that ships byte[3]=5 today would render with stretch-whole (the
collapse default in `resizeBehavior()` at line 88).
**Replacement:** No code change needed today (no consumer). Add a TODO in
the cinf-resize-behavior doc's "Open / parked" section linking to a stub in
`composeChrome.ts` for a future bundle. The current behavior is graceful
degradation; the lint warning when a future bundle hits this would be helpful.
**Effort:** 5-line change (TODO comment).
**Risk:** zero (no consumer today).

### [F9] `composeChrome.scrollbar` arrow-id table is canonical but the doc-comment doesn't cite the corpus-corroborated authoring

**File:** `src/controls.ts:344–360`
**Current:** Comment block claims the normal/pressed id split is decoded from
`kDEF231_0.asm:9f0e-9f38` (the CDEF's contrlHilite swap). The mapping is:
RAISED `-10201..-10204` / PRESSED `-10197..-10200`.
**Primary-source says:** `corpus-corroborated-ids.md` cicn section confirms
8 author labels in the `-10205..-10208` range as the slider THUMB family
(`"Down Pointing Slider Thumbs"`, `"Up Pointing Slider Thumbs"`, etc.) —
distinct from the `-10197..-10204` scroll-arrow family. The comment block
NOTES this correctly. There is one gap though: the comment notes the
"platinum-8" divergence (boxed -10202 rests where its preview shows flat
-10198) — but that's not flagged in the kdef-faithfulness-ledger.
**Replacement:** Add a kdef-faithfulness-ledger row: "Scroll-arrow id→state
mapping is the universal 2.3.1 kDEF decode; platinum-8's per-art swap is an
accepted divergence (its boxed and flat arrow cicns are reversed in the bundle
from the 2.3.1 convention)." Reference `controls.ts:344–360`.
**Effort:** 10-line change (ledger row).
**Risk:** zero.

### [F10] `composeCornerSprite` doc widget id arithmetic (`-14336 + idx + (pressed ? 3 : 0)`) could cite `kThemeWidget*` enum

**File:** `src/renderWindow.ts:313–321`
**Current:** Comment cites that the document widget set is `-14336..` and
utility is `-14320..`, with close/zoom/collapse = base+0/+1/+2 and pressed +3.
**Primary-source says:** `apple-primary-source.md` § "ThemeWidget" enum:
```
kThemeWidgetCloseBox    = 0
kThemeWidgetZoomBox     = 1
kThemeWidgetCollapseBox = 2
```
So `+0/+1/+2` mirrors Apple's enum values exactly. The Kaleidoscope id base
(`-14336` doc, `-14320` utility) is Kaleidoscope-private but the per-role offset
IS Apple's enum.
**Replacement:** Add a code comment citing `kThemeWidget*` values and link to
`apple-primary-source.md`. The `corpus-corroborated-ids.md` cicn entry
"-14334 inactive grow box (n=10)" confirms `-14334 = active+(-2)` and is
*not* a widget — it's the inactive grow box (n=10 bundles agree). So our
`+3 = pressed` arithmetic is for ICS4 channel only; the cicn channel uses
`-14334` for inactive grow. Comment is currently silent on this dual-channel
discrimination.
**Effort:** 10-line change (comment + ledger row).
**Risk:** zero.

### [F11] `composeFaceButton`'s `lineH * 0.6` text size rule could be promoted to a citation in the kdef-faithfulness-ledger

**File:** `src/controls.ts:990`
**Current:** `glyphs = label ? rasterizeText(label, Math.max(8, Math.round(lineH * 0.6)), fg) : null;`
**Primary-source says:** `apple-cdef-button-vs-our-compose.md` row 5 +
"Candidate ledger entries" §2 — explicitly recommends adding a ledger row
documenting `0.6 × faceHeight` as a deliberate divergence from Apple's
`kThemeSystemFont = 12pt`, motivated by per-scheme face-height variance
(16 → 74 px tall in the corpus). The audit doc already drafted the ledger
prose.
**Replacement:** Add the ledger row verbatim from
`apple-cdef-button-vs-our-compose.md` "Candidate ledger entries §2" to
`docs/spec/kdef-faithfulness-ledger.md`. Reference `controls.ts:990`.
**Effort:** 10-line change (ledger row).
**Risk:** zero.

### [F12] `composeButton` OUTSET vs OVERLAY model for the default ring is documented in MEMORY but missing from the ledger

**File:** `src/controls.ts:1055–1079`
**Current:** Comment block thoroughly documents the dual-model. MEMORY entry
`reference_default_button_ring` flags the OUTSET formula
`(ring.width − face.width) / 2` as authoritative shipped art over Apple's
`kThemeMetricFocusRectOutset = 4 px`.
**Primary-source says:** `apple-cdef-button-vs-our-compose.md` row 2 +
"Candidate ledger entries" §1 explicitly recommends adding this to the
kdef-faithfulness-ledger as a deliberate divergence.
**Replacement:** Add the ledger row from
`apple-cdef-button-vs-our-compose.md` "Candidate ledger entries §1". Reference
`controls.ts:1034–1057`.
**Effort:** 10-line change (ledger row).
**Risk:** zero.

---

## Summary table

| ID | Title | Effort | Risk | Behavior change? |
|---|---|---|---|---|
| F1 | WND_ID_SLUG missing 3 collapsed-utility variants | 5-line | zero | display sort only |
| F2 | -3790 not in kdef-control-ids.mjs | 10-line | zero | no |
| F3 | Push-button anti-role comment polish | 5-line | zero | no |
| F4 | classifyPart cites STR# 130 names | 30-line | zero | diag labels only |
| F5 | frameFromBody clamp cites wnd# fallback ladder | 5-line | zero | no |
| F6 | UTILITY_SLUG_RE drift (Apple ThemeWindowType) | 30-line | medium | dialog-body-bg may differ |
| F7 | cinf patternAnchor 1..4 unused | 30-line | medium | pattern phase visible on tiled bands |
| F8 | cinf byte[3]=5 bg-pattern path unused | 5-line | zero | no |
| F9 | Scroll-arrow platinum-8 divergence | 10-line | zero | no |
| F10 | Corner-sprite widget arithmetic cites kThemeWidget* | 10-line | zero | no |
| F11 | composeFaceButton 0.6× text size ledger row | 10-line | zero | no |
| F12 | Default-ring outset dual-model ledger row | 10-line | zero | no |

**Effort breakdown:** 5-line × 4 · 10-line × 5 · 30-line × 3
**Risk breakdown:** zero × 10 · medium × 2

---

## Recommended priority order (quick wins first)

1. **F1, F2, F8** — 20 lines, zero risk, demo-side + decoder-stub polish. Land
   together as a "primary-source citation pass" commit.
2. **F11, F12, F9, F10** — 40 lines of kdef-faithfulness-ledger entries. The
   apple-cdef-button-vs-our-compose audit already drafted F11+F12 verbatim.
3. **F5, F3** — comment-only polish. 10 lines, zero behavior risk.
4. **F4** — 30-line "use STR# 130 names in `partRole`". Diagnostic labels become
   self-documenting. Owner judgement: do we want internal terms or editorial
   terms in the diagnostic strip?
5. **F6** — owner judgement on whether the Apple `ThemeWindowType` enum should
   drive the runtime's window-class predicate. Likely behavior change for
   dialog-body-bg tier resolution. Defer until visual baselines + the corpus
   walk confirm impact.
6. **F7** — the patternAnchor 1..4 implementation. Highest-leverage of the
   "decoded but unused" finds. Worth a real spike + visual diff before landing.

---

## Findings NOT made into rows

- **Scrollbar tracker-block divergence** between `composeScrollbar`'s state→id
  mapping and the bundle slug names — already documented at
  `src/controls.ts:323–328` AND `kdef-faithfulness-ledger.md`. No new
  citation gap.
- **Corner-sprite widget `+3 pressed` offset** — covered by F10 above.
- **`composeChrome.drawableExtent` trimming beos's 92→75-wide template** —
  already cited in `kdef-faithfulness-ledger.md` via the "structure rect"
  entry. No new gap.
- **`baseChain.ts` cycle guard** — clean; no primary-source mismatch.
- **`loadTheme.ts` magic-byte check** — sniffs `.sit` / `.rsrc` only; no
  primary-source role-pegging implied.
- **`composeProgress` 2-part lavender vs 3-part role split** —
  already documented; uses `corpus-corroborated-ids.md` `-10223 = "Progress
  Bar: Lavender " (n=6)` as the structured answer. No gap.
- **`scriptoscope-` rename sweep** — no primary-source content; covered by
  LEARNINGS entry.

---

## Landed in this pass

**None.** Every finding listed surfaces an opportunity worth review; none was
both (a) primary-source-grounded enough to land without owner sign-off AND
(b) trivially safe (no behavior change). The closest candidates — F1, F2 — are
purely demo-side / scripts-side and would have been landed except the audit
intentionally surfaces findings as a triaged list for owner review (the
instruction was "bias toward findings that surface real behavior gaps").

The most-leverage row is F7 (cinf `patternAnchor` 1..4 wiring) — primary-
source-grounded by `cinf-resize-behavior.md` §"kDEF dispatch in detail" with a
specific corpus survey identifying the 14 bundles + slot combinations that
ship non-zero patternAnchor. Worth a follow-up spike.
