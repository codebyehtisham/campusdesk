import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutStaff } from '../../auth/staffSession';
import { EXAMS_PORTAL_BASE } from '../../admin/paths';

const staffReq = { authScope: 'staff' };
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function ExamsHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('exams');
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', classId: '', maxMarks: '100', examDate: '' });

  const kickOut = () => {
    signOutStaff();
    navigate(EXAMS_PORTAL_BASE, { replace: true });
  };

  const loadExams = async () => {
    const [examsRes, classesRes] = await Promise.all([
      api.get('/staff/exams', staffReq),
      api.get('/staff/exams/classes', staffReq),
    ]);
    setExams(Array.isArray(examsRes.data) ? examsRes.data : []);
    setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
  };

  const loadMarks = async (examId) => {
    const res = await api.get(`/staff/exams/${examId}/marks`, staffReq);
    setSelectedExam(res.data?.exam || null);
    setMarks(Array.isArray(res.data?.rows) ? res.data.rows : []);
  };

  useEffect(() => {
    loadExams()
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

  const createExam = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/staff/exams',
        {
          title: form.title,
          classId: form.classId || undefined,
          maxMarks: Number(form.maxMarks) || 100,
          examDate: form.examDate || undefined,
        },
        staffReq
      );
      setForm({ title: '', classId: '', maxMarks: '100', examDate: '' });
      setNotice('Exam created.');
      await loadExams();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not create exam.');
    } finally {
      setSaving(false);
    }
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);
    try {
      await api.put(
        `/staff/exams/${selectedExam.id}/marks`,
        { marks: marks.map((row) => ({ personId: row.personId, marksObtained: row.marksObtained, notes: row.notes })) },
        staffReq
      );
      setNotice('Marks saved.');
      await loadMarks(selectedExam.id);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save marks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading exams workspace…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <span className="eyebrow">Examinations</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Exams & results</h1>
        <p className="m-0 max-w-2xl text-text-muted">Schedule exams and enter marks for enrolled students.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'exams', label: 'Exam schedule' },
          { key: 'marks', label: 'Mark entry' },
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

      {tab === 'exams' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createExam} className="glass rounded-[1.4rem] p-6">
            <h2 className="mt-0 text-xl">New exam</h2>
            <div className="grid gap-3">
              <label className={labelClass}>
                Title
                <input className="field" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </label>
              <label className={labelClass}>
                Class (optional)
                <select className="field" value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}>
                  <option value="">All students</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Max marks
                <input className="field" type="number" min="1" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))} />
              </label>
              <label className={labelClass}>
                Exam date
                <input className="field" type="date" value={form.examDate} onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
              {saving ? 'Saving…' : 'Create exam'}
            </button>
          </form>
          <div className="grid gap-3">
            {exams.length === 0 ? (
              <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No exams scheduled yet.</div>
            ) : (
              exams.map((exam) => (
                <article key={exam.id} className="glass rounded-[1.4rem] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="m-0">{exam.title}</h3>
                      <p className="m-0 text-sm text-text-muted">
                        {exam.class?.name || 'All students'} · Max {exam.maxMarks}
                        {exam.examDate ? ` · ${exam.examDate.slice(0, 10)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline py-2 text-sm"
                      onClick={() => {
                        setTab('marks');
                        loadMarks(exam.id).catch(() => setNotice('Could not load marks.'));
                      }}
                    >
                      Enter marks
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'marks' && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              Exam
              <select
                className="field min-w-[240px]"
                value={selectedExam?.id || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setSelectedExam(null);
                    setMarks([]);
                    return;
                  }
                  loadMarks(id).catch(() => setNotice('Could not load marks.'));
                }}
              >
                <option value="">Choose exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </label>
            {selectedExam && (
              <button type="button" className="btn btn-primary" onClick={saveMarks} disabled={saving}>
                {saving ? 'Saving…' : 'Save marks'}
              </button>
            )}
          </div>
          {!selectedExam ? (
            <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">Select an exam to enter marks.</div>
          ) : marks.length === 0 ? (
            <div className="glass rounded-[1.4rem] p-8 text-center text-text-muted">No students on the roster for this exam.</div>
          ) : (
            <div className="grid gap-3">
              {marks.map((row) => (
                <article key={row.personId} className="glass rounded-[1.4rem] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="m-0">{row.name}</h3>
                      <p className="m-0 text-sm text-text-muted">{row.title || 'Student'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="field w-28"
                        type="number"
                        min="0"
                        max={selectedExam.maxMarks}
                        placeholder="Marks"
                        value={row.marksObtained ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value);
                          setMarks((rows) => rows.map((item) => (item.personId === row.personId ? { ...item, marksObtained: value } : item)));
                        }}
                      />
                      <span className="text-sm font-bold text-cardinal">{row.grade || '—'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
