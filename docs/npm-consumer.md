# Use the package in an application

Use this path when your application already bundles JavaScript and you want
Scriptoscope managed through dependencies, a lockfile and your own deployment.
For a plain HTML page or a quick try, the
[hosted starter](https://khawkins98.github.io/scriptoscope/install.html) is the
shorter setup: copy its HTML, load its stylesheet/module and choose a hosted
theme. npm is optional; both paths use the same renderer and theme format.

Scriptoscope adds classic-Mac window chrome and themed controls to your own
HTML. Your content stays selectable, your forms keep native values and keyboard
behavior, and your application owns when the decoration attaches and disappears.

Install it with your app's other dependencies, commit your lockfile, and bundle
the runtime with your application. You can choose and host themes independently
of runtime upgrades. This works for personal sites, retro interfaces and existing
applications that want a themed window without replacing their content system.

## Install

With npm, your application loads its own theme files and explicitly attaches
and cleans up windows and controls. The hosted starter provides a page-level
helper for that orchestration. Installing the package does not automatically scan or
decorate your page; the complete example below shows the application lifecycle.

```sh
npm install @khawkins98/scriptoscope
```

The runtime is framework-independent ESM with TypeScript declarations. Import
the APIs you need and the optional stylesheet:

```ts
import { loadOwnedTheme, WindowManager, type OwnedTheme } from '@khawkins98/scriptoscope';
import { ScriptoscopeWindow, promoteControl, restoreControl } from '@khawkins98/scriptoscope/declarative';
import '@khawkins98/scriptoscope/scriptoscope.css';
```

For a page without a build step, use the
[hosted installation guide](https://khawkins98.github.io/scriptoscope/install.html).

## Install and run the complete example

Use Node 24 for this Vite/TypeScript example. This is a browser application;
DOM promotion and canvas rendering run on the client. Importing the JS entrypoints
on a server does not provide server rendering.

The installed package includes a small Vite app at `examples/npm/`. From a
project where you installed Scriptoscope, copy it into a new directory:

```sh
cp -R node_modules/@khawkins98/scriptoscope/examples/npm ../my-scriptoscope-app
cd ../my-scriptoscope-app
npm install
npm run theme
npm run dev
```

Open the URL printed by Vite, including `/nested/`. Check “Keep my setting”,
then press “Restore native HTML”. The original checkbox and its value remain.
The sample uses the package's public exports and your own hosted theme files.
You can copy its markup and lifecycle into an existing application instead of
starting a separate Vite app.

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
layout. The theme archive is deliberately separate from the runtime package.

For another Kaleidoscope scheme, obtain the original `.sit` or `.rsrc` archive,
retain its original provenance/terms when redistributing, and place it with its
`meta.json` in your application's public theme directory. Change both the bundle
URL and the `source` filename in `main.ts`. A `.sit` lazily uses the bundled
decoder; consumers do not need Emscripten or a separately hosted WASM file.

## Attachment and ownership

The complete executable recipe is [main.ts](../examples/npm/main.ts) with
[index.html](../examples/npm/index.html). Its key calls are:

```ts
import { loadOwnedTheme, WindowManager, type OwnedTheme } from '@khawkins98/scriptoscope';
import { ScriptoscopeWindow, promoteControl, restoreControl } from '@khawkins98/scriptoscope/declarative';
import '@khawkins98/scriptoscope/scriptoscope.css';

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
accepts both theme forms. Import these types from `@khawkins98/scriptoscope`. Keep the
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

## Decode themes off the main thread (optional)

By default a theme archive is decoded on the thread that asks for it. Decoding
one archive takes tens of milliseconds on a fast desktop and several hundred on
a slow device, which shows up as long tasks while a page loads. To move that
work, create a worker from the `decode-worker` export and pass it to the loader
or resolver:

```ts
import { createOwnedThemeResolver } from '@khawkins98/scriptoscope/declarative';

const decodeWorker = new Worker(
  new URL('@khawkins98/scriptoscope/decode-worker', import.meta.url),
  { type: 'module' },
);
const resolver = createOwnedThemeResolver({ themeBaseUrl: '/themes', decodeWorker });
```

`loadTheme`, `loadOwnedTheme`, `loadKaleidoscopeScheme` and
`loadOwnedKaleidoscopeScheme` take the same `decodeWorker` option. It also
accepts a function returning the worker, called on the first load that uses it.
The loaded theme is the same as without the option; only where the decode runs
changes.

- The worker is yours. Share one between loads and resolvers, and call
  `terminate()` when the page no longer loads themes. Disposing a theme or a
  resolver does not stop it.
- The `new Worker(new URL(...), { type: 'module' })` form is what Vite and
  webpack 5 recognise and bundle. A bundler that does not emit worker files needs
  `dist/decode-worker.js` copied and served from your own origin; it is a single
  self-contained module.
- Loads that pass `displayProfile`, `cicnTransfer`, `cinfEnvironment` or
  `sliderLayoutEnvironment`, or `meta` that is not plain JSON data, decode on the
  calling thread as before. Those prepared handles cannot cross to a worker.
- A worker that fails to start, throws, or does not answer within
  `decodeWorkerTimeoutMs` (default 30 seconds) rejects its pending loads with an
  error whose `code` is `'DECODE_WORKER_FAILED'`. The library does not retry on
  the main thread; retry without the option if you want that fallback.
- Eager loaders (`loadTheme`, `createThemeResolver`) still encode every image to
  a PNG URL on the main thread after the decode. The owned loaders skip that
  step, so they gain the most.

## Public files and troubleshooting

Supported imports are `@khawkins98/scriptoscope`, `@khawkins98/scriptoscope/renderer`,
`@khawkins98/scriptoscope/declarative`, `@khawkins98/scriptoscope/decode-worker` (a worker
script, not an importable API), `@khawkins98/scriptoscope/scriptoscope.css` and
`@khawkins98/scriptoscope/package.json`. Shared hashed JS chunks are shipped dependencies of
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
