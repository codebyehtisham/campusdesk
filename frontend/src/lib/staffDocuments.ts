import api from '../api/client';

const cache = new Map<string, string>();

function cacheKey(applicationId: string, fieldKey: string, authScope: 'admin' | 'staff') {
  return `${authScope}:${applicationId}:${fieldKey}`;
}

export async function staffDocumentBlobUrl(
  applicationId: string,
  fieldKey: string,
  authScope: 'admin' | 'staff'
) {
  const key = cacheKey(applicationId, fieldKey, authScope);
  const hit = cache.get(key);
  if (hit) return hit;

  const res = await api.get(`/applications/${applicationId}/files/${fieldKey}`, {
    authScope,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  cache.set(key, url);
  return url;
}

export function revokeStaffDocumentUrls(applicationId?: string) {
  for (const [key, url] of cache) {
    if (!applicationId || key.includes(`:${applicationId}:`)) {
      URL.revokeObjectURL(url);
      cache.delete(key);
    }
  }
}

export function clearStaffDocumentCache(applicationId: string, fieldKey: string, authScope: 'admin' | 'staff') {
  const key = cacheKey(applicationId, fieldKey, authScope);
  const hit = cache.get(key);
  if (hit) {
    URL.revokeObjectURL(hit);
    cache.delete(key);
  }
}
