import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ADMIN_BASE, FACULTY_BASE } from '../../admin/paths';
import { getAdmin } from '../../auth/adminSession';
import { getStaff } from '../../auth/staffSession';
import api from '../../api/client';
import { canDecideAdmissions } from '../../data/roles';
import {
  collectDocuments,
  formatFileSize,
  initials,
  statusClass,
  statusLabel,
} from '../../lib/admissionReview';

function FolderIcon({ open = false, className = 'h-4 w-4' }) {
  return open ? (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 20a2 2 0 01-2-2V8a2 2 0 012-2h5l2 2h9a2 2 0 012 2v1H4v9z" opacity="0.35" />
      <path d="M4 8h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
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

function FieldValue({ field, value }) {
  if (value == null || value === '') {
    return <span className="text-text-muted">Not provided</span>;
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
  return <span className="text-sm font-medium text-ink">{String(value)}</span>;
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
  const [active, setActive] = useState({ type: 'overview' });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/applications/${id}`, { authScope })
      .then((res) => {
        setDetail(res.data);
        setError('');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load this application.');
      })
      .finally(() => setLoading(false));
  }, [id, authScope]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const documents = useMemo(() => collectDocuments(detail?.form, detail?.answers), [detail]);
  const groups = detail?.form?.groups || [];
  const student = detail?.student;
  const canAct = canDecide && detail && ['submitted', 'accepted', 'rejected'].includes(detail.status);

  const decide = async (decision) => {
    if (!detail?.id) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/applications/${detail.id}/decision`, { decision }, { authScope });
      setDetail((d) => ({ ...d, ...res.data }));
      setNotice(
        decision === 'accepted'
          ? 'Applicant accepted and added to the student roster.'
          : 'Applicant marked rejected.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that decision.');
    } finally {
      setSaving(false);
    }
  };

  const selectedDoc = active.type === 'document' ? documents.find((d) => d.key === active.key) : null;
  const selectedGroup = active.type === 'section' ? groups.find((g) => g.id === active.id) : null;

  const navButtonClass = (selected) =>
    `flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
      selected ? 'bg-cardinal text-white shadow-sm' : 'text-ink hover:bg-white/80'
    }`;

  return (
    <div className="flex min-h-svh flex-col bg-bg-alt">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={listPath} className="btn btn-outline-light shrink-0 py-2 text-sm">
              ← Back to list
            </Link>
            <div className="min-w-0">
              <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Application review
              </p>
              <h1 className="m-0 truncate text-lg font-bold text-ink">{student?.name || 'Applicant'}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail ? (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass[detail.status] || ''}`}>
                {statusLabel[detail.status] || detail.status}
              </span>
            ) : null}
            {canAct ? (
              <>
                <button
                  type="button"
                  className="btn btn-navy py-2 text-sm"
                  disabled={saving}
                  onClick={() => decide('accepted')}
                >
                  {detail?.status === 'accepted' ? 'Accepted' : 'Accept student'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-crimson/25 bg-crimson-pale px-4 py-2 text-sm font-bold text-crimson disabled:opacity-50"
                  disabled={saving}
                  onClick={() => decide('rejected')}
                >
                  {detail?.status === 'rejected' ? 'Rejected' : 'Reject'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6">
          {error ? (
            <p className="m-0 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
          ) : null}
          {notice ? (
            <p className="m-0 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-10 text-text-muted">Loading application…</div>
      ) : !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
          <p className="m-0 text-text-muted">Application not found.</p>
          <Link to={listPath} className="btn btn-primary">
            Back to admissions
          </Link>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-0 px-4 py-4 sm:px-6 lg:flex-row lg:py-6">
          <aside className="mb-4 w-full shrink-0 lg:mb-0 lg:w-72">
            <div className="glass sticky top-[4.5rem] overflow-hidden rounded-[1.25rem]">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cardinal-pale text-xs font-bold text-cardinal">
                    {initials(student?.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-bold text-ink">{student?.name}</p>
                    <p className="m-0 truncate text-xs text-text-muted">{student?.email}</p>
                  </div>
                </div>
              </div>
              <nav className="max-h-[calc(100vh-12rem)] overflow-y-auto p-2">
                <button
                  type="button"
                  className={navButtonClass(active.type === 'overview')}
                  onClick={() => setActive({ type: 'overview' })}
                >
                  <span className="text-base" aria-hidden="true">
                    📋
                  </span>
                  Overview
                </button>

                <div className="mt-1">
                  <button
                    type="button"
                    className={`${navButtonClass(active.type === 'documents')} justify-between`}
                    onClick={() => {
                      setActive({ type: 'documents' });
                      setExpanded((p) => ({ ...p, documents: true }));
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <FolderIcon open={expanded.documents} className="h-4 w-4 shrink-0" />
                      Documents
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem]">{documents.length}</span>
                  </button>
                  {expanded.documents && documents.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {documents.map((doc) => (
                        <li key={doc.key}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                              active.type === 'document' && active.key === doc.key
                                ? 'bg-cardinal-pale text-cardinal'
                                : 'text-text-muted hover:bg-white/70 hover:text-ink'
                            }`}
                            onClick={() => setActive({ type: 'document', key: doc.key })}
                          >
                            <FileIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{doc.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {groups.map((group) => {
                  const folderKey = group.id;
                  const isOpen = expanded[folderKey];
                  const fieldCount = (group.fields || []).length;
                  return (
                    <div key={group.id} className="mt-1">
                      <button
                        type="button"
                        className={`${navButtonClass(active.type === 'section' && active.id === group.id)} justify-between`}
                        onClick={() => {
                          setActive({ type: 'section', id: group.id });
                          setExpanded((p) => ({ ...p, [folderKey]: true }));
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FolderIcon open={isOpen} className="h-4 w-4 shrink-0" />
                          <span className="truncate">{group.title}</span>
                        </span>
                        <span className="shrink-0 text-[0.65rem] opacity-70">{fieldCount}</span>
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 flex-1 lg:pl-4">
            <div className="glass min-h-[28rem] rounded-[1.5rem] p-5 sm:p-8">
              {active.type === 'overview' && (
                <div>
                  <span className="eyebrow">Overview</span>
                  <h2 className="mt-2 mb-4">Application summary</h2>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Applicant</dt>
                      <dd className="m-0 mt-1 text-sm font-bold text-ink">{student?.name}</dd>
                    </div>
                    <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Email</dt>
                      <dd className="m-0 mt-1 text-sm font-bold text-ink">{student?.email}</dd>
                    </div>
                    <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status</dt>
                      <dd className="m-0 mt-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClass[detail.status]}`}>
                          {statusLabel[detail.status]}
                        </span>
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-border bg-white/70 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Documents</dt>
                      <dd className="m-0 mt-1 text-sm font-bold text-ink">{documents.length} uploaded</dd>
                    </div>
                    {detail.submittedAt ? (
                      <div className="rounded-2xl border border-border bg-white/70 px-4 py-3 sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Submitted</dt>
                        <dd className="m-0 mt-1 text-sm font-medium text-ink">
                          {new Date(detail.submittedAt).toLocaleString()}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {!canDecide && (
                    <p className="mt-6 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-semibold text-cardinal">
                      Only admissions officers can accept or reject. You can browse all folders and documents.
                    </p>
                  )}
                </div>
              )}

              {active.type === 'documents' && (
                <div>
                  <span className="eyebrow">Documents folder</span>
                  <h2 className="mt-2 mb-1">All uploaded files</h2>
                  <p className="m-0 mb-6 text-sm text-text-muted">
                    {documents.length
                      ? `${documents.length} file${documents.length === 1 ? '' : 's'} in this application.`
                      : 'No documents uploaded yet.'}
                  </p>
                  {documents.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {documents.map((doc) => (
                        <button
                          key={doc.key}
                          type="button"
                          className="overflow-hidden rounded-[1.25rem] border border-border bg-white text-left shadow-sm transition hover:border-cardinal/30 hover:shadow-md"
                          onClick={() => setActive({ type: 'document', key: doc.key })}
                        >
                          <div className="flex aspect-[4/3] items-center justify-center bg-bg/80">
                            {doc.image ? (
                              <img src={doc.href} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                            ) : (
                              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cardinal-pale text-cardinal">
                                <FileIcon className="h-7 w-7" />
                              </span>
                            )}
                          </div>
                          <div className="border-t border-border p-4">
                            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-text-muted">
                              {doc.groupTitle}
                            </p>
                            <p className="m-0 mt-1 text-sm font-bold text-ink">{doc.label}</p>
                            <p className="m-0 mt-0.5 truncate text-xs text-text-muted">{doc.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-bg/80 px-4 py-8 text-center text-sm text-text-muted">
                      The student has not uploaded any files yet.
                    </p>
                  )}
                </div>
              )}

              {active.type === 'document' && selectedDoc && (
                <div>
                  <span className="eyebrow">{selectedDoc.groupTitle}</span>
                  <h2 className="mt-2 mb-1">{selectedDoc.label}</h2>
                  <p className="m-0 mb-6 text-sm text-text-muted">
                    {selectedDoc.name}
                    {selectedDoc.size ? ` · ${formatFileSize(selectedDoc.size)}` : ''}
                  </p>
                  <div className="mb-6 overflow-hidden rounded-[1.25rem] border border-border bg-bg/60">
                    {selectedDoc.image ? (
                      <img
                        src={selectedDoc.href}
                        alt={selectedDoc.name || selectedDoc.label}
                        className="mx-auto max-h-[min(70vh,640px)] w-full object-contain p-4"
                      />
                    ) : selectedDoc.pdf ? (
                      <iframe
                        title={selectedDoc.label}
                        src={selectedDoc.href}
                        className="h-[min(70vh,640px)] w-full bg-white"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-20 text-cardinal">
                        <FileIcon className="h-12 w-12" />
                        <p className="m-0 text-sm font-semibold text-ink">Preview not available</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={selectedDoc.href} target="_blank" rel="noreferrer" className="btn btn-primary py-2 text-sm">
                      Open in new tab
                    </a>
                    <a
                      href={selectedDoc.href}
                      download={selectedDoc.name || selectedDoc.label}
                      className="btn btn-outline-light py-2 text-sm"
                    >
                      Download
                    </a>
                  </div>
                </div>
              )}

              {active.type === 'section' && selectedGroup && (
                <div>
                  <span className="eyebrow">Form section</span>
                  <h2 className="mt-2 mb-1">{selectedGroup.title}</h2>
                  {selectedGroup.description ? (
                    <p className="m-0 mb-6 text-sm text-text-muted">{selectedGroup.description}</p>
                  ) : null}
                  <dl className="grid gap-3">
                    {(selectedGroup.fields || []).map((field) => (
                      <div
                        key={field.key}
                        className={`rounded-2xl border px-4 py-3 ${
                          field.type === 'file' ? 'border-cardinal/20 bg-cardinal-pale/25' : 'border-border bg-white/70'
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
                                onClick={() => setActive({ type: 'document', key: field.key })}
                              >
                                Open file
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
            </div>

            {canAct && (
              <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                <button
                  type="button"
                  className="btn btn-navy flex-1 py-2.5 text-sm"
                  disabled={saving}
                  onClick={() => decide('accepted')}
                >
                  Accept student
                </button>
                <button
                  type="button"
                  className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson"
                  disabled={saving}
                  onClick={() => decide('rejected')}
                >
                  Reject
                </button>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
