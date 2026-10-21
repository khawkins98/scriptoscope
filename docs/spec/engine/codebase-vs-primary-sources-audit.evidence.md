# codebase-vs-primary-sources-audit — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/codebase-vs-primary-sources-audit.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`codebase-vs-primary-sources-audit.md`](../codebase-vs-primary-sources-audit.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## [F8] `composeChrome` cinf `bg-pattern` (byte[3] = 5) path is decoded but no consumer (original)

````text
documents the dispatch at `0x109be: cmpib #5,%a0@(3)` → `bnew 0x10a6c` — the
````

## [F9] `composeChrome.scrollbar` arrow-id table is canonical but the doc-comment doesn't cite the corpus-corroborated authoring (original)

````text
`kDEF231_0.asm:9f0e-9f38` (the CDEF's contrlHilite swap).
````

## Further original passages restated in place (moved verbatim during the completeness pass)

### [F9] `composeChrome.scrollbar` arrow-id table is canonical but the doc-comment doesn't cite the corpus-corroborated authoring (original, old lines 246–246)

````text
`kDEF231_0.asm:9f0e-9f38` (the CDEF's contrlHilite swap). The mapping is:
````

### [F10] `composeCornerSprite` doc widget id arithmetic (`-14336 + idx + (pressed ? 3 : 0)`) could cite `kThemeWidget*` enum (original, old lines 276–276)

````text
**Replacement:** Add a code comment citing `kThemeWidget*` values and link to
````
