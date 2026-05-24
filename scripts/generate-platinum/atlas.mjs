// scripts/generate-platinum/atlas.mjs
// Build the MASTER sprite atlas: one PNG laying out all 26 base sprites (13
// window types × active/inactive) in a grid, each drawn at ATLAS.scale, labeled
// with its type+state, and overlaid with MAGENTA slice lines (vertical = top-
// edge cell boundaries, horizontal = title/body divider) so a human can paint
// the whole set in one Photoshop doc. The layout comes from atlas-layout.mjs
// (shared with the slicer) so painted art slices back to the exact coordinates.
//
// Run via scripts/generate-platinum-atlas.mjs.
import { drawWindow } from './draw-window.mjs';
import { WINDOW_TYPES } from './window-types.mjs';
import { computeAtlasLayout } from './atlas-layout.mjs';
import { drawText } from './atlas-font.mjs';
import { PALETTE } from './palette.mjs';

const MAGENTA = [255, 0, 255];
const LABEL_INK = [20, 20, 20];
const PAGE_BG = [245, 245, 245];     // light page so sprites + magenta read
const SPRITE_BG = [255, 255, 255];   // backing behind each sprite cell

/**
 * Render the atlas to an RGBA buffer.
 * @returns {{width:number, height:number, rgba:Uint8Array, layout:object}}
 */
export function buildAtlas(palette = PALETTE) {
  const layout = computeAtlasLayout();
  const { width, height, scale } = layout;
  const rgba = new Uint8Array(width * height * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4; rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  };
  // Page background.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, PAGE_BG);

  // Draw each type once (both states share geometry).
  const drawnBySlug = {};
  for (const cfg of WINDOW_TYPES) drawnBySlug[cfg.slug] = drawWindow(cfg, palette);

  for (const slot of layout.slots) {
    const img = drawnBySlug[slot.slug][slot.state];
    const { x: sx, y: sy } = slot.sprite;

    // White backing behind the sprite cell (so transparent sprite px read).
    for (let dy = -1; dy < slot.sprite.h + 1; dy++)
      for (let dx = -1; dx < slot.sprite.w + 1; dx++) set(sx + dx, sy + dy, SPRITE_BG);

    // Blit the sprite at `scale` (nearest-neighbour); skip transparent px.
    for (let py = 0; py < img.height; py++) {
      for (let px = 0; px < img.width; px++) {
        const si = (py * img.width + px) * 4;
        if (img.rgba[si + 3] === 0) continue;
        const c = [img.rgba[si], img.rgba[si + 1], img.rgba[si + 2]];
        for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++)
          set(sx + px * scale + ox, sy + py * scale + oy, c);
      }
    }

    // Magenta slice lines OVER the sprite: vertical at the cell boundaries.
    for (const lx of slot.sliceLinesX)
      for (let dy = 0; dy < slot.sprite.h; dy++) set(lx, sy + dy, MAGENTA);
    // Horizontal title/body divider (only when there's a title bar).
    if (slot.sliceLineY != null)
      for (let dx = 0; dx < slot.sprite.w; dx++) set(sx + dx, slot.sliceLineY, MAGENTA);

    // Label above the sprite.
    drawText(set, slot.label.x, slot.label.y + 3, slot.label.text, LABEL_INK);
  }

  return { width, height, rgba, layout };
}
