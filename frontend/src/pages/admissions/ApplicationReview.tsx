import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ADMIN_BASE, FACULTY_BASE } from '../../admin/paths';
import { getAdmin } from '../../auth/adminSession';
import { getStaff } from '../../auth/staffSession';
import api from '../../api/client';
import { canDecideAdmissions } from '../../data/roles';
import {
  applicationProgress,
  collectDocuments,
  formatFileSize,
  initials,
  sectionProgress,
  statusClass,
  statusLabel,
} from '../../lib/admissionReview';
import { revokeStaffDocumentUrls, staffDocumentBlobUrl, clearStaffDocumentCache } from '../../lib/staffDocuments';
import { readFileAsDataUrl } from '../../lib/uploads';

const ease = [0.22, 1, 0.36, 1] as const;

function FolderIcon({ open = false, className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {open ? (
        <>
          <path d="M4 20a2 2 0 01-2-2V8a2 2 0 012-2h5l2 2h9a2 2 0 012 2v1H4v9z" opacity="0.35" />
          <path d="M4 8h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" />
        </>
      ) : (
        <path d="M4 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      )}
    </svg>
  );
}

function FileIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h6l4 4v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="review-progress-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function FieldValue({ field, value }) {
  if (value == null || value === '') {
    return <span className="text-sm italic text-text-muted">Not provided</span>;
  }
  if (field?.type === 'file' && typeof value === 'object' && value.url) {
    return (
      <span className="text-sm font-medium text-ink">
        {value.name || 'Uploaded file'}
        {value.size ? ` · ${formatFileSize(value.size)}` : ''}
      </span>
    );
  }
  if (field?.type === 'textarea') {
    return <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-ink">{String(value)}</p>;
  }
  return <span className="text-sm font-semibold text-ink">{String(value)}</span>;
}

function DocumentPreview({ doc, previewHref, previewLoading, replacing, onReplace, onPrev, onNext, hasPrev, hasNext }) {
  const [broken, setBroken] = useState(false);
  const href = previewHref || '';
  const missing = Boolean(doc && !previewLoading && !href);
  const inputId = doc ? `replace-${doc.key}` : 'replace-doc';

  useEffect(() => {
    setBroken(false);
  }, [doc?.key, href]);

  if (!doc) {
    return (
      <div className="review-preview-empty">
        <FileIcon className="mb-3 h-12 w-12 text-cardinal/40" />
        <p className="m-0 font-semibold text-ink">Select a document</p>
        <p className="m-0 mt-1 max-w-xs text-sm text-text-muted">Pick a file from the list to preview it here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate text-base font-bold text-ink">{doc.label}</p>
          <p className="m-0 truncate text-xs text-text-muted">
            {doc.name}
            {doc.size ? ` · ${formatFileSize(doc.size)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-outline-light px-3 py-1.5 text-xs" disabled={!hasPrev} onClick={onPrev}>
            ← Prev
          </button>
          <button type="button" className="btn btn-outline-light px-3 py-1.5 text-xs" disabled={!hasNext} onClick={onNext}>
            Next →
          </button>
        </div>
      </div>
      <div className="review-preview-frame">
        {previewLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="admit-spinner" />
            <p className="m-0 text-sm text-text-muted">Loading document…</p>
          </div>
        ) : broken || missing ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <FileIcon className="h-12 w-12 text-crimson" />
            <p className="m-0 text-sm font-semibold text-ink">File missing from cloud storage</p>
            <p className="m-0 max-w-sm text-sm text-text-muted">
              The file metadata is saved but the actual file was never stored in R2 (common for applications
              submitted before cloud storage was enabled). Upload a replacement below, or ask the applicant to use
              Replace documents in Apply.
            </p>
            {onReplace ? (
              <>
                <input
                  id={inputId}
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  disabled={replacing}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onReplace(file);
                  }}
                />
                <label htmlFor={inputId} className="btn btn-primary py-2 text-sm">
                  {replacing ? 'Uploading…' : 'Upload replacement'}
                </label>
              </>
            ) : null}
          </div>
        ) : doc.image ? (
          <motion.img
            key={doc.key}
            src={href}
            alt={doc.name || doc.label}
            className="review-preview-image"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease }}
            onError={() => setBroken(true)}
          />
        ) : doc.pdf ? (
          <iframe title={doc.label} src={href} className="review-preview-iframe" onError={() => setBroken(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
            <FileIcon className="h-12 w-12 text-cardinal" />
            <p className="m-0 text-sm font-semibold text-ink">Preview not available for this file type</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary py-2 text-sm"
          aria-disabled={!href}
          onClick={(event) => {
            if (!href) event.preventDefault();
          }}
        >
          Open in new tab
        </a>
        <a
          href={href}
          download={doc.name || doc.label}
          className="btn btn-outline-light py-2 text-sm"
          aria-disabled={!href}
          onClick={(event) => {
            if (!href) event.preventDefault();
          }}
        >
          Download
        </a>
      </div>
    </div>
  );
}

export default function ApplicationReview({ portal = 'staff' }) {
  const { id } = useParams();
  const reduce = useReducedMotion();
  const authScope = portal === 'admin' ? 'admin' : 'staff';
  const listPath = portal === 'admin' ? `${ADMIN_BASE}/admissions` : `${FACULTY_BASE}/admissions`;
  const role = portal === 'admin' ? getAdmin()?.role || 'admin' : getStaff()?.role;
  const canDecide = canDecideAdmissions(role);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState({ documents: true });
  const [active, setActive] = useState({ type: 'overview' });
  const [confirmReject, setConfirmReject] = useState(false);
  const [mobilePane, setMobilePane] = useState('browse');
  const [previewUrls, setPreviewUrls] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replacingKey, setReplacingKey] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/applications/${id}`, { authScope })
      .then((res) => {
        setDetail(res.data);
        setError('');
        setActive({ type: 'overview' });
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load this application.');
      })
      .finally(() => setLoading(false));
  }, [id, authScope]);

  const documents = useMemo(() => collectDocuments(detail?.form, detail?.answers), [detail]);

  useEffect(() => {
    if (!id || !documents.length) {
      setPreviewUrls({});
      setPreviewLoading(false);
      return undefined;
    }

    let cancelled = false;
    const scope = portal === 'admin' ? 'admin' : 'staff';
    setPreviewLoading(true);

    const load = async () => {
      const entries = await Promise.all(
        documents.map(async (doc) => {
          try {
            const href = await staffDocumentBlobUrl(id, doc.key, scope);
            return [doc.key, href];
          } catch {
            return [doc.key, ''];
          }
        })
      );
      if (!cancelled) {
        setPreviewUrls(Object.fromEntries(entries));
        setPreviewLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, portal, documents]);

  useEffect(() => () => revokeStaffDocumentUrls(id), [id]);

  const reloadDocumentPreview = async (fieldKey: string) => {
    if (!id) return;
    const scope = portal === 'admin' ? 'admin' : 'staff';
    clearStaffDocumentCache(id, fieldKey, scope);
    try {
      const href = await staffDocumentBlobUrl(id, fieldKey, scope);
      setPreviewUrls((current) => ({ ...current, [fieldKey]: href }));
    } catch {
      setPreviewUrls((current) => ({ ...current, [fieldKey]: '' }));
    }
  };

  const replaceDocument = async (fieldKey: string, file: File) => {
    if (!id || !detail) return;
    setReplacingKey(fieldKey);
    setError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.post(
        `/applications/${id}/files/${fieldKey}`,
        { file: dataUrl, name: file.name },
        { authScope }
      );
      setDetail((current) => ({
        ...current,
        answers: { ...(current?.answers || {}), [fieldKey]: res.data },
      }));
      await reloadDocumentPreview(fieldKey);
      setNotice(`${res.data?.name || 'Document'} uploaded to cloud storage.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload that document.');
    } finally {
      setReplacingKey('');
    }
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const groups = detail?.form?.groups || [];
  const student = detail?.student;
  const progress = useMemo(() => applicationProgress(detail?.form, detail?.answers), [detail]);
  const canAct = canDecide && detail && ['submitted', 'accepted', 'rejected'].includes(detail.status);

  const selectedDoc = active.type === 'document' ? documents.find((d) => d.key === active.key) : null;
  const selectedGroup = active.type === 'section' ? groups.find((g) => g.id === active.id) : null;
  const docIndex = selectedDoc ? documents.findIndex((d) => d.key === selectedDoc.key) : -1;

  const decide = async (decision) => {
    if (!detail?.id) return;
    if (decision === 'rejected' && !confirmReject) {
      setConfirmReject(true);
      return;
    }
    setConfirmReject(false);
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/applications/${detail.id}/decision`, { decision }, { authScope });
      setDetail((d) => ({ ...d, ...res.data }));
      setNotice(
        decision === 'accepted'
          ? `${student?.name || 'Applicant'} accepted and added to the student roster.`
          : `${student?.name || 'Applicant'} marked as rejected.`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that decision.');
    } finally {
      setSaving(false);
    }
  };

  const selectDocument = (key) => {
    setActive({ type: 'document', key });
    setMobilePane('preview');
  };

  const sidebarItem = (selected, onClick, children, className = '') => (
    <button
      type="button"
      onClick={onClick}
      className={`review-nav-item ${selected ? 'is-active' : ''} ${className}`}
    >
      {children}
    </button>
  );

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: `Documents (${documents.length})` },
  ];

  return (
    <div className="review-shell flex min-h-svh w-full flex-col">
      <div className="review-backdrop pointer-events-none fixed inset-0" aria-hidden="true" />

      {(error || notice) && (
        <div className="relative z-20 w-full px-4 pt-3 sm:px-6 lg:px-8">
          <AnimatePresence>
            {error ? (
              <motion.p className="review-alert is-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.p>
            ) : null}
            {notice ? (
              <motion.p className="review-alert is-success" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {notice}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      )}

      {loading ? (
        <div className="review-loading">
          <div className="admit-spinner" />
          <p className="m-0">Loading student file…</p>
        </div>
      ) : !detail ? (
        <div className="review-loading">
          <p className="m-0 text-text-muted">Application not found.</p>
          <Link to={listPath} className="btn btn-primary mt-4">
            Back to admissions
          </Link>
        </div>
      ) : (
        <>
          <motion.section
            className="review-profile w-full"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <div className="review-profile-inner">
              <Link to={listPath} className="review-back-link mb-4 inline-flex">
                ← Back to applications
              </Link>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="review-avatar-wrap">
                <ProgressRing pct={progress.pct} size={92} />
                <span className="review-profile-avatar">{initials(student?.name)}</span>
                <span className="review-profile-pct" aria-label={`${progress.pct}% complete`}>
                  {progress.pct}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="review-profile-name m-0">{student?.name || 'Applicant'}</h1>
                  <span className={`admit-status ${statusClass[detail.status]}`}>{statusLabel[detail.status]}</span>
                </div>
                <p className="m-0 mt-1 text-white/80">{student?.email}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="review-chip">{documents.length} documents</span>
                  <span className="review-chip">
                    {progress.requiredDone}/{progress.requiredTotal} required fields
                  </span>
                  {detail.submittedAt ? (
                    <span className="review-chip">Submitted {new Date(detail.submittedAt).toLocaleDateString()}</span>
                  ) : (
                    <span className="review-chip">Not yet submitted</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                {documents.length > 0 ? (
                  <button type="button" className="review-profile-btn is-primary" onClick={() => selectDocument(documents[0].key)}>
                    Review documents
                  </button>
                ) : null}
                <button type="button" className="review-profile-btn" onClick={() => setActive({ type: 'overview' })}>
                  View overview
                </button>
              </div>
              </div>
            </div>
          </motion.section>

          <div className="review-workspace">
            <aside className={`review-sidebar ${mobilePane === 'browse' ? 'block' : 'hidden lg:block'}`}>
              <p className="review-sidebar-label">Student file</p>
              <nav className="review-nav">
                {sidebarItem(active.type === 'overview', () => setActive({ type: 'overview' }), <>Overview</>)}

                <div className="mt-1">
                  {sidebarItem(
                    active.type === 'documents' || active.type === 'document',
                    () => {
                      setActive(documents.length ? { type: 'document', key: documents[0].key } : { type: 'documents' });
                      setExpanded((p) => ({ ...p, documents: true }));
                    },
                    <>
                      <FolderIcon open={expanded.documents} className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">Documents</span>
                      <span className="review-nav-badge">{documents.length}</span>
                    </>,
                    'justify-between'
                  )}
                  {expanded.documents && documents.length ? (
                    <ul className="review-doc-list">
                      {documents.map((doc) => (
                        <li key={doc.key}>
                          <button
                            type="button"
                            onClick={() => selectDocument(doc.key)}
                            className={`review-doc-item ${active.type === 'document' && active.key === doc.key ? 'is-active' : ''}`}
                          >
                            <FileIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{doc.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <p className="review-sidebar-section">Form sections</p>
                {groups.map((group) => {
                  const stats = sectionProgress(group, detail.answers);
                  return (
                    <div key={group.id}>
                      {sidebarItem(
                        active.type === 'section' && active.id === group.id,
                        () => setActive({ type: 'section', id: group.id }),
                        <>
                          <FolderIcon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{group.title}</span>
                          <span className={`review-nav-badge ${stats.complete ? 'is-complete' : ''}`}>
                            {stats.filled}/{stats.total}
                          </span>
                        </>,
                        'justify-between'
                      )}
                    </div>
                  );
                })}
              </nav>
            </aside>

            <main className={`review-main ${mobilePane === 'preview' ? 'block' : 'hidden lg:block'}`}>
              <div className="review-mobile-tabs lg:hidden">
                <button type="button" className={mobilePane === 'browse' ? 'is-active' : ''} onClick={() => setMobilePane('browse')}>
                  File menu
                </button>
                <button type="button" className={mobilePane === 'preview' ? 'is-active' : ''} onClick={() => setMobilePane('preview')}>
                  Details
                </button>
              </div>

              <div className="review-panel">
                <div className="review-tabs hidden lg:flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={
                        (tab.key === 'overview' && active.type === 'overview') ||
                        (tab.key === 'documents' && (active.type === 'documents' || active.type === 'document'))
                          ? 'is-active'
                          : ''
                      }
                      onClick={() =>
                        tab.key === 'overview'
                          ? setActive({ type: 'overview' })
                          : setActive(documents.length ? { type: 'document', key: documents[0].key } : { type: 'documents' })
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active.type}-${active.key || active.id || 'root'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease }}
                  >
                    {active.type === 'overview' && (
                      <div>
                        <h2 className="review-panel-title">Application overview</h2>
                        <p className="review-panel-hint">Key details before reviewing documents and form answers.</p>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            ['Applicant', student?.name],
                            ['Email', student?.email],
                            ['Status', statusLabel[detail.status]],
                            ['Documents', `${documents.length} uploaded`],
                            ['Required fields', `${progress.requiredDone}/${progress.requiredTotal}`],
                            ['Submitted', detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : 'Not yet'],
                          ].map(([label, value], i) => (
                            <motion.div
                              key={label}
                              className="review-stat-card"
                              initial={reduce ? false : { opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05, duration: 0.3, ease }}
                            >
                              <p className="review-stat-label">{label}</p>
                              <p className="review-stat-value">{value}</p>
                            </motion.div>
                          ))}
                        </div>
                        {documents.length > 0 ? (
                          <button type="button" className="btn btn-primary mt-6" onClick={() => selectDocument(documents[0].key)}>
                            Start document review →
                          </button>
                        ) : null}
                      </div>
                    )}

                    {(active.type === 'documents' || active.type === 'document') && (
                      <div className="grid gap-6 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
                        <div>
                          <h2 className="review-panel-title text-lg!">All files</h2>
                          <ul className="space-y-2">
                            {documents.map((doc) => {
                              const selected = active.type === 'document' && active.key === doc.key;
                              return (
                                <li key={doc.key}>
                                  <button
                                    type="button"
                                    onClick={() => selectDocument(doc.key)}
                                    className={`review-file-card ${selected ? 'is-selected' : ''}`}
                                  >
                                    <div className="review-file-thumb">
                                      {doc.image && previewUrls[doc.key] ? (
                                        <img src={previewUrls[doc.key]} alt="" />
                                      ) : (
                                        <FileIcon className="h-6 w-6 text-cardinal" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="m-0 truncate text-sm font-bold text-ink">{doc.label}</p>
                                      <p className="m-0 truncate text-xs text-text-muted">{doc.name}</p>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          {!documents.length ? (
                            <p className="rounded-xl bg-bg/60 px-4 py-8 text-center text-sm text-text-muted">No documents uploaded yet.</p>
                          ) : null}
                        </div>
                        <DocumentPreview
                          doc={selectedDoc}
                          previewHref={selectedDoc ? previewUrls[selectedDoc.key] : ''}
                          previewLoading={previewLoading}
                          replacing={Boolean(selectedDoc && replacingKey === selectedDoc.key)}
                          onReplace={
                            selectedDoc && detail?.status !== 'accepted' && detail?.status !== 'rejected'
                              ? (file) => replaceDocument(selectedDoc.key, file)
                              : null
                          }
                          hasPrev={docIndex > 0}
                          hasNext={docIndex >= 0 && docIndex < documents.length - 1}
                          onPrev={() => docIndex > 0 && selectDocument(documents[docIndex - 1].key)}
                          onNext={() => docIndex < documents.length - 1 && selectDocument(documents[docIndex + 1].key)}
                        />
                      </div>
                    )}

                    {active.type === 'section' && selectedGroup && (
                      <div>
                        <h2 className="review-panel-title">{selectedGroup.title}</h2>
                        {selectedGroup.description ? <p className="review-panel-hint">{selectedGroup.description}</p> : null}
                        <dl className="grid gap-3 lg:grid-cols-2">
                          {(selectedGroup.fields || []).map((field, i) => (
                            <motion.div
                              key={field.key}
                              className={`review-field-card ${field.type === 'file' ? 'is-file lg:col-span-2' : ''}`}
                              initial={reduce ? false : { opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.28, ease }}
                            >
                              <dt className="review-field-label">
                                {field.required ? <span className="review-required" /> : null}
                                {field.label}
                              </dt>
                              <dd className="m-0 mt-2">
                                {field.type === 'file' && detail.answers?.[field.key]?.url ? (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <FieldValue field={field} value={detail.answers[field.key]} />
                                    <button type="button" className="btn btn-outline-light py-1.5 text-xs" onClick={() => selectDocument(field.key)}>
                                      Preview file
                                    </button>
                                  </div>
                                ) : (
                                  <FieldValue field={field} value={detail.answers?.[field.key]} />
                                )}
                              </dd>
                            </motion.div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>

          {canAct ? (
            <footer className="review-footer w-full">
              <div className="review-footer-inner flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="m-0 text-sm font-bold text-ink">Decision for {student?.name}</p>
                  <p className="m-0 text-xs text-text-muted">Accept enrolls them on the roster. Reject closes the application.</p>
                  {confirmReject ? <p className="m-0 mt-2 text-xs font-bold text-crimson">Tap Reject again to confirm.</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    type="button"
                    className="btn btn-navy min-w-[10rem] py-2.5 text-sm"
                    disabled={saving}
                    onClick={() => decide('accepted')}
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                  >
                    {saving ? 'Saving…' : detail.status === 'accepted' ? '✓ Accepted' : 'Accept student'}
                  </motion.button>
                  <button
                    type="button"
                    className={`review-reject-btn ${confirmReject ? 'is-confirm' : ''}`}
                    disabled={saving}
                    onClick={() => decide('rejected')}
                  >
                    {detail.status === 'rejected' ? 'Rejected' : confirmReject ? 'Confirm reject' : 'Reject'}
                  </button>
                  {confirmReject ? (
                    <button type="button" className="btn btn-outline-light py-2.5 text-sm" onClick={() => setConfirmReject(false)}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            </footer>
          ) : !canDecide ? (
            <footer className="review-footer is-readonly">
              View-only access — only admissions officers can accept or reject applicants.
            </footer>
          ) : null}
        </>
      )}
    </div>
  );
}
