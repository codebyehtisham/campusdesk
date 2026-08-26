import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { FACULTY_BASE } from '../../admin/paths';
import { isTeacher, staffHome } from '../../data/roles';

const emptyForm = { title: '', body: '', week: '1' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const staffReq = { authScope: 'staff' };

export default function FacultyCourses() {
  const navigate = useNavigate();
  const staff = getStaff();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutStaff();
    navigate(FACULTY_BASE, { replace: true });
  };

  const load = async (keepId = classId) => {
    try {
      const res = await api.get('/staff/teaching', staffReq);
      const next = Array.isArray(res.data?.classes) ? res.data.classes : [];
      setClasses(next);
      if (!keepId || !next.some((item) => item.id === keepId)) {
        setClassId(next[0]?.id || '');
      }
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load course content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTeacher(staff?.role)) {
      setLoading(false);
      return;
    }
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const current = useMemo(() => classes.find((item) => item.id === classId), [classes, classId]);
  const contents = current?.contents || [];

  const openCreate = () => {
    setForm(emptyForm);
    setPanel({ mode: 'create' });
  };

  const openEdit = (item) => {
    setForm({ title: item.title, body: item.body || '', week: String(item.week || 0) });
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
    if (!form.title.trim() || !classId) return;
    setSaving(true);
    try {
      const payload = { title: form.title.trim(), body: form.body.trim(), week: Number(form.week) || 0 };
      if (panel?.mode === 'edit') {
        await api.put(`/staff/content/${panel.id}`, payload, staffReq);
        setNotice('Course content updated.');
      } else {
        await api.post(`/staff/classes/${classId}/content`, payload, staffReq);
        setNotice('Course content added.');
      }
      closePanel();
      await load(classId);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not save this content.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/staff/content/${pendingDelete.id}`, staffReq);
      setNotice('Content removed.');
      setPendingDelete(null);
      await load(classId);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not remove this content.');
    } finally {
      setSaving(false);
    }
  };

  if (!isTeacher(staff?.role)) {
    return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Teaching</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Course content</h1>
          <p className="m-0 max-w-xl text-text-muted">Week-by-week materials for the classes you teach.</p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={openCreate} disabled={!current}>
          Add content
        </button>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading courses…</div>
      ) : classes.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No classes assigned</h3>
          <p className="m-0 text-text-muted">Ask an organisation admin to assign you a class.</p>
        </div>
      ) : (
        <>
          <label className={`${labelClass} mb-6 max-w-md`}>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="field">
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {contents.length === 0 ? (
            <div className="glass rounded-[1.6rem] p-10 text-center">
              <h3>No content yet</h3>
              <p className="mb-6 text-text-muted">Add the first week of material for this class.</p>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                Add content
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {contents.map((item) => (
                <article key={item.id} className="glass rounded-[1.6rem] p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      {item.week > 0 && <span className="tag tag-allied w-fit">Week {item.week}</span>}
                      <h3 className="mt-3 mb-1">{item.title}</h3>
                      <p className="m-0 whitespace-pre-wrap text-text-muted">{item.body || 'No notes yet.'}</p>
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
        </>
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
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit content' : 'New content'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update this week' : 'Add course material'}</h2>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>
                  Week
                  <input name="week" type="number" min="0" value={form.week} onChange={handleChange} className="field" />
                </label>
                <label className={labelClass}>
                  Title
                  <input name="title" required value={form.title} onChange={handleChange} className="field" />
                </label>
                <label className={labelClass}>
                  Notes
                  <textarea name="body" rows={6} value={form.body} onChange={handleChange} className="field" />
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save changes' : 'Add content'}
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
              <h3>Remove this content?</h3>
              <p className="text-text-muted">“{pendingDelete.title}” will be removed from this class.</p>
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
