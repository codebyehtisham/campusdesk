import { useMemo, useState } from 'react';
import { formatMoney } from './money';

type Point = { month?: string; label: string; paidCents?: number; outstandingCents?: number };

const W = 720;
const H = 248;
const PAD = { top: 18, right: 18, bottom: 34, left: 54 };

const axisMoney = (cents: number) => {
  const n = (Number(cents) || 0) / 100;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};

const linePath = (xs: number[], ys: number[]) =>
  xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');

const areaPath = (xs: number[], ys: number[], baseline: number) => {
  if (!xs.length) return '';
  return `${linePath(xs, ys)} L${xs[xs.length - 1].toFixed(1)} ${baseline} L${xs[0].toFixed(1)} ${baseline} Z`;
};

export function BarChart({ data = [] }: { data?: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const max = Math.max(1, ...data.map((item) => Math.max(item.paidCents || 0, item.outstandingCents || 0)));
    const step = max > 200000 ? 50000 : max > 50000 ? 10000 : 5000;
    const niceMax = Math.max(step, Math.ceil(max / step) * step);
    const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((niceMax * t) / step) * step))];
    const count = Math.max(data.length, 1);
    const xs = data.map((_, i) => PAD.left + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW));
    const y = (value: number) => PAD.top + innerH - (value / niceMax) * innerH;
    return {
      innerW,
      innerH,
      niceMax,
      ticks,
      xs,
      paidY: data.map((item) => y(item.paidCents || 0)),
      openY: data.map((item) => y(item.outstandingCents || 0)),
      baseline: PAD.top + innerH,
    };
  }, [data]);

  if (!data.length) {
    return <p className="m-0 py-10 text-center text-sm text-[var(--pc-muted)]">No payment history yet.</p>;
  }

  const nearest = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let dist = Infinity;
    chart.xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const active = hover != null ? data[hover] : null;

  return (
    <div className="pc-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="pc-line-chart"
        role="img"
        aria-label="Revenue by month"
        onMouseMove={(e) => nearest(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="pcPaidFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ee0a8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3ee0a8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {chart.ticks.map((tick) => {
          const y = PAD.top + chart.innerH - (tick / chart.niceMax) * chart.innerH;
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="pc-chart-grid" />
              <text x={PAD.left - 8} y={y + 4} className="pc-chart-axis" textAnchor="end">
                {axisMoney(tick)}
              </text>
            </g>
          );
        })}
        <path d={areaPath(chart.xs, chart.paidY, chart.baseline)} fill="url(#pcPaidFill)" />
        <path d={linePath(chart.xs, chart.paidY)} className="pc-chart-line is-paid" />
        <path d={linePath(chart.xs, chart.openY)} className="pc-chart-line is-open" />
        {hover != null && (
          <line x1={chart.xs[hover]} x2={chart.xs[hover]} y1={PAD.top} y2={chart.baseline} className="pc-chart-cross" />
        )}
        {data.map((item, i) => (
          <g key={item.month || item.label}>
            <circle cx={chart.xs[i]} cy={chart.paidY[i]} r={hover === i ? 5 : 3.2} className="pc-chart-dot is-paid" />
            <circle cx={chart.xs[i]} cy={chart.openY[i]} r={hover === i ? 5 : 3.2} className="pc-chart-dot is-open" />
            <text x={chart.xs[i]} y={H - 10} className="pc-chart-axis" textAnchor="middle">
              {item.label}
            </text>
          </g>
        ))}
      </svg>
      {active && (
        <div className="pc-chart-tip">
          <strong>{active.label}</strong>
          <span>Paid {formatMoney(active.paidCents)}</span>
          <span>Outstanding {formatMoney(active.outstandingCents)}</span>
        </div>
      )}
    </div>
  );
}
