"""Fail-closed Gate-03 ratification runner."""
from __future__ import annotations
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
import sys; sys.path.insert(0,str(ROOT/'WRAPPERS'))
from governance_runtime import HashChainLineage,utc_now
AID='AMD-v2.4.0-GATE-03-CLOSED'; GATE='GATE-03'; REPORT='CIC-TEST-REPORT-GATE-03-R2'; ACTOR='ACT-20260714-0001'
def run():
 c=json.loads((ROOT/'confirmation/GATE-03-R2-CONFIRMATION.json').read_text()); a=json.loads((ROOT/f'AMENDMENTS/{AID}.draft.json').read_text()); g=json.loads((ROOT/'MANIFEST/gate-registry.json').read_text()); reg=json.loads((ROOT/'AMENDMENTS/amendment-registry.json').read_text())
 if c.get('status')!='SUBMITTED_FOR_RATIFICATION' or c.get('report_result')!='PASS' or a.get('status')!='PROPOSED' or g['gates'][GATE].get('status')!='OPEN': raise RuntimeError('RATIFICATION_PRECONDITION_FAILED')
 lineage=HashChainLineage(ROOT/'LINEAGE/CIC-Lineage-v2.4.jsonl'); now=utc_now(); closure=lineage.append('CLOSED',ACTOR,REPORT,parent_submission_lineage_id=c['confirmed_lineage_id'],amendment_id=AID,gate_id=GATE)
 a.update(status='RATIFIED',ratified_date=now[:10],ratified_by='Tier 1 (Chris)',linked_lineage_id=closure['lineage_id'],decision_note='Tier 1 ratified Gate-03 closure on 2026-07-14.')
 (ROOT/f'AMENDMENTS/{AID}.json').write_text(json.dumps(a,indent=2)+'\n'); g['gates'][GATE].update(status='CLOSED',closure_amendment=AID,closure_lineage_id=closure['lineage_id']); (ROOT/'MANIFEST/gate-registry.json').write_text(json.dumps(g,indent=2)+'\n')
 for row in reg['amendments']:
  if row.get('amendment_id')==AID: row.update(status='RATIFIED',ratified_date=now[:10],ratified_by='Tier 1 (Chris)',linked_lineage_id=closure['lineage_id'],artifact_path=f'AMENDMENTS/{AID}.json')
 (ROOT/'AMENDMENTS/amendment-registry.json').write_text(json.dumps(reg,indent=2)+'\n')
 out={'confirmation_id':'CIC-GOV-GATE-03-RATIFICATION-20260714-0001','status':'RATIFIED_AND_CLOSED','mode':'GOVERNANCE_RATIFY','ratified_at':now,'gate_id':GATE,'amendment':{'amendment_id':AID,'status':'RATIFIED','ratified_by':'Tier 1 (Chris)','report_id':REPORT},'closure':{'from':'OPEN','to':'CLOSED','closure_lineage_id':closure['lineage_id'],'parent_submission_lineage_id':c['confirmed_lineage_id'],'lineage_record_hash':closure['record_hash'],'lineage_tail_hash':lineage.tail_hash()},'governance_effects':{'gate_closed':True,'amendment_ratified':True,'runtime_activated':False,'gate_05_closed':False}}
 (ROOT/'confirmation/GATE-03-RATIFICATION-CONFIRMATION.json').write_text(json.dumps(out,indent=2)+'\n'); print('STATUS: RATIFIED_AND_CLOSED\nGATE-03: CLOSED\nAMENDMENT: AMD-v2.4.0-GATE-03-CLOSED — RATIFIED'); return out
if __name__=='__main__': run()
