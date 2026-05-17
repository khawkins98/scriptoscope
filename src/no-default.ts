// Aaron UI entry point — without the bundled-default auto-load side effect.
//
// Use this when you want the full library API but DON'T want the runtime
// to auto-fetch mass:werk 7 Le on startup. Common cases:
//   - You're shipping your own default theme via loadTheme(yourUrl) in app
//     init code, and don't want a redundant 404 / wasted fetch for 7 Le.
//   - You're building Aaron UI into a non-browser context (SSR, prerender).
//   - You're size-sensitive about the initial network request budget.
//
// Identical re-exports to the main entry — only difference is the missing
// `enableBundledDefault()` side-effect call. The functions for loading the
// bundled default (`loadBundledDefault`, `setBundledDefaultUrl`, etc.) are
// still exported here, so opting out doesn't lock you out of opting back
// in later.

export * from './index-no-side-effects.js';
