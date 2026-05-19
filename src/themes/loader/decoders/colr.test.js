import { describe, expect, it } from 'vitest';
import { decodeColr } from './colr.js';

describe('decodeColr', () => {
  it('decodes the 5 documented TMPL 128 fields', () => {
    // Synthesized: version 1.1, K-min 2.3 (0x23), accent colors true,
    // stretch-thumb-center true, + 11 zero bytes
    const bytes = new Uint8Array([
      0x01, 0x01, 0x23, 0x01, 0x01,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const c = decodeColr(bytes);
    expect(c.schemeVersion).toBe(1);
    expect(c.fileFormatVersion).toBe(1);
    expect(c.minimumKVersion).toBe(0x23);
    expect(c.hasAccentColors).toBe(true);
    expect(c.stretchScrollbarThumbFromCenter).toBe(true);
    expect(c.extraBytes.length).toBe(11);
    expect(c.extraBytes.every((b) => b === 0)).toBe(true);
  });

  it('decodes the actual Antique scheme Colr (from K2.3 install)', () => {
    // From /tmp/aaron-disasm — Antique's Colr resource
    const bytes = new Uint8Array([
      0x00, 0x00, 0x23, 0x00, 0x00,
      0xf9, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const c = decodeColr(bytes);
    expect(c.schemeVersion).toBe(0);
    expect(c.fileFormatVersion).toBe(0);
    expect(c.minimumKVersion).toBe(0x23);
    expect(c.hasAccentColors).toBe(false);
    expect(c.stretchScrollbarThumbFromCenter).toBe(false);
    expect(c.extraBytes[0]).toBe(0xf9);
    expect(c.extraBytes[2]).toBe(0x01);
    expect(c.extraBytes[4]).toBe(0x01);
  });

  it('handles negative DBYT values (signed-byte interpretation)', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x23, 0, 0]);
    const c = decodeColr(bytes);
    expect(c.schemeVersion).toBe(-1);
    expect(c.fileFormatVersion).toBe(-2);
  });

  it('throws on resources shorter than 5 bytes', () => {
    expect(() => decodeColr(new Uint8Array([1, 2, 3]))).toThrow(/too short/);
  });

  it('handles exactly 5 bytes (no extra)', () => {
    const c = decodeColr(new Uint8Array([1, 1, 0x20, 1, 1]));
    expect(c.extraBytes).toEqual([]);
  });
});
