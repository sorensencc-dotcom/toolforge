import json
from pathlib import Path
from governance_runtime import ActivationController,ActorRegistry,HashChainLineage,digest
ROOT=Path(__file__).resolve().parents[1]; lineage=HashChainLineage(ROOT/'LINEAGE/CIC-Lineage-v2.4.jsonl'); gates=ROOT/'MANIFEST/gate-registry.json'; amendments=ROOT/'AMENDMENTS/amendment-registry.json'; actors=ActorRegistry(ROOT/'WRAPPERS/actor-registry.json',lineage,digest(b'bootstrap'))
refs=[f'AMD-v2.4.0-GATE-0{i}-CLOSED' for i in range(1,5)]; declaration={'declaration_id':'CIC-ACTIVATION-20260714-0001','declared_by':'ACT-20260714-0001','gate_closure_references':refs,'lineage_tail_hash':lineage.tail_hash()}
record=ActivationController(gates,amendments,lineage,actors,ROOT/'MANIFEST/runtime-status.json').activate(declaration); out={'status':'ACTIVE','runtime_activated':True,'declaration_id':declaration['declaration_id'],'activation_lineage_id':record['lineage_id'],'lineage_tail_hash':lineage.tail_hash(),'gate_closure_references':refs}; (ROOT/'confirmation/RUNTIME-ACTIVATION-CONFIRMATION.json').write_text(json.dumps(out,indent=2)+'\n'); print('RUNTIME_ACTIVATED: true\nSTATUS: ACTIVE')
