// Castle's control-panel extras (classic Kaleidoscope only; the web runtime
// draws none of them). Builders and ids: tools/theme-author/classic-extras.js,
// docs/authoring-a-scheme.md §6.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 (the picker icon) + STR# -14320
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: a banner-red
//                       arrow with a parchment edge (exact system-palette entries)
//   WindowShade Sounds  snd -14336 / -14335, synthesized: the drawbridge, a chain
//                       rattle and a wooden thud (collapse: thud first; expand:
//                       rattle first)
import { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, synthesize } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { icon32, icon16 } from './menus.mjs';

const thud = (start) => [
  { wave: 'square', from: 120, to: 70, amp: 0.4, start, decay: 0.05, length: 0.14 },
  { wave: 'noise', from: 500, amp: 0.9, start, decay: 0.04, length: 0.14 },
];
const rattle = (start) => [0, 0.03, 0.06, 0.09].map((t, i) => ({ wave: 'noise', from: 3500, amp: 0.25 - 0.04 * i, start: start + t, attack: 0.002, decay: 0.012, length: 0.04 }));

export function build(add) {
  const family = encodeIconFamily(-16455, { large: icon32(), small: icon16(), dither4: false });
  const resources = [
    ...aboutBox({
      name: 'Castle',
      description: 'A stone keep with towers, banners and a portcullis.',
      year: 2026,
      icon: rasterFromIconFamily(family), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#990000', outline: '#ffffcc' }),
    ...shadeSounds({
      collapse: synthesize([...thud(0), ...rattle(0.12)], { seconds: 0.3 }),
      expand: synthesize([...rattle(0), ...thud(0.14)], { seconds: 0.3 }),
    }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
