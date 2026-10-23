// Isolated process-only mutation. Never writes runtime source or dist.
import '../../helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
const variants={
 'public-unsupported':['/pushButtonFacade.ts','if (drawn.unsupported)','if (false)'],
 'unknown-guard':['/qd/cinfFrame.ts',"if (icon?.status === 'unknown' || !cicn) {",'if (false) {'],
 'push-state':['/tables/pushButton.ts',"resource: -10240", "resource: -10239"],
 'disabled-precedence':['/tables/checkables.ts','hilites: [254, 255]','hilites: [255]'],
 'ring-outset':['/tables/pushButton.ts','outset: 4','outset: 3'],
 'mask-repeat':['/families/checkables.ts','const id = iconId();',"const id = iconId(); env.systemResources.getResource('ics#', id, { trace });"],
 'storage-origin':['/families/checkables.ts','left: bounds.left - storageOrigin.x','left: bounds.left'],
 'original-value':['/families/checkables.ts','value = input.value === 1 && input.acidAlternate ? C.CB13.alternate : input.value;', 'value = value === 1 && input.acidAlternate ? C.CB13.alternate : value;'],
 'color-custom':['/families/checkables.ts','(!color && input.customBottlenecks)','input.customBottlenecks'],
 'body-sampling':['/qd/cinfFrame.ts','if (bodyFill) {','if (true) {'],
 'sentinel':['/tables/cinfFrame.ts','sentinel: 0x1234','sentinel: 0x1235'],
 'oracle-state':['/controls459-rules.mjs','disabled(h) ? -10240','disabled(h) ? -10239'],
};
const id=process.env.CONTROLS459_MUTATION;
if(id==='harness-failure')throw Error('intentional setup rejection');
const config=variants[id];if(!config)throw Error(`unknown mutation ${id}`);
let applied=false;
registerHooks({load(url,ctx,next){const result=next(url,ctx);if(url.endsWith(config[0])){const source=String(result.source);if(!source.includes(config[1]))throw Error(`mutation token absent ${id}`);applied=true;return{...result,source:source.replace(config[1],config[2])};}return result;}});
process.on('exit',()=>{if(!applied){console.error('MUTATION_NOT_APPLIED');process.exitCode=99;}});
