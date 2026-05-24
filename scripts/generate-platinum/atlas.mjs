// scripts/generate-platinum/atlas.mjs
// Build the two sprite atlases (see atlas-layout.mjs for the layout contract):
//
//   buildPaintableAtlas() → sprite-atlas.png        (1× art, magenta gutters)
//     The hand-painting surface. Each sprite is drawn at 1× native into its
//     layout rect; the rects hold ONLY paintable art. Everything between/around
//     the sprite rects is a flat MAGENTA void so boundaries are unambiguous and
//     the slicer can copy each sprite rect 1:1 (the rect is pure art). No labels,
//     no slice lines drawn over the sprite pixels.
//
//   buildGuideAtlas()     → sprite-atlas-guide.png  (4× art + labels + cut lines)
//     The annotated read-only reference map: upscaled sprites, type+state labels,
//     and magenta slice lines (vertical cell boundaries + horizontal title/body
//     divider) drawn over each sprite. The painter consults this for where the
//     cuts fall; it is never sliced.
//
// Both share window geometry via atlas-layout.mjs / window-types.mjs, so the
// painted 1× atlas slices back to the exact source coordinates.
import { drawWindow } from './draw-window.mjs';
import { WINDOW_TYPES } from './window-types.mjs';
import { computePaintableLayout, computeGuideLayout } from './atlas-layout.mjs';
import { drawText } from './atlas-font.mjs';
import { PALETTE } from './palette.mjs';

const MAGENTA = [255, 0, 255];
const LABEL_INK = [20, 20, 20];
const PAGE_BG = [245, 245, 245];     // light page so sprites + magenta read
const SPRITE_BG = [255, 255, 255];   // backing behind each sprite cell

function makeCanvas(width, height, bg) {
  const rgba = new Uint8Array(width * height * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4; rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, bg);
  return { rgba, set };
}

/** Draw all type sprites once (both states share geometry). */
function drawAllSprites(palette) {
  const bySlug = {};
  for (const cfg of WINDOW_TYPES) bySlug[cfg.slug] = drawWindow(cfg, palette);
  return bySlug;
}

/**
 * PAINTABLE atlas: 1× sprites, magenta gutter void, no overlays.
 * @returns {{width:number, height:number, rgba:Uint8Array, layout:object}}
 */
export function buildPaintableAtlas(palette = PALETTE) {
  const layout = computePaintableLayout();
  const { width, height, scale } = layout;
  // The whole page is the MAGENTA void; sprite rects are punched in with white
  // backing then painted. This guarantees everything outside a sprite rect is
  // unambiguous void the slicer never reads.
  const { rgba, set } = makeCanvas(width, height, MAGENTA);

  const drawnBySlug = drawAllSprites(palette);
  for (const slot of layout.slots) {
    const img = drawnBySlug[slot.slug][slot.state];
    const { x: sx, y: sy } = slot.sprite;

    // White backing across the EXACT sprite rect (so transparent sprite px read
    // as white, not magenta — the rect is pure art for a clean 1:1 slice).
    for (let dy = 0; dy < slot.sprite.h; dy++)
      for (let dx = 0; dx < slot.sprite.w; dx++) set(sx + dx, sy + dy, SPRITE_BG);

    // Blit the sprite at 1× (scale === 1); skip transparent px so backing shows.
    for (let py = 0; py < img.height; py++) {
      for (let px = 0; px < img.width; px++) {
        const si = (py * img.width + px) * 4;
        if (img.rgba[si + 3] === 0) continue;
        const c = [img.rgba[si], img.rgba[si + 1], img.rgba[si + 2]];
        for (let oy = 0; oy < scale; oy++) for (let ox = 0; ox < scale; ox++)
          set(sx + px * scale + ox, sy + py * scale + oy, c);
      }
    }
  }
  return { width, height, rgba, layout };
}

/**
 * REFERENCE MAP: 4× sprites with labels + magenta slice lines over the art.
 * @returns {{width:number, height:number, rgba:Uint8Array, layout:object}}
 */
export function buildGuideAtlas(palette = PALETTE) {
  const layout = computeGuideLayout();
  const { width, height, scale } = layout;
  const { rgba, set } = makeCanvas(width, height, PAGE_BG);

  const drawnBySlug = drawAllSprites(palette);
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
