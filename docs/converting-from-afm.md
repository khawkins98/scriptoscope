# Converting a Mac OS Appearance theme (`.afm`) to a Kaleidoscope `.rsrc`

Scriptoscope does not load Apple's Mac OS 8.5+ Appearance theme format (`.afm`)
natively. The decision is in [`PRD.md` §90](../PRD.md) and the reasoning is in
[`LEARNINGS.md`](../LEARNINGS.md) 2026-05-16 — short version: Apple-asserted
visual IP on Hi-Tech / Drawing Board / Gizmo, a sparse community `.afm` corpus,
and a separate compositor model (`kPSetCDEF`) we don't ship. The decision was
revisited 2026-05-28 (issue [#174](https://github.com/khawkins98/aaron-ui/issues/174))
and confirmed. The pivot — **user-side conversion** instead of a runtime
importer — is tracked at [#176](https://github.com/khawkins98/aaron-ui/issues/176),
which carries the roadmap for making this pathway lower-friction over time
(docs improvements, an optional Node CLI converter, possible standalone
package).

This page exists for the rare case where **you own an `.afm` file** — typically
a community-authored one with documented redistribution terms — and want its
chrome rendered through Scriptoscope. The path is **user-side**: you convert
the bundle yourself using period tools, then load the resulting `.rsrc` via
the existing Kaleidoscope code path.

## What's in an `.afm`

An `.afm` is a Mac OS resource fork wrapped in a single-fork container.
Resource types of interest:

| Type | Meaning |
|---|---|
| `kTHM` | Theme container (metadata, references the sub-resources) |
| `kSCH` | Color scheme (palette + highlight colors) |
| `kncs` | Native control set (button / scrollbar / progress / etc.) |
| `kPSet` | Parts set (window-chrome parts + their bevel/scale rules) |
| `kSND` | Optional theme sounds |

Kaleidoscope's format uses a different vocabulary:

| Kaleidoscope | Role | Closest Appearance equivalent |
|---|---|---|
| `cicn` | Color icon (button face / scrollbar thumb / etc.) | sub-resources inside `kncs` |
| `wnd#` | Window-chrome part list | `kPSet` (with different part codes) |
| `cinf` | Chrome-info: 9-slice insets + colour roles | inline within `kPSet` parts |
| `ppat` | Pixel pattern (titlebar tiles, desktop) | inline within `kPSet` |
| `Colr` | Colour table | `kSCH` |

The two formats describe similar visual ideas with different containers and
different layout conventions. There is no automatic decoder — the conversion
needs human eyes for layout decisions.

## The workflow

### What you need

- A Mac OS 8.x–9.x environment. A modern Mac can run this in
  [SheepShaver](https://www.emaculation.com/doku.php/sheepshaver) or
  [Basilisk II](https://www.emaculation.com/doku.php/basilisk_ii) — both
  emulators, both free, both supported on Apple Silicon under macOS 14+.
- [**ResEdit 2.1.3**](https://macintoshgarden.org/apps/resedit) — Apple's
  resource editor. Run it inside the emulator.
- The **Kaleidoscope 2.3.1 SDK** (or any 2.x SDK) — provides the resource
  templates (`TMPL`s) for the Kaleidoscope schema so ResEdit shows fields by
  name instead of raw bytes. Mirrored on Macintosh Garden.
- Your source `.afm` (and the right to redistribute its derived form if you
  intend to share the result).

### High-level steps

1. **Open the `.afm` in ResEdit.** You'll see the kTHM container at top and
   the sub-resources beneath.
2. **Extract the color scheme.** Open the `kSCH` resource. Note the highlight
   color (used for selected text), the active titlebar color, and the
   accent. These map to Kaleidoscope's `Colr` resource and the
   `headerColors.{active,inactive,text}` entries of `theme.json`.
3. **Extract the chrome parts.** Open each `kPSet` part. Each contains:
   - the rendered chrome bitmap (an SICN or PICT — copy it),
   - bevel/inset metadata (the part's "frame" rect minus its "content" rect
     — these become Kaleidoscope's `cinf` 9-slice insets),
   - the part's position in the window (these become entries in `wnd#`).
4. **Build a new Kaleidoscope scheme.** Start from a known-good `.rsrc`
   skeleton (extract one from any working Kaleidoscope theme — `themes/1138/`
   in this repo is a good template). Replace its `cicn`, `cinf`, `wnd#`, and
   `Colr` resources with what you decoded from the `.afm`.
5. **Paste in the controls.** Each `kncs` button / scrollbar / checkbox /
   radio in the Appearance set becomes a `cicn` in the Kaleidoscope scheme,
   matched by resource ID per
   [`docs/spec/kdef231-reference.md`](./spec/kdef231-reference.md) §2.
6. **Save as `.rsrc`** and copy the file out of the emulator.

### Loading the result into Scriptoscope

Drop the `.rsrc` onto the demo at `demo/index.html` (the BYO drop-zone) — the
in-browser decoder will run the same conversion pipeline as the Node CLI and
render your scheme live.

For a permanent bundle, copy the `.rsrc` to `themes/<your-slug>/scheme.rsrc`
and run:

```sh
npm run import -- <your-slug>
```

This produces `theme.json` + `cicns/` + the per-bundle provenance metadata.
See [`docs/porting-a-kaleidoscope-scheme.md`](./porting-a-kaleidoscope-scheme.md)
for the full porting walkthrough.

## Caveats

- **Provenance matters.** If the `.afm` you converted is Apple's (Hi-Tech,
  Drawing Board, Gizmo) or any other rights-asserted theme, **don't
  redistribute** the resulting bundle. Use it locally only. Apple's
  enforcement record is real ([`LEARNINGS.md`](../LEARNINGS.md)).
- **Some Appearance features don't have Kaleidoscope analogs** — drag-along
  animations, certain control-state variants, and the sound bundle don't
  carry over. Static chrome converts cleanly; behavior often doesn't.
- **This is a one-way conversion** — there's no `.rsrc` → `.afm` path because
  the Appearance Manager's geometry model carries information Kaleidoscope's
  doesn't.

## If you'd rather not do this

The Kaleidoscope corpus has a Platinum-faithful scheme already shipped:
**`platinum-8`** (Russell Silver Jr.'s 1998 freeware scheme, included in
`themes/platinum-8/`). It's the recognizable Mac OS 8 Appearance look,
without the IP exposure. It loads with no conversion step:

```ts
const theme = await loadTheme('/themes/platinum-8');
```

For most "I want classic Mac chrome" needs, that's the answer.
