import hashlib
from pathlib import Path
def compute_drift(i):
 s,b,z=i.get('seal_id'),i.get('baseline_ref'),i.get('sealed_ref'); c=i.get('ceiling',.03)
 if not s or not b:return {'status':'FAIL','reason':'missing_inputs'}
 p=Path(b)
 if not p.exists():return {'status':'FAIL','reason':'baseline_not_found'}
 a=hashlib.sha256(p.read_bytes()).hexdigest(); q=Path(z) if z else None; other=hashlib.sha256(q.read_bytes()).hexdigest() if q and q.exists() else hashlib.sha256(s.encode()).hexdigest(); d=sum(x!=y for x,y in zip(a,other))/len(a); return {'status':'OK' if d<=c else 'FAIL','drift_score':d,'ceiling':c}
