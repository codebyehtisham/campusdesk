import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { Banner, Drawer, PageHead } from './ui';

const formatWhere = (location) => {
  if (!location) return '—';
  return [location.city, location.region, location.country].filter(Boolean).join(', ') || '—';
};

const pretty = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const orgLabel = (organization) => {
  if (!organization) return 'No organisation';
  if (typeof organization === 'object') return organization.name || organization.slug || 'Organisation';
  return 'Organisation';
};

export default function PlatformAudit() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [orgs, setOrgs] = useState([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);

  const kick = (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      signOutPlatform();
      navigate(SUPER_BASE, { replace: true });
      return true;
    }
    return false;
  };

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await api.get('/platform/audit', {
        authScope: 'platform',
        params: {
          page: nextPage,
          limit: 25,
          q: q || undefined,
          method: method || undefined,
          role: role || undefined,
          organization: organization || undefined,
        },
      });
      setData(res.data);
      setError('');
    } catch (err) {
      if (kick(err)) return;
      setError(err.response?.data?.message || 'Could not load traffic.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get('/platform/organizations', { authScope: 'platform' })
      .then((res) => setOrgs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setOrgs([]));
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [method, role, organization]);

  const search = (e) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  const openRow = async (id) => {
    try {
      const res = await api.get(`/platform/audit/${id}`, { authScope: 'platform' });
      setActive(res.data);
    } catch {
      setActive(data.items.find((item) => item._id === id || item.id === id) || null);
    }
  };

  return (
    <div>
      <PageHead
        kicker="Traffic"
        title="API audit"
        hint="Every request across all tenants: method, URL, headers, body, response, IP, and location. Passwords and tokens are stored as [redacted]."
      />

      <form onSubmit={search} className="mb-5 flex flex-col gap-3 lg:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search URL, IP, city, or actor"
          className="field flex-1"
        />
        <select value={organization} onChange={(e) => setOrganization(e.target.value)} className="field lg:w-56">
          <option value="">All tenants</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="field lg:w-40">
          <option value="">All methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="field lg:w-44">
          <option value="">All roles</option>
          {['superadmin', 'admin', 'teacher', 'officer', 'reviewer', 'reader', 'viewer', 'applicant', 'anonymous'].map(
            (item) => (
              <option key={item} value={item}>
                {item}
              </option>
            )
          )}
        </select>
        <button type="submit" className="btn btn-primary py-3">
          Search
        </button>
        <button type="button" className="btn btn-outline py-3" onClick={() => load(page)}>
          Refresh
        </button>
      </form>

      <Banner>{error}</Banner>

      <p className="mb-3 font-mono text-[0.72rem] tracking-wide text-[var(--pc-muted)] uppercase">
        {data.total} records
      </p>

      {loading ? (
        <div className="pc-panel p-10 text-center">Loading traffic…</div>
      ) : data.items.length === 0 ? (
        <div className="pc-panel p-10 text-center">
          <h3>No requests yet</h3>
          <p className="m-0">Browse the site or use a portal, then refresh this list.</p>
        </div>
      ) : (
        <div className="pc-table-wrap">
          {data.items.map((item) => (
            <button
              key={item._id || item.id}
              type="button"
              className="pc-row"
              onClick={() => openRow(item._id || item.id)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-allied">{item.method}</span>
                <span className={`tag ${item.statusCode >= 400 ? 'tag-nursing' : 'tag-allied'}`}>{item.statusCode}</span>
                <span className="font-mono text-[0.7rem] text-[var(--pc-muted)]">{item.durationMs}ms</span>
                <span className="tag tag-allied">{orgLabel(item.organization)}</span>
              </div>
              <p className="mt-2 mb-0 font-mono text-[0.82rem] break-all text-[var(--pc-text)]">{item.url}</p>
              <p className="m-0 text-xs text-[var(--pc-muted)]">
                {item.ip || '—'} · {formatWhere(item.location)}
                {item.actor?.email ? ` · ${item.actor.email}` : item.actor?.role ? ` · ${item.actor.role}` : ''} ·{' '}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {data.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn btn-outline py-2.5 text-sm"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              load(next);
            }}
          >
            Previous
          </button>
          <span className="font-mono text-sm text-[var(--pc-muted)]">
            {data.page} / {data.pages}
          </span>
          <button
            type="button"
            className="btn btn-outline py-2.5 text-sm"
            disabled={page >= data.pages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next);
            }}
          >
            Next
          </button>
        </div>
      )}

      <Drawer
        open={Boolean(active)}
        onClose={() => setActive(null)}
        kicker="Request"
        title={active ? `${active.method} ${active.url}` : ''}
        widthClass="max-w-xl"
      >
        {active && (
          <>
            <p className="text-sm">
              {orgLabel(active.organization)} · {active.ip} · {formatWhere(active.location)} · {active.statusCode} ·{' '}
              {active.durationMs}ms
            </p>
            {active.actor?.email && (
              <p className="text-sm">
                Signed in as {active.actor.email} ({active.actor.role})
              </p>
            )}
            <p className="text-sm">{active.userAgent}</p>
            {[
              ['Query', active.query],
              ['Headers', active.headers],
              ['Request body', active.requestBody],
              ['Response', active.responseBody],
            ].map(([label, value]) => (
              <div key={label} className="mt-6">
                <p className="mb-2 text-sm font-bold text-[var(--pc-text)]">{label}</p>
                <pre className="overflow-x-auto rounded-[10px] border border-[var(--pc-line)] bg-[var(--pc-input)] p-4 text-xs whitespace-pre-wrap">
                  {pretty(value)}
                </pre>
              </div>
            ))}
            <button type="button" className="btn btn-outline mt-8" onClick={() => setActive(null)}>
              Close
            </button>
          </>
        )}
      </Drawer>
    </div>
  );
}
