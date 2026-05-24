// scripts/generate-platinum/manifest.mjs
// Synthesize the document-window manifest assets in the extractor's shape, so
// the real buildThemeJson pairs them (inactive = wndId, active = wndId+1) and
// emits a 'document-window' windowType.
import { METRICS } from './metrics.mjs';
import { TEXT_MARKER } from './draw-document-window.mjs';

const WND_ID = -14336;            // canonical Mac OS document-window wnd# (→ slug 'document-window')
const CICN_INACTIVE = -14336;     // pairChromeStates: inactive = wndId
const CICN_ACTIVE = -14335;       // active = wndId + 1
const PPAT_STIPPLE = 128;

// Title-stretch grower part code (kDEF growers: 8/11/12/13/14/18). Corners/widget
// cells are FIXED (any non-grower code). See docs/spec/kdef231-recipe-walk.md.
const STRETCH = 8, FIXED = 0;

export function buildDocumentWindowAssets(drawn) {
  const inset = METRICS.frameInset;
  const W = drawn.active.width, H = drawn.active.height;
  const leftEnd = METRICS.cells.leftFixed;
  const stretchEnd = leftEnd + METRICS.cells.titleStretch;

  // wnd# data shape per decoders/wnd.js: { rectangles, topSide, bottomSide, leftSide, rightSide }
  const wndData = {
    rectangles: [
      // part 0 = content/body rect inside the frame (Mac order top,left,bottom,right)
      { part: 0, rect: { top: METRICS.titleBarHeight + inset + 1, left: inset, bottom: H - inset, right: W - inset } },
    ],
    // END-based: each {part, border} closes a cell at pixel `border`.
    topSide: [
      { part: FIXED, border: leftEnd },         // [0, leftEnd) fixed leading corner + close cell
      { part: STRETCH, border: stretchEnd },     // [leftEnd, stretchEnd) stretch title cell
      { part: FIXED, border: W },                // [stretchEnd, W) fixed right widget cell + corner
    ],
    bottomSide: [{ part: FIXED, border: W }],    // 1px band, tiles
    leftSide:   [{ part: FIXED, border: H }],
    rightSide:  [{ part: FIXED, border: H }],
  };

  // cinf data shape per decoders/cinf.js — stretch (tileSides=0), title text anchor.
  const cinfData = {
    cornerSize: inset, sideThickness: inset, tileSides: 0, patternAnchor: 0,
    resizeBehavior: 'stretch-whole', bgPatternId: 0,
    bgPixel: { x: 0, y: 0 },
    textPixel: { x: TEXT_MARKER.x, y: TEXT_MARKER.y }, // MUST equal draw-document-window TEXT_MARKER
    embossPixel: { x: 0, y: 0 },
  };

  return [
    { type: 'cicn', id: CICN_INACTIVE, name: 'Document Window', status: 'ok',
      file: 'cicns/cicn-n14336-document-window-inactive.png', width: drawn.inactive.width, height: drawn.inactive.height },
    { type: 'cicn', id: CICN_ACTIVE, name: 'Active Document Window', status: 'ok',
      file: 'cicns/cicn-n14335-active-document-window.png', width: drawn.active.width, height: drawn.active.height },
    { type: 'ppat', id: PPAT_STIPPLE, name: 'Title Pinstripe', status: 'ok',
      file: 'ppats/ppat-128-title-pinstripe.png', width: drawn.stipple.width, height: drawn.stipple.height },
    { type: 'wnd#', id: WND_ID, name: 'Document Window', status: 'ok', data: wndData },
    { type: 'cinf', id: WND_ID, name: 'Document Window', status: 'ok', data: cinfData },
  ];
}
