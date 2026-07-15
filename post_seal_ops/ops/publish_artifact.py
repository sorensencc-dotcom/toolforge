from pathlib import Path
def publish_artifact(i):
 s,a=i.get('seal_id'),i.get('artifact_path')
 if not s or not a:return {'status':'FAIL','reason':'missing_inputs'}
 p=Path(a)
 if not p.exists():return {'status':'FAIL','reason':'artifact_not_found'}
 d=Path('sealed_store'); d.mkdir(exist_ok=True); out=d/f'{s}.bin'; out.write_bytes(p.read_bytes()); return {'status':'OK','store_ref':str(out)}
