// docs/spec/engine/checkables.md: decisions and signed icon identities.
export const CHECKABLES = {
  CB1: { id: 'CB1', source: '0x67fc..0x6812' },
  CB2: { id: 'CB2', source: '0x6c34..0x6c5e' },
  CB3: { id: 'CB3', checkbox: [1, 3], radio: [2, 4], variationMask: 7, source: '0x673c..0x6770' },
  CB4: { id: 'CB4', hilites: [254, 255], cicnTier: 0, iconTier: 2, source: '0x66e8..0x670c,0x7202..0x7208,0x7326..0x732c' },
  CB5: { id: 'CB5', cicnTier: 2, iconTier: 1, source: '0x670e..0x6718,0x71f6..0x7200,0x731c..0x7324' },
  CB6: { id: 'CB6', cicnTier: 1, iconTier: 0, source: '0x71f6..0x7208,0x731c..0x732c' },
  CB7: { id: 'CB7', disabledMode: 49, mode: 1, source: '0x71c6..0x71e8' },
  CB8: { id: 'CB8', alternate: 3, source: '0x720a..0x7232' },
  CB9: { id: 'CB9', retry: 1, source: '0x7234..0x7264' },
  CB10: { id: 'CB10', base: -9504, kindStep: 12, valueStep: 3, source: '0x7266..0x728a' },
  CB11: { id: 'CB11', source: '0x728c..0x7310' },
  CB12: { id: 'CB12', source: '0x7314..0x7318' },
  CB13: { id: 'CB13', alternate: 3, source: '0x7380..0x73a2' },
  CB14: { id: 'CB14', retry: 1, source: '0x73a4..0x73d8' },
  CB15: { id: 'CB15', source: '0x73da..0x73fa,0xf50c..0xf51e' },
  CB16: { id: 'CB16', source: '0xf51a..0xf51e' },
  CB17: { id: 'CB17', source: '0xf4fa..0xf50a,0xf574..0xf57a,0xf5c6..0xf61a' },
  CB18: { id: 'CB18', source: '0xf57c..0xf59c' },
  CB19: { id: 'CB19', source: '0xf5bc..0xf5c6' },
  CB20: { id: 'CB20', source: '0xf52e..0xf554,0xf5dc..0xf604' },
  CB21: { id: 'CB21', source: '0xf606..0xf61a' },
  CB22: { id: 'CB22', source: '0xf61e..0xf652' },
  CB23: { id: 'CB23', source: '0xf654..0xf66a' },
  CB24: { id: 'CB24', width: 16, eraseHeight: 12, height: 16, source: '0x732e..0x7360,0x18bb8..0x18bc0' },
} as const;
export const CHECKABLE_ICON_ROWS = [
  { kind: 0, tier: 0, ids: [-10236, -10235, -10234, -10233], source: '0x18b88..0x18b90' },
  { kind: 0, tier: 1, ids: [-10232, -10231, -10230, -10229], source: '0x18b90..0x18b98' },
  { kind: 0, tier: 2, ids: [-10240, -10239, -10238, -10237], source: '0x18b98..0x18ba0' },
  { kind: 1, tier: 0, ids: [-10220, -10219, -10218, -10219], source: '0x18ba0..0x18ba8' },
  { kind: 1, tier: 1, ids: [-10216, -10215, -10214, -10215], source: '0x18ba8..0x18bb0' },
  { kind: 1, tier: 2, ids: [-10224, -10223, -10222, -10223], source: '0x18bb0..0x18bb8' },
] as const;
export const CHECKABLE_GEOMETRY = { center: 8, label: 18, planes: 64, imageBytes: 32, rowBytes: 2, byteBits: 8, highBit: 128, byteMax: 255, opaque: 255,
  source: 'checkables §5; CB17–CB24; 0x18abc..0x18ac4' } as const;
export const CHECKABLE_IDS = { bases: [CHECKABLES.CB10.base], terms: [[0, 12], [0, 3, 6, 9], [0, 1, 2]] } as const;
// Declared public typography/allocation, never native glyph evidence.
export const CHECKABLE_FACADE = { fontSize: 9, height: 20, foreground: '#000000', source: 'modern public adapter policy' } as const;
