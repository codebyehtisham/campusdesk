import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';

const emptyForm = { name: '', code: '', room: '', courseId: '', teacherId: '' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const adminReq = { authScope: 'admin' };

export default function AdminClasses() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const load = async () => {
    try {
      const res = await api.get('/admin/teaching', adminReq);
      setClasses(Array.isArray(res.data?.classes) ? res.data.classes : []);
      setTeachers(Array.isArray(res.data?.teachers) ? res.data.teachers : []);
      setProgrammes(Array.isArray(res.data?.programmes) ? res.data.programmes : []);
      setStudents(Array.isArray(res.data?.students) ? res.data.students : []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not load classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const teacherOptions = useMemo(() => teachers.filter((item) => !item.blocked), [teachers]);

  const openCreate = () => {
    setForm(emptyForm);
    setPanel({ mode: 'create' });
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      code: item.code || '',
      room: item.room || '',
      courseId: item.courseId || '',
      teacherId: item.teacherId || '',
    });
    setPanel({ mode: 'edit', id: item.id });
  };

  const openEnroll = (item) => {
    setSelected(item.studentIds || []);
    setPanel({ mode: 'enroll', id: item.id, name: item.name });
  };

  const closePanel = () => {
    setPanel(null);
    setForm(emptyForm);
    setSelected([]);
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        room: form.room.trim(),
        courseId: form.courseId || null,
        teacherId: form.teacherId || null,
      };
      if (panel?.mode === 'edit') {
        await api.put(`/admin/classes/${panel.id}`, payload, adminReq);
        setNotice('Class updated.');
      } else {
        await api.post('/admin/classes', payload, adminReq);
        setNotice('Class added to the timetable.');
      }
      closePanel();
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not save this class.');
    } finally {
      setSaving(false);
    }
  };

  const saveEnrollments = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/classes/${panel.id}/enrollments`, { personIds: selected }, adminReq);
      setNotice('Class list updated.');
      closePanel();
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not update the class list.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await api.delete(`/admin/classes/${pendingDelete.id}`, adminReq);
      setNotice('Class removed.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setNotice(err.response?.data?.message || 'Could not remove this class.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStudent = (id) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Teaching</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Classes</h1>
          <p className="m-0 max-w-xl text-text-muted">
            Create teaching classes, assign a faculty member, and enrol students from the attendance roster.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`${ADMIN_BASE}/timetable`} className="btn btn-outline">
            Timetable
          </Link>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New class
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading classes…</div>
      ) : classes.length === 0 ? (
        <div className="glass rounded-[1.6rem] p-10 text-center">
          <h3>No classes yet</h3>
          <p className="mb-6 text-text-muted">
            {teacherOptions.length === 0
              ? 'Add a Faculty member from Users, then create the first class.'
              : 'Create a class and assign it to a faculty member.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={teacherOptions.length === 0}>
            Add the first class
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {classes.map((item) => (
            <article key={item.id} className="glass rounded-[1.6rem] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {item.code && <span className="tag tag-allied w-fit">{item.code}</span>}
                    {!item.active && <span className="tag tag-nursing">Inactive</span>}
                  </div>
                  <h3 className="mt-3 mb-1">{item.name}</h3>
                  <p className="m-0 text-text-muted">
                    {item.teacher?.name || 'No faculty assigned'}
                    {item.course?.title ? ` · ${item.course.title}` : ''}
                    {item.room ? ` · ${item.room}` : ''}
                  </p>
                  <p className="mt-2 mb-0 text-sm text-text-muted">
                    {item.studentCount} student{item.studentCount === 1 ? '' : 's'} · {item.slotCount} timetable slot
                    {item.slotCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={() => openEnroll(item)}>
                    Students
                  </button>
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
        {panel && (panel.mode === 'create' || panel.mode === 'edit') && (
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
              <span className="eyebrow">{panel.mode === 'edit' ? 'Edit class' : 'New class'}</span>
              <h2 className="text-[1.8rem]">{panel.mode === 'edit' ? 'Update this class' : 'Add a teaching class'}</h2>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>
                  Class name
                  <input name="name" required value={form.name} onChange={handleChange} className="field" />
                </label>
                <label className={labelClass}>
                  Code
                  <input name="code" value={form.code} onChange={handleChange} className="field" placeholder="BSN-Y1" />
                </label>
                <label className={labelClass}>
                  Room
                  <input name="room" value={form.room} onChange={handleChange} className="field" />
                </label>
                <label className={labelClass}>
                  Programme
                  <select name="courseId" value={form.courseId} onChange={handleChange} className="field">
                    <option value="">Not linked</option>
                    {programmes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Faculty member
                  <select name="teacherId" value={form.teacherId} onChange={handleChange} className="field">
                    <option value="">Unassigned</option>
                    {teacherOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {teacherOptions.length === 0 && (
                    <span className="font-medium text-text-muted">Create a Faculty member user first.</span>
                  )}
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save changes' : 'Create class'}
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
        {panel?.mode === 'enroll' && (
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
              <span className="eyebrow">Class list</span>
              <h2 className="text-[1.8rem]">{panel.name}</h2>
              <p className="text-text-muted">Tick students from the attendance roster. {selected.length} selected.</p>
              <form onSubmit={saveEnrollments} className="mt-4 flex flex-col gap-3">
                {students.length === 0 ? (
                  <p className="m-0 text-sm text-text-muted">Add students on the student attendance page first.</p>
                ) : (
                  students.map((person) => (
                    <label key={person.id} className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(person.id)}
                        onChange={() => toggleStudent(person.id)}
                        className="mt-1"
                      />
                      <span>
                        <strong className="block text-sm text-ink">{person.name}</strong>
                        <small className="text-text-muted">{person.title || person.email}</small>
                      </span>
                    </label>
                  ))
                )}
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                    {saving ? 'Saving…' : 'Save class list'}
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
              <h3>Remove this class?</h3>
              <p className="text-text-muted">
                “{pendingDelete.name}” and its timetable slots will be removed. Attendance sessions for this class will also be deleted.
              </p>
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={confirmDelete}>
                  Delete class
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
