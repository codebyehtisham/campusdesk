import AdmissionsBoard from '../../components/AdmissionsBoard';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getStaff } from '../../auth/staffSession';
import { isReadOnlyAdmissions, isTeacher, roleLabel, staffHome, canDecideAdmissions } from '../../data/roles';

const ease = [0.22, 1, 0.36, 1] as const;

export default function FacultyAdmissions() {
  const staff = getStaff();
  if (isTeacher(staff?.role) || !staff?.modules?.includes('admissions')) {
    return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
  }

  const canDecide = canDecideAdmissions(staff?.role);
  const readOnly = isReadOnlyAdmissions(staff?.role);

  return (
    <div>
      <motion.section
        className="admit-hero mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
      >
        <span className="eyebrow">Admissions</span>
        <h1 className="admit-title m-0">Student applications</h1>
        <p className="m-0 mt-2 max-w-2xl text-text-muted">
          Review submitted forms, preview uploaded documents, and make enrollment decisions — all in one workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="admit-badge">{roleLabel(staff?.role)}</span>
          {canDecide ? (
            <span className="admit-badge is-live">Can accept & reject</span>
          ) : readOnly ? (
            <span className="admit-badge is-muted">View only</span>
          ) : null}
        </div>
      </motion.section>

      <AdmissionsBoard authScope="staff" role={staff?.role} />
    </div>
  );
}
