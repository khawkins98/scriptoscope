// Aaron UI main entry — re-exports the full public API and triggers the
// bundled-default theme to auto-load on DOMContentLoaded.
//
// Consumers who want to opt out of the auto-load (and own theme loading
// entirely themselves) should import from `aaron-ui/no-default` instead.

export * from './index-no-side-effects.js';

import { enableBundledDefault } from './themes/runtime/bundledDefault.js';

// Side-effect: schedule the bundled-default theme to fetch+apply on
// DOMContentLoaded. No-op if the consumer has already called loadTheme()
// manually before the auto-load fires.
enableBundledDefault();
