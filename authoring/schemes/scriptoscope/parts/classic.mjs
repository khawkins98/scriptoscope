// Native control-panel extras; these are not browser verification claims.
import {
  aboutBox,
  arrowCursors,
  shadeSounds,
  rasterFromIconFamily,
  synthesize,
} from '../../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './menus.mjs';
const tick = (from, to) =>
  synthesize([{ wave: 'sine', from, to, amp: 0.3, decay: 0.025, length: 0.07 }], { seconds: 0.08 });
export function build(add) {
  const family = encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), dither4: false });
  for (const r of [
    ...aboutBox({
      name: 'Scriptoscope Reference',
      description:
        'Scriptoscope Studio: charcoal enamel, warm paper and a six-tile maker mark. Original reference theme.',
      year: 2026,
      icon: rasterFromIconFamily(family),
      iconGamma: false,
    }),
    ...arrowCursors({ fill: '#333333', outline: '#ffffcc' }),
    ...shadeSounds({ collapse: tick(800, 500), expand: tick(500, 800) }),
  ])
    add(r.type, r.id, r.data, r.name);
}
