// Headless render of the procedural Platinum (engine-fallback) sprites to PNGs,
// for fidelity iteration without a browser. Renders label-less (rasterizeText
// needs a DOM canvas; geometry/colour is what we're verifying).
//   node scripts/render-platinum.mjs [outdir]
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  platinumWindow, platinumButton, platinumCheckable, platinumSlider,
  platinumScrollbar, platinumDisclosure,
} from '../dist/aaron-ui.js';
import { encodePng } from './diag-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] || '/tmp/platinum-trace/render');
mkdirSync(out, { recursive: true });
const save = (name, buf) => { writeFileSync(resolve(out, name + '.png'), encodePng(buf.width, buf.height, buf.data)); console.log(`  ${name}: ${buf.width}x${buf.height}`); };

save('window', platinumWindow({ contentW: 220, contentH: 90, fill: '#cccccc', stripe: '#aaaaaa', text: '#000000', frame: '#555555' }).buffer);
save('button', platinumButton({ minWidth: 60 }));
save('button-default', platinumButton({ minWidth: 60, default: true }));
save('button-disabled', platinumButton({ minWidth: 60, disabled: true }));
save('checkbox-on', platinumCheckable('checkbox', { checked: true }));
save('checkbox-off', platinumCheckable('checkbox', {}));
save('radio-on', platinumCheckable('radio', { checked: true }));
save('radio-off', platinumCheckable('radio', {}));
save('slider-h', platinumSlider({ orientation: 'horizontal', length: 120, value: 0.4 }));
save('scrollbar-h', platinumScrollbar({ orientation: 'horizontal', length: 140, value: 0.35 }));
save('scrollbar-v', platinumScrollbar({ orientation: 'vertical', length: 100, value: 0.5 }));
save('disclosure-r', platinumDisclosure({ direction: 'right' }));
save('disclosure-d', platinumDisclosure({ direction: 'down' }));
console.log('-> ' + out);
