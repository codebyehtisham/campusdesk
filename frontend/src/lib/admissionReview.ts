import { formatFileSize, isImageMime, isPdfMime, resolveUploadUrl } from './uploads';

export const statusClass = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-cardinal-pale text-cardinal',
  submitted: 'bg-amber-100 text-amber-900',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-crimson-pale text-crimson-dark',
};

export const statusLabel = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function collectDocuments(form, answers) {
  const docs = [];
  for (const group of form?.groups || []) {
    for (const field of group.fields || []) {
      if (field.type !== 'file') continue;
      const value = answers?.[field.key];
      if (!value?.url) continue;
      docs.push({
        key: field.key,
        label: field.label,
        groupTitle: group.title,
        groupId: group.id,
        ...value,
        href: resolveUploadUrl(value.url),
        image: isImageMime(value.mime),
        pdf: isPdfMime(value.mime, value.name),
      });
    }
  }
  return docs;
}

export function countDocuments(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  return Object.values(answers).filter((v) => v && typeof v === 'object' && v.url).length;
}

export { formatFileSize, resolveUploadUrl };
