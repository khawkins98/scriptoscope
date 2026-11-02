# Substitute window-title ink fit

This listing-free clarification restates the existing TF1–TF6 and F11
substitute-font policy in [window-widgets.md](window-widgets.md). It applies
to eligible drawn recipe-window titles; it makes no original native typography
or device-equivalence claim. Existing empty-title, title-suppression and
empty-clip behavior stays unchanged.

TF3's **all main glyph ink** includes every raster row containing any
nonzero-alpha coverage of the main title glyphs, including fallback glyphs
and faint antialiased coverage. Evaluate that coverage before clipping, for
the **full requested title before horizontal truncation**, at F11's unchanged
adjusted baseline. Every such row must lie within the vertical interval of
the candidate's actual remapped TX4 clip. Nominal font bounds or measured
text bounds do not establish a fit when actually painted main glyph ink
extends beyond them. There is no alpha threshold, row tolerance or allowance
to discard low-alpha rows to call a candidate fitting.

Keep the preferred family, the required bold or plain face, and spacing.
Keep the preferred size when it fits; otherwise select the largest fitting
positive integer pixel size no greater than the preferred size. Candidate
geometry follows TF6: use the same existing layout constructor and caller
inputs with each candidate's style to obtain its actual remapped clip.
Neither the clip nor the plate may expand to accommodate ink.

The identical resolved family, face, size and spacing govern the full-title
advance, layout, horizontal truncation and ellipsis measurement, and drawing.
Do not refit from a truncated title or restore the preferred size during a
later measurement or draw. TF1's horizontal room and marker policy remain
unchanged.

Shadow retains its existing clipped semantics and paint order; it neither
participates in main-ink fit nor enlarges the budget. If no positive integer
candidate at or below the preferred size fits a nonempty vertical clip,
TF5 applies: omit both main and shadow ink, retain the full title and
accessibility name, and retain the preferred style for advance and layout
geometry. Preserve the frame, plate and clip and introduce no new typed public
failure. This physically impossible-slot fallback does not permit clipping
or omitting glyph rows when a fitting candidate exists.
