# kdef182-disassembly-findings — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/kdef182-disassembly-findings.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`kdef182-disassembly-findings.md`](../kdef182-disassembly-findings.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## 6. Methodology (toolchain) (original)

````text
- 68k disassembly: `m68k-elf-objdump -D -b binary -m m68k:68000 -EB`
- PEF parsing: hand-rolled `parse-pef.py` based on Apple's Mac OS Runtime Architecture spec
- Strings: `strings -n 4` + `xxd`
- Resource-load pattern search: byte-pattern grep for `0x2f3c TT TT TT TT 0x3f3c IL IH 0xa9a0` (the canonical "push type, push ID, call GetResource" sequence)

Disassembly artifacts kept under `/tmp/aaron-disasm/` (not committed). Reproducible from the original binary path above.
````
