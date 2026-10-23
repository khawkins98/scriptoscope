import { prepareCicnTransferResults, type CicnTransferData, type CicnTransferOption, prepareDisplayProfile, type DisplayProfileData, loadKaleidoscopeScheme, CicnTransferError } from 'scriptoscope';
const channels = Array.from({length:256}, (_,i)=>(i+3)%256);
const producer = {model:'rgb16-high-byte-table' as const, channels:[channels,channels,channels] as const};
const devicePalette = [{index:2,rgb16:[4352,4352,4352] as const},{index:3,rgb16:[8448,8448,8448] as const}];
const data: CicnTransferData = {"version":1,"scope":"finite-raster-preparation","environment":{producer,devicePalette,"deviceEvidenceSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","engineEvidenceSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"records":[{"source":{"payloadSha256":"4b4f5271e7e3a9957577942c323425ef068bc4951ae9e2db3ea38182a8436a0a","byteLength":104,"indexedRepresentationSha256":"68c4a3f29cb50d37eff4ca4fea21562c9140b11cf10682cca61517e35eabe07b"},"operation":{"name":"GetCIcon-CopyBits","mode":"srcCopy","masked":false,"foregroundRGB16":[0,0,0],"backgroundRGB16":[65535,65535,65535],"sourceRect":[0,0,3,1],"destinationRect":[5,6,8,7],"clipRect":[5,6,8,7],"portRect":[0,0,20,20],"localZeroGlobal":[40,70]},"preparationEvidenceSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","evidence":[{"sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","description":"Owned literal fixture; not an original observation"}],"destinationIndices":[2,3,2]}]};
const profileData: DisplayProfileData = {producer,devicePalette,...{"version":1,"conditions":{"kind":"owned-literal-fixture"},"evidence":[{"sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","description":"Owned literal source sampler mapping"}],"mappings":[{"rgb16":[65535,0,0],"deviceIndex":2,"deviceRgb16":[4352,4352,4352]}]}};
const bytes = Uint8Array.from([0,0,0,16,0,0,0,124,0,0,0,108,0,0,0,56,0,0,0,104,0,0,0,0,128,2,0,0,0,0,0,1,0,3,0,0,0,0,0,0,0,0,0,72,0,0,0,72,0,0,0,0,0,4,0,1,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1,0,3,0,0,0,0,0,2,0,0,0,0,0,1,0,3,0,0,0,0,192,0,192,0,0,0,0,0,0,0,0,0,0,0,255,255,0,0,0,0,153,144,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,28,0,50,0,0,99,105,99,110,0,0,0,10,216,1,0,0,0,0,0,0,0,0,0,0,5,111,119,110,101,100]);
export async function verifyFiniteTransfer() {
  const results = await prepareCicnTransferResults(data), displayProfile = await prepareDisplayProfile(profileData);
  const cicnTransfer: CicnTransferOption = {results,contractId:results.contractId,maskPolicy:'source-mask-alpha'};
  let encoded=0;
  const planes = new Set<string>();
  const theme=await loadKaleidoscopeScheme(bytes,{displayProfile,cicnTransfer,assetUrlFactory:(rgba,width,height,path)=>{
    encoded++;
    const opaque = path === 'cicn-unmasked/cicn-n10239-owned.png';
    if (!opaque && path !== 'cicns/cicn-n10239-owned.png') throw Error('Unexpected packed finite asset identity');
    if (planes.has(path)) throw Error('Duplicate packed finite asset');
    planes.add(path);
    // Same finite CopyBits source record, with source mask alpha only on the
    // original plane; the new deep-icon companion preserves its hidden RGB.
    if(width!==3 || height!==1 || JSON.stringify([...rgba])!==JSON.stringify([20,20,20,255,36,36,36,255,20,20,20,opaque ? 255 : 0])) throw Error('Packed finite plane/mask drift');
    return opaque ? 'owned:finite-opaque' : 'owned:finite-plane';
  }});
  const evidence=theme.manifest.chromeElements.owned!.cicnTransfer;
  if(encoded!==2 || planes.size!==2 || evidence?.resultsId!==results.id || evidence.resource.signedId!==-10239 || !Object.isFrozen(evidence.operation)) throw Error('Packed finite identity failed');
  theme.dispose?.();
  let rejected=false;
  try{await loadKaleidoscopeScheme(bytes,{displayProfile,cicnTransfer:{...cicnTransfer,contractId:'cicn-transfer-context:wrong'},assetUrlFactory:()=>{encoded++;return'never';}});}
  catch(e){if(!(e instanceof CicnTransferError))throw e;rejected=true;}
  if(!rejected || encoded!==2)throw Error('Packed context mismatch allocated asset');
}
