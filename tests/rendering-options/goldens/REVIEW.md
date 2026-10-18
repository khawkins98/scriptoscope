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
