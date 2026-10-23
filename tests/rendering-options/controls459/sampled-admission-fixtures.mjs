// Port of the independently frozen finite admission probe. Expected pixels live
// in sampled-admission-checks.mjs, never computed by this collector.
import { forkOf } from '../../resource-provenance/fixtures.mjs';
import { sampledBandIcon, sampledBandInfo } from '../../decoder-fixtures/sampled-bands.mjs';
export const sampledKinds=['valid','badAlpha','badSize','unsafePresent','noProofPresent','emptyAsset','wrongAssetType','nullAsset','symbolAsset','objectAsset','pathSymbol','badComparison','badPathType','transparent','equivalent','decodeError','selected-base'];
export async function collectSampledAdmission(api,kinds=sampledKinds) {
 const rows=[];
 for(const observed of [false,true])for(const kind of kinds){
  const owner=await api.loadKaleidoscopeScheme(forkOf([
   {type:'cicn',id:-10239,name:'face',data:sampledBandIcon({transparent:kind==='transparent',...(kind==='equivalent'?{sampledRgb:[65535,0,0]}:{})})},
   {type:'cinf',id:-10239,data:sampledBandInfo()},
  ]),{provenance:observed});
  owner.baseUrl=location.origin+'/sampled-owner/';
  const e=owner.manifest.chromeElements.face,original=e.sampledBandAsset?.asset;
  const ordinary=api.assetUrl(owner,e.asset),opaque=api.assetUrl(owner,e.iconBlit.unmaskedAsset);
  let coercions=0;
  if(kind==='badAlpha'||kind==='badSize'){
   const c=document.createElement('canvas');c.width=kind==='badSize'?8:7;c.height=7;const ctx=c.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,c.width,7);e.sampledBandAsset={...e.sampledBandAsset,asset:c.toDataURL()};
  }
  if(kind==='unsafePresent')e.samplingEquivalence={...e.samplingEquivalence,status:'unknown',reason:'unsafe-palette-access'};
  if(kind==='noProofPresent')delete e.samplingEquivalence;
  if(kind==='emptyAsset')e.sampledBandAsset={...e.sampledBandAsset,asset:''};
  if(kind==='wrongAssetType')e.sampledBandAsset={...e.sampledBandAsset,asset:42};
  if(kind==='nullAsset')e.sampledBandAsset={...e.sampledBandAsset,asset:null};
  if(kind==='symbolAsset')e.sampledBandAsset={...e.sampledBandAsset,asset:Symbol('invalid')};
  if(kind==='objectAsset')e.sampledBandAsset={...e.sampledBandAsset,asset:{toString(){coercions++;throw Error('asset coercion before eligibility');}}};
  if(kind==='pathSymbol')e.sampledBandAsset={...e.sampledBandAsset,derivedPath:Symbol('invalid')};
  if(kind==='badComparison')e.sampledBandAsset={...e.sampledBandAsset,comparison:'bad'};
  if(kind==='badPathType')e.sampledBandAsset={...e.sampledBandAsset,derivedPath:{toString(){coercions++;return 'cicn-sampled/fake.png';}}};
  if(kind==='decodeError')e.sampledBandAsset={...e.sampledBandAsset,asset:'data:image/png;base64,AAAA'};
  const descriptor=e.sampledBandAsset;
  const scalar=(value)=>typeof value==='string'||typeof value==='number'||value===null?value:{type:typeof value};
  const descriptorSnapshot=descriptor?Object.fromEntries(Object.entries(descriptor).map(([key,value])=>[key,scalar(value)])):null;
  const decode=HTMLImageElement.prototype.decode,calls=[];let trace,count=0,p,error;
  HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
  const theme=kind==='selected-base'?{base:owner,baseUrl:location.origin+'/wrong-child/',manifest:{chromeElements:{}}}:owner;
  try{p=await api.composeButton(theme,{label:'',default:false,minWidth:29,height:17,diagnostics:{onComplete:v=>{count++;trace=v;}}});}
  catch(err){error={name:err.name,message:err.message};}
  finally{HTMLImageElement.prototype.decode=decode;owner.dispose();}
  rows.push({kind,observed,original,ordinary,opaque,descriptor:descriptorSnapshot,proof:e.samplingEquivalence,owner:owner.baseUrl,
   calls,count,coercions,error,band:p?[...p.getPixel(4,0)]:null,hole:p?[...p.getPixel(4,3)]:null,corner:p?[...p.getPixel(0,0)]:null,
   size:p?[p.width,p.height]:null,trace,provenance:owner.byteProvenance});
 }
 return rows;
}
