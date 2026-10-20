import { syntheticDisplayProfile } from './display-profile.mjs';

// Synthetic device outputs deliberately differ from RGB8 and RGB8*257 mappings.
export function directDisplayProfile() {
  return { ...syntheticDisplayProfile(), version: 2, directRgb8: {
    operation: 'GetPixPat-FillCRect-patCopy', context: 'declared-context0', scope: 'preparation-only',
    evidence: [{ sha256: '1'.repeat(64), description: 'Owned literal fixture, not native measurement' }],
    mappings: [
      { rgb8: [170,170,170], deviceIndex: 4, deviceRgb16: [0x5a5a,0x6464,0x6e6e] },
      { rgb8: [187,187,187], deviceIndex: 5, deviceRgb16: [0x7878,0x8282,0x8c8c] },
      { rgb8: [221,221,221], deviceIndex: 3, deviceRgb16: [0x1414,0x1e1e,0x2828] },
    ],
  } };
}

// Independently serialized 2x2 RGBDirect PixPat, two distinct rows. High bytes
// and optional row padding are distractors, not colors or alpha.
export function directProfilePpat({ rowBytes = 12, colors = [170,187,221,170] } = {}) {
  const a = new Uint8Array(78 + rowBytes * 2), v = new DataView(a.buffer);
  v.setUint16(0, 1); v.setUint32(2, 28); v.setUint32(6, 78);
  v.setUint16(32, 0x8000 | rowBytes); v.setInt16(38, 2); v.setInt16(40, 2);
  v.setUint16(42, 1); // Version 1, as in all eight reviewed native oracle inputs.
  v.setUint32(50, 0x00480000); v.setUint32(54, 0x00480000);
  v.setUint16(58, 16); v.setUint16(60, 32); v.setUint16(62, 3); v.setUint16(64, 8);
  a.fill(0x5e, 78);
  colors.forEach((c, i) => a.set([[0,255,85,170][i], c,c,c], 78 + Math.floor(i / 2) * rowBytes + (i % 2) * 4));
  return a;
}
