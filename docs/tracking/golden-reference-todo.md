# TODO — golden render-vs-reference diff ("Layer 2" detection net)

**Status:** deferred — *blocked on trustworthy ground truth* (see the catch below).
**Why it matters:** it's the one detection net we don't have. `lint:themes`
(static data shape) and `diag:audit` (our model's own invariants) + the
[faithfulness ledger](kdef-faithfulness-ledger.md) catch *data-shaped* and
*structural* divergence. None of them catch an *algorithm*-shaped render bug
(off-by-one, tile-vs-stretch, a misplaced title) — those still surface only when
a human eyeballs a render. A golden diff would close that.

## The idea

Render each documented window type at a known size/state, diff against a
ground-truth image, fail past a tolerance, wire into CI (vitest/Playwright). Then
the beos-class corner gap, the 1984 arch, the M5 joint drift, etc. would trip a
test instead of waiting to be noticed.

## The catch (the actual blocker)

**Our current reference images are not a reliable oracle.** `demo/assets/
references/*.png` are *author-provided preview thumbnails* scraped from scheme
distribution sites (see `demo/assets/references/README.md` — and note the corpus
PNGs aren't even listed there). That means:

- **Version drift** — a preview may be from a different revision of the scheme
  than the `.rsrc` we extract from. The pixels won't match even if our render is
  perfect.
- **Unknown capture conditions** — window size, active/inactive state, title text,
  scale/DPI, and palette are all unknown and inconsistent across the set. Some
  are likely stylised marketing previews, not faithful OS renders.
- **They include title text + content + drop shadows** we don't (and shouldn't)
  reproduce in the frame-only compositor.

A pixel diff against this set would produce false failures — eroding trust in the
net until people ignore it. Garbage oracle, garbage test.

## What "doing it properly" requires

Generate **our own, version-matched ground truth** from the *same* scheme bits we
ship: run each `.rsrc` in **Kaleidoscope 2.3.1** on a classic Mac OS (an emulator
— Mini vMac / Basilisk II / SheepShaver), screenshot the documented window types
at **known, scripted** sizes + states, and crop to the frame. That reference is
captured from the same data we render, at conditions we control, so a diff is
meaningful.

> **Not a clean-room violation.** This is using Kaleidoscope *as a user* to
> capture reference screenshots offline, for test fixtures — NOT re-shipping or
> executing its kDEF as our runtime. That distinction is the whole point of the
> [clean-room constraint](kdef-faithfulness-ledger.md): we mimic the algorithm in
> our own code; we may still look at what the real app draws to check our work.

This is a meaningful chunk of work (emulator setup, a scripted capture harness,
crop/normalise tooling) — hence deferred.

## Cheaper interim options (don't need a perfect oracle)

1. **Golden-against-self regression.** Snapshot *our own* renders for the corpus;
   fail when a commit changes them unexpectedly. Catches *regressions* (did this
   change move pixels we didn't mean to?) even though it can't judge *correctness*.
   Cheap, high value, no emulator. Probably the right first step. Build it on
   `diag:render` (headless, pure-Node, straight from the compositor) — NOT on
   browser screenshots. (A Playwright tool, `tools/scheme-screenshots.mjs`, did the
   latter against the old multi-scene demo; it was retired in the v3 cleanup —
   broken against the single-window playground and redundant with `diag:render`.
   If browser-pipeline coverage is ever wanted, rebuild fresh against the
   playground's `#theme=…` hash state with a real image diff.)
2. **Structural diff, not pixel.** Compare derived geometry — per-side border
   thickness, corner continuity, title-region placement — at a loose tolerance
   against the existing previews. Survives palette/AA/version noise; would have
   caught the beos 22px-vs-5px right border. Weaker than pixels, far more robust
   to the provenance problem.

## Definition of done (whichever path)

- A `npm run` target that renders the corpus and compares to ground truth.
- Tolerances chosen so the *current* corpus passes clean (an armed baseline,
  like `lint:themes`).
- Wired into CI so every change is checked.
- Reference provenance documented (version, size, state, capture method) so the
  oracle is auditable.

## Pointers
- Renders: `composeWindowChrome` (`src/composeChrome.ts`) via `scripts/render-window.mjs`.
- Existing nets: `npm run lint:themes`, `npm run diag:audit`.
- Reference dir + (incomplete) provenance: `demo/assets/references/`.
