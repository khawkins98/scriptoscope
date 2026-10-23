// Explicit opt-in runner, never npm test's default suite. Runtime source remains
// untouched: Node loader hooks and browser response substitutions inject faults.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sliderRuntimeMutations } from '../helpers/slider-runtime-mutations.mjs';
const directory=process.argv[2];
if(!directory || resolve(directory).startsWith('/tmp/'))throw new Error('Pass a durable receipt directory outside /tmp');
mkdirSync(directory,{recursive:true});
const only=process.argv[3],results=[];
for(const mutation of sliderRuntimeMutations.filter(m=>!only||m.lane===only||m.id===only)){
  const args=mutation.lane==='node'
    ? ['--experimental-strip-types','--import','./tests/helpers/slider-mutation-hook.mjs','--test',`--test-name-pattern=${mutation.test}`,mutation.file??'tests/rendering-options/slider-environment.test.mjs']
    : ['node_modules/@playwright/test/cli.js','test','--config','tests/rendering-options/playwright.config.mjs','slider-endpoints.spec.mjs','--output',resolve(directory,mutation.id+'-artifacts'),'--grep',mutation.test];
  const run=(label,enabled)=>{
    const env={...process.env};delete env.SCRIPTOSCOPE_SLIDER_MUTATION;if(enabled)env.SCRIPTOSCOPE_SLIDER_MUTATION=mutation.id;
    const child=spawnSync(process.execPath,args,{encoding:'utf8',env,timeout:120000,maxBuffer:8*1024*1024});
    const output=(child.stdout??'')+(child.stderr??'');
    writeFileSync(resolve(directory,`${mutation.id}-${label}.log`),output);
    return {exit:child.status,signal:child.signal,error:child.error?.message,output};
  };
  const positive=run('control',false),negative=positive.exit===0?run('mutant',true):undefined;
  // A targeted assertion diagnostic is mandatory. Import/setup failures,
  // exceptions and timeouts never count as kills, even with nonzero exit.
  const targeted=negative && negative.exit===1 && !negative.signal && !negative.error
    && negative.output.includes(mutation.assertion)
    && (mutation.lane==='node'?negative.output.includes('ERR_ASSERTION'):negative.output.includes('expect(received)'))
    && !/Mutation setup failed|Timeout .* exceeded|TypeError:|ReferenceError:|ERR_MODULE_NOT_FOUND/.test(negative.output);
  const row={id:mutation.id,path:mutation.path,test:mutation.test,assertion:mutation.assertion,controlExit:positive.exit,mutationExit:negative?.exit??null,killed:!!targeted};
  results.push(row);writeFileSync(resolve(directory,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(row));
}
if(!results.length)throw new Error('No mutation selected');
process.exitCode=results.every(r=>r.killed)?0:1;
