import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber, ease } from './motion';

export function Pulse({ on = true, tone = 'live' }: { on?: boolean; tone?: 'live' | 'warn' }) {
  const cls = !on ? 'pc-pulse-off' : tone === 'warn' ? 'pc-pulse-warn' : 'pc-pulse-live';
  return <span className={`pc-pulse ${cls}`} aria-hidden="true" />;
}

export function GateSwitch({
  on,
  disabled,
  busy,
  compact,
  onChange,
  liveLabel = 'Live',
  offLabel = 'Off',
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  onChange: (next: boolean) => void;
  liveLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={() => onChange(!on)}
      className={`pc-switch ${on ? 'is-on' : ''} ${compact ? 'is-compact' : ''}`}
    >
      <span className="pc-switch-track">
        <span className="pc-switch-knob" />
      </span>
      <span className="pc-switch-copy">{on ? liveLabel : offLabel}</span>
    </button>
  );
}

export function PageHead({
  kicker,
  title,
  hint,
  actions,
}: {
  kicker?: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="pc-head"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
    >
      <div>
        {kicker ? (
          <motion.p className="pc-kicker" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
            {kicker}
          </motion.p>
        ) : null}
        <h1 className="pc-title-gradient">{title}</h1>
        {hint ? <p className="pc-hint">{hint}</p> : null}
      </div>
      {actions ? <div className="pc-head-actions">{actions}</div> : null}
    </motion.div>
  );
}

export function Banner({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <motion.p
      className="pc-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.p>
  );
}

export function Toast({ children }: { children?: ReactNode }) {
  return (
    <AnimatePresence>
      {children ? (
        <motion.p
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="pc-toast"
        >
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function Drawer({
  open,
  onClose,
  kicker,
  title,
  children,
  widthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  kicker?: string;
  title?: string;
  children: ReactNode;
  widthClass?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
          <motion.aside
            initial={reduce ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={`pc-drawer ${widthClass}`}
          >
            {kicker ? <p className="pc-kicker">{kicker}</p> : null}
            {title ? <h3 className="pc-drawer-title">{title}</h3> : null}
            {children}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  animateValue,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'live' | 'warn';
  animateValue?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`pc-stat ${tone === 'warn' ? 'is-warn' : tone === 'live' ? 'is-live' : ''}`}
      initial={false}
      whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.18 } }}
    >
      <p>{label}</p>
      <p className="pc-stat-value">
        {animateValue != null ? <AnimatedNumber value={animateValue} format={(n) => String(Math.round(n))} /> : value}
      </p>
      {hint ? <p className="mt-2 mb-0 text-sm">{hint}</p> : null}
    </motion.div>
  );
}

export function Panel({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className={`pc-panel pc-glow-panel ${className}`}
      initial={false}
      whileHover={reduce ? undefined : { borderColor: 'rgba(45, 212, 191, 0.28)' }}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          {title ? <h2 className="m-0">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}
