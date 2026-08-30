import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';

const emptyForm = { name: '', description: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const adminReq = { authScope: 'admin' };

export default function AdminUnits() {
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [scheme, setScheme] = useState({ label: 'Organisation', kind: 'education' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const [unitRes, schemeRes] = await Promise.all([
        api.get('/admin/units', adminReq),
        api.get('/admin/scheme', adminReq),
      ]);
      setUnits(Array.isArray(unitRes.data) ? unitRes.data : []);
      setScheme({ label: schemeRes.data?.label || 'Organisation', kind: schemeRes.data?.kind || 'education' });
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setError(err.response?.data?.message || 'Could not load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setPanel({ mode: 'create' });
  };

  const openEdit = (item) => {
    setForm({ name: item.name, description: item.description || '' });
    setPanel({ mode: 'edit', id: item.id });
  };

  const closePanel = () => {
    setPanel(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (panel?.mode === 'edit') {
        await api.put(`/admin/units/${panel.id}`, form, adminReq);
        setNotice('Department updated.');
      } else {
        await api.post('/admin/units', form, adminReq);
        setNotice('Department added.');
      }
      closePanel();
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setNotice(err.response?.data?.message || 'Could not save this department.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/units/${pendingDelete.id}`, adminReq);
      setNotice('Department removed.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setNotice(err.response?.data?.message || 'Could not remove this department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">{scheme.label}</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Departments</h1>
          <p className="m-0 max-w-xl text-text-muted">
            Campus units for administration, faculty, admissions, accounts, library, and examinations.
          </p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={openCreate}>
          New department
        </button>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading departments…</div>
      ) : units.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No departments yet</h3>
          <p className="mb-6 text-text-muted">Add the first unit for this organisation.</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add a department
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {units.map((item) => (
            <article key={item.id} className="glass rounded-[1.6rem] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  {!item.active && <span className="tag tag-nursing">Inactive</span>}
                  <h3 className="mt-2 mb-1">{item.name}</h3>
                  <p className="m-0 text-text-muted">{item.description || 'No notes yet.'}</p>
                  <p className="mt-2 mb-0 text-sm text-text-muted">
                    {item.peopleCount} {item.peopleCount === 1 ? 'person' : 'people'} on the roster
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => openEdit(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-crimson/25 bg-crimson-pale px-5 py-2.5 text-sm font-bold text-crimson"
                    onClick={() => setPendingDelete(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-white/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="flex-1" aria-label="Close" onClick={closePanel} />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white p-7 md:p-9"
            >
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit department' : 'New department'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update this unit' : 'Add a department'}</h2>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>
                  Name
                  <input name="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="field" />
                </label>
                <label className={labelClass}>
                  Notes
                  <textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="field" />
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save changes' : 'Create department'}
                  </button>
                  <button type="button" className="btn btn-outline flex-1" onClick={closePanel}>
                    Cancel
                  </button>
                </div>
              </form>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/65 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass glow-border w-full max-w-md rounded-[1.6rem] p-8">
              <h3>Remove this department?</h3>
              <p className="text-text-muted">“{pendingDelete.name}” will be removed. People stay on the roster, unassigned.</p>
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={confirmDelete}>
                  Delete
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingDelete(null)}>
                  Keep it
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
