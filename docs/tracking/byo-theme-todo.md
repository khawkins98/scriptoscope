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

## Open — gated (decide before building)

- **Export / save the translated theme.** Today a converted theme renders but evaporates on
  reload — no save. The shape (downloadable `.zip` bundle vs. in-page `LoadedTheme` handoff) is a
  **consumption-layer decision**, so it's deliberately sequenced *after* ADR-0001's gating spike.
  Mechanically cheap once chosen (`convertScheme` already yields `{ theme, assets }` in memory).
  *Gate: ADR-0001 gating spike.* (User advocate flagged the missing-save dead-end as the top UX gap.)
- **Grafting onto live web pages** — the unbuilt consumption layer (scanner / window-manager /
  CSS emission). See ADR-0001. *Gate: its own spike.*
- **sit-wasm as a standalone OSS release** — the owner wants to potentially offer it to the
  community, but it's not adoptable yet:
  - **LICENSE for the first-party files** (`shim.c`, `index.mjs`, `build.sh`) — they currently
    inherit the repo's `UNLICENSED` status, so the "MIT" claim has no grant behind it (only the
    vendored `munbox/` is MIT). *Gate: owner decision — the repo license is deliberately undecided.*
  - Its own `package.json` (name/version/`exports`/`files`), a hand-written `index.d.ts`, runnable
    Node + browser usage examples, a CDN/`locateFile` note, and a committed license-clean `.sit`
    test fixture (today both real-decode tests skip on a fresh clone — fixtures are git-ignored).
  - Naming/positioning for discoverability (e.g. `stuffit-wasm`), npm keywords. *All gated on the
    LICENSE decision.*

## Open — drop-zone UX & accessibility (deferred polish, not blockers)

From the user-advocate review; the demo bills itself as a "runtime debugger," so some
developer-flavored text is in-character — these matter most if the drop-zone courts non-developers.

- **P1 Friendly error wrapping.** Raw decoder strings leak to the UI (`theme.json.windowTypes:
  expected object`, `parseResourceFork: data section overruns…`, munbox `header2 out of range`).
  Wrap with a human top line; tuck the raw text behind a `<details>`. (`demo/index.html` `convertAndRender`)
- **P1 Visible "preview only — no save yet" line** by the success check (not just the 10.5px fine
  print). Reinforces the privacy promise; pre-empts the missing-save disappointment.
- **P1 `aria-live` on `#byo-out`** (and `role=alert` on errors) — screen-reader users currently get
  no feedback on convert success/failure/progress. Highest-leverage small a11y fix.
- **P2 Surface multi-file disclosure** — when an archive had >1 candidate theme, say "showing the
  largest of N" in the report (today it silently picks the largest).
- **P2 Busy/progress state** during a heavy `.sit` decode (`aria-busy`/spinner).
- **P2 Plainer copy** — demote `.sitx`/"resource fork"/"AppleDouble" jargon below a plain-language
  lead; answer "where do I get a theme file?" (link the Kaleidoscope archive / a sample).
- **P2 Recovery affordance** after an error ("try another file"); `accept=` on the file input.

## Open — decoder coverage & robustness (the real edges)

- **`.sitx` (StuffIt X)** unsupported — munbox scope. Detect + give a clear message (currently it
  may fall through to a generic failure). 
- **Multi-file `.sit` selection is a heuristic** — "largest resource fork = the scheme." Robust for
  the corpus, not guaranteed. A content-aware pick (which fork parses as a valid scheme) would be
  stronger.
- **Nested wrappers** (`.sit.hqx`, `.sit.bin`) untested in the wild (munbox auto-chains).
- **munbox SIT5 trailing over-run** — worked around in `shim.c` (keep entries decoded before a
  trailing error). Candidate to fix + upstream properly (see `tools/sit-wasm/munbox/PATCHES.md`).
- **Method-15 fidelity** verified only as "decodes to a structurally valid theme," not byte-identical
  (no method-15 corpus fixture). A byte-identical method-15 fixture would close the gap.
