import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdmissionsBoard from '../../components/AdmissionsBoard';
import { getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import api from '../../api/client';

export default function AdminAdmissions() {
  const admin = getAdmin();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings')
      .then((res) => setOpen(Boolean(res.data?.admissionsOpen)))
      .catch(() => {});
  }, []);

  const toggle = async (next) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/admin/settings', { admissionsOpen: next }, { authScope: 'admin' });
      setOpen(Boolean(res.data?.admissionsOpen));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update admissions status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Admissions</span>
          <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Student records</h1>
          <p className="m-0 max-w-xl text-text-muted">
            Open or close public applications. Officers accept or reject submitted forms. Build the student form in
            Admission portal.
          </p>
        </div>
        <Link to={`${ADMIN_BASE}/admissions/form`} className="btn btn-primary text-sm">
          Edit admission portal
        </Link>
      </div>

      <div className="glass mb-8 flex flex-col justify-between gap-4 rounded-[1.6rem] p-6 sm:flex-row sm:items-center">
        <div>
          <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Public applications</p>
          <h3 className="mt-2 mb-1">{open ? 'Admissions are open' : 'Admissions are closed'}</h3>
          <p className="m-0 text-sm text-text-muted">
            {open
              ? 'Students can pick your institute and apply with your published form.'
              : 'Your institute is hidden from the apply picker until you open admissions again.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn py-2.5 text-sm ${open ? 'btn-primary' : 'btn-outline'}`}
            disabled={saving || open}
            onClick={() => toggle(true)}
          >
            Open
          </button>
          <button
            type="button"
            className={`btn py-2.5 text-sm ${!open ? 'btn-primary' : 'btn-outline'}`}
            disabled={saving || !open}
            onClick={() => toggle(false)}
          >
            Close
          </button>
        </div>
      </div>
      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}

      <AdmissionsBoard authScope="admin" role={admin?.role || 'admin'} />
    </div>
  );
}
