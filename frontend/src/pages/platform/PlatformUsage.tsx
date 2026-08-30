import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import { formatBytes } from './money';
import { Banner, PageHead } from './ui';

export default function PlatformUsage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  useEffect(() => {
    api
      .get('/platform/usage', { authScope: 'platform' })
      .then((res) => {
        setRows(Array.isArray(res.data) ? res.data : []);
        setError('');
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
        setError(err.response?.data?.message || 'Could not load fleet usage.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div>
      <PageHead
        kicker="Operations"
        title="Usage metering"
        hint="Today's API calls, seat counts, and storage estimates per tenant for billing."
      />
      <Banner>{error}</Banner>
      {loading ? (
        <div className="pc-panel p-10 text-center">Loading fleet usage…</div>
      ) : (
        <div className="pc-panel overflow-x-auto p-0">
          <table className="pc-table w-full min-w-[640px]">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>API calls (today)</th>
                <th>Seats</th>
                <th>Storage est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.organizationId}>
                  <td>
                    <Link to={`${SUPER_BASE}/organizations/${row.organizationId}`} className="font-semibold text-[var(--pc-accent)]">
                      {row.name}
                    </Link>
                    <p className="m-0 font-mono text-[0.65rem] text-[var(--pc-muted)]">{row.slug}</p>
                  </td>
                  <td>{row.apiCalls}</td>
                  <td>{row.seatCount}</td>
                  <td>{formatBytes(row.storageBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-6 text-center text-sm text-[var(--pc-muted)]">No usage recorded yet.</p> : null}
        </div>
      )}
    </div>
  );
}
