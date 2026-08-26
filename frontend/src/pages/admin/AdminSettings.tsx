import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getAdmin, signOutAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import ChangePasswordForm from '../../components/ChangePasswordForm';

export default function AdminSettings() {
  const navigate = useNavigate();
  const admin = getAdmin();

  return (
    <div>
      <span className="eyebrow">Account</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Change password</h1>
      <p className="mb-8 max-w-2xl text-text-muted">
        Update the password for this admin account. You will stay signed in after it saves.
      </p>
      <ChangePasswordForm
        accountName={admin?.name || 'Administrator'}
        accountEmail={admin?.email}
        note="Faculty accounts change their own password in the faculty portal. You can also reset a faculty password from Access."
        onSubmit={async ({ currentPassword, newPassword }) => {
          const res = await api.put(
            '/admin/password',
            { currentPassword, newPassword },
            { authScope: 'admin' }
          );
          return res.data?.message || 'Password updated. You can keep working in this session.';
        }}
        onAuthError={() => {
          signOutAdmin();
          navigate(ADMIN_BASE, { replace: true });
        }}
      />
    </div>
  );
}
