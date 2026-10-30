"""Palette ramp / contrast / 8-bit collapse report for a scheme palette.
Input: a list of (name, hex). Output: per colour, the nearest system-palette entry, its
distance, and which names collapse to the same entry; plus WCAG contrast for named pairs."""
import sys, re, numpy as np
sys.path.insert(0,'/tmp/design-review'); from sim8 import PAL
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lum(c):
    def ch(v): v/=255; return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=c; return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b)
def contrast(a,b):
    la,lb=lum(hx(a)),lum(hx(b)); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def near(h):
    c=np.array(hx(h)); d=((PAL-c)**2).sum(1); i=int(d.argmin()); return tuple(int(v) for v in PAL[i]), float(d[i]**0.5)
def report(title, colours, pairs=()):
    print(f'== {title}')
    groups={}
    for name,h in colours:
        n,d=near(h); groups.setdefault(n,[]).append((name,h,d))
    for n,items in groups.items():
        flag=' <-- COLLAPSE' if len(items)>1 else ''
        print(f'  sys {"#%02x%02x%02x"%n}: '+', '.join(f'{nm} {h} (d={d:.0f})' for nm,h,d in items)+flag)
    for a,b,label in pairs:
        print(f'  contrast {label}: {contrast(a,b):.2f}:1')
if __name__=='__main__':
    report('Castle active stone + banner', [('stone0','#a59e91'),('stone1','#9d968a'),('stone2','#aaa396'),('stone3','#979084'),('stone4','#a19a8c'),('stoneHi','#c4bdaf'),('stoneLo','#7e786d'),('mortar','#615b52'),('outline','#2b2824'),('banner0','#9b2630'),('banner1','#8a1d26'),('banner2','#76161f'),('bannerLo','#4f0d13'),('trim','#d4a943'),('trimLo','#8d6b20'),('title','#f7e7b6')],
        [('#f7e7b6','#8a1d26','active title on banner'),('#efe8de','#857673','inactive title on banner'),('#f8eac4','#8a5a2e','button label on wood'),('#1a1816','#e0d9cb','body text on flagstone (approx)')])
    report('Castle inactive stone', [('stone0','#bdb9b2'),('stone1','#b8b4ad'),('stone2','#c1bdb6'),('stone3','#b4b0a9'),('stone4','#bbb7b0'),('stoneHi','#d2cec7'),('stoneLo','#a29e97'),('mortar','#94908a')])
    report('Brickworks red / yellow', [('red.base','#d8261c'),('red.gloss','#ff8f84'),('red.hi','#f2554a'),('red.lo','#b0180f'),('red.deep','#86100a'),('red.seam','#5a0a06'),('yel.base','#f7c51a'),('yel.gloss','#fff3b0'),('yel.hi','#ffe066'),('yel.lo','#d6a400'),('yel.deep','#a87e00'),('yel.seam','#634a00'),('white.base','#f6f5ef'),('white.lo','#dcdbd2'),('white.deep','#bdbcb2')],
        [('#1c1a17','#f6f5ef','active title on tile'),('#8a877f','#ebeae6','inactive title on faded tile (approx)'),('#1e1712','#f7c51a','button label on yellow')])
    report('Bonn active', [('barTop','#f4e4c7'),('barBottom','#dcc196'),('barLine','#b7966a'),('stone','#e2c9a0'),('stoneHi','#f2e2c4'),('stoneLo','#b99a70'),('red','#c0262d'),('redLo','#7e1419'),('yellow','#f4c430'),('sky','#24484f'),('skyHi','#3e6a70'),('glass0','#7fb1bd'),('glass1','#4f8795'),('glass2','#2e5b66'),('water0','#5fa3a3'),('water1','#3f8689'),('water2','#2b6a72'),('water3','#22565e'),('foam','#d9f0ec'),('tree0','#f7b7ca'),('tree1','#ee93ae'),('tree2','#fcd9e4')],
        [('#fff6de','#c0262d','active title on pennant'),('#4a423d','#ddd5c8','inactive title on plate (approx)'),('#1a1816','#fbf5ea','body text on cream')])
    report('Halcyon', [('barTop','#fbfcfe'),('barBottom','#e6ebf2'),('separator','#d2d8e1'),('border','#97a2b2'),('title','#1d2430'),('glyph','#4a5566'),('buttonEdge','#8d98a8'),('accent','#1689a8'),('in.title','#9aa1ab'),('in.border','#c4c9d0'),('in.barTop','#f6f7f9')],
        [('#1d2430','#eef2f7','active title on bar'),('#9aa1ab','#f6f7f9','inactive title on bar'),('#97a2b2','#ffffff','border vs white body'),('#c4c9d0','#ffffff','inactive border vs body'),('#4a5566','#f3f6f9','glyph on button'),('#ffffff','#1689a8','white glyph on accent')])
