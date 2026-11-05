# Scriptoscope

[Live demo](https://khawkins98.github.io/scriptoscope/showcase.html) · [Theme gallery](https://khawkins98.github.io/scriptoscope/) · [Install](#install)

Scriptoscope gives websites classic Mac windows and controls by reading original
[Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) theme files.
Window frames, buttons and patterns paint into canvas; your content stays live
HTML, with selectable text, links and native form values.

Kaleidoscope lost to OS X a quarter-century ago. I rebuilt the rendering layer
anyway, so those improbable little schemes could run in a browser tab. If you
ship it on a real website, [I’d like to see it](https://github.com/khawkins98/scriptoscope/issues).

## Install

Choose the path that matches your page:

| I want to… | Start here |
|---|---|
| Decorate a plain HTML page | [Five-minute setup](#five-minute-setup) below; no npm or build step |
| Integrate with an application | [npm integration guide](./docs/npm-consumer.md); version the dependency and host your themes |
| Change themes, use a picker, or accept a dropped scheme | [Page decoration guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/decorate-a-page.md#theme-switching-at-runtime) |
| Render or manage windows directly | [Runtime recipes](https://github.com/khawkins98/scriptoscope/blob/main/docs/runtime-api.md) |
| Create a new Kaleidoscope scheme | [Scheme authoring guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/authoring-a-scheme.md) |

Both integration paths use the same renderer and theme format. npm gives your
application dependency versioning and deployment control; it does not add
rendering features or require a particular framework.

```sh
npm install @khawkins98/scriptoscope
```

The [npm guide](./docs/npm-consumer.md) includes a complete TypeScript/Vite app,
a first-party sample theme, nested deployment URLs and explicit cleanup. The
package does not automatically scan your page. Attach decoration after your
application creates its native DOM, and release it when that content leaves.

## Five-minute setup

Save this as an HTML page and serve it from a local web server or your website.
It loads the public example host and a hosted scheme:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Kaleidoscope window</title>
  <link rel="stylesheet"
        href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
</head>
<body>
  <div data-scriptoscope-window data-scriptoscope-title="Welcome">
    <p>This is real HTML, wearing a scheme from the nineties.</p>
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

The window starts in normal page flow. Drag it by its frame to move it; the
children remain ordinary HTML. Set `pageThemeDefault` to another slug from the
[theme catalog](https://khawkins98.github.io/scriptoscope/themes-manifest.json)
to change the skin. The stylesheet provides optional shell decoration; the
renderer itself paints the chrome.

The hosted `mountExplicitPage` helper selects the page’s sources once and owns
their theme and lifetime. It is an example orchestration layer, separate from
the package’s explicit promotion primitives. Dynamically inserted controls need
`handle.attach(...)`; use `detach(...)` before removing them and `disconnect()`
when disposing the page. See the [handle reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/decorate-a-page.md#explicit-page-host-options)
for the exact contracts.

The hosted files follow the deployed demo. For a reproducible application, use
npm and a lockfile, or [vendor matching build files](https://github.com/khawkins98/scriptoscope/blob/main/docs/decorate-a-page.md#vendoring-if-you-dont-want-a-third-party-cdn-dependency)
including the lazy decoder chunks and your chosen theme archives.

## Before using it in an application

- **Pre-1.0:** check the [changelog](./CHANGELOG.md) and [migration guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/integration-release-notes.md)
  when upgrading. This is a desktop windowing runtime, not a complete AppKit or
  Carbon implementation or a mobile-first UI toolkit.
- **DOM ownership matters:** window promotion replaces the source wrapper and
  moves its children into the managed window. Framework references to the
  wrapper become detached. Use the [application lifecycle recipe](./docs/npm-consumer.md)
  and [integration notes](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md)
  for framework mounting, CSS conflicts and cleanup.
- **Size and hit testing affect layout:** declared width/height are content
  dimensions; auto-captured bounds include the frame. Transparent parts of
  supported frames pass input through by default. Use `data-scriptoscope-hit="box"`
  when the full rectangular host should take input. Details live in the
  [markup reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/decorate-a-page.md#the-full-data-scriptoscope--vocabulary).
- **Classic behavior is deliberate:** hover does not invent artwork the scheme
  never supplied. Native controls retain form and keyboard behavior, but your
  application still needs accessibility review. The [interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md)
  documents gestures, keyboard support, events and touch differences.
- **Regression coverage has limits:** reviewed screenshots detect changes in
  output; they do not certify complete fidelity to the original engine. See the
  [fidelity plan](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/fidelity-verification-plan.md)
  and [known divergences](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/kdef-faithfulness-ledger.md).

## Use another scheme

Drop an original `.sit` or `.rsrc` file onto the [interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html).
Decoding runs in the browser without uploading your file. The page guide covers
[adding a drop zone](https://github.com/khawkins98/scriptoscope/blob/main/docs/decorate-a-page.md#bring-your-own-theme--drop-a-sit--rsrc-and-see-it-render)
and registering the result in your own application. Community archives include
[Mac Themes Garden](https://macthemes.garden/) and the
[Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/).

Themes are separate inputs from the npm runtime. When hosting one yourself,
retain the archive, metadata, attribution and original redistribution terms.
Desktop pictures, sounds and other page content remain your application’s concern.

## If you build a scheme

The [creation guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/authoring-a-scheme.md)
walks from concept art through geometry, sprites, controls and visual review.
The [Scriptoscope Reference Native Theme](https://github.com/khawkins98/scriptoscope/tree/main/authoring/schemes/scriptoscope/)
is a worked example that builds into a real Kaleidoscope resource fork.

## Contribute or learn how it works

Start with [CONTRIBUTING](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md)
for local setup and checks. Runtime implementers must start with the
[implementer brief](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/IMPLEMENTER-BRIEF.md)
and their assigned safe family spec. Its read scope takes precedence over broad
repository exploration. [Project background](https://github.com/khawkins98/scriptoscope/blob/main/docs/project-background.md)
explains the preservation goal, history and evidence boundaries.

For integration help from an agent, [llms.txt](https://github.com/khawkins98/scriptoscope/blob/main/llms.txt)
provides task-specific entry points. Feature proposals and work in progress live
in the [issue tracker](https://github.com/khawkins98/scriptoscope/issues).

## License

Scriptoscope’s own code is [MIT](./LICENSE). Third-party schemes, fonts and
supporting tools retain their own terms; they are not relicensed by this project.
Read [THIRD_PARTY_NOTICES](./THIRD_PARTY_NOTICES), each bundle’s `meta.json` and
`PROVENANCE.md`, and the [acknowledgements](https://github.com/khawkins98/scriptoscope/blob/main/demo/acknowledgements.html)
for authors and sources. Original scheme authors can contact
<khawkins98@gmail.com> about attribution or removal.
