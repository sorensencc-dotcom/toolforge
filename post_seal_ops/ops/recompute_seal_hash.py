import hashlib
def recompute_seal_hash(i):
 b=i.get('artifact_bytes')
 if b is None:return {'status':'FAIL','reason':'missing_artifact_bytes'}
 return {'status':'OK','seal_hash':hashlib.sha256(b).hexdigest()}
