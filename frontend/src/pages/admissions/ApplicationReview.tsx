import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

function ChevronIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, index) => (
        <span key={item} className="flex items-center gap-1">
          {index > 0 ? <ChevronIcon className="h-3.5 w-3.5 text-text-muted" /> : null}
          <span className={index === items.length - 1 ? 'font-bold text-ink' : 'font-medium text-text-muted'}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function DocumentPreview({ doc, onPrev, onNext, hasPrev, hasNext }) {
  if (!doc) {
    return (
      <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-border bg-white/60 p-8 text-center">
        <FileIcon className="mb-3 h-10 w-10 text-cardinal/50" />
        <p className="m-0 font-semibold text-ink">Select a document</p>
        <p className="m-0 mt-1 max-w-xs text-sm text-text-muted">Choose a file from the folder list to preview it here.</p>
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
            Prev
          </button>
          <button type="button" className="btn btn-outline-light px-3 py-1.5 text-xs" disabled={!hasNext} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
      <div className="min-h-[20rem] flex-1 overflow-hidden rounded-[1.25rem] border border-border bg-[#f4f7f7] shadow-inner">
        {doc.image ? (
          <img
            src={doc.href}
            alt={doc.name || doc.label}
            className="mx-auto h-full max-h-[min(72vh,720px)] w-full object-contain p-4"
          />
        ) : doc.pdf ? (
          <iframe title={doc.label} src={doc.href} className="h-[min(72vh,720px)] w-full bg-white" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-cardinal">
            <FileIcon className="h-12 w-12" />
            <p className="m-0 text-sm font-semibold text-ink">Preview not available for this file type</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={doc.href} target="_blank" rel="noreferrer" className="btn btn-primary py-2 text-sm">
          Open in new tab
        </a>
        <a href={doc.href} download={doc.name || doc.label} className="btn btn-outline-light py-2 text-sm">
          Download
        </a>
      </div>
    </div>
  );
}

export default function ApplicationReview({ portal = 'staff' }) {
  const { id } = useParams();
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
  const [active, setActive] = useState({ type: 'documents' });
  const [confirmReject, setConfirmReject] = useState(false);
  const [mobilePane, setMobilePane] = useState('browse');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/applications/${id}`, { authScope })
      .then((res) => {
        setDetail(res.data);
        setError('');
        const docs = collectDocuments(res.data?.form, res.data?.answers);
        if (docs.length) setActive({ type: 'document', key: docs[0].key });
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load this application.');
      })
      .finally(() => setLoading(false));
  }, [id, authScope]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const documents = useMemo(() => collectDocuments(detail?.form, detail?.answers), [detail]);
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
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
        selected
          ? 'bg-white text-cardinal shadow-sm'
          : 'text-white/85 hover:bg-white/10 hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );

  const breadcrumbs = () => {
    if (active.type === 'overview') return ['Application', 'Overview'];
    if (active.type === 'documents') return ['Application', 'Documents'];
    if (active.type === 'document' && selectedDoc) {
      return ['Application', 'Documents', selectedDoc.label];
    }
    if (active.type === 'section' && selectedGroup) {
      return ['Application', selectedGroup.title];
    }
    return ['Application'];
  };

  return (
    <div className="flex min-h-svh flex-col bg-[#eef3f3]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            to={listPath}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:border-cardinal/30 hover:text-cardinal"
          >
            ← All applications
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cardinal to-cardinal-light text-sm font-bold text-white shadow-md">
              {initials(student?.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 truncate text-lg font-bold text-ink sm:text-xl">{student?.name || 'Applicant'}</h1>
                {detail ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${statusClass[detail.status]}`}>
                    {statusLabel[detail.status]}
                  </span>
                ) : null}
              </div>
              <p className="m-0 truncate text-sm text-text-muted">{student?.email || 'Loading…'}</p>
            </div>
          </div>
          {detail && !loading ? (
            <div className="hidden items-center gap-3 md:flex">
              <div className="min-w-[8rem]">
                <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted">Completion</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-gradient-to-r from-cardinal to-cardinal-light" style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="m-0 mt-1 text-xs font-bold text-ink">{progress.pct}% · {documents.length} docs</p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {(error || notice) && (
        <div className="mx-auto w-full max-w-[1800px] px-4 pt-3 sm:px-6">
          {error ? (
            <p className="m-0 rounded-2xl border border-crimson/20 bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="m-0 rounded-2xl border border-cardinal/20 bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">
              {notice}
            </p>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-text-muted">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cardinal/20 border-t-cardinal" />
          <p className="m-0">Loading application…</p>
        </div>
      ) : !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
          <p className="m-0 text-text-muted">Application not found.</p>
          <Link to={listPath} className="btn btn-primary">
            Back to admissions
          </Link>
        </div>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col lg:flex-row lg:gap-0 lg:px-2 lg:py-4">
            <aside
              className={`shrink-0 bg-gradient-to-b from-[#0f5c5c] to-[#0a4848] text-white lg:mx-2 lg:w-72 lg:rounded-[1.25rem] lg:shadow-xl ${
                mobilePane === 'browse' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="border-b border-white/10 px-4 py-4">
                <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">File explorer</p>
                <p className="m-0 mt-1 text-sm font-bold">Application folders</p>
              </div>
              <nav className="max-h-[50vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-11rem)]">
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
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem]">{documents.length}</span>
                    </>,
                    'justify-between'
                  )}
                  {expanded.documents ? (
                    <ul className="mt-1 space-y-0.5 border-l border-white/10 pl-3 ml-3">
                      {documents.map((doc) => (
                        <li key={doc.key}>
                          <button
                            type="button"
                            onClick={() => selectDocument(doc.key)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                              active.type === 'document' && active.key === doc.key
                                ? 'bg-white/15 text-white'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <FileIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{doc.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <p className="mb-1 mt-4 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Form sections
                </p>
                {groups.map((group, index) => {
                  const stats = sectionProgress(group, detail.answers);
                  return (
                    <div key={group.id} className="mt-0.5">
                      {sidebarItem(
                        active.type === 'section' && active.id === group.id,
                        () => setActive({ type: 'section', id: group.id }),
                        <>
                          <FolderIcon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{group.title}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[0.6rem] ${
                              stats.complete ? 'bg-emerald-400/25 text-emerald-100' : 'bg-white/15'
                            }`}
                          >
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

            <main
              className={`min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-6 ${
                mobilePane === 'preview' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="mb-3 flex gap-2 lg:hidden">
                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 text-sm font-bold ${mobilePane === 'browse' ? 'bg-cardinal text-white' : 'bg-white text-ink'}`}
                  onClick={() => setMobilePane('browse')}
                >
                  Folders
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 text-sm font-bold ${mobilePane === 'preview' ? 'bg-cardinal text-white' : 'bg-white text-ink'}`}
                  onClick={() => setMobilePane('preview')}
                >
                  Preview
                </button>
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-white p-5 shadow-sm sm:p-8 min-h-[28rem]">
                <Breadcrumb items={breadcrumbs()} />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active.type}-${active.key || active.id || 'root'}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {active.type === 'overview' && (
                      <div>
                        <h2 className="mb-1 text-2xl font-bold text-ink">Application overview</h2>
                        <p className="m-0 mb-6 text-sm text-text-muted">Summary before you review documents and answers.</p>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            ['Applicant', student?.name],
                            ['Email', student?.email],
                            ['Status', statusLabel[detail.status]],
                            ['Documents', `${documents.length} uploaded`],
                            ['Required fields', `${progress.requiredDone}/${progress.requiredTotal}`],
                            ['Submitted', detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : 'Not yet'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-border bg-bg/40 px-4 py-4">
                              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
                              <p className="m-0 mt-1 text-sm font-bold text-ink">{value}</p>
                            </div>
                          ))}
                        </div>
                        {documents.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-primary mt-6"
                            onClick={() => selectDocument(documents[0].key)}
                          >
                            Start with documents →
                          </button>
                        ) : null}
                      </div>
                    )}

                    {(active.type === 'documents' || active.type === 'document') && (
                      <div className="grid gap-6 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
                        <div>
                          <h2 className="mb-3 text-lg font-bold text-ink">Files</h2>
                          <ul className="space-y-2">
                            {documents.map((doc) => {
                              const selected = active.type === 'document' && active.key === doc.key;
                              return (
                                <li key={doc.key}>
                                  <button
                                    type="button"
                                    onClick={() => selectDocument(doc.key)}
                                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                                      selected
                                        ? 'border-cardinal bg-cardinal-pale/50 shadow-sm'
                                        : 'border-border bg-white hover:border-cardinal/25'
                                    }`}
                                  >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg">
                                      {doc.image ? (
                                        <img src={doc.href} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        <FileIcon className="h-5 w-5 text-cardinal" />
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
                            <p className="rounded-xl bg-bg/60 px-4 py-8 text-center text-sm text-text-muted">
                              No documents uploaded yet.
                            </p>
                          ) : null}
                        </div>
                        <DocumentPreview
                          doc={selectedDoc}
                          hasPrev={docIndex > 0}
                          hasNext={docIndex >= 0 && docIndex < documents.length - 1}
                          onPrev={() => docIndex > 0 && selectDocument(documents[docIndex - 1].key)}
                          onNext={() => docIndex < documents.length - 1 && selectDocument(documents[docIndex + 1].key)}
                        />
                      </div>
                    )}

                    {active.type === 'section' && selectedGroup && (
                      <div>
                        <h2 className="mb-1 text-2xl font-bold text-ink">{selectedGroup.title}</h2>
                        {selectedGroup.description ? (
                          <p className="m-0 mb-6 text-sm text-text-muted">{selectedGroup.description}</p>
                        ) : null}
                        <dl className="grid gap-3 lg:grid-cols-2">
                          {(selectedGroup.fields || []).map((field) => (
                            <div
                              key={field.key}
                              className={`rounded-2xl border px-4 py-4 ${
                                field.type === 'file'
                                  ? 'border-cardinal/25 bg-cardinal-pale/20 lg:col-span-2'
                                  : 'border-border bg-bg/30'
                              }`}
                            >
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                {field.required ? <span className="h-1.5 w-1.5 rounded-full bg-crimson" /> : null}
                                {field.label}
                              </dt>
                              <dd className="m-0 mt-2">
                                {field.type === 'file' && detail.answers?.[field.key]?.url ? (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <FieldValue field={field} value={detail.answers[field.key]} />
                                    <button
                                      type="button"
                                      className="btn btn-outline-light py-1.5 text-xs"
                                      onClick={() => selectDocument(field.key)}
                                    >
                                      Preview file
                                    </button>
                                  </div>
                                ) : (
                                  <FieldValue field={field} value={detail.answers?.[field.key]} />
                                )}
                              </dd>
                            </div>
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
            <footer className="sticky bottom-0 z-30 border-t border-border bg-white/95 px-4 py-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl sm:px-6">
              <div className="mx-auto flex max-w-[1800px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="m-0 text-sm font-bold text-ink">Decision for {student?.name}</p>
                  <p className="m-0 text-xs text-text-muted">
                    Accept adds them to the student roster. Reject closes this application.
                  </p>
                  {confirmReject ? (
                    <p className="m-0 mt-2 text-xs font-bold text-crimson">Tap Reject again to confirm.</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-navy min-w-[9rem] py-2.5 text-sm"
                    disabled={saving}
                    onClick={() => decide('accepted')}
                  >
                    {saving ? 'Saving…' : detail.status === 'accepted' ? '✓ Accepted' : 'Accept student'}
                  </button>
                  <button
                    type="button"
                    className={`min-w-[9rem] rounded-full border px-5 py-2.5 text-sm font-bold disabled:opacity-50 ${
                      confirmReject
                        ? 'border-crimson bg-crimson text-white'
                        : 'border-crimson/25 bg-crimson-pale text-crimson'
                    }`}
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
            <footer className="border-t border-border bg-cardinal-pale/50 px-4 py-3 text-center text-sm font-semibold text-cardinal sm:px-6">
              View-only access — only admissions officers can accept or reject applicants.
            </footer>
          ) : null}
        </>
      )}
    </div>
  );
}
