import {test,expect} from '@playwright/test';
import {preview} from 'vite';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
// Requires build:demo. Built asset assertions in the frozen probe reject a dev server.
test('production diagnostic preserves visible labels and pointer/Space/disabled controls',async({},info)=>{
 const server=await preview({configFile:'vite.demo.config.js',preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});
 const output=info.outputPath('visibility');
 try {
  const base=`http://127.0.0.1:${server.httpServer.address().port}/scriptoscope/`;
  const run=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['tests/rendering-options/controls459/consumer-visibility-regression.mjs'],{env:{...process.env,BASE_URL:base,REVIEW_EVIDENCE:output}});
   let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal,log}));
  });
  await info.attach('visibility-result.json',{path:output+'/result.json',contentType:'application/json'});
  const result=JSON.parse(await readFile(output+'/result.json','utf8'));
  expect(run.signal,run.log).toBeNull();expect(result.setupFailures,run.log).toEqual([]);
  expect(result.rows.every(r=>r.positivePageAndBuild),run.log).toBe(true);
  expect(result.rows.every(r=>r.interactions.length===5),run.log).toBe(true);
  expect(result.failures,'visible labels after passing built-page and interaction controls').toEqual([]);
  expect(run.code,run.log).toBe(0);
 } finally {await new Promise((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));}
});
