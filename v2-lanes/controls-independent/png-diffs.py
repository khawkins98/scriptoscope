"""Compare pinned Linux candidate sheets without changing either PNG plane."""
from pathlib import Path
from PIL import Image, ImageChops
import hashlib,json,re,sys
root=Path('/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent')
tag=sys.argv[3] if len(sys.argv)>3 else 'png-comparison'
old=root/'goldens-old';new=root/(sys.argv[1] if len(sys.argv)>1 else 'goldens-recorded');diff=root/(tag+'-diff');diff.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
recorded={f'{slug}-page-{page}.png' for slug,page in re.findall(r'› ([a-z0-9-]+): reviewed Linux Chromium contact sheet page([12]) ',(root/(sys.argv[2] if len(sys.argv)>2 else 'linux-record.log')).read_text())}
rows=[]
for a in sorted(old.glob('*.png')):
 b=new/a.name
 if not b.exists():rows.append({'name':a.name,'status':'missing-candidate'});continue
 row={'name':a.name,'recorded':a.name in recorded,'status':'UNAPPROVED CANDIDATE' if a.name in recorded else 'not recorded; original retained','oldSha256':sha(a),'newSha256':sha(b),'changed':sha(a)!=sha(b)}
 if row['changed']:
  x=Image.open(a).convert('RGBA');y=Image.open(b).convert('RGBA')
  row['oldSize']=list(x.size);row['newSize']=list(y.size)
  size=(max(x.width,y.width),max(x.height,y.height))
  xp=Image.new('RGBA',size);yp=Image.new('RGBA',size);xp.paste(x,(0,0));yp.paste(y,(0,0))
  delta=ImageChops.difference(xp,yp)
  changed=[any(p) for p in delta.getdata()]
  row['changedPixels']=sum(changed)
  row['diffAlignment']='top-left, transparent padding to max extent; no rescaling'
  heat=Image.new('RGB',size);heat.putdata([(255,0,255) if p else (255,255,255) for p in changed])
  heat.save(diff/a.name)

 rows.append(row)
(root/(tag+'.json')).write_text(json.dumps({'classification':'CANDIDATES; different Tier-2 and actual production demo review required','rows':rows},indent=2)+'\n')
print(json.dumps({'sheets':len(rows),'changed':sum(r.get('changed',False) for r in rows)}))
