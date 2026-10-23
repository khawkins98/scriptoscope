"""Compare pinned Linux candidate sheets without changing either PNG plane."""
from pathlib import Path
from PIL import Image, ImageChops
import hashlib,json,re
root=Path('/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent')
old=root/'goldens-old';new=root/'goldens-recorded';diff=root/'goldens-diff';diff.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
recorded={f'{slug}-page-{page}.png' for slug,page in re.findall(r'✓[^\n]*?› ([^:]+):[^\n]*?page([12]) ',(root/'linux-record.log').read_text())}
rows=[]
for a in sorted(old.glob('*.png')):
 b=new/a.name
 if not b.exists():rows.append({'name':a.name,'status':'missing-candidate'});continue
 row={'name':a.name,'recorded':a.name in recorded,'status':'UNAPPROVED CANDIDATE' if a.name in recorded else 'not recorded; original retained','oldSha256':sha(a),'newSha256':sha(b),'changed':sha(a)!=sha(b)}
 if row['changed']:
  x=Image.open(a).convert('RGBA');y=Image.open(b).convert('RGBA')
  row['oldSize']=list(x.size);row['newSize']=list(y.size)
  if x.size==y.size:
   delta=ImageChops.difference(x,y);bbox=delta.convert('RGB').getbbox();row['rgbDiffBounds']=bbox
   row['changedPixels']=sum(p!=(0,0,0,0) for p in delta.getdata())
   delta.save(diff/a.name)
  else:row['diff']='size changed; compare full old/new sheets'
 rows.append(row)
(root/'png-comparison.json').write_text(json.dumps({'classification':'CANDIDATES; different Tier-2 and actual production demo review required','rows':rows},indent=2)+'\n')
print(json.dumps({'sheets':len(rows),'changed':sum(r.get('changed',False) for r in rows)}))
