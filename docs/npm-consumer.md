# Use the package in an application

The registry package is not published yet. This guide works with a locally built
tarball now; publication will use the same package exports. For the current
no-build hosted setup, use the [website installation guide](https://khawkins98.github.io/scriptoscope/install.html).

## Install and run the complete example

Use Node 24 for this Vite/TypeScript example. This is a browser application;
DOM promotion and canvas rendering run on the client. Importing the JS entrypoints
on a server does not provide server rendering.

From a Scriptoscope checkout, prepare a tarball:

```sh
npm ci
npm run build
mkdir -p /absolute/path/to/output
npm pack --ignore-scripts --pack-destination /absolute/path/to/output
```

Create a new app outside the checkout, copying the example directory from either
the checkout or an installed package. Replace the absolute paths below with your
paths and use the tarball filename printed by `npm pack`:

```sh
mkdir my-scriptoscope-app
cp -R /absolute/path/to/scriptoscope/examples/npm/. my-scriptoscope-app/
cd my-scriptoscope-app
npm install /absolute/path/to/output/scriptoscope-0.9.0.tgz
npm run theme
npm run dev
```

Open the URL printed by Vite, including `/nested/`. Check “Keep my setting”,
then press “Restore native HTML”. The original checkbox and its value remain.
The example files are included in the package at `examples/npm/`; there are no
imports from the Scriptoscope checkout or the Pages example host.

To verify production output:

```sh
npm run build
npm run preview
```

Open the preview URL with `/nested/`. `vite.config.js` sets that base explicitly.
Change it to your application's deployment path (or `/` for the domain root).

## Acquire and host a theme

`npm run theme` downloads the original first-party Scriptoscope Reference design
from the fixed repository revision
`8f5635699fd7a5fe666187b1af87bd9ae4b5000c`. It saves its archive, metadata,
license and generated provenance alongside each other:

```text
public/themes/scriptoscope/
  scheme.rsrc
  meta.json
  LICENSE
  PROVENANCE.md
```

This download needs network access during setup. The running app fetches these
files from your own server; it does not depend on Pages or contact the archive
source. Vite copies `public/` files unchanged into the production output.
For offline setup, copy those four files from a previous download into the same
layout. The theme archive is deliberately separate from the runtime tarball.

For another Kaleidoscope scheme, obtain the original `.sit` or `.rsrc` archive,
retain its original provenance/terms when redistributing, and place it with its
`meta.json` in your application's public theme directory. Change both the bundle
URL and the `source` filename in `main.ts`. A `.sit` lazily uses the bundled
decoder; consumers do not need Emscripten or a separately hosted WASM file.

## Attachment and ownership

The complete executable recipe is [main.ts](../examples/npm/main.ts) with
[index.html](../examples/npm/index.html). Its key calls are:

```ts
import { loadOwnedTheme, WindowManager, type OwnedTheme } from 'scriptoscope';
import { ScriptoscopeWindow, promoteControl, restoreControl } from 'scriptoscope/declarative';
import 'scriptoscope/scriptoscope.css';

const theme = await loadOwnedTheme(`${import.meta.env.BASE_URL}themes/scriptoscope`, {
  source: 'scheme.rsrc',
});
const manager = new WindowManager<OwnedTheme>();
const promoted = await ScriptoscopeWindow.promote(source, { manager, theme });
await promoteControl(input, theme);
```

Here `source` is the article element and `input` is its native checkbox; capture
them before promotion, as shown in the full example. Attributes alone do not
attach anything: the app calls promotion explicitly. `mountExplicitPage` belongs
to the hosted Pages example and is not a package export.

The manager's default type is `LoadedTheme`. With an owned loader, explicitly
use `WindowManager<OwnedTheme>`, or `WindowManager<ThemeInput>` if the application
accepts both theme forms. Import these types from `scriptoscope`. Keep the
theme alive while any window or control borrows it.

The URL uses Vite's `import.meta.env.BASE_URL` so it works at `/nested/` as well
as `/`. In other build tools, supply your app's public asset base explicitly.
`{ source: 'scheme.rsrc' }` avoids a speculative request for `scheme.sit`.

Restore dependents before disposing their owner:

```ts
restoreControl(input);
promoted.unmount();
manager.dispose();
theme.dispose();
```

`manager.dispose()` unregisters its windows; it does not restore their source DOM
or dispose application-owned themes. Call each window's `unmount()` and restore
controls first. The example also cleans up on failed mounting and page exit,
and keeps the live UI when the browser places the page in its Back/Forward cache.

The isolated package test compiles and runs this shipped example, including the
restore button, alongside the broader consumer contract. Package JS imports are
checked without DOM globals; strict types are checked with both Bundler and
NodeNext resolution.

## Public files and troubleshooting

Supported imports are `scriptoscope`, `scriptoscope/renderer`,
`scriptoscope/declarative`, `scriptoscope/scriptoscope.css` and
`scriptoscope/package.json`. Shared hashed JS chunks are shipped dependencies of
these entries, not additional supported imports. Keep them when self-hosting.
The package includes [LICENSE](../LICENSE) and
[THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES); it excludes demo themes and fonts.

- A theme request returning HTML usually means the URL points at the app router
  instead of the public directory. Verify the archive URL directly.
- A missing stylesheet can leave outer-shell and focus styles absent. Import the
  exported CSS path, rather than a checkout-relative file.
- A TypeScript mismatch about `manifest` or `baseUrl` with an owned theme usually
  means the manager still uses its default `LoadedTheme` type.
- When using another framework, attach after its native DOM mounts and call the
  cleanup sequence before that framework removes the elements.

Vite references: [public assets](https://vite.dev/guide/assets.html#the-public-directory)
and [public base paths](https://vite.dev/guide/build.html#public-base-path).
