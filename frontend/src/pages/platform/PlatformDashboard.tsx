import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import {
  IconBuildings,
  IconCard,
  IconKey,
  IconPulse,
  IconSwitches,
} from '../../components/nav/ConsoleIcons';
import { AnimatedNumber, LiveClock, PingBar, StaggerCard, StaggerGrid } from './motion';
import { Banner, Pulse } from './ui';
import { BarChart } from './BarChart';
import { formatMoney } from './money';

const empty = {
  counts: { organizations: 0, modules: 0, orgAdmins: 0, faculty: 0, applicants: 0 },
  recent: [],
  services: [],
  uptime: { seconds: 0, startedAt: null },
  traffic: { lastHour: 0, last24h: 0, errors24h: 0 },
  memory: { rssMb: 0, heapMb: 0 },
  versions: { backend: '—', node: '—' },
  evaluatedAt: null,
  billing: {
    currency: 'USD',
    totalPaidCents: 0,
    monthPaidCents: 0,
    outstandingCents: 0,
    mrrCents: 0,
    activeSubscriptions: 0,
    pastDue: 0,
    monthly: [],
  },
};

const ease = [0.22, 1, 0.36, 1] as const;

function formatUptime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function pingTone(ms, up) {
  if (!up) return 'warn';
  if (ms == null) return 'warn';
  if (ms <= 50) return 'live';
  if (ms <= 200) return undefined;
  return 'warn';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ACTIONS = [
  {
    to: `${SUPER_BASE}/organizations`,
    label: 'Provision tenant',
    hint: 'Spin up a campus or hospital org',
    icon: IconBuildings,
    tone: 'primary',
  },
  {
    to: `${SUPER_BASE}/organizations`,
    label: 'Manage tenants',
    hint: 'Lock, theme, admins, modules',
    icon: IconBuildings,
    tone: 'default',
  },
  {
    to: `${SUPER_BASE}/modules`,
    label: 'Catalog',
    hint: 'Departments & sellable modules',
    icon: IconSwitches,
    tone: 'default',
  },
  {
    to: `${SUPER_BASE}/billing`,
    label: 'Billing',
    hint: 'MRR, invoices, past due',
    icon: IconCard,
    tone: 'default',
  },
  {
    to: `${SUPER_BASE}/audit`,
    label: 'Traffic log',
    hint: 'API requests & error traces',
    icon: IconPulse,
    tone: 'default',
  },
  {
    to: `${SUPER_BASE}/settings`,
    label: 'Operator access',
    hint: 'Rotate platform password',
    icon: IconKey,
    tone: 'default',
  },
];

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (live = false) => {
    if (live) setRefreshing(true);
    try {
      const res = await api.get('/platform/dashboard', {
        authScope: 'platform',
        params: live ? { live: 1 } : undefined,
      });
      setData({ ...empty, ...res.data });
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOutPlatform();
        navigate(SUPER_BASE, { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not load the control plane.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = data.counts;
  const traffic = data.traffic || empty.traffic;
  const memory = data.memory || empty.memory;
  const versions = data.versions || empty.versions;
  const billing = data.billing || empty.billing;
  const services = data.services?.length
    ? data.services
    : [
        { name: 'API', status: 'down' },
        { name: 'PostgreSQL', status: 'down' },
        { name: 'Redis', status: 'down' },
      ];
  const allUp = services.every((s) => s.status === 'up');

  return (
    <div className="pc-dash">
      <Banner>{error}</Banner>

      <motion.header
        className="pc-dash-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
      >
        <div className="pc-dash-hero-grid" aria-hidden="true" />
        <div className="pc-dash-hero-copy">
          <p className="pc-kicker m-0">
            {greeting()} · operator console
          </p>
          <h1 className="pc-dash-title">Mission control</h1>
          <p className="pc-dash-sub">
            Tenants, entitlements, billing, and live infrastructure — every super-admin move from one surface.
          </p>
        </div>
        <div className="pc-dash-hero-aside">
          <div className={`pc-health-orb ${allUp ? 'is-live' : 'is-warn'}`}>
            <Pulse on={allUp} tone={allUp ? 'live' : 'warn'} />
            <div>
              <strong>{allUp ? 'All systems nominal' : 'Attention required'}</strong>
              <span>
                {services.filter((s) => s.status === 'up').length}/{services.length} services up ·{' '}
                <LiveClock />
              </span>
            </div>
          </div>
          <button
            type="button"
            className={`btn btn-outline py-2.5 text-sm ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => load(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Syncing…' : 'Sync telemetry'}
          </button>
        </div>
      </motion.header>

      <StaggerGrid className="pc-kpi-row">
        {[
          { label: 'Total revenue', value: formatMoney(billing.totalPaidCents, billing.currency), hint: 'Paid invoices' },
          { label: 'MRR', value: formatMoney(billing.mrrCents, billing.currency), hint: `${billing.activeSubscriptions} active` },
          {
            label: 'Outstanding',
            value: formatMoney(billing.outstandingCents, billing.currency),
            hint: billing.pastDue ? `${billing.pastDue} past due` : 'Open invoices',
            warn: billing.outstandingCents > 0,
          },
          { label: 'Tenants', value: counts.organizations, n: counts.organizations, hint: 'Live orgs' },
          { label: 'Students', value: counts.applicants, n: counts.applicants, hint: 'Applicants' },
          {
            label: 'Errors 24h',
            value: traffic.errors24h,
            n: traffic.errors24h,
            hint: `${traffic.last24h} requests`,
            warn: traffic.errors24h > 0,
          },
        ].map((m) => (
          <StaggerCard key={m.label}>
            <article className={`pc-kpi ${m.warn ? 'is-warn' : ''}`}>
              <p className="pc-kpi-label">{m.label}</p>
              <p className="pc-kpi-value">
                {m.n != null ? <AnimatedNumber value={m.n} format={(v) => String(Math.round(v))} /> : m.value}
              </p>
              <p className="pc-kpi-hint">{m.hint}</p>
            </article>
          </StaggerCard>
        ))}
      </StaggerGrid>

      <div className="pc-ops-grid">
        <section className="pc-ops-actions">
          <div className="pc-section-head">
            <div>
              <p className="pc-kicker m-0">Operator moves</p>
              <h2 className="m-0">What can you do?</h2>
            </div>
          </div>
          <div className="pc-action-grid">
            {ACTIONS.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04, duration: 0.35, ease }}
              >
                <Link to={action.to} className={`pc-action-card ${action.tone === 'primary' ? 'is-primary' : ''}`}>
                  <span className="pc-action-icon">
                    <action.icon />
                  </span>
                  <span className="pc-action-copy">
                    <strong>{action.label}</strong>
                    <small>{action.hint}</small>
                  </span>
                  <span className="pc-action-go" aria-hidden="true">
                    →
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <aside className="pc-ops-side">
          <section className="pc-glass-card">
            <div className="pc-section-head is-tight">
              <p className="pc-kicker m-0">Revenue</p>
              <span className="pc-chip-mini">Monthly</span>
            </div>
            <BarChart data={billing.monthly || []} compact />
          </section>

          <section className="pc-glass-card">
            <div className="pc-section-head is-tight">
              <p className="pc-kicker m-0">Infrastructure</p>
              <span className="pc-chip-mini">Live pings</span>
            </div>
            <ul className="pc-infra-list">
              {services.map((service) => {
                const up = service.status === 'up';
                return (
                  <li key={service.name} className={up ? 'is-up' : 'is-down'}>
                    <div className="pc-infra-meta">
                      <Pulse on={up} tone={pingTone(service.latencyMs, up)} />
                      <strong>{service.name}</strong>
                    </div>
                    <div className="pc-infra-ping">
                      <span>
                        {up && service.latencyMs != null ? `${Math.round(service.latencyMs)} ms` : up ? 'Up' : 'Down'}
                      </span>
                      <PingBar ms={service.latencyMs} up={up} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="pc-infra-foot">
              Uptime {formatUptime(data.uptime?.seconds)} · RSS {memory.rssMb} MB · API v{versions.backend}
            </p>
          </section>
        </aside>
      </div>

      {data.recent?.length > 0 && (
        <section className="pc-glass-card pc-recent">
          <div className="pc-section-head">
            <div>
              <p className="pc-kicker m-0">Fleet</p>
              <h2 className="m-0">Recent tenants</h2>
            </div>
            <Link to={`${SUPER_BASE}/organizations`} className="pc-text-link">
              View all →
            </Link>
          </div>
          <div className="pc-tenant-strip">
            {data.recent.slice(0, 6).map((org, i) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease }}
              >
                <Link to={`${SUPER_BASE}/organizations/${org.id}`} className="pc-tenant-tile">
                  <span className="pc-tenant-mark">{String(org.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="pc-tenant-copy">
                    <strong>{org.name}</strong>
                    <small>{org.slug}</small>
                  </span>
                  <span className={`pc-tenant-status ${org.status === 'active' ? 'is-live' : 'is-warn'}`}>
                    {org.status}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
