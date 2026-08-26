import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getStaff, signOutStaff } from '../../auth/staffSession';
import { FACULTY_BASE } from '../../admin/paths';
import { roleLabel } from '../../data/roles';
import ChangePasswordForm from '../../components/ChangePasswordForm';

export default function FacultyPassword() {
  const navigate = useNavigate();
  const staff = getStaff();

  return (
    <div>
      <span className="eyebrow">Account</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Change password</h1>
      <p className="mb-8 max-w-2xl text-text-muted">
        Update the password for your {(roleLabel(staff?.role) || 'faculty').toLowerCase()} account. You will stay signed in after it saves.
      </p>
      <ChangePasswordForm
        accountName={staff?.name || 'Faculty'}
        accountEmail={staff?.email}
        note="If you cannot sign in later, ask an administrator to unblock your account or set a new password."
        onSubmit={async ({ currentPassword, newPassword }) => {
          const res = await api.put(
            '/staff/password',
            { currentPassword, newPassword },
            { authScope: 'staff' }
          );
          return res.data?.message || 'Password updated. You can keep working in this session.';
        }}
        onAuthError={() => {
          signOutStaff();
          navigate(FACULTY_BASE, { replace: true });
        }}
      />
    </div>
  );
}
