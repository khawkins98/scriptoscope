import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,linkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
const configURL=new URL('./isolated-vite.config.mjs',import.meta.url);
let ordinal=0;
async function load(root){process.env.TITLEBAR_RUN_ROOT=root;return (await import(`${configURL}?case=${ordinal++}`)).default;}
function run(){const p=realpathSync(mkdtempSync(join(tmpdir(),'titlebar-config-test-')));for(const d of ['work','web','logs'])mkdirSync(join(p,d));writeFileSync(join(p,'titlebar-owned-run.json'),JSON.stringify({purpose:'titlebar-pair-v1'}));for(const f of ['system755-run.dsk','transfer-run.dsk'])writeFileSync(join(p,'work',f),'abcdefgh');return p;}
test('reject unmarked media and hardlinked shared media',async()=>{
 const p=run();try{rmSync(join(p,'titlebar-owned-run.json'));await assert.rejects(load(p));writeFileSync(join(p,'titlebar-owned-run.json'),JSON.stringify({purpose:'titlebar-pair-v1'}));linkSync(join(p,'work/system755-run.dsk'),join(p,'work/shared.dsk'));await assert.rejects(load(p),/never linked seeds/);}finally{rmSync(p,{recursive:true,force:true});}
});
test('real HTTP media I/O rejects missing or invalid coordinates and releases run lock',async()=>{
 const p=run();let server;
 try{
  const config=await load(p),routes=new Map();
  server=createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');const route=routes.get(url.pathname);if(!route){res.writeHead(404).end();return;}req.url=url.search;route(req,res);});
  config.plugins[0].configureServer({httpServer:server,middlewares:{use:(path,fn)=>routes.set(path,fn)}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  for(const query of ['?length=1','?offset=&length=1','?offset=0','?offset=0&length=','?offset=NaN&length=1','?offset=7&length=2'])assert.equal((await fetch(base+'/__disk'+query)).status,400);
  assert.equal((await fetch(base+'/__disk?length=1',{method:'POST',body:'X'})).status,400);
  assert.equal(readFileSync(join(p,'work/system755-run.dsk'),'utf8'),'abcdefgh');
  assert.equal(await (await fetch(base+'/__disk?offset=1&length=3')).text(),'bcd');
  assert.equal((await fetch(base+'/__disk?offset=3',{method:'POST',body:'XY'})).status,200);
  assert.equal(readFileSync(join(p,'work/system755-run.dsk'),'utf8'),'abcXYfgh');
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  assert.throws(()=>readFileSync(join(p,'titlebar-server.lock')),/ENOENT/);
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));rmSync(p,{recursive:true,force:true});}
});
test('owned subprocess SIGINT/SIGTERM removes lock before exiting',{timeout:5000},async()=>{
 for(const [signal,code] of [['SIGINT',130],['SIGTERM',143]]){
  const p=run();let child;
  try{
   const script=`import config from ${JSON.stringify(configURL.href)};import {EventEmitter} from 'node:events';config.plugins[0].configureServer({httpServer:new EventEmitter(),middlewares:{use(){}}});console.log('owned-ready');setInterval(()=>{},1000);`;
   child=spawn(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TITLEBAR_RUN_ROOT:p},stdio:['ignore','pipe','pipe']});
   const [ready]=await once(child.stdout,'data');assert.match(ready.toString(),/owned-ready/);
   const exited=once(child,'exit');child.kill(signal);assert.deepEqual(await exited,[code,null]);
   assert.throws(()=>readFileSync(join(p,'titlebar-server.lock')),/ENOENT/);
  }finally{if(child?.exitCode===null)child.kill('SIGKILL');rmSync(p,{recursive:true,force:true});}
 }
});
test('read/write only bounded owned media; close releases descriptor',async()=>{
 const p=run();try{
  const config=await load(p),routes=new Map(),http=new EventEmitter();
  config.plugins[0].configureServer({httpServer:http,middlewares:{use:(path,fn)=>routes.set(path,fn)}});
  assert.throws(()=>config.plugins[0].configureServer({httpServer:new EventEmitter(),middlewares:{use(){}}}),/EEXIST/);
  const invoke=(method,url,data)=>{const req=new EventEmitter();req.method=method;req.url=url;req.destroy=()=>{req.destroyed=true;};let bytes;const res={statusCode:200,setHeader(){},end(b){bytes=b;}};routes.get('/__disk')(req,res);if(data){req.emit('data',Buffer.from(data));req.emit('end');}return {req,res,bytes};};
  assert.equal(invoke('GET','?offset=2&length=3').bytes.toString(),'cde');
  assert.equal(invoke('GET','?offset=-1&length=3').res.statusCode,400);
  assert.equal(invoke('GET','?offset=7&length=2').res.statusCode,400);
  assert.equal(invoke('POST','?offset=2','XY').res.statusCode,200);
  assert.equal(readFileSync(join(p,'work/system755-run.dsk'),'utf8'),'abXYefgh');
  assert.equal(invoke('POST','?offset=7','long').req.destroyed,true);
  assert.equal(readFileSync(join(p,'work/system755-run.dsk'),'utf8'),'abXYefgh');
  http.emit('close');assert.throws(()=>invoke('GET','?offset=0&length=1'),/bad file descriptor|EBADF/);assert.throws(()=>readFileSync(join(p,'titlebar-server.lock')),/ENOENT/);
 }finally{rmSync(p,{recursive:true,force:true});}
});
