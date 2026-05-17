# Contributing

Thanks for your interest in contributing to Aaron UI.

> **Status:** Phase 1 (WM core) shipped. The contribution flow below is the real flow now — `npm install`, run tests, open a PR. Phase 4 (theme engine, which absorbed the former Phase 2 / Platinum chrome after the 2026-05-17 Kaleidoscope-runtime pivot) is in flight; see [milestones](https://github.com/khawkins98/aaron-ui/milestones) and the [Phase 4 child tickets under #23](https://github.com/khawkins98/aaron-ui/issues/23) for what's open.

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

## Periodic documentation cut-throughs

Docs and LEARNINGS rot. The faster the project moves, the faster they rot. Stale guidance is worse than no guidance — a future contributor reading a confidently-worded paragraph that hasn't been true for three months will burn an afternoon before realising. To keep that from happening, schedule deliberate cut-through passes:

**When to run a cut-through:**

- At every phase milestone close (Phase 1 done → review everything once; Phase 4 done → same).
- After any strategic pivot (a North Star change, a scope drop, a renaming) — pivot in-the-moment, then a wider sweep within the week to catch every doc the pivot ricocheted into.
- On any "wait, that's not right anymore" moment while reading docs in normal work. Stop, fix, commit. Don't carry the discrepancy.

**What to review, in order:**

1. **[`README.md`](./README.md)** — does the lede still describe the project accurately? Is the status sentence current? Are linked URLs alive?
2. **[`PRD.md`](./PRD.md)** — does §Phased delivery match what's shipped vs. open? Are §Success criteria still the right targets? Are tracker issue links current?
3. **[`LEARNINGS.md`](./LEARNINGS.md)** — each entry: is this still true? Is it superseded by a later entry? If superseded, add a "**Superseded YYYY-MM-DD by [other entry]**" header at the top of the stale entry — *don't delete it*; the historical record matters.
4. **[`docs/`](./docs/) artifacts** — each spec/architecture/spike doc: does it still describe how the system works? If a spec has drifted from implementation, either fix the spec (preferred) or update the implementation to match (when the spec was right).
5. **This file** — does the contribution flow it describes still match how PRs actually get landed? Are the commit-message examples still representative?

**Tactics for an honest cut-through:**

- **Read each doc as if you've never seen it.** The fastest way to spot stale guidance is to ask "does this match what I'd see if I cloned the repo today?" at every paragraph.
- **Cross-check claims against the code.** "The library exports `X`" — does it? `grep` it. "Phase N has shipped" — has it? Check the milestone.
- **Distinguish drift from supersession.** Drift = the doc was right at the time, code changed, doc didn't follow → update the doc. Supersession = a later decision invalidated an earlier one → mark the older entry as superseded, link to the newer, preserve the historical context.
- **Prefer many small commits over one massive sweep.** "docs(cut-through): update README + PRD §Phased delivery for Phase 4 close" is a better commit than "docs: review everything." Smaller commits make the reviewer's job easier and the changelog more useful.
- **Open a single PR for each cut-through.** Title pattern: `docs(cut-through): post-Phase-N review` or `docs(cut-through): post-pivot review YYYY-MM-DD`. Body summarises what was found and what was changed.

A cut-through is not optional polish — it's part of how the project stays trustworthy. If you're reading this and the project's recent history shows zero cut-through PRs, that's a smell: it means accumulated drift is waiting to bite the next contributor. Run one.

## Adding a theme (porting a Kaleidoscope scheme)

Aaron UI is a Kaleidoscope-compatibility runtime — themes are *ported* (not hand-authored) from existing `.ksc` schemes. Authoring entirely new chrome means using period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK on classic Mac OS or under SheepShaver), then porting the resulting `.ksc` through the same flow.

Phase 4 work is in progress under [tracker #23](https://github.com/khawkins98/aaron-ui/issues/23). The porting flow as currently implemented:

1. **Verify the scheme's license permits redistribution.** Check the scheme's readme. Mass:werk's schemes are explicit ("freeware, redistribute freely"). When a scheme lacks an explicit license, study it privately but do not port until rights are confirmed.
2. **Run the scheme through the extractor.** `tools/scheme-extractor/bin/extract.js` decodes `cicn` / `ppat` / `cinf` / `wnd#` resources from the `.ksc` and emits PNG assets plus an `extraction-manifest.json`. See [`tools/scheme-extractor/README.md`](./tools/scheme-extractor/README.md).
3. **Create `themes/<scheme-slug>/` with two hand-authored files:**
   - **`meta.json`** — bundle metadata the binary scheme doesn't carry: `name`, `author`, `origin` (with the readme-stated license verbatim). See [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md) for the schema.
   - **`PROVENANCE.md`** — human-readable companion: author, source URL, readme excerpt, our license interpretation, why this scheme is in the corpus. See `themes/masswerk-7-le/PROVENANCE.md` as the canonical example.
4. **Materialize the canonical bundle.** Run `node scripts/build-theme-bundles.mjs <slug>` — the script copies PNGs into `themes/<slug>/cicns/` and `ppats/`, merges your `meta.json`, runs the extractor's `buildThemeJson`, validates against the schema, and writes `theme.json`. Validation failures abort the build.
5. **Smoke test locally.** `npm run dev` and open the landing page; the switcher's `<select>` can be extended to include your slug, or load via the JS console: `await loadTheme('themes/<your-slug>/')`.
6. **PR with a side-by-side screenshot** — Aaron UI rendering vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or the period screenshot the original author shipped).

The complete step-by-step walk-through (with troubleshooting for common pitfalls) is in [`docs/porting-a-kaleidoscope-scheme.md`](./docs/porting-a-kaleidoscope-scheme.md).

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
