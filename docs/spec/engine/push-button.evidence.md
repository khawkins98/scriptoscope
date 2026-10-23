# `push-button.draw` — evidence appendix

**Verifier-only. Implementers must not read this file.**

Writer: issue #459 spec lane, 2026-10-23. Static listing and resource-map
reading only; no original code or emulator run. These are writer derivations,
not independent verifier verdicts; PM must assign a separate verifier and
separate test author before implementation.

## E1. Immutable source identity and predecessors

Kaleidoscope 2.3.1 kDEF 0, 107,726 bytes, SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
Private binary: root checkout `.scratch/k231-kdef/kDEF/id-0-680x0_DefProcs.bin`.
L1 annotated listing:
`campaign-20261021/v2-lanes/L1/annotated/kdef0.annotated.txt`, SHA-256
`51d75e615906369862959e468812105d330f0e63f7c6a96178dc906ea46d1205`.
Pinned Universal Interfaces 3.0.1 Traps.h SHA-256
`b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b`.
Private header: `campaign-20261021/lanes/RE-advisory/work/traps/Traps.h`.
The public spec carries no original bytes.

Prior exact citations preserved here: `push-button-selection.md`
`0x7572–0x7594`; `control-face-geometry.md` `0x108a4..0x108b0`,
`0x10b72..0x10bb8`, `0x10c18..0x10f82`; `control-text-colors.md`
`0x10904–0x1091a`, `0x10922–0x10934`, `0x1093e–0x10954`,
`0x1095a–0x1096a`, `0x10970–0x10990`, `0x759a`,
`0x75ca–0x75ea`, `0x70a6–0x70ba`; default-ring reference
`0x7698..0x76a2`, `0x76b8..0x770e`.
These predecessor notes' modern policies do not become decoded rules.

## E2. Address-to-row trace (writer; verifier verdict required)

| safe rows | listing facts | independent verdict |
|---|---|---|
| PB1–PB4 | `0x67fc..0x6802` tests contrlVis. `0x66e8..0x6718` tests hilite -2/-1, clears pressed under disabled. `0x6c3e` tests rgnSave; push flag byte10 chooses FrameRoundRect 8×8 | not supplied |
| PB5–PB9 | `0x7576..0x7594` selects -10240/-10238/-10239 and calls `0x10fc0`. No fallback ID at this call site. `0x10864..0x1086a` returns 0 on no cicn; `0x1086e..0x10898` tries same-ID cinf then 0 for body, 1 for nonbody | not supplied |
| PB10–PB13 | `0x759a` compares emboss first word with 0x1234. `0x75a6..0x75c4` depth<4+disabled→mode49, else1. `0x75ca` sets blob byte24 for emboss; `0x75de` clears it; `0x70a6..0x70b2` moves pen +1,+1 only on that byte | not supplied |
| DR1–DR5 | `0x768c..0x76b6` dereferences auxiliary handle before testing Acid and byte30 (no null-safe auxiliary contract implied). `0x7698..0x76a2` expands D by4. Ring calls clear the region flag. Disabled -10232 no fallback; pressed -10230→-10231 only on returned false; normal -10231 | not supplied |
| DR6 | `0x1089a..0x1089c` branches to `0x10fa8` on cinf miss; `0x10fb6` returns1. This differs from the cicn-NULL return0 and suppresses DR3 fallback | not supplied |
| plain label | `0x6fb8..0x7036` FontInfo and CR count; signed corrected /2 yields trunc toward zero. Push-only byte10 and lineHeight<13 subtract1. `0x707c..0x709c` centers each line; `0x6d4e..0x6d80` intersects clip with D. CR scan special final-length adjustment at `0x7054..0x7058` | not supplied |

Trap identities from Traps.h: `$A8A9` InsetRect, `$A8B0` FrameRoundRect,
`$A8EC` CopyBits, `$AA14` RGBForeColor, `$A889` TextMode, `$A885` DrawText,
`$A893` MoveTo, `$A894` Move, `$A88B` GetFontInfo, `$A886` TextWidth,
`$AA1E` GetCIcon, `$A9A0` GetResource, `$A998` UseResFile. `$AB1D`
QD extensions selector identities need the Apple offscreen reference; their
full effect is explicitly outside the current safe draw scope.

## E3. Selected exact listing lines

The following are copied directly from the pinned annotated listing; addresses
and trap annotations are retained. They are evidence, never implementation input.

```text
    7576:	4a2a 0008                               	tstb %a2@(8)
    757a:	6706                                    	beqs 0x7582 ; → routine@0x7424 (target 0x7582, pcRelative)
    757c:	303c d800                               	movew #-10240,%d0
    7580:	6010                                    	bras 0x7592 ; → routine@0x7424 (target 0x7592, pcRelative)
    7582:	4a2a 0009                               	tstb %a2@(9)
    7586:	6706                                    	beqs 0x758e ; → routine@0x7424 (target 0x758e, pcRelative)
    7588:	303c d802                               	movew #-10238,%d0
    758c:	6004                                    	bras 0x7592 ; → routine@0x7424 (target 0x7592, pcRelative)
    758e:	303c d801                               	movew #-10239,%d0
    7592:	3f00                                    	movew %d0,%sp@-
    7594:	61ff 0000 9a2a                          	bsrl 0x10fc0 ; → routine@0x10fc0 (target 0x10fc0, pcRelative)
```

```text
    759a:	0c6e 1234 ffea                          	cmpiw #4660,%fp@(-22)
    75a0:	56c0                                    	sne %d0
    75a2:	4400                                    	negb %d0
    75a4:	1600                                    	moveb %d0,%d3
    75a6:	4a2a 0008                               	tstb %a2@(8)
    75aa:	4fef 000e                               	lea %sp@(14),%sp
    75ae:	6710                                    	beqs 0x75c0 ; → routine@0x7424 (target 0x75c0, pcRelative)
    75b0:	0c6e 0004 0012                          	cmpiw #4,%fp@(18)
    75b6:	6c08                                    	bges 0x75c0 ; → routine@0x7424 (target 0x75c0, pcRelative)
    75b8:	3f3c 0031                               	movew #49,%sp@-
    75bc:	a889                                    	.short 0xa889 ; 0xA889 _TextMode
    75be:	6006                                    	bras 0x75c6 ; → routine@0x7424 (target 0x75c6, pcRelative)
    75c0:	3f3c 0001                               	movew #1,%sp@-
    75c4:	a889                                    	.short 0xa889 ; 0xA889 _TextMode
    75c6:	4a03                                    	tstb %d3
    75c8:	6714                                    	beqs 0x75de ; → routine@0x7424 (target 0x75de, pcRelative)
    75ca:	157c 0001 0018                          	moveb #1,%a2@(24)
    75d0:	486e ffea                               	pea %fp@(-22)
    75d4:	aa14                                    	.short 0xaa14 ; 0xAA14 _RGBForeColor
    75d6:	2f0a                                    	movel %a2,%sp@-
    75d8:	4eba f748                               	jsr %pc@(0x6d22) ; → routine@0x6d22 (target 0x6d22, pcRelative)
    75dc:	584f                                    	addqw #4,%sp
    75de:	422a 0018                               	clrb %a2@(24)
    75e2:	486e ffa8                               	pea %fp@(-88)
    75e6:	aa14                                    	.short 0xaa14 ; 0xAA14 _RGBForeColor
    75e8:	2f0a                                    	movel %a2,%sp@-
    75ea:	4eba f736                               	jsr %pc@(0x6d22) ; → routine@0x6d22 (target 0x6d22, pcRelative)
```

```text
    7698:	486e fff8                               	pea %fp@(-8)
    769c:	2f3c fffc fffc                          	movel #-196612,%sp@-
    76a2:	a8a9                                    	.short 0xa8a9 ; 0xA8A9 _InsetRect
    76a4:	2613                                    	movel %a3@,%d3
    76a6:	2043                                    	moveal %d3,%a0
    76a8:	0c90 4163 6964                          	cmpil #1097034084,%a0@
    76ae:	6664                                    	bnes 0x7714 ; → routine@0x7424 (target 0x7714, pcRelative)
    76b0:	2043                                    	moveal %d3,%a0
    76b2:	4a28 001e                               	tstb %a0@(30)
    76b6:	675c                                    	beqs 0x7714 ; → routine@0x7424 (target 0x7714, pcRelative)
    76b8:	4a2a 0008                               	tstb %a2@(8)
    76bc:	6714                                    	beqs 0x76d2 ; → routine@0x7424 (target 0x76d2, pcRelative)
    76be:	4227                                    	clrb %sp@-
    76c0:	486e fff8                               	pea %fp@(-8)
    76c4:	3f3c d808                               	movew #-10232,%sp@-
    76c8:	61ff 0000 90da                          	bsrl 0x107a4 ; → routine@0x107a4 (target 0x107a4, pcRelative)
    76ce:	504f                                    	addqw #8,%sp
    76d0:	6042                                    	bras 0x7714 ; → routine@0x7424 (target 0x7714, pcRelative)
    76d2:	4a2a 0009                               	tstb %a2@(9)
    76d6:	672a                                    	beqs 0x7702 ; → routine@0x7424 (target 0x7702, pcRelative)
    76d8:	4227                                    	clrb %sp@-
    76da:	486e fff8                               	pea %fp@(-8)
    76de:	3f3c d80a                               	movew #-10230,%sp@-
    76e2:	61ff 0000 90c0                          	bsrl 0x107a4 ; → routine@0x107a4 (target 0x107a4, pcRelative)
    76e8:	4a00                                    	tstb %d0
    76ea:	504f                                    	addqw #8,%sp
    76ec:	6626                                    	bnes 0x7714 ; → routine@0x7424 (target 0x7714, pcRelative)
    76ee:	4227                                    	clrb %sp@-
    76f0:	486e fff8                               	pea %fp@(-8)
    76f4:	3f3c d809                               	movew #-10231,%sp@-
    76f8:	61ff 0000 90aa                          	bsrl 0x107a4 ; → routine@0x107a4 (target 0x107a4, pcRelative)
    76fe:	504f                                    	addqw #8,%sp
    7700:	6012                                    	bras 0x7714 ; → routine@0x7424 (target 0x7714, pcRelative)
    7702:	4227                                    	clrb %sp@-
    7704:	486e fff8                               	pea %fp@(-8)
    7708:	3f3c d809                               	movew #-10231,%sp@-
    770c:	61ff 0000 9096                          	bsrl 0x107a4 ; → routine@0x107a4 (target 0x107a4, pcRelative)
    7712:	504f                                    	addqw #8,%sp
```

```text
   10864:	4a85                                    	tstl %d5
   10866:	6606                                    	bnes 0x1086e ; → routine@0x107fe (target 0x1086e, pcRelative)
   10868:	7000                                    	moveq #0,%d0
   1086a:	6000 074c                               	braw 0x10fb8 ; → routine@0x107fe (target 0x10fb8, pcRelative)
   1086e:	4227                                    	clrb %sp@-
   10870:	3f04                                    	movew %d4,%sp@-
   10872:	61ff 0000 0e84                          	bsrl 0x116f8 ; → routine@0x116f8 (target 0x116f8, pcRelative)
   10878:	2648                                    	moveal %a0,%a3
   1087a:	200b                                    	movel %a3,%d0
   1087c:	584f                                    	addqw #4,%sp
   1087e:	661a                                    	bnes 0x1089a ; → routine@0x107fe (target 0x1089a, pcRelative)
   10880:	4227                                    	clrb %sp@-
   10882:	4a2e 0016                               	tstb %fp@(22)
   10886:	6704                                    	beqs 0x1088c ; → routine@0x107fe (target 0x1088c, pcRelative)
   10888:	7000                                    	moveq #0,%d0
   1088a:	6002                                    	bras 0x1088e ; → routine@0x107fe (target 0x1088e, pcRelative)
   1088c:	7001                                    	moveq #1,%d0
   1088e:	3f00                                    	movew %d0,%sp@-
   10890:	61ff 0000 0e66                          	bsrl 0x116f8 ; → routine@0x116f8 (target 0x116f8, pcRelative)
   10896:	2648                                    	moveal %a0,%a3
   10898:	584f                                    	addqw #4,%sp
   1089a:	200b                                    	movel %a3,%d0
   1089c:	6700 070a                               	beqw 0x10fa8 ; → routine@0x107fe (target 0x10fa8, pcRelative)
```

```text
   10fa8:	4a2c 04c5                               	tstb %a4@(1221)
   10fac:	6608                                    	bnes 0x10fb6 ; → routine@0x107fe (target 0x10fb6, pcRelative)
   10fae:	2f05                                    	movel %d5,%sp@-
   10fb0:	4eba f6fc                               	jsr %pc@(0x106ae) ; → routine@0x106ae (target 0x106ae, pcRelative)
   10fb4:	584f                                    	addqw #4,%sp
   10fb6:	7001                                    	moveq #1,%d0
   10fb8:	4cdf 0cf8                               	moveml %sp@+,%d3-%d7/%a2-%a3
   10fbc:	4e5e                                    	unlk %fp
```

## E4. Own-fork census and evidence limits

The writer parsed the resource maps of the 18 repository archives via the
existing StuffIt/container reader and independent `parseResourceMap` in
`tests/rendering-options/checkable-rules.mjs`; this only decodes data, not
original executable code. For each archive it printed cicn/cinf IDs among
{-10240,-10239,-10238,-10232,-10231,-10230,0,1}. The safe corpus table records
the full partition: all 18 have the five nonpressed-ring cicns; none has
-10230 or cinf0/1; same-ID face cinf exists in13; ring metadata differs for
Lisa and floppies. Census is presence-only, neither provider proof nor capture.
A separate verifier must repeat that census and the address trace, and the
separate author must exercise every §7 mutation without importing runtime rules.

Missing face/metadata outputs, offscreen/device details, special labels and
lifecycle remain explicit scope limits. No runtime/test edit, native acquisition,
ledger promotion, self-review or verification mark is part of this commit.
