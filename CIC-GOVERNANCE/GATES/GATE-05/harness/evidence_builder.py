"""Build Gate-05 R2 report."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def build(src,actor,out):
 d=json.loads(src.read_text()); reg=json.loads((ROOT/'WRAPPERS/actor-registry.json').read_text()); p=d['passed']; report={'report_id':'CIC-TEST-REPORT-GATE-05-R2','gate_id':'GATE-05','gate_name':'Tier 1 Ratification','spec_version':'2.4.0','executed_by':actor,'actor_registry_state':reg.get(actor,{}).get('state','UNREGISTERED'),'execution_timestamp':d['executed_at'],'test_cases':d['cases'],'additional_test_cases':[],'total_cases':1,'passed':p,'failed':d['failed'],'skipped':0,'overall_result':d['overall_result'],'submitted_for_ratification':None,'_amendment_target':'AMD-v2.4.0-GATE-05-CLOSED','_submission_ready':bool(p==1 and reg.get(actor,{}).get('state')=='ACTIVE')}; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps({'report_id':report['report_id'],'result':report['overall_result'],'submission_ready':report['_submission_ready']})); return report
if __name__=='__main__':
 p=argparse.ArgumentParser(); p.add_argument('--driver-result',type=Path,required=True); p.add_argument('--actor',required=True); p.add_argument('--output',type=Path,required=True); a=p.parse_args(); raise SystemExit(0 if build(a.driver_result,a.actor,a.output)['_submission_ready'] else 1)
