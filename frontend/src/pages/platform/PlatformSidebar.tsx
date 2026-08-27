import { Link, NavLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { SUPER_BASE } from '../../admin/paths';
import {
  IconBuildings,
  IconCard,
  IconDashboard,
  IconKey,
  IconPulse,
  IconSwitches,
} from '../../components/nav/ConsoleIcons';
import { LiveClock } from './motion';
import { Pulse } from './ui';

const ROUTES = [
  { to: `${SUPER_BASE}/dashboard`, label: 'Overview', icon: IconDashboard, end: true },
  { to: `${SUPER_BASE}/organizations`, label: 'Tenants', icon: IconBuildings },
  { to: `${SUPER_BASE}/modules`, label: 'Catalog', icon: IconSwitches },
  { to: `${SUPER_BASE}/billing`, label: 'Billing', icon: IconCard },
  { to: `${SUPER_BASE}/audit`, label: 'Traffic', icon: IconPulse },
  { to: `${SUPER_BASE}/settings`, label: 'Access', icon: IconKey },
];

function initials(email?: string) {
  const source = (email || 'SA').split('@')[0];
  const parts = source.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  email?: string;
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
};

export default function PlatformSidebar({ email, pathname, onNavigate, onSignOut }: Props) {
  const reduce = useReducedMotion();
  const activeTo =
    ROUTES.find((r) => (r.end ? pathname === r.to : pathname.startsWith(r.to)))?.to || ROUTES[0].to;

  return (
    <aside className="pc-spine" aria-label="Operator navigation">
      <div className="pc-spine-rail" aria-hidden={false}>
        <Link to={`${SUPER_BASE}/dashboard`} className="pc-spine-mark" onClick={onNavigate} title="Campus Desk">
          <span>CD</span>
        </Link>

        <nav className="pc-spine-icons">
          {ROUTES.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                onClick={onNavigate}
                title={item.label}
                className={`pc-spine-icon ${active ? 'is-active' : ''}`}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="pc-spine-pip"
                    className="pc-spine-pip"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <item.icon className="h-5 w-5" />
              </NavLink>
            );
          })}
        </nav>

        <div className="pc-spine-rail-foot">
          <Pulse on />
        </div>
      </div>

      <div className="pc-spine-panel">
        <header className="pc-spine-head">
          <p className="pc-spine-kicker">Operator console</p>
          <h2 className="pc-spine-title">Campus Desk</h2>
          <div className="pc-spine-live">
            <span className="pc-spine-live-dot" />
            <span>Online</span>
            <LiveClock className="pc-spine-clock" />
          </div>
        </header>

        <nav className="pc-spine-list" aria-label="Pages">
          {ROUTES.map((item) => {
            const active = item.to === activeTo;
            return (
              <NavLink
                key={`label-${item.to}`}
                to={item.to}
                end={Boolean(item.end)}
                onClick={onNavigate}
                className={`pc-spine-item ${active ? 'is-active' : ''}`}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="pc-spine-item-bg"
                    className="pc-spine-item-bg"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <span className="pc-spine-item-label">{item.label}</span>
                <span className="pc-spine-item-go" aria-hidden="true">
                  →
                </span>
              </NavLink>
            );
          })}
        </nav>

        <footer className="pc-spine-foot">
          <Link to={`${SUPER_BASE}/organizations`} className="pc-spine-cta" onClick={onNavigate}>
            Provision tenant
          </Link>
          <div className="pc-spine-account">
            <span className="pc-spine-avatar">{initials(email)}</span>
            <div className="pc-spine-account-meta">
              <strong title={email || ''}>{email || 'platform'}</strong>
              <small>Superuser</small>
            </div>
            <button type="button" className="pc-spine-out" onClick={onSignOut}>
              Out
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}
