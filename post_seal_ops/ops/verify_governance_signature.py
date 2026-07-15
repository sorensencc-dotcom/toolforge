def verify_governance_signature(i):
 h,p=i.get('seal_hash'),i.get('gov_sig_profile')
 if not h or not p:return {'status':'FAIL','reason':'missing_inputs'}
 x=p.get('prefix')
 if not x:return {'status':'FAIL','reason':'missing_prefix'}
 v=h.startswith(x);return {'status':'OK' if v else 'FAIL','signature_valid':v}
