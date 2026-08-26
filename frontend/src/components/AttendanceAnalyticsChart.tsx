import { useMemo } from 'react';

const W = 720;
const H = 280;
const PAD = { top: 20, right: 20, bottom: 48, left: 48 };

type Point = { label: string; value: number; sublabel?: string };

const barColor = (value: number) => (value > 75 ? '#059669' : '#dc2626');

export function AttendanceBarChart({ data = [], title = 'Attendance %' }: { data?: Point[]; title?: string }) {
  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const max = 100;
    const count = Math.max(data.length, 1);
    const gap = 12;
    const barW = Math.min(56, (innerW - gap * (count - 1)) / count);
    const totalW = count * barW + gap * (count - 1);
    const startX = PAD.left + (innerW - totalW) / 2;
    return data.map((item, i) => {
      const x = startX + i * (barW + gap);
      const h = (item.value / max) * innerH;
      const y = PAD.top + innerH - h;
      return { ...item, x, y, h, barW };
    });
  }, [data]);

  if (!data.length) {
    return <p className="m-0 py-12 text-center text-sm text-text-muted">No attendance data for this view yet.</p>;
  }

  return (
    <div className="attendance-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img" aria-label={title}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - tick / 100);
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-text-muted text-[10px]">
                {tick}%
              </text>
            </g>
          );
        })}
        <line
          x1={PAD.left}
          y1={PAD.top + (H - PAD.top - PAD.bottom) * 0.25}
          x2={W - PAD.right}
          y2={PAD.top + (H - PAD.top - PAD.bottom) * 0.25}
          stroke="#059669"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.35"
        />
        {chart.map((bar) => (
          <g key={bar.label}>
            <rect x={bar.x} y={bar.y} width={bar.barW} height={bar.h} rx="6" fill={barColor(bar.value)} opacity="0.9" />
            <text x={bar.x + bar.barW / 2} y={bar.y - 6} textAnchor="middle" className="fill-ink text-[11px] font-bold">
              {bar.value}%
            </text>
            <text x={bar.x + bar.barW / 2} y={H - 18} textAnchor="middle" className="fill-text-muted text-[10px]">
              {bar.label.length > 12 ? `${bar.label.slice(0, 11)}…` : bar.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AttendanceLineChart({ data = [], title = 'Attendance trend' }: { data?: Point[]; title?: string }) {
  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const count = Math.max(data.length, 1);
    const xs = data.map((_, i) => PAD.left + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW));
    const ys = data.map((item) => PAD.top + innerH - (item.value / 100) * innerH);
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
    const avg = data.length ? Math.round(data.reduce((sum, row) => sum + row.value, 0) / data.length) : 0;
    return { xs, ys, path, avg, innerH };
  }, [data]);

  if (!data.length) {
    return <p className="m-0 py-12 text-center text-sm text-text-muted">No attendance history yet.</p>;
  }

  const color = barColor(chart.avg);

  return (
    <div className="attendance-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img" aria-label={title}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = PAD.top + chart.innerH * (1 - tick / 100);
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-text-muted text-[10px]">
                {tick}%
              </text>
            </g>
          );
        })}
        <path d={chart.path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chart.xs.map((x, i) => (
          <g key={`${data[i].label}-${i}`}>
            <circle cx={x} cy={chart.ys[i]} r="5" fill={color} />
            <text x={x} y={H - 18} textAnchor="middle" className="fill-text-muted text-[10px]">
              {data[i].label.length > 10 ? `${data[i].label.slice(0, 9)}…` : data[i].label}
            </text>
          </g>
        ))}
      </svg>
      <p className={`mt-2 text-center text-sm font-bold ${chart.avg > 75 ? 'text-emerald-700' : 'text-crimson'}`}>
        Average {chart.avg}% · {chart.avg > 75 ? 'Above' : 'At or below'} 75% threshold
      </p>
    </div>
  );
}
