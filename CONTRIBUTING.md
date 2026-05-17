# Contributing

Thanks for your interest in contributing to Aaron UI.

> **Status:** Phase 1 (WM core) shipped. The contribution flow below is the real flow now — `npm install`, run tests, open a PR. Phase 2 work (default Platinum chrome) is in flight; see [milestones](https://github.com/khawkins98/aaron-ui/milestones) for what's open.

## Your first code contribution

Aaron UI is plain TypeScript with no framework dependency.

1. **Fork and clone.**
   ```sh
   # Fork on GitHub first, then:
   git clone https://github.com/<your-handle>/aaron-ui.git
   cd aaron-ui
   npm install
   ```

2. **Start the dev server.**
   ```sh
   npm run dev        # http://localhost:5173 — opens the demo page
   ```

3. **Run the test suite.**
   ```sh
   npm run typecheck  # tsc --noEmit
   npm run test:unit  # Vitest with jsdom (140+ tests)
   npm run test:e2e   # Playwright against the dev server (30+ tests)
   ```

4. **Make a change.** Pick from the open milestones or browse the [epic tracker issues](https://github.com/khawkins98/aaron-ui/issues?q=is%3Aissue+is%3Aopen+label%3Atype-epic) for context. Safe first-time targets:
   - Implement a single ticket within an open milestone.
   - Improve a JSDoc comment that confused you the first time you read it.
   - Add a missing test case to an existing spec file.

4. **Push to a feature branch on your fork.**
   ```sh
   git checkout -b feat/my-first-change
   git add <files>
   git commit -m "feat(chrome): adjust title pill padding to match HIG"
   git push -u origin feat/my-first-change
   ```

5. **Open a PR** from your fork's branch to `khawkins98/aaron-ui:main`. CI will run typecheck + tests.

6. **Once CI is green, squash-merge.**

## Branching

- Branch from `main` for each piece of work.
- Use short, descriptive branch names. Conventional prefixes:
  `feat/<thing>`, `fix/<thing>`, `docs/<thing>`, `chore/<thing>`,
  `refactor/<thing>`, `test/<thing>`, `spike/<thing>` (research,
  do-not-merge).
- Never commit directly to `main`. Open a PR.

## Commit messages — Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

Common types used here:

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation only
- `chore` — tooling, deps, build config
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or fixing tests
- `ci` — CI/CD pipeline changes
- `build` — build system or external dependency changes

Scopes that make sense for this project (suggested, not enforced):

- `wm` — window manager core (drag, resize, z-order, focus)
- `chrome` — title bar, controls, growbox, scrollbars
- `controls` — buttons, popups, tabs, fields, etc.
- `themes` — theme engine and theme bundles
- `sounds` — sound playback
- `a11y` — accessibility
- `docs` — documentation
- `demo` — the demo site

Examples:

```
feat(wm): implement 8-direction resize handles
fix(chrome): correct close-box bevel composition under high-DPI
docs(themes): document the CSS custom property catalog
test(wm): add Playwright regression for raise-on-click z-order
```

Use `!` after the type or a `BREAKING CHANGE:` footer for breaking changes:

```
feat(api)!: rename AaronWindow constructor option `theme` to `themeId`
```

## Pull requests

- Open a PR against `main` for any non-trivial change.
- Keep PRs focused — one logical change per PR when practical.
- Include a brief description of *why*, not just *what*.
- Link related issues.

### Merging

- **Squash and merge** is the default for larger PRs or any branch with noisy work-in-progress commits. The squash commit message must itself follow Conventional Commits — this keeps `main`'s history clean and changelog-friendly.
- For small PRs that already consist of a single well-formed Conventional Commit, a regular merge is fine.
- Avoid merge commits from `main` into feature branches; rebase instead.

## Before opening a PR

- Make sure typecheck + tests pass locally (or in CI on your branch).
- Update [`PRD.md`](./PRD.md) if behavior or architecture changed.
- Add a note to [`LEARNINGS.md`](./LEARNINGS.md) if you discovered something non-obvious along the way — Mac OS HIG quirks, browser quirks, theme-bundle format edge cases, accessibility tradeoffs, period-Mac trivia that informed a decision — future contributors will thank you.
- Don't commit build artifacts (`dist/`, `node_modules/`, theme working files, etc.).

## Adding a theme (porting a Kaleidoscope scheme)

Aaron UI is a Kaleidoscope-compatibility runtime — themes are *ported* (not hand-authored) from existing `.ksc` schemes. Authoring entirely new chrome means using period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK on classic Mac OS or under SheepShaver), then porting the resulting `.ksc` through the same flow.

Once the theme engine (Phase 4, [tracker #23](https://github.com/khawkins98/aaron-ui/issues/23)) lands, the intended flow:

1. **Verify the scheme's license permits redistribution.** Check the scheme's readme. Mass:werk's schemes are explicit ("freeware, redistribute freely"). When a scheme lacks an explicit license, study it privately but do not port until rights are confirmed.
2. **Run the scheme through the extractor.** `tools/scheme-extractor` decodes `cicn` / `ppat` / `cinf` / `wnd#` / `Colr` resources from the `.ksc` and emits a draft `theme.json` per [`docs/kaleidoscope-geometry-spec.md`](./docs/kaleidoscope-geometry-spec.md) §7.
3. **Stage the bundle under `themes/<scheme-slug>/`** — the extracted PNGs plus the generated `theme.json`.
4. **Fill in provenance** in `theme.json`: original author, year, source URL, the readme-stated license verbatim.
5. **Smoke test.** Load the theme in the demo, confirm the WM still drags + resizes, confirm windows render with the new chrome.
6. **PR with a side-by-side screenshot** — Aaron UI rendering vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or the period screenshot the original author shipped).

Hand-authoring CSS or SVG chrome as a "first-party Aaron UI theme" is **out of scope** — the 2026-05-17 LEARNINGS entry "Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author" records why. If you want to author a new look, the recommended path is ResEdit + Kaleidoscope SDK on classic Mac OS / SheepShaver, then port the resulting `.ksc` through this flow.

## Reporting bugs

Open an issue with:

- What you tried (the smallest reproducing example, please).
- What you expected.
- What you got.
- Browser + OS + Aaron UI version.
- Screenshot if visual.

For accessibility issues, please flag explicitly — those jump the queue.

## Reporting scheme-fidelity issues

If Aaron UI is rendering a loaded Kaleidoscope scheme *differently from how Kaleidoscope itself renders that scheme*, that's a runtime bug — open an issue with a side-by-side screenshot of Aaron UI's render vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or a period screenshot if the scheme shipped one). Scheme fidelity is the project's central commitment.

Issues of the form "this scheme doesn't look like the Mac OS 8 HIG" are a separate category — they're authorial choices of the *scheme*, not bugs in Aaron UI. If you want HIG-faithful chrome, load a HIG-faithful scheme (mass:werk's "7 Le" is the bundled default for exactly this reason).
