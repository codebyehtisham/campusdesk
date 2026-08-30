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

const ACTIONS = [
  { to: `${SUPER_BASE}/organizations`, label: 'Provision tenant', hint: 'Spin up a new campus', icon: IconBuildings, primary: true },
  { to: `${SUPER_BASE}/organizations`, label: 'Manage tenants', hint: 'Lock, theme, modules', icon: IconBuildings },
  { to: `${SUPER_BASE}/modules`, label: 'Module catalog', hint: 'Departments & SKUs', icon: IconSwitches },
  { to: `${SUPER_BASE}/billing`, label: 'Billing', hint: 'MRR & invoices', icon: IconCard },
  { to: `${SUPER_BASE}/audit`, label: 'Traffic log', hint: 'API & errors', icon: IconPulse },
  { to: `${SUPER_BASE}/settings`, label: 'Operator access', hint: 'Rotate password', icon: IconKey },
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
  const upCount = services.filter((s) => s.status === 'up').length;
  const healthPct = Math.round((upCount / Math.max(services.length, 1)) * 100);

  const metrics = [
    { label: 'Total revenue', value: formatMoney(billing.totalPaidCents, billing.currency), tag: 'Paid', icon: IconCard },
    { label: 'MRR', value: formatMoney(billing.mrrCents, billing.currency), tag: `${billing.activeSubscriptions} subs`, icon: IconPulse },
    {
      label: 'Outstanding',
      value: formatMoney(billing.outstandingCents, billing.currency),
      tag: billing.pastDue ? `${billing.pastDue} past due` : 'Clear',
      icon: IconCard,
      warn: billing.outstandingCents > 0,
    },
    { label: 'Tenants', n: counts.organizations, tag: 'Fleet', icon: IconBuildings },
    { label: 'Applicants', n: counts.applicants, tag: 'Pipeline', icon: IconSwitches },
    {
      label: 'Errors 24h',
      n: traffic.errors24h,
      tag: `${traffic.last24h} req`,
      icon: IconPulse,
      warn: traffic.errors24h > 0,
    },
  ];

  return (
    <div className="px-mission">
      <Banner>{error}</Banner>

      <motion.header
        className="px-mission-hero"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <div>
          <p className="px-mission-kicker">Mission control</p>
          <h1>Fleet overview</h1>
          <p className="px-mission-lead">
            Live telemetry across tenants, billing, and infrastructure — provision orgs and ship modules from one dark
            console.
          </p>
          <div className="px-mission-actions">
            <Link to={`${SUPER_BASE}/organizations`} className="px-mission-btn is-solid">
              Provision tenant
            </Link>
            <button
              type="button"
              className="px-mission-btn"
              onClick={() => load(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? 'Syncing…' : 'Sync telemetry'}
            </button>
          </div>
        </div>
        <div className="px-mission-status">
          <div className="px-mission-status-head">
            <Pulse on={allUp} tone={allUp ? 'live' : 'warn'} />
            {allUp ? 'All systems nominal' : 'Attention required'}
          </div>
          <p className="px-mission-status-meta">
            {upCount}/{services.length} services up · uptime {formatUptime(data.uptime?.seconds)} · <LiveClock />
          </p>
        </div>
      </motion.header>

      <StaggerGrid className="px-bento">
        {metrics.map((m) => (
          <StaggerCard key={m.label}>
            <article className={`px-metric ${m.warn ? 'is-warn' : ''}`}>
              <div className="px-metric-top">
                <span className="px-metric-icon">
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="px-metric-tag">{m.tag}</span>
              </div>
              <p className="px-metric-value">
                {m.n != null ? <AnimatedNumber value={m.n} format={(v) => String(Math.round(v))} /> : m.value}
              </p>
              <p className="px-metric-label">{m.label}</p>
              <span className="px-metric-glow" aria-hidden="true" />
            </article>
          </StaggerCard>
        ))}
      </StaggerGrid>

      <div className="px-grid-2">
        <section className="px-panel">
          <div className="px-panel-head">
            <div>
              <p className="px-panel-kicker">Quick actions</p>
              <h2>Operator moves</h2>
            </div>
          </div>
          <div className="px-action-list">
            {ACTIONS.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35, ease }}
              >
                <Link to={action.to} className={`px-action-item ${action.primary ? 'is-primary' : ''}`}>
                  <span className="px-action-icon">
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span className="px-action-copy">
                    <strong>{action.label}</strong>
                    <small>{action.hint}</small>
                  </span>
                  <span className="px-action-go" aria-hidden="true">
                    →
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <section className="px-panel">
            <div className="px-panel-head">
              <div>
                <p className="px-panel-kicker">Revenue</p>
                <h3>Monthly</h3>
              </div>
              <span className="px-chip">MRR</span>
            </div>
            <BarChart data={billing.monthly || []} compact />
          </section>

          <section className="px-panel">
            <div className="px-panel-head">
              <div>
                <p className="px-panel-kicker">Infrastructure</p>
                <h3>Stack health</h3>
              </div>
              <span className="px-chip">v{versions.backend}</span>
            </div>
            <div className="px-progress">
              <div className="px-progress-track">
                <div className="px-progress-fill" style={{ width: `${healthPct}%` }} />
              </div>
              <span>{healthPct}%</span>
            </div>
            <div className="flex flex-col gap-2">
              {services.map((service) => {
                const up = service.status === 'up';
                return (
                  <div key={service.name} className={`px-infra-row ${up ? '' : 'is-down'}`}>
                    <span className="px-infra-name">
                      <Pulse on={up} tone={pingTone(service.latencyMs, up)} />
                      {service.name}
                    </span>
                    <span className="px-infra-ping">
                      {up && service.latencyMs != null ? `${Math.round(service.latencyMs)} ms` : up ? 'Up' : 'Down'}
                      <PingBar ms={service.latencyMs} up={up} />
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="m-0 mt-3 font-mono text-[0.62rem] text-text-muted">
              RSS {memory.rssMb} MB · Node {versions.node}
            </p>
          </section>
        </div>
      </div>

      {data.recent?.length > 0 && (
        <section className="px-panel">
          <div className="px-panel-head">
            <div>
              <p className="px-panel-kicker">Fleet</p>
              <h2>Recent tenants</h2>
            </div>
            <Link to={`${SUPER_BASE}/organizations`} className="px-link">
              View all →
            </Link>
          </div>
          <div className="px-tenant-grid">
            {data.recent.slice(0, 6).map((org, i) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease }}
              >
                <Link to={`${SUPER_BASE}/organizations/${org.id}`} className="px-tenant-card">
                  <span className="px-tenant-avatar">{String(org.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="px-tenant-meta">
                    <strong>{org.name}</strong>
                    <small>{org.slug}</small>
                  </span>
                  <span className={`px-tenant-pill ${org.status === 'active' ? 'is-live' : 'is-warn'}`}>
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
