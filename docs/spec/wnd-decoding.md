# Bounded wnd# list decoding

`decodeWnd` reads a rectangle list followed by top, bottom, left and right side
lists. Each list begins with a signed 16-bit count minus one. Rectangle records
are 10 bytes (signed part plus Rect); side records are 4 bytes (signed part and
border). `-1` means empty. The decoder rejects missing count words, incomplete
record spans and negative counts below `-1` before reading or allocating records.
Checks use the supplied byte view, not its backing buffer. Trailing bytes remain
permitted; this fix adds no engine buffer-capacity or geometry validity rule.

The structure is pinned by `TMPL` 1240, named `wnd#`, in the canonical 1138 fork:
SHA-256 `6cfe7fd81b5be5d80393999cb4a90e60910c917462941cb03bf4d940b15736c8`.
Its five ZCNT/LSTC lists contain DWRD+RECT or DWRD+DWRD records. Signed interpretation
and the empty sentinel are corroborated by the pinned kDEF 2.3.1 resource
SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`:

- `0x3680–0x3698` initializes list counts to `-1`.
- `0x36c2–0x36cc` uses signed multiplication by 10 and a 12-byte addition to
  advance past the rectangle count and records; side advances at
  `0x36de–0x36e8` use `4 × storedCount + 6`.
- `0x4a88–0x4a90` recognizes `-1`; `0x4bde–0x4be0` and
  `0x59f6–0x59f8` use signed loop comparisons. `0x6586–0x658e` checks a negative
  rectangle count and uses signed multiplication.

This is the bounded signed-count interpretation for this format; it does not
claim every ResEdit ZCNT consumer shares it. Negative non-sentinel values are
invalid for this decoder, rather than silently becoming empty lists.

Previously, the shared Reader could supply zero-like values beyond a truncated
view, so even a single zero byte could become a successful window recipe. Bounds
checks are local to `wnd.js`; the shared Reader and other decoders are unchanged.
The converter now records such a recipe as `error`, and window construction
cannot attribute a successful recipe to it. Existing fallback or synthesis may
still occur from other valid resources; error reporting does not certify their
historical appearance. No goldens, fidelity assessments or reference approvals
change. See #330 and [window provenance](resource-byte-provenance.md).
