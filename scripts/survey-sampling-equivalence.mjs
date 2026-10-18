import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const {enumerateForks,selectFork}=await import(root+'/tests/control-availability/source.mjs');
const {parseResourceFork}=await import(root+'/tools/theme-loader/resource-fork.js');
const {decodeCicn}=await import(root+'/tools/theme-loader/decoders/cicn.js');
const {convertChrome}=await import(root+'/tools/theme-loader/convert.js');
const choices=JSON.parse(readFileSync(root+'/tests/control-availability/source-choices.json')).sources;
const rows=[];const totals={};const headers=[];let companionAssets=0;
for(const choice of choices){
 const b=new Uint8Array(readFileSync(root+'/'+choice.path));const fork=selectFork(b,await enumerateForks(b,choice.format),choice);const counts={};
 const converted=convertChrome(fork.bytes);const companions=converted.assets.filter(a=>a.path.startsWith('cicn-sampled/')).length;companionAssets+=companions;
 for(const resource of parseResourceFork(fork.bytes).filter(r=>r.type==='cicn')){
  const d=decodeCicn(resource.data);const k=d.samplingEquivalence.status+':'+d.samplingEquivalence.reason;counts[k]=(counts[k]??0)+1;totals[k]=(totals[k]??0)+1;
 }
 for(const [key,e]of Object.entries(converted.theme.chromeElements))if([-9568,-9567,-9551,-9550].includes(e.sourceCicnId))headers.push({slug:choice.slug,key,id:e.sourceCicnId,dimensions:[e.width,e.height],slice:e.slice,bodyRequest:e.bodyRequest,samplingEquivalence:e.samplingEquivalence});
 rows.push({slug:choice.slug,archiveSha256:choice.archiveSha256,forkSha256:choice.forkSha256,counts,companionAssets:companions});
}
console.log(JSON.stringify({scope:'Observed metadata only; no independent expectation, used-band incidence or fidelity promotion',totals,companionAssets,rows,surveySignedIds:[-9568,-9567,-9551,-9550],pachHeaderDispatchIds:[-9568,-9567],headers},null,2));
