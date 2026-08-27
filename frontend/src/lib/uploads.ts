/** Turn stored /uploads/... paths into a browser-openable URL (dev API host vs same-origin prod). */
export function resolveUploadUrl(url: string | undefined | null) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;

  const uploadsMatch = String(url).match(/\/uploads\/(.+)$/i);
  if (uploadsMatch && typeof window !== 'undefined') {
    const path = `/uploads/${uploadsMatch[1]}`;
    return `${window.location.origin}${path}`;
  }

  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;

  const apiBase =
    import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5050/api' : '/api');
  const origin = apiBase.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${path}`;
}

export function formatFileSize(bytes: number | undefined) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string | undefined) {
  return Boolean(mime?.startsWith('image/'));
}

export function isPdfMime(mime: string | undefined, name?: string) {
  if (mime === 'application/pdf') return true;
  return Boolean(name?.toLowerCase().endsWith('.pdf'));
}
