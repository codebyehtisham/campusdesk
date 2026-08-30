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
  counts: { organizations: 0, modules: 0, orgAdmins: 0, faculty: 0, applicants: 0, trialOrgs: 0, trialExpired: 0 },
  trials: { active: 0, expired: 0, expiringSoon: [] },
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
  { to: `${SUPER_BASE}/organizations`, label: 'Provision tenant', hint: 'Spin up a campus or hospital org', icon: IconBuildings, tone: 'primary' },
  { to: `${SUPER_BASE}/organizations`, label: 'Manage tenants', hint: 'Lock, theme, admins, modules', icon: IconBuildings },
  { to: `${SUPER_BASE}/modules`, label: 'Catalog', hint: 'Departments & sellable modules', icon: IconSwitches },
  { to: `${SUPER_BASE}/billing`, label: 'Billing', hint: 'MRR, invoices, past due', icon: IconCard },
  { to: `${SUPER_BASE}/audit`, label: 'Traffic log', hint: 'API requests & error traces', icon: IconPulse },
  { to: `${SUPER_BASE}/settings`, label: 'Operator access', hint: 'Rotate platform password', icon: IconKey },
];

const KPI_TONES = ['teal', 'amber', 'mint', 'rose', 'sky', 'violet'] as const;

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
  const trials = data.trials || empty.trials;
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

  const kpis = [
    { label: 'Total revenue', value: formatMoney(billing.totalPaidCents, billing.currency), hint: 'Paid invoices', icon: IconCard, delta: 'Revenue' },
    { label: 'MRR', value: formatMoney(billing.mrrCents, billing.currency), hint: `${billing.activeSubscriptions} active`, icon: IconPulse, delta: 'Recurring' },
    {
      label: 'Outstanding',
      value: formatMoney(billing.outstandingCents, billing.currency),
      hint: billing.pastDue ? `${billing.pastDue} past due` : 'Open invoices',
      icon: IconCard,
      warn: billing.outstandingCents > 0,
      delta: billing.outstandingCents > 0 ? 'Due' : 'Clear',
    },
    { label: 'Tenants', value: counts.organizations, n: counts.organizations, hint: 'Live orgs', icon: IconBuildings, delta: 'Fleet' },
    {
      label: 'Trial institutes',
      value: counts.trialOrgs ?? 0,
      n: counts.trialOrgs ?? 0,
      hint: trials.expired ? `${trials.expired} expired` : 'Active trials',
      icon: IconBuildings,
      warn: (counts.trialExpired ?? 0) > 0,
      delta: (counts.trialExpired ?? 0) > 0 ? 'Expired' : 'Trial',
    },
    { label: 'Students', value: counts.applicants, n: counts.applicants, hint: 'Applicants', icon: IconSwitches, delta: 'Pipeline' },
    {
      label: 'Errors 24h',
      value: traffic.errors24h,
      n: traffic.errors24h,
      hint: `${traffic.last24h} requests`,
      icon: IconPulse,
      warn: traffic.errors24h > 0,
      delta: traffic.errors24h > 0 ? 'Watch' : 'Stable',
    },
  ];

  return (
    <div className="pc-dash">
      <Banner>{error}</Banner>

      <motion.header
        className="pc-dash-banner platform-dash-banner"
        initial={{ opacity: 0, y: 22, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease }}
      >
        <div className="pc-dash-banner-copy">
          <p className="pc-dash-banner-kicker">Welcome back, operator</p>
          <h1>Platform command center</h1>
          <p>Provision tenants, manage entitlements, and watch billing — live stack telemetry at a glance.</p>
          <div className="pc-dash-banner-actions">
            <Link to={`${SUPER_BASE}/organizations`} className="pc-dash-banner-btn platform-btn-shine">
              Provision tenant
            </Link>
            <button
              type="button"
              className={`pc-dash-banner-btn is-ghost ${refreshing ? 'is-spinning' : ''}`}
              onClick={() => load(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? 'Syncing…' : 'Sync telemetry'}
            </button>
          </div>
        </div>
        <div className="pc-dash-banner-art" aria-hidden="true">
          <div className="pc-dash-mesh" />
          <div className="pc-dash-orb" />
          <div className="pc-dash-orb is-2" />
          <div className="pc-dash-orb is-3" />
          <div className={`pc-dash-banner-status ${allUp ? 'is-live' : 'is-warn'}`}>
            <Pulse on={allUp} tone={allUp ? 'live' : 'warn'} />
            <div>
              <strong>{allUp ? 'All systems nominal' : 'Attention required'}</strong>
              <span>
                {upCount}/{services.length} up · <LiveClock />
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      <StaggerGrid className="pc-kpi-row" delay={0.05}>
        {kpis.map((m, i) => (
          <StaggerCard key={m.label}>
            <article className={`pc-kpi platform-kpi-animated is-${KPI_TONES[i % KPI_TONES.length]} ${m.warn ? 'is-warn' : ''}`}>
              <div className="pc-kpi-top">
                <span className="pc-kpi-icon">
                  <m.icon className="h-4 w-4" />
                </span>
                <span className="pc-kpi-delta">{m.delta}</span>
              </div>
              <p className="pc-kpi-value">
                {m.n != null ? <AnimatedNumber value={m.n} format={(v) => String(Math.round(v))} /> : m.value}
              </p>
              <p className="pc-kpi-label">{m.label}</p>
              <p className="pc-kpi-hint">{m.hint}</p>
              <span className="pc-kpi-spark platform-kpi-spark" aria-hidden="true" />
            </article>
          </StaggerCard>
        ))}
      </StaggerGrid>

      <div className="pc-ops-grid">
        <section className="pc-ops-actions">
          <div className="pc-section-head">
            <div>
              <p className="pc-kicker m-0">Quick actions</p>
              <h2 className="m-0">Operator moves</h2>
            </div>
          </div>
          <div className="pc-action-grid">
            {ACTIONS.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.38, ease }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <Link to={action.to} className={`pc-action-card platform-action-card ${action.tone === 'primary' ? 'is-primary' : ''}`}>
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
          <motion.section
            className="pc-glass-card platform-panel-glow"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.45, ease }}
          >
            <div className="pc-section-head is-tight">
              <p className="pc-kicker m-0">Revenue</p>
              <span className="pc-chip-mini">Monthly</span>
            </div>
            <BarChart data={billing.monthly || []} compact />
          </motion.section>

          <motion.section
            className="pc-glass-card pc-project-card platform-panel-glow"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.28, duration: 0.45, ease }}
          >
            <div className="pc-section-head is-tight">
              <div>
                <p className="pc-kicker m-0">Infrastructure</p>
                <h3 className="m-0 mt-1">Campus Desk stack</h3>
              </div>
              <span className="pc-chip-mini">v{versions.backend}</span>
            </div>
            <p className="pc-project-meta">Release health · uptime {formatUptime(data.uptime?.seconds)}</p>
            <div className="pc-progress">
              <div className="pc-progress-track">
                <motion.div
                  className="pc-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${healthPct}%` }}
                  transition={{ duration: 1, ease, delay: 0.3 }}
                />
              </div>
              <span>{healthPct}%</span>
            </div>
            <ul className="pc-infra-list">
              {services.map((service, i) => {
                const up = service.status === 'up';
                return (
                  <motion.li
                    key={service.name}
                    className={up ? 'is-up' : 'is-down'}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.06, duration: 0.35, ease }}
                  >
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
                  </motion.li>
                );
              })}
            </ul>
            <p className="pc-infra-foot">
              RSS {memory.rssMb} MB · Node {versions.node}
            </p>
          </motion.section>
        </aside>
      </div>

      {trials.expiringSoon?.length > 0 && (
        <motion.section
          className="pc-glass-card pc-recent platform-panel-glow mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45, ease }}
        >
          <div className="pc-section-head">
            <div>
              <p className="pc-kicker m-0">Trials</p>
              <h2 className="m-0">Expiring within 3 days</h2>
            </div>
            <Link to={`${SUPER_BASE}/organizations`} className="pc-text-link" state={{ filter: 'trial' }}>
              Trial tenants →
            </Link>
          </div>
          <div className="pc-tenant-strip">
            {trials.expiringSoon.map((org, i) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.32, ease }}
                whileHover={{ y: -3 }}
              >
                <Link to={`${SUPER_BASE}/organizations/${org.id}`} className="pc-tenant-tile platform-tenant-tile">
                  <span className="pc-tenant-mark">{String(org.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="pc-tenant-copy">
                    <strong>{org.name}</strong>
                    <small>
                      {org.trialEndsAt
                        ? `Ends ${new Date(org.trialEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : org.slug}
                    </small>
                  </span>
                  <span className="pc-tenant-status is-warn">trial</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {data.recent?.length > 0 && (
        <motion.section
          className="pc-glass-card pc-recent platform-panel-glow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease }}
        >
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.32, ease }}
                whileHover={{ y: -3 }}
              >
                <Link to={`${SUPER_BASE}/organizations/${org.id}`} className="pc-tenant-tile platform-tenant-tile">
                  <span className="pc-tenant-mark">{String(org.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="pc-tenant-copy">
                    <strong>{org.name}</strong>
                    <small>{org.slug}</small>
                  </span>
                  <span className={`pc-tenant-status ${org.isTrial ? 'is-warn' : org.status === 'active' ? 'is-live' : 'is-warn'}`}>
                    {org.isTrial ? 'trial' : org.status}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
