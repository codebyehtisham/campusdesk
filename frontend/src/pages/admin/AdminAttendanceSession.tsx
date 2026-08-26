import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import { ADMIN_BASE } from '../../admin/paths';
import AttendanceRecordRow, { AttendanceRecordHeader } from '../../components/AttendanceRecordRow';

const adminReq = { authScope: 'admin' as const };

export default function AdminAttendanceSession() {
  const { sessionId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    api
      .get(`/admin/attendance/sessions/${sessionId}`, adminReq)
      .then((res) => {
        setDetail(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load this session.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const locationEnabled = Boolean(detail?.attendanceLocationEnabled);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to={`${ADMIN_BASE}/attendance/students`} className="btn btn-outline py-2.5 text-sm">
          Back to attendance
        </Link>
      </div>

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading class roster…</div>
      ) : error ? (
        <p className="rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      ) : detail ? (
        <>
          <span className="eyebrow">Class attendance</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">{detail.className}</h1>
          <p className="mb-8 max-w-2xl text-text-muted">
            {detail.date} · Instructor: {detail.teacherName || '—'} · {detail.room || 'No room'} ·{' '}
            <span className="font-semibold text-ink">{detail.status}</span>
          </p>

          <section className="glass rounded-[1.6rem] p-6">
            <AttendanceRecordHeader locationEnabled={locationEnabled} />
            {detail.roster?.length ? (
              detail.roster.map((person) => (
                <AttendanceRecordRow key={person.id} person={person} locationEnabled={locationEnabled} />
              ))
            ) : (
              <p className="m-0 py-6 text-center text-text-muted">No students enrolled in this class.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
