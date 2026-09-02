import json
from pathlib import Path
def validate_treatment_graph(i):
 r=i.get('treatment_graph_ref')
 if not r:return {'status':'FAIL','reason':'missing_graph_ref'}
 p=Path(r)
 if not p.exists():return {'status':'FAIL','reason':'graph_not_found'}
 try:g=json.loads(p.read_text())
 except Exception:return {'status':'FAIL','reason':'invalid_json'}
 v='nodes' in g and 'edges' in g;return {'status':'OK' if v else 'FAIL','treatment_graph_valid':v}
