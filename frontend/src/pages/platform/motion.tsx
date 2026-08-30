import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export const ease = [0.22, 1, 0.36, 1] as const;
export const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const NODES = [
  { x: 18, y: 22, delay: 0 },
  { x: 72, y: 18, delay: 0.4 },
  { x: 48, y: 55, delay: 0.8 },
  { x: 82, y: 68, delay: 1.1 },
  { x: 28, y: 78, delay: 0.6 },
];

export function PlatformBackdrop() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pc-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="pc-orb pc-orb-a" />
      <div className="pc-orb pc-orb-b" />
      <div className="pc-orb pc-orb-c" />
      <div className="pc-grid-drift" />
    </div>
  );
}

export function PxBackdrop() {
  return <PlatformBackdrop />;
}

export function PlatformLoginBackdrop() {
  const reduce = useReducedMotion();
  if (reduce) return <div className="platform-login-mesh" aria-hidden="true" />;

  return (
    <div className="platform-login-mesh" aria-hidden="true">
      <div className="platform-login-grid" />
      {NODES.map((node) => (
        <motion.span
          key={`${node.x}-${node.y}`}
          className="platform-login-node"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + node.delay, duration: 0.6, ease }}
        />
      ))}
      <motion.div
        className="platform-login-scan"
        initial={{ y: '-100%' }}
        animate={{ y: '200%' }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
      />
    </div>
  );
}

export function RevealLines({
  lines,
  className = '',
}: {
  lines: { text: string; accent?: boolean }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className}>
        {lines.map((line) => (
          <span key={line.text} className={line.accent ? 'text-white/95' : ''}>
            {line.text}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {lines.map((line, i) => (
        <motion.span
          key={line.text}
          className={`block ${line.accent ? 'text-cardinal' : ''}`}
          initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.65, ease: easeOut }}
        >
          {line.text}
        </motion.span>
      ))}
    </div>
  );
}

export function PageEnter({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
      transition={{ duration: 0.42, ease }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={fadeUp}
      transition={{ duration: 0.5, ease }}
      whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.22 } }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  format = (n) => String(n),
  className = '',
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const prev = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return undefined;

    const start = performance.now();
    const duration = 700;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return <span className={className}>{format(display)}</span>;
}

export function PingBar({ ms, up }: { ms?: number | null; up: boolean }) {
  const pct = !up || ms == null ? 8 : Math.max(8, Math.min(100, 100 - Math.log10(ms + 1) * 28));
  const tone = !up ? 'warn' : ms != null && ms <= 50 ? 'live' : ms != null && ms <= 200 ? 'mid' : 'warn';

  return (
    <div className="pc-ping-bar" aria-hidden="true">
      <motion.div
        className={`pc-ping-bar-fill is-${tone}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease }}
      />
    </div>
  );
}

export function QuickAction({
  to,
  label,
  hint,
  icon,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.45, ease }}
      whileHover={reduce ? undefined : { y: -3, transition: { duration: 0.2 } }}
    >
      <Link to={to} className="pc-quick-action">
        <span className="pc-quick-action-icon">{icon}</span>
        <span className="pc-quick-action-copy">
          <strong>{label}</strong>
          <small>{hint}</small>
        </span>
        <span className="pc-quick-action-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </motion.div>
  );
}

export function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className={className} dateTime={now.toISOString()}>
      {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </time>
  );
}

export function ShimmerLine({ className = '' }: { className?: string }) {
  return <div className={`pc-shimmer ${className}`} aria-hidden="true" />;
}

export { AnimatePresence, motion };
