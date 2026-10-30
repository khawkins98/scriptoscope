// Bonn's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Warm Rhine sandstone for the frame, the city's red and yellow as accents,
// Altstadt cherry-blossom pink, and Rhine blue-greens for the water and the
// skyline silhouette.
export const C = {
  // The colour controls normally sit on: the cream document body. Used as the
  // smooth-edge matte for buttons and checkboxes.
  body: '#fbf5ea',
  utilBody: '#f3ece0',
  red: '#c0262d', redLo: '#7e1419', yellow: '#f4c430', yellowLo: '#b98c12',
  pink: '#f4a9c0', pinkHi: '#fcd6e2', pinkLo: '#d9708f',
  active: {
    outline: '#3a2c26',
    barTop: '#f4e4c7', barBottom: '#dcc196', barLine: '#b7966a',
    stone: '#e2c9a0', stoneHi: '#f2e2c4', stoneLo: '#b99a70',
    red: '#c0262d', redLo: '#7e1419', yellow: '#f4c430', yellowLo: '#b98c12',
    title: '#fff6de', titleShadow: '#5b0d12',
    // Skyline: a deep Rhine teal silhouette, glass for the Post Tower, blossom trees.
    sky: '#24484f', skyHi: '#3e6a70', glass: ['#7fb1bd', '#4f8795', '#2e5b66'],
    tree: ['#f7b7ca', '#ee93ae', '#fcd9e4'], trunk: '#4a3326',
    water: ['#5fa3a3', '#3f8689', '#2b6a72', '#22565e'], foam: '#d9f0ec', waterEdge: '#173f46',
    bank: '#8fae5e', bankLo: '#5f7f3c',
    pink: '#f4a9c0', pinkHi: '#fcd6e2', pinkLo: '#d9708f',
  },
  inactive: {
    outline: '#7d736c',
    barTop: '#efe9df', barBottom: '#ddd5c8', barLine: '#c2b8a9',
    stone: '#ddd6ca', stoneHi: '#ece7de', stoneLo: '#bfb6a8',
    red: '#b7a8a3', redLo: '#9a8c87', yellow: '#d9d0bd', yellowLo: '#b8af9c',
    title: '#4a423d', titleShadow: '#4a423d',               // same colour = no shadow
    sky: '#8a9a9c', skyHi: '#9fadaf', glass: ['#c2cdd0', '#aab8bc', '#95a5a9'],
    tree: ['#e3cfd5', '#d8c0c7', '#ece0e4'], trunk: '#8f857f',
    water: ['#b9c9c9', '#aabdbe', '#9db2b4', '#93a9ab'], foam: '#e8eeed', waterEdge: '#7d8f91',
    bank: '#b8bfa9', bankLo: '#9fa78f',
    pink: '#ddc7ce', pinkHi: '#ece0e4', pinkLo: '#c2a9b1',
  },
};
