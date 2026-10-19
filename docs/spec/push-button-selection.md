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

When that owner's exact signed art is absent, named roles and positive-ID aliases
retain their compatibility behavior. Positive aliases retain the existing label
heuristic. Self-first base traversal, active-to-pressed, inactive-to-active and
the final raw-ID escape remain modern policies, not proven native lookup order.
Duplicate-resource selection, provider/cache behavior and decoder correctness
are separate obligations.

The triggering Animals comparison retained the original 80×20 normal capture,
measured profile and canonical −10239 source pin. Before the correction it
selected −10238 and differed at 1,404 pixels; pressed and inactive matched.
That failed result remains retained independently of subsequent checks. The
new source/built comparisons must establish any corrected output claim without
changing those reference pixels, profile mappings or expected source inputs.
