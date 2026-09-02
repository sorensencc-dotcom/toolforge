import hashlib,json
from pathlib import Path
from governance_runtime import HashChainLineage
ROOT=Path(__file__).resolve().parents[1]; c=json.loads((ROOT/'confirmation/RUNTIME-ACTIVATION-CONFIRMATION.json').read_text()); g=json.loads((ROOT/'MANIFEST/gate-registry.json').read_text()); a=json.loads((ROOT/'AMENDMENTS/amendment-registry.json').read_text()); l=HashChainLineage(ROOT/'LINEAGE/CIC-Lineage-v2.4.jsonl')
if not c.get('runtime_activated') or c.get('status')!='ACTIVE': raise RuntimeError('RUNTIME_NOT_ACTIVE')
if any(x.get('status')!='CLOSED' for x in g['gates'].values()): raise RuntimeError('GATES_NOT_CLOSED')
if any(x.get('status')!='RATIFIED' for x in a['amendments']): raise RuntimeError('AMENDMENTS_NOT_RATIFIED')
if l.tail_hash()!=c['lineage_tail_hash']: raise RuntimeError('LINEAGE_TAIL_MISMATCH')
g['runtime_active']=True; g['status']='STABLE / SEALED'; (ROOT/'MANIFEST/gate-registry.json').write_text(json.dumps(g,indent=2)+'\n')
out={'status':'STABLE / SEALED','commit':'SUCCESS','runtime_active':True,'gate_states':{k:v['status'] for k,v in g['gates'].items()},'amendment_statuses':{x['amendment_id']:x['status'] for x in a['amendments']},'activation_lineage_id':c['activation_lineage_id'],'lineage_tail_hash':l.tail_hash(),'manifest_sha256':hashlib.sha256((ROOT/'MANIFEST/gate-registry.json').read_bytes()).hexdigest(),'amendment_registry_sha256':hashlib.sha256((ROOT/'AMENDMENTS/amendment-registry.json').read_bytes()).hexdigest(),'lineage_sha256':hashlib.sha256((ROOT/'LINEAGE/CIC-Lineage-v2.4.jsonl').read_bytes()).hexdigest()}; (ROOT/'confirmation/COMMIT-CONFIRMATION.json').write_text(json.dumps(out,indent=2)+'\n'); print('COMMIT: SUCCESS\nSTATUS: STABLE / SEALED')
