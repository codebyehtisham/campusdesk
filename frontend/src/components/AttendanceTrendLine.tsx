const W = 180;
const H = 44;
const PAD = 6;

export default function AttendanceTrendLine({ history = [], percent = 0 }) {
  const points = Array.isArray(history) ? history : [];
  const color = percent > 75 ? '#e8622a' : '#dc2626';

  if (!points.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-44" aria-hidden>
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#e5e7eb" strokeWidth="2" />
      </svg>
    );
  }

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  let hits = 0;
  const values = points.map((row, i) => {
    if (row.finalPresent) hits += 1;
    return (hits / (i + 1)) * 100;
  });
  const xs = values.map((_, i) => PAD + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW));
  const ys = values.map((v) => PAD + innerH - (v / 100) * innerH);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length - 1].toFixed(1)} ${(PAD + innerH).toFixed(1)} L${xs[0].toFixed(1)} ${(PAD + innerH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-44" role="img" aria-label={`Attendance trend ${percent}%`}>
      <path d={area} fill={percent > 75 ? 'rgba(232,98,42,0.15)' : 'rgba(220,38,38,0.12)'} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
