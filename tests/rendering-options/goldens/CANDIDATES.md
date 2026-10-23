# #459 reviewed Linux golden delta

These changed PNG hashes have separate Tier-2 visual acceptance, carried through
the independently reviewed DOM repair; see the #459 section in `REVIEW.md`.
Recording and byte-identical verification alone do not approve images or establish
original-engine typography fidelity. The historical candidate receipts below are
retained without rewriting capture provenance.

Recorded with `npm run test:rendering:container -- record` in the pinned Linux/amd64
Playwright 1.64.0 Noble image (digest in manifest.json), Docker 29.4.0, Chromium
156.0.8078.4, DPR 1. Runtime source is the integrated baaace9856d6fe8eca1cbc52c9af5441b0e0778f
base; this lane changes tests and acceptance metadata only. The manifest's
execution commit is null because recording occurred with uncommitted test/metadata
changes; this does not certify a clean execution. Runtime source was unchanged
from the named base. Compared with the previous seed, only the bundle and
package-lock provenance hashes change; the lockfile change was already in the
base, and this lane does not edit it. The stylesheet hash and full environment
are identical. Final exact-head readiness binds the committed delivery separately. The first recording
was disrupted by concurrent build/report artifact writers (33 pass/3 fail); its
logs/artifacts are preserved. The isolated serial rerun passed all 36 pages.

Expected change: sliced-window title samples follow window-widgets TC1–TC5 and
the declared existing alpha-over substitute-glyph policy, with raw equality
suppressing shadow and differences drawing it first at (+1,+1). Narrow title
markers follow TF1/TX4/TX5. The independent source/built contracts separately check
raw RGB16 samples, mask-clear pixels, paint order, clipping, whole fitting titles,
and the ellipsis-only boundary. Snapshot output is not their oracle.

The unchanged 70-case inventory was retained: no utility-window golden case is
added, so these images do not establish #423 collapsed utility geometry (covered
by the public source/built rule contracts instead). No status, closure, source
archive, font, stylesheet or golden environment/case-inventory change is claimed.

16 of 36 PNGs change; 113,968 backing pixels differ, total compressed PNG size delta +25,320 bytes. Dimensions are unchanged on every page.

Old/new/full RGB diff and vivid changed-pixel masks for all 36 pages, exact pixel counts/bounds/hashes and the diagnostic crop are retained at:

`/Users/khawkins/Documents/git/scriptoscope-lanes/459-tests-followups/`

See `old-goldens/`, `new-goldens/`, `diff-goldens/`, `golden-delta.json`, and `1138-title-old-new-diff.png`. These are durable local review artifacts outside `/tmp`.

| PNG candidate | Changed pixels | Old SHA-256 | New SHA-256 |
|---|---:|---|---|
| 1138-page-1.png | 4067 | `96a24e6f6c6fb49ba3c531d91bd4a6eea75633628224b34e47af25eee4303503` | `a3989b5a677d28fa2512b4bba885f664bd1387c2cdebbd82402bb9c78401a58e` |
| 1138-page-2.png | 5810 | `a8e4b74fd1934c12e96eb3952b7ff2f32c04fc0c50e996e734269b13c06e5a8c` | `1c99869b5cd2e09a1d16040080c068ed47eed9de0a55115e30992386104a185f` |
| 1984-page-1.png | 7518 | `1de4b72c3887ff7a07c31218c504d338e5157b66ba174ff2149b59e9975a5d44` | `08c77db1916882f6f48f8ea2a837602d80474097a1b03f6f06288671e2ecb2ca` |
| 1984-page-2.png | 10740 | `47282256d229671fb32b808fa21d46b5f03e435acf0d8c70e17a906b2bddeb5f` | `c6051320eb4a629677a1a66aa48ad77588c1d8aab14530e0946345ec92e614d1` |
| 1990-page-1.png | 4543 | `3576feb963d839c15a2bfafbe0d5d3fa9eac464de7f51baa94440e793221c83e` | `0d36c136719b54b4e53c67e3f0cd6935d0e9ecbece009622e303e696e1951977` |
| 1990-page-2.png | 6490 | `b29480e79e89fc5a9a4e84f1084275c9869220034b54d612aadc71ec631892b8` | `910315b466284207b63881ca00ce312503fc2dab2d5e65e228ea26a42723cd62` |
| animals-page-1.png | 5880 | `b96628751f53a286cb681f01c90810f80dd126d13d7aaa64f840169521e6f1f9` | `3b25b22cd7c08eb387c6148ec39b03d2a6713b7e41c4f3673ad4501e72f95e4e` |
| animals-page-2.png | 8400 | `42119172b35b5fa0afd11eb86dee4c547690b4a7d0dd16453a35296b546818e4` | `8bcbbc299792251dfe8cb32254ce3e377e93377a71399fd3e7d6ada39716e878` |
| crayon-os-page-1.png | 8246 | `ea5b71219a791a4545a111de6d25147bf478bbfb1d83501a02bcea6ff596f577` | `f3fb503acd51bef2552b282662c7cc5c4f2d3bb1bb44f669ea3a31ffca90b5f5` |
| crayon-os-page-2.png | 11780 | `cf4eb8fe5a388317d802b9eab3b1203963c52324b1110e6113974364c962933c` | `c7be47dfa8d33659729d95f40ecc96e93bb9b9ee9348c7ade6bf276e44b3ac91` |
| dolphin-som-page-1.png | 2359 | `d0de293da2b13d80b145505da38d8409e6f5e2d0fb660871098c995ef742637c` | `c0b8a4bf72f07a8f29d5952143e4ec43fbc086c880cc12ce667ee80c883a66c0` |
| dolphin-som-page-2.png | 3370 | `4c3cd511fbed6586850953f25ad4e508d244410b3cdf044c27f9302e35512f5a` | `dbcb5fef3db8987467312c57f2f6220c649b6b07194c3c79603c19d350a7bcf1` |
| floppies-page-1.png | 7413 | `6ed443ba92490fccdc360d9903c7115c7e59c757b83b22149b13ac684b9fe1d7` | `32a615bdd700e753f816b9738f93956186995a891c0d7d414b3b98a6922c0580` |
| floppies-page-2.png | 10590 | `fc48bc104e3e5900f2e3b30bd8208c03005f71c25f9dbe4ad34a8edca0f3d73b` | `cb8f6bad0bebec7181e92f7bfe9fb58f033d5d93c91fffd6f38d499f8784b914` |
| monkey-paradise-page-1.png | 6902 | `5ca635b67d45602341fe279e0090edf6a0a7c725a997dd4318f1862a6814d040` | `daf41802f25292263e0a2ca4df19331687e1211c0588e48c2aa122ee61db42a6` |
| monkey-paradise-page-2.png | 9860 | `6b60d50b47cdd25fc0b03c855fc216897ed18e0c8a408603c5f7afee04461569` | `f16f5594423c8f79c6b6660e8a92006cf37f8fb8992591d08ccbb6746e7b30d3` |
