import json,hashlib,io,concurrent.futures,urllib.request
from pathlib import Path
from PIL import Image,ImageOps
urls=json.loads(Path('verification/card-image-sources.json').read_text())
out=Path('assets/character-thumbnails');out.mkdir(exist_ok=True)
def convert(url):
 try:
  data=Path(url).read_bytes() if url.startswith('assets/media-originals/') else urllib.request.urlopen(url,timeout=25).read()
  with Image.open(io.BytesIO(data)) as image:
   image=ImageOps.exif_transpose(image).convert('RGB');image.thumbnail((560,840))
   path=out/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.webp');image.save(path,'WEBP',quality=83,method=6)
  return url,{'src':path.as_posix(),'originalBytes':len(data),'bytes':path.stat().st_size}
 except Exception as e:return url,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results=dict(pool.map(convert,urls))
good={u:r['src'] for u,r in results.items() if 'src'in r}
Path('assets/atlas-character-thumbnails.js').write_text('window.ATLAS_CHARACTER_THUMBNAILS = '+json.dumps(good,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
Path('verification/card-image-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'images':len(good),'failed':{u:r for u,r in results.items() if 'error'in r},'before':sum(r.get('originalBytes',0) for r in results.values()),'after':sum(r.get('bytes',0) for r in results.values())}))
