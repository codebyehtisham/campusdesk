import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { Banner, PageHead, Stat } from './ui';
import { BarChart } from './BarChart';
import { formatDate, formatMoney } from './money';

const empty = {
  currency: 'USD',
  totalPaidCents: 0,
  monthPaidCents: 0,
  outstandingCents: 0,
  mrrCents: 0,
  activeSubscriptions: 0,
  pastDue: 0,
  monthly: [],
  plans: [],
  tenants: [],
  subscriptions: [],
  invoices: [],
};

export default function PlatformBilling() {
  const navigate = useNavigate();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tenantId, setTenantId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/platform/billing', { authScope: 'platform' });
      const next = { ...empty, ...res.data };
      setData(next);
      setTenantId((current) => current || next.tenants?.[0]?.id || '');
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOutPlatform();
        navigate(SUPER_BASE, { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not load billing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tenant = (data.tenants || []).find((item) => item.id === tenantId) || data.tenants?.[0];
  const preview = tenant?.preview;

  const generateInvoice = async (status = 'open') => {
    if (!tenant?.id) return;
    setGenerating(true);
    try {
      const res = await api.post(
        `/platform/organizations/${tenant.id}/invoices/generate`,
        { status },
        { authScope: 'platform' }
      );
      setNotice(`${res.data?.invoice?.number || 'Invoice'} generated · ${preview?.quantity || 0} modules × $5.`);
      await load();
      setTenantId(tenant.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        kicker="Billing"
        title="Billing"
        hint="Generate invoices at $5 per enabled module. Subscriptions and collected revenue stay on this screen."
        actions={
          <button type="button" className="btn btn-outline py-2.5 text-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />
      <Banner>{error}</Banner>
      {notice ? <p className="pc-banner" style={{ borderColor: 'var(--pc-live)' }}>{notice}</p> : null}

      <section className="pc-panel p-5 md:p-6">
        <div className="pc-head mb-4">
          <div>
            <h2 className="m-0">Generate invoice</h2>
            <p className="pc-hint">Each live module on a campus is billed at $5. Choose a tenant, review the lines, then issue the invoice.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-start">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--pc-text)]">
            Tenant
            <select className="field" value={tenant?.id || ''} onChange={(e) => setTenantId(e.target.value)}>
              {(data.tenants || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="m-0 text-2xl font-bold text-[var(--pc-text)]">
              {formatMoney(preview?.amountCents, preview?.currency || data.currency)}
              <span className="ml-2 text-sm font-medium text-[var(--pc-muted)]">
                {preview?.quantity || 0} × $5
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(preview?.lines || []).length ? (
                preview.lines.map((line) => (
                  <span key={line.slug} className="pc-chip is-on">
                    {line.name} · $5
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--pc-muted)]">No modules enabled on this campus.</span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary py-2 text-sm"
                disabled={generating || !preview?.quantity}
                onClick={() => generateInvoice('open')}
              >
                {generating ? 'Generating…' : 'Generate invoice'}
              </button>
              <button
                type="button"
                className="btn btn-outline py-2 text-sm"
                disabled={generating || !preview?.quantity}
                onClick={() => generateInvoice('paid')}
              >
                Generate and mark paid
              </button>
              {tenant?.id && (
                <Link to={`${SUPER_BASE}/organizations/${tenant.id}`} className="btn btn-outline py-2 text-sm">
                  Open tenant
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total revenue" value={formatMoney(data.totalPaidCents, data.currency)} hint="All paid invoices" />
        <Stat label="This month" value={formatMoney(data.monthPaidCents, data.currency)} />
        <Stat
          label="MRR"
          value={formatMoney(data.mrrCents, data.currency)}
          hint={`${data.activeSubscriptions} active subscription${data.activeSubscriptions === 1 ? '' : 's'}`}
        />
        <Stat
          label="Outstanding"
          value={formatMoney(data.outstandingCents, data.currency)}
          tone={data.outstandingCents ? 'warn' : undefined}
          hint={data.pastDue ? `${data.pastDue} past due` : 'Open invoices'}
        />
      </div>

      <section className="pc-panel p-5 md:p-6">
        <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="m-0">Revenue by month</h2>
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
        </div>
        <BarChart data={data.monthly || []} />
      </section>

      <section>
        <h2>Plans</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(data.plans || []).map((plan) => (
            <article key={plan.id} className="pc-panel p-5">
              <p className="pc-kicker mb-1">{plan.slug}</p>
              <h3 className="mt-0 mb-1">{plan.name}</h3>
              <p className="m-0 text-2xl font-bold text-[var(--pc-text)]">
                {formatMoney(plan.amountCents, plan.currency)}
                <span className="ml-1 text-sm font-medium text-[var(--pc-muted)]">/ {plan.interval}</span>
              </p>
              <p className="mt-2 mb-0 text-sm">{plan.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Tenant subscriptions</h2>
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data.subscriptions || []).length ? (
                data.subscriptions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`${SUPER_BASE}/organizations/${item.organizationId}`}>{item.organization?.name}</Link>
                      <div className="font-mono text-[0.68rem] text-[var(--pc-muted)]">{item.organization?.slug}</div>
                    </td>
                    <td>{item.plan?.name || 'Custom'}</td>
                    <td>
                      {formatMoney(item.amountCents, item.currency)} / {item.interval}
                    </td>
                    <td>
                      <span className={`tag ${item.status === 'active' ? 'tag-allied' : 'tag-nursing'}`}>{item.status}</span>
                    </td>
                    <td>
                      <Link to={`${SUPER_BASE}/organizations/${item.organizationId}`} className="text-sm font-semibold text-[var(--pc-accent)]">
                        Payments →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-[var(--pc-muted)]">
                    No subscriptions yet. Open a tenant and start one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Recent invoices</h2>
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tenant</th>
                <th>Issued</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.invoices || []).length ? (
                data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.number}</strong>
                      <div className="font-mono text-[0.68rem] text-[var(--pc-muted)]">{invoice.method}</div>
                    </td>
                    <td>
                      <Link to={`${SUPER_BASE}/organizations/${invoice.organizationId}`}>{invoice.organization?.name}</Link>
                    </td>
                    <td>{formatDate(invoice.issuedAt)}</td>
                    <td>{formatMoney(invoice.amountCents, invoice.currency)}</td>
                    <td>
                      <span className={`tag ${invoice.status === 'paid' ? 'tag-allied' : 'tag-nursing'}`}>{invoice.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-[var(--pc-muted)]">
                    No invoices recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
