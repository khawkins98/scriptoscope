// Dedicated capture glue. Requires an explicitly marked, private restored copy.
import {readFileSync, realpathSync, lstatSync, openSync, closeSync, readSync, writeSync, appendFileSync, unlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
const supplied = process.env.TITLEBAR_RUN_ROOT;
if (!supplied) throw Error('TITLEBAR_RUN_ROOT must name your newly restored isolated run');
const root = realpathSync(supplied);
if (root !== resolve(supplied)) throw Error('Run root must be a real absolute path');
const marker = JSON.parse(readFileSync(join(root, 'titlebar-owned-run.json'), 'utf8'));
if (marker.purpose !== 'titlebar-pair-v1') throw Error('Missing dedicated ownership marker');
const disk = join(root, 'work/system755-run.dsk'), transfer = join(root, 'work/transfer-run.dsk');
for (const p of [disk, transfer]) {
  const s = lstatSync(p);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || realpathSync(p) !== p) throw Error('Media must be fresh regular copies, never linked seeds');
}
const port = Number(process.env.TITLEBAR_PORT ?? 4495);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid private port');
export default {root: join(root, 'web'), server: {host:'127.0.0.1', port, strictPort:true, headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}, plugins:[{
  name:'isolated-titlebar-media', configureServer(server) {
    const lock=join(root,'titlebar-server.lock'), lockFD=openSync(lock,'wx');
    closeSync(lockFD);
    let fd;
    try {fd=openSync(disk,'r+');} catch(error) {unlinkSync(lock);throw error;}
    const size = lstatSync(disk).size;
    let closed = false;
    const cleanup=()=>{if (!closed) {closed=true;closeSync(fd);unlinkSync(lock);process.removeListener('exit',cleanup);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',terminate);}};
    const interrupt=()=>{cleanup();process.exit(130);}, terminate=()=>{cleanup();process.exit(143);};
    process.once('exit',cleanup);
    process.once('SIGINT',interrupt);
    process.once('SIGTERM',terminate);
    server.httpServer?.once('close',cleanup);
    server.httpServer?.once('error',cleanup);
    server.middlewares.use('/transfer.dsk', (_req,res) => {res.setHeader('Content-Type','application/octet-stream'); res.end(readFileSync(transfer));});
    server.middlewares.use('/__disk', (req,res) => {
      const url = new URL(req.url, 'http://127.0.0.1'), offset = Number(url.searchParams.get('offset'));
      if (!url.searchParams.has('offset') || !url.searchParams.get('offset')?.trim() || !Number.isSafeInteger(offset) || offset < 0 || offset > size) {res.statusCode=400;res.end();return;}
      if (req.method==='GET') {
        const length = Number(url.searchParams.get('length'));
        if (!url.searchParams.has('length') || !url.searchParams.get('length')?.trim() || !Number.isSafeInteger(length) || length<0 || length>262144 || offset+length>size) {res.statusCode=400;res.end();return;}
        const b=Buffer.alloc(length);const n=readSync(fd,b,0,length,offset);if(n!==length){res.statusCode=500;res.end();return;}res.end(b);
      } else if (req.method==='POST') {
        const chunks=[];let count=0;
        req.on('data', b => {count+=b.length;if(count>262144 || offset+count>size)req.destroy();else chunks.push(b);});
        req.on('end', () => {if(req.destroyed)return;const b=Buffer.concat(chunks);const n=writeSync(fd,b,0,b.length,offset);appendFileSync(join(root,'logs/disk-writes.jsonl'),JSON.stringify({at:new Date().toISOString(),offset,length:n})+'\n');res.statusCode=n===b.length?200:500;res.end();});
      } else {res.statusCode=405;res.end();}
    });
  }
}]};
