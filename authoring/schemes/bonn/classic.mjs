// Bonn's control-panel extras (classic Kaleidoscope only; the web runtime
// draws none of them). Builders and ids: tools/theme-author/classic-extras.js,
// docs/authoring-a-scheme.md §6.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 (the picker icon) + STR# -14320
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: the frame's
//                       near-black outline colour with a cream edge (exact
//                       system-palette entries). The first build used the Rhine
//                       teal, which all but vanished on the teal desktop in
//                       real Kaleidoscope (classic/README.md).
//   WindowShade Sounds  snd -14336 / -14335, synthesized: a small bell (three
//                       inharmonic partials), lower to collapse, higher to expand
import { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, synthesize } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './icon.mjs';

const bell = (f) => synthesize([
  { from: f, decay: 0.16 },
  { from: f * 2, amp: 0.5, decay: 0.09 },
  { from: f * 2.76, amp: 0.35, decay: 0.05 },
], { seconds: 0.4, fade: 0.08 });

export function build(add) {
  const family = encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), dither4: false });
  const resources = [
    ...aboutBox({
      name: 'Bonn',
      description: 'Bonn’s skyline and the Rhine in cherry-blossom time.',
      year: 2026,
      icon: rasterFromIconFamily(family), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#330000', outline: '#ffffcc' }),
    ...shadeSounds({ collapse: bell(660), expand: bell(990) }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
