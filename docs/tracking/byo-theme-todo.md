# Bring-your-own-theme — remaining work

Tracks what's left on the **in-browser drag-and-drop conversion** feature (drop a Kaleidoscope
theme → decode + render client-side). Consolidates a 3-lens review (developer advocate, technical
writer, user advocate, 2026-05-27). Companion docs: design + status in
`docs/superpowers/specs/2026-05-27-browser-conversion-design.md`; the StuffIt decoder in
`tools/sit-wasm/README.md`; consumption/grafting in `docs/adr/0001-consumption-architecture.md`.

## Shipped (working, validated)

Conversion core (`tools/theme-loader/convert.js`) · browser shell (`loadKaleidoscopeScheme`) ·
`assetUrl` blob-URL passthrough · input decoders for raw `.rsrc`, `.hqx`/MacBinary/AppleSingle·Double
(pure JS, `containers.js`), and StuffIt `.sit` (munbox→WASM, `tools/sit-wasm/`) · demo drop-zone.
Validated on real archives: classic `SIT!` method 13 byte-identical to corpus; SIT5 method 15
(multi-file) decodes to a structurally valid theme.

## Done in the review pass (2026-05-27)

- Doc-accuracy: `containers.js` `.sit` comment/throw (was "unsupported"); spike doc "built" note;
  ADR Decision 4 superseded marker; `shim.c` stack comment; README corpus list (8→10) + a
  "Bring your own theme" section; softened the "didn't otherwise exist" claim; full build-flag note.
- Code/robustness: empty-input (0-byte) guard in `loadKaleidoscopeScheme`; `index.mjs` JSDoc now
  documents `type`/`creator` as u32 OSType codes + the shared-singleton WASM instance.
- **Licensing (owner decided MIT):** root `LICENSE` (MIT, scoped away from `themes/` + munbox +
  fonts), `package.json` MIT + author, README §License rewrite, and a `tools/sit-wasm/LICENSE`.
- **sit-wasm packaging:** `tools/sit-wasm/package.json` ("stuffit-wasm", exports/files/keywords),
  `index.d.ts`, README install + runnable Node/browser examples + a `locateFile` note.
- **Drop-zone UX/a11y:** friendly error wrapping (raw text behind a `<details>`); a visible
  "preview only — not saved" note at success + in the limits line; `role=status aria-live=polite`
  on `#byo-out` + `aria-busy` during decode; plainer hint copy + a "Kaleidoscope archive" link +
  simpler `aria-label` + `accept=` on the picker.

## Open — gated (decide before building)

- **Export / save the translated theme.** Today a converted theme renders but evaporates on
  reload — no save. The shape (downloadable `.zip` bundle vs. in-page `LoadedTheme` handoff) is a
  **consumption-layer decision**, so it's deliberately sequenced *after* ADR-0001's gating spike.
  Mechanically cheap once chosen (`convertScheme` already yields `{ theme, assets }` in memory).
  *Gate: ADR-0001 gating spike.* (User advocate flagged the missing-save dead-end as the top UX gap.)
- **Grafting onto live web pages** — the unbuilt consumption layer (scanner / window-manager /
  CSS emission). See ADR-0001. *Gate: its own spike.*
- **sit-wasm as a standalone OSS release** — license + packaging now DONE (MIT, `package.json`
  "stuffit-wasm", `index.d.ts`, examples). Remaining to actually ship it:
  - **Publish to npm** (and/or split to its own repo — `repository.directory` already points here).
  - **A committed license-clean `.sit` test fixture** so the byte-identical test runs on a fresh
    clone (today both real-decode tests skip — fixtures are git-ignored `.scratch/` clean-room
    sources). Likely a synthetic minimal `SIT!` archive (method 0) generated first-party.

## Open — drop-zone UX & accessibility (remaining)

The P0/P1 items from the user-advocate review shipped (see Done above: friendly errors,
preview-only expectation, `aria-live`/`aria-busy`, plainer copy, `accept=`). Remaining:

- **P2 Dynamic multi-file disclosure** — when an archive had >1 candidate theme, say "showing the
  largest of N" in the report. Needs fork-count plumbing through `loadKaleidoscopeScheme` (or a
  second `decodeArchive` pass in the demo); the static limits line already warns it *can* happen.
- **P2 Busy spinner** — `aria-busy` is set during decode, but there's no visual spinner for a heavy
  `.sit`; the static "Converting…" text reads as frozen on large files.
- **P2 Recovery affordance** — a "try another file" / dismiss control after an error.

## Open — decoder coverage & robustness (the real edges)

- **`.sitx` (StuffIt X)** unsupported — munbox scope. A dropped `.sitx` now fails *gracefully* (the
  friendly error names `.sitx` as a likely cause). A *dedicated* detector (route `.sitx` to a
  specific message) needs a real `.sitx` sample to confirm its magic — don't guess the format.
- **Multi-file `.sit` selection is a heuristic** — "largest resource fork = the scheme." Robust for
  the corpus, not guaranteed. A content-aware pick (which fork parses as a valid scheme) would be
  stronger.
- **Nested wrappers** (`.sit.hqx`, `.sit.bin`) untested in the wild (munbox auto-chains).
- **munbox SIT5 trailing over-run** — worked around in `shim.c` (keep entries decoded before a
  trailing error). Candidate to fix + upstream properly (see `tools/sit-wasm/munbox/PATCHES.md`).
- **Method-15 fidelity** verified only as "decodes to a structurally valid theme," not byte-identical
  (no method-15 corpus fixture). A byte-identical method-15 fixture would close the gap.
