from pathlib import Path
def validate_wrapper_logs(i):
 p=i.get('log_path')
 if not p:return {'status':'FAIL','reason':'missing_log_path'}
 p=Path(p)
 if not p.exists():return {'status':'FAIL','reason':'log_not_found'}
 v='GOV_WRAPPER_OK' in p.read_text(encoding='utf-8',errors='ignore');return {'status':'OK' if v else 'FAIL','log_valid':v}
