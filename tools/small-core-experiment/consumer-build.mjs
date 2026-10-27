import { writeFile } from 'node:fs/promises';
import { build } from 'vite';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
const names=['renderWindow','composeButton','bufferToCanvas','platinumCheckable','platinumSlider','platinumScrollbar','platinumDisclosure','platinumBevelButton','platinumMenuBar','platinumMenu','platinumPopupMenu','platinumListHeader'];
const results=[];
for(const [label,entry]of [['baseline','scriptoscope'],['boundary','scriptoscope'],['boundary','renderer']]) {
  const dir=import.meta.dirname, input=resolve(dir,'consumer.mjs');
  await writeFile(input,`import {${names.join(',')}} from './artifacts/${label}/${entry}.js'; import {scene} from './scene.mjs'; globalThis.runScene=()=>scene({${names.join(',')}});`);
  let metric;
  await build({configFile:false,logLevel:'error',build:{outDir:`${dir}/artifacts/consumer-${label}-${entry}`,lib:{entry:input,formats:['es']},rollupOptions:{output:{entryFileNames:'consumer.js'}}},plugins:[{name:'metric',generateBundle(_,bundle){
    const chunks=Object.values(bundle).filter(b=>b.type==='chunk');
    metric={label,entry,js:chunks.reduce((n,c)=>n+Buffer.byteLength(c.code),0),gzip:chunks.reduce((n,c)=>n+gzipSync(c.code).length,0),chunks:chunks.map(c=>({file:c.fileName,bytes:Buffer.byteLength(c.code)}))};
  }}]});
  results.push(metric);
}
await writeFile(new URL('./artifacts/consumer.json',import.meta.url),JSON.stringify(results,null,2));
console.log(results);
