// scripts/generate-platinum/atlas-layout.mjs
// SINGLE SOURCE OF TRUTH for the master sprite-atlas layout. Imported by BOTH
// the atlas generator (atlas.mjs) and the slicer (slice-atlas.mjs) so the
// painted PNG slices back to the exact same coordinates it was generated with.
//
// The atlas lays out all 26 base sprites (13 types × active/inactive) in a
// grid: one ROW per window type, two COLUMNS (active, inactive). Each sprite
// sits in a fixed cell with a label strip above it and padding around it, so a
// human can paint every sprite in one Photoshop document. The slicer reads each
// sprite back out of its `sprite` rect (the magenta slice lines + labels live
// in the padding/label band, never over the sprite, so they don't corrupt art).
import { geometryFor, WINDOW_TYPES } from './window-types.mjs';
import { FONT } from './atlas-font.mjs';

// Layout constants (px). Change here → both generator + slicer follow.
export const ATLAS = {
  pad: 12,          // gap between cells
  labelH: 14,       // label strip height above each sprite
  colGap: 24,       // gap between the active/inactive columns
  marginX: 16,      // left/right page margin
  marginY: 16,      // top/bottom page margin
  scale: 4,         // sprites are tiny (≤47px); draw at Nx so they're paintable
  states: ['active', 'inactive'],
};

/**
 * Compute the full atlas layout.
 * @returns {{
 *   width:number, height:number, scale:number,
 *   slots: Array<{
 *     slug:string, name:string, state:'active'|'inactive',
 *     cicnW:number, cicnH:number,                 // native sprite px
 *     sprite:{x:number,y:number,w:number,h:number}, // sprite rect in atlas px (scaled)
 *     label:{x:number,y:number,text:string},
 *     sliceLinesX:number[],  // vertical cut x's (atlas px, sprite-relative→absolute): cell boundaries
 *     sliceLineY:number|null // horizontal title/body divider y (atlas px), null if title-less
 *   }>
 * }}
 */
export function computeAtlasLayout() {
  const { pad, labelH, colGap, marginX, marginY, scale, states } = ATLAS;

  // Per-type native geometry.
  const geos = WINDOW_TYPES.map((cfg) => ({ cfg, geo: geometryFor(cfg) }));

  // Column width = widest sprite (scaled) across all types, so columns align.
  const maxW = Math.max(...geos.map(({ geo }) => geo.width)) * scale;

  const colX = states.map((_, i) => marginX + i * (maxW + colGap));
  // Page must hold both the sprite grid AND the (wider) labels, which can run
  // past the sprite cell for long type names. Size to whichever is wider.
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
    const rowSpriteY = y + labelH; // sprite sits below its label strip

    for (let s = 0; s < states.length; s++) {
      const state = states[s];
      const x = colX[s];
      // Vertical slice lines: the top-edge cell boundaries (leftFixed, leftFixed+fill).
      const cuts = [geo.leftFixed, geo.leftFixed + geo.fill];
      const sliceLinesX = cuts.map((c) => x + c * scale);
      // Horizontal divider: row `topFrame` (title/body), only when there's a title bar.
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

    // Advance to the next row by the tallest sprite in this row (both states equal).
    y = rowSpriteY + spriteH + pad;
  }

  const height = y - pad + marginY;
  return { width: rightEdge, height, scale, slots };
}
