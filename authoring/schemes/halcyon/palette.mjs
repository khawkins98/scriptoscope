// Halcyon's palette. Colours are what you want to see on screen (sRGB); the
// encoder handles the classic-Mac gamma difference.
//
// Add a family's colours under its own key rather than reusing unrelated ones,
// so one family can be retuned without moving another.
//
// Contrast floors (WCAG, on these on-screen colours; docs/authoring-visual-design.md §2.3):
// frame border vs white body ≥ 3:1 (active 4.4, inactive 3.0), inactive title
// vs inactive bar ≥ 4.5:1 (4.5), white glyph on the accent 4.9:1.
//
// The two accent colours sit on classic 8-bit system-palette entries (they are
// macRgbToSrgb of cube entries #006699 and #003366; the encoder stores them
// within one unit of the entry), so an
// 8 bpp screen shows the same teal as the web instead of snapping it to a
// greener #006666. The greys are allowed to collapse to the grey ramp at
// 8 bpp: every step still lands on a distinct grey, and nothing turns colour.
export const C = {
  accent: '#0078a8',        // system entry #006699
  accentPressed: '#004478', // system entry #003366
  body: '#ffffff',
  active: {
    barTop: '#fbfcfe', barBottom: '#e6ebf2', highlight: '#ffffff',
    separator: '#d2d8e1', border: '#6f7a8a', title: '#1d2430',
    glyph: '#4a5566', buttonTop: '#ffffff', buttonBottom: '#e2e7ee', buttonEdge: '#8d98a8',
  },
  inactive: {
    barTop: '#f6f7f9', barBottom: '#f6f7f9', highlight: '#fbfbfc',
    separator: '#e3e6ea', border: '#8c95a3', title: '#6a727f',
    glyph: null, buttonTop: '#eef0f3', buttonBottom: '#eef0f3', buttonEdge: '#d0d4da',
  },
};

