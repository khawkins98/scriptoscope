// Independent full-bounds adapter model. checkables.md §5 supplies placement;
// its Modern public allocation declares D=16×20 for empty labels. No src imports,
// opaque-bounds crop or renderer-derived expected plane.
export function checkablePresentation(source,lane) {
 const x=lane==='icon'?0:8-Math.trunc(source.width/2);
 const y=lane==='icon'?Math.floor((20-12)/2):Math.trunc((20-source.height)/2);
 const left=Math.min(0,x),top=Math.min(0,y);
 const width=Math.max(16,x+source.width)-left,height=Math.max(20,y+source.height)-top;
 const rgba=new Array(width*height*4).fill(0);
 for(let sy=0;sy<source.height;sy++)for(let sx=0;sx<source.width;sx++){
  const from=(sy*source.width+sx)*4,to=((y-top+sy)*width+x-left+sx)*4;
  rgba.splice(to,4,...source.rgba.slice(from,from+4));
 }
 return {width,height,rgba};
}
