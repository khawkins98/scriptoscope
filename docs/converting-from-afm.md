# Converting a Mac OS Appearance theme (`.afm`) to a Kaleidoscope `.rsrc`

Scriptoscope does not load `.afm` files and this repository has no supported
`.afm` converter. If your goal is classic Mac chrome, try the bundled
`platinum-8` or `apple-platinum-2` scheme first; see the
[integration guide](./npm-consumer.md).

For a theme you have permission to adapt, the available route is **manual
scheme authoring** with period tools or the
[resource-fork authoring toolkit](./authoring-a-scheme.md). This is a design and
resource-mapping task, not a file-extension change or a verified turnkey recipe.
The [scope decision (#174)](https://github.com/khawkins98/scriptoscope/issues/174)
and [conversion-tooling discussion (#176)](https://github.com/khawkins98/scriptoscope/issues/176)
provide background, not a shipped importer.

## What's in an `.afm`

Appearance themes and Kaleidoscope schemes use different resource vocabularies
and layout/control models. Scriptoscope's supported scheme inputs are described
in the [bundle reference](./theme-bundle-layout.md). A generated `theme.json`
is a local diagnostic derivative, not the target format for manual conversion.

## The workflow

### What you need

- The source theme and permission appropriate to your intended use or sharing.
- A compatible classic Mac environment and resource editor if examining the
  original theme there; verify the OS/tool combination for your source.
- A working Kaleidoscope scheme skeleton, with its identity/credits updated and
  any inherited art's terms retained. The first-party
  [reference scheme](../authoring/schemes/scriptoscope/README.md) is a code example.

### High-level steps

1. Inventory the source art, colours, controls and state variants. Record source
   attribution and which features the target format cannot represent.
2. Author Kaleidoscope `cicn` art, `wnd#` frame recipes, `cinf` control geometry,
   patterns and metadata using the [authoring workflow](./authoring-a-scheme.md).
   Resource names that look similar do not establish equivalent geometry.
3. Review mask edges, title/control space, repeat behavior and state coverage.
   Follow the [frame reference](./authoring-exotic-frames.md) rather than guessing
   a mapping from an Appearance parts set.
4. Build a real `.rsrc` and validate the exact result in the browser, at 8-bit
   colour and in native Kaleidoscope. Preserve deliberate departures and tested
   states. A copied static bitmap does not establish equivalent behavior.

### Loading the result into Scriptoscope

Open the resulting `.rsrc` in the [showcase](https://khawkins98.github.io/scriptoscope/showcase.html)
file picker. For permanent hosting, use a source bundle and complete provenance
as described in [bundle layout](./theme-bundle-layout.md). A community-corpus
addition also follows the [porting review](./porting-a-kaleidoscope-scheme.md).
Generated diagnostics are optional deployment artifacts, not the runtime input.

## Caveats

Do not redistribute source or derived art without the necessary rights; the
runtime's MIT license does not relicense theme artwork. Keep original attribution
and terms. Unsupported state, animation, sound and layout behavior needs an
explicit limitation or redesign; no automatic lossless/reversible mapping is
provided here.

## If you'd rather not do this

Use an existing Kaleidoscope scheme. For a hosted `platinum-8` bundle:

```ts
import { loadTheme } from '@khawkins98/scriptoscope';
const theme = await loadTheme('/themes/platinum-8');
// Keep it alive while dependents use it; dispose after their teardown.
```

The theme files must be hosted at that path; installing the package alone does
not supply them.
