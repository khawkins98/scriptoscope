// scripts/generate-platinum/manifest.mjs
// Synthesize the manifest assets (cicn pairs + wnd# recipes + cinf) for ALL 13
// canonical Platinum window types, in the extractor's shape, so the real
// buildThemeJson pairs them (inactive = wndId, active = wndId+1) and emits one
// windowType per slug.
//
// RECIPE CORRECTNESS (see classifyPart in src/composeChrome.ts):
//   part 1 => fixed (1:1)        part 8 => grow (absorbs slack)
//   part 0 => COLLAPSES to 0     — only ever used as a border-0 origin marker.
// Top edge:  [0,leftFixed) fixed corner · [leftFixed,leftFixed+fill) GROW title
//            fill · [leftFixed+fill, W) fixed corner.
// Side/bottom edges: a single fixed band over the full extent (tiles 1:1).
// Collapsed types ship ONLY a top recipe (empty bottom/left/right) → the
// compositor draws just the title bar, exactly like a real collapsed window.
import { geometryFor, WINDOW_TYPES, FIXED, STRETCH } from './window-types.mjs';

const PPAT_STIPPLE = 128;

/**
 * Build the wnd# side recipes + part-0 body rect for one type's geometry.
 * Mac rect order is {top,left,bottom,right}; borders are END-based px offsets.
 */
function buildWndData(geo, cfg) {
  const { width: W, height: H, inset, leftFixed, fill, topFrame, hasTitle } = geo;
  const stretchEnd = leftFixed + fill;

  // Body rect (part 0): the stretchable band between the divider (topFrame) and
  // the bottom inset. NON-DEGENERATE (bottom>top, right>left) — lint requires it.
  const bodyTop = topFrame;
  const bodyBottom = Math.max(bodyTop + 1, H - inset);
  const rectangles = [
    { part: 0, rect: { top: bodyTop, left: inset, bottom: bodyBottom, right: W - inset } },
  ];

  // TOP edge. With a title bar: fixed-corner / grow-fill / fixed-corner. Without
  // a title (dialog/alert/no-title utility): the top is a plain frame band, same
  // shape — a thin grow fill flanked by fixed corners keeps it stretchable.
  const topSide = [
    { part: FIXED, border: leftFixed },
    { part: STRETCH, border: stretchEnd },
    { part: FIXED, border: W },
  ];

  if (cfg.collapsed) {
    // Title-only window: no body frame. Only the top recipe is shipped.
    return { rectangles, topSide, bottomSide: [], leftSide: [], rightSide: [] };
  }

  // Bottom / side bands: a single fixed band over the full extent. (1px-thick
  // uniform frame — tiles cleanly; nothing to collapse.)
  const bottomSide = [{ part: FIXED, border: W }];
  const leftSide = [{ part: FIXED, border: H }];
  const rightSide = [{ part: FIXED, border: H }];
  return { rectangles, topSide, bottomSide, leftSide, rightSide };
}

/**
 * Build the manifest assets for ALL window types from the drawn sprite map.
 * @param {Record<string, {active,inactive,geo}>} drawnBySlug
 * @param {{stipple:{width,height}}} extras  shared stipple ppat
 * @returns {Array} manifest assets (cicn/ppat/wnd#/cinf)
 */
export function buildAllWindowAssets(drawnBySlug, extras) {
  const assets = [];

  // One shared title pinstripe ppat (secondary; title fill is baked into cicns).
  assets.push({
    type: 'ppat', id: PPAT_STIPPLE, name: 'Title Pinstripe', status: 'ok',
    file: 'ppats/ppat-128-title-pinstripe.png', width: extras.stipple.width, height: extras.stipple.height,
  });

  for (const cfg of WINDOW_TYPES) {
    const drawn = drawnBySlug[cfg.slug];
    const geo = drawn.geo ?? geometryFor(cfg);
    const inactiveId = cfg.wndId;     // inactive cicn = wndId
    const activeId = cfg.wndId + 1;   // active cicn  = wndId + 1
    const files = cicnFiles(cfg, inactiveId, activeId);

    const wndData = buildWndData(geo, cfg);
    const cinfData = {
      cornerSize: geo.inset, sideThickness: geo.inset, tileSides: 0, patternAnchor: 0,
      resizeBehavior: 'stretch-whole', bgPatternId: 0,
      bgPixel: { x: 0, y: 0 },
      textPixel: { x: geo.inset, y: geo.inset }, // MUST match the drawer's TEXT marker
      embossPixel: { x: 0, y: 0 },
    };

    assets.push(
      { type: 'cicn', id: inactiveId, name: `${cfg.name} (Inactive)`, status: 'ok',
        file: files.inactive, width: drawn.inactive.width, height: drawn.inactive.height },
      { type: 'cicn', id: activeId, name: `Active ${cfg.name}`, status: 'ok',
        file: files.active, width: drawn.active.width, height: drawn.active.height },
      { type: 'wnd#', id: cfg.wndId, name: cfg.name, status: 'ok', data: wndData },
      { type: 'cinf', id: cfg.wndId, name: cfg.name, status: 'ok', data: cinfData },
    );
  }
  return assets;
}

/** Stable cicn PNG filenames for a type (n<absId> for negative ids). */
export function cicnFiles(cfg, inactiveId, activeId) {
  const tag = (id) => (id < 0 ? `n${-id}` : `${id}`);
  return {
    inactive: `cicns/cicn-${tag(inactiveId)}-${cfg.slug}-inactive.png`,
    active:   `cicns/cicn-${tag(activeId)}-${cfg.slug}-active.png`,
  };
}
