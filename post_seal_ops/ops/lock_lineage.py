import json,time
from pathlib import Path
def lock_lineage(i):
 s=i.get('seal_id')
 if not s:return {'status':'FAIL','reason':'missing_seal_id'}
 p=Path('lineage_lock.json'); d=json.loads(p.read_text()) if p.exists() else {}; k=f'lock-{s}-{int(time.time())}'; d[s]={'lock_id':k,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}; p.write_text(json.dumps(d,indent=2)); return {'status':'OK','lineage_lock_id':k}
