# Public default-dialog observations — quarantined partial research

These four observations preserve a native System 7.5.5 experiment under the
Windows95 and System7 Nostalgia Silver schemes. They are **QUARANTINED_PARTIAL**,
produced and inspected by automated agents, not a human attestation or accepted
reference capture. They neither populate `captures.json`/`reviews.json` nor
change a requirement, availability expectation, renderer or regression golden.
The original-reference intake remains empty with thirteen missing requests.

The public `SetDialogDefaultItem(1)` and `GetStdFilterProc` calls returned noErr.
The original standard filter participated, and Return returned item 1 for both
schemes. The initial dialog default item was already 1: this setter was
idempotent with respect to the observed field, so transition-specific behavior
was not tested. The read-only Acid auxiliary default flag stayed 0. That does
**not** exclude every authored ring path: the separate PACH130 `FrameRoundRect`
interception can select ring art without consulting that flag. The actual
painter of these borders remains unknown. This does not invalidate the observed
public API behavior or output; it prevents attribution to the specific kDEF
auxiliary-flag/Appearance route or assuming direct `composeButton` equivalence. See [CONTEXT.md](CONTEXT.md) for the
bounded source trace, primary Apple API documentation and exact v4/v6 comparison.

The Windows95 face interior is pixel-identical to the earlier v4 normal control;
204 changed pixels surround it. System7 has 624 external changes plus four face
corner pixels changing white to RGB192. These are observations, not a tolerance,
decoder diagnosis or proof of a generic/nondefault/authored border. No dynamic
paint trace or pre-filter image was captured.

## Included evidence and historical context

- Twelve original PNGs: native 640×480 frames, 160×80 ports and 96×36 control
  margins, for each scheme before and after Return. Files are byte-identical to
  the private originals. Crops use integer native coordinates without resampling.
- Our exact [v6 C source](fixtures/v6.c), four sanitized metadata records in
  [observations.json](observations.json), scalar external app/tool/component pins
  in [environment.json](environment.json), and [comparison.json](comparison.json).
- [files.json](files.json) binds every included file except itself. The check is
  integrity and scope enforcement, not authenticated authorship or eligibility.

The unchanged [v4/v5 package](../../original-observations/2026-10-18/README.md),
introduced at commit `2295dba63e831259b482b0c51af72121f3a18d06`, supplies the
historical compiler/OS/ROM/emulator/tool identities and transport/color research.
Explicit repository-file hashes bind those references. Original scheme choices
remain references to the canonical registry at commit
`20c69d9a836a4e1e6735c2a37f68ca48b93cac28`, compatibility draft 0.1.3. These are
historical recording identities, not a second source selector or a promise of
current eligibility. Later contract versions must not rewrite the observations.

No engine, OS, ROM, executable fixture, disk, dependency, private preference or
user absolute path is included. External byte pins are labeled
`EXTERNAL_NOT_INCLUDED`; they do not masquerade as missing included files.
The full private restart environment was retained separately.

## Reproduction boundary

Follow the prior package's external setup recipe with independently available,
matching assets and a unique private environment. Never boot the original disks
or use shared HFS working-directory state. Snapshot private media before changes.
Compile the included C with the historically pinned m68k/Retro68 toolchain and
package its APPL with SIZE, recording the new output identity rather than assuming
a byte-identical rebuild. Install only on stopped, copied media.

The v6 fixture constructs an enabled empty button DITL, then calls
`NewColorDialog` with window procID 0 and a 160×80 content port. It gets the actual
control via `GetDialogItem`, records the initial default/Acid fields read-only,
calls the public setter and retrieves the standard filter, and delegates ordinary
modal events to that filter. No ring or auxiliary default flag is drawn/written
by our fixture. Its procID 0 is a window-construction input; actual windowKind,
control variant/value/min/max and color table were not measured.

Select the pinned scheme through the original UI, retain the full telemetry
frame, then capture the normal observation and a separate post-Return frame.
Record new actual values; the existing metadata must not be reused as telemetry
for a later run. Export native canvas backing pixels and extract the measured
port at (80,90), margin at (92,102), without color correction or scaling. The
recorded guest depth is 8 bits; browser transport RGBA is not guest QuickDraw depth.
Exit the app and request guest shutdown before stopping the owned worker/server;
record shutdown uncertainty and rehash all original/preserved inputs. This run
had no explicit shutdown acknowledgement, so clean shutdown remains unknown.

Eligibility still lacks reviewed palette/device mapping, font payload and
provider/patch search-chain conditions. Internal border ownership is a separate
source-attribution question, not a requirement to trace every original call. The earlier v5 guest
RGB16 versus producer gray discrepancy is not resolved by these observations.
No further guest experiment is performed by the repository checks.

```sh
node tests/research-observations/default-dialog.mjs
node --test tests/research-observations/default-dialog.test.mjs
npm run test:references
```

Related research: [#190](https://github.com/khawkins98/scriptoscope/issues/190)
and [#221](https://github.com/khawkins98/scriptoscope/issues/221).
