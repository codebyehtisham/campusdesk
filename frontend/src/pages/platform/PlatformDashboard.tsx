import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { FRONTEND_VERSION } from '../../version';
import { Banner, PageHead, Pulse, Stat } from './ui';
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

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/platform/dashboard', { authScope: 'platform' });
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
      <PageHead
        kicker="Control plane"
        title="Operations"
        hint="Revenue, tenant count, service health, and request volume across the platform."
        actions={
          <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <Banner>{error}</Banner>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total revenue" value={formatMoney(billing.totalPaidCents, billing.currency)} hint="All paid invoices" />
        <Stat label="This month" value={formatMoney(billing.monthPaidCents, billing.currency)} />
        <Stat label="MRR" value={formatMoney(billing.mrrCents, billing.currency)} hint={`${billing.activeSubscriptions} active subscription${billing.activeSubscriptions === 1 ? '' : 's'}`} />
        <Stat
          label="Outstanding"
          value={formatMoney(billing.outstandingCents, billing.currency)}
          tone={billing.outstandingCents ? 'warn' : undefined}
          hint={billing.pastDue ? `${billing.pastDue} past due` : 'Open invoices'}
        />
      </div>

      <section className="pc-panel p-5 md:p-6">
        <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="m-0">Revenue by month</h2>
          <p className="pc-legend m-0">
            <span><i style={{ background: '#4a9eff' }} />Paid</span>
            <span><i style={{ background: 'rgba(109,147,255,0.55)' }} />Outstanding</span>
          </p>
        </div>
        <BarChart data={billing.monthly || []} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Tenants" value={counts.organizations} />
        <Stat label="Modules" value={counts.modules} />
        <Stat label="Org admins" value={counts.orgAdmins} />
        <Stat label="Faculty" value={counts.faculty} />
        <Stat label="Students" value={counts.applicants} />
      </div>

      <section className="pc-panel p-5 md:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="m-0">Service health</h2>
          <p className="m-0 font-mono text-[0.68rem] tracking-wide text-[var(--pc-muted)] uppercase">
            Evaluated {formatWhen(data.evaluatedAt)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const up = service.status === 'up';
            return (
              <div key={service.name} className="pc-service">
                <div>
                  <p className="m-0 flex items-center gap-2 font-semibold text-[var(--pc-text)]">
                    <Pulse on={up} tone={up ? 'live' : 'warn'} />
                    {service.name}
                  </p>
                  <p className="m-0 mt-1 text-sm">
                    {service.latencyMs == null ? 'No response' : `${service.latencyMs}ms`}
                  </p>
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
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="pc-panel p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0">Request volume</h2>
            <Link to={`${SUPER_BASE}/audit`} className="text-sm font-semibold text-[var(--pc-accent)]">
              Open traffic →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Last hour" value={traffic.lastHour} />
            <Stat label="Last 24h" value={traffic.last24h} />
            <Stat label="Errors 24h" value={traffic.errors24h} tone={traffic.errors24h ? 'warn' : undefined} />
          </div>
        </section>

        <section className="pc-panel p-5 md:p-6">
          <h2>Runtime</h2>
          <div className="grid gap-3">
            <div className="pc-service">
              <div>
                <p className="m-0 text-[0.68rem] font-bold tracking-[0.16em] text-[var(--pc-muted)] uppercase">Backend</p>
                <p className="mt-1 mb-0 text-lg font-bold text-[var(--pc-text)]">v{versions.backend}</p>
                <p className="m-0 text-sm">Node {versions.node}</p>
              </div>
              <Pulse on />
            </div>
            <div className="pc-service">
              <div>
                <p className="m-0 text-[0.68rem] font-bold tracking-[0.16em] text-[var(--pc-muted)] uppercase">Console</p>
                <p className="mt-1 mb-0 text-lg font-bold text-[var(--pc-text)]">v{FRONTEND_VERSION}</p>
                <p className="m-0 text-sm">Platform UI</p>
              </div>
              <Pulse on />
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to={`${SUPER_BASE}/modules`} className="btn btn-primary">
          Catalog
        </Link>
        <Link to={`${SUPER_BASE}/billing`} className="btn btn-outline">
          Billing
        </Link>
        <Link to={`${SUPER_BASE}/organizations`} className="btn btn-outline">
          Tenants
        </Link>
        <Link to={`${SUPER_BASE}/audit`} className="btn btn-outline">
          Traffic log
        </Link>
      </div>

      {data.recent?.length > 0 && (
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
                {data.recent.map((org) => (
                  <tr key={org.id}>
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
      )}
    </div>
  );
}
