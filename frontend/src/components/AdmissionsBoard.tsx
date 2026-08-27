import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_BASE, FACULTY_BASE } from '../admin/paths';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';
import { countDocuments, initials, statusClass, statusLabel } from '../lib/admissionReview';

const SECTIONS = [
  {
    key: 'pending',
    label: 'Pending',
    description: 'Submitted applications waiting for an officer decision.',
    match: (status) => status === 'submitted',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  {
    key: 'draft',
    label: 'In progress',
    description: 'Students still filling the form.',
    match: (status) => ['not_started', 'in_progress'].includes(status),
    tone: 'border-cardinal/20 bg-cardinal-pale/40 text-cardinal',
  },
  {
    key: 'accepted',
    label: 'Accepted',
    description: 'Accepted students are added to the student roster for LMS and attendance enrollment.',
    match: (status) => status === 'accepted',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    description: 'Rejected applications. Officers can accept them later if circumstances change.',
    match: (status) => status === 'rejected',
    tone: 'border-crimson/20 bg-crimson-pale text-crimson-dark',
  },
];

export default function AdmissionsBoard({ authScope, role }) {
  const [rows, setRows] = useState([]);
  const [section, setSection] = useState('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canDecide = canDecideAdmissions(role);
  const reviewBase = authScope === 'admin' ? `${ADMIN_BASE}/admissions/review` : `${FACULTY_BASE}/admissions/review`;

  useEffect(() => {
    api
      .get('/applications', { authScope })
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load student records.'))
      .finally(() => setLoading(false));
  }, [authScope]);

  const activeSection = SECTIONS.find((item) => item.key === section) || SECTIONS[0];

  const counts = useMemo(
    () =>
      SECTIONS.reduce((acc, item) => {
        acc[item.key] = rows.filter((row) => item.match(row.status)).length;
        return acc;
      }, {}),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!activeSection.match(row.status)) return false;
      if (!q) return true;
      const name = row.student?.name?.toLowerCase() || '';
      const email = row.student?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
  }, [rows, activeSection, query]);

  return (
    <div>
      {!canDecide && (
        <p className="mb-5 rounded-2xl border border-cardinal/15 bg-cardinal-pale px-4 py-3 text-sm font-semibold text-cardinal">
          {role === 'admin'
            ? 'Organisation admins can open or close admissions and view records. Only admissions officers can accept or reject.'
            : 'View-only access. You can open applications but cannot accept or reject.'}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`rounded-[1.25rem] border p-4 text-left transition ${
              section === item.key ? `${item.tone} ring-2 ring-cardinal/20` : 'border-border bg-white hover:border-cardinal/20'
            }`}
          >
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted">{item.label}</p>
            <p className="m-0 mt-1 text-2xl font-bold text-ink">{counts[item.key] || 0}</p>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 max-w-xl text-sm text-text-muted">{activeSection.description}</p>
        <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-semibold text-ink sm:w-auto">
          Search
          <input
            className="field py-2.5"
            placeholder="Name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading student records…</div>
      ) : filteredRows.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No {activeSection.label.toLowerCase()} applications</h3>
          <p className="m-0 text-text-muted">
            {query ? 'Try a different search or switch tabs.' : 'Switch tabs to see other groups.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.4rem] border border-border bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-border bg-bg/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted md:grid">
            <span>Applicant</span>
            <span>Email</span>
            <span>Documents</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-border">
            {filteredRows.map((row) => {
              const files = countDocuments(row.answers);
              return (
                <li key={row.id} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-bg/40 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cardinal-pale text-xs font-bold text-cardinal">
                      {initials(row.student?.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 truncate font-bold text-ink">{row.student?.name || 'Applicant'}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${statusClass[row.status]}`}>
                          {statusLabel[row.status]}
                        </span>
                      </div>
                      {row.submittedAt ? (
                        <p className="m-0 mt-0.5 text-xs text-text-muted">
                          Submitted {new Date(row.submittedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="m-0 truncate text-sm text-text-muted md:py-0">{row.student?.email}</p>
                  <p className="m-0 text-sm font-semibold text-ink">
                    {files ? `${files} file${files === 1 ? '' : 's'}` : '—'}
                  </p>
                  <div className="md:text-right">
                    <Link to={`${reviewBase}/${row.id}`} className="btn btn-primary w-full py-2.5 text-sm md:w-auto">
                      Review →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
