import { useEffect, useState } from 'react';
import api from '../../api/client';
import { formatMoney } from '../../lib/money';
import { staffReq, useLibraryKickOut } from './libraryShared';
import LibraryNotice, { useLibraryNotice } from './LibraryNotice';

export default function LibraryLoans() {
  const kickOut = useLibraryKickOut();
  const [notice, setNotice] = useLibraryNotice();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const loansRes = await api.get('/staff/library/loans', staffReq);
    setLoans(Array.isArray(loansRes.data) ? loansRes.data : []);
  };

  useEffect(() => {
    load()
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
      })
      .finally(() => setLoading(false));
  }, []);

  const returnLoan = async (loanId: string) => {
    setSaving(true);
    try {
      await api.put(`/staff/library/loans/${loanId}/return`, {}, staffReq);
      setNotice('Book returned.');
      await load();
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not return book.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading loans…</div>;
  }

  const activeLoans = loans.filter((loan: any) => !loan.returnedAt);

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Library</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Loans</h1>
        <p className="m-0 max-w-2xl text-text-muted">
          {activeLoans.length} active loan{activeLoans.length === 1 ? '' : 's'} · process returns here.
        </p>
      </div>

      <div className="grid gap-3">
        {loans.length === 0 ? (
          <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No loans recorded yet.</div>
        ) : (
          loans.map((loan: any) => (
            <article key={loan.id} className="glass rounded-[1.4rem] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="m-0">{loan.item?.title}</h3>
                  <p className="m-0 text-sm text-text-muted">
                    {loan.person?.name}
                    {loan.dueAt ? ` · due ${loan.dueAt.slice(0, 10)}` : ''}
                  </p>
                </div>
                {loan.returnedAt ? (
                  <span className="rounded-full bg-bg-alt px-3 py-1 text-xs font-bold text-text-muted">
                    Returned {loan.returnedAt.slice(0, 10)}
                    {loan.fineCents ? ` · fine ${formatMoney(loan.fineCents)}` : ''}
                  </span>
                ) : (
                  <button type="button" className="btn btn-primary py-2 text-sm" disabled={saving} onClick={() => returnLoan(loan.id)}>
                    Mark returned
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <LibraryNotice message={notice} />
    </div>
  );
}
