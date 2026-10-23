import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const env={...process.env};delete env.NODE_TEST_CONTEXT;
const run=(pattern,mutation)=>spawnSync(process.execPath,[...(mutation?['--import','./tests/rendering-options/controls459/metadata-mutation-loader.mjs']:[]),'--test','--test-reporter=tap',`--test-name-pattern=${pattern}`,'tests/rendering-options/controls459-metadata.test.mjs'],{env:{...env,CONTROLS459_METADATA_MUTATION:mutation??''},encoding:'utf8',timeout:15000});
for(const [mutation,pattern] of [['cinf','cinf-UNKNOWN'],['short','cinf-short'],['body','ppat-UNKNOWN|mode5-UNKNOWN']])test(`metadata ${mutation} guard removal fails explicit reason assertions after positive controls`,()=>{
 const control=run('metadata positive controls');assert.equal(control.status,0,control.stdout+control.stderr);
 const baseline=run(pattern);assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
 const mutant=run(`metadata positive controls|${pattern}`,mutation);
 if(process.env.CONTROLS459_MUTATION_RECEIPTS){const d=process.env.CONTROLS459_MUTATION_RECEIPTS;mkdirSync(d,{recursive:true});writeFileSync(`${d}/metadata-${mutation}-control.log`,control.stdout+control.stderr+baseline.stdout+baseline.stderr);writeFileSync(`${d}/metadata-${mutation}-mutant.log`,mutant.stdout+mutant.stderr);}
 assert.equal(mutant.status,1,mutant.stdout+mutant.stderr);assert.equal(mutant.signal,null);assert.equal(mutant.error,undefined);
 assert.match(mutant.stdout,/ok 1 - metadata positive controls/,'mutated runtime must retain valid/NULL/body controls');
 assert.match(mutant.stdout,/ERR_ASSERTION/);assert.match(mutant.stdout,/exact independent reason|without incidental exception/);
 assert.doesNotMatch(mutant.stdout+mutant.stderr,/mutation token absent|MUTATION_NOT_APPLIED|ERR_MODULE_NOT_FOUND/);
});
