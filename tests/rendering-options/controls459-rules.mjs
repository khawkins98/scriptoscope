// Independent oracle: only docs/spec/engine/{push-button,checkables,qd-primitives}.md.
// No runtime tables, manifests or output are imported here. Native pixel/font/device
// equivalence remains unknown; these are draw/message rules plus declared adapters.
export const ICON_ROWS = [
  [-10236,-10235,-10234,-10233], [-10232,-10231,-10230,-10229], [-10240,-10239,-10238,-10237],
  [-10220,-10219,-10218,-10219], [-10216,-10215,-10214,-10215], [-10224,-10223,-10222,-10223],
];
export const disabled = h => h === 254 || h === 255;
export const face = h => disabled(h) ? -10240 : h ? -10238 : -10239;
export const ring = h => disabled(h) ? [-10232] : h ? [-10230,-10231] : [-10231];
export function selection({ variation, hilite, value, acidAlternate }) {
  const kind = [2,4].includes(variation & 7) ? 1 : 0;
  const ct = disabled(hilite) ? 0 : hilite ? 2 : 1;
  const it = disabled(hilite) ? 2 : hilite ? 1 : 0;
  const cv = value === 1 && acidAlternate && !kind ? 3 : value;
  const iv = value === 1 && acidAlternate ? 3 : value;
  return { cicns: (cv >= 2 ? [cv,1] : [cv]).map(v => -9504 + 12*kind + 3*v + ct),
    icons: (iv >= 2 ? [iv,1] : [iv]).map(v => ICON_ROWS[kind*3+it][v]), kind, ct, it };
}
export function label(D, text, m, width, push) {
  if (!text || text.endsWith('\r')) return []; // final CR native glyphs explicitly unknown
  const lines = text.split('\r'), n = lines.length, h = m.ascent+m.descent+m.leading;
  const base = D.bottom - Math.trunc((D.bottom+1-D.top-n*h)/2) - m.leading-m.descent-(n-1)*h - (push && h<13 ? 1 : 0);
  return lines.map((text,i) => ({ text, x: push ? Math.trunc((D.left+D.right-width(text))/2) : D.left+18, baseline: base+i*h }));
}
export function emboss(bg, em, point) {
  return !(point.x===0 && point.y===0) && em[0]!==0x1234 && em.some((v,i) => v!==bg[i]);
}
export function iconTransfer({ color, allSet, recordingPicture, customBottlenecks }) {
  return allSet || recordingPicture || (!color && customBottlenecks) ? 'copyBits' : 'copyMask';
}
export const ROWS = {
  PB1:'guards',PB2:'guards',PB3:'push-state',PB4:'push-state',PB5:'push-state',PB6:'push-state',PB7:'push-state',
  PB8:'push-null',PB9:'push-null',PB10:'raw-colour',PB11:'text-mode',PB12:'paint-order',PB13:'raw-colour',
  DR1:'ring-gate',DR2:'push-state',DR3:'ring-retry',DR4:'push-state',DR5:'paint-order',DR6:'ring-retry',
  CB1:'guards',CB2:'guards',CB3:'check-state',CB4:'check-state',CB5:'check-state',CB6:'check-state',CB7:'check-order',
  CB8:'check-state',CB9:'check-retry',CB10:'check-state',CB11:'source-bounds',CB12:'check-retry',CB13:'check-state',
  CB14:'check-retry',CB15:'check-retry',CB16:'check-null',CB17:'icon-transfer',CB18:'mask-owner',CB19:'mask-owner',
  CB20:'icon-transfer',CB21:'icon-transfer',CB22:'icon-transfer',CB23:'icon-transfer',CB24:'icon-geometry',
};
