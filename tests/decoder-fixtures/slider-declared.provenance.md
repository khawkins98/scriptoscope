# Independent slider contract candidate (#427 / #459)

Runtime under test: `b540d193733d0e77a9c803bf734350cb9d60efab`.
The test author owns no runtime or loader changes. Expectations come from
`docs/spec/slider-layout-cinf.md`, `engine/slider.md` G1/CF1/CF3, §5.2,
SL1/SL3–SL6 and `slider-interaction.md`, with DECISIONS #9 for pressed art.
This is modern declared-input consistency coverage, not original acquisition
or a historical Resource Manager search-order claim.

`slider-declared.mjs` serializes owned opaque indexed8 art with endpoint palette
colors. The archive has corner 5 and a two-pixel, one-column groove; external
provider A has corner 3 and a one-pixel tiled groove; B has corner 5 and the
archive-like slicing. The provider may contain deliberately different cicn art,
but the declared tier is cinf-only. Reordering providers changes metadata, never
art ownership. The 48px axis and 7px thumb with corner 3 imply travel 35;
normal starts are 3, 11, 20, 38 at normalized 0, .25, .5, 1 horizontally,
and 38, 29, 20, 3 vertically. Truncation (not rounding) gives both .25 and
vertical .5 boundaries. State cells normal/pressed/disabled are red/green/black.

The seven-color groove source axis is `RGBWKYC`. Literal runs at length 48:
start-anchored k1: `R` + first 46 columns of repeating `GBWKY` + `C`;
end-anchored k1: `RY` + nine `GBWKY` tiles + `C`;
one-column k2: `RG` + 44 `B` + `YC`. Other pixels are opaque white, unless
covered by the independently placed thumb. The 19px-wide groove has RGB stripes
across its width: SL1 puts it at trunc((16−19)/2) = −1, exposing source rows
1..16 in the clipped control. A floor would expose rows 2..17 and fail.

Complete provider payloads include byte 3, so 0/1/2/3-byte grooves fail CF3,
whereas a one-byte corner and explicit corner zero remain valid. A trace test
checks gate/corner/groove requests, missing outcomes, fallback to declared
group0 metadata, ordinary archive cicn/ppat authority and suppressed archive/base
cinfs. Trace binding and private typed corner provenance are source-only;
public complete planes and interaction run against separate source/built servers.

Both ordinary and declared imperative paths exercise an off-center thumb grab
at exact .25, a 7px drag over 35px travel (result .45), and an interior centered
track click (result .6), horizontally and vertically at CSS scale 2. Native
bounds 10..20, step .25 retain exact 12.5 on grab and reach 20 after full travel.
A paused actual image decode checks pre-await option/asset snapshots. Existing
native range tests retain stale pressed-paint, teardown, numeric sanitization,
zero-travel and missing-thumb coverage; their imperative exact grab now correctly
expects no callback. Scrollbar callbacks retain their old expectation.

The unchanged historical `slider-endpoints.mjs` source/fork/payload pins are
retained. Its provider contains only one-byte corners: declared gate now admits
it and suppresses archive groove metadata, yielding red thumbs over white. Its
ordinary path still hands off. The old pinned registry binding ID remains a
historical fixture record; the verifier independently computes current generic
binding identity from environment ID, fork hash, completeness and provider data.
No historical ledger status, case input, denominator, golden or spec is changed.
The old decoded loader role is replaced by opaque manifest identity plus the
typed adapter's actual corner selection joined to load ID, resource occurrence,
actual decode URL and complete output plane.

A blocking regression deliberately fails on this runtime: a complete first
provider can hide a later incomplete provider. The coordinator adjudicated
whole-declaration completeness mandatory on 2026-10-23. The Node adapter and
source/built public composition reproduce this independently; each begins with
a passing complete-provider control. Public controls include empty base gate
payloads (presence-only CF1), so all engine cinf requests hit provider A and
cannot accidentally discover B through a missing first request. Runtime repair
belongs to a different author; these tests must not be weakened to pass.

`slider-mutations.mjs <durable-directory> [node|browser|mutation-id]` injects
independent runtime faults using Node load hooks or intercepted source responses;
it never writes runtime files. Each mutation has its own unmodified positive
control. A killed mutation requires the named assertion diagnostic and exit 1;
setup errors, TypeError/ReferenceError, unrelated exceptions and timeouts do not
count. The final set covers provider order, corner payload use, duplicate/empty/
unknown input, owner asset and marker deletion, archive groove mixing, truncated
groove payload, full-canvas travel, absent track centering, grab reanchoring and
vertical sign. It is a bounded probe set, not an exhaustive mutation score or a
built-minifier mutation test. Earlier invalid probe receipts are retained.

Acceptance-binding regeneration changes only the four toolchain hashes below.
Input forks, 18 source inventories, selections, all 594 envelope cells and all
OPEN/UNKNOWN statuses remain byte-identical. This records the already frozen
loader migration; no selection or source-input delta is accepted.

| Toolchain file | Previous sha256 | Frozen sha256 |
| --- | --- | --- |
| tools/theme-loader/buildThemeJson.js | f2256e76ab0a510b286f91f3cbc23d53c3b479e637e794801232718ccbd1bf3c | 37116b897bfa61182fdc4c48b15a459937b696f18347a0a82194c8bf38ae3d5e |
| tools/theme-loader/cinf-environment.js | f9140388bab7d1cb8a29989e1f43b0e0ab35e0e03c5e87745f31911ab21d9dbe | 3db1d5247f3d457eb61e04be4245d5518d5e5a6b3e76c268ee540e7412e0a87a |
| tools/theme-loader/convert.js | 2b6a4e7f2c12c3c3bb3e90cad2b1c687ef9199537cdfb8997013138a3bdde0a4 | 172693d4a36f0dceb5d78d1838538af33eccbf79bec5fbbf6d0b1ba9048679f3 |
| tools/theme-loader/loadKaleidoscopeScheme.js | dad280dfa1f6ccb172822f723c6efe5ed867dd4ee622bed5bcaa90131dc136e1 | b110b7236be8b20f7fc2e8bb0baeaeb689421b7eb8ca519b600c03a65219922e |

Durable command receipts, rejected probe logs and exact-head result are kept at
`/Users/khawkins/orca/receipts/459-slider-tests/`. Original device/cache/search
order, native captures, visual review, goldens and original acceptance remain
unknown or owned by the PM's different Tier-2/visual reviewer.
