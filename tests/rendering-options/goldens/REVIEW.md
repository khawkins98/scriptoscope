# Reviewed regression seed — 2026-10-18

These 36 images record Scriptoscope output, not original-engine reference images.
Approval includes the explicit mismatches and unknowns in
[KNOWN-LIMITS.md](../KNOWN-LIMITS.md), particularly #218 and #223. Their presence
in a regression baseline does not certify historical fidelity or interaction
semantics.

The frozen capture commit is `c7899553cc41c024800c3f74354becfb83c134fa`, after
the grouped-tab fixture correction (#224) and complete slider-thumb retention
(#225). [Capture run 39109292259](https://github.com/khawkins98/scriptoscope/actions/runs/39109292259)
recorded all 36 pages, then passed a fresh exact comparison of all 36. The
committed PNGs and manifest are the downloaded bytes from that run. Later seed,
documentation and workflow commits are not the capture provenance.

The [manifest](./manifest.json) records Linux/amd64, Chromium 156.0.8078.4,
Playwright 1.64.0, the immutable container image, fonts, source archives, case
inventory and capture bundle/CSS/lockfile hashes. The runtime bundle SHA256 is
`cd40a517c956fae88331607e652ff0ba4429f44cd54459b1308ec79f0acd139a`.

Frontend and PM reviews covered both pages for all 18 themes; an independent
runtime review also checked Windows95/System7 buttons, grouped tabs and complete
slider cells. All nine first-half page1 images and nine second-half page1 images
were unchanged from the earlier reviewed capture. Page2 changes were inspected
for the corrected tab layout and slider geometry. No additional unexplained
regression blocked this seed. The earlier run 39106614957 was not approved as a
seed because its fixture and clipped slider outputs still needed correction.

The successful verification retained 36 complete page observations covering 1,260
cases: 1,168 rendered and 92 unavailable. Those counts describe execution, not
independently established resource availability. The 42 browser contracts provide
separate source-art, geometry, label-ink, DOM and keyboard evidence.

[Verification proof run 39109820394](https://github.com/khawkins98/scriptoscope/actions/runs/39109820394)
ran from later seed head `f615727524a9ad6a3f0134b1ea17635fc765e188` with recording
disabled. All 36 committed sheets passed. Separate selected-sheet probes failed
for the missing manifest, missing PNG and exactly one changed opaque pixel.
Verification did not create/update expected files; their original SHA256 values
were restored and the restored sheet passed. Expected/actual/diff evidence and
failure logs are retained in that run's negative-verification artifact.

## Reviewed solid-face delta — PR233

[Capture run 39110776093](https://github.com/khawkins98/scriptoscope/actions/runs/39110776093)
records runtime commit `777262945ed0f57733bc98136f3708ba7ba5fe1b`. All 36 pages
were recorded and then passed a fresh exact comparison. The current manifest
records this capture; its environment, case inventory, source archives, stylesheet
and lockfile identities are unchanged from the seed. The bundle SHA256 is now
`6e68ee4e7e52662b7a859d0c6fe68d21184d198260fe85e97383a34cd12c4fec`.

Only six PNGs change; the other 30 remain byte-identical:

| Sheet | Changed pixels | Reviewed change |
|---|---:|---|
| 1984 page 1 | 2,216 | First-strip edge sampling on push/default faces |
| 1984 page 2 | 632 | The same face correction on closed selects/custom foreground |
| Apple Lisa page 1 | 436 | Authored square corner blocks retained on push/default faces |
| Apple Lisa page 2 | 130 | The same corner correction on closed selects/custom foreground |
| Evolution page 1 | 90 | Independent bevel bands remove incorrect edge patches |
| Floppies page 1 | 2 | Tiny-height masked corner overlap |

Every changed region was reviewed in before/after/diff crops at integer zoom.
No unrelated text, layout, resource selection or reference-art changes were seen.
The same four theme deltas were independently inspected in a 1,296-render corpus
probe; all list-header and Crayon pattern cases in that probe were unchanged.

This update follows the independent source-coordinate and masked-overlap
requirements in [control-face geometry](../../../docs/spec/control-face-geometry.md)
and `face-bands.spec.mjs` (120 source/built cases). The screenshots are regression
expectations, not the correctness oracle for the new painter. #218 remains open
for pattern-backed/list-header/legacy faces and text policies, and #223 and the
other explicitly recorded unknowns remain unresolved.

## Reviewed direct body and label delta — 2026-10-18

[Capture run 39138845407](https://github.com/khawkins98/scriptoscope/actions/runs/39138845407)
records commit `327fda1f` (full identity in the manifest). It recorded all 36
pages and then passed exact repeat verification. Only the final combined output
is adopted: the earlier text-only candidate at `322910b5` was not approved for
publication because Crayon's authored dark text still sat on the old incorrect
purple body. Separate implementation commits preserve review of both corrections.

The combined delta changes 26 sheets, 90,472 pixels within 187 case bounds;
all sheet dimensions and case ordering are unchanged. Of these changed cases,
115 have direct resolution traces and 72 declarative integration cases do not.
The untraced cases are not assigned invented resource provenance.

The text-stage review independently joined 111 changed direct traces to raw
RGB16 samples, exact cicn/cinf payload identities, the declared display transform
and source emboss decisions. All 342 text decision records remain identical
between that intermediate candidate and the final combined capture. Against the
text-only images, body changes are confined to Animals page1 (371 pixels),
Crayon page1 (22,532 pixels) and Crayon page2 (5,701 pixels). The final review
covers their actual pattern choices, continuous inset fill and preserved label
placement. Crayon's normal/disabled bodies now use the cream pattern with authored
dark/gray text; its pressed body and dark text retain their source colors.

Independent hand-encoded palette/sentinel fixtures, literal asymmetric tile
rows, exclusive-corner/port-clip assertions, numeric-name occurrence-order
negatives, pinned actual Crayon paint dependencies and cancellation tests supply
the correctness evidence. The sheets remain regression expectations. Full
QuickDraw text transfer, original device color/palette, managed port propagation
(#270), mode5 color-icon bodies and list-header/tab behavior are not certified by
this update. See [known limits](../KNOWN-LIMITS.md) and the
[direct pattern](../../../docs/spec/control-pattern-context.md) and
[text sample](../../../docs/spec/control-text-colors.md) contracts.


## Reviewed CDEF 8 tab body delta — 2026-10-18

[Capture run 39143358902](https://github.com/khawkins98/scriptoscope/actions/runs/39143358902)
records runtime commit `a7b46ecb` (full provenance retained in the manifest).
All 36 pages passed exact repeat verification. Independent automated root and
Astra review inspected all 13 changed page-2 sheets: 24,872 pixels inside 78 tab
cases (52 direct, 26 declarative), with unchanged alpha and sheet dimensions.
The other 23 sheets are unchanged, including Crayon's retained legacy pattern
center. No tab paint-resolution trace is exposed; expected catalog source
bindings are separate evidence, not observed painting dependencies.

Changes follow the pinned CDEF 8 full-source end strips, first-column/native-tile
bands and separate solid-center contract. Hand-written literal rows, prior-code
negative tests, and exact pinned 1138/1990 source-coordinate assertions establish
the bounded body requirement independently of these regression images. The
AgjpQy checks exclude the current browser glyph ink rather than certifying fonts.
No unexplained delta was identified. Original typography, variant selection,
pattern-center phase, full layout and device/transfer behavior remain open;
these snapshots do not certify whole tabs or historical reference equality.


## Reviewed mixed CICN selection delta — 2026-10-19

[Capture run 39234502164](https://github.com/khawkins98/scriptoscope/actions/runs/39234502164) records frozen runtime commit `232d56001eaa4ed197541f52d860cc480c32d317`, bundle SHA-256 `95cd7c890607356de85c8c8a6fa6055262b598b4d0f86d3584144984901606a3`. All 36 pages were recorded and passed fresh exact repeat verification in the same pinned Linux environment. The later parser-parent squash rebase preserved the entire capture tree.

Independent frontend and PM review inspected all 26 changed before/after/diff crops. Exactly 1,861 pixels change, entirely within direct mixed checkbox/radio cells; the other 10 PNGs are byte-identical. All card/sheet bounds, cases, fonts, source archives and environment remain unchanged. Prepared artwork and retained output were checked against the pinned archives. Monkey Paradise radio selects a 12×12 mixed image instead of its former 13×13 off image: the unchanged layout policy narrows the canvas from 155×13 to 154×12 and shifts the label left/up by one pixel. Its aligned label mask is exact; antialias differences follow the stationary checkerboard. No unexplained change was found.

Correctness comes from independently reviewed kDEF `7234–7282`: value 2 selects mixed art and a miss retries value 1 in the same kind/state tier. Thirty owned cases per source/built runtime separately pin literal IDs, payload/occurrence identities and complete output, with missing-art and compatibility fallbacks explicit. These sheets expose no checkable paint-resolution trace; expected source artwork is not relabeled as an observed historical provider. Mixed-overrides-checked is modern API mapping, later active-checked/icon fallbacks are compatibility policy, and original provider/cache, decoder/device, typography and whole-control fidelity remain unresolved. This is regression-baseline approval only.


## Reviewed normal checkable icon delta — 2026-10-19

[Capture run 39240330593](https://github.com/khawkins98/scriptoscope/actions/runs/39240330593) records runtime commit `e3036225f9e04a7e43563f243fb52fe9250f356e`, bundle SHA-256 `5a902fad8582f9802c1fd6b1d89dc55c8d77d1a998a60451fc21593a01ebbc7a`. All 36 pages passed recording and fresh exact verification in the pinned Linux environment. Reviewed manifest SHA-256: `670237dc404c25387ec95221daf90f45b7400c7093fd826c7f339ba9e71f5296`.

Independent automated frontend and PM review inspected all 50 before/after/diff crops in 10 changed sheets: 4,159 pixels, entirely within stationary 16×16 normal/checked/mixed checkable glyph bounds for Apple Platinum 2, Black Platinum, Platinum 8, Slimes and System7 Nostalgia Silver. All sheet/card bounds, labels, layout and disabled cells are unchanged. The other 26 PNGs are byte-identical, including CICN themes. Expected old/new prepared ics8 artwork, mask declarations and archive hashes were independently checked; no unexplained change was found.

The pinned source table and mask-dependent retry are documented in [checkable-icons.md](../../../docs/spec/checkable-icons.md). Fifty-four owned cases per source/built runtime independently check literal row IDs, actual mask availability, decoded color occurrence/URL and complete output; retained before-results demonstrate both the normal/pressed row error and missing-mask retry. These sheets expose no checkable paint-resolution trace. Expected prepared-art comparisons do not establish historical provider order, native depth selection, decoder/device completeness, placement or typography. Manual no-inspector fallback remains unobserved compatibility. This approves regression baselines without promoting original-reference or ledger status.


## Reviewed canonical push-face selection delta — 2026-10-19

[Capture run 39277518754](https://github.com/khawkins98/scriptoscope/actions/runs/39277518754) produced candidates at commit `e3480b9dc6a67c4b54ad63ef34ee7a8fcbc20a29`, bundle SHA-256 `d3e23f97698cff6ec331beab04bb4c6255efe2e67f817317abac6b97529bea55`. The artifact contains all 36 complete ordinary-verification page observations in the pinned Linux environment; whole-workflow completion is tracked separately. Manifest SHA-256: `c68383022237a33853a6dda4ccc01aabefda58a29136bb07560580ad2db3aa7f`.

Independent automated frontend and PM review inspected all 22 changed before/after/diff cells. Exactly four Animals/Monkey Paradise sheets change, totaling 44,682 pixels; the other 32 PNGs are byte-identical. All 1,260 case statuses, canvas sizes and control rectangles remain unchanged. Normal push/default/select surfaces now use their canonical patterned normal artwork instead of the pressed green face. No unexplained visual delta was identified.

The original numeric state dispatch, rather than interpretation of resource labels, establishes selection; see [push-button-selection.md](../../../docs/spec/push-button-selection.md). Separate source/built checks match fifteen independently reviewed recorded empty faces, including Animals, under their explicit measured conditions. Monkey Paradise selection is source-backed, without an independent native pixel claim. These sheets remain regression baselines: fonts, masks, phase, providers/cache and whole-control historical fidelity are not certified.


## Reviewed window action and shell-shadow delta — 2026-10-20

[Capture run 39432211514](https://github.com/khawkins98/scriptoscope/actions/runs/39432211514) recorded and exactly verified all 36 sheets at commit `20690f31397396c175b017a5370cf39868201322`, bundle SHA-256 `7ae92ddbaee4ee8ea0dbdb3dd61216f681ea8c30cd89ad3bd121a7fa921693c7`, stylesheet SHA-256 `f675b1e9af7e6c337a58f5af8199444227605d4c9973474cf4ead2a85e04b087`. Manifest SHA-256: `9fb5c161876451e8d3f42ea9e3d9c73308490db2169b3197e51925c64e8ef67c`. The pinned Linux environment matches the previous reviewed baseline.

Independent automated frontend and PM review inspected all 62 unique before/after/diff strips. All 36 sheets change: 375,020 pixels within 306 window-bearing cells. The rectangular CSS shadow disappears at the outer right/bottom edges; Apple Platinum 2, Black Platinum, Slimes and System7 Nostalgia Silver additionally swap their synthetic corner-sprite zoom/shade glyph positions. All 1,260 case statuses, render paths, control rectangles and canvas dimensions, plus sheet/card bounds, remain unchanged. No unexplained title, content or layout change was found.

Native `wnd#` rectangle parts 1/2/3 supply close/zoom/shade identity independently of position; separate source/built interaction tests check authored right-grouped and vertical layouts, pressed pixels, shade/restore, zoom/restore, keyboard close and restored resize controls. Corner-sprite placement and opt-in shell shadows remain modern compatibility policy. These are regression baselines, not original-engine pixel, provider, font or whole-window fidelity certification; no recorded-reference or ledger status changes.


## CANDIDATE, NOT REVIEWED: 11/14 tile-direction delta (2026-10-21)

**Status: unreviewed candidate.** These four sheets are proposed for independent
frontend/PM review. They are not approved by this section, and the PR must not
merge until a reviewer replaces this heading.

Recorded locally with `npm run test:rendering:container -- record` in the
pinned Linux/amd64 image at runtime commit `614726da2b7a4a81ce318ad893b84234afbbe609`. The run used a git worktree,
so the container could not read git and the manifest's `gitCommit` is
`null`. The bundle SHA-256 `89c2117134402f13b80d6f31a4bb8dfb8ca2de531c7e113eba3addd9b4eb66be`
identifies the runtime. A CI "Record rendering golden candidates" run can
reproduce the bytes with full provenance. Two separate records gave
byte-identical PNGs. The environment, fonts, archives and case inventory in
the manifest are unchanged. Manifest SHA-256: `e17918e68246da5a0421f8a81d75b6c29d6816397984522470ab9f4d93cbfcc7`.

Exactly four sheets change, totalling 2,924 pixels:

| sheet | changed pixels | clusters |
|---|---:|---:|
| animals page 1 | 1,148 | 28 |
| animals page 2 | 1,640 | 40 |
| monkey-paradise page 1 | 56 | 28 |
| monkey-paradise page 2 | 80 | 40 |

The other 32 PNGs are byte-identical. Every cluster is a repeated small edge
patch in a window-bearing cell: 14×5 and 14×7 at the animals bottom edge next
to the right corner, and 3×2 plus 1×1 on the monkey-paradise right edge. That
matches the five code-11/14 cells whose anchor changed. A direct composition
diff over 13,510 compositions puts all 26,034 changed chrome pixels inside
those cells and none outside them. Before/after/diff crops and the cluster list
are in the private asset store under `campaign-20261021/lanes/H/golden-candidates/`.

The source rule is [kdef231-reference.md §5.1](../../../docs/spec/kdef231-reference.md):
the `0xfeae` direction byte `(pc==11||pc==14)?0:1` anchors 11/14 at the far
end. `window-chrome-rules.mjs` checks it per direction in Node and in the
source/built browser modes. These remain regression baselines: no native
capture confirms the pixels, and there is no original-engine or ledger
promotion.
