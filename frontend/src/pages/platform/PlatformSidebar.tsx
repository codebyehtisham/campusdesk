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

const DOCK_ITEMS = GROUPS.flatMap((g) => g.items);

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
  mobile?: boolean;
};

export default function PlatformSidebar({ email, name, onNavigate, onSignOut, mobile }: Props) {
  if (mobile) {
    return (
      <>
        <div className="px-nav-title">Control plane</div>
        <p className="px-nav-sub">Campus Desk platform</p>
        {GROUPS.map((group) => (
          <div key={group.title} className="px-nav-group">
            <p className="px-nav-label">{group.title}</p>
            <nav className="px-nav-links">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    onClick={onNavigate}
                    className={({ isActive }) => `px-nav-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
        <Link to={`${SUPER_BASE}/organizations`} className="px-nav-cta" onClick={onNavigate}>
          + Provision tenant
        </Link>
        <button type="button" className="px-dock-signout mt-4" onClick={onSignOut}>
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <nav className="px-dock" aria-label="Platform navigation">
        <Link to={`${SUPER_BASE}/dashboard`} className="px-dock-brand" title="Campus Desk Platform" onClick={onNavigate}>
          <CampusDeskMark size={36} />
        </Link>

        <div className="px-dock-nav">
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                title={item.label}
                onClick={onNavigate}
                className={({ isActive }) => `px-dock-link ${isActive ? 'is-active' : ''}`}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" />
              </NavLink>
            );
          })}
        </div>

        <div className="px-dock-foot">
          <span className="px-dock-avatar" title={email || 'Operator'}>
            {initials(email, name)}
          </span>
          <button type="button" className="px-dock-signout" onClick={onSignOut}>
            Exit
          </button>
        </div>
      </nav>

      <aside className="px-nav-panel" aria-label="Platform sections">
        <p className="px-nav-title">Control plane</p>
        <p className="px-nav-sub">Campus Desk platform</p>

        {GROUPS.map((group) => (
          <div key={group.title} className="px-nav-group">
            <p className="px-nav-label">{group.title}</p>
            <nav className="px-nav-links">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={Boolean(item.end)}
                    onClick={onNavigate}
                    className={({ isActive }) => `px-nav-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}

        <Link to={`${SUPER_BASE}/organizations`} className="px-nav-cta" onClick={onNavigate}>
          + Provision tenant
        </Link>
      </aside>
    </>
  );
}
