# Installed package consumer contract

Run `npm run test:package` with Node 24 and the pinned Playwright Chromium
installed. CI runs this in the same immutable Linux image as rendering contracts.
This verifies packaging and native browser integration, not historical pixels,
all public APIs, every bundler/browser, or readiness to publish to npm.

The runner builds a clean library, packs it, installs only the tarball into a
unique temporary consumer, resolves root/declarative/CSS/package.json exports,
and compiles both public declaration entrypoints with strict Bundler resolution
and `skipLibCheck: false`. A missing relative declaration must fail here even
when repository typechecking passes. Every compiled type file must belong to the
installed consumer or TypeScript's own standard libraries. The build copies the
authoritative browser loader declaration into `dist/tools/`, rebasing its
source-type reference to the emitted declarations rather than maintaining a
second public interface.

Vite builds the fixture with an explicit isolated configuration and no aliases.
Every filesystem module must belong to that consumer; tool-generated virtual
modules are separate. The installed consumer is removed before the browser starts.
An independent static-only server then serves the completed production files
under `/consumer/`. Only the original Windows95 archive and its metadata are
copied as external theme input; repository derivatives are not served.

The browser checks actual lazy archive decoding, stylesheet application, a
promoted window and checkbox/range/select controls, real pointer/keyboard input,
and disconnect preserving the same native nodes/current values. Failed resources,
cross-origin requests and browser errors fail the smoke. It also repacks candidates
omitting CSS and the actual lazy decoder chunk: these must fail at export-file
resolution and bundling respectively, naming the omitted file. The normal
consumer keeps the decoder live by loading a StuffIt archive.
A third candidate points the packed declaration at an existing repository type
file. It must fail the type-file boundary even though those types compile,
proving that checkout files cannot silently satisfy a broken tarball.

Compact `result.json` evidence and failure screenshots live under
`test-results/rendering-evidence/package-consumer/`. Set
`SCRIPTOSCOPE_PACKAGE_EVIDENCE` to a separate directory for concurrent local jobs.
Records include clean/dirty git identity, tarball digest/file list, export paths,
module graph, browser/network results and negative-case outcomes. Failed runs are
incomplete. Local dirty executions remain dirty observations; they do not satisfy
the independent requirement ledger. Temporary consumers, servers and browsers are
released in `finally`.
