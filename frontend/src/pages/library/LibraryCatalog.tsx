import { useEffect, useState } from 'react';
import api from '../../api/client';
import { labelClass, staffReq, useLibraryKickOut } from './libraryShared';
import LibraryNotice, { useLibraryNotice } from './LibraryNotice';

export default function LibraryCatalog() {
  const kickOut = useLibraryKickOut();
  const [notice, setNotice] = useLibraryNotice();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemForm, setItemForm] = useState({ title: '', author: '', isbn: '', copiesTotal: '1' });

  const load = async () => {
    const itemsRes = await api.get('/staff/library/items', staffReq);
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
  };

  useEffect(() => {
    load()
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
      })
      .finally(() => setLoading(false));
  }, []);

  const addItem = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not add book.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading catalog…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Library</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Catalog</h1>
        <p className="m-0 max-w-2xl text-text-muted">Add books and browse what is in the collection.</p>
      </div>

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
            items.map((item: any) => (
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

      <LibraryNotice message={notice} />
    </div>
  );
}
