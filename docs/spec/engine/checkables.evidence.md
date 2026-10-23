# `checkables.draw` — evidence appendix

**Verifier-only. Implementers must not read this file.**

Writer: #459 spec lane, 2026-10-23. Static listing/data reading only; no
original executable or emulator run. Independent verdicts are not supplied
by this writer; PM must arrange the distinct verifier and test author.

## E1. Identity and prior exact citations

Kaleidoscope 2.3.1 kDEF 0, 107,726 B, SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
Binary: root checkout `.scratch/k231-kdef/kDEF/id-0-680x0_DefProcs.bin`.
Listing: private `campaign-20261021/v2-lanes/L1/annotated/kdef0.annotated.txt`,
SHA-256 `51d75e615906369862959e468812105d330f0e63f7c6a96178dc906ea46d1205`.
Traps.h: Universal Interfaces 3.0.1, private
`campaign-20261021/lanes/RE-advisory/work/traps/Traps.h`, SHA-256
`b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b`.

The preceding `docs/spec/checkable-icons.md` is copied below, unchanged, to
preserve all exact table, address and policy citations. New safe geometry and
transfer rows derive from E3/E4, not from runtime output.

## E2. Predecessor note (verbatim)

# Checkable icon selection

This corrects the modern self-owned icon fallback after CICN selection. It does
not establish an original Resource Manager provider, device depth, mask decoder,
text, or whole-control placement claim. There is no new pressed public option.

## Pinned source

kDEF SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`:
A4 setup at `0x104/0x108` yields base + `0x18a0a`; `0x710e–0x712c` copies
48 bytes from A4 + `0x17e`, resource offsets `[0x18b88,0x18bb8)`.
The table SHA-256 is
`a04ff620dd05d109fbe0fc76247940f15657e9c603381bc30ed92c1264399095`.
These signed values are metadata, not shipped engine bytes.

| Kind | Tier | Value 0 | Value 1 | Value 2 | Value 3 |
| --- | --- | ---: | ---: | ---: | ---: |
| Checkbox | Normal | -10236 | -10235 | -10234 | -10233 |
| Checkbox | Pressed | -10232 | -10231 | -10230 | -10229 |
| Checkbox | Disabled | -10240 | -10239 | -10238 | -10237 |
| Radio | Normal | -10220 | -10219 | -10218 | -10219 |
| Radio | Pressed | -10216 | -10215 | -10214 | -10215 |
| Radio | Disabled | -10224 | -10223 | -10222 | -10223 |

`0x731c–0x732c` starts tier 0, selects tier 1 for blob byte 9, then tier 2
for blob byte 8. `0x73b6–0x73ce` and `0x73da–0x73f2` index
`kind*24 + tier*8 + value*2`. For value 2/3, `0x73ae–0x73d8` probes the
selected `ics#` with GetResource; NULL changes only the value to 1. The final
draw helper also requires the selected mask (`0xf50c–0xf51e`). A missing color
resource is not that NULL result. The source's subsequent color-depth and mask
owner lookup remain outside this modern compatibility implementation.

## Public behavior and evidence boundary

The public Boolean mapping remains mixed → value 2 before checked → value 1,
and disabled → tier 2, otherwise tier 0. That mapping is modern policy. The
normal icon row previously used the source's pressed IDs; it now uses tier 0.
CICN priority, its existing fallback, and all other glyph consumers are unchanged.

The loader exposes optional `inspector.iconMaskResources`: every raw same-fork
`ics#` occurrence, with signed ID, resource index and byte length. A present
empty array establishes no masks in this modern input fork. An absent field is
unknown. This census also includes masks without decoded color art. Color
`iconIndex` entries carry their actual raw `resourceIndex`; checkables require
the exact glyph URL, signed ID, 16px size, matching type/depth and decoded mask.
The highest available color depth remains the existing loader policy.

Only an absent mixed mask triggers same-tier checked retry. Present masks shorter
than 64 bytes or duplicate IDs are unsupported and return null, without treating
them as native NULL. A selected mask without supported color art also returns
null; mono fallback is not added here. A present incomplete or contradictory
inspector cannot bypass these checks. Hand-built themes with no inspector retain
the explicitly unobserved color-art/active-row compatibility fallback.

`checkable-icons.spec.mjs` uses owned forks, independently literal signed IDs and
black/white planes through the public source/built loader. It joins observed
decode URLs to the exact color entry and raw occurrence, separately checks mask
occurrences, and compares every output pixel. It asserts no band-paint event or
historical provider. Two icon-only expectations in the older mixed-CICN fixture
now exercise same-tier checked fallback; all its CICN cases remain unchanged.
No regression golden or synthetic output becomes an original reference.

## Lane order, state bytes, resource files and placement (2.3.1 decode)

Same kDEF SHA-256 as above; file offsets. These rows back the corpus rule
table in `tests/rendering-options/checkable-rules.mjs`. They are read from the
local disassembly and cited by address. They are not executed or shipped.

- State bytes (0x66e8–0x6770): blob byte8 is set when ControlRecord hilite is 254 or 255, so disabled and inactive are one state; byte9 is set for any other nonzero hilite; varCode&7 in {1,3} clears byte10 and byte11, and in {2,4} clears byte10 and sets byte11 (radio).
- CICN lane (0x71ec–0x728a): value is ControlRecord+18; tier starts 1, byte9 makes it 2, byte8 makes it 0; for value 2 or 3 the id -9504+12*kind+3*value+tier is fetched through 0x10472 and a NULL result sets value to 1; the id is then recomputed and fetched again at the same kind and tier. There is no retry at another tier.
- Lane order (0x728c–0x7318): a non-NULL CICN is drawn and the routine exits at 0x7310; a NULL CICN branches to the icon lane at 0x7314, which re-reads value from ControlRecord+18, so the CICN value-1 retry does not carry over.
- Value 3 (0x720a–0x7232, 0x7380–0x73a2): when value is 1 and the Gestalt('Acid') response byte +20 is nonzero, value becomes 3; the CICN lane also requires byte11 = 0 (checkbox), the icon lane does not. What sets that byte is not decoded.
- Resource files (0x10472–0x106ac, 0x7364–0x736c): when Gestalt('Copl') returns noErr (0x104a8), 0x10472 calls UseResFile with the low word of its response, otherwise the current file stays; ids outside its 18-slot cache, or any id when the cache base a4@(3436) is NULL (0x104b0), reach _GetCIcon (0xaa1e), which searches from that file down the resource chain; the icon lane calls UseResFile(0), the System file, before GetResource('ics#'). Which open file owns a found resource is not established for either lane.
- Placement (0x72a0–0x72d2, 0x732e–0x7360, 0x7060–0x70a4): the CICN lane computes h = left + 8 - trunc(width/2) and v = trunc((top + bottom - height)/2) from the control Rect and the CIcon bounds before calling 0xf68c and 0x102d0; the icon lane offsets the global a4@(430) rect by (left + 2, (top + bottom - 12) >> 1), widens it by 2 on each side, erases it (0xa8a3) and adds 4 to its bottom; the shared label routine 0x6d22 moves the pen to left + 18 when byte10 is 0. The helper destination semantics, the a4@(430) rect and the label baseline are not decoded.

### What the modern runtime does with these rows

`composeCheckable` takes `{checked, mixed, disabled}` and has no control Rect,
pressed option or Gestalt state. The corpus rule table therefore declares:
value = mixed ? 2 : checked ? 1 : 0, hilite 255 for `disabled` and 0 otherwise,
`Acid` byte +20 clear, and a resource chain holding only the archive's own
fork. Each of these is an assumption, not an original observation. After a
same-tier CICN miss the runtime retries the normal-tier CICN before the icon
lane. The CICN lane above has no such retry. No shipped archive reaches that
branch, and `mixed-checkable.spec.mjs` keeps it as recorded compatibility
policy. The runtime draws the glyph at x = 0 and the label raster at
glyph width + 5. Comparing that with the pen at left + 18 needs the
label font's side bearing, so geometry stays unknown.


## E3. New address-to-row trace (writer derivation)

| rows | listing fact | independent verdict |
|---|---|---|
| CB1–CB7 | `0x67fc..0x6812` contrlVis; `0x6c3e..0x6c5c` rgnSave and byte10=0→FrameRect. `0x66e8..0x6770` derives disabled/pressed/kind. `0x71c6` tests a2+6==0 before EraseRect; caller semantics not newly decoded. `0x71d2..0x71e8` disabled mode49 else1, then shared label | not supplied |
| CB8–CB12 | `0x71f6..0x7208` cicn tier1/2/0. Acid byte20 conversion at `0x720a..0x7232` also tests a2+11==0. `0x7234..0x7264` special-value NULL retry at1. `0x728c` cicn-NULL enters `0x7314` and re-reads contrlValue at `0x7318` | not supplied |
| icon table / CB13–CB16 | copied48 bytes at `0x710e..0x712c`. `0x7380..0x73a2` repeats Acid conversion without kind check. `0x73ae..0x73d8` probes ics# for2/3. `0x73fa` enters helper; `0xf50c..0xf51e` requests selected mask again | not supplied |
| CB17–CB19 | `0xf4fa..0xf50a` lowDepth true for noncolour port, else A4+1222. `0xf574..0xf59c` clears colour handle for lowDepth; else HomeResFile(mask), Get1Resource('ics8',id), restoring prior file. `0xf5bc..0xf5c4` requires colour resource and A4+1216 pixel map, otherwise mono | not supplied |
| CB20–CB23 | `0xf52e..0xf554` AND of all8 mask longs, +1==0 means all bits set. Mono path also tests picSave and grafProcs (`0xf5dc..0xf5f0`); colour path tests only all-set mask and picSave (`0xf630..0xf63c`). CopyBits/CopyMask at `0xf602`, `0xf61a`, `0xf650`, `0xf66a` | not supplied |
| CB24 / geometry | initial destination rect from A4+430/434 at `0x7102..0x7108`; A4=base+0x18a0a; binary `0x18bb8..0x18bc0` holds Rect(0,0,12,12). `0x732e..0x7360` adds (left+2, arithmetic-half(top+bottom−12)), widens by2, erases, then bottom+=4. Helper source from A4+178/182, binary `0x18abc..0x18ac4` = Rect(0,0,16,16) | not supplied |
| cicn / label geometry | `0x72a0..0x72d2` signed corrected halves truncate toward0; `0x72e6` computes clear-mask region, `0x72ee` EraseRgn before `0x72fe` corner blit. `0x7028..0x7036` only applies small-line baseline decrement when byte10 is true; checkables clear it. `0x7060..0x706c` x=left+18 | not supplied |

The initial 12×12 rect and 16×16 source constants were checked with xxd and
Python byte reads from the pinned binary. No code was executed. The writer
searched the annotated listing for A4+430 and A4+178 uses; the cited consumers
read these constants. A separate verifier must check writers/relocation and
nonzero-bound primitive semantics before implementing the new geometry.

Trap identities from pinned Traps.h: `$A8A1` FrameRect, `$A8A3` EraseRect,
`$A8D4` EraseRgn, `$A889` TextMode, `$A9A0` GetResource, `$A81F` Get1Resource,
`$A9A4` HomeResFile, `$A998` UseResFile, `$A994` CurResFile, `$A1AD` Gestalt,
`$A8EC` CopyBits, `$A817` CopyMask. `$AA73` is absent in this header;
Appearance setup is excluded rather than assigning an unpinned identity.

## E4. Selected exact listing excerpts

```text
    7102:	2d6c 01ae fff8                          	movel %a4@(430),%fp@(-8)
    7108:	2d6c 01b2 fffc                          	movel %a4@(434),%fp@(-4)
```

```text
    732e:	3c2a 0012                               	movew %a2@(18),%d6
    7332:	dc6a 000e                               	addw %a2@(14),%d6
    7336:	0646 fff4                               	addiw #-12,%d6
    733a:	e246                                    	asrw #1,%d6
    733c:	3a2a 0010                               	movew %a2@(16),%d5
    7340:	5445                                    	addqw #2,%d5
    7342:	db6e fffa                               	addw %d5,%fp@(-6)
    7346:	dd6e fff8                               	addw %d6,%fp@(-8)
    734a:	db6e fffe                               	addw %d5,%fp@(-2)
    734e:	dd6e fffc                               	addw %d6,%fp@(-4)
    7352:	556e fffa                               	subqw #2,%fp@(-6)
    7356:	546e fffe                               	addqw #2,%fp@(-2)
    735a:	486e fff8                               	pea %fp@(-8)
    735e:	a8a3                                    	.short 0xa8a3 ; 0xA8A3 _EraseRect
    7360:	586e fffc                               	addqw #4,%fp@(-4)
    7364:	554f                                    	subqw #2,%sp
    7366:	a994                                    	.short 0xa994 ; 0xA994 _CurResFile
    7368:	3a1f                                    	movew %sp@+,%d5
    736a:	4267                                    	clrw %sp@-
    736c:	a998                                    	.short 0xa998 ; 0xA998 _UseResFile
```

```text
    7380:	0c43 0001                               	cmpiw #1,%d3
    7384:	661e                                    	bnes 0x73a4 ; → routine@0x70f6 (target 0x73a4, pcRelative)
    7386:	203c 4163 6964                          	movel #1097034084,%d0
    738c:	43ee ff78                               	lea %fp@(-136),%a1
    7390:	a1ad                                    	.short 0xa1ad ; 0xA1AD _Gestalt
    7392:	2288                                    	movel %a0,%a1@
    7394:	4a40                                    	tstw %d0
    7396:	660c                                    	bnes 0x73a4 ; → routine@0x70f6 (target 0x73a4, pcRelative)
    7398:	206e ff78                               	moveal %fp@(-136),%a0
    739c:	4a28 0014                               	tstb %a0@(20)
    73a0:	6702                                    	beqs 0x73a4 ; → routine@0x70f6 (target 0x73a4, pcRelative)
    73a2:	7603                                    	moveq #3,%d3
    73a4:	3003                                    	movew %d3,%d0
    73a6:	5540                                    	subqw #2,%d0
    73a8:	0c40 0001                               	cmpiw #1,%d0
    73ac:	622c                                    	bhis 0x73da ; → routine@0x70f6 (target 0x73da, pcRelative)
    73ae:	594f                                    	subqw #4,%sp
    73b0:	2f3c 6963 7323                          	movel #1768125219,%sp@-
    73b6:	3044                                    	moveaw %d4,%a0
    73b8:	2008                                    	movel %a0,%d0
    73ba:	e788                                    	lsll #3,%d0
    73bc:	7200                                    	moveq #0,%d1
    73be:	122a 000b                               	moveb %a2@(11),%d1
    73c2:	c2fc 0018                               	muluw #24,%d1
    73c6:	41ee ff80                               	lea %fp@(-128),%a0
    73ca:	d1c1                                    	addal %d1,%a0
    73cc:	d1c0                                    	addal %d0,%a0
    73ce:	3f30 3200                               	movew %a0@(0,%d3:w:2),%sp@-
    73d2:	a9a0                                    	.short 0xa9a0 ; 0xA9A0 _GetResource
    73d4:	201f                                    	movel %sp@+,%d0
    73d6:	6602                                    	bnes 0x73da ; → routine@0x70f6 (target 0x73da, pcRelative)
    73d8:	7601                                    	moveq #1,%d3
    73da:	3044                                    	moveaw %d4,%a0
    73dc:	2008                                    	movel %a0,%d0
    73de:	e788                                    	lsll #3,%d0
    73e0:	7200                                    	moveq #0,%d1
    73e2:	122a 000b                               	moveb %a2@(11),%d1
    73e6:	c2fc 0018                               	muluw #24,%d1
    73ea:	41ee ff80                               	lea %fp@(-128),%a0
    73ee:	d1c1                                    	addal %d1,%a0
    73f0:	d1c0                                    	addal %d0,%a0
    73f2:	3f30 3200                               	movew %a0@(0,%d3:w:2),%sp@-
    73f6:	486e fff8                               	pea %fp@(-8)
    73fa:	61ff 0000 80be                          	bsrl 0xf4ba ; → routine@0xf4ba (target 0xf4ba, pcRelative)
    7400:	204b                                    	moveal %a3,%a0
    7402:	a01b                                    	.short 0xa01b ; 0xA01B _SetZone
    7404:	3f05                                    	movew %d5,%sp@-
    7406:	a998                                    	.short 0xa998 ; 0xA998 _UseResFile
```

```text
    f574:	4a03                                    	tstb %d3
    f576:	6704                                    	beqs 0xf57c ; → routine@0xf4ba (target 0xf57c, pcRelative)
    f578:	95ca                                    	subal %a2,%a2
    f57a:	6022                                    	bras 0xf59e ; → routine@0xf4ba (target 0xf59e, pcRelative)
    f57c:	554f                                    	subqw #2,%sp
    f57e:	a994                                    	.short 0xa994 ; 0xA994 _CurResFile
    f580:	361f                                    	movew %sp@+,%d3
    f582:	554f                                    	subqw #2,%sp
    f584:	2f0b                                    	movel %a3,%sp@-
    f586:	a9a4                                    	.short 0xa9a4 ; 0xA9A4 _HomeResFile
    f588:	a998                                    	.short 0xa998 ; 0xA998 _UseResFile
    f58a:	594f                                    	subqw #4,%sp
    f58c:	2f3c 6963 7338                          	movel #1768125240,%sp@-
    f592:	3f2e 000c                               	movew %fp@(12),%sp@-
    f596:	a81f                                    	.short 0xa81f ; 0xA81F _Get1Resource
    f598:	245f                                    	moveal %sp@+,%a2
    f59a:	3f03                                    	movew %d3,%sp@-
    f59c:	a998                                    	.short 0xa998 ; 0xA998 _UseResFile
```

```text
    f5bc:	200a                                    	movel %a2,%d0
    f5be:	6706                                    	beqs 0xf5c6 ; → routine@0xf4ba (target 0xf5c6, pcRelative)
    f5c0:	4aac 04c0                               	tstl %a4@(1216)
    f5c4:	6658                                    	bnes 0xf61e ; → routine@0xf4ba (target 0xf61e, pcRelative)
    f5c6:	2d53 ffe6                               	movel %a3@,%fp@(-26)
    f5ca:	3d7c 0002 ffea                          	movew #2,%fp@(-22)
    f5d0:	2d6e fff8 ffec                          	movel %fp@(-8),%fp@(-20)
    f5d6:	2d6e fffc fff0                          	movel %fp@(-4),%fp@(-16)
    f5dc:	4a04                                    	tstb %d4
    f5de:	6612                                    	bnes 0xf5f2 ; → routine@0xf4ba (target 0xf5f2, pcRelative)
    f5e0:	206e fff4                               	moveal %fp@(-12),%a0
    f5e4:	4aa8 005c                               	tstl %a0@(92)
    f5e8:	6608                                    	bnes 0xf5f2 ; → routine@0xf4ba (target 0xf5f2, pcRelative)
    f5ea:	2048                                    	moveal %a0,%a0
    f5ec:	4aa8 0068                               	tstl %a0@(104)
    f5f0:	6714                                    	beqs 0xf606 ; → routine@0xf4ba (target 0xf606, pcRelative)
    f5f2:	486e ffe6                               	pea %fp@(-26)
    f5f6:	2f03                                    	movel %d3,%sp@-
    f5f8:	486e fff8                               	pea %fp@(-8)
    f5fc:	2f06                                    	movel %d6,%sp@-
    f5fe:	4267                                    	clrw %sp@-
    f600:	42a7                                    	clrl %sp@-
    f602:	a8ec                                    	.short 0xa8ec ; 0xA8EC _CopyBits
    f604:	606c                                    	bras 0xf672 ; → routine@0xf4ba (target 0xf672, pcRelative)
    f606:	486e ffe6                               	pea %fp@(-26)
    f60a:	486e ffd8                               	pea %fp@(-40)
    f60e:	2f03                                    	movel %d3,%sp@-
    f610:	486e fff8                               	pea %fp@(-8)
    f614:	486e fff8                               	pea %fp@(-8)
    f618:	2f06                                    	movel %d6,%sp@-
    f61a:	a817                                    	.short 0xa817 ; 0xA817 _CopyMask
    f61c:	6054                                    	bras 0xf672 ; → routine@0xf4ba (target 0xf672, pcRelative)
```

```text
    f630:	4a04                                    	tstb %d4
    f632:	660a                                    	bnes 0xf63e ; → routine@0xf4ba (target 0xf63e, pcRelative)
    f634:	206e fff4                               	moveal %fp@(-12),%a0
    f638:	4aa8 005c                               	tstl %a0@(92)
    f63c:	6716                                    	beqs 0xf654 ; → routine@0xf4ba (target 0xf654, pcRelative)
    f63e:	206c 04c0                               	moveal %a4@(1216),%a0
    f642:	2f10                                    	movel %a0@,%sp@-
    f644:	2f03                                    	movel %d3,%sp@-
    f646:	486e fff8                               	pea %fp@(-8)
    f64a:	2f06                                    	movel %d6,%sp@-
    f64c:	4267                                    	clrw %sp@-
    f64e:	42a7                                    	clrl %sp@-
    f650:	a8ec                                    	.short 0xa8ec ; 0xA8EC _CopyBits
    f652:	6018                                    	bras 0xf66c ; → routine@0xf4ba (target 0xf66c, pcRelative)
    f654:	206c 04c0                               	moveal %a4@(1216),%a0
    f658:	2f10                                    	movel %a0@,%sp@-
    f65a:	486e ffd8                               	pea %fp@(-40)
    f65e:	2f03                                    	movel %d3,%sp@-
    f660:	486e fff8                               	pea %fp@(-8)
    f664:	486e fff8                               	pea %fp@(-8)
    f668:	2f06                                    	movel %d6,%sp@-
    f66a:	a817                                    	.short 0xa817 ; 0xA817 _CopyMask
```

## E5. Corpus and independent verification obligations

The safe corpus partition and216-row count are the existing independent
`checkable-rules.mjs` / `checkable-rules.test.mjs` declaration:13 cicn archives,
5 icon archives; Animals radio mixed retries to checked in2 rows. Existing
rules explicitly do not discriminate the modern normal-tier retry with corpus
inputs; sparse synthetic resources are required. No selection assertion proves
System-file/owner/depth transfer or native typography.

Re-trace every CB row and all six table ranges; mark each CONFIRMED/REFUTED
with verifier identity/date and checked listing in a separate verification
artifact. Geometry, colour-vs-mono transfer and repeated mask lookup are new
requirements, not existing reviewed runtime behavior. Run every §7 mutation
through the separate test-author lane. No self-review, native evidence,
status promotion or runtime/test change is part of this deliverable.
