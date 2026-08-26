import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CAREER_TYPES } from '../../data/careers';
import api from '../../api/client';
import { signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { useNavigate } from 'react-router-dom';

const emptyForm = { title: '', type: 'Full-Time', desc: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const adminReq = { authScope: 'admin' };

export default function AdminCareers() {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState([]);
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

  const loadOpenings = async () => {
    try {
      const res = await api.get('/careers');
      setOpenings(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load openings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpenings();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const openCreate = () => {
    setForm(emptyForm);
    setPanel({ mode: 'create' });
  };

  const openEdit = (item) => {
    setForm({ title: item.title, type: item.type, desc: item.desc });
    setPanel({ mode: 'edit', id: item.id });
  };

  const closePanel = () => {
    setPanel(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.desc.trim()) return;
    setSaving(true);
    try {
      if (panel?.mode === 'edit') {
        await api.put(`/careers/${panel.id}`, form, adminReq);
        setNotice('Opening updated. The public careers page now shows this change.');
      } else {
        await api.post('/careers', form, adminReq);
        setNotice('Opening published on the public careers page.');
      }
      closePanel();
      await loadOpenings();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not save this opening.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/careers/${pendingDelete.id}`, adminReq);
      setNotice(`Removed “${pendingDelete.title}” from the careers page.`);
      setPendingDelete(null);
      await loadOpenings();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not delete this opening.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">HR</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Career openings</h1>
          <p className="m-0 max-w-xl text-text-muted">
            HR oversees the roles listed on the public careers page. Add, edit, or remove openings here.
          </p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={openCreate}>
          New opening
        </button>
      </div>

      <p className="mb-5 text-sm font-semibold text-text-muted">
        {loading ? 'Loading…' : `${openings.length} ${openings.length === 1 ? 'role' : 'roles'} live`}
      </p>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading openings…</div>
      ) : openings.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No openings yet</h3>
          <p className="mb-6 text-text-muted">The public careers page will show an empty list until HR publishes a role.</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add the first role
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {openings.map((item, i) => (
            <article
              key={item.id}
              className={`glass rounded-[1.6rem] p-6 ${i % 2 === 0 ? 'glow-border' : ''}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <span className="tag tag-nursing w-fit">{item.type}</span>
                  <h3 className="mt-3 mb-2">{item.title}</h3>
                  <p className="m-0 text-text-muted">{item.desc}</p>
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
            exit={{ opacity: 0, y: 12 }}
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
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white p-7 shadow-[-24px_0_60px_rgba(13,42,128,0.08)] md:p-9"
            >
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit role' : 'New role'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update opening' : 'Add an opening'}</h2>
              <p className="mb-6 text-text-muted">
                Title, type, and description match the cards on the public careers page.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className={labelClass}>
                  Job title
                  <input
                    type="text"
                    name="title"
                    required
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Nursing Faculty"
                    className="field"
                  />
                </label>
                <label className={labelClass}>
                  Type
                  <select name="type" value={form.type} onChange={handleChange} className="field">
                    {CAREER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Description
                  <textarea
                    name="desc"
                    required
                    rows="5"
                    value={form.desc}
                    onChange={handleChange}
                    placeholder="Teach theory and clinical courses…"
                    className="field resize-y"
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save changes' : 'Publish opening'}
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
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="glass glow-border w-full max-w-md rounded-[1.6rem] p-8"
            >
              <h3>Remove this role?</h3>
              <p className="text-text-muted">
                “{pendingDelete.title}” will disappear from the public careers page. You can add it again later.
              </p>
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={confirmDelete}>
                  {saving ? 'Deleting…' : 'Delete opening'}
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setPendingDelete(null)}>
                  Keep it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
