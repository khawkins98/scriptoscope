// Shared procedural-frame art identities required by the eager loader registry.
// Rendering data remains in proceduralFrame.ts behind the existing frame import.
/** §3.5 frame cicn ids by role and hilite. */
export const PF_ART = {
  document: { hilited: -14332, normal: -14336, id: '§3.5.doc', source: '0x12dfc..0x12e18, 0x13938' },
  dialogAlert: { hilited: -14322, normal: -14324, id: '§3.5.dlg-alert', source: '0x1353a..0x13588, 0x13950' },
  dialog: { hilited: -14326, normal: -14328, id: '§3.5.dlg', source: '0x1353a..0x13588, 0x13950' },
  stripesDocument: { id: '§3.5.stripes04', stripes: -14331, source: '0x13e58' },
  stripesMovable: { id: '§3.5.stripes5', alert: -14321, normal: -14325, source: '0x13e42..0x13e52' },
  growDocument: { hilited: -14330, normal: -14334, id: '§3.5.grow04', source: '0x1450a..0x14526, 0x144f2..0x14556' },
  growMovable: { hilited: -14309, normal: -14310, id: '§3.5.grow5', source: '0x13136..0x13204' },
} as const;

/** §9.4 UFA1–UFA3 utility frame cicn ids. */
export const PF_UTILITY_ART = {
  frameSide: { id: 'UFA1', active: -14315, inactive: -14319, source: '0x15e20..0x15e6c' },
  frame: { id: 'UFA1', active: -14316, inactive: -14320, source: '0x15e20..0x15e6c' },
  inactiveFallback: { id: 'UFA2', source: '0x15e6e..0x15e98' },
  absent: { id: 'UFA3', source: '0x15e9a..0x15e9c' },
} as const;

/** §9.7 grow box art UGB1–UGB2 (masked copy, GB3). */
export const PF_UTILITY_GROW = {
  small: { id: 'UGB1', active: -14285, inactive: -14286, source: '0x16e2a..0x16e82' },
  /** smallGrow crops the top-left trunc(size · 11 / 15), unscaled. */
  normal: { id: 'UGB2', active: -14313, inactive: -14317, crop: [11, 15], source: '0x16e86..0x16f12' },
} as const;

/** §9.5 stripes US1–US6 (drawn only when active). */
export const PF_UTILITY_STRIPES = {
  /** Across: T.t + trunc((t − 8) / 2) (side: T.l + …), 9 rows; along: Lu .. Ru. */
  band: { id: 'US1', crossLess: 8, rows: 9, source: '0x16872..0x168ec' },
  clip: { id: 'US2', source: '0x16862..0x16870, 0x16988..0x1699e' },
  art: { id: 'US3', horizontal: [-14314], side: [-14318, -14314], source: '0x1694c..0x16984' },
  /** Along-length below 4 px: painted with the fill colour. */
  narrow: { id: 'US4', minAlong: 4, source: '0x16a1c..0x16a2a, 0x16a82..0x16a8c, 0x169a6..0x169b2, 0x16a0e..0x16a18' },
  /** Tiled 1:1, opaque copy (GB3a); source extent 9 across. */
  tile: { id: 'US5', extent: 9, source: '0x16a2c..0x16a7e, 0x169b4..0x16a08' },
  remove: { id: 'US6', source: '0x168fe..0x1690c' },
} as const;
