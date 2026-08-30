import { useEffect, useState } from 'react';
import api from '../../api/client';
import { labelClass, staffReq, useLibraryKickOut } from './libraryShared';
import LibraryNotice, { useLibraryNotice } from './LibraryNotice';

export default function LibraryIssue() {
  const kickOut = useLibraryKickOut();
  const [notice, setNotice] = useLibraryNotice();
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loanForm, setLoanForm] = useState({ itemId: '', personId: '', dueAt: '', notes: '' });

  const load = async () => {
    const [itemsRes, membersRes] = await Promise.all([
      api.get('/staff/library/items', staffReq),
      api.get('/staff/library/members', staffReq),
    ]);
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
    setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
  };

  useEffect(() => {
    load()
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
      })
      .finally(() => setLoading(false));
  }, []);

  const issueLoan = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not issue book.');
    } finally {
      setSaving(false);
    }
  };

  const availableItems = items.filter((item: any) => item.active && item.copiesAvailable > 0);

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading issue workspace…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Library</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Issue book</h1>
        <p className="m-0 max-w-2xl text-text-muted">Lend a copy to a student or staff member.</p>
      </div>

      <form onSubmit={issueLoan} className="glass max-w-xl rounded-[1.4rem] p-6">
        <h2 className="mt-0 text-xl">New loan</h2>
        <div className="grid gap-3">
          <label className={labelClass}>
            Book
            <select className="field" required value={loanForm.itemId} onChange={(e) => setLoanForm((f) => ({ ...f, itemId: e.target.value }))}>
              <option value="">Choose book</option>
              {availableItems.map((item: any) => (
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
              {members.map((member: any) => (
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
        <button type="submit" className="btn btn-primary mt-4" disabled={saving || availableItems.length === 0}>
          {saving ? 'Saving…' : 'Issue book'}
        </button>
        {availableItems.length === 0 ? (
          <p className="m-0 mt-3 text-sm text-text-muted">No books are available to issue right now.</p>
        ) : null}
      </form>

      <LibraryNotice message={notice} />
    </div>
  );
}
