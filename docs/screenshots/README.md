# Scheme screenshots

Per-scheme baseline renders of the demo playground. The intent: one PNG per
corpus theme, regenerated after any change that touches the chrome renderer, so a
PR diff shows what moved visually.

> **Heads-up — the generator is currently stale.** `tools/scheme-screenshots.mjs`
> is out of sync with the demo and does not produce correct per-scheme renders as
> written (see "Known gaps" below). The PNGs checked in here predate the current
> corpus. Treat them as rough historical baselines, not a trusted oracle, until
> the tool is repaired. For the broader "we lack a trustworthy render oracle"
> problem, see [`../tracking/golden-reference-todo.md`](../tracking/golden-reference-todo.md).

## Current corpus

The live corpus is defined by the bundles under `themes/`:

| Slug | Display name |
|---|---|
| 1138 | 1138 |
| 1984 | 1984 |
| 1990 | 1990 |
| apple-platinum-2 | Apple Platinum 2 |
| beos-r503 | BeOS R5.0.3 |
| evolution | Evolution |

Provenance per scheme: `themes/<slug>/PROVENANCE.md`.

Only `1138.png`, `1990.png`, and `evolution.png` are checked in here, and they
predate the current renderer — `1984`, `apple-platinum-2`, and `beos-r503` have
no baseline at all.

## Known gaps (why the generator doesn't work as-is)

`tools/scheme-screenshots.mjs` navigates to `${base}/?theme=<slug>` and expects
the demo to select a theme from that query parameter. The current demo
(`demo/index.html`) does **not** read a `?theme=` query string — its playground
serializes state to `location.hash` (`#theme=<slug>&wt=…&w=…`) and reads it back
from the hash. A bare `?theme=…` is ignored and the playground falls through to
its default (`1138`). So the tool would screenshot the same default scheme for
every slug.

The tool's `ALL_SCHEMES` list is also stale: it still names the departed
`masswerk-7-le` / `masswerk-dark-ergobox2` schemes and omits the current
`1984` / `apple-platinum-2` / `beos-r503`. The `tests/e2e/theme-url-param.spec.ts`
it cites no longer exists.

To revive this flow, point the tool at the hash form the demo actually reads —
e.g. `${base}/#theme=<slug>&wt=document-window&state=active&scale=2` — and sync
`ALL_SCHEMES` to the corpus table above.
