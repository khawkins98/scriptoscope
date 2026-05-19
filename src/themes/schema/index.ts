// Barrel export for the theme schema. Re-exported from the library root.

export {
  THEME_SCHEMA_VERSION,
  type ChromeElementEntry,
  type ConformanceReport,
  type CursorEntry,
  type EdgeRecipe,
  type PartEntry,
  type PatternEntry,
  type SliceSpec,
  type Theme,
  type ThemeAuthor,
  type ThemeOptions,
  type ThemeOrigin,
  type WindowChromeStates,
  type WindowEdges,
  type WindowTypeEntry,
} from './types.js';

export { parseTheme, ThemeValidationError } from './parseTheme.js';
