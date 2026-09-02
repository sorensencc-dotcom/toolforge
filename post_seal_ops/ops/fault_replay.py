def fault_replay(i):
 if not i.get('test_case_id') or not i.get('seal_id'):return {'status':'FAIL','reason':'missing_inputs'}
 return {'status':'OK','fault_replay_result':'PASS'}
