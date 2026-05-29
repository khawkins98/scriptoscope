import type { LoadedTheme } from './types.js';
import { resolveInChain } from './baseChain.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (FUN_30a8): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
}

/**
 * Measure a border-ring cicn's border thickness: scan in from the middle
 * row/column until alpha drops out (the transparent interior begins). Used
 * to inset a progress track inside its frame and to size the frame's
 * 9-slice corners. Falls back to a small inset if the cicn has no
 * transparent interior.
 */
/** Bounding box of the buffer's non-transparent pixels (alpha > 0). */
function opaqueBounds(buf: PixelBuffer): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = buf.width, y0 = buf.height, x1 = -1, y1 = -1;
  for (let y = 0; y < buf.height; y++)
    for (let x = 0; x < buf.width; x++)
      if (buf.getPixel(x, y)[3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

function frameBorder(buf: PixelBuffer): number {
  const my = buf.height >> 1;
  let l = 0;
  while (l < buf.width && buf.getPixel(l, my)[3] >= 40) l++;
  const mx = buf.width >> 1;
  let t = 0;
  while (t < buf.height && buf.getPixel(mx, t)[3] >= 40) t++;
  if (l >= buf.width >> 1 || t >= buf.height >> 1) return Math.max(1, Math.min(2, (Math.min(buf.width, buf.height) - 1) >> 1));
  return Math.max(1, Math.min(l, t));
}

/**
 * Look up a chromeElement by its bundle key (e.g.
 * `'normal-horizontal-scrollbar'`) and load its cicn into a PixelBuffer.
 * Returns null if the scheme doesn't ship that element (→ baseline path).
 */
async function loadByKey(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const hit = resolveInChain(theme, (t) => {
    const asset = t.manifest.chromeElements?.[key]?.asset;
    return asset ? { theme: t, asset } : null; // first theme in the chain that ships it
  });
  return hit ? loadCicnBuffer(assetUrl(hit.theme, hit.asset)) : null;
}

/**
 * Look up a chromeElement by its Kaleidoscope RESOURCE ID and load it.
 * The id is the authoritative selector the kDEF uses (e.g. -8286 = the
 * horizontal scrollbar track); bundle slugs for the same resource vary
 * wildly between schemes ("normal-horizontal-scrollbar" vs
 * "horizontal-scrollbar-active" vs "horizontal-scroll-bar-track-arrows"),
 * so resolving by id is the only thing that works across every theme.
 * Asset filenames encode the id as `cicn-n8286-...` / `cicn--10240-...`;
 * control resources are all negative, so we match on the absolute value.
 */
async function loadById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const hit = resolveInChain(theme, (t) => {
    const el = elementById(t, id);
    return el ? { theme: t, asset: el.asset } : null; // first theme in the chain that ships it
  });
  return hit ? loadCicnBuffer(assetUrl(hit.theme, hit.asset)) : null;
}

/**
 * Load an `ics4` GLYPH (a scheme's own pictogram) by its Kaleidoscope
 * RESOURCE ID and return it as a PixelBuffer. Mirrors {@link loadById}, but
 * resolves through the `glyphs` map {@link loadTheme} built from the bundle's
 * `icons/index.json` (id-string → `icons/ics4-<id>.png`) rather than the
 * chrome-cicn catalogue. Walks the base chain so a lightly-skinned scheme can
 * inherit a base scheme's glyphs. Returns null when no scheme in the chain
 * ships that glyph (→ the caller's procedural fallback). The id is passed as a
 * NEGATIVE resource id (e.g. -10198), matching how icons/index.json keys them.
 */
async function loadGlyphById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const hit = resolveInChain(theme, (t) => {
    const asset = t.glyphs?.[String(id)];
    return asset ? { theme: t, asset } : null; // first theme in the chain that ships it
  });
  return hit ? loadCicnBuffer(assetUrl(hit.theme, hit.asset)) : null;
}

/**
 * SELF-ONLY variants of {@link loadById} / {@link loadGlyphById}: resolve a
 * control resource on the scheme ITSELF, never walking the base chain. Used for
 * controls whose art a scheme must OWN to render faithfully (checkbox/radio) —
 * a scheme that ships none falls to the PROCEDURAL Platinum glyph rather than
 * inheriting from an unrelated base bundle. The corner-sprite schemes —
 * apple-platinum-2 / platinum-8 / system7-nostalgia-silver — ship a control-
 * glyph ics4 family (-10197..-10240: scroll arrows, slider/indicator thumb orbs,
 * push-button faces, window-widget boxes) but NO checkbox/radio art in it
 * (verified by pixel-decode; the kDEF 2.3.1 has no -9488..-9504 immediate either
 * — see docs/spec/kdef231-reference.md §2.4), so self-resolution misses →
 * procedural Platinum, which is the faithful look for these Platinum-family
 * schemes. */
async function loadByIdSelf(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const el = elementById(theme, id);
  return el ? loadCicnBuffer(assetUrl(theme, el.asset)) : null;
}

async function loadGlyphByIdSelf(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const asset = theme.glyphs?.[String(id)];
  return asset ? loadCicnBuffer(assetUrl(theme, asset)) : null;
}

/** SELF-ONLY variant of {@link loadByKey}: a scheme's own chromeElement by key,
 *  no base-chain walk. */
async function loadByKeySelf(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const asset = theme.manifest.chromeElements?.[key]?.asset;
  return asset ? loadCicnBuffer(assetUrl(theme, asset)) : null;
}

/** The chromeElement whose asset encodes resource `id` (for textAnchor etc).
 *  Uses the explicit `sourceCicnId` field the decoder writes on every chromeElement
 *  (matched against |id| — the same id can appear with either sign in different
 *  schemes). Previously parsed the resource id out of the `asset` PATH STRING; that
 *  broke under Option A's in-memory load path, where `rewriteAssetRefs` replaces
 *  paths with `blob:` URLs (the regex `/cicn-n?-?(\d+)/` finds no match against a
 *  blob URL → every elementById call returned null → buttons / default-rings /
 *  textAnchors silently un-themed). `sourceCicnId` is the decoder's own field, lives
 *  in `theme.json`, survives the URL rewrite, and is what `lint-themes` reads too. */
function elementById(theme: LoadedTheme, id: number) {
  const abs = Math.abs(id);
  for (const v of Object.values(theme.manifest.chromeElements ?? {})) {
    if (typeof v.sourceCicnId === 'number' && Math.abs(v.sourceCicnId) === abs) return v;
  }
  return null;
}

/**
 * Draw a solid triangular scroll-arrow glyph centered in the size×size box
 * at (bx,by), pointing in `dir`. Platinum schemes (e.g. apple-platinum-2)
 * ship the arrow-button FACE as a cicn but leave the glyph itself to the
 * CDEF — so we stamp the face, then draw this glyph on top.
 */
function drawArrowGlyph(
  buf: PixelBuffer,
  bx: number,
  by: number,
  size: number,
  dir: 'l' | 'r' | 'u' | 'd',
  [r, g, b]: [number, number, number],
): void {
  const depth = Math.max(2, Math.floor((size - 6) / 2)); // ~3 for a 16px button
  const cx = bx + (size >> 1);
  const cy = by + (size >> 1);
  const off = Math.ceil(depth / 2);
  for (let d = 0; d <= depth; d++) {
    const halfH = depth - d; // full base at d=0, single-px tip at d=depth
    for (let t = -halfH; t <= halfH; t++) {
      let px: number, py: number;
      if (dir === 'r') { px = cx - off + d; py = cy + t; }
      else if (dir === 'l') { px = cx + off - d; py = cy + t; }
      else if (dir === 'd') { px = cx + t; py = cy - off + d; }
      else { px = cx + t; py = cy + off - d; }
      buf.setPixel(px, py, r, g, b, 255);
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive';

export interface ScrollbarOptions {
  orientation?: Orientation;
  /** Length along the scroll axis, in px (thickness is fixed by the cicn). */
  length?: number;
  /** Thumb position, 0..1. */
  value?: number;
  /** Thumb size as a fraction of the track, 0..1 (used when `proportional`). */
  thumbExtent?: number;
  /**
   * Thumb LENGTH model. `true` (default) = OS 8 Appearance proportional thumb
   * (length scales with `thumbExtent` / the content ratio); `false` = the classic
   * System 7 fixed-size thumb (the cicn's native length). Era preference — exposed so
   * a host can wire it to a user setting (System-7 vs Platinum scrolling).
   */
  proportional?: boolean;
  state?: ControlState;
}

/**
 * Locate the centred grip motif of a capsule thumb cicn along its long axis. The kDEF thumb is a
 * capsule — rounded end caps + a small grip in the CENTRE — that grows by stretching ONLY the
 * uniform body between cap and grip; the caps and grip stay 1:1 (verified on the corpus art:
 * `#oooooooXXXXXXXoooooo#` — flat edge, beveled body, a busy centre grip). The body is near-uniform
 * along the long axis, so the grip is the central run of lines that differ from a body reference
 * line. Returns the grip's native start+length, or null when there's no distinct centre motif.
 */
function thumbGrip(thumb: PixelBuffer, horiz: boolean): { start: number; len: number } | null {
  const len = horiz ? thumb.width : thumb.height;
  const cross = horiz ? thumb.height : thumb.width;
  if (len < 8) return null;
  const at = (i: number, j: number) => (horiz ? thumb.getPixel(i, j) : thumb.getPixel(j, i));
  const ref = Math.floor(len * 0.25); // a body line: inside the cap, outside the centre grip
  const diff = (i: number) => {
    let d = 0;
    for (let j = 0; j < cross; j++) {
      const p = at(i, j), r = at(ref, j);
      d += Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]) + Math.abs(p[2] - r[2]) + Math.abs(p[3] - r[3]);
    }
    return d / cross; // avg per-cross-pixel RGBA delta from the body reference
  };
  const THRESH = 28;
  let gs = -1, ge = -1;
  for (let i = Math.floor(len * 0.2); i < Math.ceil(len * 0.8); i++) {
    if (diff(i) > THRESH) { if (gs < 0) gs = i; ge = i; }
  }
  return gs >= 0 ? { start: gs, len: ge - gs + 1 } : null;
}

/**
 * Compose a scrollbar into a pixel buffer (docs/spec/kdef231-reference.md §1.3 / §2.6):
 * stretch the track cicn along the axis, stamp the thumb at the
 * value-proportional position. 7 Le ships an empty (white) track + a
 * blue striped thumb; arrows are OS-baseline (not in the bundle).
 *
 * Returns null if the scheme ships no scrollbar cicns (baseline path).
 */
export async function composeScrollbar(
  theme: LoadedTheme,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'vertical';
  const length = Math.max(16, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const state = opts.state ?? 'normal';

  const horiz = orientation === 'horizontal';

  // Track cicn by RESOURCE ID. The state→id mapping is taken from the kDEF
  // scrollbar drawer (decompiled FUN_000066b4), which is authoritative — the
  // bundle slugs mislabel these (e.g. -8287 "empty" is the kDEF's disabled,
  // -8288 "disabled" is actually pressed):
  //   horizontal: active -8285 / inactive -8286 / disabled -8287 / pressed -8288
  //   vertical:   active -8277 / inactive -8278 / disabled -8279 / pressed -8280
  const idInactive = horiz ? 8286 : 8278;
  const idDisabled = horiz ? 8287 : 8279;
  const idPressed = horiz ? 8288 : 8280;
  const wantId = state === 'pressed' ? idPressed : state === 'disabled' ? idDisabled : idInactive;
  const track = (await loadById(theme, wantId)) ?? (await loadById(theme, idInactive));
  if (!track) return null; // baseline path

  // Thumb by resource id: -10206 h / -10208 v (pressed -10205 / -10207).
  const thumb = await loadById(theme, horiz ? (state === 'pressed' ? 10205 : 10206) : state === 'pressed' ? 10207 : 10208);

  // Arrow-BUTTON glyphs — the scheme's OWN ics4 pictograms for the end buttons.
  // The directional arrow family is -10197..-10204 (a 16×16 button: face + arrow +
  // bevel), NOT -10205..-10208 (those are the slider THUMB, h/v × normal/pressed).
  //
  // The normal/pressed id split is UNIVERSAL — it is NOT stored per scheme (the
  // scheme resource forks carry no CDEF/control template, only art). It is hardcoded
  // in Kaleidoscope's shared CDEF, decoded at kDEF231_0.asm:9f0e-9f38, which writes
  // BOTH ids per direction into the control record and selects at draw time by
  // contrlHilite — the PRESSED id for the one arrow under the mouse, the RAISED id
  // for the rest; a disabled control draws the RAISED art dimmed (there is no
  // separate inactive-arrow bitmap). Canonical table mirrored in
  // docs/spec/kdef231-reference.md §"Scroll-arrow ics4 family" — keep all three in sync.
  //   RAISED / normal: right -10201 · left -10202 · down -10203 · up -10204
  //   PRESSED:         right -10197 · left -10198 · down -10199 · up -10200
  // NB the scheme art APPEARANCE of each quartet varies (s7-nostalgia-silver's raised
  // set is a beveled 3-D arrow, platinum-8's is a boxed gray button whose pressed
  // quartet is a flat arrow), but the id→state mapping above is the engine's and we
  // apply it universally. CONSEQUENCE: platinum-8 (a 1998/Kaleidoscope-1.x scheme that
  // placed art the other way) renders its boxed -10202 at rest rather than the flat
  // -10198 its own preview shows — an accepted divergence (owner: follow the 2.3.1
  // decode universally, see kdef-faithfulness-ledger). Earlier these were swapped, so
  // every resting scrollbar drew the depressed arrows.
  // For a horizontal bar the LOW end is the left button, the HIGH end the right;
  // for vertical, low = up (top), high = down (bottom). These glyphs are the WHOLE
  // button (they carry their own face), so we stamp them in place of the
  // procedural face+triangle when the scheme ships them; otherwise fall back to
  // drawArrowGlyph so the sliced schemes + cicn-less schemes render unchanged.
  const pressed = state === 'pressed';
  const lowArrowId = horiz ? (pressed ? 10198 : 10202) : (pressed ? 10200 : 10204); // left / up
  const highArrowId = horiz ? (pressed ? 10197 : 10201) : (pressed ? 10199 : 10203); // right / down
  const lowArrow = await loadGlyphById(theme, -lowArrowId);
  const highArrow = await loadGlyphById(theme, -highArrowId);

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // Two cicn FORMATS (empirically, by aspect ratio):
  //  • wide composite (48×16, 43×16, 33×16 …) — the arrow boxes are baked
  //    into the two ends and the track sits between them. Render as a
  //    3-slice along the long axis: copy each end 1:1, stretch the middle.
  //    Arrows are part of the bitmap; we never stamp them separately.
  //  • single track cell (7 Le, 16×16) — square, no baked arrows (those
  //    are left to the OS). Stretch one interior slice for a clean track.
  const composite = longSrc >= thickness * 2;
  let trackStart = 0;
  let trackLen = length;

  if (composite) {
    const end = Math.min(thickness, Math.floor((longSrc - 1) / 2));
    const mid = longSrc - end * 2;
    const dmid = length - end * 2;
    if (horiz) {
      out.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
      out.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
      out.copyBits(track, { x: end, y: 0, w: mid, h: thickness }, { x: end, y: 0, w: dmid, h: thickness });
    } else {
      out.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
      out.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
      out.copyBits(track, { x: 0, y: end, w: thickness, h: mid }, { x: 0, y: end, w: thickness, h: dmid });
    }
    trackStart = end;
    trackLen = Math.max(0, length - end * 2);
  } else if (length >= thickness * 3) {
    // Single square cell = a Platinum arrow-BUTTON face with no baked glyph
    // (apple-platinum-2's 16×16 bevelled square). Stamp the face at both
    // ends as the two arrow buttons, stretch its interior for the track
    // between, then draw the arrow glyph procedurally (the CDEF's job).
    const btn = thickness;
    const arrowDark: [number, number, number] = state === 'disabled' ? [165, 165, 165] : [72, 72, 72];
    // Stamp an end button: prefer the scheme's OWN ics4 arrow-button glyph
    // (a complete face+arrow, centered in the button box); otherwise lay the
    // track-square face + the procedural triangle, exactly as before.
    const stampButton = (
      bx: number,
      by: number,
      glyph: PixelBuffer | null,
      dir: 'l' | 'r' | 'u' | 'd',
    ): void => {
      out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: bx, y: by, w: btn, h: thickness });
      if (glyph) {
        out.drawOver(glyph, bx + Math.round((btn - glyph.width) / 2), by + Math.round((thickness - glyph.height) / 2));
      } else {
        drawArrowGlyph(out, bx, by, btn, dir, arrowDark);
      }
    };
    if (horiz) {
      const sx = Math.max(1, Math.min(track.width - 2, track.width >> 1));
      out.copyBits(track, { x: sx, y: 0, w: 1, h: track.height }, { x: btn, y: 0, w: length - btn * 2, h: thickness });
      stampButton(0, 0, lowArrow, 'l');
      stampButton(length - btn, 0, highArrow, 'r');
    } else {
      const sy = Math.max(1, Math.min(track.height - 2, track.height >> 1));
      out.copyBits(track, { x: 0, y: sy, w: track.width, h: 1 }, { x: 0, y: btn, w: thickness, h: length - btn * 2 });
      stampButton(0, 0, lowArrow, 'u');
      stampButton(0, length - btn, highArrow, 'd');
    }
    trackStart = btn;
    trackLen = Math.max(0, length - btn * 2);
  } else if (horiz) {
    const sx = Math.max(1, Math.min(track.width - 2, track.width >> 1));
    out.copyBits(track, { x: sx, y: 0, w: 1, h: track.height }, { x: 0, y: 0, w: length, h: thickness });
  } else {
    const sy = Math.max(1, Math.min(track.height - 2, track.height >> 1));
    out.copyBits(track, { x: 0, y: sy, w: track.width, h: 1 }, { x: 0, y: 0, w: thickness, h: length });
  }

  // ── thumb: positioned by value within the track region (between arrows) ──
  if (thumb) {
    const native = horiz ? thumb.width : thumb.height;
    const cross = horiz ? thumb.height : thumb.width;
    const offC = Math.round((thickness - cross) / 2);
    // PROPORTIONAL (OS 8) thumb length scales with the track; FIXED (System 7) keeps
    // the cicn's native length. Default proportional (the bundled themes are Platinum
    // -era); ScrollbarOptions.proportional flips it. Never shorter than the cicn.
    const proportional = opts.proportional ?? true;
    const thumbLen = proportional
      ? Math.max(native, Math.round(trackLen * Math.min(1, Math.max(0.08, opts.thumbExtent ?? 0.4))))
      : native;
    const pos = trackStart + Math.round(value * Math.max(0, trackLen - thumbLen));
    if (thumbLen <= native) {
      // fixed (or proportional collapsed to native) — stamp 1:1
      if (horiz) out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: pos, y: offC, w: thumb.width, h: thumb.height });
      else out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: offC, y: pos, w: thumb.width, h: thumb.height });
    } else {
      // Capsule multi-slice: the rounded end caps AND the centre grip stay 1:1 (never stretched);
      // only the uniform body fill between them grows. The grip is re-CENTRED in the grown thumb.
      // (The body is uniform along the long axis, so stretching a 1px body slice is seamless.)
      const grip = thumbGrip(thumb, horiz);
      let cap = Math.max(2, Math.min(Math.floor((native - 1) / 2), Math.round(cross / 2)));
      if (grip) cap = Math.max(1, Math.min(cap, grip.start, native - (grip.start + grip.len)));
      const gw = grip ? grip.len : 0;
      const gctr = pos + Math.round((thumbLen - gw) / 2); // grip centred in the grown thumb
      const refIdx = grip ? Math.max(0, Math.min(cap, grip.start - 1)) : cap; // a uniform body line
      const W = thumb.width, Hh = thumb.height;
      if (horiz) {
        const fill = (x0: number, x1: number) => { if (x1 > x0) out.copyBits(thumb, { x: refIdx, y: 0, w: 1, h: Hh }, { x: x0, y: offC, w: x1 - x0, h: Hh }); };
        out.copyBits(thumb, { x: 0, y: 0, w: cap, h: Hh }, { x: pos, y: offC, w: cap, h: Hh });
        out.copyBits(thumb, { x: native - cap, y: 0, w: cap, h: Hh }, { x: pos + thumbLen - cap, y: offC, w: cap, h: Hh });
        if (grip) {
          fill(pos + cap, gctr);
          out.copyBits(thumb, { x: grip.start, y: 0, w: gw, h: Hh }, { x: gctr, y: offC, w: gw, h: Hh });
          fill(gctr + gw, pos + thumbLen - cap);
        } else fill(pos + cap, pos + thumbLen - cap);
      } else {
        const fill = (y0: number, y1: number) => { if (y1 > y0) out.copyBits(thumb, { x: 0, y: refIdx, w: W, h: 1 }, { x: offC, y: y0, w: W, h: y1 - y0 }); };
        out.copyBits(thumb, { x: 0, y: 0, w: W, h: cap }, { x: offC, y: pos, w: W, h: cap });
        out.copyBits(thumb, { x: 0, y: native - cap, w: W, h: cap }, { x: offC, y: pos + thumbLen - cap, w: W, h: cap });
        if (grip) {
          fill(pos + cap, gctr);
          out.copyBits(thumb, { x: 0, y: grip.start, w: W, h: gw }, { x: offC, y: gctr, w: W, h: gw });
          fill(gctr + gw, pos + thumbLen - cap);
        } else fill(pos + cap, pos + thumbLen - cap);
      }
    }
  }

  // ── CDEF scrollbar frame: mirror a one-sided long-edge border ──────────────
  // The classic Control Manager strokes a 1px outline around the whole bar; some
  // scheme TRACK cicns bake it onto only ONE long edge. platinum-8's -8286 carries
  // the content-facing line but no frame-facing line, so its resting scrollbar reads
  // as missing the hairline against the window's bottom/right frame. If one long edge
  // is a continuous dark border and the opposite edge is opaque fill WITHOUT one,
  // copy the border across — restoring the bar's outline. Transparent tracks (e.g.
  // system7-nostalgia-silver, whose frame shows through the window chrome) have no
  // border to mirror, so this is a no-op for them; schemes already framed both sides
  // see the source edge re-painted onto itself (unchanged).
  {
    const lum = (p: readonly [number, number, number, number]): number => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const N = length;
    const cross = thickness - 1;
    const at = (i: number, c: number): readonly [number, number, number, number] =>
      horiz ? out.getPixel(i, c) : out.getPixel(c, i);
    const paint = (c: number, col: [number, number, number]): void => {
      for (let i = 0; i < N; i += 1) {
        if (horiz) out.setPixel(i, c, col[0], col[1], col[2], 255);
        else out.setPixel(c, i, col[0], col[1], col[2], 255);
      }
    };
    let darkA = 0, darkB = 0, opaqA = 0, opaqB = 0;
    const colA = new Map<number, number>(), colB = new Map<number, number>();
    for (let i = 0; i < N; i += 1) {
      const a = at(i, 0), b = at(i, cross);
      if (a[3] > 200) { opaqA += 1; if (lum(a) < 110) { darkA += 1; const k = (a[0] << 16) | (a[1] << 8) | a[2]; colA.set(k, (colA.get(k) ?? 0) + 1); } }
      if (b[3] > 200) { opaqB += 1; if (lum(b) < 110) { darkB += 1; const k = (b[0] << 16) | (b[1] << 8) | b[2]; colB.set(k, (colB.get(k) ?? 0) + 1); } }
    }
    const dom = (m: Map<number, number>): [number, number, number] => {
      let bk = -1, bc = 0; for (const [k, c] of m) if (c > bc) { bc = c; bk = k; }
      return bk < 0 ? [0, 0, 0] : [(bk >> 16) & 255, (bk >> 8) & 255, bk & 255];
    };
    if (darkA / N > 0.6 && darkB / N < 0.5 && opaqB > N * 0.6) paint(cross, dom(colA));
    else if (darkB / N > 0.6 && darkA / N < 0.5 && opaqA > N * 0.6) paint(0, dom(colB));
  }

  return out;
}

export interface SliderOptions {
  orientation?: Orientation;
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a slider (docs/spec/kdef231-reference.md §2.4 / §2.6): stretch the groove track
 * along the axis, stamp the thumb at the value position. 7 Le's thumb
 * cicns are 15×64 sprite sheets — 4 stacked 15×16 states
 * (blank / normal / pressed / disabled).
 */
export async function composeSlider(
  theme: LoadedTheme,
  opts: SliderOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const state = opts.state ?? 'normal';
  const horiz = orientation === 'horizontal';

  // Resolve by RESOURCE ID (slugs vary per scheme; ids are stable). The
  // non-directional slider: horizontal track -10131 (pressed -10130 /
  // inactive -10132) + thumbs -10129 · vertical track -10115 (-10114 /
  // -10116) + thumbs -10113.
  const tA = horiz ? 10131 : 10115;
  const tP = horiz ? 10130 : 10114;
  const tI = horiz ? 10132 : 10116;
  const tId = state === 'pressed' ? tP : state === 'disabled' || state === 'inactive' ? tI : tA;
  // SELF-ONLY (like composeCheckable): a scheme renders its OWN slider groove +
  // thumb (the -10131/-10129 h · -10115/-10113 v family) or falls to procedural
  // Platinum — it does NOT borrow the base bundle's. Every texture/cicn scheme +
  // 1990 + the replica ship this family in their OWN bundle (self hop hits); the
  // corner-sprite schemes ship NO slider groove (their -10205..-10208 are the
  // scrollbar thumb / directional indicators, not a groove+thumb pair — verified
  // by pixel-decode), so they fall to platinumSlider rather than the replica's.
  const track = (await loadByIdSelf(theme, tId)) ?? (await loadByIdSelf(theme, tA));
  if (!track) return null;
  const thumbs = await loadByIdSelf(theme, horiz ? 10129 : 10113);

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // groove: 3-slice along the axis — keep the rounded end caps 1:1, stretch
  // the uniform middle. (Full-stretch would smear the caps.) Cap width is a
  // few px; clamp so two caps fit.
  const end = Math.min(6, Math.floor((longSrc - 1) / 2));
  const mid = longSrc - end * 2;
  const dmid = length - end * 2;
  if (horiz) {
    out.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
    out.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
    out.copyBits(track, { x: end, y: 0, w: mid, h: thickness }, { x: end, y: 0, w: dmid, h: thickness });
  } else {
    out.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
    out.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
    out.copyBits(track, { x: 0, y: end, w: thickness, h: mid }, { x: 0, y: end, w: thickness, h: dmid });
  }

  // thumb: pick the state row from the sprite sheet, stamp at value
  if (thumbs) {
    const stateRow = state === 'pressed' ? 2 : state === 'disabled' || state === 'inactive' ? 3 : 1;
    const tw = horiz ? thumbs.width : thumbs.width; // thumb cell is the short dimension wide
    // sheet stacks 4 states along the LONG axis
    const cells = 4;
    if (horiz) {
      const cellH = Math.floor(thumbs.height / cells);
      const thumbW = thumbs.width;
      const pos = Math.round(value * Math.max(0, length - thumbW));
      out.copyBits(thumbs, { x: 0, y: stateRow * cellH, w: thumbW, h: cellH }, { x: pos, y: 0, w: thumbW, h: cellH });
    } else {
      const cellW = Math.floor(thumbs.width / cells);
      const thumbH = thumbs.height;
      const pos = Math.round(value * Math.max(0, length - thumbH));
      out.copyBits(thumbs, { x: stateRow * cellW, y: 0, w: cellW, h: thumbH }, { x: 0, y: pos, w: cellW, h: thumbH });
    }
    void tw;
  }
  return out;
}

export interface DisclosureOptions {
  direction?: 'right' | 'down';
  state?: ControlState;
}

/**
 * Compose a disclosure triangle: a fixed state glyph, stamped 1:1.
 *
 * SELF-ONLY (like composeCheckable / composeSlider): a scheme draws its OWN
 * disclosure triangle or falls to the procedural Platinum one — it does not
 * inherit the base bundle's (the replica ships -9990/-9991 triangles that would
 * otherwise leak into every cicn-less scheme via the chain). Resolution order on
 * the scheme itself: (1) the named disclosure chromeElement (texture schemes),
 * (2) the canonical kDEF id family -10102..-10112 (right/down × normal/pressed/
 * inactive; no corpus scheme ships it as a cicn today, kept for completeness),
 * (3) the scheme's OWN ics4 triangle pictogram. apple-platinum-2 is the only
 * corner-sprite scheme that ships a disclosure triangle: a pixel-VERIFIED clean
 * pair under the NON-canonical positive ics4 ids 3060 (right/collapsed) and 3061
 * (down/expanded) — wired here by id. platinum-8 + system7-nostalgia-silver ship
 * none → procedural Platinum.
 */
export async function composeDisclosure(
  theme: LoadedTheme,
  opts: DisclosureOptions = {},
): Promise<PixelBuffer | null> {
  const dir = opts.direction ?? 'right';
  const state = opts.state ?? 'normal';
  const prefix = state === 'pressed' ? 'pressed-' : state === 'disabled' || state === 'inactive' ? 'inactive-' : '';
  // note: the bundle has a typo "tringle" for inactive-right
  const keys = [
    `${prefix}${dir}-pointing-disclosure-triangle`,
    `${prefix}${dir}-pointing-disclosure-tringle`,
    `${dir}-pointing-disclosure-triangle`,
  ];
  for (const k of keys) {
    const g = await loadByKeySelf(theme, k);
    if (g) return g;
  }
  // Canonical kDEF disclosure-triangle id family (docs/spec/kdef231-reference.md
  // §2.6): -10102..-10112, right/down × normal/pressed/inactive (rows of 5 per
  // the period doc; we map only the normal right/down here, which is all the
  // renderer needs). Resolved self-only as a cicn, then as an ics4 glyph.
  const canonical = dir === 'right' ? 10102 : 10103;
  const byId = (await loadByIdSelf(theme, canonical)) ?? (await loadGlyphByIdSelf(theme, -canonical));
  if (byId) return byId;
  // apple-platinum-2's pixel-verified own triangles (non-canonical positive ics4
  // ids — see the doc-comment). 3060 = right/collapsed, 3061 = down/expanded.
  return loadGlyphByIdSelf(theme, dir === 'right' ? 3060 : 3061);
}

export interface TabOptions {
  label?: string;
  /** The SELECTED tab uses the "front"/"on" cicn (taller, raised); an
   *  unselected tab uses the shorter "rear"/"off" cicn. */
  selected?: boolean;
}

/**
 * Compose one segmented TAB (e.g. an On|Off pair) from the scheme's tab cicns.
 * Selected = the "front"/"on" tab (`-9972` SSF small / `-9980` LSF large — the
 * taller, raised trapezoid); unselected = the shorter "rear"/"off" tab
 * (`-9975` / `-9983`). The cicn is 3-sliced across its width — rounded top
 * corners fixed, middle stretched — to fit the label. Returns null when the
 * scheme ships no tab cicn (caller falls back to a CSS segmented control).
 *
 * NB: this is NOT the popup-menu tab `-12319` (a different control that no
 * corpus scheme ships) — the segmented tab control is the `-998x` family
 * (SSF/LSF front/rear tabs + tab pane). See docs/spec/kdef231-reference.md.
 */
export async function composeTab(theme: LoadedTheme, opts: TabOptions = {}): Promise<PixelBuffer | null> {
  const ids = opts.selected ? [9972, 9980] : [9975, 9983]; // small then large; front/rear
  let tab: PixelBuffer | null = null;
  for (const id of ids) {
    tab = await loadById(theme, id);
    if (tab) break;
  }
  if (!tab) return null;
  const b = opaqueBounds(tab);
  if (b.x1 < b.x0 || b.y1 < b.y0) return null;
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;

  // Label color: the tab's center marker pixel is the authored text colour;
  // use it when it actually contrasts with the (solid) tab face, else pick a
  // contrasting b/w from the face — the tabs are filled (blue 1984 / gray beos),
  // so the label must read against that fill, not the content behind.
  const cx = (b.x0 + b.x1) >> 1;
  const cy = (b.y0 + b.y1) >> 1;
  const [mr, mg, mb, ma] = tab.getPixel(cx, cy);
  const [fr, fgc, fbc] = tab.getPixel(Math.max(b.x0, cx - 4), cy); // face pixel, offset from marker
  const faceLum = 0.299 * fr + 0.587 * fgc + 0.114 * fbc;
  const mLum = 0.299 * mr + 0.587 * mg + 0.114 * mb;
  const fg = ma > 200 && Math.abs(mLum - faceLum) > 40
    ? `#${[mr, mg, mb].map((c) => c.toString(16).padStart(2, '0')).join('')}`
    : faceLum < 128 ? '#ffffff' : '#000000';

  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, Math.max(8, Math.round(bh * 0.42)), fg) : null;
  const cap = Math.max(2, Math.min(12, Math.floor((bw - 1) / 2)));
  const outW = Math.max(bw, (glyphs ? glyphs.width : 0) + cap * 2 + 6);
  const out = PixelBuffer.alloc(outW, bh);

  // 3-slice the tab box across its width: fixed ends 1:1, stretched middle.
  out.copyBits(tab, { x: b.x0, y: b.y0, w: cap, h: bh }, { x: 0, y: 0, w: cap, h: bh });
  out.copyBits(tab, { x: b.x1 - cap + 1, y: b.y0, w: cap, h: bh }, { x: outW - cap, y: 0, w: cap, h: bh });
  out.copyBits(tab, { x: b.x0 + cap, y: b.y0, w: bw - cap * 2, h: bh }, { x: cap, y: 0, w: outW - cap * 2, h: bh });
  // The body label sits slightly below center (the trapezoid's top is the bevel).
  if (glyphs) out.drawOver(glyphs, Math.round((outW - glyphs.width) / 2), Math.round((bh - glyphs.height) / 2) + 1);
  return out;
}

/**
 * Compose a window grow box (the bottom-right resize control) from the
 * scheme's cicn — active -14333 (apple-platinum-2 uses -14330) /
 * inactive -14334. Stamped 1:1 (it's a fixed-size corner glyph, 15–20px).
 * Returns null when the scheme ships no grow box (→ caller's CSS fallback).
 */
export async function composeGrowBox(
  theme: LoadedTheme,
  opts: { state?: ControlState } = {},
): Promise<PixelBuffer | null> {
  const inactive = opts.state === 'inactive';
  if (inactive) return loadById(theme, 14334);
  return (await loadById(theme, 14333)) ?? (await loadById(theme, 14330));
}

export interface ProgressOptions {
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a determinate progress bar (docs/spec/kdef231-reference.md §2.6): stretch
 * the unfilled track across the bar, overlay the fill cicn across the
 * 0..value portion (inset to the interior), cap with the frame ends.
 */
export async function composeProgress(
  theme: LoadedTheme,
  opts: ProgressOptions = {},
): Promise<PixelBuffer | null> {
  const length = Math.max(16, opts.length ?? 160);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const active = (opts.state ?? 'normal') !== 'inactive';

  // PROGRESS-BAR RESOURCE MODEL — TWO FAMILIES (enumerate the FULL id set before
  // assuming roles from slug names; that was the recurring trap here):
  //  • LAVENDER 2-PART (apple-platinum-2 / system7-nostalgia-silver / black-platinum /
  //    platinum-8 / beos-r503): a dedicated FILL `-10223` ("lavender", the canonical
  //    DEFAULT — owner-chosen) + an empty TRACK `-10224`. These schemes ALSO ship
  //    `-10071..-10080` + `-10220..-10222` — but those are ALTERNATE HUE fills
  //    (teal/rose/…/copper/aquamarine; picker deferred), NOT frame/track/fill roles,
  //    and they carry NO progress frame. (I repeatedly mis-modelled these by reading
  //    only the -1007x hue slugs and missing that -10223/-10224 also ship here.)
  //  • ROLE 3-PART (1138 / 1984 / 1990 / evolution; replica = 2-part): the
  //    deconstructed layers — frame `-10080`/`-10077`, fill `-10079`/`-10076`, track
  //    `-10078`/`-10075` (active/inactive). Used only by schemes WITHOUT `-10223`.
  // See kdef231-reference §2.4 + the per-theme resource-role manifest.
  const lavender = await loadById(theme, 10223);
  if (lavender) {
    const trk = await loadById(theme, 10224);
    const ph = (trk ?? lavender).height;
    const out = PixelBuffer.alloc(length, ph);
    // 3-slice a tile into `dst` across its full width: rounded end caps 1:1, middle
    // stretched. `dst` width sets the run (so the fill goes in its own buffer, below).
    const slice3 = (dst: PixelBuffer, src: PixelBuffer): void => {
      const w = dst.width;
      if (w <= 0) return;
      if (w <= src.width) { dst.copyBits(src, { x: 0, y: 0, w: src.width, h: src.height }, { x: 0, y: 0, w, h: ph }); return; }
      const cap = Math.min(4, Math.max(1, (src.width - 2) >> 1));
      dst.copyBits(src, { x: 0, y: 0, w: cap, h: src.height }, { x: 0, y: 0, w: cap, h: ph });
      dst.copyBits(src, { x: src.width - cap, y: 0, w: cap, h: src.height }, { x: w - cap, y: 0, w: cap, h: ph });
      dst.copyBits(src, { x: cap, y: 0, w: src.width - cap * 2, h: src.height }, { x: cap, y: 0, w: w - cap * 2, h: ph });
    };
    // Empty track across the full bar, then the FILL tile 3-sliced to value over it.
    // The fill keeps its OWN tile (bevel + highlight + leading edge) — 3-slicing (caps
    // 1:1, middle stretched) preserves that, where stretching only the interior colour
    // came out flat/awkward. drawOver (alpha-respecting) composites the fill so its
    // rounded corners don't erase the track at the leading edge (a 1px seam otherwise).
    if (trk) slice3(out, trk);
    if (value > 0) {
      const fb = PixelBuffer.alloc(Math.max(1, Math.round(value * length)), ph);
      slice3(fb, lavender);
      out.drawOver(fb, 0, 0);
    }
    return out;
  }

  // ROLE 3-part (schemes WITHOUT -10223): the id is the stable selector (slugs differ:
  // "progress-bar-frame-active" vs "progress-indicator-frame"). Inactive uses -1007{7,6,5}.
  const frame = await loadById(theme, active ? 10080 : 10077);
  const track = (await loadById(theme, active ? 10078 : 10075)) ?? (await loadById(theme, 10078));
  const fill = (await loadById(theme, active ? 10079 : 10076)) ?? (await loadById(theme, 10079));
  if (!frame && !track) return null;

  const h = frame ? frame.height : track!.height;
  const out = PixelBuffer.alloc(length, h);

  // The frame is a border ring with a transparent interior; its border
  // thickness (the inset where alpha drops out) sets where the track/fill
  // live and the 9-slice corner size. Measure it from the cicn itself.
  const border = frame ? frameBorder(frame) : 1;
  const ix = border;
  const iw = Math.max(0, length - border * 2);
  const iy = border;
  const ih = Math.max(0, h - border * 2);

  // 1) unfilled track stretched across the interior (the empty look for
  //    schemes whose frame has a transparent interior, e.g. 1990).
  if (track && iw > 0 && ih > 0) {
    out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: ix, y: iy, w: iw, h: ih });
  }

  // 2) frame border: 9-slice so corners stay crisp. Some schemes' frames
  //    have a transparent interior (track shows through), others an opaque
  //    one (1984 is solid white) — either way the fill goes on TOP next.
  if (frame) {
    out.nineSlice(frame, { x: 0, y: 0, w: frame.width, h: frame.height }, { l: border, t: border, r: border, b: border }, { x: 0, y: 0, w: length, h });
  }

  // 3) fill across 0..value of the interior, ON TOP of the frame — 3-slice
  //    along the bar: keep the section's rounded end caps 1:1, stretch the
  //    middle (NOT tiled — tiling repeats the section into visible chevrons).
  if (fill && value > 0 && iw > 0 && ih > 0) {
    const fw = Math.round(value * iw);
    if (fw > 0 && fw <= fill.width) {
      out.copyBits(fill, { x: 0, y: 0, w: fill.width, h: fill.height }, { x: ix, y: iy, w: fw, h: ih });
    } else if (fw > 0) {
      // cap = the rounded-corner width (~a few px); keep it small so a
      // non-empty middle remains even for narrow (12px) fill sections.
      const cap = Math.min(4, Math.max(1, (fill.width - 2) >> 1));
      const fmid = fill.width - cap * 2;
      out.copyBits(fill, { x: 0, y: 0, w: cap, h: fill.height }, { x: ix, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: fill.width - cap, y: 0, w: cap, h: fill.height }, { x: ix + fw - cap, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: cap, y: 0, w: fmid, h: fill.height }, { x: ix + cap, y: iy, w: fw - cap * 2, h: ih });
    }
  }
  return out;
}

export interface ButtonOptions {
  label?: string;
  default?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  minWidth?: number;
  /** Title color (themed buttons carry no text-color metadata yet). */
  fg?: string;
}

export interface BevelButtonOptions {
  label?: string;
  on?: boolean;       // set / selected (latched)
  pressed?: boolean;  // momentary press
  disabled?: boolean;
  small?: boolean;
  minWidth?: number;
  fg?: string;
}

interface FaceOptions { label?: string; disabled?: boolean; minWidth?: number; fg?: string; padX?: number; width?: number; height?: number; align?: 'center' | 'left'; }

/**
 * Render a 9-sliced control FACE into a label-sized buffer: slice the face into the
 * button rect, flatten the interior to its fill colour (erasing the centre cinf
 * text-colour MARKER so the stretch doesn't smear it across the label), and draw the
 * centred label in a contrasting b/w. The kDEF's face drawer (0x7424) reads NO text
 * colour — the Control Manager draws titles in the system colour — and the cinf
 * marker (1990 mid-gray, evolution black) is illegible, so we pick by face luminance
 * (matches the scheme previews); disabled grays but stays contrasting. The 9-slice
 * corner = the cinf `cornerSize` (0x107fe), else a derived inset. Shared by
 * composeButton (which wraps a default ring around it) and composeBevelButton.
 */
async function composeFaceButton(theme: LoadedTheme, face: PixelBuffer, faceId: number, opts: FaceOptions): Promise<PixelBuffer> {
  const label = opts.label ?? '';
  const faceEl = elementById(theme, faceId) ?? elementById(theme, 10239);
  const fIns = faceEl?.slice?.corner ?? sliceInset(face.width, face.height);
  const faceIns = { l: fIns, t: fIns, r: fIns, b: fIns };
  // Sample the interior FILL colour OFFSET from the marker (which often sits at
  // [fIns,fIns]); sampling the marker would flood the flattened interior with the
  // light label colour — a stripe across the button.
  const ta = faceEl?.textAnchor;
  const sx = ta ? Math.max(0, Math.min(face.width - 1, ta[0] - 3)) : fIns;
  const sy = ta ? Math.max(0, Math.min(face.height - 1, ta[1])) : fIns;
  const [cr, cg, cb, ca] = face.getPixel(sx, sy);
  const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const fg = opts.fg ?? (opts.disabled
    ? (lum < 128 ? '#b0b0b0' : '#707070')
    : lum < 128 ? '#ffffff' : '#000000');
  const lineH = opts.height ?? face.height;
  const glyphs = label ? rasterizeText(label, Math.max(8, Math.round(lineH * 0.6)), fg) : null;
  const padX = opts.padX ?? 12;
  const innerW = opts.width ?? Math.max(opts.minWidth ?? 56, (glyphs ? glyphs.width : 0) + padX * 2);
  const innerH = lineH;
  const out = PixelBuffer.alloc(innerW, innerH);
  out.nineSlice(face, { x: 0, y: 0, w: face.width, h: face.height }, faceIns, { x: 0, y: 0, w: innerW, h: innerH });
  if (ca > 0) {
    const cw = innerW - fIns * 2, ch = innerH - fIns * 2;
    if (cw > 0 && ch > 0) out.fillRect({ x: fIns, y: fIns, w: cw, h: ch }, cr, cg, cb, 255);
  }
  if (glyphs) {
    const gx = opts.align === 'left' ? padX : Math.round((innerW - glyphs.width) / 2);
    out.drawOver(glyphs, gx, Math.round((innerH - glyphs.height) / 2));
  }
  return out;
}

/**
 * Compose a THEMED push button (docs/spec/kdef231-reference.md §1.2 / §2.2,
 * FUN_30a8 — Platinum fallback: docs/kaleidoscope-asset-catalog.md §6.1): 9-slice the
 * push-button face (-10239 active / -10238 pressed / -10240 inactive) into the
 * button rect; for the default button wrap the shipped ring (-10231/-10232) around
 * it. Returns null if the scheme ships no push-button cicn (→ baselineButton).
 */
export async function composeButton(theme: LoadedTheme, opts: ButtonOptions = {}): Promise<PixelBuffer | null> {
  const faceId = opts.disabled ? 10240 : opts.pressed ? 10238 : 10239;
  const face = (await loadById(theme, faceId)) ?? (await loadById(theme, 10239));
  if (!face) return null; // baseline path
  const faceBuf = await composeFaceButton(theme, face, faceId, opts);
  // Probe the active ring REGARDLESS of `opts.default` so plain buttons reserve the same outer
  // footprint as defaults would. Classic Mac convention: all buttons in a dialog row share an outer
  // rect — the default's ring is drawn at those outer bounds; a plain button leaves the same area as
  // transparent margin around its face. Without this, default + plain buttons in the same row
  // misalign vertically (the default's canvas grows by 2*outset, the plain's doesn't).
  const ringActive = await loadById(theme, 10231);
  if (!ringActive) return faceBuf; // theme ships no ring at all — preserve face-only output
  const ring = opts.default ? await loadById(theme, opts.disabled ? 10232 : 10231) : null;
  // The ring cicn is a 9-slice default-button OUTLINE template. Two authoring models
  // exist across the corpus — pick the right outset for each:
  //
  //   1. OUTSET model (ring authored LARGER than face): the artist drew the ring
  //      cicn at face-size + halo, so the canonical outset is the half-difference
  //      between the two. Crayon-os ships ring 80×80 / face 74×74 → outset 3.
  //      Most themed schemes use this (1984 / 1990 / animals / dolphin-som / evolution
  //      / monkey-paradise / windows-* etc.).
  //   2. OVERLAY model (ring authored SAME-OR-SMALLER than face): the ring is meant
  //      to draw AS an outline on top of the face. Apple-platinum-2 / 1138 / beos-r503
  //      / platinum-8 / slimes / system7-nostalgia-silver / black-platinum ship
  //      ring 16×16 = face 16×16. Falls back to the historical ring.width/4 heuristic
  //      so existing working renders don't regress.
  //
  // Probe BOTH ids (ring-active for the plain-button reservation, ring-or-fallback
  // for the actual draw) so a disabled-default isn't mis-outset if -10231/-10232
  // ship at different sizes.
  const faceCe = elementById(theme, 10239);
  const ringDrawn = ring ?? ringActive;
  const authoredDelta = (faceCe && ringDrawn.width > faceCe.width)
    ? Math.max(0, Math.round((ringDrawn.width - faceCe.width) / 2))
    : 0;
  const outset = authoredDelta >= 1
    ? authoredDelta
    : Math.max(3, Math.round(ringDrawn.width / 4));
  const out = PixelBuffer.alloc(faceBuf.width + outset * 2, faceBuf.height + outset * 2);
  if (ring) {
    const ringEl = elementById(theme, opts.disabled ? 10232 : 10231);
    const rIns = ringEl?.slice?.corner ?? sliceInset(ring.width, ring.height);
    out.nineSlice(ring, { x: 0, y: 0, w: ring.width, h: ring.height }, { l: rIns, t: rIns, r: rIns, b: rIns }, { x: 0, y: 0, w: out.width, h: out.height });
  }
  out.drawOver(faceBuf, outset, outset);
  return out;
}

/**
 * Compose a THEMED bevel button (toolbar / palette toggle). The scheme ships a
 * 12-cicn set — NORMAL size -10162..-10167 and SMALL size -10171..-10176, each laid
 * out [set/on: pressed, unpressed, inactive] then [clear/off: pressed, unpressed,
 * inactive]. 9-slice the state's face like the push button. Falls back within the
 * bundle (exact → same-value unpressed → -10163) and returns null (→
 * platinumBevelButton) when the scheme ships no bevel-button cicn for this state.
 */
export async function composeBevelButton(theme: LoadedTheme, opts: BevelButtonOptions = {}): Promise<PixelBuffer | null> {
  const sizeBase = opts.small ? 10171 : 10162;
  const valueOff = opts.on ? 0 : 3;                          // set/on group, then clear/off (+3)
  const stateOff = opts.pressed ? 0 : opts.disabled ? 2 : 1; // pressed · unpressed · inactive
  const reqId = sizeBase + valueOff + stateOff;
  const ids = [reqId, sizeBase + valueOff + 1, 10163];
  let face: PixelBuffer | null = null;
  let usedId = reqId;
  for (const id of ids) { const f = await loadById(theme, id); if (f) { face = f; usedId = id; break; } }
  if (!face) return null; // → platinumBevelButton
  const faceOpts: FaceOptions = { padX: 8, minWidth: opts.minWidth ?? (opts.small ? 18 : 22) };
  if (opts.label != null) faceOpts.label = opts.label;
  if (opts.disabled != null) faceOpts.disabled = opts.disabled;
  if (opts.fg != null) faceOpts.fg = opts.fg;
  return composeFaceButton(theme, face, usedId, faceOpts);
}

export interface ListHeaderColumn { label: string; width: number; }
export interface ListHeaderOptions { columns?: ListHeaderColumn[]; height?: number; inactive?: boolean; }

/**
 * Compose a THEMED list / Finder column header: 9-slice the scheme's finder-header
 * cell cicn (-9567 active / -9568 inactive) into each column with a left-aligned
 * label (the cell is the same 9-slice shape as a button face, so it reuses
 * composeFaceButton). Returns null (→ platinumListHeader) when the scheme ships none.
 */
export async function composeListHeader(theme: LoadedTheme, opts: ListHeaderOptions = {}): Promise<PixelBuffer | null> {
  const cellId = opts.inactive ? 9568 : 9567;
  const cell = await loadById(theme, cellId);
  if (!cell) return null; // → platinumListHeader
  const cols = opts.columns ?? [{ label: 'Name', width: 140 }, { label: 'Size', width: 56 }, { label: 'Kind', width: 90 }];
  const H = opts.height ?? Math.max(16, cell.height);
  const W = cols.reduce((a, c) => a + c.width, 0);
  const out = PixelBuffer.alloc(W, H);
  let x = 0;
  for (const c of cols) {
    const cellBuf = await composeFaceButton(theme, cell, cellId, { label: c.label, width: c.width, height: H, align: 'left', padX: 6 });
    out.drawOver(cellBuf, x, 0);
    x += c.width;
  }
  return out;
}

/**
 * Compose a THEMED checkbox/radio glyph + label into a buffer. Stamps
 * the fixed-size state cicn 1:1 (radio: `radio-buttons-{on|off}-...`;
 * checkbox: `normal-{on|off}-...`). Returns null → baselineCheckable.
 *
 * Resolution is deliberately SELF-ONLY (no base-chain walk): a scheme renders
 * its OWN checkbox/radio art, and one that ships none returns null so the caller
 * draws the procedural Platinum glyph — rather than inheriting from an unrelated
 * base bundle. Every texture/cicn scheme (1138/1984/beos/evolution) and 1990 ship
 * -9488..-9504 as cicns in their OWN bundle, so they resolve on the first hop
 * unchanged.
 *
 * The corner-sprite Platinum-family schemes — apple-platinum-2 / platinum-8 /
 * system7-nostalgia-silver — ship NO checkbox/radio CICN, but they DO author the
 * art as ics4 GLYPHS in the -10214..-10240 family (pixel-VERIFIED across all
 * three schemes, 12×12 each, identical glyph shapes to the replica's -9488/-9500
 * cicns):
 *   • CHECKBOX (square box; cols = X / dash=mixed / CHECK / empty, rows =
 *     active / pressed / disabled — pixel-verified 8× grid):
 *       active  → empty -10232 · checked(✓) -10231 · mixed(–) -10230
 *       disabled→ empty -10240 · checked(✓) -10239 · mixed(–) -10238
 *   • RADIO (round orb; cols = mixed / ON / off, rows = active/pressed/disabled):
 *       active  → off -10216 · on -10215 · mixed -10214
 *       disabled→ off -10224 · on -10223 · mixed -10222
 * So self-resolution now hits the scheme's OWN glyph; only a scheme that ships
 * neither cicn nor ics4 falls through to the procedural Platinum glyph.
 */
export async function composeCheckable(
  theme: LoadedTheme,
  kind: 'checkbox' | 'radio',
  opts: { label?: string; checked?: boolean; mixed?: boolean; disabled?: boolean; fg?: string } = {},
): Promise<PixelBuffer | null> {
  // Resolve by RESOURCE ID. radio: on -9488 active / -9489 inactive,
  // off -9491 active / -9492 inactive · checkbox: checked -9500 active /
  // -9501 inactive, empty -9503 active / -9504 inactive. (Schemes that ship
  // no themed checkbox/radio — e.g. apple-platinum-2 — return null → baseline.)
  let wantId: number, activeId: number;
  if (kind === 'radio') {
    activeId = opts.checked ? 9488 : 9491;
    wantId = opts.disabled ? (opts.checked ? 9489 : 9492) : activeId;
  } else {
    activeId = opts.checked ? 9500 : 9503;
    wantId = opts.disabled ? (opts.checked ? 9501 : 9504) : activeId;
  }
  // The corner-sprite schemes' OWN ics4 glyph ids for this control+state (the
  // -10214..-10240 family, pixel-verified — see the doc-comment). Tried as ics4
  // glyphs, NEVER walking the base chain. Active-state id is the fallback so a
  // disabled control that lacks a disabled glyph still shows the scheme's own art.
  // The cluster is 4 marks × 3 tiers (pixel-verified across the 3 schemes):
  //   checkbox cols = [X, mixed/dash, CHECK, empty]; rows = active / pressed / disabled.
  //     active  -10229..-10232 · pressed -10233..-10236 · DISABLED -10237..-10240
  //   radio    cols = [mixed, ON, off]; rows = active / pressed / disabled.
  //     active  -10214..-10216 · pressed -10218..-10220 · DISABLED -10222..-10224
  // "checked" is the CHECK glyph (not the X), and the inactive/disabled state is
  // the grayed THIRD row (not the pressed second row).
  let glyphId: number, glyphActiveId: number;
  if (kind === 'radio') {
    glyphActiveId = opts.mixed ? 10214 : opts.checked ? 10215 : 10216;
    glyphId = opts.disabled ? (opts.mixed ? 10222 : opts.checked ? 10223 : 10224) : glyphActiveId;
  } else {
    glyphActiveId = opts.mixed ? 10230 : opts.checked ? 10231 : 10232;
    glyphId = opts.disabled ? (opts.mixed ? 10238 : opts.checked ? 10239 : 10240) : glyphActiveId;
  }
  // SELF-ONLY resolution order (no base-chain hop → no replica borrow):
  //   1. own cicn for this state          (texture/cicn schemes, 1990, replica)
  //   2. own cicn for the active state     (cicn scheme lacking a disabled cell)
  //   3. own ics4 glyph at the -1021x..-1024x family for this state  (icon schemes)
  //   4. own ics4 glyph at the active state of that family
  // Falls to null (→ procedural baseline) only when the scheme ships neither.
  const glyph =
    (await loadByIdSelf(theme, wantId)) ??
    (await loadByIdSelf(theme, activeId)) ??
    (await loadGlyphByIdSelf(theme, -glyphId)) ??
    (await loadGlyphByIdSelf(theme, -glyphActiveId));
  if (!glyph) return null;
  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, 9, opts.fg ?? '#000000') : null;
  const gap = 5;
  const w = glyph.width + (glyphs ? gap + glyphs.width : 0);
  const h = Math.max(glyph.height, glyphs ? glyphs.height : 0);
  const out = PixelBuffer.alloc(w, h);
  out.copyBits(glyph, { x: 0, y: 0, w: glyph.width, h: glyph.height }, { x: 0, y: Math.round((h - glyph.height) / 2), w: glyph.width, h: glyph.height });
  if (glyphs) out.drawOver(glyphs, glyph.width + gap, Math.round((h - glyphs.height) / 2));
  return out;
}

// ─── Baseline (procedural Platinum) controls ───────────────────────────
// Kaleidoscope leaves standard controls to the OS unless the scheme ships
// cicns (kdef-findings §2.2). 7 Le ships none, so these render as the
// Platinum default — DOM elements with procedural styling, not cicn
// composites. Accessible + the faithful path for cicn-less schemes.

export interface BaselineButtonOptions {
  default?: boolean;
  disabled?: boolean;
  /** Minimum button width in px (default 62). Use a small value for compact
   *  buttons like a segmented On/Off pair. */
  minWidth?: number;
}

export function baselineButton(label: string, opts: BaselineButtonOptions = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = !!opts.disabled;
  // Platinum push button: rounded face with a top-light gradient, a dark
  // outer frame, a white top-inner highlight + soft bottom-inner shadow.
  // The default button gets the classic black ring (1px light gap, then a
  // 2px black rounded outline) via stacked box-shadows.
  const bevel = 'inset 0 1px 0 #ffffff, inset 0 -1px 1px rgba(0,0,0,0.14)';
  Object.assign(b.style, {
    font: '12px Charcoal, Chicago, Geneva, sans-serif',
    padding: '3px 16px',
    minWidth: `${opts.minWidth ?? 56}px`,
    margin: '3px',
    color: opts.disabled ? '#9a9a9a' : '#000',
    background: opts.disabled ? '#e0e0e0' : 'linear-gradient(180deg, #fefefe 0%, #ececec 48%, #cdcdcd 100%)',
    border: '1px solid #5a5a5a',
    borderRadius: '10px',
    boxShadow: opts.default ? `${bevel}, 0 0 0 1px #d4d4d4, 0 0 0 3px #000000` : bevel,
    cursor: opts.disabled ? 'default' : 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  return b;
}

export function baselineCheckable(
  kind: 'checkbox' | 'radio',
  label: string,
  opts: { checked?: boolean; disabled?: boolean } = {},
): HTMLLabelElement {
  const wrap = document.createElement('label');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    font: '12px Chicago, Charcoal, Geneva, sans-serif',
    color: opts.disabled ? '#888' : '#000',
  } satisfies Partial<CSSStyleDeclaration>);
  const box = document.createElement('span');
  Object.assign(box.style, {
    width: '12px',
    height: '12px',
    background: 'linear-gradient(#ffffff, #dcdcdc)',
    border: '1px solid #555555',
    borderRadius: kind === 'radio' ? '50%' : '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: '1',
  } satisfies Partial<CSSStyleDeclaration>);
  if (opts.checked) box.textContent = kind === 'radio' ? '●' : '✓';
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(box, text);
  return wrap;
}

/** Blit a composed control buffer to a CSS-scaled, pixelated canvas. */
export function bufferToCanvas(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(buf.toImageData(), 0, 0);
  Object.assign(canvas.style, {
    width: `${buf.width * scale}px`,
    height: `${buf.height * scale}px`,
    imageRendering: 'pixelated',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);
  return canvas;
}
