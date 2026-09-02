"""Deterministic Gate-03 R2 driver for persistent actor registry."""
from __future__ import annotations
import argparse, json, os, sys, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'WRAPPERS'))
from governance_runtime import ActorRegistry, GateError, HashChainLineage, digest, utc_now

def case(test_id, fn):
    t=time.monotonic()
    try: d=fn(); ok=bool(d.pop('passed')); err=None
    except Exception as e: d={}; ok=False; err={'type':type(e).__name__,'message':str(e)}
    return {'test_id':test_id,'outcome':'PASS' if ok else 'FAIL','execution_time_ms':round((time.monotonic()-t)*1000,3),'failure':err,'details':d}

def run(output:Path):
    with tempfile.TemporaryDirectory(prefix='gate03-r2-',dir=ROOT/'tests') as td:
        w=Path(td); rows=[]
        def mk(): return ActorRegistry(w/'actors.json',HashChainLineage(w/'lineage.jsonl'),digest(b'old'))
        def c1():
            r=mk(); r.register('ACT-20260714-0001','Human','HUMAN','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0001','ACTIVE','BOOTSTRAP',bootstrap='old'); r=ActorRegistry(w/'actors.json',HashChainLineage(w/'lineage.jsonl'),digest(b'old')); return {'passed':r.get('ACT-20260714-0001')['state']=='ACTIVE'}
        def c2():
            r=mk(); r.register('ACT-20260714-0002','x','HUMAN','BOOTSTRAP',bootstrap='old')
            try: r.transition('ACT-20260714-0002','RETIRED','BOOTSTRAP',bootstrap='old'); return {'passed':False}
            except GateError as e: return {'passed':e.code=='ACTOR_TRANSITION_INVALID'}
        def c3():
            r=mk(); r.register('ACT-20260714-0003','x','HUMAN','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0003','ACTIVE','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0003','SUSPENDED','BOOTSTRAP',bootstrap='old'); return {'passed':not r.is_active('ACT-20260714-0003')}
        def c4():
            r=mk(); before=r.lineage.tail_hash(); r.register('ACT-20260714-0004','x','HUMAN','BOOTSTRAP',bootstrap='old'); records=r.lineage.records(); after=r.lineage.tail_hash(); row=records[-1]; return {'passed':after!=before and row['action']=='MUTATED' and row['details']['details_type']=='ACTOR_REGISTERED' and row['record_hash']==after,'records':len(records),'tail_before':before,'tail_after':after}
        def c5():
            try: mk().register('bad','x','HUMAN','BOOTSTRAP',bootstrap='old'); return {'passed':False}
            except GateError as e: return {'passed':e.code=='ACTOR_INVALID'}
        def c6():
            target=w/'actors.json'; rows={f'ACT-20260714-{i:04d}':{'actor_id':f'ACT-20260714-{i:04d}','display_name':'x','actor_type':'HUMAN','state':'PENDING','registered_by':'BOOTSTRAP'} for i in range(10,1010)}; payload=(json.dumps(rows,sort_keys=True,separators=(',',':'))+'\n').encode(); temp=target.with_suffix('.json.tmp'); t=time.monotonic();
            with temp.open('wb') as h: h.write(payload); h.flush(); os.fsync(h.fileno())
            os.replace(temp,target); elapsed=(time.monotonic()-t)*1000; loaded=json.loads(target.read_text()); return {'passed':len(loaded)==1000 and elapsed<5000,'actors':len(loaded),'elapsed_ms':round(elapsed,3)}
        def c7():
            r=mk(); r.register('ACT-20260714-0007','x','HUMAN','BOOTSTRAP',bootstrap='old'); return {'passed':all('credential' not in x and 'secret' not in x for x in r.export())}
        def c8():
            r=mk(); r.rotate_bootstrap('old','new')
            try: r.register('ACT-20260714-0008','x','HUMAN','BOOTSTRAP',bootstrap='old'); return {'passed':False}
            except GateError as e: return {'passed':e.code=='ACTOR_UNREGISTERED'}
        def c9():
            r=mk(); r.register('ACT-20260714-0009','x','HUMAN','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0009','ACTIVE','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0009','SUSPENDED','BOOTSTRAP',bootstrap='old'); r.transition('ACT-20260714-0009','RETIRED','BOOTSTRAP',bootstrap='old')
            try: r.transition('ACT-20260714-0009','ACTIVE','BOOTSTRAP',bootstrap='old'); return {'passed':False}
            except GateError as e: return {'passed':e.code=='ACTOR_TRANSITION_INVALID'}
        for i,fn in enumerate((c1,c2,c3,c4,c5,c6,c7,c8,c9),1): rows.append(case(f'TC-03-{i:03d}',fn))
    result={'driver_version':'1.0.0-candidate.1','gate_id':'GATE-03','executed_at':utc_now(),'cases':rows,'total':9,'passed':sum(x['outcome']=='PASS' for x in rows),'failed':sum(x['outcome']=='FAIL' for x in rows),'overall_result':'PASS' if all(x['outcome']=='PASS' for x in rows) else 'FAIL'}
    output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8'); return result
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--output',type=Path,required=True); a=p.parse_args(); r=run(a.output); print(json.dumps({'gate_id':'GATE-03','result':r['overall_result'],'passed':r['passed'],'failed':r['failed']})); raise SystemExit(0 if r['overall_result']=='PASS' else 1)
