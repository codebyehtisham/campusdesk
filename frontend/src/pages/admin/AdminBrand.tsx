import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getAdmin, signInAdmin, signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import BrandMark from '../../components/BrandMark';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';
const adminReq = { authScope: 'admin' };

export default function AdminBrand() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', tagline: '', logo: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const kickOut = () => {
    signOutAdmin();
    navigate(ADMIN_BASE, { replace: true });
  };

  const applyOrg = (org) => {
    setForm({
      title: org?.title || org?.name || '',
      tagline: org?.tagline || '',
      logo: org?.logo || '',
    });
    const current = getAdmin();
    if (current && org) {
      signInAdmin({ ...current, organization: { ...current.organization, ...org }, modules: org.modules || current.modules });
    }
  };

  useEffect(() => {
    api
      .get('/admin/me', adminReq)
      .then((res) => applyOrg(res.data?.organization))
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/admin/brand', { title: form.title.trim(), tagline: form.tagline.trim() }, adminReq);
      applyOrg({ ...getAdmin()?.organization, ...res.data });
      setNotice('Title text is live on the public site and campus logins.');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const logo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
      const res = await api.post('/admin/brand/logo', { logo }, adminReq);
      applyOrg({ ...getAdmin()?.organization, ...res.data });
      setNotice('Logo updated. It now appears with this organisation.');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        kickOut();
        return;
      }
      setError(err.response?.data?.message || 'Could not upload the logo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <span className="eyebrow">Organisation</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Brand</h1>
      <p className="mb-8 max-w-xl text-text-muted">
        Logo and title text belong to this organisation. They show on the public site, org admin, and faculty portal.
      </p>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={handleSubmit} className="glass rounded-[1.6rem] p-6 md:p-8">
          <label className={labelClass}>
            Title text
            <input
              className="field"
              required
              maxLength={80}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <span className="font-medium text-text-muted">Shown next to the logo in the header and logins.</span>
          </label>
          <label className={`${labelClass} mt-4`}>
            Tagline
            <input
              className="field"
              maxLength={80}
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="Optional second line"
            />
          </label>
          <label className={`${labelClass} mt-4`}>
            Logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={handleLogo} className="field" />
            <span className="font-medium text-text-muted">PNG, JPG, WEBP, GIF, or SVG. Up to 1.5 MB.</span>
          </label>
          <button type="submit" className="btn btn-primary mt-6" disabled={saving}>
            {saving ? 'Saving…' : 'Save title'}
          </button>
        </form>

        <aside className="glass h-fit rounded-[1.6rem] p-6">
          <p className="m-0 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Preview</p>
          <div className="mt-4 flex items-center gap-3">
            <BrandMark org={form} size={56} />
            <span className="leading-tight">
              <strong className="block font-serif text-lg font-bold tracking-tight text-ink">{form.title || 'Title'}</strong>
              {form.tagline ? <small className="text-text-muted">{form.tagline}</small> : null}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
