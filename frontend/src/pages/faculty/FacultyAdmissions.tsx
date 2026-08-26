import AdmissionsBoard from '../../components/AdmissionsBoard';
import { Navigate } from 'react-router-dom';
import { getStaff } from '../../auth/staffSession';
import { isReadOnlyAdmissions, isTeacher, roleLabel, staffHome, canDecideAdmissions } from '../../data/roles';

export default function FacultyAdmissions() {
  const staff = getStaff();
  if (isTeacher(staff?.role) || !staff?.modules?.includes('admissions')) {
    return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
  }
  return (
    <div>
      <span className="eyebrow">Admissions</span>
      <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Student records</h1>
      <p className="mb-8 max-w-xl text-text-muted">
        Signed in as {roleLabel(staff?.role)}.
        {isReadOnlyAdmissions(staff?.role)
          ? ' You can read applications only.'
          : canDecideAdmissions(staff?.role)
            ? ' You can accept, reject, and change decisions for applicants.'
            : ' You can read applications only.'}
      </p>
      <AdmissionsBoard authScope="staff" role={staff?.role} />
    </div>
  );
}
