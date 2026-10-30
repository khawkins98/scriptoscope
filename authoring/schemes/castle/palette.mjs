// Castle's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Warm grey stone, moss, a deep red banner with gold trim, royal blue
// heraldry, wood-brown buttons and iron fittings, on a parchment body.
//
// The stone and moss are picked so that their STORED values (after the gamma
// pre-compensation) sit a few units from one SYSTEM_PALETTE_256 grey/green
// each, every step on its own entry. A warm grey that falls between cube cells
// snaps to pink or olive at 8 bpp (design review §1.2), so the warmth here is
// kept under ~10 units and there are no mixes between the named steps:
//
//   active    stoneHi #bbbbbb  stone #999999 / #888888  stoneLo #777777  mortar #666666
//   inactive  stoneHi #cccccc  stone #bbbbbb / #aaaaaa  stoneLo #999999  mortar #888888
//   moss      #336633 / #669966 (active), greys (inactive)
//
// (Checked in both the stored values and the on-screen ones, which is what the
// design-review sim8.py prototype quantises.)
export const C = {
  // The colour controls normally sit on: the parchment body.
  // Used as the smooth-edge matte for buttons and checkboxes.
  body: '#eae2cf',
  parchment: '#ece4d1',
  active: {
    stone: ['#aba79f', '#9b978f'],                      // two block tones, 16 apart
    stoneHi: '#cac5bb', stoneLo: '#8d8981', mortar: '#7b776f', outline: '#2b2824',
    moss: ['#4a7848', '#78a878'],
    banner: ['#9b2630', '#8a1d26', '#76161f'],          // top → bottom of the fabric
    bannerLo: '#4f0d13', trim: '#d4a943', trimLo: '#8d6b20',
    title: '#f7e7b6', titleShadow: '#3d0a0f',
    iron: '#34373d', ironHi: '#737882',
    field: '#2b4b97', fieldHi: '#4266b8', gold: '#ddb54a',
    dark: '#1a1816', lit: '#e0822c', litHi: '#f6c14f',
    crestAlert: '#a12a2a',
  },
  inactive: {
    stone: ['#c8c5be', '#bab7b0'],
    stoneHi: '#dcd8d0', stoneLo: '#aeaba4', mortar: '#a19e97', outline: '#6f6b66',
    moss: ['#a2a6a0', '#b4b8b0'],
    banner: ['#8f807c', '#857673', '#7b6d6a'],
    bannerLo: '#6c605d', trim: '#c8bfae', trimLo: '#a39a8a',
    title: '#efe8de', titleShadow: '#efe8de',            // same colour = no shadow
    iron: '#8d8b88', ironHi: '#a9a7a4',
    field: '#9fa3ad', fieldHi: '#aeb2bb', gold: '#cfcbc2',
    dark: '#8c8883', lit: '#8c8883', litHi: '#8c8883',
    crestAlert: '#a9a19c',
  },
  wood: {
    face: '#8a5a2e', hi: '#a9773f', lo: '#6a431f', edge: '#3a2312', grain: '#7c5028', text: '#f8eac4', emboss: '#2e1a0c',
    pressedFace: '#6c4421', pressedHi: '#583718', pressedLo: '#82552b',
    disabledFace: '#b2a08a', disabledEdge: '#8e7f6e', disabledText: '#e0d6c8',
  },
};
