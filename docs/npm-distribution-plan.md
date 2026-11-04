# npm distribution proposal

Status: draft for review, 2026-11-04. Tracker: [#649](https://github.com/khawkins98/scriptoscope/issues/649).
This proposes future work; the [current release procedure](../CONTRIBUTING.md#cutting-a-release)
still produces GitHub releases and Pages deployments only.

## Recommendation

Publish one browser-oriented, ESM-only `scriptoscope` package using the existing
entrypoints. Keep themes as separately hosted inputs. The current renderer and
application-owned attachment/lifetime model can support npm consumers without a
rewrite. Treat npm publication separately from the [v1 threshold](https://github.com/khawkins98/scriptoscope/issues/168).

The changes needed are at the distribution boundary: a complete npm setup recipe,
predictable package contents, bundled dependency notices, a few additional consumer
checks and a publisher connected to the existing release gate.

## What exists today

Inspected commit: `8f5635699fd7a5fe666187b1af87bd9ae4b5000c`, package `0.9.0`.

| Area | Current implementation | Implication |
| --- | --- | --- |
| Package surface | Root, `/renderer`, `/declarative`, `/scriptoscope.css`, `/package.json` exports | Keep these supported paths; internal files are implementation details. |
| Build | Vite multi-entry ESM plus TypeScript declarations, CSS and loader declarations | A usable package build already exists. |
| Browser decoder | Lazy StuffIt decoder chunk; generated munbox module embeds WASM bytes | Consumers should not need Emscripten or manually copy a separate WASM binary. Verify the actual package in a browser. |
| Themes | `loadTheme(url)` or bytes through `loadKaleidoscopeScheme` | Runtime installation and theme acquisition are already separable. |
| Consumer contract | Installs a packed tarball into an isolated temporary app, checks strict types, bundles and runs in Chromium | Extend this harness rather than create a parallel smoke suite. |
| Release gate | Checks rendering, package consumption and other release contracts on the commit to be tagged | Publication must depend on that successful gate. |
| npm publisher | None; `prepublishOnly` builds but does not run the release gate | Do not treat a successful local build as permission to release. |

The existing consumer harness checks public export lists, renderer interoperability,
archive decode, native control interaction and teardown. Its five negative cases
reject missing CSS, renderer JS, renderer declarations, a lazy frame chunk and a
loader declaration pointed outside the installed consumer.

## Package and architecture boundaries

### Keep one package and the current rendering model

Use `scriptoscope` as the proposed name, subject to npm ownership confirmation.
`npm view scriptoscope` returned E404 during this investigation; that does not
reserve the name or establish publishing rights. If it cannot be claimed, choose
a scope before updating consumer examples.

Keep ESM-only distribution and the current explicit exports. CommonJS, framework
adapters, custom-element registration and a monorepo are not prerequisites for
publishing. Add those only for a concrete consumer requirement. The existing
`/renderer` entry shares implementation with the full runtime; preserve identity
across entrypoints and measure actual consumer bundles before promising size savings.

Retain canvas decoration, native content and explicit promotion/disposal. npm
distribution does not depend on completing the engine's incremental family
migration or redesigning the rendering architecture.

### Make the npm front door complete

The README's easiest setup imports `mountExplicitPage` from Pages. That helper
lives in `demo/explicit-host.mjs`, imports `explicit-layout.mjs`, and reaches into
`src/declarative/index.ts`; it is not an npm export. Simply substituting a bare
package import into that snippet would fail.

First ship a small npm-first example using existing exported APIs:

1. Install the package and import its stylesheet.
2. Host a theme archive and its metadata at an explicit application URL, or read
   a user-selected archive through the public byte loader.
3. Load the theme and create a `WindowManager`.
4. Promote a window/control with the public declarative primitives.
5. Restore promoted native elements and release window/theme resources on teardown.

Exercise this example from an installed tarball, without checkout aliases, source
imports or a mandatory Pages URL. Document that supplying `data-scriptoscope-*`
attributes alone does not attach the runtime; the application owns attachment.

Keep the demo page host as application orchestration for the first npm release.
If a turnkey host becomes an explicit product requirement, propose a small typed
host API separately, with documented ownership, async cancellation and teardown.
Do not expose the whole demo controller as a packaging shortcut.

### Keep theme assets external

The runtime package should contain code, types, optional CSS, notices and consumer
documentation. Keep community archives, generated theme derivatives, reference
captures, demo fonts and research material out of it. This preserves a clear
boundary between runtime code and separately attributed theme inputs.

Document a consumer-hosted bundle layout (`scheme.sit` or `scheme.rsrc`, optional
`meta.json`, and original provenance/terms alongside redistributed bundles), with
an explicit base URL that also works under a non-root application path. Keep the
existing byte-loader path for applications that manage their own files.

Use a versioned or content-addressed theme location for reproducible integrations.
An unversioned Pages deployment can remain a demo convenience. A theme npm package
or hosted catalog is a later distribution choice, not a runtime dependency.

### Harden output contents and declaration ownership

`files: ["dist", ...]` includes everything under `dist`. A clean library build
removes old output, but `build:demo` subsequently adds `dist/demo` and
`dist/pages-loader`. Define an allowlist or a dedicated package staging directory
so packing after either build history produces the same runtime-only contents.
Always include shared and lazy chunks; copying only the named entry files breaks
decoding and built-in frames.

Keep JS source maps initially for debugging. Review both their size and embedded
source contents before publication; measure gzip/brotli consumer transfer size
separately from npm tarball size. Declaration maps are already disabled.

The public type graph currently depends on declarations copied from
`tools/theme-loader` into `dist/tools`. That works in the installed consumer
test. Preserve it initially; if this grows, move reusable runtime loader code and
its authoritative types into a clearly owned runtime directory in a focused
follow-up. No need to reorganize the entire repository before release.

The tarball currently has only the top-level Scriptoscope `LICENSE` as a license
file. Include a `THIRD_PARTY_NOTICES` file with the bundled munbox notice from
`tools/sit-wasm/munbox/LICENSE` (copyright dafo123), and audit other bundled inputs.
Make the notice a required packed file, independent of source maps.

### Define environment support explicitly

The package is a browser runtime. All three built JS entrypoints imported
successfully in Node without DOM globals in this investigation. Turn that into a
consumer contract for server-side module evaluation; it does not establish server
rendering support. DOM attachment and canvas work belong on the client.

Extend strict declaration checks from Bundler resolution to NodeNext. Keep the
current browser target as the implementation baseline until it is verified and
documented; the build target alone does not prove API availability in every
browser. Separate contributor/publisher Node requirements from consumer support.

## Release and publication plan

1. Settle registry ownership, initial version and channel. Keep `0.9.0` historical;
   publish a fresh version chosen against current `main`. Recommend an initial
   `next` prerelease to exercise registry installation before `latest`.
2. Add a publisher workflow using GitHub-hosted Actions and npm trusted publishing.
   Bind it to the repository and exact workflow filename, with `id-token: write`
   only where publication needs it. npm documents automatic provenance for public
   packages from public repositories using this path. Check the current CLI
   requirements when implementing; the documented publishing minimum is npm
   11.5.1 and Node 22.14.0. Resolve first-package bootstrap/account setup explicitly.
3. Trigger publication from a deliberate release event and verify tag/version/
   `VERSION` agreement. Require a successful dispatch/scheduled release-gate run
   for the tagged commit. A separate tag-check workflow running concurrently is
   not a dependency: the publisher must perform or depend on the check itself.
4. On that commit, build once and pack one candidate. Record its digest and file
   list, install/test that tarball, then publish the same artifact. Extend the
   harness to accept a supplied tarball: today it builds/packs its own candidate.
   Avoid a subsequent source-directory publish that silently rebuilds new bytes.
5. Set the intended dist-tag explicitly, serialize publication and handle retries.
   If the version exists, compare registry integrity with the candidate; never
   overwrite it or silently create a different version. Tag management via OIDC
   has separate npm CLI/permission requirements; verify them before automating
   promotion to `latest`.
6. Install the published version in an isolated consumer and run the bounded
   browser smoke. Link the package version, gate and provenance in release notes.
   On a broken release, document deprecation/channel correction and a fix version.
7. Update CONTRIBUTING's GitHub-only procedure and add the npm path to README.
   Continue shipping the Pages demo through its existing pipeline.

Authoritative references: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/),
[Node package entrypoints](https://nodejs.org/api/packages.html#package-entry-points).
The maintainer still needs to select the npm owner, first version and channel;
this proposal does not change account settings or publish anything.

## Implementation sequence and acceptance

### Documentation and website rollout

The planning PR links this proposal from README, CONTRIBUTING and `llms.txt`,
and labels npm as planned on the website's `demo/install.html`. The homepage
already sends consumers to that installation page and needs no new npm claim.

When registry installation is verified, update these surfaces together:

- README Install/Five-minute setup and `demo/install.html`: add tested npm
  installation, CSS imports, theme hosting and teardown; retain the working
  no-build Pages option. Distinguish the package primitives from the Pages host.
- CONTRIBUTING: replace the GitHub-only release instructions with the actual
  publisher, registry bootstrap, channel and recovery procedure.
- `llms.txt`: update distribution status and link the npm recipe so integration
  agents use the same supported paths as human consumers.
- Homepage (`demo/index.html`): keep its installation link pointing at the
  shared guide; add an npm-specific call to action only after the package exists.
- CHANGELOG and release notes: record the first npm version, supported exports,
  environment requirements, theme asset boundary and any migration steps.

### Implementation work

| Follow-up | Acceptance |
| --- | --- |
| Consumer docs/example | An installed-package example loads a self-hosted theme, promotes native content and tears down using public exports only. |
| Package contents/notices | Clean library and demo-first histories obey the same file policy; lazy chunks/types/CSS/notices are present, demo/themes/research are absent. |
| Consumer harness | Preserve browser and negative cases; add supplied-tarball mode, packed-file/notices assertions, Node import safety and strict NodeNext types. |
| Publisher/release docs | The exact tested artifact is published only after the tagged commit's release gate; registry smoke and recovery are documented. |

These can land as focused PRs. This draft records the plan and baseline only.
It does not implement a publisher, change runtime exports or decide v1 readiness.

## Independent consumer trial

A second agent tried an isolated application from a locally packed tarball,
using public exports rather than the repository's demo host. This simulates the
proposed npm path; it is not a registry-install test.

The application passed strict TypeScript NodeNext checking and a Vite production
build served under `/nested/`. In Chromium it loaded a consumer-hosted Windows95
`scheme.sit`, promoted a window and checkbox, and restored the same native input
with its checked state retained. Window, manager and theme disposal completed
without browser errors. This supports keeping the existing runtime architecture.

The trial exposed these concrete gaps to address before publication:

| Consumer obstacle | Required follow-up |
| --- | --- |
| The shortest README recipe uses the Pages-only `mountExplicitPage`; the npm outline does not show actual attachment/disposal code. | Supply one complete installed-package example, including HTML, imports, theme placement, promotion and teardown. |
| `loadOwnedTheme()` paired with the natural `new WindowManager()` fails TypeScript checking: the manager defaults to `LoadedTheme`. | Show `new WindowManager<OwnedTheme>()` with `type OwnedTheme` imported from the root, or explicitly choose `ThemeInput`. Assess inference ergonomics separately; no redesign is required for the working recipe. |
| Runtime installation does not provide a theme or tell a new consumer where to obtain one. | Show exactly which archive/metadata files the example expects, where to place them and how to preserve their provenance. |
| Theme URLs need to respect a nested deployment base. | Demonstrate an explicit application-aware URL; the trial used `${import.meta.env.BASE_URL}themes/windows-95` and `{ source: 'scheme.sit' }`. |
| Packing after `build:demo` includes demo output and additional assets. | Enforce runtime-only package contents regardless of build history and check the actual release tarball. |
| The demo-inclusive tarball still lacks an explicit munbox notice file. | Ship and assert the bundled dependency notices independently of demo assets and source maps. |

The demo-first tarball contained 345 files (224 under `dist/demo`), measured
7,316,439 bytes compressed and 15,664,442 bytes unpacked. Compare with the
clean-library measurements below; these are observations of local build states,
not fixed size budgets. The trial workspace and screenshots are temporary local
evidence, not a committed consumer fixture. Promote the complete example into
the installed-package contract as implementation work.

## Local evidence

Observed 2026-11-04, Node `24.18.0`, npm `11.16.0` on the baseline above:

- `npm run build`: passed. Vite reported the generated decoder's `node:module`
  branch as externalized for browser compatibility; the browser consumer passed.
- `node tests/package-consumer/run.mjs`: passed, including the five defective
  tarball rejection cases. Evidence is generated under
  `test-results/rendering-evidence/package-consumer/` and is not committed.
- Direct Node imports of `dist/scriptoscope.js`, `dist/renderer.js` and
  `dist/declarative.js`: passed without DOM globals (81, 44 and 31 runtime exports).
- `npm pack --dry-run --ignore-scripts --json`, after the clean library build:
  120 files, 1,048,793 bytes compressed, 3,448,787 bytes unpacked. JS: 740,656
  unpacked bytes; source maps: 2,058,294; declarations: 369,705.

This is packaging evidence, not a full release-gate run, browser support matrix,
performance budget or proof that publication is ready.
