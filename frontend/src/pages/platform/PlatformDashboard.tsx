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
import { AnimatedNumber, LiveClock, PingBar, ShimmerLine, StaggerCard, StaggerGrid } from './motion';
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

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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

const COMMAND_GROUPS = [
  {
    title: 'Tenants',
    desc: 'Campuses & hospitals on the platform',
    actions: [
      { to: `${SUPER_BASE}/organizations`, label: 'All tenants', hint: 'Browse, search, open records' },
      { to: `${SUPER_BASE}/organizations`, label: 'Provision tenant', hint: 'Education or hospital org' },
    ],
  },
  {
    title: 'Entitlements',
    desc: 'Global catalog every tenant inherits',
    actions: [
      { to: `${SUPER_BASE}/modules`, label: 'Departments', hint: 'Publish or hide departments' },
      { to: `${SUPER_BASE}/modules`, label: 'Modules', hint: 'LMS, admissions, attendance…' },
    ],
  },
  {
    title: 'Billing',
    desc: 'Subscriptions & invoices',
    actions: [
      { to: `${SUPER_BASE}/billing`, label: 'Billing overview', hint: 'MRR, outstanding, per-tenant' },
      { to: `${SUPER_BASE}/billing`, label: 'Generate invoices', hint: 'Run monthly billing cycle' },
    ],
  },
  {
    title: 'Observability',
    desc: 'Traffic, health, runtime',
    actions: [
      { to: `${SUPER_BASE}/audit`, label: 'API traffic log', hint: 'Requests, errors, payloads' },
      { to: `${SUPER_BASE}/dashboard`, label: 'Live health', hint: 'Postgres, Redis, API pings' },
    ],
  },
  {
    title: 'Per-tenant control',
    desc: 'Open any tenant to manage',
    actions: [
      { to: `${SUPER_BASE}/organizations`, label: 'Lock / suspend', hint: 'Service gate per campus' },
      { to: `${SUPER_BASE}/organizations`, label: 'Theme & public site', hint: 'Branding & templates' },
      { to: `${SUPER_BASE}/organizations`, label: 'Org admins', hint: 'Create, block, reset password' },
    ],
  },
  {
    title: 'Account',
    desc: 'Operator access',
    actions: [{ to: `${SUPER_BASE}/settings`, label: 'Change password', hint: 'Rotate platform credentials' }],
  },
];

function CommandTile({ to, label, hint, delay = 0 }: { to: string; label: string; hint: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35, ease }}>
      <Link to={to} className="pc-cmd-tile">
        <strong>{label}</strong>
        <span>{hint}</span>
        <em aria-hidden="true">→</em>
      </Link>
    </motion.div>
  );
}

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

  return (
    <div className="pc-dash flex flex-col gap-5">
      <section className="pc-hero pc-hero-compact">
        <div className="pc-hero-copy">
          <p className="pc-kicker m-0">{greeting()} · command center</p>
          <h1 className="pc-title-gradient m-0 text-[clamp(1.35rem,2.5vw,1.85rem)]!">Every platform action. One screen.</h1>
        </div>
        <div className="pc-hero-meta">
          <LiveClock className="pc-hero-clock" />
          <button
            type="button"
            className={`btn btn-outline py-2 text-sm ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => load(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Syncing…' : 'Sync live'}
          </button>
        </div>
        <ShimmerLine className="mt-4" />
      </section>

      <Banner>{error}</Banner>

      <StaggerGrid className="pc-metric-strip" delay={0.02}>
        {[
          { label: 'Revenue', value: formatMoney(billing.totalPaidCents, billing.currency) },
          { label: 'MRR', value: formatMoney(billing.mrrCents, billing.currency) },
          { label: 'Tenants', value: counts.organizations, n: counts.organizations },
          { label: 'Students', value: counts.applicants, n: counts.applicants },
          { label: 'Traffic 24h', value: traffic.last24h, n: traffic.last24h },
          { label: 'Errors', value: traffic.errors24h, n: traffic.errors24h, warn: traffic.errors24h > 0 },
        ].map((m) => (
          <StaggerCard key={m.label}>
            <div className={`pc-metric-pill ${m.warn ? 'is-warn' : ''}`}>
              <span>{m.label}</span>
              <strong>{m.n != null ? <AnimatedNumber value={m.n} format={(v) => String(Math.round(v))} /> : m.value}</strong>
            </div>
          </StaggerCard>
        ))}
      </StaggerGrid>

      <div className="pc-bento">
        <section className="pc-bento-main">
          <div className="pc-bento-head">
            <div>
              <p className="pc-kicker m-0">Command hub</p>
              <h2 className="m-0 text-base font-bold text-[var(--pc-text)]">All super-admin actions</h2>
            </div>
            <Link to={`${SUPER_BASE}/organizations`} className="btn btn-primary py-2 text-sm">
              + Provision tenant
            </Link>
          </div>
          <div className="pc-cmd-grid">
            {COMMAND_GROUPS.map((group, gi) => (
              <div key={group.title} className="pc-cmd-group">
                <div className="pc-cmd-group-head">
                  <h3 className="m-0">{group.title}</h3>
                  <p className="m-0">{group.desc}</p>
                </div>
                <div className="pc-cmd-list">
                  {group.actions.map((action, ai) => (
                    <CommandTile key={`${group.title}-${action.label}`} {...action} delay={gi * 0.04 + ai * 0.03} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="pc-bento-side">
          <div className="pc-panel pc-glow-panel p-4">
            <p className="pc-kicker m-0 mb-2">Revenue trend</p>
            <BarChart data={billing.monthly || []} compact />
          </div>

          <div className="pc-panel pc-glow-panel p-4">
            <p className="pc-kicker m-0 mb-3">Infrastructure</p>
            <div className="flex flex-col gap-2">
              {services.map((service) => {
                const up = service.status === 'up';
                return (
                  <div key={service.name} className={`pc-service pc-service-mini ${up ? 'is-up' : 'is-down'}`}>
                    <div className="min-w-0">
                      <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-[var(--pc-text)]">
                        <Pulse on={up} tone={pingTone(service.latencyMs, up)} />
                        {service.name}
                      </p>
                      <p className="m-0 font-mono text-xs font-bold text-[var(--pc-muted)]">
                        {up && service.latencyMs != null ? `${Math.round(service.latencyMs)} ms` : up ? 'Up' : 'Down'}
                      </p>
                      <PingBar ms={service.latencyMs} up={up} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="m-0 mt-3 text-[0.65rem] text-[var(--pc-muted)]">
              Uptime {formatUptime(data.uptime?.seconds)} · RSS {memory.rssMb} MB · v{versions.backend}
            </p>
          </div>

          <div className="pc-panel pc-glow-panel p-4">
            <p className="pc-kicker m-0 mb-2">Quick jump</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: `${SUPER_BASE}/organizations`, icon: IconBuildings, label: 'Tenants' },
                { to: `${SUPER_BASE}/modules`, icon: IconSwitches, label: 'Catalog' },
                { to: `${SUPER_BASE}/billing`, icon: IconCard, label: 'Billing' },
                { to: `${SUPER_BASE}/audit`, icon: IconPulse, label: 'Traffic' },
                { to: `${SUPER_BASE}/settings`, icon: IconKey, label: 'Access' },
              ].map((item) => (
                <Link key={item.to + item.label} to={item.to} className="pc-jump-tile">
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {data.recent?.length > 0 && (
        <section className="pc-panel pc-glow-panel p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-bold">Recent tenants</h2>
            <Link to={`${SUPER_BASE}/organizations`} className="text-xs font-semibold text-[var(--pc-accent)]">
              View all →
            </Link>
          </div>
          <div className="pc-table-wrap">
            <table className="pc-table pc-table-compact">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th>Modules</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.slice(0, 5).map((org) => (
                  <tr key={org.id}>
                    <td>
                      <Link to={`${SUPER_BASE}/organizations/${org.id}`}>{org.name}</Link>
                      <div className="font-mono text-[0.62rem] text-[var(--pc-muted)]">{org.slug}</div>
                    </td>
                    <td>
                      <span className={`tag ${org.status === 'active' ? 'tag-allied' : 'tag-nursing'}`}>{org.status}</span>
                    </td>
                    <td className="text-xs text-[var(--pc-muted)]">
                      {(org.departments || org.modules || []).slice(0, 3).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
