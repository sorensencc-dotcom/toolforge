from pathlib import Path
def verify_immutable_storage(i):
 x=i.get('artifact_path')
 if not x:return {'status':'FAIL','reason':'missing_artifact_path'}
 p=Path(x)
 if not p.exists():return {'status':'FAIL','reason':'artifact_not_found'}
 v=(p.stat().st_mode&0o222)==0;return {'status':'OK' if v else 'FAIL','storage_verified':v}
