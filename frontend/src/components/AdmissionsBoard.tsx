import { useEffect, useState } from 'react';
import api from '../api/client';
import { canDecideAdmissions } from '../data/roles';

const statusClass = {
  not_started: 'bg-cardinal-pale text-cardinal',
  in_progress: 'bg-cardinal-pale text-cardinal',
  submitted: 'bg-crimson-pale text-crimson',
  accepted: 'bg-cardinal-pale text-cardinal',
  rejected: 'bg-crimson-pale text-crimson',
};

const statusLabel = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export default function AdmissionsBoard({ authScope, role }) {
  const [rows, setRows] = useState([]);
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

  const decide = async (id, decision) => {
    setSavingId(id);
    try {
      const res = await api.patch(`/applications/${id}/decision`, { decision }, { authScope });
      setRows((list) => list.map((row) => (row.id === id ? res.data : row)));
      setNotice(decision === 'accepted' ? 'Applicant accepted.' : 'Applicant rejected.');
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
          Your role is view only. You can read student records but cannot accept or reject.
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading student records…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No applications yet</h3>
          <p className="m-0 text-text-muted">When students register to apply, they will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => (
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
                    </p>
                  )}
                </div>
                {canDecide && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-navy py-2.5 text-sm"
                      disabled={savingId === row.id || row.status === 'accepted'}
                      onClick={() => decide(row.id, 'accepted')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson disabled:opacity-50"
                      disabled={savingId === row.id || row.status === 'rejected'}
                      onClick={() => decide(row.id, 'rejected')}
                    >
                      Reject
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
