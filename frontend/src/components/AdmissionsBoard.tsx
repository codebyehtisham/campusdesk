import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';

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
    label: 'Pending',
    description: 'Applications still in progress or awaiting review.',
    match: (status) => ['not_started', 'in_progress', 'submitted'].includes(status),
  },
  {
    key: 'accepted',
    label: 'Accepted',
    description: 'Accepted students. Officers can move them back to rejected if needed.',
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
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState('');
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

  const decide = async (id, decision) => {
    setSavingId(id);
    try {
      const res = await api.patch(`/applications/${id}/decision`, { decision }, { authScope });
      setRows((list) => list.map((row) => (row.id === id ? res.data : row)));
      setNotice(decision === 'accepted' ? 'Applicant marked accepted.' : 'Applicant marked rejected.');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that decision.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div>
      {!canDecide && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-semibold text-cardinal">
          {role === 'admin'
            ? 'Organisation admins can open or close admissions and view records. Only admissions officers can accept or reject.'
            : 'Your role is view only. You can read student records but cannot accept or reject.'}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              section === item.key ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'
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
        <div className="grid gap-4">
          {filteredRows.map((row) => (
            <article key={row.id} className="glass rounded-[1.6rem] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <span className={`tag w-fit ${statusClass[row.status] || 'tag-allied'}`}>
                    {statusLabel[row.status] || row.status}
                  </span>
                  <h3 className="mt-3 mb-1">{row.student?.name || 'Applicant'}</h3>
                  <p className="m-0 text-text-muted">{row.student?.email}</p>
                  {row.reviewer && (
                    <p className="mt-2 mb-0 text-sm text-text-muted">
                      Reviewed by {row.reviewer.name || row.reviewer.email}
                      {row.reviewedAt ? ` · ${new Date(row.reviewedAt).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </div>
                {canDecide && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-navy py-2.5 text-sm"
                      disabled={savingId === row.id}
                      onClick={() => decide(row.id, 'accepted')}
                    >
                      {row.status === 'accepted' ? 'Keep accepted' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson disabled:opacity-50"
                      disabled={savingId === row.id}
                      onClick={() => decide(row.id, 'rejected')}
                    >
                      {row.status === 'rejected' ? 'Keep rejected' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
