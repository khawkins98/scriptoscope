# Scheme screenshots

Per-scheme baseline renders of the main demo at 1200×900. One PNG per bundled theme. Regenerate after any change that touches the chrome renderer to see what changed visually.

## Regenerate

```bash
# Dev server must be running:
npm run dev

# In another shell:
node tools/scheme-screenshots.mjs                 # all schemes
node tools/scheme-screenshots.mjs acid 1990       # subset
node tools/scheme-screenshots.mjs --base http://localhost:5173
```

Output: `docs/screenshots/<slug>.png` per scheme. Commit the deltas alongside the renderer change so the PR description can call out visual regressions / improvements.

## How it works

The demo accepts a `?theme=<slug>` URL parameter (see `tests/e2e/theme-url-param.spec.ts`). The screenshot script:

1. Iterates every known slug (or just the subset passed as args).
2. Launches Chromium via Playwright at 1200×900 viewport.
3. Navigates to `${base}/?theme=${slug}`, waits for network idle + a brief settle for the async classifier + geometry derivation.
4. Captures a fullPage:false screenshot to the output dir.

Same path is exercised live when you visit `http://localhost:5173/?theme=acid` etc — useful for sharing a specific scheme.

## Schemes covered

| Slug | Display name | Author | Year |
|---|---|---|---|
| masswerk-7-le | mass:werk 7 Le | Norbert Landsteiner | 2001 |
| masswerk-dark-ergobox2 | mass:werk Dark ErgoBox 2 | Norbert Landsteiner | 2011 |
| acid | Acid (#1022) | SHIOCOP | 1999 |
| 1138 | 1138 | Erik Ekengren | 1998 |
| big-blue | Big Blue is Watching (#1984) | Geoffrey Hamilton | 1996 |
| 1990 | 1990 | SHIOCOP | 1999 |
| evolution | 1991 evolution | SHIOCOP | 1999 |

Provenance per scheme: `themes/<slug>/PROVENANCE.md`.
