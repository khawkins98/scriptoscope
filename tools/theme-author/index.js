// Scheme authoring toolkit: the write-side counterpart of tools/theme-loader/.
// Pure and portable (no fs, no DOM). Start with docs/authoring-a-scheme.md.
export { writeResourceFork } from './resource-fork-writer.js';
export { encodeCicn } from './encode-cicn.js';
export { encodeWnd, encodeCinf, encodeColr, encodeVers } from './encode-records.js';
export { Raster, mix, verticalGradient, ditheredGradient, bayer } from './raster.js';
export { parseColor, srgbToStored } from './color.js';
export { windowLayout } from './window-layout.js';
export { checkScheme, titleContrast } from './check-scheme.js';
export { writeMacBinary } from './macbinary.js';
export { encodePpat } from './encode-ppat.js';
export { encodeIconPlane, encodeIconList, encodeIconFamily, SYSTEM_PALETTE_16, SYSTEM_PALETTE_256 } from './encode-icons.js';
export { encodeClut, encodeHeaderClut } from './encode-clut.js';
export { frameLayout, stripLayout, pressedStripFrom } from './frame-layout.js';
export { fitPalette, colorCount } from './fit-palette.js';
export { simulate8bit, systemEntryFor, nearestSystemIndex } from './sim8.js';
export { paletteReport, formatPaletteReport, flattenPalette, contrastRatio, relativeLuminance, CONTRAST_FLOORS } from './palette-report.js';
export { contactSheet } from './contact-sheet.js';
export { encodeStrList, toMacRoman, pascalString } from './encode-strings.js';
export { encodeDlog, encodeDitl, DIALOG_POSITION, DITL_TYPE } from './encode-dialog.js';
export { encodeCrsr, encodeCrsrRecord } from './encode-crsr.js';
export { encodeSnd, synthesize, toOffsetBinary, SND_RATE } from './encode-snd.js';
export { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, ARROW, ABOUT_ID, ABOUT_ICON_ID } from './classic-extras.js';
