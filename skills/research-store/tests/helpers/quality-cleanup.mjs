import assert from 'node:assert/strict';

export async function cleanupQualityPublications(service, paths, ids) {
  const check = result => {
    if (result.error) throw new Error('Quality publication cleanup failed (details suppressed)');
    return result.data;
  };
  // Discover again by run-owned paths even when the earlier publication lookup failed.
  const documents = check(await service.from('documents').select('id').in('git_path', paths));
  for (const document of documents) if (!ids.includes(document.id)) ids.push(document.id);
  check(await service.from('documents').delete().in('git_path', paths));
  assert.equal(check(await service.from('documents').select('id').in('git_path', paths)).length, 0);
  if (ids.length) assert.equal(check(await service.from('research_items').select('id').in('document_id', ids)).length, 0);
}
