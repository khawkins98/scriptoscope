# Porting a Kaleidoscope scheme into Aaron UI

Walk-through for adding a new Kaleidoscope scheme to Aaron UI's theme corpus. By the end you have a bundle under `themes/<your-slug>/` that loads via `loadTheme()` and renders chrome end-to-end.

**Audience:** anyone porting a freeware Kaleidoscope `.ksc` scheme — typically because you want Aaron UI to load a scheme other than mass:werk's bundled "7 Le" default.

**Companion reading:** [`docs/theme-bundle-layout.md`](./theme-bundle-layout.md) (the directory shape), [`docs/kaleidoscope-geometry-spec.md`](./kaleidoscope-geometry-spec.md) (what's in a `.ksc`), [`docs/runtime-rendering-architecture.md`](./runtime-rendering-architecture.md) (how the runtime renders it). This doc is the *procedural* version of those three.

---

## 0. Before you start

**Verify the scheme's license permits redistribution.** Check the scheme's original readme. Mass:werk's schemes are explicit: "freeware, redistribute as long as with this readme file." When a scheme lacks an explicit license, study it privately but **do not port until rights are confirmed**. Aaron UI's clean-room boundary is from Kaleidoscope's source code; the assets we ship come *only* from schemes whose authors granted redistribution.

**Tools you need on macOS:**

- `DeRez` (ships with Xcode Command Line Tools) — decompiles classic Mac resource forks to text
- `unar` (Homebrew: `brew install unar`) — unpacks `.sit` / `.bin` / `.hqx` archives without losing resource forks
- Node.js 20+ (the extractor + builder are pure ES modules)
- This repo cloned with `npm install` run inside it

---

## 1. Acquire the scheme

Source: typically [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) or the original author's homepage. The archive is usually a `.sit` (StuffIt) preserving the Mac resource fork.

```sh
# Stage the scheme under .scratch/ (gitignored, won't be committed).
mkdir -p .scratch/schemes/<your-slug>
cd .scratch/schemes/<your-slug>

# Download the .sit archive (or copy from your downloads).
unar your-scheme.sit
```

`unar` produces a directory containing the scheme file (typically named the same as the scheme without an extension). Inside is the resource fork plus an icon and readme.

---

## 2. Decompile to a `.r` text file

```sh
# From the scheme directory unar created:
DeRez "your-scheme-file" > scheme.r

# Quick check — should be tens of thousands of lines.
wc -l scheme.r
```

If `wc -l` shows a small number (< 1000), the resource fork was probably stripped during transit. Common cause: the archive was extracted through a non-Mac filesystem at some point. Re-download the `.sit` and `unar` again.

---

## 3. Run the extractor

```sh
# From the repo root (cd back up):
node tools/scheme-extractor/bin/extract.js \
  --input  .scratch/schemes/<your-slug>/scheme.r \
  --output demo/assets/themes/<your-slug>/ \
  --verbose
```

This emits:

- `demo/assets/themes/<your-slug>/cicn-n<id>-<slug>.png` — one PNG per chrome cicn
- `demo/assets/themes/<your-slug>/ppat-n<id>-<slug>.png` — one PNG per tile pattern
- `demo/assets/themes/<your-slug>/extraction-manifest.json` — diagnostic record
- `demo/assets/themes/<your-slug>/theme.json` — draft Aaron UI bundle manifest

Spot-check a few PNGs in your image viewer to confirm they look like the chrome you'd expect. Especially the document-window cicn — it should look like the window border + titlebar of the scheme.

---

## 4. Create the canonical bundle skeleton

Two hand-authored files live alongside the canonical bundle. They carry everything the binary scheme doesn't (author, license, palette).

```sh
mkdir -p themes/<your-slug>
```

### 4a. `themes/<your-slug>/meta.json`

```json
{
  "name": "Your Scheme Name",
  "author": {
    "name": "Original Author Name",
    "email": "optional@example.com",
    "url": "https://author-website.example",
    "year": 2005
  },
  "origin": {
    "kind": "kaleidoscope-port",
    "originalFormat": "ksc",
    "originalLicense": "<verbatim license string from the scheme's readme>",
    "originalReadme": "<name of the readme file>",
    "sourceUrl": "https://macintoshgarden.org/apps/your-scheme"
  },
  "palette": {
    "bg": "#cccccc",
    "fg": "#000000",
    "accent": "#316ac5",
    "titlebar-active-bg": "#cccccc",
    "titlebar-active-fg": "#000000",
    "titlebar-inactive-bg": "#eeeeee",
    "titlebar-inactive-fg": "#888888",
    "window-frame": "#888888"
  }
}
```

The `originalLicense` field is **verbatim from the readme**, not paraphrased. Preserves the porter's interpretation context for future auditors.

The `palette` is hand-picked pending a Colr decoder (a future ticket). Pull colors from the scheme's reference thumbnail by eye — they're applied as `--aaron-colr-*` CSS custom properties at the root.

### 4b. `themes/<your-slug>/PROVENANCE.md`

Markdown companion to `meta.json`. Same factual content, formatted for humans. See `themes/masswerk-7-le/PROVENANCE.md` as the canonical template — copy and adapt.

The README has a "Why this is in the corpus" section explaining what makes this scheme worth porting (stylistic distinctiveness, historical significance, faithful Platinum reproduction, etc.). Be honest; don't fabricate provenance.

---

## 5. Materialize the canonical bundle

```sh
node scripts/build-theme-bundles.mjs <your-slug>
```

The script:

1. Reads `demo/assets/themes/<your-slug>/extraction-manifest.json`
2. Copies cicn PNGs into `themes/<your-slug>/cicns/`
3. Copies ppat PNGs into `themes/<your-slug>/ppats/`
4. Merges your `meta.json` into the extractor's draft `theme.json`
5. Validates the result against the schema (`src/themes/schema/parseTheme.ts` / `tools/scheme-extractor/lib/validateTheme.js`)
6. Writes the final `themes/<your-slug>/theme.json`

If validation fails, the script aborts non-zero and explains which field violates the schema — `theme.json.windowTypes.<slug>.parts.part-1.rect[3]: expected finite number`, that level of dotted-path specificity. Fix and re-run.

### Add your slug to the build script

`scripts/build-theme-bundles.mjs` has an `ALL_BUNDLES` array that defaults to building both mass:werk schemes when called with no args. Add your slug so future `npm run build:demo` runs pick it up:

```js
const ALL_BUNDLES = ['masswerk-7-le', 'masswerk-dark-ergobox2', '<your-slug>'];
```

---

## 6. Smoke-test it locally

```sh
npm run dev
```

In your browser, open `http://localhost:5173/theme-switcher-fixture.html`. The fixture's switcher has buttons for the two bundled schemes — to test yours, you can either:

- Add a button to the fixture (edit `demo/theme-switcher-fixture.html`)
- Use the JS console:
  ```js
  await loadTheme('themes/<your-slug>/');
  ```
- Set `<html data-aaron-theme="themes/<your-slug>/">` and reload

You should see:

- The window's chrome bitmap render with your scheme's titlebar
- `wnd#`-derived hit overlays for close / zoom / windowshade (5 part divs in the titlebar for typical document-window schemes)
- The page background pick up your `palette.bg` color

If the chrome looks off (stretched wrong, missing borders), check that `theme.json.chromeElements.<name>.slice` has reasonable corner/side values. If they're absent, the scheme didn't ship cinf data for that cicn — Aaron UI degrades to a simple background-image render, which is fine for non-bordered chrome but visibly wrong for window frames.

---

## 7. Side-by-side fidelity check

If the scheme had a reference thumbnail (often `Scheme Settings.jpg` or similar in the original archive), put a copy at `demo/assets/references/<your-slug>.jpg`. The landing demo can then show the original next to Aaron UI's render for visual comparison.

If the scheme didn't ship a thumbnail, take a screenshot of Kaleidoscope's own "Scheme Settings" preview running under SheepShaver (or use a period screenshot from Macintosh Garden) and crop it to the relevant window.

---

## 8. Open the PR

```sh
git checkout -b port/<your-slug>
git add themes/<your-slug>/ demo/assets/themes/<your-slug>/ \
        demo/assets/references/<your-slug>.jpg \
        scripts/build-theme-bundles.mjs
git commit -m "themes: port <Your Scheme Name> by <Author> (#XX)"
git push -u origin port/<your-slug>
```

PR body checklist:

- [ ] License: quote the verbatim license string from the readme
- [ ] Author: name + email/URL preserved in `meta.json` and `PROVENANCE.md`
- [ ] Side-by-side screenshot: Aaron UI render next to the scheme's preview thumbnail
- [ ] Smoke tested locally: window renders + theme swap works
- [ ] `node scripts/build-theme-bundles.mjs <your-slug>` validates clean

---

## Common pitfalls

### "The chrome cicn body is white but the reference shows gray"

This is the ppat-overlay case (LEARNINGS 2026-05-16). Some schemes have white cicn body pixels but Kaleidoscope overlaid a `ppat` tile on the body region at draw time. Aaron UI's runtime supports this via `cinf.bgPatternId`, but the extractor currently emits `bgPatternId: 0` for every cinf because the geometry decoder doesn't read the field yet. This is a known gap — track via the Phase 4 follow-ons or open a new issue. Workaround for now: accept the visual difference; document in your PROVENANCE.md.

### "The wnd# parts are positioned wrong / not where the close box appears in the cicn"

Part IDs are scheme-relative (LEARNINGS 2026-05-17 "wnd# part IDs are scheme-relative integers"). The integer-to-semantic-role mapping isn't standardized — every scheme decides which part is the close box. The runtime doesn't try to auto-classify; it just positions overlays at the rect coordinates wnd# specifies. If you're hooking up listeners (close on part-1 click, etc.), inspect your scheme's wnd# data first to find the right indices.

### "The PNG dimensions don't match the rendered chrome size"

This is the fixed-aspect-vs-stretch issue from the architecture spec (§10 impedance mismatches). Some scheme chrome is designed to scale (border-image with `cinf.tileSides`); some isn't (ErgoBox's projecting tab). The current runtime stretches all chrome via border-image, which can look weird for non-stretchable schemes. Document in PROVENANCE.md, file an issue if it's important to your use case.

### "I lost the resource fork during extraction"

Symptom: `DeRez scheme-file > scheme.r` produces a near-empty file. The resource fork was stripped — usually by extracting through Linux/Windows, or by some archive tools. Re-download the `.sit` and use `unar` on the original.

---

## What you don't need to do

- **Don't hand-edit `theme.json`** — it's generated. Edit `meta.json` and re-run the builder. Hand edits get clobbered next run.
- **Don't commit the source `.r` file** — it's gitignored under `.scratch/`. Other porters will re-download from the upstream URL.
- **Don't author CSS, SVG, or any chrome assets from scratch.** The 2026-05-17 Kaleidoscope-runtime pivot establishes that Aaron UI doesn't hand-author chrome — it renders what Kaleidoscope schemes provide. If you want new chrome, use Kaleidoscope's own authoring tools (ResEdit + Kaleidoscope SDK under SheepShaver) to produce a `.ksc` and port it through this flow.
- **Don't worry about sounds or desktop backgrounds.** Kaleidoscope schemes in practice didn't carry them; Aaron UI doesn't fabricate them. The `palette`, `chromeElements`, `windowTypes`, and `patterns` sections are the full bundle surface.

---

## Resources

- [Kaleidoscope on Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) — ~4,010 schemes
- [Mac Themes Garden](https://macthemes.garden/) — searchable thumbnail index
- [mass:werk schemes](https://www.masswerk.at/schemes.php) — Aaron UI's bundled-default source
- [SheepShaver](https://www.emaculation.com/doku.php/sheepshaver) — for authoring new schemes under emulated classic Mac OS

For questions about the format itself, the geometry spec ([`docs/kaleidoscope-geometry-spec.md`](./kaleidoscope-geometry-spec.md)) is the authoritative reference. For runtime behavior, the architecture doc ([`docs/runtime-rendering-architecture.md`](./runtime-rendering-architecture.md)) covers how a parsed `Theme` becomes DOM.
