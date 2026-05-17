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

## Adding a theme

Once the theme engine (Phase 4) lands, adding a theme will be the most accessible contribution path. The intended flow:

1. Create a directory under `themes/<theme-name>/` following the bundle layout in PRD §Theme system.
2. Author chrome.css + controls.css against the documented CSS custom property catalog.
3. Add sounds, desktop, fonts, icons as needed (`themes/<name>/sounds/`, etc.).
4. Add a `theme.json` with metadata, including original-author attribution if the theme is adapted from a period source.
5. Add a smoke test that loads the theme and asserts the WM still drags + resizes correctly under it.
6. PR with a screenshot of the theme rendered in the demo page.

For themes adapted from period sources (Kaleidoscope schemes, Apple's official Mac OS 8.5 themes, etc.), include provenance in `theme.json` — original author/year/source URL — and confirm the source's license permits redistribution. When in doubt, ship an "inspired by" reinterpretation rather than a literal artwork reproduction.

## Reporting bugs

Open an issue with:

- What you tried (the smallest reproducing example, please).
- What you expected.
- What you got.
- Browser + OS + Aaron UI version.
- Screenshot if visual.

For accessibility issues, please flag explicitly — those jump the queue.

## Reporting HIG inaccuracies

If a Platinum chrome detail is wrong vs. the [Mac OS 8 HIG](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html), open an issue citing the specific HIG section and (if possible) a side-by-side screenshot of Aaron UI vs. a period-correct reference (a Mac OS 8 screenshot from Macintosh Garden / archive.org is ideal). HIG fidelity for the default theme is a project-level commitment, not a nice-to-have.
