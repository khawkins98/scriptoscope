# proxy-icon-modified-dot — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/proxy-icon-modified-dot.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`proxy-icon-modified-dot.md`](../proxy-icon-modified-dot.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## 2.3.1 kDEF call sites — PEF imports and glue stubs (original)

````text
PEF imports verified via `/tmp/pef-imports.py`:

```
Lib 4: WindowsLib  firstSym=213 count=2
  Sym 213: GetWindowProxyIcon  (class=0x82 TVect)
  Sym 214: IsWindowModified    (class=0x82 TVect)
```

Loader-reloc replay (`/tmp/pef-relocs.py`) places the resolved TVect pointers at:

| Data offset | Import |
|---|---|
| `0x354` | `GetWindowProxyIcon` |
| `0x358` | `IsWindowModified` |

…which the code reaches via the standard CFM glue stubs at `0x26b88` (`lwz r12, 0x354(r2)`) and `0x26c30` (`lwz r12, 0x358(r2)`).

### All call sites (from `bl 0x26b88` / `bl 0x26c30`)
````

## Decoded paired site (`0x22be0..0x22c78`) (original)

````text
```asm
                                          ; (rect math: shrink frame to 16x16 slot
                                          ;  centred to the left of the title text)
0x22c00:  addi   r3, r31, 0               ; r3 = window ptr
0x22c04:  addi   r4, r1, 0x44             ; r4 = &IconRef out-handle
0x22c08:  bl     GetWindowProxyIcon       ;   → r1+0x44 receives IconRef
0x22c10:  li     r28, 0                   ; r28 = transform flags (0 = normal)
0x22c14:  addi   r3, r31, 0
0x22c18:  bl     IsWindowModified         ;   → r3 = bool
0x22c20:  clrlwi. r0, r3, 0x18
0x22c24:  beq    0x22c2c
0x22c28:  li     r28, 1                   ; modified → transform = kTransformDisabled?
                                          ;            (likely kTransformOpenFolder=2 or
                                          ;             a modified-document transform = 1)
0x22c2c:  lbz    r0, 0x590(r2)            ; global "window inactive" flag
0x22c30:  cmplwi r0, 0
0x22c34:  beq    0x22c3c
0x22c38:  addi   r28, r28, 0x4000         ; inactive → OR kTransformDisabled (0x4000)
                                          ; (matches IconServicesLib transform bits)
0x22c3c:  …(build rect at +0x10..+0x10 → 16x16 icon slot)…
0x22c48:  mr     r5, r28                  ; r5 = transform
0x22c4c:  addi   r3, r1, 0x38             ; r3 = &iconRect
0x22c50:  li     r4, 1                    ; r4 = kAlignAbsoluteCenter or kAlignNone (=1)
0x22c54:  …                                ; r6 = 0 (services)
0x22c70:  lwz    r7, 0x44(r1)             ; r7 = the IconRef returned earlier
0x22c78:  bl     PlotIconRef              ; (TOC 0x64 = PlotIconRef, IconServicesLib)
```

**Effective C-equivalent:**

```c
IconRef ref;
GetWindowProxyIcon(theWindow, &ref);
short transform = IsWindowModified(theWindow) ? 1 : 0;
if (g_windowInactive) transform |= 0x4000;   /* dim when inactive */
Rect r = /* 16x16 slot, left of title text */;
PlotIconRef(&r, kAlignAbsoluteCenter, transform, kIconServicesNormalUsageFlag, ref);
```

The 16x16 slot is built by extending `(r3, r0)` by `0x10` in both dimensions (`addi r7, r7, 0x10`, `addi r0, r8, -0x10`) — i.e. a standard small-icon (`ics`-family) box flush against the leading edge of the title text.
````

## Scheme-side gate (`bl 0x23b20`) (original)

````text
### Scheme-side gate (`bl 0x23b20`)

The second paired site (`0x230f4`) is reached only if `0x23b20` returns true. That routine at the top:

```asm
0x23b28:  lis  r4, 0x7769          ; 'wi'
0x23b34:  addi r3, r4, 0x6e64      ; 'wind'  →  FourCC 'wind'
0x23b40:  bl   0x25c70             ; (helper that GetResource's 'wind' by id)
```
````

## 1.8.2 cross-check (original)

````text
`grep -c GetWindowProxyIcon` and `grep -c IsWindowModified` against `.scratch/k182-kdef/kDEF/id-1.bin`: **zero matches each.** 1.8.2 does not import either symbol. Proxy-icon support is a strict 2.3.1 addition, riding the AppearanceLib/WindowsLib delta documented in `docs/spec/kdef-binary-inventory.md §6`.
````

## Reproducing the analysis (original)

````text
```sh
# (1) Confirm 2.3.1 imports the symbols, 1.8.2 doesn't.
strings .scratch/k231-kdef/kDEF/id-1.bin | grep -E 'GetWindowProxyIcon|IsWindowModified'
strings .scratch/k182-kdef/kDEF/id-1.bin | grep -E 'GetWindowProxyIcon|IsWindowModified'  # empty

# (2) Locate TOC slots + glue stubs.
python3 /tmp/pef-imports.py .scratch/k231-kdef/kDEF/id-1.bin
python3 /tmp/pef-relocs.py  .scratch/k231-kdef/kDEF/id-1.bin

# (3) Enumerate call sites.
grep -nE 'bl[[:space:]]+0x26b88|bl[[:space:]]+0x26c30' .scratch/k231-kdef/kDEF/k231-kdef1.asm

# (4) Inspect the paired-site flow.
sed -n '35570,35630p' .scratch/k231-kdef/kDEF/k231-kdef1.asm

# (5) Confirm no corpus 'wind' resources.
find themes -name resource-roles.json -exec grep -l '"wind"' {} \;   # empty
```

All five steps yield the results documented above.
````

## 2.3.1 kDEF call sites heading (original)

````text
## 2.3.1 kDEF call sites (`.scratch/k231-kdef/kDEF/id-1.bin`, PowerPC)
````

## 1.8.2 absence (original)

````text
occurs in the 1.8.2 kDEF (`.scratch/k182-kdef/kDEF/id-1.bin`): **zero
````
