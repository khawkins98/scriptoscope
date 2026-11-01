// Kingfisher's control-panel extras (classic Kaleidoscope only; the web runtime
// draws none of them). Builders and ids: tools/theme-author/classic-extras.js,
// docs/authoring-a-scheme.md §7.2.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 (the picker icon) + STR# -14320
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: a navy
//                       arrow with a white edge (exact system-palette entries)
//   WindowShade Sounds  snd -14336 / -14335: a kingfisher's dive, synthesized
//                       (a falling "plip" with a little splash; expand rises)
import { aboutBox, arrowCursors, shadeSounds, rasterFromIconFamily, synthesize } from '../../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './menus.mjs';

const plip = (from, to, splashAt) => synthesize([
  { from, to, decay: 0.07, length: 0.16 },
  { from: from * 2, to: to * 2, amp: 0.25, decay: 0.03, length: 0.16 },
  { wave: 'noise', from: 1800, amp: 0.35, start: splashAt, decay: 0.035, length: 0.08 },
], { seconds: 0.22 });

export function build(add) {
  const family = encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), dither4: false });
  const resources = [
    ...aboutBox({
      name: 'Kingfisher',
      description: 'A kingfisher lands on frosted glass: lavender, navy and teal water.',
      year: 2026,
      icon: rasterFromIconFamily(family), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#003366', outline: '#ffffff' }),
    ...shadeSounds({ collapse: plip(1100, 450, 0.1), expand: plip(450, 1100, 0) }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
