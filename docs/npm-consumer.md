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
`loadOwnedKaleidoscopeScheme` take the same `decodeWorker` option. The loaded
theme is the same as without the option; only where the decode runs changes.
Without the option nothing about a load changes, including its timing.

**Bundling.** The form above, with the bare package specifier, is verified with
Vite 7: the package's consumer test builds it from the published tarball. Your
own worker file containing only
`import '@khawkins98/scriptoscope/decode-worker'` is verified the same way.
Other bundlers are not tested. For a setup that does not emit worker files, copy
`dist/decode-worker.js` and serve it from your own origin: it is one
self-contained module with no imports.

**Who stops the worker.** A `Worker` you pass is yours: share it between loads
and resolvers and call `terminate()` when the page no longer loads themes.
Disposing a theme or a resolver does not stop it, and neither does a failure.
You can instead pass a function that creates the worker. That function is
called when the first load that will decode in the worker starts, never for a
load that stays on the calling thread. A worker obtained this way is held by
the library, since you have no handle to it: if it fails, the library
terminates it and calls your function once more for a replacement on the next
load. Return a new `Worker` from the function, not one you also use elsewhere.

**Loads that stay on the calling thread.** A load that passes `displayProfile`,
`cicnTransfer`, `cinfEnvironment` or `sliderLayoutEnvironment` decodes on the
calling thread as before, because those prepared handles cannot cross to a
worker. So does a load whose `meta` is not plain cloneable data: functions,
class instances, dates, accessors, symbol keys, sparse arrays, and `Proxy`
objects such as a reactive store's state. Pass a plain copy of such metadata if
you want the worker used.

**When the worker fails.** The affected loads reject with an `Error` whose `code`
is `'DECODE_WORKER_FAILED'`. The library does not retry on the main thread;
catch that code and load again without the option if you want that fallback.

| What happens | How it is noticed | How soon |
| --- | --- | --- |
| The worker dispatches `error` or `messageerror` | The event | At once |
| The worker never started (its script was missing or blocked), or is not this worker script | It does not answer the liveness check sent with the first request | 5 seconds, or `decodeWorkerTimeoutMs` if that is shorter |
| The worker answered before and then goes silent | The load's own timeout | `decodeWorkerTimeoutMs`, default 30 seconds |

A worker's `error` event cannot be observed after the fact, which is why a
worker created long before its first load is checked rather than trusted. On a
very slow connection the worker script must therefore arrive within 5 seconds
of the first load that uses it.

**What does not move.** Eager loaders (`loadTheme`, `createThemeResolver`) still
encode every image to a PNG URL on the main thread after the decode. The owned
loaders skip that step, so they gain the most.

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
