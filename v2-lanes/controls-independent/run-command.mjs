// Durable own-exit receipt; no pipeline masks the command's result.
import { spawnSync, execFileSync } from 'node:child_process';
import { openSync,closeSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [name,cmd,...args]=process.argv.slice(2);
if(!name||!cmd||!/^[\w.-]+$/.test(name))throw Error('name command [args] required');
const dir='/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent';mkdirSync(dir,{recursive:true});
const path=resolve(dir,name+'.log'),fd=openSync(path,'w'),started=new Date().toISOString();
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const r=spawnSync(cmd,args,{stdio:['ignore',fd,fd],env:process.env});closeSync(fd);
writeFileSync(resolve(dir,name+'.json'),JSON.stringify({cmd,args,head,started,ended:new Date().toISOString(),exit:r.status,signal:r.signal,error:r.error?.message,log:path},null,2)+'\n');
console.log(JSON.stringify({name,exit:r.status,signal:r.signal,log:path}));process.exitCode=r.status??1;
