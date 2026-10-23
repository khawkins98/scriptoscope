// docs/spec/engine/push-button.md: one row per PB/DR decision.
export const PUSH_BUTTON = {
  PB1: { id: 'PB1', source: '0x67fc..0x6812' },
  PB2: { id: 'PB2', oval: 8, source: '0x6c34..0x6c5e' },
  PB3: { id: 'PB3', hilites: [254, 255], source: '0x66e8..0x670c' },
  PB4: { id: 'PB4', source: '0x670e..0x6718' },
  PB5: { id: 'PB5', resource: -10240, source: '0x7576..0x7580, 0x7592..0x7594' },
  PB6: { id: 'PB6', resource: -10238, source: '0x7582..0x758c' },
  PB7: { id: 'PB7', resource: -10239, source: '0x758e..0x7594' },
  PB8: { id: 'PB8', source: '0x10864..0x1086a, 0x759a..0x75ea' },
  PB9: { id: 'PB9', fallback: 0, source: '0x1086e..0x1089c, 0x10fa8..0x10fb8' },
  PB10: { id: 'PB10', sentinel: 0x1234, source: '0x10904..0x10998, 0x759a..0x75a4' },
  PB11: { id: 'PB11', depth: 4, grayishTextOr: 49, srcOr: 1, source: '0x75a6..0x75c4' },
  PB12: { id: 'PB12', offset: 1, source: '0x75c6..0x75ea, 0x70a6..0x70ba' },
  PB13: { id: 'PB13', source: '0x75c6..0x75ea' },
  DR1: { id: 'DR1', source: '0x76a8..0x76b6' },
  DR2: { id: 'DR2', resource: -10232, source: '0x76b8..0x76d0' },
  DR3: { id: 'DR3', resource: -10230, source: '0x76d2..0x7700' },
  DR4: { id: 'DR4', resource: -10231, source: '0x7702..0x7712' },
  DR5: { id: 'DR5', outset: 4, fallback: 1, source: '0x7698..0x76a2, 0x107de..0x107f2, 0x1086e..0x10898' },
  DR6: { id: 'DR6', source: '0x1089a..0x1089c, 0x10fa8..0x10fb8' },
} as const;
export const PUSH_LABEL = { shortLine: 13, source: '0x6fb8..0x7036, 0x707c..0x70ca' } as const;
export const PUSH_IDS = { bases: [PUSH_BUTTON.PB5.resource, PUSH_BUTTON.PB6.resource, PUSH_BUTTON.PB7.resource,
  PUSH_BUTTON.DR2.resource, PUSH_BUTTON.DR3.resource, PUSH_BUTTON.DR4.resource], terms: [] } as const;
// Declared browser allocation/typography policy retained by the public facade.
export const PUSH_FACADE = { minWidth: 56, padding: 12, height: 20, reasonableHeight: 28, fontSize: 12,
  source: 'modern compatibility policy; push-button §2 and §5 (allocation around original D)' } as const;

export const PUSH_PRESSED_PARTS = { family: 'push-button', parts: { button: 1 }, defaultPart: 'button',
  source: 'push-button PB4; public pressed boolean compatibility mapping' } as const;
