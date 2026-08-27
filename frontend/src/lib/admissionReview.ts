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
  const seen = new Set();

  const pushDoc = (fieldKey, label, groupTitle, groupId, value) => {
    if (!value?.url || seen.has(fieldKey)) return;
    seen.add(fieldKey);
    docs.push({
      key: fieldKey,
      label: label || fieldKey,
      groupTitle: groupTitle || 'Documents',
      groupId: groupId || 'documents',
      ...value,
      href: resolveUploadUrl(value.url),
      image: isImageMime(value.mime),
      pdf: isPdfMime(value.mime, value.name),
    });
  };

  for (const group of form?.groups || []) {
    for (const field of group.fields || []) {
      if (field.type !== 'file') continue;
      pushDoc(field.key, field.label, group.title, group.id, answers?.[field.key]);
    }
  }

  // Include file answers even if the live/snapshot form no longer lists the field.
  if (answers && typeof answers === 'object') {
    for (const [key, value] of Object.entries(answers)) {
      if (!value || typeof value !== 'object' || !value.url) continue;
      pushDoc(key, key.replace(/_/g, ' '), 'Documents', 'documents', value);
    }
  }

  return docs;
}

export function countDocuments(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  return Object.values(answers).filter((v) => v && typeof v === 'object' && v.url).length;
}

export function isEmptyAnswer(field, answers) {
  const value = answers?.[field?.key];
  if (value == null || value === '') return true;
  if (field?.type === 'file') return !(value && value.url);
  return false;
}

export function sectionProgress(group, answers) {
  const fields = group?.fields || [];
  const required = fields.filter((f) => f.required);
  const requiredDone = required.filter((f) => !isEmptyAnswer(f, answers)).length;
  const filled = fields.filter((f) => !isEmptyAnswer(f, answers)).length;
  return {
    total: fields.length,
    filled,
    required: required.length,
    requiredDone,
    complete: required.length ? requiredDone === required.length : filled === fields.length,
    pct: fields.length ? Math.round((filled / fields.length) * 100) : 0,
  };
}

export function applicationProgress(form, answers) {
  const groups = form?.groups || [];
  const stats = groups.map((g) => sectionProgress(g, answers));
  const requiredTotal = stats.reduce((n, s) => n + s.required, 0);
  const requiredDone = stats.reduce((n, s) => n + s.requiredDone, 0);
  const pct = requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0;
  return { groups: stats, requiredTotal, requiredDone, pct };
}

export { formatFileSize, resolveUploadUrl };
