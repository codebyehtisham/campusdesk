import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ChartPoint = {
  date: string;
  value: number;
  label?: string;
  sublabel?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  data?: ChartPoint[];
  variant?: 'line' | 'bar';
  yMax?: number;
  emptyMessage?: string;
};

const W = 920;
const MAIN_H = 300;
const NAV_H = 72;
const PAD = { top: 28, right: 28, bottom: 44, left: 54 };
const NAV_PAD = { top: 10, bottom: 22, left: 54, right: 28 };

const lineColor = (avg: number) => (avg > 75 ? '#e8622a' : '#dc2626');
const areaColor = (avg: number) => (avg > 75 ? 'rgba(232, 98, 42, 0.18)' : 'rgba(220, 38, 38, 0.14)');

const formatDate = (raw: string) => {
  if (!raw) return '';
  const parts = raw.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2].slice(0, 2)}`;
  return raw.length > 8 ? raw.slice(0, 8) : raw;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function useChartGeometry(data: ChartPoint[], range: [number, number], yMax: number) {
  return useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = MAIN_H - PAD.top - PAD.bottom;
    const navInnerW = W - NAV_PAD.left - NAV_PAD.right;
    const navInnerH = NAV_H - NAV_PAD.top - NAV_PAD.bottom;
    const [start, end] = range;
    const visible = data.slice(start, end + 1);
    const count = Math.max(visible.length, 1);
    const allCount = Math.max(data.length, 1);

    const xAt = (index: number, total: number, width: number, left: number) =>
      total === 1 ? left + width / 2 : left + (index / (total - 1)) * width;

    const yAt = (value: number, height: number, top: number) => top + height - (value / yMax) * height;

    const mainPoints = visible.map((row, i) => ({
      ...row,
      x: xAt(i, count, innerW, PAD.left),
      y: yAt(row.value, innerH, PAD.top),
    }));

    const navPoints = data.map((row, i) => ({
      x: xAt(i, allCount, navInnerW, NAV_PAD.left),
      y: yAt(row.value, navInnerH, NAV_PAD.top),
    }));

    const mainPath = mainPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const mainArea =
      mainPoints.length > 0
        ? `${mainPath} L${mainPoints[mainPoints.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L${mainPoints[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`
        : '';
    const navPath = navPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const selLeft = data.length ? xAt(start, allCount, navInnerW, NAV_PAD.left) : NAV_PAD.left;
    const selRight = data.length ? xAt(end, allCount, navInnerW, NAV_PAD.left) : NAV_PAD.left + navInnerW;

    return { innerW, innerH, navInnerH, visible, mainPoints, navPoints, mainPath, mainArea, navPath, selLeft, selRight, baseline: PAD.top + innerH, navBaseline: NAV_PAD.top + navInnerH };
  }, [data, range, yMax]);
}

export default function AttendanceTimeSeriesChart({
  title,
  subtitle,
  data = [],
  variant = 'line',
  yMax = 100,
  emptyMessage = 'No attendance data for this view yet.',
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [drag, setDrag] = useState<'left' | 'right' | 'pan' | null>(null);
  const dragRef = useRef({ startX: 0, startRange: [0, 0] as [number, number] });

  useEffect(() => {
    if (!data.length) {
      setRange([0, 0]);
      return;
    }
    const end = data.length - 1;
    const window = Math.min(end, Math.max(4, Math.floor(data.length * 0.6)));
    setRange([Math.max(0, end - window), end]);
  }, [data]);

  const avg = data.length ? Math.round(data.reduce((s, r) => s + r.value, 0) / data.length) : 0;
  const color = lineColor(avg);
  const geo = useChartGeometry(data, range, yMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const indexFromX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || !data.length) return 0;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * W;
      const navInnerW = W - NAV_PAD.left - NAV_PAD.right;
      const ratio = clamp((x - NAV_PAD.left) / navInnerW, 0, 1);
      return clamp(Math.round(ratio * (data.length - 1)), 0, data.length - 1);
    },
    [data.length]
  );

  const onPointerDown = (kind: 'left' | 'right' | 'pan', e: { preventDefault: () => void; clientX: number; pointerId: number; target: EventTarget | null }) => {
    e.preventDefault();
    setDrag(kind);
    dragRef.current = { startX: e.clientX, startRange: [...range] };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: { clientX: number }) => {
    if (!drag || !data.length) return;
    const idx = indexFromX(e.clientX);
    const [start, end] = dragRef.current.startRange;
    if (drag === 'left') setRange([clamp(idx, 0, end - 1), end]);
    if (drag === 'right') setRange([start, clamp(idx, start + 1, data.length - 1)]);
    if (drag === 'pan') {
      const delta = indexFromX(e.clientX) - indexFromX(dragRef.current.startX);
      const width = end - start;
      let nextStart = clamp(start + delta, 0, data.length - 1 - width);
      setRange([nextStart, nextStart + width]);
    }
  };

  const onPointerUp = () => setDrag(null);

  if (!data.length) {
    return <p className="m-0 py-14 text-center text-sm text-text-muted">{emptyMessage}</p>;
  }

  const totalH = variant === 'bar' || data.length <= 6 ? MAIN_H : MAIN_H + NAV_H + 8;
  const showNavigator = variant === 'line' && data.length > 6;

  return (
    <div className="attendance-ts-chart rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 px-1">
        <h3 className="m-0 text-lg font-bold text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 mb-0 text-sm text-text-muted">{subtitle}</p> : null}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${totalH}`}
        className="w-full select-none"
        role="img"
        aria-label={title}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Main grid */}
        {ticks.map((tick) => {
          const y = PAD.top + geo.innerH * (1 - tick / yMax);
          return (
            <g key={`main-tick-${tick}`}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e8e8" strokeWidth="1" />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="fill-[#666] text-[11px]">
                {tick}%
              </text>
            </g>
          );
        })}
        {/* 75% threshold */}
        <line
          x1={PAD.left}
          y1={PAD.top + geo.innerH * 0.25}
          x2={W - PAD.right}
          y2={PAD.top + geo.innerH * 0.25}
          stroke="#059669"
          strokeWidth="1"
          strokeDasharray="5 4"
          opacity="0.45"
        />

        {variant === 'line' ? (
          <>
            <path d={geo.mainArea} fill={areaColor(avg)} />
            <path d={geo.mainPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {geo.mainPoints.map((p) => (
              <circle key={`${p.date}-${p.x}`} cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke={color} strokeWidth="2" />
            ))}
          </>
        ) : (
          geo.mainPoints.map((p, i) => {
            const barW = Math.min(48, (geo.innerW / Math.max(geo.mainPoints.length, 1)) * 0.65);
            return (
              <g key={`bar-${p.label || i}`}>
                <rect
                  x={p.x - barW / 2}
                  y={p.y}
                  width={barW}
                  height={geo.baseline - p.y}
                  rx="4"
                  fill={lineColor(p.value)}
                  opacity="0.92"
                />
                <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-ink text-[11px] font-bold">
                  {p.value}%
                </text>
              </g>
            );
          })
        )}

        {geo.mainPoints.map((p, i) => (
          <text
            key={`x-${p.date}-${i}`}
            x={p.x}
            y={MAIN_H - 14}
            textAnchor="middle"
            className="fill-[#666] text-[10px]"
          >
            {formatDate(p.date) || p.label}
          </text>
        ))}

        {/* Navigator */}
        {showNavigator ? (
          <>
            <rect x={0} y={MAIN_H + 4} width={W} height={NAV_H} fill="#fafafa" />
            <line x1={NAV_PAD.left} y1={geo.navBaseline} x2={W - NAV_PAD.right} y2={geo.navBaseline} stroke="#ddd" />
            <path d={geo.navPath} fill="none" stroke="#b8b8b8" strokeWidth="1.5" />
            <rect
              x={geo.selLeft}
              y={NAV_PAD.top}
              width={Math.max(8, geo.selRight - geo.selLeft)}
              height={geo.navInnerH}
              fill="rgba(232,98,42,0.12)"
              stroke={color}
              strokeWidth="1"
            />
            <rect
              x={geo.selLeft - 5}
              y={NAV_PAD.top}
              width="10"
              height={geo.navInnerH}
              fill="#888"
              rx="2"
              className="cursor-ew-resize"
              onPointerDown={(e) => onPointerDown('left', e)}
            />
            <rect
              x={geo.selRight - 5}
              y={NAV_PAD.top}
              width="10"
              height={geo.navInnerH}
              fill="#888"
              rx="2"
              className="cursor-ew-resize"
              onPointerDown={(e) => onPointerDown('right', e)}
            />
            <rect
              x={geo.selLeft + 5}
              y={NAV_PAD.top}
              width={Math.max(0, geo.selRight - geo.selLeft - 10)}
              height={geo.navInnerH}
              fill="transparent"
              className="cursor-grab"
              onPointerDown={(e) => onPointerDown('pan', e)}
            />
          </>
        ) : null}
      </svg>

      <p className={`mt-2 text-center text-sm font-semibold ${avg > 75 ? 'text-emerald-700' : 'text-crimson'}`}>
        Average {avg}%{showNavigator ? ' · drag the range below to zoom the timeline' : ''}
      </p>
    </div>
  );
}

/** Running attendance % for binary present/absent sessions */
export function toCumulativeSeries(history: { date: string; finalPresent: boolean }[]): ChartPoint[] {
  let hits = 0;
  return history.map((row, i) => {
    if (row.finalPresent) hits += 1;
    return { date: row.date, value: Math.round((hits / (i + 1)) * 100) };
  });
}
