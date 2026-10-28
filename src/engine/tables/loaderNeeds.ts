import { CHECKABLE_IDS, CHECKABLE_ICON_ROWS } from './checkables.js';
// Loader inputs the engine families need, registered per family (data only).
// src/loadTheme.ts asks the theme loader for exactly these; a new family adds
// its row here instead of editing the runtime.
//
// An id grid lists resource ids as every `base + t1 + t2 + …`, one term from
// each `terms` array (src/engine/resources/ids.ts expands it).
import { SCROLLBAR_TRACK_IDS } from './scrollbar.js';
import { PF_ART, PF_UTILITY_ART, PF_UTILITY_GROW, PF_UTILITY_STRIPES } from './proceduralFrameArt.js';
import { SLIDER_IDS } from './slider.js';
import { PROGRESS_FALLBACK, PROGRESS_IDS } from './progress.js';
import { PUSH_IDS, PUSH_BUTTON } from './pushButton.js';

export interface IdGrid {
  readonly bases: readonly number[];
  readonly terms: readonly (readonly number[])[];
}

export interface FamilyLoaderNeeds {
  readonly family: string;
  /** cicns the family draws with the icon blit (qd-primitives I1–I3): the loader records depth and an opaque companion. */
  readonly iconBlitCicns: readonly IdGrid[];
  /** Small colour icons needing exact opaque pixels for checkable CB22. */
  readonly checkableIconIds?: readonly number[];
  /** cinfs read as raw header bytes, retained in `manifest.engineCinfs`. */
  readonly cinfs?: readonly IdGrid[];
  /** cicns the family draws through the line samplers (slider BL4/BL5, BL8/BL12): the adapter also loads their sampler companion. */
  readonly lineSampledCicns?: readonly IdGrid[];
  readonly source: string;
}

export const ENGINE_LOADER_NEEDS: readonly FamilyLoaderNeeds[] = [
  { family: 'checkables', iconBlitCicns: [CHECKABLE_IDS], checkableIconIds: [...new Set(CHECKABLE_ICON_ROWS.flatMap(r => [...r.ids]))],
    source: 'checkables CB11 full bounds, CB18/CB22 opaque ics8 occurrences' },
  { family: 'push-button', iconBlitCicns: [PUSH_IDS],
    cinfs: [PUSH_IDS, { bases: [PUSH_BUTTON.PB9.fallback, PUSH_BUTTON.DR5.fallback], terms: [] }],
    lineSampledCicns: [PUSH_IDS], source: 'push-button PB5–PB10, DR2–DR6; qd B2, E3/E4, S2/S4' },
  { family: 'scrollbar', iconBlitCicns: [SCROLLBAR_TRACK_IDS.horizontal, SCROLLBAR_TRACK_IDS.vertical], source: 'scrollbar AC5 (composite arrow cells, icon blit)' },
  {
    family: 'proceduralFrame',
    iconBlitCicns: [{
      bases: [PF_ART.document.hilited, PF_ART.document.normal, PF_ART.dialog.hilited, PF_ART.dialog.normal,
        PF_ART.dialogAlert.hilited, PF_ART.dialogAlert.normal, PF_ART.growDocument.hilited, PF_ART.growDocument.normal,
        PF_ART.growMovable.hilited, PF_ART.growMovable.normal, PF_UTILITY_ART.frame.active, PF_UTILITY_ART.frame.inactive,
        PF_UTILITY_ART.frameSide.active, PF_UTILITY_ART.frameSide.inactive, PF_UTILITY_GROW.normal.active, PF_UTILITY_GROW.normal.inactive,
        ...PF_UTILITY_STRIPES.art.side],
      terms: [],
    }],
    source: 'procedural-frame GB3a opaque copies (§4/§5/§5A corners, §9.5 US5 utility stripes); frame samples read the opaque companion (§3.5 "Sampling", §9.4); grow and utility frame cicns are copied masked (GB3)',
  },
  { family: 'slider', iconBlitCicns: [], cinfs: [SLIDER_IDS.horizontal, SLIDER_IDS.vertical],
    lineSampledCicns: [SLIDER_IDS.horizontal, SLIDER_IDS.vertical], source: 'slider G1, ID6, TR3–TR6 (cinf bytes 0, 2, 3); BL4/BL5 line colours (BL8, BL12)' },
  { family: 'progress', iconBlitCicns: [], cinfs: [PROGRESS_IDS.art],
    lineSampledCicns: [PROGRESS_IDS.art, { bases: [PROGRESS_FALLBACK.cicn], terms: [] }],
    source: 'progress GATE1–GATE4, CINF2 (frame bytes 0–2, fill/track bytes 0, 2, 3); BLIT3/BLIT4 line colours and FB1–FB3 samples (COL1)' },
];
