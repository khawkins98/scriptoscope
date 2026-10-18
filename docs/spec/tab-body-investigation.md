# Tab body investigation: pinned source, unresolved painter

Tracked by [#223](https://github.com/khawkins98/scriptoscope/issues/223) under
#221. The full-raster horizontal prototype remains held: it restores missing
middle strips but also stretches semantic color-sample pixels into visible bars.
No runtime fix or golden update follows from this source note.

## Input and address convention

The inspected input is Kaleidoscope 2.3.1 PACH 130, “68k Patches”, 87914 bytes,
SHA-256 `bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`.
The [binary inventory](kdef-binary-inventory.md#pach-identity-and-reconstructed-source-chain-2026-10-18)
records a freshly reconstructed installer → AppleDouble → raw fork → payload
chain, matching the existing kDEF 0 reference as well. All addresses below use
resource-payload offset zero; they are not offsets into a decompressed code
section or into the installer. Inspection is static; original code is not run.

## Established bounded observations

- At `0xb996` the caller pushes signed ID -9980, then calls `0x69a4` at
  `0xb99a`; at `0xb9d4` it pushes -9983 and calls the same helper at `0xb9d8`.
- `0x69a4..0x6a04` calls loader `0x7ea2`, requires a 56-byte returned record,
  then copies six bytes from offset26 or offset44 to its output. The branch
  tests the byte at `a4+1832`; its complete original meaning remains untraced.
- At `0x7ec4` the loader pushes FourCC `cinf` and at `0x7ecc` requests the
  passed signed resource ID with trap `0xa9a0` (GetResource). This is a metadata
  request, not evidence that the helper paints a tab body.

These support the previously identified semantic color-record use. They do not
identify the destination painter, its mask, dimensions, label font or the fate
of color samples when painting. A signed word found inside a branch opcode is
not a resource request; retain actual decoded instruction/call context.

## Required next evidence

Trace the PACH/Appearance drawing caller and actual tab body assembly, including
small/large variants, selected/unselected state, destination/source coordinates,
masking and label placement. Relate that caller to the generic cinf engine only
when a real call path establishes the relation. Pin any additionally cited
resource before promoting a requirement to verified.

The 1138/1990 middle-strip defect remains a demonstrated mismatch. Complete
body/sample handling, original tab height and font policy remain unknown.
Candidate source art and agreement between renderer builds do not resolve them.
