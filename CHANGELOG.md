# Changelog

All notable changes to Scriptoscope, in reverse chronological order. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows semver,
with the pre-1.0 caveat that the public API may change without a major bump while the
declarative front door, theme schema, and consumer-facing class names stabilize.

## [Unreleased]

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

- Slim: `dist/` + `README.md` + `LICENSE`. **NOT** included: `src/`, `themes/`, `PRD.md`,
  `LEARNINGS.md`, `docs/`. Consumers use the built `dist/scriptoscope.js` and fetch themes
  from a base URL they host. Drops the tarball from ~1.4 MB unpacked to ~150 KB.

### License

- MIT (decided in #26; first-party code only — `themes/` keeps per-scheme freeware terms,
  `tools/sit-wasm/munbox/` keeps its own MIT, demo fonts keep CC BY-SA / free-with-credit).

### Status

- Pre-alpha. The declarative API surface is the most stable; the imperative API
  (`loadTheme()`, `renderWindow()`, `WindowManager`) is also stable but may grow.
- 0.0.x cadence intentional — see `LEARNINGS.md` for the prototype-mode commit-cadence rule.

[Unreleased]: https://github.com/khawkins98/aaron-ui/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/khawkins98/aaron-ui/releases/tag/v0.0.1
