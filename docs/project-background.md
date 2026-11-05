# Why Scriptoscope exists

Kaleidoscope, by Greg Landweber and Arlo Rose, let classic Mac users replace
window chrome with community-authored schemes. Scriptoscope reads the same
binary resource forks and renders the frames, controls and patterns in a browser.
It preserves the original scheme artwork while keeping page content as real DOM.
The goal is a web-native window manager and theme engine, not a Macintosh emulator.

The project began as Aaron UI, named after Landweber’s earlier extension, and
became Scriptoscope on 2026-05-28. The [project history](./history.md) records the
architecture generations and retired approaches; [ADR-0001](./adr/0001-consumption-architecture.md)
explains the DOM-plus-canvas design. The original product direction grew out of
[cv-mac #24](https://github.com/khawkins98/cv-mac/issues/24),
[cv-mac #25](https://github.com/khawkins98/cv-mac/issues/25) and
[classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229).

## Preservation and attribution

The runtime is a clean-room reimplementation. No original Kaleidoscope code
ships or executes as Scriptoscope’s runtime. Research and native reference
captures have a separate role; consult [CONTRIBUTING](../CONTRIBUTING.md) for the
project’s implementation and evidence rules.

Community schemes are third-party material, not MIT-licensed project code.
Each [theme bundle](../themes/) retains its source archive, `meta.json` and
`PROVENANCE.md`, including the original author’s stated terms. The project’s
preservation policy includes removal on an author’s request. The maintainer has
attempted to contact the original Kaleidoscope authors and scheme creators;
if you can help reach them, contact <khawkins98@gmail.com>.

[Mac Themes Garden](https://macthemes.garden/) and the
[Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) preserve schemes
and reference images. The [acknowledgements](../demo/acknowledgements.html) collect
credits for archives, artwork, fonts and supporting tools.

The StuffIt decoder under [tools/sit-wasm](../tools/sit-wasm/) uses the MIT-licensed
munbox library and carries its own license for standalone use. Demo fonts retain
the license files alongside them: Instrument Serif and Cormorant Garamond use
SIL OFL 1.1; Charcoal 12 is Jeremy Sachs’ CC BY-SA bitmap; Virtue is by Marty
Pfeiffer under its author’s terms.

## Understand the rendering evidence

Regression screenshots show whether output changed. Independent, source-backed
expectations and original references with matching inputs are needed to assess
fidelity. A scoped observation does not certify unobserved states, typography,
masks, private painter selection or a complete original-engine request.

Use the [fidelity verification plan](./spec/fidelity-verification-plan.md),
[faithfulness ledger](./spec/kdef-faithfulness-ledger.md),
[reference intake](../tests/reference-captures/README.md) and
[original-reference inventory](../tests/reference-captures/ORIGINALS.md) for the
contracts and unresolved evidence. [Resource-byte provenance](./spec/resource-byte-provenance.md)
establishes input identity, separately from independent decoder correctness.
The [acceptance inventory proposal](./spec/acceptance-inventory-proposal.md) and
[pinned emulator reproduction](./research/emulator-build-reproduction/2026-10-19/README.md)
record their own scope and limits. Maintainers may use the optional
[private reference environment](./maintainer-reference-environment.md); public CI
does not require access.

## Follow implementation work

Milestones and active review belong in the
[issue tracker](https://github.com/khawkins98/scriptoscope/issues),
[release notes](../CHANGELOG.md) and [integration decisions](./v2/DECISIONS.md),
rather than the installation instructions. Runtime contributors start with the
[implementer brief](./spec/engine/IMPLEMENTER-BRIEF.md); its restricted read scope
overrides the research links on this page.

For specific proposals, the existing trackers cover
[menus](https://github.com/khawkins98/scriptoscope/issues/166),
[Appearance Manager import](https://github.com/khawkins98/scriptoscope/issues/174),
[conversion tooling](https://github.com/khawkins98/scriptoscope/issues/176),
[variants and bonus assets](https://github.com/khawkins98/scriptoscope/issues/177),
[state coverage](https://github.com/khawkins98/scriptoscope/issues/178),
[custom elements](https://github.com/khawkins98/scriptoscope/issues/29) and
[rendering fidelity](https://github.com/khawkins98/scriptoscope/issues/221).
These links are entry points, not promises that the features will ship.
