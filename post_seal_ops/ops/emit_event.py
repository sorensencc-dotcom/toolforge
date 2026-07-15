import json,time
from pathlib import Path
def emit_event(i):
 t,s=i.get('type'),i.get('seal_id')
 if not t or not s:return {'status':'FAIL','reason':'missing_event_fields'}
 e={'event_type':t,'seal_id':s,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}; p=Path('event_log.json'); a=json.loads(p.read_text()) if p.exists() else []; a.append(e); p.write_text(json.dumps(a,indent=2)); return {'status':'OK','event_emitted':True,'event':e}
