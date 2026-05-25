# Porting a Kaleidoscope scheme into Aaron UI

Walk-through for adding a new Kaleidoscope scheme to Aaron UI's theme corpus. By the end you have a bundle under `themes/<your-slug>/` that loads via `loadTheme()` and renders chrome end-to-end.

**Audience:** anyone porting a freeware Kaleidoscope `.ksc` scheme — typically because you want Aaron UI to load a scheme beyond the bundled corpus (`1138`, `1984`, `1990`, `apple-platinum-2`, `beos-r503`, `evolution`, `platinum-8`, `system7-nostalgia-silver`).

**Companion reading:** [`docs/theme-bundle-layout.md`](./theme-bundle-layout.md) (the directory shape), `src/types.ts` (the theme.json schema), [`docs/spec/compositor-spec.md`](./spec/compositor-spec.md) + [`docs/spec/kdef231-recipe-walk.md`](./spec/kdef231-recipe-walk.md) (how the kDEF compositor draws a scheme), and `tools/theme-loader/` (the `.rsrc` decoders). The condensed version of this same flow lives in [`CONTRIBUTING.md` § Adding a theme](../CONTRIBUTING.md#adding-a-theme-porting-a-kaleidoscope-scheme); this doc is the *long-form, troubleshooting* version.

---

## 0. Before you start

**Verify the scheme's license permits redistribution.** Check the scheme's original readme. Mass:werk's schemes are explicit: "freeware, redistribute as long as with this readme file." When a scheme lacks an explicit license, study it privately but **do not port until rights are confirmed**. Aaron UI's clean-room boundary is from Kaleidoscope's source code; the assets we ship come *only* from schemes whose authors granted redistribution.

**Tools you need:**

- `unar` (Homebrew: `brew install unar`) — unpacks `.sit` / `.bin` / `.hqx` archives without losing resource forks
- Node.js 20+ (the extractor reads the raw resource fork directly — pure ES modules, no native deps)
- This repo cloned with `npm install` run inside it

You do **not** need `DeRez` or any macOS-only tooling. The extractor (`scripts/extract-scheme.mjs`) parses the binary resource fork itself via `tools/theme-loader/resource-fork.js`. All you have to supply is the raw resource fork as `scheme.rsrc`.

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

## 2. Extract the resource fork as `scheme.rsrc`

The extractor wants the **raw resource fork** bytes — not a DeRez `.r` text dump. On macOS the resource fork lives in the file's `..namedfork/rsrc` stream; copy it out:

```sh
# From the scheme directory unar created — copy the resource fork to scheme.rsrc:
mkdir -p ../../../themes/<your-slug>
cp "your-scheme-file/..namedfork/rsrc" ../../../themes/<your-slug>/scheme.rsrc

# Quick sanity check — a real scheme fork is hundreds of KB.
ls -l ../../../themes/<your-slug>/scheme.rsrc
```

If the copied file is tiny (a few hundred bytes or empty), the resource fork was stripped during transit — usually because the archive passed through a non-Mac filesystem. Re-download the `.sit` and `unar` it again. (Some `unar` builds emit the fork as a sibling `._name` AppleDouble file or a `rsrc` data file; whichever carries the resource-fork bytes is what you copy to `scheme.rsrc`.)

---

## 3. Run the extractor

With `themes/<your-slug>/scheme.rsrc` in place (and, ideally, a `meta.json`
beside it — see step 4; the extractor auto-reads it if present), run from the
repo root:

```sh
node scripts/extract-scheme.mjs <your-slug>
```

It parses the resource fork directly (`tools/theme-loader/resource-fork.js`),
decodes the `cicn` / `ppat` / `cinf` / `wnd#` / `clut` resources via the live
decoders in `tools/theme-loader/decoders/`, and writes everything **in place**
under `themes/<your-slug>/`:

- `cicns/cicn-n<id>-<slug>.png` — one PNG per chrome cicn
- `ppats/ppat-n<id>-<slug>.png` — one PNG per tile pattern
- `extraction-manifest.json` — diagnostic record of every decoded resource
- `theme.json` — the schema-validated Aaron UI bundle manifest (header text
  colours decoded from the `-14335`/`-14336` cluts are folded in automatically)

There is no separate "build the bundle" step — `extract-scheme.mjs` builds and
validates `theme.json` in the same pass (it calls `buildThemeJson` +
`validateTheme` internally). If validation fails it aborts non-zero and names
the offending field; fix and re-run.

Spot-check a few PNGs in your image viewer to confirm they look like the chrome you'd expect. Especially the document-window cicn (`cicn-n14335-…`) — it should look like the window border + titlebar of the scheme.

---

## 3.5 Extract the icon glyphs (REQUIRED — easy to forget)

`extract-scheme.mjs` decodes the window **chrome** (cicn/ppat/wnd#/cinf/clut). The
scheme's **icon glyphs** — the scroll-arrow / checkbox / radio / window-widget
pictograms and the Finder scene icons — are a **separate** extractor that you must
also run:

```sh
node scripts/extract-icons.mjs <your-slug>
```

It writes `themes/<your-slug>/icons/*.png` + `icons/index.json`. The runtime's glyph
map (`loadTheme` → `theme.glyphs`) and the renderer's checkbox/radio/widget stamping
read from here — so **skipping this step makes the scheme fall back to procedural
controls instead of its own glyphs.** (The corner-sprite Platinum-family schemes lean
on this heavily; see [`docs/spec/...`] and the `reference_corner_sprite_frame` note.)

It decodes **both** 4-bit (`ics4`/`icl4`, the exact 16-colour palette) **and** 8-bit
(`ics8`/`icl8`, the Apple 256-colour system palette), preferring 4-bit where a scheme
ships both. Some schemes ship **only 8-bit** (e.g. Black Platinum, 1990) — the
extractor handles them; a 4-bit-only decoder silently produced **zero** glyphs for
those, which is the gap this step closes.

**Completeness guard.** A clean run prints per-type counts and the "shipped" tally:

```
[black-platinum] 140 icons → icons/  (icl4=0, ics4=0, icl8=46, ics8=94; shipped ics4=0/ics8=94/icl4=0/icl8=46)
```

If a scheme ships icon resources but the extractor yields **0** glyphs, it exits
non-zero with `⚠ MISSED` — treat that as a hard failure (corrupt data, or a depth/
format we don't decode). "Shipped" counts higher than extracted is normal: the extra
are 4-bit/8-bit duplicates the dedup dropped.

Both extractors run together in `npm run build:themes` (`extract-scheme --all` +
`extract-icons --all`), so a full rebuild always captures glyphs — but for a
single-scheme port, run `extract-icons` explicitly as shown.

---

## 4. Author the provenance sidecars

Two hand-authored files live alongside the bundle. They carry everything the binary scheme doesn't (name, author, license, source). Author them **before** step 3 so the extractor folds `meta.json` into `theme.json` on the first pass — but you can also add them after and re-run the extractor.

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
    "sourceUrl": "https://macintoshgarden.org/apps/your-scheme"
  }
}
```

See `themes/beos-r503/meta.json` for a real one. The `originalLicense` field is **verbatim from the readme**, not paraphrased — it preserves the porter's interpretation context for future auditors.

You do **not** hand-author a colour palette. Header text colours come from the `-14335`/`-14336` window cluts, decoded automatically into `theme.json.headerColors`; scheme-global flags come from `Colr`. (`buildThemeJson` still accepts an optional `meta.palette` block as an override, but no current corpus scheme uses it — leave it out unless you have a specific reason.)

### 4b. `themes/<your-slug>/PROVENANCE.md`

Markdown companion to `meta.json` — the same factual content, formatted for humans, so it renders on GitHub. Copy `themes/beos-r503/PROVENANCE.md` (or any current corpus bundle's) as the template and adapt it.

Include a "Why this is in the corpus" note explaining what makes this scheme worth porting (stylistic distinctiveness, historical significance, faithful Platinum reproduction, etc.). Be honest; don't fabricate provenance. If `PROVENANCE.md` and `meta.json` ever drift, `PROVENANCE.md` is authoritative and `meta.json` should be corrected to match.

After authoring both, (re-)run the extractor so `meta.json` is merged into `theme.json`:

```sh
node scripts/extract-scheme.mjs <your-slug>
```

---

## 5. Smoke-test it locally

```sh
npm run dev
```

In your browser, open the demo (`http://localhost:5173/`). To load your scheme, use the JS console:

```js
await loadTheme('themes/<your-slug>/');
```

(or set `<html data-aaron-theme="themes/<your-slug>/">` and reload, if the demo wires that up).

You should see:

- The window's chrome bitmap render with your scheme's titlebar
- `wnd#`-derived hit overlays for close / zoom / windowshade in the titlebar
- The header text drawn in the scheme's authored title colour (from the clut)

If the chrome looks off (stretched wrong, missing borders), inspect the
recipe: the compositor walks `theme.json.windowTypes["document-window"].edges`
(the `(partCode, border)` side lists) per the
[compositor spec](./spec/compositor-spec.md). A part code mislabelled by the
decoder, or a window cinf the scheme didn't ship, is the usual cause.

For a faster non-browser check, render the document window straight to a PNG:

```sh
npm run diag:render            # renders every corpus window type to themes/<slug>/diag/
npm run diag:audit             # placement audit vs. the reference images
```

---

## 6. Side-by-side fidelity check

Put a reference preview at `demo/assets/references/<your-slug>.png` (the corpus
uses PNGs — `1138.png`, `beos-r503.png`, …). The demo and the `diag:audit` pass
compare Aaron UI's render against it.

If the scheme shipped a thumbnail (often `Scheme Settings.jpg` or similar in the
original archive), convert it to PNG and use that. Otherwise take a screenshot of
Kaleidoscope's own "Scheme Settings" preview running under SheepShaver (or use a
period screenshot from Macintosh Garden) and crop it to the relevant window.

---

## 7. Open the PR

```sh
git checkout -b port/<your-slug>
git add themes/<your-slug>/ demo/assets/references/<your-slug>.png
git commit -m "themes: port <Your Scheme Name> by <Author>"
git push -u origin port/<your-slug>
```

The whole bundle (PNGs, `theme.json`, `meta.json`, `PROVENANCE.md`,
`extraction-manifest.json`, and the source `scheme.rsrc`) lives under
`themes/<your-slug>/` and is committed together. To pick the new bundle up in
the all-themes re-extract, no registry edit is needed — `npm run build:themes`
runs `extract-scheme.mjs --all`, which discovers every `themes/*/scheme.rsrc`.

PR body checklist:

- [ ] License: quote the verbatim license string from the readme
- [ ] Author: name + email/URL preserved in `meta.json` and `PROVENANCE.md`
- [ ] Side-by-side screenshot: Aaron UI render next to the scheme's preview thumbnail
- [ ] Smoke tested locally: window renders (browser or `npm run diag:render`)
- [ ] `node scripts/extract-scheme.mjs <your-slug>` validates clean

---

## Common pitfalls

### "The chrome cicn body is white but the reference shows gray"

This is the ppat-overlay case (LEARNINGS 2026-05-16). Some schemes have white cicn body pixels but Kaleidoscope overlaid a `ppat` tile on the body region at draw time. Aaron UI's runtime supports this via `cinf.bgPatternId`, but the extractor currently emits `bgPatternId: 0` for every cinf because the geometry decoder doesn't read the field yet. This is a known gap — track via the Phase 4 follow-ons or open a new issue. Workaround for now: accept the visual difference; document in your PROVENANCE.md.

### "The wnd# parts are positioned wrong / not where the close box appears in the cicn"

Part IDs are scheme-relative (LEARNINGS 2026-05-17 "wnd# part IDs are scheme-relative integers"). The integer-to-semantic-role mapping isn't standardized — every scheme decides which part is the close box. The runtime doesn't try to auto-classify; it just positions overlays at the rect coordinates wnd# specifies. If you're hooking up listeners (close on part-1 click, etc.), inspect your scheme's wnd# data first to find the right indices.

### "The frame stretches wrong / a baked ornament smears as the window widens"

The v3 compositor doesn't border-image-stretch the whole bitmap. It walks the
`wnd#` side recipe and classifies each `(partCode, border)` cell as fixed,
stretch, tile, or scale (see [`compositor-spec.md`](./spec/compositor-spec.md)
§ Part-code classification). A smeared ornament usually means the cell carrying
it is being classified as stretch when it should be fixed — i.e. a part-code
mismatch between `theme.json` and what the kDEF expects. The
[2.3.1 recipe-walk decode](./spec/kdef231-recipe-walk.md) (see its
"honest discrepancy" notes on evolution/beos) covers the known cases where the
decoder's part numbering may not match the engine's. Document anything new in
PROVENANCE.md and open an issue.

### "I lost the resource fork during extraction"

Symptom: the copied `scheme.rsrc` is near-empty (a few hundred bytes), or
`extract-scheme.mjs` parses zero `cicn`/`wnd#` resources. The resource fork was
stripped — usually by extracting through Linux/Windows, or by some archive
tools. Re-download the `.sit` and use `unar` on the original, then re-copy the
`..namedfork/rsrc` stream (step 2).

---

## What you don't need to do

- **Don't hand-edit `theme.json`** — it's generated. Edit `meta.json` and re-run `extract-scheme.mjs`. Hand edits get clobbered on the next extract.
- **Don't author CSS, SVG, or any chrome assets from scratch.** The 2026-05-17 Kaleidoscope-runtime pivot establishes that Aaron UI doesn't hand-author chrome — it renders what Kaleidoscope schemes provide. If you want new chrome, use Kaleidoscope's own authoring tools (ResEdit + Kaleidoscope SDK under SheepShaver) to produce a `.ksc` and port it through this flow.
- **Don't worry about sounds or desktop backgrounds.** Kaleidoscope schemes in practice didn't carry them; Aaron UI doesn't fabricate them. The `chromeElements`, `windowTypes`, `patterns`, and `headerColors` sections are the full bundle surface.

---

## Resources

- [Kaleidoscope on Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) — ~4,010 schemes
- [Mac Themes Garden](https://macthemes.garden/) — searchable thumbnail index
- [mass:werk schemes](https://www.masswerk.at/schemes.php) — Norbert Landsteiner's freeware schemes
- [SheepShaver](https://www.emaculation.com/doku.php/sheepshaver) — for authoring new schemes under emulated classic Mac OS

For the resource-fork format itself, the decoders under `tools/theme-loader/` are the reference. For how a loaded scheme is drawn, see [`docs/spec/compositor-spec.md`](./spec/compositor-spec.md) + [`docs/spec/kdef231-recipe-walk.md`](./spec/kdef231-recipe-walk.md).
