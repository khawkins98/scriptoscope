# apple-appearancelib-spike — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/apple-appearancelib-spike.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`apple-appearancelib-spike.md`](../apple-appearancelib-spike.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Tooling (solved) (original)

````text
- No raw-PPC disassembler was installed. Resolved with **capstone 5.0.7** in an
  isolated venv at `/tmp/ppc-venv` (`CS_ARCH_PPC | CS_MODE_32 | CS_MODE_BIG_ENDIAN`).
  Reproduce: `/tmp/ppc-venv/bin/python .scratch/iso-recon/pef-locate.py`.
````

## The remaining layer (the cost) (original)

````text
  3. Disassemble there (capstone, ready) and trace the push-button path through
````

## Calibration (decoded DrawThemeButton once) (original)

````text
- Signature confirmed: `DrawThemeButton(rect, kind, drawInfo, prevInfo, eraseProc, labelProc, userData)` (args r3..r9 saved to r23..r29).
- Validates: null rect → ret -50 (paramErr); null drawInfo → -50. Reads drawInfo state halfword at `+6`, `andi. &5`.
- **It is a THIN DISPATCHER, not the drawer:** fetches the current theme object
  (imported glue `bl 0x18618`), then `lwz r12,0(r3); lwz r12,0xCC(r12); bl …` —
  i.e. dispatches to a **vtable method at offset 0xCC** on the theme-provider object.
````

## Header (binary path) (original)

````text
*Clean-room. All offsets are into `.scratch/iso-recon/85-System.bin` (git-ignored).
````
