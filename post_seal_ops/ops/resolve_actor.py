import json
from pathlib import Path
def resolve_actor(i):
 a=i.get('actor_placeholder')
 if not a:return {'status':'FAIL','reason':'missing_actor_placeholder'}
 p=Path('actor_map.json'); d=json.loads(p.read_text()) if p.exists() else {}; d.setdefault(a,f'actor-{a}'); p.write_text(json.dumps(d,indent=2)); return {'status':'OK','actor_id':d[a]}
