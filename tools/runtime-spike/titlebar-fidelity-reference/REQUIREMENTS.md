# Independent titlebar reference pack

Prepared 2026-10-27 against commit `776a8ee4c8376d616639ff156b50efdd10b792d0`,
tree `a23cbc66095ba1ababbf73d02fe8c93b11bc4e40`. Initial checkout was clean;
setup was intentionally skipped. No install, runtime implementation read, emitted
JavaScript read, original-program source/disassembly read, or runtime edit was used.
This pack belongs to the independent acceptance lane. Implementers receive only
listing-free public input/semantic summaries, never this pack or its test pins.

## Inventory and authority

`manifest.json` pins the existing canonical source registry, public capture and
review registries, relevant continuity contracts, and 18 public preview images.
It references rather than copies or replaces the canonical source identities.
Each preview records its byte hash, dimensions and existing origin metadata.
Recorded origin URLs are metadata assertions, not newly authenticated downloads;
in particular a source archive URL need not be the preview's acquisition URL.
Platinum 8 and System 7 Nostalgia Silver have known author attribution in the
preview README; version, font, native scale and capture conditions remain unknown.

The manifest also pins one representative public original full frame per scheme,
including the original capture ID, time, image dimensions and recorded condition.
These are available **incidental chrome**, not admitted titlebar observations.
All 54 capture records are `push-button`, and all 59 requests are push-button
requests. Their scoped review establishes no titlebar pixel, font, geometry or
activation obligation. Other visible windows in a full frame do not inherit the
fixture window's state, font or geometry. In particular, `inactive` in the button
campaign means a disabled control in an active window.

Supported theme denominator is the 18 reviewed inputs in
`tests/control-availability/source-choices.json`, not a new mutable theme catalog.
For **each of those 18**, original matched active and inactive titlebar cases are
missing. Window type/alias availability must remain explicit per input; no claim
that every theme supplies every titlebar type follows from this inventory.

Existing rendering goldens and scene snapshots establish continuity with the
current implementation. Their passing does not establish historical fidelity.
The pinned golden manifest records Linux x64, Chromium 156.0.8078.4,
Playwright 1.64.0, 1280×960, DPR1. A future baseline comparison must retain that
manifest's font/environment identities; host/browser/DPR changes are separate
conditions. Virtue and Charcoal-12 are declared substitutions, with historical
text equivalence unverified by the public compatibility contract.

## Independent requirements and missing coverage

| Dimension | Requirement for a claim | Current authority / missing coverage |
|---|---|---|
| Raw pixels | Compare exact registered original titlebar bounds, full frame retained, under identical scheme/version, type, state, text, size and display condition. Preserve mismatches. | 18 qualitative previews and incidental original frames; **zero reviewed titlebar pixel cases**. No tolerance or expected pixels derived from a candidate. |
| Font and geometry | Record actual font identity/provider, size/style, glyph metrics, title string, baseline, title rectangle, clip, plate/widget rectangles and window frame/content rectangles. Separate glyph ink from surrounding art. | Existing title-fit checks constrain current output relative to current measured glyphs and recomposed chrome; they do not identify original typography. Original values unknown for every theme/state. |
| State | Observe the same native window active and inactive, with exact activation condition and widget availability/pressed condition. Do not substitute disabled controls. | Existing tests cover selected current states. No original paired titlebar state reference registered. |
| Scale | Native reference at recorded 1:1 framebuffer pixels; separately compare browser CSS scale, DPR and backing pixels. Record transforms, no silent resampling. | Existing layout contract covers scale 1 and 2 for two schemes. Historical scaling and complete 18-theme browser matrix remain unverified. |
| Native browser interaction | Accessible close/zoom/collapse controls; exactly-once actions; Enter/Space activation, active/inactive focus behavior, disabled suppression, correctly aligned pointer hit regions and cleanup/remount. | Modern compatibility semantics, not proof of Mac interaction. Existing widget tests exercise four pointer subjects and two keyboard subjects; no new execution or all-theme coverage claim here. |
| Unsupported/unknown | Record absent window aliases/art, unsupported font providers, missing state or telemetry and untested sizes explicitly. | A passing case or preview cannot fill an unknown cell or imply unavailable widgets exist. |

Independent continuity checks already present include whole fitting titles, title
ink containment and scale-aligned visible chrome. Keep those assertions when
evaluating a replacement. They remain useful even where original metrics are
unknown; they must not be promoted to original Mac expectations.

Substantiated correction opportunities are in **claim and coverage**, not an
asserted renderer defect: distinguish disabled controls from inactive windows,
and replace the preview README's stale statement that the original capture
manifest is empty with the precise current button-only scope when that document
is next maintained. The registry has 54 records. Neither finding supports a
numerical titlebar/font correction; no runtime fidelity mismatch was established.

## Minimum concrete capture handoff

Start with the canonical Windows 95 source entry and one supported document
window, then expand the identical request to each supported theme/type. This
choice uses existing public source identities and an available original frame;
it does not treat the existing frame as a matching titlebar reference.

1. Register request IDs `titlebar/windows-95/document/active/v1` and
   `titlebar/windows-95/document/inactive/v1` before acquisition. Use the registry's
   exact archive, entry and fork pins. Record installed System 7.5.5/Kaleidoscope
   2.3.1 identities and actual loaded scheme, not just a selected filename.
2. Request content rectangle 240×120 native pixels and title `Agjpqy 0123`.
   Record actual content/frame/titlebar/title-clip/widget rectangles and screen
   placement; requested content dimensions are not assumed outer dimensions.
   Retain an empty-title companion to separate artwork from glyph ink. Follow
   with `Controls`, a long title, and minimum/native/resized geometry classes;
   those are additional cases, not inferred from the first pair.
3. Record actual original title font family/ID, provider, size and style, ascent,
   descent, leading and measured advances if obtainable. Default/system title
   font is an observation to identify, not permission to assume a browser font.
   Unknown provider/metrics limits typography even if pixels match.
4. Use a recorded framebuffer resolution and 1:1 producer scale; retain full
   unmodified native frame, lossless titlebar crop and explicit crop coordinates.
   Request the established indexed 8 bpp condition with same-run palette,
   producer and finite conversion bindings. A direct 32 bpp attempt is a distinct
   condition requiring its own review; never pool it with 8 bpp captures.
5. Capture the exact same window active, then inactive because another window
   became active, with title/geometry/font unchanged. Record actual activation
   and ordering observations, unobscured crop and cursor location. Record idle,
   pointer-down, canceled/outside release and successful action separately for
   each available title widget; do not infer native keyboard semantics from
   browser behavior. Use stopped immutable copies and preserve failed attempts.
6. Bind full frame/crop bytes and hashes, original public invocation and native
   telemetry, time, environment/producer identity, source/fork identity,
   palette/depth/gamma, origin/clip, export identity and independent review to
   each request. Unknown patch order/provider/cache stays unknown. Admit only
   the explicitly reviewed dimension; no candidate output participates in
   deciding the expected values.

Facility is **available but titlebar cases are unregistered**, not a missing
original binary or missing emulator claim. Public capture metadata already
records `NewCWindow(proc0)` in the retained original environment. Authorized
private infrastructure retains system/ROM/engine, toolkit and immutable seeds.
This proves prior window creation and preservation, not a ready titlebar fixture
or a validated inactive-window capture procedure. A later acquisition owner can
extend a native public Window Manager fixture in an isolated copied environment,
with a separately reviewed invocation and telemetry plan; no original-program
source access is needed or authorized by this handoff. Existing toolkit source
was not inspected here. No emulator was launched or controlled, and screenshots
from the unrelated Mac emulator chat are explicitly excluded.

## Bounded search and execution record

Searched public reference image filenames/README, per-theme origin metadata,
canonical source registry, public capture/request/review metadata, and narrowly
selected current title/window tests. No `src/`, demo implementation, built module,
maps, historical implementation or private listing content was read.

Authorized local inventory was limited to
`~/Documents/Scriptoscope-maintainer-assets`: directory names, relevant registry/
manifest filenames, recovery top-level names and existing asset-store manifests.
Source-bearing files discovered by name were not opened. No titlebar-specific
registered acquisition was located. Private original bytes and captures were
neither copied into this pack nor published.

Authenticated read-only Forgejo `ls-remote` and a no-checkout, LFS-smudge-disabled
metadata clone identified asset-store HEAD
`017d4d8859fba0a549ae14927c9b7d67ce81c854`. Only its tree names and manifest were
read; no LFS payload was fetched. Its 26 asset entries include the original
environment/toolkit/seeds and existing control campaigns, with no titlebar-named
asset. This bounded manifest search does not assert that no incidental titlebar
image exists inside an unexpanded archive. The configured Forgejo SSH alias
points to the existing Contabo host; no additional server scan was necessary.
Private metadata scratch was outside the worktree and removed after inventory.

Validation is limited to JSON parse, exact SHA-256 and PNG dimension checks for
all 18 previews and representative frames, 18 canonical source archive hashes,
registry counts/surfaces, and whitespace checks. No broad suite, browser process,
baseline rewrite or acceptance-ledger update was performed. A later verification
dispatch can compare frozen compiled base776a and opaque compiled replacement
under the same environment, preserving current native semantics and continuity;
historical fidelity remains a separate acquisition/review task.
