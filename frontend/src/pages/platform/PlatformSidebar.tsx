import { Link, NavLink } from 'react-router-dom';
import { SUPER_BASE } from '../../admin/paths';
import CampusDeskMark from '../../components/CampusDeskMark';
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
    title: 'Platform',
    items: [
      { to: `${SUPER_BASE}/dashboard`, label: 'Dashboard', icon: IconDashboard, end: true },
      { to: `${SUPER_BASE}/organizations`, label: 'Tenants', icon: IconBuildings },
      { to: `${SUPER_BASE}/modules`, label: 'Catalog', icon: IconSwitches },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: `${SUPER_BASE}/billing`, label: 'Billing', icon: IconCard },
      { to: `${SUPER_BASE}/audit`, label: 'Traffic', icon: IconPulse },
      { to: `${SUPER_BASE}/settings`, label: 'Access', icon: IconKey },
    ],
  },
];

function initials(email?: string, name?: string) {
  const source = (name || email || 'SA').split('@')[0];
  const parts = source.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  email?: string;
  name?: string;
  onNavigate: () => void;
  onSignOut: () => void;
};

export default function PlatformSidebar({ email, name, onNavigate, onSignOut }: Props) {
  return (
    <>
      <Link to={`${SUPER_BASE}/dashboard`} className="staff-rail-brand platform-rail-brand" onClick={onNavigate}>
        <CampusDeskMark size={48} className="ring-2 ring-white/20 platform-mark-float" />
        <span>
          <strong>Campus Desk</strong>
          <small>Platform console</small>
        </span>
      </Link>

      <div className="staff-nav-scroll">
        {GROUPS.map((group) => (
          <div key={group.title} className="staff-nav-group">
            <p className="staff-nav-label">{group.title}</p>
            <nav className="staff-nav platform-nav-animated">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    onClick={onNavigate}
                    className={({ isActive }) => `platform-nav-item ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="staff-nav-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="staff-rail-foot">
        <Link
          to={`${SUPER_BASE}/organizations`}
          className="staff-rail-cta platform-rail-cta mb-3 block text-center"
          onClick={onNavigate}
        >
          Provision tenant
        </Link>
        <div className="staff-rail-user">
          <span className="staff-rail-avatar platform-avatar-pulse" aria-hidden="true">
            {initials(email, name)}
          </span>
          <div className="staff-rail-user-meta">
            <strong>{email || 'Platform admin'}</strong>
            <small>Super admin</small>
          </div>
        </div>
        <button type="button" className="staff-rail-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </>
  );
}
