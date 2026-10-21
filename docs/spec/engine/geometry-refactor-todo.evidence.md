# geometry-refactor-todo — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/geometry-refactor-todo.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`geometry-refactor-todo.md`](../../geometry-refactor-todo.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Key decode insight — WDEF 125 title-bar height (original)

````text
(clamped ≥10), frame top = `titleHeight + 1` (decode `0x392` step, `fp@(-356)`). For the
````

## Decode tooling (original)

````text
**Decode tooling** (git-ignored, `.scratch/iso-recon/`): `m68k-elf-objdump` for 68k
WDEF/CDEF; capstone in `/tmp/ppc-venv` + `pef-locate.py` / `pef-decompress.py` for the
PPC AppearanceLib. Clean-room: binaries stay in `.scratch`, docs cite `0xADDR`, never
commit Apple's listing.
````

## Further original passages restated in place (moved verbatim during the completeness pass)

### Principles (the decisions to honor) (original, old lines 39–39)

````text
   `decode:` (cite the `0xADDR`) vs `tuning:` (calibration — e.g. colors are runtime
````

### Ongoing workstream: geometry-glitch reconciliation (original, old lines 84–84)

````text
   Constants, cited `0xADDR`) first; the real shipped resource second; a measured
````
