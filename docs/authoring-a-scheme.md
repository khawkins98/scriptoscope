# Authoring a Kaleidoscope scheme in code

Create a real Kaleidoscope resource fork with the tools in
[`tools/theme-author/`](../tools/theme-author/). It loads in Scriptoscope and
can be packaged for Kaleidoscope 2.3.1 on a classic Mac.

Start with this guide. Use [frame rules](./authoring-exotic-frames.md) for
recipe mechanics, [visual design](./authoring-visual-design.md) for art decisions
and [AI art routes](./authoring-art-with-ai.md) when choosing an art tool.
The [folder guide](../authoring/README.md) describes what to commit.

## 1. What you are making

A scheme is a resource fork: entries have a four-character **type**, signed
numeric **id**, optional name and bytes. The important types are:

| Type | Purpose |
|---|---|
| `cicn` | indexed colour art with a binary transparency mask |
| `wnd#` | frame cells, content/title rectangles and widget positions |
| `cinf` | control slicing geometry and sampled colour coordinates |
| `ppat` | opaque repeating patterns |
| `Colr`, `vers` | scheme flags and version metadata |

The runtime reads these resources; it does not interpret your drawing code.
Resource omissions may use a fallback or become unavailable, depending on
the family. A successful load alone does not establish a complete scheme.

## 2. Quick start

```sh
npm install
npm run author -- authoring/schemes/kingfisher
npm run dev
# open http://localhost:5173/authoring-preview.html
```

`author` runs `buildScheme()`, serializes the resources, reloads them through
the runtime converter and checks them. With no errors it writes:

- `scheme.rsrc`: raw resource bytes for Scriptoscope; commit this file.
- `scheme.bin`: generated MacBinary with Finder type `Colr`, creator `Acid`
  and the custom-icon flag; use it for a classic Mac, but do not commit it.

MacBinary preserves the resource fork and Finder information in one file.
StuffIt Expander, MacBinary utilities or `hcopy -m` restore a classic file.
Warnings require inspection even when the command exits successfully.

For a new scheme, copy example source to `authoring/schemes/<slug>/`. Update
all identity, metadata, version/About and credit strings; simplify the frame
into a buildable skeleton. Copy the [brief template](../authoring/concept-brief-template.md).
Keep inherited art credited until replaced. Do not carry example captures or
classic validation claims forward as proof of your new build. New directories
are discovered automatically by scheme checks; no registry edit is required.
Open the explicit preview URL for your slug. Showcase integration is optional.

Kingfisher is the worked reference for imported illustrations, frame recipes
and control-family builders. Keep authored schemes outside the community corpus
in `themes/`.

## 3. Five ideas you need

### 3.1 A window is one small image plus a stretching recipe

Draw a **source template**, not a full-size window. Each edge's `wnd#` list
cuts that template into cells: fixed pieces, repeating growers, a title plate
and optional ornaments. Use [`frameLayout()`](./authoring-exotic-frames.md#8-framelayout-and-windowlayout)
for explicit named cells; `windowLayout()` is the simpler rounded-frame helper.

The main codes are 1 (fixed), 8/11 (repeat to fill space), 5/6 (title plate/caps),
10 (fixed ornament that can drop), and 12 with 13/14 (whole tiles plus filler).
These are behaviors, not drawing commands. A grower repeats its source pixels;
putting part of a building in it repeats that part across the window.
See [R1–R12](./authoring-exotic-frames.md#1-cell-codes-rules-r1r12) before designing an unusual edge.

Keep the source compact: store one material period and repeat it. Reserve
fixed cells for distinctive silhouettes. Check `layout.minWidthForTitle(px)`;
fixed art consumes title room even when much of its cell is transparent.

### 3.2 The content area is a hole

Rectangle-list part 0 is the content area; leave its pixels transparent for
live HTML. Parts 1, 2, 3 are close, zoom, collapse; part 4 is the title.
Widgets belong inside fixed cells. Ornaments outside the body must still fit
inside the template's rectangular bands; they cannot draw beyond its bounds.

### 3.3 Some colours live on hidden pixels

The engine samples RGB while ignoring the mask:

| Colour | Sample |
|---|---|
| title text | `(content.left, content.top)` |
| title shadow | one pixel to its right; same colour means no shadow |
| button label / face | the `cinf`'s `textPixel` / `bgPixel` |

Write hidden pixels with `raster.swatch()` **after** painting. Popup windows
use a lower sample row ([R25](./authoring-exotic-frames.md#6-popup-and-side-floating-windows-r25r26)).
`Raster` coordinates are whole pixels; floor computed centers. Clipping past
an edge is allowed, but fractional coordinates are not.

### 3.4 Type the colour you want to see

Encoders pre-compensate for the loader's classic-Mac-to-modern display gamma.
Use display sRGB in artwork; `{ gamma: false }` is for deliberately raw stored
values. Kingfisher's `sys()` palette helper instead starts from a chosen
stored system-palette entry and returns its display colour.

Prefer system-palette entries for procedural controls and desktop patterns:
the 6×6×6 cube (`00 33 66 99 cc ff`) plus grey/channel ramps. Extracted
illustrations may retain source-derived palettes to preserve shading. Every
compiled `cicn` must still fit 256 colours. Check `author --palette` and the
8-bit simulation for hue shifts, collapsed ramps and lost outlines; neither
palette choice guarantees identical display conditions on every machine.

### 3.5 Smooth edges, dithering and the colour budget

A `cicn` mask is binary. Smooth helpers blend against existing opaque pixels
or an explicit matte; against an unknown desktop, keep hard silhouette edges.
This limits the scheme resource, not all classic graphics: QuickDraw had
deep-mask blending from System 7 ([Apple technical journal, p.26](https://vintageapple.org/develop/pdf/develop-06_9104_Spring_1991.pdf)).

Keep imported PNG alpha at 0/255. Alpha 1–127 means a **hidden swatch** to the
encoder, so accidental partial alpha can make coloured edge pixels invisible.

A 1px grower must be one colour per row, not a dithered column that becomes
stripes. Multi-pixel textures must wrap at their repeat boundary. `fitPalette`
can merge rare colours while preserving swatches, but may remove a deliberate
one-pixel highlight; simplify ramps before relying on it.

## 4. The workflow

Brief → skeleton → concept → extraction → clean-up → build → browser/8-bit
review → exact-build classic test. Probe unfamiliar geometry in classic early;
do not wait for finished illustration to discover a source-template problem.

### 4.1 Write the brief

Use the [template](../authoring/concept-brief-template.md). Record the defining
silhouette, materials/light, palette roles, target outer size and measured
feature sizes. Reserve a representative title and widget rectangles. Keep
concept crop/grid/mask decisions and deliberate departures reproducible.

### 4.2 Make the concept image

Build a skeleton, then generate its geometry reference:

```sh
node scripts/authoring-concept.mjs authoring/schemes/<slug> --out /tmp/geometry.html
```

Supply its SVG, the brief, title/widget reservations and a target outer size
to the artist. It shows **source cells before stretching**, not the final
composition. Revise the skeleton if the concept needs larger forms; do not
squeeze a strong concept into inherited dimensions to preserve old tests.
Save the selected image and exact prompt under `concept/`.

### 4.3 Paint over the concept

Extract strong illustration before reconstructing it. Measure the source grid,
sample at that scale, remove the backdrop with a binary mask and preserve its
proportions/outlines. Repair detail the source cannot supply. Use explicit
background masks and a source-derived palette when palette voting loses the
illustration's character. The general palette-voting tool is:

```sh
# Convert JPEG to lossless PNG first, e.g. with sips or ImageMagick.
npm run paint-over -- /tmp/concept.png --crop 40,10,300,190 --scale 3 \
  --palette authoring/schemes/kingfisher/palette.mjs --key '#c8d4e4' --out /tmp/bird.png
```

`mode` preserves the most common palette colour per sampled block; `mean`
helps soft areas. Record crop, scale, masks and palette changes. Thin rays,
stars and glyphs may require whole-pixel repairs rather than downsampling.
Keep approved assets stable: adding an unrelated sprite should not requantize
illustrations already reviewed.

### 4.4 Clean up by hand

Keep detailed illustrations as transparent 1× PNGs; use short grids for small
glyphs and code for geometry/repeating surfaces. Import with `decodePng` and
`Raster.fromRgba`; reject a nonzero returned `snapped` count, and keep active/
inactive art dimensions matched. Apply hidden swatches in the frame painter.

Remove background contamination and JPEG speckles without erasing intentional
outlines. Place sparks after outline passes. Keep distinctive shapes in fixed
cells, paint repeats by named cell positions and run `layout.lint(raster)` on
every frame/state. Use `uniform` groups for matching 1px growers; mark a
multi-pixel title plate `tiled: true` when only its title rows must be uniform.

Review silhouette/spacing before surface contrast, then fine detail. Structural
checks cannot decide whether glass still reads as glass or a landmark keeps
its identity. Use the [visual checklist](./authoring-visual-design.md#4-review-checklist).

### 4.5 Build and check

```sh
npm run author -- authoring/schemes/<slug> --sheet --palette
npm run check:schemes
```

Read diagnostics and sampled title/button colours, not only the exit code.
`--sheet` writes a gitignored contact sheet with an 8-bit comparison;
`--palette` reports palette mappings, collapses and contrast. Declare important
colour pairs in `palette.mjs`'s `CONTRAST` export.

Rebuild `scheme.rsrc` after changes. Shared authored-scheme tests check clean
builds, runtime conversion, committed bytes, packaging and common assets.
Keep scheme-specific tests for meaningful behavior, not incidental illustration
pixels or every template dimension. Run the relevant tests and repository gates
before submitting. Community-corpus gates alone do not cover authored schemes.

### 4.6 Preview and capture

With `npm run dev` running, open
`http://localhost:5173/authoring-preview.html?scheme=/authoring/schemes/<slug>/scheme.rsrc`.
Reload after rebuilding. Use `&layout=/authoring/preview-layouts/sizes.html`
for narrow/wide windows and long titles; `&active=<title or window type>`
selects the active window. Inspect pressed widgets and collapse/restore too.

For matched composition, capture the live control scene:

```sh
npm run capture:authoring -- authoring/schemes/kingfisher --concept --out /tmp/window.png
node scripts/authoring-concept.mjs authoring/schemes/kingfisher \
  --render /tmp/window.png --crop 182,162,773,532 --out /tmp/comparison.html
```

The self-contained comparison matches **outer widths**, preserves both aspect
ratios and shows the source geometry separately. The crop includes the full
concept window. Capture `--width`/`--height` are **content** pixels; defaults
are 380×210. `--document` uses the ordinary content instead of live controls,
progress and active scrollbars. The comparison script's `--concept <path>`
selects a different source image; it is not the capture script's scene flag.

Capture final `preview.png` and `preview-sizes.png` with
`npm run capture:authoring -- authoring/schemes/<slug>` (`--base` changes port).
Temporary comparison files belong outside the committed scheme.

### 4.7 Check it at 8 bits

```sh
npm run sim8 -- /tmp/window.png /tmp/window-8bit.png --zoom 2
# For the standard DPR-2 preview.png, also pass --dpr 2.
```

The simulation approximates classic palette mapping in stored colours;
`--capture` uses the recorded emulator's display levels. Inspect lost detail,
colour shifts and collapsed ramps. It is a review aid, not native fidelity
evidence. Recheck after palette or art changes.

### 4.8 Test in real Kaleidoscope

First test novel geometry with a skeleton, then test the finished **exact
bytes**. Keep repeated source periods compact and probe unusually large source
templates early. Browser validation does not establish native compatibility;
there is no established universal source-size limit to substitute for testing.

Use the [private maintainer environment](./maintainer-reference-environment.md)
when available; it is not a public build dependency:

1. Include classic extras, finish browser/8-bit review, build and run
   `check:schemes`. Record SHA-256 of both `.rsrc` and `.bin`; freeze the batch.
2. Copy immutable seeds. Stage the exact MacBinary files with the isolated
   `hcopy -m` wrapper only while the VM is stopped; unmount HFS before boot.
   Never boot or modify the seeds themselves.
3. Record OS/Kaleidoscope version, depth, resolution and sound condition.
   Quit helper/test apps before selecting a scheme; do not switch while a
   native fixture is running.
4. Exercise normal/narrow/wide, active/inactive, pressed and collapsed states,
   plus About, menus, picker and cursor. State what was actually tested;
   a sound-off run does not verify audible sounds or an unused progress bar.
5. Preserve captures, frozen hashes, observations and private raw-receipt
   location in `classic/README.md`. Stop before HFS inspection/export; verify
   exported resource bytes and unchanged seeds where that procedure applies.

A later byte change needs a new native result. A focused recheck may cite a
broader earlier run, but must identify both hashes and the checks each covers.
Compatibility smoke tests do not admit fidelity evidence or refresh goldens.

### 4.9 Add the classic extras

Copy an example's `classic.mjs`: `aboutBox`, `arrowCursors`, `shadeSounds` build
the About dialog/panel strings, cursor and WindowShade sounds. Include them
before the final freeze. `aboutBox` wraps/sizes for the panel's small font
(Geneva 9 in the reference environment), not Chicago title text. Inspect its
fit and test cursor contrast on the actual desktop. See [§7.2](#72-control-panel-extras)
for the resources that enable each control-panel option.

## 5. The toolkit (`tools/theme-author/`)

Start at [`index.js`](../tools/theme-author/index.js) and the chosen scheme's
`buildScheme()`. Encoders and drawing helpers document their own inputs;
round-trip tests check them against the community corpus. The main groups are:

- `raster.js`, `color.js`, `fit-palette.js`: pixels, colours and budget.
- `frame-layout.js`, `window-layout.js`: recipes, named cells and pressed strips.
- `encode-*.js`: images, patterns, records, icon families and classic extras.
- `resource-fork-writer.js`, `macbinary.js`: packaging.
- `check-scheme.js`, `contact-sheet.js`, `palette-report.js`: diagnostics.

Do not duplicate an encoder or PNG reader in a scheme. Keep scheme-specific
illustration and palette decisions in its folder.

## 6. Control families

### 6.1 Push buttons and the default ring

Author push faces and rings with same-id `cicn` and `cinf`. The engine also
supports `cinf 0` fallback; without either metadata record, an available face
can become unavailable. The engine copies corners, stretches/tiles bands
according to `tileSides`, and fills the center from `bgPixel`; a painted
center gradient is lost. Use a multi-pixel band for a repeating stud row.

The default ring is drawn outside and after the face. Its corner blocks reach
inward: keep everything inside the ring transparent so it cannot erase the
button. Check short, wide, default, disabled and pressed controls.

### 6.2 Checkboxes and radio buttons

Their ids are `-9504 + 12·kind + 3·value + tier`: kind 0 checkbox/1 radio;
value 0 off/1 on/2 mixed; tier 0 disabled/1 normal/2 pressed. This gives 18
images. Choose sizes from the design, not a presumed platform limit; odd
sizes make centered dots easier. Verify state masks and glyph alignment.

### 6.3 Rules for the other families

- **Scrollbars:** paint track under opaque thumb edges; the track reaches only
  one pixel beneath each end. Keep the stretched track uniform along its axis.
- **Sliders:** leave pixels outside track/thumb masks transparent; they expose
  the body. Keep track pixels under thumb edges to avoid a white matte box.
- **Progress:** frame corner and side thickness should match. Fill/track
  `cinf.tileSides` controls repeating versus stretched source. Use a multi-pixel
  repeat for segmented fills. Indeterminate frames must loop cleanly.
- **Tab panes:** `textPixel` and `bgPixel` must not sample the same colour.
- **Menus:** same-id `cinf` supplies fill/text samples; test in classic.
- **Desktop:** `ppat` must be opaque and power-of-two; prefer system colours.
- **Window widgets:** author rectangle sizes/positions inside fixed cells.
  Normal/pressed masks must match. Generate `-14330` with `stripLayout` and
  `pressedStripFrom`; cumulative widths determine offsets. Classic utilities
  use their own `-14298`. The web uses the document strip for every window,
  so corresponding utility pieces must remain compatible. See [R24](./authoring-exotic-frames.md#5-pressed-widgets-r24).

### 6.4 Reuse a family from another scheme

Copy an existing family painter, keep its resource/metadata relationships and
re-theme its palette. Use source comments for engine constraints. Inspect the
result with the frame: a button should belong to the same material family,
not merely share its accent colour.

### 6.5 How Kingfisher is laid out

[`scheme.mjs`](../authoring/schemes/kingfisher/scheme.mjs) builds the resource
list and calls `parts/` family builders. Frames and imported PNGs are separate
from controls. The builder reports duplicate type/id pairs with both owners.
This is an example organization, not another abstraction a new scheme needs.

## 7. Id cheat-sheet

### 7.1 What the first-party schemes ship

| Id | Resource role |
|---|---|
| `-14336` | document `wnd#`; same-id inactive `cicn`, active id + 1 |
| `-14332`, `-14328`, `-14326`, `-14324`, `-14322` | collapsed document, dialog, alert, movable modal, movable alert |
| `-14304`, `-14300` | titled utility and collapsed titled utility |
| `-14330`, `-14298` | document / classic utility pressed-widget `cicn` strips |
| `-10240`, `-10239`, `-10238` | inactive / normal / pressed push `cicn` + `cinf` |
| `-10232`, `-10231` | inactive / normal default-ring `cicn` + `cinf` |
| `-10080 … -10075` | active/inactive progress frame, fill and track `cicn` + `cinf` |
| `17`, `42` | desktop / utility `ppat` |
| `-16455` | picker icon family |
| `-14320` | About `DLOG`/`DITL` and panel `STR#` |
| `129`, `1` | `Colr` flags / `vers` metadata |

For other families, copy the named resources from their existing builders
and consult the [asset catalog](./kaleidoscope-asset-catalog.md) or
[corpus labels](./spec/corpus-corroborated-ids.md). Window identities live in
[`window-type-identities.js`](../tools/theme-loader/window-type-identities.js).
Active/inactive frame pairs must have equal dimensions.

### 7.2 Control-panel extras

| Option | Required resource / constraint |
|---|---|
| Desktop Pattern | opaque power-of-two `ppat 17` |
| About This Scheme | `DLOG -14320` → `DITL`; `STR# -14320` name/description; icon or picture item must name supplied art |
| Arrow Cursor | `crsr 0`; helper also supplies Finder variants |
| WindowShade Sounds | `snd -14336/-14335`; user must enable sounds too |
| Finder Colors | `cicn` + `cinf -9552 … -9548`; panel disables this under System 7 |
| Finder Icons | complete families at system ids; not just the picker icon |
| Accent Color | flag alone is insufficient; modern-family menus do not acquire per-accent art from it |
| Alternate Checkboxes | value-3 checkbox set; not shipped by the examples |

## 8. What the checks catch

`checkScheme` reports missing/mismatched frames, invalid content/widget
rectangles, missing metadata/states, invisible sampled labels, recipe clipping
and broken About references. `frameLayout` validates cell allocations and
`layout.lint` checks repeated cells and drawable extent. See the diagnostics
and [`check-scheme.js`](../tools/theme-author/check-scheme.js) rather than
maintaining a second rule list here. Design contrast floors are stricter
than corpus-calibrated warning floors; visual acceptance remains separate.

## 9. Not covered yet

- Text fields are CSS in the web; popup-button pieces, menus and several
  classic control variants are not exposed by the authoring preview.
- `--concept` explicitly calls public `composeProgress`; there is no declarative
  progress element. A browser preview is not proof that the same native control
  was exercised in a VM run.
- Window grow-box art and control-panel extras need native review. Popup and
  side-floating windows have [additional runtime limits](./authoring-exotic-frames.md#6-popup-and-side-floating-windows-r25r26).
- Ordinary classic content is owned by the application, not a scheme body
  pattern. Dialog/alert colours use `dctb`/`actb -14336` or Kaleidoscope grey.
- The toolkit has no `PICT` encoder or complete Finder-icon set.

## 10. Where the rules come from

- [Compositor model](./spec/compositor-spec.md) and [window widgets](./spec/engine/window-widgets.md).
- [Control family specs](./spec/README.md), linked by each source painter.
- [Resource catalog](./kaleidoscope-asset-catalog.md) and [Apple ids](./spec/apple-primary-source.md).
- Scheme `classic/README.md` files: exact-build compatibility observations, not admitted fidelity evidence.
