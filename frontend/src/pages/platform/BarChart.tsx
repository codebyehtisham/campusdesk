import { useMemo, useState } from 'react';
import { formatMoney } from './money';

type Point = { month?: string; label: string; paidCents?: number; outstandingCents?: number };

const W = 720;
const H = 260;
const PAD = { top: 22, right: 22, bottom: 40, left: 52 };

const linePath = (xs: number[], ys: number[]) =>
  xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');

const niceMax = (values: number[]) => {
  const max = Math.max(1, ...values);
  const step = max > 200000 ? 50000 : max > 50000 ? 10000 : max > 10000 ? 5000 : max > 1000 ? 500 : 100;
  return Math.max(step, Math.ceil(max / step) * step);
};

const axisMoney = (cents: number) => {
  const n = (Number(cents) || 0) / 100;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
};

/** Super-admin chart: dark canvas, blue line, square markers */
export function BarChart({ data = [] }: { data?: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const maxVal = niceMax(data.map((item) => Math.max(item.paidCents || 0, item.outstandingCents || 0)));
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));
    const count = Math.max(data.length, 1);
    const xs = data.map((_, i) => PAD.left + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW));
    const y = (value: number) => PAD.top + innerH - (value / maxVal) * innerH;
    return {
      innerH,
      maxVal,
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
  const marker = 5;

  return (
    <div className="pc-chart-wrap pc-chart-dark">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="pc-line-chart"
        role="img"
        aria-label="Revenue by month"
        onMouseMove={(e) => nearest(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={0} y={0} width={W} height={H} fill="#050505" rx="8" />

        {chart.ticks.map((tick) => {
          const y = PAD.top + chart.innerH - (tick / chart.maxVal) * chart.innerH;
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              <text x={PAD.left - 10} y={y + 4} fill="#ffffff" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="end">
                {axisMoney(tick)}
              </text>
            </g>
          );
        })}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={chart.baseline} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <line x1={PAD.left} y1={chart.baseline} x2={W - PAD.right} y2={chart.baseline} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />

        {/* Outstanding — secondary dashed line */}
        <path
          d={linePath(chart.xs, chart.openY)}
          fill="none"
          stroke="rgba(109,147,255,0.55)"
          strokeWidth="2"
          strokeDasharray="6 5"
          strokeLinecap="round"
        />

        {/* Paid — primary blue line */}
        <path
          d={linePath(chart.xs, chart.paidY)}
          fill="none"
          stroke="#4a9eff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hover != null && (
          <line
            x1={chart.xs[hover]}
            x2={chart.xs[hover]}
            y1={PAD.top}
            y2={chart.baseline}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {data.map((item, i) => (
          <g key={item.month || item.label}>
            <rect
              x={chart.xs[i] - marker / 2}
              y={chart.paidY[i] - marker / 2}
              width={marker}
              height={marker}
              fill="#4a9eff"
              stroke="#ffffff"
              strokeWidth={hover === i ? 1.5 : 0}
            />
            <text x={chart.xs[i]} y={H - 12} fill="#ffffff" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle">
              {i + 1}
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

      <p className="pc-chart-footnote m-0 mt-2 text-center text-[0.68rem] text-[var(--pc-muted)]">
        X-axis: month index · hover for values · blue = paid
      </p>
    </div>
  );
}
