// Public Boolean/caller environment and browser font policies around checkables.draw.
import type { LoadedTheme } from './types.js';
import { PixelBuffer } from './pixelBuffer.js';
import { themeResourceChain } from './engine/resources/theme.js';
import { createTrace, type EngineTrace } from './engine/trace.js';
import { checkableResourceIds, drawCheckable, type CheckableCicn } from './engine/families/checkables.js';
import { CHECKABLE_FACADE as F } from './engine/tables/checkables.js';

export interface CheckableOptions {
  label?: string; checked?: boolean; mixed?: boolean; disabled?: boolean; fg?: string;
  /** Completed engine trace, including unknown provider/decode outcomes. */
  onTrace?: (trace: EngineTrace) => void;
}
/** Unknown input is never returned as NULL: NULL means the declared environment
 * proved that no selected art exists. Browser typography and transparent erases
 * are public composition policies, not original Toolbox observations. */
export async function composeEngineCheckable(theme: LoadedTheme, kind: 'checkbox' | 'radio', opts: CheckableOptions = {}): Promise<PixelBuffer | null> {
  const input = { variation: kind === 'checkbox' ? 1 : 2, value: opts.mixed ? 2 : opts.checked ? 1 : 0,
    hilite: opts.disabled ? 255 : 0, acidAlternate: false, colorPort: true, lowDepth: false,
    colorIconMapAvailable: true, eraseControl: false, label: opts.label ?? '' };
  const trace = createTrace('checkables', input);
  trace.drawOps.push({ op: 'environment', policy: 'public Boolean mapping; acidAlternate=false; archive/base chain stands in for cicn loader and System-file environment; control-panel art not shipped; transparent erase; browser font and alpha-over text substitute (native glyph/device text transfer unknown)' });
  try {
    const seen = new Set<LoadedTheme>();
    for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base) {
      seen.add(t);
      if (!t.inspector?.cicnResources) trace.drawOps.push({ op: 'environment', policy: 'older manifest: cicn presence is the declared manifest environment; original raw census unknown', owner: t.baseUrl });
    }
    const wanted = checkableResourceIds(input);
    const chain = await themeResourceChain(theme, wanted, { checkables: true });
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('checkable label canvas unavailable');
    ctx.font = `${F.fontSize}px Chicago, "Charcoal", Geneva, sans-serif`;
    const metrics = ctx.measureText('M');
    const fontMetrics = { ascent: Math.ceil(metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent),
      descent: Math.ceil(metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent), leading: 0 };
    const labelWidth = Math.max(0, ...input.label.split('\r').map(s => Math.ceil(ctx.measureText(s).width)));
    // Allocation surrounds full source rectangles, never mask-set bounds.
    let maxWidth = 16, maxHeight = 16;
    for (const p of chain.providers) for (const r of wanted) if (r.type === 'cicn') {
      const art = p.get(r.type, r.id) as CheckableCicn | null;
      if (art?.pixmap) { maxWidth = Math.max(maxWidth, art.pixmap.width); maxHeight = Math.max(maxHeight, art.pixmap.height); }
    }
    const padX = Math.max(0, Math.trunc(maxWidth / 2) - 8), padY = Math.ceil(maxHeight / 2);
    const D = { left: padX, top: padY, right: padX + (input.label ? 18 + labelWidth : 16), bottom: padY + F.height };
    const out = PixelBuffer.alloc(D.right + maxWidth, D.bottom + maxHeight);
    const result = drawCheckable(out, chain, { ...input, rect: D }, {
      systemResources: chain, fontMetrics,
      // Transparent backing is the declared modern background plane. Native
      // 1-bit foreground/background RGB is unavailable, so no mapping is supplied.
      erase: (r, mask) => {
        for (let y = Math.max(0, r.top); y < Math.min(out.height, r.bottom); y++) for (let x = Math.max(0, r.left); x < Math.min(out.width, r.right); x++) {
          const sx = x - r.left + (mask ? mask.bounds.left - mask.storageOrigin.x : 0);
          const sy = y - r.top + (mask ? mask.bounds.top - mask.storageOrigin.y : 0);
          if (!mask || !mask.source.data[(sy * mask.source.width + sx) * 4 + 3]) out.setPixel(x, y, 0, 0, 0, 0);
        }
      },
      drawLabel: pass => {
        canvas.width = out.width; canvas.height = out.height;
        ctx.font = `${F.fontSize}px Chicago, "Charcoal", Geneva, sans-serif`; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = opts.fg ?? F.foreground;
        ctx.save(); ctx.beginPath(); ctx.rect(D.left, D.top, D.right - D.left, D.bottom - D.top); ctx.clip();
        for (const line of pass.lines) ctx.fillText(line.text, line.x, line.baseline);
        ctx.restore(); out.drawOver(new PixelBuffer(out.width, out.height, ctx.getImageData(0, 0, out.width, out.height).data), 0, 0);
      },
    }, trace);
    if (result.unsupported) throw new Error(`Unsupported checkable output: ${result.unsupported}`);
    if (!result.drawn) return null;
    const bounds = [D, ...trace.drawOps.filter(o => o.dst && (o.operation === 'cornerFullBounds' || o.transfer)).map(o => o.dst!)];
    const left = Math.min(...bounds.map(r => r.left)), top = Math.min(...bounds.map(r => r.top));
    const right = Math.max(...bounds.map(r => r.right)), bottom = Math.max(...bounds.map(r => r.bottom));
    const cropped = PixelBuffer.alloc(right - left, bottom - top);
    cropped.copyBits(out, { x: left, y: top, w: cropped.width, h: cropped.height }, { x: 0, y: 0, w: cropped.width, h: cropped.height });
    return cropped;
  } finally { opts.onTrace?.(trace); }
}
