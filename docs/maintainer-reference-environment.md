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

Follow the [reference intake contract](../tests/reference-captures/README.md) for exact source/scheme bytes, public invocation, geometry/state, actual Copl/FCB and stopped-fork identity, device/palette/producer conditions, durable export counts, raw pixels/crops and independent review. Preserve failed attempts. Capture completion alone does not admit evidence or authorize a golden update. Display calibration and decoder coverage must independently support any comparison; unknown provider/cache, mask, phase, font and whole-control obligations stay visible.

## Preserve the assets

The store follows Newsheep's hash-verified, at-most-90-MiB LFS parts to fit the Cloudflare-proxied HTTPS upload limit. Keep instructions/manifests in ordinary Git and binary parts in LFS. Use `assets.py store --help` and record each asset's origin, purpose and restoration limits before pushing.

Forgejo's weekly dumps currently exclude LFS data. Keep an independent durable local copy; the server must not be the only copy. The maintainer's initial core snapshot lives at `~/Documents/Scriptoscope-maintainer-assets/recovery-2026-10-19`, outside `/tmp`. No server backup or clean-machine restore guarantee is implied.
