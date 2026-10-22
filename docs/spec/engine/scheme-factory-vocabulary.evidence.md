# scheme-factory-vocabulary — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/scheme-factory-vocabulary.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`scheme-factory-vocabulary.md`](../scheme-factory-vocabulary.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Implications for the widget-presence flag field (original)

````text
Our `docs/spec/kdef231-reference.md` §7.6 calls out the
`a4@(0x1f0/0x1f4/0x1f5/0x1f9/0x1fc)` mystery — a 16-bit-ish field per
window-type whose bits gate the close/zoom/collapse/grow widgets. Scheme
````

## Re-extract commands (original)

````text
> Re-extract:
> ```sh
> curl -L https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/SchemeFactoryPR2.sea.hqx -o sf.sea.hqx
> unar -o /tmp/scheme-factory sf.sea.hqx
> xattr -px com.apple.ResourceFork '/tmp/scheme-factory/Scheme Factory 1.0pr2/Scheme Factory 1.0pr2' | xxd -r -p > /tmp/sf-rsrc.bin
> node /tmp/probe-sf.mjs  # the probe script
> ```
````
