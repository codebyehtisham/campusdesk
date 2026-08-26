import AttendanceTrendLine from './AttendanceTrendLine';

const pill = (label, tone) => {
  const tones = {
    present: 'bg-emerald-100 text-emerald-800',
    absent: 'bg-crimson-pale text-crimson-dark',
    na: 'bg-slate-100 text-slate-600',
    onsite: 'bg-emerald-100 text-emerald-800',
    unknown: 'bg-amber-100 text-amber-900',
    true: 'bg-emerald-600 text-white',
    false: 'bg-crimson text-white',
  };
  return (
    <span className={`inline-flex min-w-[4.5rem] justify-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${tones[tone] || tones.na}`}>
      {label}
    </span>
  );
};

const qrLabel = { present: 'Present', absent: 'Absent', na: 'N/A' };
const locLabel = { onsite: 'Onsite', unknown: 'Unknown' };

export default function AttendanceRecordRow({ person, locationEnabled, showGraph = true }) {
  const qr = person.qrStatus || (person.status === 'present' ? 'present' : person.status ? 'absent' : 'na');
  const loc = person.locationStatus ?? (locationEnabled ? 'unknown' : null);
  const final = Boolean(person.finalPresent);
  const percent = person.attendancePercent ?? 0;

  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-0 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(5rem,auto))_minmax(9rem,1fr)] lg:items-center">
      <div>
        <strong className="block text-ink">{person.name}</strong>
        <small className="text-text-muted">{person.title || person.email}</small>
      </div>
      {pill(qrLabel[qr] || 'N/A', qr === 'present' ? 'present' : qr === 'absent' ? 'absent' : 'na')}
      {locationEnabled ? pill(locLabel[loc] || 'Unknown', loc === 'onsite' ? 'onsite' : 'unknown') : <span />}
      {pill(final ? 'True' : 'False', final ? 'true' : 'false')}
      {showGraph ? (
        <div className="flex items-center gap-2">
          <AttendanceTrendLine history={person.attendanceHistory} percent={percent} />
          <span className={`text-xs font-bold ${percent > 75 ? 'text-emerald-700' : 'text-crimson'}`}>{percent}%</span>
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceRecordHeader({ locationEnabled }) {
  return (
    <div className="hidden border-b border-border pb-2 text-[0.68rem] font-bold tracking-[0.12em] text-text-muted uppercase lg:grid lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(5rem,auto))_minmax(9rem,1fr)] lg:gap-3">
      <span>Student</span>
      <span className="text-center">QR</span>
      {locationEnabled ? <span className="text-center">Location</span> : <span />}
      <span className="text-center">Final</span>
      <span>Class trend</span>
    </div>
  );
}
