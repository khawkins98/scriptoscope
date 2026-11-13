> Experiment record: retain the inputs, measurements and limitations at their recorded revisions. These results are not general speed guarantees. For a new optimization task, start with [measured simplification](measured-simplification.md).

# Runtime optimization experiments

Use [measured simplification](measured-simplification.md): identify code or work that can disappear, charge every replacement, then verify behavior and complete public-operation cost. A negative result applies to its inspected scope, not every possible implementation.

## Landed results

| Change | Evidence and limit |
| --- | --- |
| [#493](https://github.com/khawkins98/scriptoscope/pull/493): shared raster executor | Consolidated duplicate CPU mechanisms. Reported −161 noncomment production lines and −2,057 emitted JS bytes under that study’s census. No speed claim. |
| [#494](https://github.com/khawkins98/scriptoscope/pull/494): prepared header coverage arithmetic | Synthetic warm public-header time fell 20–47%; +7 production lines, +117 emitted JS bytes. Generic fractional/masked counting remains. |
| [#495](https://github.com/khawkins98/scriptoscope/pull/495): prepared header pattern spans | Synthetic warm header calls improved by size; +23 production lines, +695 emitted JS bytes. |
| [#496](https://github.com/khawkins98/scriptoscope/pull/496): prepared push pattern spans | Synthetic warm opaque-pattern calls took 36–84% less time; +59 production lines, +1,923 emitted JS bytes. Prototype hooks and cloned shared-storage aliases required fixes before landing. |
| [#497](https://github.com/khawkins98/scriptoscope/pull/497): omit no-rect final push scan | 18 synthetic warm public workloads took 8–61% less time; +2 production lines, +38 emitted JS bytes. Narrow allocator-read timing change is documented in [push allocator compatibility](push-allocator-compatibility.md). |
| [#663](https://github.com/khawkins98/scriptoscope/pull/663): StuffIt decoder requested alongside a named `.sit`; byte lookup tables for indexed `cicn`/`ppat` decode | **Decode.** Node 24, resource fork to raw theme without PNG encoding, all 18 themes, old and new interleaved, three 40-round runs: the paired new/old time ratio had medians 0.73, 0.67 and 0.65; fastest rounds fell from 652 to 371 ms, from 513 to 332 ms and from 262 to 174 ms (host load differed between runs). Themes with little indexed art did not change. Scope: genuine `Uint8Array` rasters only; other index containers, non-byte output, fractional sizes and short rasters keep the keyed path. Narrowing: the byte path copies each realized colour once per palette index, so a realizer that reuses or mutates its returned array, or returns a one-shot iterable, yields different pixels than before. **Prewarm.** Cold Chromium `loadTheme` with `source: 'scheme.sit'` under DevTools throttling saved 157–165 ms at 150 ms latency and 410–413 ms at 400 ms latency: about one request latency, because the decoder still shares a bandwidth-capped link with the archive. Scope: only a `source` whose path ends in `.sit`; the default cascade is unchanged and gains nothing. A named `.sit` that is missing or holds a raw fork still requests the decoder, and a WASM instantiation failure (two `console.error` lines, cached) can now occur at request time. **Limits.** All timing came from one heavily loaded host. Not measured: other browsers, real networks, a separately served `munbox.wasm`, PNG encoding, memory. |

Performance ranges describe the measured fixtures and hosts, not whole applications, cold starts, all browsers, memory, or historical-program fidelity. Counts from different studies need their stated scopes; source-line savings and execution savings are separate scores. The #497 verifier remained runtime-source blind, but accidentally saw author timing summaries during measurement; its fixed harness and analysis were unchanged and all samples retained.

## Decode long tasks: stage yielding chosen over a decode worker (#662)

Baseline `e4250ef9` (after #663 and #664). Headless Chromium from Playwright 1.64 on
one Apple-silicon Mac whose load average moved between 4 and 38 during the work;
built demo served by `vite preview`; one fresh browser process per run; variants
interleaved round by round. Ranges are min–max over the stated runs. DevTools CPU
throttling slows the main thread but not workers.

**What was measured first.** An owned decode plus the first render of its window is
one task, because nothing between the archive response and the window paint crosses
a task boundary. On the landing page (five owned themes) that is five long tasks
during load. Unthrottled on a quiet host there were none over 50 ms in 5 of 5 runs;
on a loaded host, 1–5 of 54–178 ms. At 4× CPU throttle: 3–6 tasks, the longest
108–689 ms, total blocking time 189–207 ms (quiet) to 219–904 ms (loaded). A CPU
profile of the landing load and one cached switch attributes main-thread time to: browser-internal work
25–42%, window render and preparation 15–20%, StuffIt WASM 11–19%, chrome
conversion 10–16%, icon conversion 5–9%, manifest and inspector build 2–3%,
resource-fork parse 1%. Decode stages together are 29–49%. A theme switch on an
idle page costs one decode task and two render tasks; the click itself paints
within 16–56 ms because the work follows the archive response. Switching to a
cached theme decodes nothing and still costs one task of 53–109 ms at 4×.

Eager loads (`loadTheme`, `createThemeResolver`) are a different problem: five
themes were ready in 0.6–1.5 s against 0.13–0.28 s owned, with the main thread busy
throughout, but in many short tasks. Exporting every asset (240–870 per theme) as a PNG blob URL dominates: the
export script is 25–28% of main-thread time and browser-internal work 44–45%,
against about 16% for decode. A throwaway pure-JS uncompressed PNG encoder through
`assetUrlFactory` was only 16–30% faster and made the blobs 4.7–7.1 times larger:
the cost is per asset, not compression. The owned loaders avoid
it by exporting on request. No eager change is proposed.

**Candidates.** The draft decode worker (#665) and stage yielding were built and
measured against the same baseline in the same sessions. Caching decoded themes
across page loads was rejected without a prototype: it adds a second, versioned
copy of data the original archive is authoritative for, cannot cover loads that
pass function-bearing options, and saves at most the 4–42 ms a warm decode costs.
A StuffIt rebuild was not attempted (no Emscripten toolchain on the host).

| Landing page load, 12 runs per variant | Baseline | `yieldBetweenStages` | Decode worker (#665) |
| --- | ---: | ---: | ---: |
| Total blocking time, unthrottled | 0–119 ms | 0–62 ms | 0–43 ms |
| Total blocking time, 4× | 166–525 ms | 4–277 ms | 0–75 ms |
| Total blocking time, 4×, quieter session only (6 runs) | 166–379 ms | 4–58 ms | 2–48 ms |
| Total blocking time, 6× | 420–813 ms | 93–485 ms | 19–74 ms |
| Longest task, 4× | 104–331 ms | 52–183 ms | 0–103 ms |
| Longest task, 6× | 165–267 ms | 76–153 ms | 69–98 ms |
| Time to all five windows, 4× | 621–1110 ms | 615–1265 ms | 325–658 ms |

All three columns come from the same two sessions, variants interleaved round by
round, with host load average between 4 and 10. At 4× yielding had lower blocking
time than the baseline in 12 of 12 paired rounds and a shorter longest task in 11
of 12; at 6×, 12 of 12 for both. The worker was lower in 12 of 12 for all four.
Unthrottled, neither differs from the baseline beyond noise. On a five-theme owned
harness without the landing page's own work, 4×, 5 runs on a loaded host: baseline
197–728 ms, yielding 9–395 ms, worker 13–104 ms.

Each boundary is one `MessageChannel` message. An earlier build preferred
`scheduler.yield()`; review showed that it inherits the calling task's priority
and abort signal, so a load started from `requestIdleCallback` or a
background-priority `postTask` stalled at its first boundary for as long as
normal-priority work kept arriving (the whole 3 s busy period in the repro, in
Chromium and Firefox), and aborting the caller's task signal rejected the load.
With the message task the same repro completes in 198–210 ms in Chromium and
102–133 ms in Firefox (132–152 ms and 93–116 ms without the option), and the
abort case resolves in both. Every figure in this section was re-measured on the
message-task build. Frame timing was checked in three engines, unthrottled: the
longest gap between animation frames during one owned decode fell from 39–66 ms
to 17–38 ms in Chromium, 40–67 ms to 19–32 ms in Firefox and 36–63 ms to 18–38 ms
in WebKit, with total decode time unchanged.

**Decision.** `yieldBetweenStages` is proposed; the worker stays a draft. Yielding
removes most of the blocking the worker removes at 4× and roughly half to
three-quarters at 6×, for +51 production lines (61 added, 10 removed, comments
included) and +992 raw / +273 gzip bytes in the shared loader chunk, with no new
file. The worker costs about +590 production lines (704 added, 117 removed),
+11,002 raw / +3,256 gzip bytes in the same chunk for every consumer, and a
separate 191,998-byte (70,411 gzip) worker file for those who opt in.

**What yielding does not do.** It does not reduce main-thread work: time to the
last window is unchanged, where the worker roughly halves it under DevTools
throttling. That halving is partly an artifact of the unthrottled worker; with
equal cores (unthrottled) the time to all windows did not differ beyond noise
(128–205 ms against 132–240 ms on the harness), though main-thread busy time fell
from 138–221 ms to 59–112 ms. Each stage remains one task, so at 6× the StuffIt
unwrap and chrome conversion of a large scheme still exceed 50 ms. A boundary
takes its turn with the page's other tasks: on a page saturated with back-to-back
8 ms tasks each boundary waited 8–57 ms and an opted-in decode took 55–212 ms
against 31–82 ms without the option, across three engines. Render tasks are
untouched by either approach.

**Behavior.** Decoded output through the built entry was compared in Chromium,
Firefox and WebKit for all 18 bundled themes in five modes (raw, raw with
provenance, owned from bytes, owned from URL, eager): baseline against the
candidate without the option, and against the candidate with it. 180 of 180 cases
identical per engine, over canonical graphs with sorted keys, frozen state and a
SHA-256 of every typed array, with the provenance load id, raster namespace counter
and blob URLs masked. The comparator detected a flipped pixel bit, an added key and
a frozen object in 54 of 54 sensitivity cases. Without the option, microtask tick
counts to settlement match the baseline for five inputs, and option reads match
apart from the one added read. A 48-case mutation run over the loader change (each
boundary moved or removed, the input copy and option snapshot moved or dropped,
each stage option dropped, the default path altered) is killed by the unit tests
with no case surviving and none killed by a hang.

**Picker fallback icon.** Opting the showcase in exposed an existing race in the
theme picker: a tile whose scheme has no folder icon borrowed the icon of whichever
tile resolved first. On the baseline the "Apple Platinum 2" tile showed two
different icons across five loads in Chromium and in Firefox. The borrowed icon is
now the first available in a fixed order, and was the same in 15 of 15 loads across
the three engines.

**Limits.** One host and Chromium only for blocking-time figures, bundled themes
only, no real slow device. Not measured: Firefox or WebKit blocking time (neither
exposes long tasks or CPU throttling to the harness), memory, interaction latency
during a decode. The showcase page decodes the active theme twice and decodes again
on the first switch to a theme whose picker tile was already decoded, because its
picker and its page host use separate resolvers; that repeated work is unchanged.

## StuffIt decoder build flags: size-optimized build chosen (#662)

Baseline `9dfe0a59`. Emscripten 5.0.7 (`263db4cf`, clang 23.0.0git, Binaryen
`wasm-opt` 129) from a local SDK; Node 24.18; Chromium 156, Firefox 157 and WebKit
27.2 from Playwright 1.64; one Apple M5 Mac whose load average moved between 4 and
58 during the work. Sizes are bytes; gzip is Node zlib level 9 throughout.

**Baseline identity.** The unchanged `build.sh` reproduces the committed
`munbox.mjs` exactly and `munbox.wasm` except for two bytes in the memory section:
the committed binary declares 337 initial pages (21.06 MB) where `build.sh` asks
for 32 MB. Building without `-sINITIAL_MEMORY=32MB` reproduces the committed
binary byte for byte, so it was built with this compiler before that flag was
added. There is therefore no compiler-version effect to separate, and every
comparison below has two references: the committed binary and the `-O2` build
from `build.sh` as written (the control).

**Thresholds, fixed before any variant was built.** A size win is a lazy decoder
chunk at least 5% smaller in gzip than both references, with median warm and cold
decode not slower than the control by more than the identical-binary difference
seen in the same session. A speed win is warm decode at least 10% faster than both
references, outside that difference, in Node and in Chromium with and without 4×
CPU throttling, with the chunk no more than 5% larger. Either needs identical
output on every input and passing tests.

**Behavior check.** Each variant decoded a fixed 404-input corpus through the
unmodified `index.mjs` wrapper, one worker per variant, with a 15 s watchdog per
input: the 13 bundled `.sit` archives; the five bundled and one authored raw
forks; empty, 8-byte, HTML and six random inputs; 45 truncations and 15 corrupted
bodies of three archives; 9 archives wrapped in generated MacBinary, BinHex and
BinHex-over-MacBinary; 3 generated MacBinary/BinHex files carrying both forks;
4 damaged wrappers; and 300 seeded corruptions (bit flips, header bytes,
truncation, overwritten runs) of four archives and two wrapped ones. The record
per input is every fork's name, type, creator, fork type, length and SHA-256, or
the error class and message, plus anything written to `console.error`/`warn`.
On the committed binary 136 inputs decode, 254 report a decoder error, 12 abort on
a munbox assertion and 2 never return. Those last two groups are existing
behavior and are the same in every variant. No Compact Pro input was available,
so that layer is compiled but not exercised.

| Variant (flags added to, or replacing `-O2` in, the control) | wasm raw / gzip | glue raw / gzip | Lazy chunk raw / gzip | Chunk gzip vs both references | Output identical |
| --- | ---: | ---: | ---: | ---: | --- |
| Committed binary | 69,806 / 29,648 | 13,264 / 4,437 | 105,021 / 44,767 | — | reference |
| Control: `-O2`, `build.sh` unchanged | 69,806 / 29,647 | 13,264 / 4,437 | 105,021 / 44,767 | 0.0% | yes |
| `-O3` | 71,161 / 30,736 | 12,908 / 4,383 | 106,500 / 45,537 | +1.7% | yes |
| `-Os` | 60,461 / 27,491 | 12,622 / 4,338 | 92,006 / 40,864 | −8.7% | yes |
| `-Oz` | 57,014 / 26,532 | 12,414 / 4,196 | 87,024 / 39,087 | −12.7% | yes |
| `-O2 -flto` | 73,329 / 30,031 | 14,250 / 4,825 | 110,837 / 44,971 | +0.5% | yes |
| `-O3 -flto` | 75,237 / 30,743 | 13,810 / 4,755 | 112,988 / 45,617 | +1.9% | yes |
| `-Os -flto` | 59,914 / 27,333 | 13,699 / 4,724 | 92,492 / 41,338 | −7.7% | yes |
| `-Oz -flto` | 56,886 / 26,445 | 13,491 / 4,583 | 88,066 / 39,586 | −11.6% | yes |
| `-O2 --closure 1` | as control | 6,226 / 2,972 | 104,101 / 44,476 | −0.7% | yes |
| `-O3 --closure 1` | as `-O3` | 5,925 / 2,828 | 105,419 / 45,393 | +1.4% | yes |
| `-Os --closure 1` | as `-Os` | 5,784 / 2,784 | 90,913 / 40,559 | −9.4% | yes |
| `-Oz --closure 1` | as `-Oz` | 5,570 / 2,653 | 85,966 / 38,800 | −13.3% | yes |
| `-flto --closure 1` at each of the four levels | as the `-flto` rows | 6,115–6,743 / 2,941–3,263 | not built | — | yes |
| `-sASSERTIONS=0` | as control | as control | as control | 0.0% | yes (already the default) |
| `-sINCOMING_MODULE_JS_API=print` | as control | 11,700 / 4,061 | 103,716 / 44,347 | −0.9% | yes, but `locateFile` is ignored |
| `-sTEXTDECODER=2` | as control | 12,866 / 4,277 | 104,464 / 44,592 | −0.4% | yes |
| `-sENVIRONMENT=web` | as control | 12,242 / 4,095 | not built | — | no: cannot start in Node |
| `-sMALLOC=emmalloc` | 63,138 / 26,996 | as control | 96,129 / 41,538 | −7.2% | yes |
| `wasm-opt -Oz`, `-O3`, `-Oz --converge` on the control | 69,089–69,581 / 29,579–29,658 | as control | 104,065 / 44,661 (`--converge`) | −0.2% | yes |
| `--closure 1`, API `print`, `TEXTDECODER=2` at `-O2` / `-O3` / `-Os` / `-Oz` | as each level | 4,557–4,998 / 2,277–2,470 | 102,297 / 43,812; 103,615 / 44,736; 89,109 / 39,881; 84,688 / 38,319 | −2.1%; −0.1%; −10.9%; −14.4% | yes, but `locateFile` is ignored |
| The same plus emmalloc at `-O2` / `-O3` / `-Os` / `-Oz` | 63,138 / 26,996; 64,347 / 28,089; 53,669 / 25,102; 50,217 / 24,088 | as above | 93,405 / 40,587; 94,527 / 41,467; 80,053 / 36,479; 75,624 / 34,935 | −9.3%; −7.4%; −18.5%; −22.0% | yes |
| The same plus `-flto` at `-O2` / `-O3` / `-Os` / `-Oz` | 66,658 / 27,438; 68,416 / 28,054; 53,118 / 24,953; 50,091 / 23,992 | 4,919–5,335 / 2,494–2,691 | 98,563 / 40,701; 100,601 / 41,249; 80,117 / 36,943; 76,256 / 35,293 | −9.1%; −7.9%; −17.5%; −21.2% | yes |
| `wasm-opt` passes on four of those | within 1.1% of their inputs | unchanged | 76,232 / 35,206 for the smallest | −21.4% | yes |
| `-Oz --closure 1 -sTEXTDECODER=2`, API `print,locateFile` | as `-Oz` | 4,710 / 2,319 | 84,736 / 38,332 | −14.4% | yes |
| `-Os --closure 1 -sTEXTDECODER=2`, API `print,locateFile` | as `-Os` | 4,600 / 2,285 | 89,157 / 39,888 | −10.9% | yes |
| **Chosen: `-Os --closure 1 -sTEXTDECODER=2`** | 60,461 / 27,491 | 5,460 / 2,622 | 90,387 / 40,371 | −9.8% | yes |

The other library chunks are unchanged apart from the hashed name of the decoder
chunk they import. Brotli (quality 11) for the chosen chunk is 35,165 against
38,962.

**Timing.** Warm is the fastest of 12 passes (8 in Chromium) over all 13 bundled
archives after 3 (2) untimed passes; cold is the first `decodeArchive` call on a
78 KB archive, which includes compiling and instantiating the module. Node used
the wrapper with a fresh process per sample; Chromium imported the built lazy
chunk in a fresh browser context per sample, so the base64 path is what was
timed. Variant order was reshuffled every round. Each cell is minimum / median /
maximum in milliseconds over the samples in that session; “A/A” is a second copy
of the control binary.

| Session (samples per variant) | Committed | Control | A/A | Chosen | `-Oz` with the same glue flags |
| --- | ---: | ---: | ---: | ---: | ---: |
| Node warm, finalists (20) | 92 / 130 / 169 | 88 / 120 / 175 | 97 / 130 / 177 | 75 / 127 / 168 ¹ | 97 / 136 / 189 |
| Node cold, finalists (20) | 7.0 / 10.6 / 16.3 | 7.1 / 11.1 / 19.7 | 7.1 / 11.6 / 15.9 | 6.5 / 11.1 / 20.3 ¹ | 8.7 / 12.1 / 21.1 |
| Chromium warm, finalists (16) | 91 / 132 / 195 | 91 / 127 / 182 | 94 / 129 / 181 | 94 / 128 / 187 ¹ | 108 / 150 / 176 |
| Chromium cold, finalists (16) | 8.2 / 12.7 / 21.9 | 8.7 / 11.4 / 18.8 | 8.2 / 13.0 / 23.2 | 9.0 / 12.6 / 15.1 ¹ | 10.2 / 13.4 / 22.9 |
| Chromium 4× warm, finalists (12) | 336 / 365 / 670 | 340 / 415 / 607 | 341 / 403 / 555 | 352 / 381 / 570 ¹ | 359 / 436 / 560 |
| Chromium 4× cold, finalists (12) | 33.0 / 55.6 / 71.7 | 33.0 / 51.3 / 85.8 | 30.3 / 46.3 / 72.8 | 31.1 / 44.5 / 73.9 ¹ | 31.0 / 40.1 / 90.4 |
| Node warm, shipped bytes (16) | 171 / 183 / 200 | 174 / 182 / 199 | 172 / 183 / 215 | 173 / 182 / 205 | — |
| Node cold, shipped bytes (16) | 15.0 / 19.3 / 32.5 | 15.3 / 19.3 / 31.2 | 16.2 / 18.0 / 26.9 | 15.1 / 17.5 / 25.9 | — |
| Chromium warm, shipped bytes (14) | 165 / 215 / 245 | 194 / 226 / 244 | 175 / 214 / 244 | 174 / 222 / 245 | — |
| Chromium cold, shipped bytes (14) | 17.3 / 21.4 / 32.3 | 17.3 / 21.6 / 24.5 | 16.4 / 21.3 / 23.5 | 17.3 / 21.7 / 22.7 | — |
| Chromium 4× warm, shipped bytes (12) | 484 / 562 / 916 | 441 / 651 / 966 | 534 / 634 / 871 | 533 / 649 / 934 | — |
| Chromium 4× cold, shipped bytes (12) | 45.7 / 62.6 / 99.1 | 46.7 / 60.1 / 103.2 | 46.3 / 60.8 / 104.4 | 47.9 / 65.7 / 108.5 | — |

¹ Measured on the `print,locateFile` build, which has the same `munbox.wasm` bytes
as the chosen build and a slightly smaller glue. The “shipped bytes” session, run
under load averages of 12 to 58, used the committed artefacts.

Noise floor: the two copies of one binary differed in median by up to 8% within a
finalist session and by up to 18% in an earlier 22-variant Node session (144
against 118 ms), and in fastest sample by up to 14%. The chosen build's medians
are within −8% to +6% of the control in every session, inside that floor. In the
shipped-bytes session the per-round ratio to the control had a median of 0.99
(Node), 0.94 (Chromium) and 0.98 (4×) for the chosen build against 1.01, 0.97 and
0.98 for the A/A copy. No variant met the speed threshold; nothing was faster
outside the floor.

**Rejected on measurement.** `-Oz` saves about another 1,600–1,800 gzip bytes of
chunk but was the one family that looked slower: medians +13% (Node), +18%
(Chromium) and +5% (4×) in the finalist session; and in earlier sessions, where
the A/A copy's fastest sample was within 1.4% of the control's, fastest samples
3–4% above the control in three separate `-Oz` builds in Node (24 samples each)
and 4% above in two of three at 4× (10 samples each). That is suggestive rather
than established on this host, and it was enough to prefer `-Os`. emmalloc
saves about 3,200 gzip bytes of chunk but holds more memory: after four passes
over the 13 archives in one instance the heap was 55.4 MB against 38.4 MB with
dlmalloc, and 494.8 MB against 286.3 MB after forty. `-O3` and `-flto` make the
binary larger. Explicit `wasm-opt` passes change less than 1%, because `emcc`
already runs Binaryen at these levels.

**Rejected on contract.** Restricting the factory options to `print` drops the
`locateFile` hook that the decoder README documents for a custom WASM location;
allowing `print,locateFile` keeps it and saves a further 483 gzip bytes of chunk,
but any other Emscripten option passed to `createMunbox()` by code importing the
glue directly would be ignored, so it was left out. Removing container layers was
measured on a scratch copy of the sources and not shipped: without BinHex,
MacBinary and Compact Pro the control would be 50,908 / 22,071 (chunk 79,825 /
33,931, −24.2%), and with `-Oz` 40,998 / 19,809 (chunk 65,668 / 29,815); singly,
BinHex is worth 3,785 gzip bytes of chunk, MacBinary 2,606 and Compact Pro 4,089.
In this project only inputs that `detectContainer` classifies as StuffIt reach the
WASM, and the pure-JS loader handles MacBinary and BinHex itself, but
`decodeArchive` is a public entry of the standalone `stuffit-wasm` package whose
README, types and package description promise all four formats and nested
wrappers. Dropping the layers changed 109 of the 404 corpus results (a wrapped
`.sit` comes back as one undecoded data fork).

**Memory.** Linear memory after instantiation, after the largest archive
(`crayon-os`, 515 KB) and after all 13 archives is 32.00 MB for the control and
the chosen build, and 21.06 MB for the previously committed binary; after four
passes it is 38.44 MB against 36.50 MB. The 11 MB difference at start is the
`-sINITIAL_MEMORY=32MB` flag that the old artefact lacked, not the optimization
level. Existing behavior, unchanged by any variant: the heap grows by roughly
7 MB per pass over the 13 archives through one instance and does not come back.

**Compatibility and reproducibility.** The chosen build was instantiated through
the built `dist/scriptoscope.js` (`loadKaleidoscopeScheme` on a `.sit`) in
Chromium, Firefox and WebKit: the same eight HTTP requests as the baseline, no
console errors, and all 18 bundled themes decode to the same canonical digest
(sorted keys, SHA-256 of each of 9,352 typed arrays, provenance load id masked) in
each engine; with the mask removed two runs of one binary differ in 18 of 18. The
wrapper still silences decoder stdout and `locateFile` is still honoured. A second
build from a clean copy in a fresh shell, and a build in the
`emscripten/emsdk:5.0.7` linux/arm64 image, both reproduce the committed bytes
exactly. Neither glue file carries embedded licence text, before or after.

**Limits.** One loaded host; Chromium only for browser timing; no real slow
device or network; transfer size stands in for download time. Differences under
roughly 8% in median decode time could not be resolved, so “no slowdown” means
none larger than that. Compact Pro and the rare StuffIt methods have no fixture.

## Rejected structural theories after #497

These trials used the admitted production baseline corresponding to merged #497 (`240d0e1b5e7a8e574421b00383c96da43207360f`). Its production-only source archive excludes tests; a reconstructed subset tree must not be compared as though it were the full repository tree.

| Theory | Concrete result | Constraint on repeating it |
| --- | --- | --- |
| General shared bevel/frame span framework | Raster, pattern, border geometry and transfer executors are already shared. Three apparent bevel traversal sites total only 21 physical lines / 1,045 source bytes before replacement costs. | Identify a whole existing implementation that disappears before adding another executor or prepared sibling. |
| Hoist repeated terminal bevel border calls | Actual prototype: −59 contextual tokens, −194 source bytes, −117 emitted JS bytes, zero physical/noncomment lines. It adds branch bookkeeping. Rejected before parity/timing qualification. | A small call-site cleanup does not establish a materially smaller drawing core. |
| Resolve progress frame metadata once | Diagnostic deletion: −17 contextual tokens, −67 source bytes, zero lines. Stable pixels still changed callbacks/traces; mutable metadata changed pixels; a second-request exception disappeared. No full-bundle or timing claim. | The repeated request is observable protocol work. Validation, resource preparation and fill/track drawing implementations are already shared. |
| Compact push resource record | Source inventory found 24 gross physical lines / 1,662 bytes across three local/preflight regions before required replacements. Larger admission, dependency and lookup blocks still serve other callers. No qualifying prototype. | Count record construction, failure/provenance states, adapters and retained generic routes. A resource-transaction snapshot is an unproven compatibility hypothesis, not an approved migration. |
| Combine facade/lifetime wrappers | Shared helpers already own lifecycle and diagnostics; only six wrapper lines / 174 source bytes remain across three inspected sites before replacement. No prototype or runtime claim. | Preserve distinct callback-error precedence, publication/owner-check order, partial traces and commit rules; adding a generic lifecycle wrapper does not delete those policies. |
| Remove private procedural-frame sample color clone | Exact-source review: −33 contextual tokens, −1 production line, −59 emitted JS bytes; no new helper. Independent public parity passed, but all seven timing intervals crossed no-change across 700 retained pairs. | Parked as insufficient material benefit. Author-only small-frame signal was not independently established. Declared engine callbacks were not available through the shipped package transport. |
| Factor frame-table literal schemas | Cost model: six constructors save 1,165 source bytes after typed helper costs; excluding the losing attribution helper estimates 1,305 bytes with 87 initialization calls. No transformed production candidate. | This trades named fields for long positional calls. No AST, emitted-size, initialization, identity/freeze parity or render-time claim is established. |
| Unify horizontal/vertical scrollbar and slider bodies | Source inventory confirms substantial paths already share Axis. Residual slider tick branches have three statements each and drag branches two, with different vertical and read-order policy. No prototype. | Bounded 1–4 inline-line opportunity before adapters is insufficient for a new axis framework; already-shared bodies earn no new deletion credit. |
| Post-optimizer Terser formatting | Source-owned trial: all runtime JS −129,644 raw / −15,881 gzip9 bytes; maps add 20,963 gzip9 bytes, full summed closure +5,082. A later actual-package audit measured 955,799 → 960,645 archive bytes (+4,846). | Strict preservation failed: five comment instances truly absent; follow-up classified four as ordinary prose and left one numeric/parenthetical annotation unresolved. The 106 raw PURE instances were preserved, attachment not proved. No cold/warm timing or adoption claim; new build-tool costs apply. |

The admitted 104,937-byte index chunk contains a 93,076-byte base64 data URI for the exact 69,806-byte decoder WASM. Those encoded asset bytes are shipped cost, not handwritten drawing logic. A config-only asset-emission prototype preserved the binary and saved 20,127 raw / 9,824 summed gzip9 runtime bytes after charging all JavaScript and WASM, while adding 16 noncomment configuration lines and deleting no drawing logic. Direct browser/CDN-style and Vite controls passed, but bare Rollup omitted the binary and failed unless the consumer added an asset-emission adapter. Parked under the retained consumer contract; bounded synthetic archive roundtrips are not full format-fidelity evidence, and no startup or warm-render timing claim was established.

## What the source census does and does not show

A source-only responsibility census of the #497 baseline counted 92 admitted TypeScript files: 18,205 physical lines / 1,021,958 bytes. Shared raster execution and geometry occupied 487 physical lines / 29,020 bytes. Larger categories included resource-directed layout/painting policy (4,340 lines), public render orchestration (2,843), built-in procedural fallback (2,532), and host lifecycle/interactivity (5,084). Mixed files were assigned by dominant responsibility; these are physical source counts including comments/types, not emitted bytes or execution profiles.

This census established no larger compatible graph deletion from a new display-list interpreter. Such a representation would still need resource-selection policy, mutable-provider barriers, immediate alias semantics, diagnostics and public result adapters. Removing corner-sprite rendering could delete a concentrated graph but would withdraw supported fidelity, so it is not recommended under the faithful-core goal. Continue measuring removable complete-render work; do not interpret a small shared raster kernel as proof that surrounding contracts are free or unnecessary.

## Preserve the existing lazy frame boundary (#501)

Landed in [#501](https://github.com/khawkins98/scriptoscope/pull/501) after exact-head browser/build and documentation gates passed. The loader registry needs four procedural-frame art constant groups. Importing them from the full frame table kept that table eager even though frame painting already used a dynamic import. Moving the exact groups into a shared module and reexporting the original bindings lets the remaining table follow that existing lazy edge. Source review checked mutation/import ordering and preserved the existing eager loader captures and live scrollbar-plane alias.

Independent module-request accounting measured renderer initial JS at 352,555 → 331,549 raw bytes, while the existing frame chunk grows 39,790 → 59,742. The first-frame closure therefore saves only 1,054 raw bytes; all seven shipped JS files together save 1,063 raw / 530 summed Node gzip9 bytes. No extra production fetch is added. Progress-only consumers already shake out the table and gain effectively nothing.

The production cost is +272 source bytes, +6 physical lines and +1 noncomment line under the source review's contextual-token census. This removes an eager dependency, not a maintained rendering mechanism. Public synthetic comparisons, loader checks, consumer execution and alias/import-order checks passed within their stated scopes. Six fresh-process timings establish no broad startup, CPU or memory gain.

Strict consumer compilation reports the same three TS2307 references to missing dist/src companions in both supplied distribution assemblies. This is an existing assembly verification limit, not a new candidate error or proof about unexamined complete npm publications. No shim or skipLibCheck was added to hide it.

## Scalar compositor reads: rejected execution theory

The reviewed #501 runtime was the baseline. A prototype replaced two private per-pixel tuple reads with scalar channel snapshots, retaining the public tuple-returning helper. This duplicates a little read logic: +8 noncomment production lines, +261 source bytes, +231 raw shipped JS bytes and +73 summed Node gzip9 bytes. All seven runtime files and all 101 declaration files were bound to immutable artifacts and reproduced by a separate source reviewer.

Source-owned dynamic-read, thrown-prefix and alias controls passed. Independent comparison retained 4,864 matrix cases plus observer, lifetime, provider and pattern checks without a candidate pixel/behavior mismatch. Exact reflection still failed: incidental minification changed the Function.name values of two public bindings, CicnTransferError and isDebug. No exception was approved. An ideal straight-alpha oracle also failed on translucent destinations equally in both versions; that baseline limitation is distinct from candidate parity and was not relabeled a pass.

Six fresh browser processes retained 30 warm samples per workload and variant, with balanced order across eight complete public operations. No workload established a speed benefit. Geometric means of candidate/baseline paired process-median ratios were 1.114 (interval 1.010–1.253) for small bevels and 1.117 (1.029–1.219) for large frames; the other six intervals crossed no change. These descriptive 95% bootstrap intervals resample six process pairs and are unadjusted for eight comparisons. Cold/setup observations were separate. These are synthetic workload results, not whole-application or historical-fidelity measurements.

Park the prototype. Separate producer allocation sampling suggested less temporary heap traffic, but was not independently confirmed in this timing trial; allocation reduction does not establish faster complete rendering. This trial adds source and shipped code while showing slowdown signals. No independent memory benefit is claimed. Do not repeat the same scalar rewrite or add hard-coded generated-name compatibility shims to rescue it without a new, concrete hypothesis.

## Default-loader boundary census: no compatible cut established

A source-owned emitted-consumer census found no additional saving for a named progress import from the default package entry: both default and renderer consumers already emitted 57,729 raw / 18,380 Node gzip9 bytes. URL loading plus window rendering retained more conversion code, but the inspected dynamic-import cut would add an observable suspension and import-failure behavior at a mutable-input boundary. No production prototype, emitted saving or timing gain was established for that cut. It remains an unapproved compatibility proposal, not a completed optimization.

## Policy and publication audits: no substantial deletion established

A further source-only audit found resource construction already shared across seven callers and the diagnostic transaction across four. Four private pattern selectors form a real 108-noncomment-line / 8,094-byte replacement envelope, but their linked-asset usability, ambiguity, raw-resource presence and diagnostic policies differ. The estimated selector, result types and four adapters cost 95–130 lines: approximately 13 saved through 22 added, without a prototype or emitted-size claim. A 344-line bevel envelope includes legacy painting, labels, mode admission, clipping and diagnostics; it is touched code, not proven deletable duplication. No new orchestration framework is justified by this budget.

Window publication already allocates fresh ImageData and uses native typed-array set. There is no JavaScript channel-copy loop to replace. Wrapping the source plane changes observable isolation, storage validation and canvas-hook behavior; allocating that plane before painting moves errors and adds ownership machinery while retaining the public fresh-copy route. The faithful gross/net deletion established by this audit is zero. Native readback or copy samples alone do not prove dispensable work.

## Optional bevel coverage count: unapproved proposal, mixed timing

Complete-call CPU sampling identified a coverage traversal whose numeric result has no consumer without a diagnostic collector. A collector-only guard nevertheless omits observable dimension reads on the public allocation result and errors or side effects attached to those reads. The fixed-contract version stopped before implementation. A separate review-only proposal preserves the original pattern-dimension conditions and enabled diagnostic records, and skips only that unmasked count when the collector is absent. Its observation retirement is unapproved; no production change has landed.

The frozen prototype adds 14 source bytes / four contextual tokens / zero lines and 11 raw shipped JS bytes; summed per-file Node gzip9 changes by −4 bytes. It deletes no maintained helper. Separate source review reproduced all seven runtime files, 101 declarations and CSS and passed 190 retained synthetic comparisons in each of three browsers. Independent public checks positively admitted successful clipping, pattern and label pixels and browser package consumers. A corrected fixed 19,754-case getter sweep used one verified common serialized input with fresh per-case state: enabled diagnostics and other-allocation semantics matched; 9,499 absent-diagnostics rows differed, including explicitly characterized sentinel, mutation and changed-dimension cases on the counted output buffer. Those differences are the proposed contract change, not equivalence passes.

An earlier 16,050-case incomplete attempt generated inputs separately and encountered unequal image assets. Its available evidence is preserved but is input-invalid; complete original inputs were not retained. The corrected attempt bound common input before comparisons and preserved the same target map. Independent mode-5 masked-body admission remained a coverage gap; matching fallback results do not certify that branch. Existing alpha-oracle and strict distribution-assembly type limits remain disclosed separately.

Exactly six fresh balanced BC/CB browser processes then retained all 2,160 warm samples. Each process measured both variants; uncertainty uses paired process mean log-ratios with a Student-t 95% interval, without treating batches as independent processes. Negative percentages mean less candidate time.

| Complete public workload | Candidate time change | 95% interval |
| --- | ---: | ---: |
| Patterned small bevel | −2.87% | −19.00% to +16.47% |
| Patterned ordinary bevel | −9.23% | −25.54% to +10.64% |
| Patterned large bevel | −18.81% | −34.07% to −0.02% |
| Patterned bevel, diagnostics enabled | +11.57% | −2.83% to +28.11% |
| Unpatterned ordinary control | +15.53% | +0.73% to +32.52% |
| Unaffected progress control | +12.85% | −1.93% to +29.85% |

The large-case observation is promising, but slower unaffected controls prevent an isolated performance-win claim. Cold setup, first calls and warm calls remain separate; no memory or whole-application gain is established. No samples were excluded or timing rerun to obtain a preferred result. The candidate remains frozen and unapproved. Neither profiling share nor this mixed trial justifies landing it; the subsequent identical-artifact audit below identifies a material period effect without establishing a candidate effect.

## Identical-baseline timing audit: material position effect

The same seven-file, 688,856-byte baseline graph was served under both original module roots, with every opaque member hash verified. The active measurement functions, common serialized input, six workloads, twenty warmup calls, thirty samples per workload and slot, and fixed batch counts were unchanged. After registration, 24 fresh measured processes completed twelve balanced blocks, retaining all 8,640 warm batches, 288 first-call values and 48 setup values. No processes, batches or outliers were excluded.

For patterned ordinary rendering, the second/first period ratio was **0.820685**, with simultaneous interval **[0.727976, 0.925200]**, wholly below the preregistered reciprocal five-percent bound 0.952381. Inference used twelve block units, Student t11 and Bonferroni coverage across twelve slot/period endpoints. The remaining eleven intervals were inconclusive; none established bounded neutrality. This is material position asymmetry on that host and protocol, not an optimization of the identical code. It does not identify an engine mechanism or prove the earlier counterbalanced candidate estimate biased; all candidate claims remain parked.

Two earlier registrations ended in admission failure and supplied no inference: an invalid outer launch expression before any harness import, then an expected-user-agent mismatch after one unadmitted process. Those records remain preserved. Identity preflight established that the tool actually launched managed Chrome for Testing 153.0.8010.47; a separate installed Chrome 156 application had supplied the mistaken metadata. The valid audit bound live UA, CDP product and the actual owned executable separately, used syntax-checked launch payloads, and added pre-data structural admission guards to the numerical analyzer after synthetic validation. Its one identity-only blank-page probe is separate from the 24 measured processes.

All measured browsers, daemons and the static server closed positively. Full command-line flags were not exposed; the observed default launch policy was bound without changing it. Approximate independent-block/normal-contrast assumptions and single-host ambient activity limit interpretation. An advisor subsequently designed a contingent isolated-process null protocol but recommended against executing it for this parked proposal: it would require 96 fresh launches, and null success would establish neither candidate benefit nor acceptable compatibility cost. No new launches were authorized or run. Preserve that design for a separately justified measurement-method task; do not automatically extend this audit or resume candidate timing.

## Pixel-kernel deletion budget: no whole mechanism removable

A source-only audit of the merged #501 baseline counted 212 physical lines / 205 noncomment lines / 14,027 UTF-8 bytes in the pixel executor. Its explicitly enumerated seven-file support group—raster, PixelBuffer, rectangle, axis, slice, types and prepared-pattern modules—totals 486 physical lines / 392 noncomment lines / 27,566 bytes. This is a named source scope, not a project-wide count or shipped-size measurement. An earlier responsibility bucket used a different, unreconciled categorization; these figures establish no before/after reduction.

Stable per-operation geometry, data references and private output ownership do not by themselves delete a complete retained mechanism. Shared executors already handle clipping, scaling, slicing, tiling, masks, regions, alpha and fractional addressing; aliasing, shared storage and public observation/error behavior also remain. No separate owned/general executor pair was found to collapse. Broad integer-only or nonaliasing preconditions would require validation and migration without an established deletion budget. No prototype, build or timing trial was justified by this audit.

## Window-wrapper retirement: no net deletion established

A source-only audit identified a complete optional host-policy graph: `ScriptoscopeWindow`, its dependency type and exclusive resize-observer helper. Removing the two files and two entry exports would delete 639 physical lines / 35,759 source bytes before migration. Renderer-core deletion is zero; actual emitted and compressed savings were not measured. This API retirement is unapproved and is distinct from the already adopted mount/discovery retirement.

A separate public-consumer audit found two direct promotion integrations and 37 authored window sources across eight public pages. Their shared page host, responsive remounting, persisted layout and modal/collage close flows rely on source restoration, sizing, focus, cancellation and lifetime policies that retained manager APIs do not replace. A faithful shared consumer adapter plus integration glue was estimated at 500–880 physical production lines / 27,700–49,000 bytes. Those are unimplemented planning ranges, not measured savings; external consumer costs are unknown. Copying the wrapper into demo helpers would remain maintained production code and must be charged in full.

Do not prototype this retirement on the present deletion case. A fixed-size collage-only migration would leave the broader wrapper graph required, while deleting its policies without replacement changes current public flows. Reconsider only with a separately approved product decision or a concrete replacement that removes obligations rather than relocating them. No implementation, build, timing or consumer migration was performed by either audit.

## Procedural drawing and ordered checkable data: rejected simplification

A source-only fallback census identified 2,803 physical lines / 157,423 bytes across explicitly bounded frame, table, Platinum, progress and native text/DOM responsibilities. This is neither a removable algorithm budget nor directly comparable to the earlier rough responsibility bucket. Replacing utility-frame interior bitmap bookkeeping with rectangle exclusions removes only a nine-line exclusive executor while shared region machinery remains required elsewhere. Fractional indexing, callback timing and diagnostic counts add replacement obligations; no prototype was justified for that cut.

A final-image palette mask for fixed-size Platinum checkables also stopped before implementation: flattening repeated writes changes fractional-storage bytes and intermediate option observations. A separate ordered-data prototype closed the previously uncosted alternative. It preserves the base/mark boundary and repeated writes, replacing the fixed geometry helpers with five strings containing 580 literal characters and a decoder. Full production-source cost falls by 22 noncomment lines / 873 bytes and all shipped JavaScript by 180 raw bytes, while summed Node gzip9 increases by 138 bytes. The producer's contextual syntax count falls by 441 tokens; a separate reviewer measures 440 fewer lexical scanner tokens. Those are different counting methods.

The source reviewer independently matched 1,248 differential controls but rejected the maintained representation: geometry and pass order become a case-sensitive encoded drawing program, and long strings make token savings a weak complexity measure. Its separately labeled Python/zlib compression pair also grows (+128 JavaScript bytes); it is not interchangeable with the Node pair. A separate source-blind verifier matched 500 common-input functional cases through actual public entries, including storage bytes and observation/error prefixes, but found 82 changed public name values across root/renderer reflection. No reflection exception was approved; these are observable name occurrences, not a count of unique functions. The declaration assemblies retain the same three unresolved references noted earlier. Browser rendering and concurrent shared-memory interleavings were not covered. No speed claim follows from any of these checks or size measures. Retain the baseline rather than trade readable geometry for compact instruction strings or silently waive reflection. No candidate was integrated or timed. A subsequent maintainer decision allows independently classified incidental generated names to vary under the [generated-name policy](generated-name-compatibility.md). That future comparison policy does not reverse this prototype’s maintainability and compressed-size rejection.

## Follow-up artifact accounting: formatter still rejected

A separate artifact-only audit verified the old formatter trial's 115 distribution members and used the same public package metadata/docs from `19f6a621d40550119a7f02c7d9e871c697bef9a7` for both sides. Actual npm packing retained all maps, declarations, CSS, documentation and license: 119 members each, 955,799 → 960,645 gzip archive bytes, an increase of 4,846 bytes (0.507%). The raw member payload falls by 149,581 bytes. This is a full archive comparison, not the sum of separately compressed files and not a claim about current v2 packages.

The baseline archive SHA256 is `84f3293bc5e23e3ac1d3b1906299319ba1ebd55cf3a7cc80ae555457d50961e0`; the formatted archive is `1d70b9b0866d402174b230fde8ef551d09b2da9ba0832dab6dfddeb6a37a329b`. The listing-free audit report SHA256 is `dfeef271be6859117987d1edea679aca600a0ae39e5a412d650eeb2d9197bb74`. Its comment classification narrows the earlier three unknowns to one unresolved annotation; it does not grant legal/pragma clearance or waive the original preservation requirement. No new candidate or timing run was made. The generated-name policy does not rescue this comment-preservation and package-size failure.

## Common icon preparation: replacement costs exceed deletion

A source-only audit on the #501 source considered sharing bevel and generic icon preparation. Only dimensions/alpha-mask validation supplied a defensible common fragment: seven noncomment lines / 521 bytes before imports and replacements. Charging the old import gives eight lines / 571 bytes; the proposed helper, calls and imports cost twelve lines / 675 bytes. The net is **four added lines and 104 added bytes**, with four fewer lexical fragment tokens. This tiny fragment count is not a compiler-wide syntax or complexity result.

The larger admission, selected-occurrence, export-demand, owner-diagnostic and abort/lifetime policies remain distinct. No whole preparation mechanism was shown removable; no implementation, dependency installation, build, emitted-size comparison or timing trial followed. Do not claim the abandoned bevel draft supplies a funded shared-preparation simplification. Reconsider only with a different deletion budget. Listing-free audit report SHA256: `19ecbcaa1f13a72e2da76ff88e21e9d9bf07711812fff3eed97f1a9c7d3c6020`.

## Header private output: refreshed proposal, inconclusive timing

The existing [#500 draft](https://github.com/khawkins98/scriptoscope/pull/500) was reproduced against current main `59aced1f71a3dfbff8a85514a4025cd2a9dc7930`, source tree `b156313051a31c7baf8a044fe3bedcb4d5a77009`, in isolated artifacts. No runtime change was integrated. Exactly its two existing production files differ; the newer shared-raster, prepared-pattern and lazy-frame work is retained. The frozen identity document SHA256 is `259d7b2162034f183a2afe6abdd5678a7d6cc48c6358fe5992904fd77c23b5ba`.

For window/list-header facade calls reaching output construction with a full effective clip, the proposal paints fresh ordinary zero storage directly, omitting the public output allocator and detached work-plane/final copy. Its allocator invocation, side effects/errors and precedence, custom dimensions/initial bytes, returned identity, aliases/shared storage and resource-pressure consequences remain **unapproved**. This includes later driver rejection after construction. Partial/empty clips, earlier returns, columns and generic/prepared caller-buffer routes retain the existing mechanisms. No additional options/resource snapshot or lifetime waiver is adopted.

Independent source review found no unexpected change outside that proposal, but identified added specialization alongside retained general machinery: **+6 noncomment lines, +624 source bytes, +249 all-seven-JS bytes and +87 summed per-file Node gzip9 bytes**. Source-map and declaration costs also grow. Actual public build/pack/consumer checks passed independently for both variants, including strict installed types and browser checks without skips. All maps remain charged: 116 package members, 953,437 → 953,929 actual gzip archive bytes (**+492**); raw member payload grows by 1,574 bytes. The actual declaration-copy pipeline resolves the source-capsule assembly limitation rather than hiding it with a shim. This is performance specialization, not a code-deletion win.

Separate public behavioral verification passed 236 observations and 46 literal assertions per variant. It recorded 59 allocator-consequence differences as proposed changes, not parity passes. It also enumerated 142 name paths through the same `PixelBuffer` binding; separate per-binding source-map provenance tied `ae` → `re` to the unchanged authored declaration under the adopted generated-name policy. No unexpected retained-contract difference was observed in that finite scan. Direct hidden-helper execution and managed owner disposal/abort remain uncovered by that public-only verification. Actual package consumers and source review do not establish exhaustive behavioral or native fidelity.

A fresh source-blind timing plan was frozen before samples. It used authored opaque synthetic planes with in-memory decode adapters, normal allocators, complete awaited public operations and one variant per fresh process. Eight balanced four-process main blocks and four identical-baseline sham blocks completed once: 48 measured processes, 2,688 batches, 43,008 measured operations, no failures, exclusions or replacements. Two untimed renderer preflights and two separately disclosed authoring/metadata utilities make 52 Node invocations. Their accounting was clarified before any measurement; the frozen workloads, schedule, harness, sample counts and analysis stayed unchanged.

| Pooled full-clip endpoint | Candidate/baseline time ratio | 99% interval |
| --- | ---: | ---: |
| Window header | 0.4425 | 0.3677–0.5324 |
| List header | 0.4627 | 0.3860–0.5545 |
| Identical-baseline window sham | 1.0186 | 0.7247–1.4317 |
| Identical-baseline list sham | 1.0196 | 0.6552–1.5868 |

Both main endpoints pass the predeclared practical-benefit criterion, but neither sham interval fits the required 0.95–1.05 stability band. Nineteen of twenty retained-control descriptive upper bounds also exceed 1.05; no control lower bound establishes the predeclared slowdown screen. The fixed overall decision is **inconclusive**, not performance-review GO and not proof of regression or neutrality. No favorable subset, threshold change, optional rerun or historical timing projection rescues it. Eight per-case warmups establish this cache-predecoded workload, not proven JIT steady state. These Node/synthetic results establish no browser, startup, memory, application-wide or original-program benefit.

Listing-free report SHA256 identities: source review `76ffa87e96484f4916eec2e66b1fd046b129d18bead3e2068d75508078f73935`; public-contract review `df6717f400a34efd7ede65743000f528255c6fd51ffbbfd8e8a6bdd7b8863289`; actual-package review `661d707ab04907f2bbd5016b1fd541720a53da4203b09d656db566dd2d0b2b07`; timing `6cd8079134dedab42d62f0f072c163eff058d193fb1bdbe7e31fa4fb627dff83`. Timing plan SHA256: `bd8e8c3df02c8a6b1b6b4aed79712c93728a10e65bdf2f99d9e7579d64a6b582`. These identify local retained research artifacts; they do not embed reproducibility payloads in this document or make them repository acceptance evidence. The proposal remains unmerged and its allocator exception unapproved.

## Recent source-size progress, with a fixed scope

A Git-metadata-only comparison from immediately before #493 (`26e83e26cc3954a29c50d87c2755085c38259869`) to `59aced1f71a3dfbff8a85514a4025cd2a9dc7930` counts every tracked non-test `src/` blob, including data and declarations, excluding `.test.`/`.spec.` files and test/fixture directories. It measures 99 → 94 files and 1,046,377 → 1,036,186 bytes: **10,191 fewer bytes (0.974%)**. This is one explicit recent-wave scope, not a comparison with the original program, noncomment-line total or shipped package size. No renderer source changed after #501 in this interval; later tests, documentation and audits are not additional runtime reductions. Scoped execution improvements and source-size reductions remain separate results, and the larger architectural simplification is unfinished.

## Rules for the next theory

- Start with exact responsibilities and statements that can be deleted; distinguish repeated execution from duplicate implementation.
- Do not claim already-landed consolidation again. Eager and owned themes already converge through ThemeView.
- Preserve provider callbacks, mutable metadata, errors, diagnostic ordering, allocation, fractional geometry, aliasing and lifetimes except for explicitly adopted changes.
- A new representation must pay for types, construction, guards, adapters and every retained fallback; moving code or compressing formatting is not simplification.
- Stop a structurally losing trial before expensive benchmarks. For a viable trial, bind source and opaque runtime artifacts before independent verification.
- Keep verifier handoffs limited to identities and necessary cost metadata; do not embed producer timing summaries or probes.
