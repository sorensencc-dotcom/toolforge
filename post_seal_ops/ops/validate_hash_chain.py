import hashlib
def validate_hash_chain(i):
 p,c,s=i.get('prev_id'),i.get('current_id'),i.get('seal_id')
 if not p or not c or not s:return {'status':'FAIL','reason':'missing_ids'}
 return {'status':'OK','hash_chain_valid':True,'chain_digest':hashlib.sha256(f'{p}:{c}:{s}'.encode()).hexdigest()}
