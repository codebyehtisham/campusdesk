import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';
import { formatFileSize, isImageMime, isPdfMime, resolveUploadUrl } from '../lib/uploads';

const statusClass = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-cardinal-pale text-cardinal',
  submitted: 'bg-amber-100 text-amber-900',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-crimson-pale text-crimson-dark',
};

const statusLabel = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const SECTIONS = [
  {
    key: 'pending',
    label: 'Pending review',
    description: 'Submitted applications waiting for an officer decision.',
    match: (status) => status === 'submitted',
  },
  {
    key: 'draft',
    label: 'In progress',
    description: 'Students still filling the form.',
    match: (status) => ['not_started', 'in_progress'].includes(status),
  },
  {
    key: 'accepted',
    label: 'Accepted',
    description: 'Accepted students are added to the student roster for LMS and attendance enrollment.',
    match: (status) => status === 'accepted',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    description: 'Rejected applications. Officers can accept them later if circumstances change.',
    match: (status) => status === 'rejected',
  },
];

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function collectDocuments(form, answers) {
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
        ...value,
        href: resolveUploadUrl(value.url),
      });
    }
  }
  return docs;
}

function FileIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 4h6l4 4v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentCard({ doc }) {
  const image = isImageMime(doc.mime);
  const pdf = isPdfMime(doc.mime, doc.name);

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-border bg-white shadow-sm">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-bg/80">
        {image ? (
          <img
            src={doc.href}
            alt={doc.name || doc.label}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        ) : pdf ? (
          <div className="flex flex-col items-center gap-2 text-cardinal">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cardinal-pale">
              <FileIcon className="h-7 w-7" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide">PDF</span>
          </div>
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cardinal-pale text-cardinal">
            <FileIcon className="h-7 w-7" />
          </span>
        )}
      </div>
      <div className="space-y-2 border-t border-border p-4">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {doc.groupTitle}
          </p>
          <p className="m-0 mt-1 text-sm font-bold text-ink">{doc.label}</p>
          <p className="m-0 mt-0.5 truncate text-xs text-text-muted">{doc.name || 'Uploaded file'}</p>
          {doc.size ? <p className="m-0 mt-1 text-xs text-text-muted">{formatFileSize(doc.size)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={doc.href}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary flex-1 py-2 text-xs sm:flex-none"
          >
            Open
          </a>
          <a href={doc.href} download={doc.name || doc.label} className="btn btn-outline-light py-2 text-xs">
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

function AnswerValue({ field, value }) {
  if (value == null || value === '') {
    return <span className="text-text-muted">Not provided</span>;
  }

  if (field?.type === 'file' && typeof value === 'object' && value.url) {
    const href = resolveUploadUrl(value.url);
    const image = isImageMime(value.mime);
    const pdf = isPdfMime(value.mime, value.name);

    return (
      <div className="space-y-3">
        {image ? (
          <a href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border">
            <img src={href} alt={value.name || field.label} className="max-h-48 w-full object-contain bg-bg/60" />
          </a>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{value.name || 'Uploaded file'}</span>
          {value.size ? <span className="text-xs text-text-muted">{formatFileSize(value.size)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={href} target="_blank" rel="noreferrer" className="btn btn-primary py-2 text-xs">
            {pdf ? 'Open PDF' : image ? 'Open full size' : 'Open file'}
          </a>
          <a href={href} download={value.name || field.label} className="btn btn-outline-light py-2 text-xs">
            Download
          </a>
        </div>
      </div>
    );
  }

  if (field?.type === 'textarea') {
    return <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-ink">{String(value)}</p>;
  }

  return <span className="text-sm font-medium text-ink">{String(value)}</span>;
}

function ApplicationReviewPanel({ detail, loading, canDecide, saving, onClose, onDecide }) {
  const documents = useMemo(
    () => collectDocuments(detail?.form, detail?.answers),
    [detail?.form, detail?.answers]
  );

  const groups = detail?.form?.groups || [];
  const student = detail?.student;

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close review panel"
        className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-review-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border bg-bg shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <header className="shrink-0 border-b border-border bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cardinal-pale text-sm font-bold text-cardinal">
                {initials(student?.name)}
              </span>
              <div className="min-w-0">
                <span className={`tag ${statusClass[detail?.status] || 'tag-allied'}`}>
                  {statusLabel[detail?.status] || detail?.status}
                </span>
                <h2 id="application-review-title" className="mt-2 mb-1 truncate text-xl font-bold text-ink">
                  {student?.name || 'Applicant'}
                </h2>
                <p className="m-0 truncate text-sm text-text-muted">{student?.email}</p>
                {detail?.submittedAt ? (
                  <p className="m-0 mt-1 text-xs text-text-muted">
                    Submitted {new Date(detail.submittedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </div>
            <button type="button" className="btn btn-outline-light shrink-0 py-2 text-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <div className="glass rounded-[1.5rem] p-10 text-center text-text-muted">Loading application…</div>
          ) : !detail ? (
            <div className="glass rounded-[1.5rem] p-10 text-center text-text-muted">Could not load this application.</div>
          ) : (
            <div className="space-y-6">
              <section className="glass glow-border rounded-[1.5rem] p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="eyebrow">Documents</span>
                    <h3 className="mt-1 mb-0">Uploaded files</h3>
                    <p className="m-0 mt-1 text-sm text-text-muted">
                      {documents.length
                        ? `${documents.length} file${documents.length === 1 ? '' : 's'} attached to this application.`
                        : 'No documents uploaded yet.'}
                    </p>
                  </div>
                </div>
                {documents.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {documents.map((doc) => (
                      <DocumentCard key={doc.key} doc={doc} />
                    ))}
                  </div>
                ) : (
                  <p className="m-0 rounded-2xl bg-bg/80 px-4 py-6 text-center text-sm text-text-muted">
                    The student has not uploaded any document fields yet.
                  </p>
                )}
              </section>

              {groups.map((group) => (
                <section key={group.id} className="glass rounded-[1.5rem] p-5 sm:p-6">
                  <div className="mb-4">
                    <span className="eyebrow">Section</span>
                    <h3 className="mt-1 mb-0">{group.title}</h3>
                    {group.description ? (
                      <p className="m-0 mt-1 text-sm text-text-muted">{group.description}</p>
                    ) : null}
                  </div>
                  <dl className="grid gap-3">
                    {(group.fields || []).map((field) => (
                      <div
                        key={field.key}
                        className={`rounded-2xl border px-4 py-3 ${
                          field.type === 'file' ? 'border-cardinal/20 bg-cardinal-pale/20' : 'border-border/70 bg-white/70'
                        }`}
                      >
                        <dt className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                          {field.required ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-crimson" aria-hidden="true" />
                          ) : null}
                          {field.label}
                          {field.type === 'file' ? (
                            <span className="rounded-full bg-cardinal-pale px-2 py-0.5 text-[0.6rem] normal-case text-cardinal">
                              Document
                            </span>
                          ) : null}
                        </dt>
                        <dd className="m-0 mt-2">
                          <AnswerValue field={field} value={detail?.answers?.[field.key]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              {!groups.length ? (
                <p className="m-0 text-sm text-text-muted">No form schema attached to this application.</p>
              ) : null}

              {detail.reviewer ? (
                <p className="m-0 text-sm text-text-muted">
                  Reviewed by {detail.reviewer.name || detail.reviewer.email}
                  {detail.reviewedAt ? ` · ${new Date(detail.reviewedAt).toLocaleString()}` : ''}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {canDecide && detail && ['submitted', 'accepted', 'rejected'].includes(detail.status) ? (
          <footer className="shrink-0 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-navy flex-1 py-2.5 text-sm sm:flex-none"
                disabled={saving}
                onClick={() => onDecide(detail.id, 'accepted')}
              >
                {detail.status === 'accepted' ? 'Keep accepted' : 'Accept applicant'}
              </button>
              <button
                type="button"
                className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson disabled:opacity-50 sm:flex-none"
                disabled={saving}
                onClick={() => onDecide(detail.id, 'rejected')}
              >
                {detail.status === 'rejected' ? 'Keep rejected' : 'Reject'}
              </button>
            </div>
          </footer>
        ) : null}
      </motion.aside>
    </>
  );
}

export default function AdmissionsBoard({ authScope, role }) {
  const [rows, setRows] = useState([]);
  const [section, setSection] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const canDecide = canDecideAdmissions(role);

  const load = async () => {
    try {
      const res = await api.get('/applications', { authScope });
      setRows(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load student records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeSection = SECTIONS.find((item) => item.key === section) || SECTIONS[0];
  const filteredRows = useMemo(
    () => rows.filter((row) => activeSection.match(row.status)),
    [rows, activeSection]
  );

  const counts = useMemo(
    () =>
      SECTIONS.reduce((acc, item) => {
        acc[item.key] = rows.filter((row) => item.match(row.status)).length;
        return acc;
      }, {}),
    [rows]
  );

  const openReview = async (id) => {
    setReviewId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/applications/${id}`, { authScope });
      setDetail(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load application detail.');
      setReviewId('');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReview = () => {
    setReviewId('');
    setDetail(null);
  };

  const decide = async (id, decision) => {
    setSavingId(id);
    try {
      const res = await api.patch(`/applications/${id}/decision`, { decision }, { authScope });
      setRows((list) => list.map((row) => (row.id === id ? res.data : row)));
      setNotice(
        decision === 'accepted'
          ? 'Applicant accepted and added to the student roster for classes / attendance.'
          : 'Applicant marked rejected.'
      );
      setError('');
      if (detail?.id === id) setDetail((d) => ({ ...d, ...res.data }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that decision.');
    } finally {
      setSavingId('');
    }
  };

  const docCount = (row) => {
    const answers = row.answers || {};
    return Object.values(answers).filter((v) => v && typeof v === 'object' && v.url).length;
  };

  return (
    <div>
      {!canDecide && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-semibold text-cardinal">
          {role === 'admin'
            ? 'Organisation admins can open or close admissions, build the portal, and view records. Only admissions officers can accept or reject.'
            : 'Your role is view only. You can read student records but cannot accept or reject.'}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              section === item.key ? 'bg-cardinal text-white shadow-sm' : 'border border-border bg-white text-ink hover:bg-bg'
            }`}
          >
            {item.label} ({counts[item.key] || 0})
          </button>
        ))}
      </div>

      <p className="mb-5 text-sm text-text-muted">{activeSection.description}</p>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading student records…</div>
      ) : filteredRows.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No {activeSection.label.toLowerCase()} applications</h3>
          <p className="m-0 text-text-muted">Switch tabs to see other groups.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredRows.map((row) => {
            const files = docCount(row);
            return (
              <article
                key={row.id}
                className="glass flex flex-col gap-4 rounded-[1.4rem] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cardinal-pale text-xs font-bold text-cardinal">
                    {initials(row.student?.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 truncate text-base font-bold text-ink">{row.student?.name || 'Applicant'}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${statusClass[row.status] || 'tag-allied'}`}>
                        {statusLabel[row.status] || row.status}
                      </span>
                      {files > 0 ? (
                        <span className="rounded-full bg-bg px-2.5 py-0.5 text-[0.65rem] font-bold text-text-muted">
                          {files} doc{files === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                    <p className="m-0 truncate text-sm text-text-muted">{row.student?.email}</p>
                    {row.submittedAt ? (
                      <p className="m-0 mt-0.5 text-xs text-text-muted">
                        Submitted {new Date(row.submittedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary py-2.5 text-sm"
                    onClick={() => openReview(row.id)}
                  >
                    Review application
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {reviewId ? (
          <ApplicationReviewPanel
            detail={detail}
            loading={detailLoading}
            canDecide={canDecide}
            saving={savingId === reviewId}
            onClose={closeReview}
            onDecide={decide}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
