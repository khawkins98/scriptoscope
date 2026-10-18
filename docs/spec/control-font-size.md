# Button font size and face geometry

`composeButton` and `composeBevelButton` accept `fontSize`, a finite nominal CSS
pixel size of at least 6. Omission uses **12px as an explicit compatibility
default**, independently of face height. The size is captured before asynchronous
artwork loading and is used for measurement, automatic width, foreground and
emboss. Growing an automatic face to the existing 20px fallback does not change
that size. Explicit compact heights remain explicit and can clip the label.

```ts
await composeButton(theme, { label: 'OK', height: 24, fontSize: 12 });
await composeBevelButton(theme, { label: 'Apply', fontSize: 16 });
```

Nonfinite values and values below 6 reject with `RangeError`; they are not
silently clamped by the browser text raster helper. Fractional sizes are allowed.
The current Chicago/Charcoal/Geneva/sans-serif family order, glyph-buffer sizing,
centering, foreground/emboss colors, and face-height policy remain compatibility
choices. The multi-column `composeListHeader`, tabs, native controls and
procedural fallback controls retain their separate typography policies.

## Source boundary

The pinned Kaleidoscope 2.3.1 kDEF0 component has SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
At `0x753c/0x7540`, the push path copies port `txFont` (+68) to `TextFont`;
at `0x7546/0x754a` it copies port `txSize` (+74) to `TextSize`. The caller
saves port style at `0x6c66/0x6c6a` and invokes the style setter `0x65ba` at
`0x6cb0–0x6cb8`; its absolute/relative size handling is a style operation.
`GetFontInfo` at `0x6fbc` supplies metrics for placement. The Rect height is
not a font-size selector. See [issue #310](https://github.com/khawkins98/scriptoscope/issues/310)
and the [source reference](kdef231-reference.md).

This proves the push-button size/Rect separation, not a universal historical
12px default. Sharing the explicit option with bevel buttons is an API
compatibility policy. No claim is made about original font-provider selection,
exact glyphs, QuickDraw baselines or device rasterization. The focused browser
fixture checks nominal size, width and foreground/emboss consistency with an
independent current-browser glyph mask; reviewed exact goldens cover regressions,
not historical font fidelity.
