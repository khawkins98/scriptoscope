// An explicit typed-provider boundary for isolated facade mutations. Browser
// acceptance separately exercises the real loader and decoder. No disk edits.
import '../../helpers/registerTs.mjs';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){if(url.endsWith('/engine/resources/theme.ts'))return{format:'module',shortCircuit:true,source:'export async function themeResourceChain() { return globalThis.__controls459PublicChain; }'};return next(url,context);}});
