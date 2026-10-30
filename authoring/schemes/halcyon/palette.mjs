// Halcyon's palette. Colours are what you want to see on screen (sRGB); the
// encoder handles the classic-Mac gamma difference.
//
// Add a family's colours under its own key rather than reusing unrelated ones,
// so one family can be retuned without moving another.
export const C = {
  accent: '#1689a8',
  accentPressed: '#0f6a83',
  body: '#ffffff',
  active: {
    barTop: '#fbfcfe', barBottom: '#e6ebf2', highlight: '#ffffff',
    separator: '#d2d8e1', border: '#97a2b2', title: '#1d2430',
    glyph: '#4a5566', buttonTop: '#ffffff', buttonBottom: '#e2e7ee', buttonEdge: '#8d98a8',
  },
  inactive: {
    barTop: '#f6f7f9', barBottom: '#f6f7f9', highlight: '#fbfbfc',
    separator: '#e3e6ea', border: '#c4c9d0', title: '#9aa1ab',
    glyph: null, buttonTop: '#eef0f3', buttonBottom: '#eef0f3', buttonEdge: '#d0d4da',
  },
};

