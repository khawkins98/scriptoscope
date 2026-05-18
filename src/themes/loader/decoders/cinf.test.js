import { describe, it, expect } from 'vitest';
import { decodeCinf, resizeBehavior, RESIZE_BEHAVIOR_LABELS } from './cinf.js';

// Minimal cinf byte sequences for behavior verification. Layout:
//   [cornerSize, sideThickness, tileSides, patternAnchor, bgPatternId (int16),
//    bgPixelY (int16), bgPixelX (int16), textY (int16), textX (int16),
//    embossY (int16), embossX (int16)]
function makeCinf(tileSides, patternAnchor) {
  return new Uint8Array([
    4, 4,                    // cornerSize, sideThickness
    tileSides, patternAnchor,
    0, 0,                    // bgPatternId = 0
    0, 0, 0, 0,              // bgPixelY, bgPixelX
    0, 0, 0, 0,              // textY, textX
    0, 0, 0, 0,              // embossY, embossX
  ]);
}

describe('resizeBehavior', () => {
  it('maps (0, 0) → stretch-whole', () => {
    expect(resizeBehavior(0, 0)).toBe('stretch-whole');
  });

  it('maps the full stretch family (0, 0..4)', () => {
    expect(resizeBehavior(0, 0)).toBe('stretch-whole');
    expect(resizeBehavior(0, 1)).toBe('stretch-top');
    expect(resizeBehavior(0, 2)).toBe('stretch-left');
    expect(resizeBehavior(0, 3)).toBe('stretch-bottom');
    expect(resizeBehavior(0, 4)).toBe('stretch-right');
  });

  it('maps the full repeat family (1, 0..4)', () => {
    expect(resizeBehavior(1, 0)).toBe('repeat-whole');
    expect(resizeBehavior(1, 1)).toBe('repeat-top');
    expect(resizeBehavior(1, 2)).toBe('repeat-left');
    expect(resizeBehavior(1, 3)).toBe('repeat-bottom');
    expect(resizeBehavior(1, 4)).toBe('repeat-right');
  });

  it('returns stretch-whole as safe default for out-of-range (no encoding known yet for anchor-* family)', () => {
    expect(resizeBehavior(2, 0)).toBe('stretch-whole');
    expect(resizeBehavior(0, 99)).toBe('stretch-whole');
  });

  it('publishes all 15 canonical labels', () => {
    expect(RESIZE_BEHAVIOR_LABELS).toHaveLength(15);
    expect(RESIZE_BEHAVIOR_LABELS[10]).toBe('anchor-center');
    expect(RESIZE_BEHAVIOR_LABELS[14]).toBe('anchor-bottom-right');
  });
});

describe('decodeCinf', () => {
  it('decodes (0, 0) cinf with stretch-whole resizeBehavior', () => {
    const d = decodeCinf(makeCinf(0, 0));
    expect(d.cornerSize).toBe(4);
    expect(d.sideThickness).toBe(4);
    expect(d.tileSides).toBe(0);
    expect(d.patternAnchor).toBe(0);
    expect(d.resizeBehavior).toBe('stretch-whole');
  });

  it('decodes (1, 3) cinf with repeat-bottom resizeBehavior', () => {
    const d = decodeCinf(makeCinf(1, 3));
    expect(d.resizeBehavior).toBe('repeat-bottom');
  });

  it('preserves backwards-compat boolean tileSides as tile field', () => {
    const d = decodeCinf(makeCinf(1, 0));
    expect(d.tileSides).toBe(1); // raw byte preserved
    expect(d.resizeBehavior).toBe('repeat-whole'); // and surfaced as label
  });
});
