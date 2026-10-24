# Push-button resource selection

The kDEF 2.3.1 branch at 0x7572–0x7594 selects a signed resource ID:
disabled uses −10240, pressed uses −10238, otherwise normal uses −10239.
The branch passes that ID to the face painter without consulting resource names.
The existing [source reference](kdef231-reference.md) pins
the dispatch; this correction does not alter that reference or its evidence.

Within each loaded owner, Scriptoscope now selects a usable exact negative ID
before named role aliases. A menu-like author label does not veto −10239, and
a differently numbered element named `push-button-active` does not replace it.
Diagnostics report this choice as `source-dispatch` / `resource-id`, retaining
the actual selected key, owner and decoded resource identity.

## Current migrated push/default policy

For migrated push/default composition, a missing canonical signed face does not
enter the former named-role, positive-ID, anti-role, cross-state or raw-ID escape
ladder. The engine requests the PB state ID from the declared archive/base
resource environment. A successful base request retains that actual base owner
and signed identity; a positive local alias cannot replace it. Missing art is
unavailable. Known art plus same-ID/default metadata NULL skips body/border under
PB9/DR6; selected malformed or UNKNOWN data is not NULL. A visible native consumer
replacement is separate browser presentation policy, not a legacy source paint.

The previous facade's alias/heuristic and active-state fallback vocabulary is
historical for these migrated families. It remains relevant where an unmigrated
family still explicitly supports it: bevel compatibility retries and tab
selection are not changed by the PB migration. Exact completed-operation
diagnostics, signed resource/owner joins and admission-versus-paint distinctions
remain required. See [engine/push-button.md](engine/push-button.md) and
[control-resolution-diagnostics.md](control-resolution-diagnostics.md).
Duplicate-resource selection, historical provider/cache ordering and decoder
correctness remain separate obligations; the declared modern chain is not proof
of original Resource Manager precedence.

The triggering Animals comparison retained the original 80×20 normal capture,
measured profile and canonical −10239 source pin. Before the correction it
selected −10238 and differed at 1,404 pixels; pressed and inactive matched.
That failed result remains retained independently of subsequent checks. The
new source/built comparisons must establish any corrected output claim without
changing those reference pixels, profile mappings or expected source inputs.
