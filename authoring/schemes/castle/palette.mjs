// Castle's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Warm grey stone, moss, a deep red banner with gold trim, royal blue
// heraldry, wood-brown buttons and iron fittings.
export const C = {
  // The colour controls normally sit on: the middle of the flagstone body.
  // Used as the smooth-edge matte for buttons and checkboxes.
  body: '#e0d9cb',
  parchment: '#ece4d1',
  active: {
    stone: ['#a59e91', '#9d968a', '#aaa396', '#979084', '#a19a8c'],
    stoneHi: '#c4bdaf', stoneLo: '#7e786d', mortar: '#615b52', outline: '#2b2824',
    moss: ['#5a6b33', '#6f8340', '#4b5a2b'],
    banner: ['#9b2630', '#8a1d26', '#76161f'],          // top → bottom of the fabric
    bannerLo: '#4f0d13', trim: '#d4a943', trimLo: '#8d6b20',
    title: '#f7e7b6', titleShadow: '#3d0a0f',
    iron: '#34373d', ironHi: '#737882',
    field: '#2b4b97', fieldHi: '#4266b8', gold: '#ddb54a',
    dark: '#1a1816', lit: '#e0822c', litHi: '#f6c14f',
    crestAlert: '#a12a2a',
  },
  inactive: {
    stone: ['#bdb9b2', '#b8b4ad', '#c1bdb6', '#b4b0a9', '#bbb7b0'],
    stoneHi: '#d2cec7', stoneLo: '#a29e97', mortar: '#94908a', outline: '#6f6b66',
    moss: ['#a3a796', '#a9ad9c', '#9b9f8e'],
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
