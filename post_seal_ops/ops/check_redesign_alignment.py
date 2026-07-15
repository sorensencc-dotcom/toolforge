import json
from pathlib import Path
def check_redesign_alignment(i):
 r=i.get('redesign_signal_ref')
 if not r:return {'status':'FAIL','reason':'missing_signal_ref'}
 p=Path(r)
 if not p.exists():return {'status':'FAIL','reason':'signal_not_found'}
 try:v=json.loads(p.read_text()).get('alignment') is True
 except Exception:return {'status':'FAIL','reason':'invalid_json'}
 return {'status':'OK' if v else 'FAIL','alignment_valid':v}
