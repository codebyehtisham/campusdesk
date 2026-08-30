import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { LIBRARY_PORTAL_BASE } from '../../admin/paths';
import { formatMoney } from '../../lib/money';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function LibraryHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('catalog');
  const [items, setItems] = useState([]);
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [itemForm, setItemForm] = useState({ title: '', author: '', isbn: '', copiesTotal: '1' });
  const [loanForm, setLoanForm] = useState({ itemId: '', personId: '', dueAt: '', notes: '' });

  const kickOut = () => {
    signOutStaff();
    navigate(LIBRARY_PORTAL_BASE, { replace: true });
  };

  const load = async () => {
    const [itemsRes, loansRes, membersRes] = await Promise.all([
      api.get('/staff/library/items', staffReq),
      api.get('/staff/library/loans', staffReq),
      api.get('/staff/library/members', staffReq),
    ]);
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
    setLoans(Array.isArray(loansRes.data) ? loansRes.data : []);
    setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
  };

  useEffect(() => {
    load()
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const addItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/staff/library/items',
        {
          title: itemForm.title,
          author: itemForm.author,
          isbn: itemForm.isbn,
          copiesTotal: Number(itemForm.copiesTotal) || 1,
        },
        staffReq
      );
      setItemForm({ title: '', author: '', isbn: '', copiesTotal: '1' });
      setNotice('Book added to catalog.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not add book.');
    } finally {
      setSaving(false);
    }
  };

  const issueLoan = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/staff/library/loans',
        {
          itemId: loanForm.itemId,
          personId: loanForm.personId,
          dueAt: loanForm.dueAt || undefined,
          notes: loanForm.notes,
        },
        staffReq
      );
      setLoanForm({ itemId: '', personId: '', dueAt: '', notes: '' });
      setNotice('Book issued.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not issue book.');
    } finally {
      setSaving(false);
    }
  };

  const returnLoan = async (loanId) => {
    setSaving(true);
    try {
      await api.put(`/staff/library/loans/${loanId}/return`, {}, staffReq);
      setNotice('Book returned.');
      await load();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not return book.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading library workspace…</div>;
  }

  const activeLoans = loans.filter((loan) => !loan.returnedAt);

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Library</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Catalog & circulation</h1>
        <p className="m-0 max-w-2xl text-text-muted">Manage the catalog, issue books, and process returns.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'catalog', label: 'Catalog' },
          { key: 'issue', label: 'Issue book' },
          { key: 'loans', label: `Loans (${activeLoans.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.key ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={addItem} className="glass rounded-[1.4rem] p-6">
            <h2 className="mt-0 text-xl">Add book</h2>
            <div className="grid gap-3">
              <label className={labelClass}>
                Title
                <input className="field" required value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} />
              </label>
              <label className={labelClass}>
                Author
                <input className="field" value={itemForm.author} onChange={(e) => setItemForm((f) => ({ ...f, author: e.target.value }))} />
              </label>
              <label className={labelClass}>
                ISBN
                <input className="field" value={itemForm.isbn} onChange={(e) => setItemForm((f) => ({ ...f, isbn: e.target.value }))} />
              </label>
              <label className={labelClass}>
                Copies
                <input className="field" type="number" min="1" value={itemForm.copiesTotal} onChange={(e) => setItemForm((f) => ({ ...f, copiesTotal: e.target.value }))} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
              {saving ? 'Saving…' : 'Add to catalog'}
            </button>
          </form>
          <div className="grid gap-3">
            {items.length === 0 ? (
              <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">Catalog is empty.</div>
            ) : (
              items.map((item) => (
                <article key={item.id} className="glass rounded-[1.4rem] p-5">
                  <h3 className="m-0">{item.title}</h3>
                  <p className="m-0 mt-1 text-sm text-text-muted">
                    {item.author || 'Unknown author'}
                    {item.isbn ? ` · ${item.isbn}` : ''}
                  </p>
                  <p className="m-0 mt-2 text-sm font-bold text-ink">
                    {item.copiesAvailable} of {item.copiesTotal} available
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'issue' && (
        <form onSubmit={issueLoan} className="glass max-w-xl rounded-[1.4rem] p-6">
          <h2 className="mt-0 text-xl">Issue book</h2>
          <div className="grid gap-3">
            <label className={labelClass}>
              Book
              <select className="field" required value={loanForm.itemId} onChange={(e) => setLoanForm((f) => ({ ...f, itemId: e.target.value }))}>
                <option value="">Choose book</option>
                {items
                  .filter((item) => item.active && item.copiesAvailable > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.copiesAvailable} available)
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Member
              <select className="field" required value={loanForm.personId} onChange={(e) => setLoanForm((f) => ({ ...f, personId: e.target.value }))}>
                <option value="">Choose member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.kind})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Due date
              <input className="field" type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm((f) => ({ ...f, dueAt: e.target.value }))} />
            </label>
            <label className={labelClass}>
              Notes
              <input className="field" value={loanForm.notes} onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
            {saving ? 'Saving…' : 'Issue book'}
          </button>
        </form>
      )}

      {tab === 'loans' && (
        <div className="grid gap-3">
          {loans.length === 0 ? (
            <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No loans recorded yet.</div>
          ) : (
            loans.map((loan) => (
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
      )}

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
