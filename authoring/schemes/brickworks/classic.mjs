// Brickworks' control-panel extras (classic Kaleidoscope only; the web
// runtime draws none of them). Builders and ids:
// tools/theme-author/classic-extras.js, docs/authoring-a-scheme.md §7.2.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 (the picker icon) + STR# -14320
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: a red
//                       plastic arrow with a white edge (exact system-palette entries)
//   WindowShade Sounds  snd -14336 / -14335, synthesized: two plastic clicks,
//                       bricks pulled apart (collapse, falling) or pressed
//                       together (expand, rising)
import { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, synthesize } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './icon.mjs';

const click = (start, pitch) => [
  { wave: 'noise', from: 4000, amp: 0.8, start, attack: 0.001, decay: 0.006, length: 0.03 },
  { from: pitch, amp: 0.5, start, attack: 0.001, decay: 0.012, length: 0.04 },
];
const clicks = (a, b) => synthesize([...click(0, a), ...click(0.07, b)], { seconds: 0.14 });

export function build(add) {
  const family = encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), dither4: false });
  const resources = [
    ...aboutBox({
      name: 'Brickworks',
      description: 'Chunky toy bricks in bright primary plastic.',
      year: 2026,
      icon: rasterFromIconFamily(family), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#cc0000', outline: '#ffffff' }),
    ...shadeSounds({ collapse: clicks(2400, 1800), expand: clicks(1800, 2400) }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
