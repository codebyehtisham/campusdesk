import { Link, NavLink } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import {
  IconBuildings,
  IconCard,
  IconDashboard,
  IconKey,
  IconPulse,
  IconSwitches,
} from '../../components/nav/ConsoleIcons';

const GROUPS = [
  {
    label: 'Navigation',
    items: [
      { to: `${SUPER_BASE}/dashboard`, label: 'Dashboard', icon: IconDashboard, end: true },
      { to: `${SUPER_BASE}/organizations`, label: 'Tenants', icon: IconBuildings },
      { to: `${SUPER_BASE}/modules`, label: 'Catalog', icon: IconSwitches },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: `${SUPER_BASE}/billing`, label: 'Billing', icon: IconCard },
      { to: `${SUPER_BASE}/audit`, label: 'Traffic', icon: IconPulse },
      { to: `${SUPER_BASE}/settings`, label: 'Access', icon: IconKey },
    ],
  },
];

function displayName(email?: string, name?: string) {
  if (name?.trim()) return name.trim();
  const local = (email || 'platform').split('@')[0];
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(email?: string, name?: string) {
  const source = displayName(email, name);
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  email?: string;
  name?: string;
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
};

export default function PlatformSidebar({ email, name, pathname, onNavigate, onSignOut }: Props) {
  return (
    <aside className="pc-aside" aria-label="Platform navigation">
      <div className="pc-aside-brand">
        <Link to={`${SUPER_BASE}/dashboard`} className="pc-aside-logo" onClick={onNavigate}>
          <span className="pc-aside-mark">CD</span>
          <span className="pc-aside-brand-text">
            <strong>Campus Desk</strong>
            <small>Platform</small>
          </span>
        </Link>
      </div>

      <div className="pc-aside-profile">
        <span className="pc-aside-avatar" aria-hidden="true">
          {initials(email, name)}
        </span>
        <div className="pc-aside-profile-meta">
          <strong title={email || ''}>{displayName(email, name)}</strong>
          <small>Administrator</small>
        </div>
      </div>

      <nav className="pc-aside-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="pc-aside-group">
            <p className="pc-aside-group-label">{group.label}</p>
            <ul className="pc-aside-list">
              {group.items.map((item) => {
                const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={Boolean(item.end)}
                      onClick={onNavigate}
                      className={`pc-aside-link ${active ? 'is-active' : ''}`}
                    >
                      <span className="pc-aside-link-icon">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="pc-aside-link-label">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="pc-aside-foot">
        <Link to={`${SUPER_BASE}/organizations`} className="pc-aside-cta" onClick={onNavigate}>
          Provision tenant
        </Link>
        <button type="button" className="pc-aside-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
