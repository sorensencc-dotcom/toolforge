import json,time
from pathlib import Path
def register_artifact(i):
 s,m=i.get('seal_id'),i.get('manifest_path')
 if not s or not m:return {'status':'FAIL','reason':'missing_inputs'}
 if not Path(m).exists():return {'status':'FAIL','reason':'manifest_not_found'}
 p=Path('registry.json'); d=json.loads(p.read_text()) if p.exists() else {}; k=f'reg-{s}-{int(time.time())}'; d[k]={'seal_id':s,'manifest_path':m,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}; p.write_text(json.dumps(d,indent=2)); return {'status':'OK','registry_id':k}
