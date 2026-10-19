# Opt-in prepared bitmap text for plain push buttons

`prepareBitmapFont(data)` snapshots caller-owned strike data before hashing it
with Web Crypto. Its immutable `bitmap-font:<sha256>` identity binds normalized
render data and the caller's provenance description. It authenticates neither
an original font nor its selected provider. No installed font lookup or font
file decoding occurs. No original font payloads are distributed by this feature.

```ts
const bitmapFont = await prepareBitmapFont({
  version: 1, strikeSize: 12,
  metrics: { ascent: 8, descent: 2, leading: 1 },
  provenance: { kind: 'caller-declared', description: 'My own pixel glyph' },
  glyphs: [{ character: 'x', advance: 2, bearingX: -1, bearingY: -2,
    width: 3, height: 3, mask: [1,0,1, 0,1,0, 1,0,1] }],
});
const pixels = await composeButton(theme, {
  bitmapFont, label: 'x', minWidth: 80, height: 20,
  compositionContext: { controlOrigin: [20,20], portOrigin: [0,0],
    patternOrigin: { status: 'unknown' }, clip: { kind: 'rect', rect: { x:0,y:0,w:160,h:80 } } },
});
```

The option is on `ButtonOptions` only. Omitting it keeps browser-font rendering
unchanged, including the explicit 12px compatibility default. Bevels, tabs,
list headers, window titles and procedural fallback controls keep their existing
policies. With a prepared strike, omitted `fontSize` means `strikeSize`; an
explicit different size rejects. There is no scaling, substitution, shaping,
kerning, font manager or CSS font dependency in prepared text.

## Finite data and context contract

- `strikeSize` is an integer at least 6; ascent/descent/leading are nonnegative
  integers with positive combined line height. Values fit signed16 bounds.
- Each glyph maps exactly one Unicode scalar to a binary row-major mask.
  Character encoding conversion is the caller's responsibility. Duplicate,
  missing, tab or multiline mappings reject. Zero-sized/all-zero masks represent
  spaces or empty ink, independently of advance. Advance is nonnegative.
- `bearingX` and `bearingY` locate the ink rectangle relative to the glyph's pen
  and baseline. They may be negative; overhang is retained independently of
  advance and line metrics. Dense masks are copied and frozen.
- Label, strike, size and composition context are captured before artwork
  awaits. Explicit unknown clipping rejects. Omitted context means local
  origin0 with an unbounded port clip as a **compatibility declaration**, not
  observed original state. The control face always clips text.
- Explicit face dimensions are positive integers (minimum width may be zero).
  Unsupported signed16 layout arithmetic rejects; overflow/wrapping is not
  emulated. Automatic width uses summed advances plus the existing padding;
  automatic height retains the existing 20px fallback policy using line metrics,
  not the ink rectangle. Explicit compact heights may clip ink.

## Source-derived single-line placement

Pinned kDEF0 SHA256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`:
ordinary push variant setup `66c2–67a2`, control Rect/clip `6d42–6d80`,
`GetFontInfo` at `6fbc`, baseline `6ff2–7036`, centered advance `707c–709c`,
and emboss offset `70a6–70b2`. For Rect(left,top,right,bottom), advance W,
ascent A, descent D, leading G, line height L=A+D+G:

```
x = truncTowardZero((left + right - W) / 2)
baseline = bottom - truncTowardZero((bottom + 1 - top - L) / 2) - G - D
if L < 13: baseline -= 1
```

The calculation occurs in port coordinates, then translates to the face-local
buffer (excluding reserved ring margins). Negative halves must truncate toward
zero; centering after translating to local coordinates is not always equivalent.
Foreground and authored emboss use the same prepared run, with emboss(+1,+1)
painted first. Binary glyph masks carry the existing selected display colors;
caller CSS foreground colors retain the existing browser color/source-over
policy. This is not a claim about complete QuickDraw transfer modes.

## Diagnostics and evidence boundary

`trace.bitmapTextPaint` is separate from face-resource and kDEF band traces. It
records the actual prepared font ID, caller-declared provider basis, metrics,
advance, source-derived pen, unclipped port-space ink bounds, face/declared clip,
and foreground/emboss clipped mask occupancy. Counts describe each glyph-mask
stage, not unique writes or pixels surviving later foreground/ring overlays.
Empty or wholly clipped ink emits no font-paint record. Completion publishes the
record only on successful whole rendering; later ring errors and aborts suppress
it. It never contains masks or font bytes.

Repository fixtures are synthetic owned glyphs. The separate
[quarantined native observation](../research/control-label-observations/2026-10-19/README.md)
is conditional evidence, not an admitted reference or proof that an original
control selected the private candidate font/provider. This feature changes no
reference admission, compatibility authority or requirement-ledger status.
