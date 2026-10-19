# Default-button caller boundary — read-only source review

Status: independently reviewed static source interpretation (#277), not a runtime change or reference admission. Original bytes were inspected offline and are not redistributed. The [v6 observations](../research/default-dialog-observations/2026-10-18/CONTEXT.md) and metadata remain immutable; this note expands their bounded PACH lead without changing their factual observations.

## Three distinct contracts

1. Apple TN1148 publicly specifies SetDialogDefaultItem plus standard-filter participation: the chosen item receives a default border and Return/Enter handling. A fully conditioned capture can establish that API output without identifying every internal painter. Source: https://leopard-adc.pepas.com/technotes/tn/tn1148.html (1999-01-11).
2. The kDEF control-data/default route uses the Acid auxiliary record: at 6b14–6b66 the control-data tag `dflt` writes auxiliary byte30; 7698 applies InsetRect(-4,-4), then 76a8/76b2 checks Acid/byte30 before its ring dispatch. This is a control-painter route, not a global default-border enable switch.
3. PACH130 independently intercepts FrameRoundRect. It does not read an Acid record. Its resource choice and paint/erase branch depend on the current pen/port/colors, not simply a control's disabled or window-active state. Scriptoscope's current direct `default:true` policy cannot yet be called equivalent to all public Dialog Manager output.

## Exact PACH source identity and incoming arguments

Installer PACH130, 87914 bytes, SHA256 bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44. All addresses below are relative to the named resource payload. The independently pinned [installer/resource chain](./kdef-binary-inventory.md#pach-identity-and-reconstructed-source-chain-2026-10-18) is reused, not reconstructed from filenames. The kDEF 0 comparison uses 107726 bytes, SHA256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`. This identifies static installer components; it does not prove a running installation or patch stack.

FrameRoundRect registration292c and wrapper binding24ba lead to98be; 98d0 calls d528. At d530–d538 the function receives caller Rect pointer (fp12), two oval dimensions (fp10/fp8). It obtains the port and full PenState at d540/d546. In the ordinary themed path it uses the caller rectangle directly; there is no kDEF-style unconditional -4 outset here. A special monochrome screen-port branch temporarily adds a saved offset at d73a–d744 and reverses it at d7ea–d800; that is not a universal border outset.

## Guards and branch meanings

The following offsets are independently checkable from the original binary; the interpretation uses the Apple Universal Interfaces 3.4.1 [Quickdraw.h](https://github.com/elliotnunn/UniversalInterfaces/blob/328d38f2b72b2d4ceda30170eea32ca6b9de218a/3.4.1/Universal/Interfaces/CIncludes/Quickdraw.h) GrafPort/CGrafPort/PenState layouts. `PenState` is point, size, mode, then eight pattern bytes; both port layouts place `pnVis` at66, `picSave` at92 and `rgnSave` at96. The color-port pen PixPat handle is at58.

- d548–d59e: separate oval22x22/Rect top-left(-3,-3)/pen3x3 special case, including another settings/height guard; it calls the saved original routine after a temporary top adjustment. Not the ordinary default path.
- d5a2–d5e2: oval16x16/height28/pen1x1 creator-specific early return for `chsk`/`GKON`. Creator helper attribution remains bounded to the returned signature comparison.
- d5e6–d5f8: non-null port rgnSave(+96) or picSave(+92) delegates to the saved original routine at d816. Thus region/picture recording is a distinct route.
- d5fc–d61c: oval dimensions must be <=16 and pen size exactly3x3, else original routine. There is no positive lower-bound check here.
- d620–d634: portVersion/rowBytes high bits identify color-port layout. d644–d648: negative pnVis(+66) returns without drawing.
- d640 initializes `erase=false`; d642 initializes `normalResource=true`.
- d65e–d676 sets erase if all foreground RGB16 components are FFFF. d678–d6a4 sets erase when foreground equals background and is nonblack.
- d6a6–d6c6 examines the two PenState pattern longs: OR==0 sets erase; OR neither0 norFFFFFFFF clears normalResource and calls PenNormal. Note OR==FFFFFFFF does not prove every pattern bit is1, so do not overstate this as an all-black-pattern test.
- d6cc–d6d4 sets erase when pnMode==11.
- d6d6–d6e8 sets erase for a color port whose pen PixPat's first word is nonzero.
- d6ea–d6fc clears normalResource if any foreground RGB16 component is nonzero.
- d708–d7a4 handles the monochrome screen baseAddr match and saved-port/region/pen preservation; not needed to pretend all destination origins are known.
- d7a6 resets pen size to1x1; d7ae passes erase, d7b0 passes the current Rect, d7b6/d7bc chooses -10231 when normalResource remains true, otherwise -10232; d7c2 calls6e4c. This resource-name convention does not turn these predicates into active/inactive state checks.
- 6e4c–6e84: erase=true builds a region using778a (body=false), then EraseRgn at6e7c only if construction succeeded. 6e86–6e9a: erase=false calls6ea6 with body=false and null color outputs.
- 6ea6 loads the actual cicn via cache1367a or65ee, then same-ID cinf via7ea2; missing cinf falls back to cinf1 for this body=false invocation (6f28–6f3e). Actual resource owner still depends on the source's resource/cache environment. Missing cicn returnsfalse, rather than proving any particular builtin outline.

## What v6 does and does not establish

The already preserved v6 public invocation succeeded through standard-filter participation and Return selection while the observed Acid byte30 was0. Those before/after zero readouts are not a reliable proxy for public default-border state: the byte was not instrumented during paint, so a transient change is not excluded. The static PACH route independently establishes a possible path without an Acid-byte check; it is a compatible explanation, not an observed dynamic branch or selected-payload proof. v6 lacks an instrumented FrameRoundRect call rectangle/pen/port snapshot, so its 204/628 changed pixels cannot determine which of the above branches ran. Font, palette, provider and transport conditions remain the existing partial-reference issues.

## Next bounded evidence

For a future conditioned black-box public capture, retain the public call sequence, actual control/default-item state, window/control rectangle and environment observations; do not require internal branch tracing merely to admit geometry evidence. For attribution to this specific PACH route, separately record actual FrameRoundRect arguments and pen/port fields at the call boundary, or provide a source-proven original Dialog Manager caller with that exact state. The latter proof is not currently available in this review. A direct FrameRoundRect experiment with explicit pen state could isolate the patch contract, but is a different public invocation and must not be relabeled as DialogDefault.

No change to Scriptoscope ring outset, state selection, erase behavior, or resource ownership is justified by the current partial capture alone. A later implementation should expose/choose a declared caller contract rather than silently combining kDEF default flags with PACH pen-state predicates.

## Review and remaining claim boundary

Two automated reviewers independently checked the pinned binary identity and fourteen opcode bindings, the ordinary guard/dispatch ranges, and the region-versus-paint wrapper. This is source review, not human attestation of an original capture. Prior shorthand that treated an observed Acid0 field as globally disabling authored default borders is superseded by the separate source routes above. The original public Dialog Manager caller rectangle and during-paint state remain unknown. No capture eligibility, requirement assessment, golden, or compatibility-authority version changes with this note.

## Public Scriptoscope option and transition observations (2026-10-19)

`ButtonOptions.default` requests the kDEF-style control-painter ring around the
button face. It does not perform `SetDialogDefaultItem`, select a dialog item, or
install Return/Enter handling. The current ring geometry/state policy remains
unchanged; this option is not a promise of equivalence with every DialogManager
caller sequence.

The [v11/v11b System7 observations](../research/default-dialog-transitions/2026-10-19/README.md)
record successful public default-item switches between two empty buttons with
actual standard-filter processing. Their complete port planes did not change.
v11 explicitly erased/redrew after the setter; v11b removed that operation and
used genuine 1→2→1→2 switches. The differing v6 output remains unresolved. These
negative results establish only these caller sequences, not absence of native
default painting, an internal route, or a renderer bug. No authority, intake or
requirement status changes.
