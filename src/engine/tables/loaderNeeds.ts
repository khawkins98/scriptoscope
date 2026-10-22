// Loader inputs the engine families need, registered per family (data only).
// src/loadTheme.ts asks the theme loader for exactly these; a new family adds
// its row here instead of editing the runtime.
//
// An id grid lists resource ids as every `base + t1 + t2 + …`, one term from
// each `terms` array (src/engine/resources/ids.ts expands it).
import { SCROLLBAR_TRACK_IDS } from './scrollbar.js';

export interface IdGrid {
  readonly bases: readonly number[];
  readonly terms: readonly (readonly number[])[];
}

export interface FamilyLoaderNeeds {
  readonly family: string;
  /** cicns the family draws with the icon blit (qd-primitives I1–I3): the loader records depth and an opaque companion. */
  readonly iconBlitCicns: readonly IdGrid[];
  readonly source: string;
}

export const ENGINE_LOADER_NEEDS: readonly FamilyLoaderNeeds[] = [
  { family: 'scrollbar', iconBlitCicns: [SCROLLBAR_TRACK_IDS.horizontal, SCROLLBAR_TRACK_IDS.vertical], source: 'scrollbar AC5 (composite arrow cells, icon blit)' },
];
