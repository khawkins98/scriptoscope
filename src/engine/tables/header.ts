/** Header contract: native surface rows and modern column policies stay separate. */
export const HEADER_STATE = [
  { row: 'N1', zero: true, id: -9568, source: '0xc1e8..0xc1fa' },
  { row: 'N2', zero: false, id: -9567, source: '0xc1e8..0xc1fa' },
] as const;
export const HEADER_BANDS = [
  { row: 'N6', piece: 'TL', source: '0x72a8..0x7300' },
  { row: 'N7', piece: 'TR', source: '0x7300..0x7362' },
  { row: 'N8', piece: 'top', source: '0x7362..0x73e4' },
  { row: 'N9', piece: 'BL', source: '0x73e4..0x7452' },
  { row: 'N10', piece: 'BR', source: '0x7452..0x74be' },
  { row: 'N11', piece: 'bottom', source: '0x74be..0x7542' },
  { row: 'N12', piece: 'left', source: '0x7542..0x75b6' },
  { row: 'N13', piece: 'right', source: '0x75b6..0x762e' },
] as const;
export const HEADER_DOMAIN = { min: -32768, max: 32767, stateMax: 4294967295,
  byteMax: 255, rgb16Max: 65535, channels: 4 } as const;
export const HEADER_COLUMNS = {
  rows: 'C1–C8', basis: 'modern-compatibility-policy',
  defaults: [{ label: 'Name', width: 140 }, { label: 'Size', width: 56 }, { label: 'Kind', width: 90 }],
  minHeight: 16, maxTemplateHeight: 28, defaultHeight: 20, minInset: 2, insetSubtraction: 3,
  minFont: 8, fontFactor: 0.6, labelX: 6, textSampleOffset: 3,
  luminance: [0.299, 0.587, 0.114], contrastThreshold: 128,
  light: '#ffffff', dark: '#000000',
} as const;
