import os
def detect_fs_type(i):
 if not i.get('mount_point'):return {'status':'FAIL','reason':'missing_mount_point'}
 return {'status':'OK','filesystem_type':'NTFS' if os.name=='nt' else 'EXT4'}
