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
//   • Title bar  = a per-type racing-stripe cicn (e.g. -14331 document, -14321
//                  alert, -14325 dialog, -14314 utility — each 16×13 / 9×9) TILED
//                  across the title rect (anchored top, clipped to the title
//                  height). OMITTED for title-LESS frames (alert/dialog/no-title
//                  utility): those draw only the ring.       [WDEF 125 §0x5d0]
//   • Frame      = a 1px arithmetic ring in the header `frame` colour: top edge
//                  is the title-bar height (≈19/16/11px) or 1px when title-less;
//                  sides/bottom 1px.                          [§0x434]
//   • Widgets    = ~7×7 beveled squares, a PER-TYPE set (opts.widgets): document
//                  = close + collapse + zoom; movable-modal/movable-alert/titled-
//                  utility = close only; side/no-title = none. close at
//                  title.left+4, collapse/zoom right-aligned (~7px apart).
//                                            [§0x1018 / §0x110e / §0x11fc]
//   • Grow box   = the `active-grow-box` cicn (-14330 / utility -14313, 16-17px)
//                  stamped at the bottom-right, over the frame.   [wGrow §0x1244]
//   • Body       = a transparent hole inside the frame (real DOM shows through).
//
// Drives every apple-platinum-2 window TYPE (document, alert, dialog, movable-
// modal/alert, titled/side/no-title utility + their collapsed variants) from the
// scheme's OWN sprites; the per-type recipe (slug, sprite ids, title height,
// title-less flag, widget set) is the table in buildThemeJson.js.
//
// Returns the SAME `ComposedChrome` shape composeWindowChrome returns, so
// renderWindow.ts's downstream (canvas blit, title text, content inset) is
// shared. composeChrome.ts is NOT touched.
// ───────────────────────────────────────────────────────────────────────────

export interface CornerSpriteOptions {
  /** The pinstripe title-bar fill cicn (-14331), tiled across the title rect.
   *  Omit (null/undefined) for a title-LESS frame (alert/dialog/no-title
   *  utility): no pinstripe bar is drawn, just the 1px frame ring. */
  pinstripe?: PixelBuffer | null;
  /** The grow-box cicn (-14330), stamped bottom-right. Omit to skip it. */
  growBox?: PixelBuffer | null;
  /** The window-frame proxy cicn (-14332 active / -14336 inactive, = chrome.active/
   *  inactive). When present it is FRAME-EXTRACTED — the 8 border cells 9-sliced
   *  (corners 1:1, edges stretched) with the centre left TRANSPARENT (the content
   *  hole) — to draw the scheme's OWN beveled frame + corners that scale, instead of
   *  the procedural bevel. ("Slice around the centre.") Distinct from the same-id
   *  ics4 widget glyph (dual channel: cicn = frame, ics4 = pressed-zoom widget). */
  frameCicn?: PixelBuffer | null;
  /** Header frame colour (theme.headerColors.<state>.frame). The 1px ring +
   *  widget outlines are drawn in this. Defaults to a mid grey. */
  frameColor?: string | undefined;
  /** Header fill colour (theme.headerColors.<state>.fill) — the widget face.
   *  Defaults to a light Platinum grey. */
  fillColor?: string | undefined;
  /** The scheme's bevel highlight / shadow tones (manifest headerColors
   *  `lightBevel` / `darkBevel`, sampled per state at extract time). When both
   *  are present the side/bottom frame is drawn as a RAISED GRAY PANEL (~3px:
   *  dark outline + face + top/left highlight + bottom/right shadow) instead of a
   *  flat 1px ring — the classic Mac window frame. Omit ⇒ the flat 1px ring. */
  lightBevel?: string | undefined;
  darkBevel?: string | undefined;
  /** Measured title-text width (px) — reported as the title region for the
   *  centred title, mirroring composeWindowChrome's contract. */
  titleWidthPx?: number | undefined;
  /** Which widget glyphs sit in the title bar, left→right. `close` anchors at
   *  the left; `collapse`/`zoom` anchor right (zoom outermost). Defaults to the
   *  document set [close, collapse, zoom] so the existing render is unchanged.
   *  Empty ⇒ no widgets (utility/side palettes). */
  widgets?: ('close' | 'collapse' | 'zoom')[] | undefined;
  /**
   * The scheme's OWN ics4 widget pictograms, keyed by role. When a glyph is
   * supplied it is stamped 1:1 (the glyph carries its own face + bevel) at the
   * widget's anchor INSTEAD of the fabricated beveled square, and the widget's
   * box takes the glyph's size so it renders at native scale. The anchor points
   * (close left, zoom 4px from right, collapse inboard) are unchanged and the
   * recorded placement rect tracks the real drawn box, so interactive.ts's
   * hit-zones line up with the glyph. Roles with no glyph fall back to the
   * procedural square.
   *
   * The corner-sprite Platinum-family schemes (apple-platinum-2, platinum-8,
   * system7-nostalgia-silver) author these as ics4 in the -14336..-14331 family
   * — NORMAL state: close -14336 / zoom -14335 / collapse -14334; PRESSED state:
   * close -14333 / zoom -14332 / collapse -14331 (pressed rendering is wired in
   * interactive.ts, a separate follow-up). renderWindow loads the normal trio
   * and passes them here. */
  widgetGlyphs?: Partial<Record<'close' | 'collapse' | 'zoom', PixelBuffer | null>> | undefined;
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

/** Most-common opaque colour in a region of `buf` — the title bar's BACKGROUND
 *  (the stripe gaps dominate the thin stripes), so it's right for both a light
 *  bar (ap2) and a dark one (black-platinum's black-with-white-stripes). */
function dominantColor(buf: PixelBuffer, x0: number, y0: number, w: number, h: number, fallback: [number, number, number, number]): [number, number, number, number] {
  const counts = new Map<number, number>();
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 2) {
    const [r, g, b, a] = buf.getPixel(x, y);
    if (a < 200) continue;
    const k = (r << 16) | (g << 8) | b;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = -1, bk = -1;
  for (const [k, c] of counts) if (c > best) { best = c; bk = k; }
  return bk < 0 ? fallback : [(bk >> 16) & 255, (bk >> 8) & 255, bk & 255, 255];
}

/** Is a title-bar stripe sprite a HORIZONTAL-LINE pattern (each row ~uniform across
 *  the width — the document/dialog racing stripes) vs a per-column pattern (the
 *  utility DOTS)? Line patterns are STRETCHED on X (one interior column scaled across
 *  the run) so the sprite's right-edge margin can't tile into a repeating vertical
 *  seam — apple-platinum-2's stripes stop ~2px short of the edge, which tiled into a
 *  "sliced" look. Dot patterns are TILED (stretching a column would smear the dots).
 *  Tests interior columns only (skips the edge margin where the seam lives). */
function isHorizontalLineStripe(pin: PixelBuffer): boolean {
  const w = pin.width, h = pin.height;
  if (w < 6 || h < 2) return false;
  let uniform = 0;
  for (let y = 0; y < h; y += 1) {
    const f = pin.getPixel(2, y);
    let ok = true;
    for (let x = 3; x < w - 2; x += 1) {
      const p = pin.getPixel(x, y);
      if (Math.abs(p[0] - f[0]) + Math.abs(p[1] - f[1]) + Math.abs(p[2] - f[2]) > 60) { ok = false; break; }
    }
    if (ok) uniform += 1;
  }
  return uniform >= h * 0.75;
}

/**
 * FRAME-EXTRACT a window-frame proxy cicn (e.g. -14332): copy the 8 BORDER cells
 * — 4 corners + 4 edges (edges stretched along their run) — and leave the CENTRE
 * untouched (the transparent content hole / the title fill already drawn). "Slice
 * AROUND the centre." The proxy's bevel is hairline at 16px, so each border cell is
 * scaled up by `scale` (the Platinum frame reads ~2× the proxy's border) → the dest
 * border is `cSrc × scale` px thick. `cSrc` = source px forming a corner/edge.
 */
function frameExtract(out: PixelBuffer, src: PixelBuffer, cSrc: number, scale: number, fullW: number, fullH: number, drawTopEdge = true): void {
  const S = src.width, Sh = src.height;
  const cs = Math.max(1, Math.min(cSrc, Math.floor((Math.min(S, Sh) - 1) / 2)));
  const C = Math.max(cs, Math.round(cs * scale)); // dest border thickness (scale may be fractional)
  const cp = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void =>
    out.copyBits(src, { x: sx, y: sy, w: sw, h: sh }, { x: dx, y: dy, w: dw, h: dh });
  const midSW = S - cs * 2, midSH = Sh - cs * 2;       // source middle spans
  const midDW = fullW - C * 2, midDH = fullH - C * 2;  // dest middle spans
  cp(0, 0, cs, cs, 0, 0, C, C);                                   // TL
  cp(S - cs, 0, cs, cs, fullW - C, 0, C, C);                      // TR
  cp(0, Sh - cs, cs, cs, 0, fullH - C, C, C);                     // BL
  cp(S - cs, Sh - cs, cs, cs, fullW - C, fullH - C, C, C);        // BR
  if (midDW > 0 && midSW > 0) {
    // The TOP edge carries the proxy's title-band detail, which smears across a
    // titled bar — skip it there (the racing-stripes own the bar); keep it for
    // title-less frames. The top CORNERS are always drawn (the beveled joins).
    if (drawTopEdge) cp(cs, 0, midSW, cs, C, 0, midDW, C);        // top edge
    cp(cs, Sh - cs, midSW, cs, C, fullH - C, midDW, C);           // bottom edge
  }
  if (midDH > 0 && midSH > 0) {
    cp(0, cs, cs, midSH, 0, C, C, midDH);                         // left edge
    cp(S - cs, cs, cs, midSH, fullW - C, C, C, midDH);            // right edge
  }
  // centre cell deliberately NOT copied → stays the content hole / title fill.
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

  // Beveled-frame mode: when the scheme ships a bevel palette (headerColors
  // lightBevel/darkBevel, sampled per state at extract time), the frame is drawn
  // as a RAISED GRAY PANEL instead of a flat 1px line. The thin synthesized sides
  // (1px) are widened so the bevel reads — footprint grows ~2px/side, faithful to
  // the System 7 / Platinum chunkier frame. Applies to TITLED windows (left/right/
  // bottom; top is the title bar) AND to TITLE-LESS framed boxes (dialog/alert —
  // no pinstripe — which bevel all 4 sides, top included).
  const beveled = !!(opts.lightBevel && opts.darkBevel && opts.fillColor);
  if (beveled) {
    frame.left = Math.max(frame.left, 3);
    frame.right = Math.max(frame.right, 3);
    frame.bottom = Math.max(frame.bottom, 3);
    if (!opts.pinstripe) frame.top = Math.max(frame.top, 3); // title-less ⇒ beveled top band too
  }

  // FRAME-EXTRACTED mode: the scheme ships a window-frame proxy cicn (-14332 active /
  // -14336 inactive) → frame-extract it (border cells, transparent centre) for the
  // beveled frame + corners that scale, instead of the procedural bevel. The proxy's
  // bevel is hairline at 16px, so the border cells are scaled 2× (owner-confirmed).
  const FRAME_SCALE = 1;
  const FRAME_CSRC = 5; // source px per corner / edge cross-section: the proxy's outer
                        // bevel PLUS its inner shadow/highlight row (4 trimmed that
                        // inner px into the discarded centre — the inner shading read wrong)
  const useFrame = !!(opts.frameCicn && opts.frameCicn.width >= 8 && opts.frameCicn.height >= 8);
  if (useFrame) {
    const C = Math.max(FRAME_CSRC, Math.round(FRAME_CSRC * FRAME_SCALE));
    frame.left = Math.max(frame.left, C);
    frame.right = Math.max(frame.right, C);
    frame.bottom = Math.max(frame.bottom, C);
  }

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const ringRgba = hexToRgba(opts.frameColor, [85, 85, 85]); // #555
  const faceRgba = hexToRgba(opts.fillColor, [221, 221, 221]); // #ddd
  const hiBevelRgba = hexToRgba(opts.lightBevel, [221, 221, 221]); // headerColors.lightBevel
  const shBevelRgba = hexToRgba(opts.darkBevel, [136, 136, 136]); // headerColors.darkBevel
  const titleH = frame.top; // top inset == title-bar height (≈19, or 1 if title-less)

  // A real, paintable title BAR needs both a pinstripe sprite AND a top inset
  // tall enough to be a bar (not the 1px frame band of a title-less alert/dialog
  // /no-title-utility). Title-less frames draw only the 1px ring (no pinstripe,
  // no under-line, no widgets) — the WDEF model for those window classes.
  const hasTitleBar = !!opts.pinstripe && titleH >= 6;
  const widgets = opts.widgets ?? ['close', 'collapse', 'zoom'];

  const placement: PlacementSlice[] = [];

  // ── Title-bar widget LAYOUT (positions only) ───────────────────────────────
  // Resolved up front so the pinstripe (§1) can be BOUNDED to the gaps between the
  // controls; the glyphs themselves are stamped in §3 from this same layout.
  // Geometry (WDEF 125 §"Box geometry"): close = title.left+3; zoom 4px from the
  // right end; collapse inboard of zoom; each vertically centred. WBOX sizes the
  // fabricated box for any role a scheme ships no glyph for.
  const WBOX = Math.max(7, Math.min(13, titleH - 7));
  const widgetsActive = hasTitleBar && titleH >= WBOX + 2 && widgets.length > 0;
  const boxOf = (role: 'close' | 'collapse' | 'zoom'): { w: number; h: number; glyph: PixelBuffer | null } => {
    const g = opts.widgetGlyphs?.[role];
    if (g && g.width > 0 && g.height > 0 && g.height <= titleH - 1) return { w: g.width, h: g.height, glyph: g };
    return { w: WBOX, h: WBOX, glyph: null };
  };
  const widgetLayout: { glyph: 'close' | 'collapse' | 'zoom'; x: number; y: number; w: number; h: number }[] = [];
  if (widgetsActive) {
    if (widgets.includes('close')) {
      const b = boxOf('close');
      const x = frame.left + 4 - 1 < 0 ? 2 : frame.left + 3;
      widgetLayout.push({ glyph: 'close', x, y: Math.max(1, Math.round((titleH - b.h) / 2)), w: b.w, h: b.h });
    }
    let rx = -1; // sentinel: compute from fullW on the first right widget
    for (const glyph of ['zoom', 'collapse'] as const) {
      if (!widgets.includes(glyph)) continue;
      const b = boxOf(glyph);
      if (rx < 0) rx = fullW - frame.right - 4 - b.w; // zoom: 4px from the right end
      const x = Math.max(0, rx);
      widgetLayout.push({ glyph, x, y: Math.max(1, Math.round((titleH - b.h) / 2)), w: b.w, h: b.h });
      rx = Math.max(0, x - b.w - 2);
    }
  }

  // ── 1. title bar: a header-fill FACE with the pinstripe INSET into it ───────
  // The racing-stripe sprite is NOT painted edge-to-edge over the whole bar (that
  // buried the widgets + ran the stripes to the very top/bottom). Per the references
  // it sits in a band INSET a couple px top/bottom, BOUNDED to the gaps between the
  // controls (≈5px clear of the close box and the zoom/collapse boxes), with the
  // centred title plate cut out. The bar BACKGROUND (margins + widget gaps + title
  // plate) is the header fill — except a dark-bar scheme (black-platinum paints
  // white-on-black, but its face clut is a misleading light grey) where we take the
  // sprite's own dark ground so the whole bar reads black. Sprite tiles on X
  // (repeat), clipped to the band on Y.
  if (hasTitleBar && fullW > 0) {
    const pin = opts.pinstripe!;
    const spriteBg = dominantColor(pin, 0, 0, pin.width, pin.height, faceRgba);
    const spriteLum = 0.299 * spriteBg[0] + 0.587 * spriteBg[1] + 0.114 * spriteBg[2];
    const barBg = spriteLum < 96 ? spriteBg : faceRgba; // dark-bar schemes keep their black ground
    out.fillRect({ x: 0, y: 0, w: fullW, h: titleH }, barBg[0], barBg[1], barBg[2], 255);
    // Centred title plate = a gap in the stripes for the title text (already the bar
    // ground, since the stripe segments below exclude it).
    let plateX = -1, plateW = 0;
    if (opts.titleWidthPx && opts.titleWidthPx > 4 && titleH > 3) {
      plateW = Math.min(fullW - 4, opts.titleWidthPx + 6);
      plateX = Math.max(1, Math.round((fullW - plateW) / 2));
    }
    // Inset band + horizontal bounds (clear of the widgets, gap for the title).
    const STRIPE_PAD = 5;
    const leftW = widgetLayout.find((w) => w.glyph === 'close');
    const rightWs = widgetLayout.filter((w) => w.glyph !== 'close');
    const stripeLeft = (leftW ? leftW.x + leftW.w : frame.left) + STRIPE_PAD;
    const stripeRight = (rightWs.length ? Math.min(...rightWs.map((w) => w.x)) : fullW - frame.right) - STRIPE_PAD;
    const sy0 = Math.max(2, Math.round((titleH - 1) * 0.2));
    const sy1 = titleH - 1 - Math.max(2, Math.round((titleH - 1) * 0.24));
    if (pin.width > 0 && pin.height > 0 && stripeRight > stripeLeft && sy1 > sy0) {
      const segs: [number, number][] = plateX >= 0
        ? [[stripeLeft, plateX - 2], [plateX + plateW + 2, stripeRight]]
        : [[stripeLeft, stripeRight]];
      // Horizontal-line stripes (document/dialog racing stripes) are STRETCHED on X —
      // one interior column scaled across the run — so the sprite's right-edge margin
      // can't tile into a repeating vertical seam (apple-platinum-2's "sliced" look).
      // Dot patterns (utility) are TILED. Y always tiles the sprite + clips to the band.
      const stretchX = isHorizontalLineStripe(pin);
      const srcCol = pin.width >> 1; // a clean interior column (clear of the edge margin)
      const drawn: { x: number; y: number; w: number; h: number }[] = [];
      for (const [x0, x1] of segs) {
        if (x1 - x0 < 2) continue;
        for (let dy = sy0; dy < sy1; dy += pin.height) {
          const hh = Math.min(pin.height, sy1 - dy);
          if (stretchX) {
            out.copyBits(pin, { x: srcCol, y: 0, w: 1, h: hh }, { x: x0, y: dy, w: x1 - x0, h: hh });
          } else {
            for (let dx = x0; dx < x1; dx += pin.width) {
              const ww = Math.min(pin.width, x1 - dx);
              out.copyBits(pin, { x: 0, y: 0, w: ww, h: hh }, { x: dx, y: dy, w: ww, h: hh });
            }
          }
        }
        drawn.push({ x: x0, y: sy0, w: x1 - x0, h: sy1 - sy0 });
      }
      if (drawn.length) placement.push({ edge: 'top', code: 8, role: 'title pinstripe', mode: stretchX ? 'stretch' : 'tile', src: { x: 0, y: 0, w: pin.width, h: pin.height }, rects: drawn });
    }
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
  // Frame-extracted border (the scheme's own beveled frame + corners) REPLACES the
  // procedural 1px ring + bevel when a frame proxy cicn is supplied. Drawn after the
  // title fill so it frames the pinstripe; the centre stays the content hole.
  if (useFrame) {
    frameExtract(out, opts.frameCicn!, FRAME_CSRC, FRAME_SCALE, fullW, fullH, !hasTitleBar);
    // Titled bar: the frame's top EDGE is skipped (it would smear the proxy's title-
    // band detail across the pinstripe), so draw a 1px top outline between the corners.
    if (hasTitleBar) out.fillRect({ x: 0, y: 0, w: fullW, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
  } else ring({ x: 0, y: 0, w: fullW, h: fullH });
  if (hasTitleBar && useFrame) {
    // Content-well border: a 1px frame around the INNER (content) area — its TOP
    // edge is the title/body divider. NOT a full-width line cutting through the side
    // bevels (the old under-line ran x=0..fullW, slicing the left/right frame). The
    // references frame the Finder body with this 1px recess just inside the window
    // frame; the window's outer edge is the frame proxy + the y=0 top outline above.
    // Drawn just OUTSIDE the content hole (frame.left-1 .. fullW-frame.right, titleH-1
    // .. fullH-frame.bottom) so it sits on the frame's inner edge, clear of the DOM
    // content that fills the hole.
    const cl = frame.left - 1, cr = fullW - frame.right, ct = titleH - 1, cb = fullH - frame.bottom;
    const wline = (x: number, y: number, w: number, h: number): void => {
      if (w > 0 && h > 0) out.fillRect({ x, y, w, h }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
    };
    wline(cl, ct, cr - cl + 1, 1); // top — the title/body divider, inner width only
    wline(cl, ct, 1, cb - ct + 1); // left
    wline(cr, ct, 1, cb - ct + 1); // right
    wline(cl, cb, cr - cl + 1, 1); // bottom
  } else if (hasTitleBar) {
    // Procedural fallback (no frame proxy): the flat full-width divider; the §2c
    // beveled section adds the sunken content-well recess for these.
    out.fillRect({ x: 0, y: titleH - 1, w: fullW, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
  }

  // ── 2c. beveled side/bottom frame (raised gray PANEL, not a flat line) ──────
  // Inside the 1px outer outline (drawn above): a face fill + a top/left highlight
  // and bottom/right shadow, plus a content-well recess so the content reads sunken.
  // This is the ~3px beveled gray border the references show (System 7 / Platinum
  // window frame), using the scheme's own lightBevel/darkBevel tones.
  if (beveled && !useFrame) {
    const fill = (x: number, y: number, w: number, h: number, c: [number, number, number, number]): void => {
      if (w > 0 && h > 0) out.fillRect({ x, y, w, h }, c[0], c[1], c[2], 255);
    };
    const cl = frame.left, cr = fullW - frame.right, ct = frame.top, cb = fullH - frame.bottom;
    if (!hasTitleBar) {
      // TITLE-LESS framed box (dialog/alert): a full raised PANEL on all 4 sides.
      fill(1, 1, fullW - 2, frame.top - 1, faceRgba); // top band
      fill(1, 1, frame.left - 1, fullH - 2, faceRgba); // left band
      fill(fullW - frame.right, 1, frame.right - 1, fullH - 2, faceRgba); // right band
      fill(1, fullH - frame.bottom, fullW - 2, frame.bottom - 1, faceRgba); // bottom band
      // raised bevel: highlight inner top+left, shadow inner bottom+right
      fill(1, 1, fullW - 2, 1, hiBevelRgba);
      fill(1, 1, 1, fullH - 2, hiBevelRgba);
      fill(1, fullH - 2, fullW - 2, 1, shBevelRgba);
      fill(fullW - 2, 1, 1, fullH - 2, shBevelRgba);
      // content-well recess (sunken): dark top+left, light right+bottom
      fill(cl - 1, ct - 1, cr - cl + 1, 1, shBevelRgba);
      fill(cl - 1, ct - 1, 1, cb - ct + 1, shBevelRgba);
      fill(cr, ct - 1, 1, cb - ct + 1, hiBevelRgba);
      fill(cl - 1, cb, cr - cl + 1, 1, hiBevelRgba);
    } else {
      // TITLED window: the title bar owns the top; bevel left / right / bottom.
      const bandTop = titleH, bandH = fullH - titleH - 1; // below the under-line, above the bottom outline
      fill(1, bandTop, frame.left - 1, bandH, faceRgba);
      fill(fullW - frame.right, bandTop, frame.right - 1, bandH, faceRgba);
      fill(1, fullH - frame.bottom, fullW - 2, frame.bottom - 1, faceRgba);
      // raised bevel: highlight on the inner left, shadow on the inner right + bottom
      fill(1, bandTop, 1, bandH, hiBevelRgba);
      fill(fullW - 2, bandTop, 1, bandH, shBevelRgba);
      fill(1, fullH - 2, fullW - 2, 1, shBevelRgba);
      // content-well recess (sunken content): dark on its left, light on its right/bottom
      fill(cl - 1, titleH, 1, cb - titleH, shBevelRgba);
      fill(cr, titleH, 1, cb - titleH, hiBevelRgba);
      fill(cl - 1, cb - 1, cr - cl + 2, 1, hiBevelRgba);
    }
  }

  placement.push({
    edge: 'top', code: 0, role: 'frame ring', mode: 'fixed',
    src: { x: 0, y: 0, w: 1, h: 1 }, rects: [{ x: 0, y: 0, w: fullW, h: fullH }],
  });

  // ── 2b. title-bar raised bevel (WDEF 125 §"title-rect raised bevel") ────────
  // Inside the 1px border, a top/left HIGHLIGHT + bottom/right SHADOW makes the
  // bar read as a RAISED ridge instead of a flat striped strip — the single
  // change that stops the window looking like "one giant box". Drawn over the
  // pinstripe (the WDEF fills the rect then strokes the bevel); the widgets sit
  // on top at the ends. Mirrors the widget bevel's lighten/darken amounts.
  if (hasTitleBar && titleH >= 5 && fullW >= 5 && !useFrame) {
    const hi = lighten(faceRgba, 0.55);
    const sh = darken(faceRgba, 0.22);
    const innerH = titleH - 3; // y=1 down to the row just above the under-line
    out.fillRect({ x: 1, y: 1, w: fullW - 2, h: 1 }, hi[0], hi[1], hi[2], 255); // top highlight
    out.fillRect({ x: 1, y: 1, w: 1, h: innerH }, hi[0], hi[1], hi[2], 255); // left highlight
    out.fillRect({ x: 1, y: titleH - 2, w: fullW - 2, h: 1 }, sh[0], sh[1], sh[2], 255); // bottom shadow
    out.fillRect({ x: fullW - 2, y: 1, w: 1, h: innerH }, sh[0], sh[1], sh[2], 255); // right shadow
  }

  // ── 3. widgets: the scheme's OWN close/zoom/collapse glyph, else a procedural
  //       box. close left, collapse + zoom right ─────────────────────────────
  // The corner-sprite schemes DO ship widget art: ics4/ics8 at -14336..-14331 are
  // the WIDGET channel (close/zoom/collapse, active + inactive), distinct from the
  // SAME-id cicn (a window-type proxy) — the dual-channel pattern (cf. cicn -10239
  // push-button face vs ics4 -10239 checkbox). renderWindow loads them into
  // opts.widgetGlyphs and we stamp them 1:1 at the glyph's native size. A role a
  // scheme doesn't ship falls back to a PROCEDURAL beveled box with the classic
  // mark (close = empty, zoom = nested inner square, collapse = window-shade line)
  // sized to ~bar-height − margin. Geometry (WDEF 125 §"Box geometry"): close =
  // title.left+4; zoom 4px from the right end; collapse inboard of zoom; vertically
  // centred. Widget SET per type (opts.widgets): document = [close,collapse,zoom];
  // movable-modal/alert/titled-utility = [close]; side/no-title = [].
  if (widgetsActive) {
    const drawWidget = (wx: number, wy: number, box: { w: number; h: number; glyph: PixelBuffer | null }, role: 'close' | 'collapse' | 'zoom'): void => {
      // A future scheme shipping real per-widget FACE art would stamp it 1:1.
      if (box.glyph) { out.copyBits(box.glyph, { x: 0, y: 0, w: box.w, h: box.h }, { x: wx, y: wy, w: box.w, h: box.h }); return; }
      // Procedural beveled square (face + 1px ring + raised bevel).
      const W = box.w;
      out.fillRect({ x: wx, y: wy, w: W, h: W }, faceRgba[0], faceRgba[1], faceRgba[2], 255);
      out.fillRect({ x: wx, y: wy, w: W, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx, y: wy + W - 1, w: W, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx, y: wy, w: 1, h: W }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      out.fillRect({ x: wx + W - 1, y: wy, w: 1, h: W }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      const hi = lighten(faceRgba, 0.5);
      const sh = darken(faceRgba, 0.18);
      out.fillRect({ x: wx + 1, y: wy + 1, w: W - 2, h: 1 }, hi[0], hi[1], hi[2], 255); // top
      out.fillRect({ x: wx + 1, y: wy + 1, w: 1, h: W - 2 }, hi[0], hi[1], hi[2], 255); // left
      out.fillRect({ x: wx + 1, y: wy + W - 2, w: W - 2, h: 1 }, sh[0], sh[1], sh[2], 255); // bottom
      out.fillRect({ x: wx + W - 2, y: wy + 1, w: 1, h: W - 2 }, sh[0], sh[1], sh[2], 255); // right
      // Classic role mark, drawn in the frame colour, inset 2px:
      if (role === 'zoom') {
        // nested inner square in the upper-left (~half the box) — the zoom glyph
        const m = Math.max(3, Math.floor((W - 4) / 2) + 1);
        out.fillRect({ x: wx + 2, y: wy + 2, w: m, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
        out.fillRect({ x: wx + 2, y: wy + 2, w: 1, h: m }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
        out.fillRect({ x: wx + 2, y: wy + 1 + m, w: m, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
        out.fillRect({ x: wx + 1 + m, y: wy + 2, w: 1, h: m + 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      } else if (role === 'collapse') {
        // window-shade horizontal line across the middle — the collapse glyph
        const my = wy + Math.floor((W - 1) / 2);
        out.fillRect({ x: wx + 2, y: my, w: W - 4, h: 1 }, ringRgba[0], ringRgba[1], ringRgba[2], 255);
      }
      // close: empty box (the classic Platinum close box has no mark until pressed)
    };
    // Stamp each widget at its hoisted position (widgetLayout, computed above so
    // §1 could bound the stripes to the gaps); record the rects for hit-testing.
    for (const w of widgetLayout) drawWidget(w.x, w.y, boxOf(w.glyph), w.glyph);
    placement.push({
      edge: 'widget', code: 4, role: widgetLayout.map((w) => w.glyph).join('/'), mode: 'stamp',
      src: { x: 0, y: 0, w: WBOX, h: WBOX },
      rects: widgetLayout.map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h })),
    });
  }

  // ── 4. grow box: a SEPARATE sprite, stacked ABOVE the content ──────────────
  // The grow box belongs at the scrollbar corner, just inside the frame — NOT on
  // the frame edges. Stamping it at the absolute corner (fullW-w, fullH-h) into the
  // chrome dropped its 16px box on top of the bottom + right frame bevels, so the
  // resize box read as "baked into" those edges. The references put the resize
  // control INSIDE: the thin frame bevel runs clean around the outside. So it is NOT
  // drawn into the chrome buffer (whose bottom/right edges stay the vanilla beveled
  // frame all the way across); instead it is returned as its own sprite that
  // renderWindow stacks over the content layer, anchored on the INNER frame corner.
  let growBoxSprite: ComposedChrome['growBox'];
  if (opts.growBox && opts.growBox.width > 0 && opts.growBox.height > 0) {
    const gb = opts.growBox;
    const gw = gb.width, gh = gb.height;
    // The sprite is the scheme's OWN grow-box cicn, drawn 1:1 — exactly as shipped.
    // Schemes that ship a BLANK framed box (platinum-8's -14330) render flat, matching
    // their reference; we do NOT fabricate a resize-handle texture (the scheme's intent
    // is a plain box). Schemes that ship the overlapping-squares glyph render it.
    const gx = fullW - frame.right - gw; // inner frame corner
    const gy = fullH - frame.bottom - gh;
    growBoxSprite = { buffer: gb, x: gx, y: gy, w: gw, h: gh };
    placement.push({
      edge: 'widget', code: 10, role: 'grow box', mode: 'stamp',
      src: { x: 0, y: 0, w: gw, h: gh },
      rects: [{ x: gx, y: gy, w: gw, h: gh }],
    });
  }

  // ── 5. articulated geometry regions ───────────────────────────────────────
  // The named-region model the texture schemes get from their wnd#/cinf recipe,
  // synthesized here for the procedural Platinum frame: the title bar (code 8,
  // above), the close/zoom/collapse widget rects (code 4, above), the grow box
  // (code 10, above), plus the three thin frame SIDES below. Platinum sides are
  // 1px by design (the frame is code-driven, not corner-sprite art — WDEF 125),
  // so these are slim; they exist so hit-testing, the diagnostic strip, and any
  // future per-side texture mapping can address each edge, not just "the box".
  const sideReg = (edge: 'left' | 'right' | 'bottom', x: number, y: number, w: number, h: number): void => {
    if (w > 0 && h > 0) {
      placement.push({ edge, code: 1, role: `${edge} side`, mode: 'fixed', src: { x: 0, y: 0, w: 1, h: 1 }, rects: [{ x, y, w, h }] });
    }
  };
  sideReg('left', 0, titleH, frame.left, contentH);
  sideReg('right', fullW - frame.right, titleH, frame.right, contentH);
  sideReg('bottom', 0, fullH - frame.bottom, fullW, frame.bottom);

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
    growBox: growBoxSprite,
  };
}
