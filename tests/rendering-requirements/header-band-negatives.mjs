import { headerLiteralPixels } from './header-band-cases.mjs';
const face=row=>row.trace.steps.find(s=>s.role==='face'&&s.action==='selected');
export const headerBandMutations = indices => [
  ['missing row',rows=>rows.pop()],['duplicate row',rows=>rows.push(structuredClone(rows[0]))],
  ['wrong exact case',rows=>{rows[0].caseId='unregistered';}],
  ['wrong options',rows=>{rows[0].options.height++;}],
  ['wrong fixture predicate',rows=>{rows[0].selector.tile='wrong';}],
  ['wrong requested state',rows=>{rows[0].trace.requested.pressed=true;}],
  ['wrong owner',rows=>{face(rows[0]).owner.baseUrl='wrong-owner';}],
  ['wrong depth',rows=>{face(rows[0]).owner.chainDepth=99;}],
  ['wrong load',rows=>{face(rows[0]).resource.byteProvenance.loadId='wrong-load';}],
  ['wrong cicn occurrence',rows=>{face(rows[0]).resource.byteProvenance.cicnResourceIndex=99;}],
  ['wrong cinf occurrence',rows=>{face(rows[0]).resource.byteProvenance.cinfResourceIndex=99;}],
  ['wrong manifest key',rows=>{face(rows[0]).resource.manifestKey='wrong-key';}],
  ['wrong signed id',rows=>{face(rows[0]).resource.signedId=-1;}],
  ['wrong payload hash',rows=>{rows[0].owner.byteProvenance.resources[0].sha256='0'.repeat(64);}],
  ['wrong fork hash',rows=>{rows[0].owner.byteProvenance.fork.sha256='0'.repeat(64);}],
  ['missing actual resources',rows=>{rows[0].owner.byteProvenance.resources=[];}],
  ...(indices[0]===0?[
    ['wrong raw UInt32 state',rows=>{rows[0].options.drawState=0;}],
    ['zero state incorrectly selects active id',rows=>{face(rows[1]).resource.signedId=-9567;}],
    ['wrong literal pixel',rows=>{rows[0].pixels[0][0]=[0,0,0,0];}],
    ['wrong clip phase',rows=>{rows[1].pixels[2][6]=rows[1].pixels[2][5];}],
    ['ordinary-height pixels substituted for list-view',rows=>{
      // Actual pixel mutation with the diagnostic unchanged: ordinary H=13 has
      // lower band7/6 at (8,10)/(9,10); list-view H+1=14 retains solid body there.
      const ordinary=headerLiteralPixels(0);rows[1].pixels[10][8]=ordinary[10][8];rows[1].pixels[10][9]=ordinary[10][9];
    }],
    ['wrong paint height trace only',rows=>{rows[1].trace.headerSurface.paintRect.h=13;}],
    ['wrong context origin',rows=>{rows[0].trace.headerSurface.context.controlOrigin=[0,0];}],
    ['wrong effective clip',rows=>{rows[1].trace.headerSurface.effectiveClip.w=9;}],
    ['wrong missing-pattern decision',rows=>{rows[0].trace.steps.find(s=>s.role==='body-fill').action='selected';}],
    ['no actual paint',rows=>{rows[0].trace.steps=rows[0].trace.steps.filter(s=>s.usage!=='paint');}],
  ]:indices[0]===2?[
    ['stale unsupported result',rows=>{rows[0].status='unsupported';}],
    ['raster red substituted for sampled gray',rows=>{rows[0].pixels[0][4]=[255,0,0,255];}],
    ['missing output pixels',rows=>{rows[0].pixels=null;}],
    ['false sampling proof',rows=>{rows[0].sampling.status='equivalent';}],
    ['missing actual sampled dependency',rows=>{rows[0].trace.bandPaints=[];}],
    ['wrong sampled dependency URL',rows=>{rows[0].trace.bandPaints[0].derived.assetUrl='blob:wrong';}],
  ]:[
    ['raster red substituted for sampled band',rows=>{rows[0].pixels[0].rgba=[255,0,0,255];}],
    ['sampled gray substituted for ordinary corner',rows=>{rows[0].pixels[2].rgba=[48,48,48,255];}],
    ['missing companion paint',rows=>{rows[0].trace.bandPaints=rows[0].trace.bandPaints.filter(b=>b.policy!=='sampled-companion');}],
    ['wrong companion owner',rows=>{rows[0].trace.bandPaints.find(b=>b.policy==='sampled-companion').owner.baseUrl='wrong';}],
    ['wrong companion occurrence',rows=>{rows[0].trace.bandPaints.find(b=>b.policy==='sampled-companion').resource.byteProvenance.cicnResourceIndex=99;}],
    ['wrong companion path',rows=>{rows[0].trace.bandPaints.find(b=>b.policy==='sampled-companion').derived.path='wrong.png';}],
    ['wrong companion transport URL',rows=>{rows[0].trace.bandPaints.find(b=>b.policy==='sampled-companion').derived.assetUrl='blob:wrong-companion';}],
    ['wrong observed owner companion URL',rows=>{rows[0].owner.element.sampledBandAsset.asset='blob:wrong-owner-companion';}],
    ['wrong companion branch',rows=>{rows[0].trace.bandPaints.find(b=>b.policy==='sampled-companion').branch='copy';}],
  ]),
];
