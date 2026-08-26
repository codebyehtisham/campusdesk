const W = 160;
const H = 36;
const PAD = 4;

export default function AttendanceTrendLine({ history = [], percent = 0 }) {
  const points = Array.isArray(history) ? history : [];
  const color = percent > 75 ? '#059669' : '#dc2626';

  if (!points.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-40" aria-hidden>
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#e5e7eb" strokeWidth="2" />
      </svg>
    );
  }

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const xs = points.map((_, i) => PAD + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW));
  const ys = points.map((row) => PAD + innerH - (row.finalPresent ? innerH : 0));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-40" role="img" aria-label={`Attendance trend ${percent}%`}>
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={`${points[i].date}-${i}`} cx={x} cy={ys[i]} r="2.5" fill={color} />
      ))}
    </svg>
  );
}
