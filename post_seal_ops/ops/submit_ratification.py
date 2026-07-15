import json,time
from pathlib import Path
def submit_ratification(i):
 s,a=i.get('seal_id'),i.get('actor_id')
 if not s or not a:return {'status':'FAIL','reason':'missing_inputs'}
 p=Path('ratification_queue.json'); q=json.loads(p.read_text()) if p.exists() else []; k=f'rat-{s}-{int(time.time())}'; q.append({'packet_id':k,'seal_id':s,'actor_id':a,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}); p.write_text(json.dumps(q,indent=2)); return {'status':'OK','ratification_packet_id':k}
