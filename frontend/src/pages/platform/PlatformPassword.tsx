import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getPlatform, signOutPlatform } from '../../auth/platformSession';
import { SUPER_BASE } from '../../admin/paths';
import ChangePasswordForm from '../../components/ChangePasswordForm';
import { PageHead } from './ui';

export default function PlatformPassword() {
  const navigate = useNavigate();
  const account = getPlatform();

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
    </div>
  );
}
