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
