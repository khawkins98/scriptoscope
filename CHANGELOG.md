# Changelog

All notable changes to Scriptoscope, in reverse chronological order. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows semver,
with the pre-1.0 caveat that the public API may change without a major bump while the
declarative front door, theme schema, and consumer-facing class names stabilize.

## [Unreleased]

- Add the v2 pre-review gate and review tiers. `npm run lane:ready` fails on a dirty worktree, an unpushed head or a pushed head that differs from HEAD. It also fails on leftover review labels in the family ledger sources, `ledger.json` and the control-availability expectations: `PENDING`, "Awaiting independent review" or "PROPOSED verified" in exact case anywhere, or in any case on lines that are new since the merge-base. A single `PENDING` reviewer label on a hash-only expectations bump passes with a WARN for the PM. A hash-only bump means 64-hex sha256 values with unchanged keys, the inventory version, and a review block that archives the prior review. It then runs the clean-room linter, `gen-trap-table --check`, `report-coverage`, `build-ledger.mjs --check`, a new ledger history guard, `validate-source` (document hash pins), typecheck and `npm test`. It prints a markdown summary with the commit and each exit code for the PR body. `--skip-tests` is accepted only for docs-only diffs, and it still runs the document-pinned tests. A new `v2 docs + ledger` workflow runs the no-browser checks, `validate-source` and `npm test` on every PR and push to v2, including docs-only PRs that `ci.yml` skips. It fetches the base commit explicitly and fails if the base can't be read. It also runs the base commit's copy of the linter, coverage pin and history guard against the head, so a PR cannot weaken its own judge. By maintainer decision, Traps.h is not stored in CI, so the workflow checks only the trap table's structure and says so. The history guard (`scripts/check-ledger-history.mjs`) requires each family's merged transition history to be an unchanged prefix of the head's, and `_base.json` to be unchanged. This catches a rewrite that re-derives every digest, which the generator's own chain checks accept. It fails closed when its base commit can't be read. `npm run ledger:sync` regenerates and checks `ledger.json` for the second of two family-touching PRs, and the workflow prints that command when the ledger is stale; CI never commits. Hardening: `report-coverage` treats the inventory as frozen when its status mentions "frozen" in any case, when any pin field exists, or when the base inventory was frozen. In each case the full in-scope pin is then required, so neither `frozen: false`, a reworded status nor a deleted pin turns the checks off. Against a frozen base, `inScope.changes` is append-only, and a re-pin (a new count or sha256) needs a new entry recording `from`, `to` and `what`, so a self-consistent silent re-pin fails. The clean-room brief-scope check now also catches bare top-level directories (with or without backticks and trailing slashes), unbackticked paths, link targets including the repo root, and paths outside the repo. It rejects forbidden locations (`.scratch`, listings, `*.evidence.md`, lane and maintainer-store paths, absolute and `~` paths) in the Allowed paths section even when they don't exist on disk, along with any `scheme://` URL. The brief's listing-path exemption no longer covers that section. `package.json`, which the brief allows, is now linted. CONTRIBUTING records the tiers and the `lane:ready` requirement (#378).

- Correct the scroll-bar CDEF citations (v2 lane L5 verifier). The scroll-bar CDEF is service slot 1 `0x997e`, not slot 5 `0x8d36` as the scroll-bar selection entry below says; slot 5 is a separate, undecoded CDEF (`bevp` tags). `0xbbf4` is the track rect, not the thumb rect; a disabled control fills the whole track rect; the "together arrows" byte is never set, so arrow 0 is always drawn; arrow icons are `ics#` then `ics8`, never `ics4`, and cicns -10204..-10197 are never loaded. Docs, rule-table comments and the scroll-bar ledger family (1.1.0, evidence re-pinned) follow; no rule outcome or ledger status changes. Add scroll-bar geometry rules from `docs/spec/engine/scrollbar.md` (boxes, track rect, thumb length/position, segments, slicing, part codes, pattern underlay, offscreen rule) with a mutation table, and todo rows awaiting the scroll-bar driver.

- Add source-addressed scroll-bar selection rules for all 18 archives, decoded from the 2.3.1 scroll-bar CDEF (`0x8d36`): state bytes, the track `(-8288 | -8280) + tier` (0 inactive, 1 disabled, 2 normal, 3 pressed) with no cross-tier retry, the bounds-over-16 composite flag, the arrow-icon and arrow-box lanes, and the thumb (none while disabled). A Node rule table reads each archive's own resource map and a per-archive mutation table names what each wrong reading changes. A source/built browser check replaces every candidate cicn and arrow icon with a sentinel and compares the resources the public `composeScrollbar` draws in 144 rows. The 32 normal rows of 16 archives agree. The other 112 rows disagree with the decode and are pinned per class, not fixed: pressed and inactive use the wrong track tier everywhere, the thumb is drawn while disabled or inactive, the icon-lane archives draw the wrong arrow icons, crayon-os and windows-95 tracks are drawn as square cells with procedural arrows, and pressed composite tracks omit the normal-tier arrow boxes. Fixing them changes every archive's reviewed goldens, and pressed needs a part option. Sliders and progress bars have no selection decode and are added as explicit unknowns. After independent review, ledger 1.22.0 adds 54 cases and 365 obligations: 13 `scrollbar.normal-selection` verified (selection only, under the declared mapping and an archive-only chain; the five ppat-shipping archives stay unknown), 18 `scrollbar.state-selection` mismatched under issue #374, the rest unknown (173 verified, 18 mismatched, 1,213 unknown). The runtime's tier map does not follow the 1.8.2 drawer, which selects the same tiers as 2.3.1; its comment misreads FUN_000066b4. No images or goldens.

- Fix window-edge tiling for part codes 11 and 14. These cells now tile from the far end of their run (right on top and bottom edges, bottom on left and right edges), so a partial tile falls at the near end and shows the end of the source art. Every other tiling code still tiles from the start. This follows the decoded `0xfeae` direction byte, which sets the starting end, not the axis. It changes five cells in animals (four) and monkey-paradise (one), in both states. The window-chrome rule check now asserts both directions for runs longer than 1px and rejects scaled or wrongly anchored tiles. The check now also covers unknown-class cells and records which archives can tell a wrong blit from a right one. Seven can; 1138, 1984, apple-lisa, beos-r503, windows-31 and windows-95 cannot. Ledger 1.21.0 cites the decode for the 13 `window.tile-blit` obligations. After review, seven of them are verified: 1990, animals, crayon-os, dolphin-som, evolution, floppies and monkey-paradise. They agree with the decoded rule at sampled sizes, for opaque pixels, and only animals and monkey-paradise exercise the 11/14 direction. The other six stay unknown, giving 160 verified and 879 unknown in total. No native capture backs these. The kDEF reference also corrects the widget routing: `0x5ffc` is the hit-test, widgets draw through `0x632e`/`0x6062`, and their placement depends on side widths, so this gives no support for collapsing code 10 (#221).

- Add source-addressed checkbox/radio selection rules for all 18 archives. A Node rule table reads each archive's own resource map. It covers the 2.3.1 state bytes, the CICN lane (`-9504 + 12*kind + 3*value + tier`, value-2 same-tier retry), the branch into the icon lane after a CICN miss, and the pinned icon table with the missing-`ics#` retry. A source/built browser check compares all 216 public `composeCheckable` rows (checkbox/radio × off/on/mixed × normal/disabled, empty label) with the predicted archive raster. 178 rows discriminate; 38 share pixels with another resource. Append 18 open checkable ledger cases (1.20.0, 185 obligations). Independent review promoted only the 13 CICN-lane selection obligations, as agreement with the decode under the stated conditions (153 verified, 886 unknown). Icon-only selection stays unknown. Limits: the rows assume the modern public-to-native mapping, a clear Gestalt(`Acid`) byte and an archive-only resource chain. The original lanes switch resource files (`UseResFile`), and that is not resolved. Pressed and value-3 art, ics8/ics4 depth, glyph placement and the label pen are recorded as unknown. The runtime's normal-tier CICN retry has no counterpart in the decode, but no shipped archive reaches it, so it is recorded rather than changed. Popup buttons are not covered.

- Record the reviewed 32 bpp reference-environment findings: Floppies depth-then-scheme results and their limits; boot-counted Animals and Crayon OS hangs; the about-box picture-depth association; the `nosound` host setting; and the absence of a splash toggle. Receipts are in the private store; nothing is admitted.

- Tighten the nine-state follow-ups from review. Every 1990/Dolphin ledger row, case substitution list and evidence locator/limit must now carry `State-non-discriminating`, and no 1984 row may. The test fails when any single marker is removed. Reword "Only 1984 discriminates hilite->cicn selection" to say the 1984 face comparisons are state-discriminating and that original selection remains unknown for all nine. Only unhashed ledger prose and evidence excerpts change; the inventory digest, version 1.19.0 and all statuses stay the same. The sealed `nine-state-evidence.json` and reviewed `captureMethod` text are left as recorded, with clarifying notes in the reference-captures README. The six byte-identical 1984/1990/Dolphin palette and producer-table copies become aliases, and the intake validator and `readOriginal` now resolve aliases when the repository is reached through a symlinked path.

- Add nine independently reviewed empty 80×20 push-face records for 1984, 1990 and Dolphin (normal/pressed/inactive), each environment with its own measured 1,223-key profile and finite CIcon transfer data, and let recorded-face harnesses bind such transfer data to the ordinary loader with whole-load provenance. Only the nine face-output obligations are verified (ledger 1.19.0: 140 verified, 714 unknown). Limits: the 1990 and Dolphin faces are identical across states and schemes, so they do not test state selection; only 1984 does. Title colour is untested, and the transferred elements are a slider tick and a checkbox, not the faces. Shutdown acknowledgement, provider/cache order, mask/phase/font, whole-port equivalence and cold-cache behaviour remain unknown. First batch stored in the compact evidence format (#221).

- Document the lean fidelity method in CONTRIBUTING and the project guide: rules-first coverage with sampled native captures, many observations per boot with predictions frozen before capture, review that proves each check can fail, named capture conditions (8-bit calibrated vs 32 bpp direct, never pooled), a native attempt budget and durable lane workspaces. Record the 32 bpp `SetDepth32` condition and its limits in the reference-environment guide. Correct the corner-sprite scheme list (five, including slimes) and the display-gamma module path.

- Add source-addressed window-chrome rule tables for the 13 `wnd#` archives (the other 5 get only the corpus-split and author-label checks). They cover the 0x356c `wnd#` ladder, END-based cells, the 1:1 leading corner, flag-independent part-code widths, per-half 0x5178 allocation and 1px-run 0xfeae opaque tiling. The checks run over every sliced window type, both states and 15 sampled sizes, in Node and in the source/built browser modes. Append 18 open window-chrome ledger cases (1.18.0); independent review promoted only the 13 `wnd#` ladder obligations. Record one decode disagreement (code 10 under caller flag 1, failing `todo`) and one undecoded overrun (titled halves at the template minimum, kept as an observation).

- Store committed fidelity evidence compactly without weakening any check. Measured profiles, calibration measurements and calibration logs use one-row-per-line `compact-json-v1`, and byte checks recover the exact originally bound bytes through `tests/compact-evidence.json`. Byte-identical duplicate profiles and the duplicate BeOS calibration are replaced by declared aliases. Twelve unread Shared307 calibration screenshots now live in the private asset store under sha256-bound locators. All capture/review digests, ledger and registry identities are unchanged. New intakes should follow the documented format (#221).

- Add four independently reviewed empty-face records for Floppies normal/pressed/inactive and Evolution pressed, genuine separate measured profiles and state-specific bindings. Preserve prior Evolution records and all broader unknowns; independent review accepted only four output obligations after the registered source/built pair matched all45 faces/72,000 pixels per mode. Refine the fidelity delivery roadmap without changing its full target or exit criteria.

- Allow recorded-face comparisons to bind a complete measured profile per state while preserving each theme’s existing default profile and earlier capture bindings.

- Cover source-derived push/default state precedence, missing-ring branches and face-rectangle expansion through direct composition and actual promoted buttons, using owned literal art in mandatory source/built tests. Preserve original caller/provider and broader fidelity unknowns.

- Add three independently reviewed Monkey Paradise empty-state observations and their actual 288-key measured profile. Join normal output to the loaded same-owner pattern and completed body union; verify only the three registered output obligations after independent source/built review, and preserve all prior evidence and broader unknowns.

- Record completed patterned control-body unions with actual resource, phase policy and write counts; preserve lookup-only diagnostics on empty or failed compositions.

- Clarify fidelity batching, consolidated preboot review and separate acquisition/execution identities while retaining required evidence and validation gates.

- Bind titlebar close, zoom and shade actions to authored widget identities, including right-grouped and vertically stacked controls; put shade outermost in the synthetic document layout and remove the resize overlay while collapsed so shade can restore the window.

- Leave window shell shadows off by default, including the landing page, so rectangular CSS shadows do not fill transparent edges of custom chrome. Preserve the explicit shadow custom-property opt-in and theme-painted artwork.

- Add two independently reviewed empty Evolution normal/inactive observations, actual 1,971-key measured preparation, public comparison cases and narrow ledger bindings. Preserve all prior records and typography, provider, phase and whole-control unknowns; exclude labeled captures and native font payloads (#190, #221).

- Add opt-in finite CIcon transfer preparation with exact source/context bindings, explicit modern mask alpha, and owned loader/package acceptance; strict default and display-profile v1/v2 behavior remain unchanged.

- Refresh the reference-intake status and document claim-focused fidelity batches, explicit ownership, delta review and finite-adapter stopping criteria without changing evidence admission or required checks.

- Add the six-source Shared307 empty-face campaign with separate measured profiles, original state observations and source/built comparisons. Validate completion through paired metadata and actual paint dependencies, replacing theme-name dispatch; retain exact payload identities, explicit absent metadata, acquisition incidents and broader fidelity unknowns (#190, #221).

- Document independently reviewed sparse CIcon preparation and ordinary transfer observations, separating documented foreground/background coloration from the unresolved missing-index lookup rule. Preserve runtime compatibility, strict profile rejection and all fidelity/intake statuses (#221).

- Add three independently reviewed BeOS empty-face state observations with finite measured-profile source/built comparisons and narrow ledger bindings. Preserve prior capture/request records and explicit cross-run, provider, phase, mask and whole-control unknowns (#190, #221).

- Add an opt-in version 2 finite direct-RGB8 preparation policy for strictly bounded full-color patterns, separate from RGB16 mappings. Preserve version 1/default behavior and whole-load rejection; retain explicit paint-context and original-evidence limits. Add a measured BeOS test profile and source/built whole-load checks without promoting capture intake or ledger claims (#221, #190).

- Document the fidelity workflow: prefer shared-model corrections, retain evidence and limits for interim overrides, and consolidate them when independent references establish the common behavior.

- Select each owner's exact signed push-button resource before author-name aliases, correcting the Animals normal face mismatch without changing recorded pixels or measured profiles. Preserve explicit compatibility fallback when the canonical art is absent.

- Add Animals normal, logically highlighted and disabled empty-face acquisition evidence from one fixed-order boot, a separately measured 209-tuple display profile, and bounded cross-run calibration joins. Preserve prior capture/request bindings and all broader provider, phase, mask and whole-control unknowns (#221, #190).

- Document the private maintainer reference-asset store, verified fetch workflow, restore limits and separation from public CI; refresh the README to twelve reviewed scoped observations.

- Add four independently reviewed Crayon/Lisa highlighted and disabled empty-face observations, calibrated measured-profile comparisons and narrow recorded-output ledger bindings. Define one fixed empty-push campaign across 18 sources and three states, preserving prior bindings and leaving 42 unacquired campaign states and all broad fidelity claims unresolved (#221, #190).

- Register existing conditional slider endpoint and checkable icon selector assertions in the partial requirement ledger, binding owned inputs and actual source/built output while preserving all historical provider, decoder and whole-control unknowns (#221). Document coherent implementation/harness/ledger/documentation batches with one reviewed final check chain and retained unchanged-input receipts.

- Add an explicit group2 slider layout environment with independently owned cinf metadata, inset horizontal/reversed vertical endpoints and committed pointer geometry; preserve default compatibility behavior and reject unsupported inputs.

- Keep slider groove cap/tile metadata attached to the actual selected resource when a missing requested state falls back to active art; add literal public-loader checks without changing endpoint policy.

- Document the source-bound progress PaintRect interceptor and the unresolved upstream value-to-rectangle connection, without changing runtime behavior or fidelity status.

- Register eight exact owned mixed checkbox/radio selector and same-tier fallback cases in the partial requirement ledger, with actual source/built fork/occurrence/pixel joins and explicit historical-environment limits (#221).
- Correct checkbox/radio normal icon IDs from the pinned kDEF table, and retry checked art at the same tier only when the mixed `ics#` mask is absent. Expose a same-fork mask census; reject short/duplicate masks or contradictory catalogs while retaining unobserved manual-theme compatibility.

- Select mixed checkbox/radio CICNs before the source-defined same-tier checked fallback; preserve existing active-state and icon compatibility fallbacks. Add literal public-loader source/built state and ownership checks.

- Reject resource-fork reads beyond declared data/map sections even when trailing file bytes are readable; preserve empty lists, zero-length resources and valid corpus decoding.

- Extend existing push/bevel corpus checks with deduplicated tiny-height corner/side overlap cases at public width anchors, retaining all prior cases and unresolved provider/body limits (#221).

- Check omitted empty-label push/bevel dimensions across the existing corpus and declared-cinf tuples, preserving explicit-size cases and unknown fidelity boundaries; automatic dimensions remain modern public policy (#221).

- Exercise the 87 default missing-cinf push/bevel tuples with a separately declared owned cinf-0 provider in the existing source/built boundary harness; preserve default unknown rows and historical-provider limits (#221).

- Add an opt-in prepared cinf-only provider environment for standalone push/bevel faces, with separate consumed-owner diagnostics and explicit unknown/unsupported results; preserve common metadata and default loading behavior (#221).

- Add declared known-origin pattern full-face checks to the existing source/built border groups, binding actual ppat bytes and independent control-body phase while retaining unknown-origin invocations and original environment limits (#221).

- Extend existing border-boundary checks to conditional solid-body full face rectangles using bound raw background samples, actual modern null-pattern admission and explicitly transparent initialization; retain pattern/missing-cinf cases and original environment claims as unresolved (#221).

- Specify the source-derived cinf same-ID/default lookup sequence with synthetic conditional fixtures and explicit unknown provider environments; correct `$A9A0` to GetResource in the source reference without changing runtime loading or injecting defaults (#221).

- Add finite source/built push and bevel border-size checks across all 18 inputs, with independent opaque-writer coordinates, exact input/paint joins and explicit unreachable or unknown cases; broader fidelity and ledger closure remain OPEN (#221).

- Reject truncated wnd# counts/records and invalid negative list counts before decoding fabricated window geometry; preserve the signed empty sentinel and valid corpus outputs (#330).

- Add opt-in exact window construction byte provenance for sliced recipes and explicitly synthetic corner-sprite windows; carry those occurrence links into the full-envelope inventory without changing default manifests or paint.

- Bind all 18 sources and the full draft acceptance envelope to repeatable modern loader/resource/window-key inventories, retaining duplicate/error occurrences and explicit canonical-versus-loader selection comparisons. No fidelity or coverage promotion.

- Record a quarantined executed font-result and RAM-strike follow-up for the existing AgjpQy research note; retain cache/provider, whole-font and pixel-contribution limits without new intake or runtime claims (#221, #190, #315).

- Materialize a DRAFT acceptance envelope for all 18 source references and 15 contracted families across 33 public family/path bindings, preserving unresolved options, boundaries and evidence without coverage or closure claims.

- Admit direct full-color whole-header pattern bodies with explicit known pattern-origin state, shared original-Rect phase and clipped inset union; retain unsupported mode5, device/cache and unknown-origin paths.

- Support whole-header one-pixel line colors through the existing owner-bound sampled companion, preserving strict missing-data, mask and device-policy limits. Resolve only the existing collision sampled-color obligation in ledger1.8.0 (51 verified,218 unknown; all32 cases OPEN).

- Qualify the historical chrome QA punchlist and unversioned previews as visual context, preserving its findings without implying current all-type fidelity certification.

- Record exact pinned-source reproduction of the preserved emulator JS/WASM, with sanitized build identities and explicit unintegrated-observer/provider limits.

- Propose a full 18-scheme acceptance inventory with explicit API paths, option classes and unresolved boundary obligations; preserve existing evidence and open closure.

- Preserve one quarantined System7 AgjpQy observation and exact conditional public prepared-strike comparison, with public metrics and explicit provider/whole-font limits (#221, #190, #315).

- Document #315’s later exact public prepared-strike O/K comparison alongside the unchanged historical candidate observation and its provider/whole-font limits.

- Add one scoped Lisa normal-face reference with its measured 22-color profile, exact recorded-output comparison and stopped-export guidance; preserve prior scopes and broad unknowns.

- Add one scoped Crayon normal-face observation and exact recorded-profile comparison with explicit port placement. Original pattern phase/provider/mask and whole-request obligations remain unknown; existing six attestations retain their semantic bindings.

- Bind reference attestations to request-specific semantics and versioned eligibility rules, retaining global documentation/ledger versions as provenance. Preserve prior attestations through one reviewed metadata migration; admission outcomes and original artifacts stay unchanged.

- Register two existing prepared bitmap-font SOURCE assertions: declared strike identity, signed source pen and literal clipped mask paint. Ledger 1.5.0 keeps original typography/provider unknown; authority 0.1.11 requires metadata-only reference re-attestation.

### Added (2026-10-19)

- Add opt-in prepared bitmap strikes for single-line plain push labels, with
  immutable caller-owned identity, explicit glyph mappings, source-derived pen
  placement and completed clipped-ink diagnostics. Browser fonts remain the
  default; no original font data or provider certification is included (#314).

### Fixed (2026-10-19)

- Decouple themed push/bevel label size from face height. `fontSize` now accepts
  finite sizes of at least 6px, defaulting to an explicit 12px compatibility
  policy for measurement, foreground and emboss (#310).

### Added (2026-10-19)

- Preserve partial System7 default-item transition observations and clarify that
  `ButtonOptions.default` requests a kDEF-style painter ring, independently of
  DialogManager default selection and Return/Enter handling (#277).

- Track six exact recorded-condition empty button comparisons in the requirement
  ledger, with explicit measured-profile/original-intake/paint/execution bindings.
  Original masks, typography, private selection and broad control fidelity remain
  unknown; existing cases and assessments are unchanged.

- Admit two independently AI-reviewed original empty normal button observations
  for Windows 95 and System 7 under the bounded public-API face scope. Retain
  full frames, exact port/context crops, sanitized logs and recorded conditions;
  all broader requirements remain unresolved and neither whole request is
  satisfied. No original executable/font payloads, runtime change or ledger
  promotion is included (#190).

### Added (2026-10-18)

- Extend the existing empty-face reference scope to four recorded Windows95/System7
  logical-highlight/disabled states in active windows. Preserve normal v1 evidence,
  exact request inputs and every broader unresolved requirement; v2 excludes
  physical gestures and inactive-window claims. Admit four separately reviewed
  original observations and reuse existing profile comparisons for all six faces (#190).

- Add a narrow versioned reference-review scope for the two fixed empty normal
  Windows 95/System 7 faces. Preserve full context, palette/producer and public
  invocation evidence; report scoped observations separately with every broader
  requirement unresolved. Existing full/default-ring/Crayon gates and the empty
  capture corpus remain unchanged (#190).

- Report completed legacy push/bevel raster paint separately from source-backed
  band diagnostics, including System 7’s no-cinf face. Bind the actual loaded
  resource and clipped pre-label alpha occupancy; suppress aborted/failed paint
  without changing pixels or attributing the compatibility path to kDEF.
  Reuse existing profile renders for exact full-face comparisons against the two
  separately reviewed original observations under their recorded finite profile.

- Add explicit finite display profiles shared by raw theme conversion, browser
  loading and declarative mounts. Preserve exact RGB16 through one joint device
  mapping/producer stage, reject missing mappings before asset allocation, and
  keep the default assets, goldens and source provenance unchanged. The opt-in
  measured two-theme test input remains quarantined partial evidence (#190).

- Support bounded mode-5 color-icon push/bevel bodies: aligned 1:1 color copies,
  conventional one-bit masks, and genuine missing-body erasure. Preserve hidden
  ordinary RGB once through display preparation, exact resource occurrence and
  dependent asset cleanup; keep unsupported/scaled/provider cases explicit (#300).

- Register four exact whole-header and sampled-band requirement cases with
  independent literal pixels and actual owning byte joins (#301). Preserve the
  prior eighteen cases/150 assessments; keep all closures OPEN and explicitly
  separate unsupported header admission from verified source-model pixels.

- Clarify the fixed display LUT as a compatibility policy in source comments and
  historical notes; distinguish extraction/browser preparation from raw decoding
  and independently measured original display conditions (#190).
- Correct expanded push, bevel and default-ring band colors when the original
  palette sampler differs from indexed raster decoding (#296). Keep corners,
  ordinary raster assets and the display LUT unchanged; create occurrence-bound
  sampled companions only after a complete safe pass and decode only painted
  dependencies, with normal cancellation/disposal ownership.

- Add a separate whole-header surface compositor with explicit Rect/state/clip,
  raw background and mask/band composition, and list-view bottom extension before
  clipping (#292). Report unsupported sampling, pattern, special-origin and
  recording/device boundaries explicitly; preserve the existing multi-column
  text helper and distinguish admission work from actual paint diagnostics.

- Register two exact solid-background requirement cases with selected-owner byte
  joins and independent literal fill assertions. Preserve all sixteen prior cases
  and 134 assessments; the eighteen-case inventory remains OPEN with device,
  original ownership and broader geometry unknown (#289).

- Retain bounded indexed cicn sampler/current-display equivalence metadata for
  future source-sampled band admission (#295). Compare actual opaque raster
  colors, preserve occurrence ownership, and report unsafe/ambiguous inputs as
  unknown; existing control pixels and display conversion stay unchanged.

- Promote directly inserted declarative subtree roots and their moved child
  controls, retaining queued additions through theme/preparation barriers. Keep
  initial mount-root semantics and late initial control discovery. Existing
  window hosts now exclude both direct and wrapped late controls; this removes
  the accidental wrapped path that bypassed the documented boundary (#281).

- Correct supported solid push/bevel bodies to use the selected face owner's
  raw background sample beneath mask holes and opaque palette collisions. Keep
  pattern priority, explicit unsupported/legacy fallbacks and the existing LUT.

- Reconcile the control-face and kDEF reference notes with delivered full-color
  pattern and raw RGB16 text/background behavior. Preserve remaining device,
  font, transfer and list-header limits; refresh only the three affected
  availability document pins without changing its 27 cases or outcomes.

- Record the independent public Dialog Manager, kDEF default-data, and PACH
  FrameRoundRect contracts. Pin exact pen/color/erase guards without assigning
  the quarantined default-border observations to an unobserved painter (#277).

- Extend the partial rendering requirement inventory to sixteen exact direct
  cases, with bounded authored RGB16 text/emboss and pattern phase/clip evidence.
  Preserve the original eight cases, all OPEN closures and explicit unknown
  typography, transfer, device and original-port requirements. Synchronize draft
  authority 0.1.4 with the unchanged 13 capture requests (#274).

- Reject requirement assessments backed only by unrelated archive or synthetic
  inputs, while retaining general engine rules and explicitly shared source
  evidence. This adds an association guard without promoting any fidelity claim
  or changing the reviewed inventory (#274).

- Bind interactive push-button patterns to committed managed content ports, with
  explicit context/scale ownership, paired state repaint epochs and finite shared
  tracking. Same-mount declared buttons follow window scroll and reparenting;
  imperative binding is opt-in and exposes unsupported/pending states (#270).

- Preserve failed browser-test attachments and their hashes outside the next
  run's replaceable output, including original failure metadata and explicit
  incomplete-copy reporting. Slider lifetime probes measure the current canvas
  atomically across its initial repaint.

- Preserve four public Dialog Manager default-button observations as quarantined
  partial research. API/Return behavior is recorded separately from unknown
  border attribution; native images and fixture pins do not admit references
  or change rendering expectations (#190, #221).

- Preserve six original-environment control observations as quarantined partial
  research, with native frames, fixture sources, external input/tool pins and
  integrity checks. Palette/provider/font gaps remain open; reference intake
  still has no admitted captures or approvals (#190).

- Add opt-in tab paint diagnostics with actual selected owner/resource occurrence,
  source-band versus legacy branch reasons and independent byte-join negatives.
  Preserve output, decode counts and theme ownership; no fidelity assessment is
  promoted (#284).

- Portable browser-observation metadata binds the actual checkout, built assets
  and browser version. Environment commit claims and supplied metadata cannot
  silently replace observed execution identity; this remains regression evidence.

- Extend opt-in byte provenance to actual `ppat` catalog occurrences and preserve raw signed `cinf` body requests, including zero; no pattern-paint claim or rendering change (#260).

- Clean installed-tarball consumer check: strict public declaration resolution,
  isolated production bundling, real archive loading/native interaction and
  teardown, with missing assets and declaration-escape negatives in pinned CI.

- Reviewed exact source inputs for all 18 bundled schemes, with independent
  archive inventories/extraction hashes, explicit raw-source boundaries and
  tamper checks. This approves contract inputs, not original lookup or rendering.

- Versioned fidelity compatibility-contract draft defining proposed source inputs,
  family boundaries, evidence obligations and explicit substitutions. Its target
  remains OPEN; partial requirement and availability inventories do not establish
  an overall fidelity percentage.

- Corrected source evidence for cinf body dispatch and a reproducible raw-field
  survey of all 18 pinned scheme forks. Pixel-pattern fills apply outside mode5;
  mode5 requests color-icon art. Rendering behavior remains unchanged.

- Opt-in actual load-byte provenance joins selected control resources to archive,
  chosen fork and cicn/cinf payload hashes without default-path hashing. Frozen
  per-load evidence distinguishes inherited owners and concurrent loads; ambiguous
  duplicate asset bindings reject diagnostic loads instead of claiming a false join.

- Interactive period-ad landing with five live themed portrait windows, scheme
  switching and composition resets; the previous demonstration remains available
  at `showcase.html`, including legacy theme links. ([#245](https://github.com/khawkins98/scriptoscope/pull/245))

- Finite independently reviewed control availability expectations: 26 API-policy
  outcomes plus an explicit unknown, checked against actual source/built resource
  traces, pinned archive evidence and native fallback keyboard behavior.

- Versioned partial fidelity requirement inventory for eight exact control cases,
  with independent evidence, explicit unknown obligations, live mismatch tracking
  and CI reports separating reviewed requirements from actual test executions.

- Opt-in per-render resource-selection traces for push/default and bevel buttons,
  including actual owner/IDs, compatibility fallbacks and ring reservation versus
  paint. Direct matrix evidence records these observations separately from fidelity.

- Reviewed Linux control-rendering regression seed: 36 bounded contact sheets,
  pinned input provenance and explicit known fidelity/interaction limits, with
  exact comparisons in CI and optional missing-file/one-pixel failure probes.

- Compact rendering observations retained on successful and failed CI runs,
  including executed availability/dimensions and explicit fidelity limits.

- Reusable public-runtime control matrix with bounded and extended option cases,
  raw-art references, promoted DOM/style metadata, and grid/flex window fixtures
  for source-backed assertions and reviewed contact sheets (refs #213).

- Pinned browser CI for rendering-option contracts across the theme corpus,
  source and built entries, real promoted DOM, and independent source-art checks.
  Explicit Linux golden recording/verification preserves reviewable failure evidence.

- Explicit `ThemeEntry.meta` support for catalogs carrying a complete provenance
  sidecar; picker display labels no longer substitute for origin/license metadata.
  ([#198](https://github.com/khawkins98/scriptoscope/pull/198))
- Idempotent `ThemeResolver.dispose()` and mount-owned resource cleanup. Registered
  themes and their base chains remain caller-owned.
  ([#202](https://github.com/khawkins98/scriptoscope/pull/202))

### Changed (2026-10-18)

- Contributor and architecture guidance documents rendering acceptance, pinned
  golden review, and explicit fidelity limits. Historical ring-outset and cinf
  slicing heuristics are marked superseded by the verified source model.

- Background theme-picker previews decode only folder icons instead of complete
  schemes, reducing conversion work and asset allocation while retaining the
  source archives and icon fallback semantics.
  ([#201](https://github.com/khawkins98/scriptoscope/pull/201))
- Development tooling uses Vite 7 and Node.js 24. The library build explicitly
  preserves the previous browser target.
  ([#194](https://github.com/khawkins98/scriptoscope/pull/194))
- Updated architecture, integration, and vendoring guidance, including sibling
  lazy chunks and resource ownership; preserved superseded historical notes.
  ([#204](https://github.com/khawkins98/scriptoscope/pull/204))

### Documentation (2026-10-18)

- Clarify harness-driven development, regression versus fidelity evidence, and
  focused validation without redundant full-suite runs; retain required checks.

- Provisional independent reference-capture requests and evidence intake checks:
  exact source/condition/provenance bindings, separate independent review, known
  self-image contamination checks, and an honest report of thirteen missing
  captures. Nonzero-port experiments require reviewed direct invocation and
  observed pattern-origin state. Author previews and selfgoldens remain
  non-independent evidence.

- Reconcile the fidelity plan with delivered solid-face geometry and loaded-byte
  provenance; keep remaining decoder, pattern and reference requirements explicit.
  Correct the charter's landing/showcase paths and active reference tracking.

- Pin the PACH tab-investigation resources to a reconstructed installer/fork
  chain; preserve the unresolved body-painter and color-sample requirements.

### Fixed (2026-10-18)

- Render supported tab bodies with full-raster end strips, cinf-selected repeated
  bands and a separate solid center, preserving 1138/1990 middle strips without
  stretching semantic color markers. Pattern-backed centers and original tab
  typography remain explicit limitations (#223). The two existing exact tab
  geometry assessments now have source-backed executable acceptance; all other
  132 assessments and all OPEN case inventories are preserved.

- Push and bevel labels use their selected cicn/cinf RGB16 text samples and
  optional emboss pass, preserving masked colors and exact sentinel decisions
  before PNG transport; explicit foreground overrides remain supported.

- Resolve canonical, legacy and raw window identities before resource fallback,
  preserving authored collapsed utility chrome in sliced and corner-sprite
  themes. Keep exact custom names, emitted manifest keys and child/base policy.

- Declarative button teardown restores original native elements, display and focus;
  removes owned faces/listeners across retheme and insertion-observer races; and
  cancels pending theme/face work without adopting moved sources. The showcase
  No Theme/Restore flow preserves native form values and mounts one face per button.

- Paint full-color push/bevel pattern bodies from the actual face owner with explicit logical-port context, continuous corner-anchored phase, byte-linked diagnostics and cancellable preparation. Carry decoder-order pattern bindings even for numeric names and raw ID0; mounted layout propagation remains active separately (#218, #270).

- Native slider composition stops at disposal boundaries between image decodes;
  a held track cannot resume and request a thumb after owned theme URLs revoke.
  Native restoration stays synchronous; public/imperative rendering is unchanged.

- Packed public types now include the browser-loader declaration referenced by
  the root entrypoint, with its LoadedTheme import pointing at emitted types.
  Clean TypeScript consumers no longer need repository files or skipLibCheck.


- Promoted range pointer hit testing now uses the geometry that drew its canvas.
  Stationary thumb grabs preserve exact native values, dragging retains grab
  offsets, and track clicks center the thumb without changing imperative slider
  or scrollbar mapping. Late paints cannot replace newer hit geometry.

- Promoted ranges retain native keyboard and accessibility semantics: fractional
  steps, numeric bounds, `step="any"`, effective disabled fieldsets and live labels.
  Pointer values use native sanitization, with change only on a changed drag
  commit; live attributes/reset refresh the art and teardown releases owned work.
  The imperative normalized slider API is unchanged.

- Restore promoted checkbox/radio/range/select carriers on disconnect while
  preserving live form state and consumer attributes. Retheme and teardown release
  old face/global drag listeners and pending paints, cancel unfinished promotion,
  and remove mount-owned theme-switcher wiring (#232).

- Overlapping theme requests no longer let delayed chrome replace a newer window
  batch. Window preparation is isolated from live canvases, failed newer requests
  cannot revive superseded work, and declarative completion/default/URL updates
  follow successful work. Dynamic scans join the current request boundary; native
  focus and state survive face replacement. Direct public button/tab preparation
  remains usable in disconnected fragments; reentrant button insertion disposes
  discarded faces without leaving duplicate controls. (Refs #237.)

- Promoted range sliders retain associated labels and explicit ARIA naming,
  including naming precedence and live label references after retheming (#229).

- Indexed cicn decoding now respects ColorSpec pixel-value mappings and rejects
  truncated or impossible row layouts before pixel allocation. Independent
  byte fixtures cover masks, four depths and palette flags; all 3,325 pinned
  corpus images retain their exact decoded pixels. ([#256](https://github.com/khawkins98/scriptoscope/issues/256))

- Solid push and bevel faces with explicit cinf metadata now use square corners,
  independent masked edge bands and the source-defined inset-union body fill.
  Pattern-backed faces and list headers remain tracked separately under #218.

- Decode indexed pixel patterns using their explicit color-table offset and
  flag-dependent pixel-value mapping; unsupported destination-palette tables
  are skipped instead of using unrelated stored RGB colors.

- Fixed Firefox startup in the extended rendering workflow by matching the
  container user to its mounted home. Browser launch preflight now fails before
  running the matrix; optional focused workflow reruns retain the full default.

- Slider canvases retain the complete authored thumb cell and center the groove
  and thumb across their combined thickness, fixing clipped Windows 95 handles
  in horizontal and vertical orientations (refs #222).

- Corrected the rendering matrix tab fixture to place the tab strip before its
  panels, matching consumer markup and avoiding a misleading contact-sheet layout.

- Default-button rings use the original four-pixel outset, complete source raster,
  square corners, and independently thick masked edge bands. Pressed defaults
  select their authored ring when available. This removes Windows 95's detached
  bracket and preserves overlapping ring art in schemes such as 1990.

- Promoted selects keep one native keyboard target and show its focus indicator
  on the visible wrapper. Decorative faces stay out of the tab order and
  accessibility tree when their selected label is repainted.

- Solid button, bevel, and list-header faces sample their authored cinf background
  pixel instead of a guessed offset from the text marker. Windows 95 normal and
  disabled faces now use the source gray rather than white border pixels. Face
  fallbacks retain the selected resource's own slicing/sample metadata.

- Scope the optional window shadow to the actual rendered window part, including
  imperative windows and hosts stretched by consumer grid/flex layouts. Promoted buttons, selects, and checkables no longer receive an extra
  rectangular shadow over their scheme-authored art (related to #207).

- Share Scene info-bar background/text resolution between the diagnostic and its
  audit so textured bars report their actual black label instead of unused dark
  header-fill contrast. Rendering precedence stays unchanged (related to #183).

- Gate the boot wipe on inert targets so pending window content stays visible
  while keyboard focus remains available.

- Inventory every source resource in extraction diagnostics, with explicit skipped
  types, consumed header palettes, and totals that match the resource fork (#179).

- Tiny resizable button templates now use the standard face height when their
  label would otherwise be clipped. Fixes squashed Windows 95 showcase buttons
  and closed selects, including the press-state size jump; Apple Lisa and Windows
  3.1 push-button templates and undersized bevel labels receive the same general
  correction. Explicit heights are preserved.
  ([#207](https://github.com/khawkins98/scriptoscope/issues/207))

- Include lazy library chunks in the public deployment, extract archive-only
  themes locally, and release picker listeners/timers on teardown. Repair the
  boot smoke harness's server and browser cleanup.
  ([#192](https://github.com/khawkins98/scriptoscope/pull/192))
- Resolve utility-window aliases from canonical resource identity, including
  opaque asset URLs and legacy raw keys.
  ([#195](https://github.com/khawkins98/scriptoscope/pull/195))
- Evict rejected theme/raster promises to permit retry, and release assets from
  partially failed concurrent encodes.
  ([#196](https://github.com/khawkins98/scriptoscope/pull/196))
- Allocate whole tiles with the kDEF's two-pass division/remainder rules,
  preserving frame corners and avoiding rounding-induced gaps or clipping.
  ([#197](https://github.com/khawkins98/scriptoscope/pull/197))
- Prefer each theme's own button face before inheriting a base theme's named face.
  ([#200](https://github.com/khawkins98/scriptoscope/pull/200))
- Prepare window chrome before moving live content. Preserve layout/focus during
  setup and respect cancellation, removal, reparenting, failure, and immediate
  remount without stale commits.
  ([#199](https://github.com/khawkins98/scriptoscope/pull/199))
- Evict released raster URLs across raw and bundled loader copies; late loads
  clean up after disconnect without disposing caller-registered theme graphs.
  ([#202](https://github.com/khawkins98/scriptoscope/pull/202))
- Capture the diagnostic Scene using an isolated server and compare fresh scratch
  captures against committed fixtures. Refresh all 18 browser scene baselines;
  failed verification never overwrites them.
  ([#203](https://github.com/khawkins98/scriptoscope/pull/203))
- Constrain mobile showcase/blog grids and upload-modal measurements, reserve
  room for native chrome and card cascades, and keep Restore chrome mounted.
  ([#205](https://github.com/khawkins98/scriptoscope/pull/205))

### Security (2026-10-18)

- Refresh locked development dependency security patches and upgrade the vulnerable
  Vite/esbuild toolchain through the Vite 7 migration.
  ([#193](https://github.com/khawkins98/scriptoscope/pull/193),
  [#194](https://github.com/khawkins98/scriptoscope/pull/194))

### Fixed (rendering — 18 themes refreshed via the codex pattern, 2026-05-29)

The decoded `ThemeManifest` carries structured answers for every visual slot;
the runtime was guessing or hardcoding in many places. The fixes below all
share the same shape: **read the manifest field instead**. Captured in
`LEARNINGS.md`'s "codex pattern" entry as a 16-row table.

- `controls.ts:elementById` — resolve by `chromeElement.sourceCicnId` (numeric)
  instead of regex-on-asset-path. Asset paths become `blob:` URLs under the
  Option A in-memory load; the regex matched nothing, every `elementById` call
  returned null, buttons / default-rings / textAnchors silently un-themed.
- Default-button ring outset uses `(ring.width - face.width) / 2` (the
  artist-authored halo) when ring > face, instead of `ring.width / 4`. Crayon-os
  (ring 80×80 / face 74×74) went from 20px outset to the authored 3.
- `pixelBuffer.nineSlice` honours `slice.tile: true` (repeat side bands at
  native pixel rate rather than stretching). Wired into `composeFaceButton` +
  ring + `composeProgress` frame + `composeTab` middle + `composeScrollbar` +
  `composeSlider` tracks. Apple-lisa Lisa-frame, windows-31 double-rectangle
  border, crayon-os crayon-stroke patterns all preserved at button-display size.
- `pixelBuffer.nineSlice` honours `slice.side` for vertical inset (was
  collapsed to corner=side everywhere). The kDEF TMPL 129 declares them
  independently; 1138 / 1984 / animals / apple-lisa / dolphin-som etc. all
  have button-family elements with non-square slices.
- `pixelBuffer.nineSlice` clamps `(l+r) ≤ sr.w` and `(t+b) ≤ sr.h` —
  unclamped, the negative middle silently corrupted (corner blits overlapped,
  side spans early-returned) on 1990 + evolution rings authored as 21×21 with
  `slice.side=14`. The buggy renders briefly shipped before this clamp.
- `composeChrome.titleFillRgb` samples the kDEF 0x5530 title-text marker
  pixel; `renderWindow` uses the sampled colour when it contrasts with the
  bar (|markerLum − barLum| > 40), else falls back to the luminance-contrast
  B/W pick. Windows-31 "Hello!" now draws (the marker pixel sits on the dark
  blue title bg; contrast-rejection routes to the white fallback).
- `resolveTitleWidgetRects` maps source-x widget positions through the
  per-cell placement record to output-x. 1990's widgets stacked left of a
  growable title plate were claimed to be at source x=56-64 when the plate's
  growth had shifted them to output x≈92-100; the title-fit math saw negative
  available width and dropped the title. The `mapX(sx)` per-cell mapping now
  produces correct output positions; 1990 / apple-lisa / windows-31 "Hello!"
  all render.
- `loadTheme` preserves `bundleUrl` as `theme.baseUrl` (was `''` under
  Option A's in-memory decode). The empty key collapsed every theme into the
  first-loaded theme's slot in `_gridCache` / `_iconCache` /
  `interactive.titleStripCache` — 1138's folder icons leaked into 1984's
  Scene preview.

### Fixed (controls — push-button face resolves by manifest role, 2026-05-29)

- `composeButton` now resolves the push-button face via the manifest's
  STRUCTURED chromeElement key (`push-button-active` / `active-push-button`
  / `active-button` / `push-button`) first; falls back to id-based lookup
  that REJECTS anti-role keys (`/menu|tab-pane|pull-down|popup|window|dialog|scroll/`).
  When no active face exists, substitutes the pressed face — the
  AppearanceManager's documented "empty state slot" fallback. Resolves the
  long-deferred **monkey-paradise + animals** misroute: both bundles assign
  id -10239 to `solo-menu-background-2` and ship NO active push-button cicn
  (only pressed + inactive). Their OK button slot rendered menu wallpaper;
  it now renders the pressed-button face the author shipped. Logged in the
  kdef faithfulness ledger as an Accepted Divergence.

### Fixed (Scene composition — `demo/index.html` + slot wiring)

- Info bar lookup: `chromeElement(-9567).bgPattern` → `bodyBackground.pattern`
  → `headerColors.active.fill` → flat. Replaces the hardcoded `#e6e6e6`.
  Every theme now lands above the hard fallback. monkey-paradise's
  `ppat-129` (declared via cinf), 1990's army-camo, slimes' lemon-lime
  header fill — all picked up from the structured field rather than guessed.
- Volume icon lookup: `ics4/8 -3790` → `ics4/8 -14336` → `FINDER_GRID_PNG`.
  Slimes / floppies / apple-platinum-2 / platinum-8 / system7-nostalgia-
  silver pick up their theme-mark on `-14336` when `-3790` isn't shipped.
- Info-bar text colour contrast-picks against the resolved background
  luminance instead of hardcoded `#000`. Black-platinum / Windows-ports
  dark fills are legible now.
- `schemeIcons` excludes well-known document ids (Clippings -3800..-3803,
  Edition File -3989, App badge -16455) from coverage-rank, and drops the
  non-folder last-resort ids from the folder priority list. Apple-platinum-2
  + system7-nostalgia-silver fall through to neutral SVG folders instead
  of showing the Earth icon / App badge.
- Desktop pattern: adds `ppat-17` (Apple-reserved Mac OS canonical id) as
  T2 in the lookup. 1990 / animals / monkey-paradise / evolution / crayon-os
  ship it; previously fell to the CSS checkerboard.
- `renderWindow.bodyBackgroundStyle` skips the Icon-View ppat for modal-
  style windowTypes (`UTILITY_SLUG_RE = /utility|mini|floating|palette|dialog|alert|modal|popup/`).
  The Options dialog body across every textured-body theme stopped filling
  with the army-camo / aqua / etc and now matches the references' flat
  utility surface.
- 3-tone procedural pinstripe via `lightTinge → fill → darkTinge` (was
  only `darkTinge`; `lightTinge` was decoded but unconsumed). Only the
  `buildBaselineWindow` procedural path is affected; corner-sprite + sliced
  paths use their own pinstripe sprites.
- Scene geometry: `winW: 178 → 220` so multi-word volume names fit;
  `dlgTop: mainTop + 2` so the Options dialog stops covering windows-31's
  title bar entirely.

### Fixed (loadTheme + cascade hardening)

- `fetchFirst` rejects 200-with-bad-bytes (HTML SPA fallback) and continues
  the `.sit → .rsrc` cascade. Without it, a misconfigured CDN serving HTML
  for missing files made `parseResourceFork` explode with
  `dataOffset=1008813135` instead of falling through.
- `loadKaleidoscopeScheme` default asset factory adds a main-thread
  `<canvas>` fallback for Safari 16.0–16.3 (where `OffscreenCanvas` is
  undefined). Without it, ~5% of iOS traffic returned a broken `LoadedTheme`
  with un-rewritten asset paths.

### Added

- **Codex framework** — three coupled artifacts for "stop guessing, read
  the manifest field" discipline:
  - `scripts/scene-coverage-audit.mjs` — walks every bundle's decoded
    manifest, runs each Scene SLOT's tier resolver, prints per-theme
    table; modes: console / `--write` / `--json` / `--check` / `--theme=`.
  - `docs/scene-slot-spec.md` — hand-authored slot contract: 8 slots
    each with tier hierarchy, why each tier exists, where the runtime /
    demo implements it.
  - `docs/scene-codex.md` — auto-generated; committed; the corpus-wide
    audit. Per-theme tier table + tier distribution per slot + shipped
    resource counts + variant flags.
- `tests/visual-baselines/scenes/<slug>.png` — committed Scene-panel
  fixtures per theme. Regen via `npm run baseline:scenes`. Eyeball
  comparison net against the per-theme reference for "the path ran but
  produced empty / wrong-looking output" regressions (lint can't catch).
- `themes/lint-baseline.json` — sha256 + decoded-manifest fingerprint
  per slug from the maintainer's last full lint run. Default
  `npm run lint:themes` is fast-verify against this baseline;
  `--update` re-runs the slow rule walk; `--strict` re-decodes + checks
  the decoded fingerprint (CI signal).
- `npm run audit:scenes` — codex audit; `-- --check` is the CI signal
  for slot floor.
- `npm run baseline:scenes` — re-capture all 18 scene fixtures.
- New `ChromeElement` type fields, JSDoc-documented: `sourceCicnId`,
  `sourceCinfId`, `bgPattern`, `bgAnchor`, `embossAnchor`.
- New `ThemeManifest.patterns` field — the catalog of decoded ppats
  keyed by slug.
- New `ThemeProgressModel`, `ThemeScrollArrowMap` types covering the
  inspector catalog's role-classification shapes.
- `ButtonOptions.height` — caller-supplied override for the button face
  height. Without it, themes with big face cicns (crayon-os 74×74) blow
  up to 80-tall buttons. The demo passes `height: 22` for tab-sized
  cells.
- `LoadedTheme.dispose?: () => void` — revokes blob: URLs minted at
  decode (~500 per scheme). Without it, switching themes 50× leaks
  ~25k blob URLs.
- `loadTheme(url, opts.source?: string)` — hint to skip the
  `.sit → .rsrc` cascade. Catalog's `themes-manifest.json` carries
  the `source` field per slug; demo's `loadWithBase` passes it.

### Changed (renderer surface)

- `composeChrome` returns new `titleFillRgb` field on `ComposedChrome`
  (the sampled marker colour or null). Backwards-compat (optional).
- `bodyBackgroundStyle` now takes an optional `slug` parameter so it
  can gate the Icon-View ppat by windowType. Shared
  `UTILITY_SLUG_RE` between `renderWindow` and the body-bg style.

### Changed

- **Theme bundles ship only the original archive** (Option A migration, 2026-05-29).
  Per-bundle contents went from `{scheme.rsrc, theme.json, cicns/, ppats/, icons/,
  resource-roles.json, rasters.json, extraction-manifest.json, meta.json, PROVENANCE.md}`
  to just `{scheme.sit | scheme.rsrc, meta.json, PROVENANCE.md}`. The runtime decodes
  the archive in-browser via the bundled StuffIt + Kaleidoscope decoders — same path
  the demo's drop-zone has used since 2026-05-27. Repo footprint dropped from ~55 MB
  to 6.3 MB across 18 bundles. Per-bundle wire weight halved (the `.sit` averages
  ~30–50% of the unwrapped fork size). Per-load decode cost ~234 ms on a fast machine
  (Promise.all-parallelised OffscreenCanvas encoding); cached after first hit.
- **`loadTheme(bundleUrl, opts?)` gains `opts.source`** — a hint that names which file
  to fetch (`'scheme.sit' | 'scheme.rsrc' | string`). Skips the cascade and the 404
  noise when a bundle ships only one form. The demo reads it from `themes-manifest.json`'s
  new `source` field per slug.
- **Control resolution uses `chromeElement.sourceCicnId` rather than parsing the asset path.**
  Path strings get rewritten to `blob:` URLs by `rewriteAssetRefs`, so the old
  `/cicn-n?-?(\d+)/` regex broke silently — every `elementById` call returned null and
  default-button rings / scrollbar arrows / textAnchors went un-themed. The decoder
  already writes `sourceCicnId` on every element; the runtime now reads it directly.
  Full story in `LEARNINGS.md`'s 2026-05-29 entry.
- **`loadTheme` preserves the consumer-passed URL as `theme.baseUrl`** instead of
  inheriting the decoder's `''` default — `interactive.ts`'s title-strip cache and
  the demo's per-theme icon caches key on `baseUrl`, so an empty key was collapsing
  every theme into the first-loaded theme's identity (1138's folder icons leaking
  into 1984's Scene preview).

### Added

- **In-memory inspector catalog** on `LoadedTheme.inspector` — `iconIndex` + `cicns` +
  `ppats` + `resourceRoles`, each with baked-in blob URLs. Mirrors the on-disk shapes
  the demo's diagnostic panels used to fetch (`icons/index.json`, `rasters.json`,
  `resource-roles.json`). Built by `loadKaleidoscopeScheme` for browser callers; pure
  JS, no extra fetches.
- **`loadKaleidoscopeScheme` re-exported from `'scriptoscope'`** — the in-browser
  `.sit`/`.rsrc` decoder is reachable through the npm-package entry without crossing
  into `tools/theme-loader/` paths. Returns the same `LoadedTheme` `loadTheme` does.
- **`tests/visual-baselines/scenes/<slug>.png`** — committed Scene-panel fixtures per
  theme. Regen via `npm run baseline:scenes`. Eyeball comparison net for renderer
  regressions of the un-themed-but-no-error class.
- **`themes/lint-baseline.json`** — committed sha256 + status per slug from the
  maintainer's last full lint run. Default `npm run lint:themes` is a fast verify
  pass against this baseline; `--update` re-runs the slow rule walk; `--strict`
  exits 1 on drift (CI signal).
- **`tools/theme-loader/classifyResources.js`** — the portable id → role rubric,
  shared between the bake pipeline and the runtime inspector. Closes the dual-channel
  trap (same id different roles per scheme + per cicn/ics4 channel).
- **`fetchFirst` cascade hardening** in `loadTheme` — rejects 200-with-bad-bytes (HTML
  SPA fallback responses) and continues to the `.rsrc` alternative, instead of
  consuming the HTML and exploding deep in `parseResourceFork`.

### Removed

- `apple-platinum-replica` bundle — was a generated universal base that retired when
  the in-memory decode replaced its main consumer (the sparse-bundle inheritance hop).
  `mountDeclarative({ baseSlug })` callers can pick any other shipped slug as the base.
- The on-disk parity test in `tools/theme-loader/convert.test.mjs`. The replacement is
  the in-memory shape test (asserts every asset rewrites to a URL, inspector populates)
  + the lint baseline sha256.

## [0.0.1] — 2026-05-28

**First publish-prep cut.** No code changes from the prior committed state — this is the
mechanical packaging pass that gets the project on npm. The runtime is already feature-rich
(Phase 3 controls vocabulary shipped; declarative front door + Shadow DOM + persistence +
themed scrollbars + tabs + text fields + a four-page demo suite); this version exists so
consumers can `npm install scriptoscope` and start integrating.

### Renamed

- Project: **Aaron UI → Scriptoscope**. Rationale + scope in `LEARNINGS.md` 2026-05-28
  ("Scriptoscope pivot"). Forcing function: the `aaron-ui` npm name was taken by an
  unrelated package, so the publish couldn't go bare under the prior brand.
- Package: `scriptoscope` (was `aaron-ui`, never published under that name).
- Build artifacts: `dist/aaron-ui.js` → `dist/scriptoscope.js`, `src/aaron-ui.css` →
  `src/scriptoscope.css`, exports map updated.
- The GitHub repo (`khawkins98/aaron-ui`) and the GH Pages URL (`/aaron-ui/`) stay as-is
  for now — independent pivot, not coupled to the npm rename.

### Preserved (deliberate API stability)

- `data-aaron-*` consumer attribute namespace (window/title/x/y/width/height/state/
  button/default/control/field/tabs/etc.). Renaming this would be an API break with
  marginal brand value.
- `.aw-*` CSS class prefix (`.aw-window`, `.aw-content`, `.aw-button`, `.aw-chrome`, etc.).
- `AaronWindow` class name, exported from the declarative entry.
- Same model as underscore.js → Lodash keeping `_`.

### Tarball scope

- Slim: `dist/` + `README.md` + `LICENSE` + `CHANGELOG.md`. **NOT** included: `src/`,
  `themes/`, `PRD.md`, `LEARNINGS.md`, `docs/`, `tools/`. Consumers use the built
  `dist/scriptoscope.js` and fetch themes from a base URL they host. Packaged size:
  ~239 KB; unpacked ~782 KB (sourcemaps + .d.ts.map files account for the bulk of the
  unpacked footprint — kept for IDE jump-to-definition).

### License

- MIT (decided in #26; first-party code only). The slim tarball ships only `dist/` + the
  three top-level docs, so per-scheme freeware terms (themes), munbox MIT (sit-wasm),
  and demo-font terms (CC BY-SA / free-with-credit) are repo-level concerns — relevant
  for source-tree contributors, not consumers of the published package.

### Status

- Pre-alpha. The declarative API surface is the most stable; the imperative API
  (`loadTheme()`, `renderWindow()`, `WindowManager`) is also stable but may grow.
- 0.0.x cadence intentional — see `LEARNINGS.md` for the prototype-mode commit-cadence rule.

[Unreleased]: https://github.com/khawkins98/aaron-ui/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/khawkins98/aaron-ui/releases/tag/v0.0.1
