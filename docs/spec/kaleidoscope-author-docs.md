# Kaleidoscope author-documentation archive index

The first-party "Creating Schemes" documentation Greg Landweber + Arlo Rose
shipped inside Kaleidoscope 1.x and 2.x is locked inside resource-fork-bearing
`.sit` archives. The application binaries themselves carry the docs as STR# /
TEXT / PICT resources in their `'KbDF'` / `'kDEF'` / installer payloads;
extracting requires either a Mac OS Classic emulator (SheepShaver / Basilisk
II) or running the installer on legacy hardware.

What we HAVE locally:
- `~/Downloads/kaleidoscope182US.sit` (661 KB) — Kaleidoscope 1.8.2 installer
- `~/Downloads/Kaleidoscope231US.bin` (1.81 MB MacBinary) — Kaleidoscope 2.3.1 installer
- `/tmp/kaleido-trace/extracted/k182-installer-rsrc/` — 1.8.2 installer's own resource fork (186 KB, STR# / PICT / DLOG / CODE)
- `/tmp/kaleido-trace/extracted/k231-installer-rsrc/` — 2.3.1 installer's own resource fork (220 KB)

The installer resource forks contain installer chrome (DLOG / DITL / ALRT /
INIT / CODE), NOT the kDEF or the Creating-Schemes docs. To recover those:
SheepShaver path + StuffIt Expander + running the installer remains the
gating step.

## What the surviving public web has

When the upstream `.sit` docs aren't accessible, **the community wrappers
around them survive on the Wayback Machine** and quote the docs verbatim.

### Authoritative archive URLs

| Source | URL | Why |
|---|---|---|
| **kupan787's "Kaleidoscope 2.0 FAQ"** | https://web.archive.org/web/20021213161947/http://members.aol.com/kupan787/kaleidoscope/FAQ1.htm | Greg Landweber + Arlo Rose Q&A quoting the bundled K2 docs verbatim |
| **"Not Compleat Kaleidoscope Companion"** (mollusc@oz.net) | https://web.archive.org/web/20021213002557/http://www.oz.net/~mollusc/k_shack/companion/index.html | The authoritative Finder icon-id table (icl/ics/icm/cicn) with patched-or-not status |
| Companion · large icons | …`/IconsAppearanceManager_icl.html` | Apple Finder folder/document/volume icon ids |
| Companion · small icons | …`/IconsAppearanceManager_ics.html` | The `-3790 = snap-to-grid` finding lives here |
| Companion · other cicns | …`/Icons_cicns.html` | Alert pictograms (stop / caution / note), disclosure triangles |
| Companion · duplicates | …`/IconsDuplicate_icl.html` | System 7 vs OS 8 differences |
| Lloyd Wood's "Kaleidoscope Way" | https://web.archive.org/web/20211025170525/http://personal.ee.surrey.ac.uk/Personal/L.Wood/kaleidoscope/way/ | Hub linking everything |
| Calyxa's button-ring tutorial | https://web.archive.org/web/20120409123319/http://calyxa.best.vwh.net/kaleido/buttonring/ | Confirms `cicn -10231` = default button ring mask |
| Scheme Factory tutorial | https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/tutorial/ | Window-walkthrough enumerates every wnd# part |
| Scheme Factory PR2 (the editor binary) | https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/SchemeFactoryPR2.sea.hqx | The editor itself; UI palette names every window-part type |
| Apple Appearance Manager SDK 1.0.3 | https://web.archive.org/web/20020312171604/ftp://dev.apple.com/devworld/Development_Kits/Appearance_SDK_1.0.3_v1.0.1.sit.hqx | Parent spec — defines every `wnd#`-equivalent role peg |

### Upstream `.sit` archives to pull

| File | Source | Estimated contents |
|---|---|---|
| `Kaleidoscope231US.bin` | https://macintoshgarden.org/sites/macintoshgarden.org/files/apps/Kaleidoscope231US.bin (1.81 MB) | 2.3.1 installer + Creating-Schemes folder + Kaleidoscope Goodies |
| `Kaleidoscope231US.sit` | https://www.macintoshrepository.org/1706-kaleidoscope | mirror — same payload |
| `Scheme-Factory-1-0pr2.sit` | https://www.macintoshrepository.org/11058-scheme-factory-kaleidoscope-editor- | The official scheme editor's resource fork enumerates every scheme slot |

To unpack with resource forks intact, use `unar` (`brew install unar`):

```sh
unar -o /tmp/kaleido-trace/extracted -f ~/Downloads/Kaleidoscope231US.bin
```

Then run the installer in SheepShaver / Basilisk II to extract the kDEF
extension + Creating-Schemes folder.

## Cross-reference — id table from the public docs

The FAQ + Companion together confirm (via direct citation):

| id | role | source |
|---|---|---|
| `-3790` | **snap-to-grid badge** (Finder window header) | Companion `IconsAppearanceManager_ics.html` |
| `-3789` | Arrange By… badge (Finder header) | Companion |
| `-3995` | hard disk | Companion `IconsAppearanceManager_icl.html` |
| `-3999` | generic folder | Companion |
| `-3983` | System Folder | Companion |
| `-3993` | trash | Companion |
| `-9548..-9552` | Finder list / icon view + sort column + separator + desktop label | FAQ verbatim quote of K2 bundled docs |
| `-9776..-9773` | dialog and alert background patterns (cicns) | FAQ |
| `-10231` | default button ring | Calyxa tutorial |
| `-14302/-14301` | normal disabled / enabled grow box | FAQ |
| `-14286/-14285` | small disabled / enabled grow box | FAQ |
| `-14328` | inactive moveable modal dialog | FAQ |
| `-14322` | inactive dialog | FAQ |
| `-14336/-14335` (clut) | active / inactive title-bar divider colours | FAQ |

For ids the public docs are silent on (`-9567`, `-9568`, etc.), the **bundles
themselves are now the spec** — see `docs/spec/corpus-corroborated-ids.md`
where author labels from 17 of 18 bundles cross-corroborate every important
id. 1138 alone documents 442 NAMED resource labels.

## Application

When wondering "what is id X?":

1. Check `docs/spec/corpus-corroborated-ids.md` (corpus author labels, n-bundle corroborated).
2. Check the public-docs id table above (Companion + FAQ).
3. Check `docs/spec/apple-primary-source.md` for the Apple role peg.
4. If still ambiguous, run `node scripts/probe-reference-slot.mjs` to pixel-match against the bundle's reference image.

The order is intentional: the corpus is the most-authoritative because it's
the bundle authors documenting their own work; the public docs are second
because they were written by community archaeologists from the period; Apple's
docs are the role-peg context.
