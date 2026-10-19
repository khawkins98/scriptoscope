import type { ControlCompositionSnapshot, ControlRect } from './controlComposition.js';

export interface BitmapGlyph {
  readonly character: string;
  readonly advance: number;
  /** Signed ink top-left offsets from this glyph's pen/baseline. */
  readonly bearingX: number; readonly bearingY: number;
  readonly width: number; readonly height: number;
  /** Binary row-major mask, exactly width * height entries. */
  readonly mask: readonly number[];
}
export interface BitmapFontData {
  readonly version: 1;
  readonly strikeSize: number;
  readonly metrics: { readonly ascent: number; readonly descent: number; readonly leading: number };
  readonly glyphs: readonly BitmapGlyph[];
  readonly provenance: { readonly kind: 'caller-declared'; readonly description: string };
}
export interface PreparedBitmapFont { readonly id: `bitmap-font:${string}`; readonly data: BitmapFontData; }
const prepared = new WeakMap<PreparedBitmapFont, ReadonlyMap<string, BitmapGlyph>>();
const integer = (n: number, name: string, min = -32768, max = 32767): number => {
  if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`${name} must be an integer in ${min}..${max}`);
  return n;
};
function dense<T>(array: readonly T[], name: string): void {
  if (!Array.isArray(array) || Array.from({ length: array.length }, (_, i) => i).some(i => !Object.hasOwn(array, i)))
    throw new TypeError(`${name} must be a dense array`);
}
/** Snapshot all caller data before hashing. No font lookup, scaling or provider authentication. */
export async function prepareBitmapFont(input: BitmapFontData): Promise<PreparedBitmapFont> {
  if (input?.version !== 1 || input.provenance?.kind !== 'caller-declared' || typeof input.provenance.description !== 'string' || !input.provenance.description.trim())
    throw new TypeError('Bitmap font requires version1 and caller-declared provenance');
  const strikeSize = integer(input.strikeSize, 'strikeSize', 6);
  const metrics = Object.freeze({ ascent: integer(input.metrics?.ascent, 'ascent', 0),
    descent: integer(input.metrics?.descent, 'descent', 0), leading: integer(input.metrics?.leading, 'leading', 0) });
  integer(metrics.ascent + metrics.descent + metrics.leading, 'lineHeight', 1);
  dense(input.glyphs, 'glyphs');
  const seen = new Set<string>();
  const glyphs = input.glyphs.map(g => {
    if (typeof g?.character !== 'string' || [...g.character].length !== 1 || /[\r\n\t]/.test(g.character)
        || /[\uD800-\uDFFF]/u.test(g.character) || seen.has(g.character)) throw new TypeError('Glyphs require unique explicit single-character mappings');
    seen.add(g.character);
    const width = integer(g.width, 'glyph.width', 0), height = integer(g.height, 'glyph.height', 0);
    dense(g.mask, 'glyph.mask');
    if (g.mask.length !== width * height || g.mask.some(v => v !== 0 && v !== 1)) throw new TypeError('Glyph mask must be binary and match its dimensions');
    return Object.freeze({ character: g.character, advance: integer(g.advance, 'glyph.advance', 0),
      bearingX: integer(g.bearingX, 'glyph.bearingX'), bearingY: integer(g.bearingY, 'glyph.bearingY'),
      width, height, mask: Object.freeze([...g.mask]) });
  }).sort((a, b) => a.character < b.character ? -1 : a.character > b.character ? 1 : 0);
  const data = Object.freeze({ version: 1 as const, strikeSize, metrics, glyphs: Object.freeze(glyphs),
    provenance: Object.freeze({ kind: 'caller-declared' as const, description: input.provenance.description }) });
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const font = Object.freeze({ id: `bitmap-font:${hash}` as const, data });
  prepared.set(font, new Map(glyphs.map(g => [g.character, g])));
  return font;
}

/** Internal immutable run: advances and ink occupancy remain separate. */
export interface BitmapGlyphRun {
  readonly font: PreparedBitmapFont; readonly label: string; readonly advance: number; readonly lineHeight: number;
  readonly glyphs: readonly { readonly glyph: BitmapGlyph; readonly penX: number }[];
  readonly inkBounds: ControlRect | null;
}
export function prepareBitmapGlyphRun(font: PreparedBitmapFont, label: string, size: number | undefined,
  context: ControlCompositionSnapshot): BitmapGlyphRun {
  const mapping = prepared.get(font);
  if (!mapping) throw new TypeError('Use prepareBitmapFont to prepare the bitmap strike');
  if (size !== undefined && size !== font.data.strikeSize) throw new RangeError('fontSize must exactly match bitmap strikeSize; scaling is unsupported');
  if (context.clip.kind === 'unknown') throw new RangeError('Bitmap text requires an explicit known clip');
  if (typeof label !== 'string' || /[\r\n\t]/.test(label)) throw new TypeError('Bitmap text supports single-line plain labels only');
  let advance = 0, left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const glyphs = [...label].map(character => {
    const glyph = mapping.get(character);
    if (!glyph) throw new RangeError(`No bitmap glyph mapping for ${JSON.stringify(character)}`);
    const penX = advance;
    advance = integer(advance + glyph.advance, 'label advance', 0);
    for (let y = 0; y < glyph.height; y++) for (let x = 0; x < glyph.width; x++) if (glyph.mask[y * glyph.width + x]) {
      const px = integer(penX + glyph.bearingX + x, 'ink.x'), py = integer(glyph.bearingY + y, 'ink.y');
      left = Math.min(left, px); top = Math.min(top, py); right = Math.max(right, px + 1); bottom = Math.max(bottom, py + 1);
    }
    return Object.freeze({ glyph, penX });
  });
  return Object.freeze({ font, label, advance, lineHeight: font.data.metrics.ascent + font.data.metrics.descent + font.data.metrics.leading,
    glyphs: Object.freeze(glyphs), inkBounds: Number.isFinite(left) ? Object.freeze({ x: left, y: top, w: right - left, h: bottom - top }) : null });
}
/** kDEF 6ff2..7036 and 707c..709c, one ordinary push line. Reject overflow rather than emulate it. */
export function bitmapPushPen(run: BitmapGlyphRun, rect: ControlRect): readonly [number, number] {
  const left = integer(rect.x, 'Rect.left'), top = integer(rect.y, 'Rect.top');
  integer(rect.w, 'Rect.width', 1); integer(rect.h, 'Rect.height', 1);
  const right = integer(left + rect.w, 'Rect.right'), bottom = integer(top + rect.h, 'Rect.bottom');
  const x = Math.trunc(integer(integer(left + right, 'left + right') - run.advance, 'center numerator') / 2);
  const half = Math.trunc(integer(integer(integer(bottom + 1, 'bottom + 1') - top, 'height + 1') - run.lineHeight, 'baseline numerator') / 2);
  const { leading, descent } = run.font.data.metrics;
  let baseline = integer(integer(integer(bottom - half, 'baseline center') - leading, 'baseline leading') - descent, 'baseline descent');
  if (run.lineHeight < 13) baseline = integer(baseline - 1, 'short-line baseline');
  if (run.inkBounds) {
    integer(x + run.inkBounds.x, 'ink.left'); integer(baseline + run.inkBounds.y, 'ink.top');
    integer(x + run.inkBounds.x + run.inkBounds.w, 'ink.right');
    integer(baseline + run.inkBounds.y + run.inkBounds.h, 'ink.bottom');
  }
  return Object.freeze([x, baseline]);
}

export interface BitmapTextPaint {
  readonly fontId: PreparedBitmapFont['id'];
  readonly providerBasis: 'caller-declared';
  readonly layoutBasis: 'kdef-2.3.1-single-line-push';
  readonly coordinateSpace: 'port';
  readonly strikeSize: number;
  readonly metrics: BitmapFontData['metrics'];
  readonly label: string; readonly advance: number; readonly lineHeight: number;
  readonly pen: readonly [number, number]; readonly faceRect: ControlRect;
  readonly declaredClip: ControlCompositionSnapshot['clip'];
  readonly contextBasis: ControlCompositionSnapshot['basis'];
  readonly inkBounds: ControlRect | null;
  /** Mask occupancy after face/port clip, before later overlays; not surviving final contribution. */
  readonly foreground: { readonly rgba: readonly number[]; readonly pixels: number; readonly bounds: ControlRect | null };
  readonly emboss: { readonly rgba: readonly number[]; readonly pixels: number; readonly bounds: ControlRect | null } | null;
}
