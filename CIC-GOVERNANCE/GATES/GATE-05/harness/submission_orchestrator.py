import argparse,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'WRAPPERS'))
def validate(report,actor):
 x=json.loads(report.read_text()); reg=json.loads((ROOT/'WRAPPERS/actor-registry.json').read_text()); f=[]
 if reg.get(actor,{}).get('state')!='ACTIVE': f.append('ACTOR_UNREGISTERED')
 if x.get('gate_id')!='GATE-05' or x.get('report_id')!='CIC-TEST-REPORT-GATE-05-R2': f.append('REPORT_ID_INVALID')
 if x.get('overall_result')!='PASS' or not x.get('_submission_ready'): f.append('R2_EVIDENCE_INCOMPLETE')
 if json.loads((ROOT/'MANIFEST/gate-registry.json').read_text())['gates']['GATE-05']['status']!='OPEN': f.append('GATE_NOT_OPEN')
 return x,f
def submit(report,actor):
 x,f=validate(report,actor)
 if f: raise RuntimeError(';'.join(f))
 from governance_runtime import HashChainLineage,utc_now
 lineage=HashChainLineage(ROOT/'LINEAGE/CIC-Lineage-v2.4.jsonl'); now=utc_now(); aid='AMD-v2.4.0-GATE-05-CLOSED'; ing=lineage.append('INGESTED',actor,x['report_id'],gate_id='GATE-05',report_hash=hashlib.sha256(report.read_bytes()).hexdigest()); conf=lineage.append('CONFIRMED',actor,x['report_id'],parent_lineage_id=ing['lineage_id'],amendment_id=aid); x['submitted_for_ratification']=now; report.write_text(json.dumps(x,indent=2)+'\n')
 amendment={'amendment_id':aid,'title':'GATE-05 closure - Tier 1 Ratification','status':'PROPOSED','submitted_date':now[:10],'ratified_date':None,'submitted_by':actor,'ratified_by':None,'affected_sections':['CIC-GATE-SPEC-001 section 7','MANIFEST/gate-registry.json'],'change_summary':'Propose GATE-05 closure after deterministic R2 passed 1/1.','breaking_change':False,'linked_lineage_id':conf['lineage_id'],'submission_lineage_id':ing['lineage_id'],'linked_report_id':x['report_id']}; (ROOT/'AMENDMENTS'/f'{aid}.draft.json').write_text(json.dumps(amendment,indent=2)+'\n')
 out={'status':'SUBMITTED_FOR_RATIFICATION','gate_id':'GATE-05','gate_state':'OPEN','report_id':x['report_id'],'report_result':x['overall_result'],'amendment_id':aid,'amendment_status':'PROPOSED','actor':actor,'ingested_lineage_id':ing['lineage_id'],'confirmed_lineage_id':conf['lineage_id'],'lineage_tail_hash':lineage.tail_hash(),'submitted_at':now}; (ROOT/'confirmation/GATE-05-R2-CONFIRMATION.json').write_text(json.dumps(out,indent=2)+'\n'); print(json.dumps(out)); return out
if __name__=='__main__':
 p=argparse.ArgumentParser(); p.add_argument('report',type=Path); p.add_argument('--actor',required=True); p.add_argument('--submit',action='store_true'); a=p.parse_args(); x,f=validate(a.report,a.actor); out=submit(a.report,a.actor) if a.submit else {'gate_id':'GATE-05','valid':not f,'findings':f}; print(json.dumps(out)); raise SystemExit(0 if not f else 1)
