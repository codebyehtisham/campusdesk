import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { FRONTEND_VERSION } from '../../version';
import {
  IconBuildings,
  IconCard,
  IconDashboard,
  IconPulse,
  IconSwitches,
} from '../../components/nav/ConsoleIcons';
import { AnimatedNumber, LiveClock, PingBar, QuickAction, ShimmerLine, StaggerCard, StaggerGrid } from './motion';
import { Banner, PageHead, Panel, Pulse, Stat } from './ui';
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

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function formatPing(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  return `${Math.round(ms)} ms`;
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
    <div className="flex flex-col gap-6">
      <section className="pc-hero">
        <div className="pc-hero-copy">
          <p className="pc-kicker m-0">{greeting()}</p>
          <h1 className="pc-title-gradient m-0 text-[clamp(1.6rem,3vw,2.35rem)]!">Operations command center</h1>
          <p className="pc-hint m-0 mt-2 max-w-xl">
            Live revenue, tenant health, infrastructure pings, and traffic — all in one place.
          </p>
        </div>
        <div className="pc-hero-meta">
          <div className="pc-hero-clock-wrap">
            <span className="pc-kicker m-0">Live</span>
            <LiveClock className="pc-hero-clock" />
          </div>
          <button
            type="button"
            className={`btn btn-outline py-2.5 text-sm ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => load(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
        <ShimmerLine className="mt-5" />
      </section>

      <PageHead
        kicker="Control plane"
        title="Overview"
        hint="Revenue, tenant count, service health, and request volume across the platform."
      />

      <Banner>{error}</Banner>

      <StaggerGrid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerCard>
          <Stat label="Total revenue" value={formatMoney(billing.totalPaidCents, billing.currency)} hint="All paid invoices" />
        </StaggerCard>
        <StaggerCard>
          <Stat label="This month" value={formatMoney(billing.monthPaidCents, billing.currency)} />
        </StaggerCard>
        <StaggerCard>
          <Stat
            label="MRR"
            value={formatMoney(billing.mrrCents, billing.currency)}
            hint={`${billing.activeSubscriptions} active subscription${billing.activeSubscriptions === 1 ? '' : 's'}`}
          />
        </StaggerCard>
        <StaggerCard>
          <Stat
            label="Outstanding"
            value={formatMoney(billing.outstandingCents, billing.currency)}
            tone={billing.outstandingCents ? 'warn' : undefined}
            hint={billing.pastDue ? `${billing.pastDue} past due` : 'Open invoices'}
          />
        </StaggerCard>
      </StaggerGrid>

      <StaggerCard>
        <Panel
          className="p-5 md:p-6"
          title="Revenue by month"
          action={
            <p className="pc-legend m-0">
              <span>
                <i style={{ background: '#4a9eff' }} />
                Paid
              </span>
              <span>
                <i style={{ background: 'rgba(109,147,255,0.55)' }} />
                Outstanding
              </span>
            </p>
          }
        >
          <BarChart data={billing.monthly || []} />
        </Panel>
      </StaggerCard>

      <StaggerGrid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StaggerCard>
          <Stat label="Tenants" value={counts.organizations} animateValue={counts.organizations} />
        </StaggerCard>
        <StaggerCard>
          <Stat label="Modules" value={counts.modules} animateValue={counts.modules} />
        </StaggerCard>
        <StaggerCard>
          <Stat label="Org admins" value={counts.orgAdmins} animateValue={counts.orgAdmins} />
        </StaggerCard>
        <StaggerCard>
          <Stat label="Faculty" value={counts.faculty} animateValue={counts.faculty} />
        </StaggerCard>
        <StaggerCard>
          <Stat label="Students" value={counts.applicants} animateValue={counts.applicants} />
        </StaggerCard>
      </StaggerGrid>

      <StaggerCard>
        <Panel
          className="p-5 md:p-6"
          title="Service health"
          action={
            <p className="m-0 font-mono text-[0.68rem] tracking-wide text-[var(--pc-muted)] uppercase">
              Evaluated {formatWhen(data.evaluatedAt)}
            </p>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => {
              const up = service.status === 'up';
              const isDatastore = service.name === 'PostgreSQL' || service.name === 'Redis';
              return (
                <div key={service.name} className={`pc-service pc-service-animated ${up ? 'is-up' : 'is-down'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-2 font-semibold text-[var(--pc-text)]">
                      <Pulse on={up} tone={pingTone(service.latencyMs, up)} />
                      {service.name}
                    </p>
                    <p className="m-0 mt-1 text-sm text-[var(--pc-muted)]">{isDatastore ? 'Ping time' : 'Response'}</p>
                    <p className="m-0 mt-0.5 font-mono text-lg font-bold text-[var(--pc-text)]">
                      {up && service.latencyMs != null ? (
                        <AnimatedNumber value={service.latencyMs} format={(n) => `${Math.round(n)} ms`} />
                      ) : (
                        formatPing(service.latencyMs)
                      )}
                    </p>
                    <PingBar ms={service.latencyMs} up={up} />
                  </div>
                  <span className={`tag ${up ? 'tag-allied' : 'tag-nursing'}`}>{up ? 'Up' : 'Down'}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="API uptime" value={formatUptime(data.uptime?.seconds)} hint={`Started ${formatWhen(data.uptime?.startedAt)}`} />
            <Stat label="Memory RSS" value={`${memory.rssMb} MB`} hint={`Heap ${memory.heapMb} MB`} />
          </div>
        </Panel>
      </StaggerCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <StaggerCard>
          <Panel
            className="p-5 md:p-6"
            title="Request volume"
            action={
              <Link to={`${SUPER_BASE}/audit`} className="text-sm font-semibold text-[var(--pc-accent)]">
                Open traffic →
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Last hour" value={traffic.lastHour} animateValue={traffic.lastHour} />
              <Stat label="Last 24h" value={traffic.last24h} animateValue={traffic.last24h} />
              <Stat
                label="Errors 24h"
                value={traffic.errors24h}
                animateValue={traffic.errors24h}
                tone={traffic.errors24h ? 'warn' : undefined}
              />
            </div>
          </Panel>
        </StaggerCard>

        <StaggerCard>
          <Panel className="p-5 md:p-6" title="Runtime">
            <div className="grid gap-3">
              <div className="pc-service pc-service-animated is-up">
                <div>
                  <p className="m-0 text-[0.68rem] font-bold tracking-[0.16em] text-[var(--pc-muted)] uppercase">Backend</p>
                  <p className="mt-1 mb-0 text-lg font-bold text-[var(--pc-text)]">v{versions.backend}</p>
                  <p className="m-0 text-sm">Node {versions.node}</p>
                </div>
                <Pulse on />
              </div>
              <div className="pc-service pc-service-animated is-up">
                <div>
                  <p className="m-0 text-[0.68rem] font-bold tracking-[0.16em] text-[var(--pc-muted)] uppercase">Console</p>
                  <p className="mt-1 mb-0 text-lg font-bold text-[var(--pc-text)]">v{FRONTEND_VERSION}</p>
                  <p className="m-0 text-sm">Platform UI</p>
                </div>
                <Pulse on />
              </div>
            </div>
          </Panel>
        </StaggerCard>
      </div>

      <StaggerGrid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction to={`${SUPER_BASE}/organizations`} label="Tenants" hint="Manage campuses" icon={<IconBuildings />} />
        <QuickAction to={`${SUPER_BASE}/modules`} label="Catalog" hint="Departments & modules" icon={<IconSwitches />} />
        <QuickAction to={`${SUPER_BASE}/billing`} label="Billing" hint="Invoices & MRR" icon={<IconCard />} />
        <QuickAction to={`${SUPER_BASE}/audit`} label="Traffic" hint="API audit log" icon={<IconPulse />} />
      </StaggerGrid>

      {data.recent?.length > 0 && (
        <StaggerCard>
          <section>
            <h2>Recent tenants</h2>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Status</th>
                    <th>Entitlements</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((org, i) => (
                    <tr key={org.id} className="pc-table-row-animated" style={{ animationDelay: `${i * 40}ms` }}>
                      <td>
                        <Link to={`${SUPER_BASE}/organizations/${org.id}`}>{org.name}</Link>
                        <div className="font-mono text-[0.68rem] text-[var(--pc-muted)]">{org.slug}</div>
                      </td>
                      <td>
                        <span className={`tag ${org.status === 'active' ? 'tag-allied' : 'tag-nursing'}`}>{org.status}</span>
                        {org.isPublic ? <span className="tag tag-allied ml-2">Public</span> : null}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {(org.departments || []).length
                            ? org.departments.map((slug) => (
                                <span key={slug} className="pc-chip">
                                  {slug}
                                </span>
                              ))
                            : (org.modules || []).join(' · ') || 'None'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </StaggerCard>
      )}
    </div>
  );
}
