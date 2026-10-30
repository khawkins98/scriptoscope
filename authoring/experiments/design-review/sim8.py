"""8-bpp simulation: map every pixel of a PNG to the nearest Mac system-palette entry
(the 6x6x6 cube + 4 ten-step ramps, as classic Kaleidoscope on an 8-bit screen does).
Usage: python3 -I sim8.py in.png out.png [--dpr 2] [--zoom 4]
--dpr 2 takes every 2nd pixel first (the preview pages are DPR-2 captures)."""
import sys, numpy as np
from PIL import Image
L=[255,204,153,102,51,0]; pal=[(L[x//36],L[(x//6)%6],L[x%6]) for x in range(215)]
R=[238,221,187,170,136,119,85,68,34,17]
pal+= [(v,0,0) for v in R]+[(0,v,0) for v in R]+[(0,0,v) for v in R]+[(v,v,v) for v in R]+[(0,0,0)]
PAL=np.array(pal,dtype=np.int32)
def nearest(rgb):  # rgb: (...,3) int
    flat=rgb.reshape(-1,3)
    out=np.empty_like(flat)
    for i in range(0,len(flat),65536):
        chunk=flat[i:i+65536]
        d=((chunk[:,None,:]-PAL[None,:,:])**2).sum(-1)
        out[i:i+65536]=PAL[d.argmin(1)]
    return out.reshape(rgb.shape)
if __name__=='__main__':
    a=sys.argv; src,dst=a[1],a[2]
    dpr=int(a[a.index('--dpr')+1]) if '--dpr' in a else 1
    zoom=int(a[a.index('--zoom')+1]) if '--zoom' in a else 1
    im=Image.open(src).convert('RGB')
    if dpr>1: im=im.resize((im.width//dpr,im.height//dpr),Image.NEAREST)
    q=Image.fromarray(nearest(np.array(im,dtype=np.int32)).astype(np.uint8))
    if zoom>1: q=q.resize((q.width*zoom,q.height*zoom),Image.NEAREST)
    q.save(dst); print(dst,q.size)
