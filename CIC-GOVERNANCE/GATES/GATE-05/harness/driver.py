"""Deterministic Gate-05 activation-validator R2 driver."""
import argparse,json,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; sys.path.insert(0,str(ROOT/'WRAPPERS'))
import governance_runtime as rt
def run(out):
 with tempfile.TemporaryDirectory(dir=ROOT/'tests') as td:
  w=Path(td); gates=w/'gates.json'; gates.write_text(json.dumps({'gates':{f'GATE-0{i}':{'status':'OPEN'} for i in range(1,6)}})); amendments=w/'a.json'; amendments.write_text('{"amendments":[]}'); lineage=rt.HashChainLineage(w/'lineage.jsonl'); actors=rt.ActorRegistry(w/'actors.json',lineage,rt.digest(b'boot')); c=rt.ActivationController(gates,amendments,lineage,actors,w/'status.json');
  try: c.activate({}); result={'test_id':'TC-05-001','outcome':'FAIL','details':{'unexpected':'activation accepted'}}
  except rt.GateError as e: result={'test_id':'TC-05-001','outcome':'PASS' if e.code=='GATES_OPEN' and not (w/'status.json').exists() else 'FAIL','details':{'error_code':e.code,'status_written':(w/'status.json').exists()}}
 r={'driver_version':'1.0.0-candidate.1','gate_id':'GATE-05','executed_at':rt.utc_now(),'cases':[result],'total':1,'passed':int(result['outcome']=='PASS'),'failed':int(result['outcome']=='FAIL'),'overall_result':'PASS' if result['outcome']=='PASS' else 'FAIL'}; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(r,indent=2)+'\n'); print(json.dumps({'gate_id':'GATE-05','result':r['overall_result'],'passed':r['passed'],'failed':r['failed']})); return r
if __name__=='__main__':
 p=argparse.ArgumentParser(); p.add_argument('--output',type=Path,required=True); a=p.parse_args(); raise SystemExit(0 if run(a.output)['overall_result']=='PASS' else 1)
