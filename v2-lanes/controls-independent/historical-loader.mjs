// Read-only old-code observation. No checkout and no runtime file mutations.
import '../../tests/helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import ts from 'typescript';
const root=process.cwd(),ref=process.env.CONTROLS459_SOURCE_REF;
if(!/^[a-f0-9]{8,40}$/.test(ref??''))throw Error('pinned ref required');
registerHooks({load(url,context,next){if(url.startsWith('file:')){const path=relative(root,fileURLToPath(url));if(/^(tools\/theme-loader|src)\//.test(path)&&/\.(js|mjs|ts)$/.test(path)&&!path.endsWith('.test.mjs')){let source;try{source=execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error(`old source absent: ${path}`);}if(path.endsWith('.ts'))source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return{format:'module',shortCircuit:true,source};}}return next(url,context);}});
