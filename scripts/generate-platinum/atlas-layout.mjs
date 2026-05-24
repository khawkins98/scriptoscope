// scripts/generate-platinum/atlas-layout.mjs
// SINGLE SOURCE OF TRUTH for the sprite-atlas layouts. Imported by BOTH the atlas
// generator (atlas.mjs) and the slicer (slice-atlas.mjs) so the painted PNG
// slices back to the exact same coordinates it was generated with.
//
// There are TWO atlas variants, both produced from the same grid math:
//
//   • PAINTABLE atlas  → sprite-atlas.png        (scale 1, NO labels/lines)
//       Sprites drawn at 1× native, laid in a 2-column grid (active|inactive),
//       one row per type. Sprites are separated by MAGENTA gutters so their
//       boundaries are unambiguous and the slicer can copy each sprite rect 1:1.
//       The sprite rects contain ONLY paintable art — no labels, no slice lines.
//       This is what the artist paints (zoom in your editor for 1px work).
//
//   • REFERENCE MAP   → sprite-atlas-guide.png    (scale 4, WITH labels/lines)
//       Upscaled, labelled (type+state), with magenta vertical slice lines + the
//       horizontal title/body divider drawn OVER each sprite. Read-only guide the
//       painter consults to see where the cuts fall. Never sliced.
//
// The slicer uses the PAINTABLE layout (scale 1): each slot exposes its sprite's
// (x,y,w,h) in atlas px, which at scale 1 equals native cicn px — a clean 1:1 cut.
import { geometryFor, WINDOW_TYPES } from './window-types.mjs';
import { FONT } from './atlas-font.mjs';

// Shared layout constants (px, in *native* units unless noted).
export const ATLAS = {
  states: ['active', 'inactive'],
  // Paintable atlas: 1× art, magenta gutters, no labels.
  paintable: { scale: 1, gutter: 4, margin: 4 },
  // Reference map: 4× art, label strips, slice lines drawn over the sprites.
  guide: { scale: 4, pad: 12, labelH: 14, colGap: 24, marginX: 16, marginY: 16 },
};

/**
 * Compute the PAINTABLE (1×) atlas layout. Tight grid of native-size sprites,
 * separated by magenta gutters; no labels, no over-art slice lines.
 *
 * @returns {{
 *   variant:'paintable', width:number, height:number, scale:number, gutter:number,
 *   slots: Array<{
 *     slug:string, name:string, state:'active'|'inactive',
 *     cicnW:number, cicnH:number,                       // native sprite px
 *     sprite:{x:number,y:number,w:number,h:number},     // sprite rect in atlas px (== native at 1×)
 *     gutterCutsX:number[],  // internal vertical cut x's, in GUTTER coords (never inside the sprite rect)
 *   }>
 * }}
 */
export function computePaintableLayout() {
  const { states } = ATLAS;
  const { scale, gutter, margin } = ATLAS.paintable;
  const geos = WINDOW_TYPES.map((cfg) => ({ cfg, geo: geometryFor(cfg) }));

  // Column width = widest sprite across all types, so the two columns align.
  // Page columns: [margin][gutter][col0][gutter][col1][gutter][margin].
  const maxW = Math.max(...geos.map(({ geo }) => geo.width)) * scale;
  const colX = states.map((_, i) => margin + gutter + i * (maxW + gutter));
  const pageWidth = margin + states.length * (gutter + maxW) + gutter + margin;

  const slots = [];
  let y = margin + gutter; // first row sits below the top margin + a gutter
  for (const { cfg, geo } of geos) {
    const spriteW = geo.width * scale;
    const spriteH = geo.height * scale;
    for (let s = 0; s < states.length; s++) {
      const state = states[s];
      const x = colX[s];
      // Internal vertical cuts (cell boundaries), placed for reference only. We
      // expose them in GUTTER space conceptually — but for the paintable atlas we
      // never draw inside the sprite rect, so these are just the absolute x's of
      // the cell boundaries (the slicer does NOT use them; it copies 1:1).
      const cuts = [geo.leftFixed, geo.leftFixed + geo.fill].map((c) => x + c * scale);
      slots.push({
        slug: cfg.slug,
        name: cfg.name,
        state,
        cicnW: geo.width,
        cicnH: geo.height,
        sprite: { x, y, w: spriteW, h: spriteH },
        gutterCutsX: cuts,
      });
    }
    y += spriteH + gutter; // advance past the sprite + its bottom gutter
  }

  const pageHeight = y + margin; // bottom margin after the last gutter
  return { variant: 'paintable', width: pageWidth, height: pageHeight, scale, gutter, slots };
}

/**
 * Compute the REFERENCE-MAP (4×) atlas layout: upscaled sprites with label strips
 * and magenta slice lines drawn over each sprite. This is the legacy annotated
 * style, kept as a read-only guide.
 *
 * @returns {{
 *   variant:'guide', width:number, height:number, scale:number,
 *   slots: Array<{
 *     slug, name, state, cicnW, cicnH,
 *     sprite:{x,y,w,h}, label:{x,y,text},
 *     sliceLinesX:number[],  // vertical cut x's (atlas px) — drawn over the sprite
 *     sliceLineY:number|null // horizontal title/body divider y (atlas px)
 *   }>
 * }}
 */
export function computeGuideLayout() {
  const { states } = ATLAS;
  const { scale, pad, labelH, colGap, marginX, marginY } = ATLAS.guide;
  const geos = WINDOW_TYPES.map((cfg) => ({ cfg, geo: geometryFor(cfg) }));

  const maxW = Math.max(...geos.map(({ geo }) => geo.width)) * scale;
  const colX = states.map((_, i) => marginX + i * (maxW + colGap));
  const charW = FONT.w + FONT.gap;
  const longestLabel = Math.max(...WINDOW_TYPES.map((c) => `${c.name} - inactive`.length)) * charW;
  const gridRight = colX[states.length - 1] + maxW + marginX;
  const labelRight = colX[states.length - 1] + longestLabel + marginX;
  const rightEdge = Math.max(gridRight, labelRight);

  const slots = [];
  let y = marginY;
  for (const { cfg, geo } of geos) {
    const spriteW = geo.width * scale;
    const spriteH = geo.height * scale;
    const rowSpriteY = y + labelH;
    for (let s = 0; s < states.length; s++) {
      const state = states[s];
      const x = colX[s];
      const cuts = [geo.leftFixed, geo.leftFixed + geo.fill];
      const sliceLinesX = cuts.map((c) => x + c * scale);
      const sliceLineY = geo.hasTitle ? rowSpriteY + geo.topFrame * scale : null;
      slots.push({
        slug: cfg.slug,
        name: cfg.name,
        state,
        cicnW: geo.width,
        cicnH: geo.height,
        sprite: { x, y: rowSpriteY, w: spriteW, h: spriteH },
        label: { x, y, text: `${cfg.name} - ${state}` },
        sliceLinesX,
        sliceLineY,
      });
    }
    y = rowSpriteY + spriteH + pad;
  }

  const height = y - pad + marginY;
  return { variant: 'guide', width: rightEdge, height, scale, slots };
}
