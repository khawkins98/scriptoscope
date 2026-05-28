# Contributing

Thanks for your interest in contributing to Scriptoscope.

> **Status:** the project is on the **v3 part-code-compositor reset** ("v3" = an architecture generation, not a release version — the package is pre-1.0) — the chrome renderer (`src/composeChrome.ts`) is rebuilt around Kaleidoscope's own part-code model and validated against the decompiled 2.3.1 kDEF. It's in prototype mode: the maintainer commits directly to the working branch, and the focus is rendering fidelity, not API stability. Read [`docs/history.md`](./docs/history.md) first (especially its "Dead ends — don't relitigate these" list), then [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the current model. For any binary-level question — a routine address, a resource id, a struct offset, a coordinate mapping — the standing lookup reference is [`docs/spec/kdef231-reference.md`](./docs/spec/kdef231-reference.md).

## Your first code contribution

Scriptoscope is plain TypeScript with no framework dependency.

1. **Fork and clone.**
   ```sh
   # Fork on GitHub first, then:
   git clone https://github.com/<your-handle>/scriptoscope.git
   cd scriptoscope
   npm install
   ```

2. **Start the dev server.**
   ```sh
   npm run dev        # http://localhost:5173 — opens demo/index.html
   ```

3. **Check your work.** In prototype mode the project leans on the type checker and the render/audit diagnostics rather than a unit/e2e suite:
   ```sh
   npm run typecheck  # tsc --noEmit
   npm run diag:render  # render a window off a bundle to a PNG for eyeballing
   npm run diag:audit   # audit part placement against the recipe
   npm run lint:themes  # validate theme bundles
   ```

4. **Make a change.** Browse the [epic tracker issues](https://github.com/khawkins98/aaron-ui/issues?q=is%3Aissue+is%3Aopen+label%3Atype-epic) and [`docs/spec/glitch-punchlist.md`](./docs/spec/glitch-punchlist.md) for context. Safe first-time targets:
   - Pick a render glitch off the punch-list and tighten the compositor against the recipe.
   - Improve a JSDoc comment that confused you the first time you read it.
   - Port an additional freeware scheme into the corpus (see "Adding a theme" below).

5. **Push to a feature branch on your fork.**
   ```sh
   git checkout -b feat/my-first-change
   git add <files>
   git commit -m "fix(chrome): correct close-box placement under the 2.3.1 recipe"
   git push -u origin feat/my-first-change
   ```

6. **Open a PR** from your fork's branch to `khawkins98/aaron-ui:main`, with a typecheck-clean diff. (The maintainer commits directly to the working branch in prototype mode; PRs are the path for external contributions.)

## Branching

- Branch from `main` for each piece of work.
- Use short, descriptive branch names. Conventional prefixes:
  `feat/<thing>`, `fix/<thing>`, `docs/<thing>`, `chore/<thing>`,
  `refactor/<thing>`, `test/<thing>`, `spike/<thing>` (research,
  do-not-merge).
- External contributions come via PR against `main`; the maintainer commits directly to the working branch in prototype mode (see the Status note above).

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

- Make sure `npm run typecheck` is clean, and that the relevant diagnostics (`diag:render`, `diag:audit`, `lint:themes`) still pass for any chrome/theme change.
- Update [`PRD.md`](./PRD.md) / the [`docs/spec/`](./docs/spec/) specs if behavior or architecture changed.
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

Scriptoscope is a Kaleidoscope-compatibility runtime — themes are *ported* (not hand-authored) from existing `.ksc` schemes. Authoring entirely new chrome means using period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK on classic Mac OS or under SheepShaver), then porting the resulting `.ksc` through the same flow.

The porting flow as currently implemented (the corpus today is `1138`, `1984`, `1990`, `apple-platinum-2`, `beos-r503`, `evolution`, `platinum-8`, `system7-nostalgia-silver` — use one of the full schemes, e.g. `beos-r503`, as a worked example; note `platinum-8` and `system7-nostalgia-silver` are controls-only, with no window recipes, so they're atypical examples):

1. **Verify the scheme's license permits redistribution.** Check the scheme's readme. When a scheme lacks an explicit license, study it privately but do not port until rights are confirmed.
2. **Create `themes/<scheme-slug>/` and drop in the scheme's resource fork plus its metadata:**
   - **`scheme.rsrc`** — the raw resource fork of the `.ksc` (the extractor reads this directly; no macOS DeRez step needed).
   - **`meta.json`** — bundle metadata the binary scheme doesn't carry: `name`, `author`, `origin` (with the readme-stated license verbatim). See `themes/beos-r503/meta.json` for the shape and [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md) for the schema.
   - **`PROVENANCE.md`** — human-readable companion: author, source URL, readme excerpt, our license interpretation, why this scheme is in the corpus. See `themes/beos-r503/PROVENANCE.md` as a canonical example.
3. **Run the importer.** `npm run import -- <slug>` runs the whole pipeline scoped to your scheme (chrome + icons + rasters + roles + lint), scaffolds a `meta.json` stub if you skipped step 2's metadata, and prints a report card (scheme type, window types, header colours, control/icon/glyph coverage, lint verdict). Under the hood that's `extract-scheme.mjs` (decodes `cicn`/`ppat`/`cinf`/`wnd#`/`clut` → PNGs + a schema-validated `theme.json`) + `extract-icons.mjs` (glyphs) — you can run those individually too. (Re-extract every bundle with `npm run build:themes`.)
4. **Smoke test locally.** `npm run dev`, then open the demo and switch to your slug — or load it from the JS console: `await loadTheme('/themes/<your-slug>')`. For a quick headless check, `npm run diag:render` renders a window off a bundle to a PNG, and `npm run lint:themes` validates the bundle.
5. **PR with a side-by-side screenshot** — Scriptoscope rendering vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or the period screenshot the original author shipped).

The complete step-by-step walk-through (with troubleshooting for common pitfalls) is in [`docs/porting-a-kaleidoscope-scheme.md`](./docs/porting-a-kaleidoscope-scheme.md).

Hand-authoring CSS or SVG chrome as a "first-party Scriptoscope theme" is **out of scope** — the 2026-05-17 LEARNINGS entry "Scriptoscope is a Kaleidoscope-compatibility runtime, not a Platinum re-author" records why. If you want to author a new look, the recommended path is ResEdit + Kaleidoscope SDK on classic Mac OS / SheepShaver, then port the resulting `.ksc` through this flow.

## Reporting bugs

Open an issue with:

- What you tried (the smallest reproducing example, please).
- What you expected.
- What you got.
- Browser + OS + Scriptoscope version.
- Screenshot if visual.

For accessibility issues, please flag explicitly — those jump the queue.

## Reporting scheme-fidelity issues

If Scriptoscope is rendering a loaded Kaleidoscope scheme *differently from how Kaleidoscope itself renders that scheme*, that's a runtime bug — open an issue with a side-by-side screenshot of Scriptoscope's render vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or a period screenshot if the scheme shipped one). Scheme fidelity is the project's central commitment.

Issues of the form "this scheme doesn't look like the Mac OS 8 HIG" are a separate category — they're authorial choices of the *scheme*, not bugs in Scriptoscope. If you want HIG-faithful chrome, load a HIG-faithful scheme (`apple-platinum-2` in the current corpus is a good one).
