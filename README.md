# Scriptoscope

[Landing page](https://khawkins98.github.io/scriptoscope/) · [Interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html) · [Install](#install)

Scriptoscope brings classic Mac **Kaleidoscope** schemes to ordinary websites. It
reads the original `.sit` and `.rsrc` archives in your browser and paints window
frames and controls onto canvas. Your content stays live HTML: selectable text,
real links, native form values and event handlers.

Kaleidoscope lost to OS X a quarter-century ago. I rebuilt the rendering layer
anyway, so schemes by people who mostly stopped making them in 2002 could run in
a browser tab. If you're unhinged enough to ship it on a real website,
[I want to hear about it](https://github.com/khawkins98/scriptoscope/issues).
The [project story](https://github.com/khawkins98/scriptoscope/blob/main/docs/project-background.md)
has the history, original authors and preservation context.

## Install

Choose the setup that fits your site. Both use the same renderer and theme format;
npm is optional.

| Your site | Start here |
| --- | --- |
| Plain HTML or a quick experiment | [Five-minute hosted setup](#five-minute-setup) below; the example host loads themes and attaches windows and controls. |
| An application with a JavaScript build | [npm integration guide](./docs/npm-consumer.md); your app hosts themes and owns attachment and cleanup. |

For an application:

```sh
npm install @khawkins98/scriptoscope
```

The [npm guide](./docs/npm-consumer.md) includes a complete TypeScript/Vite app,
a first-party sample theme, nested deployment paths and teardown. Installing the
package alone does not decorate your page. Attach after native DOM mounts and
restore dependents before releasing their theme.

## Five-minute setup

Save this as an HTML page and serve it from your website or a local static server.
It loads the hosted example and one of the demo's original schemes:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>My Kaleidoscope window</title>
  <link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
</head>
<body>
  <div data-scriptoscope-window data-scriptoscope-title="Welcome">
    <p>This is live HTML. <a href="https://example.com">Real links</a> work.</p>
    <button data-scriptoscope-button data-scriptoscope-default>OK</button>
  </div>
  <script type="module">
    import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
    await mountExplicitPage({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      pageThemeDefault: '1138',
    });
  </script>
</body>
</html>
```

The window starts at the element's position and size. Drag its frame to move it.
The hosted helper captures sources once; later DOM additions need explicit
`handle.attach(...)` calls. `mountExplicitPage` is a hosted example helper, not an
npm export. The hosted code and themes follow the Pages deployment; use npm or
[vendor a matching build](https://github.com/khawkins98/scriptoscope/blob/main/docs/hosted-recipes.md#vendoring-if-you-dont-want-a-third-party-cdn-dependency)
when your application needs dependency control.

## Before you adopt it

- **Pre-1.0 desktop windowing.** This is a compatibility runtime, not a full
  AppKit/Carbon reproduction or a mobile-first toolkit. See the
  [changelog](./CHANGELOG.md) for release changes and migrations.
- **Promotion changes the wrapper DOM.** Children move into the managed window
  and the original wrapper detaches. Integrate after framework mounting and use
  the documented cleanup lifecycle. Host layout styles are constrained; see
  [integration edge cases](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md).
- **Rendering coverage has limits.** Regression screenshots do not establish
  original-engine fidelity. Known control and rendering gaps remain; see the
  [rendering scope](https://github.com/khawkins98/scriptoscope/blob/main/docs/project-background.md#rendering-regression-coverage).
- **Themes have their own terms.** The runtime license does not relicense scheme
  artwork, fonts or other third-party inputs. Preserve attribution and provenance.
  Local-file theme conversion runs in the tab without uploading the archive.

## Find the right documentation

| What you want to do | Read |
| --- | --- |
| Learn by running an application | [npm guide and executable example](./docs/npm-consumer.md) |
| Switch themes, accept a local scheme, or self-host | [Hosted page recipes](https://github.com/khawkins98/scriptoscope/blob/main/docs/hosted-recipes.md) |
| Look up attributes, host options or CDN paths | [Hosted page reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/hosted-reference.md) |
| Use lower-level rendering and owned assets | [Runtime API guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/runtime-api.md) |
| Check gestures, keyboard behavior and events | [Interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md) |
| Understand the design, history and evidence | [Project background](https://github.com/khawkins98/scriptoscope/blob/main/docs/project-background.md) |
| Contribute code or run the checkout | [Contributing](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md) |

Helping an AI assistant integrate? [llms.txt](https://github.com/khawkins98/scriptoscope/blob/main/llms.txt)
points to the same task guides and references. Runtime implementers must start
with the [implementer brief](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/IMPLEMENTER-BRIEF.md)
and its allowed reading scope.

## If you build a scheme

The [creation guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/authoring-a-scheme.md)
covers concept art, geometry, editable sprites and visual review. The
[Scriptoscope Reference Native Theme](https://github.com/khawkins98/scriptoscope/tree/main/authoring/schemes/scriptoscope/)
is a worked example that builds ordinary Kaleidoscope resource forks. Validate a
new design in the browser, at 8-bit colour and in native Kaleidoscope before
publishing it.

## License

The site’s [Acknowledgements page](https://github.com/khawkins98/scriptoscope/blob/main/demo/acknowledgements.html) collects scheme authors, archives, visual inspiration, image provenance, fonts, and supporting tools.

**Scriptoscope's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Instrument Serif and Cormorant Garamond (SIL OFL 1.1), Charcoal 12 (Jeremy Sachs, CC BY-SA), and Virtue (Marty Pfeiffer, author’s terms); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](https://github.com/khawkins98/scriptoscope/tree/main/tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
