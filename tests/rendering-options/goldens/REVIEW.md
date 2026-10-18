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
