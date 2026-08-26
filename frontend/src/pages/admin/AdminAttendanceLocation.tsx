import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { ADMIN_BASE } from '../../admin/paths';
import CampusMapPicker from '../../components/CampusMapPicker';

const adminReq = { authScope: 'admin' as const };

export default function AdminAttendanceLocation() {
  const [enabled, setEnabled] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(250);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const loadCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location access.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setNotice('Current location loaded. Save to apply.');
        setLocating(false);
      },
      (err) => {
        setError(err.message || 'Could not read your current location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const load = async () => {
    try {
      const res = await api.get('/admin/attendance/location', adminReq);
      setEnabled(Boolean(res.data?.attendanceLocationEnabled));
      setLatitude(res.data?.latitude ?? res.data?.location?.latitude ?? null);
      setLongitude(res.data?.longitude ?? res.data?.location?.longitude ?? null);
      setRadiusMeters(Number(res.data?.radiusMeters) || 250);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load campus location settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(
        '/admin/attendance/location',
        {
          attendanceLocationEnabled: enabled,
          latitude,
          longitude,
          radiusMeters,
        },
        adminReq
      );
      setEnabled(Boolean(res.data?.attendanceLocationEnabled));
      setLatitude(res.data?.latitude ?? null);
      setLongitude(res.data?.longitude ?? null);
      setRadiusMeters(Number(res.data?.radiusMeters) || 250);
      setNotice('Campus location settings saved.');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not save campus location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <span className="eyebrow">Student attendance</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Campus location</h1>
      <p className="mb-6 max-w-2xl text-text-muted">
        When enabled, students must be inside the selected area on their phone when scanning a class QR code. Faculty and
        admins can see whether each present mark was on campus.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link to={`${ADMIN_BASE}/attendance/students`} className="btn btn-outline py-2.5 text-sm">
          Back to roster
        </Link>
      </div>

      {error && (
        <p className="mb-5 rounded-2xl bg-crimson-pale px-4 py-3 text-sm font-bold text-crimson-dark">{error}</p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-cardinal-pale px-4 py-3 text-sm font-bold text-cardinal">{notice}</p>
      )}

      {loading ? (
        <div className="glass rounded-[1.6rem] p-10 text-center text-text-muted">Loading map…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CampusMapPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            onPick={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <aside className="glass h-fit rounded-[1.6rem] p-6">
            <label className="mb-5 flex items-start gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#0f5c5c]"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>
                Require location when scanning QR
                <small className="mt-1 block font-normal text-text-muted">
                  Mobile sends GPS with each scan. Marks outside the radius are rejected.
                </small>
              </span>
            </label>

            <label className="mb-4 flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Allowed radius (meters)
              <input
                type="number"
                min={25}
                max={5000}
                step={25}
                className="field"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Math.max(25, Number(e.target.value) || 250))}
              />
            </label>

            <div className="mb-5 rounded-2xl bg-bg-alt px-4 py-3 text-sm text-text-muted">
              <p className="m-0">
                <strong className="text-ink">Pin</strong>
                <br />
                {latitude != null && longitude != null
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : 'Tap the map or use your current location.'}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline mb-3 w-full py-2.5 text-sm"
              disabled={locating || saving}
              onClick={loadCurrentLocation}
            >
              {locating ? 'Getting location…' : 'Use my current location'}
            </button>

            <button type="button" className="btn btn-primary w-full" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save campus location'}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
