# Quarantined original-environment observations, 2026-10-18

**QUARANTINED_PARTIAL — research only.** These six observations are preserved for
[#190](https://github.com/khawkins98/scriptoscope/issues/190), under
[#221](https://github.com/khawkins98/scriptoscope/issues/221). They are not admitted
reference captures, human attestations, approved fidelity expectations or regression
goldens. No image comparison tolerance is established here.

The [reference intake](../../../../tests/reference-captures/README.md) still has
**13 missing requests and an empty capture/review corpus**. This directory is not
an intake evidence kind and the intake does not read it. A future submission needs
its own complete conditions and separate review under the then-current contract.
The integrity check below cannot grant eligibility or update any ledger.

## What is preserved

| Original scheme | Normal | Pressed | Disabled |
|---|---|---|---|
| Windows 95 | [frame](images/windows-95-normal-frame.png) / [port](images/windows-95-normal-port.png) | [frame](images/windows-95-pressed-frame.png) / [port](images/windows-95-pressed-port.png) | [frame](images/windows-95-disabled-frame.png) / [port](images/windows-95-disabled-port.png) |
| System 7 Nostalgia Silver | [frame](images/system7-nostalgia-silver-normal-frame.png) / [port](images/system7-nostalgia-silver-normal-port.png) | [frame](images/system7-nostalgia-silver-pressed-frame.png) / [port](images/system7-nostalgia-silver-pressed-port.png) | [frame](images/system7-nostalgia-silver-disabled-frame.png) / [port](images/system7-nostalgia-silver-disabled-port.png) |

[observations.json](observations.json) records each observation's time, own
invocation/telemetry and three unchanged PNGs: native 640×480 frame, 160×80 port,
and 96×36 control-with-margin. Port and margin were extracted at frame rectangles
(80,90,160,80) and (92,102,96,36), without scaling or recoloring. The 18 PNG bytes
are identical to the externally retained captures. Full frames include the native
telemetry window; the fixture's output is an observation, not a trusted oracle for
all internal state.

Our original [v4.c](fixtures/v4.c) calls `NewCWindow`, `NewControl(proc0)`,
`Draw1Control` and `HiliteControl(0/10/255)`. It reads actual ControlRecord bounds,
hilite and empty title, actual port bounds/local-to-global origin, current font
metrics, device depth and front window. Every selected frame shows port
(0,0,160,80), control LTRB(20,20,100,40), active target window, Chicago 0 size 12,
and guest depth 8. Hilite 255 is a **disabled control in an active window**, not
inactive-window behavior. No default-button mechanism is invoked. The fixture
source is our work; its compiled APPL and all tool libraries remain external.

[files.json](files.json) hashes only files actually included here. It is a local
integrity index, not a reviewer signature or evidence approval. Scalar metadata
was curated from the private logs to remove user paths and redundant copies;
unknown fields were retained as unknown. Reviews of component identity and package
integrity were performed by automated Codex agents, **not a human attestation**.

## Transport and device color are distinct

[color-probes.json](color-probes.json) separates guest `GetCPixel` RGB16, raw
producer bytes and browser canvas pixels, and binds each probe to its own fixture.

1. v4 painted red/green/blue/white/black with original QuickDraw. `GetCPixel`
   reported exact RGB primaries. The worker's raw bytes were already RGBA; the
   private browser glue mistakenly swapped red and blue a second time. The
   [rejected before frame](images/transport-before-rejected.png) preserves that
   defect as diagnostic proof only. It is an exact integer extraction of the
   native canvas from a previously retained page screenshot; its external input
   digest and rectangle are recorded. It is excluded from the six observations.
2. Corrected glue copies R/G/B unchanged and sets alpha255. Raw/canvas sentinel
   samples match for all five colors under both schemes. Corrected v4 proof is
   visible in the Windows 95 normal frame. This verifies channel order only.
3. Separate [v5.c](fixtures/v5.c) and [native frame](images/face-color-v5-frame.png)
   measure the Windows 95 face at port(60,30) and dark edge at(60,38). Guest
   `GetCPixel` reports `0xCCCC` (204) and `0x8888` (136); raw producer and corrected
   canvas report 218 and 165. Thus the remaining gray conversion occurs before the
   browser copy. Its mechanism is unresolved. No gamma formula, color tolerance,
   production renderer change or historical color acceptance follows.

The guest's QuickDraw depth is 8, despite the 32-bit RGBA transport. Complete raw
shared-framebuffer snapshots were not retained; only sampled bytes and exported
PNG outputs are available. Previous incorrect-color captures remain outside this
package except the explicitly rejected proof.

## Historical inputs, not a second source authority

[environment.json](environment.json) lists exact external SHA-256/size pins for
OS image, Quadra 650 ROM, BasiliskII JS/WASM, installer, installed Control Panel
and PACH/kDEF components, compiler driver/toolchain/sysroot, compiled v4/v5 apps,
private capture glue/worker/exporter and HFS tools. `EXTERNAL_NOT_INCLUDED` means
no relative file binding or redistributed binary is implied. In particular the
installed kDEF0 is 107,726 bytes with SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
That identifies one component, not the full running patch stack.

The source references point to the existing
[canonical source-choice registry at 20c69d9a](https://github.com/khawkins98/scriptoscope/blob/20c69d9a/tests/control-availability/source-choices.json)
and record the actual archive/fork digests used. There is no copied selection
algorithm, new source choice or resource-role approval. Compatibility draft 0.1.3
and request catalog 0.1.1 are **historical context**. Future authority/catalog
changes must not rewrite these observations or silently classify them as current
eligible evidence. Current authority remains
[the compatibility contract](../../../spec/fidelity-compatibility-contract.md).

## External reproduction recipe

This recipe requires separately obtained, authorized original media matching the
external pins. It does not download, ship or run an original engine in Scriptoscope
or CI. The private restart environment was retained outside Git.

1. Create a unique temporary directory. Copy the pinned System 7.5.5 disk, ROM,
   emulator and installer into it; hash originals and copies before/after. Keep
   originals read-only and boot only the copied disk. Do not reuse a user's VM,
   preferences, shared folders or HFS mount state.
2. Use the externally pinned `classic-vibe-mac` worker and BasiliskII assets.
   The inspected sibling repository is GPL-3.0; no sibling implementation is
   copied here. Its repository commit is a locator; actual used-file hashes in
   `environment.json` are the byte identities. Private worker adaptations read
   262144-byte chunks from the copied disk and persist writes to that one fixed
   file through a loopback-only endpoint. Validate offsets/lengths; never accept
   a caller-selected filesystem path. Serve with COOP same-origin / COEP
   require-corp, 640×480 canvas and CSS 1:1. Use cpu 4, modelid 30, 64 MiB RAM, JIT off,
   no host shared folder and no network provider. Do not use a BGRA swizzle: prove
   the actual producer order with v4 before exporting. See the external glue,
   worker and exporter hashes for the observed implementation.
3. Build isolated hfsutils 3.2.6 from the pinned source archive. The observed private
   build hardcoded its `hcwd` state directory inside the unique environment,
   instead of the shared user state. Transfer files only while the emulator is
   stopped. A separate 8 MiB HFS transfer disk can carry the installer; its emulated
   in-memory writes need not persist. Never mount a live guest disk concurrently.
4. Compile the included fixtures with the pinned external `wasm-retro-cc` bundle
   and driver (`scripts/compile-c-cli.mjs` in that external repository):
   Copy `fixtures/v4.c` to the observed basename `SingleControlProbe.c`, then run
   `node compile-c-cli.mjs --bundle TOOL_BUNDLE SingleControlProbe.c -o SingleControlProbe.bin`
   (v5 used basename `SingleControlProbe-v5.c`).
   Exact cc1/as/linker options and tool/sysroot hashes are in `environment.json`.
   The observed build used `-mcpu=68020 -O0`, linked Retro68 libraries, ran
   Elf2Mac, and used the external `build.ts` SIZE-resource splicer (`SIZE` -1 payload
   `00800010000000100000`: flags0x0080, preferred/minimum1MiB). Output names
   and build-tool details can affect compiled bytes; compare the external app
   pins when claiming exact reproduction. No header, library, compiler binary or
   compiled application is redistributed here.
5. Boot the copied disk; use the original Kaleidoscope 2.3.1 installer's custom
   Control Panel + extension installation. Restart and independently inspect the
   installed component/version bytes. The recorded disk had only enough space
   for this subset, not every optional installer item. The known component
   hashes do not prove all installed/running patches.
6. Extract exactly the two declared registry forks, preserving their payload
   hashes. The observed transfer used MacBinary wrappers with type `Colr`,
   creator `Acid`; that wrapper is not the original archived container. Open each
   scheme through the original extension/Finder and record activation. Install
   our v4 app through private HFS transfer and launch it. The target window stays
   active; clicking the telemetry window cycles 0→10→255 and reactivates target.
   Keep actual geometry/font/depth/state telemetry visible. No internal default
   flag is written and no default ring is manually drawn.
7. Verify original QuickDraw sentinel values against raw producer bytes and canvas
   pixels. Export `canvas.toDataURL('image/png')` at native backing dimensions;
   extract port/margin with `getImageData`/`putImageData`, with no resizing,
   interpolation, gamma correction or cleanup. Record PNG digests and exact
   actual metadata independently for each state. v5 is a separate follow-up
   executable/run; do not attribute its telemetry to v4 by assumption.
8. Request guest Finder Shut Down, let writes settle, then stop only the owned
   worker/browser/server. Rehash original inputs. The observed environment did
   show an improper-shutdown warning on a later reboot despite this request;
   complete clean-shutdown status remains unknown. All writes were to copied
   private media; the original files were rehashed unchanged.

The original input paths and private preferences are intentionally not retained
here. Tool/source links and byte identities support reconstruction; the README
is not a turnkey bundled emulator or a claim that every unknown condition can
already be reproduced.

## Missing conditions and integrity check

Still unknown: full palette/device configuration and producer gray conversion;
font version/resource payload; complete installation/patch/provider/base search
chain; public default mechanism; inactive-window behavior; valid nonzero-origin
invocation; and complete guest shutdown status. No missing field is filled with
a guessed default. These gaps prevent intake approval even where geometry matches
a provisional request.

From repository root:

```sh
node tests/research-observations/validate.mjs
node --test tests/research-observations/validate.test.mjs
npm run test:references
```

The first two commands check quarantine labels, finite inventory, included-file
hashes/PNG structure, external-vs-included bindings, forbidden files/path escapes
and scope-escalation negatives. They do not authenticate the producer or establish
historical fidelity. The last command must still report 13 missing requests and
zero approved captures after this addition.
