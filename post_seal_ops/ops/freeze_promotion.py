import json,time
from pathlib import Path
def freeze_promotion(i):
 s=i.get('seal_id')
 if not s:return {'status':'FAIL','reason':'missing_seal_id'}
 p=Path('promotion_freeze.json'); d=json.loads(p.read_text()) if p.exists() else {}; d[s]={'state':'FROZEN','timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}; p.write_text(json.dumps(d,indent=2)); return {'status':'OK','promotion_state':'FROZEN'}
