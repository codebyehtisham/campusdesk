import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import ChangePasswordForm from '../../components/ChangePasswordForm';
import { Banner, PageHead, Toast } from './ui';

const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-ink';

export default function PlatformPassword() {
  const navigate = useNavigate();
  const account = getPlatform();
  const [trialForm, setTrialForm] = useState({
    trialDays: 14,
    trialMaxAdmins: 1,
    trialMaxFaculty: 2,
    trialMaxStudents: 1,
  });
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialNotice, setTrialNotice] = useState('');
  const [trialError, setTrialError] = useState('');

  const kickOut = () => {
    signOutPlatform();
    navigate(SUPER_BASE, { replace: true });
  };

  useEffect(() => {
    api
      .get('/platform/trial-settings', { authScope: 'platform' })
      .then((res) => {
        if (res.data) setTrialForm(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) kickOut();
        else setTrialError(err.response?.data?.message || 'Could not load trial settings.');
      });
  }, []);

  const saveTrial = async (e) => {
    e.preventDefault();
    setTrialSaving(true);
    setTrialNotice('');
    try {
      const res = await api.put('/platform/trial-settings', trialForm, { authScope: 'platform' });
      setTrialForm(res.data);
      setTrialNotice('Trial defaults saved. New trial institutes use these limits.');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return kickOut();
      setTrialNotice(err.response?.data?.message || 'Could not save trial settings.');
    } finally {
      setTrialSaving(false);
    }
  };

  return (
    <div>
      <PageHead
        kicker="Access"
        title="Operator credentials"
        hint="Update the password for this superuser account. You stay signed in after it saves."
      />
      <ChangePasswordForm
        accountName={account?.name || 'Superuser'}
        accountEmail={account?.email}
        note="Organisation admins change their passwords in /org-admin. Faculty use /faculty-portal."
        onSubmit={async ({ currentPassword, newPassword }) => {
          const res = await api.put(
            '/platform/password',
            { currentPassword, newPassword },
            { authScope: 'platform' }
          );
          return res.data?.message || 'Password updated.';
        }}
        onAuthError={() => {
          signOutPlatform();
          navigate(SUPER_BASE, { replace: true });
        }}
      />

      <section className="pc-panel mt-8">
        <PageHead
          kicker="Trials"
          title="Trial institute defaults"
          hint="Applied when you provision a new trial tenant. Limits cap org admins, faculty, and students for the trial period."
        />
        <Banner>{trialError}</Banner>
        <Toast>{trialNotice}</Toast>
        <form onSubmit={saveTrial} className="mt-4 grid max-w-xl gap-4">
          <label className={labelClass}>
            Trial period (days)
            <input
              type="number"
              min={1}
              className="field"
              value={trialForm.trialDays}
              onChange={(e) => setTrialForm((f) => ({ ...f, trialDays: Number(e.target.value) }))}
            />
          </label>
          <label className={labelClass}>
            Max org admins
            <input
              type="number"
              min={0}
              className="field"
              value={trialForm.trialMaxAdmins}
              onChange={(e) => setTrialForm((f) => ({ ...f, trialMaxAdmins: Number(e.target.value) }))}
            />
          </label>
          <label className={labelClass}>
            Max faculty members
            <input
              type="number"
              min={0}
              className="field"
              value={trialForm.trialMaxFaculty}
              onChange={(e) => setTrialForm((f) => ({ ...f, trialMaxFaculty: Number(e.target.value) }))}
            />
          </label>
          <label className={labelClass}>
            Max students
            <input
              type="number"
              min={0}
              className="field"
              value={trialForm.trialMaxStudents}
              onChange={(e) => setTrialForm((f) => ({ ...f, trialMaxStudents: Number(e.target.value) }))}
            />
          </label>
          <button type="submit" className="btn btn-primary w-fit" disabled={trialSaving}>
            {trialSaving ? 'Saving…' : 'Save trial defaults'}
          </button>
        </form>
      </section>
    </div>
  );
}
