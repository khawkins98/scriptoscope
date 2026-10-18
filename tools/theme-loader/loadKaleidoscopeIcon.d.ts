/** Internal picker preview path; preserves resource masks, palettes and depth preference. */
export function loadKaleidoscopeIcon(
  bytes: Uint8Array,
  ids: number[],
  assetUrlFactory?: (rgba: Uint8Array, width: number, height: number, path: string) => string | Promise<string>,
  displayProfile?: import('./display-profile.js').DisplayProfile,
): Promise<string | null>;
