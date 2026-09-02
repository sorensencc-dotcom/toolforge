from pathlib import Path
def semantic_diff(i):
 a,b=i.get('baseline_ref'),i.get('sealed_ref')
 if not a or not b:return {'status':'FAIL','reason':'missing_inputs'}
 a,b=Path(a),Path(b)
 if not a.exists() or not b.exists():return {'status':'FAIL','reason':'files_missing'}
 x,y=a.read_text().splitlines(),b.read_text().splitlines(); r=[{'line':n,'baseline':x[n] if n<len(x) else '','sealed':y[n] if n<len(y) else ''} for n in range(max(len(x),len(y))) if (x[n] if n<len(x) else '')!=(y[n] if n<len(y) else '')]; return {'status':'OK','semantic_diff_report':r}
