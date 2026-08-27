import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_BASE, FACULTY_BASE } from '../admin/paths';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';
import { countDocuments, initials, statusClass, statusLabel } from '../lib/admissionReview';

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

export default function AdmissionsBoard({ authScope, role }) {
  const [rows, setRows] = useState([]);
  const [section, setSection] = useState('pending');
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
            const files = countDocuments(row.answers);
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
                <Link to={`${reviewBase}/${row.id}`} className="btn btn-primary shrink-0 py-2.5 text-sm">
                  Open application
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
