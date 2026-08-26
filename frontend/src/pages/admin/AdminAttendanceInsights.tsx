import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { ADMIN_BASE } from '../../admin/paths';
import { todayStamp } from '../../data/attendance';
import AttendanceTimeSeriesChart, { toCumulativeSeries } from '../../components/AttendanceTimeSeriesChart';
import AttendanceTrendLine from '../../components/AttendanceTrendLine';

const adminReq = { authScope: 'admin' as const };

const TABS = [
  { key: 'class-date', label: 'By class · date' },
  { key: 'student', label: 'Individual student' },
  { key: 'class-overall', label: 'Class overall' },
];

export default function AdminAttendanceInsights() {
  const [tab, setTab] = useState('class-date');
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [date, setDate] = useState(todayStamp());
  const [classDateData, setClassDateData] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [studentClassId, setStudentClassId] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [classId, setClassId] = useState('');
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/attendance/analytics/meta', adminReq)
      .then((res) => {
        const classes = Array.isArray(res.data?.classes) ? res.data.classes : [];
        const students = Array.isArray(res.data?.students) ? res.data.students : [];
        setMeta({ classes, students });
        setStudentId(students[0]?.id || '');
        setClassId(classes[0]?.id || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load filters.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== 'class-date') return;
    setLoading(true);
    api
      .get('/admin/attendance/analytics/by-class-date', { ...adminReq, params: { date } })
      .then((res) => {
        setClassDateData(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load class attendance.'))
      .finally(() => setLoading(false));
  }, [tab, date]);

  useEffect(() => {
    if (tab !== 'student' || !studentId) return;
    setLoading(true);
    api
      .get(`/admin/attendance/analytics/student/${studentId}`, {
        ...adminReq,
        params: studentClassId ? { classId: studentClassId } : {},
      })
      .then((res) => {
        setStudentData(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load student attendance.'))
      .finally(() => setLoading(false));
  }, [tab, studentId, studentClassId]);

  useEffect(() => {
    if (tab !== 'class-overall' || !classId) return;
    setLoading(true);
    api
      .get(`/admin/attendance/analytics/class/${classId}`, adminReq)
      .then((res) => {
        setClassData(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load class analytics.'))
      .finally(() => setLoading(false));
  }, [tab, classId]);

  const classDateChart = (classDateData?.classes || []).map((row) => ({
    date: row.classCode || row.className,
    value: row.percent,
    label: row.classCode,
    sublabel: row.teacherName,
  }));

  const studentChart = toCumulativeSeries(studentData?.history || []);

  const classTimelineChart = (classData?.timeline || []).map((row) => ({
    date: row.date,
    value: row.percent,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to={`${ADMIN_BASE}/attendance/students`} className="btn btn-outline py-2.5 text-sm">
          Back to roster
        </Link>
      </div>

      <span className="eyebrow">Student attendance</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Attendance insights</h1>
      <p className="mb-6 max-w-2xl text-text-muted">
        Graphs use the final attendance column — present and onsite when location is enabled.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === item.key ? 'bg-cardinal text-white' : 'border border-border bg-white text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      {tab === 'class-date' && (
        <section className="glass rounded-[1.6rem] p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="mt-0 mb-1 text-xl">Attendance by class</h2>
              <p className="m-0 text-sm text-text-muted">Final present % per class session on the selected date.</p>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-semibold text-ink">
              Date
              <input
                type="date"
                className="border-0 bg-transparent p-0 text-sm font-semibold text-ink outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          {loading ? (
            <p className="py-12 text-center text-text-muted">Loading chart…</p>
          ) : (
            <>
              <AttendanceTimeSeriesChart
                variant="bar"
                title={`Class attendance · ${date}`}
                subtitle="Final present % per class session on the selected date"
                data={classDateChart}
              />
              {classDateData?.classes?.length > 0 && (
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {classDateData.classes.map((row) => (
                    <div key={row.sessionId} className="rounded-2xl border border-border px-4 py-3 text-sm">
                      <strong className="text-ink">{row.className}</strong>
                      <p className="m-0 text-text-muted">
                        {row.teacherName} · {row.present}/{row.enrolled} present ·{' '}
                        <span className={row.percent > 75 ? 'font-bold text-emerald-700' : 'font-bold text-crimson'}>
                          {row.percent}%
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'student' && (
        <section className="glass rounded-[1.6rem] p-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Student
              <select className="field" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {meta.students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Class filter
              <select className="field" value={studentClassId} onChange={(e) => setStudentClassId(e.target.value)}>
                <option value="">All enrolled classes</option>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p className="py-12 text-center text-text-muted">Loading chart…</p>
          ) : studentData ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="m-0 text-xl">{studentData.student?.name}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    studentData.percent > 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-crimson-pale text-crimson-dark'
                  }`}
                >
                  Overall {studentData.percent}%
                </span>
              </div>
              <AttendanceTimeSeriesChart
                variant="line"
                title={`${studentData.student?.name} · attendance trend`}
                subtitle={
                  studentClassId
                    ? 'Running attendance % for the selected class'
                    : 'Running attendance % across all enrolled classes'
                }
                data={studentChart}
              />
              <div className="mt-6 flex flex-col gap-2">
                {(studentData.history || []).map((row) => (
                  <div key={`${row.date}-${row.classId}`} className="flex items-center justify-between rounded-2xl border border-border px-4 py-2 text-sm">
                    <span>
                      {row.date} · {row.className}
                    </span>
                    <span className={`font-bold ${row.finalPresent ? 'text-emerald-700' : 'text-crimson'}`}>
                      {row.finalPresent ? 'Present' : 'Absent'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}

      {tab === 'class-overall' && (
        <section className="glass rounded-[1.6rem] p-6">
          <div className="mb-6">
            <label className="flex max-w-md flex-col gap-1.5 text-sm font-semibold text-ink">
              Class
              <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p className="py-12 text-center text-text-muted">Loading chart…</p>
          ) : classData ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="m-0 text-xl">{classData.class?.name}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    classData.overallPercent > 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-crimson-pale text-crimson-dark'
                  }`}
                >
                  Class average {classData.overallPercent}%
                </span>
              </div>
              <h3 className="mb-2 text-base font-bold text-ink">Session attendance over time</h3>
              <AttendanceTimeSeriesChart
                variant="line"
                title={`${classData.class?.name} · session attendance`}
                subtitle="Class-wide final present % for each session"
                data={classTimelineChart}
              />
              <h3 className="mb-3 mt-8 text-base font-bold text-ink">Students in this class</h3>
              <div className="flex flex-col gap-3">
                {(classData.students || []).map((person) => (
                  <div key={person.id} className="grid gap-3 rounded-2xl border border-border px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                    <div>
                      <strong className="text-ink">{person.name}</strong>
                      <p className="m-0 text-sm text-text-muted">{person.title || person.email}</p>
                    </div>
                    <span className={`text-sm font-bold ${person.percent > 75 ? 'text-emerald-700' : 'text-crimson'}`}>
                      {person.percent}%
                    </span>
                    <AttendanceTrendLine history={person.history} percent={person.percent} />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
