// Midnight 2027's control-panel extras (classic Kaleidoscope only; the web
// runtime draws none of them). Builders and ids:
// tools/theme-author/classic-extras.js, docs/authoring-a-scheme.md §7.2.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 (the picker icon) + STR# -14320
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: a navy
//                       arrow outlined in gold, so it reads on the night-sky
//                       desktop and on white bodies (exact system-palette entries)
//   WindowShade Sounds  snd -14336 / -14335, synthesized: expanding is a
//                       rocket's whistle and three rising sparkle notes,
//                       collapsing three falling notes and a soft crackle
import { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, synthesize } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './art.mjs';

const G5 = 784, D6 = 1175, G6 = 1568;
const notes = (order) => order.map((f, i) => ({ from: f, start: 0.06 * i, decay: 0.07, length: 0.2 }));
const expand = () => synthesize([
  { from: 700, to: 1900, amp: 0.45, attack: 0.03, decay: 0.08, length: 0.12 },
  ...notes([G5, D6, G6]).map((v) => ({ ...v, start: v.start + 0.1 })),
], { seconds: 0.36 });
const collapse = () => synthesize([
  ...notes([G6, D6, G5]),
  { wave: 'noise', from: 4000, amp: 0.3, start: 0.16, decay: 0.03, length: 0.12 },
], { seconds: 0.32 });

export function build(add) {
  const family = encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), dither4: false });
  const resources = [
    ...aboutBox({
      name: 'Midnight 2027',
      description: 'Fireworks over a midnight sky for New Year 2027.',
      year: 2026,
      icon: rasterFromIconFamily(family), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#000033', outline: '#ffcc33' }),
    ...shadeSounds({ collapse: collapse(), expand: expand() }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
