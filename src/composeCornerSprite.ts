import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType } from './types.js';
import {
  type ComposedChrome,
  type Frame,
  type PlacementSlice,
} from './composeChrome.js';

// ───────────────────────────────────────────────────────────────────────────
// Corner-sprite window compositor — the classic Platinum WDEF (id 125) model,
// for look-only schemes that ship the document corner cicns + the pinstripe /
// grow-box sprites but NO wnd#/cinf recipe (apple-platinum-2, platinum-8,
// system7-nostalgia-silver). composeWindowChrome (the kDEF cicn 9-walk) can't
// render these — there is no `edges` recipe — so they would otherwise fall back
// to the apple-platinum-replica base. This draws their OWN window from their
// OWN sprites instead.
//
// Faithful to docs/spec/platinum-wdef125-decode.md (the WDEF 125 decode) and
// /tmp/kaleido-trace/kdef231_decomp.c. The Platinum frame is PROCEDURAL, not
// sliced from a corner bitmap:
//
//   • Title bar  = the `document-racing-stripes` cicn (-14331, 16×13 pinstripe)
//                  TILED across the title rect (anchored top, clipped to the
//                  title height).                          [WDEF 125 §0x5d0]
//   • Frame      = a 1px arithmetic ring in the header `frame` colour: top edge
//                  is the title-bar height (≈19px), sides/bottom 1px. [§0x434]
//   • Widgets    = ~7×7 beveled squares: close at title.left+4, zoom + collapse
//                  right-aligned (~7px apart).  [§0x1018 / §0x110e / §0x11fc]
//   • Grow box   = the `active-grow-box` cicn (-14330, 17×17) stamped at the
//                  bottom-right, over the frame.            [wGrow §0x1244]
//   • Body       = a transparent hole inside the frame (real DOM shows through).
//
// Returns the SAME `ComposedChrome` shape composeWindowChrome returns, so
// renderWindow.ts's downstream (canvas blit, title text, content inset) is
// shared. composeChrome.ts is NOT touched.
// ───────────────────────────────────────────────────────────────────────────

export interface CornerSpriteOptions {
  /** The pinstripe title-bar fill cicn (-14331), tiled across the title rect. */
  pinstripe: PixelBuffer;
  /** The grow-box cicn (-14330), stamped bottom-right. Omit to skip it. */
  growBox?: PixelBuffer | null;
  /** Header frame colour (theme.headerColors.<state>.frame). The 1px ring +
   *  widget outlines are drawn in this. Defaults to a mid grey. */
  frameColor?: string | undefined;
  /** Header fill colour (theme.headerColors.<state>.fill) — the widget face.
   *  Defaults to a light Platinum grey. */
  fillColor?: string | undefined;
  /** Measured title-text width (px) — reported as the title region for the
   *  centred title, mirroring composeWindowChrome's contract. */
  titleWidthPx?: number | undefined;
}

/** `#rgb` / `#rrggbb` → [r,g,b,255]; falls back to mid grey. */
function hexToRgba(hex: string | undefined, fallback: [number, number, number]): [number, number, number, number] {
  if (!hex) return [...fallback, 255];
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return [...fallback, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

/** Lighten an RGB toward white by `amt` (0..1) — the widget bevel highlight. */
function lighten(c: [number, number, number, number], amt: number): [number, number, number, number] {
  return [
    Math.round(c[0] + (255 - c[0]) * amt),
    Math.round(c[1] + (255 - c[1]) * amt),
    Math.round(c[2] + (255 - c[2]) * amt),
    255,
  ];
}
/** Darken an RGB toward black by `amt` (0..1) — the widget bevel shadow. */
function darken(c: [number, number, number, number], amt: number): [number, number, number, number] {
  return [Math.round(c[0] * (1 - amt)), Math.round(c[1] * (1 - amt)), Math.round(c[2] * (1 - amt)), 255];
}

/**
 * Compose a Platinum corner-sprite window into a pixel buffer at native
 * resolution. The content rect (contentW × contentH) is a transparent hole.
 * The frame thicknesses come from part-0's inset (synthesized by the extractor:
 * top ≈ 19, sides/bottom 1) the same way composeWindowChrome reads them — so the
 * full footprint and content inset stay consistent across both compositors.
 */
export function composeCornerSpriteChrome(
  windowType: WindowType,
  contentW: number,
  contentH: number,
  opts: CornerSpriteOptions,
): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeCornerSpriteChrome: windowType has no part-0 body rect');

  // The frame insets are arithmetic (the synthesized part-0 rect), not measured
  // from a corner bitmap — Platinum's frame is code-driven (WDEF 125 §"Frame &
  // bevel insets"). For the corner-sprite model the extractor stores part-0's
  // rect as the four frame THICKNESSES directly — [left, top, right, bottom] in
  // px (NOT classic Mac body coords) — so we read them straight through (no
  // cicn to measure against). Defaults to the Platinum 1px-sides / 19px-top
  // frame if a thickness is missing/negative.
  const frame: Frame = {
    left: Math.max(0, body.rect[0] || 1),
    top: Math.max(0, body.rect[1] || 19),
    right: Math.max(0, body.rect[2] || 1),
    bottom: Math.max(0, body.rect[3] || 1),
  };

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const ringRgba = hexToRgba(opts.frameColor, [85, 85, 85]); // #555
  const faceRgba = hexToRgba(opts.fillColor, [221, 221, 221]); // #ddd
  const titleH = frame.top; // top inset == title-bar height (≈19)

  const placement: PlacementSlice[] = [];

  // ── 1. title-bar fill: tile the pinstripe cicn across the title rect ───────
  // Anchored at (0,0), clipped to the title height; the cicn (16×13) is shorter
  // than the bar (≈19) — the WDEF tiles a code-baked AA00 stipple edge-to-edge,
  // so we tile the sprite on BOTH axes and clip, drawing the pinstripe rows the
  // sprite carries and leaving the residual band to the (later) frame/face.
  // First lay the header fill behind it so the gap below the 13px sprite reads
  // as the bar background rather than transparent.
  if (titleH > 0 && fullW > 0) {
    out.fillRect({ x: 0, y: 0, w: fullW, h: titleH }, faceRgba[0], faceRgba[1], faceRgba[2], 255);
    const pin = opts.pinstripe;
    if (pin.width > 0 && pin.height > 0) {
      for (let dy = 0; dy < titleH; dy += pin.height) {
        const hh = Math.min(pin.height, titleH - dy);
        for (let dx = 0; dx < fullW; dx += pin.width) {
          const ww = Math.min(pin.width, fullW - dx);
          // drawOver respects the sprite's alpha so transparent pinstripe gaps
          // keep the fill underneath; the seam at the tile boundary is the
          // sprite's own period (16px), matching the WDEF's tiled FillRect.
          out.copyBits(pin, { x: 0, y: 0, w: ww, h: hh }, { x: dx, y: dy, w: ww, h: hh });
        }
      }
    }
    placement.push({
      edge: 'top', code: 8, role: 'title pinstripe', mode: 'tile',
      src: { x: 0, y: 0, w: pin.width, h: pin.height },
      rects: [{ x: 0, y: 0, w: fullW, h: titleH }],
    });
  }

  // ── 2. 1px frame ring (header frame colour) ────────────────────────────────
  // Outer outline: top/left bright, bottom/right shadow in the WDEF; for this
  // milestone a uniform 1px ring is fine (matches buildBaselineWindow). Plus the
  // 1px under-line beneath the title bar.
  const ring = (rect: { x: number; y: number; w: number; h: number }): void => {
    out.fillRect({ x: rect.x, y: rect.y, w: rect.w, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255); // top
    out.fillRect({ x: rect.x, y: rect.y + rect.h - 1, w: rect.w, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255); // bottom
    out.fillRect({ x: rect.x, y: rect.y, w: 1, h: rect.h }, ringRgba[0], ringRgba[1], ringRgba[2], 255); // left
    out.fillRect({ x: rect.x + rect.w - 1, y: rect.y, w: 1, h: rect.h }, ringRgba[0], ringRgba[1], ringRgba[2], 255); // right
  };
  ring({ x: 0, y: 0, w: fullW, h: fullH });
  if (titleH > 0) {
    // under-line: the 1px frame line dividing the title bar from the body.
    out.fillRect({ x: 0, y: titleH - 1, w: fullW, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
  }
  placement.push({
    edge: 'top', code: 0, role: 'frame ring', mode: 'fixed',
    src: { x: 0, y: 0, w: 1, h: 1 }, rects: [{ x: 0, y: 0, w: fullW, h: fullH }],
  });

  // ── 3. widgets: ~7×7 beveled squares (close left, zoom + collapse right) ───
  // Geometry from WDEF 125 §"Box geometry": close left = title.left+4; zoom
  // right = title.right−11..−4 (4px from the right end); collapse just inboard
  // of the zoom box (~7px apart). Vertically centred in the title bar.
  const WBOX = 7;
  if (titleH >= WBOX + 2) {
    const wy = Math.max(1, Math.round((titleH - WBOX) / 2));
    const drawWidget = (wx: number): void => {
      // face
      out.fillRect({ x: wx, y: wy, w: WBOX, h: WBOX }, faceRgba[0], faceRgba[1], faceRgba[2], 255);
      // 1px outline in the frame colour
      out.fillRect({ x: wx, y: wy, w: WBOX, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx, y: wy + WBOX - 1, w: WBOX, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx, y: wy, w: 1, h: WBOX }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx + WBOX - 1, y: wy, w: 1, h: WBOX }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      // top/left highlight, bottom/right shadow — the raised bevel
      const hi = lighten(faceRgba, 0.5);
      const sh = darken(faceRgba, 0.18);
      out.fillRect({ x: wx + 1, y: wy + 1, w: WBOX - 2, h: 1 }, hi[0], hi[1], hi[2], 255); // top
      out.fillRect({ x: wx + 1, y: wy + 1, w: 1, h: WBOX - 2 }, hi[0], hi[1], hi[2], 255); // left
      out.fillRect({ x: wx + 1, y: wy + WBOX - 2, w: WBOX - 2, h: 1 }, sh[0], sh[1], sh[2], 255); // bottom
      out.fillRect({ x: wx + WBOX - 2, y: wy + 1, w: 1, h: WBOX - 2 }, sh[0], sh[1], sh[2], 255); // right
    };
    drawWidget(frame.left + 4 - 1 < 0 ? 2 : frame.left + 3); // close: ~4px from the left frame
    const rightZoom = fullW - frame.right - 4 - WBOX; // 4px from the right end
    drawWidget(Math.max(0, rightZoom));
    drawWidget(Math.max(0, rightZoom - WBOX - 2)); // collapse, ~7px inboard of zoom
    placement.push({
      edge: 'widget', code: 4, role: 'close/zoom/collapse', mode: 'stamp',
      src: { x: 0, y: 0, w: WBOX, h: WBOX },
      rects: [
        { x: frame.left + 3, y: wy, w: WBOX, h: WBOX },
        { x: Math.max(0, rightZoom), y: wy, w: WBOX, h: WBOX },
        { x: Math.max(0, rightZoom - WBOX - 2), y: wy, w: WBOX, h: WBOX },
      ],
    });
  }

  // ── 4. grow box: stamp the sprite at the bottom-right, over the frame ──────
  if (opts.growBox && opts.growBox.width > 0 && opts.growBox.height > 0) {
    const gb = opts.growBox;
    const gx = fullW - gb.width;
    const gy = fullH - gb.height;
    out.copyBits(gb, { x: 0, y: 0, w: gb.width, h: gb.height }, { x: gx, y: gy, w: gb.width, h: gb.height });
    placement.push({
      edge: 'widget', code: 10, role: 'grow box', mode: 'stamp',
      src: { x: 0, y: 0, w: gb.width, h: gb.height },
      rects: [{ x: gx, y: gy, w: gb.width, h: gb.height }],
    });
  }

  // The title region is the whole bar (the corner-sprite model has no measured
  // title-plate cell); renderWindow centres the title on it. Report the measured
  // width as a hint but span the full bar so centring matches the bar centre.
  const titleRegion = { x: 0, w: fullW };

  return {
    buffer: out,
    frame,
    fullWidth: fullW,
    fullHeight: fullH,
    titleRegion,
    titleFillSrcX: -1, // no cinf marker → renderWindow uses the declared header text colour
    placement,
  };
}
