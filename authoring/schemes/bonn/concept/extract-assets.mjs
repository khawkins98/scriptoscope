// Actual concept extraction, not a paint-over or a building redraw.
// Convert the original JPEG losslessly first, e.g.:
// sips -s format png authoring/schemes/bonn/concept/concept.jpg --out /tmp/bonn-concept.png
// node authoring/schemes/bonn/concept/extract-assets.mjs /tmp/bonn-concept.png /tmp/bonn-assets/
// The 6× PNGs are inspection previews only. Ship the 1× transparent PNGs.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {decodePng} from '../../../../scripts/lib/png-decode.mjs';
import {encodePng} from '../../../../scripts/lib/png-encode.mjs';
const root=process.argv[3] ?? 'authoring/schemes/bonn/sprites/';
if (!process.argv[2]) throw new Error('Usage: node authoring/schemes/bonn/concept/extract-assets.mjs <concept converted to PNG> [output directory]');
mkdirSync(root, {recursive:true});
const im=decodePng(readFileSync(process.argv[2]));
if (im.width !== 1024 || im.height !== 765) throw new Error(`Expected the original 1024×765 concept; received ${im.width}×${im.height}`);
const specs=[
{name:'minster',crop:[459,27,123,234],polygon:[[460,260],[460,236],[463,236],[463,174],[467,174],[467,159],[470,159],[470,138],[475,138],[476,154],[480,154],[480,165],[485,165],[486,177],[493,177],[493,118],[497,118],[497,95],[502,95],[502,78],[508,78],[508,61],[513,61],[513,46],[517,46],[518,27],[522,27],[523,47],[526,47],[526,62],[530,62],[530,78],[534,78],[535,95],[539,95],[540,118],[543,118],[543,177],[550,177],[550,170],[554,170],[554,154],[559,154],[560,137],[565,137],[565,155],[569,155],[569,169],[574,169],[574,236],[580,236],[580,260]]},
{name:'rathaus',crop:[618,117,162,144],polygon:[[620,260],[620,200],[618,198],[625,193],[627,188],[632,185],[633,179],[640,173],[643,166],[689,166],[690,145],[693,145],[691,139],[693,132],[690,130],[694,125],[694,118],[699,119],[700,126],[705,130],[703,135],[700,135],[702,141],[700,146],[704,146],[704,165],[751,165],[755,171],[760,174],[764,182],[770,185],[770,192],[777,195],[779,199],[774,201],[774,260]]},
{name:'post-tower',crop:[822,66,75,195],polygon:[[823,260],[823,85],[835,85],[835,72],[876,72],[876,68],[894,68],[894,260]]},
{name:'cherry-bough',crop:[168,165,231,96],colorMask:true},
{name:'bridge',crop:[438,633,231,75],polygon:[[443,633],[665,633],[665,686],[669,686],[669,706],[439,706],[439,686],[443,686]],waterMask:true}
];
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[d,e]=p[j];if((b>y)!=(e>y)&&x<(d-a)*(y-b)/(e-b)+a)c=!c;}return c;}
const extracted=[];
for(const spec of specs){const[cx,cy,cw,ch]=spec.crop,w=cw/3,h=ch/3,rgba=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=cx+x*3+1,sy=cy+y*3+1,i=(sy*im.width+sx)*4;const[r,g,b]=im.rgba.subarray(i,i+3);let keep=spec.colorMask ? sy<256 && ((r>g+18&&b>g+8)||(r>g+12&&r>b+20)||(r<70&&g<70&&b<70)) : inside(sx,sy,spec.polygon);if(spec.name==='minster'&&sy<118&&r>g+3&&r>b+3)keep=false;if(spec.waterMask&&((g>r+10&&b>r+5)||(r>170&&g>190&&b>190)))keep=false;if(keep)rgba.set([r,g,b,255],(y*w+x)*4);}extracted.push({...spec,w,h,rgba});}
// Shared median-cut palette preserves the source hues. No system-palette or
// scheme-palette substitution and no feature paint-over occurs here.
function makePalette(images,maximum){
const histogram=new Map();for(const a of images)for(let i=0;i<a.rgba.length;i+=4)if(a.rgba[i+3]){const rgb=Array.from(a.rgba.subarray(i,i+3));const k=rgb.join(',');if(histogram.has(k))histogram.get(k).n++;else histogram.set(k,{rgb,n:1});}
const boxes=[[...histogram.values()]];
const range=b=>[0,1,2].map(c=>Math.max(...b.map(p=>p.rgb[c]))-Math.min(...b.map(p=>p.rgb[c])));
while(boxes.length<maximum){let best=-1,score=-1,channel=0;for(let i=0;i<boxes.length;i++){if(boxes[i].length<2)continue;const rr=range(boxes[i]);const c=rr.indexOf(Math.max(...rr));const s=rr[c]*Math.sqrt(boxes[i].reduce((n,p)=>n+p.n,0));if(s>score){best=i;score=s;channel=c;}}if(best<0)break;const box=boxes.splice(best,1)[0].sort((a,b)=>a.rgb[channel]-b.rgb[channel]);const total=box.reduce((n,p)=>n+p.n,0);let n=0,k=0;while(k<box.length-1&&n<total/2)n+=box[k++].n;boxes.push(box.slice(0,k),box.slice(k));}
return boxes.map(b=>{const n=b.reduce((n,p)=>n+p.n,0);return[0,1,2].map(c=>Math.round(b.reduce((v,p)=>v+p.rgb[c]*p.n,0)/n));});
}
const pal=makePalette(extracted.filter(a=>a.name!=='bridge'),96);
const bridgePalette=makePalette(extracted.filter(a=>a.name==='bridge'),32);
const nearest=(rgb,palette=pal)=>{let best=0,d=Infinity;for(let k=0;k<palette.length;k++){const q=palette[k],dd=2*(rgb[0]-q[0])**2+4*(rgb[1]-q[1])**2+3*(rgb[2]-q[2])**2;if(dd<d){d=dd;best=k;}}return palette[best];};
for(const a of extracted){for(let i=0;i<a.rgba.length;i+=4)if(a.rgba[i+3])a.rgba.set(nearest(a.rgba.subarray(i,i+3),a.name==='bridge'?bridgePalette:pal),i);writeFileSync(join(root,a.name+'.png'),encodePng(a.w,a.h,a.rgba));const z=6,big=new Uint8Array(a.w*a.h*z*z*4);for(let y=0;y<a.h*z;y++)for(let x=0;x<a.w*z;x++){const i=(Math.floor(y/z)*a.w+Math.floor(x/z))*4;big.set(a.rgba.subarray(i,i+4),(y*a.w*z+x)*4);}writeFileSync(join(root,a.name+'-6x.png'),encodePng(a.w*z,a.h*z,big));console.log(a.name,a.w,a.h);}
