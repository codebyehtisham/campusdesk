import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
  return (
    <div className="pc-head">
      <div>
        {kicker ? <p className="pc-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {hint ? <p className="pc-hint">{hint}</p> : null}
      </div>
      {actions ? <div className="pc-head-actions">{actions}</div> : null}
    </div>
  );
}

export function Banner({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="pc-banner">{children}</p>;
}

export function Toast({ children }: { children?: ReactNode }) {
  return (
    <AnimatePresence>
      {children ? (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="pc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
          <motion.aside
            initial={{ x: 36 }}
            animate={{ x: 0 }}
            exit={{ x: 36 }}
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'live' | 'warn';
}) {
  return (
    <div className={`pc-stat ${tone === 'warn' ? 'is-warn' : tone === 'live' ? 'is-live' : ''}`}>
      <p>{label}</p>
      <p className="pc-stat-value">{value}</p>
      {hint ? <p className="mt-2 mb-0 text-sm">{hint}</p> : null}
    </div>
  );
}
