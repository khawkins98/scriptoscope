# Full-envelope input bindings

This is a repeatable **modern conversion observation**, not acceptance evidence.
The full draft envelope remains OPEN. All 18 canonical sources, 15 families and
594 source/family/path cells remain in scope; no representative option sets are
chosen here. Each source has one shared inventory, referenced by its envelope
cells. A reference does not mean every family consumes every resource.

```sh
# Node 24; no browser, image encoder, original emulator or network required.
node --experimental-strip-types tests/acceptance-bindings/generate.mjs --write
# Regenerate in memory and require byte-identical output (also in gates).
npm run test:acceptance:bindings
node --experimental-strip-types --test tests/acceptance-bindings/*.test.mjs
```

The generator reuses the canonical `enumerateForks`/`selectFork` contract and
separately runs the actual modern StuffIt selector and public raw loader.
`actualLoader.agreement` compares fork hash **and entry identity**; disagreement
retains a separate actual-loader inventory rather than silently replacing the
canonical input. Loader manifest and complete asset-plane parity are checked
against the portable `convertScheme`/`buildThemeJson` path. No PNG/URL generation
is necessary. Sidecar metadata, registry records, the complete registry/envelope
and the listed conversion/resolver source files are hashed. These listed files
are an explicit toolchain boundary, not a fingerprint of Node or the host OS.

`bindings.json` contains no resource payloads or decoded pixels. Its `tables`
object documents compact rows; a resource's zero-based row number is the parser
occurrence index. Every raw occurrence survives, including unsupported types,
signed IDs, duplicate type/IDs and errors. Duplicate groups can be found by
matching type/ID; they are never collapsed. `chromeStatus` is the actual chrome
conversion pass status, independent of the separate `iconStatus`. Chrome/pattern
catalog links carry exact observer references (including paired cinf or null).
Emitted icon links explicitly follow `convertIcons`' first sufficiently long
occurrence and first matching mask policy; they are not observer-derived or
original Resource Manager claims. Both short and shadowed duplicate icons remain
listed. A parser-level error stops generation; conversion aborts retain raw
records with unknown status, rather than manufacture successful emissions.

All actual `windowTypes` keys are retained, including custom/suffixed keys and
corner-sprite synthesis. Canonical/equivalent keys come from the existing
`wndCascade` identity helpers, whose authority is `window-type-identities.js`.
Window asset links list **all matching occurrence candidates**; a duplicated
path is not a unique ownership proof. Window geometry and complete manifest
values are hash-bound, not copied as a second recipe authority. The generator
does not execute window resolution, state fallback, collapse, base-chain lookup
or paint. Alias equivalence is not missing-resource fallback. Current child
selection may choose a heuristic before consulting a base; this inventory does
not certify that behavior historically.

The declared recipe is standalone `baseChain: []`, default display policy,
no prepared font, and no text rendering. It is one reproducible modern input
recipe, not a historical default or a restriction of the acceptance target.
Arbitrary chains/settings and original environment/provider/cache order remain
OPEN/UNKNOWN. Explicit measured profiles and prepared fonts require their own
case bindings; their absence here does not establish original device or font
conditions. No ledger, reference intake, availability or coverage status changes.
