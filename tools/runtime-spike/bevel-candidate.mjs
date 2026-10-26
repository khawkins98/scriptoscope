// Non-shipping feasibility prototype. Deliberately changes bevel compatibility.
// No native-fidelity claim; diagnostics and declared cinf environments are not implemented.
import { withThemeView } from '../../src/ownedTheme.ts';
import { resolveInChain } from '../../src/baseChain.ts';
import { PixelBuffer } from '../../src/pixelBuffer.ts';
import { rasterizeText } from '../../src/textRaster.ts';
import { snapshotControlComposition, controlPointVisible } from '../../src/controlComposition.ts';
import { themeResourceChain } from '../../src/engine/resources/theme.ts';
import { drawCinfFrame, prepareCinfFrameSamples } from '../../src/engine/qd/cinfFrame.ts';
import { rect } from '../../src/engine/qd/rect.ts';

export const bevelIds = Array.from({ length: 15 }, (_, i) => -10162 - i);

export async function composeCandidate(input, supplied = {}, observe = () => {}) {
  const opts = { ...supplied };
  const fontSize = opts.fontSize ?? 12;
  if (!Number.isFinite(fontSize) || fontSize < 6) throw new RangeError('fontSize must be finite and at least 6 CSS pixels');
  const context = snapshotControlComposition(opts.compositionContext);
  return withThemeView(input, async theme => {
    const sizeBase = opts.small ? 10171 : 10162, valueOff = opts.on ? 0 : 3;
    const requested = sizeBase + valueOff + (opts.pressed ? 0 : opts.disabled ? 2 : 1);
    let selected;
    for (const id of [requested, sizeBase + valueOff + 1, 10163]) {
      selected = resolveInChain(theme, owner => {
        const element = Object.values(owner.manifest.chromeElements ?? {}).find(e => e.sourceCicnId === -id && e.asset);
        return element ? { owner, element, id: -id } : null;
      });
      if (selected) break;
    }
    if (!selected) { observe({ stage: 'face-absent' }); return null; }
    const { owner, element, id } = selected;
    if (owner.manifest.cinfEnvironment) throw new Error('prototype: declared cinf environments unimplemented');
    const source = await owner.asset(element.asset).pixels();
    const label = opts.label ?? '';
    const measured = label ? rasterizeText(label, fontSize, '#000000') : null;
    let height = opts.height ?? (source.height <= 28 ? source.height : 20);
    if (opts.height === undefined && measured && measured.height > height) height = 20;
    const width = Math.max(opts.minWidth ?? (opts.small ? 18 : 22), (measured?.width ?? 0) + 16);
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 32767))
      throw new RangeError('proposal: allocation dimensions must be positive bounded integers');
    const out = PixelBuffer.alloc(width, height), D = rect(0, 0, height, width);
    const clip = context.clip.kind === 'rect' ? rect(context.clip.rect.y - context.controlOrigin[1],
      context.clip.rect.x - context.controlOrigin[0], context.clip.rect.y + context.clip.rect.h - context.controlOrigin[1],
      context.clip.rect.x + context.clip.rect.w - context.controlOrigin[0]) : undefined;
    const chain = await themeResourceChain(theme, [{ type: 'cicn', id }, { type: 'cinf', id }, { type: 'cinf', id: 0 }], {
      cinfBodies: [id, 0], bodyEnvironment: { owner, face: element, width, height, ...(clip ? { clip } : {}) },
      prepareSamples: prepared => prepareCinfFrameSamples(prepared, id, true, D, out, clip),
    });
    const icon = chain.getResource('cicn', id)?.value;
    const result = drawCinfFrame(out, chain, { id, cicn: icon?.pixmap, icon, dstRect: D, bodyFill: true,
      requireRawSamples: true, allocationOrigin: { x: context.controlOrigin[0], y: context.controlOrigin[1] },
      patternOffset: context.patternOrigin.status === 'known'
        ? { x: -context.patternOrigin.offset[0], y: -context.patternOrigin.offset[1] } : { x: 0, y: 0 },
    });
    if (result.unsupported) throw new Error(`proposal: ${result.unsupported}`);
    if (!result.drawn) { observe({ stage: 'cinf-absent', selectedId: id, cinfId: result.cinfId }); return null; }
    if (label) {
      const overridden = opts.fg !== undefined;
      if (!overridden && !result.colorsAvailable) throw new Error('proposal: label color unavailable');
      const css = color => `rgb(${color.r},${color.g},${color.b})`;
      const foreground = opts.fg ?? css(result.textRGB);
      const glyph = rasterizeText(label, fontSize, foreground);
      const x = Math.round((width - glyph.width) / 2), y = Math.round((height - glyph.height) / 2);
      if (!overridden && result.embossRGB) out.drawOver(rasterizeText(label, fontSize, css(result.embossRGB)), x + 1, y + 1);
      out.drawOver(glyph, x, y);
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      if (!controlPointVisible(context, x, y)) out.setPixel(x, y, 0, 0, 0, 0);
    return out;
  });
}
