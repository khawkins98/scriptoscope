// Aaron UI library entry point. This file is the public API surface
// downstream consumers import from. Currently a placeholder until Phase 1
// work lands the real WindowManager + AaronWindow + theme loader — see
// GitHub Phase 1 milestone for the full breakdown.

export const VERSION = '0.0.0';

/**
 * Marker exported so the toolchain has a real symbol to type-check + tree-
 * shake against until issue #2 lands the actual WindowManager.
 */
export const __aaronUiToolchainCheck = (): true => true;
