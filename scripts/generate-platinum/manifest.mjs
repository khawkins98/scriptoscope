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
import { geometryFor, WINDOW_TYPES, FIXED, STRETCH, PLATE } from './window-types.mjs';

/**
 * Build the wnd# side recipes + part-0 body rect for one type's geometry.
 * Mac rect order is {top,left,bottom,right}; borders are END-based px offsets.
 */
function buildWndData(geo, cfg) {
  const { width: W, height: H, inset, leftFixed, fill, topFrame, hasTitle } = geo;
  const bottomFrame = geo.bottomFrame ?? inset;
  const stretchEnd = leftFixed + fill;

  // Body rect (part 0): the stretchable band between the divider (topFrame) and
  // the bottom frame. NON-DEGENERATE (bottom>top, right>left) — lint requires it.
  const bodyTop = topFrame;
  const bodyBottom = Math.max(bodyTop + 1, H - bottomFrame);
  const rectangles = [
    { part: 0, rect: { top: bodyTop, left: inset, bottom: bodyBottom, right: W - inset } },
  ];

  // Widget hit rects (part-1…): the title-bar close/collapse/zoom boxes the
  // generator already models as data (cfg.widgets → geo.widgetSlots, in cicn
  // coords, matching the drawn/sliced glyphs). The base-Platinum WDEF computes
  // these geometrically rather than from a wnd# (which is why a vanilla bundle
  // ships none), but exposing them as parts lets the runtime hit-test them the
  // same way a scheme that DOES carry custom widget rects (e.g. 1138) is handled.
  // These hit rects are SEPARATE from the per-widget render cells the TOP edge below
  // emits (those slice each widget with the kDEF GAP codes 2/3/4): one drives
  // hit-testing, the other slicing. Both additive; the rendered chrome is unchanged.
  (geo.widgetSlots ?? []).forEach((w, i) => {
    rectangles.push({ part: i + 1, rect: { top: w.y, left: w.x, bottom: w.y + w.size, right: w.x + w.size } });
  });

  // TOP edge.
  //   Title-PLATE doc windows: fixed corner · grow fill · PLATE(part-5) · grow fill
  //   · fixed corner. The compositor grows the part-5 plate to the measured title
  //   width and centres it (the two grow-fill cells split the slack symmetrically).
  //   Each fixed corner is DECOMPOSED into a distinct slice cell per title-bar
  //   widget (close/collapse/zoom) using the kDEF GAP codes (close=2, zoom=3,
  //   shade/collapse=4) rather than one lumped fixed corner — so every control
  //   reads as its own button in the recipe + slice inspector. classifyPart maps a
  //   present widget's GAP code to 'fixed' (drawn 1:1 from the baked cicn), so the
  //   cells are all fixed and the RENDERED pixels are byte-identical to the lumped
  //   form; only the slice structure changes. (These per-widget render cells are
  //   separate from the part-1.. widget HIT rects above — that's hit-testing.)
  //   Title-less windows have no widgets, so corner() yields a plain fixed corner.
  const WIDGET_CODE = { close: 2, zoom: 3, collapse: 4 };
  const corner = (start, end) => {
    const cells = [];
    let cur = start;
    for (const w of (geo.widgetSlots ?? []).filter((w) => w.x >= start && w.x < end).sort((a, b) => a.x - b.x)) {
      const ws = w.x, we = w.x + w.size;
      if (ws > cur) cells.push({ part: FIXED, border: ws });           // frame before the widget
      cells.push({ part: WIDGET_CODE[w.glyph] ?? FIXED, border: we }); // the widget's own cell
      cur = we;
    }
    if (cur < end) cells.push({ part: FIXED, border: end });           // frame after the last widget
    return cells;
  };

  let topSide;
  if (geo.hasPlate) {
    const a = leftFixed;                       // 21  end of left fixed corner
    const b = leftFixed + geo.leftFill;        // 27  end of left pinstripe fill
    const c = b + geo.plate;                   // 57  end of the title plate
    const d = c + geo.rightFill;               // 63  end of right pinstripe fill
    topSide = [
      ...corner(0, a),
      { part: STRETCH, border: b },
      { part: PLATE, border: c },
      { part: STRETCH, border: d },
      ...corner(d, W),
    ];
  } else {
    topSide = [
      ...corner(0, leftFixed),
      { part: STRETCH, border: stretchEnd },
      ...corner(stretchEnd, W),
    ];
  }

  if (cfg.collapsed) {
    // Title-only window: no body frame. Only the top recipe is shipped.
    return { rectangles, topSide, bottomSide: [], leftSide: [], rightSide: [] };
  }

  // Bottom / side bands: a 1px fixed corner + a STRETCH cell that fills the rest
  // of the window edge. The frame is a uniform 1px outline, so the stretch cell
  // just repeats it down/across the full window dimension. (A single FIXED cell
  // would be drawn 1:1 at the cicn's extent and leave the body's edges open — the
  // compositor force-fixes the FIRST cell, so a grower must be the SECOND cell.)
  const bottomSide = [{ part: FIXED, border: 1 }, { part: STRETCH, border: W }];
  const leftSide = [{ part: FIXED, border: 1 }, { part: STRETCH, border: H }];
  const rightSide = [{ part: FIXED, border: 1 }, { part: STRETCH, border: H }];
  return { rectangles, topSide, bottomSide, leftSide, rightSide };
}

/**
 * Build the manifest assets for ALL window types from the drawn sprite map.
 * @param {Record<string, {active,inactive,geo}>} drawnBySlug
 * @returns {Array} manifest assets (cicn/wnd#/cinf)
 */
export function buildAllWindowAssets(drawnBySlug) {
  const assets = [];

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
