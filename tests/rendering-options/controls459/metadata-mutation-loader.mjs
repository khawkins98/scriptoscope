// Process-only diagnostic guard removal; no source/dist writes.
import '../../helpers/registerTs.mjs';
import {registerHooks} from 'node:module';
const variants={
 cinf:["'status' in value && value.status === 'unknown'",'false'],
 short:['if (bytes.length < CINF_SAMPLE.headerLength)', 'if (false)'],
 body:["res && 'status' in res.value && res.value.status === 'unknown'",'false'],
};
const id=process.env.CONTROLS459_METADATA_MUTATION,mutation=variants[id];
if(!mutation)throw Error('unknown metadata mutation');
let applied=false;registerHooks({load(url,ctx,next){const r=next(url,ctx);if(!url.endsWith('/qd/cinfFrame.ts'))return r;const s=String(r.source);if(!s.includes(mutation[0]))throw Error('mutation token absent');applied=true;return {...r,source:s.replaceAll(mutation[0],mutation[1])};}});
process.on('exit',()=>{if(!applied){console.error('MUTATION_NOT_APPLIED');process.exitCode=99;}});
