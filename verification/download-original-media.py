import json,hashlib,concurrent.futures,urllib.request,urllib.parse
from pathlib import Path
urls=json.loads(Path('verification/tilda-sources.json').read_text());out=Path('assets/media-originals');out.mkdir(exist_ok=True)
def fetch(url):
 try:
  ext=Path(urllib.parse.urlparse(url).path).suffix.lower();name=hashlib.sha256(url.encode()).hexdigest()[:24]+ext
  path=out/name
  if path.exists():return url,{'path':path.as_posix(),'bytes':path.stat().st_size}
  data=urllib.request.urlopen(url,timeout=30).read()
  if not data:raise ValueError('Empty file')
  path=out/name;path.write_bytes(data);return url,{'path':path.as_posix(),'bytes':len(data)}
 except Exception as e:return url,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=dict(pool.map(fetch,urls))
Path('verification/tilda-migration-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'count':len(results),'bytes':sum(r.get('bytes',0) for r in results.values()),'largest':max(r.get('bytes',0) for r in results.values()),'errors':{u:r for u,r in results.items() if 'error'in r}}))
