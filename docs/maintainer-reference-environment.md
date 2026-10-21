# Maintainer original-reference environment

The private [Scriptoscope asset repository](https://git-home.allaboutken.com/khawkins98/scriptoscope-assets) preserves the recovered **System 7.5.5 + Kaleidoscope 2.3.1 + Basilisk II** reference environment, native fixtures and capture provenance. Maintainers with Forgejo access can reuse it rather than rebuilding the environment. Access follows the server's existing German-routed connection policy; use an authorized account and its configured Git credentials.

This is optional maintainer infrastructure. Public builds, tests, CI, the published package and consumers do not download it or require its credentials. Keep original system, ROM, engine and private research bytes outside this public repository. Only reviewed distributable evidence belongs in the [public reference corpus](../tests/reference-captures/ORIGINALS.md).

## What is retained

The initial asset commit is `c37c7eb939fe0f199fa9e39029443241fdfded9f` (2026-10-19). Its ten assets total 286,394,485 bytes across twelve Git LFS parts. The private `manifest.json` records whole-file and part SHA-256 identities; each asset folder has its own usage/provenance README.

| Assets | Purpose |
| --- | --- |
| `original-*` | Original System 7.5.5 disk, Quadra ROM, Kaleidoscope installer and Basilisk II JS/WASM inputs |
| `seed-system755-after-v16l`, `seed-transfer-v16l` | Known-working copied Lisa-reference system/transfer seeds; copy before use |
| `capture-toolkit-20261019` | Native fixture, compiler/HFS tools, web wrappers and recovery inventory |
| `web-dependencies-darwin-arm64-20261019` | Exact retained macOS ARM JS dependency tree; observed installed versions/hidden lock are also in plain Git metadata |
| `reviewed-four-state-acquisition-20261019` | Successful Crayon/Lisa acquisition history supporting PR #350; optional for operating the environment |

Failed or unfinished attempts are not known-working seeds. The initial store is not a complete archive of every historical acquisition.

## Fetch and verify

Use Git LFS and a fresh local destination. The existing macOS Git credential helper can supply authorized Forgejo credentials; do not put tokens in commands, this repository or public CI.

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone https://khawkins98@git-home.allaboutken.com/khawkins98/scriptoscope-assets.git
cd scriptoscope-assets
GIT_LFS_SKIP_SMUDGE=1 git checkout c37c7eb939fe0f199fa9e39029443241fdfded9f
git lfs install --local
git config lfs.concurrenttransfers 2
git config lfs.transfer.maxretries 10
git config lfs.transfer.maxretrydelay 30

# Download the environment assets; omit the larger historical acquisition archive.
git lfs pull --include='parts/original-*/**,parts/seed-*/**,parts/capture-toolkit-20261019/**,parts/web-dependencies-darwin-arm64-20261019/**' --exclude=''
mkdir restore
python3 assets.py fetch capture-toolkit-20261019 --out restore/toolkit.tar.gz
tar -xzf restore/toolkit.tar.gz -C restore
python3 assets.py fetch web-dependencies-darwin-arm64-20261019 --out restore/dependencies.tar.gz
tar -xzf restore/dependencies.tar.gz -C restore/capture-toolkit
python3 assets.py fetch seed-system755-after-v16l --out restore/system755-seed.dsk
python3 assets.py fetch seed-transfer-v16l --out restore/transfer-seed.dsk
```

Fetch the required `original-*` assets in the same way, using their filenames and instructions in the private manifest/READMEs. To fetch one additional asset, first run `git lfs pull --include='parts/ASSET-NAME/**' --exclude=''`, then `python3 assets.py fetch ASSET-NAME --out FRESH-OUTPUT-PATH`. `fetch` verifies each part and the reconstructed whole-file hash, then replaces the output path; use a fresh path to preserve existing files. `assets.py verify ASSET-NAME` checks locally downloaded parts. A full `git lfs pull` followed by `assets.py verify` checks all stored parts.

## Restore and acquisition boundaries

The initial upload passed a fresh-clone round trip for all ten assets. That proves storage identity, **not a clean-machine boot or portable restore**. The scripts retain historical absolute paths; configure those paths in an isolated workspace. The dependency snapshot is darwin-arm64-specific, not an original portable npm-ci manifest. Browser binaries and the agent-browser CLI are separate host prerequisites. The private toolkit's inventory and READMEs describe the preserved layout.

Keep seeds immutable and run only fresh copies. Serialize HFS mounts and emulator runs; never mount a disk while its emulator is running. Select a scheme through the ordinary native UI before launching the fixture: an Animals attempt failed when switching schemes with the fixture running; the ordering recovery completed cleanly. This observation does not establish the crash's cause.

Plan the shared work and consolidated preboot review using the [fidelity batch workflow](../CONTRIBUTING.md#fidelity-acquisition-and-implementation-batches). Follow the [reference intake contract](../tests/reference-captures/README.md) for exact source/scheme bytes, public invocation, geometry/state, actual Copl/FCB and stopped-fork identity, device/palette/producer conditions, durable export counts, raw pixels/crops and independent review. Preserve failed attempts. Capture completion alone does not admit evidence or authorize a golden update. Display calibration and decoder coverage must independently support any comparison; unknown provider/cache, mask, phase, font and whole-control obligations stay visible.

## Direct 32 bpp condition

The reference boots at 8 bpp, where every comparison needs a per-scheme finite palette calibration (thousands of Color2Index/Index2Color rows). A 32 bpp condition can avoid that for plain-cicn work. Setting `displaycolordepth 32` had no effect in this Basilisk II JS/WASM build: the whole first-attempt frame stayed on the 8-bit palette. An unreviewed disassembly suggests the preference is never read. Instead, a small guest helper, `SetDepth32`, calls `SetDepth(mainDevice, 32, 0, 0)` guarded by `HasDepth`. Its source makes no palette, gamma, file or preference calls; SetDepth's own system side effects (Display Manager, PRAM/`scrn`) were not inspected. Run it from fresh media, select the scheme through the ordinary UI, then launch the fixture. The depth does not persist across a Finder Restart. Pins: source `0002d5b71f2ccd433bf1f03fbcd1493d6fb14c33fa7406e760f7069419f9a7b9`; SIZE-packaged binary `SetDepth32-with-size.bin` `0de056c18059c06dbaa81bd51e695545091e96bb755134a85809f9cc8a4fd936`, built with the preserved wasm-cc1 and not independently reviewed. The helper and receipts are in the durable local mirror under `campaign-20261021/lanes/C/` and have not yet been uploaded to the private store.

On 2026-10-21 an independently reviewed trial (accepted with limits) found that the Floppies empty push faces in all three states were exactly the cicn RGB16 high bytes laid out by the same-ID cinf rule: 1,600/1,600 pixels per state, with no calibration. Scriptoscope differed only by its default 1.8 → 2.2 display gamma. Limits:

- One boot, one scheme, one 80×20 geometry with exact tiling: no partial tiles, side bands, body pattern, overlap, label, default ring or window chrome.
- The device gamma table is not applied to these framebuffer bytes, so what a historical display showed remains unknown.
- Truncation versus rounding is unsettled because those colours are byte-doubled.
- Kaleidoscope initialised at 8 bpp; whether its cached state is fully refreshed by a later depth change is unknown.

**This trial is not admitted evidence.** No ledger row, golden or display-policy change follows from it.

Treat this as its own named condition. Record depth/pixelType/rowBytes and exact RGBWK sentinels around every draw, and erase between states so masked holes cannot retain earlier pixels.

### Later 32 bpp boots (2026-10-21, reviewed with limits)

Private receipts are in asset `lane-c-direct32-campaign-20261021` (store commit `6b964dd`, archive `b41cfce7…`), with the independent review in `lanes/C/REVIEW-batches2-4.json`. None of this is admitted evidence.

- **Floppies, depth switch then scheme (1 boot).** 18 empty push faces were drawn in one window: 80×20, 57×31, 101×45, 24×7, 24×9 and 9×9, each at hilite 0/10/255. 25,128 of 25,131 pixels equal the frozen, source-independent prediction, covering partial final tiles, corner clamping and draw order. The other 3 pixels are explained post hoc by the fixture's own draw sequence. Body fill, rounding versus truncation and pattern alignment were **not** exercised: the Floppies body colour equals the erase colour, and its colours are byte-doubled. Against main, the default output equals the display-gamma table applied to the native bytes. An analysis-only identity-gamma alias equals the native bytes on the 15 sizes main can compose.
- **Animals** hung after the 8 → 32 switch in 3 of 3 boots (sound on, one at 128 MB RAM). **Crayon OS** hung in 2 of 2: one with sound on, one with sound off, and the two final frames are byte-identical. Emulator audio is therefore not needed for that hang.
- **Selecting Crayon OS at 8 bpp and then switching** brought up a guest system error in 1 boot. The error was already showing at the first capture after the helper launched, so the depth call itself is not shown to be the cause.
- **Every scheme shows an about box (`DLOG`/`DITL -14320` picture) on selection,** Floppies included. The two schemes that hung use a 32-bit about-box picture; Floppies uses an 8-bit one. This is an association across two schemes against one, not a demonstrated cause. A static survey (`lanes/C/survey/SPLASH-SURVEY.md`) found 32-bit about-box pictures in eight schemes (1138, 1984, 1990, Animals, Crayon OS, Dolphin, Evolution, Monkey Paradise). Ten schemes use an 8-bit picture or none; all are untested except Floppies.
- **Host page stalls.** With sound on, opening the Kaleidoscope control panel at 8 bpp was followed by host loss in 2 of 2 boots. With `nosound true` (the wasm build reads it), the same step completed in 1 boot. That is consistent with an audio-message cause, but message rates were never measured with sound on. Four host losses have occurred in total and their trigger is not established; one followed the guest system error with no audio messages. Prefer `nosound true` for native work.
- **The Kaleidoscope 2.3.1 control panel has no splash toggle.** Never strip about-box resources from a scheme: that changes the original archive bytes.


## Preserve the assets

The store follows Newsheep's hash-verified, at-most-90-MiB LFS parts to fit the Cloudflare-proxied HTTPS upload limit. Keep instructions/manifests in ordinary Git and binary parts in LFS. Use `assets.py store --help` and record each asset's origin, purpose and restoration limits before pushing.

Forgejo's weekly dumps currently exclude LFS data. Keep an independent durable local copy; the server must not be the only copy. The maintainer's initial core snapshot lives at `~/Documents/Scriptoscope-maintainer-assets/recovery-2026-10-19`, outside `/tmp`. No server backup or clean-machine restore guarantee is implied.
